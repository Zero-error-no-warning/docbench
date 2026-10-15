/* Public complete examples must work together without inventing missing fields. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),D=require('../scripts/load-core.cjs');
test('published Definition, RenderDefinition and DocumentData examples are a compatible import set',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../docs/specification.md'),'utf8'),examples=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));
 const definition=D.assertImport(examples.find(v=>v.kind==='Definition'&&v.id==='definition-1')),render=D.assertImport(examples.find(v=>v.kind==='RenderDefinition'&&v.id==='render-1')),data=D.assertImport(examples.find(v=>v.kind==='DocumentData'&&v.id==='document-1'));
 assert.equal(render.definitionId,definition.id);assert.equal(data.definitionId,definition.id);assert.deepEqual(D.validateDefinition(definition,render).errors,[]);assert.deepEqual(D.validateData(definition,data.values),[]);
 const layout=examples.find(v=>v.type==='rich'&&v.id==='layout-1');assert(layout);render.documents[0].designs.docx.blocks.push(layout);assert.deepEqual(D.validateDefinition(definition,render).errors,[]);
});
