/* Word control ranges stay editable; only output expands them into concrete content. */
(function(root){
'use strict';const D=root.DocBench;
function richFieldAt(def,path){if(typeof path!=='string')return null;const f=D.fieldAt(def,path);if(f)return f;if(path?.endsWith('.value')){const parent=D.fieldAt(def,path.slice(0,-6));if(parent?.type==='Array'&&parent.itemType!=='Object')return {key:'value',label:parent.label,type:parent.itemType};}return null;}
function richNodes(content){const nodes=[];function walk(n){if(!n||typeof n!=='object')return;nodes.push(n);for(const c of Array.isArray(n.content)?n.content:[])walk(c);}walk(content);return nodes;}
function richReferences(content){const refs=new Set();for(const n of richNodes(content)){if(['fieldRef','repeatBlock'].includes(n.type))refs.add(n.attrs?.field);if(n.type==='conditionBlock'&&n.attrs?.when?.field)refs.add(n.attrs.when.field);}return [...refs].filter(p=>typeof p==='string'&&p);}
function validateRichDefinition(content,def){const errors=[];
 function walk(n,scopes=[]){if(!n||typeof n!=='object')return;const a=n.attrs||{},field=typeof a.field==='string'?a.field:'';
  if(n.type==='repeatBlock'){const f=richFieldAt(def,a.field);if(!f||!['Array','Table'].includes(f.type))errors.push('繰り返しには配列・表の項目を指定してください');const parents=D.allFields(def).filter(x=>field.startsWith(x.path+'.')&&['Array','Table'].includes(x.field.type));if(parents.some(x=>!scopes.includes(x.path)))errors.push('入れ子の繰り返しは親の繰り返し範囲内に配置してください');if(scopes.includes(a.field))errors.push('同じ項目の繰り返しを自身の内側に配置できません');scopes=[...scopes,a.field];}
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
  const copy={...n,...(n.attrs?{attrs:{...a}}:{})};if(n.type==='fieldRef'){copy.attrs={...a,valuePath:pathAt(a.field,scopes)};}
  if(n.content)copy.content=n.content.flatMap(c=>expand(c,scopes,depth+1));return [copy];
 }return expand(content)[0]||{type:'doc',content:[]};
}
function wordControlLabel(n,def){const a=n.attrs||{},type=typeof n.type==='string'?n.type:n.type?.name;if(type==='repeatBlock')return '繰り返し：'+(richFieldAt(def,a.field)?.label||a.field||'項目未指定')+' の各行';if(type==='conditionBlock'){const c=D.simpleCondition(def,a.when)||a.when;return '条件：'+(c?.field?(D.fieldAt(def,c.field)?.label||c.field)+' = '+String(Array.isArray(c.equals)?D.display(D.fieldAt(def,c.field),c.equals):c.equals):D.ruleGraph(def).nodes.find(x=>x.id===c?.nodeId)?.label||'条件を設定');}return '';}
Object.assign(D,{richFieldAt,richNodes,richReferences,validateRichDefinition,expandRich,wordControlLabel});
})(globalThis);
