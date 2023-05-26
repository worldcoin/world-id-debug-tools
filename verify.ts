import type { FullProof } from "@semaphore-protocol/proof";
import verifySemaphoreProof from "./semaphore/semaphoreProof";
import {
  ContractFunctionRevertedError,
  createPublicClient,
  encodePacked,
  http,
} from "viem";
import { polygonMumbai } from "viem/chains";
import routerAbi from "./abi/WorldIDRouter.json";
import {
  ALCHEMY_API_KEY,
  CONTRACT_ADDRESS,
  CREDENTIAL_TYPE,
  GROUP_ID,
  SEQUENCER_URI,
} from "./const";
import { BigNumberish } from "@semaphore-protocol/group";

export const verifyProofLocal = async (proof: FullProof): Promise<void> => {
  const isValid = await verifySemaphoreProof(proof, 30);

  if (isValid) {
    console.info("☑️  proof verified locally!");
  } else {
    throw new Error("❌ unable to verify proof locally");
  }
};

export const verifyProofOnChain = async ({
  proof,
  externalNullifier,
  signalHash,
}: {
  proof: FullProof;
  externalNullifier: bigint | BigInt;
  signalHash: bigint | BigInt;
}): Promise<void> => {
  const client = createPublicClient({
    chain: polygonMumbai,
    transport: http(
      `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    ),
  });

  try {
    await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: routerAbi.abi,
      functionName: "verifyProof",
      args: [
        GROUP_ID,
        proof.merkleTreeRoot,
        signalHash,
        proof.nullifierHash,
        externalNullifier,
        proof.proof,
      ],
    });
    console.info("✅ proof verified on-chain!");
  } catch (e) {
    const error = e as ContractFunctionRevertedError;
    console.log(error.message);
    throw new Error("❌ unable to verify proof on-chain");
  }
};

export const verifyProofDevPortal = async ({
  proof,
  merkleRoot,
  nullifierHash,
  signal,
  appId,
  action,
}: {
  proof: `0x${string}`; // We explicitly use JSON types to make explicit typing
  nullifierHash: `0x${string}`;
  merkleRoot: string;
  signal: string;
  appId: string;
  action: string;
}): Promise<void> => {
  const verifyResponse = await fetch(
    `https://developer.worldcoin.org/api/v1/verify/${appId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nullifier_hash: nullifierHash,
        proof,
        merkle_root: merkleRoot,
        credential_type: CREDENTIAL_TYPE,
        action,
        signal,
      }),
    }
  );

  if (verifyResponse.ok) {
    console.log("✅ proof verified with the Dev Portal!");
  } else {
    console.error(await verifyResponse.json());
    throw new Error(
      "❌ proof verification with the Dev Portal failed, something is wrong."
    );
  }
};

const shapeProofForSequencer = (proof: FullProof["proof"]) => {
  const encode = (val: BigNumberish) =>
    encodePacked(["uint256"], [val as bigint]);

  return [
    [encode(proof[0]), encode(proof[1])],
    [
      [encode(proof[2]), encode(proof[3])],
      [encode(proof[4]), encode(proof[5])],
    ],
    [encode(proof[6]), encode(proof[7])],
  ];
};

export const verifyProofSequencer = async ({
  proof,
  merkleRoot,
  nullifierHash,
  signalHash,
  externalNullifierHash,
}: {
  proof: FullProof["proof"];
  nullifierHash: `0x${string}`;
  merkleRoot: string;
  signalHash: string;
  externalNullifierHash: string;
}): Promise<void> => {
  const body = {
    nullifierHash,
    proof: shapeProofForSequencer(proof),
    root: merkleRoot,
    signalHash,
    externalNullifierHash,
  };

  const verifyResponse = await fetch(`${SEQUENCER_URI}verifySemaphoreProof`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (verifyResponse.ok) {
    console.log("✅ proof verified with the sequencer!");
  } else {
    console.error(await verifyResponse.json());
    throw new Error(
      "❌ proof verification with the sequencer failed, something is wrong."
    );
  }
};
