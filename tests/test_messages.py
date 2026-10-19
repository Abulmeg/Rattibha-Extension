"""Isolated, sanitized Moodle messaging API fixture — no real JUST requests."""
import asyncio,base64,pathlib
from playwright.async_api import async_playwright
base=pathlib.Path(__file__).resolve().parents[1]
js=(base/'content.js').read_text().replace('const path = location.pathname;','const path = window.__RL_TEST_PATH;').replace("const style = document.createElement('link');","const style = document.createElement('style');").replace("style.href = chrome.runtime.getURL('styles.css');","style.textContent = atob('"+base64.b64encode((base/'styles.css').read_bytes()).decode()+"');").replace("const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;","const COURSE_BASE = 'https://elearn.just.edu.jo/current/my/courses.php';")
fixture='''<!doctype html><html><body><h1>My courses</h1><div id="region-main"><a href="https://elearn.just.edu.jo/current/course/view.php?id=11">CPE451-Introduction to Embedded Systems (2)</a></div><script>window.M={};M.cfg={"sesskey":"abcdef123","userid":71};</script></body></html>'''
fetchmock=r'''window.__sent=[];window.__unread=2;window.__threads={
 "501":[{id:11,useridfrom:62,text:"Hello, lecture files are uploaded!",timecreated:1792324800},{id:12,useridfrom:71,text:"Thanks!",timecreated:1792325000}],
 "502":[{id:13,useridfrom:65,text:"<b>Lab notes are ready.</b><script>alert('x')</script>",timecreated:1792324800}]
};
window.fetch=async(url, opts)=>{
 if(String(url).includes('service.php')){
  const payload=JSON.parse(opts.body)[0], method=payload.methodname, a=payload.args;
  window.__calls=(window.__calls||[]).concat(method);
  if(method==='core_message_get_conversations')return {ok:true,json:async()=>[{data:{conversations:[
    {id:501,members:[{id:71,fullname:'Student'},{id:62,fullname:'Lina Saeed'}],unreadcount:window.__unread,lastmessage:{text:'Hello, lecture files are uploaded!',timecreated:1792324800}},
    {id:502,members:[{id:71,fullname:'Student'},{id:65,fullname:'Sami Saleh'}],unreadcount:0,lastmessage:{text:'Lab notes are ready.',timecreated:1792324800}}
  ]}}]};
  if(method==='core_message_get_conversation_messages')return {ok:true,json:async()=>[{data:{messages:window.__threads[String(a.convid)]||[]}}]};
  if(method==='core_message_mark_all_conversation_messages_as_read'){window.__unread=0;return {ok:true,json:async()=>[{data:null}]};}
  if(method==='core_message_send_messages_to_conversation'){window.__sent.push(a);window.__threads[String(a.conversationid)].push({id:20,useridfrom:71,text:a.messages[0].text,timecreated:1792326000});return {ok:true,json:async()=>[{data:[{id:20}]}]};}
 }
 if(String(url).includes('courses.php'))return {ok:true,url:'https://elearn.just.edu.jo/current/my/courses.php',text:async()=>'<p>test</p>'};
 throw Error('unhandled fetch '+url)
};'''
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(fixture)
  await page.evaluate("window.__RL_TEST_PATH='/current/my/courses.php';window.chrome={runtime:{getURL:p=>p.endsWith('mark.svg')?'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyOSIgZmlsbD0iIzE4M0E2NSIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik0yNiAzNi41YzAtMy41IDIuOC02LjIgNi4zLTYuMiAxNS45IDAgMjUuOCAzLjQgMzEuNyA5LjF2NDguOGMtNi02LjEtMTYuMi05LjItMzIuNC05LjItMy4xIDAtNS42LTIuNC01LjYtNS42VjM2LjVaIi8+PHBhdGggZmlsbD0iI0E5RENGMCIgZD0iTTEwMiAzNi41YzAtMy41LTIuOC02LjItNi4zLTYuMi0xNS45IDAtMjUuOCAzLjQtMzEuNyA5LjF2NDguOGM2LTYuMSAxNi4yLTkuMiAzMi40LTkuMiAzLjEgMCA1LjYtMi40IDUuNi01LjZWMzYuNVoiLz48cGF0aCBkPSJNNjQgMzl2NDgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzE4M0E2NSIgc3Ryb2tlLXdpZHRoPSIzIi8+PHBhdGggZD0iTTIyIDkwYzE1LjctLjggMjguNyAyLjEgNDIgOSAxMy4zLTYuOSAyNi4zLTkuOCA0Mi05IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+':p},storage:{local:{get:async()=>({}),set:async()=>({})}}};"+fetchmock+'void 0;')
  await page.add_script_tag(content=js)
  root=page.locator('#rattibha-learn-root')
  await root.locator('.header-chat[data-target="messages"]').click()
  await page.wait_for_timeout(400)
  print('inbox items',await root.locator('.conversation-row').count());print('SCREEN', (await root.locator('.app').inner_text())[:2200]);print('ERRORS',errors);print('CALLS',await page.evaluate('window.__calls'))
  assert await root.locator('.conversation-row').count()==2
  assert await root.locator('.message-count').count()==1
  assert await root.locator('.message-count').inner_text()=='2'
  await page.screenshot(path='/mnt/data/rattibha-v06-inbox.png',full_page=True)
  await root.locator('.conversation-row').first.click()
  await page.wait_for_timeout(400)
  assert await root.locator('.chat-bubble').count()==2
  assert await root.get_by_text('Hello, lecture files are uploaded!').count()>=1
  await page.screenshot(path='/mnt/data/rattibha-v06-thread.png',full_page=True)
  await root.locator('.message-compose textarea').fill('See you in the lab.')
  await root.locator('.message-compose button[type=submit]').click()
  await page.wait_for_timeout(600)
  assert await root.get_by_text('See you in the lab.').count()>=1
  assert len(await page.evaluate('window.__sent'))==1
  print('sent message via Moodle RPC and updated thread')
  await root.locator('.conversation-row').nth(1).click()
  await page.wait_for_timeout(300)
  assert await root.get_by_text('Lab notes are ready.').count()>=1
  assert await root.locator('.viewer-backdrop').count()==0
  assert await root.locator('script').count()==0
  await root.locator('[data-input="messages-search"]').fill('zzzzzzz')
  assert await root.locator('.conversation-row:visible').count()==0
  await root.locator('[data-input="messages-search"]').fill('')
  await root.locator('button[data-action="messages-filter"]').click()
  assert await root.locator('.conversation-row:visible').count()==0
  print('search, unread filter, safe HTML text: OK')
  # Narrow screen tests and thread back behavior
  await page.set_viewport_size({'width':390,'height':844})
  await root.locator('.thread-back').click()
  await root.locator('button[data-action="messages-filter"]').click()
  await root.locator('.conversation-row').first.click()
  await page.wait_for_timeout(200)
  assert await root.locator('.thread-back').is_visible()
  assert await root.locator('.thread-panel').is_visible()
  await page.screenshot(path='/mnt/data/rattibha-v06-mobile-thread.png',full_page=True)
  await root.locator('.thread-back').click()
  assert await root.locator('.inbox-panel').is_visible()
  print('mobile split navigation: OK')
  assert not errors,errors
  await browser.close()
asyncio.run(main())
