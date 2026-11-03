// User settings, stored in this browser (localStorage) until accounts exist.
// Read anywhere with getSettings(); components re-render with useSettings().
import {useEffect,useState} from 'react';

const KEY='wedding-settings-v1';
export const DEFAULT_SETTINGS={
 // notifications
 emailTaskReminders:true,emailVendorReplies:true,emailRsvpUpdates:true,weeklySummary:false,
 // regional
 currency:'SGD',dateFormat:'d MMM yyyy',language:'en',timeZone:'Asia/Singapore',
 // design studio and map
 mapQuality:'high',          // high: shadows + neighbourhood details · balanced: details, no shadows · saver: neither
 reduceMotion:false,
 // privacy (PDPA consent choices)
 analyticsConsent:false,personalisedRecommendations:true,marketingEmails:false
};

export function getSettings(){try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...DEFAULT_SETTINGS}}}
export function saveSettings(patch){
 const next={...getSettings(),...patch};
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}
 applyGlobalSettings(next);window.dispatchEvent(new CustomEvent('wedding-settings',{detail:next}));return next;
}
export function applyGlobalSettings(s=getSettings()){document.documentElement.classList.toggle('reduce-motion',!!s.reduceMotion)}
export function useSettings(){
 const [s,setS]=useState(getSettings);
 useEffect(()=>{const on=e=>setS(e.detail);window.addEventListener('wedding-settings',on);return()=>window.removeEventListener('wedding-settings',on)},[]);
 return [s,saveSettings];
}
export const SETTINGS_KEY=KEY;
