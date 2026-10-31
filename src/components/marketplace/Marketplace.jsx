import React,{useState} from 'react';
import {ArrowLeft,Plus,Check,Search,ShoppingBag} from 'lucide-react';

// Demonstration listings only. Replace with licensed vendor images, verified offers and
// hotel-approved menus before public launch. Prices are illustrative SGD estimates.
export const demoListings=[
 {id:'floral-white',category:'Floral',name:'Ivory garden centrepieces',vendor:'Sample floral studio',price:180,unit:'per arrangement',photo:'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=1000&q=80',inventoryType:'flowers'},
 {id:'floral-arch',category:'Floral',name:'Statement ceremony arch',vendor:'Sample floral studio',price:980,unit:'per setup',photo:'https://images.unsplash.com/photo-1519741497674-611481863552?w=1000&q=80',inventoryType:'arch'},
 {id:'music-strings',category:'Music',name:'Live string ensemble',vendor:'Sample music provider',price:850,unit:'per session',photo:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1000&q=80'},
 {id:'light-ambient',category:'Lighting',name:'Warm ambient lighting',vendor:'Sample production studio',price:600,unit:'per setup',photo:'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1000&q=80'},
 {id:'catering-banquet',category:'Catering',name:'Hotel banquet menu consultation',vendor:'Venue catering team — placeholder',price:null,unit:'quotation required',photo:'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1000&q=80'},
 {id:'chauffeur-car',category:'Chauffeur',name:'Wedding arrival chauffeur',vendor:'Sample transport provider',price:320,unit:'per booking',photo:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000&q=80'}
];
const categories=['All','Floral','Music','Lighting','Catering','Chauffeur'];
export default function Marketplace({onBack,onAdd,added=[]}){
 const [category,setCategory]=useState('All');
 const [query,setQuery]=useState('');
 const filtered=demoListings.filter(item=>(category==='All'||item.category===category)&&[item.name,item.vendor,item.category].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <div className="marketplace-screen">
  <div className="marketplace-top"><button className="market-back" onClick={onBack}><ArrowLeft size={17}/> Back to studio</button><span className="market-label">WEDDING MARKETPLACE · PREVIEW</span></div>
  <div className="marketplace-intro"><div><span className="eyebrow">CURATE YOUR CELEBRATION</span><h1>Discover the details.</h1><p>Explore flowers, performances, lighting and wedding services. Add favourites to your studio inventory.</p></div><div className="market-bag"><ShoppingBag size={18}/>{added.length} saved</div></div>
  <div className="marketplace-filters"><div className="market-categories">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="market-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search items or services"/></label></div>
  <div className="marketplace-gallery">{filtered.map(item=><article className="market-card" key={item.id}><div className="market-photo"><img src={item.photo} alt={'Illustrative '+item.category.toLowerCase()+' photograph'} loading="lazy"/><span>{item.category}</span></div><div className="market-info"><div><small>{item.vendor}</small><h3>{item.name}</h3><p>{item.price===null?'Price on request':`From S$${item.price.toLocaleString('en-SG')}`} <span>· {item.unit}</span></p></div><button className={added.includes(item.id)?'market-add added':'market-add'} disabled={added.includes(item.id)} onClick={()=>onAdd(item)}>{added.includes(item.id)?<><Check size={15}/> Added</>:<><Plus size={15}/> Add</>}</button></div></article>)}</div>
  {filtered.length===0&&<p className="market-empty">No listings match your search.</p>}
  <p className="market-disclaimer">Concept marketplace: illustrative photos, sample vendors and estimated prices only. No live listings, confirmed availability or hotel-approved catering menus yet. Chauffeur services are saved for future exterior/hotel planning, not placed in the ballroom.</p>
 </div>;
}
