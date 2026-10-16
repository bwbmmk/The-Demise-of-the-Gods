import test from 'node:test';
import assert from 'node:assert/strict';
import {editorValues,saveStoryText,resetStoryText,allCreatorTargets,exportCreatorProject,inspectCreatorImport,importCreatorProject,undoCreatorSave,escapeStoryText} from '../src/story-editor.js';
import {FINAL_CHOICES,FINAL_ENDINGS} from '../src/story-finale.js';
import {heartsThresholds} from '../src/hearts.js';
test('creator registry includes every finale ending and all three live choice cards',()=>{
  for(const choice of FINAL_CHOICES){const key=`choice:${choice.id}`,base=editorValues(key);assert.ok(base);saveStoryText(key,{...base,title:'测试选择'});assert.equal(choice.title,'测试选择');resetStoryText(key);}
  for(const [branch,panels] of Object.entries(FINAL_ENDINGS))panels.forEach((panel,i)=>assert.equal(editorValues(`scene:finale:${branch}:${panel.editSlot??i}`).body,panel.body));
  assert.ok(allCreatorTargets().length>130);
});
test('old creator ending keys still edit the same narrative beats after inserted pages',()=>{
  const key='scene:finale:embers:2',base=editorValues(key);saveStoryText(key,{...base,body:'保留的分火修改'});
  assert.equal(FINAL_ENDINGS.embers[6].body,'保留的分火修改');assert.notEqual(FINAL_ENDINGS.embers[2].body,'保留的分火修改');resetStoryText(key);
});
test('backup validation is atomic and rejects malformed fields or tuning before applying any text',()=>{
  const key='scene:prologue:opening:0',base=editorValues(key),before=exportCreatorProject();
  assert.throws(()=>importCreatorProject({format:'requiem-creator',version:1,texts:{[key]:{...base,title:'should not apply'},'choice:night':{title:42}},tuning:before.tuning}));
  assert.deepEqual(editorValues(key),base);
  assert.throws(()=>inspectCreatorImport({format:'requiem-creator',version:1,texts:{},tuning:{t1:.9,t2:.4,enabled:true}}));
  assert.deepEqual(heartsThresholds(),before.tuning);
});
test('backups round-trip saved text, preserve unknown-key isolation, and undo restores the previous value',()=>{
  const key='scene:finale:throne:0',base=editorValues(key);saveStoryText(key,{...base,title:'导出测试'});
  const backup=exportCreatorProject();resetStoryText(key);assert.equal(editorValues(key).title,base.title);
  backup.texts['unknown:future']={title:'未知',body:'',quote:''};
  assert.equal(importCreatorProject(backup).skipped,1);assert.equal(editorValues(key).title,'导出测试');
  const last=undoCreatorSave();assert.equal(last,key);assert.equal(editorValues(key).title,base.title);resetStoryText(key);
});
test('creator text is escaped as plain text and does not introduce markup attributes',()=>{
  assert.equal(escapeStoryText('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
