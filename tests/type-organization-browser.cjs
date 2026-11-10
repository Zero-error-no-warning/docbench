const assert=require('node:assert/strict');
const {reveal,publishDefinition}=require('./ui-helpers.cjs');
module.exports=async({page,url})=>{
 await page.goto(url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
 const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
 const heightPreference=await page.evaluate(()=>localStorage.getItem('docbench:typeListHeight'));
 try{
  const id=await page.evaluate(()=>{
   const D=DocBench,w=D.sample();
   const travel=D.createType(w.definition,'旅費',D.field('value','旅費','Object',{fields:[D.field('transport','交通手段')]}));
   DocBenchApp.setWorkspace(w);return travel.id;
  });
  await page.locator('[data-view=types]').click();
  await page.locator('[data-type-select="'+id+'"]').click();
  for(const [key,value] of [['folder','会計 / 支出'],['tags','明細、申請']]){
   const input='#type-'+key;await reveal(page,input);
   await page.locator(input).fill(value);await page.locator(input).dispatchEvent('change');
  }
  const listSearch=page.locator('#workbench-list-search');
  await listSearch.fill('支出 交通手段');
  assert.equal(await page.locator('.type-list-item:visible').count(),1);
  assert.match(await page.locator('.type-list-item:visible').innerText(),/会計 › 支出.*子項目「交通手段」/s);
  await listSearch.fill('');
  await page.locator('.workbench-search').getByLabel('タグ').selectOption('明細');
  assert.equal(await page.locator('.type-list-item:visible').count(),1);
  const split=page.getByRole('separator',{name:'型の一覧の高さ',exact:true});
  const before=await split.getAttribute('aria-valuenow');
  await split.press('ArrowDown');
  assert(Number(await split.getAttribute('aria-valuenow'))>Number(before));
  const outline=page.locator('[data-disclosure=type-structure]');
  await outline.locator('summary').click();
  assert(!await outline.locator('.type-field-item').first().isVisible());
  await outline.locator('summary').click();
  assert(await outline.locator('.type-field-item').first().isVisible());
  await publishDefinition(page);
  await page.locator('[data-view=definition]').click();
  await page.locator('#add-field').click();
  await page.getByRole('button',{name:'入力形式の候補を検索'}).click();
  const dialog=page.getByRole('dialog',{name:'型を検索'});
  await dialog.getByRole('searchbox').fill('会計 交通手段');
  await dialog.getByRole('button',{name:/^旅費/}).click();
  assert.equal(await page.locator('[data-prop=type]').inputValue(),'@'+id);

  await page.locator('#add-field').click();
  const key=await page.locator('[data-prop=key]').inputValue();
  await page.locator('[data-prop=type]').selectOption('Integer');
  await reveal(page,'#integer-format');
  await page.locator('#integer-format').selectOption('padded');
  await page.locator('#integer-digits').fill('6');
  await page.locator('#integer-digits').dispatchEvent('change');
  const value=page.locator('[data-input="'+key+'"]');
  await value.fill('12');await value.dispatchEvent('change');
  assert.equal(await value.inputValue(),'000012');
  assert.equal(await page.evaluate(key=>DocBenchApp.getPreviewValues()[key],key),12);
  await page.locator('#integer-format').selectOption('grouped');
  await value.fill('12345');await value.dispatchEvent('change');
  assert.equal(await value.inputValue(),'12,345');
  assert.equal(await page.evaluate(key=>DocBenchApp.getPreviewValues()[key],key),12345);
 }finally{
  await page.evaluate(({original,heightPreference})=>{
   DocBenchApp.setWorkspace(original);
   if(heightPreference===null)localStorage.removeItem('docbench:typeListHeight');
   else localStorage.setItem('docbench:typeListHeight',heightPreference);
  },{original,heightPreference});
 }
};
