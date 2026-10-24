import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {read,patchStatement,validatePatch,validId,json,sameOrigin} from '../../sync-core.mjs';
import {chinaToday,lookupJob} from '../../applications-core.mjs';
export const dynamic='force-dynamic';

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return json({error:'请先登录'},401);
  try{return json({...await read(env.DB,user.userId),user:user.displayName})}
  catch{return json({error:'云端数据库暂不可用，请稍后重试'},503)}
}

export async function PATCH(req:Request){
  const user=await getChatGPTUser();
  if(!user)return json({error:'请先登录'},401);
  if(!sameOrigin(req))return json({error:'请求来源无效'},403);
  try{
    if(Number(req.headers.get('content-length'))>20000)return json({error:'请求过大'},413);
    const body=await req.json();
    if(!validId(body.id))return json({error:'岗位标识无效'},400);
    const patch=validatePatch(body.patch);
    const statements=[patchStatement(env.DB,user.userId,body.id,patch)];
    if(Object.hasOwn(patch,'applied')){
      const id=`job:${body.id}`;
      const now=new Date().toISOString();
      if(patch.applied){
        const job=await lookupJob(env.DB,user.userId,body.id);
        if(!job)return json({error:'岗位未找到'},404);
        const prior=await env.DB.prepare('SELECT id FROM applications WHERE user_id=? AND id=?').bind(user.userId,id).first();
        statements.push(env.DB.prepare(`INSERT INTO applications(user_id,id,source_job_id,company,title,applied_date,current_stage,created_at,updated_at) VALUES(?,?,?,?,?,?,'已投递',?,?) ON CONFLICT(user_id,id) DO UPDATE SET archived=0,updated_at=excluded.updated_at`).bind(user.userId,id,body.id,job.company,job.title,chinaToday(),now,now));
        if(!prior)statements.push(env.DB.prepare(`INSERT OR IGNORE INTO application_events(user_id,application_id,id,stage,date,created_at) VALUES(?,?,?,'已投递',?,?)`).bind(user.userId,id,`initial:${body.id}`,chinaToday(),now));
      }else statements.push(env.DB.prepare('UPDATE applications SET archived=1,updated_at=? WHERE user_id=? AND id=?').bind(now,user.userId,id));
    }
    await env.DB.batch(statements);
    return json({ok:true});
  }catch{return json({error:'保存失败，请检查数据并重试'},400)}
}
