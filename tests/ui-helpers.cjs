/* Use the same visible tabs and menus as a person using the editor. */
exports.reveal=async(page,selector)=>{
 const target=page.locator(selector).first();
 const tab=await target.evaluate(el=>el.closest('[data-word-panel]')?.dataset.wordPanel);
 if(tab&&await page.locator('#word-tab-'+tab).getAttribute('aria-selected')!=='true')await page.locator('#word-tab-'+tab).click();
 const parents=await target.locator('xpath=ancestor::details').all();
 for(const parent of parents)if(!await parent.evaluate(el=>el.open))await parent.locator(':scope > summary').click();
};
exports.chooseFormat=async(page,format)=>{
 if(await page.locator('#word-output-format').isVisible())await page.locator('#word-output-format').selectOption(format);
 else{const selector='[data-design-format="'+format+'"]';await exports.reveal(page,selector);await page.locator(selector).click();}
};
exports.chooseField=async(page,id,value)=>{
 const picker=page.locator('#'+id+'-picker');
 if(await picker.count())await exports.reveal(page,'#'+id+'-picker');
 if(await picker.isVisible()){await picker.click();const dialog=page.locator('.field-picker-dialog');await dialog.locator('input[type=search]').fill(value);await dialog.locator('[data-field-choice="'+value+'"]').click();await dialog.waitFor({state:'hidden'});}
 else await page.locator('#'+id).selectOption(value);
};
