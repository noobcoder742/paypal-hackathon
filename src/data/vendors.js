// Demo vendor companies. Signing in with any email at a vendor's domain (plus the demo
// password) opens that vendor's workspace. All fictional.
export const VENDORS=[
 {id:'petal-stem',name:'Petal & Stem Floral Studio (demo)',category:'Florals',domain:'petalandstem.sg'},
 {id:'fern-foliage',name:'Fern & Foliage (demo)',category:'Florals',domain:'fernandfoliage.sg'},
 {id:'greenhouse',name:'Greenhouse Styling (demo)',category:'Decor',domain:'greenhousestyling.sg'},
 {id:'glow-works',name:'Glow Works (demo)',category:'Lighting & music',domain:'glowworks.sg'},
 {id:'lumen',name:'Lumen Production (demo)',category:'Production',domain:'lumenproduction.sg'},
 {id:'aria-strings',name:'Aria Strings (demo)',category:'Music',domain:'ariastrings.sg'},
 {id:'blue-note',name:'Blue Note Collective (demo)',category:'Music',domain:'bluenote.sg'},
 {id:'snap-happy',name:'Snap Happy (demo)',category:'Photo',domain:'snaphappy.sg'},
 {id:'sugar-atelier',name:'Sugar Atelier (demo)',category:'Desserts',domain:'sugaratelier.sg'},
 {id:'heritage-motors',name:'Heritage Motors (demo)',category:'Transport',domain:'heritagemotors.sg'},
 {id:'orchard-chauffeurs',name:'Orchard Chauffeurs (demo)',category:'Transport',domain:'orchardchauffeurs.sg'},
];
// Venue (hotel) domains: their workspace is "coming soon".
export const VENUE_DOMAINS=['orchardgrand.sg','tanglinhouse.sg','cuscadenhall.sg','claymoreresidence.sg','scottsgarden.sg'];

export const vendorById=id=>VENDORS.find(v=>v.id===id)||null;
export const vendorByName=name=>VENDORS.find(v=>v.name===name)||null;
/** 'vendor' + id, 'venue', or 'unknown' for a sign-in email. */
export function companyForEmail(email){
 const m=String(email||'').trim().toLowerCase().match(/^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/);
 if(!m)return {kind:'invalid'};
 const domain=m[1];
 const v=VENDORS.find(x=>domain===x.domain||domain.endsWith('.'+x.domain));
 if(v)return {kind:'vendor',vendor:v};
 if(VENUE_DOMAINS.some(d=>domain===d||domain.endsWith('.'+d)))return {kind:'venue'};
 return {kind:'unknown'};
}
