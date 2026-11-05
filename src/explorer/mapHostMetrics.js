// Counters for the background map (window.__mapHost), shared by MapHost and VenueExplorer.
export const mapHostMetrics=()=>window.__mapHost||(window.__mapHost={contexts:0,warm:false,activatedAt:null,framesSinceActive:0,framesDrawn:0});
/** Count a new 3D view (VenueExplorer's canvas was created). */
export function countMapContext(){mapHostMetrics().contexts++}
/** Count a drawn frame, and those drawn while the map is on screen (for the speed test). */
export function countActiveFrame(){const m=mapHostMetrics();m.framesDrawn++;if(m.activatedAt!=null)m.framesSinceActive++}
