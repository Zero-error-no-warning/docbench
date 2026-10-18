/* Follow the visible disclosure route before using an advanced control. */
exports.reveal=async(page,selector)=>{
 const parents=await page.locator(selector).first().locator('xpath=ancestor::details').all();
 for(const parent of parents)if(!await parent.evaluate(el=>el.open))await parent.locator(':scope > summary').click();
};
