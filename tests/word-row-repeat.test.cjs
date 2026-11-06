'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../scripts/load-core.cjs'),docx=require('../scripts/qa/node_modules/docx'),JSZip=require('../scripts/qa/node_modules/jszip');
global.docx=docx;global.JSZip=JSZip;vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../src/render.js'),'utf8'));
const text=t=>({type:'text',text:t}),p=(...content)=>({type:'paragraph',content}),ref=field=>({type:'fieldRef',attrs:{field,part:'value'}}),cell=(...content)=>({type:'tableCell',attrs:{rowspan:1,colspan:1},content}),row=(...content)=>({type:'tableRow',content});
function fixture(){const w=D.sample(),d=D.ensureDesign(w.render,'docx'),table={type:'table',content:[row(cell(p(text('Header'))),cell(p(text('Amount')))),row(cell(p(ref('expenses.category'))),cell(p(ref('expenses.amount')))),row(cell(p(ref('expenses.note'))),cell(p(text('detail')))),row(cell(p(text('Footer'))),cell(p(text('fixed'))))]};
 table.content[1].attrs={field:'expenses',repeatGroup:'detail'};table.content[2].attrs={field:'expenses',repeatGroup:'detail'};table.content[1].content[0].attrs={rowspan:1,colspan:1,borders:{bottom:{color:'#123456',width:1.5,style:'double'}},fill:'#abcdef'};
 w.data.values.expenses=[{_id:'a',category:'Equipment',amount:12,note:'First'},{_id:'b',category:'Travel',amount:0,note:'Second'}];d.blocks=[{id:'table',type:'rich',content:D.identifyRich({type:'doc',content:[table]})}];return {w,d,table:d.blocks[0].content.content[0]};}
test('one or multiple table rows expand per item with fixed header/footer and unchanged source',async()=>{
 const {w,d}=fixture(),before=JSON.stringify(d.blocks),tree=D.expandRich(d.blocks[0].content,w.definition,w.data.values),rows=tree.content[0].content;
 assert.deepEqual(D.validateDefinition(w.definition,w.render).errors,[]);assert.equal(rows.length,6);assert(D.richReferences(d.blocks[0].content).includes('expenses'));
 assert.equal(D.richText(tree,w.definition,w.data.values,undefined,true).match(/Header/g).length,1);assert.deepEqual(rows[1].content[0].attrs,rows[3].content[0].attrs);assert.equal(rows[1].content[0].content[0].content[0].attrs.valuePath,'expenses.0.category');assert.equal(rows[3].content[0].content[0].content[0].attrs.valuePath,'expenses.1.category');assert.equal(JSON.stringify(d.blocks),before);
 const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await zip.file('word/document.xml').async('string');assert.equal((xml.match(/<w:tr>/g)||[]).length,6);for(const token of ['Equipment','Travel','First','Second','123456','ABCDEF'])assert(xml.includes(token));assert.equal((xml.match(/>Header<\/w:t>/g)||[]).length,1);assert.equal((xml.match(/>Footer<\/w:t>/g)||[]).length,1);
 w.data.values.expenses=[];const empty=D.expandRich(d.blocks[0].content,w.definition,w.data.values);assert.equal(empty.content[0].content.length,2);
 d.blocks[0].content.content[0].content=d.blocks[0].content.content[0].content.slice(1,3);assert.deepEqual(D.expandRich(d.blocks[0].content,w.definition,w.data.values).content,[]);
});
test('vertical merges must stay within one template group and survive repeated native rows',async()=>{
 const {w,d,table}=fixture();table.content[1].content[0].attrs.rowspan=2;table.content[2].content.shift();assert.deepEqual(D.validateDefinition(w.definition,w.render).errors,[]);
 const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await zip.file('word/document.xml').async('string');assert.equal((xml.match(/w:vMerge w:val="restart"/g)||[]).length,2);
 table.content[2].attrs={};assert(D.wordRowRepeatErrors(table).some(s=>s.includes('縦結合')));
 table.content[2].attrs={field:'expenses',repeatGroup:'detail'};table.content[3].attrs={field:'expenses',repeatGroup:'other'};table.content.push(row(cell(p()),cell(p())));table.content[4].attrs={field:'expenses',repeatGroup:'detail'};assert(D.wordRowRepeatErrors(table).some(s=>s.includes('連続')));
});
test('row bindings validate collection scope, retain nested values and survive workspace serialization',()=>{
 const {w,d,table}=fixture();assert.doesNotThrow(()=>D.assertImport(JSON.parse(JSON.stringify(w))));table.content[1].attrs.field='projectName';table.content[2].attrs.field='projectName';assert(D.validateRichDefinition(d.blocks[0].content,w.definition).length);
 table.content[1].attrs.field='expenses';table.content[2].attrs.field='expenses';d.blocks[0].content={type:'doc',content:[{type:'repeatBlock',attrs:{field:'expenses'},content:[table]}]};assert(D.validateRichDefinition(d.blocks[0].content,w.definition).some(s=>s.includes('自身')));
});
test('row templates inside an outer loop resolve both outer and nested collection values',()=>{
 const w=D.createWorkspace('Nested rows','Test','docx');w.definition.fields=[D.field('groups','Groups','Array',{itemType:'Object',fields:[D.field('name','Group'),D.field('items','Items','Array',{itemType:'Object',fields:[D.field('name','Item')]})]})];w.data.values={groups:[{_id:'a',name:'A',items:[{_id:'x',name:'X'},{_id:'y',name:'Y'}]},{_id:'b',name:'B',items:[{_id:'z',name:'Z'}]}]};
 const detail=row(cell(p(ref('groups.name'),text('/'),ref('groups.items.name'))));detail.attrs={field:'groups.items',repeatGroup:'nested'};
 const content=D.identifyRich({type:'doc',content:[{type:'repeatBlock',attrs:{field:'groups'},content:[{type:'table',content:[detail]}]}]});assert.deepEqual(D.validateRichDefinition(content,w.definition),[]);assert.equal(D.richText(content,w.definition,w.data.values),'A/X\nA/Y\nB/Z');
 const outside=D.identifyRich({type:'doc',content:[{type:'table',content:[detail]}]});assert(D.validateRichDefinition(outside,w.definition).some(s=>s.includes('親')));
});
