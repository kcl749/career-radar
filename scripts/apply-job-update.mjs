import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const outputRoot=path.resolve(root,'..','..','outputs');
const updatePath=path.resolve(root,process.argv[2]||path.join('app','updates','autumn-2026-10-21.json'));
const jobs=JSON.parse(fs.readFileSync(updatePath,'utf8'));
if(!jobs.length)throw new Error('The update file contains no jobs');
const batch=jobs[0].batch;
const date=jobs[0].verified;
if(!batch||!date||jobs.some(job=>job.batch!==batch||job.verified!==date))throw new Error('Jobs must share one batch and verification date');

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
  html=html.replace(/(<option value="[^"]+") selected>/g,'$1>');
  const option=`<option value="${batch}" selected>本轮：${date.slice(5).replace('-','月')}日新增${jobs.length}个秋招</option>`;
  if(!html.includes(`value="${batch}"`))html=html.replace('<option value="">全部批次</option>',`<option value="">全部批次</option>${option}`);
  else html=html.replace(new RegExp(`<option value="${batch}"[^>]*>[^<]*<\\/option>`),option);
  html=html.replace(/(<span class="muted" id="updated">)[^<]*(<\/span>)/,`$1本轮${jobs.length}个全新秋招岗位 · ${date}已核验$2`);
  html=html.replace(/<p class="muted">本轮秋招核验：[^<]*<\/p>/,`<p class="muted">本轮秋招核验：${date}。已排除历史清单和账号岗位库中的既有岗位，本轮${jobs.length}个均为未推荐过的新岗位；牛客列表状态字段为开放，详情页可访问。平台创建时间不等于企业首次发布日期，申请前仍需核对企业官网。</p>`);
  if(offline)html=html.replace(/职途雷达 · 离线版(?: \d{4}-\d{2}-\d{2})?/g,`职途雷达 · 离线版 ${date}`);
  return html;
};

const catalogPath=path.join(root,'app','catalog.json');
fs.writeFileSync(catalogPath,JSON.stringify(merge(JSON.parse(fs.readFileSync(catalogPath,'utf8'))),null,2)+'\n');

const boardPath=path.join(root,'app','board.html');
fs.writeFileSync(boardPath,updateHtml(fs.readFileSync(boardPath,'utf8')));

const offlineFiles=fs.readdirSync(outputRoot).filter(name=>/^职途雷达-离线版-.*\.html$/.test(name)).sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
if(!offlineFiles.length)throw new Error('No prior offline board found');
const oldOffline=path.join(outputRoot,offlineFiles.at(-1));
const priorVersion=Number(offlineFiles.at(-1).match(/-v(\d+)\.html$/)?.[1]||0);
const newOffline=path.join(outputRoot,`职途雷达-离线版-${date}-v${priorVersion+1}.html`);
fs.writeFileSync(newOffline,updateHtml(fs.readFileSync(oldOffline,'utf8'),true));

const jsonOutput=path.join(outputRoot,`秋招新增岗位清单-${date}-${jobs.length}个.json`);
fs.writeFileSync(jsonOutput,JSON.stringify({schema:'career-radar-jobs-v1',updatedAt:'2026-10-21T00:00:00+08:00',jobs},null,2)+'\n');

const md=[`# 2027届全新秋招岗位推荐（${date}）`,'',`共 ${jobs.length} 个，均已排除历史清单中的岗位。排序综合考虑岗位方向、技能匹配和城市偏好。平台创建时间不等于企业首次发布日期。`,'',...jobs.flatMap(j=>[
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
fs.writeFileSync(path.join(outputRoot,`秋招新增岗位推荐-${date}-${jobs.length}个.md`),md.join('\n'));

const practice=path.join(outputRoot,'职途雷达-每日训练-2026-10-20.html');
if(fs.existsSync(practice)){
  const text=fs.readFileSync(practice,'utf8').replace(/职途雷达-离线版-[^"']+\.html/g,path.basename(newOffline));
  fs.writeFileSync(practice,text);
}

console.log(JSON.stringify({jobs:jobs.length,catalog:JSON.parse(fs.readFileSync(catalogPath,'utf8')).length,offline:newOffline,jsonOutput},null,2));

