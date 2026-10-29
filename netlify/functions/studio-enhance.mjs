import core from './lib/studio-enhance-handler.js';
import adapt from './lib/studio-request.js';
// Modern Netlify runtime supplies the uncached Blobs endpoint for strong consistency.
export default (request,context)=>adapt(request,context,core.handler);
