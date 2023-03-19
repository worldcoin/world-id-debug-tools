import { config } from "dotenv";

config();

export const SEQUENCER_URI = "https://phone-signup.stage-crypto.worldcoin.dev/";
export const GROUP_ID = 1;
export const AUTH_TOKEN = process.env.AUTH_TOKEN;
export const CREDENTIAL_TYPE = "phone";
