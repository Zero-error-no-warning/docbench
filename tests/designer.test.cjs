'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const D = require('../scripts/load-core.cjs');
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../src/render.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../src/designer.js'),'utf8'));
test('dragging and resizing respect slide boundaries at fractional centimetre limits',()=>{
 const box={slide:1,x:1,y:2,w:30.6,h:4},page={width:33.867,height:19.05};
 const moved=D.adjustDesignBox(box,100,100,page);
 assert(moved.x+moved.w<=page.width);assert(moved.y+moved.h<=page.height);
 const resized=D.adjustDesignBox(box,100,100,page,true);
 assert(resized.x+resized.w<=page.width);assert(resized.y+resized.h<=page.height);
 assert.equal(D.adjustDesignBox(box,-100,-100,page).x,0);
 assert.equal(D.adjustDesignBox(box,.16,.24,page).x,1.2);
 assert.equal(D.adjustDesignBox(box,.16,.24,page,false,false).x,1.16);
 assert.deepEqual(box,{slide:1,x:1,y:2,w:30.6,h:4});
});
test('Excel range placement uses the label column and both horizontal and vertical merges',()=>{
 const r={row:7,col:3,endRow:9,endCol:6};
 assert.deepEqual(D.rangeLayout({type:'field'},r),{cell:'C7',span:3,rowSpan:3});
 assert.deepEqual(D.rangeLayout({type:'text'},r),{cell:'C7',span:4,rowSpan:3});
 assert.deepEqual(D.rangeLayout({type:'field',showLabel:false},r),{cell:'C7',span:4,rowSpan:3});
});
test('document drag reorder keeps immutable IDs and changes the intended insertion position',()=>{
 const b=[{id:'a'},{id:'b'},{id:'c'}];
 assert.deepEqual(D.reorderDesignBlocks(b,'a','c',true).map(b=>b.id),['b','c','a']);
 assert.deepEqual(D.reorderDesignBlocks(b,'c','a',false).map(b=>b.id),['c','a','b']);
 assert.equal(D.reorderDesignBlocks(b,'a','a'),b);
 assert.deepEqual(b.map(b=>b.id),['a','b','c']);
});
