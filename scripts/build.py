#!/usr/bin/env python3
"""Build a one-file offline application (no build dependencies)."""
import hashlib, json, re
from pathlib import Path
import rjsmin
ROOT=Path(__file__).resolve().parent.parent
libs=['jszip.min.js','pako.min.js','docx.js','pptxgen.min.js']
source=(ROOT/'index.html').read_text()
css=(ROOT/'src/style.css').read_text()
css=re.sub(r'\s+',' ',css).strip()
app=rjsmin.jsmin('\n;\n'.join((ROOT/'src'/p).read_text() for p in ['core.js','render.js','app.js']))
# PptxGenJS is already minified and uses nested templates unsupported by rJSmin.
# Preserve pre-minified upstream bundles; minify only the unminified docx IIFE.
vendor='\n;\n'.join(rjsmin.jsmin((ROOT/'vendor'/p).read_text(),keep_bang_comments=True) if p=='docx.js' else (ROOT/'vendor'/p).read_text() for p in libs)
licenses='\n\n'.join(p.name+'\n'+p.read_text() for p in sorted((ROOT/'vendor').glob('*LICENSE*')))
portable=source.replace('<link rel="stylesheet" href="src/style.css">','<style>'+css+'</style>')
portable=re.sub(r'<script src="[^"]+"></script>','',portable)
portable=portable.replace('href="docs/specification.md"','href="https://github.com/Zero-error-no-warning/docbench/blob/main/docs/specification.md"')
portable=portable.replace('</body>','<script>/* Third-party license texts are included below. */\n'+vendor.replace('</script','<\\/script')+'\n;'+app.replace('</script','<\\/script')+'</script><script type="text/plain" id="third-party-licenses">'+licenses.replace('</script','<\\/script')+'</script></body>')
portable=re.sub(r'\n\s*(?=<|$)','',portable)
(ROOT/'portable/docbench.html').write_text(portable)
(ROOT/'portable/build-manifest.json').write_text(json.dumps({'sha256':hashlib.sha256(portable.encode()).hexdigest(),'bytes':len(portable.encode()),'runtimeFiles':['docbench.html'],'vendorLibraries':libs},indent=2)+'\n')
print(f'Portable: 1 runtime file, {len(portable.encode()):,} bytes; embedded minified JS and licenses.')
