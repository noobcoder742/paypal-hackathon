# Vendor workspace (business side) — design

**Status:** agreed in chat on 6 Nov 2026 (founder chose: vendors first, hotels become "What's next";
the PayPal invoicing, AI reminders and AG Studio move to vendors; demo company accounts).

## Goal
A vendor (florist, band, photographer…) signs in with their company email and lands in their own
workspace: their clients, who has paid, colour-coded status, new bookings highlighted, and the
balance collected by PayPal invoice. Full-screen, with a left sidebar of pages (Vercel/Claude style),
in the quiet recent.design language (grey section labels, active dot, pill filters, 1px-border cards)
with restrained motion.

## Sign-in (demo accounts)
- `src/data/vendors.js` lists each demo vendor: id, name, category, email domain.
- Any email at a vendor's domain + the demo password (`DEMO_PASSWORD`, else `HOTEL_DEMO_PASSWORD`)
  returns a session token bound to that vendor id. Spaces are trimmed.
- A venue (hotel) domain → "Venue workspaces are coming soon". Unknown domain → "We couldn't find
  your company". Wrong password → "That password is not right".
- Every vendor API call is scoped to the token's vendor; a vendor can never read or act on another
  vendor's bookings.

## Data flow
1. A couple approves the deposit order in PayPal; `captureOrder` succeeds.
2. For each order line, a booking is stored for that item's vendor (`vbooking:<vendorId>:<id>`), with
   the couple's name and email from the PayPal capture (payer), item, quantity, total, 20% deposit
   paid, balance = total − deposit (server-computed), `seen:false`.
3. The vendor opens the booking (marks it seen) and sends the balance as a PayPal invoice
   (Agent Toolkit `create_invoice` + `send_invoice`) to the couple's PayPal email.
4. The AI drafts a friendly reminder; the vendor edits/approves; sent with `send_invoice_reminder`.
5. "Check payment" calls `get_invoice`; PAID → paid in full.
Example bookings (labelled "(example)") fill each workspace for the demo; they cannot be invoiced.

## Status (one colour each, always with a text label)
New (blue, row highlighted until opened) · Deposit paid (amber) · Balance invoiced (violet) ·
Overdue (red, invoice sent > 14 days ago and unpaid) · Paid in full (green).

## Pages (left sidebar)
- **Overview** — greeting, four count-up KPIs (new bookings, deposits received, balances to collect,
  paid in full), new bookings list (highlighted), next weddings.
- **Bookings** — every client: couple, wedding date, item, total, deposit, balance, status pill,
  paid tick, actions; status filter chips with counts.
- **Payments** — PayPal timeline: deposits captured, invoices sent, reminders, payments.
- **Calendar** — month grid; wedding days dotted in status colours.
- **Insights** — AG Studio dashboard on the vendor's bookings + "Ask AI" (Bookings assistant
  delegating to AG Studio's built-in agents). The coloured selection box on widgets is removed.

## Motion
Sliding sidebar indicator, page fade/rise (200 ms), staggered rows (first 8 only), count-up KPIs,
a soft pulse on the "new" dot. Transform/opacity only; all off under `prefers-reduced-motion`.

## Out of scope (Devpost "What's next")
Hotel/venue workspace (interlinked banquet enquiries), real email sign-in, vendor payouts.
