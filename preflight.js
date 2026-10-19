/* Render a lightweight courses-shaped placeholder before content.js loads.
   A timeout always restores the original JUST website if startup fails. */
(()=>{'use strict';
  if(!/^\/current\/(?:my\/courses\.php|course\/view\.php)$/.test(location.pathname))return;
  const root=document.documentElement;root.classList.add('rattibha-boot');
  const style=document.createElement('style');
  style.textContent=`html.rattibha-boot:not(.rattibha-native)>body{visibility:hidden!important}
  html.rattibha-boot:before{content:'Rattibha Learn';font:600 14px system-ui,-apple-system,sans-serif;position:fixed;z-index:2147483645;inset:0;color:#3a4642;background:#f6f6f3;padding:36px max(22px,calc((100vw - 990px)/2));box-sizing:border-box}
  html.rattibha-boot:after{content:'';position:fixed;z-index:2147483646;pointer-events:none;top:126px;left:max(22px,calc((100vw - 990px)/2));width:min(720px,calc(100vw - 44px));height:395px;border-radius:12px;background:repeating-linear-gradient(to bottom,#e9ebea 0,#e9ebea 40px,#f8f8f6 40px,#f8f8f6 66px);opacity:.65}
  @media(prefers-color-scheme:dark){html.rattibha-boot:before{background:#191b1e;color:#c6cac8}html.rattibha-boot:after{opacity:.24}}
  @media(max-width:700px){html.rattibha-boot:after{top:110px}}
  `;
  root.appendChild(style);
  setTimeout(()=>root.classList.remove('rattibha-boot'),12000);
})();
