import { DurableObject } from "cloudflare:workers";
import { createLobby, matchRequest } from "./matchmaking.js";

export class Matchmaker extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.lobby = await ctx.storage.get("lobby") ?? createLobby();
    });
  }

  fetch(request) {
    return matchRequest(request, this.lobby, (lobby) => this.ctx.storage.put("lobby", lobby));
  }
}

export default {
  fetch(request, env) {
    return env.MATCHMAKER.getByName("lobby").fetch(request);
  },
};
