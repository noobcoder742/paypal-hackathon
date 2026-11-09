// Venue directory for the map-first Design page.
// Built to grow to 100+ partner venues (hotels, churches, outdoor spaces):
// each venue has a location, a category, a few key facts and a list of
// bookable *spaces* (ballroom, chapel nave, lawn...). A space can be "3D ready"
// (has a studio model) or listed without one until the venue shares plans.
//
export const VENUE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'church', label: 'Churches' },
  { id: 'outdoor', label: 'Outdoor' },
];

export const VENUES = [
  {
    id: 'orchard-grand',
    banquet: { pricePerTable: 2288, minTables: 10, maxTables: 24 },
    name: 'The Orchard Grand',
    area: 'Tanglin · Orchard',
    category: 'hotel',
    status: '3d',
    // Points inside the venue's buildings (used to highlight them on the map).
    points: [[1.3057577, 103.8260358]],
    facts: [
      ['Nearest MRT', 'Orchard Boulevard (TE13), about 6 min walk'],
      ['Parking', 'Hotel car park'],
      ['Catering', 'In-house banquet kitchen'],
      ['Banquet capacity', 'Up to 240'],
    ],
    note: 'Fictional demo venue on a real building. Name, prices and details are invented for the demo.',
    spaces: [
      {
        id: 'grand-ballroom',
        name: 'Grand Ballroom',
        summary: '21 × 17 m · up to 240 guests',
        image: '/venues/ballroom-render.jpg',
        studio: 'orchard-grand/grand-ballroom',
        // Highlight box on the map, metres relative to the venue's first point.
        box: { x: 0, y: 2.7, z: 0, width: 16.8, height: 5.4, depth: 20.6 },
      },
    ],
  },
  {
    id: 'tanglin-house',
    banquet: { pricePerTable: 2188, minTables: 20, maxTables: 80 },
    name: 'Tanglin House',
    area: 'Orange Grove · Orchard',
    category: 'hotel',
    status: 'example',
    points: [
      [1.311267, 103.8264312],
      [1.3116651, 103.8271141],
      [1.3119636, 103.8261706],
    ],
    facts: [
      ['Nearest MRT', 'Orchard (NS22)'],
      ['Parking', 'On site'],
      ['Catering', 'In-house'],
      ['Banquet capacity', 'To be confirmed'],
    ],
    note: 'Fictional demo venue on a real building. Not a partner; spaces appear after onboarding.',
    spaces: [],
  },
  {
    id: 'cuscaden-hall',
    banquet: { pricePerTable: 2088, minTables: 15, maxTables: 45 },
    name: 'Cuscaden Hall',
    area: 'Cuscaden · Orchard',
    category: 'hotel',
    status: 'example',
    points: [[1.3045455, 103.8247868]],
    facts: [
      ['Nearest MRT', 'Orchard Boulevard (TE13)'],
      ['Parking', 'On site'],
      ['Catering', 'In-house'],
      ['Banquet capacity', 'To be confirmed'],
    ],
    note: 'Fictional demo venue on a real building. Not a partner.',
    spaces: [],
  },
  {
    id: 'claymore-residence',
    banquet: { pricePerTable: 1888, minTables: 10, maxTables: 30 },
    name: 'Claymore Residence',
    area: 'Claymore · Orchard',
    category: 'hotel',
    status: 'example',
    points: [[1.3074042, 103.8299804]],
    facts: [
      ['Nearest MRT', 'Orchard (NS22)'],
      ['Parking', 'On site'],
      ['Catering', 'In-house'],
      ['Banquet capacity', 'To be confirmed'],
    ],
    note: 'Fictional demo venue on a real building. Not a partner.',
    spaces: [],
  },
  {
    id: 'scotts-garden-hotel',
    banquet: { pricePerTable: 2488, minTables: 10, maxTables: 25 },
    name: 'Scotts Garden Hotel',
    area: 'Cuscaden · Orchard',
    category: 'hotel',
    status: 'example',
    points: [[1.3053416, 103.8276352]],
    facts: [
      ['Nearest MRT', 'Orchard Boulevard (TE13)'],
      ['Parking', 'To be confirmed'],
      ['Catering', 'In-house'],
      ['Banquet capacity', 'To be confirmed'],
    ],
    note: 'Fictional demo venue on a real building. Not a partner.',
    spaces: [],
  },
];

export const findVenue = id => VENUES.find(v => v.id === id);
export const findSpace = (venueId, spaceId) => findVenue(venueId)?.spaces.find(s => s.id === spaceId);
