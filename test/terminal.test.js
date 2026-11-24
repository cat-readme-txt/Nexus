import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "../web/rules.js";
import { runTestCommand } from "../web/terminal.js";

function startedMatch(passAndPlay) {
  const game = createGame({ now: 0, selectSpecies: false, passAndPlay });
  game.phase = "play";
  game.players.blue.tv = 6;
  return game;
}

test("testing commands add TV above the usual cap and put new Proxies in reserve", () => {
  const game = startedMatch(true);
  assert.match(runTestCommand(game, "blue", "add TV 100", 1).message, /106 TV/);
  assert.match(runTestCommand(game, "blue", "add proxies 4", 1).message, /4 reserve Proxies/);
  assert.deepEqual([game.players.blue.tv, game.players.blue.reserve, game.revision], [106, 4, 2]);
  assert.deepEqual([game.players.red.tv, game.players.red.reserve], [0, 0]);
  assert.equal(Object.keys(game.proxies).length, 0);
});

test("testing commands reject remote matches, expired turns, other seats, and invalid input", () => {
  const online = startedMatch(false);
  const local = startedMatch(true);
  assert(runTestCommand(online, "blue", "add TV 100", 1).error);
  assert(runTestCommand(local, "red", "add TV 100", 1).error);
  assert(runTestCommand(local, "blue", "add TV 100", local.deadline).error);
  for (const input of ["add TV 0", "add TV -1", "add TV 1.5", "add TV 2e3", "add TV 9999999999999999", "add score 2", "add TV 10 red"]) {
    assert(runTestCommand(local, "blue", input, 1).error, input);
  }
  assert.deepEqual([local.players.blue.tv, local.players.red.tv, local.revision], [6, 0, 0]);
  assert.equal(online.players.blue.tv, 6);
});
