/* One editing document; saved block IDs, conditions and field bindings survive. */
(function(root){
'use strict';
const D=root.DocBench;
function attachWordEditor(surface,config,doc){
 const lib=root.DocBenchEditorLib,required={TextSelection:['between','near'],Selection:['fromJSON'],StepMap:[]};
 const missing=Object.entries(required).filter(([name,methods])=>typeof lib?.[name]!=='function'||methods.some(method=>typeof lib[name][method]!=='function')||name==='StepMap'&&!lib[name].empty).map(([name])=>name);
 for(const name of ['RepeatBlock','ConditionBlock','ControlRanges','ToolbarSelection','ListTypography','WordDocument','WordSection','WordObject','WordEditing','WordFormatting','WordTab','CharacterStyle','RowRepeats'])if(!lib?.[name])missing.push(name);
 if(missing.length){const error=Error('Word編集用ライブラリの必要なAPIがありません（'+missing.join(', ')+'）。vendor/tiptap.min.js をHTMLと同じ配布版のファイルに差し替え、ページを再読み込みしてください。');error.code='WORD_EDITOR_DEPENDENCY';throw error;}
 const settings=D.settings({...config.design,outputFormat:'docx'}),main=doc.querySelector('main');
 const host=doc.createElement('div');host.className='word-edit';
 main.querySelectorAll('[data-block-id]').forEach(node=>node.remove());
 main.insertBefore(host,main.querySelector('footer'));
 main.style.margin='0 auto';main.style.background='white';main.style.boxShadow='0 3px 16px #21364222';
 // A percentage is an actual scale; fit follows pane resizing without rebuilding Tiptap.
 const paperWidth=main.offsetWidth;
 function fitPaper(){if(surface.clientWidth)main.style.zoom=config.zoom===0?Math.max(.15,(surface.clientWidth-28)/paperWidth):(config.zoom||100)/100;}
 fitPaper();const resizeObserver=new ResizeObserver(fitPaper);resizeObserver.observe(surface);
 doc.body.style.background='#e8eef0';
 let documentEditor,editor=null,lastSelected=config.selectedId,heldSelection=null,gesture=null,ruler=null,formatPlanDoc=null,formatPlan=new Map();
 const locate=id=>{let found=null;documentEditor.state.doc.forEach((node,pos)=>{if(node.attrs.id===id)found={node,pos};});return found;};
 function currentBlock(){
  const selection=documentEditor.state.selection;
  if(selection.node?.type.name==='wordObject')return selection.node;
  for(let depth=selection.$head.depth;depth>0;depth--){const n=selection.$head.node(depth);if(n.type.name==='wordSection')return n;}
  return null;
 }
 function activate(){
  if(!documentEditor)return;
  const block=currentBlock();lastSelected=block?.attrs.id||null;editor=block?.type.name==='wordObject'?null:documentEditor;
  for(const el of main.querySelectorAll('[data-block-id]'))el.classList.toggle('db-selected',el.dataset.blockId===lastSelected);
  config.onSelect(lastSelected);config.onSelectionStyle?.();ruler?.sync();
 }
 function syncSelection(view=editor?.view){
  if(heldSelection||!view||view.isDestroyed||view.composing||!(view.state.selection instanceof lib.TextSelection))return;
  const selection=view.root.getSelection?.();
  if(!selection?.anchorNode||!selection.focusNode||!view.dom.contains(selection.anchorNode)||!view.dom.contains(selection.focusNode))return;
  try{const anchor=view.posAtDOM(selection.anchorNode,selection.anchorOffset),head=view.posAtDOM(selection.focusNode,selection.focusOffset),next=lib.TextSelection.between(view.state.doc.resolve(anchor),view.state.doc.resolve(head));if(!next.eq(view.state.selection))view.dispatch(view.state.tr.setSelection(next));}catch{}
 }
 function holdSelection(){if(!editor||heldSelection)return;syncSelection();heldSelection={selection:editor.state.selection.toJSON(),marks:editor.state.storedMarks?.map(m=>m.toJSON())||null};editor.commands.holdWordSelection(true);}
 function releaseSelection(){if(!heldSelection)return;heldSelection=null;if(!documentEditor.isDestroyed)documentEditor.commands.holdWordSelection(false);}
 function restoreHeldSelection(){if(!heldSelection||!editor)return;try{const selection=lib.Selection.fromJSON(editor.state.doc,heldSelection.selection),marks=heldSelection.marks?.map(m=>editor.schema.markFromJSON(m))||null;if(!selection.eq(editor.state.selection)||!D.equal(editor.state.storedMarks?.map(m=>m.toJSON())||null,heldSelection.marks))editor.view.dispatch(editor.state.tr.setSelection(selection).setStoredMarks(marks).setMeta('addToHistory',false));}catch{releaseSelection();}}
 const style=doc.createElement('style');
 style.textContent=D.wordDecorCSS+`
 .word-ruler{position:relative;height:26px;background:#f6f8fa;border-bottom:1px solid #bdcdd3;font:9px sans-serif;margin-bottom:8px;user-select:none;z-index:4}
 .word-ruler[hidden]{display:none}.word-ruler-tick{position:absolute;top:2px;border-left:1px solid #a7b8c2;height:10px;padding-left:2px;color:#637780}
 .word-ruler button{position:absolute;top:14px;width:12px;height:10px;transform:translateX(-50%);border:1px solid #196c74;background:#c4e0e4;padding:0;cursor:ew-resize;touch-action:none}
 .word-ruler button[data-ruler-indent=first]{top:-2px;clip-path:polygon(0 0,100% 0,50% 100%)}
 .word-ruler button:focus-visible{outline:2px solid #087f8c;outline-offset:2px}

 .word-document{outline:none;min-height:340px;cursor:text}
 .word-document .tiptap{outline:none;min-height:1em;cursor:text;user-select:text}
 .word-document .tiptap p{min-height:1em}
 .word-document h1,.word-document h2,.word-document h3,.word-document h4,.word-document h5,.word-document h6{font-weight:var(--word-heading-weight,bold)}
 .word-document h1{font-size:var(--word-heading-size,22pt)}.word-document h2{font-size:var(--word-heading-size,18pt)}.word-document h3{font-size:var(--word-heading-size,16pt)}.word-document h4{font-size:var(--word-heading-size,14pt)}.word-document h5{font-size:var(--word-heading-size,12pt)}.word-document h6{font-size:var(--word-heading-size,11pt)}
 .word-document .tiptap blockquote{margin:0 0 8pt;padding:0 0 0 18pt;border-left:2pt solid #acbcc4}
 .word-document .tiptap table{width:100%;table-layout:fixed;border-collapse:collapse}
 .word-document td,.word-document th{position:relative;min-width:25px;outline:1px dashed #bdcdd3;outline-offset:-1px}
 .word-document .selectedCell:after{content:"";position:absolute;inset:0;background:#196c7422;pointer-events:none}
 .column-resize-handle{position:absolute;right:-2px;top:0;bottom:-2px;width:4px;background:#087f8c;pointer-events:none}
 .resize-cursor{cursor:col-resize}.tableWrapper{overflow:visible}
 .word-repeated-row>td,.word-repeated-row>th{box-shadow:inset 3px 0 #7ab7bd}
 .word-document .word-repeat-start-cell{padding-top:26px!important}
 .word-repeat-start-cell::before{content:attr(data-repeat-label);position:absolute;left:5px;top:2px;font:10px/1.5 sans-serif;color:#21636b;background:#e8f5f5;padding:2px 5px;white-space:nowrap;max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis;pointer-events:none}
 .word-held-selection{background:#accfd9;color:inherit}
 .word-document li::marker{font-size:var(--word-marker-size,1em);color:var(--word-marker-color,currentColor)}
 .field-token{display:inline-block;background:#e5f3f1;color:#085e64;padding:1px 4px;border-radius:3px;font-size:.85em}
 .word-control-range{position:relative;border-left:2px solid #8bb5bb;margin:8pt 0;padding:0 0 0 10px}
 .word-control-range.conditionBlock{border-color:#baa3cf}
 .word-control-range{border:1px solid #b9d3d6;border-left:3px solid #76a8af;border-radius:4px;padding:0 10px 0;margin:10pt 0}
 .word-control-range.conditionBlock{border:1px solid #d6c8e2;border-left:3px solid #aa91bd}
 .word-document .word-range-label,.word-document .word-range-end{display:block;width:100%;text-align:left;white-space:normal;line-height:1.5;font:11px/1.5 sans-serif;color:#366d76;background:#f0f7f7;border:0;border-radius:0;cursor:pointer;padding:5px 7px;margin:0;min-height:26px}
 .word-document .conditionBlock>.word-range-label,.word-document .conditionBlock>.word-range-end{background:#f7f3fa;color:#795c91}
 .word-document .word-range-content{padding:8px 0}
 .word-document .word-range-end{border-top:1px dashed #bdd3d6;font-size:10px}

 .word-range-label{background:#edf5f5;color:#37646c;font:11px sans-serif;padding:5px 8px;margin:0 0 8px;cursor:pointer;user-select:none}
 .conditionBlock>.word-range-label{background:#f3eff8;color:#755786}.word-range-content{min-height:1em}
 .word-page-break,.word-bound-pagebreak{border-top:1px dashed #a1b7bf;color:#6d818b;font:10px sans-serif;margin:10px 0;padding:5px 0}
 .word-flow-block,.word-bound-block{position:relative;min-height:16px;outline-offset:1px}
 .word-flow-block.db-selected{outline:1px solid #c8dcdf}.word-bound-block.db-selected{outline:2px solid #087f8c}
 .word-flow-handle{position:absolute;left:-26px;top:1px;border:0;background:#e8f1f2;color:#527880;padding:2px 3px;cursor:grab;opacity:0;font-size:13px}
 .word-flow-block:hover>.word-flow-handle,.word-flow-block.db-selected>.word-flow-handle{opacity:1}
 .word-writing-gap{min-height:12px}.word-writing-gap .tiptap{min-height:12px}
 .word-empty .tiptap>p:only-child:has(>.ProseMirror-trailingBreak)::before{content:"ここから文章を入力";float:left;height:0;color:#99adb5;pointer-events:none;font-size:11pt}
 .word-writing-gap:not(:focus-within):not(:hover) .tiptap>p::before{opacity:0}
 .word-document>.word-empty:only-child .tiptap{min-height:340px}
 .db-drop-before{border-top:4px solid #087f8c}.db-drop-after{border-bottom:4px solid #087f8c}`;
 doc.head.append(style);
 const renderObject=block=>{
  if(block?.type==='pagebreak')return '<div class="word-bound-pagebreak">改ページ</div>';
  return D.outputModel(config.definition,{...config.design,blocks:[block]},config.values).map(b=>D.bodyBlock(b,settings)).join('');
 };
 documentEditor=new lib.Editor({element:host,extensions:[
  lib.WordDocument,lib.WordEditing,lib.WordSection.configure({style:block=>D.styleCSS(D.blockStyle(block,settings))}),
  lib.WordObject.configure({render:renderObject,text:source=>source.type==='pagebreak'?'［改ページ］':'［'+(source.type==='table'?'データ表：':'入力項目：')+(D.fieldAt(config.definition,source.field)?.label||source.field)+'］',onSelect:(id,part)=>config.onPart?.(part)}),
  lib.ToolbarSelection,lib.ListTypography.configure({...settings,styleForSection:source=>D.blockStyle(source,settings)}),lib.StarterKit.configure({document:false,link:false,code:false,codeBlock:false}),
  lib.WordFormatting.configure({settings}),lib.WordTab,lib.CharacterStyle.configure({settings}),lib.TextStyleKit,lib.Subscript,lib.Superscript,lib.TableBorders,lib.ParagraphFormat.configure({settings}),lib.Identity,
  lib.RowRepeats.configure({definition:config.definition,onInvalid:message=>config.onInvalid?.(message)}),lib.Table.configure({resizable:true,allowTableNodeSelection:true}),lib.TableRow,lib.Cell,lib.CellHeader,
  lib.RepeatBlock.configure({label:n=>D.wordControlLabel(n,config.definition),onEdit:()=>{activate();config.onWordControl?.();}}),
  lib.ConditionBlock.configure({label:n=>D.wordControlLabel(n,config.definition),onEdit:()=>{activate();config.onWordControl?.();}}),
  lib.PageBreakNode,lib.ControlRanges,lib.FieldRef.configure({resolve:attrs=>{const f=D.richFieldAt(config.definition,attrs.field);return (attrs.part==='label'?'項目名：':'入力値：')+(f?.label||attrs.field);}})
 ],content:D.wordEditorDocument(config.design.blocks),editorProps:{attributes:{class:'word-document','aria-label':'文書全体の編集'},handleDOMEvents:{
  keydown:(view,event)=>{syncSelection(view);if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase()))event.stopPropagation();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'&&view.state.selection.node?.type.name==='wordObject'){event.preventDefault();return controller.blockCommand('duplicate');}return false;},
  keyup:view=>{syncSelection(view);return false;},mouseup:view=>{syncSelection(view);return false;}
 }},onFocus:activate,onSelectionUpdate:activate,onUpdate:({editor:e})=>{
  activate();config.onChange({kind:'wordDocument',blocks:D.wordEditorBlocks(e.getJSON()),selectedId:lastSelected,live:true});
 }});
 // Node views are mounted during construction; focus is deliberately restored
 // by the caller only after its toolbar/controller are ready.
 documentEditor.view.dom.classList.remove('tiptap');
 editor=documentEditor;
 const select=(id,tell=true)=>{
  const target=locate(id);if(!target)return;
  releaseSelection();
  if(target.node.type.name==='wordObject')documentEditor.commands.setNodeSelection(target.pos);
  else documentEditor.commands.setTextSelection(lib.TextSelection.near(documentEditor.state.doc.resolve(target.pos+1)).from);
  if(tell)activate();
 };
 function write(){
  if(editor){editor.view.focus();return;}
  const target=locate(lastSelected);let after=target?target.pos+target.node.nodeSize:documentEditor.state.doc.content.size;
  const next=documentEditor.state.doc.nodeAt(after);
  if(next?.type.name!=='wordSection'){
   documentEditor.commands.insertContentAt(after,{type:'wordSection',attrs:{id:D.uid(),draft:true},content:[{type:'paragraph'}]});
  }
  documentEditor.commands.setTextSelection(lib.TextSelection.near(documentEditor.state.doc.resolve(after+1)).from);documentEditor.view.focus();activate();
 }
 function replaceBlocks(nodes,selectedId){
  const next=documentEditor.schema.nodeFromJSON({type:'doc',content:nodes}),tr=documentEditor.state.tr.replaceWith(0,documentEditor.state.doc.content.size,next.content);
  let selected=null;tr.doc.forEach((node,pos)=>{if(node.attrs.id===selectedId)selected={node,pos};});
  if(selected)tr.setSelection(selected.node.type.name==='wordObject'?lib.Selection.near(tr.doc.resolve(selected.pos)):lib.TextSelection.near(tr.doc.resolve(selected.pos+1)));
  documentEditor.view.dispatch(tr.scrollIntoView());
 }
 const controller={
  holdSelection,releaseSelection,select,
  edit(id){select(id,false);const target=locate(id);if(target?.node.type.name==='wordSection'){documentEditor.commands.setTextSelection(lib.TextSelection.near(documentEditor.state.doc.resolve(target.pos+target.node.nodeSize-1),-1).from);documentEditor.view.focus();activate();}},
  write,activeEditor:()=>editor,
  paragraphFormat(){
   if(!editor)return {...D.wordParagraphDefaults,fontSize:settings.fontSize};const {selection}=editor.state;let node=null,pos=selection.from;
   for(let d=selection.$from.depth;d>0;d--)if(['paragraph','heading'].includes(selection.$from.node(d).type.name)){node=selection.$from.node(d);break;}
   if(!node)editor.state.doc.nodesBetween(selection.from,selection.to,(n,p)=>{if(!node&&['paragraph','heading'].includes(n.type.name)){node=n;pos=p+1;}});if(!node)return {...D.wordParagraphDefaults,fontSize:settings.fontSize};
   const $from=editor.state.doc.resolve(pos);let source={};for(let d=1;d<=$from.depth;d++)if($from.node(d).type.name==='wordSection')source=$from.node(d).attrs.source||{};
   let base={...D.blockStyle(source,settings),wordStyles:settings.wordStyles,wordNumberings:settings.wordNumberings};for(let d=1;d<=$from.depth;d++)if($from.node(d).type.name==='table')base=D.wordTableStyle($from.node(d).toJSON(),base);for(let d=1;d<=$from.depth;d++)if($from.node(d).type.name==='tableHeader')base._headerBold=true;
   if(formatPlanDoc!==editor.state.doc){formatPlanDoc=editor.state.doc;formatPlan=new Map();const tree=D.wordNumberingPlan(editor.getJSON(),settings);const collect=n=>{if(n.attrs?.id)formatPlan.set(n.attrs.id,n);for(const c of n.content||[])collect(c);};collect(tree);}
   const planned=formatPlan.get(node.attrs.id)||node.toJSON();return D.wordNumberedStyle(planned,D.wordParagraphStyle(planned,base));
  },
  showRuler:visible=>ruler?.show(visible),
  capture(){syncSelection();return {definitionId:config.definition.id,id:lastSelected,document:documentEditor.getJSON(),selection:documentEditor.state.selection.toJSON(),marks:documentEditor.state.storedMarks?.map(m=>m.toJSON())||null,focused:documentEditor.view.hasFocus(),toolbarHeld:!!heldSelection,scroll:{top:surface.scrollTop,left:surface.scrollLeft}};},
  restore(saved){
   if(!saved||saved.definitionId!==config.definition.id)return;
   let selection;
   try{
    const oldDoc=documentEditor.schema.nodeFromJSON(saved.document),newDoc=documentEditor.state.doc;let mapping=lib.StepMap.empty;
    if(oldDoc.content.size!==newDoc.content.size){const start=oldDoc.content.findDiffStart(newDoc.content),end=oldDoc.content.findDiffEnd(newDoc.content);if(start!==null&&end){const overlap=start-Math.min(end.a,end.b);if(overlap>0){end.a+=overlap;end.b+=overlap;}mapping=new lib.StepMap([start,end.a-start,end.b-start]);}}
    selection=lib.Selection.fromJSON(oldDoc,saved.selection).map(newDoc,mapping);
   }catch{selection=lib.TextSelection.near(documentEditor.state.doc.resolve(Math.max(0,Math.min(documentEditor.state.doc.content.size,saved.selection.head??saved.selection.anchor??1))));}
   const marks=saved.marks?.map(m=>documentEditor.schema.markFromJSON(m))||null;
   documentEditor.view.dispatch(documentEditor.state.tr.setSelection(selection).setStoredMarks(marks).setMeta('addToHistory',false));
   if(saved.focused)documentEditor.view.focus();if(saved.toolbarHeld)holdSelection();surface.scrollTop=saved.scroll.top;surface.scrollLeft=saved.scroll.left;activate();
  },
  controlScopes(){if(!editor)return [];const {$from}=editor.state.selection,scopes=[];for(let depth=1;depth<=$from.depth;depth++){const n=$from.node(depth);if(n.type.name==='repeatBlock'||n.type.name==='tableRow'&&n.attrs.repeatGroup)scopes.push(n.attrs.field);}return scopes;},
  rowRepeatInfo(){if(!editor)return null;const info=lib.rowRepeatInfo(editor.state);return info?{from:info.from,to:info.to,total:info.rows.length,group:info.group,field:info.field}:null;},
  setRowRepeat(value){if(!editor)return false;restoreHeldSelection();return editor.chain().setRepeatedRows(value).focus().run();},
  control(){if(!editor)return null;const {selection}=editor.state;if(['repeatBlock','conditionBlock'].includes(selection.node?.type.name))return {type:selection.node.type.name,attrs:selection.node.attrs,pos:selection.from};for(let depth=selection.$from.depth;depth>0;depth--){const n=selection.$from.node(depth);if(['repeatBlock','conditionBlock'].includes(n.type.name))return {type:n.type.name,attrs:n.attrs,pos:selection.$from.before(depth)};}return null;},
  setControl(type,attrs,mode='insert'){
   if(!editor)write();restoreHeldSelection();syncSelection();const current=this.control();
   if(mode==='update'&&current)return editor.commands.updateAttributes(current.type,attrs);
   if((mode==='unwrap'||mode==='delete')&&current){const node=editor.state.doc.nodeAt(current.pos),tr=editor.state.tr;if(mode==='delete')tr.delete(current.pos,current.pos+node.nodeSize);else tr.replaceWith(current.pos,current.pos+node.nodeSize,node.content);editor.view.dispatch(tr.scrollIntoView());editor.view.focus();return true;}
   const id=D.uid(),a={...attrs,id};
   const done=!editor.state.selection.empty?editor.chain().focus().wrapIn(type,a).run():editor.chain().focus().insertContent({type,attrs:a,content:[{type:'paragraph'}]}).run();
   if(done){let pos=null;editor.state.doc.descendants((n,p)=>{if(n.attrs.id===id)pos=p;});if(pos!==null)editor.commands.setTextSelection(pos+2);editor.view.focus();}return done;
  },
  canCommand(name){const e=['undo','redo'].includes(name)?documentEditor:editor;if(!e)return false;if(['indent','outdent'].includes(name)&&!e.isActive('listItem'))return true;const c=e.can();const ops={merge:()=>c.mergeCells(),split:()=>c.splitCell(),row:()=>c.addRowAfter(),column:()=>c.addColumnAfter(),deleteRow:()=>c.deleteRow(),deleteColumn:()=>c.deleteColumn(),headerRow:()=>c.toggleHeaderRow(),headerColumn:()=>c.toggleHeaderColumn(),indent:()=>c.sinkListItem('listItem'),outdent:()=>c.liftListItem('listItem'),undo:()=>c.undo(),redo:()=>c.redo()};return ops[name]?ops[name]():true;},
  command(name,value,{keepFocus=false}={}){
   const e=['undo','redo'].includes(name)?documentEditor:editor;if(!e)return false;restoreHeldSelection();syncSelection();if(!keepFocus&&!e.view.hasFocus())e.view.focus();const chain=e.chain();
   const commands={bold:()=>chain.toggleBold().run(),italic:()=>chain.toggleItalic().run(),underline:()=>chain.toggleUnderline().run(),strike:()=>chain.toggleStrike().run(),subscript:()=>chain.unsetSuperscript().toggleSubscript().run(),superscript:()=>chain.unsetSubscript().toggleSuperscript().run(),bulletList:()=>chain.toggleBulletList().run(),orderedList:()=>chain.toggleOrderedList().run(),indent:()=>e.isActive('listItem')?chain.sinkListItem('listItem').run():chain.setWordParagraph({indentLeft:this.paragraphFormat().indentLeft+(this.paragraphFormat().indentUnit==='chars'?1:18)}).run(),outdent:()=>e.isActive('listItem')?chain.liftListItem('listItem').run():chain.setWordParagraph({indentLeft:Math.max(0,this.paragraphFormat().indentLeft-(this.paragraphFormat().indentUnit==='chars'?1:18))}).run(),clear:()=>chain.setWordMarkerSize(null).setWordMarkerColor(null).unsetAllMarks().run(),undo:()=>chain.undo().run(),redo:()=>chain.redo().run(),heading:()=>chain.setWordParagraphStyle(value==='paragraph'?'Normal':'Heading'+value).run(),borders:()=>chain.setTableBorders(value).run(),insert:()=>chain.insertContent(value).run(),fontSize:()=>chain.setWordMarkerSize(value).setFontSize(value+'pt').run(),font:()=>chain.setFontFamily(value).run(),color:()=>chain.setWordMarkerColor(value).setColor(value).run(),fill:()=>value?chain.setBackgroundColor(value).run():chain.unsetBackgroundColor().run(),align:()=>chain.updateAttributes('paragraph',{textAlign:value}).updateAttributes('heading',{textAlign:value}).run(),exitRange:()=>chain.exitControlRange().run(),pageBreak:()=>chain.insertContent({type:'pageBreak'}).run(),table:()=>chain.insertTable({rows:value.rows,cols:value.cols,withHeaderRow:false}).run(),merge:()=>chain.mergeCells().run(),split:()=>chain.splitCell().run(),row:()=>{const group=lib.rowRepeatInfo(e.state);return chain.addRowAfter().command(({tr})=>{if(group?.group){const info=lib.rowRepeatInfo({doc:tr.doc,selection:tr.selection});for(const row of info?.rows||[])if(!row.node.attrs.id)tr.setNodeMarkup(row.pos,undefined,{...row.node.attrs,field:group.field,repeatGroup:group.group});}return true;}).run();},column:()=>chain.addColumnAfter().run(),deleteRow:()=>chain.deleteRow().run(),deleteColumn:()=>chain.deleteColumn().run(),headerRow:()=>chain.toggleHeaderRow().run(),headerColumn:()=>chain.toggleHeaderColumn().run(),cellFill:()=>chain.setCellAttribute('fill',value).run(),field:()=>chain.insertContent({type:'fieldRef',attrs:value}).run(),cellStyles:()=>{for(const [key,v] of Object.entries(value))chain.setCellAttribute(key,v);if('border' in value)chain.setCellAttribute('borders',null);return chain.run();},paragraph:()=>chain.setWordParagraph(value).run(),paragraphStyle:()=>chain.setWordParagraphStyle(value).run(),characterStyle:()=>value?chain.setMark('characterStyle',{styleId:value}).run():chain.unsetMark('characterStyle').run(),clearParagraph:()=>chain.clearWordParagraph().unsetAllMarks().run(),tableStyle:()=>{chain.updateAttributes('table',{styleId:value.id});if(value.reset){const selection=e.state.selection;let pos=null;for(let d=selection.$from.depth;d>0;d--)if(selection.$from.node(d).type.name==='table'){pos=selection.$from.before(d);break;}if(pos!==null)chain.command(({tr})=>{tr.doc.nodeAt(pos).descendants((n,p)=>{if(['tableCell','tableHeader'].includes(n.type.name))tr.setNodeMarkup(pos+p+1,undefined,{...n.attrs,border:null,borders:null,padding:null,valign:null,fill:null});});return true;});}return chain.run();},bottomBorder:()=>chain.updateAttributes('paragraph',{bottomBorder:value}).updateAttributes('heading',{bottomBorder:value}).run()};
   let applied;
   if(name==='wordNumbering'){
    let previous=null;e.state.doc.nodesBetween(0,e.state.selection.from,(node,pos)=>{if(node.attrs.numberingId===value.id&&pos<e.state.selection.from)previous=node;});
    const sequence=value.mode==='continue'?(previous?.attrs.numberingSequence||'default'):D.uid(),attributes={numberingId:value.id,numberingLevel:value.level||0,numberingSequence:sequence};
    if(value.target==='list'){if(!e.isActive('orderedList')&&value.id!=='none')chain.toggleOrderedList();applied=value.id==='none'?chain.liftListItem('listItem').run():chain.updateAttributes('orderedList',{...attributes,start:value.mode==='continue'?previous?.attrs.start||1:value.start||1}).run();}
    else applied=chain.setWordParagraph({...attributes,numberingStart:value.mode==='continue'?null:value.start||1}).run();
   }else applied=commands[name]?commands[name]():false;if(heldSelection){heldSelection.selection=e.state.selection.toJSON();heldSelection.marks=e.state.storedMarks?.map(m=>m.toJSON())||null;}return applied;
  },
  blockCommand(command,id=lastSelected,targetId,after=false){
   const target=locate(id);if(!target)return false;releaseSelection();const nodes=documentEditor.getJSON().content,index=nodes.findIndex(n=>n.attrs.id===id);
   if(command==='delete')nodes.splice(index,1);
   else if(command==='duplicate'){const copy=D.clone(nodes[index]);copy.attrs.id=D.uid();if(copy.content)copy.content=D.identifyRich({type:'doc',content:copy.content},true).content;nodes.splice(index+1,0,copy);id=copy.attrs.id;}
   else if(command==='reorder'){const moved=nodes.splice(index,1)[0],at=nodes.findIndex(n=>n.attrs.id===targetId);if(at<0)return false;nodes.splice(at+(after?1:0),0,moved);}
   else return false;
   if(!nodes.length)nodes.push(...D.wordEditorDocument([]).content);replaceBlocks(nodes,id);return true;
  },
  destroy(){resizeObserver.disconnect();ruler?.destroy();documentEditor.destroy();editor=null;}
 };
 main.addEventListener('click',event=>{if(event.target===main||event.target===host)write();});
 main.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-word-drag],.word-bound-block');if(!handle||event.button!==0)return;event.preventDefault();const node=handle.closest('[data-block-id]');select(node.dataset.blockId);if(node.classList.contains('word-bound-block'))documentEditor.view.focus();gesture={node,id:node.dataset.blockId,x:event.clientX,y:event.clientY,target:null,after:false};handle.setPointerCapture(event.pointerId);
 });
 const clearDrop=()=>main.querySelectorAll('.db-drop-before,.db-drop-after').forEach(n=>n.classList.remove('db-drop-before','db-drop-after'));
 main.addEventListener('pointermove',event=>{
  if(!gesture||Math.abs(event.clientX-gesture.x)+Math.abs(event.clientY-gesture.y)<4)return;clearDrop();const target=doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-block-id]');gesture.target=target&&target!==gesture.node?target.dataset.blockId:null;
  if(gesture.target){gesture.after=event.clientY>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;target.classList.add(gesture.after?'db-drop-after':'db-drop-before');}
  const rect=surface.getBoundingClientRect();if(event.clientY>rect.bottom-32)surface.scrollTop+=16;else if(event.clientY<rect.top+24)surface.scrollTop-=16;
 });
 main.addEventListener('pointerup',()=>{if(!gesture)return;const g=gesture;gesture=null;clearDrop();if(g.target)controller.blockCommand('reorder',g.id,g.target,g.after);});
 main.addEventListener('pointercancel',()=>{gesture=null;clearDrop();});
 // During dragover the browser protects the payload: only its types are
 // readable. Validate the actual block ID when the drop is delivered.
 main.addEventListener('dragover',event=>{if(documentEditor.view.dragging||!event.dataTransfer?.types.includes('text/plain'))return;const target=event.target.closest('[data-block-id]');if(!target)return;event.preventDefault();clearDrop();target.classList.add(event.clientY>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2?'db-drop-after':'db-drop-before');});
 main.addEventListener('drop',event=>{const id=event.dataTransfer?.getData('text/plain'),target=event.target.closest('[data-block-id]');if(!id||!locate(id)||!target)return;event.preventDefault();event.stopPropagation();const after=target.classList.contains('db-drop-after');clearDrop();if(id!==target.dataset.blockId)controller.blockCommand('reorder',id,target.dataset.blockId,after);},true);
 main.addEventListener('dragend',clearDrop);
 ruler=D.mountWordRuler(doc,main,controller,settings);
 if(config.selectedId)select(config.selectedId,false);
 return controller;
}
Object.assign(D,{attachWordEditor});
})(globalThis);
