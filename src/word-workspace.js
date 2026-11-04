/* Task-oriented Word controls; view preferences never enter the document model. */
(function(root){
'use strict';const D=root.DocBench;
function mountWordWorkspace(cfg){
 const toolbar=document.querySelector('.word-toolbar'),surface=document.querySelector('#document-preview');
 if(!toolbar||!surface)return null;
 const selection=toolbar.querySelector('.canvas-selection'),rows=[...toolbar.children].filter(el=>el.classList.contains('word-toolbar-row'));
 const section=(title,nodes)=>{const group=document.createElement('section');group.className='word-task-section';const h=document.createElement('h4');h.textContent=title;group.append(h,...nodes);return group;};
 const label=(id,text)=>{const input=toolbar.querySelector('#'+id),wrapper=document.createElement('label'),caption=document.createElement('span');caption.textContent=text;input.before(wrapper);wrapper.append(caption,input);};
 label('word-heading','スタイル');label('canvas-font','フォント');label('canvas-font-size','サイズ（pt）');
 const paragraph=rows[1],insertions=[...paragraph.querySelectorAll(':scope > .word-merge-tools,:scope > details:last-child')];
 const fontGroup=section('文字の書式',[rows[0]]),paragraphGroup=section('段落',[paragraph]),insertGroup=section('挿入',[...insertions]);
 selection.after(fontGroup,paragraphGroup,insertGroup);
 for(const [name,title] of [['indent','インデントを増やす'],['outdent','インデントを減らす']]){const button=toolbar.querySelector('[data-word-command="'+name+'"]');button.title=title;button.setAttribute('aria-label',title);}
 const zoom=toolbar.querySelector('#canvas-zoom');zoom.innerHTML='<option value="0">幅に合わせる</option>'+[50,75,100,125,150,200].map(n=>'<option value="'+n+'">'+n+'%</option>').join('');zoom.value=String(cfg.zoom());
 const modes=document.createElement('div');modes.className='word-view-switch';modes.setAttribute('role','group');modes.setAttribute('aria-label','Wordの表示');
 modes.innerHTML='<button type="button" id="word-view-edit" aria-controls="document-preview" aria-pressed="true">本文を編集</button><button type="button" id="word-view-result" aria-controls="word-result-preview" aria-pressed="false">入力データで確認</button>';
 const navigation=document.createElement('div');navigation.className='word-workspace-nav';
 const shortcuts=document.createElement('nav');shortcuts.className='word-task-shortcuts';shortcuts.setAttribute('aria-label','Word編集ツールの移動');
 shortcuts.innerHTML=['文字','段落','挿入','ページ'].map((name,i)=>'<button type="button" data-word-task="'+i+'">'+name+'</button>').join('');
 navigation.append(modes,shortcuts);selection.before(navigation);
 const frame=surface.parentElement,result=document.createElement('iframe');result.id='word-result-preview';result.title='入力データを反映したWordの仕上がり';result.className='paper';result.setAttribute('sandbox','');result.hidden=true;frame.append(result);
 const note=document.createElement('p');note.className='word-result-note';note.hidden=true;note.textContent='入力中のデータを反映しています。改ページ・折り返しの最終確認は、出力したWordで行ってください。';modes.after(note);
 const inspector=document.querySelector('.design-inspector'),properties=document.querySelector('#design-properties');
 const editable=[selection,fontGroup,paragraphGroup,insertGroup,inspector,...toolbar.querySelectorAll('#word-table-tools,#word-range-tools,#word-block-tools'),toolbar.querySelector(':scope > .canvas-hint')].filter(Boolean);
 let resultURL=null,saved=null,previewing=false;
 const release=()=>{if(resultURL){URL.revokeObjectURL(resultURL);resultURL=null;}};
 function showResult(show){
  if(show){let html;try{html=cfg.preview();}catch(err){cfg.notify(err.message);return;}saved=cfg.controller()?.capture();release();resultURL=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));result.src=resultURL;}
  previewing=show;surface.hidden=show;result.hidden=!show;note.hidden=!show;if(properties)properties.disabled=show;
  for(const item of editable)item.classList.toggle('word-preview-hidden',show);
  shortcuts.hidden=show;modes.querySelector('#word-view-edit').setAttribute('aria-pressed',String(!show));modes.querySelector('#word-view-result').setAttribute('aria-pressed',String(show));
  if(!show){release();result.removeAttribute('src');cfg.controller()?.restore(saved);saved=null;}
 }
 for(const button of modes.querySelectorAll('button'))button.onmousedown=event=>event.preventDefault();
 modes.querySelector('#word-view-edit').onclick=()=>{if(previewing)showResult(false);};modes.querySelector('#word-view-result').onclick=()=>{if(!previewing)showResult(true);};
 const page=document.createElement('details');page.className='word-task-section word-page-settings';page.dataset.disclosure='word-page-settings';
 page.innerHTML='<summary>ページ設定</summary><p class="canvas-hint">用紙・余白は文書全体に適用します。</p><div class="word-page-grid"><label>用紙<select data-word-page="pageSize"><option>A4</option><option>Letter</option></select></label><label>印刷の向き<select data-word-page="orientation"><option value="portrait">縦</option><option value="landscape">横</option></select></label><label class="word-margin-preset">余白<select id="word-margin-preset"><option value="custom">ユーザー設定</option><option value="normal">標準（上下左右 25.4 mm）</option><option value="narrow">狭い（上下左右 12.7 mm）</option><option value="wide">広い（左右 50.8 mm）</option></select></label>'+[['marginTop','上'],['marginBottom','下'],['marginLeft','左'],['marginRight','右']].map(([key,title])=>'<label>'+title+'余白（mm）<input data-word-page="'+key+'" type="number" min="0" max="100" step="0.1"></label>').join('')+'</div><p id="word-page-summary" class="canvas-hint"></p>';
 insertGroup.after(page);editable.push(page);
 [...shortcuts.children].forEach((button,i)=>{button.onmousedown=event=>event.preventDefault();button.onclick=()=>{const target=[fontGroup,paragraphGroup,insertGroup,page][i];if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start'});};});
 const presets={normal:{marginTop:25.4,marginBottom:25.4,marginLeft:25.4,marginRight:25.4},narrow:{marginTop:12.7,marginBottom:12.7,marginLeft:12.7,marginRight:12.7},wide:{marginTop:25.4,marginBottom:25.4,marginLeft:50.8,marginRight:50.8}};
 function apply(patch){
  const settings={...D.settings({...cfg.design(),outputFormat:'docx'}),...patch},size=settings.pageSize==='Letter'?[215.9,279.4]:[210,297];if(settings.orientation==='landscape')size.reverse();
  if(settings.marginLeft+settings.marginRight>=size[0]||settings.marginTop+settings.marginBottom>=size[1]){cfg.notify('余白が大きすぎます。本文を配置できる幅・高さを残してください。');sync();return;}
  cfg.changeSettings(patch);sync();
 }
 for(const input of page.querySelectorAll('[data-word-page]'))input.onchange=()=>{if(!input.checkValidity()||input.value===''){input.reportValidity();return;}apply({[input.dataset.wordPage]:input.type==='number'?input.valueAsNumber:input.value});};
 page.querySelector('#word-margin-preset').onchange=ev=>{if(presets[ev.target.value])apply(presets[ev.target.value]);};
 function sync(){
  const settings=D.settings({...cfg.design(),outputFormat:'docx'});
  for(const input of page.querySelectorAll('[data-word-page]'))if(input!==document.activeElement)input.value=settings[input.dataset.wordPage];
  page.querySelector('#word-margin-preset').value=Object.keys(presets).find(key=>Object.entries(presets[key]).every(([k,v])=>Math.abs(settings[k]-v)<.01))||'custom';
  page.querySelector('#word-page-summary').textContent=settings.pageSize+'・'+(settings.orientation==='landscape'?'横':'縦')+'／余白：上 '+settings.marginTop+'、下 '+settings.marginBottom+'、左 '+settings.marginLeft+'、右 '+settings.marginRight+' mm';
  const editor=cfg.controller()?.activeEditor?.(),status=selection.querySelector('#canvas-selection');
  if(editor){const range=editor.state.selection;status.textContent=range.empty?(editor.isActive('table')?'表のセルを編集中':'本文を編集中'):'選択中：'+editor.state.doc.textBetween(range.from,range.to,'\n').length+'文字';}
 }
 sync();return {sync,destroy(){release();result.remove();},isPreview:()=>previewing};
}
Object.assign(D,{mountWordWorkspace});
})(globalThis);
