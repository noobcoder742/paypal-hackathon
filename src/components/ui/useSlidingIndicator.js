import { useLayoutEffect } from 'react';
// Positions a `.slide-ind` element under the active button of a segmented
// control or tab row, so the highlight glides between options.
export default function useSlidingIndicator(
  ref,
  deps = [],
  activeSelector = '.active,.on,[aria-selected="true"]'
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ind = el.querySelector(':scope > .slide-ind');
    if (!ind) return;
    const place = () => {
      const on = el.querySelector(':scope > button:is(' + activeSelector + ')');
      if (!on) {
        ind.style.opacity = '0';
        return;
      }
      ind.style.opacity = '1';
      ind.style.width = on.offsetWidth + 'px';
      ind.style.height = on.offsetHeight + 'px';
      ind.style.transform = `translate(${on.offsetLeft}px,${on.offsetTop}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    document.fonts?.ready?.then(place);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
