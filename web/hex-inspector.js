import { nexusWalls, sideName, tileLabel, tileName, tiles } from "./board.js";
import { ACTION_COST, nodeController, proxyReady, shieldWallsForSource, wallActive } from "./rules.js";
import { specialHexLinks } from "./territory.js";

export const NODE_ICONS = {
  aegis: { file: "./assets/aegis.png", size: 24 },
  deposit: { file: "./assets/deposit.png", size: 22 },
  nexus: { file: "./assets/nexus.png", size: 43 },
  sentinel: { file: "./assets/sentinel.png", size: 43 },
  vanguard: { file: "./assets/vanguard.png", size: 39 },
};

const descriptions = {
  nexus: "Enter the enemy Nexus to win. Each powered Vanguard protects three approaches. Full protection requires both halves.",
  vanguard: "Pay 2 TV to arm this half of the Nexus shield. It needs an active friendly Proxy here and an online home Aegis or Obelisk clear of enemies.",
  sentinel: "Activate its linked field shield for 2 TV. Base capture cost is 3 TV. Home Obelisk fire costs 1 TV before modifiers and reaches up to two hexes.",
  aegis: "Capture for free and activate its shield for 2 TV. With the Forward Deployment augment, a staffed and powered Aegis can deploy reserve Proxies to legal neighbors.",
  deposit: "Claim it to gain one reserve Proxy. Keep an active Proxy on a Deposit you control to buy augments.",
  cradle: "Place starting Proxies here or deploy from reserve. Deployed Proxies activate on your next turn.",
  turbulence: "Veyari can phase jump from this terrain. Ascension bonuses are inactive here, and salvage caches can appear.",
  cache: "Spend 2 TV with an active Proxy on this hex to add one Proxy to reserve. Recovering it removes the cache.",
  territory: "Territory marks which side can use Defensive Strike against enemies here.",
};

function element(tag, value) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  return node;
}

export function renderHexInspector(panel, game, id, region) {
  const tile = tiles.get(id);
  panel.hidden = !tile;
  if (!tile) return;
  const cache = game.caches?.includes(id);
  const kind = tile.node?.type ?? (cache ? "cache" : tile.cradle ? "cradle" : tile.region === "turbulence" ? "turbulence" : "territory");
  const heading = element("h2", `${cache ? "Salvage cache" : tileName(tile)} · ${tileLabel(id)}`);
  heading.id = "hex-title";
  const header = element("div");
  header.className = "hex-inspector-heading";
  const icon = NODE_ICONS[kind];
  if (icon) {
    const image = element("img");
    image.src = icon.file;
    image.alt = "";
    image.width = 32;
    image.height = 32;
    header.append(image);
  }
  header.append(heading);
  const details = element("dl");
  function add(label, value) {
    const row = element("div");
    row.append(element("dt", label), element("dd", value));
    details.append(row);
  }

  add("Region", region ? sideName(region) : "Neutral");
  if (tile.node) {
    const controller = nodeController(game, id);
    const pending = kind === "deposit" && game.claims[id]?.pending;
    add("Control", controller ? `${sideName(controller)}${pending ? " · claim pending" : ""}` : "Unclaimed");
    const links = specialHexLinks.get(id);
    if (links.length) add("Territory links", links.map(tileLabel).join(" · "));
    const fieldGenerator = kind === "aegis" || kind === "sentinel";
    if (fieldGenerator || kind === "vanguard") {
      const borders = shieldWallsForSource(game, id);
      const powered = borders.filter((wall) => wallActive(game, wall)).length;
      const status = powered === 0 ? "Offline" : powered === borders.length ? "Online" : "Partial";
      add(kind === "vanguard" ? "Inward borders" : "Shield borders", `${status} · ${powered}/${borders.length} powered`);
      if (fieldGenerator && controller !== tile.node.home) add("Shield direction", "Mirrored toward the opposing side");
      add("Activation", game.activatedShields?.[id] ? "Activated" : `${ACTION_COST.shield} TV`);
    }
    if (kind === "nexus" || kind === "vanguard") {
      const approaches = nexusWalls.filter(({ side, source }) => side === tile.node.home && (kind === "nexus" || source === id));
      const powered = approaches.filter((wall) => wallActive(game, wall)).length;
      const status = powered === 0 ? "Offline" : powered === approaches.length ? "Online" : "Partial";
      add(kind === "nexus" ? "Nexus shield" : "Shield half", `${status} · ${powered}/${approaches.length} approaches`);
      if (kind === "vanguard") add("Nexus approaches", approaches.map(({ to }) => tileLabel(to)).join(" · "));
    }
  }
  const proxy = game.proxies[id];
  if (proxy) {
    const status = proxyReady(game, proxy) ? "Active" : "Activates on its owner’s next turn";
    add(`${sideName(proxy.side)} Proxy`, proxy.fortified ? `${status} · fortified` : status);
    if (proxy.fortified) add("Armor", "Absorbs one Obelisk or Defensive Strike hit");
  } else {
    add("Proxies", "Empty");
  }
  panel.replaceChildren(header, element("p", descriptions[kind]), details);
}
