import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {json,sameOrigin} from '../../../sync-core.mjs';
import {fetchCandidates} from '../../../job-refresh.mjs';
import catalog from '../../../catalog.json';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  const user=await getChatGPTUser();
  if(!user)return json({error:'请先登录'},401);
  if(!sameOrigin(req))return json({error:'请求来源无效'},403);
  try{
    const body=await req.json() as {type?:string,count?:number};
    const type=body.type==='实习'?'实习':body.type==='秋招'?'秋招':'';
    const count=Math.min(20,Math.max(1,Math.trunc(Number(body.count)||0)));
    if(!type||!count)return json({error:'请选择秋招或实习，并填写1至20的数量'},400);
    const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
    const previous=await env.DB.prepare('SELECT job_id,data FROM custom_jobs WHERE user_id=?').bind(user.userId).all<{job_id:string,data:string}>();
    const excluded=[...catalog.flatMap(job=>[job.id,job.url]),...previous.results.flatMap(row=>{
      try{const job=JSON.parse(row.data) as {url?:string};return [row.job_id,job.url||'']}catch{return [row.job_id]}
    })];
    const jobs=await fetchCandidates(type,count,date,fetch,excluded);
    if(!jobs.length)return json({error:'本次没有找到从未推荐过且仍开放的匹配岗位，请稍后重试'},404);
    await env.DB.batch(jobs.map(job=>env.DB.prepare('INSERT INTO custom_jobs(user_id,job_id,data) VALUES(?,?,?) ON CONFLICT(user_id,job_id) DO UPDATE SET data=excluded.data').bind(user.userId,job.id,JSON.stringify(job))));
    return json({ok:true,jobs,note:`已排除历史岗位及公司黑名单（快手、Shopee/虾皮、携程），从${type==='秋招'?'牛客校招':'实习僧'}公开页面加入 ${jobs.length} 个全新待复核候选；请在投递当日复核企业官网状态`});
  }catch(error){
    console.error('job refresh failed',error);
    return json({error:error instanceof Error&&error.message.includes('JSON')?'请求格式无效':'公开招聘页面暂时不可用，请稍后重试'},502);
  }
}

