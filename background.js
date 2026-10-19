/* Start a browser download without opening the original Moodle file page. */
chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
  if(message?.type!=='RATTIBHA_DOWNLOAD')return false;
  (async()=>{
    try {
      if(new URL(sender.url||'').hostname!=='elearn.just.edu.jo')throw new Error('Unavailable outside eLearning');
      const url=new URL(message.url);
      if(url.protocol!=='https:' && !(url.protocol==='http:' && url.hostname==='elearn.just.edu.jo'))throw new Error('Unsafe download URL');
      const filename=String(message.filename||'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().slice(0,180);
      const props={url:url.href,saveAs:false,conflictAction:'uniquify'};
      if(filename)props.filename=filename;
      const id=await chrome.downloads.download(props);
      if(typeof id!=='number')throw new Error('Download was not started');
      sendResponse({ok:true,id});
    } catch(error){sendResponse({ok:false,error:error.message||'Download failed'});}
  })();
  return true;
});
