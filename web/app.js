import { AUGMENTS } from "./augments.js";
import { createGameAudio } from "./audio.js";
import { sideName, SIDES, tileLabel, tileName, tiles, wallsBySource } from "./board.js";
import { createBoardView, IMPACT_MS } from "./board-view.js";
import { renderHexInspector } from "./hex-inspector.js";
import { renderReview, renderStats, speciesCards } from "./match-views.js";
import { onlineAvailable, savedOnlineSession, sendOnline } from "./online.js";
import { PROXY_SKINS, proxySkin } from "./proxy-skins.js";
import { runTestCommand } from "./terminal.js";
import { territoryMap } from "./territory.js";
import {
  ACTION_COST, advanceClock, allProxies, applyAction, augmentBuyError, augmentEffects, augmentStatus,
  concedeGame, createGame, defensiveTargets, deploymentCost, fabricationError, forwardActions, freeReserve,
  hasAugmentDeposit, hopTargets, nodeOrders, obeliskRange, placementActions, proxyMoves, readyProxy,
  STARTING_PROXIES, TURN_SECONDS, VOID_TV_CAP,
} from "./rules.js";

const get = (id) => document.getElementById(id);
const hide = (id, hidden) => { get(id).hidden = hidden; };
const text = (id, value) => { get(id).textContent = value; };
const button = (id, disabled) => { get(id).disabled = disabled; };

let screen = "menu";
let game = null;
let seat = null;
let room = null;
let waiting = null;
let selected = null;
let inspected = null;
let order = "move";
let plan = [];
let clockOffset = 0;
let pending = false;
let pollTimer;
let polling = null;
let deadlinePassed = false;
let connectionLost = false;
const leaveDialog = get("leave-dialog");
const augmentDialog = get("augments-dialog");
const terminalDialog = get("terminal-dialog");
const audio = createGameAudio();
const proxyDesign = get("proxy-design");
const skinKeys = { blue: "nexus-proxy-design", red: "nexus-red-proxy-design" };
const localSkins = Object.fromEntries(SIDES.map((side) => [side, readSkin(skinKeys[side])]));
let onlineSkins = {};
let terminalTurn = null;
let queuedAction = null;
let selectionReady = false;
let finalBoard = false;
let impactTransition = null;

const view = createBoardView(get("board"), get("board-viewport"), choose, previewAction);
const augmentRows = AUGMENTS.map(augmentRow);
const speciesControls = speciesCards(lockSpecies);
const targetOrders = ["deploy", "fire", "forward", "phase-jump"];
const tileOrders = ["occupy", "power-shield", "salvage", "fortify"];
const nodeControls = {
  occupy: "occupy", "forward-deploy": "forward", salvage: "salvage", fortify: "fortify",
  fire: "fire", "phase-jump": "phase-jump", "power-shield": "power-shield",
};
const orderDescriptions = {
  deploy: "Place a reserve Proxy on an empty Cradle hex. It activates next turn.",
  fabricate: "Build one reserve Proxy. Available once every three of your turns with fewer than two active Proxies.",
  forward: "Deploy one reserve Proxy beside this powered Aegis. You can deploy again when you have a legal hex, reserve and TV.",
  salvage: "Recover one reserve Proxy and remove this salvage cache.",
  occupy: "Take control of this generator. Its linked shields go offline until you activate them.",
  "power-shield": "Power this node’s linked shields. They stay active when your Proxy moves away.",
  fire: "Show reachable hexes up to two steps away, then choose an enemy Proxy to fire on.",
  fortify: "Absorb one ranged hit. Armor expires when this Proxy moves or your next turn starts.",
  "phase-jump": "Jump to an empty hex up to three steps away, ignoring shields. Once per turn.",
  "confirm-targets": "Apply the selected targets or route.",
  "cancel-targets": "Discard the current targeting plan.",
  "augments-button": "View, buy, and activate augments. Buying requires an active Proxy on a Deposit you control.",
  "end-turn": "Hand off to your opponent. Unspent TV clears. TV already banked by Capacitor Overload carries over.",
};
const orderControls = new Map(Object.keys(orderDescriptions).map((id) => {
  const control = get(id);
  const wrapper = document.createElement("div");
  wrapper.className = "order-control";
  const help = document.createElement("span");
  help.className = "order-tooltip";
  help.id = `${id}-help`;
  help.setAttribute("role", "tooltip");
  control.before(wrapper);
  wrapper.append(control, help);
  control.setAttribute("aria-describedby", help.id);
  wrapper.addEventListener("click", () => {
    if (control.disabled) wrapper.focus();
  });
  return [id, { control, wrapper, help }];
}));

function renderOrderControl(id, error, description = orderDescriptions[id]) {
  const { control, wrapper, help } = orderControls.get(id);
  control.disabled = !!error;
  help.textContent = error ? `${description} ${error}` : description;
  if (error) {
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", `${control.textContent.trim()}, unavailable`);
    wrapper.setAttribute("aria-describedby", help.id);
  } else {
    wrapper.removeAttribute("tabindex");
    wrapper.removeAttribute("role");
    wrapper.removeAttribute("aria-label");
    wrapper.removeAttribute("aria-describedby");
  }
}

function setOrder(next = "move") {
  order = next;
  plan = [];
}

function targeting() {
  return order === "hop" || order === "defensive";
}

function previewAction(id, action, inRange) {
  if (game?.phase !== "play") return;
  const tile = tiles.get(id);
  const name = {
    move: game.proxies[id] ? "Capture Proxy" : "Move", spawn: "Deploy",
    fire: "Obelisk fire", "hop-target": "Hop landing", "defensive-target": "Defensive Strike target",
    "forward-deploy": "Forward deploy", "phase-jump": "Phase jump",
  }[action?.type];
  const status = name ? `${tileLabel(id)} · ${name} · ${action.cost} TV${action.refund ? " refunded by Ascension" : ""}`
    : inRange ? `${tileLabel(id)} · Within Obelisk range`
      : tile ? `${tileLabel(id)} · ${tileName(tile)}` : playTurnTitle();
  text("board-status", status);
}

function notice(message) {
  for (const id of ["notice", "home-notice", "augment-notice", "species-notice", "review-notice"]) {
    text(id, message);
    hide(id, !message);
  }
}

function usableTurn() {
  return game && game.phase !== "finished" && game.deadline !== null
    && (screen === "local" || (seat === game.activeSide && !pending && !deadlinePassed));
}

function terminalAvailable() {
  return get("enable-terminal").checked && screen === "local" && game?.phase === "play" && game.deadline !== null;
}

function terminalOutput(message, error = false) {
  const output = get("terminal-output");
  const line = document.createElement("p");
  line.textContent = message;
  if (error) line.className = "command-error";
  if (output.childElementCount >= 24) output.firstElementChild.remove();
  output.append(line);
  output.scrollTop = output.scrollHeight;
}

function readSkin(key) {
  try {
    return proxySkin(localStorage.getItem(key));
  } catch {
    return proxySkin();
  }
}

function rememberSkin(side, skin) {
  localSkins[side] = skin;
  try {
    localStorage.setItem(skinKeys[side], skin);
  } catch {
    // Keep the preference in this page when browser storage is unavailable.
  }
}

function renderSkinSetting() {
  const local = screen === "local";
  const online = screen === "online";
  const side = online ? seat : local ? game.activeSide : "blue";
  const localHandoff = local && (game.phase === "species" ? !selectionReady : game.deadline === null);
  text("proxy-design-label", local || online ? `${sideName(side)} Proxy skin` : "Default Proxy skin");
  text("proxy-design-help", localHandoff ? "Available when you take your turn."
    : local || online ? `Applies to ${sideName(side)}’s Proxies.`
      : "Used for Blue in pass-and-play and for your seat online.");
  proxyDesign.value = proxySkin((online ? onlineSkins : localSkins)[side]);
  proxyDesign.disabled = localHandoff || screen === "waiting" || (online && pending);
}

function hopLandings(path) {
  return hopTargets(game, selected, path).map((to) => ({ to, type: "hop-target", cost: ACTION_COST.move }));
}

function legalCommands() {
  const orders = nodeOrders(game, selected);
  if (!usableTurn()) return { targets: [], orders };
  if (game.phase === "setup" || order === "deploy") {
    return { targets: placementActions(game), orders };
  }
  if (order === "hop") return { targets: hopLandings(plan), orders };
  if (order === "defensive") {
    const targets = defensiveTargets(game, game.activeSide).map((to) => ({ to, type: "defensive-target", cost: 0 }));
    return { targets, orders };
  }
  const targets = order === "move" ? [...proxyMoves(game, selected), ...hopLandings()]
    : orders.find(({ type }) => nodeControls[type] === order)?.actions ?? [];
  return { targets, orders };
}

function showImpactBeforeTransition(next, previousRevision, previousTurn) {
  const transition = next.phase === "finished" || (next.passAndPlay && next.turn !== previousTurn);
  if (!transition || previousRevision === undefined || get("battle").hidden
      || matchMedia("(prefers-reduced-motion: reduce)").matches
      || !next.impacts?.some(({ revision }) => revision > previousRevision)) return;
  clearTimeout(impactTransition);
  impactTransition = setTimeout(() => {
    impactTransition = null;
    render();
  }, IMPACT_MS + 35);
}

function receiveGame(next) {
  showImpactBeforeTransition(next, game?.revision, game?.turn);
  const newTurn = !game || next.turn !== game.turn || next.phase !== game.phase;
  if (newTurn) {
    selected = null;
    setOrder();
    deadlinePassed = false;
  }
  game = next;
  if (newTurn && (screen === "local" || game.turn === 1 || game.activeSide === seat)) {
    view.focusSide(screen === "online" ? seat : game.activeSide);
  }
}

function focusBoard() {
  get("board").focus({ preventScroll: true });
  if (matchMedia("(max-width: 720px)").matches) {
    get("board-heading").scrollIntoView({ block: "nearest" });
  }
}

function lockSpecies(species) {
  if (game?.phase !== "species" || pending) return;
  const action = { type: "choose-species", species };
  notice("");
  if (screen === "online") {
    void command("action", { room, revision: game.revision, action });
  } else if (selectionReady) {
    const error = applyAction(game, game.activeSide, action);
    if (error) {
      audio.play("error");
      notice(error);
      return;
    }
    selectionReady = false;
    if (game.phase === "setup") view.focusSide("blue");
    render();
    if (game.phase === "species") get("start-selection").focus();
  }
}

function renderSpecies() {
  const local = screen === "local";
  const side = local ? game.activeSide : seat;
  const locked = !local && game.speciesReady?.[side];
  const showCards = local ? selectionReady : !locked;
  text("species-heading", locked ? "Choice locked" : showCards ? "Choose your species" : `Pass to ${sideName(side)}`);
  text("species-message", locked ? "Waiting for the other player. Setup starts after both choices are locked."
    : showCards ? `${sideName(side)} · Species are revealed in the match review.`
      : "Continue when only you can see the screen.");
  hide("start-selection", !local || showCards);
  hide("species-options", !showCards);
  for (const control of speciesControls) control.disabled = pending || locked;
}

function choose(id) {
  if (!tiles.has(id)) return;
  if (!game) {
    text("board-status", `${tileLabel(id)} · ${tileName(tiles.get(id))}`);
    return;
  }
  inspected = id;
  if (!usableTurn()) {
    audio.play("select");
    render();
    return;
  }
  const action = legalCommands().targets.find(({ to }) => to === id);
  if (targeting()) {
    audio.play("select");
    if (order === "hop") {
      if (id === plan.at(-1)) {
        plan.pop();
        if (!plan.length) setOrder();
      } else if (action) plan.push(id);
    } else if (plan.includes(id)) {
      plan = plan.filter((target) => target !== id);
    } else if (action && plan.length < 3) {
      plan.push(id);
    }
    render();
    return;
  }
  if (action?.type === "hop-target") {
    audio.play("select");
    setOrder("hop");
    plan.push(id);
    render();
    return;
  }
  if (action) {
    sendAction(action);
    return;
  }
  audio.play("select");
  if (game.phase === "play" && !(order === "fire" && game.proxies[id]?.side !== game.activeSide)) {
    selected = id === selected ? null : id;
    setOrder();
  }
  render();
}

function afterAction(action) {
  const side = game.activeSide;
  const landing = action.type === "hop" ? action.path.at(-1) : action.to;
  if (landing !== undefined) inspected = landing;
  if (action.type === "forward-deploy") {
    selected = action.from;
    setOrder(forwardActions(game, selected).length ? "forward" : "move");
    return;
  }
  if (landing !== undefined && game.proxies[landing]?.side === side) selected = landing;
  else if (action.from !== undefined && game.proxies[action.from]?.side === side) selected = action.from;
  if (action.type === "spawn" && placementActions(game).length) {
    selected = null;
    setOrder("deploy");
  } else {
    setOrder();
  }
}

function sendAction(action) {
  if (screen === "online" && !usableTurn()) return;
  // Players submit an intent. The shared engine computes the price and effect.
  const { type, from, to, augment, path, targets } = action;
  const intent = { type, from, to, augment, path, targets };
  notice("");
  if (screen === "online") {
    queuedAction = intent;
    void command("action", { room, revision: game.revision, action: intent });
  } else {
    const previousTurn = game.turn;
    const previousRevision = game.revision;
    const error = applyAction(game, game.activeSide, intent);
    showImpactBeforeTransition(game, previousRevision, previousTurn);
    if (game.turn !== previousTurn) {
      selected = null;
      setOrder();
      view.focusSide(game.activeSide);
    } else if (!error && game.phase === "play") {
      afterAction(intent);
    }
    if (error) {
      audio.play("error");
      notice(error);
    }
    render();
  }
}

function renderClock() {
  if (!game) return;
  const now = Date.now() + (screen === "online" ? clockOffset : 0);
  const remaining = game.deadline === null ? 0 : Math.max(0, game.deadline - now);
  const seconds = Math.ceil(remaining / 1000);
  const clock = game.deadline === null ? "–:––" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  text("timer", clock);
  if (augmentDialog.open) text("augment-timer", clock);
  if (terminalDialog.open) text("terminal-timer", clock);
  const listening = screen === "local" || seat === game.activeSide;
  audio.countdown(game.turn, listening ? game.deadline : null, seconds);
  const timer = get("timer");
  timer.classList.toggle("urgent", game.deadline !== null && seconds <= 10);
  get("timer-bar").style.transform = `scaleX(${Math.min(1, remaining / (TURN_SECONDS * 1000))})`;
}

function ordersDescription(hasHopLanding) {
  if (game.phase === "finished") return "Match complete.";
  if (game.deadline === null) return "Pass the device to the next player.";
  if (screen === "online" && seat !== game.activeSide) return "Waiting for your opponent.";
  if (game.phase === "setup") {
    const remaining = STARTING_PROXIES - game.players[game.activeSide].placed;
    return `Place ${remaining} ${remaining === 1 ? "Proxy" : "Proxies"} on highlighted Cradle hexes.`;
  }
  if (order === "deploy") return "Choose a highlighted Cradle hex.";
  if (order === "fire") return "Outlined hexes show range. Choose a highlighted enemy Proxy to fire.";
  if (order === "forward") return "Choose a highlighted hex beside the Aegis.";
  if (order === "phase-jump") return "Choose an open landing hex.";
  if (order === "defensive") return `${plan.length} of 3 targets selected. Choose enemy Proxies in your territory.`;
  if (order === "hop") return "Choose another landing or confirm. The hop captures any enemies you jump over. Select the last landing to undo it.";
  if (game.players[game.activeSide].tv === 0) return "You have 0 TV. Choose an available free order or end your turn.";
  if (selected !== null && game.proxies[selected]?.side === game.activeSide) {
    if (hasHopLanding) return "Choose a Move destination or a highlighted Hop landing. Hopping over an enemy captures it.";
    return readyProxy(game, selected) ? "Choose a highlighted hex to move. Moving onto an enemy Proxy captures it."
      : "This Proxy can act starting on your next turn.";
  }
  return "Select a Proxy to see its moves, or choose a hex to inspect it.";
}

function augmentRow(augment) {
  const row = document.createElement("li");
  const icon = document.createElement("canvas");
  icon.className = "augment-icon";
  icon.width = icon.height = 52;
  icon.setAttribute("aria-hidden", "true");
  const drawing = icon.getContext("2d");
  drawing.scale(2, 2);
  drawing.strokeStyle = "#f1d18c";
  drawing.lineWidth = 1.6;
  drawing.lineCap = drawing.lineJoin = "round";
  drawing.stroke(new Path2D(augment.iconPath));
  const name = document.createElement("h3");
  const description = document.createElement("p");
  const details = document.createElement("div");
  const control = document.createElement("button");
  name.textContent = augment.name;
  description.textContent = augment.description;
  details.append(name, description);
  control.type = "button";
  control.addEventListener("click", () => chooseAugment(augment.id));
  row.append(icon, details, control);
  get("augment-list").append(row);
  return { augment, row, control };
}

function chooseAugment(id) {
  if (!usableTurn() || game.phase !== "play") return;
  const status = augmentStatus(game, game.activeSide, id);
  if (status === "available") {
    sendAction({ type: "buy-augment", augment: id });
  } else if (status === "ready") {
    augmentDialog.close();
    if (id === "defensive") {
      selected = null;
      setOrder(id);
      render();
      get("board").focus({ preventScroll: true });
    } else {
      sendAction({ type: "use-augment", augment: id });
    }
  }
}

function renderAugments() {
  const side = screen === "online" ? seat : game.activeSide;
  const acting = usableTurn() && game.phase === "play";
  const deposit = hasAugmentDeposit(game, side);
  const player = game.players[side];
  let ready = 0;
  for (const { augment, row, control } of augmentRows) {
    const { id, price } = augment;
    const state = augmentStatus(game, side, id);
    row.dataset.state = state;
    if (state === "ready") ready += 1;
    const buyError = state === "available" && augmentBuyError(game, side, id, deposit);
    const canUse = state === "ready" && (id !== "defensive" || defensiveTargets(game, side).length > 0);
    control.disabled = !acting || !(canUse || (state === "available" && !buyError));
    control.textContent = {
      available: id === "void" ? "Invoke · 0 TV" : `${id === "overload" ? "Bank TV" : "Buy"} · ${price} TV`,
      ready: id === "defensive" ? "Choose targets" : "Activate",
      used: "Spent", active: "Active", locked: "Locked",
    }[state];
    control.title = buyError || "";
    control.setAttribute("aria-label", `${augment.name}, ${control.textContent}`);
  }
  text("augment-count", ready ? `${ready} ready` : "");
  const status = player.augments?.void ? `The Call of Void is active. Deployments cost 0 TV. Your recharge cap is ${VOID_TV_CAP} TV.`
    : deposit ? "Deposit staffed. Each augment can be bought once in this match."
      : "Staff a claimed Deposit with an active Proxy to buy augments.";
  text("augment-status", `${sideName(side)} · ${player.tv} TV. ${status}`);
}

function playTurnTitle() {
  return `Turn ${game.round} · ${sideName(game.activeSide)} to act`;
}

function renderMatch() {
  const active = sideName(game.activeSide);
  const setup = game.phase === "setup";
  const finished = game.phase === "finished";
  const handoff = screen === "local" && game.deadline === null && !finished;
  const turnTitle = finished ? "Match complete" : setup ? `${active} setup` : playTurnTitle();
  const revealHandoff = handoff && impactTransition === null;
  const newlyVisibleHandoff = revealHandoff && get("handoff").hidden;

  text("board-status", turnTitle);
  text("turn-heading", turnTitle);
  get("turn-panel").dataset.side = finished ? game.winner : game.activeSide;
  text("seat-label", screen === "local" ? "Pass and play" : `You are ${sideName(seat)}`);
  hide("handoff", !revealHandoff);
  get("board").inert = handoff;
  if ((handoff || finished) && augmentDialog.open) augmentDialog.close();
  if (handoff) {
    text("handoff-title", setup ? `${active} setup` : `${active}’s turn`);
    text("handoff-message", `Pass the device to ${active}. The timer starts when they’re ready.`);
    text("start-turn", setup ? "Start setup" : "Start turn");
  }
  if (newlyVisibleHandoff) get("start-turn").focus();

  const field = allProxies(game);
  for (const side of SIDES) {
    const player = game.players[side];
    const deployed = field.filter((proxy) => proxy.side === side).length;
    get(`${side}-team`).classList.toggle("active", !finished && game.activeSide === side);
    text(`${side}-energy`, `${player.tv} TV`);
    const free = freeReserve(game, side);
    text(`${side}-reserve`, player.reserve + free);
    text(`${side}-proxies`, `${deployed} fielded`);
    const effects = augmentEffects(game, side);
    text(`${side}-effects`, effects.join(" · "));
    hide(`${side}-effects`, !effects.length);
  }

  const canOrder = usableTurn() && !setup;
  const showOrders = !setup && !finished && !handoff && (screen === "local" || game.activeSide === seat);
  const { targets, orders } = legalCommands();
  const hasHopLanding = targets.some(({ type }) => type === "hop-target");
  text("orders-description", ordersDescription(hasHopLanding));
  const turnError = canOrder ? null : "Available on your play turn.";
  const orderError = turnError ?? (targeting() ? "Confirm or cancel the current plan first." : null);
  const nodeType = tiles.get(selected)?.node?.type;
  const deposit = nodeType === "deposit";
  text("occupy-label", deposit ? "Occupy" : "Capture");
  for (const [type, id] of Object.entries(nodeControls)) {
    const command = orders.find((order) => order.type === type);
    hide(id, !showOrders || !command);
    if (!command || !showOrders) continue;
    text(`${id}-cost`, `${command.cost} TV`);
    let description;
    if (type === "occupy" && deposit) description = "Claim this Deposit and gain a reserve Proxy. Staff it at the start of your next turn to secure the claim.";
    if (type === "power-shield" && nodeType === "vanguard") {
      description = "Arm the Nexus shield. It needs an active Proxy here and an online home Aegis or Obelisk.";
    }
    renderOrderControl(id, orderError ?? command.error, description);
  }
  const showRange = showOrders && order === "fire";
  const firingRange = showRange ? obeliskRange(game, selected).map(({ to }) => to) : [];
  hide("range-key", !showRange);
  hide("hop-key", !hasHopLanding);
  hide("linked-shield-key", !wallsBySource.has(inspected) && tiles.get(inspected)?.node?.type !== "nexus");
  hide("reinforcements", !showOrders);
  text("deploy-cost", `${deploymentCost(game, game.activeSide)} TV`);
  renderOrderControl("deploy", orderError ?? (placementActions(game).length ? null : "Requires a reserve Proxy, enough TV, and an empty Cradle hex."));
  renderOrderControl("fabricate", orderError ?? fabricationError(game, game.activeSide));
  hide("turn-actions", setup || finished || handoff);
  hide("target-actions", !targeting());
  text("confirm-targets", order === "hop" ? `Confirm hop · ${ACTION_COST.move} TV` : "Use Defensive Strike");
  renderOrderControl("confirm-targets", turnError ?? (plan.length ? null : "Choose a target or landing hex first."),
    order === "hop" ? "Commit the route and capture enemies you jump over." : "Strike each selected enemy Proxy in your territory.");
  renderOrderControl("cancel-targets", null);
  renderOrderControl("augments-button", null);
  renderOrderControl("end-turn", turnError);
  for (const id of targetOrders) {
    get(id).setAttribute("aria-pressed", order === id);
  }
  get("activity").replaceChildren(...game.events.slice(-8).reverse().map((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
  renderAugments();
  const regions = territoryMap(game);
  renderHexInspector(get("hex-inspector"), game, inspected, regions.get(inspected));
  if (get("live-stats").open) renderStats(get("live-stats-table"), game);
  view.render(game, { selected, inspect: inspected, actions: targets,
    planned: plan, mode: order, firingRange, regions, playerSkins: screen === "online" ? onlineSkins : localSkins });
  renderClock();
}

function render() {
  document.body.dataset.screen = screen;
  audio.sync(game, seat);
  renderSkinSetting();
  const canOpenTerminal = terminalAvailable();
  hide("terminal-button", !canOpenTerminal);
  if (terminalDialog.open && (!canOpenTerminal || terminalTurn?.number !== game.turn)) terminalDialog.close();
  const picking = game?.phase === "species";
  const finished = game?.phase === "finished";
  const reviewing = finished && !finalBoard && impactTransition === null;
  const reviewOpened = reviewing && get("review").hidden;
  hide("home", !!game);
  hide("species", !picking);
  hide("review", !reviewing);
  hide("battle", !game || picking || reviewing);
  hide("review-button", !finished || reviewing || impactTransition !== null);
  hide("play-panel", screen !== "menu");
  hide("waiting-panel", screen !== "waiting");
  hide("match-panel", !game);
  hide("menu-button", !game || game.phase === "finished");
  hide("online-unavailable", onlineAvailable);
  button("play-local", pending);
  button("find-match", !onlineAvailable || pending);
  button("create-room", !onlineAvailable || pending);
  get("join-room").querySelector("button").disabled = !onlineAvailable || pending;
  hide("friend-controls", !onlineAvailable);
  button("cancel-search", pending);

  if (picking) {
    renderSpecies();
  } else if (reviewing) {
    if (augmentDialog.open) augmentDialog.close();
    renderReview(game);
    button("result-menu", pending);
    if (reviewOpened) get("result-title").focus({ preventScroll: true });
  } else if (game) {
    renderMatch();
  } else {
    get("board").inert = false;
    hide("handoff", true);
    text("board-status", "Capture the opposing Nexus");
    view.render(null);
  }
  if (screen === "waiting") {
    const invite = waiting.kind === "invite";
    text("waiting-title", invite ? "Room ready" : "Finding an opponent");
    text("waiting-description", invite ? "Share this code with the other player." : "Waiting for another player to join.");
    hide("invite-code-panel", !invite);
    text("invite-code", waiting.code ?? "");
  }
}

function showMenu() {
  screen = "menu";
  game = null;
  room = null;
  waiting = null;
  seat = null;
  selectionReady = false;
  finalBoard = false;
  selected = null;
  inspected = null;
  clearTimeout(impactTransition);
  impactTransition = null;
  queuedAction = null;
  setOrder();
  if (augmentDialog.open) augmentDialog.close();
  deadlinePassed = false;
  connectionLost = false;
  notice("");
  render();
}

function acceptReply(reply, op) {
  if (reply.status === "match") {
    const newMatch = room !== reply.room;
    screen = "online";
    seat = reply.side;
    room = reply.room;
    if (newMatch) {
      game = null;
      audio.sync(null);
      audio.play("start");
      finalBoard = false;
      inspected = null;
    }
    const previousTurn = game?.turn;
    if (reply.game) receiveGame(reply.game);
    if (op === "action") {
      if (!reply.error && queuedAction && game.phase === "play" && game.turn === previousTurn
          && seat === game.activeSide) afterAction(queuedAction);
      queuedAction = null;
    }
  } else if (reply.status === "waiting") {
    if (screen !== "waiting") audio.play("search");
    screen = "waiting";
    waiting = reply;
  } else {
    const expired = (screen === "online" || screen === "waiting") && op === "poll";
    showMenu();
    if (expired) notice("The online session expired.");
  }
  if (reply.error) {
    audio.play("error");
    notice(reply.error);
  }
  else if (reply.status !== "idle") notice("");
  render();
}

async function exchange(op, fields) {
  const start = Date.now();
  try {
    const reply = await sendOnline(op, fields);
    clockOffset = reply.serverTime - (start + Date.now()) / 2;
    if (connectionLost) notice("");
    connectionLost = false;
    let skinsChanged = false;
    if (reply.status === "match") {
      const nextSkins = Object.fromEntries(SIDES.map((side) => [side, proxySkin(reply.proxySkins?.[side])]));
      skinsChanged = SIDES.some((side) => nextSkins[side] !== onlineSkins[side]);
      onlineSkins = nextSkins;
    }
    if (op === "poll" && screen === "online" && reply.room === room && !reply.game && !reply.error && !skinsChanged) {
      renderClock();
      return;
    }
    acceptReply(reply, op);
  } catch (error) {
    queuedAction = null;
    if (!connectionLost) audio.play("error");
    connectionLost = true;
    notice(error.message);
  }
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (pending || !["online", "waiting"].includes(screen) || game?.phase === "finished") return;
  pollTimer = setTimeout(async () => {
    polling = exchange("poll", { room, revision: game?.revision });
    await polling;
    polling = null;
    schedulePoll();
  }, screen === "waiting" ? 1100 : 750);
}

async function command(op, fields) {
  if (pending || !onlineAvailable) return;
  pending = true;
  clearTimeout(pollTimer);
  render();
  await polling;
  await exchange(op, fields);
  pending = false;
  render();
  schedulePoll();
}

get("play-local").addEventListener("click", () => {
  audio.play("start");
  screen = "local";
  selected = null;
  setOrder();
  notice("");
  selectionReady = false;
  receiveGame(createGame({ passAndPlay: true }));
  render();
  get("start-selection").focus();
});
get("find-match").addEventListener("click", () => { void command("find", { skin: localSkins.blue }); });
get("create-room").addEventListener("click", () => { void command("create", { skin: localSkins.blue }); });
get("join-room").addEventListener("submit", (event) => {
  event.preventDefault();
  void command("join", { code: get("room-input").value, skin: localSkins.blue });
});
get("copy-code").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(waiting.code);
    notice("Room code copied.");
  } catch {
    notice(`Room code is ${waiting.code}.`);
  }
});
get("cancel-search").addEventListener("click", () => { void command("cancel"); });

get("start-selection").addEventListener("click", () => {
  selectionReady = true;
  render();
  speciesControls[0].focus();
});
get("start-turn").addEventListener("click", () => {
  sendAction({ type: "ready" });
  focusBoard();
});
for (const id of targetOrders) {
  get(id).addEventListener("click", () => {
    setOrder(order === id ? "move" : id);
    if (order === "deploy") selected = null;
    render();
    if (order !== "move") focusBoard();
  });
}
for (const type of tileOrders) {
  get(type).addEventListener("click", () => {
    const action = legalCommands().orders.find((candidate) => candidate.type === type)?.actions[0];
    if (action) sendAction(action);
  });
}
get("live-stats").addEventListener("toggle", () => {
  if (game && get("live-stats").open) renderStats(get("live-stats-table"), game);
});
get("fabricate").addEventListener("click", () => { sendAction({ type: "fabricate" }); });
get("augments-button").addEventListener("click", () => {
  augmentDialog.showModal();
  renderClock();
});
get("confirm-targets").addEventListener("click", () => {
  if (order === "hop") sendAction({ type: "hop", augment: "hop", from: selected, path: [...plan] });
  if (order === "defensive") sendAction({ type: "defensive-strike", augment: "defensive", targets: [...plan] });
});
get("cancel-targets").addEventListener("click", () => {
  setOrder();
  render();
});
get("end-turn").addEventListener("click", () => { sendAction({ type: "end" }); });
get("menu-button").addEventListener("click", () => {
  text("leave-description", `${sideName(screen === "online" ? seat : game.activeSide)} will concede and both species will be revealed.`);
  leaveDialog.returnValue = "";
  leaveDialog.showModal();
});
leaveDialog.addEventListener("close", () => {
  if (leaveDialog.returnValue !== "leave") return;
  if (screen === "online") {
    void command("concede", { room });
  } else {
    concedeGame(game, game.activeSide);
    render();
  }
});
get("result-menu").addEventListener("click", () => {
  if (screen === "online") void command("leave");
  else showMenu();
});
get("result-board").addEventListener("click", () => {
  finalBoard = true;
  render();
  focusBoard();
});
get("review-button").addEventListener("click", () => {
  finalBoard = false;
  render();
});
get("battle").addEventListener("keydown", (event) => {
  if (event.key === "Escape" && (order !== "move" || selected !== null)) {
    selected = null;
    setOrder();
    render();
  }
});
get("rules-button").addEventListener("click", () => get("rules-dialog").showModal());
get("settings-button").addEventListener("click", () => get("settings-dialog").showModal());
proxyDesign.addEventListener("change", () => {
  const skin = proxyDesign.value;
  if (proxyDesign.disabled || !PROXY_SKINS.has(skin)) return;
  rememberSkin(screen === "local" ? game.activeSide : "blue", skin);
  if (screen === "online") void command("skin", { room, skin });
  else render();
});
get("enable-terminal").addEventListener("change", render);
get("terminal-button").addEventListener("click", () => {
  if (!terminalAvailable()) return;
  terminalTurn = { number: game.turn, side: game.activeSide };
  text("terminal-side", `${sideName(terminalTurn.side)} · Local match`);
  get("terminal-output").replaceChildren();
  terminalOutput("Type help to list commands.");
  get("terminal-input").value = "";
  terminalDialog.showModal();
  renderClock();
});
get("terminal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!terminalDialog.open || !terminalAvailable() || terminalTurn?.number !== game.turn) return;
  const input = get("terminal-input");
  const { error, message } = runTestCommand(game, terminalTurn.side, input.value);
  terminalOutput(`> ${input.value}`);
  terminalOutput(error ?? message, !!error);
  audio.play(error ? "error" : "select");
  input.value = "";
  input.focus();
  render();
});

for (const channel of ["effects", "music"]) {
  const slider = get(`${channel}-volume`);
  slider.value = audio.volumes[channel];
  text(`${channel}-level`, `${slider.value}%`);
  slider.addEventListener("input", () => {
    audio.setVolume(channel, Number(slider.value));
    text(`${channel}-level`, `${slider.value}%`);
  });
}
document.addEventListener("click", (event) => {
  if (event.isTrusted) audio.unlock();
  if (event.target instanceof Element && event.target.closest("button, summary")) audio.play("ui");
}, true);
document.addEventListener("keydown", (event) => {
  if (event.isTrusted && !event.repeat) audio.unlock();
}, true);

get("zoom-out").addEventListener("click", () => view.zoomBy(-.35));
get("zoom-fit").addEventListener("click", () => view.fit());
get("zoom-in").addEventListener("click", () => view.zoomBy(.35));

setInterval(() => {
  if (!game || game.deadline === null) return;
  const expired = Date.now() + clockOffset >= game.deadline;
  if (screen === "local" && advanceClock(game)) {
    selected = null;
    setOrder();
    view.focusSide(game.activeSide);
    render();
  } else if (screen === "online" && expired !== deadlinePassed) {
    deadlinePassed = expired;
    render();
  } else {
    renderClock();
  }
}, 150);

render();
if (savedOnlineSession) void command("poll");
