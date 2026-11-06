/* Keep native editing and focus traversal intact when a view must be rebuilt. */
(function(root){
'use strict';const D=root.DocBench;
function createInteractionContinuity(host){
 let rowAction=false,pointer=false,tabbing=false,composing=false,nativePicker=null,timer=null,drafts=new WeakMap();const pending=new Map(),editingKeys=new Set();
 const context=()=>JSON.stringify([host.dataset.screen,host.dataset.definitionId,host.dataset.format]);
 function prepareRows(){
  for(const el of host.querySelectorAll('[data-input],[data-row],[data-table-path],[data-collection-path]')){
   const row=el.parentElement?.closest('[data-row-id]'),keys=['input','path','tablePath','collectionPath'];
   if(!row)continue;const values=keys.filter(k=>el.dataset[k]!==undefined).map(k=>[k,el.dataset[k].startsWith(row.dataset.rowPath+'.')?el.dataset[k].slice(row.dataset.rowPath.length):el.dataset[k]]);
   el.dataset.continuityKey=JSON.stringify([row.dataset.rowId,el.tagName,values,el.dataset.row,el.dataset.choice,el.dataset.treeLevel]);
  }
 }
 function selector(el){
  if(el===host)return ':scope';if(!el||!host.contains(el))return null;
  if(el.id)return '#'+CSS.escape(el.id);if(el.dataset.continuityKey)return '[data-continuity-key="'+CSS.escape(el.dataset.continuityKey)+'"]';
  const keys=['input','prop','property','block','typeProp','typeLabel','typeNumber','treeLevel','choice','row','path','index','ruleSelect','designKey','designScope','tablePath','collectionPath','typeScroll','definitionScroll'];
  const attrs=keys.filter(k=>el.dataset[k]!==undefined).map(k=>'[data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+CSS.escape(el.dataset[k])+'"]');
  const own=el.tagName.toLowerCase()+attrs.join('');if(attrs.length&&host.querySelectorAll(own).length===1)return own;
  const parent=el.parentElement;if(!parent)return null;const peers=[...parent.children].filter(n=>n.tagName===el.tagName),part=own+':nth-of-type('+(peers.indexOf(el)+1)+')';return parent===host?part:selector(parent)+' > '+part;
 }
 function owners(el){return ['.builder','.type-builder','#rule-inspector','[data-block-id]'].flatMap(q=>{const n=el.closest(q);if(!n)return [];const keys=['definitionId','definitionField','definition','type','field','ruleSelection','blockId'];return [{q,values:Object.fromEntries(keys.filter(k=>n.dataset[k]!==undefined).map(k=>[k,n.dataset[k]]))}];});}
 function captureFocus(){
  prepareRows();const el=document.activeElement;if(!host.contains(el)||!el.matches('input,textarea,select,button,summary,[contenteditable=true]')||el.closest('.ProseMirror,.jss_container'))return null;
  const saved={selector:selector(el),owners:owners(el),context:context(),start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft,draft:drafts.has(el)?{value:el.value,checked:['checkbox','radio'].includes(el.type)?el.checked:undefined,html:el.isContentEditable?el.innerHTML:undefined}:null};
  saved.rows=[];for(let row=el.closest('[data-row-id]');row;row=row.parentElement?.closest('[data-row-id]')){const collection=row.closest('[data-collection-path]');if(collection)saved.rows.push({id:row.dataset.rowId,index:Number(row.dataset.rowPath.split('.').at(-1)),collection:selector(collection),path:el.dataset.input?.slice(row.dataset.rowPath.length),choice:el.dataset.choice,treeLevel:el.dataset.treeLevel});}
  if(el.isContentEditable){const range=getSelection()?.rangeCount?getSelection().getRangeAt(0):null;if(range&&el.contains(range.commonAncestorContainer)){const before=document.createRange();before.selectNodeContents(el);before.setEnd(range.startContainer,range.startOffset);saved.editable={start:before.toString().length,length:range.toString().length};}}
  return saved;
 }
 function restoreFocus(saved){
  if(!saved||saved.context!==context())return;prepareRows();let el=host.querySelector(saved.selector),deleted=false;
  for(const savedRow of saved.rows||[]){
   if(el)break;if(host.querySelector('[data-row-id="'+CSS.escape(savedRow.id)+'"]'))continue;
   const collection=host.querySelector(savedRow.collection);if(!collection)continue;
   const rows=[...collection.querySelectorAll('[data-row-id]')].filter(r=>r.closest('[data-collection-path]')===collection),row=rows[Math.min(savedRow.index,rows.length-1)];
   el=row?([...row.querySelectorAll('[data-input]')].find(n=>n.dataset.input===row.dataset.rowPath+savedRow.path&&n.dataset.choice===savedRow.choice&&n.dataset.treeLevel===savedRow.treeLevel)||row.querySelector('[data-input]:not(:disabled)')):collection.querySelector('[data-row=add]:not(:disabled)');deleted=true;
  }
  if(!el||el.disabled||!el.checkVisibility()||saved.owners.some(o=>{const n=el.closest(o.q);return !n||Object.entries(o.values).some(([k,v])=>n.dataset[k]!==v);}))return;
  if(saved.draft&&!deleted){if(el.isContentEditable)el.innerHTML=saved.draft.html;else if(el.type!=='file'){if(saved.draft.value!==undefined)el.value=saved.draft.value;if(saved.draft.checked!==undefined)el.checked=saved.draft.checked;}drafts.set(el,saved.draft);}
  el.focus({preventScroll:true});if(saved.start!=null&&el.selectionStart!=null)el.setSelectionRange(saved.start,saved.end,saved.direction||'none');
  if(saved.editable&&el.isContentEditable){const texts=[],walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode())texts.push(n);const point=offset=>{for(const node of texts){if(offset<=node.length)return [node,offset];offset-=node.length;}return texts.length?[texts.at(-1),texts.at(-1).length]:[el,0];},range=document.createRange();range.setStart(...point(saved.editable.start));range.setEnd(...point(saved.editable.start+saved.editable.length));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
  el.scrollTop=saved.scrollTop;el.scrollLeft=saved.scrollLeft;
 }
 function capture(){return {context:context(),focus:captureFocus(),x:window.scrollX,y:window.scrollY,scroll:[...host.querySelectorAll('.panel-body,.field-tree,.form-preview,.table-scroll,.paper-frame,#document-preview,[data-definition-scroll],[data-type-scroll],textarea')].filter(el=>el.scrollTop||el.scrollLeft).map(el=>({selector:selector(el),top:el.scrollTop,left:el.scrollLeft}))};}
 function restore(saved){if(!saved||saved.context!==context())return;restoreFocus(saved.focus);for(const s of saved.scroll){const el=host.querySelector(s.selector);if(el){el.scrollTop=s.top;el.scrollLeft=s.left;}}window.scrollTo(saved.x,saved.y);}
 function blocked(){return rowAction||pointer||tabbing||composing||editingKeys.size>0||!!nativePicker||!!document.querySelector('.field-picker-dialog[open]');}
 function flush(){timer=null;if(blocked())return;const jobs=pending.has('render')?[pending.get('render')]:[...pending.values()];pending.clear();for(const job of jobs)job();}
 function soon(){if(timer!==null)clearTimeout(timer);timer=setTimeout(flush,0);}
 document.addEventListener('pointerdown',event=>{pointer=true;nativePicker=event.target.matches('select,input[type=color],input[type=date],input[type=datetime-local],input[type=file]')?event.target:null;},true);for(const name of ['pointerup','pointercancel'])document.addEventListener(name,()=>{pointer=false;soon();},true);
 window.addEventListener('blur',()=>{pointer=false;tabbing=false;editingKeys.clear();soon();});
 document.addEventListener('keydown',event=>{if(event.key!=='Tab'&&event.composedPath().some(el=>el instanceof Element&&el.matches('input,textarea,select,[contenteditable=true]')))editingKeys.add(event.code||event.key);if(event.key==='Tab'){pointer=false;nativePicker=null;tabbing=true;setTimeout(()=>{tabbing=false;soon();},0);}},true);
 document.addEventListener('keyup',event=>{if(editingKeys.delete(event.code||event.key))soon();if(['Escape','Enter'].includes(event.key)){nativePicker=null;pointer=false;soon();}},true);
 document.addEventListener('compositionstart',()=>{composing=true;},true);document.addEventListener('compositionend',()=>{composing=false;soon();},true);
 document.addEventListener('close',soon,true);document.addEventListener('cancel',()=>{nativePicker=null;pointer=false;soon();},true);
 document.addEventListener('input',event=>{const el=event.target;if(host.contains(el)&&el.matches('input,textarea,select,[contenteditable=true]')&&!el.closest('.ProseMirror,.jss_container'))drafts.set(el,{value:el.value,checked:['checkbox','radio'].includes(el.type)?el.checked:undefined,html:el.isContentEditable?el.innerHTML:undefined});},true);
 document.addEventListener('change',event=>{drafts.delete(event.target);if(nativePicker===event.target){nativePicker=null;pointer=false;soon();}},true);document.addEventListener('blur',event=>{drafts.delete(event.target);if(nativePicker===event.target){nativePicker=null;soon();}},true);
 function bindRowAction(button,job){
  button.onmousedown=event=>{const el=document.activeElement;if(event.button===0&&host.contains(el)&&el.matches('input:not([type=file]),textarea,select,[contenteditable=true]'))event.preventDefault();};
  button.onclick=()=>{rowAction=true;try{const el=document.activeElement;if(drafts.has(el)&&el.matches('input:not([type=file]),textarea,select,[contenteditable=true]'))el.dispatchEvent(new Event('change',{bubbles:true}));job();}finally{rowAction=false;soon();}};
 }
 return {capture,restore,captureFocus,restoreFocus,bindRowAction,resetDrafts(){drafts=new WeakMap();},defer(key,job){if(blocked()){pending.set(key,job);return true;}pending.delete(key);return false;}};
}
Object.assign(D,{createInteractionContinuity});
})(globalThis);
