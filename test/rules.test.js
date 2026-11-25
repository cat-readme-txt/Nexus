import assert from "node:assert/strict";
import test from "node:test";
import {
  board, cradles, edgeKey, mirroredWallsBySource, nexus, nexusWalls, nodes, otherSide, sentinels,
  tileLabel, tiles, vanguards, walls, wallsBySource,
} from "../web/board.js";
import {
  advanceClock, applyAction, baseShieldActive, createGame, nodeController, placementActions,
  nodeOrders, obeliskRange, proxyActions, readyProxy, shieldWallsForSource, TURN_SECONDS, wallActive,
} from "../web/rules.js";

const cost = (type, from, to) => ({ type, from, to });
const start = 10;
const turnMs = TURN_SECONDS * 1000;

function playGame() {
  const game = createGame({ now: start, selectSpecies: false });
  game.phase = "play";
  game.round = 1;
  game.players.blue.tv = 6;
  game.players.blue.turns = 1;
  return game;
}

function proxy(game, id, side) {
  game.proxies[id] = { side, readyOn: 0 };
}

test("the competition layout preserves playable hexes, nodes, and adjacent shields", () => {
  assert.equal(board.length, 337);
  assert.equal(cradles.blue.length, 25);
  assert.equal(cradles.red.length, 25);
  assert.equal(nodes.filter(({ node }) => node.type === "deposit").length, 9);
  assert.deepEqual([sentinels.blue.length, sentinels.red.length], [8, 8]);
  assert.equal(walls.length, 251);
  assert.equal(new Set(walls.map(({ from, to }) => edgeKey(from, to))).size, walls.length);
  const game = createGame({ now: start });
  for (const tile of board) {
    for (const neighbor of tile.neighbors.filter((id) => id !== null)) {
      assert(tiles.get(neighbor).neighbors.includes(tile.id));
    }
  }
  for (const wall of walls) {
    assert(tiles.get(wall.from).neighbors.includes(wall.to));
    assert.equal(tiles.get(wall.source).node.home, wall.side);
    assert(!wallActive(game, wall));
  }
  for (const [source, arc] of mirroredWallsBySource) {
    assert(["aegis", "sentinel"].includes(tiles.get(source).node.type));
    assert(arc.length <= wallsBySource.get(source).length);
    for (const { from, to, side } of arc) {
      assert(tiles.get(from).neighbors.includes(to));
      assert.equal(side, otherSide(tiles.get(source).node.home));
    }
  }
});

test("capturing a wide generator shuts down all four hexes of its printed arc", () => {
  const wideArcs = [
    [4, ["D1", "D2", "E2", "F2"], 9],
    [76, ["A3", "B3", "C3", "C4"], 8],
    [84, ["I3", "I4", "J5", "K4"], 10],
    [94, ["S3", "S4", "T5", "U4"], 10],
    [130, ["E5", "F5", "G5", "G6"], 10],
    [219, ["S8", "S9", "T10", "U9"], 10],
    [265, ["O10", "P10", "Q10", "Q11"], 10],
    [273, ["W10", "W11", "X12", "Y11"], 8],
    [320, ["T13", "U12", "V13", "V14"], 9],
  ];
  for (const [source, expectedHexes, expectedBorders] of wideArcs) {
    const game = playGame();
    const { node, neighbors } = tiles.get(source);
    const arc = wallsBySource.get(source);
    const hexes = new Set(arc.flatMap(({ from, to }) => [from, to]).filter((id) => neighbors.includes(id)).map(tileLabel));
    assert.deepEqual([...hexes].sort(), [...expectedHexes].sort(), tileLabel(source));
    assert.equal(arc.length, expectedBorders, tileLabel(source));
    game.activatedShields[source] = node.home;
    assert(arc.every((wall) => wallActive(game, wall)));

    const attacker = otherSide(node.home);
    game.activeSide = attacker;
    game.players[attacker].tv = 6;
    proxy(game, source, attacker);
    assert.equal(applyAction(game, attacker, cost("occupy", source, source), start), null);
    assert(arc.every((wall) => !wallActive(game, wall)), tileLabel(source));
  }
});

test("a fourth-hex return opens to enemy movement and closes after recapture", () => {
  const game = playGame();
  const generator = 4; // E1
  const inner = 30; // F2
  const outer = 31; // G2
  const edge = walls.find(({ from, to }) => from === inner && to === outer);
  game.activatedShields[generator] = "blue";
  game.activeSide = "red";
  game.players.red.tv = 6;
  proxy(game, generator, "red");
  proxy(game, outer, "red");

  assert.equal(edge.source, generator);
  assert.match(applyAction(game, "red", cost("move", outer, inner), start), /unavailable/);
  assert.equal(applyAction(game, "red", cost("occupy", generator, generator), start), null);
  assert.equal(applyAction(game, "red", cost("move", outer, inner), start), null);
  assert.equal(applyAction(game, "red", cost("move", generator, 5), start), null);
  assert(!wallActive(game, edge));
  proxy(game, generator, "blue");
  proxy(game, 9, "blue");
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(applyAction(game, "blue", cost("occupy", generator, generator), start), null);
  assert(!wallActive(game, edge));
  assert.equal(applyAction(game, "blue", cost("power-shield", generator, generator), start), null);
  assert(wallActive(game, edge));
});

test("a local match hands off setup and gives Blue the first fueled turn", () => {
  const game = createGame({ now: start, passAndPlay: true });
  assert.equal(game.deadline, null);
  assert.equal(applyAction(game, "red", { type: "choose-species", species: "keth" }, start), "It is the other player’s choice.");
  assert.equal(applyAction(game, "blue", { type: "choose-species", species: "directorate" }, start), null);
  assert.equal(applyAction(game, "red", { type: "choose-species", species: "keth" }, start), null);
  assert.equal(game.deadline, null);
  assert.equal(applyAction(game, "blue", { type: "ready" }, start), null);
  assert.equal(applyAction(game, "blue", { type: "place", to: cradles.red[0] }, start), "That action is unavailable.");
  for (const to of cradles.blue.slice(0, 3)) assert.equal(applyAction(game, "blue", { type: "place", to }, start), null);
  assert.equal(game.activeSide, "red");
  assert.equal(readyProxy(game, cradles.blue[0]), false);
  assert.equal(game.deadline, null);
  assert.equal(applyAction(game, "red", { type: "ready" }, start + 100), null);
  for (const to of cradles.red.slice(0, 3)) assert.equal(applyAction(game, "red", { type: "place", to }, start + 100), null);
  assert.equal(game.phase, "play");
  assert.equal(game.round, 1);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.blue.tv, 6);
  assert.equal(readyProxy(game, cradles.blue[0]), true);
  assert.equal(readyProxy(game, cradles.red[0]), false);
  assert.equal(game.deadline, null);
  assert.equal(advanceClock(game, start + 2 * turnMs), false);
  assert.equal(applyAction(game, "blue", { type: "ready" }, start + 2 * turnMs), null);
  assert.equal(game.deadline, start + 3 * turnMs);
  assert.equal(applyAction(game, "blue", { type: "end" }, start + 2 * turnMs), null);
  assert.equal(game.round, 1);
  assert.equal(applyAction(game, "red", { type: "ready" }, start + 2 * turnMs), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start + 2 * turnMs), null);
  assert.equal(game.round, 2);
});

test("timeouts complete setup, expire turns and reject actions at the deadline", () => {
  const game = createGame({ now: start });
  assert.equal(advanceClock(game, start + turnMs), false);
  assert.equal(applyAction(game, "red", { type: "choose-species", species: "veyari" }, start), null);
  assert.equal(applyAction(game, "blue", { type: "choose-species", species: "keth" }, start), null);
  assert.equal(game.deadline, start + 180_000);
  assert.equal(advanceClock(game, start + turnMs), true);
  assert.equal(game.activeSide, "red");
  assert.equal(game.players.blue.placed, 3);
  assert.equal(advanceClock(game, start + 2 * turnMs), true);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.red.placed, 3);
  assert.equal(game.players.blue.tv, 6);
  assert.equal(applyAction(game, "blue", { type: "end" }, start + 3 * turnMs), "The turn timer expired.");
  assert.equal(game.activeSide, "red");
  assert.equal(game.players.blue.tv, 0);
  assert.equal(game.players.red.tv, 6);
});

test("one Move captures an enemy for exactly 1 TV, including a fortified enemy", () => {
  const game = playGame();
  const from = 162;
  const to = 163;
  game.speciesPicks = { blue: "directorate", red: "keth" };
  proxy(game, from, "blue");
  proxy(game, to, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), "That action is unavailable.");
  proxy(game, to, "red");
  game.proxies[to].fortified = true;
  game.players.blue.tv = 0;
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), "That action is unavailable.");
  game.players.blue.tv = 1;
  assert.equal(applyAction(game, "blue", cost("strike", from, to), start), "That action is unavailable.");
  assert.equal(applyAction(game, "blue", cost("withdraw", from, to), start), "That action is unavailable.");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(game.proxies[to].side, "blue");
  assert.equal(game.proxies[from], undefined);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.activeSide, "red");
  assert.equal(game.stats.blue.tvSpent, 1);
  assert.equal(game.stats.blue.moveOrders, 1);
  assert.equal(game.stats.blue.moveCaptures, 1);
  assert.equal(game.stats.red.lost, 1);
  assert.equal(game.stats.red.hitsAbsorbed, undefined);
  assert.deepEqual(game.impacts, [{ revision: 1, tiles: [to] }]);
  assert(game.soundEvents.some(({ revision, cue }) => revision === 1 && cue === "capture"));
});

test("a capture persists when the player runs out of time", () => {
  const game = playGame();
  const from = 162;
  const to = 163;
  proxy(game, from, "blue");
  proxy(game, to, "red");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(game.players.blue.tv, 5);
  assert.equal(advanceClock(game, game.deadline), true);
  assert.equal(game.activeSide, "red");
  assert.equal(game.proxies[from], undefined);
  assert.equal(game.proxies[to].side, "blue");
  assert.equal(game.players.blue.reserve, 1);
  assert.deepEqual(game.impacts, [{ revision: 1, tiles: [to] }]);
});

test("an Aegis capture shuts down only its forward borders and persists until recapture", () => {
  const game = playGame();
  const aegis = 126; // Red's B6 Aegis.
  const from = 101;
  const outward = walls.filter(({ source }) => source === aegis);
  const homeward = walls.find(({ from, to }) => from === aegis && to === 151);
  assert(outward.length > 0);
  assert.equal(homeward.source, 176);
  game.activatedShields[aegis] = "red";
  game.activatedShields[homeward.source] = "red";

  proxy(game, from, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, aegis), start), null);
  assert.equal(nodeController(game, aegis), "red");
  assert(outward.every((wall) => wallActive(game, wall)));
  const capture = proxyActions(game, aegis).find(({ type }) => type === "occupy");
  assert.equal(capture.cost, 0);
  assert.equal(applyAction(game, "blue", capture, start), null);
  assert.equal(game.players.blue.tv, 5);
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert(wallActive(game, homeward));
  assert.equal(applyAction(game, "blue", cost("move", aegis, from), start), null);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, aegis), "blue");
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);

  proxy(game, 102, "red");
  assert.equal(applyAction(game, "red", cost("move", 102, aegis), start), null);
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert.equal(applyAction(game, "red", cost("occupy", aegis, aegis), start), null);
  assert.equal(nodeController(game, aegis), "red");
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert.equal(applyAction(game, "red", cost("power-shield", aegis, aegis), start), null);
  assert(outward.every((wall) => wallActive(game, wall)));
  assert(wallActive(game, homeward));
});

test("an Aegis can be captured after spending the last TV to enter it", () => {
  const game = playGame();
  game.players.blue.tv = 1;
  proxy(game, 101, "blue");
  assert.equal(applyAction(game, "blue", cost("move", 101, 126), start), null);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.blue.tv, 0);
  assert.equal(applyAction(game, "blue", cost("occupy", 126, 126), start), null);
  assert.equal(nodeController(game, 126), "blue");
  assert.equal(game.activeSide, "red");
});

test("Obelisk occupation has a TV cost and remains captured after departure", () => {
  const game = playGame();
  game.speciesPicks = { blue: "veyari", red: "keth" };
  const obelisk = sentinels.red[0];
  const from = 51;
  const wall = walls.find(({ source }) => source === obelisk);
  game.activatedShields[obelisk] = "red";
  proxy(game, from, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, obelisk), start), null);
  assert(wallActive(game, wall));
  assert.equal(applyAction(game, "blue", cost("occupy", obelisk, obelisk), start), null);
  assert.equal(game.players.blue.tv, 1);
  assert.equal(applyAction(game, "blue", cost("move", obelisk, from), start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, obelisk), "blue");
  assert(!wallActive(game, wall));
});

test("captured generators reverse their arcs, keep powered overlaps, and block from the new side", () => {
  for (const neighborPoweredFirst of [true, false]) {
    const game = playGame();
    const obelisk = 76; // B4
    const aegis = 126; // B6
    const native = wallsBySource.get(obelisk);
    game.activatedShields[obelisk] = "red";
    if (neighborPoweredFirst) game.activatedShields[aegis] = "red";
    proxy(game, obelisk, "blue");
    assert(native.every((wall) => wallActive(game, wall)));
    assert.equal(applyAction(game, "blue", cost("occupy", obelisk, obelisk), start), null);
    const mirrored = shieldWallsForSource(game, obelisk);
    assert.deepEqual(mirrored.map(({ from, to }) => `${tileLabel(from)}–${tileLabel(to)}`),
      ["C5–C4", "C5–B5", "B6–B5", "A5–B5", "A5–A4"]);
    assert(mirrored.every((wall) => !wallActive(game, wall)));
    assert.equal(applyAction(game, "blue", cost("power-shield", obelisk, obelisk), start), null);
    assert(native.every((wall) => !wallActive(game, wall)));
    const [shared, open] = mirrored;
    const existing = wallsBySource.get(aegis).find(({ from, to }) => edgeKey(from, to) === edgeKey(shared.from, shared.to));
    assert(wallActive(game, open));

    assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
    proxy(game, aegis, "red");
    if (!neighborPoweredFirst) assert.equal(applyAction(game, "red", cost("power-shield", aegis, aegis), start), null);
    assert.equal(wallActive(game, existing), neighborPoweredFirst);
    assert.equal(wallActive(game, shared), !neighborPoweredFirst);
    proxy(game, open.from, "red");
    assert.match(applyAction(game, "red", cost("move", open.from, open.to), start), /unavailable/);
  }
});

test("a Deposit costs 3 TV and grants a reserve even if the claim is denied", () => {
  const game = playGame();
  const deposit = 162;
  proxy(game, deposit, "blue");
  assert.equal(nodeController(game, deposit), null);
  assert.equal(applyAction(game, "blue", cost("occupy", deposit, deposit), start), null);
  assert.equal(game.players.blue.tv, 3);
  assert.equal(game.players.blue.reserve, 1);
  const retreat = proxyActions(game, deposit).find(({ type }) => type === "move");
  assert.equal(applyAction(game, "blue", retreat, start), null);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, deposit), null);
  assert.equal(game.players.blue.reserve, 1);
});

test("all own Cradle hexes can spawn Proxies, including its Obelisks, and the units activate next turn", () => {
  const setup = createGame({ now: start, selectSpecies: false });
  for (const side of ["blue", "red"]) {
    setup.activeSide = side;
    assert.deepEqual(placementActions(setup).map(({ to }) => to), cradles[side]);
    assert.equal(cradles[side].filter((id) => tiles.get(id).node?.type === "sentinel").length, 3);
  }
  const game = playGame();
  game.players.blue.reserve = 1;
  const to = 71;
  assert(!placementActions(game).some((action) => cradles.red.includes(action.to)));
  assert.equal(applyAction(game, "blue", { type: "spawn", to }, start), null);
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(readyProxy(game, to), false);
  assert.equal(baseShieldActive(game, "blue"), false);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(readyProxy(game, to), true);
  assert.equal(game.players.blue.tv, 4);
  assert.equal(baseShieldActive(game, "blue"), false);
});

test("each Vanguard costs 2 TV and only protects its own Nexus approaches and inward borders", () => {
  const game = playGame();
  const [vanguard, other] = vanguards.blue;
  const support = 8;
  const inward = wallsBySource.get(vanguard)[0];
  const otherInward = wallsBySource.get(other)[0];
  const shield = wallsBySource.get(support)[0];
  const approaches = (source) => nexusWalls.filter((wall) => wall.source === source);
  assert.deepEqual(approaches(vanguard).map(({ to }) => tileLabel(to)), ["X1", "W2", "W1"]);
  assert.deepEqual(approaches(other).map(({ to }) => tileLabel(to)), ["Y1", "Y2", "X3"]);
  proxy(game, vanguard, "blue");
  proxy(game, support, "blue");
  game.players.blue.tv = 1;
  assert.match(nodeOrders(game, vanguard).find(({ type }) => type === "power-shield").error, /Needs 2 TV/);
  assert.match(applyAction(game, "blue", cost("power-shield", vanguard, vanguard), start), /unavailable/);
  game.players.blue.tv = 12;
  game.proxies[vanguard].readyOn = 2;
  assert.match(applyAction(game, "blue", cost("power-shield", vanguard, vanguard), start), /unavailable/);
  game.proxies[vanguard].readyOn = 0;
  assert.equal(applyAction(game, "blue", cost("power-shield", vanguard, vanguard), start), null);
  assert.equal(game.players.blue.tv, 10);
  assert(!wallActive(game, inward));
  assert.equal(applyAction(game, "blue", cost("power-shield", support, support), start), null);
  assert.equal(game.players.blue.tv, 8);
  assert(wallActive(game, shield));
  assert(wallActive(game, inward));
  assert.equal(applyAction(game, "blue", cost("move", support, 9), start), null);
  assert(wallActive(game, shield));
  assert(approaches(vanguard).every((wall) => wallActive(game, wall)));
  assert(approaches(other).every((wall) => !wallActive(game, wall)));
  assert(!wallActive(game, otherInward));
  assert(!baseShieldActive(game, "blue"));
  proxy(game, other, "blue");
  assert(!baseShieldActive(game, "blue"));
  assert.equal(applyAction(game, "blue", cost("power-shield", other, other), start), null);
  assert(wallActive(game, otherInward));
  assert(baseShieldActive(game, "blue"));
  assert.equal(applyAction(game, "blue", cost("move", vanguard, 23), start), null);
  assert(!baseShieldActive(game, "blue"));
  assert(wallActive(game, otherInward));
  assert.equal(applyAction(game, "blue", cost("move", 23, vanguard), start), null);
  assert(baseShieldActive(game, "blue"));
});

test("the three Cradle Obelisks cannot switch off Vanguard borders while another home generator provides power", () => {
  for (const side of ["blue", "red"]) {
    const game = playGame();
    const opponent = otherSide(side);
    game.activeSide = opponent;
    game.players[opponent].tv = 20;
    const support = nodes.find(({ node }) => node.home === side && node.type === "aegis").id;
    const obelisks = cradles[side].filter((id) => tiles.get(id).node?.type === "sentinel");
    const inward = vanguards[side].flatMap((id) => wallsBySource.get(id));
    assert(inward.length > 6);
    assert(inward.every(({ from, to }) => cradles[side].includes(from) && cradles[side].includes(to)));
    for (const vanguard of vanguards[side]) proxy(game, vanguard, side);
    for (const id of [...vanguards[side], support, ...obelisks]) game.activatedShields[id] = side;
    for (const id of obelisks) {
      proxy(game, id, opponent);
      assert.equal(applyAction(game, opponent, cost("occupy", id, id), start), null);
      assert(wallsBySource.get(id).every((wall) => !wallActive(game, wall)));
      assert(inward.every((wall) => wallActive(game, wall)));
    }
    proxy(game, support, opponent);
    assert(!baseShieldActive(game, side));
    assert(inward.every((wall) => !wallActive(game, wall)));
  }
});

test("an Obelisk can fire at a reachable enemy up to two steps away without moving", () => {
  const game = playGame();
  const from = sentinels.blue[0];
  const to = 6;
  proxy(game, from, "blue");
  const emptyRange = obeliskRange(game, from);
  assert(emptyRange.some((hex) => hex.to === to && hex.steps === 2 && !hex.occupied));
  assert(!proxyActions(game, from).some(({ type }) => type === "fire"));
  proxy(game, to, "red");
  assert(!tiles.get(from).neighbors.includes(to));
  assert.equal(applyAction(game, "blue", cost("fire", from, to), start), null);
  assert.equal(game.stats.blue.obeliskShots, 1);
  assert.deepEqual(game.impacts[0].tiles, [to]);
  assert.equal(game.proxies[to], undefined);
  assert.equal(game.proxies[from].side, "blue");
  assert.equal(game.players.blue.tv, 5);
});

test("a partially powered Nexus can be approached through the open half", () => {
  const game = playGame();
  const wall = walls.find(({ source, side }) => side === "red" && tiles.get(source).node.type === "sentinel");
  game.activatedShields[wall.source] = "red";
  proxy(game, wall.from, "blue");
  proxy(game, wall.to, "red");
  assert.equal(applyAction(game, "blue", cost("move", wall.from, wall.to), start), "That action is unavailable.");
  assert.equal(game.proxies[wall.to].side, "red");

  const target = nexus.red;
  const from = tiles.get(target).neighbors.find((id) => id !== null && tiles.get(id).node?.type !== "vanguard");
  const westApproach = 300; // A13
  proxy(game, from, "blue");
  proxy(game, westApproach, "blue");
  proxy(game, target, "red");
  const [west, east] = vanguards.red;
  proxy(game, west, "red");
  game.activatedShields[west] = "red";
  assert(!baseShieldActive(game, "red"));
  assert(!proxyActions(game, westApproach).some(({ to }) => to === target));
  assert(proxyActions(game, from).some(({ to }) => to === target));
  proxy(game, east, "red");
  game.activatedShields[east] = "red";
  assert.equal(baseShieldActive(game, "red"), true);
  assert.equal(applyAction(game, "blue", cost("move", from, target), start), "That action is unavailable.");
  for (const id of sentinels.red) game.claims[id] = { held: "blue", pending: null };
  assert.equal(baseShieldActive(game, "red"), false);
  assert.equal(applyAction(game, "blue", cost("move", from, target), start), null);
  assert.equal(game.proxies[target].side, "blue");
  assert.equal(game.winner, "blue");
  assert.equal(game.phase, "finished");
  assert.equal(game.deadline, null);
});
