/* Shared Studio contract. All model settings are allowlisted here. No credentials. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.StudioConfig=value;})(typeof window!=='undefined'?window:this,()=>{
'use strict';
const presets=Object.freeze({
 none:{name:'Ikut prompt sahaja',prompt:''},
 antara:{name:'Antara Cahaya dan Gelap',prompt:'cinematic chiaroscuro, warm golden light balanced with deep blue shadows, elegant contrast, atmospheric depth'},
 sastera:{name:'Sastera Moden',prompt:'contemporary literary editorial aesthetic, thoughtful visual symbolism, refined composition, tactile detail'},
 langit:{name:'Langit dan Renungan',prompt:'contemplative atmosphere, luminous natural sky tones, spacious composition, gentle light'},
 falsafah:{name:'Falsafah Gelap',prompt:'philosophical visual mood, restrained dark palette, subtle symbolism, sculptural directional lighting'},
 cinta:{name:'Cinta Sinematik',prompt:'intimate cinematic atmosphere, warm soft light, delicate tonal transitions, expressive composition'},
 futuristik:{name:'Futuristik',prompt:'futuristic visual design, sophisticated materials, precise details, blue and amber illumination'},
 realistic:{name:'Fotorealistik',prompt:'photorealistic image, natural textures, believable lighting, carefully focused subject'},
 illustration:{name:'Ilustrasi Artistik',prompt:'expressive artistic illustration, layered brushwork, thoughtful color palette, fine visual detail'},
 minimal:{name:'Minimalis',prompt:'minimalist composition, clean forms, generous negative space, restrained palette'},
 fantasy:{name:'Fantasi',prompt:'fantasy art aesthetic, imaginative atmosphere, intricate visual detail, expressive light'}
});
const ratios=Object.freeze({'1:1':[[512,512],[768,768],[1024,1024]],'4:5':[[512,640],[768,960],[896,1120]],'9:16':[[288,512],[432,768],[576,1024]],'16:9':[[512,288],[768,432],[1024,576]],'3:2':[[576,384],[768,512],[1152,768]]});
const qualities=['fast','balanced','detail'];
const models=Object.freeze({schnell:{name:'FLUX.1 Schnell',id:'@cf/black-forest-labs/flux-1-schnell'},klein:{name:'FLUX.2 Klein 4B',id:'@cf/black-forest-labs/flux-2-klein-4b'},ovh:{name:'OVHcloud SDXL · Beta',id:'stable-diffusion-xl-base-v10'}});
function settings(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Tetapan tak sah.');
 const {prompt,style='antara',model='schnell',ratio='1:1',quality='balanced'}=value;
 if(typeof prompt!=='string'||prompt.trim().length<4||prompt.length>1200)throw Error('Tulis prompt antara 4 hingga 1200 aksara.');
 if(!Object.hasOwn(presets,style)||!Object.hasOwn(models,model)||!Object.hasOwn(ratios,ratio)||!qualities.includes(quality))throw Error('Gaya, model, nisbah atau kualiti tak dikenali.');
 const hasSeed=value.seed!==null&&value.seed!==undefined&&value.seed!=='';
 if(hasSeed&&(typeof value.seed!=='number'||!Number.isInteger(value.seed)||value.seed<0||value.seed>2147483647))throw Error('Seed mesti nombor bulat antara 0 hingga 2147483647.');
 if((model==='schnell'||model==='ovh')&&(ratio!=='1:1'||hasSeed))throw Error('Model ini hanya menyokong 1:1 tanpa seed. Pilih FLUX.2 Klein untuk nisbah lain atau kawalan seed.');
 const level=qualities.indexOf(quality),[width,height]=model==='klein'?ratios[ratio][level]:[1024,1024];
 const steps=model==='klein'?4:model==='ovh'?null:[2,4,8][level];
 return {prompt:prompt.trim(),style,model,ratio,quality,seed:hasSeed?value.seed:null,width,height,steps};
}
function compose(s){return [s.prompt,presets[s.style].prompt].filter(Boolean).join(', ');}
function lightEnhance(prompt){if(prompt.trim().length>850)return prompt.trim();return prompt.trim()+'\n\n'+ 'Komposisi yang jelas, subjek utama mudah dikenal pasti, pencahayaan yang serasi dengan suasana asal, imbangan warna yang harmoni dan butiran visual yang kemas. Kekalkan subjek, bilangan, lokasi, teks dan maksud asal arahan.';}
function estimate(s){if(s.model==='ovh')return 0;const tiles=s.model==='schnell'?16:Math.ceil(s.width/512)*Math.ceil(s.height/512);return Math.ceil((s.model==='klein'?tiles*26.05:tiles*4.8+s.steps*9.6)*1.15);}
return Object.freeze({presets,ratios,qualities,models,settings,compose,lightEnhance,estimate});
});
