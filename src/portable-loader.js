/* Offline bootstrap. The program is data until it has been decoded completely. */
(function () {
'use strict';
const packet = document.getElementById('docbench-payload');
function fail(error) {
 const status = document.getElementById('save-status');
 if (status) status.textContent = '起動できませんでした';
 const app = document.getElementById('app');
 if (app) {
  const message = document.createElement('section');
  message.className = 'notice error';
  message.textContent = (error.dependencies?'必要なライブラリが読み込めません。HTMLとvendorフォルダーの配置を確認してください。\n':'HTMLのコピー・保存内容を確認してください。\n') + (error.message || String(error));
  app.replaceChildren(message);
 }
 console.error(error);
}
try {
 const missing=['JSZip','pako','docx','PptxGenJS','ExcelJS','jSuites','jspreadsheet','Konva','DocBenchEditorLib','DocBenchRuleLib'].filter(name=>!globalThis[name]);
 if(missing.length){const error=Error(missing.join(', '));error.dependencies=true;throw error;}
 const encoded = packet.textContent.replace(/\s/g, '');
 if (!encoded || encoded.length % 4) throw Error('Portable data is incomplete.');
 const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
 const bundle = JSON.parse(pako.ungzip(bytes, {to:'string'}));
 if (bundle.formatVersion !== 1 || typeof bundle.program !== 'string' || typeof bundle.licenses !== 'string') throw Error('Invalid portable data.');
 const licenseText = document.getElementById('third-party-licenses');
 licenseText.textContent = bundle.licenses;
 document.getElementById('portable-licenses').onclick = () => {
  const dialog = document.getElementById('modal');
  document.getElementById('modal-title').textContent = '同梱ライブラリのライセンス';
  const pre = document.createElement('pre');
  pre.textContent = bundle.licenses;
  document.getElementById('modal-body').replaceChildren(pre);
  if (!dialog.open) dialog.showModal();
 };
 const program = document.createElement('script');
 program.textContent = bundle.program + '\n//# sourceURL=docbench-runtime.js';
 document.body.appendChild(program);
 packet.remove();
} catch (error) { fail(error); }
})();
