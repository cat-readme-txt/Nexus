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

// Neighbor indices run clockwise from north, matching the board artwork.
for (const tile of board) {
  const { column: c, row: r } = tile;
  const upper = r - c % 2;
  const offsets = [[c, r - 1], [c + 1, upper], [c + 1, upper + 1],
    [c, r + 1], [c - 1, upper + 1], [c - 1, upper]];
  tile.neighbors = offsets.map(([column, row]) => {
    if (column < 0 || column >= columns || row < 0) return null;
    const id = idAt(column, row);
    return tiles.has(id) ? id : null;
  });
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
export const walls = SHIELD_LAYOUT.map(([from, to, ...sources]) => ({
  from, to, sources, side: tiles.get(sources[0]).node.home,
}));
export const wallsByEdge = new Map();
for (const wall of walls) {
  const key = edgeKey(wall.from, wall.to);
  if (!wallsByEdge.has(key)) wallsByEdge.set(key, []);
  wallsByEdge.get(key).push(wall);
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
