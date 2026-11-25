import assert from "node:assert/strict";
import test from "node:test";
import { cradles } from "../web/board.js";
import { effectiveProxySkin, VOID_PROXY_SKIN } from "../web/proxy-skins.js";
import { TURN_SECONDS } from "../web/rules.js";
import { createLobby, matchRequest, processMatch } from "../server/matchmaking.js";

const blue = "c2f7a707-fb09-45a8-a9cb-451944644f32";
const red = "6e845e33-39b0-4f20-94b8-67bd58518761";
const guest = "fcfae088-740d-475e-92db-537d4eeb1070";

function client(lobby, token) {
  return (op, fields = {}, now = 100) => processMatch(lobby, { token, op, ...fields }, now).response;
}

function pick(client, room, species) {
  return client("action", { room, revision: 0, action: { type: "choose-species", species } });
}

test("the public queue pairs two players with isolated seats and server-validated turns", () => {
  const lobby = createLobby();
  const a = client(lobby, blue);
  const b = client(lobby, red);
  assert.equal(a("find").status, "waiting");
  assert.equal(a("find").status, "waiting");
  const match = b("find");
  assert.equal(match.side, "red");
  assert.equal(a("poll").side, "blue");
  assert.equal(client(lobby, guest)("poll", { room: match.room }).status, "idle");
  assert.equal(match.game.phase, "species");
  assert.equal(match.game.deadline, null);
  assert.equal(pick(a, match.room, "directorate").game.phase, "species");
  const setup = pick(b, match.room, "keth").game;
  assert.equal(setup.phase, "setup");
  assert.deepEqual(setup.speciesPicks, { red: "keth" });
  assert.deepEqual(setup.speciesReady, { blue: true, red: true });
  assert.deepEqual(a("poll").game.speciesPicks, { blue: "directorate" });
  assert.deepEqual(setup.stats, { blue: {}, red: {} });
  const fields = { room: match.room, revision: setup.revision, action: { type: "place", to: cradles.blue[0] } };
  assert.equal(b("action", fields).error, "It is the other player's turn.");
  assert.equal(a("action", fields).game.revision, 3);
  assert.equal(a("action", fields).error, "The game state changed. Try the action again.");
  assert.equal(b("poll", { room: match.room, revision: 3 }).game, null);
  assert.equal(b("poll").game.proxies[cradles.blue[0]].side, "blue");
});

test("an invite needs its code, survives polling, and handles concessions", () => {
  const lobby = createLobby();
  const a = client(lobby, blue);
  const b = client(lobby, red);
  const invitation = a("create");
  assert.match(invitation.code, /^[0-9A-F]{8}$/);
  assert.equal(a("poll").code, invitation.code);
  assert.equal(b("join", { code: "bad code" }).status, "idle");
  const match = b("join", { code: invitation.code.toLowerCase() });
  assert.equal(match.status, "match");
  assert.equal(client(lobby, guest)("join", { code: invitation.code }).status, "idle");
  const locked = pick(a, match.room, "veyari");
  assert.deepEqual(locked.game.speciesPicks, { blue: "veyari" });
  assert.equal(pick(a, match.room, "directorate").error, "Your species is already locked.");
  pick(b, match.room, "keth");
  lobby.rooms[match.room].game.stats.blue = { moveOrders: 4, speciesPowers: 1 };
  assert.deepEqual(b("poll").game.stats.blue, { moveOrders: 4 });
  assert.deepEqual(a("poll").game.stats.blue, { moveOrders: 4 });
  const reviewed = a("concede", { room: match.room }).game;
  assert.equal(reviewed.winner, "red");
  assert.deepEqual(reviewed.speciesPicks, { blue: "veyari", red: "keth" });
  assert.deepEqual(b("poll").game.speciesPicks, reviewed.speciesPicks);
  assert.deepEqual(reviewed.stats, { blue: { moveOrders: 4, speciesPowers: 1 }, red: {} });
  assert.equal(a("leave").status, "idle");
  assert.equal(b("leave").status, "idle");
  assert.equal(Object.keys(lobby.rooms).length, 0);
});

test("online skins belong to each seat and cosmetic changes leave order revisions usable", () => {
  const lobby = createLobby();
  const a = client(lobby, blue);
  const b = client(lobby, red);
  a("find", { skin: "drone" });
  const { room, proxySkins } = b("find", { skin: "classic" });
  assert.deepEqual(proxySkins, { blue: "drone", red: "classic" });
  pick(a, room, "directorate");
  const setup = pick(b, room, "keth").game;
  const request = { room, skin: "disc", side: "blue" };
  assert.match(client(lobby, guest)("skin", request).error, /ended/);
  assert.match(b("skin", { ...request, skin: "unknown" }).error, /valid Proxy skin/);
  const result = b("skin", request);
  assert.deepEqual(result.proxySkins, { blue: "drone", red: "disc" });
  assert.equal(result.game.revision, setup.revision);
  assert.equal(result.game.deadline, setup.deadline);
  const poll = a("poll", { room, revision: setup.revision });
  assert.equal(poll.game, null);
  assert.deepEqual(poll.proxySkins, result.proxySkins);
  const action = a("action", { room, revision: setup.revision, action: { type: "place", to: cradles.blue[0] } });
  assert.equal(action.error, undefined);
  assert.equal(action.game.players.blue.placed, 1);
});

test("The Call of Void locks only the invoking seat to Void Erosion in an online match", () => {
  const lobby = createLobby();
  const a = client(lobby, blue);
  const b = client(lobby, red);
  a("find", { skin: "drone" });
  const { room } = b("find", { skin: "classic" });
  pick(a, room, "directorate");
  pick(b, room, "keth");
  const game = lobby.rooms[room].game;
  Object.assign(game, { phase: "play", round: 1 });
  Object.assign(game.players.blue, { tv: 4, turns: 1 });
  game.proxies[64] = { side: "blue", readyOn: 0 };
  game.claims[64] = { held: "blue" };
  assert.equal(a("action", { room, revision: game.revision, action: { type: "buy-augment", augment: "void" } }).error, undefined);
  const match = b("poll");
  assert.equal(match.game.players.blue.tv, 14);
  assert.equal(match.game.players.red.tv, 0);
  assert.equal(effectiveProxySkin(match.game, "blue", match.proxySkins.blue), VOID_PROXY_SKIN);
  assert.equal(effectiveProxySkin(match.game, "red", match.proxySkins.red), "classic");
  assert.match(a("skin", { room, skin: "disc" }).error, /locks.*Void Erosion/);
  assert.equal(lobby.rooms[room].proxySkins.blue, "drone");
  assert.match(b("skin", { room, skin: VOID_PROXY_SKIN }).error, /valid Proxy skin/);
  const changed = b("skin", { room, skin: "disc" });
  assert.equal(changed.error, undefined);
  assert.equal(effectiveProxySkin(changed.game, "red", changed.proxySkins.red), "disc");
});

test("the server advances deadlines and refuses commands from expired revisions", () => {
  const lobby = createLobby();
  const a = client(lobby, blue);
  a("find");
  const b = client(lobby, red);
  const { room } = b("find");
  pick(a, room, "directorate");
  const setup = pick(b, room, "veyari").game;
  const timestamp = 100 + 1000 * TURN_SECONDS;
  const reply = a("action", { room, revision: setup.revision, action: { type: "place", to: cradles.blue[0] } }, timestamp);
  assert.equal(reply.game.activeSide, "red");
  assert.equal(reply.game.players.blue.placed, 3);
  assert.equal(reply.error, "The game state changed. Try the action again.");
});

test("online matches restore an interrupted move from older rules and capture on the next Move", () => {
  const lobby = createLobby();
  const a = client(lobby, blue);
  const b = client(lobby, red);
  a("find");
  const { room } = b("find");
  pick(a, room, "directorate");
  pick(b, room, "keth");
  const game = lobby.rooms[room].game;
  game.phase = "play";
  game.players.blue.tv = 2;
  game.engagement = { from: 162, to: 163, proxy: { side: "blue", readyOn: 0 } };
  game.proxies[163] = { side: "red", readyOn: 0 };
  const restored = b("poll", { room, revision: game.revision });
  assert.equal(restored.game.proxies[162].side, "blue");
  assert.equal(restored.game.proxies[163].side, "red");
  assert.equal(restored.game.engagement, undefined);
  const action = { type: "move", from: 162, to: 163 };
  assert.equal(a("action", { room, revision: restored.game.revision, action }).game.players.blue.tv, 1);
  const updated = b("poll", { room, revision: restored.game.revision }).game;
  assert.equal(updated.proxies[162], undefined);
  assert.equal(updated.proxies[163].side, "blue");
  assert.equal(updated.stats.blue.moveCaptures, 1);
});

test("the HTTP matchmaking endpoint supports GitHub Pages CORS and persistent updates", async () => {
  const lobby = createLobby();
  const endpoint = "https://matchmaking.example/api/match";
  const options = await matchRequest(new Request(endpoint, { method: "OPTIONS" }), lobby);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "*");
  const request = new Request(endpoint, {
    method: "POST",
    body: JSON.stringify({ op: "find", token: blue }),
  });
  let stored;
  const result = await matchRequest(request, lobby, (value) => { stored = structuredClone(value); });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).status, "waiting");
  assert.equal(client(stored, red)("find", {}, Date.now()).status, "match");
  assert.equal((await matchRequest(new Request(endpoint, { method: "POST", body: "x".repeat(4097) }), lobby)).status, 400);
});
