import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {renderBoard} from '../app/board/render.mjs';
import {validateCatalog} from '../app/catalog-core.mjs';

const projectRoot=path.resolve(import.meta.dirname,'..');
const defaultOutputRoot=path.resolve(projectRoot,'..','..','outputs');
const readProjectFile=relative=>readFile(path.join(projectRoot,relative),'utf8');

function nextVersion(names){
  return Math.max(0,...names.map(name=>Number(name.match(/-v(\d+)\.html$/)?.[1]||0)))+1;
}

export async function buildOffline({outputRoot=defaultOutputRoot,date,version}={}){
  const [template,styles,clientScript,catalogText,outputNames]=await Promise.all([
    readProjectFile('app/board/template.html'),
    readProjectFile('app/board/styles.css'),
    readProjectFile('app/board/client.js'),
    readProjectFile('app/catalog.json'),
    readdir(outputRoot),
  ]);
  const catalog=validateCatalog(JSON.parse(catalogText));
  const verified=date||catalog.map(job=>job.verified).filter(Boolean).sort().at(-1)||new Date().toISOString().slice(0,10);
  const practice=outputNames.filter(name=>/^职途雷达-每日训练-.*\.html$/.test(name)).sort().at(-1)||'#';
  const resolvedVersion=version||nextVersion(outputNames.filter(name=>/^职途雷达-离线版-.*\.html$/.test(name)));
  const filename=`职途雷达-离线版-${verified}-v${resolvedVersion}.html`;
  const output=path.join(outputRoot,filename);
  const html=renderBoard({template,styles,clientScript,catalog,mode:'offline',practiceHref:practice});
  await writeFile(output,html,'utf8');
  return {output,filename,count:catalog.length,version:resolvedVersion,date:verified};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  console.log(JSON.stringify(await buildOffline(),null,2));
}
