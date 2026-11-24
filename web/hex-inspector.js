import { sideName, tileLabel, tileName, tiles } from "./board.js";
import { forwardingFrom, nodeController, proxiesAt, proxyReady, shieldSourceActive } from "./rules.js";

export const NODE_ICONS = {
  aegis: { file: "./assets/aegis.png", size: 24, mark: "A" },
  deposit: { file: "./assets/deposit.png", size: 22, mark: "D" },
  nexus: { file: "./assets/nexus.png", size: 43, mark: "N" },
  sentinel: { file: "./assets/sentinel.png", size: 43, mark: "S" },
  vanguard: { file: "./assets/vanguard.png", size: 39, mark: "V" },
};

const descriptions = {
  nexus: "Enter the enemy Nexus to win. A powered Vanguard shield protects it.",
  vanguard: "An active friendly Proxy powers the Nexus shield here. The shield falls if the enemy controls all eight home Obelisks.",
  sentinel: "Powers shield borders for its home side. A friendly active Proxy can fire for 1 TV at a reachable enemy within two hexes.",
  aegis: "Powers linked shields for its home side. Claim it on arrival without an occupation fee. A staffed, controlled Aegis can deploy a reserve Proxy to a neighboring hex.",
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
    add("Control", controller ? `${sideName(controller)}${game.claims[id]?.pending ? " · claim pending" : ""}` : "Unclaimed");
    if (kind !== "deposit") add("Shield power", shieldSourceActive(game, id) ? "Online" : "Offline");
    if (forwardingFrom(game, id)) add("Forward deployment", "Shield offline until the next friendly turn");
  }
  const occupants = proxiesAt(game, id);
  if (!occupants.length) add("Proxies", "Empty");
  for (const proxy of occupants) {
    const status = proxyReady(game, proxy) ? "Active" : "Activates on its owner’s next turn";
    add(`${sideName(proxy.side)} Proxy`, proxy.fortified ? `${status} · fortified` : status);
  }
  if (occupants.length > 1) add("Combat", "Contested hex");
  panel.replaceChildren(header, element("p", descriptions[kind]), details);
}
