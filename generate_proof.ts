import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { Semaphore, StrBigInt } from "@zk-kit/protocols";
import { BigNumber } from "ethers";
import { AUTH_TOKEN, CREDENTIAL_TYPE, GROUP_ID, SEQUENCER_URI } from "./const";
import { defaultAbiCoder as abi } from "ethers/lib/utils";
import { generateExternalNullifier, hashToField } from "./idkit.help";
import { verifyProof } from "./utils";

const APP_ID = "app_staging_6d1c9fb86751a40d9527490eafbdb1c1"; // not used in the proof
const ACTION = 0;
const SIGNAL = "0x0000000000000000000000000000000000000000"; //wallet address

interface MerkleTreeResponse {
  root: string;
  proof: { Left?: string; Right?: string }[];
}

const main = async (args: string[]): Promise<void> => {
  let rawId: string | undefined = undefined;
  let noVerify = false;

  if (!AUTH_TOKEN) {
    console.error("❌ no auth token provided, bye!");
    return;
  }

  for (const arg of args.slice(2)) {
    if (arg === "--id") {
      rawId = args[args.indexOf(arg) + 1];
    }

    if (arg === "--no-verify") {
      noVerify = true;
    }
  }

  if (!rawId) {
    console.error("❌ no identity provided, bye!");
    return;
  }

  const newIdentity = new ZkIdentity(Strategy.SERIALIZED, JSON.parse(rawId));
  const identityCommitment = newIdentity.genIdentityCommitment();
  const trapdoor = newIdentity.getTrapdoor();
  const nullifier = newIdentity.getNullifier();

  const encodedCommitment =
    "0x" + identityCommitment.toString(16).padStart(64, "0");

  console.log(
    `ℹ️ retrieve idComm, fetching inclusion proof: ${encodedCommitment}`
  );

  const wasmFilePath = "./semaphore/semaphore.wasm";
  const finalZkeyPath = "./semaphore/semaphore_final.zkey";

  const response = await fetch(`${SEQUENCER_URI}inclusionProof`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${AUTH_TOKEN}`,
    },
    body: JSON.stringify([GROUP_ID, encodedCommitment]),
  });

  let merkleTree: MerkleTreeResponse | undefined;

  if (response.ok) {
    if (response.status === 202) {
      console.warn(
        "🤔 inclusion proof not ready yet, try again in a few seconds"
      );
      return;
    } else {
      console.log("ℹ️ inclusion proof fetched, continuing...");
    }
    merkleTree = await response.json();
  } else {
    console.error("❌ no bueno, could not fetch inclusion proof.");
    console.log(await response.text());
    return;
  }

  const siblings = merkleTree?.proof
    .flatMap((v) => Object.values(v))
    .map((v) => BigNumber.from(v).toBigInt());

  const pathIndices = merkleTree?.proof
    .flatMap((v) => Object.keys(v))
    .map((v) => (v === "Left" ? 0 : 1));

  const merkleProof = {
    root: null,
    leaf: null,
    siblings: siblings,
    pathIndices: pathIndices,
  };

  const signalHash = hashToField(SIGNAL).hash;
  const externalNullifier = ACTION; //generateExternalNullifier(APP_ID, ACTION).hash;

  const witness = {
    identityNullifier: nullifier,
    identityTrapdoor: trapdoor,
    treePathIndices: merkleProof.pathIndices,
    treeSiblings: merkleProof.siblings as StrBigInt[],
    externalNullifier,
    signalHash,
  };

  const fullProof = await Semaphore.genProof(
    witness,
    wasmFilePath,
    finalZkeyPath
  );

  const nullifierHash = abi.encode(
    ["uint256"],
    [fullProof.publicSignals.nullifierHash]
  );

  const packedProof = abi.encode(
    ["uint256[8]"],
    [Semaphore.packToSolidityProof(fullProof.proof)]
  );

  console.log("🔑 proof generated!");
  console.log({
    nullifierHash,
    packed_proof: packedProof,
    proof: Semaphore.packToSolidityProof(fullProof.proof),
    merkle_root: merkleTree?.root,
  });

  if (!noVerify) {
    await verifyProof(fullProof.proof, fullProof.publicSignals);

    console.log("Verifying proof with smart contract...");

    const verifyResponse = await fetch(
      `https://developer.worldcoin.org/api/v1/verify/${APP_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nullifier_hash: nullifierHash,
          proof: packedProof,
          merkle_root: merkleTree?.root,
          credential_type: CREDENTIAL_TYPE,
          action: ACTION,
          signal: SIGNAL,
        }),
      }
    );

    if (verifyResponse.ok) {
      console.log("✅ proof verified on-chain, all good fren!");
    } else {
      console.error("❌ proof verification failed, something is wrong.");
      console.error(await verifyResponse.json());
    }
  }
};

main(process.argv)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => console.log(error));
