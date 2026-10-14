import { Editor, Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
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
const Cell = TableCell.extend({addAttributes(){return {...this.parent?.(),border:{default:'none'},borderWidth:{default:0.5},fill:{default:null},padding:{default:6},valign:{default:'top'}};},renderHTML({node,HTMLAttributes}){const a=node.attrs;return ['td',mergeAttributes(HTMLAttributes,{style:'border:'+(a.border==='none'?'none':a.borderWidth+'pt solid '+a.border)+';background:'+(a.fill||'transparent')+';padding:'+a.padding+'px;vertical-align:'+a.valign}),0];}});
const CellHeader = TableHeader.extend({addAttributes(){return {...this.parent?.(),border:{default:'none'},borderWidth:{default:0.5},fill:{default:null},padding:{default:6},valign:{default:'top'}};},renderHTML({node,HTMLAttributes}){const a=node.attrs;return ['th',mergeAttributes(HTMLAttributes,{style:'border:'+(a.border==='none'?'none':a.borderWidth+'pt solid '+a.border)+';background:'+(a.fill||'transparent')+';padding:'+a.padding+'px;vertical-align:'+a.valign}),0];}});
const ParagraphFormat = Extension.create({name:'paragraphFormat',addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{textAlign:{default:'left',renderHTML:a=>({style:'text-align:'+a.textAlign})},lineHeight:{default:null,renderHTML:a=>a.lineHeight?{style:'line-height:'+a.lineHeight}:{}},spaceBefore:{default:0,renderHTML:a=>({style:'margin-top:'+a.spaceBefore+'pt'})},spaceAfter:{default:8,renderHTML:a=>({style:'margin-bottom:'+a.spaceAfter+'pt'})},bottomBorder:{default:'none',renderHTML:a=>({style:'border-bottom:'+(a.bottomBorder==='none'?'none':'1pt solid '+a.bottomBorder)})}}}];}});
const Identity = Extension.create({name:'richIdentity',addGlobalAttributes(){return [{types:['paragraph','heading','table','tableRow','tableCell','tableHeader','fieldRef','listItem','bulletList','orderedList','blockquote','horizontalRule'],attributes:{id:{default:null,parseHTML:element=>element.getAttribute('data-rich-id'),renderHTML:attrs=>attrs.id?{'data-rich-id':attrs.id}:{}}}}];},addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,oldState,state){if(!transactions.some(t=>t.docChanged))return null;const seen=new Set(),tr=state.tr;state.doc.descendants((node,pos)=>{if(!('id' in node.attrs))return;let id=node.attrs.id;if(!id||seen.has(id)){id=globalThis.DocBench.uid();tr.setNodeMarkup(pos,undefined,{...node.attrs,id});}seen.add(id);});return tr.docChanged?tr:null;}})];}});
globalThis.DocBenchEditorLib={Editor,StarterKit,Table,TableRow,Cell,CellHeader,TextStyleKit,FieldRef,ParagraphFormat,Identity};
