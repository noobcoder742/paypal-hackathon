// Facade details for the hotels on the map, modelled in code from published
// descriptions of each building (see docs/map-hotel-references.md). Photos
// could not be downloaded in the build environment, so these are informed
// approximations: proportions and heights come from OpenStreetMap, the
// character (materials, fins, terraces, greenery) from the descriptions.
//
// Feature keys (all optional), rendered by HotelDetails.jsx:
//  wall/roof/kind   override facade colour, roof colour and window style
//  slabs   {every, depth, colour}      protruding floor edges / balconies every N storeys
//  fins    {spacing, depth, colour, minH}  vertical fins or louvres along every facade
//  green   {every, density, maxH}      planters with hanging plants on floor edges
//  terraces {every, height}            open sky terraces cut into the tower (recess + planting)
//  crown   {colour}                    glowing band at the top of the tallest part
//  roofGarden true                     planting on the roofs
export const HOTEL_LOOKS={
 // WATG, 2008: translucent glass towers that glow at night, crescent motif in
 // the massing (Singapore flag), sleek modern exterior.
 'orchard-grand':{wall:'#d8d6cf',roof:'#9fa3a3',kind:1,storey:3.6,
  slabs:{every:1,depth:.35,colour:'#eeebe4'},crown:{colour:'#ffd9a3'},roofGarden:false},
 // Tower Wing: contemporary high-rise with balconies. Garden Wing (WATG):
 // low-rise, curving, terraced balconies festooned with hanging plants.
 'tanglin-house':{wall:'#efebe2',roof:'#b9b4aa',kind:0,storey:3.2,
  slabs:{every:1,depth:1.1,colour:'#f6f3ec'},green:{every:1,density:.55,maxH:45},roofGarden:true},
 // John Portman, 1982 (former Regent): hanging-gardens terraced landscape,
 // warm precast facade with planted terraces.
 'cuscaden-hall':{wall:'#b48d72',roof:'#8f7564',kind:0,storey:3.4,
  slabs:{every:2,depth:.9,colour:'#c9a78e'},green:{every:2,density:.7},roofGarden:true},
 // WOHA, 2023: four strata of six-storey stacks separated by open-air sky
 // terraces, columns covered in creeping vines, CTBUH best tall building 2024.
 'claymore-residence':{wall:'#eeece6',roof:'#a7aba4',kind:1,storey:3.4,
  terraces:{every:6,height:6.5},green:{every:6,density:.9},slabs:{every:1,depth:.4,colour:'#f7f5f0'},roofGarden:true},
 // Safdie Architects with DP Architects, 2023: slatted bronze-and-glass
 // facade, adjustable white louvres, curving glass roof, central garden court.
 'scotts-garden-hotel':{wall:'#d9d2c4',roof:'#c2c7c6',kind:1,storey:3.5,
  fins:{spacing:.9,depth:.55,colour:'#f2efe8',minH:6},podiumFins:{colour:'#8a6a4c',height:6},roofGarden:true}
};
