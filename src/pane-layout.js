/* Local pane preferences do not alter document definitions or Undo history. */
(function(root){
'use strict';const D=root.DocBench,key='docbench:paneWidths';let preferences={};
try{const value=JSON.parse(localStorage.getItem(key)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))preferences=value;}catch{}
function store(){try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}}
function fitWidths(ratios,total,minima){
 const minTotal=minima.reduce((a,b)=>a+b,0),mins=minima.map(n=>n*Math.min(1,total/minTotal)),result=ratios.map(n=>n*total),free=new Set(result.map((_,i)=>i));let left=total;
 while(free.size){const sum=[...free].reduce((n,i)=>n+ratios[i],0),weight=i=>sum?ratios[i]/sum:1/free.size,below=[...free].filter(i=>left*weight(i)<mins[i]);if(!below.length){for(const i of free)result[i]=left*weight(i);break;}for(const i of below){result[i]=mins[i];left-=mins[i];free.delete(i);}}
 return result;
}
function mountPaneLayout(host,screen){
 const work=host.querySelector(':scope > .builder,:scope > .rule-workbench,:scope > .render-grid,:scope > .form-grid');document.body.style.removeProperty('--pane-header-width');if(!work)return {destroy(){}};
 const controller=new AbortController(),signal=controller.signal,layer=document.createElement('div');layer.className='pane-resizer-layer';host.append(layer);let groups=[],widths=[],minimums=[],drag=null,frame=0,dimensions='';
 const names={types:['型一覧','型の設定','入力プレビュー'],definition:['入力項目','項目の設定','フォームプレビュー'],rules:['ノード追加','ノードの設定','条件エディタ'],render:['出力の設定','出力編集'],form:['入力','書類プレビュー']}[screen];
 const panels=screen==='rules'?[work.querySelector('.rule-palette'),work.querySelector('.rule-properties'),work.querySelector('.rule-stage')]:[...work.children].filter(el=>el.classList.contains('panel'));
 const defaultMins=panels.length===3?[130,180,280]:screen==='render'?[270,320]:[250,280];
 function valid(value){return Array.isArray(value)&&value.length===panels.length&&value.every(n=>Number.isFinite(n)&&n>0)&&Math.abs(value.reduce((a,b)=>a+b,0)-1)<.01;}
 function measure(){
  dimensions=[host.clientWidth,host.clientHeight,innerWidth].join(':');
  if(innerWidth<=850){work.style.removeProperty('grid-template-columns');layer.replaceChildren();document.body.style.removeProperty('--pane-header-width');return;}
  work.style.removeProperty('grid-template-columns');
  groups=screen==='rules'&&innerWidth<=1100?[[0,1],[2]]:panels.map((_,i)=>[i]);minimums=groups.map(g=>Math.max(...g.map(i=>defaultMins[i])));
  const saved=preferences[screen];if(valid(saved)){const weights=groups.map(g=>g.reduce((n,i)=>n+saved[i],0));widths=fitWidths(weights,work.clientWidth,minimums);setWidths();}else widths=groups.map(g=>panels[g[0]].getBoundingClientRect().width);
  if(layer.children.length!==groups.length-1){layer.replaceChildren();groups.slice(0,-1).forEach((g,i)=>{const handle=document.createElement('div');handle.className='pane-resizer';handle.dataset.paneIndex=String(i);handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label',g.map(j=>names[j]).join('・')+'と'+groups[i+1].map(j=>names[j]).join('・')+'の幅');handle.title='ドラッグで幅を変更／左右キーで調整／ダブルクリックで初期幅';handle.onpointerdown=ev=>start(ev,i,handle);handle.ondblclick=reset;handle.onkeydown=ev=>{if(ev.key==='Home'){ev.preventDefault();reset();}else if(['ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();adjust(i,(ev.key==='ArrowLeft'?-1:1)*(ev.shiftKey?50:20));save();}};layer.append(handle);});}position();
 }
 function setWidths(){work.style.gridTemplateColumns=widths.map(n=>n.toFixed(3)+'px').join(' ');}
 function position(){if(!groups.length||innerWidth<=850)return;const rect=host.getBoundingClientRect(),right=panels.at(-1).getBoundingClientRect();document.body.style.setProperty('--pane-header-width',right.left+'px');for(const handle of layer.children){const i=Number(handle.dataset.paneIndex),next=panels[groups[i+1][0]].getBoundingClientRect(),top=i===groups.length-2?0:Math.max(...groups[i].map(j=>panels[j].getBoundingClientRect().top),...groups[i+1].map(j=>panels[j].getBoundingClientRect().top))-rect.top;handle.style.left=(next.left-rect.left-4)+'px';handle.style.top=top+'px';handle.style.height=(host.clientHeight-top)+'px';handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','100');handle.setAttribute('aria-valuenow',String(Math.round(widths.slice(0,i+1).reduce((a,b)=>a+b,0)/work.clientWidth*100)));handle.setAttribute('aria-valuetext',Math.round(widths[i])+'px / '+Math.round(widths[i+1])+'px');}}
 function adjust(i,delta,base=widths){const pair=base[i]+base[i+1],scale=Math.min(1,pair/(minimums[i]+minimums[i+1])),left=Math.max(minimums[i]*scale,Math.min(pair-minimums[i+1]*scale,base[i]+delta));widths=[...base];widths[i]=left;widths[i+1]=pair-left;setWidths();position();}
 function save(){const ratios=Array(panels.length).fill(0),total=widths.reduce((a,b)=>a+b,0),old=preferences[screen];for(let i=0;i<groups.length;i++){const group=groups[i],sum=valid(old)?group.reduce((n,j)=>n+old[j],0):0;for(const j of group)ratios[j]=widths[i]/total*(sum?old[j]/sum:1/group.length);}preferences[screen]=ratios;store();}
 function reset(){const index=layer.contains(document.activeElement)?document.activeElement.dataset.paneIndex:null;delete preferences[screen];store();measure();if(index!==null)layer.querySelector('[data-pane-index="'+index+'"]')?.focus({preventScroll:true});}
 function start(ev,i,handle){if(ev.button!==0)return;ev.preventDefault();drag={id:ev.pointerId,i,x:ev.clientX,widths:[...widths],handle};handle.setPointerCapture(ev.pointerId);document.body.classList.add('pane-resizing');}
 function end(cancel=false){if(!drag)return;const current=drag;drag=null;if(cancel){widths=current.widths;setWidths();position();}else save();document.body.classList.remove('pane-resizing');if(current.handle.hasPointerCapture(current.id))current.handle.releasePointerCapture(current.id);}
 layer.addEventListener('pointermove',ev=>{if(drag&&ev.pointerId===drag.id)adjust(drag.i,ev.clientX-drag.x,drag.widths);},{signal});layer.addEventListener('pointerup',()=>end(),{signal});layer.addEventListener('pointercancel',()=>end(true),{signal});layer.addEventListener('lostpointercapture',()=>end(true),{signal});document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&drag){ev.preventDefault();end(true);}},{signal});
 const observer=new ResizeObserver(()=>{if(dimensions===[host.clientWidth,host.clientHeight,innerWidth].join(':'))return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(drag)end(true);measure();});});observer.observe(host);measure();
 return {destroy(){end(true);controller.abort();observer.disconnect();cancelAnimationFrame(frame);layer.remove();document.body.style.removeProperty('--pane-header-width');}};
}
Object.assign(D,{mountPaneLayout});
})(globalThis);
