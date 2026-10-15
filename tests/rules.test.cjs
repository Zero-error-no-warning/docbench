'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../scripts/load-core.cjs');
function fixture(){const w=D.sample();w.definition.fields.push(D.field('kind','種別','Enum',{options:['A','B','C']}),D.field('x','X','String'));Object.assign(w.data.values,{kind:'A',x:'保持'});return w;}
function simple(w,field,value){return D.addSimpleRule(w.definition,{field,equals:value}).nodeId;}
function add(w,type,extra={}){const n={id:D.uid(),type,...extra};D.ensureRuleGraph(w.definition).nodes.push(n);return n.id;}
function wire(w,source,target,input){D.connectRule(w,source,target,input);}
function target(w,key,property){return D.ruleTargets(w).find(t=>t.path===key&&t.property===property);}
test('AND / OR compose typed predicates and reuse one result for visibility, required and multiple document generation',()=>{
 const w=fixture(),a=simple(w,'kind','A'),b=simple(w,'kind','B'),or=add(w,'or'),and=add(w,'and');wire(w,a,or,'items');wire(w,b,or,'items');const money=add(w,'field',{field:'budget'}),limit=add(w,'literal',{valueType:'number',value:1000}),compare=add(w,'compare',{operator:'gte'});wire(w,money,compare,'left');wire(w,limit,compare,'right');wire(w,or,and,'items');wire(w,compare,and,'items');
 wire(w,and,target(w,'x','visibleWhen').id,'condition');wire(w,and,target(w,'x','requiredWhen').id,'condition');w.render.documents.push(D.createOutputDocument('追加','docx'));for(const document of w.render.documents)document.generateWhen={nodeId:and};assert.deepEqual(D.validateDefinition(w.definition,w.render).errors,[]);
 for(const [kind,budget,expected] of [['A',1000,true],['B',1200,true],['C',1200,false],['A',999,false]]){Object.assign(w.data.values,{kind,budget});const state=D.inputState(w.definition,w.data.values);assert.equal(state.visible('x'),expected);assert.equal(state.required(D.fieldAt(w.definition,'x')),expected);assert.equal(D.availableDocuments(w.definition,w.render,w.data.values).length,expected?2:0);}
});
test('unknown values stay unknown through NOT and AND / OR use explicit three-valued truth tables',()=>{
 const w=fixture();w.data.values.kind='';const a=simple(w,'kind','A'),not=add(w,'not'),yes=add(w,'literal',{valueType:'boolean',value:true}),no=add(w,'literal',{valueType:'boolean',value:false}),and=add(w,'and'),or=add(w,'or');wire(w,a,not,'value');wire(w,a,and,'items');wire(w,no,and,'items');wire(w,a,or,'items');wire(w,yes,or,'items');const run=D.ruleRuntime(w.definition,w.data.values);
 assert.equal(run.evaluate(a).status,'unknown');assert.equal(run.evaluate(not).status,'unknown');assert.deepEqual(run.evaluate(and),{status:'known',value:false,valueType:'boolean'});assert.equal(run.evaluate(or).value,true);D.fieldAt(w.definition,'kind').visibleWhen={field:'status',equals:'計画中'};assert.equal(D.inputState(w.definition,w.data.values).matches({nodeId:not}),false);
});
test('simple UI edits preserve private chain identity and copy a shared rule before changing it',()=>{
 const w=fixture(),x=D.fieldAt(w.definition,'x');x.visibleWhen=D.setSimpleRule(w,x,'visibleWhen',{field:'kind',equals:'A'});const id=x.visibleWhen.nodeId,length=w.definition.ruleGraph.nodes.length;
 x.visibleWhen=D.setSimpleRule(w,x,'visibleWhen',{field:'kind',equals:'B'});assert.equal(x.visibleWhen.nodeId,id);assert.equal(w.definition.ruleGraph.nodes.length,length);assert.deepEqual(D.simpleCondition(w.definition,x.visibleWhen),{field:'kind',equals:'B'});
 w.render.documents[0].generateWhen={nodeId:id};x.visibleWhen=D.setSimpleRule(w,x,'visibleWhen',{field:'kind',equals:'C'});assert.notEqual(x.visibleWhen.nodeId,id);assert.deepEqual(D.simpleCondition(w.definition,w.render.documents[0].generateWhen),{field:'kind',equals:'B'});
});
test('legacy migration is deterministic, preserves semantics and does not rewrite history nodes',()=>{
 const w=fixture();D.fieldAt(w.definition,'x').visibleWhen={field:'kind',equals:'A'};D.fieldAt(w.definition,'x').requiredWhen={field:'budget',equals:1200000};const before=D.clone(w),a=D.clone(w),b=D.clone(w);assert.equal(D.migrateRuleConditions(a),2);D.migrateRuleConditions(b);assert.deepEqual(a,b);assert.deepEqual(a.history,before.history);assert.equal(D.migrateRuleConditions(a),0);assert.equal(D.inputState(a.definition,a.data.values).visible('x'),true);a.data.values.kind='C';assert.equal(D.inputState(a.definition,a.data.values).visible('x'),false);assert.deepEqual(D.validateDefinition(a.definition,a.render).errors,[]);
});
test('cycles, wrong ports, duplicate connections, incompatible values and dangling bindings are rejected',()=>{
 const w=fixture(),yes=add(w,'literal',{valueType:'boolean',value:true}),and=add(w,'and'),not=add(w,'not');wire(w,yes,and,'items');wire(w,and,not,'value');assert.match(D.ruleConnectionError(w,not,and,'items'),/循環/);
 const field=add(w,'field',{field:'budget'});assert.match(D.ruleConnectionError(w,field,and,'items'),/論理/);assert.match(D.ruleConnectionError(w,field,target(w,'x','visibleWhen').id,'condition'),/条件の結果/);
 wire(w,yes,target(w,'x','visibleWhen').id,'condition');assert.match(D.ruleConnectionError(w,yes,target(w,'x','visibleWhen').id,'condition'),/解除/);wire(w,yes,and,'items');assert(D.validateDefinition(w.definition,w.render).errors.some(e=>e.message.includes('重複')));
 D.fieldAt(w.definition,'x').visibleWhen={nodeId:'missing'};assert(D.validateDefinition(w.definition,w.render).errors.some(e=>e.message.includes('条件ノードがありません')));
});
test('graph DAGs still reject visibility feedback through field references and NOT of hidden input cannot reveal data',()=>{
 const w=fixture(),x=D.fieldAt(w.definition,'x'),rule=simple(w,'x','保持');x.visibleWhen={nodeId:rule};assert(D.validateDefinition(w.definition,w.render).errors.some(e=>e.message.includes('循環')));assert.equal(D.inputState(w.definition,w.data.values).visible('x'),false);
});
test('unfinished unused nodes may be saved, but a bound incomplete condition blocks generation validation',()=>{
 const w=fixture(),compare=add(w,'compare',{operator:'eq'});assert.deepEqual(D.validateDefinition(w.definition,w.render).errors,[]);D.fieldAt(w.definition,'x').visibleWhen={nodeId:compare};assert(D.validateDefinition(w.definition,w.render).errors.some(e=>e.message.includes('未接続')));
});
test('conditions compare dates by order, keep zero/false typed and graph changes merge by stable IDs',()=>{
 const w=fixture(),left=add(w,'literal',{valueType:'date',value:'2026-10-15'}),right=add(w,'literal',{valueType:'date',value:'2026-10-14'}),compare=add(w,'compare',{operator:'gte'});wire(w,left,compare,'left');wire(w,right,compare,'right');assert.equal(D.ruleRuntime(w.definition,w.data.values).evaluate(compare).value,true);
 const base=D.state(w),a=D.clone(base),b=D.clone(base);a.definition.ruleGraph.nodes[0].label='変更A';b.definition.ruleGraph.nodes[1].label='変更B';const merged=D.merge(base,a,b);assert.equal(merged.conflicts.length,0);assert.equal(merged.value.definition.ruleGraph.nodes[0].label,'変更A');assert.equal(merged.value.definition.ruleGraph.nodes[1].label,'変更B');
});

test('malformed graphs and inherited operator names are rejected without evaluating them',()=>{
 const w=fixture(),x=D.fieldAt(w.definition,'x');w.definition.ruleGraph={nodes:{},connections:[]};x.visibleWhen={nodeId:'bad'};assert(D.validateDefinition(w.definition,w.render).errors.some(e=>e.path==='ruleGraph'));assert.equal(D.inputState(w.definition,w.data.values).visible('x'),false);w.definition.ruleGraph={nodes:[{id:'bad',type:'compare',operator:'constructor'}],connections:[]};assert(D.validateDefinition(w.definition,w.render).errors.some(e=>e.message.includes('比較方法')));
});

test('published graph and render examples form an executable pair',()=>{
 const markdown=require('node:fs').readFileSync(require('node:path').join(__dirname,'../docs/specification.md'),'utf8'),examples=[...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>{try{return JSON.parse(m[1]);}catch{return null;}}),definition=examples.find(v=>v?.id==='definition-rules'),render=examples.find(v=>v?.id==='render-rules');assert(definition&&render);assert.deepEqual(D.validateDefinition(definition,render).errors,[]);assert.equal(D.availableDocuments(definition,render,{kind:'A',amount:1000,x:'値'}).length,2);assert.equal(D.availableDocuments(definition,render,{kind:'B',amount:999,x:'値'}).length,1);assert.equal(D.availableDocuments(definition,render,{kind:'C',amount:999,x:'値'}).length,0);
});

test('migration keeps distinct valid IDs and does not overwrite existing graph nodes',()=>{
 const w=fixture(),a=D.fieldAt(w.definition,'x');a.id='a-b';a.visibleWhen={field:'kind',equals:'A'};const b=D.field('z','Z','String',{id:'a_b',visibleWhen:{field:'kind',equals:'B'}});w.definition.fields.push(b);w.data.values.z='';D.migrateRuleConditions(w);assert.notEqual(a.visibleWhen.nodeId,b.visibleWhen.nodeId);assert.equal(D.inputState(w.definition,w.data.values).visible('x'),true);assert.equal(D.inputState(w.definition,w.data.values).visible('z'),false);const before=D.clone(D.ruleGraph(w.definition)),first=D.addSimpleRule(w.definition,{field:'kind',equals:'A'},'fixed'),second=D.addSimpleRule(w.definition,{field:'kind',equals:'B'},'fixed');assert.notEqual(first.nodeId,second.nodeId);assert.equal(D.simpleCondition(w.definition,first).equals,'A');assert.equal(D.simpleCondition(w.definition,second).equals,'B');assert.deepEqual(D.ruleGraph(w.definition).nodes.slice(0,before.nodes.length),before.nodes);
});
