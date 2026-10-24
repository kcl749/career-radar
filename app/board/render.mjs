import {catalogMeta,validateCatalog} from '../catalog-core.mjs';

const TOKENS=['__CAREER_RADAR_STYLES__','__CAREER_RADAR_BOOTSTRAP__','__CAREER_RADAR_CLIENT__','__CAREER_RADAR_APPLICATIONS__','__CAREER_RADAR_PAPA__','__CAREER_RADAR_EXCEL__','__CAREER_RADAR_TITLE__','__CAREER_RADAR_MODE_LABEL__','__CAREER_RADAR_PRACTICE_HREF__'];

const scriptJson=value=>JSON.stringify(value)
  .replaceAll('<','\\u003c')
  .replaceAll('\u2028','\\u2028')
  .replaceAll('\u2029','\\u2029');

const escapeAttribute=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export function renderBoard({template,styles,clientScript,applicationsScript,papaScript,excelScript,catalog,mode='online',practiceHref}){
  validateCatalog(catalog);
  if(!['online','offline'].includes(mode))throw new Error(`Unsupported board mode: ${mode}`);
  const meta=catalogMeta(catalog);
  const config={mode,catalog,meta};
  const values={
    __CAREER_RADAR_STYLES__:styles,
    __CAREER_RADAR_BOOTSTRAP__:`window.__CAREER_RADAR__=${scriptJson(config)};`,
    __CAREER_RADAR_CLIENT__:clientScript,
    __CAREER_RADAR_APPLICATIONS__:applicationsScript,
    __CAREER_RADAR_PAPA__:papaScript,
    __CAREER_RADAR_EXCEL__:excelScript,
    __CAREER_RADAR_TITLE__:mode==='online'?'职途雷达 · 在线版':'职途雷达 · 离线版',
    __CAREER_RADAR_MODE_LABEL__:mode==='online'?'私人岗位库 · 跨设备同步':'私人岗位库 · 当前浏览器保存',
    __CAREER_RADAR_PRACTICE_HREF__:escapeAttribute(practiceHref||(mode==='online'?'/practice':'#')),
  };
  let html=template;
  for(const token of TOKENS){
    if(!html.includes(token))throw new Error(`Board template is missing ${token}`);
    html=html.replaceAll(token,()=>values[token]);
  }
  const unresolved=html.match(/__CAREER_RADAR_[A-Z_]+__/);
  if(unresolved)throw new Error(`Board template contains an unresolved token: ${unresolved[0]}`);
  return html;
}
