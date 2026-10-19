import { Editor, Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StepMap } from '@tiptap/pm/transform';
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
 addProseMirrorPlugins(){const base=this.options;return [new Plugin({props:{decorations:state=>{const decorations=[];state.doc.descendants((n,pos)=>{if(n.type.name==='listItem'){const item=n.toJSON();decorations.push(Decoration.node(pos,pos+n.nodeSize,{style:'--word-marker-size:'+globalThis.DocBench.listMarkerSize(item,base)+'pt;--word-marker-color:'+globalThis.DocBench.listMarkerColor(item,base)}));}});return DecorationSet.create(state.doc,decorations);}}})];},
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
  addNodeView(){return ({node})=>{const dom=document.createElement('span');dom.className='field-token';dom.contentEditable='false';dom.textContent=this.options.resolve(node.attrs);dom.title=node.attrs.field;return {dom};};}
});
const rangeNode=(name,tag)=>Node.create({
 name,group:'block',content:'block+',defining:true,isolating:true,
 addOptions(){return {label:node=>globalThis.DocBench.wordControlLabel(node,{fields:[]}),onEdit:()=>{}};},
 addAttributes(){return name==='repeatBlock'?{field:{default:''}}:{when:{default:null}};},
 parseHTML(){return [{tag:'section[data-word-range="'+name+'"]',contentElement:'[data-range-content]',getAttrs:el=>{try{return JSON.parse(el.getAttribute('data-range-attrs')||'{}');}catch{return false;}}}];},
 renderHTML({node,HTMLAttributes}){return ['section',mergeAttributes(HTMLAttributes,{'data-word-range':name,'data-range-attrs':JSON.stringify(node.attrs),class:'word-control-range '+name}),['div',{'data-range-label':'',contenteditable:'false'},this.options.label(node)],['div',{'data-range-content':''},0]];},
 addNodeView(){return ({node,editor,getPos})=>{
  const dom=document.createElement('section'),label=document.createElement('div'),contentDOM=document.createElement('div');dom.className='word-control-range '+name;dom.dataset.wordRange=name;label.className='word-range-label';label.contentEditable='false';label.setAttribute('role','button');label.setAttribute('aria-label',tag+'の設定');label.title='クリックして'+tag+'の設定';label.textContent=this.options.label(node);contentDOM.className='word-range-content';dom.append(label,contentDOM);
  label.addEventListener('mousedown',ev=>{ev.preventDefault();editor.commands.setNodeSelection(getPos());this.options.onEdit();});
  return {dom,contentDOM,update:next=>{if(next.type.name!==name)return false;node=next;label.textContent=this.options.label(next);return true;},ignoreMutation:m=>m.target===label||label.contains(m.target)};
 };}
});
const RepeatBlock=rangeNode('repeatBlock','繰り返し'),ConditionBlock=rangeNode('conditionBlock','条件付き範囲');
const PageBreakNode=Node.create({name:'pageBreak',group:'block',atom:true,parseHTML(){return [{tag:'div[data-word-page-break]'}];},renderHTML(){return ['div',{'data-word-page-break':'',class:'word-page-break'},'改ページ'];}});
const ControlRanges=Extension.create({name:'controlRanges',addCommands(){return {exitControlRange:()=>({state,dispatch})=>{const {selection}=state,{$from}=selection;let pos=['repeatBlock','conditionBlock'].includes(selection.node?.type.name)?selection.to:null;for(let depth=$from.depth;pos===null&&depth>0;depth--)if(['repeatBlock','conditionBlock'].includes($from.node(depth).type.name))pos=$from.after(depth);if(pos===null)return false;const tr=state.tr.insert(pos,state.schema.nodes.paragraph.create());if(dispatch)dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos+1))).scrollIntoView());return true;}};},addKeyboardShortcuts(){return {'Mod-Enter':()=>this.editor.commands.exitControlRange()||this.editor.commands.insertContent({type:'pageBreak'})};}});

const cellExtension=tag=>({addAttributes(){return {...this.parent?.(),border:{default:'none'},borderWidth:{default:0.5},borders:{default:null},fill:{default:null},padding:{default:6},valign:{default:'top'}};},renderHTML({node,HTMLAttributes}){const a=node.attrs;return [tag,mergeAttributes(HTMLAttributes,{style:globalThis.DocBench.cellBorderCSS(a)+'background:'+(a.fill||'transparent')+';padding:'+a.padding+'px;vertical-align:'+a.valign}),0];}});
const Cell = TableCell.extend(cellExtension('td'));
const CellHeader = TableHeader.extend(cellExtension('th'));
// ProseMirror owns cell geometry and selection, including merged and nested cells.
const TableBorders=Extension.create({name:'tableBorders',addCommands(){return {setTableBorders:({preset,scope='table',color='#172b39',width=.5,style='single'})=>({state,dispatch})=>{
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
   a.borders[side]=on?edge:'none';
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
const ParagraphFormat = Extension.create({name:'paragraphFormat',addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{textAlign:{default:'left',renderHTML:a=>({style:'text-align:'+a.textAlign})},lineHeight:{default:null,renderHTML:a=>a.lineHeight?{style:'line-height:'+a.lineHeight}:{}},spaceBefore:{default:0,renderHTML:a=>({style:'margin-top:'+a.spaceBefore+'pt'})},spaceAfter:{default:8,renderHTML:a=>({style:'margin-bottom:'+a.spaceAfter+'pt'})},bottomBorder:{default:'none',renderHTML:a=>({style:'border-bottom:'+(a.bottomBorder==='none'?'none':'1pt solid '+a.bottomBorder)})}}}];}});
const Identity = Extension.create({name:'richIdentity',addGlobalAttributes(){return [{types:['paragraph','heading','table','tableRow','tableCell','tableHeader','fieldRef','listItem','bulletList','orderedList','blockquote','horizontalRule','repeatBlock','conditionBlock','pageBreak'],attributes:{id:{default:null,parseHTML:element=>element.getAttribute('data-rich-id'),renderHTML:attrs=>attrs.id?{'data-rich-id':attrs.id}:{}}}}];},addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,oldState,state){if(!transactions.some(t=>t.docChanged))return null;const seen=new Set(),tr=state.tr;state.doc.descendants((node,pos)=>{if(!('id' in node.attrs))return;let id=node.attrs.id;if(!id||seen.has(id)){id=globalThis.DocBench.uid();tr.setNodeMarkup(pos,undefined,{...node.attrs,id});}seen.add(id);});return tr.docChanged?tr:null;}})];}});
globalThis.DocBenchEditorLib={Editor,StarterKit,Table,TableRow,Cell,CellHeader,TextStyleKit,FieldRef,ParagraphFormat,Identity,TableBorders,Subscript,Superscript,Selection,TextSelection,StepMap,RepeatBlock,ConditionBlock,PageBreakNode,ControlRanges,ToolbarSelection,ListTypography};
