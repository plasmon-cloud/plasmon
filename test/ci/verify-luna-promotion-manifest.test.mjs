import { EXACT_305_WARNING, HISTORICAL_LUNA_RESTORATIONS, REQUIRED_TOTAL, verifyManifest } from './verify-luna-promotion-manifest.mjs';
function assert(ok,message){if(!ok)throw new Error(message)}
function entry(i,classification='EQUIVALENT'){
  const e={id:`luna-a-selftest-${String(i).padStart(3,'0')}`,lunaLane:'A',sourceIssue:1,sourceArtifact:'selftest',sourceKind:'executable',d42:false,classification,evidencePath:'evidence.test.ts',requiredCiLane:null,ownerIssue:null,restorationIssue:null,replacement:null,rationale:null,lastCertifiedReleaseSha:'1'.repeat(40),activeTestQuarantine:null,healthAllowRule:null};
  if(classification==='PENDING'){e.evidencePath=null;e.ownerIssue=10} if(classification==='QUARANTINED'){e.sourceKind='browser-contract';e.evidencePath=null;e.restorationIssue=20;e.rationale='q'} if(classification==='FUTURE'){e.evidencePath=null;e.ownerIssue=30;e.rationale='future'} if(classification==='SUPERSEDED'){e.evidencePath=null;e.sourceKind='removed-test';e.replacement='replacement';e.rationale='superseded'} return e;
}
function fixture(){
  const entries=Array.from({length:REQUIRED_TOTAL},(_,i)=>entry(i+1)); const h=entries[0]; h.sourceIssue=305;h.classification='PERMANENT';h.healthAllowRule=true;h.activeTestQuarantine=false;h.healthAllow={kind:'console.warn',message:EXACT_305_WARNING,unknownDiagnosticsFatal:true};
  HISTORICAL_LUNA_RESTORATIONS.forEach((issue,i)=>{const e=entries[i+1];e.sourceKind='browser-contract';e.classification='PACKAGED';e.evidencePath='test/e2e/plasmon-refactor-smoke.spec.ts';e.requiredCiLane='smoke';e.restorationIssue=issue});
  return {schema:'plasmon-luna-promotion-manifest-v1',target:'release/0.1.0-r2',expectedTotal:REQUIRED_TOTAL,certification:{inputRef:'release/0.1.0-r2',releaseSha:'1'.repeat(40)},stableIdMigrations:[],entries};
}
const baseOptions={expectedReleaseSha:'1'.repeat(40),pathExists:async()=>true,browserReachability:{get:()=> 'smoke'},issueState:async(issue)=>HISTORICAL_LUNA_RESTORATIONS.includes(issue)?'closed':'open'};
async function fails(label,mutate,expected,options={}){const m=fixture();mutate(m);try{await verifyManifest(m,{...baseOptions,...options})}catch(error){const msg=String(error.message??error);assert(msg.includes(expected),`${label}: expected ${expected}, got ${msg}`);return}throw new Error(`${label}: invalid fixture unexpectedly passed`)}
await verifyManifest(fixture(),baseOptions);
await fails('pending owner',m=>{const e=m.entries[20];e.classification='PENDING';e.evidencePath=null;e.ownerIssue=null},'PENDING entry requires canonical ownerIssue');
await fails('closed pending',m=>{const e=m.entries[20];e.classification='PENDING';e.evidencePath=null;e.ownerIssue=999},'is not open',{issueState:async(issue)=>issue===999?'closed':(HISTORICAL_LUNA_RESTORATIONS.includes(issue)?'closed':'open')});
await fails('quarantine owner',m=>{const e=m.entries[1];e.classification='QUARANTINED';e.evidencePath=null;e.requiredCiLane=null;e.restorationIssue=null;e.rationale='q'},'QUARANTINED entry requires restorationIssue');
await fails('terminal evidence',m=>{m.entries[20].evidencePath='missing.test.ts'},'terminal evidence disappeared',{pathExists:async(path)=>path!=='missing.test.ts'});
await fails('packaged reachability',m=>{const e=m.entries[20];e.classification='PACKAGED';e.sourceKind='browser-contract';e.evidencePath='other.spec.ts';e.requiredCiLane='smoke'},'not reachable',{browserReachability:{get:()=>undefined}});
await fails('duplicate id',m=>{m.entries[1].id=m.entries[0].id},'duplicate stable gate id');
await fails('silent disappearance',m=>{m.entries.pop()},`manifest must contain exactly ${REQUIRED_TOTAL}`);
await fails('supersession rationale',m=>{const e=m.entries[20];e.classification='SUPERSEDED';e.evidencePath=null;e.sourceKind='removed-test';e.replacement='x';e.rationale=null},'requires concrete rationale');
await fails('entry SHA',m=>{m.entries[20].lastCertifiedReleaseSha='2'.repeat(40)},'certified SHA disagrees');
await fails('target SHA',m=>{m.certification.releaseSha='2'.repeat(40);for(const e of m.entries)e.lastCertifiedReleaseSha='2'.repeat(40)},'does not match');
await fails('stable registry',m=>{},'absent from stable ID registry',{expectedStableIds:new Set([...fixture().entries.slice(1).map(e=>e.id),'luna-a-missing-old-id'])});
console.log('Luna promotion manifest verifier self-tests passed');
