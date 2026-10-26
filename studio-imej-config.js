(function(root){
"use strict";
/* Fixed, allowlisted model URLs from web-txt2img 0.3.1 SDTurboAdapter. */
const base="https://huggingface.co/schmuell/sd-turbo-ort-web/resolve/main/";
const FILES=["unet/model.onnx","text_encoder/model.onnx","vae_decoder/model.onnx"].map(name=>base+name);
const config=Object.freeze({
 cacheName:"web-txt2img-v1",
 backgroundId:"studio-sd-turbo-v1",
 model:"sd-turbo",
 modelBytes:2398*1024*1024,
 files:Object.freeze(FILES),
 isModelFile:url=>FILES.includes(String(url))
});
root.StudioImejConfig=config;
})(typeof self!=="undefined"?self:globalThis);