
(function(){
  document.querySelectorAll('.tri-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item=btn.parentElement;
      var open=item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open?'true':'false');
    });
  });
})();


;


(function(){
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeBtn');
  var iconMoon = document.getElementById('iconMoon');
  var iconSun = document.getElementById('iconSun');
  function applyTheme(t){
    root.setAttribute('data-theme', t);
    iconMoon.style.display = t === 'dark' ? 'block' : 'none';
    iconSun.style.display = t === 'dark' ? 'none' : 'block';
    try{ localStorage.setItem('gb-theme', t); }catch(e){}
  }
  var saved = 'dark';
  try{ saved = localStorage.getItem('gb-theme') || 'dark'; }catch(e){}
  applyTheme(saved);
  themeBtn.addEventListener('click', function(){
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  var worksEl = document.getElementById('works');
  var searchInput = document.getElementById('searchInput');
  var countNum = document.getElementById('countNum');
  var noResult = document.getElementById('noResult');
  var catBar = document.getElementById('catBar');
  var resetBtn = document.getElementById('resetBtn');
  var CATS = ["Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Duologi","Duologi","Trilogi","Trilogi","Trilogi","Tetralogi","Tetralogi","Tetralogi","Tetralogi"];
  var PILIHAN = ["LANGIT YANG TIDAK SAMA","SEBUAH SENI KEBOHONGAN","PARADOKS TERLALU MANUSIA","DI LUAR GARIS","ANTARA TAHU DAN APORIA","WANITA YANG DIAM"];
  var activeCat = 'pilihan';
  var pageUrl = (document.querySelector('link[rel="canonical"]')&&document.querySelector('link[rel="canonical"]').href)||location.href;
  function pad(n){ return n < 10 ? '0'+n : ''+n; }
  function render(list){
    worksEl.innerHTML = '';
    list.forEach(function(p){
      var w = document.createElement('div');
      w.className = 'work reveal visible';
      var lines = p[1].join('\n');
      var cat = CATS[p[2]-1] || '';
      var catLabel = CATS[p[2]-1] || 'Media Sosial';
      var quote = p[1].filter(Boolean).slice(0,3).join(' ');
      var shareText = encodeURIComponent(p[0]+'\n\n'+quote+'\n\n— Gaya Bebas · Shaiful Ridhwan\n'+pageUrl);
      var shareUrl = encodeURIComponent(pageUrl);
      var waHref = 'https://wa.me/?text='+shareText;
      var tgHref = 'https://t.me/share/url?url='+shareUrl+'&text='+encodeURIComponent(p[0]+' — Gaya Bebas');
      var xHref = 'https://twitter.com/intent/tweet?text='+encodeURIComponent(p[0]+'\n— Gaya Bebas · Shaiful Ridhwan')+'&url='+shareUrl;
      var fbHref = 'https://www.facebook.com/sharer/sharer.php?u='+shareUrl;
      w.innerHTML = '<div class="work-head" role="button" tabindex="0" aria-expanded="false" title="Klik untuk baca / tutup puisi"><div class="left"><span class="num">'+pad(p[2])+'</span><h3>'+p[0]+'</h3></div><div style="display:flex;align-items:center;gap:.8rem"><span class="work-cat">'+catLabel+'</span><span class="work-cat" style="color:var(--muted)">2026</span><button type="button" class="fav-btn" data-poem="'+p[0]+'" aria-label="Simpan ke kegemaran" title="Simpan ke kegemaran"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button><div class="plus"></div></div></div>'+
        '<div class="work-body"><div class="inner"><div class="poem-text">'+escapeHtml(lines)+'</div>'+
        '<div class="share-bar"><span class="share-label">Kongsi puisi ini</span>'+
        '<a class="share-btn s-fb" href="'+fbHref+'" target="_blank" rel="noopener" title="Kongsi di Facebook">Facebook</a>'+
        '<a class="share-btn s-wa" href="'+waHref+'" target="_blank" rel="noopener" title="Kongsi di WhatsApp">WhatsApp</a>'+
        '<a class="share-btn s-tg" href="'+tgHref+'" target="_blank" rel="noopener" title="Kongsi di Telegram">Telegram</a>'+
        '<a class="share-btn s-x" href="'+xHref+'" target="_blank" rel="noopener" title="Kongsi di X / Twitter">X</a>'+
        '<button type="button" class="share-btn s-copy" title="Salin petikan puisi">Salin</button>'+
        '<button type="button" class="share-btn s-close" title="Tutup puisi & kembali ke senarai">Tutup</button></div>'+
        '<div class="work-meta"><span>'+catLabel+'</span><span>Puisi gaya bebas</span><span>2026</span></div></div></div>';
      var head = w.querySelector('.work-head');
      var body = w.querySelector('.work-body');
      var favBtn = w.querySelector('.fav-btn');
      head.addEventListener('click', function(){
        var open = w.classList.toggle('open');
        head.setAttribute('aria-expanded',open?'true':'false');
        body.style.maxHeight = open ? body.scrollHeight + 'px' : '0';
      });
      head.addEventListener('keydown', function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); head.click(); } });
      if(favBtn){
        favBtn.addEventListener('click', function(ev){
          ev.stopPropagation();
          var poemName = this.getAttribute('data-poem');
          var favs = JSON.parse(localStorage.getItem('gb_favorites') || '[]');
          var idx = favs.indexOf(poemName);
          if(idx > -1){ favs.splice(idx, 1); this.classList.remove('active'); this.setAttribute('aria-label','Simpan ke kegemaran'); this.setAttribute('title','Simpan ke kegemaran'); }
          else{ favs.push(poemName); this.classList.add('active'); this.setAttribute('aria-label','Buang dari kegemaran'); this.setAttribute('title','Buang dari kegemaran'); }
          localStorage.setItem('gb_favorites', JSON.stringify(favs));
        });
        var favs = JSON.parse(localStorage.getItem('gb_favorites') || '[]');
        if(favs.indexOf(p[0]) > -1){ favBtn.classList.add('active'); favBtn.setAttribute('aria-label','Buang dari kegemaran'); favBtn.setAttribute('title','Buang dari kegemaran'); }
      }
      worksEl.appendChild(w);
    });
    countNum.textContent = list.length;
    noResult.style.display = list.length === 0 ? 'block' : 'none';
    if(typeof observeReveals === 'function') observeReveals();
  }
  function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var POEMS = (typeof window.__POEMS__ !== 'undefined') ? window.__POEMS__ : [];
  POEMS.forEach(function(p,i){ p.push(i+1); });
  var ctEl=document.getElementById('countTotal'); if(ctEl){ ctEl.textContent = POEMS.length; }
  function applyFilter(){
    var q=searchInput.value.trim().toLowerCase();
    var mode=q?'all':activeCat;
    catBar.querySelectorAll('.cat-btn').forEach(function(btn){
      var series=btn.getAttribute('data-series'),cat=btn.getAttribute('data-cat');
      var selected=series?(series.charAt(0).toUpperCase()+series.slice(1)===mode):
        cat==='pilihan'?mode==='pilihan':cat==='media'?mode==='Media Sosial':mode==='all';
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-pressed',selected?'true':'false');
    });
    var filtered=POEMS.filter(function(p){
      if(q&&!(p[0].toLowerCase().includes(q)||p[1].join(' ').toLowerCase().includes(q)))return false;
      return mode==='pilihan'?PILIHAN.includes(p[0]):mode==='all'||CATS[p[2]-1]===mode;
    });
    if(mode==='pilihan')filtered.sort(function(a,b){return PILIHAN.indexOf(a[0])-PILIHAN.indexOf(b[0]);});
    render(filtered);
    var note=document.getElementById('archiveNote');
    if(note)note.textContent=q?'Carian merentasi semua 33 puisi.':mode==='pilihan'?'Enam puisi pilihan. Semua karya lain masih boleh dicari.':mode==='all'?'Semua 33 puisi dipaparkan.':'Kategori: '+mode+'.';
  }
  applyFilter();
  function fallbackCopy(t){ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} document.body.removeChild(ta); }
  worksEl.addEventListener('click', function(e){
    var btn = e.target.closest('.s-close, .s-copy');
    if(!btn) return;
    var work = btn.closest('.work');
    if(!work) return;
    if(btn.classList.contains('s-close')){
      work.classList.remove('open');
      var bd = work.querySelector('.work-body'); if(bd) bd.style.maxHeight='0';
      work.querySelector('.work-head').scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
    if(btn.classList.contains('s-copy')){
      var title = work.querySelector('h3').textContent;
      var text = work.querySelector('.poem-text').textContent;
      var payload = title+'\n\n'+text.trim()+'\n\n— Gaya Bebas · Shaiful Ridhwan\n'+pageUrl;
      var old = btn.textContent;
      var done = function(){ btn.textContent='Disalin!'; setTimeout(function(){ btn.textContent=old; },1600); };
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(payload).then(done, function(){ fallbackCopy(payload); done(); }); }
      else { fallbackCopy(payload); done(); }
    }
  });
  searchInput.addEventListener('input',applyFilter);
  catBar.addEventListener('click',function(e){
    var btn=e.target.closest('.cat-btn');if(!btn)return;
    var series=btn.getAttribute('data-series'),cat=btn.getAttribute('data-cat');
    if(series)activeCat=series.charAt(0).toUpperCase()+series.slice(1);
    else if(cat==='pilihan')activeCat='pilihan';
    else if(cat==='media')activeCat='Media Sosial';
    else activeCat='all';
    searchInput.value='';applyFilter();
  });
  resetBtn.addEventListener('click',function(){
    activeCat='pilihan';searchInput.value='';applyFilter();
  });

  var archiveDirectory=document.getElementById('archiveDirectory');
  if(archiveDirectory)archiveDirectory.addEventListener('click',function(event){
    var link=event.target.closest('a[data-archive-title]');
    if(!link)return;
    event.preventDefault();
    searchInput.value=link.getAttribute('data-archive-title')||'';
    applyFilter();
    var work=worksEl.querySelector('.work-head');
    if(work){work.scrollIntoView({behavior:'smooth',block:'center'});work.click();}
    if(window.history&&history.replaceState)history.replaceState(null,'','#karya');
  });

  // Keep the top progress line on the compositor, not in layout.
  var progress = document.getElementById('progress');
  var progressFrame = 0;
  function updateProgress(){
    progressFrame = 0;
    if(!progress)return;
    var h = document.documentElement;
    var maxScroll = Math.max(1,h.scrollHeight-h.clientHeight);
    progress.style.transform = 'scaleX('+Math.max(0,Math.min(1,h.scrollTop/maxScroll))+')';
  }
  window.addEventListener('scroll',function(){
    if(!progressFrame)progressFrame=requestAnimationFrame(updateProgress);
  },{passive:true});
  updateProgress();

  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, {threshold:.12}) : null;
  function observeReveals(){
    if(!io){ document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('visible'); }); return; }
    document.querySelectorAll('.reveal:not(.visible)').forEach(function(el){ io.observe(el); });
  }
  observeReveals();
  // Safety fallback — force visibility even if IntersectionObserver is slow/silent
  setTimeout(function(){ document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('visible'); }); }, 250);
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('visible'); });
  }

  // Cache every glow as a small sprite; preserve the existing particle field.
  var canvas = document.getElementById('bgCanvas');
  var ctx = canvas && canvas.getContext('2d');
  if(canvas && ctx){
    var particles=[],raf=0,previousFrame=0,currentColor='',resizeFrame=0;
    var COUNT=Math.min(70,Math.floor(window.innerWidth/18));
    function resize(){
      var oldWidth=canvas.width||window.innerWidth,oldHeight=canvas.height||window.innerHeight;
      var newWidth=Math.max(1,window.innerWidth),newHeight=Math.max(1,window.innerHeight);
      if(canvas.width===newWidth&&canvas.height===newHeight)return;
      canvas.width=newWidth;canvas.height=newHeight;
      particles.forEach(function(p){p.x*=newWidth/oldWidth;p.y*=newHeight/oldHeight;});
    }
    resize();
    window.addEventListener('resize',function(){
      if(resizeFrame)return;
      resizeFrame=requestAnimationFrame(function(){resizeFrame=0;resize();});
    },{passive:true});
    for(var i=0;i<COUNT;i++){
      particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,
        r:Math.random()*1.8+.4,vx:(Math.random()-.5)*.42,
        vy:(Math.random()-.5)*.42,a:Math.random()*.5+.2,sprite:null});
    }
    function cacheGlow(color){
      particles.forEach(function(p){
        var sprite=document.createElement('canvas');
        sprite.width=40;sprite.height=40;
        var brush=sprite.getContext('2d');
        if(!brush)return;
        brush.shadowBlur=8;
        brush.shadowColor='rgba('+color+',.6)';
        brush.fillStyle='rgba('+color+','+p.a+')';
        brush.beginPath();brush.arc(20,20,p.r,0,Math.PI*2);brush.fill();
        p.sprite=sprite;
      });
      currentColor=color;
    }
    function tick(now){
      raf=0;
      if(document.hidden)return;
      var color=root.getAttribute('data-theme')==='dark'?'232,184,106':'168,116,31';
      if(color!==currentColor)cacheGlow(color);
      var step=previousFrame?Math.min(2,(now-previousFrame)/16.667):1;
      previousFrame=now;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      particles.forEach(function(p){
        p.x+=p.vx*step;p.y+=p.vy*step;
        if(p.x<0)p.x+=canvas.width;else if(p.x>canvas.width)p.x-=canvas.width;
        if(p.y<0)p.y+=canvas.height;else if(p.y>canvas.height)p.y-=canvas.height;
        if(p.sprite)ctx.drawImage(p.sprite,p.x-20,p.y-20);
      });
      raf=requestAnimationFrame(tick);
    }
    function startParticles(){
      if(document.hidden||raf)return;
      previousFrame=0;
      raf=requestAnimationFrame(tick);
    }
    function stopParticles(){
      cancelAnimationFrame(raf);raf=0;previousFrame=0;
    }
    document.addEventListener('visibilitychange',function(){
      if(document.hidden)stopParticles();else startParticles();
    });
    window.addEventListener('pagehide',stopParticles);
    window.addEventListener('pageshow',startParticles);
    startParticles();
  }
})();


;


(function(){
  document.querySelectorAll('.pick-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      var pick = btn.closest('.pick');
      var body = pick.querySelector('.pick-body');
      var open = pick.classList.toggle('open');
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0';
      btn.textContent = open ? 'Tutup ' : 'Baca Puisi ';
      var arr = document.createElement('span'); arr.className='arr'; arr.textContent='→'; btn.appendChild(arr);
    });
  });
})();


;


(function(){
  var ham=document.getElementById('hamburger');
  var navLinks=document.querySelector('.nav-links');
  if(ham&&navLinks){
    ham.addEventListener('click',function(){
      var open=navLinks.classList.toggle('open');
      ham.classList.toggle('open',open);
      ham.setAttribute('aria-expanded',open?'true':'false');
    });
    navLinks.querySelectorAll('a.link').forEach(function(a){
      a.addEventListener('click',function(){ navLinks.classList.remove('open'); ham.classList.remove('open'); ham.setAttribute('aria-expanded','false'); });
    });
  }
  var btt=document.getElementById('backToTop');
  if(btt){
    window.addEventListener('scroll',function(){
      if(window.scrollY>600){btt.classList.add('show');}else{btt.classList.remove('show');}
    },{passive:true});
    btt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
  }
  function hideBadge(){
    document.querySelectorAll('a[href*="netlify.com"]').forEach(function(a){
      var p=a; for(var i=0;i<4&&p;i++){ if(p.style&&p.style.position==='fixed'){p.style.display='none';} p=p.parentElement; }
    });
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',hideBadge);}else{hideBadge();}
  setTimeout(hideBadge,1500);
})();

