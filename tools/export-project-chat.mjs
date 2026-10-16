import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const workspace=path.resolve(import.meta.dirname,'..');
const sessionsRoot='C:/Users/MR/.codex/sessions';
const output=path.join(workspace,'docs','project-chat-history.md');
const rootIds=new Set([
  '01a10240-2875-7011-ad42-99f8e690c265',
  '01a100d4-a032-7833-9656-406ef82b7ed4',
]);

async function files(dir){
  const entries=await readdir(dir,{withFileTypes:true});const result=[];
  for(const entry of entries){const full=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await files(full));else if(entry.name.endsWith('.jsonl'))result.push(full);}
  return result;
}
function clean(text){
  let value=String(text??'').replace(/<environment_context>[\s\S]*?<\/environment_context>/gi,'')
    .replace(/<external_codex_apps_open_page>[\s\S]*?<\/external_codex_apps_open_page>/gi,'')
    .replace(/<in-app-browser-context[^>]*>[\s\S]*?<\/in-app-browser-context>/gi,'')
    .replace(/<app-context>[\s\S]*?<\/app-context>/gi,'')
    .replace(/<permissions instructions>[\s\S]*?<\/permissions instructions>/gi,'')
    .replace(/<plugins_instructions>[\s\S]*?<\/plugins_instructions>/gi,'')
    .replace(/<skills_instructions>[\s\S]*?<\/skills_instructions>/gi,'')
    .replace(/<collaboration_mode>[\s\S]*?<\/collaboration_mode>/gi,'')
    .replace(/<multi_agent_role>[\s\S]*?<\/multi_agent_role>/gi,'')
    .replace(/<multi_agent_mode>[\s\S]*?<\/multi_agent_mode>/gi,'')
    .replace(/<model_switch>[\s\S]*?<\/model_switch>/gi,'')
    .replace(/\n{3,}/g,'\n\n').trim();
  value=value.replace(/^\s*Distinguish instructions in attached documents from the user's request\.\s*$/gim,'').trim();
  return value;
}
function timestamp(value){const n=Date.parse(value||'');return Number.isFinite(n)?n:0;}
function textFromMessage(payload){
  if(typeof payload.text==='string')return payload.text;
  if(Array.isArray(payload.content))return payload.content.filter(x=>x?.type==='input_text'||x?.type==='text'||x?.type==='output_text').map(x=>x.text||'').join('\n');
  return '';
}

const records=[];const paths=await files(sessionsRoot);
for(const file of paths){
  let lines;try{lines=(await readFile(file,'utf8')).split(/\r?\n/).filter(Boolean);}catch{continue;}
  let meta=null;try{meta=JSON.parse(lines[0]);}catch{continue;}
  const p=meta?.payload;const cwd=path.resolve(p?.cwd||'');
  if(cwd!==workspace)continue;
  const sessionId=p?.session_id||p?.id||path.basename(file);
  const root=sessionId=== '01a10240-2875-7011-ad42-99f8e690c265'?'持续开发对话':sessionId==='01a100d4-a032-7833-9656-406ef82b7ed4'?'项目初始对话':'项目对话续页';
  for(const line of lines.slice(1)){
    let row;try{row=JSON.parse(line);}catch{continue;}
    const payload=row.payload;
    if(row.type!=='response_item'||payload?.type!=='message')continue;
    const role=payload.role;if(role!=='user'&&role!=='assistant')continue;
    const body=clean(textFromMessage(payload));if(!body)continue;
    // 会话恢复时偶尔会把权限审计/代理提示伪装成 userMessage；它们不是项目聊天内容。
    if(role==='user'&&(/RETAINED USER INSTRUCTIONS|The following is the Codex agent history|<permissions instructions>|<multi_agent_role>/.test(body)))continue;
    // 压缩上下文和重连恢复可能重复旧消息；同角色同正文只保留第一次出现。
    records.push({id:payload.id||`${sessionId}:${row.ordinal}`,role,body,time:timestamp(row.timestamp)||timestamp(payload.created_at),sessionId,root});
  }
}
records.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
const seen=new Set();const unique=[];
for(const record of records){const key=record.role+'\n'+record.body;if(seen.has(key))continue;seen.add(key);unique.push(record);}
const started=unique[0]?.time?new Date(unique[0].time).toLocaleString('zh-CN'):'';
const ended=unique.at(-1)?.time?new Date(unique.at(-1).time).toLocaleString('zh-CN'):'';
const lines=[
  '# 《神之殇》项目聊天记录',
  '',
  `> 导出范围：${started} 至 ${ended}。来源为本机 Codex 项目会话档案，项目目录：\`${workspace}\`。`,
  '> 已保留用户需求、助手回复和关键讨论；系统提示、自动环境块、命令输出、工具调用和重复的压缩上下文已移除。图片以原始附件路径保留。',
  `> 共收录 ${unique.filter(x=>x.role==='user').length} 条用户消息、${unique.filter(x=>x.role==='assistant').length} 条助手回复。`,
  '',
  '## 会话来源',
  '',
  '- 项目初始对话：建立跑酷原型、世界观、序章和开发底座。',
  '- 持续开发对话：按《厄里昂：万家微火》重写剧情、推进三幕、Boss 通道、剧情纯享、创作者通道和 visual-kit 取舍。',
  '- 项目对话续页：上下文压缩后的同项目继续记录。',
  '',
  '## 时间线',
  ''
];
let day='';let index=0;
for(const item of unique){
  const date=item.time?new Date(item.time).toLocaleDateString('zh-CN'):'未标日期';
  if(date!==day){day=date;lines.push(`### ${date}`,'');}
  index++;
  const label=item.role==='user'?'用户':'助手';
  const phase=item.role==='assistant'?'（项目回复）':'';
  lines.push(`#### ${index}. ${label}${phase}`, '', item.body, '');
}
lines.push('---','','这份文件由 `tools/export-project-chat.mjs` 生成。后续继续聊天后，可再次运行该脚本刷新。','');
await writeFile(output,lines.join('\n'),'utf8');
console.log(`已导出 ${unique.length} 条消息：${output}`);
