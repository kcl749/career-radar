import template from './template.html?raw';
import styles from './styles.css?raw';
import clientScript from './client.js?raw';
import catalog from '../catalog.json';
import {getChatGPTUser} from '../chatgpt-auth';
import {renderBoard} from './render.mjs';

export const dynamic='force-dynamic';

export async function GET(){
  if(!await getChatGPTUser())return new Response('请登录后使用',{status:401});
  const html=renderBoard({template,styles,clientScript,catalog,mode:'online',practiceHref:'/practice'});
  return new Response(html,{headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
  }});
}
