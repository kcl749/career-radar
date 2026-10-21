import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const outputRoot=path.resolve(root,'..','..','outputs');
const updatePath=path.join(root,'app','updates','autumn-2026-10-21.json');
const jobs=JSON.parse(fs.readFileSync(updatePath,'utf8'));
if(jobs.length!==20)throw new Error(`Expected 20 jobs, received ${jobs.length}`);

const merge=(oldRows)=>[...new Map([...oldRows,...jobs].map(row=>[row.id,row])).values()];
const readBase=(html)=>{
  const start=html.indexOf('let base=');
  const end=html.indexOf(',custom=[]',start);
  if(start<0||end<0)throw new Error('Unable to locate embedded job catalog');
  return {start,end,rows:JSON.parse(html.slice(start+'let base='.length,end))};
};
const updateHtml=(source,offline=false)=>{
  const found=readBase(source);
  const merged=merge(found.rows);
  let html=source.slice(0,found.start)+'let base='+JSON.stringify(merged)+source.slice(found.end);
  html=html.replace(/<option value="2026-10-19秋招" selected>/g,'<option value="2026-10-19秋招">');
  html=html.replace(/<option value="">全部批次<\/option>(?!<option value="2026-10-21秋招")/,'<option value="">全部批次</option><option value="2026-10-21秋招" selected>本轮：10月21日秋招</option>');
  html=html.replace(/(<span class="muted" id="updated">)[^<]*(<\/span>)/,'$1本轮20个秋招岗位 · 2026-10-21已核验$2');
  html=html.replace(/<p class="muted">本轮秋招核验：[^<]*<\/p>/,'<p class="muted">本轮秋招核验：2026-10-21。20个岗位在牛客列表中的状态字段为开放，详情页可访问，平台截止日未早于核验日；未替你实际提交申请。平台创建时间不等于企业首次发布日期，远期截止日期需向企业确认。本轮仅1个高匹配岗位处于近7天创建范围，其余为仍开放的高匹配机会。</p>');
  if(offline)html=html.replace(/职途雷达 · 离线版/g,'职途雷达 · 离线版 2026-10-21');
  return html;
};

const catalogPath=path.join(root,'app','catalog.json');
fs.writeFileSync(catalogPath,JSON.stringify(merge(JSON.parse(fs.readFileSync(catalogPath,'utf8'))),null,2)+'\n');

const boardPath=path.join(root,'app','board.html');
fs.writeFileSync(boardPath,updateHtml(fs.readFileSync(boardPath,'utf8')));

const oldOffline=path.join(outputRoot,'职途雷达-离线版-2026-10-20-v3.html');
const newOffline=path.join(outputRoot,'职途雷达-离线版-2026-10-21-v4.html');
fs.writeFileSync(newOffline,updateHtml(fs.readFileSync(oldOffline,'utf8'),true));

const jsonOutput=path.join(outputRoot,'秋招岗位清单-2026-10-21.json');
fs.writeFileSync(jsonOutput,JSON.stringify({schema:'career-radar-jobs-v1',updatedAt:'2026-10-21T00:00:00+08:00',jobs},null,2)+'\n');

const md=['# 2027届秋招岗位推荐（2026-10-21）','',`共 ${jobs.length} 个。排序综合考虑岗位方向、技能匹配和城市偏好。平台创建时间不等于企业首次发布日期。`,'',...jobs.flatMap(j=>[
  `## ${j.priority}. ${j.company}｜${j.title}`,
  '',
  `- 地点：${j.city}`,
  `- 核心技能：${j.skills}`,
  `- 发布口径：${j.published}`,
  `- 截止口径：${j.deadline}`,
  `- 资格：${j.eligibility}`,
  `- 匹配原因：${j.reason}`,
  `- 建议补充：${j.improvement}`,
  `- 申请：[岗位页面](${j.url})`,
  `- 核验：${j.verified}；${j.status}`,
  ''
])];
fs.writeFileSync(path.join(outputRoot,'秋招岗位推荐-2026-10-21.md'),md.join('\n'));

const practice=path.join(outputRoot,'职途雷达-每日训练-2026-10-20.html');
if(fs.existsSync(practice)){
  const text=fs.readFileSync(practice,'utf8').replace(/职途雷达-离线版-2026-10-20-v3\.html/g,'职途雷达-离线版-2026-10-21-v4.html');
  fs.writeFileSync(practice,text);
}

console.log(JSON.stringify({jobs:jobs.length,catalog:JSON.parse(fs.readFileSync(catalogPath,'utf8')).length,offline:newOffline,jsonOutput},null,2));

