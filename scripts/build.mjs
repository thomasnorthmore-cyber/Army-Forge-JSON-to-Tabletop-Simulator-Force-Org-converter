import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/src',{recursive:true});
await copyFile('index.html','public/index.html');
for(const f of ['army-forge.mjs','force-org.mjs','faction-fetch.mjs'])await copyFile('src/'+f,'public/src/'+f);
console.log('Website assets prepared');
