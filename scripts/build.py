#!/usr/bin/env python3
"""Build ASCII-safe portable HTML with separate local vendor libraries."""
import base64, gzip, hashlib, json, re, textwrap
from pathlib import Path
import rjsmin
ROOT=Path(__file__).resolve().parent.parent
# Ship the same published specification in normal and portable apps; no runtime fetch.
specification=(ROOT/'docs/specification.md').read_text()
(ROOT/'src/specification.js').write_text('/* Generated from docs/specification.md by scripts/build.py. */\nDocBench.specification='+json.dumps(specification,ensure_ascii=False)+';\n',encoding='utf-8')
libs=['jszip.min.js','pako.min.js','docx.js','pptxgen.min.js','exceljs.min.js','jsuites.js','jspreadsheet.js','konva.min.js','tiptap.min.js']
source=(ROOT/'index.html').read_text()
css=re.sub(r'\s+',' ',(ROOT/'src/style.css').read_text()).strip()
# CSS uses its own escape syntax; HTML character entities do not apply inside style.
css=''.join(c if ord(c)<128 else '\\'+format(ord(c),'x')+' ' for c in css)
app=rjsmin.jsmin('\n;\n'.join((ROOT/'src'/p).read_text() for p in ['core.js','layout.js','render.js','designer.js','editors.js','specification.js','app.js']))
# Vendor libraries remain separate; local pako loads before the bootstrap.
program=app
licenses='\n\n'.join(p.name+'\n'+p.read_text() for p in sorted((ROOT/'vendor').glob('*LICENSE*')))
bundle=json.dumps({'formatVersion':1,'program':program,'licenses':licenses},ensure_ascii=False,separators=(',',':')).encode('utf-8')
encoded=base64.b64encode(gzip.compress(bundle,mtime=0)).decode('ascii')
payload='\n'.join(textwrap.wrap(encoded,120))
bootstrap=''
loader=rjsmin.jsmin((ROOT/'src/portable-loader.js').read_text())
def ascii_js(value):
 # Keep all executable bootstrap text ASCII, including literals and comments.
 return ''.join(c if ord(c)<128 else ('\\u'+format(ord(c),'04x') if ord(c)<=0xffff else '\\u'+format(0xd800+((ord(c)-0x10000)>>10),'04x')+'\\u'+format(0xdc00+((ord(c)-0x10000)&1023),'04x')) for c in value)
def script(value):
 return '<script>'+re.sub(r'</script',r'<\\/script',ascii_js(value),flags=re.I)+'</script>'
portable=source.replace('<link rel="stylesheet" href="src/style.css">','<style>'+css+'</style>')
portable=re.sub(r'<script src="src/[^"]+"></script>','',portable)
portable=portable.replace('src="vendor/','src="../vendor/').replace('href="vendor/','href="../vendor/')
portable=portable.replace('</footer>','<button id="portable-licenses" class="small">ライセンス</button></footer>')
# Encode visible HTML as numeric references. Saving as ANSI does not damage JS.
portable=portable.encode('ascii','xmlcharrefreplace').decode('ascii')
portable=portable.replace('</body>','<script type="application/octet-stream" id="docbench-payload">\n'+payload+'\n</script><script type="text/plain" id="third-party-licenses"></script>'+script(loader)+'</body>')
(ROOT/'portable/docbench.html').write_text(portable,encoding='ascii',newline='\n')
raw=portable.encode('ascii')
manifest={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'runtimeFiles':['docbench.html',*["../vendor/"+p for p in libs],'../vendor/jsuites.css','../vendor/jspreadsheet.css'],'vendorLibraries':libs,'payloadEncoding':'gzip+base64','sourceEncoding':'ASCII','programSha256':hashlib.sha256(program.encode('utf-8')).hexdigest()}
(ROOT/'portable/build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Portable HTML + local vendor libraries, {len(raw):,} ASCII bytes; minified program in gzip + Base64, licenses included.')
