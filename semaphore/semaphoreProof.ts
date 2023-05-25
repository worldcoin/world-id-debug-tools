import { BigNumber } from "@ethersproject/bignumber";
import { BytesLike, Hexable } from "@ethersproject/bytes";
import { Group } from "@semaphore-protocol/group";
import type { Identity } from "@semaphore-protocol/identity";
import type {
  SnarkArtifacts,
  FullProof,
  Proof,
  SnarkJSProof,
} from "@semaphore-protocol/proof";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import verificationKeys from "./verification_key.json";
// @ts-ignore
import { groth16 } from "snarkjs";

/**
 * Packs a proof into a format compatible with Semaphore.
 * @param originalProof The proof generated with SnarkJS.
 * @returns The proof compatible with Semaphore.
 */
function packProof(originalProof: SnarkJSProof): Proof {
  return [
    originalProof.pi_a[0],
    originalProof.pi_a[1],
    originalProof.pi_b[0][1],
    originalProof.pi_b[0][0],
    originalProof.pi_b[1][1],
    originalProof.pi_b[1][0],
    originalProof.pi_c[0],
    originalProof.pi_c[1],
  ];
}

/**
 * Unpacks a proof into its original form.
 * @param proof The proof compatible with Semaphore.
 * @returns The proof compatible with SnarkJS.
 */
function unpackProof(proof: Proof): SnarkJSProof {
  return {
    pi_a: [proof[0], proof[1]],
    pi_b: [
      [proof[3], proof[2]],
      [proof[5], proof[4]],
    ],
    pi_c: [proof[6], proof[7]],
    protocol: "groth16",
    curve: "bn128",
  };
}

/**
 * Generates a Semaphore proof.
 * World ID overriden to avoid double hashing the external nullifier and signal hash.
 * @param identity The Semaphore identity.
 * @param groupOrMerkleProof The Semaphore group or its Merkle proof.
 * @param externalNullifier The external nullifier.
 * @param signal The Semaphore signal.
 * @param snarkArtifacts The SNARK artifacts.
 * @returns The Semaphore proof ready to be verified.
 */
export async function generateSemaphoreProof(
  { trapdoor, nullifier, commitment }: Identity,
  groupOrMerkleProof: Group | MerkleProof,
  externalNullifier: BytesLike | Hexable | number | bigint,
  signal: BytesLike | Hexable | number | bigint,
  snarkArtifacts: SnarkArtifacts
): Promise<FullProof> {
  let merkleProof: MerkleProof;

  if ("depth" in groupOrMerkleProof) {
    const index = groupOrMerkleProof.indexOf(commitment);

    if (index === -1) {
      throw new Error("The identity is not part of the group");
    }

    merkleProof = groupOrMerkleProof.generateMerkleProof(index);
  } else {
    merkleProof = groupOrMerkleProof;
  }

  const { proof, publicSignals } = await groth16.fullProve(
    {
      identityTrapdoor: trapdoor,
      identityNullifier: nullifier,
      treePathIndices: merkleProof.pathIndices,
      treeSiblings: merkleProof.siblings,
      externalNullifier: externalNullifier,
      signalHash: signal,
    },
    snarkArtifacts.wasmFilePath,
    snarkArtifacts.zkeyFilePath
  );

  return {
    merkleTreeRoot: publicSignals[0],
    nullifierHash: publicSignals[1],
    signal: BigNumber.from(signal).toString(),
    externalNullifier: BigNumber.from(externalNullifier).toString(),
    proof: packProof(proof),
  };
}

/**
 * Verifies a Semaphore proof.
 * @param fullProof The SnarkJS Semaphore proof.
 * @param treeDepth The Merkle tree depth.
 * @returns True if the proof is valid, false otherwise.
 */
export default function verifySemaphoreProof(
  {
    merkleTreeRoot,
    nullifierHash,
    externalNullifier,
    signal,
    proof,
  }: FullProof,
  treeDepth: number
): Promise<boolean> {
  if (treeDepth < 16 || treeDepth > 32) {
    throw new TypeError("The tree depth must be a number between 16 and 32");
  }

  const verificationKey = {
    ...verificationKeys,
    vk_delta_2: verificationKeys.vk_delta_2[treeDepth - 16],
    IC: verificationKeys.IC[treeDepth - 16],
  };

  return groth16.verify(
    verificationKey,
    [merkleTreeRoot, nullifierHash, signal, externalNullifier],
    unpackProof(proof)
  );
}
