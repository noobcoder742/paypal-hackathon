import test from 'node:test';
import assert from 'node:assert/strict';
import { venueNamedIn, namedVenue } from '../src/data/venues.js';
test('finds the venue a couple names, in any case, with or without "the"', () => {
  assert.equal(venueNamedIn('I want ORCHARD GRAND, 16 tables'), 'orchard-grand');
  assert.equal(venueNamedIn('The Claymore Residence please'), 'claymore-residence');
  assert.equal(venueNamedIn('garden wedding in Orchard, S$60k'), null);
});
test("only the couple's own messages count, newest first", () => {
  const msgs = [
    { role: 'user', content: 'Tanglin House, 30 tables' },
    { role: 'assistant', content: 'The Orchard Grand fits too.' },
    { role: 'user', content: 'ok, secure these vendors' },
  ];
  assert.equal(namedVenue(msgs), 'tanglin-house');
  assert.equal(namedVenue([{ role: 'assistant', content: 'The Orchard Grand' }]), null);
});
