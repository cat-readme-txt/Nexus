export function runTestCommand(game, side, input, now = Date.now()) {
  if (!game?.passAndPlay || game.activeSide !== side || game.phase !== "play"
      || game.deadline === null || now >= game.deadline) {
    return { error: "Run testing commands during your own pass-and-play turn." };
  }
  const [verb, subject, amount, ...extra] = input.trim().toLowerCase().split(/\s+/);
  if (verb === "help" && subject === undefined) {
    return { message: "add TV <amount> increases energy. add reserve <amount> adds undeployed Proxies." };
  }
  const key = subject === "tv" ? "tv" : ["reserve", "proxy", "proxies"].includes(subject) ? "reserve" : null;
  if (verb !== "add" || !key || extra.length) {
    return { error: "Use add TV <amount> or add reserve <amount>." };
  }
  const count = Number(amount);
  const player = game.players[side];
  const total = player[key] + count;
  if (!/^\d+$/.test(amount ?? "") || count < 1 || !Number.isSafeInteger(total)) {
    return { error: "Enter a positive whole number within the supported range." };
  }
  player[key] = total;
  game.revision += 1;
  return { message: key === "tv" ? `Added ${count} TV. You have ${total} TV.`
    : `Added ${count} to reserve. You have ${total} reserve Proxies.` };
}
