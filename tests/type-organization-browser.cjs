const assert=require('node:assert/strict');
const {reveal,publishDefinition}=require('./ui-helpers.cjs');
module.exports=async({page,url})=>{
 await page.goto(url+'/#editor');await page.waitForFunction(()=>window.DocBenchApp);
 const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
 const heightPreference=await page.evaluate(()=>localStorage.getItem('docbench:typeListHeight'));
 try{
  const {id,root,transport,station,supplies}=await page.evaluate(()=>{
   const D=DocBench,w=D.sample();
   const train=D.field('transport','交通手段','Object',{fields:[D.field('station','駅')]}),travel=D.createType(w.definition,'旅費',D.field('value','旅費','Object',{fields:[train,D.field('date','利用日','Date')]}));
   const supply=D.createType(w.definition,'物品');supply.folder=['会計','物品'];
   DocBenchApp.setWorkspace(w);return {id:travel.id,root:travel.schema.id,transport:travel.schema.fields[0].id,station:travel.schema.fields[0].fields[0].id,supplies:supply.id};
  });
  await page.locator('[data-view=types]').click();
  await page.locator('[data-type-select="'+id+'"]').click();
  async function assertSameRow(name,format){
   const a=await page.locator(name).boundingBox(),b=await page.locator(format).boundingBox();
   assert(a&&b&&Math.abs(a.y-b.y)<2&&a.x+a.width<=b.x,'name and format are side by side');
  }
  await assertSameRow('#type-name','#type-prop-type');
  for(const [key,value] of [['folder','会計 / 支出'],['tags','明細、申請']]){
   const input='#type-'+key;await reveal(page,input);
   await page.locator(input).fill(value);await page.locator(input).dispatchEvent('change');
  }
  const type=page.locator('[data-type-select="'+id+'"]');
  const accounting=page.locator('.type-folder').filter({has:page.locator('summary:text-is("会計")')}).first();
  assert.equal(await type.locator('xpath=ancestor::details[contains(@class,"type-folder")]').count(),2);
  await accounting.locator(':scope > summary').click();
  assert(!await type.isVisible());
  const listSearch=page.locator('#workbench-list-search');
  await listSearch.fill('支出 交通手段');
  assert.equal(await page.locator('.type-list-item:visible').count(),1);
  assert.match(await page.locator('.type-list-item:visible').innerText(),/会計 › 支出.*子項目「交通手段」/s);
  await listSearch.fill('');
  assert(!await type.isVisible());
  await accounting.locator(':scope > summary').click();
  assert(await type.isVisible());
  assert(await page.locator('[data-type-select="'+supplies+'"]').isVisible());
  await page.locator('.workbench-search').getByLabel('タグ').selectOption('明細');
  assert.equal(await page.locator('.type-list-item:visible').count(),1);
  const split=page.getByRole('separator',{name:'型の一覧の高さ',exact:true});
  const before=await split.getAttribute('aria-valuenow');
  await split.press('ArrowDown');
  assert(Number(await split.getAttribute('aria-valuenow'))>Number(before));
  const rootBranch=page.locator('[data-type-branch="'+root+'"]'),transportBranch=page.locator('[data-type-branch="'+transport+'"]');
  const stationRow=page.locator('[data-type-field="'+station+'"]');
  assert(!await stationRow.isVisible());
  await transportBranch.click();assert(await stationRow.isVisible());
  await transportBranch.click();assert(!await stationRow.isVisible());
  assert(await page.locator('[data-type-field="'+transport+'"]').isVisible());
  await rootBranch.click();assert(!await transportBranch.isVisible());
  assert(await page.locator('[data-type-field="'+root+'"]').isVisible());
  await rootBranch.click();assert(await transportBranch.isVisible());assert(!await stationRow.isVisible());
  await publishDefinition(page);
  await page.locator('[data-view=definition]').click();
  await page.locator('#add-field').click();
  await assertSameRow('[data-prop=label]','[data-prop=type]');
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
