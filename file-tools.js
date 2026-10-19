/* Rattibha Learn file tools. All document parsing stays in the browser.
   Text-and-layout previews are deliberately not represented as pixel-perfect Office rendering. */
(() => {
  'use strict';
  const parser = new DOMParser();
  const enc = new TextEncoder();
  const escape = text => String(text??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const xml = value => parser.parseFromString(value, 'application/xml');
  const filename = name => String(name||'file').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} ._-]/gu,'').slice(0,70) || 'file';
  const safe = html => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rattibha Learn</title><style>body{font:16px/1.6 system-ui,Arial,sans-serif;color:#1b222b;background:white;margin:30px auto;max-width:920px;padding:0 25px}p{margin:.5em 0 1em}h2{margin-top:2em}table{border-collapse:collapse;width:100%;margin:14px 0}td{border:1px solid #ddd;padding:7px}img{max-width:100%}.rl-slide{position:relative;width:100%;aspect-ratio:16/9;border:1px solid #ddd;page-break-after:always;break-after:page;overflow:hidden;margin:0 0 20px}.rl-slide-text{position:absolute;white-space:pre-wrap;overflow-wrap:anywhere}.rl-slide img{position:absolute;object-fit:contain}@page{size:A4;margin:15mm}@media print{body{max-width:none;margin:0;padding:0}.rl-slide{border:0;page-break-after:always;width:100%}}</style></head><body>${html}</body></html>`;
  const megabytes = bytes => `${Math.ceil(bytes / 1024 / 1024)} MB`;
  const getZip = async input => {
    if(!globalThis.JSZip)throw new Error('Office reader could not start. Reload the extension.');
    // Office packages are compressed: a large media file does not necessarily mean a large slide deck.
    // Check archive metadata before inflating any entry, then decode only the slides/images we use.
    if(input.size && input.size>180*1024*1024)throw new Error(`This file is ${megabytes(input.size)}. Local conversion supports files up to 180 MB; please reduce embedded videos first.`);
    const zip=await globalThis.JSZip.loadAsync(input);
    const entries=Object.values(zip.files);
    const uncompressed=entries.reduce((sum,item)=>sum+(Number(item._data?.uncompressedSize)||0),0);
    if(entries.length>10000 || uncompressed>750*1024*1024)
      throw new Error('This Office file expands beyond safe browser limits. Remove embedded videos or compress the media first.');
    return zip;
  };
  const readXml = async (zip, path) => zip.file(path) ? xml(await zip.file(path).async('string')) : null;
  const allLocal=(root, name) => [...(root?.getElementsByTagName('*')||[])].filter(n=>n.localName===name);
  const textNodes=(root, name) => allLocal(root,name).map(n=>n.textContent||'');
  function officeDoc(xmlDoc) {
    const body=allLocal(xmlDoc,'body')[0]||xmlDoc.documentElement;
    const blocks=[];const plaintext=[];
    const parseBlock=node=>{
      if(node.localName==='p') {
        const text=textNodes(node,'t').join('');
        if(!text.trim())return;
        const style=allLocal(node,'pStyle')[0]?.getAttribute('w:val')||'';
        const heading=/heading|title/i.test(style);
        plaintext.push(text);blocks.push(`<${heading?'h2':'p'} dir="auto">${escape(text)}</${heading?'h2':'p'}>`);
      } else if(node.localName==='tbl') {
        const lines=[];
        const cells=allLocal(node,'tr').map(row=>allLocal(row,'tc').map(c=>textNodes(c,'t').join('')));
        cells.forEach(row=>{lines.push(row.join(' \t '));});plaintext.push(lines.join('\n'));
        blocks.push(`<table>${cells.map(row=>`<tr>${row.map(c=>`<td dir="auto">${escape(c)}</td>`).join('')}</tr>`).join('')}</table>`);
      }
    };
    [...body.children].forEach(parseBlock);
    return {kind:'docx',html:blocks.join('')||'<p>No editable text found.</p>',text:plaintext.join('\n\n')};
  }
  async function docx(input) {
    const zip=await getZip(input);
    if(!zip.file('word/document.xml'))throw new Error('This is not a readable DOCX document.');
    const result=officeDoc(await readXml(zip,'word/document.xml'));
    return {...result,title:filename(input.name)};
  }
  function orderNumber(name){return Number(name.match(/slide(\d+)\.xml$/)?.[1]||0);}
  const atPercent=(part,total) => Number.isFinite(part)&&total?Math.min(120,Math.max(-20,100*part/total)):0;
  async function pptx(input, onProgress) {
    const zip=await getZip(input);
    const names=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b)=>orderNumber(a)-orderNumber(b));
    if(!names.length)throw new Error('This is not a readable PPTX presentation.');
    if(names.length>600)throw new Error(`This presentation has ${names.length} slides. The local converter supports up to 600 slides.`);
    const presentation=await readXml(zip,'ppt/presentation.xml');
    const size=allLocal(presentation,'sldSz')[0];
    const sw=Number(size?.getAttribute('cx')||12192000),sh=Number(size?.getAttribute('cy')||6858000);
    function locationOf(element){
      const transform=allLocal(element,'xfrm')[0];
      const off=allLocal(transform,'off')[0], ext=allLocal(transform,'ext')[0];
      if(!off||!ext)return '';
      const x=atPercent(Number(off.getAttribute('x')),sw),y=atPercent(Number(off.getAttribute('y')),sh);
      const w=atPercent(Number(ext.getAttribute('cx')),sw),h=atPercent(Number(ext.getAttribute('cy')),sh);
      return `left:${x.toFixed(3)}%;top:${y.toFixed(3)}%;width:${w.toFixed(3)}%;height:${h.toFixed(3)}%;`;
    }
    const slides=[];
    const mediaCache=new Map();
    const mediaUrls=[];
    let slideIndex=0;
    for(const name of names){
      const doc=await readXml(zip,name);
      const paragraphs=allLocal(doc,'p').map(p=>textNodes(p,'t').join('')).filter(Boolean);
      const text=paragraphs.join('\n');
      const slideNumber=orderNumber(name);
      const shapeFragments=[];
      const shapes=allLocal(doc,'sp').filter(node=>allLocal(node,'txBody').length);
      shapes.forEach(shape=>{
        const value=allLocal(shape,'p').map(p=>textNodes(p,'t').join('')).filter(Boolean).join('\n');
        if(!value)return;
        const style=locationOf(shape);
        shapeFragments.push(`<div class="rl-slide-text" style="${style||'position:relative;'}">${escape(value).replaceAll('\n','<br>')}</div>`);
      });
      // Keep slide images in the offline preview, when their media is embedded.
      const rels=await readXml(zip,`ppt/slides/_rels/slide${slideNumber}.xml.rels`);
      const relationships=new Map(allLocal(rels,'Relationship').map(rel=>[rel.getAttribute('Id'),rel.getAttribute('Target')]));
      for(const picture of allLocal(doc,'pic')){
        const blip=allLocal(picture,'blip')[0];
        const relationId=blip?.getAttribute('r:embed');
        const target=relationships.get(relationId);
        if(!target)continue;
        const basename=target.split('/').pop();
        const mediaPath='ppt/media/'+basename;
        const media=zip.file(mediaPath);if(!media||media._data?.uncompressedSize>24*1024*1024)continue;
        const type=/\.png$/i.test(basename)?'image/png':/\.jpe?g$/i.test(basename)?'image/jpeg':/\.gif$/i.test(basename)?'image/gif':null;
        if(!type)continue;
        let url=mediaCache.get(mediaPath);
        if(!url){
          const bytes=await media.async('uint8array');
          url=URL.createObjectURL(new Blob([bytes],{type}));
          mediaCache.set(mediaPath,url);mediaUrls.push(url);
        }
        shapeFragments.push(`<img alt="" src="${url}" style="${locationOf(picture)}"/>`);
      }
      const rendered=shapeFragments.length?shapeFragments.join(''):`<div style="white-space:pre-wrap;margin:7%">${escape(text)}</div>`;
      slides.push({number:slideNumber,text,paragraphs,html:`<section class="rl-slide">${rendered}</section>`});
      slideIndex++;
      if(slideIndex%4===0){
        onProgress?.({phase:'reading',done:slideIndex,total:names.length});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    onProgress?.({phase:'reading',done:names.length,total:names.length});
    return {kind:'pptx',title:filename(input.name),slides,mediaUrls,text:slides.map(slide=>`Slide ${slide.number}\n${slide.text}`).join('\n\n'),html:slides.map(s=>s.html).join('')};
  }
  async function makeDocx(name, content) {
    const zip=new JSZip();
    const lines=String(content).slice(0,1000000).split(/\r?\n/);
    const wordXml=`<?xml version="1.0" encoding="utf-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(line=>`<w:p><w:r><w:t xml:space="preserve">${escape(line)}</w:t></w:r></w:p>`).join('')}<w:sectPr/></w:body></w:document>`;
    zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml',wordXml);
    return zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  function blobDownload(blob,name) {
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.documentElement.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  const options = ext => ext==='docx'||ext==='pptx' ? [
    {value:'txt',label:'Plain text (.txt)'},{value:'html',label:'Web page (.html)'},...(ext==='pptx'?[{value:'docx',label:'Word notes (.docx · text only)'}]:[]),{value:'pdf',label:'PDF document (.pdf)'}
  ] : ext==='txt'||ext==='md' ? [{value:'docx',label:'Word document (.docx)'},{value:'html',label:'Web page (.html)'},{value:'pdf',label:'PDF document (.pdf)'}] : [];
  const read = async (file, options = {}) => {
    const ext=file.name.toLowerCase().split('.').pop();
    if(ext==='docx')return docx(file);
    if(ext==='pptx')return pptx(file,options.onProgress);
    if(ext==='txt'||ext==='md'){
      if(file.size>10*1024*1024)throw new Error('File is too large.');
      const text=await file.text();return {kind:ext,title:filename(file.name),text,html:`<article style="white-space:pre-wrap" dir="auto">${escape(text)}</article>`};
    }
    if(ext==='pdf')return {kind:'pdf',title:filename(file.name),html:'',text:''};
    throw new Error('Supported inputs: DOCX, PPTX, TXT and Markdown.');
  };
  const release = result => { for(const url of result?.mediaUrls||[]) URL.revokeObjectURL(url); };
  const offlineHtml = async result => {
    let html=result.html;
    for(const src of result.mediaUrls||[]){
      const data=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(new Error('Could not include a slide image in HTML.'));
        fetch(src).then(r=>r.blob()).then(blob=>reader.readAsDataURL(blob)).catch(reject);
      });
      html=html.replaceAll(src,data);
    }
    return safe(html);
  };
  const convert = async (documentResult,format,options={})=>{
    const title=documentResult.title||'Converted file';
    if(format==='pdf'){if(!globalThis.RLPdfGenerator)throw new Error('PDF exporter could not start. Reload the extension.');const pdf=await RLPdfGenerator.exportPdf(documentResult,options.onProgress);blobDownload(pdf,title+'.pdf');return {downloaded:true};}
    if(format==='txt'){blobDownload(new Blob([documentResult.text],{type:'text/plain;charset=utf-8'}),title+'.txt');return {downloaded:true};}
    if(format==='html'){blobDownload(new Blob([await offlineHtml(documentResult)],{type:'text/html;charset=utf-8'}),title+'.html');return {downloaded:true};}
    if(format==='docx'){blobDownload(await makeDocx(title,documentResult.text),title+'.docx');return {downloaded:true};}
    throw new Error('This conversion is not available locally.');
  };
  globalThis.RLFileTools={read,convert,options,safe,filename,escape,blobDownload,release};
})();
