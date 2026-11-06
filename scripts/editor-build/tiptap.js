import { ParagraphFormat, CharacterStyle, WordTab, WordFormatting } from './word-format.js';
import { Editor, Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StepMap, canJoin } from '@tiptap/pm/transform';
import { selectedRect, isInTable } from '@tiptap/pm/tables';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';

const toolbarSelectionKey=new PluginKey('wordToolbarSelection');
const ToolbarSelection=Extension.create({name:'wordToolbarSelection',addProseMirrorPlugins(){return [new Plugin({key:toolbarSelectionKey,state:{init:()=>false,apply:(tr,held)=>tr.getMeta(toolbarSelectionKey)??held},props:{decorations:state=>{const selected=state.selection;if(!toolbarSelectionKey.getState(state)||selected.empty)return null;if(selected instanceof TextSelection)return DecorationSet.create(state.doc,[Decoration.inline(selected.from,selected.to,{class:'word-held-selection'})]);return null;}}})];},addCommands(){return {holdWordSelection:held=>({tr,dispatch})=>{if(dispatch)dispatch(tr.setMeta(toolbarSelectionKey,held).setMeta('addToHistory',false));return true;}};}});
const ListTypography=Extension.create({
 name:'wordListTypography',addOptions(){return {fontSize:11,color:'#172b39'};},
 addGlobalAttributes(){return [{types:['listItem'],attributes:{
  markerFontSize:{default:null,parseHTML:el=>parseFloat(el.style.getPropertyValue('--word-marker-size'))||null,renderHTML:a=>a.markerFontSize?{style:'--word-marker-size:'+a.markerFontSize+'pt'}:{}},
  markerColor:{default:null,parseHTML:el=>el.style.getPropertyValue('--word-marker-color')||null,renderHTML:a=>a.markerColor?{style:'--word-marker-color:'+a.markerColor}:{}}
 }}];},
 addProseMirrorPlugins(){const base=this.options;return [new Plugin({props:{decorations:state=>{const decorations=[];state.doc.descendants((n,pos)=>{if(n.type.name==='listItem'){const item=n.toJSON(),position=state.doc.resolve(pos);let source=null;for(let d=position.depth;d>0;d--)if(position.node(d).type.name==='wordSection'){source=position.node(d).attrs.source;break;}const fallback=base.styleForSection?base.styleForSection(source||{}):base;decorations.push(Decoration.node(pos,pos+n.nodeSize,{style:'--word-marker-size:'+globalThis.DocBench.listMarkerSize(item,fallback)+'pt;--word-marker-color:'+globalThis.DocBench.listMarkerColor(item,fallback)}));}});return DecorationSet.create(state.doc,decorations);}}})];},
 addCommands(){const setMarker=(attribute,value)=>({state,tr,dispatch})=>{
  const selected=state.selection,seen=new Set();const change=(node,pos)=>{if(node.type.name!=='listItem'||seen.has(pos))return;seen.add(pos);if(node.attrs[attribute]!==value)tr.setNodeMarkup(pos,undefined,{...node.attrs,[attribute]:value});};
  if(selected.empty){for(let d=selected.$from.depth;d>0;d--)if(selected.$from.node(d).type.name==='listItem'){change(selected.$from.node(d),selected.$from.before(d));break;}}
  else state.doc.nodesBetween(selected.from,selected.to,(node,pos)=>{if(node.type.name==='listItem'){// A nested list changes its own marker, not its enclosing item.
   const start=pos+1,firstEnd=start+(node.firstChild?.nodeSize||0);if(selected.from<firstEnd&&selected.to>start)change(node,pos);
  }});if(dispatch)dispatch(tr);return true;
 };return {setWordMarkerSize:size=>setMarker('markerFontSize',size),setWordMarkerColor:color=>setMarker('markerColor',color)};}
});

const FieldRef = Node.create({
  name:'fieldRef',group:'inline',inline:true,atom:true,
  addOptions(){return {resolve:attrs=>'［'+attrs.field+'］'};},
  addAttributes(){return {field:{default:''},part:{default:'value'}};},
  parseHTML(){return [{tag:'span[data-field-ref]'}];},
  renderHTML({node,HTMLAttributes}){return ['span',mergeAttributes(HTMLAttributes,{'data-field-ref':node.attrs.field,class:'field-token'}),this.options.resolve(node.attrs)];},
  renderText({node}){return this.options.resolve(node.attrs);},
  addNodeView(){return ({node})=>{const dom=document.createElement('span');dom.className='field-token';dom.contentEditable='false';dom.textContent=this.options.resolve(node.attrs);dom.title=node.attrs.field;return {dom};};}
});
const rangeNode=(name,tag)=>Node.create({
 name,group:'block',content:'block+',defining:true,isolating:true,
 addOptions(){return {label:node=>globalThis.DocBench.wordControlLabel(node,{fields:[]}),onEdit:()=>{}};},
 addAttributes(){return name==='repeatBlock'?{field:{default:''}}:{when:{default:null}};},
 parseHTML(){return [{tag:'section[data-word-range="'+name+'"]',contentElement:'[data-range-content]',getAttrs:el=>{try{return JSON.parse(el.getAttribute('data-range-attrs')||'{}');}catch{return false;}}}];},
 renderHTML({node,HTMLAttributes}){return ['section',mergeAttributes(HTMLAttributes,{'data-word-range':name,'data-range-attrs':JSON.stringify(node.attrs),class:'word-control-range '+name}),['div',{'data-range-label':'',contenteditable:'false'},this.options.label(node)],['div',{'data-range-content':''},0]];},
 addNodeView(){return ({node,editor,getPos})=>{
  const dom=document.createElement('section'),label=document.createElement('button'),contentDOM=document.createElement('div'),end=document.createElement('button');dom.className='word-control-range '+name;dom.dataset.wordRange=name;label.className='word-range-label';label.type='button';label.contentEditable='false';label.setAttribute('aria-label',tag+'の設定');label.title='クリックして'+tag+'の設定';label.textContent=this.options.label(node);contentDOM.className='word-range-content';end.type='button';end.contentEditable='false';end.className='word-range-end';end.textContent=(name==='repeatBlock'?'ここまでを1件分としてくり返す':'ここまでを条件で表示')+' · 続きを外に書く';end.title='このまとまりの後に新しい段落を作ります';dom.append(label,contentDOM,end);
  label.addEventListener('mousedown',ev=>ev.preventDefault());label.addEventListener('click',()=>{editor.commands.setNodeSelection(getPos());this.options.onEdit();});
  end.addEventListener('mousedown',ev=>ev.preventDefault());end.addEventListener('click',()=>editor.chain().setNodeSelection(getPos()).exitControlRange().focus().run());
  return {dom,contentDOM,update:next=>{if(next.type.name!==name)return false;node=next;label.textContent=this.options.label(next);return true;},ignoreMutation:m=>m.target===label||label.contains(m.target)||m.target===end||end.contains(m.target)};
 };}
});
const RepeatBlock=rangeNode('repeatBlock','繰り返し'),ConditionBlock=rangeNode('conditionBlock','条件付き範囲');
const PageBreakNode=Node.create({name:'pageBreak',group:'block',atom:true,parseHTML(){return [{tag:'div[data-word-page-break]'}];},renderHTML(){return ['div',{'data-word-page-break':'',class:'word-page-break'},'改ページ'];}});
// A single ProseMirror document owns selection, clipboard and history across
// all saved blocks. Containers preserve the public Render Definition format.
const WordDocument=Node.create({name:'doc',topNode:true,content:'(wordSection | wordObject)+'});
const WordEditing=Extension.create({
 name:'wordEditing',priority:1100,
 addKeyboardShortcuts(){
  const join=backward=>({editor})=>{
   const {state,view}=editor,{$from,empty}=state.selection;
   if(!empty||$from.depth!==2||$from.node(1).type.name!=='wordSection'||!$from.parent.isTextblock)return false;
   const section=$from.node(1),atEdge=backward?$from.parentOffset===0&&$from.index(1)===0:$from.parentOffset===$from.parent.content.size&&$from.index(1)===section.childCount-1;
   if(!atEdge)return false;
   const pos=backward?$from.before(1):$from.after(1),neighbor=backward?state.doc.resolve(pos).nodeBefore:state.doc.resolve(pos).nodeAfter;
   if(neighbor?.type.name!=='wordSection'||!(backward?neighbor.lastChild:neighbor.firstChild)?.isTextblock||!canJoin(state.doc,pos))return false;
   const tr=state.tr.join(pos);if(canJoin(tr.doc,pos-1))tr.join(pos-1);view.dispatch(tr.scrollIntoView());return true;
  };
  const edge=(end,extend)=>{const editor=this.editor,{state,view}=editor,pos=TextSelection.near(state.doc.resolve(end?state.doc.content.size:0),end?-1:1).head;view.dispatch(state.tr.setSelection(TextSelection.create(state.doc,extend?state.selection.anchor:pos,pos)).scrollIntoView());return true;};
  return {Backspace:()=>join(true)({editor:this.editor}),Delete:()=>join(false)({editor:this.editor}),'Mod-Home':()=>edge(false,false),'Mod-End':()=>edge(true,false),'Mod-Shift-Home':()=>edge(false,true),'Mod-Shift-End':()=>edge(true,true)};
 }
});
function sourceAttrs(element){try{const value=JSON.parse(element.getAttribute('data-word-source')||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}}
const WordSection=Node.create({
 name:'wordSection',content:'block+',defining:true,
 addOptions(){return {style:()=>'',onSelect:()=>{}};},
 addAttributes(){return {id:{default:null},source:{default:null,rendered:false},draft:{default:false,rendered:false}};},
 parseHTML(){return [{tag:'section[data-word-section]',contentElement:'.tiptap',getAttrs:el=>({id:el.getAttribute('data-block-id'),source:sourceAttrs(el)})}];},
 renderHTML({node}){return ['section',{'data-word-section':'','data-block-id':node.attrs.id,'data-word-source':JSON.stringify(node.attrs.source)},['div',{class:'tiptap'},0]];},
 addNodeView(){return ({node,editor,getPos})=>{
  const dom=document.createElement('section'),handle=document.createElement('button'),contentDOM=document.createElement('div');
  dom.className='db-object word-flow-block';handle.className='word-flow-handle';handle.type='button';handle.contentEditable='false';handle.dataset.wordDrag='';handle.title='ドラッグして段落・表を移動';handle.setAttribute('aria-label','段落・表を移動');handle.textContent='⋮⋮';contentDOM.className='tiptap db-editing';contentDOM.contentEditable='true';contentDOM.editor=editor;dom.append(handle,contentDOM);
  const paint=()=>{dom.dataset.blockId=node.attrs.id;dom.classList.toggle('word-writing-gap',!!node.attrs.draft);dom.classList.toggle('word-empty',node.childCount===1&&node.firstChild.type.name==='paragraph'&&!node.firstChild.content.size);contentDOM.style.cssText=this.options.style(node.attrs.source||{});const source=node.attrs.source;contentDOM.style.setProperty('--word-heading-size',source?.type==='heading'&&source.style?.fontSize?source.style.fontSize+'pt':'initial');contentDOM.style.setProperty('--word-heading-weight',source?.type==='heading'&&typeof source.style?.bold==='boolean'?(source.style.bold?'bold':'normal'):'initial');};paint();
  handle.addEventListener('mousedown',ev=>ev.preventDefault());
  return {dom,contentDOM,update:next=>{if(next.type!==node.type)return false;node=next;paint();return true;},ignoreMutation:m=>m.type!=='selection'&&(m.target===dom||m.target===handle||handle.contains(m.target)||m.type==='attributes'&&m.target===contentDOM)};
 };}
});
const WordObject=Node.create({
 name:'wordObject',atom:true,selectable:true,
 addOptions(){return {render:()=>'',text:()=>'',onSelect:()=>{}};},
 addAttributes(){return {id:{default:null},source:{default:null,rendered:false}};},
 parseHTML(){return [{tag:'section[data-word-object]',getAttrs:el=>{const source=sourceAttrs(el);return source&&['field','table','pagebreak'].includes(source.type)?{id:el.getAttribute('data-block-id'),source}:false;}}];},
 renderHTML({node}){return ['section',{'data-word-object':'','data-block-id':node.attrs.id,'data-word-source':JSON.stringify(node.attrs.source)},this.options.text(node.attrs.source)];},
 renderText({node}){return this.options.text(node.attrs.source);},
 addNodeView(){return ({node,editor,getPos})=>{
  const dom=document.createElement('section');dom.className='db-object word-bound-block';dom.contentEditable='false';dom.tabIndex=0;
  const paint=()=>{dom.dataset.blockId=node.attrs.id;dom.innerHTML=this.options.render(node.attrs.source);};paint();
  dom.addEventListener('mousedown',ev=>{if(ev.button!==0)return;ev.preventDefault();editor.commands.setNodeSelection(getPos());this.options.onSelect(node.attrs.id,ev.target.closest('[data-style-part]')?.dataset.stylePart||'value');editor.view.focus();});
  return {dom,update:next=>{if(next.type!==node.type)return false;node=next;paint();return true;},selectNode:()=>dom.classList.add('db-selected'),deselectNode:()=>dom.classList.remove('db-selected'),ignoreMutation:()=>true};
 };}
});
const ControlRanges=Extension.create({name:'controlRanges',addCommands(){return {exitControlRange:()=>({state,dispatch})=>{const {selection}=state,{$from}=selection;let pos=['repeatBlock','conditionBlock'].includes(selection.node?.type.name)?selection.to:null;for(let depth=$from.depth;pos===null&&depth>0;depth--)if(['repeatBlock','conditionBlock'].includes($from.node(depth).type.name))pos=$from.after(depth);if(pos===null)return false;const tr=state.tr.insert(pos,state.schema.nodes.paragraph.create());if(dispatch)dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos+1))).scrollIntoView());return true;}};},addKeyboardShortcuts(){return {'Mod-Enter':()=>this.editor.commands.exitControlRange()||this.editor.commands.insertContent({type:'pageBreak'})};}});

// Row templates remain ordinary table rows, preserving native table editing and merged cells.
function rowRepeatInfo(state){
 if(!isInTable(state))return null;const rect=selectedRect(state),rows=[];rect.table.forEach((node,offset)=>rows.push({node,pos:rect.tableStart+offset}));let from=rect.top,to=rect.bottom;
 const group=rows[from]?.node.attrs.repeatGroup,field=rows[from]?.node.attrs.field;
 if(group){while(from>0&&rows[from-1].node.attrs.repeatGroup===group)from--;while(to<rows.length&&rows[to].node.attrs.repeatGroup===group)to++;}
 return {...rect,rows,from,to,group,field};
}
const RowRepeats=Extension.create({
 name:'rowRepeats',addOptions(){return {definition:{fields:[]},onInvalid:()=>{}};},
 addGlobalAttributes(){return [{types:['tableRow'],attributes:{field:{default:null,parseHTML:el=>el.getAttribute('data-repeat-field'),renderHTML:a=>a.field?{'data-repeat-field':a.field}:{}},repeatGroup:{default:null,parseHTML:el=>el.getAttribute('data-repeat-group'),renderHTML:a=>a.repeatGroup?{'data-repeat-group':a.repeatGroup}:{}}}}];},
 addCommands(){return {setRepeatedRows:({field,from,to,remove=false})=>({state,tr,dispatch})=>{
  const info=rowRepeatInfo(state);if(!info||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>info.rows.length||from>=to)return false;
  const touched=new Set(info.rows.slice(from,to).map(r=>r.node.attrs.repeatGroup).filter(Boolean)),group=globalThis.DocBench.uid(),copy=info.table.toJSON();
  for(let i=0;i<copy.content.length;i++){const a={...copy.content[i].attrs};if(touched.has(a.repeatGroup)){a.field=null;a.repeatGroup=null;}if(!remove&&i>=from&&i<to){a.field=field;a.repeatGroup=group;}copy.content[i].attrs=a;}
  const errors=globalThis.DocBench.wordRowRepeatErrors(copy);if(errors.length){this.options.onInvalid(errors[0]);return false;}
  if(dispatch){for(let i=0;i<info.rows.length;i++)tr.setNodeMarkup(info.rows[i].pos,undefined,copy.content[i].attrs);dispatch(tr);}return true;
 }};},
 addProseMirrorPlugins(){const cfg=this.options;return [new Plugin({filterTransaction(tr){if(!tr.docChanged)return true;let error=null;tr.doc.descendants(n=>{if(n.type.name==='table'){error||=globalThis.DocBench.wordRowRepeatErrors(n.toJSON())[0];}});if(error){cfg.onInvalid(error);return false;}return true;},props:{decorations(state){const decorations=[];state.doc.descendants((table,pos)=>{if(table.type.name!=='table')return;let previous=null;table.forEach((row,offset,index)=>{const a=row.attrs;if(!a.repeatGroup){previous=null;return;}decorations.push(Decoration.node(pos+1+offset,pos+1+offset+row.nodeSize,{class:'word-repeated-row','data-repeat-field':a.field,'aria-label':'データ1件分の明細行'}));if(a.repeatGroup!==previous&&row.firstChild){let count=1;while(index+count<table.childCount&&table.child(index+count).attrs.repeatGroup===a.repeatGroup)count++;const label=(globalThis.DocBench.richFieldAt(cfg.definition,a.field)?.label||a.field)+'：'+count+'行を1件分としてくり返す';decorations.push(Decoration.node(pos+offset+2,pos+offset+2+row.firstChild.nodeSize,{class:'word-repeat-start-cell','data-repeat-label':label}));}previous=a.repeatGroup;});});return DecorationSet.create(state.doc,decorations);}}})];}
});

const cellExtension=tag=>({addAttributes(){return {...this.parent?.(),border:{default:null},borderWidth:{default:0.5},borders:{default:null},fill:{default:null},padding:{default:null},valign:{default:null}};},renderHTML({node,HTMLAttributes}){const a={padding:6,valign:'top',...Object.fromEntries(Object.entries(node.attrs).filter(([,v])=>v!=null))};return [tag,mergeAttributes(HTMLAttributes,{style:globalThis.DocBench.cellBorderCSS(a)+'background:'+(a.fill||'transparent')+';padding:'+a.padding+'px;vertical-align:'+a.valign}),0];}});
const Cell = TableCell.extend(cellExtension('td'));
const CellHeader = TableHeader.extend(cellExtension('th'));
// ProseMirror owns cell geometry and selection, including merged and nested cells.
const TableBorders=Extension.create({name:'tableBorders',addCommands(){return {setTableBorders:({preset,scope='table',color='#172b39',width=.5,style='single',erase=false})=>({state,dispatch})=>{
 if(!isInTable(state))return false;
 const selection=selectedRect(state),{map,table,tableStart}=selection,r=scope==='table'?{left:0,top:0,right:map.width,bottom:map.height}:selection;
 const edge={color,width,style},changes=new Map(),sides=['top','right','bottom','left'];
 const attrs=pos=>{if(!changes.has(pos)){const a=table.nodeAt(pos).attrs;changes.set(pos,{...a,borders:Object.fromEntries(sides.map(side=>[side,globalThis.DocBench.cellBorder(a,side)]))});}return changes.get(pos);};
 const replace=['all','outer','inside','none'].includes(preset);
 for(const pos of map.cellsInRect(r)){
  const c=map.findCell(pos),a=attrs(pos),outer={top:c.top===r.top,bottom:c.bottom===r.bottom,left:c.left===r.left,right:c.right===r.right};
  for(const side of sides){
   const set=replace||preset===side&&outer[side]||preset==='horizontal'&&['top','bottom'].includes(side)&&!outer[side]||preset==='vertical'&&['left','right'].includes(side)&&!outer[side];if(!set)continue;
   const on=preset==='all'||preset==='outer'&&outer[side]||preset==='inside'&&!outer[side]||!replace;
   a.borders[side]=on&&!erase?edge:'none';
   // Shared edges agree on both cells, so clearing an edge really removes it.
   const neighbors=[];if(side==='top'&&c.top>0)for(let x=c.left;x<c.right;x++)neighbors.push(map.map[(c.top-1)*map.width+x]);
   if(side==='bottom'&&c.bottom<map.height)for(let x=c.left;x<c.right;x++)neighbors.push(map.map[c.bottom*map.width+x]);
   if(side==='left'&&c.left>0)for(let y=c.top;y<c.bottom;y++)neighbors.push(map.map[y*map.width+c.left-1]);
   if(side==='right'&&c.right<map.width)for(let y=c.top;y<c.bottom;y++)neighbors.push(map.map[y*map.width+c.right]);
   const opposite={top:'bottom',bottom:'top',left:'right',right:'left'}[side];
   for(const other of new Set(neighbors)){const neighbor=map.findCell(other);if((side==='top'||side==='bottom')?(neighbor.left===c.left&&neighbor.right===c.right):(neighbor.top===c.top&&neighbor.bottom===c.bottom))attrs(other).borders[opposite]=a.borders[side];}
  }
 }
 if(dispatch){const tr=state.tr;for(const [pos,a] of changes)tr.setNodeMarkup(tableStart+pos,undefined,a);dispatch(tr);}return true;
 }};}});
const Identity = Extension.create({name:'richIdentity',addGlobalAttributes(){return [{types:['paragraph','heading','table','tableRow','tableCell','tableHeader','fieldRef','listItem','bulletList','orderedList','blockquote','horizontalRule','repeatBlock','conditionBlock','pageBreak'],attributes:{id:{default:null,parseHTML:element=>element.getAttribute('data-rich-id'),renderHTML:attrs=>attrs.id?{'data-rich-id':attrs.id}:{}}}}];},addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,oldState,state){if(!transactions.some(t=>t.docChanged))return null;const seen=new Set(),tr=state.tr;state.doc.descendants((node,pos)=>{if(!('id' in node.attrs))return;let id=node.attrs.id;if(!id||seen.has(id)){id=globalThis.DocBench.uid();tr.setNodeMarkup(pos,undefined,{...node.attrs,id});}seen.add(id);});return tr.docChanged?tr:null;}})];}});
globalThis.DocBenchEditorLib={Editor,StarterKit,Table,TableRow,Cell,CellHeader,TextStyleKit,FieldRef,ParagraphFormat,Identity,TableBorders,Subscript,Superscript,Selection,TextSelection,StepMap,RepeatBlock,ConditionBlock,PageBreakNode,ControlRanges,ToolbarSelection,ListTypography,CharacterStyle,WordTab,WordFormatting,WordDocument,WordSection,WordObject,WordEditing,RowRepeats,rowRepeatInfo};
