import {
  FullProof,
  verifyProof as semaphoreVerifyProof,
} from "@semaphore-protocol/proof";

export const verifyProof = async (proof: FullProof): Promise<void> => {
  const isValid = await semaphoreVerifyProof(proof, 30);

  if (isValid) {
    console.info("☑️  proof verified locally!");
  } else {
    console.error("❌ unable to verify proof locally");
  }
};
