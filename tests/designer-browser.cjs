/* Real pointer / keyboard actions in the same preview used by the UI. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({page,out,url,root}){
 await page.goto(url);await page.waitForFunction(()=>window.DocBenchApp);
 const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
 const frame=()=>page.frameLocator('#document-preview');
 const shape=id=>frame().locator('[data-block-id="'+id+'"].db-object');
 const fixture=async format=>{
  await page.evaluate(format=>{
   const w=DocBench.sample(),d=DocBench.ensureDesign(w.render,format);w.render.outputFormat=format;
   if(format==='pptx')d.blocks=[{id:'title',type:'heading',text:'Slide heading',layout:{slide:1,x:1,y:1,w:25,h:1.5}},{id:'drag',type:'text',text:'Drag target',layout:{slide:1,x:2,y:3,w:8,h:3},style:{fontSize:20}}];
   if(format==='xlsx'){d.settings.columnWidths='12,12,12,12,12,12,12,12,12,12';d.blocks=[{id:'sheet-title',type:'heading',text:'Sheet heading',layout:{cell:'C3',span:4}},{id:'sheet-budget',type:'field',field:'budget',layout:{cell:'A8',span:2}}];}
   if(format==='docx')d.blocks=[{id:'word-title',type:'heading',text:'Word heading'},{id:'word-text',type:'text',text:'Paragraph body'},{id:'word-table',type:'table',field:'expenses'}];
   DocBenchApp.setWorkspace(w);
  },format);
  await page.locator('[data-view="render"]').click();
  await frame().locator(format==='xlsx'?'[data-cell]':'.db-object').first().waitFor();
 };
 const readBlock=id=>page.evaluate(id=>{const w=DocBenchApp.getWorkspace();return w.render.designs[w.render.outputFormat].blocks.find(b=>b.id===id);},id);
 const drag=async(locator,dx,dy)=>{
  await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();assert(b);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:9});await page.mouse.up();
 };
 const xmlFrom=async(file,entry)=>page.evaluate(async({bytes,entry})=>{const z=await JSZip.loadAsync(new Uint8Array(bytes));return z.file(entry).async('string');},{bytes:[...fs.readFileSync(file)],entry});
 const exportFile=async format=>{const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#design-export').click()]);const file=path.join(out,'interactive.'+format);await download.saveAs(file);return file;};

 await fixture('pptx');const start=await readBlock('drag');
 await drag(shape('drag'),55,26);await shape('drag').waitFor();const moved=await readBlock('drag');assert(moved.layout.x>start.layout.x);assert(moved.layout.y>start.layout.y);assert.equal(moved.layout.w,start.layout.w);
 await page.locator('#undo').click();await shape('drag').waitFor();assert.deepEqual((await readBlock('drag')).layout,start.layout);
 await page.locator('#redo').click();await shape('drag').waitFor();assert.deepEqual((await readBlock('drag')).layout,moved.layout);
 await drag(shape('drag').locator('.db-resize'),35,18);await shape('drag').waitFor();const resized=await readBlock('drag');assert(resized.layout.w>moved.layout.w);assert(resized.layout.h>moved.layout.h);
 await shape('drag').press('ArrowRight');await shape('drag').waitFor();assert((await readBlock('drag')).layout.x>resized.layout.x);
 await shape('drag').press('Control+d');await frame().locator('.db-object').first().waitFor();assert.equal(await frame().locator('.db-object').count(),3);await page.locator('[data-canvas-command="delete"]').click();await frame().locator('.db-object').first().waitFor();assert.equal(await frame().locator('.db-object').count(),2);
 await shape('drag').click();await page.locator('#canvas-font-size').fill('24');await page.locator('#canvas-font-size').dispatchEvent('change');await shape('drag').waitFor();
 await page.locator('#canvas-color').fill('#112233');await page.locator('#canvas-color').dispatchEvent('change');await shape('drag').waitFor();
 await shape('drag').dblclick();await shape('drag').locator('p').fill('Edited on canvas');await page.locator('#canvas-selection').click();await shape('drag').waitFor();assert.equal((await readBlock('drag')).text,'Edited on canvas');
 const filePpt=await exportFile('pptx'),slideXml=await xmlFrom(filePpt,'ppt/slides/slide1.xml'),final=await readBlock('drag');
 assert(slideXml.includes('Edited on canvas'));assert(slideXml.includes('sz="2400"'));assert(slideXml.includes('112233'));assert(slideXml.includes('x="'+Math.round(final.layout.x*360000)+'" y="'+Math.round(final.layout.y*360000)+'"'));
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,'10-interactive-pptx.png'),fullPage:true});

 await fixture('xlsx');await frame().locator('[data-cell="C3"]').click();
 const from=frame().locator('[data-cell="D12"]'),to=frame().locator('[data-cell="H14"]');await to.scrollIntoViewIfNeeded();await from.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();assert(a&&b);
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
 assert((await page.locator('#canvas-range').innerText()).includes('D12:H14'));await page.locator('#canvas-place').click();await frame().locator('[data-cell="D12"]').waitFor();
 assert.deepEqual((await readBlock('sheet-title')).layout,{cell:'D12',span:5,rowSpan:3});
 assert.equal(await frame().locator('[data-cell="D12"]').getAttribute('rowspan'),'3');
 await page.locator('#undo').click();await frame().locator('[data-cell="C3"]').waitFor();assert.equal((await readBlock('sheet-title')).layout.cell,'C3');await page.locator('#redo').click();await frame().locator('[data-cell="D12"]').waitFor();assert.equal((await readBlock('sheet-title')).layout.cell,'D12');
 const xlsx=await exportFile('xlsx');assert((await xmlFrom(xlsx,'xl/worksheets/sheet1.xml')).includes('ref="D12:H14"'));
 // Occupied ranges report a conflict without losing either element.
 const blockCount=await page.evaluate(()=>DocBenchApp.getWorkspace().render.designs.xlsx.blocks.length);await page.locator('#canvas-insert-type').selectOption('field');await page.locator('#canvas-insert-field').selectOption('budget');await page.locator('#canvas-insert').click();assert((await page.locator('#toast').innerText()).includes('重複'));assert.equal(await page.evaluate(()=>DocBenchApp.getWorkspace().render.designs.xlsx.blocks.length),blockCount);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,'11-interactive-excel.png'),fullPage:true});

 await fixture('docx');const wordSource=await shape('word-text').boundingBox(),wordTarget=await shape('word-title').boundingBox();assert(wordSource&&wordTarget);await drag(shape('word-text'),wordTarget.x+20-(wordSource.x+wordSource.width/2),wordTarget.y+3-(wordSource.y+wordSource.height/2));await shape('word-title').waitFor();assert.deepEqual(await page.evaluate(()=>DocBenchApp.getWorkspace().render.designs.docx.blocks.map(b=>b.id)),['word-text','word-title','word-table']);
 await page.locator('#undo').click();await shape('word-title').waitFor();assert.equal(await page.evaluate(()=>DocBenchApp.getWorkspace().render.designs.docx.blocks[0].id),'word-title');
 await shape('word-title').dblclick();await shape('word-title').locator('h1').fill('Edited Word heading');await shape('word-title').locator('h1').click();assert.equal(await shape('word-title').locator('h1').getAttribute('contenteditable'),'true');await page.locator('#canvas-selection').click();await shape('word-title').waitFor();assert.equal((await readBlock('word-title')).text,'Edited Word heading');
 await page.locator('#canvas-font-size').fill('28');await page.locator('#canvas-font-size').dispatchEvent('change');await shape('word-title').waitFor();
 const docx=await exportFile('docx'),wordXml=await xmlFrom(docx,'word/document.xml');assert(wordXml.includes('Edited Word heading'));assert(wordXml.includes('w:sz w:val="56"'));
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,'12-interactive-word.png'),fullPage:true});
 // Viewer content stays script-disabled, and the portable file exposes the same interaction layer.
 assert.equal(await page.locator('#document-preview').getAttribute('sandbox'),'allow-same-origin');
 await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);await page.evaluate(()=>DocBenchApp.save());
 await page.goto('file://'+path.join(root,'portable/docbench.html'));await page.waitForFunction(()=>window.DocBenchApp);await fixture('pptx');const portableStart=await readBlock('drag');await drag(shape('drag'),30,0);await shape('drag').waitFor();assert((await readBlock('drag')).layout.x>portableStart.layout.x);
};
