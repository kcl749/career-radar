import fs from 'node:fs';
import path from 'node:path';
import {mergeCatalog,validateCatalog} from '../app/catalog-core.mjs';
import {buildOffline} from './make-offline.mjs';

const root=path.resolve(import.meta.dirname,'..');
const outputRoot=path.resolve(root,'..','..','outputs');
const updatePath=path.resolve(root,process.argv[2]||path.join('app','updates','autumn-2026-10-21.json'));
const incoming=validateCatalog(JSON.parse(fs.readFileSync(updatePath,'utf8')));
if(!incoming.length)throw new Error('The update file contains no jobs');
const batch=incoming[0].batch;
const date=incoming[0].verified;
if(!batch||!date||incoming.some(job=>job.batch!==batch||job.verified!==date))throw new Error('Jobs must share one batch and verification date');

const catalogPath=path.join(root,'app','catalog.json');
const existing=validateCatalog(JSON.parse(fs.readFileSync(catalogPath,'utf8')));
const merged=mergeCatalog(existing,incoming);
if(!merged.inserted.length)throw new Error('No new jobs: every id or URL already exists in catalog.json');
fs.writeFileSync(catalogPath,JSON.stringify(merged.rows,null,2)+'\n');

const jobs=merged.inserted;
const offline=await buildOffline({outputRoot,date});
const type=jobs.every(job=>job.type===jobs[0].type)?jobs[0].type:'岗位';
const jsonOutput=path.join(outputRoot,`${type}新增岗位清单-${date}-${jobs.length}个.json`);
fs.writeFileSync(jsonOutput,JSON.stringify({schema:'career-radar-jobs-v1',updatedAt:new Date().toISOString(),jobs},null,2)+'\n');
const markdown=[`# 2027届全新${type}岗位推荐（${date}）`,'',`共 ${jobs.length} 个，均已排除目录中的既有岗位。排序综合考虑岗位方向、技能匹配和城市偏好。平台创建时间不等于企业首次发布日期。`,'',...jobs.flatMap(job=>[
  `## ${job.priority}. ${job.company}｜${job.title}`,'',`- 地点：${job.city}`,`- 核心技能：${job.skills}`,`- 发布口径：${job.published}`,`- 截止口径：${job.deadline}`,`- 资格：${job.eligibility}`,`- 匹配原因：${job.reason}`,`- 建议补充：${job.improvement}`,`- 申请：[岗位页面](${job.url})`,`- 核验：${job.verified}；${job.status}`,'',
])];
const markdownOutput=path.join(outputRoot,`${type}新增岗位推荐-${date}-${jobs.length}个.md`);
fs.writeFileSync(markdownOutput,markdown.join('\n'));
console.log(JSON.stringify({inserted:jobs.length,skipped:merged.skipped.length,catalog:merged.rows.length,offline:offline.output,jsonOutput,markdownOutput},null,2));
