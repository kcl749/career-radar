import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateCatalog,catalogMeta} from '../app/catalog-core.mjs';
import {renderBoard} from '../app/board/render.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [template,styles,clientScript,applicationsScript,papaScript,excelScript,catalogText]=await Promise.all([read('app/board/template.html'),read('app/board/styles.css'),read('app/board/client.js'),read('app/board/applications.js'),read('app/board/vendor/papaparse.min.js'),read('app/board/vendor/read-excel-file.min.js'),read('app/catalog.json')]);
const catalog=validateCatalog(JSON.parse(catalogText));
if(new Set(catalog.map(job=>job.url)).size!==catalog.length)throw new Error('Catalog contains duplicate URLs');
for(const mode of ['online','offline']){
  const html=renderBoard({template,styles,clientScript,applicationsScript,papaScript,excelScript,catalog,mode,practiceHref:mode==='online'?'/practice':'practice.html'});
  if(!html.includes(`"mode":"${mode}"`))throw new Error(`${mode} mode was not embedded`);
  if(!html.includes('"catalog":['))throw new Error(`${mode} catalog was not embedded`);
  if(/__CAREER_RADAR_[A-Z_]+__/.test(html))throw new Error(`${mode} contains unresolved tokens`);
  if(html.includes('let base=['))throw new Error(`${mode} still contains the legacy embedded catalog`);
  if(!html.includes('id="applications-page"')||!html.includes('readXlsxFile')||!html.includes('window.Papa'))throw new Error(`${mode} application pool or import parser missing`);
}
console.log(JSON.stringify({ok:true,...catalogMeta(catalog)},null,2));
