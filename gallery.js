/* Original mobile composition and taps, with local pinch zoom. */
(() => {
  const mobile=matchMedia('(max-width:768px), (hover:none) and (pointer:coarse)');
  const list=document.getElementById('listaMobile');
  const mobileViews=new Map();
  let activeZoom=null;
  const {zoomPan}=window.PortfolioMotion;
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

  function attachZoom(view,index){
    const {wrap,article}=view;
    let gesture=null,tap=null,consumed=false,resetAnimation=null,resetToken=0;
    const viewport=()=>view.zoomViewport||({left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0,width:window.visualViewport?.width||window.innerWidth,height:window.visualViewport?.height||window.innerHeight});
    const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
    function captureBase(){
      if(view.zoomActive) return;
      const rect=wrap.getBoundingClientRect();
      view.zoomBase={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
    }
    function midpoint(touches){
      const base=view.zoomBase||wrap.getBoundingClientRect();
      return {x:(touches[0].clientX+touches[1].clientX)/2-base.left,y:(touches[0].clientY+touches[1].clientY)/2-base.top};
    }
    function activate(){
      if(view.zoomActive) return;
      if(activeZoom&&activeZoom!==view) activeZoom.resetZoom();
      activeZoom=view;view.zoomActive=true;view.zoomViewportWidth=window.innerWidth;
      const base=view.zoomBase;
      wrap.style.setProperty('--zoom-left',base.left+'px');wrap.style.setProperty('--zoom-top',base.top+'px');
      wrap.style.setProperty('--zoom-width',base.width+'px');wrap.style.setProperty('--zoom-height',base.height+'px');
      wrap.classList.add('is-zoomed');article.classList.add('has-zoom');
      document.documentElement.classList.add('image-zoom-active');
      const plane=wrap.children[0].getBoundingClientRect();
      view.zoomViewport={left:plane.left,top:plane.top,width:Math.max(plane.width,window.innerWidth),height:Math.max(plane.height,window.innerHeight)};
    }
    function paint(){
      if(view.scale>1.01) activate();
      if(view.zoomActive){
        const pan=zoomPan(view.zoomBase,viewport(),view.scale,view.x,view.y);
        view.x=pan.x;view.y=pan.y;
      }
      wrap.querySelectorAll('img').forEach(img=>img.style.transform='translate3d('+view.x+'px,'+view.y+'px,0) scale('+view.scale+')');
    }
    function cancelReturn(){
      if(!resetAnimation) return;
      const image=wrap.querySelectorAll('img')[0];
      const rect=image.getBoundingClientRect(),base=view.zoomBase;
      ++resetToken;resetAnimation.cancel();resetAnimation=null;
      view.scale=rect.width/base.width;view.x=rect.left-base.left;view.y=rect.top-base.top;paint();
    }
    view.resetZoom=(animate=false)=>{
      const ticket=++resetToken;
      resetAnimation?.cancel();resetAnimation=null;gesture=null;
      const image=wrap.querySelectorAll('img')[0];
      const from='translate3d('+view.x+'px,'+view.y+'px,0) scale('+view.scale+')';
      function finish(){
        if(ticket!==resetToken) return;
        view.scale=1;view.x=view.y=0;view.zoomActive=false;view.zoomBase=null;view.zoomViewport=null;
        wrap.classList.remove('is-zoomed');article.classList.remove('has-zoom');
        wrap.querySelectorAll('img').forEach(img=>img.style.transform='translate3d(0px,0px,0) scale(1)');
        if(activeZoom===view){activeZoom=null;document.documentElement.classList.remove('image-zoom-active');}
        resetAnimation=null;
      }
      if(animate&&view.zoomActive&&image?.animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
        image.style.transform='translate3d(0px,0px,0) scale(1)';
        resetAnimation=image.animate([{transform:from},{transform:'translate3d(0px,0px,0) scale(1)'}],{duration:180,easing:'cubic-bezier(.22,.72,.22,1)'});
        resetAnimation.finished.then(finish,()=>{});
      }else finish();
    };
    wrap.addEventListener('touchstart',event=>{
      if(resetAnimation&&event.touches.length<2){tap=null;consumed=true;return;}
      cancelReturn();
      if(event.touches.length>=2){
        if(!wrap.querySelectorAll('img').length) return;
        event.preventDefault();consumed=true;tap=null;captureBase();activate();
        const mid=midpoint(event.touches),vp=viewport(),base=view.zoomBase;
        const maxScale=Math.max(4,Math.ceil(vp.width/base.width),Math.ceil(vp.height/base.height));
        gesture={distance:distance(event.touches),scale:view.scale,anchorX:(mid.x-view.x)/view.scale,anchorY:(mid.y-view.y)/view.scale,maxScale};
      }else if(view.zoomActive){
        event.preventDefault();consumed=true;tap=null;
        const t=event.touches[0];gesture={panX:t.clientX-view.x,panY:t.clientY-view.y};
      }else{
        const t=event.touches[0];consumed=false;tap={x:t.clientX,y:t.clientY,time:performance.now()};
      }
    },{passive:false});
    wrap.addEventListener('touchmove',event=>{
      if(event.touches.length>=2&&gesture?.distance){
        event.preventDefault();const mid=midpoint(event.touches);
        view.scale=Math.max(1,Math.min(gesture.maxScale,gesture.scale*distance(event.touches)/gesture.distance));
        view.x=mid.x-gesture.anchorX*view.scale;view.y=mid.y-gesture.anchorY*view.scale;paint();
      }else if(view.zoomActive&&gesture?.panX!==undefined){
        event.preventDefault();const t=event.touches[0];
        view.x=t.clientX-gesture.panX;view.y=t.clientY-gesture.panY;paint();
      }
    },{passive:false});
    wrap.addEventListener('touchend',event=>{
      // Pinch is transient: ending either contact returns the photo and releases scroll.
      if(consumed||view.zoomActive||resetAnimation){
        gesture=tap=null;
        if(!resetAnimation) view.resetZoom(true);
        if(!event.touches.length) consumed=false;
        return;
      }
      if(event.touches.length){
        const t=event.touches[0];gesture={panX:t.clientX-view.x,panY:t.clientY-view.y};return;
      }
      if(!consumed&&tap){
        const t=event.changedTouches[0];
        if(Math.hypot(t.clientX-tap.x,t.clientY-tap.y)<10&&performance.now()-tap.time<300){
          const rect=wrap.getBoundingClientRect();step(index,t.clientX<rect.left+rect.width/2?-1:1);
        }
      }
      gesture=tap=null;consumed=false;
      if(view.scale<1.02) view.resetZoom();
    },{passive:true});
    wrap.addEventListener('touchcancel',()=>{gesture=tap=null;consumed=false;view.resetZoom();},{passive:true});
    // Browser bars change viewport height while scrolling; do not cancel the gesture.
    const resize=()=>{if(!view.zoomActive||Math.abs(window.innerWidth-view.zoomViewportWidth)>1) view.resetZoom();};
    window.addEventListener('resize',resize,{passive:true});
    window.visualViewport?.addEventListener('resize',resize,{passive:true});
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
    }else{mobileObserver?.disconnect();activeZoom?.resetZoom();}
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape') activeZoom?.resetZoom(true);});
  mobile.addEventListener('change',syncMode);syncMode();
})();
