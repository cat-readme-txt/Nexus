import { AUGMENTS } from "./augments.js";
import { sideName, SIDES, tileLabel, tileName, tiles } from "./board.js";
import { createBoardView, IMPACT_MS } from "./board-view.js";
import { renderHexInspector } from "./hex-inspector.js";
import { renderReview, renderStats, speciesCards } from "./match-views.js";
import { onlineAvailable, savedOnlineSession, sendOnline } from "./online.js";
import {
  ACTION_COST, advanceClock, allProxies, applyAction, augmentBuyError, augmentEffects, augmentStatus,
  canFireFrom, concedeGame, createGame, defensiveTargets, deploymentCost, fabricationError,
  forwardActions, freeReserve, hasAugmentDeposit, hopTargets,
  obeliskRange, placementActions, proxyActions, readyProxy, STARTING_PROXIES, TURN_SECONDS,
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
let queuedAction = null;
let selectionReady = false;
let finalBoard = false;
let impactTransition = null;

const view = createBoardView(get("board"), get("board-viewport"), choose, previewAction);
const augmentRows = AUGMENTS.map(augmentRow);
const speciesControls = speciesCards(lockSpecies);

function setOrder(next = "move") {
  order = next;
  plan = [];
}

function targeting() {
  return order === "hop" || order === "defensive";
}

function previewAction(id, action, inRange) {
  if (!game || game.phase !== "play" || !usableTurn()) return;
  const name = {
    move: game.proxies[id] ? "Move into occupied hex" : "Move", "ascension-strike": "Ascension strike", spawn: "Deploy",
    fire: "Obelisk fire", "hop-target": "Hop landing", "defensive-target": "Defensive Strike target",
    "forward-deploy": "Forward deploy", "phase-jump": "Phase jump",
  }[action?.type];
  const status = name ? `${tileLabel(id)} · ${name} · ${action.cost} TV`
    : inRange ? `${tileLabel(id)} · Within Obelisk range` : `Round ${game.round} · ${sideName(game.activeSide)} turn`;
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

function legalCommands() {
  if (!usableTurn()) return { targets: [], options: [], forward: [] };
  if (game.engagement) return { targets: [], options: proxyActions(game, game.engagement.to), forward: [] };
  if (game.phase === "setup" || order === "deploy") {
    return { targets: placementActions(game), options: [], forward: [] };
  }
  if (targeting()) {
    const ids = order === "hop" ? hopTargets(game, selected, plan) : defensiveTargets(game, game.activeSide);
    const type = order === "hop" ? "hop-target" : "defensive-target";
    return { targets: ids.map((to) => ({ to, type, cost: order === "hop" ? 1 : 0 })), options: [], forward: [] };
  }
  const options = proxyActions(game, selected);
  const forward = forwardActions(game, selected);
  const targets = order === "forward" ? forward
    : options.filter(({ type }) => type === order);
  return { targets, options, forward };
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
  if (game.engagement && inspected === null) inspected = game.engagement.to;
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
  if (!usableTurn() || game.engagement) {
    render();
    return;
  }
  const action = legalCommands().targets.find(({ to }) => to === id);
  if (targeting()) {
    if (order === "hop") {
      if (id === plan.at(-1)) plan.pop();
      else if (action) plan.push(id);
      else if (!plan.length && game.proxies[id]?.side === game.activeSide && readyProxy(game, id)) selected = id;
    } else if (plan.includes(id)) {
      plan = plan.filter((target) => target !== id);
    } else if (action && plan.length < 3) {
      plan.push(id);
    }
    render();
    return;
  }
  if (action) {
    sendAction(action);
    return;
  }
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
  if (game.engagement) selected = game.engagement.to;
  else if (landing !== undefined && game.proxies[landing]?.side === side) selected = landing;
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
    if (error) notice(error);
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
  const timer = get("timer");
  timer.classList.toggle("urgent", game.deadline !== null && seconds <= 10);
  get("timer-bar").style.transform = `scaleX(${Math.min(1, remaining / (TURN_SECONDS * 1000))})`;
}

function ordersDescription() {
  if (game.phase === "finished") return "Match complete.";
  if (game.deadline === null) return "Pass the device to the next player.";
  if (screen === "online" && seat !== game.activeSide) return "Waiting for your opponent.";
  if (game.phase === "setup") {
    const remaining = STARTING_PROXIES - game.players[game.activeSide].placed;
    return `Place ${remaining} ${remaining === 1 ? "Proxy" : "Proxies"} on highlighted Cradle hexes.`;
  }
  if (order === "deploy") return "Choose a highlighted Cradle hex.";
  if (game.engagement) return `Both Proxies share ${tileLabel(game.engagement.to)}. Choose Strike or Withdraw.`;
  if (order === "fire") return "Outlined hexes show range. Choose a highlighted enemy Proxy to fire.";
  if (order === "ascension-strike") return "Choose an enemy Proxy in teleport range.";
  if (order === "forward") return "Choose a highlighted hex beside the Aegis.";
  if (order === "phase-jump") return "Choose an open landing hex.";
  if (order === "defensive") return `${plan.length} of 3 targets selected. Choose enemy Proxies in your territory.`;
  if (order === "hop") {
    if (plan.length) return "Choose another landing or confirm the hop. Select the last landing to undo it.";
    if (hopTargets(game, selected, []).length) return "Choose a highlighted hex to jump over the adjacent Proxy.";
    return "Select an active Proxy with a valid jump.";
  }
  if (selected !== null && game.proxies[selected]?.side === game.activeSide) {
    return readyProxy(game, selected) ? "Choose a highlighted hex to move or select an order below."
      : "This Proxy can act starting on your next turn.";
  }
  return "Select a Proxy to see its moves, or choose a hex to inspect it.";
}

function augmentRow(augment) {
  const row = document.createElement("li");
  const name = document.createElement("h3");
  const description = document.createElement("p");
  const details = document.createElement("div");
  const control = document.createElement("button");
  name.textContent = augment.name;
  description.textContent = augment.description;
  details.append(name, description);
  control.type = "button";
  control.addEventListener("click", () => chooseAugment(augment.id));
  row.append(details, control);
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
    if (id === "hop" || id === "defensive") {
      if (id === "defensive") selected = null;
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
    const canUse = state === "ready" && (id !== "hop" || player.tv > 0)
      && (id !== "defensive" || defensiveTargets(game, side).length > 0);
    control.disabled = !acting || !(canUse || (state === "available" && !buyError));
    control.textContent = {
      available: id === "void" ? "Invoke · 0 TV" : `Buy · ${price} TV`,
      ready: id === "hop" ? "Plan hop" : id === "defensive" ? "Choose targets" : "Activate",
      used: "Spent", active: "Active", locked: "Locked",
    }[state];
    control.title = buyError || "";
    control.setAttribute("aria-label", `${augment.name}, ${control.textContent}`);
  }
  text("augment-count", ready ? `${ready} ready` : "");
  const status = player.augments?.void ? "The Call of Void is active. Your capacitor is capped at 20 TV."
    : deposit ? "Deposit staffed. Each augment can be bought once in this match."
      : "Staff a claimed Deposit with an active Proxy to buy augments.";
  text("augment-status", `${sideName(side)} · ${player.tv} TV. ${status}`);
}

function renderMatch() {
  const active = sideName(game.activeSide);
  const setup = game.phase === "setup";
  const finished = game.phase === "finished";
  const handoff = screen === "local" && game.deadline === null && !finished;
  const turnTitle = finished ? "Match complete" : setup ? `${active} setup` : `${active} turn`;
  const revealHandoff = handoff && impactTransition === null;
  const newlyVisibleHandoff = revealHandoff && get("handoff").hidden;

  text("board-status", setup || finished ? turnTitle : `Round ${game.round} · ${turnTitle}`);
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
    text(`${side}-proxies`, `${deployed} fielded · ${player.reserve + free} reserve${free ? ` (${free} free)` : ""}`);
    const effects = augmentEffects(game, side);
    text(`${side}-effects`, effects.join(" · "));
    hide(`${side}-effects`, !effects.length);
  }

  const canOrder = usableTurn() && !setup;
  const showOrders = !setup && !finished && !handoff && (screen === "local" || game.activeSide === seat);
  const { targets, options, forward } = legalCommands();
  text("orders-description", ordersDescription());
  const available = (type) => options.find((action) => action.type === type);
  const fireAvailable = showOrders && canFireFrom(game, selected);
  const firingRange = fireAvailable && order === "fire" ? obeliskRange(game, selected).map(({ to }) => to) : [];
  for (const type of ["occupy", "salvage", "fortify", "phase-jump", "strike", "withdraw", "ascension-strike"]) {
    hide(type, !available(type));
  }
  hide("fire", !fireAvailable);
  button("fire", !canOrder || game.players[game.activeSide].tv < ACTION_COST.fire);
  hide("range-key", !fireAvailable || order !== "fire");
  text("strike-cost", available("strike") ? `${available("strike").cost} TV` : "");
  text("ascension-strike-cost", available("ascension-strike") ? `${available("ascension-strike").cost} TV` : "");
  hide("forward", !forward.length);
  text("occupy-cost", available("occupy") ? `${available("occupy").cost} TV` : "");
  text("forward-cost", forward.length ? `${forward[0].cost} TV` : "");
  hide("reinforcements", !showOrders || !!game.engagement);
  const deployments = canOrder && !targeting() ? placementActions(game) : [];
  button("deploy", deployments.length === 0);
  text("deploy-cost", `${deploymentCost(game, game.activeSide)} TV`);
  const blockedFabrication = canOrder && !targeting() ? fabricationError(game, game.activeSide) : null;
  button("fabricate", !canOrder || targeting() || !!blockedFabrication);
  text("fabrication-hint", blockedFabrication ?? "");
  hide("fabrication-hint", !blockedFabrication);
  hide("turn-actions", setup || finished || handoff);
  button("augments-button", !!game.engagement);
  hide("target-actions", !targeting());
  text("confirm-targets", order === "hop" ? "Confirm hop · 1 TV" : `Strike ${plan.length || "targets"}`);
  button("confirm-targets", !canOrder || plan.length === 0);
  button("end-turn", !canOrder);
  for (const id of ["deploy", "fire", "forward", "phase-jump", "ascension-strike"]) {
    get(id).setAttribute("aria-pressed", order === id);
  }
  get("activity").replaceChildren(...game.events.slice(-8).reverse().map((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
  renderAugments();
  renderHexInspector(get("hex-inspector"), game, inspected);
  if (get("live-stats").open) renderStats(get("live-stats-table"), game);
  view.render(game, { selected: game.engagement?.to ?? selected, inspect: inspected, actions: targets,
    planned: plan, mode: order, firingRange });
  renderClock();
}

function render() {
  document.body.dataset.screen = screen;
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
    screen = "waiting";
    waiting = reply;
  } else {
    const expired = (screen === "online" || screen === "waiting") && op === "poll";
    showMenu();
    if (expired) notice("The online session expired.");
  }
  if (reply.error) notice(reply.error);
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
    if (op === "poll" && screen === "online" && reply.room === room && !reply.game && !reply.error) {
      renderClock();
      return;
    }
    acceptReply(reply, op);
  } catch (error) {
    queuedAction = null;
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
  screen = "local";
  selected = null;
  setOrder();
  notice("");
  selectionReady = false;
  receiveGame(createGame({ passAndPlay: true }));
  render();
  get("start-selection").focus();
});
get("find-match").addEventListener("click", () => { void command("find"); });
get("create-room").addEventListener("click", () => { void command("create"); });
get("join-room").addEventListener("submit", (event) => {
  event.preventDefault();
  void command("join", { code: get("room-input").value });
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
for (const id of ["deploy", "fire", "forward", "phase-jump", "ascension-strike"]) {
  get(id).addEventListener("click", () => {
    setOrder(order === id ? "move" : id);
    if (order === "deploy") selected = null;
    render();
    if (order !== "move") focusBoard();
  });
}
for (const type of ["occupy", "salvage", "fortify", "strike", "withdraw"]) {
  get(type).addEventListener("click", () => {
    const action = legalCommands().options.find((candidate) => candidate.type === type);
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
