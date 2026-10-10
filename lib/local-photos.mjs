import {mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Local development adapter. Never served as static files.
export function localPhotos(root){
 const writes=new Map();
 const filename=key=>{if(!/^(?:[a-f0-9]{48}\/(?:meta|[0-9])|_print_devices\/[a-f0-9]{48})$/.test(key))throw new Error('Invalid object key');return path.join(root,key.replace('/','_')+'.json');};
 return {
 async put(key,value,options={}){
 const previous=writes.get(key)||Promise.resolve();const task=previous.catch(()=>{}).then(async()=>{await mkdir(root,{recursive:true});const data=typeof value==='string'?Buffer.from(value):Buffer.from(value);const file=filename(key);
 if(options.onlyIf?.etagMatches){try{const old=JSON.parse(await readFile(file,'utf8'));const etag=createHash('sha256').update(Buffer.from(old.data,'base64')).digest('hex');if(etag!==options.onlyIf.etagMatches)return null;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 const temp=file+'.'+crypto.randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({data:data.toString('base64'),...options}),{mode:0o600});await rename(temp,file);return {etag:createHash('sha256').update(data).digest('hex')};});writes.set(key,task);try{return await task;}finally{if(writes.get(key)===task)writes.delete(key);}
 },
 async get(key){try{const obj=JSON.parse(await readFile(filename(key),'utf8'));const data=Buffer.from(obj.data,'base64');return {...obj,etag:createHash('sha256').update(data).digest('hex'),body:data,text:async()=>data.toString()};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])await unlink(filename(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});},
 async list(){const files=await readdir(root).catch(()=>[]),objects=[];for(const file of files.filter(f=>f.endsWith('.json'))){const obj=JSON.parse(await readFile(path.join(root,file),'utf8'));objects.push({key:file.startsWith('_print_devices_')?file.slice(0,-5).replace('_print_devices_','_print_devices/'):file.slice(0,-5).replace('_','/'),customMetadata:obj.customMetadata});}return {objects,truncated:false};}
 };
}
