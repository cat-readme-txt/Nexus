import { cp, rm, writeFile } from "node:fs/promises";

const endpoint = process.env.MATCHMAKING_URL?.trim();
const url = endpoint ? new URL(endpoint) : null;
if (url && (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)) {
  throw new Error("MATCHMAKING_URL must be the public HTTPS root of the matchmaking server.");
}

const dist = new URL("../dist/", import.meta.url);
await rm(dist, { recursive: true, force: true });
await cp(new URL("../web/", import.meta.url), dist, { recursive: true });
await writeFile(
  new URL("config.js", dist),
  `export const matchmakingEndpoint = ${JSON.stringify(url ? new URL("/api/match", url).href : null)};\n`,
);
