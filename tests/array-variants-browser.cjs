/* Configure heterogeneous rows, author both reports and inspect exported Word files. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const JSZip=require('../scripts/qa/node_modules/jszip');
const {chooseField,publishDefinition,reveal}=require('./ui-helpers.cjs');

module.exports=async function({page,url,root}){for(const portable of [false,true]){
 await page.goto(portable?'file://'+path.join(root,'portable/docbench.html')+'#editor':url+'/#editor');
 await page.waitForFunction(()=>window.DocBenchApp);
 const original=await page.evaluate(()=>DocBenchApp.getWorkspace());
 try{
  const fixture=await page.evaluate(()=>{
   const D=DocBench,w=D.createWorkspace('支出報告','担当者','docx');
   const item=(key,label)=>D.field(key,label,'String',{required:true});
   const goods=D.createType(w.definition,'物品',D.field('value','物品','Object',{fields:[item('name','品名')]}));
   const travel=D.createType(w.definition,'旅費',D.field('value','旅費','Object',{fields:[item('destination','目的地')]}));
   const details=D.field('details','明細','Array',{itemType:'Object',fields:[],rowLabel:'明細'});
   w.definition.fields=[details];
   w.data.values={details:[]};
   w.render.documents=[D.createOutputDocument('物品報告書'),D.createOutputDocument('旅費報告書')];
   w.render.defaultDocumentId=w.render.documents[0].id;
   DocBenchApp.setWorkspace(w);
   return {field:details.id,types:[goods.id,travel.id],reports:w.render.documents.map(d=>d.id)};
  });
  await page.locator('[data-view=definition]').click();
  await page.locator('[data-select="'+fixture.field+'"]').click();
  await page.locator('[data-prop=itemType]').selectOption('Variants');
  for(const id of fixture.types){
   await page.locator('[data-variant-choice]').selectOption(id);
   await page.locator('[data-variant-add]').click();
  }
  await publishDefinition(page);
  const [goods,travel]=await page.evaluate(()=>DocBenchApp.getWorkspace().definition.fields[0].fields.map(f=>f.key));
  await page.locator('[data-view=form]').click();
  const add=page.locator('[data-collection-path=details] .collection-bottom summary');
  for(const key of [goods,travel,goods]){
   if(!await page.locator('[data-row=add][data-variant="'+key+'"]').isVisible())await add.click();
   await page.locator('[data-row=add][data-variant="'+key+'"]').click();
  }
  for(const [path,value] of [['0.'+goods+'.name','Desk'],['1.'+travel+'.destination','Kyoto'],['2.'+goods+'.name','Chair']]){
   const input=page.locator('[data-input="details.'+path+'"]');
   await input.fill(value);
   await input.dispatchEvent('change');
  }
  assert.equal(await page.locator('[data-row-id] input[data-input]').count(),3);
  assert.deepEqual(await page.evaluate(()=>{const w=DocBenchApp.getWorkspace();return DocBench.validateData(w.definition,w.data.values);}),[]);
  await page.locator('[data-view=render]').click();
  for(const [index,key,child] of [[0,goods,'name'],[1,travel,'destination']]){
   await reveal(page,'#editor-document');
   await page.locator('#editor-document').selectOption(fixture.reports[index]);
   const editor=page.locator('#document-preview .tiptap');
   await editor.locator('p').first().click();
   await reveal(page,'#word-repeat-insert');
   await page.locator('#word-repeat-insert').click();
   await chooseField(page,'word-repeat-field','details.'+key);
   await page.locator('#word-range-apply').click();
   await editor.locator('.repeatBlock p').first().click();
   await reveal(page,'#canvas-insert-field-picker');
   assert.equal(await page.locator('#canvas-insert-field option').count(),1);
   await chooseField(page,'canvas-insert-field','details.'+key+'.'+child);
   await page.locator('#canvas-insert').click();
  }
  await page.locator('[data-view=form]').click();
  for(const [index,expected,excluded] of [[0,['Desk','Chair'],['Kyoto']],[1,['Kyoto'],['Desk','Chair']]]){
   await page.locator('#output-document').selectOption(fixture.reports[index]);
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-document').click()]);
   const zip=await JSZip.loadAsync(fs.readFileSync(await download.path()));
   const xml=await zip.file('word/document.xml').async('string');
   for(const value of expected)assert(xml.includes(value),value);
   for(const value of excluded)assert(!xml.includes(value),value);
   if(index===0)assert(xml.indexOf('Desk')<xml.indexOf('Chair'));
  }
 }finally{
  await page.evaluate(w=>DocBenchApp.setWorkspace(w),original);
  await page.evaluate(()=>DocBenchApp.save());
 }
}};
