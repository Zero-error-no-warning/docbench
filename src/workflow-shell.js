/* Shared roles: a selected target, editing, an independent result, and explicit definition commits. */
(function(root){
'use strict';const D=root.DocBench;
const stages={types:['型定義','再利用する入力の形と規則'],definition:['要件定義','この書類で集める情報'],rules:['条件定義','いつ表示・必須・出力するか'],form:['入力・書類作成','実際の値を入力して書類を作成']};
function mountWorkflowShell(host,screen,cfg={}){
 const stage=stages[screen];document.body.classList.toggle('workflow-screen',!!stage);document.body.dataset.workflow=stage?screen:'';if(!stage)return;
 const bar=document.createElement('div');bar.className='workflow-stage-bar';bar.innerHTML='<strong>'+D.esc(cfg.context?'型の表示条件':stage[0])+'</strong><span>'+D.esc(cfg.context||stage[1])+'</span>';if(cfg.back){const back=document.createElement('button');back.type='button';back.className='workflow-return';back.textContent=cfg.context?'型の設定へ戻る':'元の対象へ戻る';back.onclick=cfg.back;bar.append(back);}host.prepend(bar);
 for(const footer of host.querySelectorAll('.flow-source>.workbench-flow-footer')){footer.querySelector('p')?.remove();for(const button of footer.querySelectorAll('button'))button.classList.remove('primary');}
 const settings=host.querySelector('.flow-settings');if(settings){settings.querySelector('.edit-footer')?.remove();const context=settings.querySelector('.selection-context');if(context)context.classList.add('workflow-target');}
 D.mountDefinitionPreview(host,screen,bar);
 if(screen==='rules'){
  const source=host.querySelector('.rule-palette'),inspector=host.querySelector('.rule-properties'),work=host.querySelector('.rule-workbench');work.classList.add('workflow-rule-workbench');
  const canvas=host.querySelector('#rule-canvas'),area=document.createElement('div');area.className='workflow-rule-canvas-area';canvas.before(area);area.append(canvas,host.querySelector('.rule-minimap-panel'));
  const navigation=host.querySelector('.rule-search'),tools=document.createElement('div');tools.className='workflow-rule-viewport-tools';for(const id of ['rule-arrange','rule-fit','rule-zoom-out','rule-zoom-in']){const button=host.querySelector('#'+id);if(button)tools.append(button);}navigation.append(tools);
  const back=inspector.querySelector('[data-task-back]');if(back)back.textContent='ノードを追加';source.querySelector('.panel-head h3').textContent='ノードを追加';
  const add=source.querySelector('.panel-body'),buttons=[...add.querySelectorAll('[data-add-rule]')];if(buttons.length){const label=document.createElement('label'),select=document.createElement('select'),confirm=document.createElement('button');label.textContent='追加するノード';select.id='workflow-rule-kind';for(const b of buttons){const option=document.createElement('option');option.value=b.dataset.addRule;option.textContent=b.textContent;select.append(option);b.hidden=true;}label.append(select);confirm.id='workflow-rule-add';confirm.className='primary';confirm.textContent='ノードを追加';confirm.onclick=()=>buttons.find(b=>b.dataset.addRule===select.value)?.click();add.prepend(label,confirm);}
 }
 if(screen==='form')mountInputReview(host,bar);
}
function mountInputReview(host,bar){
 const search=document.createElement('input'),go=document.createElement('button'),state=document.createElement('span');search.type='search';search.id='input-item-search';search.placeholder='入力項目を探す';search.setAttribute('aria-label','入力項目名で検索');go.textContent='移動';go.type='button';state.className='input-search-state';state.setAttribute('role','status');bar.append(search,go,state);
 function find(){const query=search.value.normalize('NFKC').trim().toLocaleLowerCase();if(!query)return;const field=[...host.querySelectorAll('.form-field')].find(el=>el.querySelector(':scope > label')?.textContent.normalize('NFKC').toLocaleLowerCase().includes(query));if(!field){state.textContent='一致する項目がありません';return;}field.scrollIntoView({block:'center',behavior:'instant'});field.querySelector('input,select,textarea,[contenteditable=true]')?.focus({preventScroll:true});state.textContent='';}
 go.onclick=find;search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();find();}};
 const input=host.querySelector('.form-grid>.panel:first-child .panel-head');if(input){const badge=document.createElement('span');badge.className='workflow-input-save';badge.textContent='入力値は自動保存';input.append(badge);}
 mountInputErrors(host);
}
function mountInputErrors(host){
 const issues=host.querySelector('#input-issues');if(!issues)return;for(const item of issues.querySelectorAll('li')){if(item.querySelector('button'))continue;const text=item.textContent,colon=text.indexOf(':'),path=colon>=0?text.slice(0,colon).replace(/\[(\d+)\]/g,(_,n)=>'.'+(Number(n)-1)):'',control=[...host.querySelectorAll('[data-input]')].find(el=>el.dataset.input===path||el.dataset.input?.endsWith('.'+path));if(!control)continue;const button=document.createElement('button');button.type='button';button.textContent=text;button.onclick=()=>{control.scrollIntoView({block:'center',behavior:'instant'});control.focus({preventScroll:true});};item.replaceChildren(button);}
}
function ruleExplanation(ws){
 const graph=D.ruleGraph(ws.definition),nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 function explain(id,seen=new Set()){
  if(seen.has(id))return '循環';const node=nodes.get(id);if(!node)return '未接続';seen=new Set(seen).add(id);
  const inputs=port=>graph.connections.filter(e=>e.target===id&&(!port||e.input===port)).map(e=>explain(e.source,seen));
  if(node.type==='field')return D.fieldAt(ws.definition,node.field)?.label||node.field||'参照項目なし';if(node.type==='literal')return '「'+String(node.value??'')+'」';if(node.type==='treeMatch')return (D.fieldAt(ws.definition,node.field)?.label||node.field)+' が '+D.treeDisplay(D.fieldAt(ws.definition,node.field)||{},node.path)+(node.operator==='descendant'?' 以下に属する':' と一致する');
  if(node.type==='compare')return (inputs('left')[0]||'未接続')+' が '+(inputs('right')[0]||'未接続')+' '+(D.ruleOperators[node.operator]||'比較方法なし');
  if(node.type==='not')return '（'+(inputs()[0]||'未接続')+'）ではない';return inputs().length?'（'+inputs().join(node.type==='and'?' かつ ':' または ')+'）':'条件を接続してください';
 }
 return D.ruleTargets(ws).filter(target=>target.owner[target.property]).map(target=>({target,expression:target.owner[target.property].nodeId?explain(target.owner[target.property].nodeId):'項目の値が設定と一致するとき'}));
}
Object.assign(D,{mountWorkflowShell,mountInputErrors,ruleExplanation});
})(globalThis);
