import assert from "node:assert/strict";
import test from "node:test";
import { nodes, tileLabel, tiles } from "../web/board.js";
import { applyAction, createGame, defensiveTargets, nodeController } from "../web/rules.js";
import { specialHexLinks, territoryMap } from "../web/territory.js";

const now = 10;
const middle = 162; // M7
const frontier = 209; // J9

function scenario() {
  const game = createGame({ now, selectSpecies: false });
  game.phase = "play";
  game.round = 1;
  Object.assign(game.players.blue, { tv: 12, turns: 1 });
  return game;
}

function place(game, id, side = "blue") {
  game.proxies[id] = { side, readyOn: 0 };
}

function act(game, type, from, to = from) {
  assert.equal(applyAction(game, game.activeSide, { type, from, to }, now), null);
}

test("Turbulence Deposits link to the nearest special hex of each side", () => {
  for (const [id, pair] of [[0, ["B4", "E1"]], [107, ["F6", "J4"]], [middle, ["J9", "P6"]],
    [242, ["P11", "T9"]], [324, ["U13", "X11"]]]) {
    assert.deepEqual(specialHexLinks.get(id).map(tileLabel).sort(), pair);
  }
  for (const { id, node } of nodes) {
    const links = specialHexLinks.get(id);
    assert(links.every((to) => specialHexLinks.get(to).includes(id)));
    if (node.home) assert(links.every((to) => [null, node.home].includes(tiles.get(to).node.home)));
  }
});

test("a frontier capture grows only after a linked Deposit is claimed and loses its region if that link is cut", () => {
  const game = scenario();
  const scout = 163;
  place(game, middle);
  place(game, frontier);
  place(game, scout, "red");
  act(game, "occupy", frontier);
  assert.equal(nodeController(game, frontier), "blue");
  assert.equal(territoryMap(game).get(frontier), "red");
  assert(!defensiveTargets(game, "blue").includes(scout));

  act(game, "occupy", middle);
  const regions = territoryMap(game);
  for (const id of [middle, frontier]) {
    assert.equal(regions.get(id), "blue");
    assert(tiles.get(id).neighbors.every((neighbor) => regions.get(neighbor) === "blue"));
  }
  assert(defensiveTargets(game, "blue").includes(scout));
  assert.equal(tiles.get(scout).region, "turbulence");

  act(game, "end");
  act(game, "end");
  assert.equal(game.claims[middle].held, "blue");
  act(game, "end");
  act(game, "move", scout, middle);
  act(game, "occupy", middle);
  assert.equal(nodeController(game, middle), "red");
  assert.equal(nodeController(game, frontier), "blue");
  assert.equal(territoryMap(game).get(frontier), "red");
});

test("territory connects to the nearest existing region through gaps beyond the one-hex ring", () => {
  const game = scenario();
  const westDeposit = 0; // A1
  const redObelisk = 76; // B4
  const gap = 2; // C1
  place(game, westDeposit);
  place(game, redObelisk);
  assert(!territoryMap(game).has(gap));
  assert(!tiles.get(westDeposit).neighbors.includes(gap));
  assert(!tiles.get(redObelisk).neighbors.includes(gap));
  act(game, "occupy", westDeposit);
  act(game, "occupy", redObelisk);
  assert.equal(territoryMap(game).get(gap), "blue");
});

test("a denied Deposit claim reverts the expansion and leaves the reserve reward", () => {
  const game = scenario();
  place(game, middle);
  act(game, "occupy", middle);
  assert.equal(territoryMap(game).get(middle), "blue");
  act(game, "move", middle, 163);
  act(game, "end");
  act(game, "end");
  assert(!territoryMap(game).has(middle));
  assert.equal(game.players.blue.reserve, 1);
});

test("growth takes an enclosed pocket without a node and releases it when the boundary reopens", () => {
  const game = scenario();
  const pocket = [128, 153]; // D6 and D7
  const last = 179; // E8
  for (const id of [107, 130, 126, 176]) {
    place(game, id);
    act(game, "occupy", id);
  }
  assert(pocket.every((id) => territoryMap(game).get(id) === "red"));
  place(game, pocket[0], "red");
  place(game, last);
  act(game, "occupy", last);
  const regions = territoryMap(game);
  assert(pocket.every((id) => regions.get(id) === "blue"));
  assert(defensiveTargets(game, "blue").includes(pocket[0]));

  act(game, "move", last, tiles.get(last).neighbors.find((id) => !game.proxies[id]));
  act(game, "end");
  act(game, "end");
  const reopened = territoryMap(game);
  assert(pocket.every((id) => reopened.get(id) === "red"));
});

test("the board edge can close a pocket, while enclosed special nodes preserve theirs", () => {
  const game = scenario();
  for (const id of [324, 320]) {
    place(game, id);
    act(game, "occupy", id);
  }
  const edge = territoryMap(game);
  for (const id of [297, 322]) assert.equal(edge.get(id), "blue");

  const another = scenario();
  another.players.blue.tv = 20;
  for (const id of [162, 209, 130, 179, 232]) {
    place(another, id);
    act(another, "occupy", id);
  }
  const nodePocket = territoryMap(another);
  assert(!nodePocket.has(107)); // H5 is an unclaimed Deposit inside the pocket.
  assert(!nodePocket.has(56)); // G3 remains part of that neutral pocket.
});
