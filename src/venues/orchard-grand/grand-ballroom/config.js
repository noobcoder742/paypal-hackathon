// Venue-specific facts and provisional geometry live here, not in the shared viewer.
// Future hotels can provide another object with the same shape.
export const grandBallroom = {
  id: 'orchard-grand/grand-ballroom',
  hotelName: 'The Orchard Grand',
  roomName: 'Grand Ballroom',
  publishedCapacity: 240,
  // x across the room (head wall at -x), z along it; height = top of the ceiling coffers
  dimensions: { length: 16.8, width: 20.6, height: 5.35 },
  status: 'unofficial-concept',
  notes: 'Fictional demo room modelled in Blender from reference images; dimensions are estimates.',
  // v2: the room changed size, so layouts saved for the old room start fresh
  storageKey: 'wedding-room-v2'
};
