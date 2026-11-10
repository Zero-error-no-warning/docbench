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
   assert(a&&b&&Math.abs(a.y-b.y)<2&&a.x+a.width<=b.x,`name and format are side by side: ${JSON.stringify({a,b})}`);
  }
  async function assertItemLine(row,kind){
   const line=row.locator('.workbench-item-line'),type=line.locator('.tree-type');
   assert.equal(await type.innerText(),kind);
   const a=await line.locator('strong').boundingBox(),b=await type.boundingBox();
   assert(a&&b&&Math.abs(a.y+a.height/2-b.y-b.height/2)<2&&a.x+a.width<=b.x,`list name and type share a line: ${JSON.stringify({a,b})}`);
  }
  const selectionStyle=row=>row.evaluate(el=>{
   const {borderRadius,backgroundColor,boxShadow}=getComputedStyle(el.closest('.workbench-item-row'));
   return {borderRadius,backgroundColor,boxShadow};
  });
  const rowGeometry=row=>row.evaluate(el=>{
   const surface=el.closest('.workbench-item-row'),list=surface.closest('.type-list,.field-tree,.type-picker-results');
   const {left}=surface.getBoundingClientRect(),{marginLeft,paddingLeft,paddingRight,borderRadius}=getComputedStyle(surface);
   const titleLeft=surface.querySelector('.tree-text').getBoundingClientRect().left;
   return {marginLeft,paddingLeft,paddingRight,borderRadius,left:left-list.getBoundingClientRect().left,labelInset:titleLeft-left};
  });
  await assertSameRow('#type-name','#type-prop-type');
  for(const [key,value] of [['folder','会計 / 支出'],['tags','明細、申請']]){
   const input='#type-'+key;await reveal(page,input);
   await page.locator(input).fill(value);await page.locator(input).dispatchEvent('change');
  }
  const type=page.locator('[data-type-select="'+id+'"]');
  const accounting=page.locator('.type-folder').filter({has:page.locator('summary:text-is("会計")')}).first();
  assert.equal(await type.locator('xpath=ancestor::details[contains(@class,"type-folder")]').count(),2);
  assert.equal(await accounting.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
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
  await assertItemLine(type,'複合型');
  const rootGeometry=await rowGeometry(page.locator('[data-type-select=builtin_year]'));
  assert.equal(rootGeometry.left,8);
  assert.deepEqual(await rowGeometry(page.locator('[data-type-field="'+root+'"]')),rootGeometry);
  assert.equal((await rowGeometry(type)).left-rootGeometry.left,26);
  const selectedStyle=await selectionStyle(type);
  assert.equal(selectedStyle.borderRadius,'6px');
  assert.match(selectedStyle.boxShadow,/inset/);
  assert(!await type.locator('[data-type-match]').isVisible());
  assert.equal(await page.locator('.workbench-search').getByRole('combobox',{name:'フォルダ'}).count(),0);
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
  await assertItemLine(page.locator('[data-type-field="'+transport+'"]'),'複合型');
  assert.equal((await rowGeometry(page.locator('[data-type-field="'+transport+'"]'))).left-rootGeometry.left,13);
  await page.locator('.task-child-list').getByRole('button',{name:'交通手段',exact:true}).click();
  assert.equal(await page.locator('#type-prop-label').inputValue(),'交通手段');
  assert.deepEqual(await selectionStyle(page.locator('[data-type-field="'+transport+'"]')),selectedStyle);
  await assertSameRow('#type-prop-label','#type-prop-type');
  await publishDefinition(page);
  await page.locator('[data-view=definition]').click();
  await page.locator('#add-field').click();
  await assertSameRow('[data-prop=label]','[data-prop=type]');
  await assertItemLine(page.locator('.tree-item.selected'),'短い文字');
  assert.deepEqual(await rowGeometry(page.locator('.tree-item.selected')),rootGeometry);
  assert.deepEqual(await rowGeometry(page.locator('.tree-item:not(.selected)').first()),rootGeometry);
  assert.deepEqual(await selectionStyle(page.locator('.tree-item.selected')),selectedStyle);
  await page.getByRole('button',{name:'入力形式の候補を検索'}).click();
  const dialog=page.getByRole('dialog',{name:'型を検索'});
  const pickerType=dialog.locator('[data-type-select="'+id+'"]');
  const pickerFolder=dialog.locator('.type-folder').filter({has:page.locator('summary:text-is("会計")')}).first();
  const pickerSearch=dialog.getByRole('searchbox');
  await assertItemLine(pickerType,'複合型');
  assert.deepEqual(await rowGeometry(dialog.locator('[data-type-select=builtin_year]')),rootGeometry);
  assert.equal(await pickerType.locator('xpath=ancestor::details[contains(@class,"type-folder")]').count(),2);
  assert.equal(await pickerFolder.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  assert.equal(await dialog.getByRole('combobox',{name:'フォルダ'}).count(),0);
  await pickerFolder.locator(':scope > summary').click();
  assert(!await pickerType.isVisible());
  await pickerSearch.fill('会計 交通手段');
  assert.equal(await dialog.locator('.type-list-item:visible').count(),1);
  await dialog.getByRole('button',{name:'検索を解除'}).click();
  assert(!await pickerType.isVisible());
  await dialog.getByRole('combobox',{name:'タグ'}).selectOption('明細');
  assert.equal(await dialog.locator('.type-list-item:visible').count(),1);
  await pickerType.click();
  assert.equal(await page.locator('[data-prop=type]').inputValue(),'@'+id);
  await page.getByRole('button',{name:'入力形式の候補を検索'}).click();
  assert.equal(await pickerType.getAttribute('aria-pressed'),'true');
  assert.deepEqual(await selectionStyle(pickerType),selectedStyle);
  await dialog.getByRole('button',{name:'閉じる',exact:true}).click();

  await page.locator('#add-field').click();
  const key=await page.locator('[data-prop=key]').inputValue();
  await page.locator('[data-prop=type]').selectOption('Integer');
  await reveal(page,'#integer-format');
  await page.locator('#integer-format').selectOption('padded');
  assert(await page.getByRole('spinbutton',{name:'桁数',exact:true}).isVisible());
  await page.locator('#integer-digits').fill('6');
  await page.locator('#integer-digits').dispatchEvent('change');
  const value=page.locator('[data-input="'+key+'"]');
  await value.fill('12');await value.dispatchEvent('change');
  assert.equal(await value.inputValue(),'000012');
  assert.equal(await page.evaluate(key=>DocBenchApp.getPreviewValues()[key],key),12);
  await value.fill('123456');await value.dispatchEvent('change');
  assert.equal(await value.getAttribute('aria-invalid'),'false');
  await value.fill('1234567');await value.dispatchEvent('change');
  assert.equal(await value.getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('[data-number-error="'+key+'"]').innerText(),'6桁以内で入力してください');
  assert.equal(await value.inputValue(),'1234567');
  await page.locator('#integer-format').selectOption('grouped');
  await value.fill('12345');await value.dispatchEvent('change');
  assert.equal(await value.inputValue(),'12,345');
  assert.equal(await page.evaluate(key=>DocBenchApp.getPreviewValues()[key],key),12345);

  await page.locator('#integer-format').selectOption('padded');
  await page.locator('#integer-digits').fill('6');
  await page.locator('#integer-digits').dispatchEvent('change');
  await publishDefinition(page);
  await page.locator('[data-view=form]').click();
  await value.fill('1234567');await value.dispatchEvent('change');
  await page.locator('#export-document').click();
  assert.match(await page.locator('#input-issues').innerText(),/6桁以内で入力してください/);
  await value.fill('12');await value.dispatchEvent('change');
  assert.equal(await value.inputValue(),'000012');
  assert.equal(await page.evaluate(key=>DocBenchApp.getWorkspace().data.values[key],key),12);

  const viewport=page.viewportSize();
  try{
   await page.setViewportSize({width:1050,height:800});
   for(const [screen,row] of [['types','[data-type-select=builtin_year]'],['definition','.tree-item:not(.selected)']]){
    await page.locator('[data-view='+screen+']').click();
    assert.equal(await page.locator('.definition-workbench').getAttribute('data-flow-layout'),'focused');
    if(!await page.locator('.flow-source').isVisible())await page.locator('[data-task-back]').click();
    assert.deepEqual(await rowGeometry(page.locator(row).first()),rootGeometry);
   }
  }finally{await page.setViewportSize(viewport);}
 }finally{
  await page.evaluate(({original,heightPreference})=>{
   DocBenchApp.setWorkspace(original);
   if(heightPreference===null)localStorage.removeItem('docbench:typeListHeight');
   else localStorage.setItem('docbench:typeListHeight',heightPreference);
  },{original,heightPreference});
 }
};
