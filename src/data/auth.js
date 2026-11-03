// Prototype sign-in. There is no backend yet, so "signing in" stores a
// session in this browser only (no password, nothing sent anywhere). Swap
// signIn/signOut for the real auth provider later; the rest of the app only
// uses useAuth().
import {useEffect,useState} from 'react';

const KEY='wedding-session-v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||null}catch{return null}};
const emit=s=>window.dispatchEvent(new CustomEvent('wedding-session',{detail:s}));

export function signIn({email,name=''}){const s={email:email.trim(),name:name.trim(),signedInAt:new Date().toISOString()};try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}emit(s);return s}
export function signOut(){try{localStorage.removeItem(KEY)}catch{}emit(null)}
export function useAuth(){
 const [session,setSession]=useState(read);
 useEffect(()=>{const on=e=>setSession(e.detail);window.addEventListener('wedding-session',on);return()=>window.removeEventListener('wedding-session',on)},[]);
 return session;
}
