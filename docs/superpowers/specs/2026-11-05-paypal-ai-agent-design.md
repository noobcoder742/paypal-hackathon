# Design: PayPal + AI wedding agent (PayPal AI Hackathon entry)

*Status: design approved in conversation on 5 Nov 2026, section by section. This document is waiting for review.*

## Goal
Enter the PayPal AI Hackathon (Devpost) with a working demo in which:
- **for couples,** an AI agent plans the wedding inside the existing site: it chooses a venue and vendors within budget, places the vendors' items in the 3D ballroom, and prepares PayPal sandbox deposits that the couple approves;
- **for hotels,** a second agent turns the couple's enquiry into a quote and sends a PayPal sandbox invoice for the banquet deposit.

## Hackathon facts this design depends on
*From the Devpost listing and search snippets of the rules page. The full rules page could not be opened from this environment, so items marked unconfirmed must be checked there before submitting.*
- **Deadline:** 12 Nov 2026, 12:00 pm Pacific (13 Nov, 4 am Singapore). **Our target is to submit by 10 Nov.**
- **Requirement:** meaningfully use the PayPal developer platform (free sandbox) and an AI tool, model or platform. A design mockup doesn't qualify.
- **Existing projects:** allowed only if "significantly updated after the start of the Hackathon Submission Period" (1 Oct 2026). The submission must explain the update.
- **Submission:** a hosted demo URL and a demo video. Judges "may judge solely on the description, images and video".
  - Unconfirmed: the video is at most 3 minutes, public on YouTube.
  - Unconfirmed: a public repo with an open-source licence.
  - Everything in English.
- **Judging:**
  - Stage One is pass/fail on fit and on reasonable use of the PayPal and AI APIs or SDKs.
  - Stage Two uses five equally weighted criteria (unconfirmed names: technical implementation, design, potential impact, innovation, presentation).
  - Target prizes: grand prizes, "Best Use of PayPal + AI" and "Best Use of Agentic Commerce".

## What the couple sees (main story)
1. **The ask.** A "Plan with AI" panel on the Design page, beside the 3D map. The couple types or picks a prompt, for example "30 tables, S$60k all-in, garden feel, Saturday 12 June 2027, near Orchard".
2. **Visible steps.** The agent's steps stream into the panel as short lines (comparing venues, checking capacity and price, choosing vendors). The camera flies to the chosen hotel using the bird's-eye rule (CLAUDE.md), opens the ballroom, and each chosen vendor item appears in the 3D room as it's picked.
3. **The plan card.** It shows the venue estimate, each vendor item with its price and reason, the total and the budget left. Follow-up requests ("swap the strings for a jazz band") change the room and the plan.
4. **"Secure these vendors."** The agent creates one PayPal sandbox order with one line per vendor deposit (20% of each item's price). The PayPal button opens, and the couple approves with a sandbox buyer account. Confirmation shows the paid deposits and the 10% platform commission per vendor.
5. **"Send enquiry to the hotel."** It sends the date, tables, budget and the 3D layout (a thumbnail plus the placed items).

## What the hotel sees (short scene)
1. A **Hotel inbox** page (demo login) lists qualified enquiries: date, tables, budget, 3D thumbnail.
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
| Client | "Plan with AI" panel, plan card, PayPal JS SDK button (public client ID only), Hotel inbox page, deposit invoices in the Planner. |

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
| Sun 8 | Rate limits, replay, tests, secret scan, repo prepared to go public (licence, concept labels on hotels) |
| Mon 9 | End-to-end check on the deployed sandbox, polish, record the 3-minute video |
| Tue 10 | Devpost write-up (including what was updated since 1 Oct) and submit; 11–13 Nov kept spare |

## Before the repo goes public
- **No secrets:** none in the code or in the git history.
- **Concept labels:** real hotel names and the unofficial Orchard Grand reconstruction are labelled as a concept (see `docs/business-review/hotel_3d_security_review.md`).
- **Licences:** an open-source licence is added, and the OpenStreetMap ODbL attribution is kept.

## Out of scope
Real vendor payouts and the marketplace split, real hotel partners and accounts, the hotel subscription, live availability calendars, and the homepage live-map hero (deferred idea).
