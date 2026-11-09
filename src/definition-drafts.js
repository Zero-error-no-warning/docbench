/* Definition changes are staged separately from published workspaces and input data. */
(function(root){
'use strict';const D=root.DocBench,copy=value=>value===undefined?undefined:D.clone(value),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function mergeDefinitionDraft(base,draft,current){
 const conflicts=[];
 function merge(a,b,c,path){
  if(equal(a,b))return copy(c);if(equal(a,c)||equal(b,c))return copy(b);
  if(a&&b&&c&&!Array.isArray(a)&&!Array.isArray(b)&&!Array.isArray(c)&&typeof a==='object'&&typeof b==='object'&&typeof c==='object'){
   const out={};for(const key of new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])){const value=merge(a[key],b[key],c[key],path.concat(key));if(value!==undefined)out[key]=value;}return out;
  }
  if([a,b,c].every(Array.isArray)){
   const id=item=>item&&typeof item==='object'&&(item.id||item._id),all=[...a,...b,...c];
   if(all.length&&all.every(id)&&[a,b,c].every(list=>new Set(list.map(id)).size===list.length)){
    const maps=[a,b,c].map(list=>new Map(list.map(item=>[id(item),item]))),ids=new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()]),values=new Map();
    for(const key of ids){const value=merge(...maps.map(map=>map.get(key)),path.concat('@'+key));if(value!==undefined)values.set(key,value);}
    const order=list=>list.map(id),baseOrder=order(a),draftOrder=order(b),currentOrder=order(c),draftMoved=!equal(baseOrder.filter(k=>maps[1].has(k)),draftOrder.filter(k=>maps[0].has(k))),currentMoved=!equal(baseOrder.filter(k=>maps[2].has(k)),currentOrder.filter(k=>maps[0].has(k)));
    if(draftMoved&&currentMoved&&!equal(draftOrder.filter(k=>maps[0].has(k)),currentOrder.filter(k=>maps[0].has(k))))conflicts.push(path.join('.')+'（順序）');
    const ordered=draftMoved?draftOrder:currentOrder;for(let i=0;i<draftOrder.length;i++){const key=draftOrder[i];if(ordered.includes(key)||!values.has(key))continue;const next=draftOrder.slice(i+1).find(k=>ordered.includes(k));ordered.splice(next?ordered.indexOf(next):ordered.length,0,key);}for(const key of values.keys())if(!ordered.includes(key))ordered.push(key);return ordered.filter(k=>values.has(k)).map(k=>values.get(k));
   }
  }
  conflicts.push(path.join('.')||'書類全体');return copy(b);
 }
 return {value:merge(base,draft,current,[]),conflicts};
}
// Trial values follow schema identity without writing into actual input data.
function rebasePreviewValues(before,after,values,actor){
 function fields(oldFields,newFields,oldValues){const out={};for(const f of newFields){const old=oldFields.find(x=>x.id===f.id),value=old&&oldValues?.[old.key];out[f.key]=field(old,f,value);}return out;}
 function field(old,f,value){
  if(!old||value===undefined||old.type!==f.type||old.itemType!==f.itemType||old.itemVariants!==f.itemVariants)return D.defaultValue(f,actor);
  if(f.type==='Object')return fields(old.fields||[],f.fields||[],value);
  if(['Array','Table'].includes(f.type)){
   if(!Array.isArray(value))return D.defaultValue(f,actor);
   if(!value.length&&old.initialRows!==f.initialRows)return D.defaultValue(f,actor);
   return value.map(row=>f.itemVariants&&(!D.arrayVariant(f,row)||!D.arrayVariant(old,row))?copy(row):({...Object.fromEntries(Object.entries(row).filter(([key])=>key.startsWith('_'))),...fields(D.rowFields(old,row),D.rowFields(f,row),row)}));
  }
  return copy(value);
 }
 return fields(before,after,values);
}
function createDefinitionDrafts(){
 let documentId=null,sessions={},active=null,published=null,failed=false;const prefix='docbench:definitionDrafts:';
 function persist(){if(!documentId)return;try{localStorage.setItem(prefix+documentId,JSON.stringify({version:2,sessions}));failed=false;}catch{failed=true;}}
 // Version 1 advanced the session base without updating history. Its original
 // ancestors cannot be recovered safely; retain the draft, discard only history.
 function selectDocument(id){if(documentId===id)return;documentId=id;active=null;published=null;sessions={};try{const saved=JSON.parse(localStorage.getItem(prefix+id)||'null');if([1,2].includes(saved?.version)&&saved.sessions&&typeof saved.sessions==='object'){sessions=saved.sessions;if(saved.version===1)for(const session of Object.values(sessions)){session.undo=[];session.redo=[];}}}catch{failed=true;}}
 function capture(value){if(!active)return;const session=sessions[active];session.value=copy(value);persist();}
 function enter(key,current){selectDocument(current.definition.id);published=copy(current);active=key;if(!key)return current;let session=sessions[key];if(!session||session.base?.definition?.id!==documentId||session.value?.definition?.id!==documentId){session=sessions[key]={base:copy(published),value:copy(published),undo:[],redo:[]};}
  const next=mergeDefinitionDraft(session.base,session.value,published);session.conflicts=next.conflicts;if(!next.conflicts.length){session.base=copy(published);session.value=next.value;}return copy(session.value);
 }
 // Each history value keeps its own merge ancestor. Advancing the live draft's
 // base on re-entry must never turn old input in Undo/Redo into a new edit.
 function record(session,value){return {base:copy(session.base),value:copy(value)};}
 function change(before,value){if(!active)return;const s=sessions[active];s.undo||=[];s.redo=[];if(!equal(before,value)){s.undo.push(record(s,before));if(s.undo.length>30)s.undo.shift();}capture(value);}
 function history(direction,value){if(!active)return null;const s=sessions[active],source=s[direction]||=[],other=direction==='undo'?'redo':'undo';if(!source.length)return null;(s[other]||=[]).push(record(s,value));const entry=source.pop(),next=mergeDefinitionDraft(entry.base,entry.value,published);s.conflicts=next.conflicts;s.base=copy(next.conflicts.length?entry.base:published);s.value=copy(next.conflicts.length?entry.value:next.value);persist();return copy(s.value);}
 function status(){const s=sessions[active];return {key:active,dirty:!!s&&!equal(s.base,s.value),conflicts:s?.conflicts||[],canUndo:!!s?.undo?.length,canRedo:!!s?.redo?.length,storageFailed:failed};}
 function clear(key=active){if(key)delete sessions[key];if(active===key)active=null;persist();}
 function reset(id){if(id){try{localStorage.removeItem(prefix+id);}catch{}}if(!id||id===documentId){sessions={};active=null;persist();}}
 return {enter,capture,change,status,history,clear,reset,active:()=>active,save:persist,result:published=>{const s=sessions[active];return s?mergeDefinitionDraft(s.base,s.value,published):{value:published,conflicts:[]};}};
}
Object.assign(D,{mergeDefinitionDraft,rebasePreviewValues,createDefinitionDrafts});
})(globalThis);
