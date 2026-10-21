(()=>{
  'use strict';

  const config=window.__CAREER_RADAR__;
  if(!config||!Array.isArray(config.catalog))throw new Error('岗位目录未正确载入');
  const online=config.mode==='online';
  const $=id=>document.getElementById(id);
  // Keep the original keys so existing offline collections survive the refactor.
  const storage={jobs:'radarJobs',state:'radarState'};
  let base=config.catalog;
  let custom=[];
  let state={};
  let ready=!online;
  let busy=false;

  document.body.dataset.mode=config.mode;

  if(!online){
    try{
      custom=JSON.parse(localStorage.getItem(storage.jobs)||'[]');
      state=JSON.parse(localStorage.getItem(storage.state)||'{}');
    }catch{
      custom=[];
      state={};
    }
  }

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safe=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}};
  const mergedJobs=()=>[...new Map([...base,...custom].map(job=>[job.id,job])).values()];
  const all=()=>mergedJobs().sort((a,b)=>(a.priority||99)-(b.priority||99));
  const latestBatch=()=>{
    const jobs=mergedJobs();
    return jobs.at(-1)?.batch||'';
  };
  const batchLabel=batch=>{
    const count=mergedJobs().filter(job=>job.batch===batch).length;
    return `${batch}（${count}）`;
  };

  function syncBatchOptions(preferred){
    const select=$('batch');
    const selected=preferred??select.value;
    const batches=[];
    const seen=new Set();
    const jobs=mergedJobs();
    for(let index=jobs.length-1;index>=0;index--){
      const batch=jobs[index].batch;
      if(batch&&!seen.has(batch)){seen.add(batch);batches.push(batch)}
    }
    select.replaceChildren(new Option('全部批次',''),...batches.map(batch=>new Option(batchLabel(batch),batch)));
    select.value=batches.includes(selected)?selected:'';
  }

  function updateSummary(){
    const batch=latestBatch();
    const jobs=mergedJobs().filter(job=>job.batch===batch);
    const verified=jobs.map(job=>job.verified).filter(Boolean).sort().at(-1)||'待确认';
    $('updated').textContent=batch?`${batch} · ${jobs.length} 个岗位 · ${verified} 已核验`:`尚无岗位`;
    $('latest-note').textContent=batch?`最新批次：${batch}。共 ${jobs.length} 个岗位，核验日期 ${verified}。平台日期不一定等于企业首次发布日期，申请前仍需核对企业官网。`:'尚无岗位数据。';
  }

  function render(){
    const data=all();
    $('total').textContent=data.length;
    $('saved').textContent=data.filter(job=>state[job.id]?.saved).length;
    $('applied').textContent=data.filter(job=>state[job.id]?.applied).length;
    const query=$('q').value.toLowerCase();
    const list=data.filter(job=>{
      const city=$('city').value;
      const view=$('view').value;
      return (!$('batch').value||job.batch===$('batch').value)
        &&JSON.stringify(job).toLowerCase().includes(query)
        &&(!city||(city==='其他'?!['深圳','广州','上海','北京'].some(name=>job.city?.includes(name)):job.city?.includes(city)))
        &&(!$('type').value||job.type===$('type').value)
        &&((!view&&!state[job.id]?.feedback)||view==='all'||(['low','unsuitable'].includes(view)?state[job.id]?.feedback===view:state[job.id]?.[view]));
    });
    $('jobs').innerHTML=list.length?list.map(job=>`<article class="card"><div class="row"><span class="muted">${esc(job.company)} · ${esc(job.city)} · ${esc(job.type)}</span><span class="tag">推荐 #${esc(job.priority||'—')}</span></div><h3>${esc(job.title)}</h3><p><strong>核心技能：</strong>${esc(job.skills)}<br><strong>匹配原因：</strong>${esc(job.reason)}<br><strong>收录等级：</strong>${esc(job.tier||'首期候选')}<br><strong>申请状态：</strong>${esc(job.status||'以申请页面为准')}<br><strong>截止口径：</strong>${esc(job.deadline||'未明确')}<br><strong>资格要求：</strong>${esc(job.eligibility||'待确认')}<br><strong>补充方向：</strong>${esc(job.improvement||'待补充')}</p><p class="muted">发布：${esc(job.published||'未标明')} · 核验：${esc(job.verified||'待确认')}</p><div class="row">${safe(job.url)?`<a href="${esc(safe(job.url))}" target="_blank" rel="noopener noreferrer">前往申请 ↗</a>`:'申请链接待补充'}<div><button data-id="${esc(job.id)}" data-action="saved">${state[job.id]?.saved?'★ 已收藏':'☆ 收藏'}</button> <button data-id="${esc(job.id)}" data-action="applied">${state[job.id]?.applied?'✓ 已投递':'标记已投递'}</button></div></div><div class="feedback-panel"><label>岗位反馈 <select data-feedback="kind" data-id="${esc(job.id)}" aria-label="岗位相关性"><option value="" ${!state[job.id]?.feedback?'selected':''}>未标记</option><option value="low" ${state[job.id]?.feedback==='low'?'selected':''}>相关性低</option><option value="unsuitable" ${state[job.id]?.feedback==='unsuitable'?'selected':''}>不适用</option></select></label>${state[job.id]?.feedback?`<label>原因 <select data-feedback="reason" data-id="${esc(job.id)}" aria-label="反馈原因">${['未说明','工作内容不喜欢','技能差距较大','毕业届别或学历不符','城市不合适','出勤或实习时长不符','到岗时间不符','已截止或下线','薪资或待遇不合适','其他'].map(value=>`<option ${state[job.id]?.feedbackReason===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label><label>补充说明（可选） <input data-feedback="note" data-id="${esc(job.id)}" value="${esc(state[job.id]?.feedbackNote||'')}" maxlength="500" placeholder="例如：偏基础报表，希望更多建模工作"></label><span class="muted">已保存，可选“未标记”撤销。</span>`:''}</div></article>`).join(''):`<div class="empty"><div class="icon">⌕</div><h2>${data.length?'暂无符合筛选条件的机会':'你的机会库，准备就绪'}</h2><p class="muted">${data.length?'试试调整城市、关键词或查看范围。':'尚未收录经过核实的岗位。'}</p></div>`;
  }

  const say=text=>$('sync-status').textContent=text;
  const controls=()=>document.querySelectorAll('[data-action],[data-feedback],#import,#export,#feedback-export,#refresh-jobs,#refresh-type,#refresh-count').forEach(element=>element.disabled=!ready||busy);
  const draw=()=>{render();controls()};
  const persistOffline=()=>{
    localStorage.setItem(storage.jobs,JSON.stringify(custom));
    localStorage.setItem(storage.state,JSON.stringify(state));
  };

  async function api(path,options={}){
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const type=response.headers.get('content-type')||'';
    if(!response.ok||!type.includes('application/json'))throw new Error(response.status===401?'登录已过期，请重新登录':`云端请求失败（${response.status}），记录未保存`);
    const data=await response.json();
    if(data.error)throw new Error(data.error);
    return data;
  }

  async function pull(){
    if(!online||busy)return;
    busy=true;
    controls();
    try{
      const data=await api('/api/state');
      state=data.state;
      custom=data.jobs;
      ready=true;
      syncBatchOptions();
      updateSummary();
      say(`☁ 已同步 · ${data.user} · ${new Date().toLocaleTimeString()}`);
      draw();
    }catch(error){
      say(error.message);
      $('message').textContent='无法读取云端。请检查网络后重试；尚未把本地标记当作云端记录。';
    }finally{
      busy=false;
      controls();
    }
  }

  async function write(id,patch){
    if(!ready||busy)return;
    if(!online){
      state[id]={...(state[id]||{}),...patch,feedbackUpdated:new Date().toISOString()};
      persistOffline();
      $('message').textContent='已保存到当前浏览器。';
      draw();
      return;
    }
    busy=true;
    controls();
    say('正在保存…');
    try{
      await api('/api/state',{method:'PATCH',body:JSON.stringify({id,patch})});
      state[id]={...(state[id]||{}),...patch};
      $('message').textContent='已保存到云端，其他设备会在30秒内或刷新后读取。';
    }catch(error){
      $('message').textContent=error.message;
    }finally{
      busy=false;
      await pull();
      draw();
    }
  }

  function download(name,payload){
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=name;
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  ['q','city','type','view','batch'].forEach(id=>$(id).addEventListener('input',draw));
  $('jobs').addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');
    if(button)write(button.dataset.id,{[button.dataset.action]:!state[button.dataset.id]?.[button.dataset.action]});
  });
  $('jobs').addEventListener('change',event=>{
    const element=event.target;
    if(!element.dataset.feedback)return;
    let patch;
    if(element.dataset.feedback==='kind'){
      patch={feedback:element.value};
      if(!element.value)Object.assign(patch,{feedbackReason:'',feedbackNote:''});
      else patch.feedbackReason=state[element.dataset.id]?.feedbackReason||'未说明';
      $('view').value=element.value||'all';
    }else if(element.dataset.feedback==='reason')patch={feedbackReason:element.value};
    else patch={feedbackNote:element.value.trim()};
    write(element.dataset.id,patch);
  });

  $('refresh-cloud').onclick=pull;
  $('refresh-jobs').onclick=async()=>{
    const type=$('refresh-type').value;
    const count=Math.min(20,Math.max(1,Math.trunc(Number($('refresh-count').value)||0)));
    if(!online){
      $('message').textContent=`请在聊天中发送“更新 ${count} 个${type}岗位”。生成新版后，现有收藏与投递记录仍保存在这个浏览器。`;
      window.scrollTo({top:$('message').offsetTop-100,behavior:'smooth'});
      return;
    }
    if(!ready||busy)return;
    busy=true;
    controls();
    say('正在搜索公开岗位…');
    try{
      const data=await api('/api/jobs/refresh',{method:'POST',body:JSON.stringify({type,count})});
      custom=[...new Map([...custom,...data.jobs].map(job=>[job.id,job])).values()];
      const batch=data.jobs[0]?.batch;
      syncBatchOptions(batch);
      updateSummary();
      $('message').textContent=`已新增 ${data.jobs.length} 个候选。${data.note}`;
      say(`☁ 岗位库已更新 · ${new Date().toLocaleTimeString()}`);
      draw();
    }catch(error){
      $('message').textContent=error.message;
      say('更新未完成');
    }finally{
      busy=false;
      controls();
    }
  };

  $('import').onclick=()=>$('file').click();
  $('file').onchange=async event=>{
    const file=event.target.files[0];
    if(!file||!ready||busy)return;
    busy=true;
    controls();
    try{
      if(file.size>2000000)throw new Error('备份超过2MB，请分批导入');
      const value=JSON.parse(await file.text());
      const rows=Array.isArray(value)?value:value.jobs;
      if(!Array.isArray(rows)||rows.length>200||rows.some(job=>typeof job.id!=='string'||!job.company||!job.title))throw new Error('文件需包含有效岗位清单，单次最多200个岗位。');
      const baseIds=new Set(base.map(job=>job.id));
      const customRows=rows.filter(job=>!baseIds.has(job.id));
      if(online){
        await api('/api/import',{method:'POST',body:JSON.stringify({jobs:customRows,state:value.state||{}})});
        $('message').textContent='记录已迁移到当前账号云端。';
      }else{
        custom=[...new Map([...custom,...customRows].map(job=>[job.id,job])).values()];
        if(value.state&&typeof value.state==='object')state={...state,...value.state};
        persistOffline();
        syncBatchOptions();
        updateSummary();
        $('message').textContent='记录已导入当前浏览器。';
      }
    }catch(error){
      $('message').textContent=`导入失败：${error.message}`;
    }finally{
      busy=false;
      if(online)await pull();
      draw();
      event.target.value='';
    }
  };

  $('export').onclick=()=>download('职途雷达完整备份.json',{schema:'career-radar-backup-v1',exportedAt:new Date().toISOString(),jobs:all(),state});
  $('feedback-export').onclick=()=>{
    const feedback=all().filter(job=>state[job.id]?.feedback).map(job=>({id:job.id,company:job.company,title:job.title,city:job.city,type:job.type,url:job.url,skills:job.skills,feedback:state[job.id].feedback==='low'?'相关性低':'不适用',reason:state[job.id].feedbackReason||'未说明',note:state[job.id].feedbackNote||''}));
    if(!feedback.length){$('message').textContent='尚无已标记的筛选反馈';return}
    download('岗位筛选反馈.json',{schema:'career-radar-feedback-v1',exportedAt:new Date().toISOString(),feedback});
  };

  syncBatchOptions(config.meta.latestBatch);
  updateSummary();
  draw();
  if(online){
    pull();
    setInterval(()=>{if(document.visibilityState==='visible'&&!busy&&!document.activeElement?.matches('[data-feedback]'))pull()},30000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pull()});
  }else say('✓ 离线岗位库已载入 · 记录保存在当前浏览器');
})();
