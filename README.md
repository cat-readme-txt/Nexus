# Nexus

Nexus is the working title for a two-player hex strategy game adapted from the competition board. Command Proxies, capture nodes, and enter the opposing Nexus to win.

## Background

Humanity depends on AI when it discovers hostile powers beyond Earth. With little intelligence and no agreement on how to respond, the world's governments give their most advanced AI access to their supercomputers. It simulates possible wars, including conflicts between alien powers. Each match is one of those simulations.

## Play locally

With Node.js 22 or newer, run:

```sh
npm run dev
```

Open the address printed in the terminal. **Pass and play** switches players on the same device and waits for the next player before starting their timer. **Find an opponent** pairs two waiting players. **Play with a friend** gives one player a code for the other to enter. To try online play locally, open the same address in a second browser profile or a private window.

Choose a species privately before placing your first three Proxies. In pass-and-play, pass the device between choices. In an online match, the server sends each player their own choice. The match review reveals both species and compares TV, casualties, reinforcements, claims, and ability use. Spend TV on any number of actions until you reach zero, end the turn yourself, or run out of time. TV stands for teravolts. Blue goes first and each active turn lasts up to three minutes, including setup. If setup times out, the game places the remaining starting Proxies in free Cradle hexes. A deployed Proxy can act, power nodes, and generate TV starting on its owner's next turn. Open **How to play** for action costs and node abilities.

### Special hexes

| Hex | What it does |
| --- | --- |
| **Nexus** (crown) | Enter the enemy Nexus to win. A powered Vanguard shield blocks entry. |
| **Vanguard** (sword and shield) | An active friendly Proxy on either Vanguard powers the shield around its Nexus. Enemy Proxies cannot enter a Vanguard hex. The Nexus shield drops if the enemy controls all eight of the defending side's Sentinel Obelisks. |
| **Sentinel Obelisk** (paired triangles) | Powers linked shield borders for its original side while that side controls it. Select **Obelisk fire** with an active Proxy on one of its side's controlled Obelisks to see reachable hexes within two steps. Fire at an enemy in range for 1 TV. Destroying the target normally adds one Proxy to reserve. |
| **Aegis** (gold hexagon) | Powers linked shield borders for its original side while that side controls it. An active Proxy claims it on arrival without paying an occupation fee. A staffed, controlled Aegis also supports forward deployment, which shuts off its shields until your next turn. |
| **Deposit** (gold ring) | Occupying a Deposit grants one reserve Proxy immediately. An active Proxy on a Deposit you control unlocks augment purchases. For the Human Directorate, a staffed, controlled Deposit also triggers its turn-start supply bonus. |
| **Cradle** (green) | Place your starting Proxies and deploy reserves in empty hexes in your own Cradle. Newly placed Proxies activate on your next turn. |
| **Turbulence** (gray) | A Proxy starting here loses access to its Ascension bonuses. Veyari can launch a phase jump from this terrain, and salvage caches can surface here. |
| **Salvage cache** (outlined box on Turbulence) | An active Proxy standing on a cache can spend 2 TV to recover one reserve Proxy. Recovering the cache removes it from the board. |

To claim a Deposit or contested Sentinel Obelisk, stand on it with an active Proxy and spend 3 TV, or 4 TV for Veyari. A claim is secured if a friendly Proxy is on the node at the start of your next turn. You keep the immediate Deposit reward if the claim lapses.

### Reinforcements

- **Fabricate reserve.** Spend 2 TV to add one reserve Proxy if you have fewer than two active Proxies. Use it once every three of your turns.
- **Recover cache.** A salvage cache appears in central Turbulence every third round. Select an active Proxy standing on it to recover one reserve Proxy for 2 TV.
- **Forward deploy.** Select an active Proxy staffing a controlled Aegis and deploy one reserve Proxy to an adjacent legal hex. It costs 1 TV per deployment, once per Aegis per turn. That source's shield is offline through the opponent's turn. Void reserves remain free.

### Species

| Species | Ability | Trade-off |
| --- | --- | --- |
| Human Directorate | A staffed, controlled Deposit provides 3 TV and one reserve Proxy at the start of the turn. | The Strike part of an attack costs 1 TV more. |
| Veyari | Once per turn for 2 TV, phase jump from Turbulence to a free hex up to three steps away, through units and ordinary shields. Vanguard shields still block the path. | Paid occupation costs 4 TV. Phase jumps cannot enter an enemy Nexus or Vanguard. |
| Keth | Once per turn for 2 TV, fortify a Proxy on a controlled Aegis or Obelisk. Armor absorbs one hit and expires on movement or the owner's next turn. | Cradle deployment costs 2 TV. Forward deployment has the standard cost. |

Visible effects can provide clues about a species. The picks stay private until the review.

### Augments

Use **Augments** during a match to see prices and effects. An active Proxy must stand on a Deposit you control to make a purchase. Each side can buy each augment once per match, then use it once on one of its turns. The purchase price and activation are separate. Hop costs 1 TV to execute a chain, and The Call of Void takes effect immediately.

| Augment | Price | Effect |
| --- | ---: | --- |
| Hop | 5 TV | Plan one or more jumps by the same Proxy over adjacent occupied hexes. Each landing must be empty and the route must respect enemy shields. The final landing determines node control. |
| Ascension | 10 TV | From your 6th turn, the Strike part of an attack costs 1 TV less. From turn 12, Strike teleports to an enemy up to two reachable hexes away with no movement charge. From turn 18, a Move can cover two open hexes for 1 TV. These upgrades turn off when the Proxy starts on Turbulence. |
| Capacitor Overload | 30 TV | Once armed, bank half of the TV left at turn end, rounded down. The next turn adds the banked amount after the normal recharge cap. Purchase can spend the entire turn's budget, so activation can wait. |
| The Call of Void | 0 TV | Fills unoccupied friendly Cradle hexes immediately and keeps the rest of the 30 Proxies as free deployments. It discards other augments and lowers the TV cap to 20. Newly placed units activate on the following turn. |
| Electromagnetic Pulse | 10 TV | Disables enemy Aegis and Obelisk shields through the end of the round. Vanguard shields continue to protect the Nexus. |
| Troop Disabler | 10 TV | Stops the opponent from receiving new Proxies during their next turn. Existing reserves remain available. |
| Defensive Strike | 5 TV | Removes up to three enemy Proxies from your territory and recycles them into reserves. |
| Deadly Retaliation | 10 TV | On the opponent's next turn, drain up to 5 TV for each Strike victim. This applies to in-place Strikes, Ascension strikes, and Defensive Strike. |

## Rules used in this version

- Move and Strike are separate orders. Spend 1 TV to enter an enemy hex with enough TV remaining for a Strike. Both Proxies share the hex until you choose **Strike** or **Withdraw**. Strike costs 2 TV before modifiers. Withdrawing, ending the turn, or letting the timer expire returns the attacking Proxy to its starting hex without refunding movement TV. Armor also sends the attacker back after absorbing the hit.
- A special hex uses its full symbol when empty and a corner label when occupied. Click any hex for its rules, control, shield power, and occupying Proxies. Faint dashed borders mark shield positions while they are offline. Open **Match statistics** during play for TV, orders, casualties, reinforcements, and claims.
- Each printed shield border is linked to the nearest same-side shield node. A border shared by multiple nodes stays active while any of those nodes powers it.
- Either color can choose any species. The original map gives Blue 23 Cradle hexes and Red 22.

The [competition manual](competition/instruction-manual.pdf) and [print board](competition/board-print.pdf) are in `competition/`. The earlier board, final landscape board, and Hextml export are there too.

## Publish to GitHub Pages

The game has a static frontend and a separate matchmaking service. The workflow uploads only the browser files in `dist/`. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

1. To enable online play, deploy the matchmaking service with the supplied Cloudflare Worker configuration. The Worker and browser share the rules engine, so redeploy the Worker when publishing a change to the rules. [Cloudflare Durable Objects setup](https://developers.cloudflare.com/durable-objects/get-started/)

   ```sh
   npx wrangler@4 login
   npx wrangler@4 deploy
   ```

2. In the GitHub repository's Actions variables, set `MATCHMAKING_URL` to the public HTTPS origin printed by Wrangler. The Pages build uses that origin for the game API. With the variable empty, the site offers pass-and-play.
3. Choose **GitHub Actions** as the repository's Pages publishing source. Push to `main` or run **Publish game to GitHub Pages** in the Actions tab.

Run `npm test` to check the rules and matchmaking, and `npm run build` to regenerate the Pages artifact.

## Competition artwork

| Background-removed figure | Use |
| --- | --- |
| [Crown](web/assets/nexus.png) | Nexus |
| [Gold sword and shield](web/assets/vanguard.png) | Vanguard |
| [Paired triangles](web/assets/sentinel.png) | Sentinel Obelisk |
| [Gold ring](web/assets/deposit.png) | Deposit |
| [Gold hexagon](web/assets/aegis.png) | Aegis |
| [Black ring](competition/artwork/deposit-black.png) | Alternate Deposit figure |
| [Black sword and shield](competition/artwork/vanguard-black.png) | Alternate Vanguard figure |
| [Gold outline shield](competition/artwork/shield-outline.png) | Distinct shield drawing |

### Home artwork

The home menu uses an original [frontier illustration](web/assets/nexus-frontier.webp) generated with the built-in ImageGen tool.

<details>
<summary>Image prompt</summary>

> Generate a wide cinematic sci-fi concept illustration for the home menu backdrop of a hex strategy game. The scene is a distant aerial view of an alien frontier at night, with a monumental hexagonal fortress and an amber energy core in the right third, muted violet-blue storm clouds, thin concentric gold lights tracing the landing terraces, and a small reddish horizon glow on the far right. Dark navy, desaturated indigo, warm antique gold highlights. The left third should be deep, quiet blue-black negative space for separately rendered web text. Aim for tactile film-grain concept art with clean architectural geometry and an atmospheric sense of scale. Keep the fortress visible on a mobile center crop. Landscape 16:10, edge-to-edge, no typography, letters, logos, watermarks, interface elements, planets, or people.

</details>
