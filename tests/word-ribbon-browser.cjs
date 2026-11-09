const {publishDefinition,clickWorkspaceHistory}=require('./ui-helpers.cjs');
/* Exercise the editor as a document author: selection, discoverability and stable canvas. */
const assert=require('node:assert/strict'),path=require('node:path');
const {reveal,chooseFormat}=require('./ui-helpers.cjs');
module.exports=async({page,url,root,out})=>{
 const viewport=page.viewportSize();
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
  await page.evaluate(()=>{const w=DocBench.sample(),d=DocBench.ensureDesign(w.render,'docx');w.render.documents[0].outputFormat='docx';d.blocks=[{id:'letter',type:'rich',content:DocBench.identifyRich(DocBench.plainRich('Hello document author'))}];DocBenchApp.setWorkspace(w);});
  await publishDefinition(page);await page.locator('[data-view=render]').click();await page.locator('#word-tab-home').click();
  const editor=page.locator('#document-preview .tiptap'),paragraph=editor.locator('p').first();
  const geometry=()=>page.locator('.output-stage').boundingBox();
  assert.equal(await page.locator('#canvas-zoom').inputValue(),'100');assert(await page.locator('#word-tab-table').isVisible());
  await paragraph.click();
  const selection=await editor.evaluate(el=>{
   const editor=el.editor;
   const text=el.querySelector('p').firstChild;
   const from=editor.view.posAtDOM(text,0),to=editor.view.posAtDOM(text,5);
   editor.commands.setTextSelection({from,to});
   window.__ribbonEditor=editor;
   return editor.state.selection.toJSON();
  });
  const before=await page.evaluate(()=>DocBenchApp.getWorkspace()),box=await geometry();
  // Arrow keys switch tabs without editing the document or changing its geometry.
  await page.locator('#word-tab-home').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#word-tab-insert').getAttribute('aria-selected'),'true');
  await page.keyboard.press('End');assert.equal(await page.locator('#word-tab-layout').getAttribute('aria-selected'),'true');await page.keyboard.press('Home');
  assert.deepEqual(await geometry(),box);assert.deepEqual(await page.evaluate(()=>DocBenchApp.getWorkspace()),before);assert.deepEqual(await editor.evaluate(el=>el.editor.state.selection.toJSON()),selection);
  await page.locator('#canvas-bold').click();assert.equal(await paragraph.locator('strong').innerText(),'Hello');assert(await editor.evaluate(el=>el.editor===window.__ribbonEditor));
  // Inline settings share one panel. Escape closes it and returns focus to its entry.
  await page.locator('#word-tab-home').click();const paragraphMenu=page.locator('.word-paragraph-details > summary');await paragraphMenu.click();assert(await page.locator('#word-line-height').isVisible());const popup=await page.locator('#word-task-panel').boundingBox();assert(popup.x>=0&&popup.x+popup.width<=page.viewportSize().width);await page.keyboard.press('Escape');assert(!await page.locator('#word-line-height').isVisible());assert(await page.locator('#word-tab-home').evaluate(el=>el===document.activeElement));
  await page.locator('#design-properties').click();assert.deepEqual(await geometry(),box);const settings=await page.locator('#word-task-panel').boundingBox();assert(settings.y>=box.y-1&&settings.y+settings.height<=box.y+box.height+1);await page.keyboard.press('Escape');assert(!await page.locator('.design-inspector').isVisible());
  // File actions remain available, while document switching stays directly visible.
  assert(await page.locator('#editor-document').isVisible());await page.locator('.word-file-menu > summary').click();assert(await page.locator('#word-import-open').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('#word-import-open').isVisible());
  // Table controls appear as a contextual tab and act on the selected table.
  await paragraph.click();await page.keyboard.press('End');await page.keyboard.press('Enter');await reveal(page,'#word-table-rows');await page.locator('#word-table-rows').fill('2');await page.locator('#word-table-cols').fill('2');await page.locator('[data-word-command=table]').click();
  assert.equal(await editor.locator('td').count(),4);assert(await page.locator('#word-tab-table').isVisible());await page.locator('#word-tab-table').click();await page.locator('[data-word-command=row]').click();assert.equal(await editor.locator('tr').count(),3);assert.deepEqual(await geometry(),box);
  await paragraph.click();assert(await page.locator('#word-tab-table').isVisible());assert.equal(await page.locator('#word-tab-table').getAttribute('aria-selected'),'true');
  // Each panel stays bounded, with a scrollable body and a reachable fixed footer.
  for(const width of [1920,1280,900]){await page.setViewportSize({width,height:720});for(const tab of ['home','insert','layout']){await page.locator('#word-tab-'+tab).click();const bounds=await page.locator('#word-task-panel').evaluate(el=>{const panel=el.getBoundingClientRect(),footer=el.querySelector('.word-task-footer').getBoundingClientRect(),body=el.querySelector('.word-task-body');body.scrollTop=body.scrollHeight;return {bottom:panel.bottom,footer:footer.bottom,top:panel.top,overflow:document.scrollingElement.scrollWidth-innerWidth};});assert(bounds.footer<=720&&bounds.top===84,tab+' panel fits at '+width+': '+JSON.stringify(bounds));assert(bounds.overflow<=1);}}
  await page.setViewportSize({width:1280,height:720});await page.locator('#word-tab-home').click();await page.screenshot({path:path.join(out,'word-ribbon'+(portable?'-portable':'')+'.png')});
  await chooseFormat(page,'xlsx');assert(!await page.locator('body.word-authoring').count());await chooseFormat(page,'docx');assert(await page.locator('#word-tab-home').isVisible());
  await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);await page.evaluate(()=>DocBenchApp.save());
 }
 await page.setViewportSize(viewport);
};

