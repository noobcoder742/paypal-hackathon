import React,{useState,useRef} from 'react';
import {LineupPicker} from './LineupPicker.jsx';
import {GENRES,cleanLineup,ensemblePrice} from '../../studio/decor/ensembles.js';
import useSlidingIndicator from '../ui/useSlidingIndicator.js';
import {ArrowLeft,ArrowRight,Plus,Check,Search,ShoppingBag,Heart,Star,Rotate3D,CalendarDays,MapPin,Clock,Info} from 'lucide-react';
import {CATALOG} from '../../data/catalog.js';
export const demoListings=CATALOG;
const categories=['Floral Arrangements','Ceremony & Decor','Music & Entertainment','Lighting & Production','Hotel Catering','Chauffeur & Transport'];
function price(item){return item.price==null?'Price on request':'From S$'+item.price.toLocaleString('en-SG')}
const FRAME_STYLES=[{objectPosition:'50% 50%',scale:1},{objectPosition:'25% 40%',scale:1.14},{objectPosition:'78% 62%',scale:1.24}];
function listingPhotos(item){return item.photos?.length?item.photos:FRAME_STYLES.map(()=>item.photo)}
// Product card: moving the pointer to the right steps through the photos, the
// card nudges right on hover, and hover reveals a favourite star and an
// add-to-inventory bar (always visible on touch screens).
function Listing({item,onOpen,isFavourite=false,onToggleFavourite,onAdd,added=false}){
 const photos=listingPhotos(item),[index,setIndex]=useState(0);
 const scrub=e=>{const r=e.currentTarget.getBoundingClientRect();setIndex(Math.min(photos.length-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*photos.length))))};
 const isProduct=true;
 return <div className="listing-card" onPointerLeave={()=>setIndex(0)}>
  <div className="listing-media" onPointerMove={scrub}>
   <button type="button" className="listing-media-open" onClick={()=>onOpen(item)} aria-label={'Open '+item.name}>
    {photos.map((src,i)=>{const frame=item.photos?.length?FRAME_STYLES[0]:FRAME_STYLES[i%FRAME_STYLES.length];return <img key={i} src={src} alt={i===0?item.name+' illustrative image':''} loading="lazy" className={i===index?'is-active':i<index?'is-before':'is-after'} style={{objectPosition:frame.objectPosition,'--frame-scale':frame.scale}}/>})}
   </button>
   {photos.length>1&&<div className="listing-dots" aria-hidden="true">{photos.map((_,i)=><span key={i} className={i===index?'on':''}/>)}</div>}
   {isProduct&&onToggleFavourite&&<button type="button" className={'listing-star'+(isFavourite?' active':'')} aria-pressed={isFavourite} aria-label={(isFavourite?'Remove from favourites: ':'Favourite: ')+item.name} title={isFavourite?'Remove from favourites':'Add to favourites'} onClick={()=>onToggleFavourite(item)}><Star size={17} strokeWidth={1.8}/></button>}
   {isProduct&&onAdd&&<button type="button" className={'listing-add'+(added?' added':'')} onClick={()=>{if(!added)onAdd(item)}} disabled={added}>{added?<><Check size={15}/> In your inventory</>:<><Plus size={15}/> Add to inventory</>}</button>}
  </div>
  <button type="button" className="listing-text" onClick={()=>onOpen(item)}><div className="editorial-meta mk-row"><span>{item.vendor}</span><span className="mk-num">{price(item)}</span></div><div className="editorial-name mk-name">{item.name}</div></button>
 </div>;
}
function ImageGallery({item}){const [selected,setSelected]=useState(0);const images=[item.photo,item.photo.replace('w=1000','w=1200')+'&crop=center',item.photo.replace('w=1000','w=1400')+'&crop=entropy'];return <div className="luxury-gallery"><div className="luxury-main-image"><img src={images[selected]} alt={item.name+' product illustration'}/><div className="luxury-image-note">{item.inventoryType?"Illustrative photography · Placeable in your 3D studio":"Illustrative photography · 3D model not yet available"}</div></div><div className="luxury-thumbs">{images.map((src,i)=><button className={selected===i?'active':''} key={i} onClick={()=>setSelected(i)} aria-label={'View image '+(i+1)}><img src={src} alt="Alternate crop of illustrative photo"/></button>)}</div></div>}
function ProductDetail({item,onBack,onAdd,added,onOpen,onStartDesign,isFavourite,onToggleFavourite,savedLineup}){
 const [lineup,setLineup]=useState(()=>item.genre?cleanLineup(item.genre,savedLineup||GENRES[item.genre].default):null);
 const changed=!!(item.genre&&savedLineup&&JSON.stringify(cleanLineup(item.genre,savedLineup))!==JSON.stringify(lineup));
 const related=demoListings.filter(x=>x.category===item.category&&x.id!==item.id).slice(0,3);
 return <div className="luxury-detail"><div className="luxury-breadcrumb"><button onClick={onBack}><ArrowLeft size={15}/> Marketplace</button><span>MARKETPLACE / {item.category.toUpperCase()}</span></div>
 <section className="luxury-hero"><ImageGallery item={item}/><div className="luxury-product-info"><small>THE WEDDING EDIT · {item.category.toUpperCase()}</small><h1>{item.name}</h1><p className="luxury-vendor">{item.vendor}</p><div className="luxury-price">{item.genre?`S$${ensemblePrice(item.genre,lineup).toLocaleString('en-SG')} / session`:price(item)}</div><p>{item.genre?'Pick the instruments and how many players you want. Your 3D studio shows exactly this line-up, and you can drag the band anywhere in the room.':'Thoughtfully selected for your celebration. Explore the details, check suitability for your venue and save this item to your wedding plan.'}</p>{item.genre&&<LineupPicker genre={item.genre} lineup={lineup} onChange={setLineup}/>}<button className="luxury-primary" disabled={added&&!changed} onClick={()=>onAdd(item.genre?{...item,lineup,price:ensemblePrice(item.genre,lineup)}:item)}>{added&&!changed?'Added to inventory':changed?'Update my line-up':'Add to inventory'} <ArrowRight size={17}/></button><button className="luxury-secondary" onClick={()=>onToggleFavourite(item)}>{isFavourite?'★ Remove favourite':'☆ Add to favourites'}</button><button className="luxury-secondary" onClick={onStartDesign}>Open my 3D studio <ArrowRight size={15}/></button><p className="luxury-note">Estimated pricing only. Availability, exact specifications and commercial rights must be confirmed with the vendor.</p></div></section>
 <section className="luxury-story"><span>01 — THE CREATION</span><h2>A detail that makes the day yours.</h2><p>Every element contributes to the atmosphere of a celebration. Discover how this piece could complement your chosen venue and wedding style.</p></section>
 <section className="luxury-wide-photo"><img src={item.photo} alt={item.name+' editorial illustration'} loading="lazy"/></section>
 <section className="luxury-story"><span>02 — EXPLORE EVERY ANGLE</span><h2>See the details up close.</h2><p>Browse the photographic views above. A true interactive 360° model will appear here when the vendor supplies an approved, optimized 3D asset.</p><div className="luxury-3d-placeholder"><Rotate3D size={35}/><strong>Interactive 3D model coming soon</strong><small>We won't simulate a 3D model by rotating a flat photograph.</small></div></section>
 <section className="luxury-details"><div><span>03 — THE DETAILS</span><h2>Composition & specifications.</h2></div><div className="luxury-specs">{[['Provider',item.vendor],['Collection',item.category],['Estimated price',price(item)],['Pricing basis',item.unit],['Availability','Vendor confirmation required'],['Customization','Request from vendor'],['Installation & delivery','Subject to vendor quotation']].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></section>
 <section className="luxury-story luxury-venue-cta"><span>04 — IN YOUR CELEBRATION</span><h2>Imagine it in your venue.</h2><p>Bring your ideas into the wedding studio and arrange your celebration in 3D.</p><button className="luxury-primary" onClick={onStartDesign}>Explore the design studio <ArrowRight size={16}/></button></section>
 <section className="luxury-related"><div className="between"><div><span>05 — DISCOVER MORE</span><h2>You may also love.</h2></div></div><div className="luxury-related-grid">{related.map(x=><Listing key={x.id} item={x} onOpen={onOpen}/>)}</div></section>
 <section className="luxury-story"><span>06 — VENDOR SERVICES</span><h2>Made for your celebration.</h2><p>Request a quotation, confirm setup requirements and coordinate delivery with your chosen vendor. Booking and payments will be enabled after vendor onboarding.</p></section></div>
}
// Short names for the category tabs.
const SHORT={'Floral Arrangements':'Floral','Ceremony & Decor':'Decor','Music & Entertainment':'Music','Lighting & Production':'Lighting','Hotel Catering':'Catering','Chauffeur & Transport':'Transport'};
// Venues are chosen on the 3D map (Design page), so the marketplace lists
// products and services only.
export default function Marketplace({initialCategory=null,onBack,onAdd,added=[],savedItems=[],backLabel=null,favourites=[],onToggleFavourite=()=>{},onStartDesign=()=>{},onPlan=()=>{}}){
 const tabsRef=useRef(null);
 const [category,setCategory]=useState(categories.includes(initialCategory)?initialCategory:'All'),[detail,setDetail]=useState(null),[query,setQuery]=useState('');
 const back=()=>{setDetail(null);window.scrollTo?.(0,0)};
 const open=item=>{setDetail(item);window.scrollTo?.(0,0)};
 const matches=item=>[item.name,item.vendor,item.category].join(' ').toLowerCase().includes(query.toLowerCase());
 const items=demoListings.filter(x=>(category==='All'||x.category===category)&&matches(x));
 useSlidingIndicator(tabsRef,[category,detail]);
 if(detail)return <div className="marketplace-screen luxury-market"><ProductDetail key={detail.id} item={detail} savedLineup={savedItems.find(x=>x.id===detail.id)?.lineup} onBack={back} onAdd={onAdd} added={added.includes(detail.id)} onOpen={open} onStartDesign={onStartDesign} isFavourite={favourites.includes(detail.id)} onToggleFavourite={onToggleFavourite}/></div>;
 return <div className="marketplace-screen mk">
  <div className="mk-head">
   <div>{backLabel&&<button type="button" className="mk-back" onClick={onBack}><ArrowLeft size={15}/> {backLabel}</button>}<span className="mk-label">The wedding edit · {demoListings.length} listings</span><h1>Find what <em>belongs</em> in your room.</h1></div>
   <div className="mk-tools">
    <label className="mk-search"><Search size={16}/><input placeholder="Search florals, lighting, music" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search the marketplace"/></label>
    <button type="button" className="mk-saved" onClick={onPlan} title="Open your saved items in the planner"><ShoppingBag size={15}/> {added.length} saved</button>
   </div>
  </div>
  <nav className="mk-chips" ref={tabsRef} aria-label="Categories"><span className="slide-ind" aria-hidden="true"/>
   {['All',...categories].map(c=><button type="button" key={c} className={category===c?'active':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c==='All'?'All':SHORT[c]}<sup>{c==='All'?demoListings.length:demoListings.filter(x=>x.category===c).length}</sup></button>)}
  </nav>
  {items.length?<div className="mk-grid">{items.map((item,i)=><div className="mk-cell" key={item.id} style={{'--i':i}}><Listing item={item} onOpen={open} isFavourite={favourites.includes(item.id)} onToggleFavourite={onToggleFavourite} onAdd={onAdd} added={added.includes(item.id)}/></div>)}</div>
   :<p className="mk-empty">No listings match “{query}”. Try another word or category.</p>}
  <p className="market-disclaimer">Prototype listings, illustrative imagery and estimated prices only. No live vendor inventory or payment processing.</p>
 </div>;
}
