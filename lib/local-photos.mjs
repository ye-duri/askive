import {mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
// Local development adapter. Never served as static files.
export function localPhotos(root){
 const filename=key=>{if(!/^[a-f0-9]{48}\/(?:meta|[0-8])$/.test(key))throw new Error('Invalid object key');return path.join(root,key.replace('/','_')+'.json');};
 return {
 async put(key,value,options={}){await mkdir(root,{recursive:true});const data=typeof value==='string'?Buffer.from(value):Buffer.from(value);const file=filename(key),temp=file+'.'+crypto.randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({data:data.toString('base64'),...options}),{mode:0o600});await rename(temp,file);},
 async get(key){try{const obj=JSON.parse(await readFile(filename(key),'utf8'));const data=Buffer.from(obj.data,'base64');return {...obj,body:data,text:async()=>data.toString()};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])await unlink(filename(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});},
 async list(){const files=await readdir(root).catch(()=>[]),objects=[];for(const file of files.filter(f=>f.endsWith('.json'))){const obj=JSON.parse(await readFile(path.join(root,file),'utf8'));objects.push({key:file.slice(0,-5).replace('_','/'),customMetadata:obj.customMetadata});}return {objects,truncated:false};}
 };
}
