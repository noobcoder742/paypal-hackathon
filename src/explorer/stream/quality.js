// Keeps the map smooth on every device (spec C1): a rolling 2 s median of the
// frame time, taken only while the camera moves, steps settings down one at a
// time when it's over the target, and back up one step after 5 s of headroom.
// Level 0 is best; level N has the first N steps reduced.
export const QUALITY_STEPS = ['dpr', 'shadows', 'detail', 'mid', 'extras'];
const WINDOW_MS = 2000,
  RAISE_AFTER_MS = 5000,
  HEADROOM = 0.6;

export class QualityController {
  /** targetMs: 33 on phones, 16.7 on laptops. cap: the lowest level allowed by Settings (high 0, balanced 2, saver 5). */
  constructor({ targetMs, cap = 0 }) {
    this.targetMs = targetMs;
    this.cap = cap;
    this.level = cap;
    this.samples = [];
    this.goodSince = null;
  }
  /** One frame: its time, whether the camera was moving, and the clock. Returns the level. */
  sample(dtMs, moving, nowMs) {
    if (!moving) return this.level;
    this.samples.push([nowMs, dtMs]);
    while (this.samples.length && nowMs - this.samples[0][0] > WINDOW_MS) this.samples.shift();
    if (nowMs - this.samples[0][0] < WINDOW_MS * 0.9) return this.level; // not a full window yet
    const sorted = this.samples.map(s => s[1]).sort((a, b) => a - b),
      med = sorted[sorted.length >> 1];
    if (med > this.targetMs && this.level < QUALITY_STEPS.length) {
      this.level++;
      this.samples = [];
      this.goodSince = null;
    } else if (med < this.targetMs * HEADROOM && this.level > this.cap) {
      if (this.goodSince == null) this.goodSince = nowMs;
      else if (nowMs - this.goodSince >= RAISE_AFTER_MS) {
        this.level--;
        this.samples = [];
        this.goodSince = null;
      }
    } else this.goodSince = null;
    return this.level;
  }
  setCap(cap) {
    this.cap = cap;
    if (this.level < cap) this.level = cap;
  }
  get settings() {
    const off = i => this.level > i;
    return {
      dpr: off(0) ? 1 : 1.75,
      shadows: !off(1),
      detailScale: off(2) ? 0.6 : 1,
      midScale: off(3) ? 0.6 : 1,
      extras: !off(4),
    };
  }
}
