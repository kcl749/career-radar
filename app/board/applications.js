(()=>{
  'use strict';
  const bridge=window.radarBridge;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const uid=()=>globalThis.crypto?.randomUUID?.()||`r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const localKey='radarApplicationsV1';
  const fields=[['company','公司 *'],['title','岗位 *'],['appliedDate','投递日期'],['currentStage','当前状态'],['assessmentDate','测评／笔试日期'],['interviewDate','面试日期'],['offerDate','Offer 日期'],['endedDate','结束日期'],['lastUpdated','最近更新时间'],['nextAction','下一步'],['nextDue','下一步截止日期'],['notes','备注']];
  const aliases={company:['公司','公司名称','企业','企业名称','company','employer'],title:['岗位','岗位名称','职位','职位名称','job','position','role','title'],appliedDate:['投递时间','投递日期','申请日期','申请时间','applieddate','applicationdate','submittedat'],currentStage:['当前状态','当前阶段','投递状态','申请状态','status','stage'],assessmentDate:['测评日期','笔试日期','测评时间','笔试时间','assessmentdate','testdate'],interviewDate:['面试日期','面试时间','interviewdate'],offerDate:['offer日期','录用日期','offerdate'],endedDate:['结束日期','拒绝日期','终止日期','endeddate'],lastUpdated:['最近更新时间','更新时间','lastupdated','updatedat'],nextAction:['下一步','待办','下一步行动','nextaction'],nextDue:['截止日期','下一步截止日期','待办截止日期','deadline','nextdue'],notes:['备注','进展','最近进展','note','notes']};
  let applications=[];
  let selected=null;
  let importSource=null;
  let preview=[];
  let loading=false;
  let hoverBubble=false;
  const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=type=>parts.find(value=>value.type===type)?.value;return `${part('year')}-${part('month')}-${part('day')}`};
  const msg=text=>$('application-message').textContent=text;
  const keyOf=app=>`${String(app.company||'').trim().toLocaleLowerCase()}|${String(app.title||'').trim().toLocaleLowerCase()}`;
  const eventKey=event=>`${event.stage}|${event.date||''}|${event.notes||''}`;
  const newApp=()=>({id:uid(),sourceJobId:null,company:'',title:'',appliedDate:null,currentStage:'已投递',nextAction:'',nextDue:null,lastUpdated:null,notes:'',archived:false,events:[]});
  const cleanDate=value=>{
    if(value===null||value===undefined||String(value).trim()==='')return null;
    if(value instanceof Date&&!Number.isNaN(value.valueOf()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
    if(typeof value==='number'&&Number.isInteger(value)&&value>=20000&&value<=80000)return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);
    const match=String(value).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if(!match)return undefined;
    const normalized=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
    const parsed=new Date(`${normalized}T12:00:00Z`);
    return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===normalized?normalized:undefined;
  };
  const urgency=app=>{
    if(!app.nextDue)return {tone:'gray',label:'未设截止'};
    const due=Date.parse(`${app.nextDue}T23:59:59+08:00`);
    if(Number.isNaN(due))return {tone:'gray',label:'截止待确认'};
    const hours=(due-Date.now())/3600000;
    if(hours<0)return {tone:'red',label:'已逾期'};
    if(hours<=48)return {tone:'red',label:'48 小时内'};
    if(hours<=168)return {tone:'amber',label:'7 天内'};
    return {tone:'green',label:'时间充裕'};
  };
  const shortRole=title=>String(title||'待填写岗位').replace(/[（(].*?[）)]/g,'').slice(0,34);
  const sortedEvents=app=>[...app.events].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));

  function showPage(page){
    const applicationPage=page==='applications';
    $('recommendation-page').hidden=applicationPage;
    $('applications-page').hidden=!applicationPage;
    $('nav-recommend').classList.toggle('selected',!applicationPage);
    $('nav-applications').classList.toggle('selected',applicationPage);
    $('nav-recommend').setAttribute('aria-current',applicationPage?'false':'page');
    $('nav-applications').setAttribute('aria-current',applicationPage?'page':'false');
    if(applicationPage)render();
  }
  $('nav-recommend').onclick=()=>showPage('recommendations');
  $('nav-applications').onclick=()=>showPage('applications');

  function storeOffline(){localStorage.setItem(localKey,JSON.stringify(applications))}
  async function load(){
    if(loading)return;
    loading=true;
    try{
      if(bridge.online){
        const data=await bridge.api('/api/applications');
        applications=data.applications;
      }else{
        try{applications=JSON.parse(localStorage.getItem(localKey)||'[]')}catch{applications=[]}
        if(!Array.isArray(applications))applications=[];
        migrateLocalMarks();
      }
      render();
    }catch(error){msg(error.message)}
    finally{loading=false}
  }
  function migrateLocalMarks(){
    let changed=false;
    for(const [id,mark] of Object.entries(bridge.getState())){
      if(!mark?.applied||applications.some(app=>app.sourceJobId===id))continue;
      const job=bridge.getJobs().find(item=>item.id===id);
      if(!job)continue;
      applications.push({...newApp(),id:`job:${id}`,sourceJobId:id,company:job.company,title:job.title,appliedDate:null,events:[{id:`initial:${id}`,stage:'已投递',date:null,notes:'旧标记，投递日期待补充'}]});
      changed=true;
    }
    if(changed)storeOffline();
  }
  async function save(changed){
    if(!changed.company.trim()||!changed.title.trim())throw Error('公司和岗位为必填项');
    if(bridge.online)await bridge.api('/api/applications',{method:'PUT',body:JSON.stringify({applications:[changed]})});
    else{applications=[changed,...applications.filter(app=>app.id!==changed.id)];storeOffline()}
    if(bridge.online)await load();else render();
  }

  function bubble(app,index){
    const u=urgency(app);
    return `<button class="application-bubble" type="button" data-app-id="${esc(app.id)}" data-urgency="${u.tone}" aria-label="${esc(`${app.company||'新投递'}，${app.title||'待填写岗位'}，${app.currentStage}，${u.label}`)}" aria-expanded="${selected===app.id}" style="--delay:${-(index%5)*1.2}s"><strong>${esc(app.company||'新投递')}</strong><span class="bubble-role">${esc(shortRole(app.title))}</span><span class="bubble-stage">${esc(app.currentStage||'已投递')}</span><span class="bubble-urgency">${esc(u.label)}</span></button>`;
  }
  function eventRows(app){
    const events=sortedEvents(app);
    return events.length?events.map(event=>`<li><strong>${esc(event.stage)} · ${esc(event.date||'日期待补充')}</strong><span class="muted">${esc(event.notes||'')}</span></li>`).join(''):'<li><strong>暂无节点</strong><span class="muted">可在下方添加投递、测评或面试进展。</span></li>';
  }
  function nodeEditor(event){return `<div class="node-edit" data-event-id="${esc(event.id)}"><label>日期<input type="date" data-node="date" value="${esc(event.date||'')}"></label><label>节点<input data-node="stage" list="application-stages" value="${esc(event.stage)}" maxlength="100"></label><label>说明<input data-node="notes" value="${esc(event.notes||'')}" maxlength="1000" placeholder="可选说明"></label><button type="button" data-action="remove-node" aria-label="删除节点">删除</button></div>`}
  function detail(app){
    const u=urgency(app);
    return `<div class="application-detail" data-detail-id="${esc(app.id)}"><div class="detail-top"><div><span class="eyebrow">投递时间线 · ${esc(u.label)}</span><h2>${esc(app.company||'新投递')} · ${esc(app.title||'待填写岗位')}</h2></div><button type="button" data-action="close">关闭详情</button></div><ol class="timeline">${eventRows(app)}</ol><h3>编辑投递记录</h3><div class="detail-grid"><label>公司 *<input data-field="company" value="${esc(app.company)}" maxlength="200" required></label><label>完整岗位名称 *<input data-field="title" value="${esc(app.title)}" maxlength="300" required></label><label>投递日期<input data-field="appliedDate" type="date" value="${esc(app.appliedDate||'')}"></label><label>当前阶段<input data-field="currentStage" list="application-stages" value="${esc(app.currentStage)}" maxlength="100"></label><label>最近更新时间<input data-field="lastUpdated" type="date" value="${esc(app.lastUpdated||'')}"></label><label>下一步<input data-field="nextAction" value="${esc(app.nextAction||'')}" maxlength="1000" placeholder="例如：完成在线测评"></label><label>下一步截止日期<input data-field="nextDue" type="date" value="${esc(app.nextDue||'')}"></label><label>最近进展／备注<textarea data-field="notes" maxlength="1000">${esc(app.notes||'')}</textarea></label></div><h3>节点</h3><div class="node-editors">${sortedEvents(app).map(nodeEditor).join('')}</div><div class="toolbar"><button type="button" data-action="add-node">＋ 添加节点</button><button type="button" data-action="save" class="primary">保存修改</button><button type="button" data-action="archive">${app.archived?'恢复投递线':'归档投递线'}</button></div></div>`;
  }
  function render(){
    const active=applications.filter(app=>!app.archived);
    $('application-nav-count').textContent=active.length;
    $('application-active-count').textContent=`${active.length} 条进行中`;
    $('application-urgent-count').textContent=`${active.filter(app=>urgency(app).tone==='red').length} 条需关注`;
    const view=$('application-view').value;
    const list=applications.filter(app=>view==='all'||(view==='archived'?app.archived:!app.archived));
    const pool=$('application-pool');
    if(!list.length){pool.innerHTML=`<div class="empty"><div class="icon">◌</div><h2>${view==='archived'?'暂无归档记录':'投递池等待第一颗气泡'}</h2><p class="muted">在推荐页标记“已投递”，或导入已有投递记录。</p></div>`;return}
    const columns=Math.max(1,Math.floor((pool.clientWidth-30)/220));
    const rows=[];
    for(let i=0;i<list.length;i+=columns){
      const part=list.slice(i,i+columns);
      rows.push(`<div class="bubble-row" style="grid-template-columns:repeat(${part.length},minmax(0,1fr));max-width:${part.length*220}px;margin-inline:auto">${part.map((app,index)=>bubble(app,i+index)).join('')}</div>`);
      const expanded=part.find(app=>app.id===selected);
      if(expanded)rows.push(detail(expanded));
    }
    pool.innerHTML=rows.join('');
    pool.classList.toggle('paused',!!selected||hoverBubble||document.visibilityState==='hidden');
  }
  $('application-view').onchange=()=>{selected=null;render()};
  $('application-pool').addEventListener('mouseover',event=>{if(event.target.closest('.application-bubble')){hoverBubble=true;$('application-pool').classList.add('paused')}});
  $('application-pool').addEventListener('mouseout',event=>{if(event.target.closest('.application-bubble')&&!event.relatedTarget?.closest?.('.application-bubble')){hoverBubble=false;$('application-pool').classList.toggle('paused',!!selected)}});
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('page-hidden',document.visibilityState==='hidden');$('application-pool').classList.toggle('paused',!!selected||hoverBubble||document.visibilityState==='hidden')});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected){selected=null;render();$('nav-applications').focus()}});
  $('application-pool').addEventListener('click',async event=>{
    const bubbleButton=event.target.closest('.application-bubble');
    if(bubbleButton){selected=selected===bubbleButton.dataset.appId?null:bubbleButton.dataset.appId;render();return}
    const button=event.target.closest('button[data-action]');
    if(!button)return;
    const action=button.dataset.action;
    if(action==='close'){selected=null;render();return}
    const detailElement=button.closest('[data-detail-id]');
    const app=applications.find(item=>item.id===detailElement?.dataset.detailId);
    if(!app)return;
    if(action==='add-node'){
      detailElement.querySelector('.node-editors').insertAdjacentHTML('beforeend',nodeEditor({id:uid(),stage:'面试',date:null,notes:''}));
      detailElement.querySelector('.node-editors .node-edit:last-child input[data-node=stage]').focus();return;
    }
    if(action==='remove-node'){button.closest('.node-edit')?.remove();return}
    if(action==='save'){
      const updated={...app};
      for(const field of detailElement.querySelectorAll('[data-field]'))updated[field.dataset.field]=field.value.trim()||(['appliedDate','lastUpdated','nextDue'].includes(field.dataset.field)?null:'');
      updated.events=[...detailElement.querySelectorAll('.node-edit')].map(row=>({id:row.dataset.eventId,stage:row.querySelector('[data-node=stage]').value.trim(),date:row.querySelector('[data-node=date]').value||null,notes:row.querySelector('[data-node=notes]').value.trim()}));
      if(updated.appliedDate!==app.appliedDate){
        const initial=updated.events.find(node=>node.id.startsWith('initial:'))||updated.events.find(node=>node.stage==='已投递');
        if(initial){initial.date=updated.appliedDate;if(initial.notes==='旧标记，投递日期待补充')initial.notes=''}
        else if(updated.appliedDate)updated.events.unshift({id:uid(),stage:'已投递',date:updated.appliedDate,notes:''});
      }
      if(updated.events.some(node=>!node.stage)){msg('节点名称不能为空');return}
      try{await save(updated);selected=updated.id;render();msg('投递记录已保存。')}catch(error){msg(error.message)}
      return;
    }
    if(action==='archive'){
      try{
        const restoring=app.archived;
        if(app.sourceJobId&&app.id===`job:${app.sourceJobId}`){const ok=await bridge.write(app.sourceJobId,{applied:restoring});if(!ok)throw Error('标记未保存，请稍后重试');if(bridge.online)await load()}
        else await save({...app,archived:!app.archived});
        selected=null;render();msg(restoring?'已恢复投递线。':'已归档，历史节点保留。');
      }catch(error){msg(error.message)}
    }
  });
  $('new-application').onclick=()=>{const app=newApp();applications.unshift(app);$('application-view').value='active';selected=app.id;render();$('application-pool').querySelector('[data-field=company]')?.focus()};

  function markChanged(detail){
    if(bridge.online){load();return}
    const appId=`job:${detail.id}`;
    let app=applications.find(item=>item.id===appId);
    if(detail.applied){
      if(app)app.archived=false;
      else if(detail.job)applications.unshift({...newApp(),id:appId,sourceJobId:detail.id,company:detail.job.company,title:detail.job.title,appliedDate:today(),events:[{id:`initial:${detail.id}`,stage:'已投递',date:today(),notes:''}]});
    }else if(app)app.archived=true;
    storeOffline();render();
  }
  window.addEventListener('radar:mark',event=>markChanged(event.detail));
  window.addEventListener('radar:state',()=>{if(bridge.online){if(!$('applications-page').querySelector(':focus'))load()}else{migrateLocalMarks();render()}});

  function downloadBackup(){const data={schema:'career-radar-applications-v1',exportedAt:new Date().toISOString(),applications};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='职途雷达-投递记录.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  $('application-export').onclick=downloadBackup;
  $('application-import').onclick=()=>$('application-file').click();
  $('cancel-application-import').onclick=$('cancel-application-import-bottom').onclick=()=>{$('application-import-workspace').hidden=true;importSource=null;preview=[]};

  const norm=value=>String(value||'').toLowerCase().replace(/[\s_\-（）。／/]/g,'');
  function autoMap(headers){const map={};for(const [key] of fields){const expected=aliases[key].map(norm);map[key]=headers.findIndex(header=>expected.includes(norm(header)))}return map}
  function mappingUI(){
    $('import-mapping').innerHTML=fields.map(([key,label])=>`<label>${label}<select data-map="${key}"><option value="-1">不导入</option>${importSource.headers.map((header,index)=>`<option value="${index}" ${importSource.mapping[key]===index?'selected':''}>${esc(header)}</option>`).join('')}</select></label>`).join('');
  }
  const rawValue=(row,key)=>{const index=importSource.mapping[key];return index>=0?row[index]:null};
  function deriveRow(row,index){
    const original=importSource.backup?.[index];
    const app={...newApp(),id:original?.id||uid(),sourceJobId:original?.sourceJobId||null,company:String(rawValue(row,'company')??'').trim(),title:String(rawValue(row,'title')??'').trim(),appliedDate:null,currentStage:String(rawValue(row,'currentStage')||'已投递').trim(),nextAction:String(rawValue(row,'nextAction')??'').trim(),nextDue:null,lastUpdated:null,notes:String(rawValue(row,'notes')??'').trim(),events:original?.events?.map(event=>({...event}))||[]};
    const invalid=[];
    for(const key of ['appliedDate','nextDue','lastUpdated','assessmentDate','interviewDate','offerDate','endedDate']){
      const parsed=cleanDate(rawValue(row,key));
      if(parsed===undefined)invalid.push(key);
      else if(key in app)app[key]=parsed;
      else {app[key]=parsed;if(parsed){const stage={assessmentDate:'测评／笔试',interviewDate:'面试',offerDate:'Offer',endedDate:'结束'}[key];if(!app.events.some(event=>event.stage===stage&&event.date===parsed))app.events.push({id:uid(),stage,date:parsed,notes:''})}}
    }
    if(app.appliedDate&&!app.events.some(event=>event.stage==='已投递'&&event.date===app.appliedDate))app.events.unshift({id:uid(),stage:'已投递',date:app.appliedDate,notes:''});
    return {app,invalid,duplicate:'merge',row:index+1};
  }
  function renderPreview(){
    const seen=new Map();
    $('application-preview').innerHTML=preview.map((item,index)=>{
      const app=item.app;
      const match=applications.find(existing=>existing.id===app.id)||applications.find(existing=>keyOf(existing)===keyOf(app)&&app.company&&app.title)||seen.get(keyOf(app));
      if(app.company&&app.title)seen.set(keyOf(app),app);
      const issues=[];
      if(!app.company||!app.title)issues.push('公司和岗位必填');
      if(!app.appliedDate)issues.push('投递日期待补充');
      if(item.invalid.length)issues.push(`${item.invalid.map(key=>fields.find(field=>field[0]===key)?.[1]||key).join('、')}无法识别`);
      if(match)issues.push('疑似同公司同岗位');
      const input=(field,type='text')=>`<input data-preview="${index}" data-field="${field}" type="${type}" value="${esc(app[field]||'')}">`;
      return `<tr><td>${item.row}</td><td>${input('company')}</td><td>${input('title')}</td><td>${input('appliedDate','date')}</td><td>${input('currentStage')}</td><td>${input('nextAction')}</td><td>${input('nextDue','date')}</td><td><select data-preview="${index}" data-field="duplicate"><option value="merge" ${item.duplicate==='merge'?'selected':''}>合并时间线</option><option value="keep" ${item.duplicate==='keep'?'selected':''}>保留另一次投递</option></select></td><td><span class="${!app.company||!app.title?'import-error':'import-warning'}">${esc(issues.join('；')||'可导入')}</span><details><summary>更多日期与备注</summary><label>最近更新${input('lastUpdated','date')}</label><label>测评／笔试${input('assessmentDate','date')}</label><label>面试${input('interviewDate','date')}</label><label>Offer${input('offerDate','date')}</label><label>结束${input('endedDate','date')}</label><label>备注${input('notes')}</label></details></td></tr>`;
    }).join('');
    $('import-issues').textContent=`${preview.length} 行 · ${preview.filter(item=>!item.app.company||!item.app.title).length} 行缺少必填项 · ${preview.filter(item=>item.invalid.length).length} 行存在无法识别的日期`;
    $('confirm-application-import').disabled=preview.some(item=>!item.app.company||!item.app.title||item.invalid.length);
  }
  $('application-preview').addEventListener('change',event=>{
    const input=event.target.closest('[data-preview]');if(!input)return;
    const item=preview[Number(input.dataset.preview)];
    if(input.dataset.field==='duplicate')item.duplicate=input.value;
    else{
      const key=input.dataset.field;
      item.app[key]=['appliedDate','nextDue','lastUpdated','assessmentDate','interviewDate','offerDate','endedDate'].includes(key)?input.value||null:input.value.trim();
      item.invalid=item.invalid.filter(value=>value!==key);
      if(['assessmentDate','interviewDate','offerDate','endedDate'].includes(key)){
        const stage={assessmentDate:'测评／笔试',interviewDate:'面试',offerDate:'Offer',endedDate:'结束'}[key];
        item.app.events=item.app.events.filter(node=>node.stage!==stage);
        if(input.value)item.app.events.push({id:uid(),stage,date:input.value,notes:''});
      }
      if(key==='appliedDate'){
        item.app.events=item.app.events.filter(node=>node.stage!=='已投递');
        if(input.value)item.app.events.unshift({id:uid(),stage:'已投递',date:input.value,notes:''});
      }
    }
    renderPreview();
  });
  $('apply-import-mapping').onclick=()=>{
    for(const select of $('import-mapping').querySelectorAll('[data-map]'))importSource.mapping[select.dataset.map]=Number(select.value);
    preview=importSource.rows.map(deriveRow);renderPreview();
  };
  $('application-file').onchange=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      if(file.size>5_000_000)throw Error('文件超过 5 MB，请分批导入');
      const extension=file.name.split('.').pop().toLowerCase();
      if(extension==='xls')throw Error('旧版 .xls 暂不支持，请先在 Excel 中另存为 .xlsx');
      let rows,backup=null;
      if(extension==='xlsx'){
        const workbook=await window.readXlsxFile(file);
        rows=Array.isArray(workbook?.[0]?.data)?workbook[0].data:workbook;
      }
      else if(extension==='csv'){
        const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);
        if(text.includes('�'))text=new TextDecoder('gb18030').decode(buffer);
        const parsed=window.Papa.parse(text,{skipEmptyLines:'greedy'});if(parsed.errors.length)throw Error(`CSV 第 ${parsed.errors[0].row+1} 行解析失败`);rows=parsed.data;
      }else if(extension==='json'){
        const data=JSON.parse(await file.text());
        const values=Array.isArray(data)?data:(data.applications||data.records);
        if(!Array.isArray(values))throw Error('JSON 需为记录数组或包含 applications 数组');
        backup=data.schema==='career-radar-applications-v1'?values:null;
        const headers=[...new Set(values.flatMap(value=>Object.keys(value)))];
        rows=[headers,...values.map(value=>headers.map(key=>value[key]))];
      }else throw Error('请选择 .xlsx、CSV 或 JSON 文件');
      if(!Array.isArray(rows)||rows.length<2)throw Error('文件没有可导入的记录');
      if(rows.length>201)throw Error('单次最多导入 200 行');
      importSource={headers:rows[0].map(String),rows:rows.slice(1),mapping:autoMap(rows[0]),backup};
      preview=importSource.rows.map(deriveRow);
      $('import-file-label').textContent=`${file.name} · ${preview.length} 行`;
      mappingUI();renderPreview();$('application-import-workspace').hidden=false;
      $('application-import-workspace').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){msg(error.message)}
  };
  $('confirm-application-import').onclick=async()=>{
    if(!preview.length)return;
    if(preview.some(item=>!item.app.company||!item.app.title||item.invalid.length)){msg('请补齐必填项并修正无法识别的日期');return}
    const merged=new Map(applications.map(app=>[app.id,app]));
    const changed=new Map();
    for(const item of preview){
      const incoming=item.app;
      const existing=item.duplicate==='merge'?[...merged.values()].find(app=>app.id===incoming.id||keyOf(app)===keyOf(incoming)):null;
      const target=existing?{...existing,company:incoming.company,title:incoming.title,appliedDate:incoming.appliedDate||existing.appliedDate,currentStage:incoming.currentStage||existing.currentStage,nextAction:incoming.nextAction||existing.nextAction,nextDue:incoming.nextDue||existing.nextDue,lastUpdated:incoming.lastUpdated||existing.lastUpdated,notes:incoming.notes||existing.notes,archived:false,events:[...existing.events]}:{...incoming,id:merged.has(incoming.id)?uid():incoming.id,events:[...incoming.events]};
      const keys=new Set(target.events.map(eventKey));
      for(const event of incoming.events)if(!keys.has(eventKey(event))){target.events.push({...event,id:target.events.some(item=>item.id===event.id)?uid():event.id});keys.add(eventKey(event))}
      merged.set(target.id,target);changed.set(target.id,target);
    }
    try{
      const records=[...changed.values()];
      if(bridge.online)await bridge.api('/api/applications',{method:'PUT',body:JSON.stringify({applications:records})});
      else{applications=[...merged.values()];storeOffline()}
      $('application-import-workspace').hidden=true;importSource=null;preview=[];
      if(bridge.online)await load();else render();
      msg(`已保存 ${records.length} 条投递记录；重复节点已合并。`);
    }catch(error){msg(error.message)}
  };

  window.addEventListener('resize',()=>{if(!$('applications-page').hidden)render()});
  load();
})();
