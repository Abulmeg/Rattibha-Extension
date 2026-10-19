"""Realistic Moodle resource wrapper -> external PDF, Word/PPTX download, and HTML links."""
import asyncio,base64,pathlib
from playwright.async_api import async_playwright
base=pathlib.Path(__file__).resolve().parents[1]
js=(base/'content.js').read_text().replace('const path = location.pathname;', 'const path = window.__RL_TEST_PATH;')
js=js.replace("const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;","const COURSE_BASE = 'https://elearn.just.edu.jo/current/my/courses.php';")
js=js.replace("const style = document.createElement('link');", "const style = document.createElement('style');").replace("style.href = chrome.runtime.getURL('styles.css');", "style.textContent = atob('"+base64.b64encode((base/'styles.css').read_bytes()).decode()+"');")
html='''<body><h1>CPE451-Introduction to Embedded Systems (All Sections)</h1><div class="course-content"><section class="course-section" data-for="section"><h3 class="sectionname">General</h3>
<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id=51">2nd Edition</a></li>
<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id=52">Week 1.docx</a></li>
<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id=53">Lecture.pptx</a></li>
<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id=54">Samples.zip</a></li>
<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id=55">Lecture handout</a></li>
<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/page/view.php?id=56">More details</a></li>
</section></div></body>'''

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1350,'height':900})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(html)
  await page.evaluate('''window.__RL_TEST_PATH='/current/course/view.php';window.__DOWNLOADS=[];
  window.chrome={runtime:{id:'extension-test',getURL:p=>p,sendMessage:async (args)=>{window.__DOWNLOADS.push(args);return {ok:true,id:123};}},storage:{local:{get:async()=>({}),set:async()=>({})}}};
  const wrap=(body)=>new Response(body,{headers:{'Content-Type':'text/html'}});
  window.fetch=async (url)=>{
    const s=String(url);
    if(s.includes('id=51'))return wrap('<main id="region-main"><p>Click on <a href="https://staroceans.org/kernel-and-driver/Designing%20Embedded%20Systems%20With%20PIC%20Microcontrollers%202nd%20Ed.pdf">2nd Edition</a> to open the resource.</p></main>');
    if(s.includes('id=52'))return wrap('<main id="region-main"><a href="/current/pluginfile.php/55/notes/Week%201.docx?forcedownload=1">Week 1</a></main>');
    if(s.includes('id=53'))return wrap('<main id="region-main"><a href="https://example.org/slides.pptx">Lecture</a></main>');
    if(s.includes('id=54'))return wrap('<main id="region-main"><a href="/current/pluginfile.php/55/samples.zip">Download</a></main>');
    if(s.includes('id=55'))return new Response(new Blob(['%PDF-1.4 content'],{type:'application/pdf'}),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Handout.pdf"'}});
    if(s.includes('id=56'))return wrap('<main id="region-main"><p>Useful lecture materials:</p><a href="/current/pluginfile.php/99/topic.pdf">PDF notes</a> <a href="https://example.org/references.docx">Reference</a></main>');
    return new Response('Not found',{status:404});
  };''')
  await page.add_script_tag(content=js)
  await page.wait_for_timeout(350)
  root=page.locator('#rattibha-learn-root')
  rows=root.locator('.resource-row')
  assert await rows.count()==6,(errors,await page.locator('body').inner_text())
  await rows.get_by_text('2nd Edition').click()
  frame=root.locator('iframe.pdf-frame')
  await frame.wait_for(state='attached')
  url=await frame.get_attribute('src')
  assert 'staroceans.org' in url and url.endswith('.pdf'),url
  assert await root.locator('.viewer-download').count()==1
  await root.locator('button[data-action=viewer-download]').first.click()
  assert 'staroceans.org' in await page.evaluate('window.__DOWNLOADS[0].url')
  print('External PDF inside viewer with direct download: OK')
  await root.locator('.viewer-close').click()
  await rows.get_by_text('Week 1.docx').click()
  await page.wait_for_timeout(150)
  assert await root.locator('.viewer-backdrop').count()==0
  assert 'pluginfile.php' in await page.evaluate('window.__DOWNLOADS.at(-1).url')
  assert 'Week 1.docx' in await page.evaluate('window.__DOWNLOADS.at(-1).filename')
  print('DOCX immediately downloads, no fake preview: OK')
  await rows.get_by_text('Lecture.pptx').click()
  await page.wait_for_timeout(150)
  assert await root.locator('.viewer-backdrop').count()==0
  assert await page.evaluate('window.__DOWNLOADS.at(-1).url')=='https://example.org/slides.pptx'
  print('PPTX immediately downloads: OK')
  await rows.get_by_text('Samples.zip').click()
  await page.wait_for_timeout(150)
  assert await page.evaluate('window.__DOWNLOADS.at(-1).url')=='https://elearn.just.edu.jo/current/pluginfile.php/55/samples.zip'
  print('ZIP immediately downloads: OK')
  await rows.get_by_text('Lecture handout').click()
  await page.wait_for_timeout(120)
  # The resource has a PDF content-type, so preview uses an internal blob URL.
  assert await root.locator('iframe.pdf-frame').count()==1
  assert (await root.locator('iframe.pdf-frame').get_attribute('src')).startswith(('blob:','https://'))
  await root.locator('.viewer-close').click()
  print('PDF MIME loaded in viewer: OK')
  await rows.get_by_text('More details').click()
  await page.wait_for_timeout(120)
  # Page with an associated PDF is correctly resolved instead of showing dead 'Click on...'.
  assert await root.locator('iframe.pdf-frame').count()==1
  print('Relative links on resource pages resolved against fetched page: OK')
  assert not errors,errors
  await browser.close()
asyncio.run(main())
