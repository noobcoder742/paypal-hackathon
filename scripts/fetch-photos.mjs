#!/usr/bin/env node
// Downloads small previews of candidate Unsplash photos (by photo id) so they can be
// reviewed before the site hotlinks them from images.unsplash.com (Unsplash License:
// free to use, no permission needed). Unsplash's search needs an API key and its
// pages refuse automated requests, so candidates are listed here by id.
// Run by .github/workflows/fetch-photos.yml → the separate `photo-candidates` branch.
import {mkdir,writeFile} from 'node:fs/promises';

const OUT=process.argv[2]||'photo-candidates';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IDS=[
 // already used in the marketplace catalogue
 '1464349095431-e9a21285b5f3','1465495976277-4387d4b0b4c6','1478146896981-b80fe463b330','1488477181946-6428a0291777',
 '1511192336575-5a79af67a629','1511795409834-ef04bbd61622','1516280440614-37939bbacd81','1519225421980-715cb0215aed',
 '1519741497674-611481863552','1520523839897-bd0b52f945a0','1523438885200-e635ba2c371e','1527529482837-4698179dc6ce',
 '1540575467063-178a50c2df87','1561181286-d3fee7d55364',
 // new candidates: couples, hotels, ballrooms, gardens, chapels, tables
 '1511285560929-80b456fea0bc','1606216794074-735e91aa2c92','1522673607200-164d1b6ce486','1469371670807-013ccf25f16a',
 '1464366400600-7168b8af9bc3','1542314831-068cd1dbfeeb','1566073771259-6a8506099945','1551882547-ff40c63fe5fa',
 '1520250497591-112f2f40a3f4','1564501049412-61c2a3083791','1445019980597-93fa8acb246c','1519167758481-83f550bb49b3',
 '1505236858219-8359eb29e329','1460978812857-470ed1c77af0','1507504031003-b417219a0fde','1438032005730-c779502df39b',
 '1544078751-58fee2d8a03b','1515934751635-c81c6bc9a2d8','1525258946800-98cfd641d0de','1532712938310-34cb3982ef74',
 '1546032996-6dfacbacbf3f','1583939003579-730e3918a45a','1591604466107-ec97de577aff','1525772764200-be829a350797',
 '1537633552985-df8429e8048b','1550005809-91ad75fb315f','1529636798458-92182e662485','1470225620780-dba8ba36b745',
 '1517457373958-b7bdd4587205','1498837167922-ddd27525d352','1530103862676-de8c9debad1d','1561912774-79769a0a0a7a',
 '1549294413-26f195200c16','1584132967334-10e028bd69f7','1596436889106-be35e843f974','1621621667797-e06afc217fb0',
];
await mkdir(OUT,{recursive:true});
const ok=[];
for(const id of IDS){
 try{const r=await fetch(`https://images.unsplash.com/photo-${id}?w=640&q=70&fm=jpg&fit=max`,{headers:{'user-agent':UA}});
  if(!r.ok){console.log('HTTP',r.status,id);continue}
  await writeFile(`${OUT}/${id}.jpg`,Buffer.from(await r.arrayBuffer()));ok.push(id);
 }catch(e){console.log('error',id,e.message)}
 await new Promise(r=>setTimeout(r,300));
}
await writeFile(`${OUT}/CANDIDATES.md`,`# Unsplash previews (${ok.length})\n\n${ok.map(id=>`- https://images.unsplash.com/photo-${id}`).join('\n')}\n`);
console.log('saved',ok.length,'of',IDS.length);
