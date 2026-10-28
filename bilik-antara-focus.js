(function(){
"use strict";
const panel=document.getElementById("voicePanel");
if(!panel)return;
const body=document.body;
const refresh=()=>{
 const expanded=!panel.hidden&&!panel.classList.contains("is-minimized");
 body.classList.toggle("voice-focus",expanded);
};
const observer=new MutationObserver(refresh);
observer.observe(panel,{attributes:true,attributeFilter:["hidden","class"]});
refresh();
window.addEventListener("pagehide",()=>{observer.disconnect();body.classList.remove("voice-focus");},{once:true});
})();