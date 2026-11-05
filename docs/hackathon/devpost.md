# Devpost submission draft: Wedding Studio

*Copy each section into the matching Devpost field. Replace the bracketed items before submitting.*

## Project name
Wedding Studio: plan a wedding with an AI agent, pay deposits with PayPal

## Tagline (one line)
An AI agent plans your wedding in a 3D ballroom and takes vendor deposits with PayPal, while the venue's agent turns your enquiry into a PayPal invoice.

## Inspiration
In Singapore a hotel wedding costs about S$60–80k, and couples juggle venue packages, a dozen vendors, deposits and spreadsheets for months. Hotels spend hours on show-rounds and on chasing deposits. We wanted one place where a couple can **see** their wedding in the actual room, and **pay** for it safely, with AI doing the legwork on both sides.

## What it does
**For couples, "Plan with AI".**
- You type your tables, budget and style, for example "30 tables, S$95,000, garden style, near Orchard".
- The agent compares venues and searches vendors.
- It checks the budget, including the ++ (10% service charge, then 9% GST), and says plainly when something can't work.
- It places the tables and décor in the 3D ballroom while you watch.
- "Secure these vendors" creates **one PayPal order with a 20% deposit line for each vendor**. You approve it in PayPal, and nothing is charged before that.
- "Send enquiry" passes the plan to the venue as a qualified lead.

**For venues, the "Banquet Sales" dashboard on AG Studio.**
- The enquiry arrives with its date, tables and budget. The hotel's agent drafts a warm quote from the venue's rate card.
- The sales manager approves, and the agent creates and sends a **PayPal invoice** for the 30% banquet deposit.
- For unpaid deposits, the agent writes a friendly reminder (a heads-up, never a demand), sent as a **PayPal invoice reminder**.
- The dashboard shows the pipeline, deposits paid with PayPal, a "Still to pay" scoreboard, a ballroom date calendar and a floor-plan preview.
- A Bookings assistant answers "who still owes a deposit?" and asks AG Studio's built-in agents to build new charts.
- The couple sees the invoice in their Planner, pays it, and the venue's dashboard flips to "Deposit paid: date secured".

## How we built it
- **The site:** Vite + React + react-three-fiber. It draws a 3D map of Singapore from OpenStreetMap and a 3D ballroom.
- **The server:** Vercel functions, with Upstash Redis for storage.
- **The agents:** Vercel AI SDK with **Claude Haiku 5.5**, with **Gemini 2.5 Flash** as an automatic fallback.
- **PayPal:**
  - **Orders v2**: the SGD deposit order with one line per vendor, captured on the server after approval, idempotent and amount-checked.
  - **JS SDK buttons**: for the couple's approval.
  - **PayPal Agent Toolkit**: `create_invoice`, `send_invoice`, `send_invoice_reminder`, `get_invoice`, `list_invoices` for the venue.
- **AG Studio:**
  - a custom theme matching the site;
  - three custom widgets that read live, cross-filtered data;
  - the **Studio Agent Framework**, with our own adapter routing every model turn through our server. Our Bookings agent is primary and delegates to AG's built-in agents.
- **Safety by design:**
  - Every amount is computed in server code, never taken from model text.
  - A person approves every payment and invoice.
  - Each agent has only the PayPal tools it needs.
  - Plan IDs come from the session, not the model.
  - Rate limits and a 30-day answer cache keep costs low; PayPal actions are never cached.
  - A clearly labelled recorded example run plays if the AI is unavailable.

## Challenges we ran into
- The toolkit's `create_order` only accepts USD, so the SGD deposit order uses Orders v2 directly, and the toolkit handles all invoicing.
- AG Studio's agents run in the browser. We wrote an adapter so their model turns go through our server with our models, keeping keys off the client.
- Making the 3D room update as the agent works, without losing the conversation between the map and the studio.

## Accomplishments that we're proud of
- A full loop: plan, then 3D room, then PayPal deposits, then the venue lead, PayPal invoice, reminder, and paid. Both sides are driven by agents, and a human approves every payment.
- Money that the AI can't get wrong, because the AI never sets it.

## What we learned
Agentic commerce works best when the agent prepares and explains, and the person approves. We also learned that the way the agent shows its work matters, from the visible steps to the room filling in.

## What's next for Wedding Studio
- Paying vendors directly with the commission split (PayPal multiparty).
- Real venue partners with live date availability.
- The hotel subscription through PayPal Subscriptions.
- More 3D ballrooms.

## Built with
`paypal-orders-v2`, `paypal-js-sdk`, `paypal-agent-toolkit`, `claude-haiku`, `gemini`, `vercel-ai-sdk`, `ag-studio`, `react`, `three.js`, `react-three-fiber`, `vercel`, `upstash`, `openstreetmap`

## Tools used (the AI services, and how they're used)
- **Claude Haiku 5.5 (Anthropic):** runs the couple's planning agent (tool use), the hotel's quote and reminder writing, and every turn of the AG Studio agents.
- **Gemini 2.5 Flash (Google AI Studio):** automatic fallback model.
- **AG Studio Agent Framework:** dashboard agents. Our Bookings assistant delegates to AG's built-in agents.
- **PayPal Agent Toolkit:** the hotel agent's PayPal invoicing tools.
- **Claude Code:** used to write much of the code, from the founder's designs and decisions.

## Built during the submission period
The project was **newly created**: its first commit is 31 Oct 2026. The 3D map, ballroom and planner were built from 31 Oct to 5 Nov. The PayPal checkout, invoicing and both AI agents were built from 5 to 10 Nov. Every commit is in the public repository.

## Testing instructions (for judges)
- **Hosted demo:** [URL]
- **Couple sign-in:** any email (demo sign-in).
- **PayPal sandbox buyer:** email [sandbox buyer email], password [sandbox buyer password]. This is test money only.
- **Venue dashboard:** footer → For venues (demo). Password: [HOTEL_DEMO_PASSWORD].
- **Path:**
  1. Design → Plan with AI → choose the first suggestion.
  2. Secure these vendors → approve in PayPal.
  3. Send enquiry to the venue, using the sandbox buyer email.
  4. For venues → Draft quote with AI → Approve and send PayPal invoice.
  5. Planner → Venue deposits → Pay with PayPal.
  6. On the dashboard: Ask the dashboard (AI).
- **If the AI hourly limit is reached,** the panel offers a labelled recorded example run.

## Links
- **Repository:** [public GitHub URL]
- **Video:** [YouTube URL]

## Prize categories
Grand prizes, Best Use of PayPal + AI, Best Use of Agentic Commerce, Best Use of AG Grid (AG Studio).
