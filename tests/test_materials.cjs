'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
global.location=new URL('https://elearn.just.edu.jo/current/course/view.php?id=88');
require('../moodle-materials.js');
const M=global.RLMoodleMaterials;

test('recognizes every standard Moodle resource by its module, not misleading filename',()=>{
  const modules={
    folder:'Folder',resource:'File',page:'Page',book:'Book',url:'Link',imscp:'IMS',
    quiz:'Quiz',assign:'Assignment',forum:'Forum',scorm:'SCORM',h5pactivity:'H5P',
    lesson:'Lesson',lti:'External',glossary:'Glossary',data:'Database',wiki:'Wiki',
    workshop:'Workshop',choice:'Choice',feedback:'Feedback',survey:'Survey',
    chat:'Chat',bigbluebuttonbn:'Conference',attendance:'Attendance'
  };
  for(const [kind,expected] of Object.entries(modules)){
    const url='https://elearn.just.edu.jo/current/mod/'+kind+'/view.php?id=55';
    assert.equal(M.classify(url,'Lecture.pptx'),expected,kind);
  }
  assert.equal(M.classify('/current/pluginfile.php/41/notes/Unit_1.pptx','Slides'),'File');
  assert.equal(M.classify('/current/pluginfile.php/41/notes/Unit_1.pdf','Handout'),'File');
  assert.equal(M.classify('/current/pluginfile.php/41/notes/Unit_1.xlsx','Spreadsheet'),'File');
  assert.equal(M.classify('/current/pluginfile.php/41/notes/demo.cpp','Code example'),'File');
  assert.equal(M.classify('/current/pluginfile.php/41/notes/photo.png','Diagram'),'Image');
  assert.equal(M.classify('/current/pluginfile.php/41/notes/lecture.mp4','Video'),'Media');
});
test('interactive modules go to Moodle but folders and pages can be viewed locally',()=>{
  for(const kind of ['Quiz','Assignment','SCORM','IMS','H5P','Lesson','Book','Link',
    'Glossary','External','Workshop','Choice','Feedback','Survey','Database','Wiki']){
    assert.equal(M.isNative(kind),true,kind);
  }
  for(const kind of ['Folder','File','Page','Forum','Image','Media']){
    assert.equal(M.isNative(kind),false,kind);
  }
});
test('detects image, sound, video and download file types',()=>{
  assert.equal(M.mediaKind('https://elearn.just.edu.jo/current/pluginfile.php/7/a.png'),'image');
  assert.equal(M.mediaKind('https://elearn.just.edu.jo/current/pluginfile.php/7/a.wav'),'audio');
  assert.equal(M.mediaKind('https://elearn.just.edu.jo/current/pluginfile.php/7/a.mp4'),'video');
  assert.equal(M.mediaKind('https://elearn.just.edu.jo/current/mod/resource/view.php?id=1','image/jpeg'),'image');
  assert.equal(M.mediaKind('https://elearn.just.edu.jo/current/mod/resource/view.php?id=1','video/mp4'),'video');
  assert.equal(M.downloadable('https://elearn.just.edu.jo/current/pluginfile.php/7/code.py'),true);
  assert.equal(M.downloadable('https://elearn.just.edu.jo/current/pluginfile.php/7/slides.ppt'),true);
  assert.equal(M.downloadable('https://elearn.just.edu.jo/current/pluginfile.php/7/notes.pdf'),false);
  assert.equal(M.downloadable('https://elearn.just.edu.jo/current/mod/folder/view.php?id=2'),false);
});
function anchor(href,textContent){
  return {
    textContent, getAttribute:key=>key==='href'?href:null,
    querySelector:()=>null,
    closest:sel=>sel.includes('foldertree')?{}:null,
    parentElement:null
  };
}
function documentWithFolder(fileLinks,zipLink){
  const rootLinks=fileLinks;
  const links=zipLink?[...rootLinks,zipLink]:rootLinks;
  const tree={parentElement:{closest:()=>null},querySelectorAll:sel=>sel==='a[href]'?rootLinks:[]};
  const main={
    querySelectorAll:sel=>sel==='a[href]'?links:(sel.includes('.foldertree')?[tree]:[])
  };
  return {body:main,querySelector:()=>main};
}
test('opens a folder with multiple files, nested paths, deduplication and optional ZIP',()=>{
  const a='https://elearn.just.edu.jo/current/pluginfile.php/155/mod_folder/content/0/Lecture%201.pdf';
  const b='https://elearn.just.edu.jo/current/pluginfile.php/155/mod_folder/content/0/Week%202/Slides.pptx';
  const c='https://elearn.just.edu.jo/current/pluginfile.php/155/mod_folder/content/0/Week%202/Notes/Sheet.xlsx';
  const zip='https://elearn.just.edu.jo/current/mod/folder/view.php?id=123&download=1';
  const page=documentWithFolder(
    [anchor(a,'Lecture 1.pdf'),anchor(b,'Slides.pptx'),anchor(c,'Sheet.xlsx'),anchor(b,'Slides.pptx')],
    anchor(zip,'Download folder')
  );
  const result=M.folderData(page,'https://elearn.just.edu.jo/current/mod/folder/view.php?id=123');
  assert.equal(result.files.length,3);
  assert.equal(result.files[0].name,'Lecture 1.pdf');
  assert.equal(result.files[0].folder,'');
  assert.equal(result.files[1].folder,'Week 2');
  assert.equal(result.files[2].folder,'Week 2 / Notes');
  assert.equal(result.folderZip,zip);
});
test('empty folder does not show unrelated course links as files',()=>{
  const page=documentWithFolder([],null);
  const result=M.folderData(page,'https://elearn.just.edu.jo/current/mod/folder/view.php?id=777');
  assert.equal(result.files.length,0);
  assert.equal(result.folderZip,'');
});
