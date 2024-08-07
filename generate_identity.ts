import { keccak256 } from "viem";
import { AUTH_TOKEN, SEQUENCER_URI } from "./const";
import { Identity } from "@semaphore-protocol/identity";

const main = async (args: string[]): Promise<void> => {
  let seed: string | undefined = undefined;
  let noInsert = false;

  if (!AUTH_TOKEN) {
    console.error("❌ no auth token provided, bye!");
    return;
  }

  for (const arg of args.slice(2)) {
    if (arg === "--seed") {
      seed = args[args.indexOf(arg) + 1];
    }

    if (arg === "--no-insert") {
      noInsert = true;
    }
  }

  const newIdentity = new Identity(
    seed ? keccak256(Buffer.from(seed)) : undefined
  );
  const identityCommitment = newIdentity.getCommitment();
  const encodedCommitment =
    "0x" + identityCommitment.toString(16).padStart(64, "0");

  console.log(`ℹ️ encoded identity commitment: ${encodedCommitment}`);

  if (!noInsert) {
    const response = await fetch(`${SEQUENCER_URI}insertIdentity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${AUTH_TOKEN}`,
      },
      body: JSON.stringify([encodedCommitment]),
    });

    if (response.ok) {
      console.log("✅ identity commitment inserted!");
    } else {
      console.error("❌ no bueno, identity commitment not inserted.");
      console.log(await response.text());
      return;
    }
  }

  console.log(`ℹ️ serialized identity`, newIdentity.toString());
};

main(process.argv)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => console.log(error));
