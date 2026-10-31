import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,Plus,Check,Search,ShoppingBag} from 'lucide-react';

// DEMO CONTENT. All images, prices and vendor names are placeholders.
// Do not represent these as real vendor listings or hotel-approved packages.
export const demoListings=[
 {id:'floral-white',category:'Floral Arrangements',name:'Ivory garden centrepiece',vendor:'Sample floral studio',price:180,unit:'arrangement',photo:'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=800&q=80',inventoryType:'flowers'},
 {id:'floral-arch',category:'Floral Arrangements',name:'Ceremony floral arch',vendor:'Sample floral studio',price:980,unit:'setup',photo:'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',inventoryType:'arch'},
 {id:'floral-roses',category:'Floral Arrangements',name:'Blush rose display',vendor:'Sample floral studio',price:260,unit:'arrangement',photo:'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=800&q=80',inventoryType:'flowers'},
 {id:'music-strings',category:'Music & Entertainment',name:'Live string ensemble',vendor:'Sample music provider',price:850,unit:'session',photo:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80'},
 {id:'music-piano',category:'Music & Entertainment',name:'Piano performance',vendor:'Sample music provider',price:540,unit:'session',photo:'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80'},
 {id:'light-ambient',category:'Lighting & Production',name:'Warm ambient lighting',vendor:'Sample production studio',price:600,unit:'setup',photo:'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80'},
 {id:'light-stage',category:'Lighting & Production',name:'Stage spotlight package',vendor:'Sample production studio',price:740,unit:'setup',photo:'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80'},
 {id:'catering-banquet',category:'Hotel Catering',name:'Banquet menu consultation',vendor:'Hotel catering — placeholder',price:null,unit:'quote',photo:'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80'},
 {id:'catering-dessert',category:'Hotel Catering',name:'Dessert selection',vendor:'Hotel catering — placeholder',price:null,unit:'quote',photo:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'},
 {id:'chauffeur-car',category:'Chauffeur & Transport',name:'Wedding arrival chauffeur',vendor:'Sample transport provider',price:320,unit:'booking',photo:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80'}
];
const categories=['Floral Arrangements','Music & Entertainment','Lighting & Production','Hotel Catering','Chauffeur & Transport'];
function Product({item,onAdd,added}){
 const [imageIndex,setImageIndex]=useState(0);
 // Different crops of the same placeholder photograph, not additional verified product photos.
 const base=item.photo;
 const alternates=[base,base.replace('w=800','w=900').replace('q=80','q=75')+'&crop=entropy&fit=crop',base.replace('w=800','w=1000')+'&fit=crop&crop=center'];
 return <article className="editorial-product" onMouseLeave={()=>setImageIndex(0)}>
  <div className="editorial-photo" onMouseEnter={()=>setImageIndex(1)}>
   <img src={alternates[imageIndex]} alt={item.name+' illustrative reference'} loading="lazy"/>
   <div className="photo-steps">{alternates.map((_,i)=><button key={i} aria-label={'View sample image '+(i+1)} className={i===imageIndex?'current':''} onMouseEnter={()=>setImageIndex(i)} onClick={()=>setImageIndex(i)}/>)}</div>
   <button className={'editorial-add '+(added?'added':'')} disabled={added} onClick={()=>onAdd(item)}>{added?<><Check size={14}/> Added</>:<><Plus size={14}/> Add to inventory</>}</button>
  </div>
  <div className="editorial-meta"><span>{item.vendor}</span><span>{item.price===null?'Price on request':'From S$'+item.price.toLocaleString('en-SG')}</span></div>
  <div className="editorial-name">{item.name}</div>
 </article>;
}
export default function Marketplace({onBack,onAdd,added=[]}){
 const [category,setCategory]=useState(null);
 const [query,setQuery]=useState('');
 const matches=item=>[item.name,item.vendor,item.category].join(' ').toLowerCase().includes(query.toLowerCase());
 const items=demoListings.filter(matches);
 return <div className="marketplace-screen editorial-market">
  <div className="marketplace-top"><button className="market-back" onClick={()=>category?setCategory(null):onBack()}><ArrowLeft size={16}/>{category?'All collections':'Back to studio'}</button><span className="market-label">MARKETPLACE · CONCEPT</span></div>
  <div className="editorial-intro"><span className="eyebrow">THE WEDDING EDIT</span><h1>{category||'Thoughtfully curated.'}</h1><p>{category?'Explore the full collection and save pieces to your wedding plan.':'Explore pieces and services for your celebration.'}</p></div>
  <label className="editorial-search"><Search size={16}/><input placeholder="Search collections and items" value={query} onChange={e=>setQuery(e.target.value)}/><span>{added.length} saved <ShoppingBag size={14}/></span></label>
  {category?<div className="editorial-grid">{items.filter(item=>item.category===category).map(item=><Product key={item.id} item={item} onAdd={onAdd} added={added.includes(item.id)}/>)}</div>:
   <div className="editorial-sections">{categories.map(cat=>{const group=items.filter(item=>item.category===cat);if(!group.length)return null;return <section key={cat} className="editorial-section"><div className="editorial-section-head"><h2>{cat}</h2><button onClick={()=>setCategory(cat)}>View more <ArrowRight size={15}/></button></div><div className="editorial-row">{group.slice(0,4).map(item=><Product key={item.id} item={item} onAdd={onAdd} added={added.includes(item.id)}/>)}</div></section>})}</div>}
  {items.length===0&&<p className="market-empty">No items found.</p>}
  <p className="market-disclaimer">Prototype listings only. Images are illustrative, not authenticated product photographs. Hover variations use crops of the same image until vendors provide multiple photos. Prices are estimates, not quotations. Catering is subject to each hotel's approved menus.</p>
 </div>;
}
