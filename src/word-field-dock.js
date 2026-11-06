/* Requirement fields insert directly at the held Word selection. */
(function(root){
'use strict';const D=root.DocBench;let state={definition:null,open:false,query:'',part:'value'};
function mountWordFieldDock(cfg){
 const definition=cfg.definition();if(state.definition!==definition.id)state={definition:definition.id,open:false,query:'',part:'value'};
 const dock=document.createElement('aside');dock.className='word-field-dock';dock.id='word-field-dock';dock.setAttribute('aria-label','入力項目の差し込み');dock.hidden=!state.open;
 dock.innerHTML='<div class="word-dock-head"><h3>入力項目を差し込む</h3><button type="button" aria-label="差し込み欄を閉じる">×</button></div><p class="word-dock-guide">本文の差し込みたい位置にカーソルを置き、項目を選んでください。</p><label class="word-dock-search">項目を検索<input id="word-field-search" type="search" placeholder="項目名・親項目名で検索" autocomplete="off"></label><label class="word-dock-part">差し込むもの<select id="word-dock-part"><option value="value">入力された値</option><option value="label">項目名（見出し用）</option></select></label><p class="word-dock-count" role="status"></p><div class="word-dock-results"></div><p class="word-dock-status" role="status" aria-live="polite"></p>';
 cfg.stage.append(dock);const search=dock.querySelector('input'),part=dock.querySelector('select'),results=dock.querySelector('.word-dock-results'),count=dock.querySelector('.word-dock-count'),status=dock.querySelector('.word-dock-status');search.value=state.query;part.value=state.part;let signature='';
 const trigger=document.createElement('button');trigger.type='button';trigger.id='word-fields-open';trigger.className='primary';trigger.textContent='入力項目を差し込む';trigger.setAttribute('aria-controls',dock.id);trigger.setAttribute('aria-expanded',String(state.open));
 function open(value,focus=false){if(value){cfg.controller()?.holdSelection?.();cfg.onOpen?.();}state.open=value;dock.hidden=!value;trigger.setAttribute('aria-expanded',String(value));if(value){sync();if(focus)search.focus({preventScroll:true});}else if(focus)cfg.controller()?.write?.();}
 trigger.onmousedown=e=>{e.preventDefault();cfg.controller()?.holdSelection?.();};trigger.onclick=()=>open(!state.open,true);dock.querySelector('.word-dock-head button').onclick=()=>open(false,true);
 dock.addEventListener('pointerdown',()=>cfg.controller()?.holdSelection?.(),true);dock.addEventListener('focusin',()=>cfg.controller()?.holdSelection?.());
 const normalize=x=>String(x).normalize('NFKC').toLocaleLowerCase();
 function sync(){
  const entries=cfg.fields(),next=JSON.stringify([entries,state.query,cfg.controller()?.controlScopes?.()]);if(next===signature)return;signature=next;
  const tokens=normalize(state.query).trim().split(/\s+/).filter(Boolean),matches=entries.filter(e=>tokens.every(t=>normalize(e.label+' '+e.value).includes(t)));count.textContent=matches.length+'件の項目'+(tokens.length?'（全'+entries.length+'件）':'');results.replaceChildren();
  for(const entry of matches){const b=document.createElement('button');b.type='button';b.dataset.wordField=entry.value;const title=document.createElement('strong'),path=document.createElement('small');title.textContent=D.richFieldAt(definition,entry.value)?.label||entry.label;path.textContent=entry.label;path.hidden=entry.label===title.textContent;b.append(title,path);b.title=entry.label;b.onmousedown=e=>e.preventDefault();b.onclick=()=>{
    const kind=document.querySelector('#canvas-insert-type'),select=document.querySelector('#canvas-insert-field');kind.value='field';kind.onchange();select.value=entry.value;select.dispatchEvent(new Event('change',{bubbles:true}));if(select.value!==entry.value){status.textContent='この位置では使えない項目です。くり返しの内側を選んでください。';return;}document.querySelector('#word-field-part').value=state.part;document.querySelector('#canvas-insert').click();status.textContent='「'+title.textContent+'」を差し込みました。';
   };results.append(b);}
  if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent=entries.length?'一致する項目がありません。':'「要件を定義」で項目を追加してください。';results.append(p);}
 }
 search.oninput=()=>{state.query=search.value;sync();};part.onchange=()=>{state.part=part.value;};
 search.onkeydown=e=>{if(e.isComposing||e.keyCode===229)return;if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}else if(e.key==='Enter'&&results.children.length===1&&results.firstElementChild.matches('button')){e.preventDefault();results.firstElementChild.click();}};
 results.onkeydown=e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...results.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);e.preventDefault();if(e.key==='ArrowUp'&&index===0){search.focus();return;}buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)))]?.focus();};
 dock.onkeydown=e=>{if(!e.isComposing&&e.keyCode!==229&&e.key==='Escape'){e.preventDefault();e.stopPropagation();open(false,true);}};
 sync();return {trigger,sync,hide:()=>open(false),destroy(){dock.remove();}};
}
Object.assign(D,{mountWordFieldDock});
})(globalThis);
