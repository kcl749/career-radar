const TARGETS=['时间序列','机器学习','算法','数据科学','数据挖掘','数据分析','统计','Python','SQL','R语言','Spark','Hadoop','预测','因果推断','推荐','Tableau','Power BI'];
const REQUIRED_TARGETS=['时间序列','机器学习','算法','数据科学','数据挖掘','数据分析','统计','预测','因果推断','推荐'];
const CITIES=['深圳','广州','上海','北京'];
const BLOCKED=['销售','客服','行政','人事','市场推广','软件测试','产品运营'];
const SCHOOL_SEARCHES=['机器学习','算法工程师','时间序列','预测算法','数据科学','数据挖掘','推荐算法','数据分析','商业分析','风控算法'];
const INTERN_SEARCHES=['机器学习 算法','时间序列','数据科学','数据挖掘','数据分析'];
const OUTSIDE_MAINLAND=['新加坡','香港','澳门','台北','海外'];

export function decodeHtml(value=''){
  return value.replace(/&#x[0-9a-f]+;?/gi,'').replace(/&#(\d+);?/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
}

export function textOnly(value=''){
  return decodeHtml(value).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s+/g,'\n').trim();
}

function hash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function exclusionKey(value=''){
  const raw=String(value).trim();
  if(!raw)return '';
  try{const url=new URL(raw);return url.pathname.split('/').filter(Boolean).at(-1)||raw}catch{}
  return raw.replace(/^auto-/,'').replace(/^(?:nc|sxs)-/,'');
}
function dateCN(value){if(!value)return '';const d=new Date(Number(value));return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d).replaceAll('/','-'):''}
function cityScore(text){const i=CITIES.findIndex(city=>text.includes(city));return i<0?0:20-i*4}
function keywords(text){return TARGETS.filter(x=>text.toLowerCase().includes(x.toLowerCase())).slice(0,8)}
function relevant(text){return REQUIRED_TARGETS.some(x=>text.toLowerCase().includes(x.toLowerCase()))}
function score(text,title=''){
  const weights={'时间序列':20,'机器学习':18,'数据科学':16,'算法':14,'数据挖掘':13,'数据分析':12,'统计':10,'预测':9,'因果推断':9,'推荐':7,'Python':7,'SQL':6,'Spark':4,'Hadoop':4};
  let value=cityScore(text);
  for(const [word,weight] of Object.entries(weights))if(text.toLowerCase().includes(word.toLowerCase()))value+=weight;
  if(/2027|27届/.test(text))value+=12;
  if(/硕士|研究生/.test(text))value+=4;
  if(BLOCKED.some(word=>title.includes(word)))value-=35;
  return value;
}

export function parseNowcoder(html){
  const marker='window.__INITIAL_STATE__=';
  const start=html.indexOf(marker);
  if(start<0)return [];
  const jsonStart=start+marker.length;
  const end=html.indexOf(';(function(){',jsonStart);
  if(end<0)return [];
  try{
    const state=JSON.parse(html.slice(jsonStart,end));
    return Array.isArray(state?.app?.['132']?.jobListData)?state.app['132'].jobListData.map(x=>x?.data).filter(Boolean):[];
  }catch{return []}
}

export function parseShixisengList(html){
  const jobs=[];
  const pattern=/<div class="f-l intern-detail__job"[\s\S]*?<a href="(https:\/\/www\.shixiseng\.com\/intern\/[^"?]+)[^"]*" title="([^"]+)"[\s\S]*?<span class="city ellipsis"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<div class="f-r intern-detail__company"[\s\S]*?<a title="([^"]+)"/g;
  for(const match of html.matchAll(pattern))jobs.push({url:match[1],title:textOnly(match[2]),city:textOnly(match[3]),company:textOnly(match[4])});
  return jobs;
}

export function parseShixisengDetail(html,seed){
  if(/职位已下线|停止招聘|已结束招聘/.test(html))return null;
  const titleMatch=html.match(/<title>([\s\S]*?)实习招聘-([\s\S]*?)实习生招聘/);
  const detail=textOnly(html.match(/<div class="job_detail"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'');
  const deadline=textOnly(html.match(/截止日期[：:]\s*([^<]+)/)?.[1]||'');
  const city=textOnly(html.match(/<span class="com_position"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'')||seed.city;
  return {...seed,title:titleMatch?textOnly(titleMatch[1]):seed.title,company:titleMatch?textOnly(titleMatch[2]):seed.company,city,detail,deadline};
}

function nowcoderJob(job,index,date){
  let ext={};try{ext=JSON.parse(job.ext||'{}')}catch{}
  const detail=textOnly(`${ext.requirements||''}\n${ext.infos||''}`);
  const company=job.recommendInternCompany?.companyShortName||job.recommendInternCompany?.companyName||job.user?.introduction||'公司待确认';
  const city=(job.jobCityList||[]).join('/')||job.jobCity||'地点待确认';
  const all=`${job.jobName} ${company} ${city} ${detail}`;
  const skills=keywords(all);
  const eligibility=/2026\s*年\s*9\s*月.{0,20}2027\s*年\s*8\s*月|2027|27届/.test(all)?'明确面向或包含2027届；具体学历及毕业时间以岗位页为准':'毕业批次待打开岗位页确认';
  return {id:`auto-nc-${job.id}`,priority:index+1,company,title:job.jobName,city,type:'秋招',published:job.createTime?`牛客平台创建于 ${dateCN(job.createTime)}`:'发布日期未标明',deadline:job.deliverEnd?dateCN(job.deliverEnd):'未标明',url:`https://www.nowcoder.com/jobs/detail/${job.id}`,skills:skills.join('、')||'技能要求待查看',reason:`岗位JD与${skills.slice(0,5).join('、')||'数据方向'}相关，结合城市与2027届资格排序。`,eligibility,improvement:'投递前核对官网入口，并在简历项目中量化数据规模、模型指标和业务结果',tier:'自动候选·待复核',verified:date,batch:`${date}秋招一键更新`,status:'牛客公开岗位页可访问；建议再到企业官网核对申请状态与截止时间'};
}

function internJob(job,index,date){
  const all=`${job.title} ${job.company} ${job.city} ${job.detail}`;
  const skills=keywords(all);
  const attendance=(all.match(/(?:每周|一周)\s*\d\s*[天日]/)?.[0]||'每周出勤待确认');
  const duration=(all.match(/(?:连续|实习)[^。；\n]{0,12}\d\s*(?:个)?月/)?.[0]||'实习时长待确认');
  const grade=/2027|27届/.test(all)?'，包含2027届':'，毕业批次待确认';
  return {id:`auto-sxs-${hash(job.url)}`,priority:index+1,company:job.company,title:job.title,city:job.city||'地点待确认',type:'实习',published:`发布日期未标明；${date}仍见于公开列表`,deadline:job.deadline||'未标明',url:job.url,skills:skills.join('、')||'技能要求待查看',reason:`岗位描述与${skills.slice(0,5).join('、')||'数据方向'}相关，结合城市、出勤与实习时长排序。`,eligibility:`${attendance}；${duration}${grade}`,improvement:'突出Python/SQL项目、统计建模方法、预测误差及可视化结论，投递前确认11月到岗要求',tier:'自动候选·待复核',verified:date,batch:`${date}实习一键更新`,status:'实习僧公开详情页可访问且显示投递入口；发布日期未标明，申请状态仍建议当日确认'};
}

async function getText(fetcher,url){
  const response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; CareerRadar/1.0)','Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`source ${response.status}`);
  return response.text();
}

export async function fetchCandidates(type,count,date,fetcher=fetch,excludedValues=[]){
  const excluded=new Set(excludedValues.map(exclusionKey).filter(Boolean));
  const isExcluded=value=>excluded.has(exclusionKey(value));
  if(type==='秋招'){
    const pages=await Promise.allSettled(SCHOOL_SEARCHES.map(term=>getText(fetcher,'https://www.nowcoder.com/jobs/school/jobs?search='+encodeURIComponent(term))));
    const seen=new Set();
    const jobs=pages.flatMap(x=>x.status==='fulfilled'?parseNowcoder(x.value):[]).filter(job=>{
      if(!job?.id||seen.has(job.id)||isExcluded(job.id)||job.status!==0)return false;seen.add(job.id);
      let ext={};try{ext=JSON.parse(job.ext||'{}')}catch{}
      const all=`${job.jobName||''} ${ext.requirements||''} ${ext.infos||''}`;
      const city=(job.jobCityList||[]).join('/')||job.jobCity||'';
      if(!relevant(all)||BLOCKED.some(word=>(job.jobName||'').includes(word))||/实习/.test(job.jobName||'')||OUTSIDE_MAINLAND.some(place=>city.includes(place)))return false;
      return !(job.deliverEnd&&Number(job.deliverEnd)<Date.now());
    }).sort((a,b)=>{
      const ta=`${a.jobName} ${a.jobCity} ${a.ext}`,tb=`${b.jobName} ${b.jobCity} ${b.ext}`;
      return score(tb,b.jobName)-score(ta,a.jobName)||(Number(b.createTime)||0)-(Number(a.createTime)||0);
    }).slice(0,count);
    return jobs.map((job,index)=>nowcoderJob(job,index,date));
  }

  const pages=await Promise.allSettled(INTERN_SEARCHES.map(term=>getText(fetcher,'https://www.shixiseng.com/interns?keyword='+encodeURIComponent(term))));
  const seen=new Set();
  const seeds=pages.flatMap(x=>x.status==='fulfilled'?parseShixisengList(x.value):[]).filter(job=>{
    if(seen.has(job.url)||isExcluded(job.url))return false;seen.add(job.url);
    return relevant(job.title)&&!BLOCKED.some(word=>job.title.includes(word));
  });
  const details=await Promise.allSettled(seeds.slice(0,Math.max(count*3,20)).map(async seed=>parseShixisengDetail(await getText(fetcher,seed.url),seed)));
  return details.flatMap(x=>x.status==='fulfilled'&&x.value?[x.value]:[]).filter(job=>{
    const all=`${job.title} ${job.detail}`;
    return relevant(all)&&!/仅限2026届|仅面向2026届|26届毕业生/.test(all);
  }).sort((a,b)=>score(`${b.title} ${b.city} ${b.detail}`,b.title)-score(`${a.title} ${a.city} ${a.detail}`,a.title)).slice(0,count).map((job,index)=>internJob(job,index,date));
}

