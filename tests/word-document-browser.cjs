const {publishDefinition,clickWorkspaceHistory}=require('./ui-helpers.cjs');
const {reveal}=require('./ui-helpers.cjs');
/* Real selection, clipboard and Undo across independently saved Word blocks. */
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({page,url,root,out}){
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
  const fixture=async bound=>{
   await page.evaluate(bound=>{
    const w=DocBench.sample(),d=DocBench.ensureDesign(w.render,'docx');w.render.documents[0].outputFormat='docx';
    d.blocks=[{id:'first',type:'text',text:'Alpha'},{id:'second',type:'text',text:'Beta'},...(bound?[{id:'bound',type:'field',field:'budget',valueStyle:{color:'#123456'}}]:[])];DocBenchApp.setWorkspace(w);
   },bound);await publishDefinition(page);await page.locator('[data-view="render"]').click();
  };
  const preview=page.locator('#document-preview'),first=preview.locator('[data-block-id="first"] .tiptap'),second=preview.locator('[data-block-id="second"] .tiptap');
  const blocks=()=>page.evaluate(()=>DocBenchApp.getWorkspace().render.documents[0].designs.docx.blocks);
  await fixture(false);
  assert(await first.evaluate(el=>el.editor===el.getRootNode().querySelector('[data-block-id="second"] .tiptap').editor));
  // The inspector's native HTML drag works even while dragover data is protected.
  await page.locator('#design-properties').click();await page.locator('[data-drag-block="second"]').dragTo(first.locator('p'),{targetPosition:{x:50,y:4}});
  assert.deepEqual((await blocks()).map(b=>b.id),['second','first']);assert.deepEqual((await blocks()).map(b=>b.text),['Beta','Alpha']);await fixture(false);
  // Cursor and Backspace cross the former editor boundary; one Undo restores it.
  await second.locator('p').click();await page.keyboard.press('Home');await page.keyboard.press('Backspace');
  await page.waitForFunction(()=>DocBenchApp.getWorkspace().render.documents[0].designs.docx.blocks.length===1);
  assert.equal((await blocks())[0].text,'AlphaBeta');await page.keyboard.press('Control+z');assert.deepEqual((await blocks()).map(b=>b.text),['Alpha','Beta']);await page.keyboard.press('Control+Shift+z');assert.equal((await blocks())[0].text,'AlphaBeta');
  await fixture(false);await first.locator('p').click();await page.keyboard.press('Control+Home');await page.keyboard.press('Control+Shift+End');
  const selection=await first.evaluate(el=>el.editor.state.selection.toJSON());assert(selection.head>selection.anchor);
  await reveal(page,'#canvas-font-size');await page.locator('#canvas-font-size').fill('17');await reveal(page,'#canvas-font-size');await page.locator('#canvas-font-size').press('Enter');
  for(const b of await blocks())assert(b.content.content[0].content[0].marks.some(m=>m.attrs?.fontSize==='17pt'));
  await reveal(page,'#canvas-zoom');await page.locator('#canvas-zoom').selectOption('75');assert.deepEqual(await first.evaluate(el=>el.editor.state.selection.toJSON()),selection);
  if(!portable){
   await page.context().grantPermissions(['clipboard-read','clipboard-write']);
   await first.locator('p').click();await page.keyboard.press('Control+Home');await page.keyboard.press('Control+Shift+End');await page.keyboard.press('Control+c');
   const clipboard=await page.evaluate(()=>navigator.clipboard.readText());assert(clipboard.includes('Alpha'));assert(clipboard.includes('Beta'));
   await page.keyboard.press('Control+End');await page.keyboard.press('Enter');await page.keyboard.press('Control+v');
   await page.waitForFunction(()=>DocBenchApp.getWorkspace().render.documents[0].designs.docx.blocks.map(b=>b.text).join('').split('Alpha').length===3);
   assert.deepEqual(await page.evaluate(()=>DocBench.validateDefinition(DocBenchApp.getWorkspace().definition,DocBenchApp.getWorkspace().render).errors),[]);
  }
  await fixture(true);
  if(!portable){await first.locator('p').click();await page.keyboard.press('Control+a');await page.keyboard.press('Control+c');assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('入力項目：'));}
  await preview.locator('[data-block-id="bound"]').click();await page.keyboard.press('Control+d');assert.equal((await blocks()).filter(b=>b.field==='budget').length,2);
  await page.keyboard.press('Control+z');assert.equal((await blocks()).filter(b=>b.field==='budget').length,1);
  const before=await blocks(),input=await page.evaluate(()=>DocBenchApp.getWorkspace().data);
  await first.locator('p').click();await page.keyboard.press('Control+a');await page.keyboard.press('Backspace');
  assert(!(await blocks()).some(b=>b.id==='bound'));await page.keyboard.press('Control+z');
  assert.deepEqual((await blocks()).map(b=>b.id),before.map(b=>b.id));assert.equal((await blocks()).find(b=>b.id==='bound').field,'budget');assert.deepEqual(await page.evaluate(()=>DocBenchApp.getWorkspace().data),input);
  // Persistence keeps saved source blocks, not editor-only wrappers or real input.
  await page.evaluate(()=>DocBenchApp.save());await page.reload();await page.waitForFunction(()=>window.DocBenchApp);await publishDefinition(page);await page.locator('[data-view="render"]').click();
  assert.deepEqual((await blocks()).map(b=>b.id),before.map(b=>b.id));assert(!(await blocks()).some(b=>JSON.stringify(b).includes('wordSection')));
  await page.screenshot({path:path.join(out,portable?'word-document-portable.png':'word-document.png'),fullPage:true});
  await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);await page.evaluate(()=>DocBenchApp.save());
 }
};
