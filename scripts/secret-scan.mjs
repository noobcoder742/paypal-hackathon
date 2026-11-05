#!/usr/bin/env node
// Fails (exit 1) if any tracked file contains something shaped like a secret.
// Usage: node scripts/secret-scan.mjs
import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const PATTERNS=[
 ['anthropic key',/sk-ant-[A-Za-z0-9_-]{10,}/g],['google key',/AIza[0-9A-Za-z_-]{30,}/g],['github token',/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/g],
 ['aws key',/AKIA[0-9A-Z]{16}/g],['private key',/-----BEGIN [A-Z ]*PRIVATE KEY-----/g],['client secret',/client_secret["' :=]+[A-Za-z0-9._-]{16,}/gi],
 ['paypal secret',/\bE[A-Za-z0-9_-]{70,}\b/g],['upstash token',/\bA[A-Za-z0-9]{8,}[A-Za-z0-9_-]{40,}=?\b(?=.*UPSTASH)/g]
];
export function findSecrets(text){const out=[];for(const [pattern,re] of PATTERNS){re.lastIndex=0;let m;while((m=re.exec(text)))out.push({pattern,index:m.index})}return out}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const skip=/(^|\/)(package-lock\.json|public\/data\/|node_modules\/)|\.(png|jpe?g|webp|glb|bin|gz|pbf)$/;
 const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(f=>f&&!skip.test(f));let bad=0;
 for(const f of files){let t;try{t=readFileSync(f,'utf8')}catch{continue}for(const s of findSecrets(t)){bad++;console.error(`${f}: possible ${s.pattern} at offset ${s.index}`)}}
 if(bad){console.error(bad+' possible secret(s) found');process.exit(1)}console.log(`secret scan: ${files.length} files clean`);
}
