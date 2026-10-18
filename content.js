/* Rattibha Learn — first student-facing prototype for JUST Moodle.
   Runs as an isolated shadow-DOM interface. Never requests credentials, and
   Moodle's underlying DOM and existing actions remain available. */
(() => {
  'use strict';
  if (window.__rattibhaLearnLoaded) return;
  window.__rattibhaLearnLoaded = true;

  const path = location.pathname;
  const isCourses = /\/my\/courses\.php$/.test(path);
  const isCourse = /\/course\/view\.php$/.test(path);
  if (!isCourses && !isCourse) return;

  const STORE = 'rattibha-learn-v1'; // Preserve existing tasks, bookmarks, preferences
  const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;
  const defaults = () => ({
    favorites: [], tasks: [], recent: [], starredResources: [], resourceLabels: {},
    theme: 'light', accent: 'blue', duration: 25, focus: null
  });
  let state = defaults();
  let courses = [];
  let course = null;
  let view = isCourse ? 'course' : 'home';
  let query = '';
  let resourceQuery = '';
  let filter = 'all';
  let native = false;
  let ready = false;
  let initialized = false;
  let appearanceOpen = false;
  let resourceFilter = 'All';
  let shownView = '';
  const accentNames = ['blue','indigo','violet','teal','rose','amber'];
  let scanTimer;
  let scanCount = 0;
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
    command: '<path d="M9 7V5.5a2.5 2.5 0 1 0-2.5 2.5H9Zm0 0v10m0-10h6m-6 10H6.5A2.5 2.5 0 1 0 9 19.5V17Zm6-10h2.5A2.5 2.5 0 1 0 15 4.5V7Zm0 0v10m0 0v2.5a2.5 2.5 0 1 0 2.5-2.5H15Z"/>'
  };
  const ic = (name, size = 19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const validUrl = raw => {
    try {
      const u = new URL(raw, location.href);
      return (u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === location.hostname)) ? u.href : '';
    } catch { return ''; }
  };
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
    if (isShared(name)) return 'Shared materials';
    const match = name.match(/\(\s*(\d+)\s*\)\s*$/);
    return match ? `Section ${match[1]}` : 'Course page';
  };
  const timeShort = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  const uniq = arr => [...new Set(arr)];
  const badge = (txt, tone = '') => `<span class="badge ${tone}">${esc(txt)}</span>`;
  const getFavorite = id => state.favorites.includes(id);
  const safeLink = (href, label, cls = '') => href ? `<a class="${cls}" href="${esc(href)}">${label}</a>` : `<span>${label}</span>`;
  const typeFrom = (href, title) => {
    const txt = `${href} ${title}`.toLowerCase();
    if (/assign|assignment|mod\/assign/.test(txt)) return 'Assignment';
    if (/mod\/quiz|\bquiz\b|exam/.test(txt)) return 'Quiz';
    if (/mod\/forum|forum/.test(txt)) return 'Forum';
    if (/\.pdf\b|\.docx?\b|\.pptx?\b|\.xlsx?\b|\/mod\/resource/.test(txt)) return 'File';
    if (/mod\/url|youtube|video/.test(txt)) return 'Link';
    return 'Resource';
  };
  const typeIcon = type => ({Assignment:'clipboard',Quiz:'checkcircle',Forum:'book',Link:'link',File:'file',Resource:'file'}[type] || 'file');
  const timerRemaining = () => {
    if (!state.focus) return state.duration * 60;
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

  function extractCourses() {
    const cards = [...document.querySelectorAll('.dashboard-card[data-region="course-content"], .dashboard-card')];
    const items = [];
    if (cards.length) {
      cards.forEach(card => {
        const a = card.querySelector('.coursename a[href*="course/view.php"], .course-info-container a[href*="course/view.php"], a[href*="course/view.php"]');
        if (!a) return;
        const href = validUrl(a.getAttribute('href'));
        if (!href) return;
        const visible = a.cloneNode(true);
        visible.querySelectorAll('.sr-only,.accesshide,.visually-hidden,[aria-hidden="true"]').forEach(el => el.remove());
        const name = cleanCourseTitle(visible.textContent || a.getAttribute('title') || card.querySelector('.coursename')?.textContent);
        if (!name) return;
        items.push({id:courseIdFrom(href), href, name, code:courseCode(name), label:courseName(name), shared:isShared(name)});
      });
    }
    if (!items.length) {
      // Alternate Moodle/Boost themes: use actual course links inside the course overview.
      const scope = document.querySelector('[data-region="myoverview"], .block_myoverview, #region-main') || document;
      scope.querySelectorAll('a[href*="/course/view.php?id="]').forEach(a => {
        const href = validUrl(a.getAttribute('href'));
        const visible=a.cloneNode(true);
        visible.querySelectorAll('.sr-only,.accesshide,.visually-hidden,[aria-hidden="true"]').forEach(el => el.remove());
        const name = cleanCourseTitle(visible.textContent || a.getAttribute('title'));
        if (href && name.length > 5) items.push({id:courseIdFrom(href), href, name, code:courseCode(name), label:courseName(name), shared:isShared(name)});
      });
    }
    return [...new Map(items.map(c => [c.id, c])).values()];
  }

  function extractCourse() {
    const heading = document.querySelector('h1, #page-header h1, .page-header-headings h1');
    const title = cleanCourseTitle(heading?.textContent || document.title.replace(/\s*\|.*/, '')) || 'Course';
    const id = activeCourseId() || title;
    const sections = [];
    const sectionNodes = [...document.querySelectorAll('[data-for="section"], .course-content li.section, .course-content .course-section')];
    const seen = new Set();
    sectionNodes.forEach((node, index) => {
      if (node.closest('[data-for="section"]') && node.closest('[data-for="section"]') !== node) return;
      const name = clean(node.querySelector('[data-for="section_title"], .sectionname, .section-title, h3, h4')?.textContent) || (index === 0 ? 'General' : `Section ${index}`);
      const resources = [];
      let activities = [...node.querySelectorAll('[data-for="cmitem"], li.activity, .activity-item')];
      // Moodle wraps activity-item inside [data-for=cmitem]; select only outermost item.
      activities = activities.filter(a => !activities.some(b => b !== a && b.contains(a)));
      activities.forEach(activity => {
        const a = activity.querySelector('.activityname a[href], a.aalink[href], .activityinstance a[href], a[href*="/mod/"]');
        if (!a) return;
        const href = validUrl(a.getAttribute('href'));
        const label = clean(a.querySelector('.instancename')?.textContent || a.textContent || a.getAttribute('title'));
        if (!href || !label || seen.has(`${href}-${label}`)) return;
        seen.add(`${href}-${label}`);
        resources.push({name:label, href, type:typeFrom(href, label)});
      });
      sections.push({name, resources, index, current:/current week|this week|الأسبوع الحالي/i.test(node.textContent || '') || !!node.querySelector('.currentweek')});
    });
    return {id, name:title, code:courseCode(title), label:courseName(title), sections, href:location.href};
  }

  function scan() {
    if (native) return;
    const next = isCourses ? extractCourses() : extractCourse();
    if (isCourses) {
      const old = courses.map(c => `${c.id}:${c.name}`).join('|');
      const now = next.map(c => `${c.id}:${c.name}`).join('|');
      if (old !== now || !initialized) { courses = next; render(); }
      ready = next.length > 0;
    } else {
      const old = JSON.stringify((course?.sections || []).map(s => `${s.name}:${s.resources.length}`));
      const now = JSON.stringify(next.sections.map(s => `${s.name}:${s.resources.length}`));
      if (old !== now || !initialized) { course = next; render(); }
      ready = true;
    }
    initialized = true;
    scanCount++;
  }

  const navItem = (target, label, glyph) => `<button type="button" class="nav-link ${view === target ? 'active':''}" data-action="nav" data-target="${target}">${ic(glyph,17)}<span>${label}</span></button>`;
  const countTasks = () => state.tasks.filter(t => !t.done).length;
  const countFav = () => courses.filter(c => getFavorite(c.id)).length;
  const progressPct = () => {
    const full = (state.focus?.duration || state.duration) * 60;
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
    const n = countTasks();
    return `<div class="app ${esc(state.theme)}" data-accent="${esc(state.accent || 'blue')}">
      <header class="header"><div class="topbar"><a href="${esc(COURSE_BASE)}" class="brand" title="Rattibha Learn home"><span class="brand-mark">R<span class="brand-dot"></span></span><span class="brand-name">Rattibha <b>Learn</b></span></a>
      <nav class="top-nav" aria-label="Main navigation">${isCourses ? navItem('home','Home','grid') : `<a class="nav-link" href="${esc(COURSE_BASE)}">${ic('grid',17)} Home</a>`}${isCourses ? navItem('courses','Courses','book') : `<a class="nav-link ${view==='course'?'active':''}" href="${esc(COURSE_BASE)}">${ic('book',17)} Courses</a>`}${navItem('tasks',`Tasks${n ? ` <span class="nav-count">${n}</span>` : ''}`,'checkcircle')}</nav>
      <div class="header-tools"><button class="focus-shortcut" data-action="nav" data-target="focus" title="Focus timer">${ic('timer',16)} <span id="timer-face">${timeShort(timerRemaining())}</span></button><div class="appearance-wrap"><button class="icon-button appearance-toggle ${appearanceOpen?'opened':''}" data-action="appearance" title="Appearance" aria-label="Appearance" aria-haspopup="true" aria-expanded="${appearanceOpen}">${ic('palette',18)}</button>${appearanceOpen ? appearanceMenu() : ''}</div><button class="native-link" data-action="native" title="Return to original eLearning">Original site ${ic('external',14)}</button></div></div></header>
      <div class="workspace"><main class="main" id="main">${main}</main></div>
      <nav class="mobile-nav" aria-label="Mobile navigation">${isCourses ? navItem('home','Home','grid') : `<a class="nav-link" href="${esc(COURSE_BASE)}">${ic('grid',17)} Home</a>`}${isCourses ? navItem('courses','Courses','book') : `<a class="nav-link" href="${esc(COURSE_BASE)}">${ic('book',17)} Courses</a>`}${navItem('tasks','Tasks','checkcircle')}${navItem('focus','Focus','timer')}</nav>
    </div>`;
  }
  function appearanceMenu() {
    return `<div class="appearance-menu" role="group" aria-label="Appearance"><div class="menu-heading"><strong>Appearance</strong><span>Make it yours</span></div><div class="menu-label">Theme</div><div class="theme-switch"><button class="${state.theme==='light'?'selected':''}" data-action="theme-choice" data-choice="light" aria-pressed="${state.theme==='light'}">${ic('sun',16)} Light</button><button class="${state.theme==='dark'?'selected':''}" data-action="theme-choice" data-choice="dark" aria-pressed="${state.theme==='dark'}">${ic('moon',16)} Dark</button></div><div class="menu-label">Accent</div><div class="accent-options">${accentNames.map(c=>`<button class="swatch swatch-${c} ${state.accent===c?'selected':''}" data-action="accent" data-choice="${c}" title="${c}" aria-label="${c}" aria-pressed="${state.accent===c}">${state.accent===c ? ic('check',15) : ''}</button>`).join('')}</div></div>`;
  }
  const blank = (glyph, title, desc) => `<div class="empty">${ic(glyph,24)}<strong>${esc(title)}</strong>${desc ? `<span>${esc(desc)}</span>` : ''}</div>`;
  function courseCard(g) {
    return `<article class="subject-row"><span class="subject-icon">${ic('book',18)}</span><div class="subject-main"><div class="subject-head"><span class="subject-code">${esc(g.code || 'COURSE')}</span><a class="subject-title" href="${esc(g.entries[0].href)}" data-course-open="${esc(g.entries[0].id)}">${esc(displayCourseLabel(g.label || g.entries[0].name))}</a></div><div class="subject-links">${g.entries.map(c=>`<a class="section-chip ${c.shared?'shared':''}" href="${esc(c.href)}" data-course-open="${esc(c.id)}">${esc(sectionLabel(c.name))}${ic('arrow',13)}</a>`).join('')}</div></div><button class="star-button ${g.fav?'selected':''}" data-action="favorite-group" data-group="${esc(g.key)}" title="${g.fav?'Unpin course':'Pin course'}" aria-label="${g.fav?'Unpin course':'Pin course'}">${ic('star',17)}</button></article>`;
  }
  function courseGrid(list) { return `<div class="subject-list">${list.map(courseCard).join('')}</div>`; }
  function loadingCourses() { return `<div class="skeleton-grid">${[1,2,3,4].map(()=>'<div class="skeleton"></div>').join('')}</div>`; }
  function searchBar() {return `<label class="search">${ic('search',18)}<input data-input="search" type="search" placeholder="Search your courses" value="${esc(query)}" aria-label="Search your courses" /></label>`;}
  function renderCourses() {
    const groups=filteredGroups();
    const total=groupCourses(courses).length;
    return `<div class="page-title"><div><h1>All courses</h1><p>${total ? `${total} subjects` : 'Find a course'}</p></div></div>
      <div class="library-toolbar">${searchBar()}<div class="filter-tabs"><button class="filter-pill ${filter!=='starred'?'active':''}" data-action="filter" data-filter="all">All</button><button class="filter-pill ${filter==='starred'?'active':''}" data-action="filter" data-filter="starred">${ic('star',14)} Pinned</button></div></div>
      ${groups.length ? courseGrid(groups) : (courses.length ? blank('search','No matching subjects','Try another search') : (Date.now()-mountedAt<12000?loadingCourses():blank('book','No courses found','Refresh the original Moodle page and try again')))}
      `;
  }


  const taskRow = task => `<div class="task-row ${task.done?'done':''}"><button class="task-check ${task.done?'checked':''}" data-action="taskdone" data-id="${esc(task.id)}" aria-label="${task.done?'Mark incomplete':'Mark complete'}">${task.done?ic('check',15):''}</button><div class="task-info"><strong>${esc(task.title)}</strong><small>${task.course ? `${esc(task.course)} · `:''}${task.due ? esc(task.due) : 'Personal task'}</small></div><button class="row-delete" data-action="taskdelete" data-id="${esc(task.id)}" title="Delete task" aria-label="Delete task">${ic('trash',16)}</button></div>`;
  function renderTaskList(limit = 999) {
    const items = [...state.tasks].sort((a,b)=>Number(a.done)-Number(b.done) || (a.due||'9999').localeCompare(b.due||'9999')).slice(0, limit);
    return items.length ? items.map(taskRow).join('') : blank('checkcircle','Nothing on your list','Add a study task to get started.');
  }
  function timerWidget(full=false) {
    const remaining=timerRemaining();
    return `<section class="focus-panel ${full?'focus-full':''}"><div class="panel-head"><h3>${ic('timer',18)} Focus</h3>${!full?`<button class="link-small" data-action="nav" data-target="focus">Open ${ic('arrow',14)}</button>`:''}</div>
      <div class="focus-line"><strong id="timer-face">${timeShort(remaining)}</strong><span>${timerIsRunning()?'In progress':state.focus?'Paused':'Ready'}</span></div><div class="focus-track"><div id="timer-progress-bar" style="width:${progressPct()}%"></div></div>
      <div class="duration-buttons">${[25,45,50].map(m=>`<button data-action="duration" data-minutes="${m}" class="duration ${state.duration===m?'selected':''}" ${timerIsRunning()?'disabled':''}>${m}m</button>`).join('')}</div>
      <div class="timer-actions"><button class="btn-primary" data-action="timer-toggle">${ic(timerIsRunning()?'pause':'play',15)} ${timerIsRunning()?'Pause':state.focus?'Resume':'Start focus'}</button><button class="btn-quiet" data-action="timer-reset" title="Reset timer" aria-label="Reset timer">${ic('reset',17)}</button></div>
    </section>`;
  }
  function taskPreview() {
    const outstanding=state.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    return `<section class="side-panel"><div class="panel-head"><h3>My tasks ${outstanding.length?`<span class="little-count">${outstanding.length}</span>`:''}</h3><button data-action="nav" data-target="tasks" class="link-small">View all ${ic('arrow',14)}</button></div>
      ${outstanding.slice(0,4).map(taskRow).join('')}
      <form id="quick-task-form" class="quick-task"><input type="text" name="title" placeholder="Add something to do..." maxlength="120" required aria-label="New task"/><button type="submit" aria-label="Add task">${ic('plus',18)}</button></form></section>`;
  }
  function savedPreview() {
    const items=[...state.starredResources.map(url=>({url,name:state.resourceLabels?.[url] || 'Saved file'})),...state.recent.filter(r=>!state.starredResources.includes(r.url))].slice(0,5);
    if (!items.length) return '';
    return `<section class="side-panel"><div class="panel-head"><h3>Recent files</h3></div><div class="recent-list">${items.map(r=>`<a class="recent-row" href="${esc(r.url)}" data-resource="${esc(r.url)}" data-resource-name="${esc(r.name)}">${ic('file',16)}<span>${esc(r.name)}</span>${ic('arrow',14)}</a>`).join('')}</div></section>`;
  }
  function renderHome() {
    const total=groupCourses(courses).length;
    const groups=filteredGroups();
    return `<div class="page-title home-title"><div><span class="page-kicker">JUST eLearning</span><h1>My courses<span class="title-count">${total || ''}</span></h1><p>Everything you need for your classes.</p></div><button data-action="nav" data-target="courses" class="page-action">${ic('search',17)} Browse all</button></div>
      <div class="overview-layout"><section class="overview-main"><div class="section-heading"><h2>Your subjects</h2><button class="link-small" data-action="nav" data-target="courses">See all ${ic('arrow',14)}</button></div>
      ${searchBar()}
      ${groups.length ? courseGrid(groups.slice(0,7)) : (courses.length ? blank('search','No matching courses','Try another search') : (Date.now()-mountedAt<12000?loadingCourses():blank('book','Waiting for courses','Moodle may still be loading')))}
      ${groups.length>7 ? `<button class="list-footer" data-action="nav" data-target="courses">Show all ${groups.length} subjects ${ic('arrow',16)}</button>`:''}</section>
      <aside class="overview-side">${taskPreview()}${savedPreview()}${timerWidget()}</aside></div>`;
  }


  function taskForm() {
    return `<form id="task-form" class="task-form"><label for="new-task">Task name</label><input id="new-task" type="text" name="title" required maxlength="120" placeholder="e.g. Review lecture 2"/><div class="form-row"><div><label for="task-course">Course (optional)</label><select id="task-course" name="course"><option value="">No course</option>${courses.map(c=>`<option value="${esc(c.code||c.label)}">${esc(c.code||c.label)}</option>`).join('')}</select></div><div><label for="task-due">Due date (optional)</label><input id="task-due" type="date" name="due"/></div></div><button type="submit" class="btn-primary">${ic('plus',18)} Add task</button></form>`;
  }
  function renderTasks() {
    return `<div class="page-title"><div><h1>My tasks</h1><p>Personal study reminders saved in this browser</p></div></div><div class="tasks-layout"><section class="pane"><h3>New task</h3>${taskForm()}</section><section class="pane"><div class="panel-head"><h3>Tasks</h3><span class="little-count">${countTasks()} remaining</span></div><div class="task-stack">${renderTaskList()}</div></section></div>`;
  }
  function renderFocus() {
    return `<div class="page-title"><div><h1>Focus timer</h1><p>Choose a duration and start when you're ready.</p></div></div><div class="focus-layout">${timerWidget(true)}</div>`;
  }


  function resourceRow(r, i) {
    const starred = state.starredResources.includes(r.href);
    return `<div class="resource-row"><div class="resource-icon">${ic(typeIcon(r.type),19)}</div><a class="resource-name" href="${esc(r.href)}" data-resource="${esc(r.href)}" data-resource-name="${esc(r.name)}"><strong>${esc(r.name)}</strong><small>${esc(r.type)}</small></a><button class="resource-star ${starred?'selected':''}" data-action="star-resource" data-url="${esc(r.href)}" title="${starred?'Remove bookmark':'Bookmark resource'}" aria-label="${starred?'Remove bookmark':'Bookmark resource'}">${ic('star',17)}</button><a class="resource-open" href="${esc(r.href)}" data-resource="${esc(r.href)}" data-resource-name="${esc(r.name)}" title="Open ${esc(r.name)}">${ic('arrow',18)}</a></div>`;
  }
  function renderCourse() {
    if (!course) return loadingCourses();
    const fav=getFavorite(course.id);
    const total=course.sections.reduce((sum,s)=>sum+s.resources.length,0);
    return `<div class="crumb"><a href="${esc(COURSE_BASE)}">Courses</a>${ic('chevron',14)}<span>${esc(course.code || 'Course')}</span></div>
      <div class="page-title course-title"><div><span class="page-kicker">${esc(course.code || 'COURSE')}</span><h1>${esc(displayCourseLabel(course.label || course.name))}</h1><p>${course.sections.length} sections · ${total} materials</p></div><button class="pin-course ${fav?'selected':''}" data-action="favorite" data-id="${esc(course.id)}">${ic('star',16)} ${fav?'Pinned':'Pin course'}</button></div>
      <div class="course-toolbar"><h2>Course content</h2><div class="section-commands"><label class="search resource-search">${ic('search',17)}<input type="search" data-input="resource-search" value="${esc(resourceQuery)}" placeholder="Find a file" aria-label="Find materials" /></label><button class="link-small" data-action="expandall">Expand all</button><button class="link-small" data-action="collapseall">Collapse</button></div></div><div class="resource-filters">${['All','File','Assignment','Quiz'].map(t=>`<button class="resource-pill ${resourceFilter===t?'selected':''}" data-action="resource-filter" data-filter="${t}">${t==='All'?'All materials':t==='File'?'Files':t==='Assignment'?'Assignments':'Quizzes'}</button>`).join('')}</div>
      <div class="sections-area">${course.sections.length ? course.sections.map((section,index)=>{
        const matching=section.resources.filter(r=>(!resourceQuery || r.name.toLowerCase().includes(resourceQuery.toLowerCase())) && (resourceFilter==='All' || r.type===resourceFilter));
        if((resourceQuery || resourceFilter!=='All') && !matching.length && !(resourceFilter==='All' && section.name.toLowerCase().includes(resourceQuery.toLowerCase())))return '';
        const visible=resourceQuery && !matching.length && resourceFilter==='All' ? section.resources : matching;
        const isOpen=(resourceQuery || resourceFilter!=='All')?true:(expanded.size===0 ? (index===0 || section.current) : expanded.has(index));
        return `<section class="section-block ${section.current?'current-section':''}"><button class="section-toggle" aria-expanded="${isOpen}" data-action="section" data-index="${index}"><span class="section-label"><span class="section-arrow ${isOpen?'open':''}">${ic('chevron',15)}</span><strong>${esc(section.name)}</strong>${section.current?'<span class="current-mark">This week</span>':''}</span><span class="section-end"><small>${visible.length} items</small></span></button>${isOpen?`<div class="section-resources">${visible.length?visible.map(resourceRow).join(''):`<div class="empty-section">No files here yet</div>`}</div>`:''}</section>`;
      }).join('') : blank('folder','No materials found','You can switch to the original page to view this course.')}</div>`;
  }


  function render() {
    if (native) {
      screen.innerHTML = `<div class="native-return"><button data-action="back-to-learn">${ic('grid',18)} Rattibha Learn ${ic('arrow',17)}</button></div>`;
      return;
    }
    let markup = '';
    if (view==='courses') markup = renderCourses();
    else if (view==='tasks') markup = renderTasks();
    else if (view==='focus') markup = renderFocus();
    else if (view==='course') markup = renderCourse();
    else markup = renderHome();
    screen.innerHTML = appShell(markup);
    updateTimerUi();
  }

  function updateTimerUi() {
    const seconds = timerRemaining();
    shadow.querySelectorAll('#timer-face').forEach(el => el.textContent = timeShort(seconds));
    shadow.querySelectorAll('#timer-progress-bar').forEach(el => el.style.width = `${progressPct()}%`);
    if (state.focus?.endAt && seconds===0) { state.focus = null; save(); render(); }
  }
  function navigate(target) {
    if (target==='course' && !isCourse) return;
    if(view===target) return;
    const old=shadow.querySelector('.main');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    view=target; appearanceOpen=false; render();
    const next=shadow.querySelector('.main');
    next?.scrollTo(0,0);
    if(!reduced && next?.animate){
      next.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
      [...next.querySelectorAll('.subject-row,.side-panel,.section-block,.pane')].slice(0,16).forEach((node,index)=>{node.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,delay:Math.min(index*28,220),easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});});
    }
  }
  function recordRecent(url,name) {
    if (!url) return;
    state.recent = [{url,name,at:Date.now()}, ...state.recent.filter(x => x.url!==url)].slice(0,20);
    save();
  }
  function makeNative(nativeValue) { native = nativeValue; document.body.inert = !native; render(); }

  shadow.addEventListener('click', async event => {
    const courseLink=event.target.closest('a[data-course-open]');
    if (courseLink) { state.recentCourses=uniq([courseLink.dataset.courseOpen,...(state.recentCourses||[])]).slice(0,15);save(); }
    const resource = event.target.closest('a[data-resource]');
    if (resource) { recordRecent(resource.dataset.resource, resource.dataset.resourceName); return; }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action==='nav') { navigate(button.dataset.target); return; }
    if (action==='native') { makeNative(true); return; }
    if (action==='back-to-learn') { makeNative(false); scan(); return; }
    if (action==='appearance') { appearanceOpen=!appearanceOpen; render(); return; }
    if (action==='theme-choice') {state.theme=button.dataset.choice;await save();render();return;}
    if (action==='accent') {state.accent=accentNames.includes(button.dataset.choice)?button.dataset.choice:'blue';await save();render();return;}
    if (action==='resource-filter') { resourceFilter=button.dataset.filter;render();return; }
    if (action==='rescan') { mountedAt=Date.now(); scan(); render(); return; }
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
      if (!expanded.size) {
        course.sections.forEach((s,i)=> { if (i===0||s.current) expanded.add(i); });
      }
      if (expanded.has(idx)) expanded.delete(idx); else expanded.add(idx);
      // For an all-collapsed state, sentinel ensures zero sections stay open.
      if (!expanded.size) expanded.add(-1);
      render(); return;
    }
    if (action==='expandall') {expanded.clear();course?.sections.forEach((s,i)=>expanded.add(i));render();return;}
    if (action==='collapseall') {expanded.clear();expanded.add(-1);render();return;}
    if (action==='duration') { if(timerIsRunning()) return; state.duration=Number(button.dataset.minutes);state.focus=null;await save();render();return; }
    if (action==='timer-toggle') {
      if (state.focus?.endAt) state.focus={...state.focus,left:timerRemaining(),endAt:null};
      else { const left=state.focus?.left || state.duration*60; state.focus={left,duration:state.focus?.duration||state.duration,endAt:Date.now()+left*1000}; }
      await save();render();return;
    }
    if (action==='timer-reset') {state.focus=null;await save();render();return;}
  });
  shadow.addEventListener('submit', async event => {
    if (!['task-form','quick-task-form'].includes(event.target.id)) return;
    event.preventDefault();
    const form = event.target;
    const title=clean(form.elements.title.value);
    if (!title) return;
    state.tasks=[{id:(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),title:title.slice(0,120),course:form.elements.course?.value || '',due:form.elements.due?.value || '',done:false},...state.tasks];
    await save();render();
  });
  shadow.addEventListener('input', event => {
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
    scan();
    if (isCourse) {
      // Moodle can hydrate content dynamically after document_idle.
      expanded.add(0);
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
    focusTick=setInterval(updateTimerUi,1000);
    window.addEventListener('pagehide',()=>{document.body.inert=false;clearInterval(focusTick);observer.disconnect();});
  })();
})();