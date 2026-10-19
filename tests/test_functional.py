import asyncio,base64,pathlib
from playwright.async_api import async_playwright
base=pathlib.Path(__file__).resolve().parents[1]
js=(base/'content.js').read_text().replace('const path = location.pathname;', 'const path = window.__RL_TEST_PATH;').replace("const style = document.createElement('link');", "const style = document.createElement('style');").replace("style.href = chrome.runtime.getURL('styles.css');", "style.textContent = atob('"+base64.b64encode((base/'styles.css').read_bytes()).decode()+"');")
js=js.replace("const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;", "const COURSE_BASE = 'https://elearn.just.edu.jo/current/my/courses.php';")
stub='''window.chrome={runtime:{getURL:p=>p},storage:{local:{get:async()=>({"rattibha-learn-v1":window.__RL_INITIAL_STATE||{}}),set:async()=>({})}}}'''
def fixture():
 return '''<html><head><title>JUST</title></head><body><h1>NES312-FUNDAMENTALS OF COMPUTER NETWORKS (2)</h1><div class="course-content">
 <li class="section" data-for="section"><h3 class="sectionname">General</h3>
 <ul><li class="activity"><div class="activity-item"><div class="activityname"><a href="https://elearn.just.edu.jo/current/mod/forum/view.php?id=11">Announcements</a></div><div class="activity-description"><div class="no-overflow">Dear ALL: All materials are posted in the All Sections page.</div></div></div></li>
 <li class="activity"><div class="activity-item"><div class="contentwithoutlink"><div class="no-overflow">Welcome to fundamentals of computer networks. Read the syllabus carefully.</div></div></div></li></ul>
 </li><li class="section" data-for="section"><h3 class="sectionname">18 October - 24 October</h3><ul><li class="activity"><div class="activity-item"><div class="activityname"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id=201">Lecture One PDF</a></div></div></li></ul></li>
 <li class="section" data-for="section"><h3 class="sectionname">25 October - 31 October</h3></li></div></body></html>'''
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1400,'height':850})
  errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  await page.set_content('<body><h1>My courses</h1><main id="region-main"></main></body>')
  await page.evaluate("window.__RL_TEST_PATH='/current/my/courses.php';"+stub)
  await page.evaluate('''window.fetch=async (url,opts)=>{if(String(url).includes('service.php'))return {ok:true,json:async()=>[{data:{courses:[{id:1,viewurl:'https://elearn.just.edu.jo/current/course/view.php?id=1',fullname:'NES312-FUNDAMENTALS OF COMPUTER NETWORKS (2)'},{id:2,viewurl:'https://elearn.just.edu.jo/current/course/view.php?id=2',fullname:'NES312-FUNDAMENTALS OF COMPUTER NETWORKS (All Sections)'},{id:3,viewurl:'https://elearn.just.edu.jo/current/course/view.php?id=3',fullname:'CPE451-Introduction to Embedded Systems (6)'}]}}]};return {ok:true,url:'https://elearn.just.edu.jo/current/my/courses.php',text:async()=>'<script>M.cfg={"sesskey":"abcdefg"};</script>'};};''')
  await page.add_script_tag(content=js)
  await page.wait_for_timeout(1100)
  root=page.locator('#rattibha-learn-root')
  print('Course retrieval and grouping:',await root.locator('.subject-row').count(),'subjects')
  assert await root.locator('.subject-row').count()==2
  assert await root.get_by_text('All Sections').count() >= 1
  assert await root.get_by_text('Fundamentals Of Computer Networks').count()>=1
  await root.locator('button[data-action=appearance]').click()
  print('swatches',await root.locator('.swatch').count())
  assert await root.locator('.swatch').count()==8
  await root.locator('button[data-action=accent]').nth(6).click()
  assert await root.locator('.app').get_attribute('data-accent')=='ocean'
  await page.close()
  page=await browser.new_page(viewport={'width':1400,'height':850})
  page.on('pageerror',lambda e:errs.append(str(e)))
  await page.set_content(fixture())
  initial={"courseCache":[{"id":"1","href":"https://elearn.just.edu.jo/current/course/view.php?id=1","name":"NES312-FUNDAMENTALS OF COMPUTER NETWORKS (2)","code":"NES312","label":"FUNDAMENTALS OF COMPUTER NETWORKS","shared":False},{"id":"2","href":"https://elearn.just.edu.jo/current/course/view.php?id=2","name":"NES312-FUNDAMENTALS OF COMPUTER NETWORKS (All Sections)","code":"NES312","label":"FUNDAMENTALS OF COMPUTER NETWORKS","shared":True}]}
  await page.evaluate("window.__RL_TEST_PATH='/current/course/view.php';window.__RL_INITIAL_STATE="+str(initial).replace('False','false').replace('True','true').replace("'",'"')+';'+stub)
  await page.evaluate('''window.fetch=async(url,opts)=>{if(String(url).includes('resource/view.php'))return {ok:true,headers:{get:(k)=>'application/pdf'},url:String(url),blob:async()=>new Blob(['%PDF-1.4 test'],{type:'application/pdf'})};throw Error('offline fixture')};void 0;''')
  await page.add_script_tag(content=js)
  await page.wait_for_timeout(400)
  root=page.locator('#rattibha-learn-root')
  print('tabs', await root.locator('.course-tab').all_text_contents())
  print('materials', await root.locator('.resource-row').all_text_contents())
  assert await root.locator('.course-tab').count()==2
  assert await root.locator('.resource-row').count()>=2
  # announcement text should be inside viewer; click announcement
  await root.locator('.resource-row').get_by_text('Announcements').click()
  await page.wait_for_timeout(250)
  assert 'Dear ALL' in await root.locator('.viewer-body').inner_text()
  await root.locator('.viewer-close').click()
  await root.locator('.resource-row').get_by_text('Lecture One PDF').click()
  await page.wait_for_timeout(200)
  assert await root.locator('iframe.pdf-frame').count()==1
  await page.close()
  print('In-page announcement and PDF preview: OK')
  assert not errs
  await browser.close()
asyncio.run(main())
