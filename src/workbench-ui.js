/* Shared workbench hierarchy. UI preferences never alter document data. */
(function(root){
'use strict';const D=root.DocBench,queries=new Map();
const paths={search:'m21 21-4.3-4.3 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',menu:'M4 6h16M4 12h16M4 18h16',undo:'M9 5 4 10l5 5M4 10h9a7 7 0 0 1 7 7',redo:'m15 5 5 5-5 5M20 10h-9a7 7 0 0 0-7 7',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',close:'m6 6 12 12M18 6 6 18'};
function uiIcon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';}
function mountWorkbenchUI(host,screen,definition){
 const work=host.querySelector('.builder'),library=screen==='types',list=work?.querySelector(library?'.type-list':'[data-definition-scroll=fields]');
 if(work&&['definition','types'].includes(screen)){
  const panel=work.children[1],selected=library?work.querySelector('.type-field-item.selected strong')?.textContent:work.querySelector('.tree-item.selected strong')?.textContent;
  if(selected){const context=document.createElement('div');context.className='selection-context';const name=document.createElement('strong');name.textContent=selected;const note=document.createElement('span');note.textContent=library?'この型の入力規則を編集':'選択中の入力項目';context.append(note,name);panel.querySelector('.panel-head').after(context);}
 }
 if(!list)return;
 const key=definition.id+':'+screen,box=document.createElement('div');box.className='workbench-search';box.innerHTML='<label class="sr-only" for="workbench-list-search">'+(library?'型を検索':'入力項目を検索')+'</label><div class="workbench-search-control">'+uiIcon('search')+'<input id="workbench-list-search" type="search" placeholder="'+(library?'型の名前・キーで検索':'項目名・キーで検索')+'" autocomplete="off"><button type="button" aria-label="検索を解除">'+uiIcon('close')+'</button></div><span class="workbench-search-status" role="status" aria-live="polite"></span>';list.before(box);
 const input=box.querySelector('input'),clear=box.querySelector('button'),status=box.querySelector('[role=status]'),empty=document.createElement('p');empty.className='workbench-search-empty';empty.textContent='一致する項目がありません。検索語を変えてください。';empty.hidden=true;list.after(empty);input.value=queries.get(key)||'';
 let searching=!!input.value.trim();const branches=[...list.querySelectorAll('.tree-branch')],expanded=new Map(branches.map(branch=>{const children=branch.querySelector(':scope > [id]');return [children,children?.hidden];}));
 function apply(){const query=input.value.trim().toLocaleLowerCase();if(query&&!searching)for(const child of expanded.keys())if(child)expanded.set(child,child.hidden);searching=!!query;const entries=[...list.querySelectorAll(library?'[data-type-select]':'[data-select]')],matches=new Set(entries.filter(el=>!query||el.textContent.toLocaleLowerCase().includes(query)));queries.set(key,input.value);clear.hidden=!query;
  if(library)for(const el of entries)el.hidden=!matches.has(el);
  else {const visit=(branch,ancestorMatch=false)=>{const item=branch.querySelector(':scope > [data-select]'),children=branch.querySelector(':scope > [id]'),own=matches.has(item),childBranches=children?[...children.children].filter(el=>el.classList.contains('tree-branch')):[],childMatch=childBranches.map(child=>visit(child,ancestorMatch||own)).some(Boolean),visible=!query||ancestorMatch||own||childMatch;branch.hidden=!visible;if(children)children.hidden=query?!visible:expanded.get(children);return own||childMatch;};for(const branch of [...list.children].filter(el=>el.classList.contains('tree-branch')))visit(branch);}
  const count=matches.size;status.textContent=query?count+' 件が一致':'名前・キーから探せます';empty.hidden=!query||count>0;
 }
 input.oninput=apply;input.onkeydown=event=>{if(event.key==='Escape'&&input.value){event.preventDefault();input.value='';apply();}};clear.onmousedown=event=>event.preventDefault();clear.onclick=()=>{input.value='';apply();input.focus({preventScroll:true});};apply();
 if(!library)list.addEventListener('click',event=>{if(!input.value.trim()||event.target.closest('[data-tree-toggle]'))return;const item=event.target.closest('[data-select]');if(!item)return;for(let branch=item.parentElement.parentElement?.closest('.tree-branch');branch;branch=branch.parentElement?.closest('.tree-branch')){const toggle=branch.querySelector(':scope > .tree-item > [data-tree-toggle]');if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();}},{capture:true});
 for(const el of list.querySelectorAll('[data-select]')){el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-pressed',String(el.classList.contains('selected')));el.onkeydown=event=>{if(event.target!==el||!['Enter',' '].includes(event.key))return;event.preventDefault();const id=el.dataset.select;el.click();queueMicrotask(()=>host.querySelector('[data-select="'+CSS.escape(id)+'"]')?.focus({preventScroll:true}));};}
 for(const el of list.querySelectorAll('[data-type-select]'))el.setAttribute('aria-pressed',String(el.classList.contains('selected')));
}
Object.assign(D,{uiIcon,mountWorkbenchUI});
})(globalThis);
