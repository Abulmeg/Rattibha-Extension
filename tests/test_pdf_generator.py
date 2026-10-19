import asyncio, io, zipfile, pathlib, base64, shutil
from playwright.async_api import async_playwright
import fitz
from PIL import Image,ImageDraw
base=pathlib.Path(__file__).resolve().parents[1]

def zipped(files):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for name,body in files.items():z.writestr(name,body)
    return out.getvalue()

sample_docx=zipped({'word/document.xml':'''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Lab Report</w:t></w:r></w:p>
<w:p><w:r><w:t>Here is a clear paragraph about fundamentals of embedded systems. It explains the experiment results and expected behavior.</w:t></w:r></w:p>
<w:p><w:r><w:t>مرحبا بكم في تقرير المختبر. هذا اختبار اللغة العربية في ملفات PDF.</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Course</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Mark</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>Security</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>98</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>''' + ('A longer set of notes from the lab. ' * 450) + '''</w:t></w:r></w:p></w:body></w:document>'''})
img=Image.new('RGB',(150,70),'#e5f5ff');d=ImageDraw.Draw(img);d.rectangle([12,12,138,58],outline='#335877',width=3)
out=io.BytesIO();img.save(out,format='PNG');img_data=out.getvalue()
sample_ppt=zipped({
'ppt/presentation.xml':'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
'ppt/slides/slide1.xml':'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="10058400" cy="1828800"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Introduction to Embedded Systems</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:blipFill><a:blip r:embed="rId4"/></p:blipFill><p:spPr><a:xfrm><a:off x="1524000" y="3300000"/><a:ext cx="6000000" cy="2700000"/></a:xfrm></p:spPr></p:pic></p:spTree></p:cSld></p:sld>',
'ppt/slides/_rels/slide1.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId4" Target="../media/image1.png"/></Relationships>',
'ppt/media/image1.png':img_data,
'ppt/slides/slide2.xml':'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Results and Discussion</a:t></a:r></a:p><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
})

async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await b.new_page(accept_downloads=True)
  failures=[];page.on('pageerror',lambda e:failures.append(str(e)))
  await page.set_content('<html><body></body></html>')
  for name in ['vendor/jszip.min.js','pdf-generator.js','file-tools.js']:
   await page.add_script_tag(path=str(base/name))
  for name,bytes,mime,expected in [
    ('notes.docx',sample_docx,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',None),
    ('slides.pptx',sample_ppt,'application/vnd.openxmlformats-officedocument.presentationml.presentation',2),
    ('notes.txt',('This is a standalone PDF generated directly, without any printer window.\n'*85).encode(),'text/plain',None)
  ]:
   await page.evaluate('''async ({name,data,mime}) => {const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)); const file=new File([bytes],name,{type:mime}); window.testResult=await RLFileTools.read(file);}''',dict(name=name,data=base64.b64encode(bytes).decode(),mime=mime))
   async with page.expect_download(timeout=30000) as promise:
    await page.evaluate("async () => { window.pdfResult=await RLFileTools.convert(window.testResult,'pdf') }")
   down=await promise.value
   destination=base/'tests'/f'test-{name}.pdf'
   await down.save_as(str(destination))
   pdf=fitz.open(destination)
   assert pdf.page_count >= 1,(name,pdf.page_count)
   if expected: assert pdf.page_count==expected,(name,pdf.page_count)
   for index,pg in enumerate(pdf):
    assert pg.rect.width > 500
    assert pg.rect.height > 400
    pixels=pg.get_pixmap(matrix=fitz.Matrix(0.6,0.6));
    if index==0:
     pathlib.Path(base/'tests'/f'{name}-page1.png').write_bytes(pixels.tobytes('png'))
   print(name, down.suggested_filename, pdf.page_count, 'pages', destination.stat().st_size, 'bytes')
   pdf.close()
  assert not failures, failures
  await b.close()
asyncio.run(main())
