import { Editor, Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { selectedRect, isInTable } from '@tiptap/pm/tables';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';

const FieldRef = Node.create({
  name:'fieldRef',group:'inline',inline:true,atom:true,
  addOptions(){return {resolve:attrs=>'［'+attrs.field+'］'};},
  addAttributes(){return {field:{default:''},part:{default:'value'}};},
  parseHTML(){return [{tag:'span[data-field-ref]'}];},
  renderHTML({node,HTMLAttributes}){return ['span',mergeAttributes(HTMLAttributes,{'data-field-ref':node.attrs.field,class:'field-token'}),this.options.resolve(node.attrs)];},
  addNodeView(){return ({node})=>{const dom=document.createElement('span');dom.className='field-token';dom.contentEditable='false';dom.textContent=this.options.resolve(node.attrs);dom.title=node.attrs.field;return {dom};};}
});
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
const Identity = Extension.create({name:'richIdentity',addGlobalAttributes(){return [{types:['paragraph','heading','table','tableRow','tableCell','tableHeader','fieldRef','listItem','bulletList','orderedList','blockquote','horizontalRule'],attributes:{id:{default:null,parseHTML:element=>element.getAttribute('data-rich-id'),renderHTML:attrs=>attrs.id?{'data-rich-id':attrs.id}:{}}}}];},addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,oldState,state){if(!transactions.some(t=>t.docChanged))return null;const seen=new Set(),tr=state.tr;state.doc.descendants((node,pos)=>{if(!('id' in node.attrs))return;let id=node.attrs.id;if(!id||seen.has(id)){id=globalThis.DocBench.uid();tr.setNodeMarkup(pos,undefined,{...node.attrs,id});}seen.add(id);});return tr.docChanged?tr:null;}})];}});
globalThis.DocBenchEditorLib={Editor,StarterKit,Table,TableRow,Cell,CellHeader,TextStyleKit,FieldRef,ParagraphFormat,Identity,TableBorders,Subscript,Superscript};
