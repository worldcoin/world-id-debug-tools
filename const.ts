import { config } from "dotenv";

config();

export const SEQUENCER_URI =
  "https://signup-batching.stage-crypto.worldcoin.dev/";
export const AUTH_TOKEN = process.env.AUTH_TOKEN;
export const CREDENTIAL_TYPE = "orb";
