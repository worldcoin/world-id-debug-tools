import { Proof, Semaphore, SemaphorePublicSignals } from "@zk-kit/protocols";
import verificationKey from "./semaphore/verification_key.json";

export const verifyProof = async (
  proof: Proof,
  publicSignals: SemaphorePublicSignals
): Promise<void> => {
  const isValid = await Semaphore.verifyProof(
    verificationKey as unknown as string,
    {
      proof,
      publicSignals,
    }
  );

  if (isValid) {
    console.info("☑️  proof verified locally!");
  } else {
    console.error("❌ unable to verify proof locally");
  }
};
