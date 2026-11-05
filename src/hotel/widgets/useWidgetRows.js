// Reads a custom widget's mapped fields through the AG Studio widget API (filters and cross-filters apply).
import {useEffect,useState} from 'react';
export function useWidgetRows(params,keys){
 const [state,setState]=useState({rows:[],fields:[]});
 const mapping=params.dataMapping||{};
 const fields=keys.map(k=>(mapping[k]||[])[0]).filter(Boolean);
 const sig=JSON.stringify(fields);
 useEffect(()=>{let live=true;if(fields.length<keys.length){setState({rows:[],fields});return}
  params.widgetApi.getData({fields}).then(r=>{if(live)setState({rows:r?.results?.rows||[],fields})}).catch(()=>{if(live)setState({rows:[],fields})});
  return()=>{live=false}},[sig,params]);// eslint-disable-line react-hooks/exhaustive-deps
 // rows are keyed by the field's key, with ".sum" (etc.) added for aggregated fields
 const keyOf=field=>{const k=field.key||field.fieldId||field.id;return Object.keys(state.rows[0]||{}).find(x=>x===k||x.startsWith(k+'.'))||k};
 return state.rows.map(row=>Object.fromEntries(keys.map((k,i)=>[k,state.fields[i]?row[keyOf(state.fields[i])]:undefined])));
}
