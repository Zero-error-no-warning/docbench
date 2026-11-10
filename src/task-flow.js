/* Focused list/detail navigation; document and history remain independent. */
(function(root){
'use strict';const D=root.DocBench,panes=new Map(),focusNext=new Map(),pinKey='docbench:workspacePinned';
function setTaskPane(id,screen,pane){panes.set(id+':'+screen,pane);}
function revealTaskInspector(host){const work=host.querySelector('.rule-workbench.task-focused');if(!work)return;setTaskPane(host.dataset.definitionId,'rules','edit');work.dataset.taskPane='edit';work.querySelector('.flow-source').hidden=true;work.querySelector('.flow-settings').hidden=false;const edit=work.querySelector('[data-task-edit]');if(edit)edit.disabled=false;}
function mountTaskFlow(host,screen,definition,cfg){
 const work=host.querySelector(':scope > .builder,:scope > .rule-workbench');if(!work||!['types','definition','rules'].includes(screen))return;
 const library=screen==='types',rule=screen==='rules',source=rule?work.querySelector('.rule-palette'):work.children[0],settings=rule?work.querySelector('.rule-properties'):work.children[1],key=definition.id+':'+screen;
 let pinned=!rule&&innerWidth>1100;
 try{const preference=localStorage.getItem(pinKey);if(!rule&&preference!==null)pinned=preference==='true'&&innerWidth>850;}catch{}
 source.classList.add('flow-source');settings.classList.add('flow-settings');work.classList.toggle('task-focused',!pinned);work.dataset.flowLayout=pinned?'pinned':'focused';
 if(!panes.has(key))panes.set(key,'list');
 function show(pane,focus){panes.set(key,pane);work.dataset.taskPane=pane;source.hidden=pane!=='list';settings.hidden=!source.hidden;const target=focus?host.querySelector(focus.selector):settings.querySelector('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');if(target?.checkVisibility())target.focus({preventScroll:true});}
 function button(text,attrs,run){const b=document.createElement('button');b.type='button';b.textContent=text;for(const [k,v]of Object.entries(attrs||{}))b.setAttribute(k,v);b.onclick=run;return b;}
 if(!rule){
  const pin=button(pinned?'一覧と設定を切り替える':'一覧と設定を並べる',{'data-pin-workbench':'','aria-pressed':String(pinned)},()=>{
   try{localStorage.setItem(pinKey,String(!pinned));}catch{}cfg.render();
  });
  pin.className='editor-layout-toggle';host.append(pin);
 }
 if(!rule)source.addEventListener('click',event=>{
  if(event.target.closest('.tree-toggle'))return;
  const target=event.target.closest('[data-select],[data-type-select],[data-type-field],#add-field,#type-add');
  if(!target)return;
  panes.set(key,'edit');
  if(!pinned||target.id)focusNext.set(key,{selector:target.id==='add-field'?'[data-prop=label]':target.id==='type-add'?'#type-name':'.selection-context',select:!!target.id});
 },{capture:true});
 const restoreFocus=()=>{
  const pending=focusNext.get(key);if(!pending)return;
  focusNext.delete(key);
  queueMicrotask(()=>{const target=host.querySelector(pending.selector);if(target?.checkVisibility()){
   if(target.classList.contains('selection-context'))target.tabIndex=-1;
   target.focus({preventScroll:true});if(pending.select&&target.select)target.select();
  }});
 };
 if(pinned){source.hidden=settings.hidden=false;restoreFocus();return;}
 work.dataset.taskPane=panes.get(key);source.hidden=panes.get(key)!=='list';settings.hidden=!source.hidden;
 const back=button(rule?'＋ ノードを追加':library?'← 型・子項目を選ぶ':'← 入力項目の一覧',{'data-task-back':''},()=>show('list',{selector:rule?'#rule-source-field':'#workbench-list-search'}));settings.querySelector('.panel-head').prepend(back);
 if(rule){const edit=button('選択した条件を編集',{'data-task-edit':''},()=>show('edit'));source.querySelector('.panel-head').append(edit);edit.disabled=!cfg.ruleSelected;return;}
 const next=button('書類での表示を設計する',{'data-task-next':''},()=>document.querySelector('[data-view=render]').click());next.className='primary';
 const footer=document.createElement('div');footer.className='workbench-flow-footer';const note=document.createElement('p');note.textContent=library?'入力の形を定義したら、「要件を定義」で書類の項目として使えます。':'集める情報を定義したら、書類のどこへ表示するかを設定します。';footer.append(note,library?button('要件の項目を定義する',{'data-task-next':''},()=>document.querySelector('[data-view=definition]').click()):next);source.append(footer);
 const done=document.createElement('div');done.className='workbench-flow-footer edit-footer';done.append(button('一覧に戻る',{'data-task-done':''},()=>show('list',{selector:'#workbench-list-search'})));settings.append(done);
 const head=settings.querySelector('.panel-head h3');if(head)head.textContent=library?'型の設定':'項目の設定';for(const h of settings.querySelectorAll('.panel-body > h3'))if(h.textContent.startsWith('選択中：'))h.remove();
 const body=settings.querySelector('.panel-body');
 if(library&&body){const items=[...source.querySelectorAll('[data-type-field]')];if(items.length>1){const label=document.createElement('label');label.textContent='編集する部分';const select=document.createElement('select');select.id='task-type-part';for(const item of items){const option=document.createElement('option');option.value=item.dataset.typeField;option.textContent=item.querySelector('strong').textContent;option.selected=item.classList.contains('selected');select.append(option);}label.append(select);body.prepend(label);select.onchange=()=>source.querySelector('[data-type-field="'+CSS.escape(select.value)+'"]')?.click();}}

 for(const b of settings.querySelectorAll('#add-child,#type-add-child'))b.addEventListener('click',()=>{panes.set(key,'edit');focusNext.set(key,{selector:library?'[data-type-prop=label]':'[data-prop=label]',select:true});},{capture:true});
 restoreFocus();
}
function mountInputSections(host){
 const pane=host.querySelector('.form-grid > .panel:first-child > .panel-body');if(!pane)return;
 const sections=[...pane.querySelectorAll('.form-section')],labels=sections.map((s,i)=>s.querySelector('h3')?.textContent||'項目 '+(i+1));let nav=pane.querySelector(':scope > .input-section-navigation');
 if(sections.length<2){nav?.remove();return;}
 if(!nav){nav=document.createElement('nav');nav.className='input-section-navigation';nav.setAttribute('aria-label','入力箇所へ移動');nav.innerHTML='<label>入力箇所へ移動<select><option value="">セクションを選ぶ</option></select></label>';pane.prepend(nav);const select=nav.querySelector('select');select.onchange=()=>{const current=[...pane.querySelectorAll('.form-section')],section=current[Number(select.value)];if(select.value!==''&&section){const a=section.getBoundingClientRect(),b=pane.getBoundingClientRect();pane.scrollTop+=a.top-b.top-nav.offsetHeight-12;}};}
 const select=nav.querySelector('select'),signature=JSON.stringify(labels);if(select.dataset.sections!==signature){const previous=select.value!==''?select.selectedOptions[0]?.textContent:null;select.innerHTML='<option value="">セクションを選ぶ</option>'+labels.map((name,i)=>'<option value="'+i+'">'+D.esc(name)+'</option>').join('');select.value=previous&&labels.includes(previous)?String(labels.indexOf(previous)):'';select.dataset.sections=signature;}
}
Object.assign(D,{mountTaskFlow,setTaskPane,revealTaskInspector,mountInputSections});
})(globalThis);
