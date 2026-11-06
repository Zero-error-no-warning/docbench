/* Regression: draft history must not republish input captured before an outside edit. */
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,url,root,out,portableTargets=[false,true]})=>{
 const published=()=>page.evaluate(()=>DocBenchApp.getPublishedWorkspace());
 const select=async view=>page.locator('[data-view='+view+']').click();
 const edit=async(prop,value)=>{const input=page.locator('[data-prop='+prop+']');await input.fill(value);await input.dispatchEvent('change');};
 const input=async value=>{await select('form');const field=page.locator('[data-input=projectName]');await field.fill(value);await field.dispatchEvent('change');await select('definition');};
 const check=async(value)=>{assert.equal((await published()).data.values.projectName,value);assert.equal(await page.evaluate(()=>DocBenchApp.getWorkspace().data.values.projectName),value);assert.deepEqual(await page.evaluate(()=>DocBenchApp.definitionDraftStatus().conflicts),[]);};
 for(const portable of portableTargets){
  await page.goto((portable?'file://'+path.join(root,'portable/docbench.html'):(url.endsWith('.html')?url:url+'/'))+'#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const fixture=async()=>{await page.evaluate(()=>{const w=DocBench.sample();w.data.values.projectName='OLD';DocBenchApp.setWorkspace(w);});await select('definition');await page.locator('.tree-item').first().click();return published();};
  let original=await fixture();await edit('label','History label');await edit('description','History description');await input('NEW');await page.locator('#undo').click();await check('NEW');assert.equal(await page.locator('[data-prop=label]').inputValue(),'History label');assert.equal(await page.locator('[data-prop=description]').inputValue(),original.definition.fields[0].description||'');assert((await page.locator('[data-draft-impact]').innerText()).includes('実際の入力値の変更なし'));assert(await page.locator('[data-draft-apply]').isEnabled());await page.locator('[data-draft-apply]').click();await check('NEW');assert.equal((await published()).definition.fields[0].label,'History label');
  // Applying remains one whole-workspace action, and reversing it retains the newer input.
  await select('form');await page.locator('#undo').click();assert.equal((await published()).definition.fields[0].label,original.definition.fields[0].label);assert.equal((await published()).data.values.projectName,'NEW');await page.locator('#redo').click();assert.equal((await published()).data.values.projectName,'NEW');await page.evaluate(()=>DocBenchApp.save());await page.reload();await page.waitForFunction(()=>window.DocBenchApp);assert.equal((await published()).data.values.projectName,'NEW');
  // Redo was created before the external update; repeated re-entry must rebase it too.
  await fixture();await edit('label','Redo label');await edit('description','Redo description');await page.locator('#undo').click();await input('NEW');await page.locator('#redo').click();await check('NEW');await input('NEWER');await page.locator('#undo').click();await page.locator('#redo').click();await check('NEWER');await page.locator('[data-draft-apply]').click();assert.equal((await published()).definition.fields[0].description,'Redo description');assert.equal((await published()).data.values.projectName,'NEWER');
  // Persisted draft history is also exercised after reload, including both stacks.
  await fixture();await edit('label','Reload label');await edit('description','Reload description');await page.locator('#undo').click();await input('SAVED NEW');await page.evaluate(()=>DocBenchApp.save());await page.reload();await page.waitForFunction(()=>window.DocBenchApp);await page.locator('.tree-item').first().click();await page.locator('#redo').click();await check('SAVED NEW');await page.locator('#undo').click();await check('SAVED NEW');await page.locator('[data-draft-apply]').click();assert.equal((await published()).data.values.projectName,'SAVED NEW');assert.equal((await published()).definition.fields[0].label,'Reload label');await page.evaluate(()=>DocBenchApp.save());
  if(out)await page.screenshot({path:path.join(out,'definition-history'+(portable?'-portable':'')+'.png'),fullPage:true});
  await page.evaluate(()=>{DocBenchApp.setWorkspace(DocBench.sample());return DocBenchApp.save();});
 }
};
