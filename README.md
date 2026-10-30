# Grand Ballroom — interactive 3D prototype

Unofficial, estimated reconstruction of The Orchard Grand's Grand Ballroom. Not affiliated with or approved by the hotel.

## Start on your computer
1. Install Node.js LTS from https://nodejs.org and VS Code from https://code.visualstudio.com
2. Extract this ZIP file to a folder.
3. In VS Code choose **File > Open Folder**, then choose `orchard-grand-ballroom`.
4. Choose **Terminal > New Terminal**.
5. Type `npm install` and press Enter. Wait for it to finish (requires internet).
6. Type `npm run dev` and press Enter.
7. Open the local URL printed in the terminal, typically http://localhost:5173/.
8. Keep the terminal running while using the website. Press Ctrl+C in the terminal to stop.

## What works
- Dollhouse, top-down plan, and eye-level guest view
- Orbit and zoom controls (in plan view, pan with right mouse button)
- Move tables and stage by dragging
- Add/remove tables; adjust individual chair counts and table rotation
- Adjust stage size and rotation
- Change fabric colour, flowers, lighting, AV equipment and ceiling visibility
- Save to browser local storage
- Capacity warning above the published 380 guests

## Known limitations
- The exact fixture positions and architecture are estimated from photographs; this is not a survey.
- Door locations are provisional.
- Carpet is a procedurally approximated repeat pattern, not a photographed texture.
- Furniture can overlap; collision detection, clearance checks and exportable plans are future work.
- Save is local to the same browser/device, not an online account.
- Ceiling visibility is off by default so the room is visible from above.

## If something goes wrong
- `npm` not found: install Node.js LTS, then close and reopen VS Code.
- Blank 3D scene: try Chrome or Edge with hardware acceleration enabled, and check the VS Code terminal for errors.
- Port in use: Vite will print a different local URL; use that one.
