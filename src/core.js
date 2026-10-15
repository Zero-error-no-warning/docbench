/* DocBench core: browser-independent, stable identity and three-way merge. */
(function (root) {
'use strict';
const types = ['String','Text','RichText','Integer','Float','Boolean','Date','DateTime','Enum','MultiEnum','File','Image','Object','Array','Table'];
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const uid = () => 'id_'+(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeKey = k => /^[A-Za-z][A-Za-z0-9_]*$/.test(k) && !['constructor','prototype','__proto__'].includes(k);
const field = (key,label,type='String',extra={}) => ({id:uid(),key,label,type,section:'基本情報',group:'',description:'',required:false,...extra});
function defaultValue(f,actor='作成者') {
 if(f.type==='Object') return Object.fromEntries((f.fields||[]).map(c=>[c.key,defaultValue(c,actor)]));
 if(['Array','Table'].includes(f.type)) return Array.from({length:f.initialRows||0},()=>newRow(f,actor));
 if(f.type==='Boolean') return false;
 if(f.type==='MultiEnum') return [];
 if(['File','Image'].includes(f.type)) return null;
 return f.default ?? '';
}
function newRow(f,actor,source) {
 const row = {_id:uid(),_meta:{origin:source?source._id:null,createdBy:actor,createdAt:now(),modifiedBy:actor,modifiedAt:now()}};
 if(f.type==='Array' && f.itemType !== 'Object') row.value = defaultValue({type:f.itemType || 'String'},actor);
 else (f.fields||[]).forEach(c=>{row[c.key] = defaultValue(c,actor);});
 if(source) Object.keys(source).filter(k=>!k.startsWith('_')).forEach(k=>{row[k]=clone(source[k]);});
 // Nested collection clones also receive fresh identity.
 function reidentify(v) {if(!v||typeof v!=='object') return; if(v._id){const old=v._id;v._id=uid();v._meta={origin:old,createdBy:actor,createdAt:now(),modifiedBy:actor,modifiedAt:now()};} Object.values(v).forEach(reidentify);}
 if(source) Object.keys(row).filter(k=>!k.startsWith('_')).forEach(k=>reidentify(row[k]));
 return row;
}
// Output documents share Definition and DocumentData, but own their designs.
function renderDocument(render,id=render.defaultDocumentId){
 if(!Object.hasOwn(render,'documents'))return render; // Legacy callers/files.
 const document=render.documents.find(d=>d.id===id);
 if(!document)throw Error('出力書類が見つかりません');
 return document;
}
function outputDocuments(render){return Object.hasOwn(render,'documents')?render.documents:[render];}
function outputDesigns(render){return outputDocuments(render).flatMap(d=>[d,...Object.values(d.designs||{})]);}
function createOutputDocument(title='新しい書類',outputFormat='docx'){
 return {id:uid(),title,outputFormat,blocks:[],template:'',useTemplate:false,designs:{}};
}
function duplicateOutputDocument(document){
 const copy=clone(document);
 function reidentify(value){if(!value||typeof value!=='object')return;if(Object.hasOwn(value,'id'))value.id=uid();Object.values(value).forEach(reidentify);}
 reidentify(copy);copy.title+='（コピー）';return copy;
}
function normalizeRender(render){
 if(!render||Object.hasOwn(render,'documents'))return render;
 // Deterministic across imports and history snapshots: migration must not create changes.
 const document={id:render.id+'_document',title:render.title||'書類',outputFormat:render.outputFormat||'html'};
 for(const key of ['blocks','template','useTemplate','css','settings','designs','cellStyles','cellValues','cellMerges','columnWidths','rowHeights'])if(Object.hasOwn(render,key)){document[key]=render[key];delete render[key];}
 delete render.outputFormat;
 render.documents=[document];render.defaultDocumentId=document.id;return render;
}
function normalizeOutputModels(value){
 if(value.kind==='Workspace'){normalizeRender(value.render);for(const node of value.history||[])normalizeRender(node.state?.render);}
 if(value.kind==='RenderDefinition'){normalizeRender(value);for(const node of value.history?.nodes||[])normalizeRender(node.state);}
 return value;
}
function sample() {
 const definition={kind:'Definition',formatVersion:1,id:uid(),title:'事業実施報告書',description:'事業の概要・成果と支出内訳を入力してください。',fields:[
 field('projectName','事業名','String',{required:true,maxLength:100}),
 field('department','担当部署','String',{required:true}),
 field('budget','予算額','Integer',{required:true,min:0,description:'円単位で入力'}),
 field('reportDate','報告日','Date',{required:true}),
 field('status','実施状況','Enum',{options:['計画中','実施中','完了'],required:true}),
 field('summary','成果概要','Text',{section:'成果',required:true,maxLength:4000}),
 field('expenses','支出内訳','Table',{section:'支出',minItems:1,maxItems:30,initialRows:1,rowLabel:'支出',allowAdd:true,allowDelete:true,allowDuplicate:true,allowReorder:true,businessKey:'category',uniqueBy:'category',sortBy:'',fields:[field('category','区分','String',{required:true}),field('amount','金額（円）','Integer',{min:0,required:true}),field('note','説明','Text')]}),
 field('attachment','参考資料','File',{section:'添付'})]};
 const render={kind:'RenderDefinition',formatVersion:1,id:uid(),definitionId:definition.id,title:'事業実施報告書',outputFormat:'html',blocks:[
 {id:uid(),type:'heading',text:'事業実施報告書'},
 ...['projectName','department','reportDate','status','budget'].map(key=>({id:uid(),type:'field',field:key})),
 {id:uid(),type:'field',field:'summary',appendixAfter:600},
 {id:uid(),type:'table',field:'expenses',rowsPerPage:12},
 {id:uid(),type:'field',field:'attachment'}],template:'',useTemplate:false};
 const values=Object.fromEntries(definition.fields.map(f=>[f.key,defaultValue(f,'デモ作成者')]));
 Object.assign(values,{projectName:'窓口業務の改善事業',department:'総務課',budget:1200000,reportDate:new Date().toISOString().slice(0,10),status:'完了',summary:'申請書の入力項目を整理し、確認に必要な時間を短縮しました。\n職員からの意見を反映して、来年度も改善を継続します。'});
 Object.assign(values.expenses[0],{category:'備品',amount:350000,note:'窓口案内用の機器'});
 const data={kind:'DocumentData',formatVersion:1,id:uid(),definitionId:definition.id,values};
 const ws={kind:'Workspace',formatVersion:1,id:uid(),actor:'作成者',currentBranch:'main',branches:{main:null},history:[],definition,render,data};
 normalizeRender(render);snapshot(ws,'初期サンプル'); return ws;
}
function state(ws){return clone({definition:ws.definition,render:ws.render,data:ws.data});}
function snapshot(ws,message,parents) {
 const id=uid(); const n={id,parents:parents || (ws.branches[ws.currentBranch]?[ws.branches[ws.currentBranch]]:[]),author:ws.actor,createdAt:now(),message:message||'スナップショット',comments:[],state:state(ws)};
 ws.history.push(n);ws.branches[ws.currentBranch]=id;return n;
}
function checkout(ws,branch){const n=ws.history.find(n=>n.id===ws.branches[branch]); if(!n)throw Error('履歴が見つかりません'); Object.assign(ws,clone(n.state));ws.currentBranch=branch;}
function ancestor(ws,left,right) {
 const nodes = new Map(ws.history.map(n=>[n.id,n]));
 const walk=start=>{const m=new Map(),q=[[start,0]];while(q.length){const [id,d]=q.shift();if(!id||m.has(id))continue;m.set(id,d);for(const p of nodes.get(id)?.parents||[])q.push([p,d+1]);}return m;};
 const a=walk(left),b=walk(right);return [...a.keys()].filter(k=>b.has(k)).sort((x,y)=>(a.get(x)+b.get(x))-(a.get(y)+b.get(y)))[0];
}
// Array order is merged as pairwise ordering constraints. Stable IDs are never array offsets.
function mergeOrder(base,left,right,ids,path,conflicts,choices) {
 const alive=new Set(ids), lists=[base,left,right].map(a=>a.filter(id=>alive.has(id)));
 // LCS identifies an element move independently of shifts caused by other IDs.
 function moved(before,after){const common=new Set(before.filter(x=>after.includes(x))),a=before.filter(x=>common.has(x)),b=after.filter(x=>common.has(x));const dp=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);const fixed=new Set();let i=0,j=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){fixed.add(a[i]);i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}return new Set(a.filter(x=>!fixed.has(x)));}
 const lm=moved(lists[0],lists[1]),rm=moved(lists[0],lists[2]);
 const stationary=new Set(lists[0].filter(x=>!lm.has(x)&&!rm.has(x)));
 const anchor=(list,id)=>{const i=list.indexOf(id);return [list.slice(0,i).filter(x=>stationary.has(x)).at(-1)||null,list.slice(i+1).find(x=>stationary.has(x))||null];};
 const divergent=[...lm].some(id=>rm.has(id)&&!equal(anchor(lists[1],id),anchor(lists[2],id)));
 if(divergent){const key=path+'/~order',choice=choices[key];if(!choice)conflicts.push({path:key,reason:'同じ要素の異なる移動先',base:lists[0],left:lists[1],right:lists[2]});const selected=choice?.mode==='right'?lists[2]:choice?.mode==='base'?lists[0]:choice?.mode==='custom'?choice.value:lists[1];const chosen=Array.isArray(selected)?selected:lists[1];return [...chosen.filter(id=>alive.has(id)),...ids.filter(id=>!chosen.includes(id))];}
 const positions=lists.map(a=>new Map(a.map((id,i)=>[id,i])));
 const edges=new Map(ids.map(id=>[id,new Set()]));
 const relation=(p,a,b)=>p.has(a)&&p.has(b)?(p.get(a)<p.get(b)?-1:1):null;
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const a=ids[i],b=ids[j], [br,lr,rr]=positions.map(p=>relation(p,a,b));let chosen;
  if(lr===rr)chosen=lr;else if(lr===br)chosen=rr;else if(rr===br)chosen=lr;else if(lr===null)chosen=rr;else if(rr===null)chosen=lr;
  else {chosen=lr;}
  if(chosen===-1)edges.get(a).add(b);if(chosen===1)edges.get(b).add(a);
 }
 const out=[],pending=new Set(ids);
 while(pending.size){const next=ids.find(id=>pending.has(id)&&![...pending].some(p=>edges.get(p).has(id)));if(next===undefined)break;out.push(next);pending.delete(next);}
 if(pending.size){const key=path+'/~order'; const choice=choices[key];if(!choice)conflicts.push({path:key,reason:'並び替えの競合',base:lists[0],left:lists[1],right:lists[2]});let chosen=choice?.mode==='right'?lists[2]:choice?.mode==='base'?lists[0]:choice?.mode==='custom'?choice.value:lists[1];if(!Array.isArray(chosen))chosen=lists[1];return [...chosen.filter(id=>alive.has(id)),...ids.filter(id=>!chosen.includes(id))];}
 return out;
}
function merge(base,left,right,choices={}) {
 const conflicts=[];
 function conflict(path,reason,b,l,r) {const choice=choices[path];if(choice){if(choice.mode==='right')return clone(r);if(choice.mode==='base')return clone(b);if(choice.mode==='delete')return undefined;if(choice.mode==='custom')return clone(choice.value);return clone(l);} conflicts.push({path,reason,base:clone(b),left:clone(l),right:clone(r)});return clone(l);}
 function visit(b,l,r,path) {
  if(equal(l,r))return clone(l);
  if(equal(l,b))return clone(r);if(equal(r,b))return clone(l);
  if(l===undefined||r===undefined)return conflict(path,'変更と削除の競合',b,l,r);
  if(Array.isArray(l)&&Array.isArray(r)){
   const all=[...(Array.isArray(b)?b:[]),...l,...r]; const idOf=x=>x && (x._id || x.id || (x.type&&x.attrs?.id));
   if(!all.length)return [];
   if(all.every(x=>typeof x==='object'&&idOf(x))){
    for(const a of [b||[],l,r])if(new Set(a.map(idOf)).size!==a.length)return conflict(path,'要素識別子重複',b,l,r);
    const bm=new Map((b||[]).map(x=>[idOf(x),x])),lm=new Map(l.map(x=>[idOf(x),x])),rm=new Map(r.map(x=>[idOf(x),x]));
    const ids=[...new Set([...bm.keys(),...lm.keys(),...rm.keys()])],values=new Map();
    for(const id of ids){let v;if(!bm.has(id)&&lm.has(id)&&rm.has(id)&&!equal(lm.get(id),rm.get(id)))v=conflict(path+'/'+id,'独立した追加で要素識別子が重複',undefined,lm.get(id),rm.get(id));else v=visit(bm.get(id),lm.get(id),rm.get(id),path+'/'+id);if(v!==undefined)values.set(id,v);}
    return mergeOrder([...bm.keys()],[...lm.keys()],[...rm.keys()],[...values.keys()],path,conflicts,choices).map(id=>values.get(id));
   }return conflict(path,'同じ配列への異なる変更',b,l,r);
  }
  if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
   const result={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){
    if(['__proto__','constructor','prototype'].includes(key))continue;
    // Audit metadata is regenerated on commit; creation metadata must agree.
    if(key==='modifiedAt'||key==='modifiedBy'){result[key]=clone(r[key]??l[key]);continue;}
    const v=visit(b?.[key],l[key],r[key],path+'/'+key);if(v!==undefined)result[key]=v;
   }return result;
  }return conflict(path,'同一項目への異なる変更',b,l,r);
 }
 return {value:visit(base,left,right,''),conflicts};
}
function diff(a,b,path='') {
 if(equal(a,b))return [];
 if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(x=>x&&(x._id||x.id||x.type&&x.attrs?.id))){const id=x=>x._id||x.id||(x.type&&x.attrs?.id);const am=new Map(a.map(x=>[id(x),x])),bm=new Map(b.map(x=>[id(x),x]));let d=[...new Set([...am.keys(),...bm.keys()])].flatMap(k=>diff(am.get(k),bm.get(k),path+'/'+k));if(!equal(a.map(id),b.map(id)))d.push({path:path+'/~order',before:a.map(id),after:b.map(id)});return d;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diff(a[k],b[k],path+'/'+k));
 return [{path,before:clone(a),after:clone(b)}];
}
function get(obj,path){return String(path||'').split('.').reduce((v,k)=>v&&Object.hasOwn(v,k)?v[k]:undefined,obj);}
function fieldAt(def,path){let fields=def.fields;let found;for(const k of String(path||'').split('.')){found=(fields||[]).find(f=>f.key===k);if(!found)return null;fields=found.fields;}return found;}
function allFields(def){const out=[];function visit(fs,p){for(const f of fs||[]){const path=p? p+'.'+f.key:f.key;out.push({field:f,path});visit(f.fields,path);}}visit(def.fields,'');return out;}
function validateDefinition(def,render) {
 const errors=[],warnings=[],ids=new Set(), seen=new WeakSet();
 const err=(path,message)=>errors.push({path,message});
 function walk(fs,path,depth=0){if(depth>16){err(path,'入れ子は16段階以内にしてください');return;}if(!Array.isArray(fs)){err(path,'fieldsは配列です');return;}const keys=new Set();for(const f of fs){if(!f||typeof f!=='object'){err(path,'項目の定義が不正です');continue;}if(seen.has(f)){err(path,'循環参照を検出しました');continue;}seen.add(f);const p=path?path+'.'+f.key:f.key;
  if(!f.id||ids.has(f.id))err(p,'項目IDが未指定または重複');ids.add(f.id);
  if(!safeKey(f.key)||keys.has(f.key))err(p,'項目キーは半角英字から始まる英数字・_で、同階層で一意にしてください');keys.add(f.key);
  if(!types.includes(f.type))err(p,'未対応の型');if(!f.label)err(p,'表示名がありません');
  for(const k of ['min','max','minLength','maxLength','minItems','maxItems','initialRows','minSelections','maxSelections'])if(f[k]!==undefined&&(typeof f[k]!=='number'||!Number.isFinite(f[k])||!['min','max'].includes(k)&&(!Number.isInteger(f[k])||f[k]<0)))err(p,k+'の数値が不正です');
  if(f.initialRows>1000)err(p,'初期行数の上限は1000です');
  for(const [lo,hi] of [['min','max'],['minLength','maxLength'],['minItems','maxItems'],['minDate','maxDate'],['minSelections','maxSelections']])if(f[lo]!==undefined&&f[lo]!==''&&f[hi]!==undefined&&f[hi]!==''&&f[lo]>f[hi])err(p,lo+'が'+hi+'を上回っています');
  if(['Enum','MultiEnum'].includes(f.type)&&(!Array.isArray(f.options)||!f.options.length||new Set(f.options).size!==f.options.length))err(p,'選択肢は1件以上・重複なしで定義してください');
  if(f.requiredWhen&&!fieldAt(def,f.requiredWhen.field))err(p,'条件付き必須の参照項目がありません');
  if(['Object','Table'].includes(f.type)||(f.type==='Array'&&f.itemType==='Object'))walk(f.fields,p,depth+1);
  if(f.type==='Array'&&(!types.includes(f.itemType)||['Object','Array','Table'].includes(f.itemType)&&f.itemType!=='Object'))err(p,'Array要素型は単純型またはObjectです');
  if(['Array','Table'].includes(f.type)){for(const name of ['businessKey','uniqueBy','sortBy'])if(f[name]&&f[name]!=='value'&&!(f.fields||[]).some(c=>c.key===f[name]))err(p,name+'に未定義の列が指定されています');if((f.initialRows||0)<(f.minItems||0)||(f.maxItems!==undefined&&(f.initialRows||0)>f.maxItems))err(p,'初期行数が最小・最大要素数の範囲外です');}
 }}walk(def.fields,'');
 const used=new Set();
 function checkRender(r,prefix){
  const report=(path,message)=>err(prefix+'.'+path,message);
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(r.designs!==undefined&&!object(r.designs)){report('designs','形式別デザインはオブジェクトです');return;}
  for(const [key,design] of [['',r],...Object.entries(r.designs||{})]){
   if(!object(design)){report('designs.'+key,'デザインはオブジェクトです');return;}
   if(design.blocks!==undefined&&(!Array.isArray(design.blocks)||design.blocks.some(b=>!object(b)))){report((key?'designs.'+key+'.':'')+'blocks','出力ブロックはオブジェクトの配列です');return;}
  }
  if(root.DocBench.validateRender)errors.push(...root.DocBench.validateRender(r).map(x=>({...x,path:prefix+'.'+x.path.replace(/^render\./,'')})));
  const activeFormat=r.outputFormat||'html';
  const designs=r.designs||{};
  for(const [format,design] of Object.entries(designs))checkDesign({...design,outputFormat:format},prefix+'.designs.'+format);
  if(!designs[activeFormat])checkDesign(r,prefix);
  // The seed blocks/template remain relevant when creating another format.
  if(r.designs&&r.blocks)checkDesign({...r,designs:undefined},prefix+'.seed');
  function checkDesign(design,path){const bid=new Set(),issue=(p,m)=>report(path.slice(prefix.length+1)+(path===prefix?'':'.')+p,m);
   for(const b of design.blocks||[]){if(!b||typeof b!=='object'){issue('blocks','出力ブロックが不正です');continue;}
    if(!b.id||bid.has(b.id))issue('blocks','出力ブロックIDが未指定または重複');bid.add(b.id);
    if(b.type==='shape'&&(!['rect','ellipse','line'].includes(b.shape)||design.outputFormat!=='pptx'))issue(b.id,'図形はPowerPointのrect/ellipse/lineです');
    if(b.content){for(const msg of root.DocBench.validateRich?.(b.content)||[])issue(b.id,msg);for(const ref of root.DocBench.richReferences?.(b.content)||[]){used.add(ref);if(!fieldAt(def,ref))issue(b.id,'未定義項目参照: '+ref);}}
    if(!['heading','text','rich','field','table','shape','pagebreak'].includes(b.type))issue(b.id,'未対応ブロック');
    if(b.type==='table'&&b.field&&fieldAt(def,b.field)&&!['Table','Array'].includes(fieldAt(def,b.field).type))issue(b.id,'表の出力にはTableまたはArray項目を指定してください');
    if(b.field){used.add(b.field);if(!fieldAt(def,b.field))issue(b.id,'未定義項目参照: '+b.field);}
    if(b.when?.field){used.add(b.when.field);if(!fieldAt(def,b.when.field))issue(b.id,'条件の参照項目がありません');}
   }
   if(design.useTemplate){const t=String(design.template||'');for(const m of t.matchAll(/{{\s*([^{}]+?)\s*}}/g)){used.add(m[1]);if(!fieldAt(def,m[1]))issue('template','未定義項目参照: '+m[1]);}if(t.replace(/{{\s*[A-Za-z][\w.]*\s*}}/g,'').includes('{{')||t.replace(/{{\s*[A-Za-z][\w.]*\s*}}/g,'').includes('}}'))issue('template','無効なテンプレート構文');}
  }
 }
 if(render){
  if(Object.hasOwn(render,'documents')){
   if(!Array.isArray(render.documents)||!render.documents.length)err('render.documents','出力書類を1件以上定義してください');
   else {const documentIds=new Set();for(const document of render.documents){
    if(!document||typeof document!=='object'){err('render.documents','書類の定義が不正です');continue;}
    const path='render.documents.'+(document.id||'?');
    if(typeof document.id!=='string'||!document.id||documentIds.has(document.id))err(path,'書類IDが未指定または重複');documentIds.add(document.id);
    if(typeof document.title!=='string'||!document.title.trim())err(path+'.title','書類名を入力してください');
    if(!document.outputFormat)err(path+'.outputFormat','出力形式を指定してください');
    if(document.kind||document.documents)err(path,'書類内にRenderDefinitionを入れることはできません');
    checkRender(document,path);
   }if(!documentIds.has(render.defaultDocumentId))err('render.defaultDocumentId','既定の書類IDが見つかりません');}
  }else checkRender(render,'render');
  for(const f of def.fields||[])if(![...used].some(p=>p===f.key||p?.startsWith(f.key+'.')))warnings.push({path:f.key,message:'出力で使われていない項目'});
 }

 return {errors,warnings};
}
function validateData(def,values){const errors=[],globalIds=new Set();const err=(p,m)=>errors.push({path:p,message:m});
 function check(fs,obj,path){if(!obj||typeof obj!=='object'||Array.isArray(obj)){err(path,'Object型の値が必要です');return;}
 for(const f of fs||[]){const p=path?path+'.'+f.key:f.key,v=obj[f.key];const required=f.required || (f.requiredWhen&&equal(get(values,f.requiredWhen.field),f.requiredWhen.equals));
 const empty=v===null||v===undefined||v===''||Array.isArray(v)&&v.length===0||f.type==='RichText'&&typeof v==='string'&&!v.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim();
 if(required&&empty){err(p,'必須項目です');continue;}if(empty)continue;
 if(['String','Text','RichText','Enum','Date','DateTime'].includes(f.type)&&typeof v!=='string'){err(p,'文字列で入力してください');continue;}
 if(['String','Text','RichText'].includes(f.type)){const count=Array.from(v.replace(/<[^>]*>/g,'')).length;if(f.minLength!==undefined&&count<f.minLength)err(p,'文字数が不足しています');if(f.maxLength!==undefined&&count>f.maxLength)err(p,'文字数が上限を超えています');}
 if(['Integer','Float'].includes(f.type)){if(typeof v!=='number'||!Number.isFinite(v)||f.type==='Integer'&&!Number.isInteger(v))err(p,'数値型が一致しません');if(f.min!==undefined&&v<f.min)err(p,'最小値を下回っています');if(f.max!==undefined&&v>f.max)err(p,'最大値を上回っています');}
 if(f.type==='Boolean'&&typeof v!=='boolean')err(p,'真偽値で入力してください');
 if(['Date','DateTime'].includes(f.type)){const pattern=f.type==='Date'?/^\d{4}-\d{2}-\d{2}$/:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;if(!pattern.test(v)||!Number.isFinite(Date.parse(v))||f.type==='Date'&&new Date(v).toISOString().slice(0,10)!==v)err(p,'無効な日付です');if(f.minDate&&v<f.minDate)err(p,'日付が下限より前です');if(f.maxDate&&v>f.maxDate)err(p,'日付が上限より後です');}
 if(f.type==='Enum'&&!f.options?.includes(v))err(p,'選択肢にない値です');
 if(f.type==='MultiEnum'){if(!Array.isArray(v)||v.some(x=>!f.options?.includes(x))||new Set(v).size!==v.length)err(p,'複数選択の値が不正です');else{if(f.minSelections!==undefined&&v.length<f.minSelections)err(p,'選択数が不足しています');if(f.maxSelections!==undefined&&v.length>f.maxSelections)err(p,'選択数が上限を超えています');}}
 if(['File','Image'].includes(f.type)){if(!v||typeof v.name!=='string'||typeof v.content!=='string'||!/^data:[^,]*;base64,/.test(v.content))err(p,'添付情報が不正です');if(f.type==='Image'&&!/^data:image\/(png|jpeg|gif|webp);base64,/.test(v.content||''))err(p,'画像はPNG/JPEG/GIF/WebPを使用してください');}
 if(f.type==='Object')check(f.fields,v,p);
 if(['Array','Table'].includes(f.type)){
  if(!Array.isArray(v)){err(p,'配列で入力してください');continue;}
  if(v.length<(f.minItems||0))err(p,'最小要素数を下回っています');if(f.maxItems!==undefined&&v.length>f.maxItems)err(p,'最大要素数を超えています');const keys=new Set();
  v.forEach((r,i)=>{const rp=p+'['+(i+1)+']';if(!r||typeof r!=='object'){err(rp,'行データが不正です');return;}if(!r._id||globalIds.has(r._id))err(rp,'要素IDが未指定または重複');globalIds.add(r._id);
   if(f.uniqueBy){const k=JSON.stringify(r[f.uniqueBy]);if(keys.has(k))err(rp,'業務キーが重複しています: '+f.uniqueBy);keys.add(k);}
   if(f.type==='Array'&&f.itemType!=='Object')check([{...f,type:f.itemType,key:'value',required:false}],r,rp);else check(f.fields,r,rp);
  });
  if(f.sortBy)for(let i=1;i<v.length;i++){const a=v[i-1][f.sortBy],b=v[i][f.sortBy];if(f.sortDirection==='desc'?a<b:a>b)err(p,'並び順制約に違反しています: '+f.sortBy);}
 }
 }
 for(const k of Object.keys(obj))if(!k.startsWith('_')&&!(fs||[]).some(f=>f.key===k))err(path?path+'.'+k:k,'未定義の入力項目');
 }check(def.fields,values,'');return errors;
}
function envelope(ws,kind){if(kind==='Workspace')return clone(ws);const key=kind==='Definition'?'definition':kind==='RenderDefinition'?'render':'data';return {...clone(ws[key]),history:{currentBranch:ws.currentBranch,branches:clone(ws.branches),nodes:ws.history.map(n=>({...clone(n),state:clone(n.state[key])}))}};}
function assertImport(v){if(!v||typeof v!=='object'||v.formatVersion!==1||!['Workspace','Definition','RenderDefinition','DocumentData'].includes(v.kind))throw Error('DocBench形式v1のJSONを選んでください');const check=JSON.stringify(v);if(/"(?:__proto__|constructor|prototype)"\s*:/.test(check))throw Error('予約プロパティを含むJSONは読み込めません');if(check.length>80*1024*1024)throw Error('読み込み上限は80MBです');if(v.kind==='Workspace'){if(!v.definition||!v.render||!v.data||!Array.isArray(v.history)||!v.branches||!Object.hasOwn(v.branches,v.currentBranch))throw Error('Workspaceの必須構造がありません');const ids=new Set(v.history.map(n=>n.id));if(ids.size!==v.history.length||v.history.some(n=>!n.state||!Array.isArray(n.parents)||n.parents.some(p=>!ids.has(p)))||Object.values(v.branches).some(id=>!ids.has(id)))throw Error('履歴IDまたは親状態の参照が不正です');const active=new Set(),done=new Set(),map=new Map(v.history.map(n=>[n.id,n]));function walk(id){if(active.has(id))throw Error('履歴の循環参照を検出');if(done.has(id))return;active.add(id);for(const p of map.get(id).parents)walk(p);active.delete(id);done.add(id);}ids.forEach(walk);}return normalizeOutputModels(v);}
root.DocBench={types,clone,equal,uid,now,esc,safeKey,field,defaultValue,newRow,renderDocument,outputDocuments,outputDesigns,createOutputDocument,duplicateOutputDocument,normalizeRender,normalizeOutputModels,sample,state,snapshot,checkout,ancestor,merge,diff,get,fieldAt,allFields,validateDefinition,validateData,envelope,assertImport};
if(typeof module!=='undefined')module.exports=root.DocBench;
})(typeof globalThis!=='undefined'?globalThis:this);
