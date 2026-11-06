// Dragging furniture across the floor: the item keeps the offset from where it
// was grabbed (no jump to the pointer), and nothing moves until the pointer has
// travelled a few pixels, so a click only selects.
export const DRAG_THRESHOLD_PX=4;

export function beginDrag({itemX,itemZ,hitX,hitZ,screenX,screenY}){
 return {offX:itemX-hitX,offZ:itemZ-hitZ,sx:screenX,sy:screenY,moved:false};
}
/** New item position for this pointer position, or null while it is still just a click. */
export function dragTo(state,{hitX,hitZ,screenX,screenY}){
 if(!state.moved){if(Math.hypot(screenX-state.sx,screenY-state.sy)<DRAG_THRESHOLD_PX)return null;state.moved=true}
 return {x:hitX+state.offX,z:hitZ+state.offZ};
}
