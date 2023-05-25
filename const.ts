import { config } from "dotenv";

config();

export const SEQUENCER_URI =
  "https://signup-batching.stage-crypto.worldcoin.dev/";
export const AUTH_TOKEN = process.env.AUTH_TOKEN;
export const CREDENTIAL_TYPE = "orb";
export const GROUP_ID = BigInt(1); // Group ID for the Orb credential
export const CONTRACT_ADDRESS = "0x3607500daa1fe6846b4E465f16a86d2978a8AF65";
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
