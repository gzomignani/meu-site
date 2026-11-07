/* Original mobile composition and taps, with local pinch zoom. */
(() => {
  const mobile=matchMedia('(max-width:768px)');
  const list=document.getElementById('listaMobile');
  const mobileViews=new Map();
  const {load,replaceFrame}=window.PortfolioMedia;
  const mobileObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        showMobile(Number(entry.target.dataset.index)); mobileObserver.unobserve(entry.target);
      }
    });
  }, {rootMargin:'500px 0px'}) : null;
  function prefetch(index){
    const p=projetos[index];
    [1,-1].forEach(step=>load(p.frames[(p.frame+step+p.frames.length)%p.frames.length],'low').catch(()=>{}));
  }
  function buildMobile() {
    if (mobileViews.size) return;
    projetos.forEach((p, index) => {
      const article = document.createElement('article'); article.className = 'projMobile';
      article.dataset.index = index;
      const heading = document.createElement('h3'); heading.className = 'tituloMobile'; heading.textContent = p.titulo;
      const frame = document.createElement('div'); frame.className = 'frameMobile';
      const wrap = document.createElement('div'); wrap.className = 'mediaWrap'; frame.append(wrap);
      const desc = document.createElement('p'); desc.className = 'descricaoMobile'; desc.textContent = p.descricao;
      const message = document.createElement('p'); message.className = 'mobile-hint'; message.hidden = true; message.setAttribute('role','status');
      article.append(heading, frame, desc, message); list.append(article);
      const view = {article, wrap, message, request:0, swap:Promise.resolve(), desired:null, scale:1, x:0, y:0};
      mobileViews.set(index, view); attachZoom(view, index);
    });
  }
  async function showMobile(index,direction=1) {
    const view=mobileViews.get(index); if(!view) return;
    const project=projetos[index],src=project.frames[project.frame];
    if(view.desired===src) return;
    view.desired=src;const ticket=++view.request;
    view.message.hidden=true;
    try{
      const source=await load(src,'high');
      if(ticket!==view.request) return;
      await view.swap;
      if(ticket!==view.request) return;
      view.resetZoom();
      const layer=document.createElement('div');layer.className='media-slide';
      const image=source.cloneNode();image.className='layer on';
      image.alt=project.titulo+' — imagem '+(project.frame+1)+' de '+project.frames.length;
      layer.append(image);
      view.wrap.style.aspectRatio=source.naturalWidth+' / '+source.naturalHeight;
      view.swap=replaceFrame(view.wrap,layer,direction);await view.swap;
      view.message.textContent='';prefetch(index);
    }catch{
      if(ticket===view.request){view.desired=null;view.message.hidden=false;view.message.textContent='Não foi possível carregar esta imagem. Toque na imagem para continuar.';}
    }
  }

  function attachZoom(view, index) {
    const {wrap} = view;
    let gesture = null, tap = null, consumed = false, resetTimer;
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    function paint() {
      view.x = clamp(view.x, wrap.clientWidth * (1 - view.scale), 0);
      view.y = clamp(view.y, wrap.clientHeight * (1 - view.scale), 0);
      wrap.querySelectorAll('img').forEach(img => img.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`);
      wrap.classList.toggle('is-zoomed', view.scale > 1.01);
    }
    view.resetZoom = () => {
      view.scale = 1; view.x = view.y = 0; gesture = null;
      wrap.classList.add('is-resetting'); paint();
      clearTimeout(resetTimer); resetTimer = setTimeout(() => wrap.classList.remove('is-resetting'), 240);
    };
    const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    function midpoint(touches) {
      const rect = wrap.getBoundingClientRect();
      return {x:(touches[0].clientX + touches[1].clientX) / 2 - rect.left, y:(touches[0].clientY + touches[1].clientY) / 2 - rect.top};
    }
    wrap.addEventListener('touchstart', event => {
      wrap.classList.remove('is-resetting');
      if (event.touches.length >= 2) {
        event.preventDefault(); consumed = true; tap = null;
        const mid = midpoint(event.touches);
        gesture = {distance:distance(event.touches), scale:view.scale, anchorX:(mid.x-view.x)/view.scale, anchorY:(mid.y-view.y)/view.scale};
      } else if (view.scale > 1.01) {
        event.preventDefault(); consumed = true;
        const t = event.touches[0]; gesture = {panX:t.clientX-view.x, panY:t.clientY-view.y};
      } else {
        const t = event.touches[0]; consumed = false;
        tap = {x:t.clientX, y:t.clientY, time:performance.now()};
      }
    }, {passive:false});
    wrap.addEventListener('touchmove', event => {
      if (event.touches.length >= 2 && gesture?.distance) {
        event.preventDefault();
        const mid = midpoint(event.touches);
        view.scale = clamp(gesture.scale * distance(event.touches) / gesture.distance, 1, 4);
        view.x = mid.x - gesture.anchorX * view.scale; view.y = mid.y - gesture.anchorY * view.scale; paint();
      } else if (view.scale > 1.01 && gesture?.panX !== undefined) {
        event.preventDefault(); const t = event.touches[0];
        view.x = t.clientX - gesture.panX; view.y = t.clientY - gesture.panY; paint();
      }
    }, {passive:false});
    wrap.addEventListener('touchend', event => {
      if (event.touches.length) {
        const t = event.touches[0]; gesture = {panX:t.clientX-view.x, panY:t.clientY-view.y}; return;
      }
      if (!consumed && tap) {
        const t = event.changedTouches[0];
        if (Math.hypot(t.clientX-tap.x,t.clientY-tap.y)<10 && performance.now()-tap.time<300) {
          const rect = wrap.getBoundingClientRect(); step(index,t.clientX<rect.left+rect.width/2?-1:1);
        }
      }
      gesture = tap = null; consumed = false;
      if (view.scale < 1.02) view.resetZoom();
    }, {passive:true});
    wrap.addEventListener('touchcancel', () => { gesture = tap = null; consumed = false; view.resetZoom(); }, {passive:true});
    window.addEventListener('resize', view.resetZoom, {passive:true});
  }
  function step(index, amount) {
    const p = projetos[index]; p.frame = (p.frame + amount + p.frames.length) % p.frames.length;
    showMobile(index,amount);
  }
  function syncMode(){
    window.PortfolioDesktop.setMobile(mobile.matches);
    if(mobile.matches){
      buildMobile();
      mobileViews.forEach((view,i)=>{if(mobileObserver) mobileObserver.observe(view.article);else showMobile(i);});
    }else mobileObserver?.disconnect();
  }
  mobile.addEventListener('change',syncMode);syncMode();
})();
