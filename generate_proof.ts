import { Identity } from "@semaphore-protocol/identity";
import { generateSemaphoreProof } from "./semaphore/semaphoreProof";
import { AUTH_TOKEN, SEQUENCER_URI } from "./const";
import {
  verifyProofDevPortal,
  verifyProofLocal,
  verifyProofOnChain,
  verifyProofSequencer,
} from "./verify";
import { internal } from "@worldcoin/idkit";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { encodePacked } from "viem";

const APP_ID = "app_staging_45068dca85829d2fd90e2dd6f0bff997";
const ACTION = "";
const SIGNAL = "my_signal";

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

  if (!merkleTree?.root) {
    throw new Error("❌ no merkle root found in sequencer response");
  }

  const siblings = merkleTree?.proof
    .flatMap((v) => Object.values(v))
    .map((v) => BigInt(v));

  const pathIndices = merkleTree?.proof
    .flatMap((v) => Object.keys(v))
    .map((v) => (v === "Left" ? 0 : 1));

  const merkleProof = {
    root: null,
    leaf: null,
    siblings: siblings,
    pathIndices: pathIndices,
  } as MerkleProof;

  const { hash: signalHash, digest: signalHashDigest } =
    internal.hashToField(SIGNAL);
  const { hash: externalNullifier, digest: externalNullifierDigest } =
    internal.generateExternalNullifier(APP_ID, ACTION);

  const fullProof = await generateSemaphoreProof(
    newIdentity,
    merkleProof,
    externalNullifier as bigint, // IDKit will soon be updated to use native bigint
    signalHash as bigint, // IDKit will soon be updated to use native bigint
    { wasmFilePath: wasmFilePath, zkeyFilePath: finalZkeyPath }
  );

  const nullifierHash = encodePacked(
    ["uint256"],
    [fullProof.nullifierHash as bigint]
  );
  const typedProof = fullProof.proof as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint
  ];
  const packedProof = encodePacked(["uint256[8]"], [typedProof]);

  console.log("🔑 proof generated!");
  console.log({
    nullifierHash,
    packed_proof: packedProof,
    merkle_root: merkleTree?.root,
  });

  await verifyProofLocal(fullProof);

  if (!noVerify) {
    await verifyProofOnChain({
      proof: fullProof,
      externalNullifier: externalNullifier,
      signalHash: signalHash,
    });

    await verifyProofDevPortal({
      proof: packedProof,
      nullifierHash,
      merkleRoot: merkleTree.root,
      appId: APP_ID,
      signal: SIGNAL,
      action: ACTION,
    });

    await verifyProofSequencer({
      proof: fullProof.proof,
      merkleRoot: merkleTree.root,
      externalNullifierHash: externalNullifierDigest,
      signalHash: signalHashDigest,
      nullifierHash,
    });

    console.log("All gucci, by! 👋");
  }
};

main(process.argv)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => console.log(error));
