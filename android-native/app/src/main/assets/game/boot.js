window.gameDiagnostics={ready:false,frames:0,renderer:'pending',width:0,height:0,error:null};
window.gameFailure=function(reason){
 try{window.aksaraPause?.();}catch{}
 const d=window.gameDiagnostics;d.error=String(reason);d.ready=false;
 console.error('AKSARA runtime failure: '+reason);
 const menu=document.querySelector('#menu');menu.style.display='grid';
 document.querySelector('#message').textContent='Permainan gagal dimulakan: '+reason;
 const b=document.querySelector('#start');b.disabled=false;b.textContent='Cuba renderer Canvas';
 b.onclick=()=>{location.href=location.pathname+'?renderer=canvas'};
};
window.addEventListener('error',e=>window.gameFailure(e.message||'Ralat JavaScript'));
window.addEventListener('unhandledrejection',e=>window.gameFailure(e.reason));
setTimeout(()=>{if(!window.gameDiagnostics.ready)window.gameFailure('Tiada bingkai renderer. Cuba Canvas.');},12000);
