// Round cart button for the top bar. The count pops (and the bag nudges) each time an item is added.
import React,{useEffect,useRef,useState} from 'react';
import {ShoppingBag} from 'lucide-react';
import './cart.css';

export default function CartButton({count,onClick,active}){
 const prev=useRef(count),[bump,setBump]=useState(0);
 useEffect(()=>{if(count>prev.current)setBump(b=>b+1);prev.current=count},[count]);
 return <button type="button" key={'cart-'+bump} className={'cart-btn'+(bump?' bump':'')+(active?' on':'')} onClick={onClick}
  aria-label={count?`Cart, ${count} item${count===1?'':'s'}`:'Cart'}>
  <ShoppingBag size={18}/>
  {count>0&&<span className="cart-count" key={count} aria-hidden="true">{count>99?'99+':count}</span>}
 </button>;
}
