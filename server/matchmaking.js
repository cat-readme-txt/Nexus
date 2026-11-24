import { advanceClock, applyAction, concedeGame, createGame, restoreLegacyMove } from "../web/rules.js";

const QUEUE_LEASE = 90_000;
const INVITE_LEASE = 20 * 60_000;
const MATCH_LEASE = 2 * 60 * 60_000;
const MAX_ROOMS = 128;
const TOKEN_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[0-9A-F]{8}$/;
const OPERATIONS = new Set(["find", "create", "join", "poll", "action", "concede", "leave", "cancel"]);

export function createLobby() {
  return { rooms: {}, membership: {}, queued: null };
}

function removeRoom(lobby, room) {
  for (const token of Object.values(room.seats)) {
    if (lobby.membership[token] === room.code) delete lobby.membership[token];
  }
  if (lobby.queued === room.code) lobby.queued = null;
  delete lobby.rooms[room.code];
}

function availableRoom(lobby, token, kind, now) {
  let code;
  do {
    code = crypto.randomUUID().slice(0, 8).toUpperCase();
  } while (lobby.rooms[code]);
  const room = {
    code, kind, seats: { blue: token }, game: null,
    expires: now + (kind === "queue" ? QUEUE_LEASE : INVITE_LEASE),
  };
  lobby.rooms[code] = room;
  lobby.membership[token] = code;
  if (kind === "queue") lobby.queued = code;
  return room;
}

function matchPlayer(lobby, room, token, now) {
  room.seats.red = token;
  room.game = createGame({ now });
  room.expires = now + MATCH_LEASE;
  lobby.membership[token] = room.code;
  if (lobby.queued === room.code) lobby.queued = null;
}

function gameForPlayer(game, side) {
  if (game.phase === "finished") return game;
  const { speciesPicks, stats, ...visible } = game;
  return {
    ...visible,
    stats: stats ? Object.fromEntries(Object.entries(stats).map(([team, counters]) => {
      const { speciesPowers, ...publicCounters } = counters;
      return [team, publicCounters];
    })) : null,
    speciesPicks: speciesPicks ? { [side]: speciesPicks[side] } : null,
    speciesReady: { blue: !!speciesPicks?.blue, red: !!speciesPicks?.red },
  };
}

export function processMatch(lobby, request, now) {
  if (typeof request?.token !== "string" || !TOKEN_PATTERN.test(request.token)
      || !OPERATIONS.has(request.op)) {
    return { response: { error: "Invalid matchmaking request." }, changed: false, status: 400 };
  }
  const token = request.token.toLowerCase();
  let changed = false;
  for (const room of Object.values(lobby.rooms)) {
    if (now >= room.expires) {
      removeRoom(lobby, room);
      changed = true;
    }
  }

  let room = lobby.rooms[lobby.membership[token]];
  const { op } = request;
  let error;
  if (!room && (op === "find" || op === "create" || op === "join")) {
    const code = typeof request.code === "string" ? request.code.trim().toUpperCase() : "";
    const open = lobby.rooms[lobby.queued];
    const invite = CODE_PATTERN.test(code) ? lobby.rooms[code] : null;
    if (op === "join" && (!invite || invite.kind !== "invite" || invite.game)) {
      error = "That room is unavailable. Check the code or ask for a new one.";
    } else if (op === "join" || (op === "find" && open)) {
      room = op === "join" ? invite : open;
      matchPlayer(lobby, room, token, now);
      changed = true;
    } else if (Object.keys(lobby.rooms).length >= MAX_ROOMS) {
      error = "All online rooms are in use. Try again in a moment.";
    } else {
      room = availableRoom(lobby, token, op === "find" ? "queue" : "invite", now);
      changed = true;
    }
  }

  if (room?.game) {
    if (restoreLegacyMove(room.game)) changed = true;
    if (advanceClock(room.game, now)) changed = true;
  }

  const side = room?.seats.blue === token ? "blue" : "red";
  if (op === "concede" && room?.game && room.code === request.room && room.game.phase !== "finished") {
    concedeGame(room.game, side);
    changed = true;
  }

  if (room && (op === "leave" || (op === "cancel" && !room.game))) {
    if (!room.game) {
      removeRoom(lobby, room);
    } else {
      concedeGame(room.game, side);
      delete lobby.membership[token];
      if (!Object.values(room.seats).some((seat) => lobby.membership[seat] === room.code)) {
        removeRoom(lobby, room);
      }
    }
    room = null;
    changed = true;
  }

  if (op === "action") {
    if (!room?.game || room.code !== request.room) {
      error = "That match has ended.";
    } else if (room.game.revision !== request.revision
      && !(room.game.phase === "species" && request.action?.type === "choose-species")) {
      error = "The game state changed. Try the action again.";
    } else {
      error = applyAction(room.game, side, request.action, now);
      if (!error) {
        room.expires = now + MATCH_LEASE;
        changed = true;
      }
    }
  }

  let response = { status: "idle", serverTime: now };
  if (room?.game) {
    const unchanged = op === "poll" && request.room === room.code && request.revision === room.game.revision;
    response = {
      status: "match", room: room.code, side,
      game: unchanged ? null : gameForPlayer(room.game, side), serverTime: now,
    };
  } else if (room) {
    if (room.kind === "queue" && room.expires < now + QUEUE_LEASE / 2) {
      room.expires = now + QUEUE_LEASE;
      changed = true;
    }
    response = { status: "waiting", kind: room.kind, code: room.kind === "invite" ? room.code : null, serverTime: now };
  }
  if (error) response.error = error;
  return { response, changed, status: 200 };
}

const RESPONSE_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

async function readRequest(request) {
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return JSON.parse(body + decoder.decode());
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    body += decoder.decode(value, { stream: true });
  }
}

export async function matchRequest(request, lobby, persist) {
  if (new URL(request.url).pathname !== "/api/match") {
    return new Response("Not found", { status: 404, headers: RESPONSE_HEADERS });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: RESPONSE_HEADERS });
  }

  let payload;
  try {
    payload = await readRequest(request);
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers: RESPONSE_HEADERS });
  }
  const { response, changed, status } = processMatch(lobby, payload, Date.now());
  const result = Response.json(response, { status, headers: RESPONSE_HEADERS });
  if (changed && persist) await persist(lobby);
  return result;
}
