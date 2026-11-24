import { matchmakingEndpoint } from "./config.js";

const SESSION_KEY = "nexus-online-v1";

function previousToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export const onlineAvailable = Boolean(matchmakingEndpoint && globalThis.crypto?.randomUUID);
export const savedOnlineSession = onlineAvailable && Boolean(previousToken());
let token = previousToken();

export async function sendOnline(op, fields = {}) {
  token ??= crypto.randomUUID();
  let response;
  try {
    response = await fetch(matchmakingEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, token, ...fields }),
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new Error("The matchmaking server is unreachable.");
  }
  if (!response.ok) throw new Error("The matchmaking server could not complete the request.");
  const body = await response.json();
  try {
    if (body.status === "waiting" || body.status === "match") sessionStorage.setItem(SESSION_KEY, token);
    if (body.status === "idle") sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Keep the active connection when browser storage is unavailable.
  }
  return body;
}
