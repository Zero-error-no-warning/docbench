'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const D=require('../scripts/load-core.cjs');
const rows=ids=>ids.map(_id=>({_id,x:1,y:2}));
test('sample definition and data meet all declared constraints',()=>{const w=D.sample();assert.deepEqual(D.validateDefinition(w.definition,w.render).errors,[]);assert.deepEqual(D.validateData(w.definition,w.data.values),[]);assert.equal(w.history.length,1);});
test('different fields and different properties of the same row merge',()=>{const b={a:1,rows:rows(['a','b'])},l=D.clone(b),r=D.clone(b);l.a=2;l.rows[0].x=8;r.rows[0].y=9;r.rows[1].x=12;const m=D.merge(b,l,r);assert.equal(m.conflicts.length,0);assert.equal(m.value.rows[0].x,8);assert.equal(m.value.rows[0].y,9);assert.equal(m.value.rows[1].x,12);});
test('addition and reorder preserve row identity',()=>{const b=rows(['a','b','c']),l=rows(['b','a','c']),r=rows(['a','b','c','d']);r[0].x=42;const m=D.merge(b,l,r);assert.equal(m.conflicts.length,0);assert.deepEqual(m.value.map(x=>x._id),['b','a','c','d']);assert.equal(m.value.find(x=>x._id==='a').x,42);});
test('independent moves merge',()=>{const b=rows(['a','b','c','d','e','f']),l=rows(['b','a','c','d','e','f']),r=rows(['a','b','c','d','f','e']);const m=D.merge(b,l,r);assert.equal(m.conflicts.length,0);assert.deepEqual(m.value.map(x=>x._id),['b','a','c','d','f','e']);});
test('same row moving to different destinations conflicts',()=>{const b=rows(['a','b','c','d','e']),l=rows(['a','c','d','b','e']),r=rows(['a','c','d','e','b']);const m=D.merge(b,l,r);assert.equal(m.conflicts[0].path,'/~order');assert.equal(m.conflicts[0].reason,'同じ要素の異なる移動先');assert.deepEqual(D.merge(b,l,r,{'/~order':{mode:'right'}}).value.map(x=>x._id),r.map(x=>x._id));});
test('scalar conflicts require explicit choice',()=>{const m=D.merge({x:1},{x:2},{x:3});assert.equal(m.conflicts.length,1);assert.equal(D.merge({x:1},{x:2},{x:3},{'/x':{mode:'custom',value:7}}).value.x,7);});
test('delete-versus-edit is explicit and can restore base',()=>{const b={rows:rows(['a'])},l={rows:[]},r=D.clone(b);r.rows[0].x=9;const m=D.merge(b,l,r);assert.equal(m.conflicts[0].path,'/rows/a');const resolved=D.merge(b,l,r,{'/rows/a':{mode:'base'}});assert.equal(resolved.value.rows[0].x,1);});
test('independent additions with same ID are a conflict',()=>{const b=[],l=rows(['a']),r=rows(['a']);r[0].y=3;assert.match(D.merge(b,l,r).conflicts[0].reason,/識別子が重複/);});
test('row copies get new IDs, preserve origin, including nested rows',()=>{const f=D.field('a','配列','Table',{fields:[D.field('items','内部','Array',{itemType:'String',initialRows:1})]});const a=D.newRow(f,'A'),b=D.newRow(f,'B',a);assert.notEqual(a._id,b._id);assert.equal(b._meta.origin,a._id);assert.notEqual(a.items[0]._id,b.items[0]._id);});
test('diff uses stable ID and explicit order, not position',()=>{const a=rows(['a','b']),b=rows(['b','a']);b[1].x=3;const paths=D.diff(a,b).map(x=>x.path);assert(paths.includes('/a/x'));assert(paths.includes('/~order'));assert(!paths.some(x=>/^\/0/.test(x)));});
test('types, business keys, sizes and sort order are checked after merge',()=>{const w=D.sample(),f=w.definition.fields.find(f=>f.key==='expenses');w.data.values.budget='100';w.data.values.expenses.push({...D.clone(w.data.values.expenses[0]),_id:D.uid()});f.maxItems=1;f.sortBy='amount';w.data.values.expenses[0].amount=9;w.data.values.expenses[1].amount=2;const msgs=D.validateData(w.definition,w.data.values).map(x=>x.message);assert(msgs.some(x=>x.includes('数値型')));assert(msgs.some(x=>x.includes('業務キー')));assert(msgs.some(x=>x.includes('最大要素数')));assert(msgs.some(x=>x.includes('並び順')));});
test('conditional required and enum selection rules are checked',()=>{const f=D.field('note','説明','Text',{requiredWhen:{field:'enabled',equals:true}}),def={fields:[D.field('enabled','有効','Boolean'),f,D.field('choices','選択','MultiEnum',{options:['A','B'],minSelections:2})]};const es=D.validateData(def,{enabled:true,note:'',choices:['A']});assert.equal(es.length,2);});
test('invalid calendar dates do not pass normalization',()=>{assert.equal(D.validateData({fields:[D.field('date','日付','Date')]},{date:'2026-02-30'}).length,1);});
test('missing references, duplicate field IDs and malformed templates are reported',()=>{const w=D.sample();w.definition.fields[1].id=w.definition.fields[0].id;w.render.documents[0].blocks.push({id:D.uid(),type:'field',field:'missing'});w.render.documents[0].useTemplate=true;w.render.documents[0].template='<h1>{{missing}}</h1>{{broken';assert(D.validateDefinition(w.definition,w.render).errors.length>=4);});
test('history common ancestor includes merge parents',()=>{const w=D.sample(),base=w.branches.main;w.branches.revised=base;D.snapshot(w,'L');const left=w.branches.main;D.checkout(w,'revised');D.snapshot(w,'R');const right=w.branches.revised;assert.equal(D.ancestor(w,left,right),base);D.snapshot(w,'M',[left,right]);assert.equal(D.ancestor(w,w.branches.revised,left),left);});
test('import rejects bad versions, reserved keys and cyclic history',()=>{assert.throws(()=>D.assertImport({kind:'Definition',formatVersion:2}));assert.throws(()=>D.assertImport(JSON.parse('{"kind":"Definition","formatVersion":1,"__proto__":{}}')));const w=D.sample();w.history[0].parents=[w.history[0].id];assert.throws(()=>D.assertImport(w),/循環/);});
test('all three independent files carry history and attachments',()=>{const w=D.sample();for(const kind of ['Definition','RenderDefinition','DocumentData']){const v=D.envelope(w,kind);assert.equal(v.history.nodes.length,1);assert.equal(v.kind,kind);}});
test('cyclic combined order requires a choice and can restore parent order',()=>{const b=rows(['a','b','c']),l=rows(['b','a','c']),r=rows(['a','c','b']);const m=D.merge(b,l,r);assert.equal(m.conflicts.length,1);assert.deepEqual(D.merge(b,l,r,{'/~order':{mode:'base'}}).value.map(x=>x._id),['a','b','c']);});

test('legacy output models migrate deterministically including complete and independent histories',()=>{
 const w=D.sample();function legacy(r){const document=D.clone(r.documents[0]),result={...r,...document,id:r.id};delete result.documents;delete result.defaultDocumentId;return result;}
 w.render=legacy(w.render);w.history.forEach(n=>n.state.render=legacy(n.state.render));
 const before=D.clone(w),a=D.assertImport(D.clone(w)),b=D.assertImport(D.clone(w));
 assert.deepEqual(a,b);assert.deepEqual(a.data,before.data);assert.equal(a.render.defaultDocumentId,before.render.id+'_document');
 assert.deepEqual(a.render.documents[0].blocks,before.render.blocks);assert.equal(a.history[0].state.render.defaultDocumentId,a.render.defaultDocumentId);assert.equal(D.diff(a.history[0].state,D.state(a)).length,0);
 const independent={...before.render,history:{nodes:before.history.map(n=>({...n,state:n.state.render}))}};
 const migrated=D.assertImport(independent);assert.equal(migrated.history.nodes[0].state.documents[0].id,migrated.documents[0].id);assert(!Object.hasOwn(migrated,'blocks'));
});
test('multiple documents merge and diff by immutable identity and keep shared input intact',()=>{
 const w=D.sample();w.render.documents.push(D.createOutputDocument('予算明細','xlsx'));
 const b=D.state(w),l=D.clone(b),r=D.clone(b),first=b.render.documents[0].id,second=b.render.documents[1].id;
 l.render.documents[0].title='報告書修正';r.render.documents[1].title='明細修正';r.render.documents.reverse();
 const result=D.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.value.render.documents.find(d=>d.id===first).title,'報告書修正');assert.equal(result.value.render.documents[0].id,second);assert.deepEqual(result.value.data,w.data);
 assert(D.diff(b,l).some(d=>d.path==='/render/documents/'+first+'/title'));
 const deleted=D.clone(b);deleted.render.documents.shift();const edited=D.clone(b);edited.render.documents[0].title='競合';assert(D.merge(b,deleted,edited).conflicts.some(c=>c.path==='/render/documents/'+first));
});
test('document duplicates have fresh nested identity while preserving field references and source data',()=>{
 const document=D.createOutputDocument('報告書','docx');document.designs.docx={blocks:[{id:'block',type:'rich',content:{type:'doc',content:[{type:'paragraph',attrs:{id:'paragraph'},content:[{type:'fieldRef',attrs:{field:'projectName'}}]}]}}]};document.designs.xlsx={cellMerges:[{id:'merge',cell:'A1',span:2,rowSpan:1}]};
 const before=D.clone(document),copy=D.duplicateOutputDocument(document);assert.deepEqual(document,before);assert.notEqual(copy.id,document.id);assert.notEqual(copy.designs.docx.blocks[0].id,'block');assert.notEqual(copy.designs.docx.blocks[0].content.content[0].attrs.id,'paragraph');assert.equal(copy.designs.docx.blocks[0].content.content[0].content[0].attrs.field,'projectName');assert.notEqual(copy.designs.xlsx.cellMerges[0].id,'merge');
});
test('all output documents are validated and unused fields are aggregated across documents',()=>{
 const w=D.sample(),a=w.render.documents[0];a.blocks=[{id:'name',type:'field',field:'projectName'}];const b=D.createOutputDocument('明細','html');b.blocks=[{id:'budget',type:'field',field:'budget'}];w.render.documents.push(b);
 assert(!D.validateDefinition(w.definition,w.render).warnings.some(x=>['projectName','budget'].includes(x.path)));
 b.blocks.push({id:'bad',type:'field',field:'missing'});assert(D.validateDefinition(w.definition,w.render).errors.some(x=>x.path.includes(b.id)&&x.message.includes('missing')));
 b.id=a.id;w.render.defaultDocumentId='absent';const errors=D.validateDefinition(w.definition,w.render).errors;assert(errors.some(x=>x.message.includes('書類ID')));assert(errors.some(x=>x.path==='render.defaultDocumentId'));
 w.render.documents=[];assert(D.validateDefinition(w.definition,w.render).errors.some(x=>x.path==='render.documents'));
});

test('visible fields alone participate in required and type validation, retained data restores after switching',()=>{
 const def={fields:[D.field('kind','種別','Enum',{options:['A','B'],required:true}),D.field('x','項目X','Integer',{required:true,min:10,visibleWhen:{field:'kind',equals:'A'}})]},values={kind:'B',x:'以前の値'};
 assert.deepEqual(D.validateDefinition(def).errors,[]);assert.deepEqual(D.validateData(def,values),[]);assert.deepEqual(D.inputState(def,values).values(),{kind:'B'});assert.equal(values.x,'以前の値');
 values.kind='A';assert(D.validateData(def,values).some(e=>e.path==='x'));values.x='';assert(D.validateData(def,values).some(e=>e.message==='必須項目です'));values.x=12;assert.deepEqual(D.validateData(def,values),[]);
 values.kind='B';assert(!Object.hasOwn(D.inputState(def,values).values(),'x'));values.kind='A';assert.equal(D.inputState(def,values).values().x,12);
});
test('hidden condition sources do not activate dependants and zero/false conditions retain their types',()=>{
 const def={fields:[D.field('flag','有無','Boolean'),D.field('number','数','Integer'),D.field('source','条件元','String',{visibleWhen:{field:'flag',equals:true}}),D.field('x','X','String',{visibleWhen:{field:'source',equals:'yes'}}),D.field('zero','ゼロ','String',{requiredWhen:{field:'number',equals:0}}),D.field('falseField','いいえ','String',{visibleWhen:{field:'flag',equals:false}})]};
 const values={flag:false,number:0,source:'yes',x:'古い値',zero:'',falseField:'表示'},input=D.inputState(def,values);assert.equal(input.visible('x'),false);assert.equal(input.visible('falseField'),true);assert(D.validateData(def,values).some(e=>e.path==='zero'));assert(!D.validateData(def,values).some(e=>e.path==='x'));
 values.flag=true;assert.equal(D.inputState(def,values).visible('x'),true);values.number='0';assert.equal(D.inputState(def,values).required(def.fields[4]),false);
});
test('conditional Object and collection columns project nested values without changing row identity',()=>{
 const condition={field:'kind',equals:'A'},def={fields:[D.field('kind','種別','Enum',{options:['A','B']}),D.field('object','詳細','Object',{visibleWhen:condition,fields:[D.field('note','説明','String',{required:true})]}),D.field('rows','表','Table',{uniqueBy:'secret',sortBy:'secret',fields:[D.field('name','名称'),D.field('secret','内部項目','String',{required:true,visibleWhen:condition})]})]},values={kind:'B',object:{note:''},rows:[{_id:'r1',name:'1',secret:'z',_meta:{origin:null}},{_id:'r2',name:'2',secret:'z'}]};
 assert.deepEqual(D.validateData(def,values),[]);const active=D.inputState(def,values);assert.equal(active.visible('object.note'),false);assert.equal(active.visible('rows.0.secret'),false);assert.deepEqual(active.values(),{kind:'B',rows:[{_id:'r1',_meta:{origin:null},name:'1'},{_id:'r2',name:'2'}]});assert.deepEqual(active.definition().fields.find(f=>f.key==='rows').fields.map(f=>f.key),['name']);assert.equal(values.rows[0].secret,'z');
 values.kind='A';assert(D.validateData(def,values).some(e=>e.path==='object.note'));assert(D.validateData(def,values).some(e=>e.message.includes('業務キー')));
});
test('condition references, value types and direct/ancestor visibility cycles are validated',()=>{
 const def={fields:[D.field('kind','種別','Enum',{options:['A','B']}),D.field('x','X','String',{visibleWhen:{field:'kind',equals:'C'}})]};assert(D.validateDefinition(def).errors.some(e=>e.path==='x.visibleWhen'));def.fields[1].visibleWhen={field:'missing',equals:'A'};assert(D.validateDefinition(def).errors.length);
 def.fields[0].visibleWhen={field:'x',equals:'value'};def.fields[1].visibleWhen={field:'kind',equals:'A'};assert(D.validateDefinition(def).errors.some(e=>e.message.includes('循環参照')));assert.equal(D.inputState(def,{kind:'A',x:'value'}).visible('x'),false);
 const parent={fields:[D.field('object','親','Object',{visibleWhen:{field:'object.enabled',equals:true},fields:[D.field('enabled','表示','Boolean')]})]};assert(D.validateDefinition(parent).errors.some(e=>e.message.includes('循環参照')));
 const array={fields:[D.field('rows','行','Table',{initialRows:0,fields:[D.field('enabled','有無','Boolean')]}),D.field('x','X','String',{visibleWhen:{field:'rows.enabled',equals:true}})]};assert(D.validateDefinition(array).errors.some(e=>e.path==='x.visibleWhen'));
});
