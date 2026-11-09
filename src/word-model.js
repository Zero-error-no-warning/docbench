/* Word control ranges stay editable; only output expands them into concrete content. */
(function(root){
'use strict';const D=root.DocBench;
function richFieldAt(def,path){if(typeof path!=='string')return null;const f=D.fieldAt(def,path);if(f)return f;if(path?.endsWith('.value')){const parent=D.fieldAt(def,path.slice(0,-6));if(parent?.type==='Array'&&parent.itemType!=='Object')return {key:'value',label:parent.label,type:parent.itemType};}return null;}
function wordFieldName(definition,path){
 if(typeof path!=='string'||!path)return '項目未指定';
 const names=[];
 let prefix='';
 for(const key of path.split('.')){
  prefix=prefix?prefix+'.'+key:key;
  names.push(richFieldAt(definition,prefix)?.label||key);
 }
 return names.join(' › ');
}
function richNodes(content){const nodes=[];function walk(n){if(!n||typeof n!=='object')return;nodes.push(n);for(const c of Array.isArray(n.content)?n.content:[])walk(c);}walk(content);return nodes;}
// Editor-only containers keep legacy block IDs and output rules. They never
// enter the saved rich-text schema or contain expanded input values.
function wordEditorDocument(blocks){
 const content=[],writing=new Set(['heading','text','rich']);
 const gap=anchor=>({type:'wordSection',attrs:{id:'word-gap-'+anchor,draft:true},content:[{type:'paragraph',attrs:{id:'word-gap-paragraph-'+anchor}}]});
 for(const block of blocks||[]){
  if(!writing.has(block.type)){if(!content.length||content.at(-1).type==='wordObject')content.push(gap('before-'+block.id));content.push({type:'wordObject',attrs:{id:block.id,source:D.clone(block)}});continue;}
  const source=D.clone(block);delete source.content;delete source.text;delete source.id;
  const body=D.wordNormalizeTabs(block.content||D.plainRich(block.text));let index=0;
  const identify=n=>{if(!['doc','text','hardBreak'].includes(n.type)){n.attrs=n.attrs||{};n.attrs.id||='word-node-'+block.id+'-'+index;index++;}for(const child of n.content||[])identify(child);};identify(body);
  if(!block.content&&block.type==='heading')for(const n of body.content){n.type='heading';n.attrs={...n.attrs,level:1};}
  content.push({type:'wordSection',attrs:{id:block.id,source},content:body.content});
 }
 if(!content.length||content.at(-1).type==='wordObject')content.push(gap(content.length?'after-'+content.at(-1).attrs.id:'empty'));
 return {type:'doc',content};
}
function wordEditorBlocks(document){
 const blocks=[];
 for(const node of document.content||[]){const a=node.attrs||{};
  if(node.type==='wordObject'){blocks.push({...D.clone(a.source),id:a.id});continue;}
  if(node.type!=='wordSection')continue;
  const content={type:'doc',content:D.clone(node.content||[])};
  if(a.draft&&content.content.length===1&&content.content[0].type==='paragraph'&&!content.content[0].content?.length)continue;
  blocks.push({...D.clone(a.source||{}),id:a.id,type:a.source?.type||'rich',content,text:D.richSourceText(content)});
 }
 return blocks;
}
function richReferences(content){const refs=new Set();for(const n of richNodes(content)){if(['fieldRef','repeatBlock'].includes(n.type)||n.type==='tableRow'&&n.attrs?.repeatGroup)refs.add(n.attrs?.field);if(n.type==='conditionBlock'&&n.attrs?.when?.field)refs.add(n.attrs.when.field);}return [...refs].filter(p=>typeof p==='string'&&p);}
function wordRowRepeatErrors(table){
 const errors=[],seen=new Set(),rows=Array.isArray(table?.content)?table.content:[];let previous=null;
 for(let i=0;i<rows.length;i++){
  const a=rows[i]?.attrs||{},group=a.repeatGroup||null;
  if(group){if(typeof group!=='string'||group.length>200||typeof a.field!=='string'||!a.field)errors.push('表の行のくり返し設定が不正です');if(group!==previous&&seen.has(group))errors.push('1件分の行は連続して指定してください');seen.add(group);if(group===previous&&a.field!==rows[i-1]?.attrs?.field)errors.push('1件分の行には同じ入力項目を指定してください');}
  else if(a.field)errors.push('表の行のくり返し設定が不正です');
  for(const cell of Array.isArray(rows[i]?.content)?rows[i].content:[]){const span=cell?.attrs?.rowspan||1;for(let j=i+1;j<Math.min(rows.length,i+span);j++)if((rows[j]?.attrs?.repeatGroup||null)!==group){errors.push('縦結合をまたぐ行は、結合全体を1件分に含めてください');break;}}
  previous=group;
 }
 return [...new Set(errors)];
}
function validateRichDefinition(content,def){const errors=[];
 function walk(n,scopes=[]){if(!n||typeof n!=='object')return;const a=n.attrs||{},field=typeof a.field==='string'?a.field:'';
  if(n.type==='table')errors.push(...wordRowRepeatErrors(n));
  if(n.type==='repeatBlock'||n.type==='tableRow'&&a.repeatGroup){const f=richFieldAt(def,a.field);if(!f||!['Array','Table'].includes(f.type))errors.push('繰り返しには配列・表の項目を指定してください');const parents=D.allFields(def).filter(x=>field.startsWith(x.path+'.')&&['Array','Table'].includes(x.field.type));if(parents.some(x=>!scopes.includes(x.path)))errors.push('入れ子の繰り返しは親の繰り返し範囲内に配置してください');if(scopes.includes(a.field))errors.push('同じ項目の繰り返しを自身の内側に配置できません');scopes=[...scopes,a.field];}
  if(n.type==='fieldRef'&&(a.part||'value')==='value'){const parents=D.allFields(def).filter(x=>field.startsWith(x.path+'.')&&['Array','Table'].includes(x.field.type));if(parents.some(x=>!scopes.includes(x.path)))errors.push('配列・表の子項目は対応する繰り返し範囲内へ挿入してください');}
  if(n.type==='conditionBlock'){const c=a.when;if(!c||typeof c!=='object'||Array.isArray(c)||!c.nodeId&&(!c.field||!Object.hasOwn(c,'equals')))errors.push('条件付き範囲には条件を設定してください');if(c?.field){const f=D.conditionFields(def).find(x=>x.path===c.field)?.field;if(!f)errors.push('条件の参照項目が不正です');else if(f.type==='TreeEnum'){if(D.treeValueError(f,c.equals,true))errors.push('条件の階層選択値が不正です');}else if(['Integer','Float'].includes(f.type)?!Number.isFinite(c.equals)||f.type==='Integer'&&!Number.isInteger(c.equals):f.type==='Boolean'?typeof c.equals!=='boolean':typeof c.equals!=='string')errors.push('条件の値の型が一致しません');}}
  for(const c of Array.isArray(n.content)?n.content:[])walk(c,scopes);
 }walk(content);return errors;
}
function expandRich(content,def,values,input=D.inputState(def,values)){
 const active=input.values();let count=0;
 const pathAt=(path,scopes)=>{for(let i=scopes.length-1;i>=0;i--){const s=scopes[i];if(path===s.field||path?.startsWith(s.field+'.'))return s.path+path.slice(s.field.length);}return path;};
 function expand(n,scopes=[],depth=0){if(++count>50000||depth>32)throw Error('繰り返しの展開が上限（50,000要素）を超えました');const a=n.attrs||{};
  if(n.type==='conditionBlock')return input.matches(a.when)?(n.content||[]).flatMap(c=>expand(c,scopes,depth+1)):[];
  if(n.type==='repeatBlock'){if(!input.visible(a.field))return [];const rows=D.get(active,pathAt(a.field,scopes));if(!Array.isArray(rows))return [];return rows.flatMap((row,i)=>{const path=pathAt(a.field,scopes)+'.'+i;return (n.content||[]).flatMap(c=>expand(c,[...scopes,{field:a.field,path}],depth+1));});}
  if(n.type==='table'){
   const errors=wordRowRepeatErrors(n);if(errors.length)throw Error(errors[0]);const rows=n.content||[],content=[];
   for(let i=0;i<rows.length;){const row=rows[i],group=row.attrs?.repeatGroup;if(!group){content.push(...expand(row,scopes,depth+1));i++;continue;}
    const field=row.attrs.field,template=[];while(i<rows.length&&rows[i].attrs?.repeatGroup===group)template.push(rows[i++]);const data=input.visible(field)?D.get(active,pathAt(field,scopes)):[];
    if(Array.isArray(data))for(let index=0;index<data.length;index++)for(const source of template){const attrs={...source.attrs};delete attrs.repeatGroup;delete attrs.field;content.push(...expand({...source,attrs},[...scopes,{field,path:pathAt(field,scopes)+'.'+index}],depth+1));}
   }
   return content.length?[{...n,attrs:{...a},content}]:[];
  }
  const copy={...n,...(n.attrs?{attrs:{...a}}:{})};if(n.type==='fieldRef'){copy.attrs={...a,valuePath:pathAt(a.field,scopes)};}
  if(n.content)copy.content=n.content.flatMap(c=>expand(c,scopes,depth+1));return [copy];
 }return expand(content)[0]||{type:'doc',content:[]};
}
function wordControlLabel(n,def){const a=n.attrs||{},type=typeof n.type==='string'?n.type:n.type?.name;if(type==='repeatBlock')return '繰り返し：'+(richFieldAt(def,a.field)?.label||a.field||'項目未指定')+' のデータ1件分';if(type==='conditionBlock'){const c=D.simpleCondition(def,a.when)||a.when;return '条件：'+(c?.field?(D.fieldAt(def,c.field)?.label||c.field)+' = '+String(Array.isArray(c.equals)?D.display(D.fieldAt(def,c.field),c.equals):c.equals):D.ruleGraph(def).nodes.find(x=>x.id===c?.nodeId)?.label||'条件を設定');}return '';}
Object.assign(D,{richFieldAt,wordFieldName,richNodes,richReferences,validateRichDefinition,expandRich,wordControlLabel,wordEditorDocument,wordEditorBlocks,wordRowRepeatErrors});
})(globalThis);
