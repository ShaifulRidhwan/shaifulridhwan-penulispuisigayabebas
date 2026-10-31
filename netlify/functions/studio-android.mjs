import {getStore} from "@netlify/blobs";
import core from "./lib/studio-image-handler.js";
import quota from "./lib/studio-quota.js";
import adapt from "./lib/aksara-mobile-studio-adapter.js";

const handler=core.createHandler({
  reserve:(event,cost,kind)=>quota.reserve(event,cost,kind,{
    store:getStore({name:"studio-antara-quota-v2",consistency:"strong"})
  })
});
export default (request,context)=>adapt.mobileStudio(request,context,handler);
