import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const source=resolve(root,'outputs/职途雷达-离线版-2026-10-19-v2.html');
const output=resolve(root,'outputs/职途雷达-离线版-2026-10-20-v3.html');
const practiceOutput=resolve(root,'outputs/职途雷达-每日训练-2026-10-20.html');
let html=await readFile(source,'utf8');
html=html
  .replaceAll('职途雷达 · 离线版 2026-10-19 v2','职途雷达 · 离线版 2026-10-20 v3')
  .replace('<span class="muted">个人求职机会库 · 离线版 2026-10-19 v2</span>','<span class="muted"><a href="职途雷达-每日训练-2026-10-20.html">每日训练</a> · 离线版 2026-10-20 v3</span>')
  .replace('最新版 2026-10-19 · 共40个岗位（本轮20个秋招）','功能版 2026-10-20 · 岗位数据核验至 2026-10-19 · 共40个岗位')
  .replace('<div class="stats"><div class="stat"><strong id="total">0</strong>已收录机会</div><div class="stat"><strong id="saved">0</strong>已收藏</div><div class="stat"><strong id="applied">0</strong>已投递</div></div><section>','<div class="stats"><div class="stat"><strong id="total">0</strong>已收录机会</div><div class="stat"><strong id="saved">0</strong>已收藏</div><div class="stat"><strong id="applied">0</strong>已投递</div></div><section class="card"><div class="row"><div><strong>新增：每日行测训练</strong><p class="muted">每天 3 道原创图形推理 + 3 道资料计算，按日期更新并保存当天进度。</p></div><a class="primary" style="padding:12px;text-decoration:none;border-radius:8px" href="职途雷达-每日训练-2026-10-20.html">开始今日训练</a></div><hr style="border:0;border-top:1px solid #edf0e9;margin:18px 0"><strong>一键更新岗位</strong><div class="toolbar"><select id="offline-refresh-type"><option>秋招</option><option>实习</option></select><input id="offline-refresh-count" type="number" min="1" max="20" value="10" style="max-width:130px"><button id="offline-refresh">一键更新岗位</button></div><p class="muted">离线文件不能直接跨站抓取。在线版支持按“秋招/实习 + 个数”更新；此处点击会说明迁移方式。</p></section><section>')
  .replace('每周结果在聊天更新；离线文件不会自动更新，请用带日期的新版本替换旧文件。','每周结果在聊天更新；离线文件不会自动联网更新。在线版现已加入按类型和数量更新候选的按钮；自动候选统一标记“待复核”。')
  .replace('</script></body></html>',`\n$('offline-refresh').onclick=()=>{$('message').textContent='离线文件受浏览器跨站限制，不能直接抓取。请使用在线版的一键更新，或在聊天中告诉我“更新 '+$('offline-refresh-type').value+' '+$('offline-refresh-count').value+' 个”，我会生成新的离线版。';window.scrollTo({top:$('message').offsetTop-100,behavior:'smooth'})};\n</script></body></html>`);
await writeFile(output,html,'utf8');

let practice=await readFile(resolve(root,'work/job-site/app/practice.html'),'utf8');
practice=practice.replaceAll('href="/board"','href="职途雷达-离线版-2026-10-20-v3.html"');
await writeFile(practiceOutput,practice,'utf8');
console.log(output);
console.log(practiceOutput);

