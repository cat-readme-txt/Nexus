import assert from "node:assert/strict";
import test from "node:test";
import { cradles } from "../web/board.js";
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
