import asyncio,base64,pathlib
from playwright.async_api import async_playwright
base=pathlib.Path(__file__).resolve().parents[1]
script=(base/'content.js').read_text().replace('const path = location.pathname;', 'const path = window.__RL_TEST_PATH;').replace("const style = document.createElement('link');", "const style = document.createElement('style');").replace("style.href = chrome.runtime.getURL('styles.css');", "style.textContent = atob('"+base64.b64encode((base/'styles.css').read_bytes()).decode()+"');")
script=script.replace("const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;", "const COURSE_BASE = 'https://elearn.just.edu.jo/current/my/courses.php';")
chrome_stub="window.chrome={runtime:{getURL:p=>p},storage:{local:{get:async()=>({}),set:async()=>({})}}}"
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await b.new_page(viewport={'width':1280,'height':600})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content('<body><main><h1>My courses</h1><div id="region-main"></div></main></body>')
  await page.evaluate("window.__RL_TEST_PATH='/current/my/courses.php';"+chrome_stub)
  await page.add_script_tag(content=script)
  await page.wait_for_timeout(8700)
  root=page.locator('#rattibha-learn-root')
  assert await root.get_by_text("Courses didn't load").count()==1
  assert await root.locator('button[data-action=native]').count()>=1
  await root.locator('.recover button[data-action=native]').click()
  assert await page.evaluate('document.body.inert') == False
  print('empty-state fallback ok')
  await page.close()
  # 20 weeks - one current, other current markers should not appear.
  html='<h1>CPE451-Introduction to Embedded Systems (All Sections)</h1><div class="course-content">'
  for i in range(20):
   title = ['11 October - 17 October','18 October - 24 October','25 October - 31 October'][i%3] if i<3 else f'Section {i}'
   resources = '<li class="activity"><a href="https://elearn.just.edu.jo/current/mod/resource/view.php?id='+str(i)+'">Lab '+str(i)+'</a></li>' if i==1 else ''
   html+=f'<section class="course-section" data-for="section"><h3 class="sectionname">{title}</h3>{resources}</section>'
  html+='</div>'
  page=await b.new_page(viewport={'width':1300,'height':580})
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(html)
  await page.evaluate("window.__RL_TEST_PATH='/current/course/view.php';"+chrome_stub)
  await page.add_script_tag(content=script)
  await page.wait_for_timeout(350)
  root=page.locator('#rattibha-learn-root')
  assert await root.locator('.current-mark').count()==1, 'exactly one current week'
  assert await root.locator('.section-block').count()==1, 'hide empty weeks'
  assert await root.locator('.resource-row').count()==1, 'resource fallback'
  await root.locator('.show-weeks').click()
  assert await root.locator('.section-block').count()==20
  await root.locator('button[data-action=expandall]').click()
  await root.locator('.main').evaluate('(el)=>el.scrollTop=350')
  prev=await root.locator('.main').evaluate('(el)=>el.scrollTop')
  await root.locator('.section-toggle').nth(5).click()
  await page.wait_for_timeout(250)
  pos=await root.locator('.main').evaluate('(el)=>el.scrollTop')
  assert pos>0 and abs(pos-prev)<150, (prev,pos)
  print('week matching, fallback extraction, scroll retention ok')
  assert not errors,errors
  await b.close()
asyncio.run(main())
