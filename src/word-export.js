/* Native OOXML properties use the same resolved formats as the editor. */
(function(root){'use strict';const D=root.DocBench;
function wordNativeFormat(design,settings,numberingConfigs){
 const L=root.docx,twip=n=>Math.round((n||0)*20),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const runOptions=st=>({font:st.font,size:st.fontSize?st.fontSize*2:undefined,color:st.color?.slice(1).toUpperCase(),bold:st.bold,italics:st.italic,underline:st.underline?{}:st.underline===false?{type:'none'}:undefined,strike:st.strike,shading:st.fill==='none'?{type:'clear',fill:'auto'}:st.fill?{fill:st.fill.slice(1)}:undefined});
 function paragraphOptions(st){const indent=D.wordIndent(st),tabs=st.tabs||[],inherited=st._styleParagraphBase?.tabs||[];return {
  alignment:st.textAlign||st.align||'left',spacing:{before:twip(st.spaceBefore),after:twip(st.spaceAfter??8),line:Math.round((st.lineHeight||1.5)*(st.lineMode==='exact'||st.lineMode==='atLeast'?20:240)),lineRule:st.lineMode==='exact'?'exact':st.lineMode==='atLeast'?'atLeast':'auto'},
  indent:{left:twip(indent.left),right:twip(indent.right),...(indent.first<0?{hanging:twip(-indent.first)}:{firstLine:twip(indent.first)})},
  tabStops:[...inherited.filter(t=>!tabs.some(v=>v.position===t.position)).map(t=>({position:twip(t.position),type:'clear'})),...tabs.map(t=>({position:twip(t.position),type:t.align,leader:{none:'none',dots:'dot',dashes:'hyphen',line:'underscore'}[t.leader||'none']}))],
  keepNext:!!st.keepNext,keepLines:!!st.keepLines,pageBreakBefore:!!st.pageBreakBefore,widowControl:st.widowControl!==false,...(st.outlineLevel!=null?{outlineLevel:st.outlineLevel}:{})
 };}
 const propertyOrder=['pStyle','keepNext','keepLines','pageBreakBefore','framePr','widowControl','numPr','pBdr','shd','tabs','suppressAutoHyphens','kinsoku','wordWrap','overflowPunct','topLinePunct','autoSpaceDE','autoSpaceDN','bidi','adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents','suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap','outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange'];
 function orderProperties(properties){properties.sort((a,b)=>{const rank=o=>{const i=propertyOrder.indexOf(Object.keys(o)[0]?.replace('w:',''));return i<0?999:i;};return rank(a)-rank(b);});}
 function patchProperties(properties,st){
  if(!properties)return;
  if(st.pageBreakBefore===false&&!properties.some(p=>p['w:pageBreakBefore']))properties.push({'w:pageBreakBefore':{_attr:{'w:val':false}}});
  if(st.indentUnit!=='chars'){orderProperties(properties);return;}
  let item=properties.find(p=>p['w:ind']);if(!item){item={'w:ind':{_attr:{}}};properties.push(item);}const a=item['w:ind']._attr||(item['w:ind']._attr={});
  a['w:leftChars']=Math.round(((st.indentLeft||0)+(st.quoteDepth||0)*18/(st.fontSize||11))*100);a['w:rightChars']=Math.round((st.indentRight||0)*100);a[st.indentFirst<0?'w:hangingChars':'w:firstLineChars']=Math.round(Math.abs(st.indentFirst||0)*100);orderProperties(properties);
 }
 class WordParagraph extends L.Paragraph{constructor(options,st){super(options);this.wordFormat=st;}prepForXml(context){const xml=super.prepForXml(context),children=xml?.['w:p'];if(children){let p=children.find(c=>c['w:pPr']);if(!p){p={'w:pPr':[]};children.unshift(p);}const st=this.wordFormat,b=st._styleParagraphBase;const patch=!b||!['indentUnit','indentLeft','indentRight','indentFirst'].every(k=>D.equal(st[k],b[k]))?st:{...st,indentUnit:'pt'};patchProperties(p['w:pPr'],{...patch,pageBreakBefore:b&&st.pageBreakBefore===b.pageBreakBefore?undefined:st.pageBreakBefore});}return xml;}}
 class WordParagraphStyle extends L.StyleForParagraph{constructor(options,st){super(options);this.wordFormat=st;}prepForXml(context){const xml=super.prepForXml(context),children=xml?.['w:style'];if(children){let props=children.find(c=>c['w:pPr']);if(!props&&(this.wordFormat.indentUnit==='chars'||this.wordFormat.pageBreakBefore===false)){props={'w:pPr':[]};const at=children.findIndex(c=>c['w:rPr']);children.splice(at<0?children.length:at,0,props);}if(props)patchProperties(props['w:pPr'],this.wordFormat);}return xml;}}
 // docx inserts default table borders even when borders are omitted. A table
 // style must retain control of those edges rather than be shadowed by them.
 class WordTable extends L.Table{constructor(options){super(options);this.inheritWordBorders=!!options.style&&!options.borders;}prepForXml(context){const xml=super.prepForXml(context),properties=xml?.['w:tbl']?.find(c=>c['w:tblPr']);if(this.inheritWordBorders&&properties)properties['w:tblPr']=properties['w:tblPr'].filter(p=>!p['w:tblBorders']);return xml;}}
 function textOptions(st){const result=runOptions(st),baseline=st._styleRunBase;if(baseline){const inherited=runOptions(baseline);for(const key of Object.keys(result))if(D.equal(result[key],inherited[key]))delete result[key];}if(st.characterStyleId)result.style=st.characterStyleId;return result;}
 function paraOptions(st){const result=paragraphOptions(st);if(st._styleParagraphBase){const inherited=paragraphOptions(st._styleParagraphBase);for(const key of Object.keys(result))if(key!=='outlineLevel'&&D.equal(result[key],inherited[key]))delete result[key];}if(st.styleId)result.style=st.styleId;return result;}
 const definitions=new Map(),schemes=D.wordNumberings(design.wordNumberings);
 function numberReference(number){const key=number.key||number.id+'|'+(number.sequence||'default');if(definitions.has(key))return definitions.get(key);const scheme=schemes.find(s=>s.id===number.id);if(!scheme)return null;const reference='word-number-'+definitions.size;
  numberingConfigs.push({reference,wordLevels:scheme.levels,levels:scheme.levels.map((l,i)=>({level:i,format:l.format,text:l.text,start:i===number.level&&number.start!=null?number.start:l.start,alignment:l.align||'left',suffix:l.suffix||'tab',style:{paragraph:{indent:{left:twip(l.indentLeft??18*(i+1)),hanging:twip(l.hanging??18)}}}}))});definitions.set(key,reference);return reference;
 }
 for(const scheme of schemes)numberReference({id:scheme.id,sequence:'default'});
 const catalog=D.wordStyles(design.wordStyles),nativeStyles=[],defaults={...D.wordParagraphDefaults,font:settings.font,fontSize:settings.fontSize,color:settings.color,lineHeight:settings.lineHeight};
 for(const style of catalog){
  const effective={...defaults,...D.resolveWordStyle(design.wordStyles,style.id,style.kind)},format=style.format||{},common={id:style.id,name:style.name,basedOn:style.basedOn,next:style.next,quickFormat:true};
  if(style.kind==='paragraph'){
   const parent={...defaults,...D.resolveWordStyle(design.wordStyles,style.basedOn,'paragraph')},paragraph=paragraphOptions({...effective,_styleParagraphBase:parent}),inherited=paragraphOptions(parent);
   for(const key of Object.keys(paragraph))if(D.equal(paragraph[key],inherited[key]))delete paragraph[key];
   const linked=schemes.flatMap(n=>n.levels.map((l,i)=>({id:n.id,level:i,heading:l.headingStyle}))).find(x=>x.heading===style.id);if(linked)paragraph.numbering={reference:numberReference({...linked,sequence:'default'}),level:linked.level};
   const patch={...effective,indentUnit:['indentUnit','indentLeft','indentRight','indentFirst'].some(k=>format[k]!=null)?effective.indentUnit:'pt',pageBreakBefore:format.pageBreakBefore};
   nativeStyles.push(new WordParagraphStyle({...common,run:runOptions(format),paragraph},patch));
  }else if(style.kind==='character')nativeStyles.push(new L.StyleForCharacter({...common,run:runOptions(format)}));
  else {
   const f=format,runXML='<w:rPr>'+(f.font?'<w:rFonts w:ascii="'+esc(f.font)+'" w:hAnsi="'+esc(f.font)+'" w:eastAsia="'+esc(f.font)+'"/>':'')+(f.fontSize?'<w:sz w:val="'+f.fontSize*2+'"/>':'')+(f.color?'<w:color w:val="'+esc(f.color.slice(1))+'"/>':'')+(f.bold!=null?'<w:b w:val="'+f.bold+'"/>':'')+(f.italic!=null?'<w:i w:val="'+f.italic+'"/>':'')+'</w:rPr>';
   const shade=fill=>fill==null?'':'<w:shd w:val="clear" w:fill="'+(fill==='none'?'auto':esc(fill.slice(1).toUpperCase()))+'"/>';
   const border=f.border!=null?'<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(side=>'<w:'+side+' w:val="'+(f.border==='none'?'nil':'single')+'" w:sz="'+Math.round((effective.borderWidth||.5)*8)+'" w:color="'+(f.border==='none'?'auto':esc(f.border.slice(1)))+'"/>').join('')+'</w:tblBorders>':'';
   const padding=f.padding??(!style.basedOn?6:null),margins=padding!=null?'<w:tblCellMar>'+['top','left','bottom','right'].map(side=>'<w:'+side+' w:w="'+Math.round(padding*15)+'" w:type="dxa"/>').join('')+'</w:tblCellMar>':'';
   nativeStyles.push(L.ImportedXmlComponent.fromXmlString('<w:style w:type="table" w:styleId="'+esc(style.id)+'"><w:name w:val="'+esc(style.name)+'"/>'+(style.basedOn?'<w:basedOn w:val="'+esc(style.basedOn)+'"/>':'')+runXML+'<w:tblPr>'+border+margins+'</w:tblPr><w:tcPr>'+shade(f.fill)+(f.valign?'<w:vAlign w:val="'+(f.valign==='middle'?'center':f.valign)+'"/>':'')+'</w:tcPr>'+(f.headerFill!=null?'<w:tblStylePr w:type="firstRow"><w:tcPr>'+shade(f.headerFill)+'</w:tcPr></w:tblStylePr>':'')+(f.alternateFill!=null?'<w:tblStylePr w:type="band1Horz"><w:tcPr>'+shade(f.alternateFill)+'</w:tcPr></w:tblStylePr>':'')+'</w:style>'));
  }
 }
 async function finish(blob){
  const zip=await root.JSZip.loadAsync(await blob.arrayBuffer());let index=-1,xml=await zip.file('word/numbering.xml').async('string');
  xml=xml.replace(/<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g,part=>{const config=numberingConfigs[index++];if(!config?.wordLevels)return part;let level=0;return part.replace(/<w:lvl\b[\s\S]*?<\/w:lvl>/g,lvl=>{const f=config.wordLevels[level++];if(!f)return lvl;return lvl.replace(/(<w:numFmt\b[^>]*\/>)/,'$1<w:lvlRestart w:val="'+(f.restartAfter==null?0:f.restartAfter+1)+'"/>'+(f.headingStyle?'<w:pStyle w:val="'+esc(f.headingStyle)+'"/>':''));});});zip.file('word/numbering.xml',xml);return new Blob([await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 }
 return {WordParagraph,WordTable,textOptions,paraOptions,numberReference,styles:{importedStyles:[new L.DocumentDefaults({run:{font:settings.font,size:settings.fontSize*2,color:settings.color.slice(1)},paragraph:paragraphOptions(defaults)}),...nativeStyles]},finish};
}
Object.assign(D,{wordNativeFormat});})(globalThis);
