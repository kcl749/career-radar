import catalog from './catalog.json' with {type:'json'};

export const chinaToday=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=type=>parts.find(item=>item.type===type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export const dateValue=value=>value===null||value===''?null:typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value?value:undefined;
export const validText=(value,max=300)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
export const validAppId=value=>validText(value,240);

export function cleanApplication(value){
  if(!value||!validAppId(value.id)||!validText(value.company,200)||!validText(value.title,300))throw Error('请填写公司和岗位');
  const dates=['appliedDate','nextDue','lastUpdated'];
  for(const key of dates)if(dateValue(value[key]??null)===undefined)throw Error(`${key} 日期无效`);
  const events=Array.isArray(value.events)?value.events:[];
  if(events.length>100)throw Error('单个岗位节点过多');
  const seen=new Set();
  const cleanEvents=events.map(event=>{
    if(!event||!validAppId(event.id)||!validText(event.stage,100)||dateValue(event.date??null)===undefined||typeof(event.notes??'')!=='string'||(event.notes??'').length>1000)throw Error('投递节点无效');
    if(seen.has(event.id))throw Error('节点标识重复');
    seen.add(event.id);
    return {id:event.id,stage:event.stage.trim(),date:dateValue(event.date??null),notes:(event.notes??'').trim()};
  });
  const brief=key=>{const text=value[key]??'';if(typeof text!=='string'||text.length>1000)throw Error(`${key} 内容过长`);return text.trim()};
  if(value.sourceJobId!==null&&value.sourceJobId!==undefined&&!validAppId(value.sourceJobId))throw Error('来源岗位无效');
  return {id:value.id,sourceJobId:value.sourceJobId||null,company:value.company.trim(),title:value.title.trim(),appliedDate:dateValue(value.appliedDate??null),currentStage:brief('currentStage')||'已投递',nextAction:brief('nextAction'),nextDue:dateValue(value.nextDue??null),lastUpdated:dateValue(value.lastUpdated??null),notes:brief('notes'),archived:!!value.archived,events:cleanEvents};
}

export function catalogJob(id){return catalog.find(job=>job.id===id)||null}
export async function lookupJob(db,user,id){
  const known=catalogJob(id);
  if(known)return known;
  const row=await db.prepare('SELECT data FROM custom_jobs WHERE user_id=? AND job_id=?').bind(user,id).first();
  if(!row)return null;
  try{return JSON.parse(row.data)}catch{return null}
}

export function applicationStatements(db,user,app){
  const now=new Date().toISOString();
  const statements=[db.prepare(`INSERT INTO applications(user_id,id,source_job_id,company,title,applied_date,current_stage,next_action,next_due,last_updated,notes,archived,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET source_job_id=excluded.source_job_id,company=excluded.company,title=excluded.title,applied_date=excluded.applied_date,current_stage=excluded.current_stage,next_action=excluded.next_action,next_due=excluded.next_due,last_updated=excluded.last_updated,notes=excluded.notes,archived=excluded.archived,updated_at=excluded.updated_at`)
    .bind(user,app.id,app.sourceJobId,app.company,app.title,app.appliedDate,app.currentStage,app.nextAction,app.nextDue,app.lastUpdated,app.notes,Number(app.archived),now,now),
    db.prepare('DELETE FROM application_events WHERE user_id=? AND application_id=?').bind(user,app.id)];
  for(const event of app.events)statements.push(db.prepare('INSERT INTO application_events(user_id,application_id,id,stage,date,notes,created_at) VALUES(?,?,?,?,?,?,?)').bind(user,app.id,event.id,event.stage,event.date,event.notes,now));
  return statements;
}
