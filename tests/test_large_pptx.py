import os, zipfile, pathlib, asyncio, io
import fitz
from playwright.async_api import async_playwright
BASE=pathlib.Path(__file__).resolve().parents[1]
TESTS=BASE/'tests'
PPT=TESTS/'large-160-slides.pptx'
SLIDES=160
if not PPT.exists():
 with zipfile.ZipFile(PPT,'w') as z:
  z.writestr('ppt/presentation.xml','<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>')
  for n in range(1,SLIDES+1):
   s=f'''<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="10058400" cy="1828800"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Lecture slide {n} of {SLIDES}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'''
   z.writestr(f'ppt/slides/slide{n}.xml',s)
  # Embedded recording can make a lecture slide deck large without expanding any slide.
  z.writestr('ppt/media/lecture-recording.mp4',os.urandom(39*1024*1024),compress_type=zipfile.ZIP_STORED)
print('PPTX test',PPT.stat().st_size//1024//1024,'MB',SLIDES,'slides')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await browser.new_page(accept_downloads=True)
  await page.set_content('<html><body><input type="file" id="file"></body></html>')
  for name in ['vendor/jszip.min.js','pdf-generator.js','file-tools.js']:
   await page.add_script_tag(path=str(BASE/name))
  await page.locator('#file').set_input_files(str(PPT))
  info=await page.evaluate('''async () => {
    const file=document.querySelector('#file').files[0];
    window.testResult=await RLFileTools.read(file);
    return {slides:window.testResult.slides.length,htmlBytes:window.testResult.html.length,mediaCount:window.testResult.mediaUrls.length};
  }''')
  print('read:',info)
  assert info['slides']==SLIDES
  async with page.expect_download(timeout=120000) as download_event:
   await page.evaluate("async () => { await RLFileTools.convert(window.testResult,'pdf'); }")
  download=await download_event.value
  out=TESTS/'large-160-slides.pdf'
  await download.save_as(str(out))
  doc=fitz.open(out)
  print('PDF result:',doc.page_count,'pages',round(out.stat().st_size/1024/1024,2),'MB')
  assert doc.page_count==SLIDES
  doc.close()
  await browser.close()
asyncio.run(main())
