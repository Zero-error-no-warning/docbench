/* Use the same visible tabs and menus as a person using the editor. */
exports.reveal=async(page,selector)=>{
 const target=page.locator(selector).first();
 const tab=await target.evaluate(el=>el.dataset.wordActionTool||el.closest('[data-word-panel]')?.dataset.wordPanel);
 if(tab&&tab!=='control'&&tab!=='details'&&(!await target.isVisible()||await page.locator('#word-tab-'+tab).getAttribute('aria-selected')!=='true'))await page.locator('#word-tab-'+tab).click();
 const parents=await target.locator('xpath=ancestor::details').all();
 for(const parent of parents)if(!await parent.evaluate(el=>el.open))await parent.locator(':scope > summary').click();
};
exports.chooseFormat=async(page,format)=>{
 if(await page.locator('#word-output-format').count()){await exports.reveal(page,'#word-output-format');await page.locator('#word-output-format').selectOption(format);if(await page.locator('.word-file-menu').count()&&await page.locator('.word-file-menu').getAttribute('open')!==null)await page.keyboard.press('Escape');}
 else{const selector='[data-design-format="'+format+'"]';await exports.reveal(page,selector);await page.locator(selector).click();}
};
exports.chooseField=async(page,id,value)=>{
 const picker=page.locator('#'+id+'-picker');
 if(await picker.count())await exports.reveal(page,'#'+id+'-picker');
 if(await picker.isVisible()){await picker.click();const dialog=page.locator('.field-picker-inline:visible,.field-picker-dialog:visible');await dialog.locator('input[type=search]').fill(value);await dialog.locator('[data-field-choice="'+value+'"]').click();await dialog.waitFor({state:'hidden'});}
 else await page.locator('#'+id).selectOption(value);
};
// Existing feature scenarios explicitly publish completed definition edits at their navigation boundaries.
// The dedicated unified workflow suite separately checks navigation without publishing and cancellation.
exports.publishDefinition=async page=>{
 const apply=page.locator('[data-draft-apply]:visible');if(!await apply.count()||await apply.isDisabled())return;
 await apply.click();await page.waitForFunction(()=>!window.DocBenchApp?.definitionDraftStatus().dirty,{},{timeout:5000});
};
exports.clickWorkspaceHistory=async(page,redo=false)=>{const id=redo?'#redo':'#undo';await exports.reveal(page,id);await page.locator(id).click();};

exports.addRule=async(page,type)=>{const kind=page.locator('#workflow-rule-kind');if(!await kind.isVisible())await page.locator('.rule-properties [data-task-back]').click();await kind.selectOption(type);await page.locator('#workflow-rule-add').click();};

// Legacy feature fixtures explicitly import trial values when the scenario needs real input data.
// Production navigation and the unified workflow tests never perform this fixture operation.
exports.publishPreviewFixture=async page=>{
 const definition=await page.locator('#app').getAttribute('data-screen')==='definition';
 const trial=definition?await page.evaluate(()=>DocBenchApp.getPreviewValues()):null;
 await exports.publishDefinition(page);
 if(trial)await page.evaluate(values=>{const w=DocBenchApp.getPublishedWorkspace();w.data.values=values;DocBenchApp.setWorkspace(w);},trial);
};
