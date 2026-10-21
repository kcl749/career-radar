import {env} from 'cloudflare:workers';
import catalog from '../../catalog.json';
import {getChatGPTUser} from '../../chatgpt-auth';
import {json,sameOrigin,validId,validatePatch,patchStatement,cleanJob} from '../../sync-core.mjs';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  const user=await getChatGPTUser();
  if(!user)return json({error:'请先登录'},401);
  if(!sameOrigin(req))return json({error:'请求来源无效'},403);
  try{
    const raw=await req.text();
    if(raw.length>2000000)return json({error:'文件过大'},413);
    const body=JSON.parse(raw);
    if(!Array.isArray(body.jobs)||body.jobs.length>200)throw new Error('jobs');
    const staticIds=new Set(catalog.map(job=>job.id));
    const statements=[];
    for(const job of body.jobs){
      const clean=cleanJob(job);
      if(staticIds.has(clean.id))continue;
      statements.push(env.DB.prepare('INSERT INTO custom_jobs(user_id,job_id,data) VALUES(?,?,?) ON CONFLICT(user_id,job_id) DO UPDATE SET data=excluded.data').bind(user.userId,clean.id,JSON.stringify(clean)));
    }
    for(const [id,value] of Object.entries(body.state||{})){
      if(!validId(id))throw new Error('id');
      const patch=validatePatch(value);
      if(Object.keys(patch).length)statements.push(patchStatement(env.DB,user.userId,id,patch));
    }
    if(statements.length>400)throw new Error('too many');
    if(statements.length)await env.DB.batch(statements);
    return json({ok:true});
  }catch{
    return json({error:'导入数据无效，未完成迁移'},400);
  }
}
