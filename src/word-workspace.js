/* Task-oriented Word controls; view preferences never enter the document model. */
(function(root){
'use strict';const D=root.DocBench;let preferredTab='home';
function mountWordWorkspace(cfg){
 const toolbar=document.querySelector('.word-toolbar'),surface=document.querySelector('#document-preview');
 if(!toolbar||!surface)return null;
 const selection=toolbar.querySelector('.canvas-selection'),rows=[...toolbar.children].filter(el=>el.classList.contains('word-toolbar-row'));
 const section=(title,nodes)=>{const group=document.createElement('section');group.className='word-task-section';const h=document.createElement('h4');h.textContent=title;group.append(h,...nodes);return group;};
 const label=(id,text)=>{const input=toolbar.querySelector('#'+id),wrapper=document.createElement('label'),caption=document.createElement('span');caption.textContent=text;input.before(wrapper);wrapper.append(caption,input);};
 label('word-heading','スタイル');label('canvas-font','フォント');label('canvas-font-size','サイズ（pt）');label('canvas-insert-type','追加するもの');label('canvas-insert-field','要件で定義した項目');label('word-field-part','文書に表示するもの');
 const paragraph=rows[1],insertions=[...paragraph.querySelectorAll(':scope > .word-merge-tools,:scope > details:last-child')];
 const fontGroup=section('文字の書式',[rows[0]]),paragraphGroup=section('段落',[paragraph]),insertGroup=section('挿入',[...insertions]);
 selection.after(fontGroup,paragraphGroup,insertGroup);
 for(const [name,title] of [['indent','インデントを増やす'],['outdent','インデントを減らす']]){const button=toolbar.querySelector('[data-word-command="'+name+'"]');button.title=title;button.setAttribute('aria-label',title);}
 const zoom=toolbar.querySelector('#canvas-zoom');zoom.innerHTML='<option value="0">幅に合わせる</option>'+[50,75,100,125,150,200].map(n=>'<option value="'+n+'">'+n+'%</option>').join('');zoom.value=String(cfg.zoom());
 const modes=document.createElement('div');modes.className='word-view-switch';modes.setAttribute('role','group');modes.setAttribute('aria-label','Wordの表示');
 modes.innerHTML='<button type="button" id="word-view-edit" aria-controls="document-preview" aria-pressed="true">本文を編集</button><button type="button" id="word-view-result" aria-controls="word-result-preview" aria-pressed="false">入力データで確認</button>';
 const navigation=document.createElement('div');navigation.className='word-workspace-nav';
 const shortcuts=document.createElement('div');shortcuts.className='word-editor-tabs';shortcuts.setAttribute('role','tablist');shortcuts.setAttribute('aria-label','Word編集の操作');
 const tabNames=[['home','ホーム','0'],['insert','差込み・挿入','2'],['layout','レイアウト','3'],['table','表','4'],['object','要素','5'],['range','くり返し・表示条件','6']];
 shortcuts.innerHTML=tabNames.map(([id,name,old])=>'<button type="button" role="tab" id="word-tab-'+id+'" data-word-tab="'+id+'" data-word-task="'+old+'" aria-controls="word-panel-'+id+'" aria-selected="false" tabindex="-1">'+name+'</button>').join('');
 navigation.append(modes,shortcuts);selection.before(navigation);
 const frame=surface.parentElement,result=document.createElement('iframe');result.id='word-result-preview';result.title='入力データを反映したWordの仕上がり';result.className='paper';result.setAttribute('sandbox','');result.hidden=true;frame.append(result);
 const note=document.createElement('p');note.className='word-result-note';note.hidden=true;note.textContent='入力中のデータを反映しています。改ページ・折り返しの最終確認は、出力したWordで行ってください。';modes.after(note);
 const inspector=document.querySelector('.design-inspector'),properties=document.querySelector('#design-properties');
 const editable=[fontGroup,paragraphGroup,insertGroup,inspector,...toolbar.querySelectorAll('#word-table-tools,#word-range-tools,#word-block-tools'),toolbar.querySelector(':scope > .canvas-hint')].filter(Boolean);
 let resultURL=null,saved=null,previewing=false;
 const release=()=>{if(resultURL){URL.revokeObjectURL(resultURL);resultURL=null;}};
 function showResult(show){
  if(show){let html;try{html=cfg.preview();}catch(err){cfg.notify(err.message);return;}saved=cfg.controller()?.capture();release();resultURL=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));result.src=resultURL;}
  previewing=show;if(show)fieldDock.hide();surface.hidden=show;result.hidden=!show;note.hidden=!show;if(properties)properties.disabled=show;toolbar.closest('.word-workbench').classList.toggle('word-proof-mode',show);selection.querySelector('#word-write').hidden=show;zoom.disabled=show;
  for(const item of editable)item.classList.toggle('word-preview-hidden',show);
  shortcuts.hidden=show;modes.querySelector('#word-view-edit').setAttribute('aria-pressed',String(!show));modes.querySelector('#word-view-result').setAttribute('aria-pressed',String(show));
  if(!show){release();result.removeAttribute('src');cfg.controller()?.restore(saved);saved=null;}sync();
 }
 for(const button of modes.querySelectorAll('button'))button.onmousedown=event=>event.preventDefault();
 modes.querySelector('#word-view-edit').onclick=()=>{if(previewing)showResult(false);};modes.querySelector('#word-view-result').onclick=()=>{if(!previewing)showResult(true);};
 const page=document.createElement('details');page.className='word-task-section word-page-settings';page.dataset.disclosure='word-page-settings';
 page.innerHTML='<summary>ページ設定</summary><p class="canvas-hint">用紙・余白は文書全体に適用します。</p><div class="word-page-grid"><label>用紙<select data-word-page="pageSize"><option>A4</option><option>Letter</option></select></label><label>印刷の向き<select data-word-page="orientation"><option value="portrait">縦</option><option value="landscape">横</option></select></label><label class="word-margin-preset">余白<select id="word-margin-preset"><option value="custom">ユーザー設定</option><option value="normal">標準（上下左右 25.4 mm）</option><option value="narrow">狭い（上下左右 12.7 mm）</option><option value="wide">広い（左右 50.8 mm）</option></select></label>'+[['marginTop','上'],['marginBottom','下'],['marginLeft','左'],['marginRight','右']].map(([key,title])=>'<label>'+title+'余白（mm）<input data-word-page="'+key+'" type="number" min="0" max="100" step="0.1"></label>').join('')+'</div><p id="word-page-summary" class="canvas-hint"></p>';
 insertGroup.after(page);editable.push(page);
 const controls=toolbar.closest('.output-controls'),grid=controls.parentElement,stage=grid.querySelector('.output-stage'),head=controls.querySelector(':scope > .panel-head');
 const fileMenu=controls.querySelector('.output-document-settings'),manager=fileMenu.querySelector('.document-manager'),documentLabel=manager.querySelector('label'),fileActions=document.createElement('div');
 fileMenu.className='action-menu word-file-menu';fileMenu.querySelector(':scope > summary').textContent='ファイル';fileActions.className='word-file-actions';
 const add=manager.querySelector('#document-add');if(add)fileActions.append(add);for(const button of manager.querySelectorAll('.action-menu-body button'))fileActions.append(button);fileMenu.append(fileActions);manager.remove();
 const bar=document.createElement('div');bar.className='word-document-bar';documentLabel.classList.add('word-document-selector');bar.append(fileMenu,documentLabel);
 const formatLabel=document.createElement('label');formatLabel.className='word-format-selector';formatLabel.innerHTML='<span>出力形式</span><select id="word-output-format" aria-label="出力形式">'+D.formats.map(f=>'<option value="'+f+'"'+(f==='docx'?' selected':'')+'>'+D.esc(D.formatNames[f])+'</option>').join('')+'</select>';
 const formats=controls.querySelector(':scope > .format-choices');fileActions.append(formats);bar.append(formatLabel);formatLabel.querySelector('select').onchange=ev=>formats.querySelector('[data-design-format="'+ev.target.value+'"]').click();
 const headActions=head.querySelector('.button-row');headActions.classList.add('word-document-actions');if(properties){properties.textContent='詳細設定';properties.setAttribute('aria-controls','word-details-panel');inspector.id='word-details-panel';}
 headActions.querySelector('#design-export').textContent='Wordを出力';bar.append(modes,headActions);head.remove();controls.prepend(bar);
 const status=document.createElement('div');status.className='word-editor-status';status.append(selection);selection.querySelector('#word-write').textContent='本文へ戻る';grid.append(status);
 const panels=document.createElement('div');panels.className='word-ribbon-panels';const panes=new Map();
 for(const [id]of tabNames){const pane=document.createElement('section');pane.id='word-panel-'+id;pane.dataset.wordPanel=id;pane.className='word-ribbon-panel';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','word-tab-'+id);panes.set(id,pane);panels.append(pane);}
 panes.get('home').append(fontGroup,paragraphGroup);panes.get('insert').append(insertGroup);panes.get('layout').append(page);page.open=true;page.querySelector('summary').hidden=true;
 for(const [id,selector]of [['table','#word-table-tools'],['object','#word-block-tools'],['range','#word-range-tools']])panes.get(id).append(toolbar.querySelector(selector));
 const pageBreak=paragraphGroup.querySelector('[data-word-command="pageBreak"]');if(pageBreak)insertGroup.append(pageBreak);
 const mergeTools=insertGroup.querySelector('.word-merge-tools');mergeTools.open=true;mergeTools.querySelector('summary').hidden=true;
 // Separate choosing a requirement from adding ordinary prose or a table.
 insertGroup.querySelector(':scope > h4').hidden=true;
 const insertion=mergeTools.querySelector('.word-insertion'),kind=insertion.querySelector('#canvas-insert-type'),part=insertion.querySelector('#word-field-part'),insert=insertion.querySelector('#canvas-insert'),rules=mergeTools.querySelector('.button-row');
 const fieldPicker=D.mountFieldPicker(insertion.querySelector('#canvas-insert-field'),{label:'要件で定義した項目',definition:cfg.definition,onOpen:()=>cfg.controller()?.holdSelection?.(),scopes:()=>cfg.controller()?.controlScopes?.()||[]});
 kind.closest('label').hidden=true;part.options[0].textContent='入力された値';part.options[1].textContent='項目名（見出し用）';
 const fieldsTitle=document.createElement('h4');fieldsTitle.id='word-insertion-title';fieldsTitle.textContent='要件の入力値を差し込む';
 const source=document.createElement('div');source.className='word-binding-source';source.innerHTML='<span id="word-binding-example"></span><button type="button" id="word-binding-definition">この項目の要件を開く</button>';
 insertion.before(fieldsTitle);insertion.after(source);
 const rulesSection=section('文章・表のくり返しと表示条件',[rules]);rulesSection.classList.add('word-control-actions');
 rules.querySelector('#word-repeat-insert').textContent='件数分くり返す';rules.querySelector('#word-condition-insert').textContent='条件で表示を切り替える';
 const ruleHint=document.createElement('p');ruleHint.className='canvas-hint';ruleHint.textContent='対象にしたい段落・表を選んでから設定します。未選択なら、文章を書き込む枠を追加します。';rulesSection.append(ruleHint);
 const ordinary=section('文章・表を追加',[]);ordinary.classList.add('word-ordinary-insert');
 for(const [value,title]of [['heading','見出し'],['text','文章'],['table','要件の一覧を表にする']]){const button=document.createElement('button');button.type='button';button.textContent=title;button.onmousedown=ev=>ev.preventDefault();button.onclick=()=>{kind.value=value;kind.onchange();if(value!=='table'){insert.click();kind.value='field';kind.onchange();}else advanced.open=true;};ordinary.append(button);}
 const back=document.createElement('button');back.type='button';back.id='word-insert-values';back.textContent='入力値の差込みへ戻る';back.onclick=()=>{kind.value='field';kind.onchange();};source.append(back);
 for(const node of [...insertGroup.children])if(node!==mergeTools&&node.tagName!=='H4')ordinary.append(node);
 insertGroup.append(rulesSection,ordinary);
 const fieldDock=D.mountWordFieldDock({stage,definition:cfg.definition,controller:cfg.controller,fields:cfg.fields});
 const advanced=document.createElement('details');advanced.className='ribbon-details word-insertion-advanced';advanced.dataset.disclosure='word-insertion-advanced';advanced.innerHTML='<summary>項目名・一覧表などの差し込み</summary>';mergeTools.before(fieldDock.trigger,advanced);const advancedBody=document.createElement('div');advancedBody.className='ribbon-popup';advancedBody.append(mergeTools);advanced.append(advancedBody);
 const hint=toolbar.querySelector(':scope > .canvas-hint');if(hint)hint.remove();toolbar.replaceChildren(shortcuts,panels);controls.append(note);navigation.remove();
 const closeSettings=document.createElement('button');closeSettings.className='word-details-close';closeSettings.textContent='設定を閉じる';closeSettings.onclick=()=>properties?.click();inspector.querySelector('.panel-head').append(closeSettings);
 for(const button of toolbar.querySelectorAll('[data-canvas-align]')){const align=button.dataset.canvasAlign,title=button.textContent;button.title=title;button.setAttribute('aria-label',title);const widths=align==='justify'?[16,16,16,16]:[16,11,16,11];button.innerHTML='<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">'+widths.map((w,i)=>'<path d="M'+(align==='center'?(20-w)/2:align==='right'?18-w:2)+' '+(4+i*4)+'h'+w+'" stroke="currentColor" stroke-width="1.7"/>').join('')+'</svg>';}
 const buttons=[...shortcuts.children];let currentTab=preferredTab;
 function setTab(id,focus=false){if(currentTab!==id)for(const popup of toolbar.querySelectorAll('.ribbon-details:not(.word-merge-tools)[open]'))popup.open=false;currentTab=id;if(['home','insert','layout'].includes(id))preferredTab=id;for(const button of buttons){const selected=button.dataset.wordTab===id;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}for(const [key,pane]of panes)pane.hidden=key!==id;if(focus)shortcuts.querySelector('[data-word-tab="'+id+'"]').focus({preventScroll:true});}
 for(const button of buttons){button.onmousedown=event=>event.preventDefault();button.onclick=()=>setTab(button.dataset.wordTab);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const available=buttons.filter(b=>!b.hidden),index=available.indexOf(button),next=event.key==='Home'?available[0]:event.key==='End'?available.at(-1):available[(index+(event.key==='ArrowRight'?1:-1)+available.length)%available.length];setTab(next.dataset.wordTab,true);};}setTab(currentTab);
 const placePopup=detail=>{
  const popup=detail.querySelector(':scope > .ribbon-popup'),anchor=detail.querySelector(':scope > summary');if(!popup||!anchor||!detail.open)return;
  const viewport=window.visualViewport,left=(viewport?.offsetLeft||0)+8,top=(viewport?.offsetTop||0)+8,right=left+(viewport?.width||innerWidth)-16,bottom=top+(viewport?.height||innerHeight)-16,rect=anchor.getBoundingClientRect();
  if(rect.right<left||rect.left>right||rect.bottom<top||rect.top>bottom){detail.open=false;return;}
  popup.dataset.wordFloating='';popup.style.setProperty('--word-popup-width',Math.max(0,right-left)+'px');popup.style.setProperty('--word-popup-height',Math.max(0,bottom-top)+'px');
  const box=popup.getBoundingClientRect(),below=Math.max(0,bottom-rect.bottom-6),above=Math.max(0,rect.top-top-6),down=box.height<=below||below>=above;
  popup.style.setProperty('--word-popup-height',Math.min(bottom-top,Math.max(40,down?below:above))+'px');
  const height=popup.getBoundingClientRect().height;
  popup.style.setProperty('--word-popup-left',Math.max(left,Math.min(rect.left,right-popup.getBoundingClientRect().width))+'px');popup.style.setProperty('--word-popup-top',Math.max(top,Math.min(down?rect.bottom+6:rect.top-6-height,bottom-height))+'px');
 };
 const repositionPopups=()=>{for(const detail of toolbar.querySelectorAll('.ribbon-details:not(.word-merge-tools)[open]'))placePopup(detail);};
 const events=new AbortController();toolbar.addEventListener('toggle',event=>{if(event.target.matches('.ribbon-details:not(.word-merge-tools)'))placePopup(event.target);},{capture:true,signal:events.signal});window.addEventListener('resize',repositionPopups,{signal:events.signal});document.addEventListener('scroll',repositionPopups,{capture:true,signal:events.signal});window.visualViewport?.addEventListener('resize',repositionPopups,{signal:events.signal});document.addEventListener('pointerdown',event=>{for(const detail of toolbar.querySelectorAll('.ribbon-details:not(.word-merge-tools)[open]'))if(!detail.contains(event.target))detail.open=false;},{signal:events.signal});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const opened=[...toolbar.querySelectorAll('.ribbon-details:not(.word-merge-tools)[open]')].at(-1);if(opened){event.preventDefault();opened.open=false;opened.querySelector('summary').focus({preventScroll:true});}else if(properties?.getAttribute('aria-expanded')==='true'){event.preventDefault();properties.click();properties.focus({preventScroll:true});}},{signal:events.signal});
 const presets={normal:{marginTop:25.4,marginBottom:25.4,marginLeft:25.4,marginRight:25.4},narrow:{marginTop:12.7,marginBottom:12.7,marginLeft:12.7,marginRight:12.7},wide:{marginTop:25.4,marginBottom:25.4,marginLeft:50.8,marginRight:50.8}};
 function apply(patch){
  const settings={...D.settings({...cfg.design(),outputFormat:'docx'}),...patch},size=settings.pageSize==='Letter'?[215.9,279.4]:[210,297];if(settings.orientation==='landscape')size.reverse();
  if(settings.marginLeft+settings.marginRight>=size[0]||settings.marginTop+settings.marginBottom>=size[1]){cfg.notify('余白が大きすぎます。本文を配置できる幅・高さを残してください。');sync();return;}
  cfg.changeSettings(patch);sync();
 }
 for(const input of page.querySelectorAll('[data-word-page]'))input.onchange=()=>{if(!input.checkValidity()||input.value===''){input.reportValidity();return;}apply({[input.dataset.wordPage]:input.type==='number'?input.valueAsNumber:input.value});};
 page.querySelector('#word-margin-preset').onchange=ev=>{if(presets[ev.target.value])apply(presets[ev.target.value]);};
 function sync(){
  fieldDock.sync();const settings=D.settings({...cfg.design(),outputFormat:'docx'});
  for(const input of page.querySelectorAll('[data-word-page]'))if(input!==document.activeElement)input.value=settings[input.dataset.wordPage];
  page.querySelector('#word-margin-preset').value=Object.keys(presets).find(key=>Object.entries(presets[key]).every(([k,v])=>Math.abs(settings[k]-v)<.01))||'custom';
  page.querySelector('#word-page-summary').textContent=settings.pageSize+'・'+(settings.orientation==='landscape'?'横':'縦')+'／余白：上 '+settings.marginTop+'、下 '+settings.marginBottom+'、左 '+settings.marginLeft+'、右 '+settings.marginRight+' mm';
  const editor=cfg.controller()?.activeEditor?.(),status=selection.querySelector('#canvas-selection');
  if(previewing)status.textContent='入力データを反映した確認表示（編集不可）';else if(editor){const range=editor.state.selection;status.textContent=range.empty?(editor.isActive('table')?'表のセルを編集中':'本文を編集中'):'選択中：'+editor.state.doc.textBetween(range.from,range.to,'\n').length+'文字';}
  const contexts={table:!!editor?.isActive('table'),object:!panes.get('object').querySelector('#word-block-tools').hidden,range:!panes.get('range').querySelector('#word-range-tools').hidden};for(const [id,available]of Object.entries(contexts)){shortcuts.querySelector('[data-word-tab="'+id+'"]').hidden=!available;if(!available&&currentTab===id)setTab('home');}
 }
 sync();return {sync,tab:()=>currentTab,restoreTab:id=>{const button=shortcuts.querySelector('[data-word-tab="'+id+'"]');if(button&&!button.hidden)setTab(id);},destroy(){fieldDock.destroy();fieldPicker.destroy();events.abort();release();result.remove();},isPreview:()=>previewing};
}
Object.assign(D,{mountWordWorkspace});
})(globalThis);
