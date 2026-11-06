const {publishDefinition,clickWorkspaceHistory}=require('./ui-helpers.cjs');
/* Row mutations preserve the edited row, including nested collection identity. */
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,url,root})=>{
 for(const portable of [false,true]){
  await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
  await page.evaluate(()=>{const D=DocBench,w=D.sample(),table=D.field('focusRows','表の編集','Table',{fields:[D.field('label','名称','String'),D.field('note','備考','RichText')],initialRows:3,sortBy:'label'}),groups=D.field('focusGroups','配列の編集','Array',{itemType:'Object',initialRows:2,fields:[D.field('name','名前','String'),D.field('children','子配列','Array',{itemType:'String',initialRows:2})]});w.definition.fields.push(table,groups);w.data.values.focusRows=D.defaultValue(table,w.actor);w.data.values.focusRows.forEach((r,i)=>r.label=['b','c','a'][i]);w.data.values.focusGroups=D.defaultValue(groups,w.actor);DocBenchApp.setWorkspace(w);});await publishDefinition(page);await page.locator('[data-view=form]').click();
  const input=p=>page.locator('[data-input="'+p+'"]'),action=(op,p,index)=>page.locator('[data-row="'+op+'"][data-path="'+p+'"]'+(index===undefined?'':'[data-index="'+index+'"]'));
  const savePosition=async p=>{await input(p).fill('z編集中の文字');await input(p).evaluate(el=>el.setSelectionRange(2,5));return input(p).evaluate(el=>el.closest('[data-row-id]')?.dataset.rowId);};
  const check=async(id,value='z編集中の文字')=>{await page.waitForFunction(({id,value})=>{const el=document.activeElement;return el?.dataset.input&&el.closest('[data-row-id]')?.dataset.rowId===id&&el.value===value;},{id,value});assert.deepEqual(await page.evaluate(()=>[document.activeElement.selectionStart,document.activeElement.selectionEnd]),[2,5]);return page.evaluate(()=>document.activeElement.dataset.input);};
  // Adding rows also retains focus in an unrelated field being edited.
  await input('projectName').fill('先に編集中');await input('projectName').evaluate(el=>el.setSelectionRange(1,3));await action('add','focusRows').click();await page.waitForFunction(()=>document.activeElement?.dataset.input==='projectName');assert.equal(await input('projectName').inputValue(),'先に編集中');assert.deepEqual(await input('projectName').evaluate(el=>[el.selectionStart,el.selectionEnd]),[1,3]);assert.equal(await page.evaluate(()=>DocBenchApp.getWorkspace().data.values.projectName),'先に編集中');
  const id=await savePosition('focusRows.1.label');await action('add','focusRows').click();await check(id);assert.equal(await page.evaluate(()=>DocBenchApp.getWorkspace().data.values.focusRows.find(r=>r.label==='z編集中の文字')?._id),id);
  await action('copy','focusRows',0).click();let p=await check(id);assert.equal(p,'focusRows.2.label');
  await action('down','focusRows',2).click();p=await check(id);assert.equal(p,'focusRows.3.label');
  await action('sort','focusRows').click();p=await check(id);assert.equal(p,'focusRows.5.label');
  await action('delete','focusRows',0).click();p=await check(id);assert.equal(p,'focusRows.4.label');
  // Deleting the edited row picks the nearest surviving input without copying its draft.
  await action('delete','focusRows',4).click();await page.waitForFunction(()=>document.activeElement?.dataset.input==='focusRows.3.label');assert.notEqual(await page.evaluate(()=>document.activeElement.value),'z編集中の文字');
  // Parent and child reordering must preserve the same nested row, not its old index.
  const child=await savePosition('focusGroups.0.children.1.value');await action('down','focusGroups',0).click();assert.equal(await check(child),'focusGroups.1.children.1.value');await action('up','focusGroups.1.children',1).click();assert.equal(await check(child),'focusGroups.1.children.0.value');await action('add','focusGroups.1.children').click();await check(child);
  await action('delete','focusGroups',1).click();await page.waitForFunction(()=>document.activeElement?.dataset.input==='focusGroups.0.children.0.value');assert.notEqual(await page.evaluate(()=>document.activeElement.value),'z編集中の文字');
  // Keyboard users stay on the invoked action and can continue operating it.
  await action('add','focusGroups.0.children').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.row==='add'&&document.activeElement.dataset.path==='focusGroups.0.children');
  // The type preview shares the same row behavior.
  const typeId=await page.evaluate(()=>{const w=DocBenchApp.getWorkspace(),t=DocBench.createType(w.definition,'配列の試験',DocBench.field('value','配列','Array',{itemType:'String',initialRows:2}));DocBenchApp.setWorkspace(w);return t.id;});await publishDefinition(page);await page.locator('[data-view=types]').click();await page.locator('[data-type-select="'+typeId+'"]').click();const previewId=await savePosition('value.1.value');await action('copy','value',0).click();assert.equal(await check(previewId),'value.2.value');await action('up','value',2).click();assert.equal(await check(previewId),'value.1.value');await action('add','value').click();await check(previewId);
  await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);await page.evaluate(()=>DocBenchApp.save());
 }
};
