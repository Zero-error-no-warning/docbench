'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const D=require('../scripts/load-core.cjs');
const dependency=name=>{try{return require(name);}catch{return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||path.join(__dirname,'../scripts/qa/node_modules'),name));}};
global.docx=dependency('docx');global.JSZip=dependency('jszip');global.PptxGenJS=dependency('pptxgenjs');global.ExcelJS=dependency('exceljs');global.pako=dependency('pako');
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../src/render.js'),'utf8'));
test('Word arbitrary layout tables, nested tables, field references and marks survive native export',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx'),tree=D.identifyRich(D.tableRich(3,3));
 const row=tree.content[0].content[0];row.content[0].attrs.colwidth=[180];row.content[1].attrs.colwidth=[90];row.content[2].attrs.colwidth=[90];
 row.content[0].content[0].content=[{type:'text',text:'Fixed text',marks:[{type:'underline'},{type:'textStyle',attrs:{color:'#112233',fontSize:'17pt'}}]}];
 row.content[1].content[0].content=[{type:'fieldRef',attrs:{field:'projectName',part:'value'}}];
 row.content[2].attrs.fill='#abcdef';row.content[2].attrs.border='#123456';
 tree.content[0].content[2].content[2].content=D.tableRich(1,2).content;
 d.blocks=[{id:'layout',type:'rich',content:D.identifyRich(tree)}];
 assert.equal(D.validateDefinition(w.definition,w.render).errors.length,0);
 const html=D.previewHTML(w.definition,{...D.renderDocument(w.render),outputFormat:'docx'},w.data.values);assert(html.includes('width:50%'));assert(html.includes('text-decoration:underline'));assert(html.includes('border:none'));assert(html.includes('background:#abcdef'));assert.equal((html.match(/class="layout-table"/g)||[]).length,2);
 const z=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await z.file('word/document.xml').async('string');
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,2);assert(xml.includes('Fixed text'));assert(xml.includes('窓口業務の改善事業'));assert(xml.includes('w:u'));assert(xml.includes('112233'));assert(xml.includes('w:sz w:val="34"'));assert(xml.includes('w:fill="ABCDEF"'));assert(xml.includes('w:val="none"'));assert(!xml.includes('w:color="auto"'));
 const exported=JSON.stringify(D.envelope(w,'RenderDefinition'));assert(!exported.includes('窓口業務の改善事業'));assert(exported.includes('projectName'));
});
test('label and value styles are independent, and headings have no implicit underline',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx');d.blocks=[{id:'head',type:'heading',text:'Plain heading'},{id:'field',type:'field',field:'budget',labelStyle:{fill:'#abcdef',underline:true,bold:false},valueStyle:{fill:null,color:'#112233'}}];
 const html=D.previewHTML(w.definition,{...D.renderDocument(w.render),outputFormat:'docx'},w.data.values);assert(!html.includes('border-bottom:3px'));assert(html.includes('data-style-part="label"'));assert(html.includes('background:#abcdef'));assert(html.includes('color:#112233'));
 const z=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await z.file('word/document.xml').async('string');assert(xml.includes('w:fill="ABCDEF"'));assert(xml.includes('112233'));assert(xml.includes('w:u'));
});
test('Excel free cells, rectangular merges, styles and sizes survive ExcelJS readback',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'xlsx');d.blocks=[];d.cellValues={C4:'=literal',B9:'Free text'};d.cellStyles={C4:{underline:true,italic:true,fill:null,bottomBorder:'#123456',color:'#112233'},B9:{fill:'#abcdef',border:'#334455',fontSize:17}};d.cellMerges=[{id:'merge',cell:'C4',span:3,rowSpan:2}];d.columnWidths={B:32};d.rowHeights={9:44};d.settings.printArea='A1:F15';
 const book=new ExcelJS.Workbook();await book.xlsx.load(await(await D.excel(w.definition,w.render,w.data.values)).arrayBuffer());const sheet=book.worksheets[0];
 assert.equal(sheet.getCell('C4').value,'=literal');assert(sheet.getCell('C4').font.underline===true||sheet.getCell('C4').font.underline==='single');assert.equal(sheet.getCell('C4').font.italic,true);assert.equal(sheet.getCell('C4').border.bottom.color.argb,'FF123456');assert.equal(sheet.getCell('B9').fill.fgColor.argb,'FFABCDEF');assert.equal(sheet.getColumn('B').width,32);assert.equal(sheet.getRow(9).height,44);assert.equal(sheet.getCell('E5').master.address,'C4');assert.equal(sheet.pageSetup.printArea,'A1:F15');
});
test('PowerPoint shape and text rotation preserve editable objects and underlining',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'pptx');d.blocks=[{id:'shape',type:'shape',shape:'ellipse',layout:{slide:1,x:1,y:1,w:5,h:3,rotation:30},style:{fill:'#abcdef',border:'#123456'}},{id:'text',type:'text',text:'Underlined',layout:{slide:1,x:7,y:1,w:10,h:3,rotation:15},style:{underline:true,italic:true,bottomBorder:'#334455'}}];
 const z=await JSZip.loadAsync(await(await D.pptx(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await z.file('ppt/slides/slide1.xml').async('string');assert(xml.includes('prst="ellipse"'));assert(xml.includes('rot="1800000"'));assert(xml.includes('rot="900000"'));assert(xml.includes('u="sng"'));assert(xml.includes('ABCDEF'));assert(xml.includes('Underlined'));
});
test('rich references, malformed styles and overlapping table IDs are rejected',()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx');d.blocks=[{id:'rich',type:'rich',content:{type:'doc',content:[{type:'paragraph',content:[{type:'fieldRef',attrs:{field:'missing',part:'value'}}]}]}}];assert(D.validateDefinition(w.definition,w.render).errors.some(x=>x.message.includes('未定義')));
 d.blocks[0].content=D.identifyRich(D.tableRich(2,2));d.blocks[0].content.content[0].content[0].content[1].attrs.id=d.blocks[0].content.content[0].content[0].content[0].attrs.id;assert(D.validateDefinition(w.definition,w.render).errors.some(x=>x.message.includes('ID')));
 const sheet=D.ensureDesign(w.render,'xlsx');sheet.cellStyles={A1:{fill:'red'}};sheet.columnWidths={A:-1};assert(D.validateDefinition(w.definition,w.render).errors.some(x=>x.message.includes('列幅')));
});
test('rich paragraphs merge by stable node identity rather than array position',()=>{
 const b=D.identifyRich(D.plainRich('First\nSecond')),l=D.clone(b),r=D.clone(b);l.content[0].content[0].text='Left';r.content[1].content[0].text='Right';const result=D.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.value.content[0].content[0].text,'Left');assert.equal(result.value.content[1].content[0].text,'Right');
});

test('Word horizontal and vertical merged cells remain native table spans',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx'),tree=D.identifyRich(D.tableRich(3,3)),rows=tree.content[0].content;
 rows[0].content[0].attrs.rowspan=2;rows[1].content.shift();rows[2].content[0].attrs.colspan=2;rows[2].content[0].attrs.colwidth=[100,100];rows[2].content.splice(1,1);d.blocks=[{id:'merged',type:'rich',content:tree}];
 assert.equal(D.validateDefinition(w.definition,w.render).errors.length,0);const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await zip.file('word/document.xml').async('string');assert(xml.includes('w:vMerge w:val="restart"'));assert(xml.includes('w:vMerge w:val="continue"'));assert(xml.includes('w:gridSpan w:val="2"'));
});
test('malformed rich marks and unbounded table spans are reported without crashing',()=>{
 for(const content of [{type:'doc',content:[{type:'paragraph',marks:{},content:[]}]},{type:'doc',content:[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1e12},content:[]}]}]}]},{type:'doc',content:[{type:'table',content:[{type:'tableRow',content:[null]}]}]}])assert(D.validateRich(content).length>0);
});
test('per-side table borders and script marks agree in HTML and native Word export',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx'),tree=D.identifyRich(D.tableRich(1,2)),cells=tree.content[0].content[0].content;
 cells[0].attrs.borders={top:{color:'#112233',width:1.5,style:'double'},left:{color:'#112233',width:1.5,style:'double'},bottom:'none',right:'none'};
 cells[1].attrs.borders={top:'none',left:'none',bottom:{color:'#445566',width:1,style:'dashed'},right:{color:'#778899',width:.5,style:'dotted'}};
 cells[0].content[0].content=[{type:'text',text:'Raised',marks:[{type:'superscript'}]},{type:'text',text:'Lowered',marks:[{type:'subscript'}]},{type:'fieldRef',attrs:{field:'projectName',part:'value'},marks:[{type:'superscript'}]}];d.blocks=[{id:'sides',type:'rich',content:tree}];
 assert.equal(D.validateRich(tree).length,0);const html=D.previewHTML(w.definition,{...D.renderDocument(w.render),outputFormat:'docx'},w.data.values);assert(html.includes('border-top:1.5pt double #112233'));assert(html.includes('border-right:0.5pt dotted #778899'));assert(html.includes('vertical-align:super'));assert(html.includes('vertical-align:sub'));assert(/data-field-ref="projectName"[^>]*vertical-align:super/.test(html));
 const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
 assert(xml.includes('<w:top w:val="double" w:color="112233" w:sz="12"'));assert(xml.includes('<w:right w:val="dotted" w:color="778899" w:sz="4"'));assert(xml.includes('w:val="superscript"'));assert(xml.includes('w:val="subscript"'));
 for(const borders of [[],{center:'none'},{top:{color:'red',width:1,style:'single'}},{top:{color:'#112233',width:-1,style:'single'}},{top:{color:'#112233',width:1,style:'bogus'}}]){const bad=D.clone(tree);bad.content[0].content[0].content[0].attrs.borders=borders;assert(D.validateRich(bad).some(e=>e.includes('罫線')));}
});
test('Word ordered lists have native numbering, start values and nested levels',async()=>{
 const w=D.sample(),d=D.ensureDesign(w.render,'docx'),p=text=>({type:'paragraph',content:[{type:'text',text}]});
 d.blocks=[{id:'list',type:'rich',content:D.identifyRich({type:'doc',content:[{type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p('First'),{type:'orderedList',content:[{type:'listItem',content:[p('Nested')]}]}]},{type:'listItem',content:[p('Second')]}]}]})}];
 const zip=await JSZip.loadAsync(await(await D.word(w.definition,w.render,w.data.values)).arrayBuffer()),xml=await zip.file('word/document.xml').async('string'),numbering=await zip.file('word/numbering.xml').async('string');assert.equal((xml.match(/<w:numPr>/g)||[]).length,3);assert(xml.includes('<w:ilvl w:val="1"'));assert(numbering.includes('<w:start w:val="3"'));assert(D.richHTML(d.blocks[0].content,w.definition,w.data.values).includes('<ol start="3">'));
});
