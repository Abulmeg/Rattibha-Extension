/* Rattibha Learn — compact student workspace for JUST Moodle.
   Runs as an isolated shadow-DOM interface. Never requests credentials, and
   Moodle's underlying DOM and existing actions remain available. */
(() => {
  'use strict';
  if (window.__rattibhaLearnLoaded) return;
  window.__rattibhaLearnLoaded = true;

  const initialPageUrl=location.href;
  const path = location.pathname;
  const isCourses = /\/my\/courses\.php$/.test(path);
  const isCourse = /\/course\/view\.php$/.test(path);
  if (!isCourses && !isCourse) return;

  const STORE = 'rattibha-learn-v1'; // Preserve existing tasks, bookmarks, preferences
  const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;
  const defaults = () => ({
    favorites: [], tasks: [], recent: [], courseCache: [], starredResources: [], resourceLabels: {},
    theme: 'light', accent: 'teal', duration: 25, focus: null, focusMode:'focus', completedSessions:0
  });
  let state = defaults();
  let courses = [];
  let course = null;
  let view = isCourse ? 'course' : (['messages','convert','tasks','focus'].includes(new URLSearchParams(location.search).get('rattibha')) ? new URLSearchParams(location.search).get('rattibha') : 'courses');
  const converter={file:null, result:null, loading:false, error:'', notice:'', format:''};
  let query = '';
  let resourceQuery = '';
  let filter = 'all';
  let native = false;
  let ready = false;
  let initialized = false;
  let appearanceOpen = false;
  let resourceFilter = 'All';
  let showAllWeeks = false;
  let actualCoursesLoaded = false;
  let shownView = '';
  let spaNavigated = false;
  let navigating = false;
  let routeRequest = 0;
  const pageCache = new Map();
  let taskFilter = 'open';
  let editingTaskId = '';
  let flashNotice = '';
  let nextScrollTop = null;
  const accentNames = ['blue','indigo','violet','teal','rose','amber','ocean','graphite'];
  let scanTimer;
  let fetchingCourses = false;
  let coursesFetchCompleted = false;
  let viewer = null;
  let viewerBlob = null;
  let viewerController = null;
  let viewerTrigger = null;
  let courseTabs = [];
  let showHelp = false;
  let scanCount = 0;
  // Messages remain in memory only; no chat content goes to browser storage.
  const messaging = {conversations:[], loaded:false, loading:false, error:'', selected:null,
    items:[], threadLoading:false, threadError:'', search:'', unreadOnly:false,
    draft:'', sending:false, sendError:'', requestId:0, currentUser:0, sesskey:''};
  let focusTick;
  let mountedAt = Date.now();
  const expanded = new Set();

  const iconPaths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    checkcircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16 9"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M20 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 14h8M8 18h6"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3h6v1.5M9 12h6M9 16h4"/>',
    moon: '<path d="M20.5 14.5A8.6 8.6 0 0 1 9.5 3.5a8.7 8.7 0 1 0 11 11Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2 6M3 4v7h7"/>',
    filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
    trash: '<path d="M4 7h16M10 3h4m-8 4 1 14h10l1-14M10 11v6m4-6v6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9a3 3 0 1 1 5.1 2.2c-1.3 1-2.5 1.3-2.5 3.2m0 3h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.3 1.3"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.3-1.3"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 22a10 10 0 1 1 10-10 3.5 3.5 0 0 1-3.5 3.5H16a2 2 0 0 0-2 2c0 1 .5 1.6.5 2.4A2.1 2.1 0 0 1 12 22Z"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    spark: '<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.6 8.6 0 0 1-7.7 4.6 9.2 9.2 0 0 1-3.8-.9L3 21l1.9-5.6a9.2 9.2 0 0 1-.9-3.9 8.6 8.6 0 0 1 4.6-7.7 8.4 8.4 0 0 1 3.8-.9h.5a8.6 8.6 0 0 1 8.1 8.1v.5Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.7 9A7 7 0 0 1 18.6 7L20 12M4 12l1.4 5A7 7 0 0 0 18.3 15"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    convert: '<path d="M4 5h8l3 3v11H4zM12 5v4h4M19 11v8h-7M15 14l3 3m0 0-3 3m3-3h-7"/>',
    command: '<path d="M9 7V5.5a2.5 2.5 0 1 0-2.5 2.5H9Zm0 0v10m0-10h6m-6 10H6.5A2.5 2.5 0 1 0 9 19.5V17Zm6-10h2.5A2.5 2.5 0 1 0 15 4.5V7Zm0 0v10m0 0v2.5a2.5 2.5 0 1 0 2.5-2.5H15Z"/>'
  };
  const ic = (name, size = 19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const validUrl = (raw, base = location.href) => {
    try {
      const u = new URL(raw, base);
      return (u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === location.hostname)) ? u.href : '';
    } catch { return ''; }
  };
  // Allow only simple readable formatting and safe links from the authenticated university page.
  function safeRichHtml(root, baseUrl = location.href) {
    if(!root)return '';
    const allowed=new Set(['p','div','span','strong','b','em','i','u','br','ul','ol','li','h2','h3','h4','blockquote','a','img','table','tbody','tr','td','th','pre','code']);
    const ignored=new Set(['script','style','svg','iframe','form','button','input','select','textarea','noscript']);
    const walk=node=>{
      if(node.nodeType===3)return esc(node.textContent||'');
      if(node.nodeType!==1)return '';
      const tag=node.localName.toLowerCase();
      if(ignored.has(tag)||node.matches?.('.accesshide,.sr-only,.visually-hidden,[aria-hidden="true"]'))return '';
      const content=[...node.childNodes].map(walk).join('');
      if(!allowed.has(tag))return content;
      if(tag==='br')return '<br>';
      if(tag==='img'){
        const src=validUrl(node.getAttribute('src'),baseUrl);
        return src?'<img src="'+esc(src)+'" alt="'+esc(node.getAttribute('alt')||'Course image')+'" loading="lazy">':'';
      }
      if(tag==='a'){
        const href=validUrl(node.getAttribute('href'),baseUrl);
        return href?`<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${content||esc(href)}</a>`:content;
      }
      return `<${tag}>${content}</${tag}>`;
    };
    return [...root.childNodes].map(walk).join('');
  }
  const courseIdFrom = url => { try { return new URL(url).searchParams.get('id') || url; } catch { return url; } };
  const clean = x => (x || '').replace(/\s+/g, ' ').trim();
  const isShared = name => /\(\s*all\s*sections?\s*\)/i.test(name);
  const courseCode = name => (clean(name).match(/^([A-Za-z]{2,7}\d{2,4}[A-Za-z0-9]*)\s*[-–:]/) || [])[1] || '';
  const cleanCourseTitle = x => clean(x)
    .replace(/^(?:(?:Course is (?:not )?starred|Course name|Starred course|Unstarred course)\s*)+/gi, '')
    .replace(/\s*(?:Course is (?:not )?starred)\s*$/gi, '');
  const displayCourseLabel = label => {
    const value=clean(label);
    const letters=value.replace(/[^A-Za-z]/g,'');
    if (!letters || letters !== letters.toUpperCase()) return value;
    const acronyms = new Set(['AI','IOT','CPU','GPU','PCB','CPE','API','FPGA','VLSI','SQL','USB','HTTP','HTML','CSS','JS','C++','IC','ICs','IT']);
    return value.split(/(\s+)/).map(part => {
      const word=part.replace(/[^A-Za-z]/g,'');
      if(acronyms.has(word)) return part;
      return part.replace(/[A-Za-z]+/g, w => w[0].toUpperCase()+w.slice(1).toLowerCase());
    }).join('');
  };
  const courseName = name => cleanCourseTitle(name)
    .replace(/\s*\(\s*all\s*sections?\s*\)/ig, '')
    .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
    .replace(/^[A-Za-z]{2,7}\d{2,4}[A-Za-z0-9]*\s*[-–:]\s*/, '')
    .trim();
  const sectionLabel = name => {
    if (isShared(name)) return 'All Sections';
    const match = name.match(/\(\s*(\d+)\s*\)\s*$/);
    return match ? `My Section (${match[1]})` : 'My Section';
  };
  const timeShort = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  const uniq = arr => [...new Set(arr)];
  const badge = (txt, tone = '') => `<span class="badge ${tone}">${esc(txt)}</span>`;
  const getFavorite = id => state.favorites.includes(id);
  const safeLink = (href, label, cls = '') => href ? `<a class="${cls}" href="${esc(href)}">${label}</a>` : `<span>${label}</span>`;
  const typeFrom = (href, title) => {
    if(globalThis.RLMoodleMaterials)return RLMoodleMaterials.classify(href,title);
    const txt = `${href} ${title}`.toLowerCase();
    if (/assign|assignment|mod\/assign/.test(txt)) return 'Assignment';
    if (/mod\/quiz|\bquiz\b|exam/.test(txt)) return 'Quiz';
    if (/mod\/forum|forum/.test(txt)) return 'Forum';
    if (/\.pdf\b|\.docx?\b|\.pptx?\b|\.xlsx?\b|\/mod\/resource/.test(txt)) return 'File';
    if (/mod\/url|youtube|video/.test(txt)) return 'Link';
    return 'Resource';
  };
  const typeIcon = type => ({Assignment:'clipboard',Quiz:'checkcircle',Forum:'book',Link:'link',File:'file',Folder:'folder',Page:'book',Book:'book',Image:'image',Media:'play',Resource:'file'}[type] || 'file');
  const timerRemaining = () => {
    if (!state.focus) return (state.focusMode==='short'?5:state.focusMode==='long'?15:state.duration) * 60;
    return state.focus.endAt ? Math.max(0, Math.ceil((state.focus.endAt - Date.now()) / 1000)) : state.focus.left;
  };
  const timerIsRunning = () => !!state.focus?.endAt;
  const activeCourseId = () => isCourse ? new URLSearchParams(location.search).get('id') : '';

  const mount = document.createElement('div');
  mount.id = 'rattibha-learn-root';
  const shadow = mount.attachShadow({mode:'open'});
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = chrome.runtime.getURL('styles.css');
  shadow.appendChild(style);
  const screen = document.createElement('div');
  screen.id = 'screen';
  shadow.appendChild(screen);
  document.documentElement.appendChild(mount);

  async function load() {
    try {
      const stored = (await chrome.storage.local.get(STORE))[STORE];
      if (stored && typeof stored === 'object') state = {...defaults(), ...stored};
    } catch (error) { console.warn('Rattibha Learn storage unavailable:', error); }
  }
  async function save() {
    try { await chrome.storage.local.set({[STORE]: state}); }
    catch (error) { console.warn('Rattibha Learn could not save:', error); }
  }

  function extractCourses(root = document) {
    const items=[];
    // Moodle has several course overview themes. Prefer real course name links,
    // but support cards, dropdowns, navigation and AJAX-rendered overview pages.
    const scoped = root.querySelectorAll('[data-region="course-content"], .dashboard-card, .coursebox, .course-listitem, .block_myoverview, [data-region="myoverview"], #region-main, #page-content, nav');
    const candidates = [...new Set([...scoped].flatMap(node => [...node.querySelectorAll('a[href*="/course/view.php"]')]))];
    if (!candidates.length) candidates.push(...root.querySelectorAll('a[href*="/course/view.php"]'));
    for(const a of candidates) {
      const href = validUrl(a.getAttribute('href'));
      if (!href || !/\/course\/view\.php(?:\?|$)/i.test(href)) continue;
      const wrapper = a.closest('.dashboard-card,.coursebox,.course-listitem,[data-region="course-content"]');
      // Avoid image/accessibility/spurious link text which can contaminate names.
      const titleEl=wrapper?.querySelector('.coursename a,.course-title a,.coursename,.course-title');
      const raw=visibleText(titleEl || a) || a.getAttribute('title') || '';
      const name=cleanCourseTitle(raw).replace(/\bCourse is (?:not )?starred\b/gi,'').trim();
      const id=courseIdFrom(href);
      if(!name || name.length < 5 || !id || items.some(c=>c.id===id))continue;
      items.push({id,href,name,code:courseCode(name),label:courseName(name),shared:isShared(name)});
    }
    return items;
  }

  function normalizedCourses(result) {
    if(!Array.isArray(result))return [];
    return result.map(c=> {
      const name=cleanCourseTitle(c.fullname || c.displayname || c.name || c.shortname);
      const id=String(c.id||'');
      const href=validUrl(c.viewurl || `/current/course/view.php?id=${encodeURIComponent(id)}`);
      return id&&href&&name?{id,href,name,code:courseCode(name),label:courseName(name),shared:isShared(name)}:null;
    }).filter(Boolean);
  }
  function getSessionKey(html='') {
    const input=document.querySelector('input[name="sesskey"]');
    if(input?.value)return input.value;
    const sources=[html,...[...document.scripts].map(e=>e.textContent||'')];
    for(const src of sources) {
      const match=src.match(/["']sesskey["']\s*:\s*["']([a-zA-Z0-9]+)["']/) || src.match(/sesskey=([a-zA-Z0-9]+)/);
      if(match)return match[1];
    }
    return '';
  }
  function mergeCourses(next) {
    if(!next.length)return;
    // A partial page must never erase a more complete saved overview.
    const existing=new Map([...(state.courseCache||[]),...courses].map(c=>[String(c.id),c]));
    next.forEach(c=>existing.set(String(c.id),c));
    const merged=[...existing.values()];
    const changed=JSON.stringify(courses)!==JSON.stringify(merged);
    courses=merged;
    actualCoursesLoaded=true;
    if(changed)render();
    if(JSON.stringify(state.courseCache)!==JSON.stringify(merged)) {
      state.courseCache=merged;
      save();
    }
  }
  async function fetchCourses() {
    if(fetchingCourses)return;
    fetchingCourses=true;
    try {
      // No external services: request Moodle pages using the current JUST session.
      const response=await fetch(COURSE_BASE,{credentials:'same-origin',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error(`Moodle returned ${response.status}`);
      const html=await response.text();
      if(!response.url.includes('courses.php'))throw new Error('Moodle redirected to login');
      mergeCourses(extractCourses(new DOMParser().parseFromString(html,'text/html')));
      // Course overview is commonly injected by Moodle AJAX after page load.
      // Use Moodle's own enrolled-courses service, not a third-party API.
      const sesskey=getSessionKey(html);
      if(sesskey) {
        const endpoint=new URL('/current/lib/ajax/service.php',new URL(COURSE_BASE).origin);
        endpoint.searchParams.set('sesskey',sesskey);
        endpoint.searchParams.set('info','core_course_get_enrolled_courses_by_timeline_classification');
        const payload=[{index:0,methodname:'core_course_get_enrolled_courses_by_timeline_classification',args:{classification:'all',limit:0,offset:0,sort:'fullname',customfieldname:'',customfieldvalue:'',searchvalue:''}}];
        const ajax=await fetch(endpoint.href,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
        if(ajax.ok){const results=await ajax.json();mergeCourses(normalizedCourses(results?.[0]?.data?.courses));}
      }
    } catch(error) {console.info('Rattibha Learn: course overview unavailable',error.message);}
    finally {fetchingCourses=false;coursesFetchCompleted=true;render();}
  }

  const visibleText = element => {
    if (!element) return '';
    const copy = element.cloneNode(true);
    copy.querySelectorAll('.sr-only,.accesshide,.visually-hidden,[aria-hidden="true"],.activityicon,.activity-icon').forEach(el => el.remove());
    return clean(copy.textContent || element.getAttribute('aria-label') || element.getAttribute('title'));
  };
  function weekIsCurrent(label, reference = new Date()) {
    // Date-based detection, not Moodle's repeated accessibility text.
    const m = clean(label).match(/^(\d{1,2})\s+([A-Za-z]+)\s*[-–—]\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
    if (!m) return false;
    const monthIndex = text => ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(text.toLowerCase());
    const a=monthIndex(m[2]), b=monthIndex(m[4]);
    if (a<0 || b<0) return false;
    const thisYear = reference.getFullYear();
    // December to January sections can cross calendar years.
    const startYear = m[5] ? Number(m[5]) : thisYear;
    const endYear = b<a ? startYear+1 : startYear;
    const start=new Date(startYear,a,Number(m[1]));
    const end=new Date(endYear,b,Number(m[3]),23,59,59,999);
    return reference >= start && reference <= end;
  }
  function extractCourse(root=document, sourceUrl=location.href) {
    const heading=root.querySelector('#page-header h1,.page-header-headings h1,#region-main h1,h1');
    const title=cleanCourseTitle(heading?.textContent || root.title.replace(/\s*\|.*/,''))||'Course';
    const id=new URL(sourceUrl,location.href).searchParams.get('id')||title;
    const nodes=[...root.querySelectorAll('.course-content [data-for="section"],.course-content li.section,.course-content .course-section')];
    const sectionNodes=nodes.filter(node=>!nodes.some(other=>other!==node&&other.contains(node)));
    const sections=[];
    for(const [index,node] of sectionNodes.entries()) {
      const h=node.querySelector('[data-for="section_title"],.sectionname,.section-title,.section-header h3,.section-header h4,h3,h4');
      const name=(visibleText(h).replace(/\b(?:Collapse all|Expand all|Current week)\b/gi,'').trim())|| (index===0?'General':`Section ${index}`);
      const resources=[], seen=new Set();
      const summary=node.querySelector('.summary .no-overflow,.summary,.section-summary,.section-description,.course-section-header ~ .content .summary');
      const summaryText=visibleText(summary);
      if(summaryText && summaryText!==name)resources.push({name:'Section notes',href:'',type:'Note',content:summaryText,html:safeRichHtml(summary)});
      // Include Moodle labels, descriptions and embedded announcements as readable notes.
      const wrappers=[...node.querySelectorAll('[data-for="cmitem"],li.activity,.activity-item,.activity,.activity-wrapper,.activity-label')]
        .filter(item=>!item.parentElement?.closest('[data-for="cmitem"],li.activity,.activity-item,.activity,.activity-wrapper'));
      for(const item of wrappers){
        // Moodle supports folders expanded directly in the course section.
        // If there is no regular folder activity link, expose ALL of its files,
        // not just the first pluginfile anchor as though it were the folder.
        const inlineFolder=item.querySelector('.foldertree,.folder-container,.foldercontent,[data-region="folderfiles"]');
        const folderActivity=[...item.querySelectorAll('a[href*="/mod/folder/view.php"]')].find(link=>{
          try {return !new URL(link.href,sourceUrl).searchParams.has('download');}catch{return false;}
        });
        if(inlineFolder&&!folderActivity){
          const parentTitle=visibleText(item.querySelector('.instancename,.activityname,.foldername'))||'Folder';
          const links=[...inlineFolder.querySelectorAll('a[href]')];
          let added=0;
          for(const link of links){
            const href=validUrl(link.getAttribute('href'),sourceUrl);
            if(!href||seen.has(href))continue;
            let filename='';
            try {filename=decodeURIComponent(new URL(href).pathname.split('/').pop()||'');}catch{}
            if(!/pluginfile\.php|\/[^/]+\.[a-z0-9]{1,8}$/i.test(new URL(href).pathname))continue;
            const label=visibleText(link)||filename||'File';
            seen.add(href);added++;
            resources.push({name:parentTitle+' / '+label,href,type:typeFrom(href,filename||label),content:''});
          }
          if(added)continue;
        }
        let anchors=[...item.querySelectorAll('.activityname a[href],.activityinstance a[href],a.aalink[href],a[href*="/mod/"],a[href*="pluginfile.php"]')];
        if(!anchors.length)anchors=[...item.querySelectorAll('a[href]')].filter(a=>/\/(mod|pluginfile|h5p)\/|pluginfile\.php/i.test(a.getAttribute('href')||''));
        const a=anchors.find(a=>!a.closest('[hidden],.accesshide,.sr-only'))||anchors[0];
        const href=a?validUrl(a.getAttribute('href')):'';
        const title=a?visibleText(a.querySelector('.instancename')||a):'';
        const textNode=item.querySelector('.activity-description .no-overflow,.activity-description,.description .no-overflow,.activity-content .description,.contentwithoutlink,.contentafterlink,.label .no-overflow,.activity-label .no-overflow,.no-overflow');
        const description=visibleText(textNode);
        if(href && !seen.has(href)) {
          seen.add(href);
          const type=typeFrom(href,title);
          resources.push({name:title||'Material',href,type,content:description||'',html:safeRichHtml(textNode)});
        } else if(description && description!==name && description!==title && description.length>2) {
          const key=`note:${description}`;
          if(!seen.has(key)){seen.add(key);resources.push({name:description.length<74?description:'Course note',href:'',type:'Note',content:description,html:safeRichHtml(textNode)});}
        }
      }
      // Some newer Moodle themes render activities without a wrapper class.
      if (!wrappers.length){
        node.querySelectorAll('a[href*="/mod/"],a[href*="pluginfile.php"]').forEach(a=>{
          const href=validUrl(a.getAttribute('href'));
          if(!href||seen.has(href))return;
          seen.add(href);const text=visibleText(a);
          resources.push({name:text||'Material',href,type:typeFrom(href,text),content:''});
        });
      }
      const current=node.classList.contains('current')||node.classList.contains('currentweek')||node.dataset.current==='true';
      sections.push({name,index,resources,current:weekIsCurrent(name)||current});
    }
    return {id,name:title,code:courseCode(title),label:courseName(title),sections,href:sourceUrl};
  }

  function scan() {
    if(native || spaNavigated)return;
    if(isCourses) {
      const next=extractCourses();
      if(next.length)mergeCourses(next);
      if(!initialized && !next.length){courses=[...(state.courseCache||[])];render();}
      if(!next.length && !courses.length && !fetchingCourses && !coursesFetchCompleted)fetchCourses();
      ready=courses.length>0;
    } else {
      const next=extractCourse();
      if(JSON.stringify(course)!==JSON.stringify(next)||!initialized){course=next;render();}
      ready=next.sections.length>0;
    }
    initialized=true;
    scanCount++;
  }


  const MOODLE_MESSAGES = new URL('/current/message/index.php',new URL(COURSE_BASE).origin).href;
  function useridFrom(doc=document) {
    const direct=doc.querySelector('[data-region="message-drawer"][data-userid], [data-region="message-drawer"] [data-userid], #page-message-index [data-userid]');
    if(direct?.dataset?.userid && /^\d+$/.test(direct.dataset.userid))return Number(direct.dataset.userid);
    const user=doc.querySelector('#user-menu-toggle a[href*="/user/profile.php?id="], .usermenu a[href*="/user/profile.php?id="], a[href*="/user/profile.php?id="]');
    if(user){try{const id=new URL(user.href,new URL(COURSE_BASE).origin).searchParams.get('id');if(/^\d+$/.test(id||''))return Number(id);}catch{}}
    const text=[...doc.scripts].map(e=>e.textContent||'').join('\n');
    const match=text.match(/\b(?:userid|currentuserid|currentUserId)[\"']?\s*[:=]\s*["']?(\d+)["']?/i);
    return match?Number(match[1]):0;
  }
  async function messageContext() {
    if(messaging.sesskey && messaging.currentUser)return messaging;
    messaging.sesskey=getSessionKey()||messaging.sesskey;
    messaging.currentUser=useridFrom()||messaging.currentUser;
    // Header/pages sometimes omit Moodle messaging config; read the same-origin inbox.
    if(!messaging.sesskey || !messaging.currentUser){
      const r=await fetch(MOODLE_MESSAGES,{credentials:'same-origin',signal:AbortSignal.timeout(12000)});
      if(!r.ok || !r.url?.startsWith(new URL(COURSE_BASE).origin+'/current/'))throw new Error('Please sign in to eLearning first.');
      const text=await r.text();const page=new DOMParser().parseFromString(text,'text/html');
      messaging.currentUser=messaging.currentUser || useridFrom(page);
      messaging.sesskey=messaging.sesskey||getSessionKey(text)||(()=>{const match=text.match(/(?:"sesskey"\s*:\s*|sesskey=)["']?([A-Za-z0-9]+)/);return match?.[1]||'';})();
    }
    if(!messaging.sesskey)throw new Error('Moodle session is unavailable.');
    // Moodle supports 0 for the current user in some installations, but the
    // conversation-message endpoint needs the user id on most versions.
    if(!messaging.currentUser)throw new Error('Could not identify your Moodle account.');
    return messaging;
  }
  async function moodleMessage(method,args) {
    const context=await messageContext();
    const endpoint=new URL('/current/lib/ajax/service.php',new URL(COURSE_BASE).origin);
    endpoint.searchParams.set('sesskey',context.sesskey);
    endpoint.searchParams.set('info',method);
    const response=await fetch(endpoint.href,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{index:0,methodname:method,args}]),signal:AbortSignal.timeout(16000)});
    if(!response.ok)throw new Error('Moodle messages are unavailable right now.');
    const data=await response.json();
    if(!Array.isArray(data)||!data[0]||data[0].error)throw new Error(clean(data?.[0]?.exception?.message||data?.[0]?.message||'Moodle could not load messages.').slice(0,160));
    return data[0].data;
  }
  const strippedMessage = html => clean(new DOMParser().parseFromString(String(html||''),'text/html').body.textContent||'');
  const conversationName=c=>clean(c.name||c.members?.filter(m=>Number(m.id)!==messaging.currentUser).map(m=>m.fullname||m.name).join(', ')||c.members?.[0]?.fullname||'Conversation');
  const avatarLetters=s=>clean(s).split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2);
  const messageTime=timestamp=>{
    if(!timestamp)return '';
    try{const value=new Date(Number(timestamp)*1000);return Number.isNaN(value.getTime())?'':value.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}catch{return '';}
  };
  const filteredConversations=()=>messaging.conversations.filter(c=>(!messaging.unreadOnly||Number(c.unreadcount)>0)&&(!messaging.search||`${conversationName(c)} ${strippedMessage(c.lastmessage?.text||'')}`.toLowerCase().includes(messaging.search.toLowerCase())));
  function updateUnreadBadge(){
    const unread=messaging.conversations.reduce((sum,c)=>sum+Number(c.unreadcount||0),0);
    shadow.querySelectorAll('[data-message-count]').forEach(node=>{node.textContent=unread?String(Math.min(unread,99)):' ';node.hidden=!unread;});
  }
  async function loadMessages(force=false) {
    if(messaging.loading||messaging.loaded&&!force)return;
    messaging.loading=true;messaging.error='';
    if(view==='messages')render();
    try{
      await messageContext();
      const result=await moodleMessage('core_message_get_conversations',{userid:messaging.currentUser,limitfrom:0,limitnum:60,mergeself:true});
      const list=Array.isArray(result)?result:Array.isArray(result?.conversations)?result.conversations:[];
      messaging.conversations=list.filter(c=>Number(c.id)>0);
      messaging.loaded=true;
    } catch(err){messaging.error=err?.message||'Could not load messages.';}
    finally{messaging.loading=false;if(view==='messages')render();else updateUnreadBadge();}
  }
  async function openThread(id) {
    const convo=messaging.conversations.find(c=>String(c.id)===String(id));
    if(!convo)return;
    messaging.selected=String(id);messaging.threadLoading=true;messaging.threadError='';messaging.sendError='';messaging.items=[];
    const token=++messaging.requestId;
    if(view==='messages'){
      render();
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches) shadow.querySelector('.thread-panel')?.animate?.([
        {opacity:.6,transform:'translateX(9px)'},{opacity:1,transform:'translateX(0)'}
      ],{duration:300,easing:'cubic-bezier(.2,1,.28,1)'});
    }
    try{
      const result=await moodleMessage('core_message_get_conversation_messages',{currentuserid:messaging.currentUser,convid:Number(id),limitfrom:0,limitnum:100,newest:true});
      if(token!==messaging.requestId)return;
      const items=Array.isArray(result)?result:result?.messages;
      if(!Array.isArray(items))throw new Error('Message history is unavailable.');
      messaging.items=items.slice().sort((a,b)=>Number(a.timecreated||0)-Number(b.timecreated||0));
      if (Number(convo.unreadcount)>0) {
        try {
          await moodleMessage('core_message_mark_all_conversation_messages_as_read',
            {userid:messaging.currentUser,conversationid:Number(id)});
          convo.unreadcount=0;
        } catch { /* Reading works even when marking read is blocked. */ }
      }
    } catch(err){if(token===messaging.requestId)messaging.threadError=err?.message||'Could not open this conversation.';}
    finally{if(token===messaging.requestId){messaging.threadLoading=false;if(view==='messages'){render();shadow.querySelector('.message-history')?.scrollTo({top:999999});}}}
  }
  async function sendMoodleMessage() {
    const text=messaging.draft.trim();
    if(!text||messaging.sending||!messaging.selected||text.length>4000)return;
    messaging.sending=true;messaging.sendError='';render();
    try{
      await moodleMessage('core_message_send_messages_to_conversation',{conversationid:Number(messaging.selected),messages:[{text,textformat:1}]});
      messaging.draft='';
      await openThread(messaging.selected);
      // Refresh previews after send without storing message contents locally.
      await loadMessages(true);
    } catch(err){messaging.sendError=err?.message||'Message was not sent.';}
    finally{messaging.sending=false;if(view==='messages')render();}
  }
  function renderMessages() {
    const selected=messaging.conversations.find(c=>String(c.id)===messaging.selected);
    const convos=filteredConversations();
    const unread=messaging.conversations.reduce((sum,c)=>sum+Number(c.unreadcount||0),0);
    const list=messaging.loading&&!messaging.loaded?`<div class="message-skeletons">${[1,2,3,4,5].map(()=>'<div class="message-skeleton"><i></i><span><b></b><b></b></span></div>').join('')}</div>`:
      messaging.error?`<div class="messages-placeholder">${ic('message',21)}<strong>Messages unavailable</strong><span>${esc(messaging.error)}</span><button data-action="reload-messages">Try again</button><a href="${esc(MOODLE_MESSAGES)}" target="_blank" rel="noopener noreferrer">Open original messages ${ic('external',14)}</a></div>`:
      convos.length?convos.map(c=>{const name=conversationName(c);return `<button class="conversation-row ${String(c.id)===messaging.selected?'selected':''}" data-action="open-thread" data-id="${esc(c.id)}"><span class="conversation-avatar" aria-hidden="true">${esc(avatarLetters(name)||'M')}</span><span class="conversation-info"><span class="conversation-name">${esc(name)}</span><span class="conversation-snippet">${esc(strippedMessage(c.lastmessage?.text||'No messages yet'))}</span></span><span class="conversation-meta">${c.lastmessage?.timecreated?`<time>${esc(messageTime(c.lastmessage.timecreated))}</time>`:''}${Number(c.unreadcount)>0?`<span class="unread-dot" aria-label="${Number(c.unreadcount)} unread messages">${Math.min(99,Number(c.unreadcount))}</span>`:''}</span></button>`;}).join(''):
      `<div class="messages-placeholder">${ic('message',22)}<strong>${messaging.search?'No matches':'No conversations'}</strong></div>`;
    const thread=selected?`<div class="thread-top"><button class="thread-back" data-action="thread-back" aria-label="Back to conversations">${ic('back',20)}</button><span class="conversation-avatar">${esc(avatarLetters(conversationName(selected))||'M')}</span><strong>${esc(conversationName(selected))}</strong><a class="thread-original" href="${esc(MOODLE_MESSAGES)}" target="_blank" rel="noopener noreferrer" title="Original messages">${ic('external',16)}</a></div><div class="message-history" role="log" aria-label="Conversation messages">${messaging.threadLoading?`<div class="thread-skeletons"><span></span><span></span><span></span><span></span></div>`:messaging.threadError?`<div class="thread-empty">${esc(messaging.threadError)} <button data-action="open-thread" data-id="${esc(selected.id)}">Retry</button></div>`:messaging.items.length?messaging.items.map(m=>{const mine=Number(m.useridfrom||m.userid||m.senderid)===messaging.currentUser;return `<div class="chat-row ${mine?'outgoing':'incoming'}"><div class="chat-bubble" dir="auto"><div class="chat-content">${esc(strippedMessage(m.text||m.smallmessage))}</div><time>${esc(messageTime(m.timecreated))}</time></div></div>`}).join(''):`<div class="thread-empty">No messages yet</div>`}</div><form id="message-form" class="message-compose"><textarea name="message" rows="1" maxlength="4000" placeholder="Write a message…" aria-label="Message" ${messaging.sending?'disabled':''}>${esc(messaging.draft)}</textarea><button class="send-button" type="submit" ${messaging.sending||!messaging.draft.trim()?'disabled':''} aria-label="Send message">${ic('send',18)}</button></form>${messaging.sendError?`<div class="message-error" role="alert">${esc(messaging.sendError)}</div>`:''}`:
      `<div class="thread-welcome">${ic('message',27)}<strong>Your chats</strong><span>Choose a conversation to read or reply.</span></div>`;
    return `<div class="page-title messages-heading"><div><h1>Chats</h1><p>${unread?`${unread} unread`: 'Your conversations'}</p></div><div class="messages-actions"><button class="page-action" data-action="reload-messages" title="Refresh conversations">${ic('refresh',16)} Refresh</button><a class="page-action" href="${esc(MOODLE_MESSAGES)}" target="_blank" rel="noopener noreferrer" title="Open original messages">${ic('external',15)} Original website</a></div></div>
    <div class="messages-layout ${selected?'thread-active':''}"><aside class="inbox-panel"><div class="inbox-toolbar"><label class="search">${ic('search',16)}<input type="search" data-input="messages-search" placeholder="Search conversations" value="${esc(messaging.search)}" aria-label="Search conversations"></label><button class="inbox-unread ${messaging.unreadOnly?'on':''}" data-action="messages-filter">Unread</button></div><div class="inbox-list">${list}</div></aside><section class="thread-panel" aria-label="Conversation">${thread}</section></div>`;
  }

  const navItem = (target, label, glyph) => `<button type="button" class="nav-link ${view === target ? 'active':''}" data-action="nav" data-target="${target}">${ic(glyph,17)}<span>${label}</span></button>`;
  const countTasks = () => state.tasks.filter(t => !t.done).length;
  const countFav = () => courses.filter(c => getFavorite(c.id)).length;
  const progressPct = () => {
    const full = (state.focus?.duration || (state.focusMode==='short'?5:state.focusMode==='long'?15:state.duration)) * 60;
    return Math.max(0, Math.min(100, 100 - Math.round(timerRemaining() / full * 100)));
  };
  const groupCourses = list => {
    const result = new Map();
    list.forEach(c => {
      const key = c.code || c.label.toLowerCase();
      if (!result.has(key)) result.set(key,{key, code:c.code, label:c.label, entries:[]});
      result.get(key).entries.push(c);
    });
    return [...result.values()].map(g => ({...g, entries:g.entries.sort((a,b)=>Number(a.shared)-Number(b.shared)),
      fav:g.entries.some(c => getFavorite(c.id))}));
  };
  function filteredGroups() {
    const groups=groupCourses(courses).filter(g =>
      `${g.code} ${g.label} ${g.entries.map(e=>e.name).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
    const filtered=filter==='starred' ? groups.filter(g=>g.fav) : groups;
    return filtered.sort((a,b)=> Number(b.fav)-Number(a.fav) || a.code.localeCompare(b.code) || a.label.localeCompare(b.label));
  }
  function appShell(main) {
    const n=countTasks();
    return `<div class="app ${esc(state.theme)}" data-accent="${esc(state.accent||'teal')}">
      <header class="header"><div class="topbar">
      <a href="${esc(COURSE_BASE)}" class="brand" data-rattibha-home title="Courses"><span class="brand-symbol theme-mark"><img src="${chrome.runtime.getURL('icons/mark-white.svg')}" alt="" width="24" height="24"></span><span class="brand-name">rattibha<span class="brand-subname">learn</span></span></a>
      <nav class="top-nav" aria-label="Main navigation">${navItem('courses','Courses','book')}${navItem('tasks',`Tasks${n?` <span class="nav-count">${n}</span>`:''}`,'checkcircle')}${navItem('convert','PDF tools','convert')}</nav>
      <div class="header-tools"><button class="header-chat ${view==='messages'?'selected':''}" data-action="nav" data-target="messages" aria-label="Open chats" title="Chats">${ic('message',19)}<span class="chat-text">Chat</span><span class="message-count" data-message-count hidden></span></button><button class="focus-shortcut ${state.focus?.endAt?'in-progress':''}" data-action="nav" data-target="focus" title="Focus timer">${ic('timer',16)} <span id="timer-face">${timeShort(timerRemaining())}</span></button>
      <div class="appearance-wrap"><button class="icon-button appearance-toggle ${appearanceOpen?'opened':''}" data-action="appearance" title="Appearance" aria-label="Appearance" aria-haspopup="true" aria-expanded="${appearanceOpen}">${ic('palette',18)}</button>${appearanceOpen?appearanceMenu():''}</div><button class="native-link" data-action="native" title="Original eLearning">${ic('external',17)}<span>Original website</span></button></div></div></header>
      <div class="workspace"><main class="main" id="main">${main}</main></div>
      <nav class="mobile-nav" aria-label="Mobile navigation">${navItem('courses','Courses','book')}${navItem('tasks','Tasks','checkcircle')}${navItem('convert','PDF tools','convert')}${navItem('focus','Focus','timer')}</nav>
      ${flashNotice?`<div class="notice" role="status">${ic('help',18)} ${esc(flashNotice)}<button data-action="clear-notice" aria-label="Dismiss">${ic('close',16)}</button></div>`:''}
    </div>`;
  }
  function appearanceMenu() {
    return `<div class="appearance-menu" role="group" aria-label="Appearance"><div class="menu-heading"><strong>Appearance</strong></div><div class="menu-label">Theme</div><div class="theme-switch"><button class="${state.theme==='light'?'selected':''}" data-action="theme-choice" data-choice="light" aria-pressed="${state.theme==='light'}">${ic('sun',16)} Light</button><button class="${state.theme==='dark'?'selected':''}" data-action="theme-choice" data-choice="dark" aria-pressed="${state.theme==='dark'}">${ic('moon',16)} Dark</button></div><div class="menu-label">Accent</div><div class="accent-options">${accentNames.map(c=>`<button class="swatch swatch-${c} ${state.accent===c?'selected':''}" data-action="accent" data-choice="${c}" title="${c}" aria-label="${c}" aria-pressed="${state.accent===c}">${state.accent===c ? ic('check',15) : ''}</button>`).join('')}</div></div>`;
  }
  const blank = (glyph, title, desc) => `<div class="empty">${ic(glyph,24)}<strong>${esc(title)}</strong>${desc ? `<span>${esc(desc)}</span>` : ''}</div>`;
  function courseCard(g) {
    const chosen=g.entries.find(c=>!c.shared)||g.entries[0];
    const mine=g.entries.find(c=>!c.shared);
    const all=g.entries.find(c=>c.shared);
    return `<article class="subject-row"><span class="subject-icon">${ic('book',19)}</span><div class="subject-main"><div class="subject-head"><span class="subject-code">${esc(g.code||'COURSE')}</span><a class="subject-title" href="${esc(chosen.href)}" data-course-open="${esc(chosen.id)}">${esc(displayCourseLabel(g.label||chosen.name))}</a></div><div class="subject-links">${mine?`<a class="section-chip" href="${esc(mine.href)}">${esc(sectionLabel(mine.name))} ${ic('arrow',12)}</a>`:''}${all?`<a class="section-chip shared" href="${esc(all.href)}">All Sections ${ic('arrow',12)}</a>`:''}${!mine&&!all?`<a class="section-chip" href="${esc(chosen.href)}">Open course ${ic('arrow',12)}</a>`:''}</div></div><button class="star-button ${g.fav?'selected':''}" data-action="favorite-group" data-group="${esc(g.key)}" title="${g.fav?'Unpin course':'Pin course'}" aria-label="${g.fav?'Unpin course':'Pin course'}">${ic('star',18)}</button></article>`;
  }

  function courseGrid(list) { return `<div class="subject-list">${list.map(courseCard).join('')}</div>`; }
  function loadingCourses() { return `<div class="course-skeleton-list">${[1,2,3,4,5].map(()=>`<div class="course-skeleton"><i></i><span><b></b><b></b></span></div>`).join('')}</div>`; }
  function loadingCourse() {return `<div class="course-loading"><div class="sk-crumb skeleton-line"></div><div class="sk-title skeleton-line"></div><div class="sk-subtitle skeleton-line"></div><div class="sk-tabs"><i></i><i></i></div>${[1,2,3].map(()=>'<div class="sk-week"><span></span><span></span></div>').join('')}</div>`;}
  function searchBar() {return `<label class="search">${ic('search',18)}<input data-input="search" type="search" placeholder="Search your courses" value="${esc(query)}" aria-label="Search your courses" /></label>`;}
  function renderCourses() {
    const groups=filteredGroups();const count=groupCourses(courses).length;
    const recent=(state.recent||[]).slice(0,2);
    const pending=state.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,4);
    return `<div class="page-title home-heading"><div><h1>Courses</h1><p>${count?`${count} subjects${actualCoursesLoaded?'':' · Saved courses'}`:'Your courses, in one place'}</p></div>${coursesFetchCompleted&&!actualCoursesLoaded?'<button class="page-action" data-action="retry-courses">Refresh courses</button>':''}</div>
      <p class="rattibha-howto">Choose a course → open a week → view or download a file. PPT, PPTX and DOCX materials have a PDF button.</p><div class="course-home-layout"><section class="course-library"><div class="library-toolbar">${searchBar()}<div class="filter-tabs"><button class="filter-pill ${filter!=='starred'?'active':''}" data-action="filter" data-filter="all">All</button><button class="filter-pill ${filter==='starred'?'active':''}" data-action="filter" data-filter="starred">${ic('star',15)} Pinned</button></div></div>
      ${groups.length?courseGrid(groups):(courses.length?blank('search','No matching courses','Try another search'):(!coursesFetchCompleted&&Date.now()-mountedAt<8000?loadingCourses():`<div class="recover"><strong>Courses didn't load</strong><span>Try reloading or open the original website.</span><div class="recover-actions"><button data-action="retry-courses">${ic('refresh',15)} Retry</button><button data-action="native">Original website</button></div></div>`))}</section>
      <aside class="home-rail"><section class="home-sidebar"><div class="home-side-header"><h2>${ic('checkcircle',18)} To do</h2><button data-action="nav" data-target="tasks">All tasks ${ic('arrow',14)}</button></div>${pending.length?`<div class="mini-tasks">${pending.map(taskRow).join('')}</div>`:`<p class="quiet-empty">Nothing due right now.</p>`}<form id="quick-task-form" class="quick-task"><input name="title" maxlength="120" required placeholder="Add a task…" aria-label="New task"><button aria-label="Add task" type="submit">${ic('plus',18)}</button></form></section>
      <section class="home-continue"><div class="home-side-header"><h2>${ic('clock',17)} Recent</h2></div>${recent.length?recent.map(r=>`<button class="recent-item" data-action="open-resource" data-url="${esc(r.url)}" data-name="${esc(r.name)}">${ic('file',16)}<span>${esc(r.name)}</span>${ic('chevron',14)}</button>`).join(''):'<p class="quiet-empty">Files you open appear here.</p>'}</section>
      <button class="home-focus" data-action="nav" data-target="focus"><span>${ic('timer',19)} Focus timer</span><span class="home-focus-time">${timeShort(timerRemaining())} ${ic('arrow',16)}</span></button></aside></div>`;
  }

  function friendlyCourse(value){
    if(!value)return '';
    const group=groupCourses(courses).find(g=>g.code===value||g.label===value||g.key===value);
    return group?displayCourseLabel(group.label):displayCourseLabel(value);
  }
  function friendlyDue(date){
    if(!date)return 'No due date';
    const d=new Date(date+'T12:00:00');
    if(!Number.isFinite(d.getTime()))return date;
    const today=new Date();const dateValue=date;
    const iso=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
    if(dateValue===iso)return 'Today';
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  }
  const taskRow = task => `<div class="task-row ${task.done?'done':''}"><button class="task-check ${task.done?'checked':''}" data-action="taskdone" data-id="${esc(task.id)}" aria-label="${task.done?'Mark incomplete':'Mark complete'}">${task.done?ic('check',15):''}</button><div class="task-info"><strong>${esc(task.title)}</strong><small>${task.course?`${ic('book',12)} ${esc(friendlyCourse(task.course))}`:''}${task.due?`<span class="due-label">${ic('calendar',12)} ${esc(friendlyDue(task.due))}</span>`:''}${!task.course&&!task.due?'Personal':''}</small></div><button class="row-edit" data-action="taskedit" data-id="${esc(task.id)}" title="Edit task" aria-label="Edit task">${ic('sliders',16)}</button><button class="row-delete" data-action="taskdelete" data-id="${esc(task.id)}" title="Delete task" aria-label="Delete task">${ic('trash',16)}</button></div>`;
  function renderTaskList(limit = 999){
    const list=[...state.tasks].filter(t=>taskFilter==='all'||(taskFilter==='done'?t.done:!t.done)).sort((a,b)=>Number(a.done)-Number(b.done)||(a.due||'9999').localeCompare(b.due||'9999')).slice(0,limit);
    return list.length?list.map(taskRow).join(''):blank('checkcircle',taskFilter==='done'?'No completed tasks':'All caught up','');
  }
  function timerWidget(full=false){
    const remaining=timerRemaining();const progress=progressPct();
    const modes=[['focus','Focus'],['short','Short break'],['long','Long break']];
    return `<section class="focus-panel ${full?'focus-full':''} ${timerIsRunning()?'timer-running':''}"><div class="focus-tabs">${modes.map(([key,title])=>`<button class="focus-mode ${state.focusMode===key?'active':''}" data-action="focus-mode" data-mode="${key}" aria-pressed="${state.focusMode===key}">${esc(title)}</button>`).join('')}</div>
    <div class="timer-dial" role="timer" aria-label="Focus timer"><svg class="timer-svg" viewBox="0 0 248 248"><circle class="timer-ring-bg" cx="124" cy="124" r="108"/><circle id="timer-ring" class="timer-ring" cx="124" cy="124" r="108" stroke-dasharray="678.584" stroke-dashoffset="${(678.584*(100-progress)/100).toFixed(2)}"/></svg><div class="timer-center"><span class="timer-caption">${state.focusMode==='focus'?'FOCUS SESSION':'TAKE A BREAK'}</span><strong id="timer-face">${timeShort(remaining)}</strong><span class="timer-status">${timerIsRunning()?'In progress':state.focus?'Paused':'Ready to start'}</span></div></div>
    ${state.focusMode==='focus'?`<div class="duration-buttons">${[25,45,50].map(m=>`<button data-action="duration" data-minutes="${m}" class="duration ${state.duration===m?'selected':''}" ${timerIsRunning()?'disabled':''}>${m} min</button>`).join('')}</div>`:''}
    <div class="timer-actions"><button class="btn-primary" data-action="timer-toggle">${ic(timerIsRunning()?'pause':'play',17)} ${timerIsRunning()?'Pause':state.focus?'Continue':(state.focusMode==='focus'?'Start focus':'Start break')}</button><button class="btn-quiet" data-action="timer-reset" title="Reset timer" aria-label="Reset timer">${ic('reset',18)}</button></div><p class="session-counter">${ic('checkcircle',16)} ${state.completedSessions||0} focus sessions finished</p></section>`;
  }
  function savedPreview() {
    const items=[...state.starredResources.map(url=>({url,name:state.resourceLabels?.[url] || 'Saved file'})),...state.recent.filter(r=>!state.starredResources.includes(r.url))].slice(0,5);
    if (!items.length) return '';
    return `<section class="side-panel"><div class="panel-head"><h3>Recent files</h3></div><div class="recent-list">${items.map(r=>`<a class="recent-row" href="${esc(r.url)}" data-resource="${esc(r.url)}" data-resource-name="${esc(r.name)}">${ic('file',16)}<span>${esc(r.name)}</span>${ic('arrow',14)}</a>`).join('')}</div></section>`;
  }
  function taskForm() {
    const groups=groupCourses(courses);const editing=state.tasks.find(t=>t.id===editingTaskId);
    return `<form id="task-form" class="task-form"><label for="new-task">What do you need to do?</label><input id="new-task" type="text" name="title" required maxlength="120" placeholder="e.g. Finish lab report" value="${esc(editing?.title||'')}"/><div class="form-row"><div><label for="task-course">Subject</label><select id="task-course" name="course"><option value="">Personal task</option>${groups.map(g=>{const id=g.code||g.label;return `<option value="${esc(id)}" ${editing?.course===id?'selected':''}>${esc(displayCourseLabel(g.label))}</option>`}).join('')}</select></div><div><label for="task-due">Due date</label><input id="task-due" type="date" name="due" value="${esc(editing?.due||'')}"/></div></div><div class="task-form-actions"><button type="submit" class="btn-primary">${ic(editing?'check':'plus',18)} ${editing?'Save task':'Add task'}</button>${editing?`<button type="button" class="btn-quiet" data-action="taskedit-cancel">Cancel</button>`:''}</div></form>`;
  }
  function renderTasks(){
    const done=state.tasks.filter(t=>t.done).length;
    return `<div class="page-title tasks-heading"><div><h1>Tasks</h1><p>${countTasks()} to do · ${done} completed</p></div></div><div class="tasks-layout"><section class="pane new-task-pane"><div class="pane-title">${ic('plus',18)}<h3>${editingTaskId?'Edit task':'New task'}</h3></div>${taskForm()}</section><section class="pane task-list-pane"><div class="panel-head"><h3>Your tasks</h3><span class="little-count">${countTasks()} remaining</span></div><div class="task-filters">${[['open','To do'],['all','All'],['done','Done']].map(([val,title])=>`<button data-action="task-filter" data-filter="${val}" class="task-filter ${taskFilter===val?'selected':''}">${title}</button>`).join('')}</div><div class="task-stack">${renderTaskList()}</div></section></div>`;
  }
  function converterOptions(){return converter.file?RLFileTools.options(converter.file.name.split('.').pop().toLowerCase()):[];}
  function renderConvert(){
    const file=converter.file;
    const supported=converterOptions();
    const pdf=file?.name.toLowerCase().endsWith('.pdf');
    return `<div class="convert-page"><div class="page-title"><div><h1>PDF tools</h1><p>Choose a document below. Your files stay on your device.</p></div></div>
    <section class="convert-panel"><label class="convert-drop" for="convert-file">${ic('folder',25)}<strong>${file?esc(file.name):'Choose a file'}</strong><span>DOCX, PPTX, PPT, TXT, MD or PDF</span><input id="convert-file" type="file" data-input="convert-file" accept=".docx,.pptx,.ppt,.txt,.md,.pdf" aria-label="Choose a document"></label>
    ${converter.loading?`<div class="convert-skeleton" role="status" aria-live="polite"><span id="convert-progress">Reading file…</span><b></b><b></b><b></b></div>`:converter.error?`<p class="convert-error" role="alert">${esc(converter.error)}</p>`:''}
    ${file&&!converter.loading?pdf?`<div class="convert-note">PDF to Word or PowerPoint isn't available offline yet. You can preview the original file here.</div><button class="btn-primary convert-pdf-preview" data-action="convert-preview-pdf">${ic('eye',17)} Preview PDF</button>`:
    `<div class="convert-controls"><label for="convert-format">Convert to</label><select id="convert-format" aria-label="Output format">${supported.map(x=>`<option value="${x.value}" ${x.value===converter.format?'selected':''}>${esc(x.label)}</option>`).join('')}</select><button data-action="convert-run" class="btn-primary" ${converter.result?'':'disabled'}>${ic('convert',17)} ${converter.format==='pdf'?'Download PDF':'Convert'}</button></div><div class="convert-note">${converter.result?.note?esc(converter.result.note):(converter.format==='pdf'?'Downloads a PDF directly. Large presentations may take a little longer.':'Text and slides are exported locally. Complex Office layouts may change.')}</div>`:''}
    ${converter.notice?`<div class="convert-success" role="status">${ic('checkcircle',17)} ${esc(converter.notice)}</div>`:''}</section>
    <p class="convert-footnote">PDFs are generated here without the print dialog. Older PPT files export readable slide text but not the original graphics or theme.</p></div>`;
  }
  function renderFocus(){return `<div class="focus-screen"><div class="page-title"><div><h1>Focus</h1></div></div><div class="focus-layout">${timerWidget(true)}</div></div>`;}

  function resourceRow(r) {
    const hasHref=!!r.href;
    const key=r.href||`note:${course.id}:${r.name}`;
    const starred=state.starredResources.includes(key);
    const type=r.type;
    const canPreview=hasHref || !!r.content;
    const downloadsOnClick=hasHref&&(isDownloadFile(r.href)||(r.type==='File'&&/\.(docx?|pptx?|xlsx?|zip|rar|7z|odt|odp|ods|rtf|txt)$/i.test(r.name)));
    const openNative=hasHref&&globalThis.RLMoodleMaterials?.isNative(r.type);
    const officeKind=hasHref && (!globalThis.RLMoodleMaterials||r.type==='File') && globalThis.RLInlinePdf?.typeFor(r.href,r.name);
    const pdfButton=officeKind?`<button class="resource-save-pdf" type="button" data-action="resource-pdf" data-url="${esc(r.href)}" data-name="${esc(r.name)}" title="${officeKind==='ppt'?'Legacy PPT to PDF: slide text preserved; graphics may differ':'Download as PDF without leaving this course'}" aria-label="Download ${esc(r.name)} as PDF">PDF ${ic('download',14)}</button>`:'';
    const noteText = type==='Note' ? clean(r.content||'') : '';
    const noteSnippet=noteText && noteText!==r.name ? `<span class="resource-note-snippet">${esc(noteText.slice(0,125))}${noteText.length>125?'…':''}</span>` : '';
    const primary=canPreview?`<button class="resource-name" data-action="open-resource" data-url="${esc(r.href)}" data-name="${esc(r.name)}" data-type="${esc(type)}" data-content="${esc(r.content||'')}" data-html="${esc(r.html||'')}"><strong>${esc(r.name==='Course note'?'Note':r.name)}</strong>${noteSnippet}<small>${esc(type==='Note'?'Read note':openNative?'Open on eLearning':downloadsOnClick?'Download':type)}</small></button>`:`<div class="resource-name"><strong>${esc(r.name)}</strong></div>`;
    return `<div class="resource-row ${type==='Note'?'resource-note':''}"><div class="resource-icon">${ic(type==='Note'?'list':typeIcon(type),19)}</div>${primary}${pdfButton}<button class="resource-star ${starred?'selected':''}" data-action="star-resource" data-url="${esc(key)}" title="${starred?'Remove bookmark':'Bookmark material'}" aria-label="${starred?'Remove bookmark':'Bookmark material'}">${ic('star',17)}</button>${hasHref?`<button class="resource-open" data-action="open-resource" data-url="${esc(r.href)}" data-name="${esc(r.name)}" data-type="${esc(type)}" data-content="${esc(r.content||'')}" data-html="${esc(r.html||'')}" title="${downloadsOnClick?'Download':'Open'} ${esc(r.name)}" aria-label="${downloadsOnClick?'Download':'Open'} ${esc(r.name)}">${ic(downloadsOnClick?'download':'eye',18)}</button>`:''}</div>`;
  }
  function getRelatedCourseTabs() {
    if(!course)return [];
    const code=course.code;const candidates=courses.filter(c=>code?c.code===code:c.label===course.label);
    if(!candidates.some(c=>String(c.id)===String(course.id) || clean(c.name).toLowerCase()===clean(course.name).toLowerCase()))candidates.push({id:course.id,href:location.href,name:course.name,shared:isShared(course.name)});
    const mine=candidates.filter(c=>!c.shared);
    const shared=candidates.find(c=>c.shared);
    return [...(mine.length?mine.map(c=>({label:sectionLabel(c.name),href:c.href,id:c.id})):[]),...(shared?[{label:'All Sections',href:shared.href,id:shared.id}]:[])];
  }
  function courseTabBar() {
    const tabs=getRelatedCourseTabs();
    if(tabs.length<2)return '';
    return `<div class="course-tabs" role="tablist" aria-label="Course sections">${tabs.map(t=>`<a role="tab" aria-selected="${String(t.id)===String(course.id)}" class="course-tab ${String(t.id)===String(course.id)?'active':''}" href="${esc(t.href)}">${esc(t.label)}</a>`).join('')}</div>`;
  }

  function renderCourse() {
    if (!course) return loadingCourse();
    const fav=getFavorite(course.id);
    const total=course.sections.reduce((sum,s)=>sum+s.resources.length,0);
    const hidden=course.sections.filter(s=>!s.resources.length && !s.current && !/^general$/i.test(s.name));
    const visibleSections=course.sections.filter(s=>showAllWeeks || s.resources.length || s.current || /^general$/i.test(s.name));
    return `<div class="crumb"><a href="${esc(COURSE_BASE)}">My courses</a>${ic('chevron',14)}<span>${esc(course.code||'Course')}</span></div>
      <div class="page-title course-title"><div><span class="page-kicker">${esc(course.code||'')}</span><h1>${esc(displayCourseLabel(course.label||course.name))}</h1><p>${total?`${total} resources`:'No resources detected'}</p></div><button class="pin-course ${fav?'selected':''}" data-action="favorite" data-id="${esc(course.id)}">${ic('star',17)} ${fav?'Pinned':'Pin'}</button></div>
      ${courseTabBar()}<div class="course-toolbar"><h2>Materials</h2><div class="section-commands"><label class="search resource-search">${ic('search',17)}<input type="search" data-input="resource-search" value="${esc(resourceQuery)}" placeholder="Search files and activities" aria-label="Find materials" /></label><button class="link-small" data-action="expandall">Expand all</button><button class="link-small" data-action="collapseall">Collapse</button></div></div>
      <div class="resource-filters">${['All','File','Folder','Note','Assignment','Quiz','Forum'].map(t=>`<button class="resource-pill ${resourceFilter===t?'selected':''}" data-action="resource-filter" data-filter="${t}">${t==='All'?'All':t==='File'?'Files':t==='Folder'?'Folders':t==='Note'?'Text':t==='Assignment'?'Assignments':t==='Quiz'?'Quizzes':'Forums'}</button>`).join('')}</div>
      ${!total?`<div class="recover resource-warning"><strong>Can't read course materials yet</strong><span>Moodle still has the original files and activities.</span><button data-action="native">Open original website ${ic('external',14)}</button></div>`:''}
      <div class="sections-area">${visibleSections.map(section=>{
        const index=section.index;
        const matching=section.resources.filter(r=>(!resourceQuery||r.name.toLowerCase().includes(resourceQuery.toLowerCase()))&&(resourceFilter==='All'||r.type===resourceFilter||(resourceFilter==='File'&&['Folder','Image','Media'].includes(r.type))));
        if((resourceQuery||resourceFilter!=='All')&&!matching.length) return '';
        const isOpen=(resourceQuery||resourceFilter!=='All')?true:(expanded.size===0?(section.current||index===0||section.resources.length>0):expanded.has(index));
        return `<section class="section-block ${section.current?'current-section':''}"><button class="section-toggle" aria-expanded="${isOpen}" data-action="section" data-index="${index}"><span class="section-label"><span class="section-arrow ${isOpen?'open':''}">${ic('chevron',15)}</span><strong>${esc(section.name)}</strong>${section.current?'<span class="current-mark">Current</span>':''}</span>${section.resources.length?`<span class="section-end">${section.resources.length}</span>`:''}</button>${isOpen?`<div class="section-resources">${matching.length?matching.map(resourceRow).join(''):`<div class="empty-section">Nothing posted yet</div>`}</div>`:''}</section>`;
      }).join('')}${(!showAllWeeks&&hidden.length&&!resourceQuery&&resourceFilter==='All')?`<button class="show-weeks" data-action="show-weeks">Show ${hidden.length} other weeks ${ic('down',15)}</button>`:''}${showAllWeeks&&hidden.length?`<button class="show-weeks" data-action="show-weeks">Hide empty weeks</button>`:''}</div>`;
  }

  function render() {
    if (native) {
      closeViewer();
      screen.innerHTML = `<div class="native-return"><button data-action="back-to-learn">${ic('grid',18)} Rattibha Learn ${ic('arrow',17)}</button></div>`;
      return;
    }
    let markup = '';
    if (view==='courses') markup = renderCourses();
    else if (view==='tasks') markup = renderTasks();
    else if (view==='focus') markup = renderFocus();
    else if (view==='convert') markup = renderConvert();
    else if (view==='messages') markup = renderMessages();
    else if (view==='course') markup = navigating ? `${loadingCourse()}` : renderCourse();
    else markup = renderCourses();
    const oldTop=shadow.querySelector('.main')?.scrollTop || 0;
    screen.innerHTML = appShell(markup);
    if(viewer)renderViewer();
    document.documentElement.classList.remove('rattibha-boot');
    const newMain=shadow.querySelector('.main');
    if (newMain) newMain.scrollTop=nextScrollTop===null?oldTop:nextScrollTop;
    nextScrollTop=null;
    updateTimerUi();
    updateUnreadBadge();
  }

  function updateTimerUi() {
    const seconds = timerRemaining();
    shadow.querySelectorAll('#timer-face').forEach(el => el.textContent = timeShort(seconds));
    shadow.querySelectorAll('#timer-progress-bar').forEach(el => el.style.width = `${progressPct()}%`);
    shadow.querySelectorAll('#timer-ring').forEach(el=>el.style.strokeDashoffset=String(678.584*(100-progressPct())/100));
    if (state.focus?.endAt && seconds===0) { if(state.focusMode==='focus')state.completedSessions=(state.completedSessions||0)+1;state.focus = null;save();render(); }
  }
  function navigate(target){
    if(target==='courses' && /\/course\/view\.php$/.test(location.pathname)){returnToCourses();return;}
    if(view===target)return;
    view=target;appearanceOpen=false;nextScrollTop=0;
    if(target==='messages')loadMessages();
    if(target==='courses'){query='';filter='all';}
    render();animatePage();
  }
  async function openCourseRoute(url, push=true) {
    const target=validUrl(url);
    if(!target || new URL(target).origin!==location.origin || !/\/current\/course\/view\.php(?:\?|$)/.test(target))return;
    const ticket=++routeRequest;
    const previousView=view;
    const oldMain=shadow.querySelector('.main');
    navigating=true;spaNavigated=true;appearanceOpen=false;view='course';nextScrollTop=0;
    if(oldMain && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      oldMain.animate([{opacity:1},{opacity:.55}],{duration:130,fill:'forwards'});
    }
    render();
    try {
      let next=pageCache.get(target);
      if(!next){
        const response=await fetch(target,{credentials:'same-origin',signal:AbortSignal.timeout(16000)});
        if(!response.ok || !/\/course\/view\.php/.test(new URL(response.url).pathname))throw new Error('Course is unavailable.');
        const parsed=new DOMParser().parseFromString(await response.text(),'text/html');
        next=extractCourse(parsed,target);
        if(!next.sections.length)throw new Error('Moodle has not loaded this course yet.');
        pageCache.set(target,next);
      }
      if(ticket!==routeRequest)return;
      course=next;view='course';navigating=false;expanded.clear();resourceQuery='';resourceFilter='All';showAllWeeks=false;
      if(push)history.pushState({rattibha:true},'',target);
      nextScrollTop=0;render();animatePage();
    }catch(err){
      if(ticket!==routeRequest)return;
      view=previousView;navigating=false;flashNotice='Could not load that course. Try its original page.';
      render();
    }
  }
  function animatePage() {
    const main=shadow.querySelector('.main');
    if (!main || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    main.firstElementChild?.animate?.([
      {opacity:.3,transform:'translate3d(0,10px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}
    ],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  function returnToCourses(push=true){
    ++routeRequest;spaNavigated=true;navigating=false;view='courses';course=null;appearanceOpen=false;nextScrollTop=0;
    if(push)history.pushState({rattibha:true},'',COURSE_BASE);
    render();animatePage();
  }
  window.addEventListener('popstate',()=>{
    if(!/\/current\/(?:my\/courses\.php|course\/view\.php)/.test(location.pathname))return;
    if(/\/my\/courses\.php$/.test(location.pathname))returnToCourses(false);
    else openCourseRoute(location.href,false);
  });
  function recordRecent(url,name) {
    if (!url) return;
    state.recent = [{url,name,at:Date.now()}, ...state.recent.filter(x => x.url!==url)].slice(0,20);
    save();
  }
  // Material URLs are either real files, Moodle wrapper pages or ordinary Moodle text.
  // A resource/view.php URL is not necessarily the file: Moodle can present external links
  // (e.g. an externally hosted PDF) within a small HTML page.
  const isDirectPdf = url => {try{return /\.pdf$/i.test(decodeURIComponent(new URL(url).pathname));}catch{return false;}};
  const isDownloadFile = url => {if(globalThis.RLMoodleMaterials)return RLMoodleMaterials.downloadable(url);try{return /\.(?:docx?|pptx?|xlsx?|odt|odp|ods|zip|rar|7z|csv|txt|rtf|epub)$/i.test(decodeURIComponent(new URL(url).pathname));}catch{return false;}};
  const mediaKindFrom=(url,mime='')=>globalThis.RLMoodleMaterials?.mediaKind(url,mime)||'';
  const inferredName = (url, label='Download') => {
    try {const part=decodeURIComponent(new URL(url).pathname.split('/').pop()||'');return /\.[a-z0-9]{2,6}$/i.test(part)?part:label;}
    catch{return label;}
  };
  const contentDispositionName = value => {
    const extended=value?.match(/filename\*\s*=\s*(?:UTF-8''|["']?)([^;"']+)/i)?.[1];
    const standard=value?.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;\s]+)/i);
    const valueToDecode=extended||standard?.[1]||standard?.[2]||'';
    try{return decodeURIComponent(valueToDecode);}catch{return valueToDecode;}
  };
  const cleanFilename = name => String(name||'download').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().slice(0,180)||'download';
  let noticeTimeout;
  function showDownloadNotice(message) {
    shadow.querySelector('.rattibha-download-toast')?.remove();
    const toast=document.createElement('div');toast.className='rattibha-download-toast';toast.setAttribute('role','status');
    toast.textContent=message;
    shadow.querySelector('.app')?.append(toast);
    clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>toast.remove(),3300);
  }
  async function startDownload(url, filename) {
    if(!url||!validUrl(url))throw new Error('No download link found.');
    if(chrome?.runtime?.sendMessage) {
      try {
        const answer=await chrome.runtime.sendMessage({type:'RATTIBHA_DOWNLOAD',url,filename:cleanFilename(filename||inferredName(url))});
        if(answer?.ok)return;
        if(answer?.error)throw new Error(answer.error);
      } catch(error) {
        // In local mock tests and during developer reloads the service worker may be absent.
        if(chrome.runtime?.id)throw error;
      }
    }
    // Graceful fallback when running without the browser download API.
    const a=document.createElement('a');a.href=url;a.download=cleanFilename(filename||inferredName(url));
    a.style.display='none';document.body.append(a);a.click();a.remove();
  }
  async function downloadResource(url, filename, returnToViewer=false) {
    try {await startDownload(url,filename);showDownloadNotice('Download started');if(returnToViewer&&viewer){viewer.downloadReady=true;renderViewer();}}
    catch(err) {showDownloadNotice('Download unavailable · Open original');if(viewer){viewer.error=err.message||'Download failed';viewer.status='ready';renderViewer();}}
  }
  function viewerShell(title,body,source,download) {
    const getButton=download?`<button class="viewer-btn viewer-download" data-action="viewer-download" title="Download file">${ic('download',17)} <span>Download</span></button>`:'';
    const launch=viewer?.mode==='pdf'&&viewer?.previewUrl?`<a class="viewer-btn" href="${esc(viewer.previewUrl)}" target="_blank" rel="noopener noreferrer" title="Open PDF in a new tab">${ic('external',16)} <span>Open PDF</span></a>`:'';
    const original=source?`<a class="viewer-btn" href="${esc(source)}" target="_blank" rel="noopener noreferrer" title="Open original Moodle page">${ic('external',16)} <span>Original</span></a>`:'';
    return `<div class="viewer-backdrop" data-action="close-viewer"><section class="viewer-panel ${viewer?.mode==='text'&&!viewer.error?'viewer-compact':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><div class="viewer-header"><div class="viewer-title">${ic(viewer?.mode==='pdf'?'file':'book',19)}<strong title="${esc(title)}">${esc(title)}</strong></div><div class="viewer-actions">${getButton}${launch}${original}<button class="viewer-close" data-action="close-viewer" aria-label="Close preview">${ic('close',20)}</button></div></div><div class="viewer-body">${body}</div></section></div>`;
  }

  function renderMediaPreview(item) {
    const url=esc(item.previewUrl||''),title=esc(item.title||'File');
    const tag=item.mediaKind==='image'?'<img src="'+url+'" alt="'+title+'" loading="lazy">':
      item.mediaKind==='audio'?'<audio controls preload="metadata" src="'+url+'"></audio>':
      '<video controls preload="metadata" playsinline src="'+url+'"></video>';
    return '<div class="material-media">'+tag+'<p>Having trouble viewing this file? Use Download or Original above.</p></div>';
  }
  function renderFolderContents(item) {
    const files=item.files||[];
    const zip=item.folderZip?'<button class="folder-zip" data-action="folder-zip" data-url="'+esc(item.folderZip)+'" data-name="'+esc(item.title||'Folder')+'.zip">'+ic('download',16)+' Download entire folder (ZIP)</button>':'';
    if(!files.length)return '<div class="folder-empty">'+ic('folder',30)+'<strong>No files could be listed</strong><p>This folder might be empty, restricted or loaded dynamically.</p>'+zip+'<a href="'+esc(item.source)+'" target="_blank" rel="noopener noreferrer">Open folder on eLearning '+ic('external',15)+'</a></div>';
    let previous='';
    const list=files.map(file=>{
      const heading=file.folder&&file.folder!==previous?'<h3 class="folder-path">'+ic('folder',15)+' '+esc(file.folder)+'</h3>':'';
      previous=file.folder;
      const kind=typeFrom(file.href,file.name);
      const pdfKind=globalThis.RLInlinePdf?.typeFor(file.href,file.name);
      const pdf=pdfKind?'<button class="folder-file-pdf" data-action="resource-pdf" data-url="'+esc(file.href)+'" data-name="'+esc(file.name)+'" title="Save as PDF">PDF '+ic('download',14)+'</button>':'';
      const attrs=' data-url="'+esc(file.href)+'" data-name="'+esc(file.name)+'" data-type="'+esc(kind)+'"';
      return heading+'<div class="folder-file-row"><span class="folder-file-icon">'+ic(typeIcon(kind),18)+'</span><button class="folder-file-name" data-action="open-resource"'+attrs+'>'+esc(file.name)+'</button>'+pdf+'<button class="folder-file-open" data-action="open-resource"'+attrs+' title="Open or download '+esc(file.name)+'" aria-label="Open '+esc(file.name)+'">'+ic('arrow',17)+'</button></div>';
    }).join('');
    return '<div class="folder-view"><div class="folder-view-top"><span>'+files.length+' file'+(files.length===1?'':'s')+'</span>'+zip+'</div>'+list+'</div>';
  }

  function renderViewer() {
    shadow.querySelector('.viewer-backdrop')?.remove();
    if(!viewer)return;
    const body=viewer.status==='loading'?`<div class="viewer-skeleton"><i></i><span></span><span></span><span></span><span></span></div>`:
      viewer.error?`<div class="viewer-empty">${ic('external',23)}<strong>Cannot open this file</strong><p>${esc(viewer.error)}</p>${viewer.download?`<button class="btn-primary" data-action="viewer-download">${ic('download',17)} Download</button>`:''}${viewer.source?`<a href="${esc(viewer.source)}" target="_blank" rel="noopener noreferrer">Original website ${ic('arrow',15)}</a>`:''}</div>`:
      viewer.mode==='folder'?renderFolderContents(viewer):
      viewer.mode==='media'?renderMediaPreview(viewer):
      viewer.mode==='pdf'?`<iframe class="pdf-frame" title="PDF preview" src="${esc(viewer.previewUrl)}" referrerpolicy="no-referrer-when-downgrade"></iframe>`:
      `<div class="document-stack"><article class="document-text" dir="auto">${viewer.html?viewer.html:esc(viewer.text||viewer.title)}</article>${viewer.entries?.length?`<div class="announcement-links">${viewer.entries.map(entry=>`<button data-action="open-resource" data-url="${esc(entry.url)}" data-name="${esc(entry.title)}" data-type="Forum">${ic('book',16)}<span>${esc(entry.title)}</span>${ic('arrow',15)}</button>`).join('')}</div>`:''}</div>`;
    shadow.querySelector('.app')?.insertAdjacentHTML('beforeend',viewerShell(viewer.title,body,viewer.source,viewer.download||''));
    shadow.querySelector('.viewer-panel')?.focus({preventScroll:true});
  }
  function closeViewer() {
    viewerController?.abort();viewerController=null;
    if(viewerBlob){URL.revokeObjectURL(viewerBlob);viewerBlob=null;}
    viewer=null;
    shadow.querySelector('.viewer-backdrop')?.remove();
    viewerTrigger?.focus?.({preventScroll:true});viewerTrigger=null;
  }
  // The file reader must inspect fetched Moodle HTML before deciding whether it is
  // a readable page. Extract links from the content area, not navigation/breadcrumbs.
  function linkedFileFromMoodle(page, baseUrl) {
    const containers=[...page.querySelectorAll('.resourcecontent, #region-main, .box.generalbox, main, body')];
    const found=[];
    for (const container of containers) {
      const elements=[...container.querySelectorAll('a[href], object[data], embed[src], iframe[src]')];
      for(const el of elements){
        if(el.closest('nav, header, footer, .breadcrumb, .drawer, [data-region="drawer"]'))continue;
        const address=el.getAttribute('href')||el.getAttribute('data')||el.getAttribute('src');
        const href=validUrl(address,baseUrl);if(!href)continue;
        const path=decodeURIComponent(new URL(href).pathname);
        if(/\.(pdf|docx?|pptx?|xlsx?|zip|rar|7z|odt|odp|ods|rtf|txt)$/i.test(path)||/pluginfile\.php/i.test(path)){
          found.push({href,label:visibleText(el)||inferredName(href)});
        }
      }
      if(found.length)break;
    }
    // Deduplicate resources. Prefer direct PDF links ahead of pluginfile redirects.
    return [...new Map(found.map(item=>[item.href,item])).values()].sort((a,b)=>Number(isDirectPdf(b.href))-Number(isDirectPdf(a.href)))[0]||null;
  }
  async function openResource(url,name,type='',content='',richHtml='') {
    closeViewer();
    viewerTrigger=shadow.activeElement;
    viewer={title:name||'Material',source:url||'',download:'',status:'loading',mode:'text',text:'',html:richHtml};
    if(!url){viewer={...viewer,status:'ready',mode:'text',text:content||name,html:richHtml};renderViewer();return;}
    if(globalThis.RLMoodleMaterials?.isNative(type)){
      const target=validUrl(url);
      if(target)window.open(target,'_blank','noopener,noreferrer');
      closeViewer();return;
    }
    if(type==='Quiz'||type==='Assignment'){
      viewer={...viewer,status:'ready',error:'Open the original website to complete this activity.'};renderViewer();return;
    }
    recordRecent(url,name);
    if(isDirectPdf(url) && new URL(url).origin!==location.origin){
      viewer={...viewer,status:'ready',mode:'pdf',previewUrl:url,download:url,fileName:inferredName(url,name+'.pdf')};
      renderViewer();return;
    }
    const directMedia=mediaKindFrom(url);
    if(directMedia){viewer={...viewer,status:'ready',mode:'media',mediaKind:directMedia,previewUrl:url,download:url,fileName:inferredName(url,name)};renderViewer();return;}
    if(isDownloadFile(url)){
      await downloadResource(url,inferredName(url,name));return;
    }
    renderViewer();
    viewerController=new AbortController();
    const signal=viewerController.signal;
    try {
      let response=await fetch(url,{credentials:'same-origin',signal});
      if(!response.ok)throw new Error('The server could not open this file.');
      const contentType=(response.headers.get('Content-Type')||'').toLowerCase();
      let finalUrl=response.url||url;
      if(/\/login\/(?:index\.php)?/.test(new URL(finalUrl).pathname))throw new Error('Please sign in to eLearning and try again.');
      let directFileName='';
      if(contentType.includes('text/html')){
        const html=await response.text();
        const page=new DOMParser().parseFromString(html,'text/html');
        if((type==='Folder'||/\/mod\/folder\/view\.php/.test(new URL(url).pathname))&&globalThis.RLMoodleMaterials){
          const folder=RLMoodleMaterials.folderData(page,finalUrl);
          viewer={...viewer,status:'ready',mode:'folder',...folder};renderViewer();return;
        }
        if(type==='Page'||type==='Forum'){
          const detail=page.querySelector('#region-main,.resourcecontent,main')||page.body;
          const entries=[...detail.querySelectorAll('a[href*="/mod/forum/discuss.php"]')].slice(0,30).map(a=>({title:visibleText(a),url:validUrl(a.getAttribute('href'),finalUrl)})).filter(x=>x.title&&x.url);
          viewer={...viewer,status:'ready',mode:'text',text:visibleText(detail)||content||'No content yet.',html:safeRichHtml(detail,finalUrl),entries};renderViewer();return;
        }
        const link=linkedFileFromMoodle(page,finalUrl);
        if(link){
          const direct=link.href;
          if(isDirectPdf(direct)){
            viewer={...viewer,status:'ready',mode:'pdf',previewUrl:direct,download:direct,fileName:inferredName(direct,name+'.pdf')};
            renderViewer();return;
          }
          const wrappedMedia=mediaKindFrom(direct);
          if(wrappedMedia){viewer={...viewer,status:'ready',mode:'media',mediaKind:wrappedMedia,previewUrl:direct,download:direct,fileName:inferredName(direct,name)};renderViewer();return;}
          if(isDownloadFile(direct)){
            closeViewer();await downloadResource(direct,inferredName(direct,name));return;
          }
          // pluginfile.php URLs often lack an extension, so inspect the response.
          response=await fetch(direct,{credentials:'same-origin',signal});
          if(!response.ok)throw new Error('File not available.');
          finalUrl=response.url||direct;
          directFileName=link.label||'';
        } else {
          const detail=page.querySelector('#region-main,.activity-description,.box.generalbox,.resourcecontent,.forumpost,.forum-post-container,.discussion-list');
          if(detail){
            const entries=[...detail.querySelectorAll('a[href*="/mod/forum/discuss.php"]')].slice(0,30).map(a=>({title:visibleText(a),url:validUrl(a.getAttribute('href'),finalUrl)})).filter(x=>x.title&&x.url);
            viewer={...viewer,status:'ready',mode:'text',text:visibleText(detail)||content||'No content yet.',html:safeRichHtml(detail,finalUrl),entries};
            renderViewer();return;
          }
          viewer={...viewer,status:'ready',mode:'text',text:content||visibleText(page.querySelector('#region-main'))||'No content yet.',html:safeRichHtml(page.querySelector('#region-main'),finalUrl)};
          renderViewer();return;
        }
      }
      const mime=(response.headers.get('Content-Type')||'').split(';')[0].toLowerCase();
      const disposition=response.headers.get('Content-Disposition')||'';
      const dispositionName=contentDispositionName(disposition);
      let filename=dispositionName||inferredName(finalUrl,directFileName||name);
      const mediaKind=mediaKindFrom(finalUrl,mime);
      if(mediaKind){viewer={...viewer,status:'ready',mode:'media',mediaKind,previewUrl:finalUrl,download:finalUrl,fileName:filename};renderViewer();return;}
      const pdf=mime==='application/pdf'||isDirectPdf(finalUrl)||/\.pdf$/i.test(filename);
      if(pdf){
        // Same-origin PDFs can be previewed as a blob for Moodle protected links.
        // Cross-origin PDFs are embedded directly so CORS does not break the viewer.
        if(new URL(finalUrl).origin!==location.origin){
          viewer={...viewer,status:'ready',mode:'pdf',previewUrl:finalUrl,download:finalUrl,fileName:filename};
          renderViewer();return;
        }
        const size=Number(response.headers.get('Content-Length')||'0');
        if(size>65*1024*1024){viewer={...viewer,status:'ready',mode:'pdf',previewUrl:finalUrl,download:finalUrl,fileName:filename};renderViewer();return;}
        const blob=await response.blob();if(signal.aborted)return;
        if(blob.type==='text/html')throw new Error('PDF unavailable; open the original website.');
        viewerBlob=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));
        viewer={...viewer,status:'ready',mode:'pdf',previewUrl:viewerBlob,download:finalUrl,fileName:filename.endsWith('.pdf')?filename:name+'.pdf'};
        renderViewer();return;
      }
      // All non-PDF downloads use the browser's download manager. Do not attempt
      // an incomplete Office preview or save a Moodle HTML wrapper as a document.
      if(mime.includes('text/html'))throw new Error('This material has no direct file link.');
      closeViewer();
      await downloadResource(finalUrl,filename);
    } catch(err) {
      if(signal.aborted)return;
      viewer=(content&&type==='Forum')?{...viewer,status:'ready',mode:'text',text:content,html:richHtml}:{...viewer,status:'ready',error:err.message||'Open the original website to access this file.',download:''};renderViewer();
    }
  }
  function makeNative(nativeValue) { if(nativeValue && spaNavigated && location.href!==initialPageUrl){ location.assign(location.href); return; } if (nativeValue) closeViewer(); native = nativeValue; document.body.inert = !native; document.documentElement.classList.toggle('rattibha-native',native);render(); }

  shadow.addEventListener('click', async event => {
    const embeddedLink=event.target.closest('.document-text a[href]');
    if(embeddedLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){
      const target=validUrl(embeddedLink.href);
      if(target && (isDirectPdf(target)||isDownloadFile(target))){
        event.preventDefault();const label=embeddedLink.textContent.trim()||inferredName(target);
        if(isDirectPdf(target))openResource(target,label,'File');
        else downloadResource(target,inferredName(target,label));
        return;
      }
    }
    const internal=event.target.closest('a[href]');
    if(internal && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!internal.target||internal.target==='_self')){
      const url=validUrl(internal.href);
      if(url && /\/current\/course\/view\.php(?:\?|$)/.test(url)){event.preventDefault();openCourseRoute(url);return;}
      if(url && new URL(url).pathname==='/current/my/courses.php'){event.preventDefault();returnToCourses();return;}
    }
    const courseLink=event.target.closest('a[data-course-open]');
    if (courseLink) { state.recentCourses=uniq([courseLink.dataset.courseOpen,...(state.recentCourses||[])]).slice(0,15);save(); }
    const resource = event.target.closest('a[data-resource]');
    if (resource) {event.preventDefault();openResource(resource.dataset.resource,resource.dataset.resourceName,resource.dataset.type||'');return;}
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if(action==='folder-zip'){await downloadResource(button.dataset.url,button.dataset.name);return;}
    if(action==='viewer-download'){
      if(viewer?.download)downloadResource(viewer.download,viewer.fileName||viewer.title,true);
      return;
    }
    if (action==='resource-pdf') { await globalThis.RLInlinePdf.run(button.dataset.url,button.dataset.name,button);return; }
    if (action==='nav') { navigate(button.dataset.target); return; }
    if(action==='convert-preview-pdf' && converter.file){
      closeViewer();viewerBlob=URL.createObjectURL(converter.file);viewer={title:converter.file.name,source:'',download:viewerBlob,previewUrl:viewerBlob,fileName:converter.file.name,status:'ready',mode:'pdf'};renderViewer();return;
    }
    if(action==='convert-run'){
      if(!converter.result||converter.loading)return;
      converter.loading=true;converter.error='';converter.notice='';render();
      try{
        const update=({phase,done,total})=>{const el=shadow.querySelector('#convert-progress');if(el)el.textContent=`${phase==='exporting'?'Creating PDF':'Reading slides'} · ${done} / ${total}`;};
        await RLFileTools.convert(converter.result,converter.format||'txt',{onProgress:update});
        converter.notice=converter.format==='pdf'?'PDF downloaded.':'File ready in Downloads.';
      }
      catch(e){converter.error=e.message||'Conversion failed.';}
      finally{converter.loading=false;render();}return;
    }
    if (action==='clear-notice'){flashNotice='';render();return;}
    if (action==='task-filter'){taskFilter=button.dataset.filter;render();return;}
    if (action==='taskedit'){editingTaskId=button.dataset.id;view='tasks';nextScrollTop=0;render();shadow.querySelector('#new-task')?.focus();return;}
    if (action==='taskedit-cancel'){editingTaskId='';render();return;}
    if (action==='focus-mode'){state.focusMode=button.dataset.mode;state.focus=null;await save();render();return;}
    if (action==='reload-messages') {loadMessages(true);return;}
    if (action==='open-thread') {openThread(button.dataset.id);return;}
    if (action==='thread-back') {messaging.selected=null;messaging.items=[];messaging.requestId++;render();return;}
    if (action==='messages-filter') {messaging.unreadOnly=!messaging.unreadOnly;render();return;}
    if (action==='close-viewer') {if(event.target.closest('.viewer-panel') && event.target===button)return;closeViewer();return;}
    if (action==='open-resource'){openResource(button.dataset.url,button.dataset.name,button.dataset.type||'',button.dataset.content||'',button.dataset.html||'');return;}
    if (action==='retry-courses'){coursesFetchCompleted=false;fetchCourses();return;}
    if (action==='native') { makeNative(true); return; }
    if (action==='back-to-learn') { makeNative(false); scan(); return; }
    if (action==='appearance') { appearanceOpen=!appearanceOpen; render(); return; }
    if (action==='theme-choice') {state.theme=button.dataset.choice;await save();render();return;}
    if (action==='accent') {state.accent=accentNames.includes(button.dataset.choice)?button.dataset.choice:'blue';await save();render();return;}
    if (action==='resource-filter') { resourceFilter=button.dataset.filter;render();return; }
    if (action==='rescan') { mountedAt=Date.now(); scan(); render(); return; }
    if (action==='show-weeks') {showAllWeeks=!showAllWeeks;render();return;}
    if (action==='filter') { filter=button.dataset.filter; render(); return; }
    if (action==='favorite-group') {
      const group=groupCourses(courses).find(g=>g.key===button.dataset.group);
      if (!group) return;
      const ids=group.entries.map(c=>c.id);
      state.favorites=group.fav?state.favorites.filter(id=>!ids.includes(id)):uniq([...state.favorites,...ids]);
      await save();render();return;
    }
    if (action==='favorite') {
      const id=button.dataset.id;
      state.favorites = getFavorite(id) ? state.favorites.filter(x=>x!==id) : [...state.favorites,id];
      await save(); render(); return;
    }
    if (action==='taskdone' || action==='taskdelete') {
      if (action==='taskdelete') state.tasks=state.tasks.filter(x=>x.id!==button.dataset.id);
      else state.tasks=state.tasks.map(x=>x.id===button.dataset.id?{...x,done:!x.done}:x);
      await save(); render(); return;
    }
    if (action==='star-resource') {
      const url=button.dataset.url;
      state.starredResources=state.starredResources.includes(url)?state.starredResources.filter(x=>x!==url):[...state.starredResources,url];
      state.resourceLabels = {...(state.resourceLabels || {}), [url]:clean(button.closest('.resource-row')?.querySelector('.resource-name strong')?.textContent) || 'Saved material'};
      await save(); render(); return;
    }
    if (action==='section') {
      const idx=Number(button.dataset.index);
      const target=course?.sections.find(s=>s.index===idx);
      if(!target)return;
      if(!expanded.size)course.sections.forEach(s=>{if(s.index===0||s.current||s.resources.length)expanded.add(s.index);});
      const wasOpen=button.getAttribute('aria-expanded')==='true';
      const panel=button.nextElementSibling?.classList.contains('section-resources')?button.nextElementSibling:null;
      if(wasOpen)expanded.delete(idx); else expanded.add(idx);
      if(!expanded.size)expanded.add(-1);
      button.setAttribute('aria-expanded',String(!wasOpen));
      button.querySelector('.section-arrow')?.classList.toggle('open',!wasOpen);
      const motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(wasOpen && panel) {
        if(!motion){panel.remove();return;}
        const height=panel.scrollHeight;
        const player=panel.animate([{height:height+'px',opacity:1},{height:'0px',opacity:0}],{duration:240,easing:'cubic-bezier(.4,0,.2,1)'});
        player.onfinish=()=>panel.remove();
      } else if(!wasOpen){
        const matching=target.resources.filter(r=>(!resourceQuery||r.name.toLowerCase().includes(resourceQuery.toLowerCase()))&&(resourceFilter==='All'||r.type===resourceFilter||(resourceFilter==='File'&&['Folder','Image','Media'].includes(r.type))));
        const child=document.createElement('div');child.className='section-resources';child.innerHTML=matching.length?matching.map(resourceRow).join(''):'<div class="empty-section">Nothing posted yet</div>';
        button.after(child);
        if(motion) {
          const height=child.scrollHeight;
          const player=child.animate([{height:'0px',opacity:.55},{height:height+'px',opacity:1}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});
          player.onfinish=()=>{child.style.height='';};
        }
      }
      return;
    }
    if (action==='expandall') {expanded.clear();course?.sections.forEach((s,i)=>expanded.add(i));render();return;}
    if (action==='collapseall') {expanded.clear();expanded.add(-1);render();return;}
    if (action==='duration') { if(timerIsRunning()) return; state.duration=Number(button.dataset.minutes);state.focusMode='focus';state.focus=null;await save();render();return; }
    if (action==='timer-toggle') {
      if (state.focus?.endAt) state.focus={...state.focus,left:timerRemaining(),endAt:null};
      else { const left=state.focus?.left || state.duration*60; state.focus={left,duration:state.focus?.duration||(state.focusMode==='short'?5:state.focusMode==='long'?15:state.duration),endAt:Date.now()+left*1000}; }
      await save();render();return;
    }
    if (action==='timer-reset') {state.focus=null;await save();render();return;}
  });
  shadow.addEventListener('submit', async event => {
    if(event.target.id==='message-form') {
      event.preventDefault();
      messaging.draft=event.target.elements.message.value;
      await sendMoodleMessage();return;
    }
    if (!['task-form','quick-task-form'].includes(event.target.id)) return;
    event.preventDefault();
    const form = event.target;
    const title=clean(form.elements.title.value);
    if (!title) return;
    if(form.id==='task-form' && editingTaskId){
      state.tasks=state.tasks.map(t=>t.id===editingTaskId?{...t,title:title.slice(0,120),course:form.elements.course?.value||'',due:form.elements.due?.value||''}:t);
      editingTaskId='';
    }else state.tasks=[{id:(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),title:title.slice(0,120),course:form.elements.course?.value || '',due:form.elements.due?.value || '',done:false},...state.tasks];
    await save();render();
  });
  shadow.addEventListener('change', async event=>{
    if(event.target.dataset.input==='convert-file'){
      const file=event.target.files?.[0];if(!file)return;
      RLFileTools.release(converter.result);
      converter.file=file;converter.error='';converter.notice='';converter.result=null;converter.loading=true;
      converter.format=RLFileTools.options(file.name.toLowerCase().split('.').pop()).some(x=>x.value==='pdf')?'pdf':(RLFileTools.options(file.name.toLowerCase().split('.').pop())[0]?.value||'');
      render();
      try{
        converter.result=await RLFileTools.read(file,{onProgress:({done,total})=>{const el=shadow.querySelector('#convert-progress');if(el)el.textContent=`Reading slides · ${done} / ${total}`;}});
      }
      catch(e){converter.error=e.message||'Could not read the file.';}
      finally{converter.loading=false;render();}
      return;
    }
    if(event.target.id==='convert-format'){converter.format=event.target.value;converter.notice='';render();}
  });
  shadow.addEventListener('input', event => {
    if(event.target.name==='message') {
      messaging.draft=event.target.value;
      const send=shadow.querySelector('.send-button'); if(send)send.disabled=!(messaging.draft.trim())||messaging.sending;
      return;
    }
    if(event.target.dataset.input==='messages-search') {
      messaging.search=event.target.value;
      const holder=shadow.querySelector('.inbox-list');
      if(holder){
        const matches=filteredConversations();
        holder.querySelectorAll('.conversation-row').forEach(row=>{
          const convo=messaging.conversations.find(c=>String(c.id)===row.dataset.id);
          const isVisible=convo && matches.includes(convo);
          row.hidden=!isVisible;
        });
        holder.querySelector('.messages-no-results')?.remove();
        if(!matches.length) holder.insertAdjacentHTML('beforeend',`<div class="messages-no-results messages-placeholder">${ic('search',18)}<strong>No matches</strong></div>`);
      }
      return;
    }
    if (!['search','resource-search'].includes(event.target.dataset.input)) return;
    const selector=event.target.dataset.input;
    if (selector==='search') query=event.target.value; else resourceQuery=event.target.value;
    const start=event.target.selectionStart;
    render();
    const next=shadow.querySelector(`[data-input="${selector}"]`);
    if (next) {next.focus();try {next.setSelectionRange(start,start);} catch {} }
  });
  document.addEventListener('pointerdown', e=>{
    if(!appearanceOpen || (e.composedPath?.() || []).some(node=>node?.classList?.contains?.('appearance-wrap')))return;
    appearanceOpen=false;setTimeout(()=>{if(!native)render();},0);
  },true);
  // Keyboard shortcut: / focuses course search when browsing course cards.
  shadow.addEventListener('keydown', event => {
    if(event.key==='Enter' && event.target.closest?.('.message-compose textarea') && !event.shiftKey){event.preventDefault();messaging.draft=event.target.value;sendMoodleMessage();return;}
    if(event.key==='Escape' && viewer){event.preventDefault();closeViewer();return;}
    if(event.key==='Escape' && appearanceOpen){appearanceOpen=false;render();return;}
    if(event.key==='/' && !['INPUT','TEXTAREA'].includes(event.target.tagName) && view==='courses') {
      event.preventDefault(); shadow.querySelector('[data-input="search"]')?.focus();
    }
  });

  (async () => {
    await load();
    // Keep the source page available for navigation, but disable accidental
    // interaction with content hidden underneath the new frontend.
    document.body.inert = true;
    courses=[...(state.courseCache||[])];
    scan();
    if (!courses.length) fetchCourses();
    if (isCourse) {
      // Open the most useful sections by default; Moodle may hydrate later.
      expanded.clear();
    }
    const observer = new MutationObserver(mutations => {
      if (mutations.every(m => mount.contains(m.target))) return;
      clearTimeout(scanTimer);
      scanTimer=setTimeout(scan,500);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(scan,1800);
    setTimeout(scan,4500);
    setTimeout(scan,10000);
    setTimeout(() => { if(!ready && !native) render(); },5500);
    setTimeout(() => { if(!ready && !native) render(); },8500);
    focusTick=setInterval(updateTimerUi,1000);
    window.addEventListener('pagehide',()=>{document.body.inert=false;clearInterval(focusTick);observer.disconnect();});
  })();
})();
