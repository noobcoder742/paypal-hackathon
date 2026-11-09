// Live-music line-ups: one marketplace listing per genre, where the couple picks
// the instruments and how many of each. The studio draws exactly that line-up.
// Classical players sit; jazz and pop players and singers stand.

export const GENRES = {
  classical: {
    label: 'Classical ensemble',
    pose: 'seated',
    base: 300,
    instruments: {
      violin: { label: 'Violin', max: 8, fee: 180 },
      viola: { label: 'Viola', max: 4, fee: 180 },
      cello: { label: 'Cello', max: 4, fee: 200 },
      doubleBass: { label: 'Double bass', max: 2, fee: 220 },
      flute: { label: 'Flute', max: 2, fee: 180 },
      harp: { label: 'Harp', max: 1, fee: 320 },
      piano: { label: 'Grand piano', max: 1, fee: 260 },
    },
    default: { violin: 2, viola: 1, cello: 1 },
  },
  jazz: {
    label: 'Jazz band',
    pose: 'standing',
    base: 360,
    instruments: {
      vocals: { label: 'Singer', max: 2, fee: 260 },
      saxophone: { label: 'Saxophone', max: 2, fee: 220 },
      trumpet: { label: 'Trumpet', max: 2, fee: 220 },
      doubleBass: { label: 'Double bass', max: 1, fee: 220 },
      piano: { label: 'Grand piano', max: 1, fee: 260 },
      drums: { label: 'Drum kit', max: 1, fee: 220 },
    },
    default: { vocals: 1, piano: 1, doubleBass: 1, drums: 1 },
  },
  pop: {
    label: 'Pop band',
    pose: 'standing',
    base: 420,
    instruments: {
      vocals: { label: 'Singer', max: 3, fee: 280 },
      electricGuitar: { label: 'Electric guitar', max: 2, fee: 220 },
      bassGuitar: { label: 'Bass guitar', max: 1, fee: 220 },
      keyboard: { label: 'Keyboard', max: 1, fee: 200 },
      drums: { label: 'Drum kit', max: 1, fee: 240 },
    },
    default: { vocals: 1, electricGuitar: 1, bassGuitar: 1, keyboard: 1, drums: 1 },
  },
};
export const MAX_MUSICIANS = 14;

/** Keep only this genre's instruments, whole numbers within each limit, at most MAX_MUSICIANS in total. */
export function cleanLineup(genre, lineup) {
  const g = GENRES[genre];
  if (!g) throw new Error('unknown genre ' + genre);
  const out = {};
  let total = 0;
  for (const [k, spec] of Object.entries(g.instruments)) {
    let n = Math.floor(Number(lineup?.[k]) || 0);
    n = Math.max(0, Math.min(spec.max, n, MAX_MUSICIANS - total));
    if (n > 0) {
      out[k] = n;
      total += n;
    }
  }
  return total ? out : { ...g.default };
}
export const lineupSize = lineup => Object.values(lineup || {}).reduce((s, n) => s + n, 0);
/** Price in S$: the band's base fee plus a fee per musician. */
export function ensemblePrice(genre, lineup) {
  const g = GENRES[genre],
    l = cleanLineup(genre, lineup);
  return g.base + Object.entries(l).reduce((s, [k, n]) => s + g.instruments[k].fee * n, 0);
}
export function lineupText(genre, lineup) {
  const g = GENRES[genre],
    l = cleanLineup(genre, lineup);
  return Object.entries(l)
    .map(([k, n]) => `${n} × ${g.instruments[k].label.toLowerCase()}`)
    .join(', ');
}

/**
 * Where each musician sits or stands, facing +z (the guests). Returns
 * [{instrument, x, z, rotation}] in metres, relative to the group's centre.
 */
export function ensembleLayout(genre, lineup) {
  const l = cleanLineup(genre, lineup),
    out = [];
  if (GENRES[genre].pose === 'seated') {
    // strings in a shallow arc (violins on the left as the guests see it), winds behind, piano and harp at the back corners
    const front = [
      ...Array(l.violin || 0).fill('violin'),
      ...Array(l.flute || 0).fill('flute'),
      ...Array(l.viola || 0).fill('viola'),
      ...Array(l.cello || 0).fill('cello'),
      ...Array(l.doubleBass || 0).fill('doubleBass'),
    ];
    // about 1 m between chairs along an arc whose ends come towards the guests
    const n = front.length,
      r = Math.max(2.4, ((n - 1) * 1.05) / (Math.PI * 0.8)),
      step = 1.05 / r;
    front.forEach((ins, i) => {
      const a = (i - (n - 1) / 2) * step;
      out.push({ instrument: ins, x: Math.sin(a) * r, z: (1 - Math.cos(a)) * r, rotation: -a });
    });
    const back = -1.6;
    // grand piano side-on to the guests: the pianist's right side and the open lid face the room
    if (l.piano) out.push({ instrument: 'piano', x: -2.6, z: back - 0.7, rotation: Math.PI / 2 });
    if (l.harp) out.push({ instrument: 'harp', x: 1.9, z: back, rotation: -0.35 });
  } else {
    if (l.drums) out.push({ instrument: 'drums', x: 0, z: -1.5, rotation: 0 });
    if (l.piano) out.push({ instrument: 'piano', x: -3.6, z: -1.2, rotation: Math.PI / 2 });
    const mid = [
      ...Array(l.keyboard || 0).fill('keyboard'),
      ...Array(l.doubleBass || 0).fill('doubleBass'),
      ...Array(l.bassGuitar || 0).fill('bassGuitar'),
    ];
    const sideX = [1.9, -1.9, 2.8, -2.8];
    mid.forEach((ins, i) =>
      out.push({
        instrument: ins,
        x: sideX[i % 4] * (l.piano && sideX[i % 4] < 0 ? 1.25 : 1),
        z: -0.7,
        rotation: sideX[i % 4] > 0 ? -0.25 : 0.25,
      })
    );
    const line = [
      ...Array(l.electricGuitar || 0).fill('electricGuitar'),
      ...Array(l.saxophone || 0).fill('saxophone'),
      ...Array(l.trumpet || 0).fill('trumpet'),
    ];
    line.forEach((ins, i) => {
      const k = i - (line.length - 1) / 2;
      out.push({
        instrument: ins,
        x: k * 1.15 + (k >= 0 ? 0.9 : -0.9) * (line.length > 0 ? 1 : 0),
        z: 0.25,
        rotation: -k * 0.12,
      });
    });
    const singers = l.vocals || 0;
    for (let i = 0; i < singers; i++)
      out.push({ instrument: 'vocals', x: (i - (singers - 1) / 2) * 1.1, z: 1.15, rotation: 0 });
  }
  return out;
}
/** Width and depth (metres) the group covers, for grabbing and clamping. */
export function ensembleFootprint(genre, lineup) {
  const pts = ensembleLayout(genre, lineup);
  const xs = pts.map(p => p.x),
    zs = pts.map(p => p.z);
  return [
    Math.max(2, Math.max(...xs) - Math.min(...xs) + 1.6),
    Math.max(1.6, Math.max(...zs) - Math.min(...zs) + 1.8),
  ];
}
