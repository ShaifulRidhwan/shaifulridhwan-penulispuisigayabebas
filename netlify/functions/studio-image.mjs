import {getStore} from '@netlify/blobs';
import core from './lib/studio-image-handler.js';
import quota from './lib/studio-quota.js';
import adapt from './lib/studio-request.js';
// Keep SDK import at the ESM entrypoint so Netlify traces and packages its dependencies.
const handler=core.createHandler({reserve:(event,cost,kind)=>quota.reserve(event,cost,kind,{store:getStore({name:'studio-antara-quota-v2',consistency:'strong'})})});
export default (request,context)=>adapt(request,context,handler);
