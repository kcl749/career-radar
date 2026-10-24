import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {json,sameOrigin} from '../../sync-core.mjs';
import {applicationStatements,cleanApplication,lookupJob} from '../../applications-core.mjs';

export const dynamic='force-dynamic';

async function bootstrapLegacy(user:string){
  const existing=await env.DB.prepare('SELECT job_id FROM marks WHERE user_id=? AND applied=1').bind(user).all();
  const prior=await env.DB.prepare('SELECT id FROM applications WHERE user_id=?').bind(user).all();
  const known=new Set(prior.results.map(row=>String(row.id)));
  const statements=[];
  for(const row of existing.results){
    const id=String(row.job_id);
    if(known.has(`job:${id}`))continue;
    const job=await lookupJob(env.DB,user,id);
    if(!job)continue;
    const now=new Date().toISOString();
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO applications(user_id,id,source_job_id,company,title,applied_date,current_stage,created_at,updated_at) VALUES(?,?,?,?,?,NULL,'已投递',?,?)`).bind(user,`job:${id}`,id,job.company,job.title,now,now));
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO application_events(user_id,application_id,id,stage,date,notes,created_at) VALUES(?,?,?,'已投递',NULL,'旧标记，投递日期待补充',?)`).bind(user,`job:${id}`,`initial:${id}`,now));
  }
  if(statements.length)await env.DB.batch(statements);
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return json({error:'请先登录'},401);
  try{
    await bootstrapLegacy(user.userId);
    const [a,e]=await Promise.all([
      env.DB.prepare('SELECT * FROM applications WHERE user_id=? ORDER BY updated_at DESC').bind(user.userId).all(),
      env.DB.prepare('SELECT * FROM application_events WHERE user_id=? ORDER BY date,created_at').bind(user.userId).all()
    ]);
    const grouped=new Map<string,unknown[]>();
    for(const row of e.results){const id=String(row.application_id);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id)?.push({id:row.id,stage:row.stage,date:row.date,notes:row.notes})}
    return json({applications:a.results.map(row=>({id:row.id,sourceJobId:row.source_job_id,company:row.company,title:row.title,appliedDate:row.applied_date,currentStage:row.current_stage,nextAction:row.next_action,nextDue:row.next_due,lastUpdated:row.last_updated,notes:row.notes,archived:!!row.archived,events:grouped.get(String(row.id))||[]}))});
  }catch{return json({error:'投递记录读取失败，请稍后重试'},503)}
}

export async function PUT(req:Request){
  const user=await getChatGPTUser();
  if(!user)return json({error:'请先登录'},401);
  if(!sameOrigin(req))return json({error:'请求来源无效'},403);
  try{
    if(Number(req.headers.get('content-length'))>2000000)return json({error:'导入内容过大'},413);
    const body=await req.json();
    if(!Array.isArray(body.applications)||body.applications.length>200)throw Error('单次最多保存 200 条');
    const apps=body.applications.map(cleanApplication);
    const seen=new Set();
    const statements=[];
    for(const app of apps){
      if(seen.has(app.id))throw Error('投递标识重复');
      seen.add(app.id);
      statements.push(...applicationStatements(env.DB,user.userId,app));
    }
    if(statements.length)await env.DB.batch(statements);
    return json({ok:true,count:apps.length});
  }catch(e){return json({error:e instanceof Error?e.message:'保存失败'},400)}
}
