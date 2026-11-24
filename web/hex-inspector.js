import { sideName, tileLabel, tileName, tiles, wallsBySource } from "./board.js";
import { baseShieldActive, forwardingFrom, nodeController, proxyReady, shieldSourceActive } from "./rules.js";

export const NODE_ICONS = {
  aegis: { file: "./assets/aegis.png", size: 24 },
  deposit: { file: "./assets/deposit.png", size: 22 },
  nexus: { file: "./assets/nexus.png", size: 43 },
  sentinel: { file: "./assets/sentinel.png", size: 43 },
  vanguard: { file: "./assets/vanguard.png", size: 39 },
};

const descriptions = {
  nexus: "Enter the enemy Nexus to win. A powered Vanguard shield protects it.",
  vanguard: "An active friendly Proxy powers the Nexus shield here. The shield falls if the enemy controls all eight home Obelisks.",
  sentinel: "Capture with a Proxy on this hex to disable or restore its linked borders. Base cost is 3 TV. Obelisk fire costs 1 TV before modifiers and reaches up to two hexes.",
  aegis: "Capture for free with a Proxy on this hex to disable or restore its linked borders. A staffed, controlled Aegis can deploy a reserve Proxy to a neighboring hex.",
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

export function renderHexInspector(panel, game, id) {
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

  if (tile.node) {
    const controller = nodeController(game, id);
    const pending = kind === "deposit" && game.claims[id]?.pending;
    add("Control", controller ? `${sideName(controller)}${pending ? " · claim pending" : ""}` : "Unclaimed");
    if (kind === "aegis" || kind === "sentinel") {
      add("Shield borders", `${wallsBySource.get(id)?.length ?? 0} linked · ${shieldSourceActive(game, id) ? "Online" : "Offline"}`);
    }
    if (kind === "nexus" || kind === "vanguard") {
      add("Nexus shield", baseShieldActive(game, tile.node.home) ? "Online" : "Offline");
    }
    if (kind === "nexus") add("Flank borders", shieldSourceActive(game, id) ? "Online" : "Offline");
    if (forwardingFrom(game, id)) add("Forward deployment", "Shield offline until the next friendly turn");
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
