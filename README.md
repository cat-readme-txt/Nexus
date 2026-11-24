# Nexus

Nexus is a two-player hex strategy game adapted from the competition board. Command Proxies, open a route through enemy shields, and enter the opposing Nexus to win. [Play Nexus](https://cat-readme-txt.github.io/Nexus/)

- [Setting](#setting)
- [Start a match](#start-a-match)
- [Turns, TV, and combat](#turns-tv-and-combat)
- [The board and special hexes](#the-board-and-special-hexes)
- [Reinforcements](#reinforcements)
- [Species](#species)
- [Augments](#augments)
- [Controls, settings, and match review](#controls-settings-and-match-review)
- [Testing terminal](#testing-terminal)
- [Development and publishing](#development-and-publishing)

## Setting

When Earth discovers hostile powers beyond the planet, its governments disagree on how to respond and have little information about the threat. They give their most advanced AI access to their supercomputers. It simulates wars involving Earth and the alien powers, including conflicts between the aliens. Each match is one of those simulations.

## Start a match

| Mode | How to join |
| --- | --- |
| **Pass and play** | Play on one device. Pass it during species selection and between setup or play turns. The incoming player starts the clock by selecting **Start setup** or **Start turn**. |
| **Find an opponent** | Join the public queue. The first player waiting takes Blue and the player who joins takes Red. |
| **Play with a friend** | Create an invite and share the eight-character code. The host takes Blue and their friend enters the code to join as Red. |

1. Each player privately picks any species. Both players can pick the same one. Species selection has no turn clock. The game reveals both choices and the species-use statistics in the postgame review. Visible effects can give clues during play.
2. Blue places three starting Proxies for free on separate empty hexes in the Blue Cradle. Red then does the same in the Red Cradle. Each setup turn lasts up to three minutes and finishes as soon as the third Proxy is placed. If time runs out, the game places any missing Proxies in the available Cradle hexes nearest that side’s Nexus.
3. Blue takes the first play turn of round 1. A round consists of a Blue turn followed by a Red turn. The next round begins with Blue.

Online matches require a matchmaking server. Reloading the same browser tab can reconnect to its seat while the match is active. The server renews the public search lease while the player polls, holds a private invite for 20 minutes, and expires a paired room after two hours without an accepted game order. A pass-and-play match lives in the current page. Keep that tab open while playing.

## Turns, TV, and combat

**TV** stands for **teravolts**, the game’s unit of energy. Each play turn begins with **3 TV plus 1 TV per active Proxy**. Species supply bonuses count toward the normal recharge cap of 30 TV. **The Call of Void** lowers that cap to 20 TV. Banked **Capacitor Overload** TV is added after the cap. Starting and deployed Proxies activate at the beginning of their owner’s next play turn. A dormant Proxy occupies its hex and can be captured.

Spend TV on any number of legal orders, including repeated orders for the same Proxy. The turn ends when you select **End turn**, the three-minute clock expires, or you run out of TV. The turn stays open at 0 TV while you have a free Aegis capture available. Unspent TV clears at handoff, except for energy saved by an armed **Capacitor Overload**. The online clock runs on the server. Settings and in-game dialogs leave the clock running.

| Order | Cost | Effect |
| --- | ---: | --- |
| **Move** | 1 TV | Select an active friendly Proxy and enter an adjacent hex. A friendly Proxy blocks the destination. An enemy Proxy on a legal destination is captured immediately, and your Proxy takes its place. Capturing costs only the Move. Dormant and fortified enemies can both be captured this way. |
| **Obelisk fire** | 1 TV, or 2 for Directorate | Select an active Proxy on an Obelisk that belongs to your side and is under your control. Select **Obelisk fire**, then choose a highlighted enemy up to two reachable steps away. The firing Proxy stays in place. |
| **Capture** | 0 TV at an Aegis, 3 TV at an Obelisk, or 4 at an Obelisk for Veyari | Use an active Proxy standing on a node you do not control to change its controller. |
| **Occupy** | 3 TV, or 4 for Veyari | Use an active Proxy on a Deposit you do not control to claim it and receive a reserve Proxy. |
| **Deploy in Cradle** | 1 TV, or 2 for Keth | Place a reserve Proxy in one of your empty Cradle hexes. |
| **Forward deploy** | 1 TV | Place a reserve Proxy next to a controlled Aegis staffed by an active friendly Proxy. |
| **Fabricate reserve** | 2 TV | Add a reserve Proxy when you have fewer than two active Proxies. |
| **Recover cache** | 2 TV | Recover the cache underneath an active Proxy and add a reserve Proxy. |
| **Phase jump** | 2 TV | Use the Veyari species power from Turbulence. |
| **Fortify** | 2 TV | Use the Keth species power on a controlled Aegis or Obelisk. |

Active enemy shield borders block movement and Obelisk fire across the edge. For a two-step Move or shot, the intervening hex must be empty and the route must be legal. An Obelisk can hit an enemy on a Vanguard if there is a clear shot. Keth armor absorbs one Obelisk or Defensive Strike hit. Removing an enemy normally adds a reserve Proxy to the attacking side. **Troop Disabler** can block that reward and **Deadly Retaliation** can drain TV on a capture or Defensive Strike.

You win immediately when your Proxy enters the enemy Nexus. An enemy Proxy standing there is captured by that same Move. Select **Leave match → Concede** to give the other player the win and open the match review.

## The board and special hexes

The flat-top competition map has **337 playable hexes**, with columns A–Y and rows 1–14. Blue’s Nexus is **X2** and Red’s is **B13**. The green Cradles have 23 Blue hexes and 22 Red hexes. Each side starts with two Vanguards, eight Sentinel Obelisks, and seven Aegis nodes. Nine Deposits start neutral. Blue and red terrain still marks the original territories for **Defensive Strike**, even after a node changes hands. [Full board layout](web/board-data.js)

| Hex | Symbol when empty | Inlay while occupied | What it does |
| --- | --- | --- | --- |
| **Nexus** | Crown | Gold crown ridge | Enter the enemy Nexus to win. The staffed Vanguard shield can block entry. The Nexus also powers seven printed corner borders as long as its side controls at least one home Obelisk. |
| **Vanguard** | Sword and shield | Amber side brackets | An active friendly Proxy standing on either home Vanguard powers the shield ring around its Nexus. The ring drops when the enemy controls all eight of that side’s Obelisks, even with a staffed Vanguard. A friendly recapture restores the ring if a Vanguard is staffed. Enemy Proxies cannot enter Vanguard hexes. |
| **Sentinel Obelisk** | Paired triangles | Lilac chevrons | Powers its linked borders while controlled by its home side. Use **Capture** to turn them off or restore them. A Proxy on a controlled home Obelisk can fire. |
| **Aegis** | Gold hexagon | Two flat gold bars | Powers its linked borders while controlled by its home side. Capture it for free when an active Proxy is on it. Any side staffing a controlled Aegis can use **Forward deploy**. |
| **Deposit** | Gold ring | Gold ring | Grants one reserve Proxy when first occupied or taken from the opponent. An active Proxy on a Deposit you control lets you buy augments and triggers Directorate supply at the start of its turn. |
| **Cradle** | Green terrain | Green terrain | Your staging area for starting Proxies and reserve deployments. It counts as part of your original territory. |
| **Turbulence** | Gray terrain | Gray terrain | Veyari can phase jump from here. A Move starting here loses all Ascension bonuses. Salvage caches can surface here. |
| **Salvage cache** | Teal crate | Teal diamond | Spend 2 TV with an active Proxy on the cache to recover one reserve Proxy and remove the cache. |

All **251 printed borders** start powered. The separate Nexus ring depends on Vanguard staffing. A printed border belongs to one generator behind it along the line from the friendly Nexus toward the enemy Nexus. The home Nexus powers the corner borders that have no Aegis or Obelisk behind them. Click a generator to highlight its linked borders. Solid lines indicate power and faint dashed lines indicate an offline shield.

Standing on an enemy generator gives you the **Capture** order. Occupying the tile with a Move leaves the generator’s controller as it was. Capturing an Aegis or Obelisk changes ownership immediately, powers down its linked borders, and leaves neighboring generators in control of their own borders. The captured borders stay offline when the invader moves away. A friendly recapture restores them, subject to temporary EMP or forward deployment effects.

Paying to **Occupy** a Deposit gives the reserve reward immediately. The pending claim counts as control, so a staffed claimant can buy augments that turn. A friendly Proxy must be on the Deposit at the start of your next turn to secure the claim. If the claim is denied, the previous controller regains it or it goes neutral again. You keep any reserve award already received.

## Reinforcements

- **Cradle deployment.** Select **Deploy in Cradle**, then choose any highlighted empty hex in your own Cradle. Each deployment consumes one reserve Proxy. Deployments from a free Void reserve use those Proxies first and cost 0 TV.
- **Forward deployment.** Select an active Proxy on a controlled Aegis, then **Forward deploy** and an empty legal neighboring hex. It costs 1 TV, or 0 TV with a free Void reserve. You can use each Aegis once per turn. Deployment powers down its linked borders through the opponent’s next turn. The destination must respect enemy shields and cannot be the enemy Nexus or Vanguard.
- **Fabrication.** Spend 2 TV to add one Proxy to reserve when you have zero or one active Proxy. You can use it once every three of your turns, even with no pieces left on the board.
- **Salvage.** A cache surfaces at the start of every third round. The schedule starts at L7 on round 3 and cycles through N7, M6, M8, K7, O7, L8, N8, K6, and O8. If the scheduled hex still holds a cache, the game checks the next eligible hex in that order. An active Proxy can recover one by standing on it and spending 2 TV.
- **Rewards.** Enemy Proxies removed by combat and newly occupied Deposits generate reserves. The Human Directorate can also earn one through supply. **Troop Disabler** prevents new reserves for its affected turn and leaves existing reserves available.

## Species

Emblems appear during private selection and in the match review. Board Proxies use the player’s team color.

| Species | Identity and emblem | Power and trade-off |
| --- | --- | --- |
| Human Directorate | Earth’s governments formed a joint directorate to coordinate the simulations and their supply lines. Its emblem combines a globe and supply chevrons. | Start your turn with at least one active Proxy on a controlled Deposit to gain +3 TV and one reserve Proxy. The bonus applies once per turn even if several Deposits are staffed. Obelisk fire costs 2 TV. Raid staffed Deposits to interrupt their supply. |
| Veyari | Their name means “those who cross.” Their scouts navigate unstable channels between systems. Their emblem frames a phase passage. | Once per turn, pay 2 TV to jump an active Proxy from Turbulence to an empty hex up to three steps away. It can pass ordinary shields and occupied hexes. The route skips the enemy Nexus and enemy Vanguards. Obelisk capture and Deposit occupation cost 4 TV. Screen their empty landing hexes to limit options. |
| Keth | Keth was a chain of citadels. Its inhabitants kept the name after leaving their homeworld. Their emblem is an armored fortress. | Once per turn, pay 2 TV to fortify an active Proxy on a controlled Aegis or Obelisk. The armor absorbs one Obelisk or Defensive Strike hit, expires if the Proxy moves, and otherwise lasts until the owner’s next turn. A Move onto its hex still captures it. Paid Cradle deployments cost 2 TV and forward deployments use the usual rate. |

[Directorate emblem](web/assets/species-directorate.png) · [Veyari emblem](web/assets/species-veyari.png) · [Keth emblem](web/assets/species-keth.png)

## Augments

Open **Augments** during your play turn. To buy one, staff a controlled Deposit with an active Proxy and pay the listed price. Each side can buy each augment once per match. Bought augments can be used immediately or on a later turn after you lose access to the Deposit. Except for **The Call of Void**, buying and activating are separate. Most activations are free. **Hop** costs 1 TV to execute.

| Augment | Price | Activation and effect |
| --- | ---: | --- |
| **Hop** | 5 TV | Choose an active Proxy and plan one or more jumps over adjacent Proxies of either side. Each jump continues in a straight line over that Proxy to the next empty hex. The route respects enemy shields and cannot revisit hexes or continue past an enemy Nexus. Select the last landing again to remove it, or **Confirm hop** to commit the whole route for 1 TV. |
| **Ascension** | 10 TV | Activate once to unlock cumulative tiers on your own play turns. From turn 6, the first capture by Move that starts outside Turbulence refunds its 1 TV movement cost each turn. You still need 1 TV to issue that Move. From turn 12, Move can capture an enemy up to two reachable hexes away. From turn 18, the same range applies to empty destinations. A Move starting in Turbulence uses the normal adjacent range and cost. |
| **Capacitor Overload** | 30 TV | Activate before ending your turn. Half of your leftover TV, rounded down, is added to the next turn after the normal recharge cap. A purchase that spends all 30 TV ends the turn normally; the augment will be ready on a later turn. |
| **The Call of Void** | 0 TV | Invoke immediately to deliver 30 free Proxies. They fill empty friendly Cradle hexes first and leave the rest as free reserve deployments. Fielded Proxies activate next turn. Invoking discards your other augments and locks future augment purchases. It clamps your current TV and normal recharge to 20. |
| **Electromagnetic Pulse** | 10 TV | Turns off the enemy’s Aegis and Obelisk borders through the end of the current round. The Nexus ring and Nexus-powered corner borders keep their ordinary behavior. |
| **Troop Disabler** | 10 TV | On the enemy’s next turn, blocks new reserve rewards, fabrication, cache recovery, and invoking The Call of Void. The opponent can deploy their existing reserve. |
| **Defensive Strike** | 5 TV | Select one to three distinct enemies on hexes of your original territory, then confirm. It hits those targets without requiring a path or a nearby friendly Proxy. Fortification absorbs the first hit. Each enemy removed normally becomes one reserve Proxy. |
| **Deadly Retaliation** | 10 TV | On the enemy’s next turn, drains up to 5 of their remaining TV for each of your Proxies they capture by Move or target with Defensive Strike. This includes hits absorbed by Keth armor. Obelisk fire does not trigger it. |

## Controls, settings, and match review

- **Board.** Select your active Proxy to show legal moves. Select a highlighted destination to commit the Move. A destination containing an enemy is marked as a capture. Select a hex outside the highlighted destinations to inspect it. The inspector displays the coordinate, terrain or node, control, shield power, active effects, and the Proxy’s activation or fortification status.
- **Obelisk preview.** With **Obelisk fire** selected, cyan outlines show reachable hexes and highlighted enemy Proxies are the available targets. Select a target to fire.
- **Keyboard.** Focus the board. Q/W/E move the cursor northwest, north, and northeast. A/S/D move it southwest, south, and southeast. Up and Down go north and south. Left and Right go southwest and southeast; hold Shift with either to go northwest or northeast. Press Enter or Space to select. Escape clears the current selection or targeting plan. Use **−**, **Fit**, and **+** to adjust zoom.
- **Appearance.** **Settings → Proxy design** switches between the default **Drone** and the **Classic shield**. Dormant tokens have a dashed outline and fortification adds a gold hexagon. The inlays work with either token. A capture or hit flashes its hex briefly when reduced motion is off.
- **Audio.** Sound effects and the synthesized ambient soundtrack start after interacting with the page. Their volume sliders start at 65% and 30%, with 0% muting the channel. Effects mark actions, captures, shield changes, augments, the turn countdown, and results. The countdown warns at ten seconds and ticks at three, two, and one. Audio levels and the Proxy design are remembered in the browser where storage is available.
- **Statistics.** Open **Match statistics** during play. It shows turns started, active and reserve Proxies, TV earned from recharges, TV spent on orders and purchases, Ascension refunds, Move orders, Move captures, Obelisk shots, Defensive Strike uses, reinforcements deployed, forward deployments, Proxies lost and removed, hits absorbed, node claims, fabrication, caches recovered, and augments used. Starting placements are part of the fielded count. Deployment statistics count reserve placements, including forward deployments and Void placements. TV spent counts the up-front Move cost even if Ascension refunds it.
- **Review.** The match review shows the winner, round, and final stats, and reveals both species, their abilities, counterplay, and power-use counts. View the final board and reopen **Match review** from the top bar.

## Testing terminal

1. In the top bar, open **Settings** and check **Enable testing terminal**.
2. Start a **Pass and play** match, finish setup, and select **Start turn**. **Testing terminal** appears in the top bar during the active play turn.
3. Open it, type a command, and press Enter or **Run**.

| Command | Result |
| --- | --- |
| `help` | Lists the commands. |
| `add TV 100` | Adds 100 TV to the player who opened the terminal for that turn. It can exceed the normal recharge cap. |
| `add reserve 4` | Adds four undeployed Proxies to that player’s reserve. `proxy` and `proxies` also work in place of `reserve`. |

Commands accept positive whole numbers and are case-insensitive. The clock keeps running and the terminal closes at handoff. Testing commands are available only during an active pass-and-play turn. Added TV is a testing grant and does not count as earned in the match statistics.

## Development and publishing

Use Node.js 22 or newer. The development server runs the browser game and local matchmaking.

```sh
npm run dev
```

Open the printed address. For online testing on one machine, open that address in two separate browser profiles or use a regular and a private window. Run the rules, matchmaking, and terminal tests and then create the static bundle.

```sh
npm test
npm run build
```

For GitHub Pages, select **GitHub Actions** under **Settings → Pages**. A push to `main` or a manual run of **Publish game to GitHub Pages** runs the tests, builds the browser files into `dist/`, and deploys that directory. The Pages build offers pass-and-play by default. [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

For hosted matchmaking, deploy the supplied Cloudflare Worker and its Matchmaker Durable Object.

```sh
npx wrangler@4 login
npx wrangler@4 deploy
```

Set the GitHub repository’s Actions variable `MATCHMAKING_URL` to the Worker’s public HTTPS origin and rerun the Pages workflow. The generated browser configuration points to its `/api/match` endpoint. The browser and Worker share the same rules engine, so deploy them together whenever the rules change. [Cloudflare Durable Objects documentation](https://developers.cloudflare.com/durable-objects/get-started/)

The [competition manual](competition/instruction-manual.pdf), [print board](competition/board-print.pdf), earlier boards, and Hextml export are in the competition folder. The rules above describe the playable web version.

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
