// The vendor catalogue, shared by the site and the agents (api/ and server/),
// so the agent and the page always agree on items and prices.
/** @placeholder DEMO_CATALOG: Replace with licensed vendor photos, real offers, prices and 3D asset URLs from the backend. Vendor names are fictional demo vendors. */
export const STYLES=['garden','classic','modern','romantic','minimal'];
export const CATALOG=[
 {id:'floral-white',category:'Floral Arrangements',name:'Ivory garden centrepiece',vendor:'Sample floral studio',price:180,unit:'arrangement',photo:'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=1000&q=80',inventoryType:'flowers',style:['classic','garden']},
 {id:'floral-arch',category:'Floral Arrangements',name:'Ceremony floral arch',vendor:'Sample floral studio',price:980,unit:'setup',photo:'https://images.unsplash.com/photo-1519741497674-611481863552?w=1000&q=80',inventoryType:'arch',style:['romantic','garden']},
 {id:'floral-roses',category:'Floral Arrangements',name:'Blush rose display',vendor:'Sample floral studio',price:260,unit:'arrangement',photo:'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=1000&q=80',inventoryType:'flowers',style:['romantic']},
 {id:'music-strings',category:'Music & Entertainment',name:'Live string ensemble',vendor:'Sample music provider',price:850,unit:'session',photo:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1000&q=80',style:['classic','romantic']},
 {id:'music-piano',category:'Music & Entertainment',name:'Piano performance',vendor:'Sample music provider',price:540,unit:'session',photo:'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1000&q=80',style:['classic','minimal']},
 {id:'light-ambient',category:'Lighting & Production',name:'Warm ambient lighting',vendor:'Sample production studio',price:600,unit:'setup',photo:'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1000&q=80',style:['romantic','classic']},
 {id:'light-stage',category:'Lighting & Production',name:'Stage spotlight package',vendor:'Sample production studio',price:740,unit:'setup',photo:'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1000&q=80',style:['modern']},
 {id:'catering-banquet',category:'Hotel Catering',name:'Banquet menu consultation',vendor:'Hotel catering — placeholder',price:null,unit:'quote',photo:'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1000&q=80',style:['classic']},
 {id:'catering-dessert',category:'Hotel Catering',name:'Dessert selection',vendor:'Hotel catering — placeholder',price:null,unit:'quote',photo:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1000&q=80',style:['classic']},
 {id:'chauffeur-car',category:'Chauffeur & Transport',name:'Wedding arrival chauffeur',vendor:'Sample transport provider',price:320,unit:'booking',photo:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000&q=80',style:['classic']},
 {id:'music-jazz',category:'Music & Entertainment',name:'Jazz trio',vendor:'Blue Note Collective (demo)',price:1200,unit:'session',photo:'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=1000&q=80',style:['modern','romantic']},
 {id:'floral-greenery',category:'Floral Arrangements',name:'Garden greenery centrepiece',vendor:'Fern & Foliage (demo)',price:150,unit:'arrangement',photo:'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1000&q=80',inventoryType:'flowers',style:['garden','minimal']},
 {id:'light-canopy',category:'Lighting & Production',name:'Fairy-light canopy',vendor:'Glow Works (demo)',price:1450,unit:'setup',photo:'https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=1000&q=80',style:['garden','romantic']},
 {id:'av-led',category:'Lighting & Production',name:'LED screen package',vendor:'Glow Works (demo)',price:1100,unit:'setup',photo:'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&q=80',inventoryType:'screen',style:['modern']},
 {id:'fun-photobooth',category:'Music & Entertainment',name:'Photo booth with prints',vendor:'Snap Happy (demo)',price:680,unit:'session',photo:'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=1000&q=80',style:['modern','classic']},
 {id:'dessert-table',category:'Hotel Catering',name:'Dessert table styling',vendor:'Sugar Atelier (demo)',price:890,unit:'setup',photo:'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1000&q=80',style:['romantic','garden']},
 {id:'car-classic',category:'Chauffeur & Transport',name:'Classic car arrival',vendor:'Heritage Motors (demo)',price:520,unit:'booking',photo:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1000&q=80',style:['classic','romantic']},
 {id:'send-off-bubbles',category:'Music & Entertainment',name:'Bubble send-off',vendor:'Snap Happy (demo)',price:180,unit:'setup',photo:'https://images.unsplash.com/photo-1519741497674-611481863552?w=1000&q=80',style:['garden','minimal']}
];
export const findItem=id=>CATALOG.find(x=>x.id===id);
