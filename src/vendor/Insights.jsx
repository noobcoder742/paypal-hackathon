// Insights: the AG Studio dashboard on this vendor's bookings, with the Bookings assistant.
import React,{useMemo,useRef} from 'react';
import {AgStudio,AgStudioProvider,createWidgets} from 'ag-studio-react';
import {AgStudioAiModule} from 'ag-studio';
import {studioThemeWedding} from '../hotel/studioSetup.js';
import {buildVendorStudioData,VENDOR_WIDGETS,VENDOR_REPORT,buildVendorAi} from './insights.js';
import {studioRows} from './status.js';
import {getToken,bookingAction} from './api.js';
import '../hotel/hotel.css';

export default function Insights({vendor,bookings,askAi}){
 const rows=useMemo(()=>studioRows(bookings),[bookings]);
 const rowsRef=useRef(rows);rowsRef.current=rows;
 const data=useMemo(()=>buildVendorStudioData(rows,vendor),[rows,vendor]);
 const widgets=useMemo(()=>createWidgets({additionalTypes:VENDOR_WIDGETS}),[]);
 const ai=useMemo(()=>buildVendorAi({getToken,getRows:()=>rowsRef.current,
  draftReminder:async id=>{if(String(id).startsWith('example-'))throw new Error('Example bookings can’t get a reminder; open a real booking.');const r=await bookingAction(id,'draft-reminder');return r.text}}),[]);
 return <div className="vs-insights">
  <AgStudioProvider licenseKey={import.meta.env.VITE_AG_STUDIO_LICENSE||undefined} modules={[AgStudioAiModule]}>
   <AgStudio style={{height:'100%',width:'100%'}} theme={studioThemeWedding} data={data} widgets={widgets} ai={ai} initialState={VENDOR_REPORT} mode={askAi?'edit':'view'} panels={{edit:{right:['ai','edit']},view:{right:['filters']}}}/>
  </AgStudioProvider>
 </div>;
}
