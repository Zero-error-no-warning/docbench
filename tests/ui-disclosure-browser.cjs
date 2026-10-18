/* Verify reachable advanced actions and disclosure state in normal and portable UI. */
const assert=require('node:assert/strict'),path=require('node:path');
const {reveal}=require('./ui-helpers.cjs');
module.exports=async({page,url,root,out})=>{
 const originalSize=page.viewportSize();await page.setViewportSize({width:1366,height:768});
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
  const original=await page.evaluate(()=>DocBenchApp.getWorkspace());await page.evaluate(()=>DocBenchApp.setWorkspace(DocBench.sample()));await page.locator('[data-view="definition"]').click();
  const baseline=await page.evaluate(()=>DocBenchApp.getWorkspace());
  assert(await page.locator('[data-prop="label"]').isVisible());assert(await page.locator('[data-prop="required"]').isVisible());assert(!await page.locator('#visible-field').isVisible());assert(!await page.locator('[data-prop="description"]').isVisible());
  await reveal(page,'#visible-field');await page.locator('#visible-field').selectOption('status');
  assert.equal(await page.locator('[data-disclosure="field-conditions"] .detail-status').innerText(),'設定あり');assert(await page.locator('#visible-field').isVisible());
  await page.locator('[data-disclosure="field-conditions"] > summary').click();assert(!await page.locator('#visible-field').isVisible());assert.equal(await page.locator('[data-disclosure="field-conditions"] .detail-status').innerText(),'設定あり');
  await page.locator('[data-prop="label"]').fill('新しい表示名');await page.locator('[data-prop="label"]').press('Tab');assert(!await page.locator('#visible-field').isVisible());
  await reveal(page,'[data-prop="description"]');await page.locator('[data-prop="description"]').fill('追加説明');await page.locator('[data-prop="description"]').press('Tab');assert(await page.locator('[data-prop="description"]').isVisible());assert.equal(await page.locator('[data-disclosure="field-description"] .detail-status').innerText(),'設定あり');
  await page.locator('[data-view="form"]').click();await page.locator('[data-view="definition"]').click();assert(await page.locator('[data-prop="description"]').isVisible());assert(!await page.locator('#visible-field').isVisible());
  await page.evaluate(w=>DocBenchApp.setWorkspace(w),baseline);await page.locator('[data-view="render"]').click();assert(!await page.locator('#document-copy').isVisible());
  const menu=page.locator('.action-menu'),summary=menu.locator(':scope > summary');await summary.focus();await page.keyboard.press('Enter');assert(await page.locator('#document-copy').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('#document-copy').isVisible());assert(await summary.evaluate(el=>el===document.activeElement));
  await summary.click();await page.locator('#workspace-title').click();assert(!await page.locator('#document-copy').isVisible());
  const count=await page.locator('#editor-document option').count();await reveal(page,'#document-copy');await page.locator('#document-copy').click();assert.equal(await page.locator('#editor-document option').count(),count+1);assert(!await page.locator('#document-copy').isVisible());
  await reveal(page,'#document-condition');await page.locator('#document-condition').click();await page.waitForFunction(()=>document.querySelector('#rule-canvas')?.dataset.ruleReady==='true');assert.equal(await page.locator('#app').getAttribute('data-screen'),'rules');
  await page.locator('[data-view="types"]').click();assert(!await page.locator('#type-key').isVisible());await reveal(page,'#type-duplicate');await page.locator('#type-duplicate').click();assert(await page.locator('#type-name').isVisible());
  for(const id of ['files-open','history-open','specification-open','definition-json-open']){await page.locator('#'+id).click();assert(await page.locator('#modal').isVisible());await page.locator('#modal-close').click();}
  const style=await page.locator('#history-open').evaluate(el=>({border:getComputedStyle(el).borderTopColor,focus:getComputedStyle(el).outlineStyle}));assert.equal(style.border,'rgba(0, 0, 0, 0)');await page.locator('#history-open').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#history-open').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  await page.screenshot({path:path.join(out,portable?'ui-disclosure-portable.png':'ui-disclosure.png')});await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);await page.evaluate(()=>DocBenchApp.save());
 }
 await page.setViewportSize(originalSize);
};
