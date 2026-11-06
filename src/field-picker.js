/* Searchable requirement picker shared by inline fields and collection bindings. */
(function(root){
'use strict';const D=root.DocBench;
function mountFieldPicker(select,cfg={}){
 if(!select||select._fieldPicker)return select?._fieldPicker;
 const button=document.createElement('button');button.type='button';button.id=select.id+'-picker';button.className='field-picker-button';button.setAttribute('aria-haspopup','dialog');select.hidden=true;select.after(button);
 let dialog=null;
 const refresh=()=>{const option=select.selectedOptions[0];button.textContent=option?.textContent||'項目を選ぶ';button.title=button.textContent;button.disabled=select.disabled||!select.options.length;button.setAttribute('aria-label',(cfg.label||'要件の項目')+'：'+button.textContent);};
 function open(){
  cfg.onOpen?.();const entries=[...select.options].filter(o=>o.value&&!o.disabled).map(o=>({path:o.value,label:o.textContent}));
  dialog=document.createElement('dialog');dialog.className='field-picker-dialog';dialog.setAttribute('aria-label',cfg.label||'要件の項目を選ぶ');
  dialog.innerHTML='<div class="dialog-head"><h2>'+D.esc(cfg.label||'要件の項目を選ぶ')+'</h2><button type="button" class="field-picker-close" aria-label="項目選択を閉じる">×</button></div><div class="field-picker-body"><label>項目を検索<input class="field-picker-search" type="search" placeholder="項目名・親項目名・キーで検索" autocomplete="off"></label><p class="field-picker-count" role="status"></p><div class="field-picker-results" aria-label="要件の項目"></div></div>';
  document.body.append(dialog);const search=dialog.querySelector('input'),result=dialog.querySelector('.field-picker-results'),count=dialog.querySelector('.field-picker-count'),definition=typeof cfg.definition==='function'?cfg.definition():cfg.definition,scopes=cfg.scopes?.()||[],expanded=new Set(scopes);
  const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase(),title=path=>D.richFieldAt(definition,path)?.label||path.split('.').at(-1);
  function choose(entry){select.value=entry.path;select.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();}
  function item(entry,full=false){const b=document.createElement('button');b.type='button';b.className='field-picker-choice';b.dataset.fieldChoice=entry.path;b.textContent=full?entry.label:title(entry.path);b.title=entry.label+' · '+entry.path;b.setAttribute('aria-current',String(entry.path===select.value));b.onclick=()=>choose(entry);return b;}
  function render(){
   const tokens=normalize(search.value).trim().split(/\s+/).filter(Boolean),matches=entries.filter(e=>tokens.every(t=>normalize(e.label+' '+e.path).includes(t)));result.replaceChildren();count.textContent=tokens.length?matches.length+'件の候補／全'+entries.length+'項目':entries.length+'項目。親項目を開くと子項目を選べます。';
   if(tokens.length){for(const entry of matches)result.append(item(entry,true));}
   else{
    const tree={children:new Map()};for(const entry of entries){let node=tree,prefix='';for(const key of entry.path.split('.')){prefix=prefix?prefix+'.'+key:key;if(!node.children.has(key))node.children.set(key,{path:prefix,children:new Map()});node=node.children.get(key);}node.entry=entry;}
    function branch(parent){const list=document.createElement('ul');for(const node of [...parent.children.values()].sort((a,b)=>Number(scopes.some(s=>b.path===s||b.path.startsWith(s+'.')))-Number(scopes.some(s=>a.path===s||a.path.startsWith(s+'.'))))){const li=document.createElement('li'),line=document.createElement('div');line.className='field-picker-entry';li.append(line);if(node.children.size){const toggle=document.createElement('button');toggle.type='button';toggle.className='field-picker-toggle';toggle.dataset.fieldFolder=node.path;toggle.setAttribute('aria-label',title(node.path)+'の子項目');toggle.setAttribute('aria-expanded',String(expanded.has(node.path)));toggle.textContent=expanded.has(node.path)?'▾':'▸';toggle.onclick=()=>{if(expanded.has(node.path))expanded.delete(node.path);else expanded.add(node.path);render();result.querySelector('[data-field-folder="'+CSS.escape(node.path)+'"]')?.focus();};line.append(toggle);}else{const space=document.createElement('span');space.className='field-picker-toggle-space';line.append(space);}
     if(node.entry)line.append(item(node.entry));else{const name=document.createElement('span');name.className='field-picker-folder';name.textContent=title(node.path);line.append(name);}if(scopes.includes(node.path)){const current=document.createElement('small');current.textContent='このくり返しの項目';line.append(current);}if(node.children.size&&expanded.has(node.path))li.append(branch(node));list.append(li);}return list;}
    result.append(branch(tree));
   }
   if(!matches.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='一致する項目がありません。別の名前や親項目名で検索してください。';result.append(empty);}
  }
  search.oninput=render;search.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();result.querySelector('button')?.focus();}else if(event.key==='Enter'){event.preventDefault();const candidates=[...result.querySelectorAll('[data-field-choice]')].filter(b=>b.checkVisibility());if(candidates.length===1)candidates[0].click();}};
  result.onkeydown=event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;const buttons=[...result.querySelectorAll('button')].filter(b=>b.checkVisibility()),at=buttons.indexOf(document.activeElement);event.preventDefault();if(event.key==='ArrowUp'&&at===0){search.focus();return;}const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,at+(event.key==='ArrowDown'?1:-1)));buttons[next]?.focus();};
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}},true);
  dialog.querySelector('.field-picker-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();dialog=null;refresh();button.focus({preventScroll:true});},{once:true});render();dialog.showModal();search.focus();
 }
 button.onclick=open;select.addEventListener('change',refresh);
 const observer=new MutationObserver(refresh);observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});refresh();
 const api={refresh,destroy(){observer.disconnect();select.removeEventListener('change',refresh);dialog?.remove();button.remove();select.hidden=false;delete select._fieldPicker;}};select._fieldPicker=api;return api;
}
Object.assign(D,{mountFieldPicker});
})(globalThis);
