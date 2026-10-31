import {getStore} from "@netlify/blobs";
import broker from "./lib/aksara-mobile-live-broker.js";

export default async (request,context)=>{
  // No website Origin spoofing. Authentication is validated by the broker.
  // All successful grants are counted in strongly-consistent Netlify Blobs.
  return broker.createLiveToken(request,context,{
    reserve:(ctx)=>broker.reserveDurableVoice(
      ctx,getStore({name:"aksara-mobile-live-budget-v1",consistency:"strong"})
    )
  });
};
