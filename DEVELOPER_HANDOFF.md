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
| Landing hero | Full-viewport video element; video file not yet supplied, CSS gradient fallback | Add owned/cleared MP4 at `public/media/wedding-hero.mp4` and optional poster `public/media/wedding-hero-poster.jpg` |
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

## Homepage media implementation

- The homepage video covers the entire viewport, including behind the transparent header.
- Place an owned or licensed H.264 MP4 at `public/media/wedding-hero.mp4`.
- Optionally provide `public/media/wedding-hero-poster.jpg` for the video poster.
- The video is muted, looping, and plays inline; reduced-motion users see a static fallback.
- **No video is included in this commit**. Until supplied, the CSS gradient fallback appears.
- Interior pages use a borderless, non-overlay navigation bar; only the 3D editor retains distinct floating controls.

## Vendor shortlist and inventory (prototype)

- Planner's Vendors screen has two tabs: **Inventory** (flat visual list, with hidden category metadata and planned quantities) and **Favourites** (grouped by category, ordered by user preference).
- Marketplace card stars toggle favourites without opening the item. On touch devices stars are always visible.
- Product detail pages expose separate Add to inventory and Favourite actions.
- Venue listings are excluded from these vendor/product collections; venue shortlists require their own booking-oriented model.
- Data currently lives in `localStorage` under `wedding-platform-planner-v1` (`savedItems`, `favourites`, `inventoryQuantities`). Ranking is array order within each category, not a global rank.
- Future DB should use separate `wishlist_items` and `wedding_inventory_items` tables with unique wedding/product keys, category metadata, optional preference rank, quantity and vendor approval status. Product IDs must be stable.
- No checkout or reservation is performed by adding to inventory.

## Camera navigation (updates_claude)

- `CameraRig` in `src/main.jsx` now orbits around a floor target instead of moving the camera freely.
- Dollhouse and Floor plan: left-drag orbits, right-drag or Shift+left-drag pans the target (kept inside the room), wheel or pinch zooms (`ORBIT_LIMITS`).
- Guest view and seat perspective use an eye-height camera. Dragging looks around and the wheel walks forward or back inside the room.
- View switches ease from the current camera position toward the new preset (`ORBIT_PRESETS`). Furniture dragging still disables the camera through `controlsRef`.
- `ORBIT_LIMITS.maxR` is the hook for the planned zoom-out to hotel corridors and the surrounding city (see `docs/redesign/PLAN.md`).
- Testing note: drei `Text` (troika) downloads font data from cdn.jsdelivr.net at runtime. If that host is blocked, the whole 3D scene stays blank. Before launch, bundle a local font and pass it through the `font` prop.

## Homepage (updates_claude)

- The hero is one 16:9 frame (full screen height on phones) that starts at the top of the page behind a transparent header. Logo and account button have no fill. The centre links sit in a translucent pill.
- The hero is followed by three sections: How it works, Venues ready in 3D, and The vendor edit. Category tiles open the Marketplace filtered to that category (`initialCategory` prop).

## Ballroom assets and surroundings (updates_claude)

- `src/studio/assets/ballroomAssets.jsx`: shared PBR materials, cloth/chair/bow geometry built once, instanced chandelier leaves and crystals, instanced place settings, a lattice canvas texture, and `StudioEnvironment` (PMREM RoomEnvironment). Labels use the bundled `public/fonts/LiberationSans-Regular.ttf` (SIL OFL).
- `scripts/fetch-osm-surroundings.mjs` writes `public/data/orchard-grand-surroundings.json`. The output is in metres, already projected around the hotel's OSM location (x east, z south). The GitHub Action `fetch-city.yml` refreshes it when the script changes, or on demand from the Actions tab.
- `src/studio/city/CityContext.jsx`: hidden until the camera is 60 m out. Hotel parts that contain the ballroom are drawn as translucent glass. `ORBIT_LIMITS.maxR` and `panRadius` grow when the data exists. Camera near/far and fog scale with zoom.
- Attribution "© OpenStreetMap contributors (ODbL)" must stay visible wherever the city layer is shown.

## Feature parity with `main`

`main` holds the first prototype (a single commit with history unrelated to `updates`). Each of its features was checked against `updates_claude`:

| `main` feature | Status on `updates_claude` |
| --- | --- |
| Dollhouse / floor plan / guest views | Kept, plus **Map view** (shown only when OSM data exists) |
| Drag tables and stage | Kept |
| Add / remove tables, delete selected table | Kept |
| Chairs per table | Kept (plus chair-to-table gap) |
| Table rotation, stage rotation | **Restored** (sliders in Selected item) |
| Stage width / depth | Kept |
| Fabric colour, flowers, lighting | Kept |
| Ceiling slab, AV equipment toggles | Kept (Venue environment) |
| Table flowers, LED screen, floral arch, stage | Kept through Inventory add/remove |
| Save to local storage, reset, capacity warning | Kept |

Seating (click a chair to highlight it, assign a guest, add dietary tags, view from the seat) comes from `updates` and still works with the new chair models.
Guest view keeps the camera at eye height inside the room, so it can never zoom out to the city. Only the orbit views (dollhouse, plan, map) can zoom out.

## Navigation, ceiling and marketplace cards (updates_claude)

- **Moving around:** in Map view, left-drag moves across the map and right-drag or Shift-drag rotates. In every view, arrow keys or WASD move and +/- zoom. Keys are ignored while typing in a form field. In Guest view the keys walk.
- **Ceiling:** "Show ceiling" (on by default for new layouts) draws the ceiling whenever the camera is below ceiling height, and hides it automatically from above. The duplicate slab in `Walls` was removed.
- **Product cards** (`Listing` in `Marketplace.jsx`):
  - Moving the pointer left to right steps through the photos, with a crossfade and slide. Pass `item.photos` to use real photos; extra frames are currently crops of one photo (`@placeholder LISTING_PHOTOS`).
  - On hover the card nudges right and reveals a star favourite button on a translucent circle (red when favourited) and a translucent rounded "Add to inventory" bar.
  - The star and bar are always visible on touch screens, and motion is reduced when the user asks for it.

## Design sidebar order (updates_claude)

- **Main tab:**
  1. **Selected item**: only shown when a table or the stage is selected, highlighted, and scrolled into view.
  2. Banquet tables
  3. Wedding styling
  4. **Stage & features**: one compact list of show/remove rows for stage, LED screen and floral arch.
  5. Venue environment (collapsed)
  6. Reset
- **Inventory tab:** inventory items, then Marketplace selections, then the Marketplace link.

## Map-first Design page, drafts and redesign v2 (updates_claude)

**Flow:**
1. Design opens `src/explorer/DesignPage.jsx`.
2. The first visit shows `VenueExplorer`, the 3D map of Singapore. Later visits reopen the last draft, with a "← on the map" link back.
3. Venues come from `src/data/venues.js`: hotels, churches and outdoor venues, each with bookable `spaces`. Only the Orchard Grand has a 3D space; the other four are labelled example pins on real buildings.
4. On the map you can search or filter, fly to a venue, open its card (MRT, parking, catering, capacity), and tap a ballroom. The building goes translucent and the ballroom box pulses. **Design this ballroom** then dives into the studio.

**Map data:**
- `scripts/fetch-sg-map.mjs` (run by the free `fetch-sg-map.yml` Action) fetches all of Singapore from OpenStreetMap in 0.05° chunks.
- It simplifies footprints (0.6 m tolerance) and writes 1 km tiles to `public/data/sg/tiles` plus `index.json`.
- Projection: equirectangular around 1.3521, 103.8198 (`src/explorer/geo.js`).
- Tiles near the camera load on demand (up to 180).
- Until tiles exist, the explorer falls back to the Orchard Grand 700 m dataset.
- **Accuracy:** `node scripts/check-map-accuracy.mjs` writes `docs/map-accuracy.md` (projection error, landmark heights, height coverage).

**Drafts:**
- Up to 3 per space. Draft A uses the original `wedding-room-v1` key, so existing layouts survive; B and C use `wedding-room-v1:draft-B` and `:draft-C`.
- Saving captures a thumbnail; this needs `preserveDrawingBuffer` on the studio canvas. Compare shows thumbnails and the stats of each saved draft.
- Switching drafts remounts the studio, so only saved changes carry over.
- Studio props added: `storageKey`, `headerExtras`, `onSaved`.

**Redesign v2:**
- White base, Cormorant Garamond + Outfit (Google Fonts in `index.html`), and one rosewood accent `#8e3b46`.
- Sliding indicators via `src/components/ui/useSlidingIndicator.js`: nav pill, studio views, side tabs, marketplace tabs.
- Side panel: summary and capacity meter, Selected item above the tabs, then **Layout** (tables, stage and features, room, reset) · **Style** · **Items** (inventory, marketplace selections).
- Checkboxes in the panel render as switches. Accordions animate where the browser supports `interpolate-size`.
- All motion respects `prefers-reduced-motion`.

### Map: unblocked venue views (src/explorer/viewFinder.js)
- Selecting a venue or ballroom no longer flies to a fixed angle. `findClearView` casts rays from points on the venue (centre and corners of each part, mid-height and top) to 24 candidate camera directions and picks the one with the fewest rays passing through neighbouring buildings, preferring the smallest turn. If every side is blocked it tilts towards top-down. Uses tile data only, ~20 ms per venue.
- Venue ownership (`venueOwnership` in VenueExplorer.jsx): buildings containing a venue point, or the nearest within 40 m, plus OSM buildings nearby with the venue's name, plus every other part of the same building. Parts share a building id (7th field of a tile building row, written by scripts/fetch-sg-map.mjs).
- For new venues, a point anywhere on the building is enough; matching the OSM name helps.

### Map realism: colours, evening light, hotel details (src/explorer/look/)
- **Colours** (`palette.js`): OpenStreetMap colour tags win when present (softened 30 % towards stone so named colours like "orange" don't look cartoonish); otherwise a palette by building type from the tile row's 8th field (HDB, apartments, houses/shophouses with clay roofs, glass towers, industrial, civic, religious, sheds). Roof colour from `roof:colour` (9th field) or the type palette.
- **Facades** (`buildingMaterial.js`): a MeshStandardMaterial extended in the shader with world-space floors and windows per facade kind (punched, glass curtain wall, house, none). Glass reflects the evening sky (warm on sun-facing walls); ~3.5 % of windows are lit. Windows fade out with distance to avoid shimmer.
- **Light** (`sun.js`, `EveningLight.jsx`): real sun position for 6:20pm Singapore time on today's date (NOAA equations; e.g. 3 Nov: azimuth 255°, elevation 6.5°, sunset 6:51pm). Warm sun with shadows that follow the camera target, cool sky fill, dusk sky gradient and haze.
- **Hotels** (`hotels.js`, `HotelDetails.jsx`): per-hotel facade overrides and details (floor slabs/balconies, fins/louvres, sky terraces, planters, roof gardens, crown glow). Sources in `docs/map-hotel-references.md`. Add an entry to `HOTEL_LOOKS` for each new partner venue.
- **Neighbourhood** (`NearbyDetails.jsx`): within 350 m of the selected venue, roof parapets, rooftop plant/AC/water tanks, street trees along main roads and trees in parks.

### Drafts: 2 per hotel
- `MAX_DRAFTS_PER_VENUE = 2` in `src/explorer/DesignPage.jsx`, counted across all spaces of a hotel. The map pin shows "N drafts" (saved drafts only) under the hotel name (`savedDraftCounts`).
- Planned paywall (3 drafts total for free users) is documented in `docs/roadmap.md`; not built.

### Planner, My Wedding, Profile, Settings redesign; marketplace without venues
- **Planner** (`src/components/planner/PlannerPage.jsx`): photo header, live summary cards (count-up), sliding section tabs, checklist as a phase timeline with animated checks and a progress ring, RSVP pills, budget bar (paid / scheduled / saved items / remaining), item cards with photos, check-in ring. Every previous function is kept (rename/add tasks, guests table, CSV export, seating studio link, payments, inventory quantities, ranked favourites, check-in, run-sheet notes).
- **My Wedding** (`src/components/account/AccountPages.jsx`): countdown to the wedding date, progress ring, venue and drafts card (last draft thumbnail), guest RSVP bars, budget meter, up-next tasks and saved items.
- **Profile**: all optional; stored in `planner.profile` (wedding date stays in `planner.date`). Fields: name, sign-in email, age, role, residency, wedding date, religion, ceremony type, guest-count range, budget range, style / venue type / area (multi-select), planning stage, how they found us. A completeness ring encourages filling it in. Use is gated by the analytics consent setting (PDPA).
- **Settings** (`src/data/settings.js`, key `wedding-settings-v1`): notifications, currency/date format/language, map quality (high / balanced / battery saver; read by the venue map), reduce motion (site-wide), PDPA consent toggles, download data as JSON, clear designs, clear planning data. Account features are marked "Coming soon".
- **Motion helpers** (`src/components/ui/motion.jsx`): CountUp, Ring, Reveal (with a fallback so content never stays hidden). All respect reduced motion.
- **Marketplace**: venues and their section removed (venues are chosen on the map). It now follows the approved preview: small uppercase label, large serif headline, search pill, text category tabs with a sliding underline, one 3-column grid with vendor and price above a serif product name, staggered entrance. Old saved venue items are dropped when the planner loads.

### Map fixes and Orchard detail (reference photos)
- **Name tags over the venue card:** map pins now use z-index 0–5, below the search panel and venue card (6).
- **Flicker in outer areas:**
  - Flat layers (ground, parks, water, footpaths, roads) don't write depth and draw in a fixed order, so overlapping OSM areas can't z-fight.
  - The sun's shadow map is snapped to whole texels and resized in steps.
  - Large parks, forests and water (392 areas spanning tiles) load once from `public/data/sg/areas.json` instead of popping with their centre tile.
  - Tiles near the view are kept while panning, and new tiles build one per frame.
- **Reference photos** (`scripts/fetch-reference-photos.mjs`, Action "Fetch reference photos"): Creative Commons photos from Wikimedia Commons taken in the last five years, saved in `docs/reference-photos` with authors and licences in `ATTRIBUTION.md`. They're team references only, not shipped. Commons has almost no recent free photos of the five hotels themselves, so the set covers the Orchard area: views from ION Orchard (2026), street views (2023–2025), the URA central area model (2025).
- **What the photos changed:**
  - **Facades:** two new styles, mall podium (glass shopfronts, pale stone, atrium glass) and office ribbon windows.
  - **Landmarks by OSM name** (`LANDMARK_LOOKS` in `look/hotels.js`):
    - Ngee Ann City: maroon granite with stepped crowns and glass pyramids.
    - Wisma Atria: blue glass.
    - a nearby hotel: white.
    - ION Orchard: dark glass.
    - Paragon and Lucky Plaza: stone and beige.
    - Tang Plaza: green roof.
  - **Orchard district layer** (`OrchardDetails` in VenueExplorer, ~2.9 × 1.4 km):
    - every building gets parapets and rooftop plant;
    - mall podium roofs get gardens, solar arrays or car-park decks;
    - large rain trees line Orchard Road and its side streets;
    - pale footpaths run beside main roads.
- iStock photos are paid Getty licences, not free to use, and the build environment can't reach them; don't add them to the repo.

### Studio map = venue map; guests by side; seat assignment; sign-in
- **Studio Map view** (`src/studio/city/StudioCity.jsx`) renders `CityLayers` from `explorer/VenueExplorer.jsx`, the same layers the venue map uses, shifted so the ballroom sits at the venue's first map point.
  - While the city is in view: 6:20pm light, the hotel drawn see-through, indoor lights dimmed and the reflection map off.
  - Clicking a hotel name tag opens it on the venue map.
- The back link is now a "Hotel selections on the map" button in the studio sidebar.
- **Guests** (`src/components/planner/GuestsSection.jsx`):
  - Sections Hers (pink), His (blue), Both sides (green), plus "Not sorted yet" for older guests.
  - `guest.side` is one of `hers`, `his` or `both`; `guest.diets` is an array of ids shared with the studio's seat badges.
  - "Assign →" calls `startAssign` in PlatformApp, which opens the studio in seating mode with `assignGuestId`. The user picks a chair and presses "Assign seat": the planner guest gets its table/seat, the seat gets the guest's diets, then the app returns to the guest list.
  - The Seating tab was removed (old `seating` links fall back to Guests).
- **Table sides** in the studio: `table.side` (`his`, `hers`, `mixed`) colours the 3D table title. It's set in the Selected item panel or the seating table panel, with a suggestion from the seated guests.
- **Planner tabs** are static (no sticky bar, no sideways scroll). Wedding day promotes the upcoming NFC check-in kit.
- **Sign-in** (`src/data/auth.js`, `src/components/account/SignedOut.jsx`) is a prototype that keeps the session in localStorage (`wedding-session-v1`). Replace `signIn`/`signOut` with the real provider.
  - Signed out: homepage, marketplace browsing, and teaser screens for Design, Planner and My Wedding. Profile and Settings ask to sign in. Saving or favouriting a product asks to sign in, then completes the action. A dismissible sign-in bar shows on public pages, and the nav has "Sign in" and "Get started".
  - Signed in: the logo and home go to **My Wedding** (kept over "Dashboard"). The account menu shows the email and a working Log out. The profile email is the sign-in email, read-only.
