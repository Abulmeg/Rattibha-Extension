"""Browser smoke tests for local Office reading and conversion without any server."""
import asyncio,base64,pathlib,io,zipfile
from playwright.async_api import async_playwright
base=pathlib.Path(__file__).resolve().parents[1]
js=(base/'content.js').read_text().replace('const path = location.pathname;', 'const path = window.__RL_TEST_PATH;').replace("const style = document.createElement('link');", "const style = document.createElement('style');").replace("style.href = chrome.runtime.getURL('styles.css');", "style.textContent = atob('"+base64.b64encode((base/'styles.css').read_bytes()).decode()+"');").replace("const COURSE_BASE = new URL('/current/my/courses.php', location.origin).href;", "const COURSE_BASE = 'https://elearn.just.edu.jo/current/my/courses.php';")

def zipbytes(entries):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
  for name,content in entries.items():z.writestr(name,content)
 return b.getvalue()

docx=zipbytes({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Lab report test</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:body></w:document>'})
pptx=zipbytes({'ppt/slides/slide1.xml':'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>First slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>','ppt/slides/slide2.xml':'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'})
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1400,'height':900},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content('<html><body><main id="region-main"><h1>My courses</h1></main></body></html>')
  await page.evaluate("window.__RL_TEST_PATH='/current/my/courses.php';window.chrome={runtime:{getURL:p=>p},storage:{local:{get:async()=>({}),set:async()=>({})}}};window.fetch=async (url)=>({ok:true,url:'https://elearn.just.edu.jo/current/my/courses.php',text:async()=>'<div>test</div>'});")
  await page.add_script_tag(path=str(base/'vendor/jszip.min.js'))
  await page.add_script_tag(path=str(base/'pdf-generator.js'))
  await page.add_script_tag(path=str(base/'file-tools.js'))
  await page.evaluate("() => {window.chrome.runtime.getURL = p => String(p).endsWith('mark-white.svg') ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTI2IDM2LjVjMC0zLjUgMi44LTYuMiA2LjMtNi4yIDE1LjkgMCAyNS44IDMuNCAzMS43IDkuMXY0OC44Yy02LTYuMS0xNi4yLTkuMi0zMi40LTkuMi0zLjEgMC01LjYtMi40LTUuNi01LjZWMzYuNVoiLz48cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNMTAyIDM2LjVjMC0zLjUtMi44LTYuMi02LjMtNi4yLTE1LjkgMC0yNS44IDMuNC0zMS43IDkuMXY0OC44YzYtNi4xIDE2LjItOS4yIDMyLjQtOS4yIDMuMSAwIDUuNi0yLjQgNS42LTUuNlYzNi41WiIvPjxwYXRoIGQ9Ik02NCAzOXY0OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMjIgOTBjMTUuNy0uOCAyOC43IDIuMSA0MiA5IDEzLjMtNi45IDI2LjMtOS44IDQyLTkiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=' : p; }")
  await page.add_script_tag(content=js)
  root=page.locator('#rattibha-learn-root')
  await root.locator('button[data-target="convert"]').first.click()
  await root.locator('#convert-file').set_input_files({'name':'lab.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':docx})
  await page.wait_for_timeout(350)
  assert not await root.locator('.convert-error').count()
  assert await root.locator('select#convert-format option').count()==3
  assert await root.locator('.convert-controls').is_visible()
  assert await root.locator('#convert-format').input_value()=='pdf'
  assert await root.locator('button[data-action=convert-run]').inner_text() == 'Download PDF'
  await page.screenshot(path='/mnt/data/rattibha-v010-convert-pdf.png',full_page=True)
  async with page.expect_download() as d:
   await root.locator('button[data-action=convert-run]').click()
  assert (await d.value).suggested_filename=='lab.pdf'
  print('DOCX -> PDF direct download, no Print dialog')
  await root.locator('select#convert-format').select_option('txt')
  print('DOCX recognized and 3 valid export actions shown')
  await root.locator('button[data-action=appearance]').click()
  await root.locator('button[data-action=accent][data-choice=violet]').click()
  await page.screenshot(path='/mnt/data/rattibha-v08-convert-docx.png',full_page=True)
  async with page.expect_download() as download_info:
   await root.locator('button[data-action="convert-run"]').click()
  download=await download_info.value
  assert download.suggested_filename=='lab.txt'
  print('DOCX -> TXT:',download.suggested_filename)
  await root.locator('#convert-file').set_input_files({'name':'class.pptx','mimeType':'application/vnd.openxmlformats-officedocument.presentationml.presentation','buffer':pptx})
  await page.wait_for_timeout(250)
  assert not await root.locator('.convert-error').count()
  await root.locator('select#convert-format').select_option('txt')
  async with page.expect_download() as download_info:
   await root.locator('button[data-action="convert-run"]').click()
  download=await download_info.value
  assert download.suggested_filename=='class.txt'
  print('PPTX -> TXT:',download.suggested_filename)
  await root.locator('#convert-file').set_input_files({'name':'test.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n'})
  await page.wait_for_timeout(250)
  assert await root.get_by_text('PDF to Word or PowerPoint',exact=False).count()
  print('PDF limitation explained; no false conversion')
  await root.locator('button[data-action="appearance"]').click()
  await root.locator('button[data-action="accent"][data-choice="violet"]').click()
  assert await root.locator('.app').get_attribute('data-accent')=='violet'
  assert await root.locator('.theme-mark').count()==1
  await page.screenshot(path='/mnt/data/rattibha-v08-convert.png',full_page=True)
  await page.set_viewport_size({'width':390,'height':844})
  await page.screenshot(path='/mnt/data/rattibha-v08-convert-mobile.png',full_page=True)
  print('errors',errors)
  assert not errors
  await browser.close()
asyncio.run(main())
