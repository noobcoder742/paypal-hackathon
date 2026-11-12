# Devpost submission: Wedding Studio

*Copy each section into the matching Devpost field.*

## Project name
Wedding Studio

## Tagline
Plan and book your wedding in one place, and see every vendor's work in your venue in 3D before you pay.

## Inspiration
Planning a wedding means a dozen vendors, dozens of chat threads, quotes in PDFs and deposits sent by bank transfer,
all tracked in a spreadsheet. Couples pay for flowers and décor they have never seen in their own venue. Vendors chase
balances by text. We wanted one platform where couples can see the wedding in the room, plan it with help, and book
it in one payment, and where vendors get paid without the chasing.

## What it does
**For couples**
- **See it in 3D.** Every florist, band, lighting and décor listing can be placed in an interactive 3D ballroom. Drag
  items around, switch to a guest's seat, and compare.
- **Plan with AI.** Type "Garden wedding, 16 tables, S$60k". The planner searches venues and vendors, checks the
  budget (including service charge and GST), says plainly when something can't fit, and places the whole plan in the
  room while you watch.
- **Book in one checkout.** "Secure these vendors" (or Add to Cart from the marketplace) fills the cart. Adjust
  quantities, add a promo code, press Make payment and approve once in PayPal: a 20% deposit for every vendor.
- **The plan updates itself.** Paid items tick their checklist tasks, turn "Paid 20% deposit" on the budget and show
  their stage under Vendors.

**For vendors**
- **Bookings arrive with context.** Each paid deposit appears in the vendor's workspace with the date, venue, guest
  count and a floor plan of where their items go.
- **Get paid without chasing.** Send the 80% balance as a PayPal invoice in one click. Overdue? Open the to-do and
  send a friendly reminder the AI drafted, through PayPal.
- **Know the month at a glance.** Money in, due, overdue and weddings coming up, with a confetti burst when money
  arrives.

## How we built it
- **Front end:** React, Vite and react-three-fiber. The ballroom was modelled in Blender and lit in Cycles, with the
  lighting baked into textures so it runs smoothly in a browser.
- **Server:** Vercel functions and Supabase.
- **AI:** Vercel AI SDK with Claude Haiku, and Gemini Flash as an automatic fallback. The planner uses tools for
  venues, vendors, budget, room placement and checkout.
- **PayPal:**
  - **Orders v2**: one SGD order with a deposit line per vendor, created on the server from the cart, approved on
    PayPal's page and captured on the server with an amount check.
  - **PayPal Agent Toolkit**: `create_invoice`, `send_invoice`, `send_invoice_reminder` and `get_invoice` for vendor
    balances.
- **Guardrails:** every amount is computed in server code, never by the model or the browser. A person approves every
  payment, invoice and reminder. Each agent only has the tools it needs, and AI use is rate-limited and cached.

## Challenges we ran into
- Making a photoreal room run in a browser: we baked Cycles lighting into textures so the room costs almost nothing to
  draw, while furniture keeps live lighting.
- One payment for many vendors: one PayPal order with a line per vendor, then splitting it into bookings per vendor
  after capture.
- Promo codes and band line-ups change the price, so the server reprices the cart and checks the captured amount
  against the approved order.

## Accomplishments that we're proud of
- A full loop on both sides: plan with AI, see it in 3D, pay once with PayPal, the plan updates itself, the vendor
  gets the booking and collects the balance with PayPal invoices.
- Money the AI can't get wrong, because the AI never sets it.

## What we learned
AI works best when it prepares and explains and the person approves. Showing the result, a room that fills in, a
budget that turns green, matters as much as the answer.

## What's next for Wedding Studio
- A workspace for hotels and venues: enquiries, quotes and banquet deposits with PayPal invoices.
- Paying vendors directly with the platform commission split (PayPal multiparty).
- Real vendor partners with live availability, and more 3D venues.

## Built with
`paypal-orders-v2`, `paypal-agent-toolkit`, `claude-haiku`, `gemini`, `vercel-ai-sdk`, `react`, `three.js`,
`react-three-fiber`, `blender`, `vercel`, `supabase`

## AI tools used
- **Claude Haiku (Anthropic):** the couple's planning agent and the vendor's reminder drafts and assistant.
- **Gemini Flash (Google AI Studio):** automatic fallback model.
- **PayPal Agent Toolkit:** PayPal invoicing tools for vendors.
- **Claude Code:** used to write much of the code, from the founder's designs and decisions.

## Built during the submission period
The project was newly created: its first commit is 31 Oct 2026, and every commit is in the public repository.

## Testing instructions (for judges)
- **Live demo:** https://wedding-studio-gray.vercel.app
- **Couple:** sign in with any email.
- **PayPal sandbox buyer (Personal account):** email `[SANDBOX PERSONAL EMAIL]`, password `[SANDBOX PERSONAL PASSWORD]`.
  Test money only.
- **Promo code:** `PAYPALDEMO` (10% off deposits).
- **Vendor workspace:** landing page → **For vendors** → `hello@petalandstem.sg`, password `hackathondemo2026`.
- **Path:**
  1. **Design** → **The Orchard Grand** → the 3D ballroom opens.
  2. **Plan with AI** → "Garden wedding, 16 tables, S$60k". Watch the items appear in the room.
  3. "Secure these vendors" → the cart → **Make payment** → approve with the sandbox buyer above.
  4. **Update my plan** → see the budget and checklist update.
  5. **For vendors** → Petal & Stem → open the new booking → **Send balance invoice**.
- **If the AI hourly limit is reached,** the panel offers a labelled recorded example run.

## Links
- **Repository:** https://github.com/noobcoder742/paypal-hackathon
- **Video:** [YouTube URL]
