/* Local PowerPoint 97–2003 reader. Extracts live slides and text without uploading a file.
   Shapes, pictures, charts and legacy animations are not reconstructed. */
(() => {
  'use strict';
  const MAX_SIZE=120*1024*1024, decoder=new TextDecoder('utf-16le');
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function fail(message){throw new Error('Legacy PPT: '+message);}
  const u16=(d,p)=>d.getUint16(p,true),u32=(d,p)=>d.getUint32(p,true);
  function compoundFile(bytes){
    if(bytes.length<1536||![0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i)=>bytes[i]===v))fail('Not a valid PowerPoint 97–2003 file.');
    const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),major=u16(d,26),shift=u16(d,30),miniShift=u16(d,32);
    if(![3,4].includes(major)||shift!==(major===3?9:12)||miniShift!==6)fail('Unsupported compound-file format.');
    const sectorSize=1<<shift,miniSize=1<<miniShift,available=Math.floor(bytes.length/sectorSize)-1;
    const loc=id=>{if(id>=available)fail('Damaged compound-file sector index.');return (id+1)*sectorSize;};
    const fatCount=u32(d,44),dirStart=u32(d,48),cutoff=u32(d,56),miniStart=u32(d,60),miniCount=u32(d,64),difatStart=u32(d,68),difatCount=u32(d,72);
    if(!fatCount||fatCount>available||cutoff!==4096)fail('Damaged compound-file header.');
    const fatIds=[];
    for(let i=0;i<109;i++){const id=u32(d,76+4*i);if(id<0xfffffffa)fatIds.push(id);}
    let next=difatStart;
    for(let k=0;k<difatCount&&k<available;k++){
      if(next>=0xfffffffa)break;
      const pos=loc(next);
      for(let j=0;j<sectorSize/4-1;j++){const id=u32(d,pos+j*4);if(id<0xfffffffa)fatIds.push(id);}
      next=u32(d,pos+sectorSize-4);
    }
    if(fatIds.length<fatCount)fail('Missing allocation table.');
    const fat=[];
    for(const id of fatIds.slice(0,fatCount)){const pos=loc(id);for(let j=0;j<sectorSize;j+=4)fat.push(u32(d,pos+j));}
    function follow(start,table,max){
      const ids=[],seen=new Set();let sid=start;
      while(sid<0xfffffffa){
        if(sid>=table.length||seen.has(sid)||ids.length>=max)fail('Damaged or circular sector chain.');
        seen.add(sid);ids.push(sid);sid=table[sid];
      }
      return ids;
    }
    function regular(start,size){
      if(size===0)return new Uint8Array();
      const ids=follow(start,fat,size===null?available+1:Math.min(available+1,Math.ceil(size/sectorSize)+1));
      if(size===null)size=ids.length*sectorSize;
      if(ids.length*sectorSize<size)fail('Truncated file stream.');
      const out=new Uint8Array(size);
      for(let i=0;i<ids.length&&i*sectorSize<size;i++)out.set(bytes.subarray(loc(ids[i]),loc(ids[i])+Math.min(sectorSize,size-i*sectorSize)),i*sectorSize);
      return out;
    }
    const dir=regular(dirStart,null),view=new DataView(dir.buffer),entries=[];
    for(let p=0;p+128<=dir.length;p+=128){
      const len=Math.min(64,u16(view,p+64)),type=dir[p+66];
      if(![2,5].includes(type)||len<2)continue;
      const name=decoder.decode(dir.subarray(p,p+len-2));
      const size=u32(view,p+120)+(major===4?u32(view,p+124)*0x100000000:0);
      if(!Number.isSafeInteger(size)||size>MAX_SIZE)fail('Oversized embedded file stream.');
      entries.push({name,type,start:u32(view,p+116),size});
    }
    const root=entries.find(e=>e.type===5);
    if(!root)fail('Missing root storage.');
    const miniFat=[];
    if(miniCount&&miniStart<0xfffffffa){
      const mb=regular(miniStart,miniCount*sectorSize),md=new DataView(mb.buffer);
      for(let p=0;p<mb.length;p+=4)miniFat.push(u32(md,p));
    }
    let miniStream;
    function stream(name){
      const e=entries.find(x=>x.name.toLowerCase()===name.toLowerCase());
      if(!e)return null;
      if(!e.size)return new Uint8Array();
      if(e.size>=cutoff)return regular(e.start,e.size);
      if(!miniStream)miniStream=regular(root.start,root.size);
      const ids=follow(e.start,miniFat,Math.ceil(e.size/miniSize)+1);
      if(ids.length*miniSize<e.size)fail('Truncated mini-stream.');
      const out=new Uint8Array(e.size);
      for(let i=0;i<ids.length&&i*miniSize<e.size;i++){
        const off=ids[i]*miniSize;
        if(off+miniSize>miniStream.length)fail('Invalid mini-stream offset.');
        out.set(miniStream.subarray(off,off+Math.min(miniSize,e.size-i*miniSize)),i*miniSize);
      }
      return out;
    }
    return {stream};
  }
  function at(d,off,limit=d.byteLength){
    if(off<0||off+8>limit)return null;
    const header=u16(d,off),len=u32(d,off+4),end=off+8+len;
    if(end>limit||end<=off)return null;
    return {off,start:off+8,end,len,type:u16(d,off+2),ver:header&15,instance:header>>>4};
  }
  function records(d,start,end,max=150000){
    const rows=[];
    for(let p=start;p+8<=end&&rows.length<max;){
      const r=at(d,p,end);if(!r)break;
      rows.push(r);p=r.end;
    }
    return rows;
  }
  function collect(d,r,types,result=[],depth=0){
    if(depth>30||result.length>5000)return result;
    if(types.includes(r.type))result.push(r);
    if(r.ver===15)for(const child of records(d,r.start,r.end))collect(d,child,types,result,depth+1);
    return result;
  }
  function textAtom(bytes,r){
    if(r.len>4*1024*1024)return '';
    const b=bytes.subarray(r.start,r.end);
    const value=r.type===4000?decoder.decode(b.subarray(0,b.length-(b.length%2))):Array.from(b,n=>String.fromCharCode(n)).join('');
    return value.replace(/\r/g,'\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim();
  }
  function unique(values){
    const out=[];
    for(const raw of values){const s=String(raw||'').replace(/\r/g,'\n').trim();if(s&&!out.includes(s))out.push(s);}
    return out;
  }
  function slideList(bytes,user){
    const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),top=records(d,0,d.byteLength,120000);
    const ud=user?.length>=20?new DataView(user.buffer,user.byteOffset,user.byteLength):null;
    let edit=ud?u32(ud,16):0,docId=0;
    const persist=new Map(),seen=new Set();
    while(edit&&edit<bytes.length&&!seen.has(edit)){
      seen.add(edit);
      const r=at(d,edit);if(!r||r.type!==4085||r.len<20)break;
      const previous=u32(d,r.start+8),pointer=u32(d,r.start+12);
      if(!docId)docId=u32(d,r.start+16);
      const dir=at(d,pointer);
      if(dir?.type===6002){
        for(let p=dir.start;p+4<=dir.end;){
          const entry=u32(d,p);p+=4;
          const id=entry&0xfffff,count=entry>>>20;
          if(count>20000||count*4>dir.end-p)break;
          for(let i=0;i<count;i++){const off=u32(d,p);p+=4;if(!persist.has(id+i))persist.set(id+i,off);}
        }
      }
      if(!previous||previous>=edit)break;
      edit=previous;
    }
    let doc=docId?at(d,persist.get(docId)??-1):null;
    if(!doc||doc.type!==1000)doc=top.find(r=>r.type===1000);
    const outline=[];
    if(doc){
      const list=records(d,doc.start,doc.end).find(r=>r.type===4080&&r.instance===0);
      if(list){
        let current=null;
        for(const r of records(d,list.start,list.end)){
          if(r.type===1011){if(current)outline.push(current);current={persist:u32(d,r.start),texts:[]};}
          else if(current&&(r.type===4000||r.type===4008))current.texts.push(textAtom(bytes,r));
        }
        if(current)outline.push(current);
      }
    }
    if(outline.length>600)fail('Slide limit exceeded (600).');
    const content=r=>r?.type===1006?unique(collect(d,r,[4000,4008]).map(x=>textAtom(bytes,x))):[];
    let slides;
    if(outline.length)slides=outline.map((s,i)=>{
      const raw=content(at(d,persist.get(s.persist)??-1)),head=unique(s.texts);
      return {number:i+1,lines:unique([...head,...raw.filter(t=>!head.some(o=>o===t||o.includes(t)))])};
    });
    else{
      const live=[...persist.values()].map(off=>at(d,off)).filter(r=>r?.type===1006);
      slides=(live.length?live:top.filter(r=>r.type===1006)).slice(0,600).map((r,i)=>({number:i+1,lines:content(r)}));
    }
    if(!slides.length)fail('No PowerPoint slides were found.');
    if(!slides.some(s=>s.lines.length))fail('No readable slide text was found; scanned/image-only decks need a full Office renderer.');
    return slides;
  }
  async function read(file,onProgress){
    if(file.size>MAX_SIZE)fail('Files above 120 MB are not supported.');
    const bytes=new Uint8Array(await file.arrayBuffer()),cfb=compoundFile(bytes);
    const doc=cfb.stream('PowerPoint Document');
    if(!doc?.length)fail('Missing PowerPoint Document stream.');
    const slides=slideList(doc,cfb.stream('Current User')),rendered=[];
    for(let i=0;i<slides.length;i++){
      const s=slides[i],title=s.lines[0]||'',body=s.lines.slice(1).join('\n\n');
      const html='<section class="rl-slide"><div class="rl-slide-text" style="left:7%;top:10%;width:86%;height:19%">'+esc(title)+'</div><div class="rl-slide-text" style="left:9%;top:32%;width:82%;height:63%">'+esc(body)+'</div></section>';
      rendered.push({number:s.number,text:s.lines.join('\n\n'),paragraphs:s.lines,html});
      if(i%12===0){onProgress?.({phase:'reading',done:i+1,total:slides.length});await new Promise(resolve=>setTimeout(resolve,0));}
    }
    onProgress?.({phase:'reading',done:slides.length,total:slides.length});
    return {kind:'ppt',title:String(file.name||'presentation').replace(/\.ppt$/i,''),slides:rendered,
      text:rendered.map(s=>'Slide '+s.number+'\n'+s.text).join('\n\n'),html:rendered.map(s=>s.html).join(''),
      note:'Legacy PPT export preserves readable slide text, not original graphics, layouts or animations.'};
  }
  globalThis.RLLegacyPpt={read};
})();
