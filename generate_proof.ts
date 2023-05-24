import { BigNumber } from "ethers";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { AUTH_TOKEN, CREDENTIAL_TYPE, SEQUENCER_URI } from "./const";
import { defaultAbiCoder as abi } from "ethers/lib/utils";
import { verifyProof } from "./utils";
import { internal } from "@worldcoin/idkit";
import { MerkleProof } from "@zk-kit/protocols";
const CONTRACT_ABI = [
  "function verifyProof (uint256 groupId, uint256 root, uint256 signalHash, uint256 nullifierHash, uint256 externalNullifierHash, uint256[8] calldata proof) external virtual onlyProxy onlyInitialized",
];

const CONTRACT_ADDRESS = "0x3607500daa1fe6846b4E465f16a86d2978a8AF65";

const APP_ID = "app_staging_45068dca85829d2fd90e2dd6f0bff997";
const ACTION = "";
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

  const newIdentity = new Identity(rawId);
  const identityCommitment = newIdentity.getCommitment();
  const trapdoor = newIdentity.getTrapdoor();
  const nullifier = newIdentity.getNullifier();

  const encodedCommitment =
    "0x" + identityCommitment.toString(16).padStart(64, "0");

  console.log(
    `ℹ️ retrieve idComm, fetching inclusion proof: ${encodedCommitment}`
  );

  const wasmFilePath = "./semaphore/semaphore.wasm";
  const finalZkeyPath = "./semaphore/semaphore.zkey";

  const response = await fetch(`${SEQUENCER_URI}inclusionProof`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${AUTH_TOKEN}`,
    },
    body: JSON.stringify([encodedCommitment]),
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
  } as MerkleProof;

  const signalHash = internal.hashToField(SIGNAL).hash;
  const externalNullifier = internal.generateExternalNullifier(
    APP_ID,
    ACTION
  ).hash;

  const fullProof = await generateProof(
    newIdentity,
    merkleProof,
    externalNullifier as bigint, // IDKit will soon be updated to use native bigint
    signalHash as bigint, // IDKit will soon be updated to use native bigint
    { wasmFilePath: wasmFilePath, zkeyFilePath: finalZkeyPath }
  );

  const nullifierHash = abi.encode(["uint256"], [fullProof.nullifierHash]);
  const packedProof = abi.encode(["uint256[8]"], [fullProof.proof]);

  console.log("🔑 proof generated!");
  console.log({
    nullifierHash,
    packed_proof: packedProof,
    proof: fullProof.proof,
    merkle_root: merkleTree?.root,
  });

  await verifyProof(fullProof);

  if (!noVerify) {
    // ANCHOR verify proof with the sequencer (through the Developer Portal)
    console.log("Verifying proof with the sequencer...");
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
      console.log("✅ proof verified with the sequencer!");
    } else {
      console.error(
        "❌ proof verification with the sequencer failed, something is wrong."
      );
      console.error(await verifyResponse.json());
    }

    // ANCHOR verify proof directly with an RPC call

    console.log("Verifying proof on-chain...");
  }
};

main(process.argv)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => console.log(error));
