# Developer handoff — Wedding Studio prototype

Updated: 2026-11-02

## Annotation convention

Search the source for these markers:

- `@placeholder` — illustrative content or simplified assets; must be replaced before representing the result as real.
- `@prototype` — local-only behavior, not production-grade infrastructure.
- `@integration` — missing external API, database, asset pipeline, or certification.
- `@todo` — structural work for scaling and maintainability.
- `@legacy` — retained prototype route or functionality no longer in primary navigation.

## Current architecture

- `src/components/PlatformApp.jsx` — homepage, top navigation, account dropdown, personal dashboard, planner, local project state.
- `src/components/marketplace/Marketplace.jsx` — marketplace collections, detail pages, gallery, illustrative vendor/venue data and availability UI.
- `src/main.jsx` — React Three Fiber ballroom, furniture, cameras, seating mode, inventory and local save/undo logic.
- `src/style.css` — application and editor styles; currently a long file with historical overrides.
- `src/venues/orchard-grand/grand-ballroom/config.js` — venue configuration.

## Known placeholders and integrations

| Area | Current behavior | Needed before launch |
| --- | --- | --- |
| Venue listing | Generic illustrative image and estimated attributes | Hotel-approved photos, descriptions, dimensions and rights |
| Vendor catalog | Demonstration listings and prices | Vendor portal, approvals, commercial licenses, catalog schema |
| Product imagery | One photo and alternate crops | Vendor-approved distinct images, accessible image gallery |
| Product 3D | Placeholder text, not a 360-degree model | Optimized licensed GLB, material variants, fallback and performance QA |
| Venue calendar | Local preferred date input | Hotel-controlled inventory and price feeds, rate validity, availability statuses |
| Booking enquiry | Local confirmation message only | Authenticated enquiry API, hotel workflow, emails and status tracking |
| Marketplace save | Local wedding-plan item | Database-backed shortlist and inventory mapping |
| Authentication | No actual login/logout | Identity provider, session handling, role-based authorization |
| Planner | localStorage only | Persistent relational DB, validation, collaboration, audit history |
| RSVP | Local status editing only | Invitation tokens, consent, RSVP endpoint and email service |
| Wedding day | Local guest check-in toggles | Staff roles, sync, QR flow, offline/error handling |
| 3D geometry | Procedural approximations | Verified venue geometry, licensed textures and GLB assets |
| Seating | Stable-looking table/seat IDs in prototype | Persistent identifiers, reassignment rules and conflict checks |
| Layout safety | No collision or egress certification | Hotel validation and clear restrictions |
| Landing hero | CSS animation placeholder | Owned or licensed video / interactive 3D media |
| Routing | In-memory page state | URL routes, deep links, browser history, scroll restoration |
| Styles | Multiple appended CSS layers | Consolidate tokens and component styles |

## Navigation policy

- Header: **Marketplace**, **Design**, **Planner** centred.
- Clicking the **Wedding Studio** logo returns to the public homepage.
- **My Wedding** is in the account dropdown, alongside Profile and Settings.
- Marketplace landing has **no Back-to-home button**.
- Product and venue detail breadcrumb **Marketplace** returns to the marketplace collection root.
- Internal product/venue details must not send visitors back to the public homepage.

## Important production warnings

- The Orchard Grand Grand Ballroom is an **unofficial concept**, not hotel-approved.
- Current imagery and prices must not be represented as real vendor offers.
- Do not expose real guests' personal details through local-only prototype workflows.
- Do not claim live availability, payment capture or confirmed reservations.
- Review commercial licenses before deploying third-party photography, textures or models.

## Suggested developer verification

1. `npm install` then `npm run build`.
2. Verify Marketplace landing has no Back button; header logo still opens Home.
3. Open a vendor detail page and click Marketplace breadcrumb; confirm collection root.
4. Open venue detail and click Marketplace breadcrumb; confirm collection root.
5. Confirm the three centered header links work across pages.
6. Confirm account dropdown includes My Wedding.
7. Confirm planner tasks and saved marketplace items survive a browser refresh.
8. Confirm no booking, RSVP invitation, or logout action falsely reports external success.
9. Test table selection, Shift camera rotation, seat assignment and chair-perspective preview.
10. Test responsive layouts, reduced motion and GPU memory before deployment.

This file documents the prototype. It is not a security audit or certification.
