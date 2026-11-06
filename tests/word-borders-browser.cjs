/* Preserve inherited/positional DOCX borders and edit one shared edge without changing others. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const JSZip=require('../scripts/qa/node_modules/jszip');
const {reveal,chooseField}=require('./ui-helpers.cjs');
const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const edge=(side,color,size=8,style='single')=>`<w:${side} w:val="${style}" w:color="${color}" w:sz="${size}"/>`;
const cell=(text,props='')=>`<w:tc><w:tcPr>${props}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
async function fixture(){const zip=new JSZip();
 zip.file('word/styles.xml',`<w:styles xmlns:w="${ns}"><w:style w:type="table" w:styleId="Grid"><w:tblPr><w:tblBorders>${edge('top','ff0000')}${edge('bottom','0000ff',16)}${edge('left','111111')}${edge('right','222222')}${edge('insideH','008800',4,'dashed')}${edge('insideV','880088',6,'dotted')}</w:tblBorders></w:tblPr></w:style><w:style w:type="table" w:styleId="Derived"><w:basedOn w:val="Grid"/><w:tblPr><w:tblBorders>${edge('bottom','333333',20,'double')}</w:tblBorders></w:tblPr><w:tblStylePr w:type="firstRow"><w:tcPr><w:tcBorders>${edge('bottom','aa6600',24)}</w:tcBorders></w:tcPr></w:tblStylePr></w:style></w:styles>`);
 zip.file('word/document.xml',`<w:document xmlns:w="${ns}"><w:body><w:tbl><w:tblPr><w:tblStyle w:val="Derived"/><w:tblLook w:firstRow="1" w:noHBand="1" w:noVBand="1"/><w:tblBorders>${edge('left','555555',12)}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="1500"/></w:tblGrid><w:tr>${cell('A')}${cell('B','<w:tcBorders><w:top w:val="nil"/></w:tcBorders>')}</w:tr><w:tr>${cell('C')}${cell('D')}</w:tr><w:tr>${cell('E')}${cell('F')}</w:tr></w:tbl><w:tbl><w:tblPr><w:tblBorders>${edge('top','123456')}${edge('bottom','654321')}${edge('insideH','008800',4,'dashed')}${edge('insideV','880088',6,'dotted')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="1500"/></w:tblGrid><w:tr>${cell('Merged','<w:vMerge w:val="restart"/>')}${cell('X')}</w:tr><w:tr>${cell('','<w:vMerge/><w:tcBorders>'+edge('bottom','abcdef',16,'double')+'</w:tcBorders>')}${cell('Y')}</w:tr></w:tbl><w:p/></w:body></w:document>`);
 return zip.generateAsync({type:'nodebuffer'});
}
module.exports=async({page,url,root,out})=>{
 const bytes=await fixture();
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const parsed=await page.evaluate(async bytes=>await DocBench.importDOCX(new File([new Uint8Array(bytes)],'罫線.docx')),[...bytes]);
  const body=parsed.document.designs.docx.blocks[0].content,tables=body.content.filter(n=>n.type==='table'),a=tables[0].content[0].content[0].attrs.borders,b=tables[0].content[0].content[1].attrs.borders,c=tables[0].content[1].content[0].attrs.borders;
  assert.equal(a.top.color,'#ff0000');assert.equal(a.bottom.color,'#aa6600');assert.equal(a.bottom.width,3);assert.equal(a.left.color,'#555555');assert.equal(a.right.style,'dotted');assert.equal(b.top,'none');assert.equal(c.top.color,'#008800');assert.equal(c.bottom.style,'dashed');assert.equal(tables[0].content[2].content[0].attrs.borders.bottom.style,'double');assert.equal(tables[1].content[0].content[0].attrs.rowspan,2);assert.equal(tables[1].content[0].content[0].attrs.borders.bottom.color,'#abcdef');
  await page.evaluate(doc=>{const w=DocBench.sample();w.render.documents=[doc];w.render.defaultDocumentId=doc.id;DocBenchApp.setWorkspace(w);},parsed.document);await page.locator('[data-view=render]').click();
  const editor=page.locator('#document-preview .tiptap');assert.equal(await editor.locator('td').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 0, 0)');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#design-export').click()]);const target=path.join(out,'borders-'+portable+'.docx');await download.saveAs(target);
  const again=await page.evaluate(async bytes=>{const result=await DocBench.importDOCX(new File([new Uint8Array(bytes)],'再読込.docx'));return result.document.designs.docx.blocks[0].content;},[...fs.readFileSync(target)]);
  const borderData=tree=>tree.content.filter(n=>n.type==='table').map(t=>t.content.map(r=>r.content.map(c=>({rowspan:c.attrs.rowspan,borders:c.attrs.borders}))));assert.deepEqual(borderData(again),borderData(body));
  await editor.locator('td').first().locator('p').click();await page.locator('#word-tab-table').click();assert.equal(await page.locator('#word-border-scope').inputValue(),'selection');
  await page.locator('#word-border-color').fill('#123456');await page.locator('#word-border-width').selectOption('1.5');await page.locator('[data-word-border=top]').click();
  const borders=()=>page.evaluate(()=>DocBenchApp.getWorkspace().render.documents[0].designs.docx.blocks[0].content.content[0].content.map(r=>r.content.map(c=>c.attrs.borders)));
  let changed=await borders();assert.equal(changed[0][0].top.color,'#123456');assert.equal(changed[0][0].top.width,1.5);assert.deepEqual(changed[0][0].bottom,a.bottom);assert.deepEqual(changed[1][0],c);
  await page.locator('#word-border-erase').check();await page.locator('[data-word-border=bottom]').click();changed=await borders();assert.equal(changed[0][0].bottom,'none');assert.equal(changed[1][0].top,'none');assert.equal(changed[0][0].top.color,'#123456');assert.equal(changed[0][0].left.color,'#555555');
  await page.locator('#undo').click();changed=await borders();assert.deepEqual(changed[0][0].bottom,a.bottom);assert.deepEqual(changed[1][0].top,c.top);
  await page.evaluate(()=>DocBenchApp.save());await page.reload();await page.waitForFunction(()=>window.DocBenchApp);await page.locator('[data-view=render]').click();assert.equal((await borders())[0][0].top.color,'#123456');
  await page.locator('#word-tab-insert').click();assert(!await page.locator('#canvas-insert-type').isVisible());assert(await page.locator('#word-binding-example').innerText().then(t=>t.includes('入力画面')));await chooseField(page,'canvas-insert-field','projectName');assert((await page.locator('#word-binding-example').innerText()).includes('窓口業務'));await page.locator('#word-binding-definition').click();assert.equal(await page.locator('[data-prop=key]').inputValue(),'projectName');
 }
};
