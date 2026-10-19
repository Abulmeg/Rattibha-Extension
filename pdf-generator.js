/* Rattibha Learn – browser-only PDF export.
 * Converts the extension's own structured document previews into PDF pages.
 * No print dialog, external service, remote code, or file upload.
 * Pages are rasterized to retain Unicode/Arabic support with browser fonts.
 */
(() => {
  'use strict';
  const MAX_PAGES = 600;
  const CANVAS_MAX = 1700 * 2400;
  const encoder = new TextEncoder();
  const pdfString = value => String(value || '').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, c => '\\' + c);
  const num = n => (+n).toFixed(3).replace(/\.0+$/, '');
  const raf = () => new Promise(resolve => setTimeout(resolve, 0));

  function createPage(w, h) {
    if(w * h > CANVAS_MAX) throw new Error('The PDF page is too large.');
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) throw new Error('PDF export is not supported by this browser.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'top';
    return {canvas, ctx};
  }
  function font(ctx, px = 23, bold = false) {
    ctx.font = `${bold ? 700 : 400} ${px}px Arial, 'Noto Sans', sans-serif`;
  }
  function bidi(text) {
    return /[\u0590-\u08ff]/.test(text || '') ? 'rtl' : 'ltr';
  }
  function words(text, ctx, maxWidth) {
    const out = [];
    const lines = String(text || '').replace(/\r\n?/g,'\n').split('\n');
    for (const raw of lines) {
      if (!raw.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of raw.trim().split(/\s+/)) {
        const attempt = line ? line + ' ' + word : word;
        if(ctx.measureText(attempt).width <= maxWidth){line = attempt;continue;}
        if(line){out.push(line);line='';}
        if(ctx.measureText(word).width <= maxWidth){line=word;continue;}
        let part='';
        for(const ch of Array.from(word)){
          if(part && ctx.measureText(part+ch).width > maxWidth){out.push(part);part=ch;}
          else part+=ch;
        }
        line=part;
      }
      if(line)out.push(line);
    }
    return out.length ? out : [''];
  }
  function paintText(ctx, text, x, y, width, px, lineGap, color, weight, maxLines) {
    font(ctx,px,weight);
    const rows=words(text,ctx,width);
    const limit=maxLines == null ? rows.length : Math.min(rows.length,maxLines);
    ctx.fillStyle=color;
    for(let i=0;i<limit;i++){
      const line=rows[i]; const rtl=bidi(line)==='rtl';
      ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';
      ctx.fillText(line,rtl?x+width:x,y+(i*lineGap));
    }
    ctx.direction='ltr';ctx.textAlign='left';
    return limit*lineGap;
  }
  function domBlocks(html, fallback) {
    const dom = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
    const body=dom.body;
    const blocks=[];
    const add=node=>{
      if(node.nodeType!==1)return;
      const tag=node.localName;
      if(['h1','h2','h3','h4'].includes(tag)){
        blocks.push({type:'heading',level:Number(tag.slice(1)),text:node.textContent||''});
      } else if(tag==='p'){
        blocks.push({type:'para',text:node.textContent||''});
      } else if(tag==='table'){
        blocks.push({type:'table',rows:[...node.querySelectorAll('tr')].map(tr=>[...tr.children].map(c=>c.textContent||''))});
      } else if(tag==='article'||tag==='section'||tag==='div'||tag==='body'){
        if(node.children.length){[...node.children].forEach(add);} else if(node.textContent.trim())blocks.push({type:'para',text:node.textContent});
      } else if(tag==='ul'||tag==='ol'){
        [...node.children].forEach((n,i)=>blocks.push({type:'para',text:(tag==='ol'?`${i+1}. `:'• ')+(n.textContent||'')}));
      }
    };
    [...body.children].forEach(add);
    if(!blocks.length && fallback)blocks.push({type:'para',text:fallback});
    return blocks;
  }
  async function renderDocument(result) {
    const W=1240,H=1754,M=115,BOTTOM=H-125,WIDTH=W-2*M;
    const title=String(result.title || 'Document');
    const pages=[];
    let {canvas,ctx}=createPage(W,H),y=135;
    function pageHeader(){
      ctx.fillStyle='#687487'; font(ctx,18,true);ctx.fillText(title.slice(0,72),M,67);
      ctx.fillStyle='#e2e5e9';ctx.fillRect(M,104,WIDTH,2);
    }
    function finish(){
      const pageNum=pages.length+1;
      ctx.fillStyle='#a2a9b3';font(ctx,16,false);ctx.fillText(String(pageNum),W-M-17,H-72);
      pages.push(canvas);
      if(pages.length>=MAX_PAGES)throw new Error('This document exceeds the 600-page browser limit.');
      ({canvas,ctx}=createPage(W,H));y=135;pageHeader();
    }
    pageHeader();
    const ensure=height=>{if(y+height>BOTTOM)finish();};
    const blocks=domBlocks(result.html,result.text);
    let processed=0;
    for(const block of blocks){
      if(block.type==='heading'){
        const px=block.level===1?38:34, gap=px*1.4;
        font(ctx,px,true);const rows=words(block.text,ctx,WIDTH);
        ensure(Math.min(rows.length,2)*gap+26);
        for(const line of rows){ensure(gap);y+=paintText(ctx,line,M,y,WIDTH,px,gap,'#152235',true)+2;}
        y+=18;
      }else if(block.type==='para'){
        const px=24,gap=36;
        font(ctx,px,false);const rows=words(block.text,ctx,WIDTH);
        for(const line of rows){ensure(gap);paintText(ctx,line,M,y,WIDTH,px,gap,'#202934',false,1);y+=gap;}
        y+=17;
      }else if(block.type==='table'){
        const rows=block.rows||[];const columns=Math.max(1,...rows.map(r=>r.length));
        const cellW=WIDTH/columns,cellPad=14,px=21,gap=30;
        for(let ri=0;ri<rows.length;ri++){
          const cells=rows[ri];font(ctx,px,ri===0);
          const lines=Array.from({length:columns},(_,j)=>words(cells[j]||'',ctx,cellW-cellPad*2));
          const count=Math.max(1,...lines.map(v=>v.length));let rowHeight=count*gap+cellPad*2;
          if(rowHeight>BOTTOM-135)rowHeight=BOTTOM-135;
          ensure(rowHeight+2);
          ctx.fillStyle=ri%2===0?'#f4f6f8':'#fff';ctx.fillRect(M,y,WIDTH,rowHeight);
          ctx.strokeStyle='#d5dce4';ctx.strokeRect(M,y,WIDTH,rowHeight);
          for(let j=0;j<columns;j++){
            if(j>0){ctx.beginPath();ctx.moveTo(M+j*cellW,y);ctx.lineTo(M+j*cellW,y+rowHeight);ctx.stroke();}
            lines[j].slice(0,Math.floor((rowHeight-2*cellPad)/gap)).forEach((line,k)=>paintText(ctx,line,M+j*cellW+cellPad,y+cellPad+k*gap,cellW-2*cellPad,px,gap,'#263449',ri===0,1));
          }
          y+=rowHeight;
        }
        y+=20;
      }
      if(++processed%24===0)await raf();
    }
    ctx.fillStyle='#a2a9b3';font(ctx,16);ctx.fillText(String(pages.length+1),W-M-17,H-72);
    pages.push(canvas);
    return pages.map(canvas=>({canvas,widthPt:595.28,heightPt:841.89}));
  }
  function percent(v, total, def) {
    if(!v)return def;
    const n=parseFloat(v); return Number.isFinite(n) ? n*total/100 : def;
  }
  function textOf(element) {
    let text='';
    const visit=node=>{
      if(node.nodeType===3)text+=node.nodeValue;
      else if(node.nodeType===1){if(node.localName==='br')text+='\n';else [...node.childNodes].forEach(visit);}
    };
    visit(element);return text;
  }
  async function* renderSlides(result) {
    const slides=result.slides||[];
    const W=slides.length>150?1280:1600,H=slides.length>150?720:900;
    if(slides.length>MAX_PAGES)throw new Error(`This presentation has ${slides.length} slides. The browser converter supports up to ${MAX_PAGES}.`);
    for(const [i,slide] of slides.entries()){
      const {canvas,ctx}=createPage(W,H);
      const dom=new DOMParser().parseFromString(slide.html||'','text/html');
      const section=dom.querySelector('.rl-slide');
      if(section){
        const elements=[...section.children];
        for(const el of elements){
          const st=el.style;
          const x=percent(st.left,W,100), y=percent(st.top,H,120);
          const w=Math.max(25,Math.min(W-x-20,percent(st.width,W,W-x-100)));
          const h=percent(st.height,H,500);
          if(el.localName==='img'&&/^(data:image\/|blob:)/.test(el.getAttribute('src')||'')){
            try{
              const img=new Image();img.src=el.getAttribute('src');
              await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Image decode timed out')),5000))]);
              const width=percent(st.width,W,Math.min(w,img.naturalWidth));
              const height=percent(st.height,H,img.naturalHeight);
              ctx.drawImage(img,x,y,width,height);
            }catch{/* skip corrupt image; keep text and other slide content */}
          }else if(el.classList.contains('rl-slide-text')||el.localName==='div'){
            const value=textOf(el).trim();if(!value)continue;
            const len=value.length;const px=Math.min(54,Math.max(24, len<55?47:len>300?25:32));
            paintText(ctx,value,x,y,w,px,px*1.27,'#1a2838',len<60,Math.max(1,Math.floor(h/(px*1.27))));
          }
        }
      }else{
        paintText(ctx,slide.text||`Slide ${i+1}`,95,95,W-190,37,50,'#162136',false,12);
      }
      yield {canvas,widthPt:960,heightPt:540};
      if(i%2===0)await raf();
    }
  }
  function jpegBytes(canvas) {
    return new Promise((resolve,reject)=>{
      canvas.toBlob(async blob=>{
        try{if(!blob)throw new Error('Could not render PDF page.');resolve(new Uint8Array(await blob.arrayBuffer()));}
        catch(e){reject(e);}
      },'image/jpeg',0.91);
    });
  }
  // Add each rendered slide to the PDF immediately; do not keep hundreds of large canvases alive.
  async function assemble(pages, title, pageCount, onProgress) {
    const parts=[];let position=0;const offsets=[0];
    const append=chunk=>{const bytes=typeof chunk==='string'?encoder.encode(chunk):chunk;parts.push(bytes);position+=bytes.byteLength;};
    const begin=(id)=>{offsets[id]=position;append(`${id} 0 obj\n`);};
    const end=()=>append('\nendobj\n');
    append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const kids=Array.from({length:pageCount},(_,i)=>`${5+3*i} 0 R`).join(' ');
    begin(1);append('<< /Type /Catalog /Pages 2 0 R >>');end();
    begin(2);append(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);end();
    let i=0;
    for await(const {canvas,widthPt,heightPt} of pages){
      const imageId=3+3*i,contentId=4+3*i,pageId=5+3*i;
      const data=await jpegBytes(canvas);
      begin(imageId);append(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.byteLength} >>\nstream\n`);append(data);append('\nendstream');end();
      const script=`q ${num(widthPt)} 0 0 ${num(heightPt)} 0 0 cm /Im0 Do Q\n`;
      begin(contentId);append(`<< /Length ${encoder.encode(script).length} >>\nstream\n`);append(script);append('endstream');end();
      begin(pageId);append(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(widthPt)} ${num(heightPt)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);end();
      canvas.width=canvas.height=1;
      i++;
      onProgress?.({phase:'exporting',done:i,total:pageCount});
      if(i%3===0)await raf();
    }
    if(i!==pageCount)throw new Error('The PDF exporter did not finish every page.');
    const infoId=3+3*pageCount;
    begin(infoId);append(`<< /Title (${pdfString(title)}) /Creator (Rattibha Learn) /Producer (Rattibha Learn PDF Export) >>`);end();
    const start=position;
    append(`xref\n0 ${infoId+1}\n0000000000 65535 f \n`);
    for(let id=1;id<=infoId;id++)append(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);
    append(`trailer\n<< /Size ${infoId+1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${start}\n%%EOF\n`);
    return new Blob(parts,{type:'application/pdf'});
  }
  async function exportPdf(result, onProgress) {
    if(!result||result.kind==='pdf')throw new Error('Choose a DOCX, PPTX or text file first.');
    const slideDeck=result.kind==='pptx';
    const pages=slideDeck?renderSlides(result):await renderDocument(result);
    return assemble(pages,result.title||'Document',slideDeck?result.slides.length:pages.length,onProgress);
  }
  globalThis.RLPdfGenerator={exportPdf};
})();
