// Free Unsplash photos (Unsplash License: free to use, no permission or credit needed),
// hotlinked from images.unsplash.com like the marketplace's vendor photos.
const u=(id,w=1600)=>`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=78`;
export const PHOTOS={
 couple:u('1591604466107-ec97de577aff'),          // My Wedding hero
 coupleAlt:u('1621621667797-e06afc217fb0',1200),   // My Wedding teaser
 coupleVeil:u('1546032996-6dfacbacbf3f',1000),     // sign-in panel
 hotel:u('1542314831-068cd1dbfeeb'),               // Planner hero
 garden:u('1523438885200-e635ba2c371e',600),       // garden pavilion card
 chapel:u('1438032005730-c779502df39b',600),       // heritage chapel card
 arch:u('1529636798458-92182e662485',1200),        // Design teaser
 table:u('1561912774-79769a0a0a7a',1200),          // Planner teaser
};
