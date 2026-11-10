/* Shared workbench hierarchy. UI preferences never alter document data. */
(function(root){
'use strict';const D=root.DocBench,queries=new Map(),closedTypeFolders=new Map();
const paths={search:'m21 21-4.3-4.3 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',menu:'M4 6h16M4 12h16M4 18h16',undo:'M9 5 4 10l5 5M4 10h9a7 7 0 0 1 7 7',redo:'m15 5 5 5-5 5M20 10h-9a7 7 0 0 0-7 7',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',close:'m6 6 12 12M18 6 6 18'};
function uiIcon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';}
function workbenchItemLine(name,type,key){
 const label=D.esc(name),kind=D.esc(type);
 return '<span class="workbench-item-line"><span class="tree-text" title="'+label+'"><strong>'+label+'</strong>'+
  (key?'<small>'+D.esc(key)+'</small>':'')+'</span><span class="tree-type" title="'+kind+'">'+kind+'</span></span>';
}
function typeFolderPaths(index){
 const folders=new Map();
 for(const {folder=[]} of index)for(let i=1;i<=folder.length;i++){
  const path=folder.slice(0,i);folders.set(JSON.stringify(path),path);
 }
 return folders;
}
function typeFilterControls(index,onChange,state,{showFolders=true}={}){
 const controls=document.createElement('div');controls.className='type-search-filters';
 const folders=showFolders?typeFolderPaths(index):new Map();
 const tags=[...new Set(index.flatMap(entry=>entry.tags))].sort((a,b)=>a.localeCompare(b,'ja'));
 function select(label,entries,value,onSelect){
  const field=document.createElement('label'),control=document.createElement('select');
  field.textContent=label;
  for(const [key,name] of [['','すべて'],...entries])control.add(new Option(name,key));
  control.value=entries.some(([key])=>key===value)?value:'';
  control.onchange=()=>{onSelect(control.value);onChange();};
  field.append(control);controls.append(field);
 }
 if(!folders.has(JSON.stringify(state.folder)))state.folder=[];
 if(!tags.includes(state.tag))state.tag='';
 if(folders.size)select('フォルダ',[...folders].map(([key,path])=>[key,path.join(' › ')]).sort((a,b)=>a[1].localeCompare(b[1],'ja')),JSON.stringify(state.folder),value=>{state.folder=value?JSON.parse(value):[];});
 if(tags.length)select('タグ',tags.map(tag=>[tag,tag]),state.tag,value=>{state.tag=value;});
 return controls;
}
function typeSearchDescription(entry){
 const location=entry.folder.join(' › '),tags=entry.tags.map(tag=>'#'+tag).join(' ');
 const reason=entry.matches.filter(match=>!['名前','キー'].includes(match.label)).map(match=>match.label+'「'+match.value.slice(0,45)+'」').join('、');
 return [location,tags,reason&&reason+'に一致'].filter(Boolean).join(' · ');
}
function mountTypeFolders(list,index,closed){
 const folders=new Map(),entries=new Map(index.map(entry=>[entry.type.id,entry.folder]));
 const buttons=[...list.querySelectorAll('[data-type-select]')];
 for(const button of buttons){
  const path=entries.get(button.dataset.typeSelect)||[];let parent=list;
  for(let i=0;i<path.length;i++){
   const key=JSON.stringify(path.slice(0,i+1));let folder=folders.get(key);
   if(!folder){
    const node=document.createElement('details'),summary=document.createElement('summary'),children=document.createElement('div');
    node.className='type-folder';node.dataset.typeFolder=key;
    summary.textContent=path[i];children.className='type-folder-children';
    node.append(summary,children);parent.append(node);
    folder={node,children,buttons:[]};folders.set(key,folder);
    summary.onclick=event=>{
     event.preventDefault();node.open=!node.open;
     if(!list.dataset.filtered){if(node.open)closed.delete(key);else closed.add(key);}
    };
   }
   folder.buttons.push(button);parent=folder.children;
  }
  parent.append(button);
 }
 return (found,filtering)=>{
  list.dataset.filtered=filtering?'true':'';
  for(const [key,{node,buttons}] of folders){
   node.hidden=filtering&&!buttons.some(button=>found.has(button.dataset.typeSelect));
   node.open=filtering||!closed.has(key);
  }
 };
}
function mountTypePickers(panel,definition){
 const types=D.availableTypes(definition),byId=new Map(types.map(type=>[type.id,type]));
 const selectors='select[data-prop=type],select[data-type-prop=type],select[data-prop=itemType],select[data-type-prop=itemType],select[data-variant-choice]';
 for(const select of panel.querySelectorAll(selectors)){
  const options=new Map();
  for(const option of select.options){
   const id=option.value.replace(/^@/,'');
   if(!option.disabled&&byId.has(id))options.set(id,option.value);
  }
  if(select.disabled||!options.size)continue;
  const index=D.typeSearchIndex([...options.keys()].map(id=>byId.get(id)));
  const button=document.createElement('button');
  button.type='button';button.className='type-search-open';button.textContent='型を検索';
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-label',select.closest('label')?.firstChild?.textContent.trim()+'の候補を検索');
  const label=select.closest('label'),control=document.createElement('div');
  if(label.parentElement.classList.contains('editor-name-type')){button.innerHTML=uiIcon('search');button.title='型を検索';}
  control.className='type-picker-control';label.before(control);control.append(label,button);
  button.onclick=()=>{
   const dialog=document.createElement('dialog');dialog.className='type-picker';
   dialog.setAttribute('aria-label','型を検索');
   dialog.innerHTML='<div class="type-picker-head"><h3>型を検索</h3><button type="button">閉じる</button></div><label>検索語<input type="search" placeholder="名前・フォルダ・タグ・子項目など" autocomplete="off"></label><p role="status"></p><div class="type-picker-results"></div>';
   const input=dialog.querySelector('input'),results=dialog.querySelector('.type-picker-results'),state={};
   function refresh(){
    const matches=D.searchTypes(index,input.value,state.folder,state.tag);
    dialog.querySelector('[role=status]').textContent=matches.length+' 件';
    results.replaceChildren();
    for(const entry of matches){
     const item=document.createElement('button'),name=document.createElement('strong'),context=document.createElement('small');
     item.type='button';name.textContent=entry.type.name;
     context.textContent=typeSearchDescription(entry)||D.basicTypeLabel(entry.type.schema?.type);
     item.append(name,context);item.onclick=()=>{
      dialog.close();
      select.value=options.get(entry.type.id);select.dispatchEvent(new Event('change',{bubbles:true}));
     };
     results.append(item);
    }
   }
   input.closest('label').after(typeFilterControls(index,refresh,state));
   input.oninput=refresh;
   dialog.querySelector('button').onclick=()=>dialog.close();
   dialog.onclose=()=>{dialog.remove();if(button.isConnected)button.focus({preventScroll:true});};
   panel.append(dialog);dialog.showModal();input.focus();refresh();
  };
 }
}
function mountWorkbenchUI(host,screen,definition){
 const work=host.querySelector('.builder'),library=screen==='types',list=work?.querySelector(library?'.type-list':'[data-definition-scroll=fields]');
 if(work&&['definition','types'].includes(screen)){
  const panel=work.children[1],selected=library?work.querySelector('.type-field-item.selected strong')?.textContent:work.querySelector('.tree-item.selected strong')?.textContent;
  if(selected){const context=document.createElement('div');context.className='selection-context';const name=document.createElement('strong');name.textContent=selected;const note=document.createElement('span');note.textContent=library?'この型の入力規則を編集':'選択中の入力項目';context.append(note,name);panel.querySelector('.panel-head').after(context);}
 }
 if(library)for(const [id,label,description]of [['type-export','型を保存','型定義を保存'],['type-import','型を読込','型定義を読込']]){const button=host.querySelector('#'+id);if(button){button.textContent=label;button.setAttribute('aria-label',description);button.title=description;}}
 if(!list)return;
 const key=definition.id+':'+screen,box=document.createElement('div');box.className='workbench-search';box.innerHTML='<label class="sr-only" for="workbench-list-search">'+(library?'型を検索':'入力項目を検索')+'</label><div class="workbench-search-control">'+uiIcon('search')+'<input id="workbench-list-search" type="search" placeholder="'+'名前・キーで検索'+'" autocomplete="off"><button type="button" aria-label="検索を解除">'+uiIcon('close')+'</button></div><span class="workbench-search-status" role="status" aria-live="polite"></span>';list.before(box);
 const input=box.querySelector('input'),clear=box.querySelector('button'),status=box.querySelector('[role=status]'),empty=document.createElement('p');empty.className='workbench-search-empty';empty.textContent='一致する項目がありません。検索語を変えてください。';empty.hidden=true;list.after(empty);input.value=queries.get(key)||'';
 const libraryIndex=library?D.typeSearchIndex(D.availableTypes(definition)):[];
 const closed=closedTypeFolders.get(key)||new Set(),updateFolders=library?mountTypeFolders(list,libraryIndex,closed):null;
 if(library)closedTypeFolders.set(key,closed);
 const filterKey=key+':organization',filter=queries.get(filterKey)||{};
 if(library){box.querySelector('[role=status]').before(typeFilterControls(libraryIndex,apply,filter,{showFolders:false}));queries.set(filterKey,filter);input.placeholder='名前・フォルダ・タグ・子項目など';}
 let searching=!!input.value.trim();const branches=[...list.querySelectorAll('.tree-branch')],expanded=new Map(branches.map(branch=>{const children=branch.querySelector(':scope > [id]');return [children,children?.hidden];}));
 function apply(){const wasSearching=searching,query=input.value.trim().toLocaleLowerCase(),filtering=!!(query||filter.tag);if(query&&!searching)for(const child of expanded.keys())if(child)expanded.set(child,child.hidden);searching=!!query;const entries=[...list.querySelectorAll(library?'[data-type-select]':'[data-select]')],matches=new Set(entries.filter(el=>!query||el.textContent.toLocaleLowerCase().includes(query)));queries.set(key,input.value);clear.hidden=!query;
  if(library){
   const found=new Map(D.searchTypes(libraryIndex,input.value,[],filter.tag).map(entry=>[entry.type.id,entry]));
   matches.clear();
   for(const el of entries){
    const entry=found.get(el.dataset.typeSelect);
    el.hidden=!entry;
    if(entry){
     matches.add(el);
     let detail=el.querySelector('[data-type-match]');
     if(!detail){detail=document.createElement('small');detail.dataset.typeMatch='';el.append(detail);}
     detail.textContent=filtering?typeSearchDescription(entry):'';detail.hidden=!detail.textContent;
    }
   }
   updateFolders(found,filtering);
  }
  else {const visit=(branch,ancestorMatch=false)=>{const item=branch.querySelector(':scope > [data-select]'),children=branch.querySelector(':scope > [id]'),own=matches.has(item),childBranches=children?[...children.children].filter(el=>el.classList.contains('tree-branch')):[],childMatch=childBranches.map(child=>visit(child,ancestorMatch||own)).some(Boolean),visible=!query||ancestorMatch||own||childMatch;branch.hidden=!visible;if(children){children.hidden=query?!visible:expanded.get(children);const toggle=item.querySelector('[data-tree-toggle]');if(toggle){toggle.setAttribute('aria-expanded',String(!children.hidden));toggle.textContent=children.hidden?'▸':'▾';toggle.setAttribute('aria-label',item.querySelector('strong').textContent+'の子項目を'+(children.hidden?'展開':'折りたたむ'));}}return own||childMatch;};for(const branch of [...list.children].filter(el=>el.classList.contains('tree-branch')))visit(branch);}
  const count=matches.size;status.textContent=filtering?count+' 件が一致':entries.length+(library?' 種類の型':' 項目');empty.hidden=count>0||!filtering;if(wasSearching&&!query){const selected=list.querySelector('.selected');if(selected){const rect=selected.getBoundingClientRect(),bounds=list.getBoundingClientRect();if(rect.top<bounds.top)list.scrollTop+=rect.top-bounds.top;else if(rect.bottom>bounds.bottom)list.scrollTop+=rect.bottom-bounds.bottom;}}
 }
 input.oninput=apply;input.onkeydown=event=>{if(event.key==='Escape'&&input.value){event.preventDefault();input.value='';apply();}};clear.onmousedown=event=>event.preventDefault();clear.onclick=()=>{input.value='';apply();input.focus({preventScroll:true});};apply();
 if(!library)list.addEventListener('click',event=>{if(!input.value.trim()||event.target.closest('[data-tree-toggle]'))return;const item=event.target.closest('[data-select]');if(!item)return;for(let branch=item.parentElement.parentElement?.closest('.tree-branch');branch;branch=branch.parentElement?.closest('.tree-branch')){const toggle=branch.querySelector(':scope > .tree-item > [data-tree-toggle]');const children=branch.querySelector(':scope > [id]');if(toggle&&expanded.get(children)){toggle.setAttribute('aria-expanded','false');toggle.click();}}},{capture:true});
 for(const branch of branches){const toggle=branch.querySelector(':scope > .tree-item > [data-tree-toggle]'),children=branch.querySelector(':scope > [id]');toggle?.addEventListener('click',()=>expanded.set(children,children.hidden));}
 for(const el of list.querySelectorAll('[data-select]')){el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-pressed',String(el.classList.contains('selected')));el.onkeydown=event=>{if(event.target!==el||!['Enter',' '].includes(event.key))return;event.preventDefault();const id=el.dataset.select;el.click();queueMicrotask(()=>host.querySelector('[data-select="'+CSS.escape(id)+'"]')?.focus({preventScroll:true}));};}
 for(const el of list.querySelectorAll('[data-type-select]'))el.setAttribute('aria-pressed',String(el.classList.contains('selected')));
}
function collectionRulesHTML(field,{input,select,check,definition,ownerId,bound,openId}){
 const element=D.arrayItemField(field);
 let html='<details data-disclosure="collection-rules"><summary>行数・行の操作</summary>';
 if(field.type==='Array'){
  html+=select('itemType','各行の型',D.arrayItemChoices(definition,ownerId,field.itemVariants),D.arrayItemType(field));
  if(field.itemVariants)html+=D.arrayVariantSettings(definition,field,ownerId,bound);
  if(element)html+='<button id="'+openId+'">選んだ型を開く</button>';
 }
 html+='<div class="property-grid">'+input('minItems','最小行数',field.minItems,'number','min="0"')+
  input('maxItems','最大行数',field.maxItems,'number','min="0"')+
  input('initialRows','初期行数',field.initialRows,'number','min="0" max="1000"')+
  input('rowLabel','行の表示名',field.rowLabel)+'</div>';
 for(const [key,label] of [['allowAdd','追加を許可'],['allowDelete','削除を許可'],['allowDuplicate','複製を許可'],['allowReorder','並び替えを許可']])html+=check(key,label,field[key]!==false);
 if(!field.itemVariants){
  const columns=[{value:'',label:'指定なし'},...D.collectionFields(field).map(col=>({value:col.key,label:col.label}))];
  for(const [key,label] of [['businessKey','業務キー'],['uniqueBy','重複禁止列'],['sortBy','並び順の列']])html+=select(key,label,columns,field[key]||'');
  html+=select('sortDirection','並び順',[{value:'asc',label:'昇順'},{value:'desc',label:'降順'}],field.sortDirection||'asc');
 }
 return html+'</details>';
}
function integerFormatHTML(field){
 if(field.type!=='Integer')return '';
 const p=field.presentation||{};
 return '<div class="property-grid"><label>整数の表示<select id="integer-format">'+
  [['','標準'],['grouped','3桁区切り（1,234）'],['padded','ゼロ埋め（0012）']].map(([value,label])=>
   '<option value="'+value+'" '+((p.integerFormat||'')===value?'selected':'')+'>'+label+'</option>').join('')+
  '</select></label>'+(p.integerFormat==='padded'?'<label>最小桁数<input id="integer-digits" type="number" min="1" max="20" value="'+D.esc(p.integerDigits||4)+'"></label>':'')+'</div>';
}
function bindIntegerFormat(host,field,disabled,update){
 const format=host.querySelector('#integer-format'),digits=host.querySelector('#integer-digits');
 if(!format)return;
 format.disabled=disabled;
 format.onchange=()=>update(p=>{
  if(format.value)p.integerFormat=format.value;else delete p.integerFormat;
  if(format.value==='padded')p.integerDigits=4;else delete p.integerDigits;
 });
 if(digits){
  digits.disabled=disabled;
  digits.onchange=()=>{
   if(!digits.checkValidity()||!digits.value){digits.value=field.presentation?.integerDigits||4;return;}
   update(p=>{p.integerDigits=digits.valueAsNumber;});
  };
 }
}
function editorSection(title,className){
 const section=document.createElement('section'),heading=document.createElement('h4');
 section.className=className;heading.textContent=title;section.append(heading);return section;
}
function mountTypeListSplit(source,list,tools){
 const split=document.createElement('div'),storageKey='docbench:typeListHeight';
 split.className='type-list-split';split.tabIndex=0;split.setAttribute('role','separator');
 split.setAttribute('aria-orientation','horizontal');split.setAttribute('aria-label','型の一覧の高さ');
 split.setAttribute('aria-valuemin','80');split.title='ドラッグか上下キーで高さを変更。Homeで初期値。';
 tools.before(split);
 function set(height,save){
  const listTop=list.getBoundingClientRect().top-source.getBoundingClientRect().top;
  const max=Math.max(80,source.clientHeight-listTop-100);
  const value=Math.min(max,Math.max(80,height));list.style.flexBasis=value+'px';
  split.setAttribute('aria-valuemax',String(max));split.setAttribute('aria-valuenow',String(Math.round(value)));
  if(save)try{localStorage.setItem(storageKey,String(value));}catch{}
 }
 let saved;try{saved=Number(localStorage.getItem(storageKey));}catch{}
 function restore(){if(source.clientHeight)set(saved||Math.max(120,source.clientHeight*.42),false);}
 restore();requestAnimationFrame(restore);
 split.onkeydown=event=>{
  if(!['ArrowUp','ArrowDown','Home'].includes(event.key))return;
  event.preventDefault();
  set(event.key==='Home'?source.clientHeight*.42:list.clientHeight+(event.key==='ArrowUp'?-24:24),true);
 };
 split.onpointerdown=event=>{
  if(event.button!==0)return;
  event.preventDefault();split.focus({preventScroll:true});split.setPointerCapture(event.pointerId);
  const start=event.clientY,height=list.clientHeight;
  split.onpointermove=move=>set(height+move.clientY-start,false);
  split.onlostpointercapture=()=>{split.onpointermove=null;set(list.clientHeight,true);};
 };
}
function mountDefinitionEditorUI(host,screen,definition,openTypes){
 if(!['types','definition'].includes(screen))return;
 const library=screen==='types',work=host.querySelector('.builder'),source=work.children[0],panel=work.children[1],body=panel.querySelector('.panel-body'),form=library?body.querySelector(':scope > fieldset'):body;
 const format=form?.querySelector('select[data-prop=type],select[data-type-prop=type]');
 work.classList.add('definition-workbench');
 source.querySelector('.panel-head h3').textContent=library?'型の一覧':'入力項目の一覧';
 panel.querySelector('.panel-head h3').textContent=library?'型の設定':'項目の設定';
 work.querySelector('.form-preview .panel-head h3').textContent='入力プレビュー';
 if(library){
  const actions=document.createElement('details');actions.dataset.disclosure='type-list-actions';
  actions.className='editor-list-actions';actions.innerHTML='<summary>型を管理</summary>';
  actions.append(source.querySelector('.type-file-actions'),source.querySelector('.type-order-actions'));
  const structure=source.querySelector('[data-type-scroll=fields]'),outline=document.createElement('section');
  outline.className='editor-type-structure';outline.setAttribute('aria-labelledby','type-structure-title');
  outline.innerHTML='<h4 id="type-structure-title">型構造</h4>';
  structure.previousElementSibling.remove();outline.append(structure);
  if(!structure.querySelector('[data-type-branch]'))outline.hidden=true;
  const tools=document.createElement('div');tools.className='type-list-tools';tools.append(actions,outline);
  const list=source.querySelector('.type-list'),empty=source.querySelector('.workbench-search-empty');
  (empty||list).after(tools);mountTypeListSplit(source,list,tools);
  const types=D.availableTypes(definition);
  const folderInput=body.querySelector('#type-folder');
  if(folderInput){
   const choices=document.createElement('datalist');choices.id='type-folder-paths';
   const paths=[...typeFolderPaths(types).values()].map(path=>path.join(' / ')).sort((a,b)=>a.localeCompare(b,'ja'));
   for(const path of paths)choices.append(new Option(path,path));
   folderInput.setAttribute('list',choices.id);folderInput.after(choices);
  }
 }
 if(!format)return;

 const selected=library?source.querySelector('.type-field-item.selected'):source.querySelector('.tree-item.selected');
 const fields=library?D.allFields({fields:[D.availableTypes(definition).find(t=>t.id===work.dataset.type)?.schema]}):D.allFields(definition);
 if(!library){
  const required=new Set(fields.filter(x=>x.field.required).map(x=>x.field.id));
  for(const row of source.querySelectorAll('[data-select]'))if(required.has(row.dataset.select)){
   const badge=document.createElement('span');badge.className='required';badge.textContent='必須';row.querySelector('strong').append(badge);
  }
 }
 const current=fields.find(x=>x.field.id===(library?selected?.dataset.typeField:selected?.dataset.select));
 const names=current?current.path.split('.').map((_,i,parts)=>fields.find(x=>x.path===parts.slice(0,i+1).join('.'))?.field.label).filter(Boolean):[];
 const context=panel.querySelector('.selection-context');
 if(context){
  context.querySelector('span').textContent=names.length>1?names.slice(0,-1).join(' › '):library?'選択中の型':'選択中の項目';
  context.querySelector('strong').textContent=names.at(-1)||context.querySelector('strong').textContent;
 }

 const basic=form.querySelector(':scope > .property-grid');
 const primary=editorSection('基本設定','editor-primary'),details=editorSection('詳細設定','editor-details');
 const issueSummary=document.createElement('div');
 issueSummary.id='definition-apply-errors';issueSummary.className='notice error';issueSummary.tabIndex=-1;
 issueSummary.setAttribute('role','alert');issueSummary.hidden=true;
 basic.before(issueSummary,primary);primary.append(basic);
 const name=basic.querySelector('[data-prop=label],[data-type-prop=label]')?.closest('label');
 if(name)name.firstChild.textContent='項目名';
 const typeName=library?body.querySelector('#type-name')?.closest('label'):null;
 if(typeName&&names.length<=1)typeName.firstChild.textContent='型名';
 const nameAndType=document.createElement('div');nameAndType.className='editor-name-type';
 basic.prepend(nameAndType);nameAndType.append(name||typeName,format.closest('label'));
 const required=form.querySelector(':scope > label.check');
 if(required){required.lastChild.textContent='入力必須';primary.append(required);}
 const keyInput=basic.querySelector('[data-prop=key],[data-type-prop=key]');
 if(keyInput){
  const key=document.createElement('details');key.dataset.disclosure='field-key';
  key.innerHTML='<summary>管理用の項目キー</summary><p class="muted">書類や条件から参照する識別子です。</p>';
  key.append(keyInput.closest('label'));form.append(key);
 }

 const reference=panel.querySelector('.type-binding,[data-editor-reference]');
 if(reference)primary.append(reference);
 const collection=form.querySelector('[data-disclosure=collection-rules]');
 const itemType=collection?.querySelector('select[data-prop=itemType],select[data-type-prop=itemType]');
 if(itemType){
  const rows=editorSection('繰り返す内容','editor-format-settings');
  basic.after(rows);
  const itemLabel=itemType.closest('label'),variants=collection.querySelector('[data-array-variants]');
  const hint=document.createElement('p');hint.className='editor-help';
  hint.id='collection-row-type-help';hint.textContent='行によって入力欄が異なる場合は、選択型を指定します。';
  itemType.setAttribute('aria-describedby',hint.id);
  rows.append(itemLabel,hint);
  const sourceButton=collection.querySelector('#array-element-type-open,#type-array-element-open');
  if(!library&&!itemType.disabled&&!sourceButton){
   const define=document.createElement('button');define.type='button';define.className='editor-text-action';
   define.textContent='型を定義へ';define.onclick=()=>openTypes();rows.append(define);
  }
  if(variants){
   const legacy=document.createElement('p');legacy.className='editor-help';
   legacy.textContent='各行の型を変更すると、この項目の入力値が初期化されます。';
   rows.append(legacy,variants);
  }
  if(sourceButton){sourceButton.textContent='選んだ型を開く';rows.append(sourceButton);}
 }
 const union=form.querySelector(':scope > [data-array-variants]');
 if(union)basic.after(union);
 const options=form.querySelector('[data-prop=options],[data-type-prop=options]')?.closest('label');
 if(options)primary.append(options);
 const tree=form.querySelector('[data-tree-settings]');
 if(tree)primary.append(tree.closest('details')||tree);
 const childAdd=form.querySelector('#add-child,#type-add-child');
 const children=childAdd?.closest('details,[data-editor-children]');
 if(children){
  primary.append(children);
  children.querySelector('p.muted')?.remove();
  const branch=selected?.closest(library?'.type-structure-branch':'.tree-branch');
  const rows=branch?.querySelectorAll(library?':scope > .type-structure-children > .type-structure-branch > .type-structure-row > [data-type-field]':':scope > div > .tree-branch > .tree-item');
  const list=document.createElement('div');list.className='task-child-list';
  for(const row of rows||[]){
   const button=document.createElement('button');button.type='button';button.textContent=row.querySelector('strong').textContent;
   button.onclick=()=>{
    branch.querySelector(':scope > div > .tree-toggle[aria-expanded=false]')?.click();
    row.click();
   };
   list.append(button);
  }
  if(list.childElementCount)childAdd.before(list);
 }
 for(const group of [...form.children].filter(el=>el.matches('details'))){
  if(['type-validation','field-validation'].includes(group.dataset.disclosure)&&!group.querySelector('input,select,textarea')){group.remove();continue;}
  if(group.dataset.disclosure==='collection-rules')group.open=false;
  details.append(group);
 }
 if(details.childElementCount>1)form.append(details);
 if(library){
  body.querySelector(':scope > hr')?.remove();body.querySelector(':scope > h3')?.remove();
  const management=body.querySelector('[data-disclosure=type-management]');
  if(management){details.append(management);if(typeName&&names.length>1)management.querySelector('fieldset').prepend(typeName);form.append(details);}
 }
 mountTypePickers(panel,definition);
}
const previewVisibility=new Map();
function mountDefinitionPreview(host,screen,bar){
 if(!['types','definition'].includes(screen))return;
 const work=host.querySelector('.definition-workbench'),preview=work.querySelector('.form-preview'),button=document.createElement('button');
 const key=host.dataset.definitionId+':'+screen,returnButton=document.createElement('button');
 returnButton.type='button';returnButton.className='editor-preview-return';returnButton.textContent='編集に戻る';
 preview.querySelector('.panel-head').append(returnButton);
 button.type='button';button.className='editor-preview-toggle';preview.id='definition-input-preview';
 button.setAttribute('aria-controls',preview.id);
 function show(visible){
  preview.hidden=!visible;work.classList.toggle('preview-hidden',!visible);
  button.setAttribute('aria-expanded',String(visible));button.textContent=visible?'プレビューを閉じる':'入力プレビュー';
 }
 show(previewVisibility.get(key)??innerWidth>850);
 function toggle(visible){
  previewVisibility.set(key,visible);show(visible);work.dispatchEvent(new Event('docbench:layout'));
  if(innerWidth>850)return;
  if(visible){preview.scrollIntoView({block:'start'});returnButton.focus({preventScroll:true});}
  else{button.scrollIntoView({block:'start'});button.focus({preventScroll:true});}
 }
 button.onclick=()=>toggle(preview.hidden);
 returnButton.onclick=()=>toggle(false);
 const tools=document.createElement('div');tools.className='editor-view-actions';
 tools.append(host.querySelector(':scope > [data-pin-workbench]'),button);bar.append(tools);
}
function showDefinitionIssues(host,issues){
 const settings=()=>host.querySelector('.definition-workbench .flow-settings');
 if(settings()?.hidden)host.querySelector('.definition-workbench .flow-source :is([data-select],[data-type-select]).selected')?.click();
 const summary=host.querySelector('#definition-apply-errors');
 if(!summary||settings()?.hidden)return false;
 const heading=document.createElement('strong'),list=document.createElement('ul');
 heading.textContent='反映する前に設定を確認してください';
 for(const issue of issues.slice(0,5)){
  const line=document.createElement('li');line.textContent=issue.message;list.append(line);
 }
 summary.replaceChildren(heading,list);summary.hidden=false;summary.focus();return true;
}
Object.assign(D,{workbenchItemLine,collectionRulesHTML,integerFormatHTML,bindIntegerFormat,uiIcon,mountWorkbenchUI,mountDefinitionEditorUI,mountDefinitionPreview,showDefinitionIssues});
})(globalThis);
