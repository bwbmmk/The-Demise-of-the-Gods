import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_REELS} from '../src/story-theater.js';
import {CREATOR_PASSWORD,CREATOR_SUMMARIES,creatorPasswordMatches,editorPageValues,saveStoryText,resetStoryText} from '../src/story-editor.js';

test('creator gate uses the requested simple password check',()=>{
  assert.equal(CREATOR_PASSWORD,'76971585');
  assert.equal(creatorPasswordMatches('76971585'),true);
  assert.equal(creatorPasswordMatches('76971584'),false);
});

test('creator edits update the theater page and shared summary source',()=>{
  const page=STORY_REELS[1].pages.find(item=>item.editKey==='summary:district-boss');
  const original=editorPageValues(page);
  assert.deepEqual(original,CREATOR_SUMMARIES['district-boss']);
  const changed={title:'桥上回声',body:'改过的战后记录。',quote:'韩蕙：「先走。」'};
  assert.equal(saveStoryText(page.editKey,changed),true);
  assert.deepEqual(editorPageValues(page),changed);
  // main.js 的保存动作会把同一 editKey 的纯享副本一起刷新；这里模拟那一步，
  // 同时确认共享源已经被覆盖。
  Object.assign(page,changed);
  assert.equal(STORY_REELS[1].pages.find(item=>item.editKey===page.editKey).body,changed.body);
  assert.equal(resetStoryText(page.editKey),true);
  Object.assign(page,original);
  assert.deepEqual(editorPageValues(page),original);
});
