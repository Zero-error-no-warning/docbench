'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../scripts/load-core.cjs');
global.docx=require('../scripts/qa/node_modules/docx');const JSZip=require('../scripts/qa/node_modules/jszip');
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../src/render.js'),'utf8'));
test('Unified Word editor preserves legacy identity, output rules and field bindings without materializing input',()=>{
 const blocks=[{id:'title',type:'heading',text:'Title',style:{fontSize:25},when:{field:'status',equals:'完了'}},{id:'prose',type:'rich',content:D.identifyRich(D.plainRich('One\nTwo'))},{id:'bound',type:'field',field:'budget',appendixAfter:100,valueStyle:{color:'#123456'}},{id:'data',type:'table',field:'expenses',rowsPerPage:10}];
 const before=D.clone(blocks),tree=D.wordEditorDocument(blocks),restored=D.wordEditorBlocks(tree);assert.deepEqual(D.wordEditorDocument(blocks),tree);
 assert.deepEqual(blocks,before);assert.deepEqual(restored.map(b=>b.id),blocks.map(b=>b.id));assert.equal(restored[0].content.content[0].type,'heading');
 for(const b of restored){assert.deepEqual(D.validateRich(b.content||D.plainRich('')),[]);const original=blocks.find(x=>x.id===b.id);for(const key of ['style','when','field','appendixAfter','valueStyle','rowsPerPage'])assert.deepEqual(b[key],original[key]);}
 assert(!JSON.stringify(restored).includes('wordSection'));assert(!JSON.stringify(restored).includes('wordObject'));assert(!JSON.stringify(restored).includes('draft'));
 assert.deepEqual(D.wordEditorBlocks(D.wordEditorDocument([])),[]);
 const gap=tree.content.find(n=>n.attrs.draft);gap.content[0].content=[{type:'text',text:'New prose'}];const withGap=D.wordEditorBlocks(tree);assert.equal(withGap.length,5);assert.equal(withGap.find(b=>b.id===gap.attrs.id).text,'New prose');
 assert.equal(D.wordEditorDocument(withGap).content.filter(n=>n.attrs.id===gap.attrs.id).length,1);
});
test('Word headings carry semantic levels and quotes retain indentation in native output',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx');d.blocks=[{id:'legacy',type:'heading',text:'Legacy title',style:{fontSize:27}},{id:'rich',type:'rich',content:D.identifyRich({type:'doc',content:[{type:'heading',attrs:{level:3},content:[{type:'text',text:'Nested title'}]},{type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Quoted prose'}]}]}]})}];
 d.blocks=D.wordEditorBlocks(D.wordEditorDocument(d.blocks));
 const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
 const paragraph=t=>[...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].find(m=>m[0].includes(t))[0];
 assert(paragraph('Legacy title').includes('w:pStyle w:val="Heading1"'));assert(paragraph('Legacy title').includes('w:sz w:val="54"'));assert(paragraph('Nested title').includes('w:pStyle w:val="Heading3"'));assert(paragraph('Nested title').includes('w:outlineLvl w:val="2"'));
 assert(paragraph('Quoted prose').includes('w:left="360"'));assert(paragraph('Quoted prose').includes('w:color="ACBCC4"'));
 assert(D.richHTML(d.blocks[1].content,w.definition,w.data.values).includes('padding:0 0 0 18pt'));
});
test('Word preview uses the exported header alignment and an honest page field placeholder',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx');w.render.documents[0].outputFormat='docx';Object.assign(d.settings,{header:'Header',footer:'Footer',font:'Meiryo'});
 const html=D.previewHTML(w.definition,w.render,w.data.values);assert(html.includes('header{text-align:right}'));assert(html.includes('［ページ番号］'));assert(!html.includes('Footer　1'));
 const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),header=await zip.file('word/header1.xml').async('string'),footer=await zip.file('word/footer1.xml').async('string');
 for(const token of ['w:val="right"','Meiryo','637780','w:sz w:val="18"'])assert(header.includes(token));assert(footer.includes('PAGE'));assert(footer.includes('637780'));
});
