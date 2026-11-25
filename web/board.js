import { NODE_LAYOUT, SHIELD_LAYOUT, TERRAIN_ROWS } from "./board-data.js";

export const SIDES = ["blue", "red"];
export const otherSide = (side) => side === "blue" ? "red" : "blue";
export const sideName = (side) => side === "blue" ? "Blue" : "Red";

const columns = TERRAIN_ROWS[0].length;
const idAt = (column, row) => row * columns + column;
const nodeAt = new Map(NODE_LAYOUT.map(([column, row, type, home]) => [
  idAt(column, row), { type, home },
]));
const region = { b: "blue", B: "blue", r: "red", R: "red", t: "turbulence", d: "deposit" };

export const board = TERRAIN_ROWS.flatMap((row, r) => Array.from(row, (code, c) => {
  if (code === " ") return null;
  const id = idAt(c, r);
  return {
    id, column: c, row: r, region: region[code],
    cradle: code === "B" || code === "R" ? region[code] : null,
    node: nodeAt.get(id) ?? null,
  };
}).filter(Boolean));

export const tiles = new Map(board.map((tile) => [tile.id, tile]));

function playableId(column, row) {
  if (column < 0 || column >= columns || row < 0) return null;
  const id = idAt(column, row);
  return tiles.has(id) ? id : null;
}

// Neighbor indices run clockwise from north, matching the board artwork.
for (const tile of board) {
  const { column: c, row: r } = tile;
  const upper = r - c % 2;
  const offsets = [[c, r - 1], [c + 1, upper], [c + 1, upper + 1],
    [c, r + 1], [c - 1, upper + 1], [c - 1, upper]];
  tile.neighbors = offsets.map(([column, row]) => playableId(column, row));
}

export const cradles = Object.fromEntries(SIDES.map((side) => [
  side, board.filter((tile) => tile.cradle === side).map(({ id }) => id),
]));
export const nodes = board.filter((tile) => tile.node);
export const nexus = {};
export const vanguards = { blue: [], red: [] };
export const sentinels = { blue: [], red: [] };
for (const { id, node } of nodes) {
  if (node.type === "nexus") nexus[node.home] = id;
  if (node.type === "vanguard") vanguards[node.home].push(id);
  if (node.type === "sentinel") sentinels[node.home].push(id);
}

export const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

export const nexusWalls = SIDES.flatMap((side) => {
  const from = nexus[side];
  // Both pairs appear west-to-east in NODE_LAYOUT.
  const [west, east] = vanguards[side];
  return tiles.get(from).neighbors.map((to, direction) => ({
    from, to, direction, side, source: direction >= 1 && direction <= 3 ? east : west,
  }));
});
export const nexusWallsByEdge = new Map(nexusWalls.map((wall) => [edgeKey(wall.from, wall.to), wall]));

export const walls = SHIELD_LAYOUT.map(([from, to, source]) => ({
  from, to, source, side: tiles.get(source).node.home,
}));
export const wallsByEdge = new Map();
export const wallsBySource = new Map();
export const mirroredWallsBySource = new Map();

function indexWall(wall, bySource) {
  const key = edgeKey(wall.from, wall.to);
  if (!wallsByEdge.has(key)) wallsByEdge.set(key, []);
  wallsByEdge.get(key).push(wall);
  if (!bySource.has(wall.source)) bySource.set(wall.source, []);
  bySource.get(wall.source).push(wall);
}

function oppositeHex(pivot, id) {
  const center = tiles.get(pivot);
  const tile = tiles.get(id);
  // Odd columns sit half a row up, so rotating the edge also reflects that offset.
  const row = 2 * center.row - tile.row + tile.column % 2 - center.column % 2;
  return playableId(2 * center.column - tile.column, row);
}

for (const wall of walls) indexWall(wall, wallsBySource);
for (const { from, to, source, side } of walls) {
  const { type } = tiles.get(source).node;
  if (type !== "aegis" && type !== "sentinel") continue;
  const mirroredFrom = oppositeHex(source, from);
  const mirroredTo = oppositeHex(source, to);
  if (mirroredFrom !== null && mirroredTo !== null) {
    indexWall({ from: mirroredFrom, to: mirroredTo, source, side: otherSide(side) }, mirroredWallsBySource);
  }
}

export const NODE_NAMES = {
  nexus: "Nexus", vanguard: "Vanguard", sentinel: "Sentinel Obelisk",
  aegis: "Aegis", deposit: "Deposit",
};

export function tileLabel(id) {
  const { column, row } = tiles.get(id);
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

export function tileName(tile) {
  return tile.node ? NODE_NAMES[tile.node.type]
    : tile.cradle ? `${sideName(tile.cradle)} Cradle`
      : tile.region === "turbulence" ? "Turbulence" : `${sideName(tile.region)} territory`;
}
