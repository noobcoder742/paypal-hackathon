# Map accuracy report

Generated 2026-11-02T19:14:26.075Z from tiles built 2026-11-02T19:13:33.154Z.

## 1. Horizontal scale (projection)
Footprints and positions come from OpenStreetMap, which is traced from aerial imagery and survey data.
Our flat-map projection was checked against exact distances on the WGS84 Earth ellipsoid (the model GPS and Google Earth use) for 3996 random point pairs across Singapore:

- mean scale error: **0.016 %**
- worst case: **0.032 %** (about 0.03 m per 100 m)

Building sizes and the distances between buildings therefore keep their true relative scale.

## 2. Heights of well-known towers
| Building | Published height | Our map | Difference |
| --- | --- | --- | --- |
| Guoco Tower | 290 m | 290 m (tallest of 2 parts) | +0.0 % |
| One Raffles Place (Tower 1) | 280 m | 283 m (tallest of 6 parts) | +1.1 % |
| UOB Plaza One | 280 m | not named in OSM | – |
| Republic Plaza | 280 m | 280 m (tallest of 17 parts) | +0.0 % |
| CapitaSpring | 280 m | 280 m (tallest of 2 parts) | +0.0 % |
| Ocean Financial Centre | 245 m | 245 m (tallest of 5 parts) | +0.0 % |
| Orchard Residences (ION) | 218 m | not named in OSM | – |
| Marina Bay Sands hotel tower | 194 m | 193 m | -0.5 % |
| The Pinnacle@Duxton | 156 m | 150 m (tallest of 10 parts) | -3.8 % |

Matched 7 of 9 landmarks; mean absolute difference **0.8 %**.

## 3. Height coverage
- 162,669 buildings in total
- 3.4 % have a measured height tag
- 31.1 % have a storey count (height = storeys × 3.4 m + 1.5 m)
- 65.5 % have no height data and use an estimate from building type and footprint

The estimated buildings are the main source of error: their footprints are accurate but their heights are approximations.
Low-rise houses and shophouses are usually close; mid-rise blocks without tags can be off by several storeys.

## How to spot-check against Google Earth yourself
Open Google Earth, find the building, and use the Measure tool (ruler) to compare a footprint edge or the gap between two towers with the same buildings in our map.
Heights can be compared by counting storeys on the 3D view. Report any wrong building and its address; the fix is a height or storey tag in OpenStreetMap (free, and it improves the map for everyone), then re-run the map Action.
