/* A newer HTML can be copied next to an older local vendor bundle. */
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({page,url,out,root}){
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
  await page.locator('[data-view="form"]').click();await page.evaluate(()=>{window.__currentEditorLib=DocBenchEditorLib;});
  for(const missing of [['TextSelection'],['TextSelection','Selection','StepMap']]){
   await page.evaluate(missing=>{const w=DocBench.sample();w.render.documents[0].outputFormat='docx';DocBench.ensureDesign(w.render,'docx').blocks=[{id:'dependency-text',type:'text',text:'Preserved text'}];DocBenchEditorLib={...window.__currentEditorLib};for(const name of missing)delete DocBenchEditorLib[name];DocBenchApp.setWorkspace(w);},missing);
   const before=await page.evaluate(()=>DocBenchApp.getWorkspace());await page.locator('[data-view="render"]').click();const warning=page.locator('#document-preview [role="alert"]');await warning.waitFor();assert.match(await warning.innerText(),/vendor\/tiptap\.min\.js/);assert.match(await warning.innerText(),/再読み込み/);assert.match(await warning.innerText(),/TextSelection/);assert.equal(await page.locator('#document-preview .tiptap').count(),0);assert.deepEqual(await page.evaluate(()=>DocBenchApp.getWorkspace()),before);
   // Other tools and saved input remain usable; replacing the bundle restores editing.
   await page.locator('[data-view="form"]').click();assert.equal(await page.locator('[data-input="projectName"]').inputValue(),before.data.values.projectName);await page.evaluate(()=>{DocBenchEditorLib=window.__currentEditorLib;});await page.locator('[data-view="render"]').click();await page.locator('#document-preview .tiptap').click();await page.keyboard.press('End');await page.keyboard.type(' recovered');assert.equal(await page.locator('#document-preview .tiptap').innerText(),'Preserved text recovered');await page.locator('[data-view="form"]').click();
  }
  await page.evaluate(w=>{DocBenchEditorLib=window.__currentEditorLib;delete window.__currentEditorLib;DocBenchApp.setWorkspace(w);},original);await page.evaluate(()=>DocBenchApp.save());
 }
};
