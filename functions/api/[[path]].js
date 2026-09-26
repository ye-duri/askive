import {gallery} from '../../lib/gallery.mjs';
export async function onRequest({request,env}){return gallery(request,env);}
