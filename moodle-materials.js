/* Moodle material and folder adapter. Keeps resource traversal separate from the UI.
 * Only inspect file links inside Moodle content areas; do not touch forms or scripts. */
(() => {
  'use strict';
  const types={
    assign:'Assignment',quiz:'Quiz',forum:'Forum',resource:'File',folder:'Folder',
    page:'Page',book:'Book',url:'Link',imscp:'IMS',scorm:'SCORM',
    h5pactivity:'H5P',hvp:'H5P',lesson:'Lesson',lti:'External',
    glossary:'Glossary',data:'Database',wiki:'Wiki',workshop:'Workshop',
    choice:'Choice',feedback:'Feedback',survey:'Survey',chat:'Chat',
    bigbluebuttonbn:'Conference',attendance:'Attendance',scheduler:'Scheduler'
  };
  const native=new Set(['Assignment','Quiz','Link','Book','IMS','SCORM','H5P',
    'Lesson','External','Glossary','Database','Wiki','Workshop','Choice','Feedback',
    'Survey','Chat','Conference','Attendance','Scheduler','Resource']);
  const fileExtension=/\.(?:pdf|docx?|pptx?|xlsx?|xlsm|ods|odt|odp|rtf|txt|md|zip|rar|7z|tar|gz|csv|epub|ipynb|sql|json|xml|cpp|py|java|htm|html|c|h|hpp|js|css)(?:$|[?#])/i;
  const imageExtension=/\.(?:png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i;
  const audioExtension=/\.(?:mp3|wav|ogg|m4a|aac|flac)(?:$|[?#])/i;
  const videoExtension=/\.(?:mp4|webm|m4v|mov|ogv)(?:$|[?#])/i;
  function pathnameOf(url) {
    try {return decodeURIComponent(new URL(url,location.href).pathname);}catch{return '';}
  }
  function classify(url,title){
    const path=pathnameOf(url).toLowerCase();
    const mod=path.match(/\/mod\/([a-z0-9_]+)\/(?:view|index)\.php/);
    if(mod)return types[mod[1]]||'Resource';
    const name=String(title||'').toLowerCase();
    if(fileExtension.test(path)||fileExtension.test(name))return 'File';
    if(imageExtension.test(path)||imageExtension.test(name))return 'Image';
    if(audioExtension.test(path)||audioExtension.test(name)||videoExtension.test(path)||videoExtension.test(name))return 'Media';
    if(/^https?:\/\//i.test(url||''))return 'Link';
    return 'Resource';
  }
  function mediaKind(url,mime=''){
    const p=pathnameOf(url);
    if(/^image\//i.test(mime)||imageExtension.test(p))return 'image';
    if(/^audio\//i.test(mime)||audioExtension.test(p))return 'audio';
    if(/^video\//i.test(mime)||videoExtension.test(p))return 'video';
    return '';
  }
  // PDFs are previewed; do not let the generic-file branch download them prematurely.
  const downloadable=url=>{const path=pathnameOf(url);return fileExtension.test(path)&&!/\.pdf$/i.test(path);};
  const valid=(url,base)=>{
    try{
      const u=new URL(url,base||location.href);
      return (u.protocol==='https:'||(u.protocol==='http:'&&u.hostname===location.hostname))?u.href:'';
    }catch{return '';}
  };
  function cleanText(node){return (node?.textContent||'').replace(/\s+/g,' ').trim();}
  function folderData(documentNode,baseUrl){
    const main=documentNode.querySelector('#region-main,[role="main"],main')||documentNode.body;
    if(!main)return {files:[],folderZip:''};
    const selector='.foldertree,.folder-container,.foldercontent,.filemanager,.files-tree,[data-region="folderfiles"]';
    const roots=[...main.querySelectorAll(selector)].filter(el=>!el.parentElement?.closest(selector));
    const areas=roots.length?roots:[main];
    const files=[],seen=new Set();
    for(const root of areas){
      for(const a of root.querySelectorAll('a[href]')){
        if(a.closest('nav,header,footer,.breadcrumb,.drawer,[data-region="drawer"],.action-menu'))continue;
        const href=valid(a.getAttribute('href'),baseUrl);
        if(!href||seen.has(href))continue;
        const uri=new URL(href),path=decodeURIComponent(uri.pathname);
        const inTree=Boolean(a.closest(selector));
        const isFolderFile=/\/mod_folder\/content\//i.test(path);
        const isAttachment=/\/pluginfile\.php\//i.test(path)||fileExtension.test(path)||imageExtension.test(path)||audioExtension.test(path)||videoExtension.test(path);
        if(!isFolderFile&&!isAttachment)continue;
        if(!inTree&&!isFolderFile&&roots.length)continue;
        if(/\/mod\/folder\/view\.php/i.test(path))continue;
        const filename=decodeURIComponent(uri.pathname.split('/').pop()||'');
        let name=cleanText(a.querySelector('.fp-filename')||a);
        if(!name||/^(?:download|view|file)$/i.test(name))name=filename||'File';
        let folder='';
        const storagePath=path.match(/\/mod_folder\/content\/(?:\d+\/)?(.+)$/i);
        if(storagePath){
          const parts=storagePath[1].split('/').filter(Boolean);
          if(parts.length>1)folder=parts.slice(0,-1).join(' / ');
        }
        if(!folder){
          let parent=a.parentElement,parts=[];
          while(parent&&parent!==root&&parent!==main){
            if(parent.matches('li.folder,.folder')){
              const label=parent.querySelector(':scope > .foldername,:scope > .fp-filename,:scope > div > .foldername');
              if(label)parts.unshift(cleanText(label));
            }
            parent=parent.parentElement;
          }
          folder=parts.filter(Boolean).join(' / ');
        }
        seen.add(href);
        files.push({href,name,folder});
      }
    }
    const download=[...main.querySelectorAll('a[href]')].find(a=>{
      const href=valid(a.getAttribute('href'),baseUrl);if(!href)return false;
      const u=new URL(href);
      return u.origin===new URL(baseUrl||location.href).origin&&/\/mod\/folder\/view\.php/i.test(u.pathname)&&
        ['1','true'].includes(u.searchParams.get('download'));
    });
    return {files,folderZip:download?valid(download.getAttribute('href'),baseUrl):''};
  }
  globalThis.RLMoodleMaterials={classify,mediaKind,downloadable,folderData,isNative:type=>native.has(type)};
})();
