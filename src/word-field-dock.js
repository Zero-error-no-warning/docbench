/* Requirement selection is separate from the explicit insertion command. */
(function(root){
'use strict';const D=root.DocBench;
function mountWordFieldDock(cfg){
 const body=cfg.body,select=body.querySelector('#canvas-insert-field'),insert=body.querySelector('#canvas-insert'),kind=body.querySelector('#canvas-insert-type');let chosen=false,wasValue=select.value;
 body.classList.add('word-field-dock');const picker=D.mountFieldPicker(select,{inline:true,wordChoices:true,searchId:'word-field-search',label:'要件で定義した項目',definition:cfg.definition,scopes:()=>cfg.controller()?.controlScopes?.()||[],onOpen:()=>cfg.controller()?.holdSelection?.()});
 const trigger=picker.button;
 select.addEventListener('change',()=>{chosen=!!select.value;wasValue=select.value;sync();});kind.addEventListener('change',()=>{chosen=false;sync();});
 const command=insert.onclick;insert.onclick=event=>{if(['field','table'].includes(kind.value)&&(!chosen||!select.value))return;command?.call(insert,event);chosen=false;sync();};
 function sync(){if(select.value!==wasValue){chosen=false;wasValue=select.value;}if(['field','table'].includes(kind.value))insert.disabled=!chosen||!select.value;picker.refresh();}
 sync();return {element:body,trigger,sync,open:()=>picker.open(),cancel(){chosen=false;kind.value='field';kind.onchange?.();select.value='';wasValue='';sync();},hide:()=>picker.close(),destroy:()=>picker.destroy()};
}
Object.assign(D,{mountWordFieldDock});
})(globalThis);
