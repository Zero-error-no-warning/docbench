import { build } from 'esbuild';
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url)),vendor=path.resolve(dir,'../../vendor');
const tiptapBuild=await build({metafile:true,entryPoints:[path.join(dir,'tiptap.js')],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2020',outfile:path.join(vendor,'tiptap.min.js'),legalComments:'eof'});
for(const [source,target] of [['exceljs/dist/exceljs.min.js','exceljs.min.js'],['jsuites/dist/jsuites.js','jsuites.js'],['jsuites/dist/jsuites.css','jsuites.css'],['jspreadsheet-ce/dist/index.js','jspreadsheet.js'],['jspreadsheet-ce/dist/jspreadsheet.css','jspreadsheet.css']])await writeFile(path.join(vendor,target),(await readFile(path.join(dir,'node_modules',source),'utf8')).replace(/\r\n/g,'\n'));
await build({stdin:{contents:"import Konva from 'konva'; globalThis.Konva=Konva;",resolveDir:dir},bundle:true,minify:true,format:'iife',platform:'browser',target:'es2020',outfile:path.join(vendor,'konva.min.js'),legalComments:'eof'});
// CE requires a formula global, but this document designer intentionally treats
// '=' prefixed input as literal text. No formula interpreter is loaded.
const ce=await readFile(path.join(vendor,'jspreadsheet.js'),'utf8');
await writeFile(path.join(vendor,'jspreadsheet.js'),'var formula={};\n'+ce);
const tiptapPackages=new Set();
for(const input of Object.keys(tiptapBuild.metafile.inputs)){
 const m=input.replaceAll('\\','/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);if(m)tiptapPackages.add(m[1]);
}
const tiptapLicenses=[];
for(const pkg of [...tiptapPackages].sort()){
 const names=await readdir(path.join(dir,'node_modules',pkg));const file=names.find(x=>/^licen[cs]e(?:\.|$)/i.test(x));if(!file)throw Error('Missing bundled license: '+pkg);tiptapLicenses.push(pkg+'/'+file);
}
for(const [name,files] of [['Tiptap',tiptapLicenses],['ExcelJS',['exceljs/LICENSE']],['Konva',['konva/LICENSE']],['Jspreadsheet',['jspreadsheet-ce/LICENSE']],['jSuites',['jsuites/LICENSE']]]){
 let text='';for(const file of files){text+=file+'\n'+(await readFile(path.join(dir,'node_modules',file),'utf8')).replace(/\r\n/g,'\n')+'\n\n';}await writeFile(path.join(vendor,name+'-LICENSE.txt'),text);
}
console.log('Local editor libraries built. No network is used by the application.');
