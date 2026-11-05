/* The design/proof loop must preserve the editor and never bake sample values into templates. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async({page,url,root,out})=>{
 const viewport=page.viewportSize();
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const original=await page.evaluate(()=>DocBenchApp.getWorkspace()),panePreferences=await page.evaluate(()=>localStorage.getItem('docbench:paneWidths'));
  await page.evaluate(()=>{const w=DocBench.sample(),d=DocBench.ensureDesign(w.render,'docx');w.render.documents[0].outputFormat='docx';d.blocks=[{id:'prose',type:'rich',content:DocBench.identifyRich({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Dear '},{type:'fieldRef',attrs:{field:'department',part:'value'}}]},{type:'repeatBlock',attrs:{field:'expenses'},content:[{type:'paragraph',content:[{type:'fieldRef',attrs:{field:'expenses.category',part:'value'}}]}]}]})}];w.data.values.department='Proof department';w.data.values.expenses=[{_id:DocBench.uid(),category:'Equipment',amount:0,note:''},{_id:DocBench.uid(),category:'Travel',amount:12,note:''}];DocBenchApp.setWorkspace(w);});
  await page.locator('[data-view="render"]').click();
  const editor=page.locator('#document-preview .tiptap'),paragraph=editor.locator(':scope > p').first(),workspace=()=>page.evaluate(()=>DocBenchApp.getWorkspace());
  assert.equal(await page.locator('#canvas-zoom').inputValue(),'100');
  await paragraph.click();await page.keyboard.press('Home');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowRight');
  const selection=await editor.evaluate(el=>{window.__wordWorkspaceEditor=el.editor;return el.editor.state.selection.toJSON();}),before=await workspace();
  assert.equal(await page.locator('#canvas-selection').innerText(),'選択中：2文字');
  await page.locator('#design-properties').click();assert(await page.locator('.design-inspector').isVisible());
  await page.locator('#word-view-result').click();assert(!await page.locator('#document-preview').isVisible());assert(!await page.locator('#canvas-font').isVisible());assert(!await page.locator('.design-inspector').isVisible());assert(await page.locator('#design-properties').isDisabled());
  const proof=page.frameLocator('#word-result-preview');await proof.locator('main').waitFor();const text=await proof.locator('main').innerText();for(const value of ['Proof department','Equipment','Travel'])assert(text.includes(value));assert(!text.includes('繰り返し：'));assert.equal(await page.locator('#word-result-preview').getAttribute('sandbox'),'');assert.deepEqual(await workspace(),before);
  await page.locator('#word-view-edit').click();assert(await paragraph.isVisible());assert(await page.locator('.design-inspector').isVisible());assert(await page.locator('#design-properties').isEnabled());assert(await editor.evaluate(el=>el.editor===window.__wordWorkspaceEditor));assert.deepEqual(await editor.evaluate(el=>el.editor.state.selection.toJSON()),selection);await page.locator('#canvas-bold').click();assert(await paragraph.locator('strong').count());await page.locator('#design-properties').click();
  await page.locator('[data-word-task="3"]').click();assert(await page.locator('[data-word-page="orientation"]').isVisible());
  await page.locator('[data-word-page="orientation"]').selectOption('landscape');await page.locator('#word-margin-preset').selectOption('narrow');
  let design=(await workspace()).render.documents[0].designs.docx;assert.equal(design.settings.orientation,'landscape');for(const key of ['marginTop','marginBottom','marginLeft','marginRight'])assert.equal(design.settings[key],12.7);
  await page.locator('#undo').click();design=(await workspace()).render.documents[0].designs.docx;assert.equal(design.settings.orientation,'landscape');assert.notEqual(design.settings.marginLeft,12.7);await page.locator('#redo').click();
  await page.locator('[data-word-task="0"]').click();await page.locator('#canvas-zoom').selectOption('100');assert.equal(await page.locator('#document-preview main').evaluate(el=>Number(getComputedStyle(el).zoom)),1);
  await page.locator('#canvas-zoom').selectOption('0');
  const identity=await editor.evaluate(el=>{window.__wordWorkspaceEditor=el.editor;return el.editor.state.selection.toJSON();});
  const fit=()=>page.locator('#document-preview').evaluate(el=>({available:el.clientWidth,width:el.shadowRoot.querySelector('main').getBoundingClientRect().width}));
  await page.setViewportSize({width:1280,height:900});await page.waitForFunction(()=>{const el=document.querySelector('#document-preview');return Math.abs(el.clientWidth-28-el.shadowRoot.querySelector('main').getBoundingClientRect().width)<2;});const fitted=await fit();assert(fitted.width<=fitted.available);assert(await editor.evaluate(el=>el.editor===window.__wordWorkspaceEditor));assert.deepEqual(await editor.evaluate(el=>el.editor.state.selection.toJSON()),identity);
  await page.evaluate(()=>DocBenchApp.save());await page.reload();await page.waitForFunction(()=>window.DocBenchApp);await page.locator('[data-view="render"]').click();design=(await workspace()).render.documents[0].designs.docx;assert.equal(design.settings.marginLeft,12.7);assert.equal(design.settings.orientation,'landscape');assert(!JSON.stringify(design).includes('Proof department'));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#design-export').click()]);const file=path.join(out,portable?'word-workspace-portable.docx':'word-workspace.docx');await download.saveAs(file);const zip=await require('../scripts/qa/node_modules/jszip').loadAsync(fs.readFileSync(file)),xml=await zip.file('word/document.xml').async('string');assert(xml.includes('w:orient="landscape"'));assert(xml.includes('w:left="720"'));assert(xml.includes('Proof department'));assert(xml.includes('Equipment'));assert(xml.includes('Travel'));
  await page.setViewportSize({width:1280,height:720});await page.screenshot({path:path.join(out,portable?'word-workspace-portable.png':'word-workspace.png'),fullPage:true});
  await page.evaluate(()=>{const w=DocBench.sample();DocBench.ensureDesign(w.render,'docx');w.render.documents[0].outputFormat='docx';DocBenchApp.setWorkspace(w);});await page.locator('[data-view="render"]').click();
  await page.locator('#toast').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('保存済み'));
  await page.screenshot({path:path.join(out,'word-workspace-overview'+(portable?'-portable':'')+'.png'),fullPage:true});await page.locator('[data-word-task="3"]').click();await page.screenshot({path:path.join(out,'word-workspace-pages'+(portable?'-portable':'')+'.png'),fullPage:true});
  await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);await page.evaluate(()=>DocBenchApp.save());
  await page.evaluate(value=>{if(value===null)localStorage.removeItem('docbench:paneWidths');else localStorage.setItem('docbench:paneWidths',value);},panePreferences);await page.reload();await page.waitForFunction(()=>window.DocBenchApp);
 }
 await page.setViewportSize(viewport);
};
