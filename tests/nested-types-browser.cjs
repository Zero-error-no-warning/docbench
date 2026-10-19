const assert=require('node:assert/strict'),path=require('node:path');
const {reveal}=require('./ui-helpers.cjs');
module.exports=async function({page,url,root,out}){
 const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  await page.evaluate(()=>DocBenchApp.setWorkspace(DocBench.sample()));await page.locator('[data-view="types"]').click();await page.locator('#type-add').click();
  await page.locator('#type-name').fill('期間');await page.locator('#type-name').dispatchEvent('change');await page.locator('#type-prop-type').selectOption('Object');
  const period=await page.evaluate(()=>DocBenchApp.getWorkspace().definition.typeDefinitions.at(-1));
  assert.equal(await page.locator('#type-prop-type option[value="@'+period.id+'"]').count(),0);
  for(const [key,label]of [['start','開始'],['end','終了']]){
   await page.locator('[data-type-field="'+period.schema.id+'"]').click();await page.locator('#type-add-child').click();
   await page.locator('#type-prop-label').fill(label);await page.locator('#type-prop-label').dispatchEvent('change');await page.locator('#type-prop-key').fill(key);await page.locator('#type-prop-key').dispatchEvent('change');
   await page.locator('#type-prop-type').selectOption('@builtin_year');assert.equal(await page.locator('#type-prop-type').inputValue(),'@builtin_year');assert(!await page.locator('#type-prop-label').isDisabled());assert(await page.locator('#type-add-child').isDisabled());
  }
  let composed=await page.evaluate(id=>DocBenchApp.getWorkspace().definition.typeDefinitions.find(t=>t.id===id),period.id);
  assert.equal(composed.schema.fields[0].typeRef.id,'builtin_year');assert.equal(composed.schema.fields[1].typeRef.id,'builtin_year');
  await page.locator('[data-type-field="'+composed.schema.fields[0].fields[1].id+'"]').click();assert(await page.locator('#type-prop-type').isDisabled());assert(await page.locator('#type-prop-key').isDisabled());await page.locator('#type-reference-open').click();
  await page.locator('[data-type-field="builtin_year_year"]').click();assert.equal(await page.locator('#type-prop-type option[value="@'+period.id+'"]').count(),0);
  await page.locator('[data-view="definition"]').click();await page.locator('#add-field').click();const item=await page.evaluate(()=>DocBenchApp.getWorkspace().definition.fields.at(-1));await page.locator('[data-prop="type"]').selectOption('@'+period.id);
  for(const [key,value]of [['start','1'],['end','8']]){const input=page.locator('[data-input="'+item.key+'.'+key+'.year"]');await input.fill(value);await input.dispatchEvent('change');}
  const nested=await page.evaluate(id=>DocBenchApp.getWorkspace().definition.fields.find(f=>f.id===id).fields[0],item.id);await page.locator('[data-tree-toggle="'+item.id+'"]').click();await page.locator('[data-select="'+nested.id+'"]').click();assert(await page.locator('[data-prop="type"]').isDisabled());
  await page.locator('[data-view="types"]').click();await page.locator('[data-type-select="builtin_year"]').click();await page.locator('[data-type-field="builtin_year_year"]').click();
  await page.locator('#type-prop-key').fill('number');await page.locator('#type-prop-key').dispatchEvent('change');
  const values=()=>page.evaluate(k=>DocBenchApp.getWorkspace().data.values[k],item.key);assert.equal((await values()).start.number,1);assert.equal((await values()).end.number,8);
  await page.locator('#undo').click();assert.equal((await values()).start.year,1);await page.locator('#redo').click();assert.equal((await values()).start.number,1);
  assert.deepEqual(await page.evaluate(()=>DocBench.validateDefinition(DocBenchApp.getWorkspace().definition).errors),[]);
  await page.locator('[data-type-select="'+period.id+'"]').click();await page.locator('[data-type-field="'+composed.schema.fields[0].id+'"]').click();
  await page.locator('#type-preview-form [data-input="value.start.number"]').fill('元');await page.locator('#type-preview-form [data-input="value.start.number"]').dispatchEvent('change');assert((await page.locator('#type-preview-output').innerText()).includes('開始: 令和元年'));
  await page.screenshot({path:path.join(out,portable?'nested-types-portable.png':'nested-types.png'),fullPage:true});
  // A referenced custom type cannot be deleted even when it is only used by another type.
  await page.evaluate(()=>DocBenchApp.save());await page.reload();await page.waitForFunction(()=>window.DocBenchApp);assert.equal((await values()).end.number,8);assert.deepEqual(await page.evaluate(()=>DocBench.validateDefinition(DocBenchApp.getWorkspace().definition).errors),[]);
  await page.locator('[data-view="types"]').click();await page.locator('[data-type-select="'+period.id+'"]').click();await page.locator('[data-type-field="'+composed.schema.fields[0].id+'"]').click();await page.locator('#type-reference-detach').click();assert.equal(await page.locator('#type-reference-open').count(),0);assert(!await page.locator('#type-add-child').isDisabled());await page.locator('#undo').click();assert.equal(await page.locator('#type-prop-type').inputValue(),'@builtin_year');
 }
 await page.goto(url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);
};
