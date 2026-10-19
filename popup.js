(() => {
  const light={blue:'#2b67bc',indigo:'#5a60b8',violet:'#8356a5',teal:'#24736c',rose:'#ae5472',amber:'#986523',ocean:'#327da4',graphite:'#59636e'};
  const dark={blue:'#8bb5f4',indigo:'#abaef7',violet:'#c8a1eb',teal:'#6ec1b5',rose:'#e7a0ba',amber:'#e6c18b',ocean:'#8cceef',graphite:'#bec9d1'};
  chrome.storage.local.get('rattibha-learn-v1').then(result=>{
    const settings=result?.['rattibha-learn-v1']||{};
    const mode=settings.theme==='dark'?'dark':'light';
    if(mode==='dark')document.body.classList.add('dark');
    const color=(mode==='dark'?dark:light)[settings.accent]||light.teal;
    document.documentElement.style.setProperty('--accent',color);
  }).catch(()=>{});
})();
