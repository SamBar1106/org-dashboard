# Division One · Live Org dashboard

Public-by-link floor plan of Samuel Barrios's seven-division bot organization. Live start/finish/error/handoff pulses, stuck/missed detection, and a 1h/24h/7d activity timeline.

**Live URL:** https://sambar1106.github.io/org-dashboard/

> The full share link ends with `#k=<topic>` so the browser can open the live relay. Without it the page still shows the published snapshot and refreshes about every minute; with the link, a snapshot event from the publisher refetches it within seconds of Pages deploying.

## What you see
- An office floor plan: one room per division (plus a Shared Tools Lab), each bot/assistant as an emoji avatar.
- Distinct states: working (green pulse), 🟢 live (blue: the code is actually running, or ran within the grace window, default 10 min), 🔒 idle / not running (grey + lock), assistant (purple), planned (faded dashed), stuck/error/missed (red pulse). Frozen tools get a 🧊.
- Live vs lock comes from whether the node's code is ACTUALLY running (published by the private repo's `shared/running.py`), not from config flags. The config approval gate (e.g. "schedule approval: off") is shown as its own row in the side panel.
- Edges light up and a packet travels when a handoff event fires (e.g. QC → ED daily report).
- Activity feed of recent events and a selectable timeline of which bots were working.

## Privacy (hard rule)
This site and every event on the relay are public-by-link. Content is **only** bot/division names, states, generic step names, small integer counts, timestamps and exit codes. Never client names, phones, SSNs, amounts, ticket subjects or file names. Events are re-sanitized in the browser (`sanitize.js`) before anything is drawn; the private repo's `shared/heartbeat.py` enforces the same whitelist before posting.

## How live updates work
1. The private `division-one-bots` repo publishes `data/org.json` + `data/status.json` here (GitHub Pages).
2. Bots post tiny JSON events to a long random [ntfy.sh](https://ntfy.sh) topic (no account, no fee).
3. This page opens that topic with `EventSource` (`/sse?since=12h`) so updates appear without a refresh. The topic comes from the URL hash (`#k=…`) and is kept in localStorage.

## Files
| file | purpose |
|---|---|
| `index.html` / `style.css` / `app.js` | single-page dashboard (no build step, no npm deps) |
| `sanitize.js` | client-side event whitelist (mirrors the private-repo sanitizer) |
| `data/org.json` | divisions, nodes, edges, schedules (from the private repo) |
| `data/status.json` | rolling 7-day event snapshot |
| `test/` | sanitizer unit tests (`npm test`) |

## Limits
- ntfy.sh free retention is about a day; the published `status.json` covers ~7 days of history.
- Assistant routines only light up the board when they call the heartbeat helper (or `scripts/run_bot.sh`, which already does).
- Anyone with the share link can read (and post) dashboard events. Rotate the topic in `secrets/.env` (`HEARTBEAT_TOPIC`) and republish if it leaks.
