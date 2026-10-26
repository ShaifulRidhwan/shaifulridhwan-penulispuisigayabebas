
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
  var CATS = ["Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Media Sosial","Duologi","Duologi","Trilogi","Trilogi","Trilogi","Tetralogi","Tetralogi","Tetralogi","Tetralogi","Novel","Novel","Novel"];
  var activeCat = 'Media Sosial';
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
      w.innerHTML = '<div class="work-head" role="button" tabindex="0" title="Klik untuk baca / tutup puisi"><div class="left"><span class="num">'+pad(p[2])+'</span><h3>'+p[0]+'</h3></div><div style="display:flex;align-items:center;gap:.8rem"><span class="work-cat">'+catLabel+'</span><span class="work-cat" style="color:var(--muted)">2026</span><button type="button" class="fav-btn" data-poem="'+p[0]+'" aria-label="Simpan ke kegemaran" title="Simpan ke kegemaran"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button><div class="plus"></div></div></div>'+
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
    var q = searchInput.value.trim().toLowerCase();
    if(q)activeCat='all';
    catBar.querySelectorAll('.cat-btn').forEach(function(btn){
      var series=btn.getAttribute('data-series'),cat=btn.getAttribute('data-cat');
      var selected=series ? (series.charAt(0).toUpperCase()+series.slice(1)===activeCat) : (cat==='all'?activeCat==='all':activeCat==='Media Sosial');
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-pressed',selected?'true':'false');
    });
    var filtered=POEMS.filter(function(p){
      var textOk=!q||p[0].toLowerCase().indexOf(q)!==-1||p[1].join(' ').toLowerCase().indexOf(q)!==-1;
      var catOk=activeCat==='all'||CATS[p[2]-1]===activeCat;
      return textOk&&catOk;
    });
    render(filtered);
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
    var btn=e.target.closest('.cat-btn');
    if(!btn)return;
    var series=btn.getAttribute('data-series'),cat=btn.getAttribute('data-cat');
    if(series)activeCat=series.charAt(0).toUpperCase()+series.slice(1);
    else if(cat==='media')activeCat='Media Sosial';
    else activeCat='all';
    searchInput.value='';
    applyFilter();
  });
  resetBtn.addEventListener('click',function(){
    activeCat='all';
    searchInput.value='';
    applyFilter();
  });

  var progress = document.getElementById('progress');
  window.addEventListener('scroll', function(){
    var h = document.documentElement;
    var scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
    progress.style.width = (scrolled * 100) + '%';
  }, {passive:true});

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

  var canvas = document.getElementById('bgCanvas');
  var ctx = canvas.getContext('2d');
  var particles = [];
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  var COUNT = Math.min(70, Math.floor(window.innerWidth / 18));
  for(var i=0;i<COUNT;i++){
    particles.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*1.8+.4, vx:(Math.random()-.5)*.42, vy:(Math.random()-.5)*.42, a:Math.random()*.5+.2});
  }
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var color = root.getAttribute('data-theme') === 'dark' ? '232,184,106' : '168,116,31';
    particles.forEach(function(p){
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0) p.x = canvas.width; if(p.x > canvas.width) p.x = 0;
      if(p.y < 0) p.y = canvas.height; if(p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba('+color+','+p.a+')';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba('+color+',.6)';
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    requestAnimationFrame(tick);
  }
  tick();
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

