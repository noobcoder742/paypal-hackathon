# Design: PayPal + AI wedding agent (PayPal AI Hackathon entry)

*Status: design approved in conversation on 5 Nov 2026, section by section. This document is waiting for review.*

## Goal
Enter the PayPal AI Hackathon (Devpost) with a working demo in which:
- **for couples,** an AI agent plans the wedding inside the existing site: it chooses a venue and vendors within budget, places the vendors' items in the 3D ballroom, and prepares PayPal sandbox deposits that the couple approves;
- **for hotels,** a second agent turns the couple's enquiry into a quote and sends a PayPal sandbox invoice for the banquet deposit.

## Hackathon rules this design depends on
*From the Official Rules, as pasted by the founder on 5 Nov 2026.*
- **Dates:**
  - Submission Period: 1 Oct 2026, 9:15 am PT – 12 Nov 2026, 12:00 pm PT (13 Nov, 4 am Singapore). **Our target is to submit by 10 Nov.**
  - Judging Period: 1–15 Dec 2026.
- **New or existing:** "newly created by the Entrant or … significantly updated after the start of the Hackathon Submission Period". The project's first commit is 31 Oct 2026, so it is newly created. The description says so, and the public repo keeps the dated history as evidence.
- **Requirement:** meaningfully integrate at least one PayPal technology (sandbox) and meaningfully incorporate AI. PayPal integration must be central. The prototype must work, be documented, and function as shown in the video.
- **Submission:**
  - A text description of features and functionality.
  - The tools used: the AI models and services, and how they are used.
  - A functional demo: a hosted URL, or complete run instructions.
  - A **public open-source repo with a licence visible in the About section**, containing all source, assets and instructions needed to run it.
  - A **video under 3 minutes, public on YouTube**, showing it working on the intended device. The video must contain **no third-party trademarks or copyrighted music or material without permission**.
- **Testing access:**
  - Judges get any test credentials or sandbox logins they need.
  - The project must stay available free of charge **until the Judging Period ends (15 Dec)**.
  - Judges may judge from the description, images and video alone.
- **IP:** the work must be original and solely owned, and must not violate copyright, trademark or privacy rights. Third-party SDKs and data must be used under their licences. Technical assistance is allowed if the ideas and work product are the entrant's.
- **Judging:**
  - Stage One is pass/fail on fit and on reasonable use of the required APIs and SDKs.
  - Stage Two has five equally weighted criteria: Technological Implementation, Design, Potential Impact, Innovation/Idea, Presentation. Ties are broken in that order.
  - Judging may include automated AI-driven analysis, so the README and description matter.
- **Prizes we target:**
  - Grand prizes.
  - Best Use of PayPal + AI.
  - Best Use of Agentic Commerce.
  - **Best Use of AG Grid** (US$5,000 for 1st). An entrant can win at most one grand prize (or honourable mention) plus one sponsor prize. AG Grid's own prize requirements (rules section 8) are still to be read from its details page.

## Venues in the demo
The rules forbid third-party trademarks in the video and IP infringement in the submission. The demo therefore uses **fictional hotels** on the real OpenStreetMap buildings, for example "The Orchard Grand" and "Tanglin House". The reconstructed ballroom is a generic "Grand Ballroom". The app and README say the venues are fictional demo venues. The map keeps its "© OpenStreetMap contributors" attribution.

## What the couple sees (main story)
1. **The ask.** A "Plan with AI" panel on the Design page, beside the 3D map. The couple types or picks a prompt, for example "30 tables, S$60k all-in, garden feel, Saturday 12 June 2027, near Orchard".
2. **Visible steps.** The agent's steps stream into the panel as short lines (comparing venues, checking capacity and price, choosing vendors). The camera flies to the chosen hotel using the bird's-eye rule (CLAUDE.md), opens the ballroom, and each chosen vendor item appears in the 3D room as it's picked.
3. **The plan card.** It shows the venue estimate, each vendor item with its price and reason, the total and the budget left. Follow-up requests ("swap the strings for a jazz band") change the room and the plan.
4. **"Secure these vendors."** The agent creates one PayPal sandbox order with one line per vendor deposit (20% of each item's price). The PayPal button opens, and the couple approves with a sandbox buyer account. Confirmation shows the paid deposits and the 10% platform commission per vendor.
5. **"Send enquiry to the hotel."** It sends the date, tables, budget and the 3D layout (a thumbnail plus the placed items).

## What the hotel sees (short scene)
1. A **Hotel inbox** page (demo login) lists qualified enquiries in an **AG Grid** table (free Community edition): date, tables, budget, 3D thumbnail, quote, invoice status and deposit paid. It is sortable and filterable, and its status cells update live.
2. **"Draft quote."** The hotel agent writes a quote: package, price per table, ++ (10% service charge, then 9% GST), and the deposit. The sales manager edits it and approves.
3. **Approval** makes the hotel agent create and send a PayPal sandbox invoice for the deposit to the couple's sandbox email.
4. The couple's **Planner** shows "Deposit invoice from <hotel>" with a link to pay it in PayPal. When it's paid, the hotel inbox shows "Deposit paid: date secured".

## Rules the agents always follow
- **No payment without approval.** No money moves without the couple's or the hotel's approval in PayPal. The agents create orders and invoices; people approve them.
- **Stay within the stated budget**, or say plainly that it isn't possible and why.
- **Amounts are enforced in code, not in the prompt.** Order and invoice amounts are recalculated on the server from catalogue and venue prices, and the order must match the plan the person saw.
- **Each agent gets only the PayPal tools it needs.** The couple's agent can create orders; the hotel's agent can create and send invoices.

## Architecture
Everything deploys to Vercel's free tier from this repo. The existing Vite app stays as it is; Vercel serves `dist/` and runs functions from `api/`.

| Piece | Responsibility |
| --- | --- |
| `api/agent` | Runs the couple's agent (Vercel AI SDK, streamed to the panel). Model order: Claude, then Gemini free tier on error or quota; if both fail, the client plays the labelled replay. |
| `api/paypal/capture` | Deterministic server code: captures an order only after the couple's PayPal approval, checks the captured amount against the stored plan, and records the result. |
| `api/hotel/enquiries` | Stores and lists enquiries. |
| `api/hotel/agent` | Runs the hotel's agent: drafts the quote, then creates and sends the invoice after approval. |
| `api/hotel/invoice-status` | Reads the invoice status from PayPal for the hotel inbox and the couple's Planner. |
| Shared data module | The catalogue (moved out of `Marketplace.jsx`) and venues (`src/data/venues.js`), imported by both the site and the functions, so the agent and the UI agree on prices and capacity. |
| Storage | Upstash Redis free tier (Vercel integration): enquiries, plans, payment records, and a per-visitor rate limit of 5 agent runs per hour. |
| Client | "Plan with AI" panel, plan card, PayPal JS SDK button (public client ID only), Hotel inbox page built on AG Grid Community, deposit invoices in the Planner. |

### Agent tools
- **Ours:**
  - `search_venues`: capacity, price per table, area.
  - `search_vendors`: category, style, price.
  - `check_budget`: venue plus vendors against the limit, and capacity against the tables.
  - `place_in_ballroom`: returns placement instructions that the browser applies to the 3D studio scene.
  - `send_enquiry`.
- **PayPal's** (`@paypal/agent-toolkit`, Vercel AI SDK adapter, sandbox only): *create order* for the couple's agent; *create invoice* and *send invoice* for the hotel's agent.

### Secrets
- **Where they live:** `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and the Upstash keys exist only in Vercel's environment variables, and in `.env.local` locally (gitignored). The browser receives only the public PayPal client ID.
- **CI check:** a secret scan fails the build on any key-like string in committed files.
- **Spending cap:** the Anthropic Console monthly limit is set to US$8.

### Commission
The demo shows the 10% platform commission per vendor line. Paying vendors directly with the commission split out (PayPal's multiparty or partner flow) needs PayPal partner approval, so the write-up describes it as the production path and the demo doesn't build it.

## Error handling
| Situation | Behaviour |
| --- | --- |
| Claude errors or is over budget | Retry the step on Gemini. If Gemini also fails, the panel offers the labelled replay of a recorded run plus "Try again". |
| Over budget or over capacity | `check_budget` and the capacity check reject the proposal. The agent revises it or explains why it can't. |
| PayPal declined, cancelled or popup closed | The plan stays unchanged, nothing is charged, and a clear message shows. |
| Capture fails | The failure is shown; it's never silently retried. |
| Rate limit reached | "You've used your 5 plans this hour", with the replay still offered. |
| Storage unavailable | The couple's flow works from the browser; the hotel inbox shows that it's waiting. |

## Testing
- **Unit tests (`node --test`):** budget maths, the 20% deposit and 10% commission, "order amounts equal the plan", tool input checks, and the model fallback order. Claude, Gemini and PayPal are faked.
- **One end-to-end run against the real PayPal sandbox** on the deployed site: plan, order, approve as the sandbox buyer, capture, enquiry, invoice, invoice paid.
- **Secret scan in CI.**
- **Real calls are tested on the Vercel deployment,** because the development environment may not reach PayPal or Anthropic directly.

## Founder's setup tasks
1. PayPal Developer account, a sandbox business account (the platform and hotel) and a sandbox personal account (the couple), plus a REST app's client ID and secret.
2. An Anthropic API key with a US$8 monthly limit.
3. A Google AI Studio key.
4. Vercel linked to the GitHub repo, with the Upstash integration added.
5. All keys pasted into Vercel's environment variables.

## Schedule (Singapore time, submit by Tue 10 Nov)
| Day | Work |
| --- | --- |
| Thu 5 Nov | Spec and plan; founder sets up the accounts; server skeleton deployed |
| Fri 6 | PayPal sandbox order and capture; agent with our tools; streaming panel; Claude → Gemini fallback |
| Sat 7 | Items placed in 3D live, plan card, swaps; Hotel inbox, hotel agent's quote and PayPal invoice |
| Sun 8 | AG Grid hotel inbox, rate limits, replay, tests, secret scan; fictional venue names; public repo copy prepared (history kept, emails and private folders removed, licence, README) |
| Mon 9 | End-to-end check on the deployed sandbox, polish, record the 3-minute video |
| Tue 10 | Devpost write-up (including what was updated since 1 Oct) and submit; 11–13 Nov kept spare |

## Public repository
A **new public GitHub repo** is created as a copy of this one, with the dated history kept:
- **Author emails:** in every commit, the founder's personal emails are replaced with their GitHub no-reply address. Future commits use that address.
- **Removed from the whole history:**
  - `docs/business-review/` and the ROI analysis.
  - `docs/reference-photos/`.
  - `CLAUDE.md` and `docs/roadmap.md`.
  - Internal plans and specs that discuss business strategy.
- **Hotel names:** real hotel names are replaced by the fictional demo names across the history.
- **Files added:**
  - An MIT `LICENSE` file (shown in the About section).
  - A data notice: map data © OpenStreetMap contributors, under ODbL.
  - A README with: what it is, how it uses PayPal and AI, the tools used, the hosted URL, test logins (sandbox buyer, hotel demo password), and run-it-yourself steps with your own keys.
- **Repo settings:** GitHub secret scanning and push protection turned on.
- **This private repo** keeps the full, unmodified project and continues as the main workspace.

## Security
- **Secrets:**
  - Exist only in Vercel's environment variables (and a gitignored `.env.local`).
  - A secret scan runs in CI.
  - GitHub push protection is on.
  - The README never contains API keys; judges get only sandbox logins and the demo password.
- **Cost abuse:**
  - A US$8 monthly Anthropic cap.
  - 5 agent runs per visitor per hour.
  - A cap on agent steps and output length per run.
  - Only same-origin requests are accepted.
  - Gemini, then the replay, take over when limits are hit.
- **Payments:**
  - The browser never sets amounts; the server recalculates every amount from catalogue and venue prices.
  - Capture checks the captured amount against the stored plan.
  - Payment and invoice status are read from PayPal, never trusted from the browser.
  - The server refuses to start with non-sandbox PayPal credentials.
- **Prompt injection:**
  - Enquiry text and vendor descriptions are untrusted input.
  - Each agent has only the PayPal tools it needs.
  - A person approves every order and invoice.
  - AI output is rendered as plain text, never as HTML.
- **Data:**
  - Only demo data, with a 30-day expiry in storage.
  - The prototype sign-in is labelled as a demo, and sensitive profile fields (religion, age) are hidden in the demo.
  - Keys and full prompts are never logged.
- **Availability through 15 Dec:** free tiers only (Vercel, Upstash, PayPal sandbox). The Anthropic cap resets on 1 Dec. A check of the hosted demo is scheduled for 1 Dec.

## Out of scope
Real vendor payouts and the marketplace split, real hotel partners and accounts, the hotel subscription, live availability calendars, and the homepage live-map hero (deferred idea).
