import {
  board, nexus, nexusWalls, nexusWallsByEdge, sideName, tileLabel, tileName, tiles, wallsByEdge,
} from "./board.js";
import { NODE_ICONS } from "./hex-inspector.js";
import { effectiveProxySkin, VOID_PROXY_SKIN } from "./proxy-skins.js";
import { nodeController, poweredBorder, proxyReady, wallActive } from "./rules.js";

export const IMPACT_MS = 220;
const RADIUS = 25;
const HEIGHT = Math.sqrt(3) * RADIUS;
const PAD = 17;
const WIDTH = 2 * PAD + 2 * RADIUS + 24 * 1.5 * RADIUS;
const MAP_HEIGHT = 2 * PAD + 14 * HEIGHT;
const POINTS = [[1, 0], [.5, Math.sqrt(3) / 2], [-.5, Math.sqrt(3) / 2],
  [-1, 0], [-.5, -Math.sqrt(3) / 2], [.5, -Math.sqrt(3) / 2]];
const centers = new Map(board.map((tile) => [
  tile.id, {
    x: PAD + RADIUS + tile.column * 1.5 * RADIUS,
    y: PAD + (tile.row + 1 - (tile.column % 2) / 2) * HEIGHT,
  },
]));

const terrain = {
  blue: ["#233d5a", "#55799f"],
  red: ["#472b37", "#976272"],
  turbulence: ["#303946", "#657585"],
  cradle: ["#244638", "#78a393"],
};
const team = {
  blue: { wall: "#b394ff", body: "#294f99", light: "#b5d2ff" },
  red: { wall: "#eea367", body: "#85373e", light: "#ffc0ae" },
};
const INLAYS = {
  nexus: { color: "#ffe294", paths: [
    [[-10, -15], [-10, -18], [-5, -15], [0, -19.5], [5, -15], [10, -18], [10, -15]],
    [[-8, 16], [8, 16]],
  ] },
  vanguard: { color: "#efba86", paths: [
    [[-16, -10], [-21, 0], [-16, 10]], [[16, -10], [21, 0], [16, 10]],
  ] },
  sentinel: { color: "#d0b9fd", paths: [
    [[-6, -14], [0, -19], [6, -14]], [[-6, 14], [0, 19], [6, 14]],
  ] },
  aegis: { color: "#f0c980", paths: [
    [[-9, -16], [9, -16]], [[-9, 16], [9, 16]],
  ] },
  deposit: { color: "#f1c36e", ring: true },
  cache: { color: "#a1efdf", paths: [
    [[-19, 0], [0, -17.5], [19, 0], [0, 17.5], [-19, 0]],
  ] },
};
const DRONE = [
  [0, -12], [5.4, -7.2], [6.7, -3.5], [11.2, .6], [11.2, 7.5], [5.5, 5.8],
  [0, 10.2], [-5.5, 5.8], [-11.2, 7.5], [-11.2, .6], [-6.7, -3.5], [-5.4, -7.2],
];
const VOID_MASK = [
  [-11, -12.5], [-5.4, -8.4], [-3, -5.8], [3, -5.8], [5.4, -8.4], [11, -12.5],
  [10, -3], [7.4, 5.6], [0, 11], [-7.4, 5.6], [-10, -3],
];
const voidRifts = new Path2D("M-5-1.5l3 1.5m4 0 3-1.5M1 2-1 4l1.6 1.3L0 8");
const fortificationShell = new Path2D("M-16-4v-5l11-5m10 0 11 5v5M-16 4v3q4 5 16 9 12-4 16-9V4");
const directionKeys = { w: 0, e: 1, d: 2, s: 3, a: 4, q: 5, ArrowUp: 0, ArrowDown: 3 };

export function createBoardView(canvas, viewport, chooseTile, previewAction) {
  const ctx = canvas.getContext("2d");
  const assets = {};
  let game = null;
  let selection = null;
  let inspected = null;
  let cursor = null;
  let hovered = null;
  let targets = new Map();
  let plan = [];
  let range = new Set();
  let regions = new Map();
  let revision = null;
  const flashes = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let order = "move";
  let playerSkins = {};
  let zoom = 1;
  let frame = 0;

  for (const [type, asset] of Object.entries(NODE_ICONS)) {
    const img = new Image();
    img.addEventListener("load", draw);
    img.src = asset.file;
    assets[type] = img;
  }

  function hex(x, y, radius) {
    ctx.beginPath();
    for (const [i, [dx, dy]] of POINTS.entries()) {
      const px = x + dx * radius;
      const py = y + dy * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function circle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawTile(tile) {
    const { x, y } = centers.get(tile.id);
    const proxy = game?.proxies[tile.id];
    const action = targets.get(tile.id);
    const hop = action?.type === "hop-target";
    const isSelected = tile.id === selection;
    const isInspected = tile.id === inspected;
    const isFocused = tile.id === cursor && document.activeElement === canvas;
    const isHovered = tile.id === hovered;
    const planned = plan.includes(tile.id);
    const inRange = range.has(tile.id);
    const [fill, edge] = terrain[tile.cradle ? "cradle" : regions.get(tile.id) ?? "turbulence"];
    const kind = tile.node?.type;
    const controller = game && tile.node ? nodeController(game, tile.id) : null;
    const captured = controller && controller !== tile.node.home;
    const cache = game?.caches?.includes(tile.id);

    hex(x, y, RADIUS * .946);
    ctx.fillStyle = isSelected || planned ? "#4a412b" : hop ? "#443759" : action ? (proxy ? "#512d37" : "#30464d")
      : inRange ? "#243c48" : fill;
    ctx.fill();
    ctx.lineWidth = isSelected || isFocused || planned || isInspected ? 2.2 : kind || inRange ? 1.55 : 1.02;
    ctx.strokeStyle = isSelected || planned ? "#ffe298" : isFocused || isInspected ? "#f3f5ff" : hop ? "#e4b5f5"
      : isHovered ? "#b3c5d9" : inRange ? "#79c9d7" : captured ? team[controller].light
        : kind === "deposit" ? "#dbb96e" : edge;
    ctx.stroke();

    if (proxy) {
      if (kind || cache) drawNodeInlay(x, y, INLAYS[kind ?? "cache"]);
      drawProxy(proxy, x, y, proxyReady(game, proxy), action || planned);
    } else {
      if (kind && assets[kind]?.complete && assets[kind].naturalWidth) {
        const { size } = NODE_ICONS[kind];
        ctx.drawImage(assets[kind], x - size / 2, y - size / 2, size, size);
      }
      if (cache && !kind) drawCache(x, y);
      if (action && !hop) {
        const dy = kind || cache ? 12 : 0;
        circle(x, y + dy, 5.2, "#183231");
        circle(x, y + dy, 2.8, "#b3eee0");
      }
    }
    if (hop) {
      ctx.save();
      ctx.translate(x + (proxy ? 13 : 0), y + (proxy || kind || cache ? 12 : 0));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#e4b5f5";
      ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
      ctx.restore();
    }
    if (kind && cache) drawCache(x - 12, y + 10, .7);
    if (captured) {
      circle(x + 12, y - 10, 5, team[controller].light);
      circle(x + 12, y - 10, 3, team[controller].body);
    }
  }

  function drawNodeInlay(x, y, { color, paths, ring }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.85;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    if (ring) ctx.arc(0, 0, 17.7, 0, 2 * Math.PI);
    else {
      for (const [[startX, startY], ...rest] of paths) {
        ctx.moveTo(startX, startY);
        for (const [px, py] of rest) ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCache(x, y, scale = 1) {
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#a1efdf";
    ctx.strokeRect(x - 6 * scale, y - 5 * scale, 12 * scale, 10 * scale);
    ctx.strokeRect(x - 2 * scale, y - 5 * scale, 4 * scale, 10 * scale);
  }

  function traceClassicProxy() {
    ctx.moveTo(0, -11.1);
    ctx.lineTo(9, -6.3);
    ctx.lineTo(8.1, 3.5);
    ctx.quadraticCurveTo(5.6, 8, 0, 11);
    ctx.quadraticCurveTo(-5.6, 8, -8.1, 3.5);
    ctx.lineTo(-9, -6.3);
  }

  function drawProxy(proxy, x, y, ready, action) {
    const proxyDesign = effectiveProxySkin(game, proxy.side, playerSkins[proxy.side]);
    const classic = proxyDesign === "classic";
    const drone = proxyDesign === "drone";
    const eroded = proxyDesign === VOID_PROXY_SKIN;
    const silhouette = eroded ? VOID_MASK : drone ? DRONE : null;
    const color = team[proxy.side];
    ctx.save();
    ctx.translate(x, y);
    if (!classic) ctx.lineJoin = "round";
    if (!ready) ctx.setLineDash([3, 2]);
    ctx.beginPath();
    if (classic) traceClassicProxy();
    else if (silhouette) {
      ctx.moveTo(...silhouette[0]);
      for (let i = 1; i < silhouette.length; i += 1) ctx.lineTo(...silhouette[i]);
    } else ctx.arc(0, 0, 9.9, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = eroded ? "#291b30" : ready ? color.body : "#26313b";
    ctx.strokeStyle = action && !eroded ? "#ffdea0" : color.light;
    ctx.lineWidth = action ? 2.5 : 2;
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    if (classic) {
      ctx.beginPath();
      ctx.moveTo(-3.7, -1);
      ctx.lineTo(0, 3.1);
      ctx.lineTo(3.7, -1);
      ctx.strokeStyle = color.light;
      ctx.lineWidth = 1.55;
      ctx.stroke();
    } else if (drone) {
      ctx.fillStyle = color.light;
      ctx.fillRect(-3.5, -2.9, 7, 2);
      if (ready) ctx.fillRect(-1, 2.8, 2, 2);
    } else if (eroded) {
      ctx.strokeStyle = "#ff7d9a";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.stroke(voidRifts);
    }
    if (proxy.fortified) {
      ctx.strokeStyle = "#ffdb91";
      ctx.lineWidth = 2;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.stroke(fortificationShell);
    }
    ctx.restore();
  }

  function drawWall({ from, to, side }, active, linked) {
    const a = centers.get(from);
    const b = centers.get(to);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const half = RADIUS * .38 / HEIGHT;
    const dx = (b.y - a.y) * half;
    const dy = (a.x - b.x) * half;
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    drawShield(team[side].wall, active, linked);
  }

  function drawNexusWall({ from, direction }, active, linked) {
    const { x, y } = centers.get(from);
    const radius = RADIUS * .85;
    const [ax, ay] = POINTS[(direction + 4) % 6];
    const [bx, by] = POINTS[(direction + 5) % 6];
    ctx.beginPath();
    ctx.moveTo(x + ax * radius, y + ay * radius);
    ctx.lineTo(x + bx * radius, y + by * radius);
    drawShield("#ffdc90", active, linked);
  }

  function drawShield(color, active, linked = false) {
    const weight = active ? 3 : 2.15;
    ctx.save();
    ctx.lineCap = active ? "round" : "butt";
    if (!active) ctx.setLineDash([4.2, 2.9]);
    if (linked) {
      ctx.lineWidth = weight + 2;
      ctx.strokeStyle = "#e2eaff";
      ctx.globalAlpha = .6;
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = active || linked ? 1 : .64;
    ctx.lineWidth = weight;
    ctx.stroke();
    ctx.restore();
  }

  function showNewImpacts(state) {
    if (!state || revision === null || state.revision < revision) flashes.clear();
    else if (!reducedMotion.matches) {
      const expires = performance.now() + IMPACT_MS;
      for (const impact of state.impacts ?? []) {
        if (impact.revision <= revision) continue;
        for (const tile of impact.tiles) flashes.set(tile, expires);
      }
    }
    revision = state?.revision ?? null;
  }

  function drawImpacts(time) {
    ctx.save();
    ctx.fillStyle = "#fff";
    for (const [id, expires] of flashes) {
      if (time >= expires) {
        flashes.delete(id);
        continue;
      }
      const { x, y } = centers.get(id);
      ctx.globalAlpha = Math.min(1, (expires - time) / (IMPACT_MS * .76));
      hex(x, y, RADIUS * .945);
      ctx.fill();
    }
    ctx.restore();
    if (flashes.size) draw();
  }

  function drawPlan() {
    if (order !== "hop" || !plan.length) return;
    const origin = centers.get(selection);
    ctx.save();
    ctx.strokeStyle = "#ffdb91";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    for (const id of plan) {
      const { x, y } = centers.get(id);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    for (const id of plan) {
      const { x, y } = centers.get(id);
      circle(x, y, 4.5, "#ffdb91");
    }
  }

  function draw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame((time) => {
      if (!canvas.width || !canvas.height) return;
      ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / MAP_HEIGHT, 0, 0);
      ctx.clearRect(0, 0, WIDTH, MAP_HEIGHT);
      for (const tile of board) drawTile(tile);
      const linked = ({ source, side }) => source === inspected
        || (nexus[side] === inspected && tiles.get(source).node.type === "vanguard");
      for (const [edge, borders] of wallsByEdge) {
        const powered = game ? poweredBorder(game, edge) : null;
        if (powered && powered === nexusWallsByEdge.get(edge)) continue;
        const visible = borders.filter(({ source, side }) => side === (game ? nodeController(game, source) : tiles.get(source).node.home));
        const wall = powered ?? visible.find(linked) ?? visible[0];
        if (wall) drawWall(wall, !!powered, linked(wall));
      }
      for (const wall of nexusWalls) {
        drawNexusWall(wall, !!game && wallActive(game, wall), linked(wall));
      }
      drawPlan();
      drawImpacts(time);
    });
  }

  function resize() {
    const maxHeight = Number.parseFloat(getComputedStyle(viewport).maxHeight) || Infinity;
    const fit = Math.min(viewport.offsetWidth, maxHeight * WIDTH / MAP_HEIGHT);
    const width = Math.max(1, Math.floor(fit * zoom));
    const height = Math.round(width * MAP_HEIGHT / WIDTH);
    const density = Math.min(2, window.devicePixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.max(1, Math.round(width * density));
    canvas.height = Math.max(1, Math.round(height * density));
    draw();
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * WIDTH / rect.width;
    const y = (event.clientY - rect.top) * MAP_HEIGHT / rect.height;
    for (const [id, point] of centers) {
      const dx = Math.abs(x - point.x);
      const dy = Math.abs(y - point.y);
      if (dy <= HEIGHT / 2 && dx + dy / Math.sqrt(3) <= RADIUS) return id;
    }
    return null;
  }

  function ensureVisible(id) {
    const point = centers.get(id);
    const x = point.x * canvas.clientWidth / WIDTH;
    const y = point.y * canvas.clientHeight / MAP_HEIGHT;
    const padding = RADIUS * canvas.clientWidth / WIDTH;
    if (x < viewport.scrollLeft + padding || x > viewport.scrollLeft + viewport.clientWidth - padding
        || y < viewport.scrollTop + padding || y > viewport.scrollTop + viewport.clientHeight - padding) {
      viewport.scrollTo(x - viewport.clientWidth / 2, y - viewport.clientHeight / 2);
    }
  }

  function describeCursor() {
    if (cursor === null) return;
    const tile = tiles.get(cursor);
    const proxy = game?.proxies[cursor];
    const action = targets.get(cursor);
    const region = regions.get(cursor);
    let label = `${tileLabel(cursor)}, ${tileName(tile, region)}`;
    if ((tile.node || tile.cradle) && region) label += `, ${sideName(region)} region`;
    if (game?.caches?.includes(cursor)) label += ", salvage cache";
    if (proxy) label += `, ${sideName(proxy.side)} ${proxy.fortified ? "fortified Proxy" : "Proxy"}`;
    if (action) {
      const labelType = action.type === "move" && proxy ? "capture Proxy"
        : action.type === "hop-target" ? "Hop landing" : action.type;
      label += `, ${labelType}, ${action.cost} TV`;
      if (action.refund) label += ", refunded by Ascension";
    }
    else if (range.has(cursor)) label += ", in firing range";
    canvas.setAttribute("aria-label", label);
  }

  canvas.addEventListener("click", (event) => {
    const id = pick(event);
    if (id !== null) {
      cursor = id;
      chooseTile(id);
      describeCursor();
      draw();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const id = pick(event);
    if (id !== hovered) {
      hovered = id;
      previewAction(id, targets.get(id), range.has(id), regions.get(id));
      draw();
    }
  });
  canvas.addEventListener("pointerleave", () => {
    hovered = null;
    previewAction(null, null);
    draw();
  });
  canvas.addEventListener("focus", () => {
    cursor ??= nexus[game?.activeSide ?? "blue"];
    describeCursor();
    draw();
  });
  canvas.addEventListener("blur", draw);
  canvas.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    let direction = directionKeys[key];
    if (key === "ArrowLeft") direction = event.shiftKey ? 5 : 4;
    if (key === "ArrowRight") direction = event.shiftKey ? 1 : 2;
    if (direction !== undefined) {
      event.preventDefault();
      cursor = tiles.get(cursor).neighbors[direction] ?? cursor;
      ensureVisible(cursor);
      describeCursor();
      draw();
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      chooseTile(cursor);
    }
  });

  new ResizeObserver(resize).observe(viewport);
  resize();
  return {
    render(state, {
      selected = null, inspect = null, actions = [], planned = [], mode = "move", firingRange = [], playerSkins: skins = {},
      regions: currentRegions = new Map(),
    } = {}) {
      showNewImpacts(state);
      game = state;
      selection = selected;
      inspected = inspect;
      targets = new Map(actions.map((action) => [action.to, action]));
      range = new Set(firingRange);
      regions = currentRegions;
      plan = planned;
      order = mode;
      playerSkins = skins;
      describeCursor();
      draw();
    },
    zoomBy(delta) {
      zoom = Math.max(1, Math.min(2.8, zoom + delta));
      resize();
      if (cursor !== null) ensureVisible(cursor);
      return zoom;
    },
    fit() {
      zoom = 1;
      resize();
      viewport.scrollTo(0, 0);
    },
    focusSide(side) {
      cursor = nexus[side];
      ensureVisible(cursor);
      describeCursor();
      draw();
    },
  };
}
