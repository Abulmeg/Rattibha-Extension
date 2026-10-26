/* In-course PDF shortcuts for JUST Moodle. Files never leave the browser. */
(() => {
  'use strict';
  if (globalThis.RLInlinePdf) return;

  const office = /\.(pptx|docx|ppt)(?=$|[?#\s])/i;
  const standalone = /\b(pptx|docx|ppt)\b/i;
  const sameSite = raw => {
    try {
      const u = new URL(raw, location.href);
      return u.origin === location.origin && /^https?:$/.test(u.protocol) ? u.href : '';
    } catch { return ''; }
  };
  const friendlyError = error => {
    const message = String(error?.message || error || 'Conversion failed.');
    if (/failed to fetch|networkerror/i.test(message)) return 'Could not access the file. Open it on eLearning and try again.';
    return message;
  };
  function typeFor(url = '', label = '') {
    let pathname = '';
    try { pathname = decodeURIComponent(new URL(url, location.href).pathname); } catch {}
    const name = String(label || '');
    const match = (name.match(office) || pathname.match(office) || name.match(standalone));
    return match ? match[1].toLowerCase() : '';
  }
  function dispositionName(value = '') {
    const match = value.match(/filename\*\s*=\s*(?:UTF-8''|["']?)([^;"']+)/i)
      || value.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;\s]+)/i);
    const raw = match?.[1] || match?.[2] || '';
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  function defaultName(url, label) {
    let name = String(label || '').trim();
    try {
      const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      if (office.test(last) || /\.pdf$/i.test(last)) name = last;
    } catch {}
    return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').slice(0,150) || 'Document';
  }
  function normalizeName(candidate, mime, fallback) {
    let name = String(candidate || fallback || 'Document').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim();
    const type = /presentationml\.presentation/.test(mime) ? 'pptx'
      : /wordprocessingml\.document/.test(mime) ? 'docx'
      : /ms-powerpoint/.test(mime) ? 'ppt'
      : /application\/pdf/.test(mime) ? 'pdf'
      : (name.match(office) || name.match(/\.pdf$/i))?.[1]?.toLowerCase() || typeFor('', name);
    if (!/\.(pptx|docx|ppt|pdf)$/i.test(name) && type) name += '.' + type;
    return { name, type };
  }
  async function acquireFile(url, label, progress, depth = 0) {
    if (depth > 2) throw new Error('eLearning redirected through too many pages.');
    const source = sameSite(url);
    if (!source) throw new Error('Automatic PDF conversion works for files hosted on JUST eLearning.');
    progress('Opening file…');
    const response = await fetch(source, { credentials: 'same-origin', redirect: 'follow' });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Your eLearning session expired. Sign in and try again.'
      : 'Could not retrieve this file (HTTP ' + response.status + ').');
    if (!sameSite(response.url || source)) throw new Error('The file is hosted outside JUST eLearning and cannot be converted privately.');
    const mime = (response.headers.get('content-type') || '').toLowerCase();
    if (/text\/html|application\/xhtml\+xml/.test(mime)) {
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const region = doc.querySelector('.resourcecontent, #region-main, main') || doc.body;
      const links = [...region.querySelectorAll('a[href], object[data], embed[src], iframe[src]')];
      const candidates = links.map(el => {
        const href = sameSite(el.getAttribute('href') || el.getAttribute('data') || el.getAttribute('src'));
        if (!href || href === source) return null;
        const path = new URL(href).pathname;
        return /pluginfile\.php|\/[^/]+\.(?:docx|pptx|ppt|pdf)$/i.test(path) ? href : null;
      }).filter(Boolean);
      if (!candidates.length) throw new Error('No downloadable Office file was found on this eLearning page.');
      candidates.sort((a, b) => Number(/pluginfile\.php/.test(b)) - Number(/pluginfile\.php/.test(a)));
      return acquireFile(candidates[0], label, progress, depth + 1);
    }
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 180 * 1024 * 1024) throw new Error('This file is too large for browser conversion (180 MB limit).');
    progress('Reading document…');
    const blob = await response.blob();
    if (blob.size > 180 * 1024 * 1024) throw new Error('This file is too large for browser conversion (180 MB limit).');
    const fromHeader = dispositionName(response.headers.get('content-disposition') || '');
    const fileInfo = normalizeName(fromHeader || defaultName(response.url || source, label), mime, label);
    if (fileInfo.type === 'pdf') {
      const outputName = fileInfo.name.replace(/\.pdf$/i,'') + '.pdf';
      return { pdf: blob, outputName };
    }
    if (!['pptx','docx','ppt'].includes(fileInfo.type)) {
      throw new Error('Only PPT, PPTX and DOCX can be converted directly.');
    }
    const filename = fileInfo.name.replace(/\.(docx|pptx|ppt|pdf)$/i, '') + '.' + fileInfo.type;
    return { file: new File([blob], filename, {type: mime || blob.type}) };
  }
  async function convert(url, label, progress = () => {}) {
    if (!globalThis.RLFileTools || !globalThis.RLPdfGenerator) throw new Error('PDF tools are unavailable. Reload the extension.');
    const input = await acquireFile(url, label, progress);
    if (input.pdf) {
      globalThis.RLFileTools.blobDownload(input.pdf, input.outputName);
      return;
    }
    let parsed;
    try {
      parsed = await globalThis.RLFileTools.read(input.file, {
        onProgress: ({done,total}) => progress('Reading slides ' + done + '/' + total + '…')
      });
      await globalThis.RLFileTools.convert(parsed, 'pdf', {
        onProgress: ({done,total}) => progress('Creating PDF ' + done + '/' + total + '…')
      });
    } finally {
      globalThis.RLFileTools.release(parsed);
    }
  }
  async function run(url, name, button, status) {
    if (!button || button.disabled) return;
    const old = button.innerHTML;
    const oldTitle = button.title;
    button.disabled = true;
    button.setAttribute('aria-busy','true');
    function say(message) {
      if (status) status.textContent = message;
      button.textContent = message;
    }
    try {
      say('Preparing…');
      await convert(url, name, say);
      say('PDF saved');
    } catch (error) {
      say('PDF unavailable');
      const detail = friendlyError(error);
      button.title = detail;
      if (status) status.textContent = detail;
      else {
        const hint = document.createElement('span');
        hint.className = 'rl-pdf-error';
        hint.setAttribute('role','status');
        hint.textContent = detail;
        button.after(hint);
        setTimeout(() => hint.remove(), 6500);
      }
    } finally {
      button.removeAttribute('aria-busy');
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = old;
        button.title = oldTitle;
        if (status) status.textContent = '';
      }, 2800);
    }
  }

  // Moodle's original interface is retained beneath Rattibha's optional course view.
  // Attach to individual resource links (never navigation, quizzes or assignments).
  function addNativeButtons() {
    const main = document.querySelector('.course-content, #region-main, main');
    if (!main) return;
    const links = main.querySelectorAll('a[href]');
    for (const link of links) {
      if (link.closest('nav, header, footer, .breadcrumb, .drawer, .rl-native-pdf-wrap')) continue;
      if (link.dataset.rlPdfChecked === '1') continue;
      const wrap = link.closest('li.activity, [data-for="cmitem"], .activity-item, .resourcecontent');
      const address = sameSite(link.getAttribute('href'));
      if (!address) continue;
      const context = (link.textContent || '') + ' ' + (link.title || '') + ' ' + (wrap?.querySelector('.instancename')?.textContent || '');
      if (!typeFor(address, context)) continue;
      if (/\/mod\/(?:quiz|assign|forum)\//.test(new URL(address).pathname)) continue;
      link.dataset.rlPdfChecked = '1';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rl-native-pdf';
      button.textContent = '↓ PDF';
      button.title = typeFor(address, context) === 'ppt' ? 'Download PPT as text-based PDF (images and original layout may differ)' : 'Download as PDF — converted on your device';
      button.setAttribute('aria-label','Download ' + (link.textContent.trim() || 'document') + ' as PDF');
      const status = document.createElement('span');
      status.className = 'rl-native-pdf-status';
      status.setAttribute('role', 'status');
      button.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        run(address, link.textContent.trim() || context.trim(), button, status);
      });
      link.after(button, status);
    }
  }
  function mountNative() {
    const style = document.createElement('style');
    style.textContent = '.rl-native-pdf{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;white-space:nowrap;min-height:28px;padding:3px 9px;margin:2px 6px;border:1px solid #b2d8cb;border-radius:6px;background:#f4faf7;color:#176b57;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer}.rl-native-pdf:hover{background:#e5f5ed}.rl-native-pdf:focus-visible{outline:2px solid #176b57;outline-offset:2px}.rl-native-pdf:disabled{opacity:.7;cursor:wait}.rl-native-pdf-status{font:12px/1.4 system-ui,sans-serif;color:#a83a2c}.rl-pdf-error{font:12px/1.4 system-ui,sans-serif;color:#a83a2c;margin-left:6px}';
    (document.head || document.documentElement).append(style);
    addNativeButtons();
    let debounce;
    const observer = new MutationObserver(changes => {
      if (changes.every(change => [...change.addedNodes].every(node => node.nodeType === 1 && (node.classList?.contains('rl-native-pdf') || node.classList?.contains('rl-native-pdf-status'))))) return;
      clearTimeout(debounce);
      debounce = setTimeout(addNativeButtons,250);
    });
    observer.observe(document.body, {childList:true,subtree:true});
    window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }
  globalThis.RLInlinePdf = { typeFor, convert, run };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountNative, {once:true});
  else mountNative();
})();
