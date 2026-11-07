/* Flat carousel. Explicit pixel geometry keeps every project on a continuous path. */
(() => {
  const {clamp,offset,slotRect,fitImage}=window.PortfolioMotion;
  const {load,replaceFrame}=window.PortfolioMedia;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const carousel=document.getElementById('carousel');
  const gallery=document.querySelector('.galeria');
  const title=document.getElementById('titulo');
  const description=document.getElementById('descricao');
  const views=[];
  let center=0,mobile=innerWidth<=768,layout=null,resizeFrame=0;
  let auto=0,hovered=false,focused=false,inView=false,userInteracted=false;
  const duration=560,easing='cubic-bezier(.22,.72,.22,1)';
  function animate(el,from,to,animations,time=duration){
    Object.assign(el.style,to);
    if(reduced.matches||!el.animate) return;
    const animation=el.animate([from,to],{duration:time,easing});
    animations.push(animation);
    animation.finished.catch(()=>{});
  }
  function rectFor(slot){
    return slotRect(slot,layout);
  }
  function imagePose(rect,ratio,slot){
    const {x,y,scale}=fitImage(rect,ratio,slot);
    return `translate3d(${x}px,${y}px,0) scale(${scale})`;
  }
  function poseImages(view,rect,slot,snapshots){
    view.frame.querySelectorAll('img').forEach(image=>{
      const ratio=Number(image.dataset.ratio);
      const transform=imagePose(rect,ratio,slot);
      const before=snapshots?.get(image);
      if(before) animate(image,{transform:before},{transform},view.animations);
      else image.style.transform=transform;
    });
  }
  function render(moving){
    if(mobile||!layout) return;
    const parent=carousel.getBoundingClientRect();
    // Batch all reads before cancelling animations or writing the next geometry.
    const snapshots=views.map(view=>{
      const rect=view.el.getBoundingClientRect();
      const style=getComputedStyle(view.el);
      const images=new Map([...view.frame.querySelectorAll('img')].map(img=>[img,getComputedStyle(img).transform]));
      return {rect:{x:rect.left-parent.left,y:rect.top-parent.top,w:rect.width,h:rect.height},opacity:style.opacity,images};
    });
    views.forEach((view,i)=>{
      const nextSlot=offset(i,center,views.length),rect=rectFor(nextSlot),old=snapshots[i];
      const visible=Math.abs(nextSlot)<=1;
      const wasVisible=Math.abs(view.slot)<=1;
      view.animations.forEach(animation=>animation.cancel());view.animations=[];
      view.el.className='projeto '+(nextSlot===0?'pos-centro':nextSlot===-1?'pos-esq':nextSlot===1?'pos-dir':'pos-fila');
      view.el.dataset.offset=nextSlot;
      view.el.tabIndex=visible?0:-1;
      view.el.setAttribute('aria-hidden',String(!visible));
      const target={width:rect.w+'px',height:rect.h+'px',transform:`translate3d(${rect.x}px,${rect.y}px,0)`,opacity:visible?'1':'0'};
      const from={width:old.rect.w+'px',height:old.rect.h+'px',transform:`translate3d(${old.rect.x}px,${old.rect.y}px,0)`,opacity:old.opacity};
      const shouldMove=moving&&(visible||wasVisible);
      if(shouldMove) animate(view.el,from,target,view.animations);
      else Object.assign(view.el.style,target);
      poseImages(view,rect,nextSlot,shouldMove?old.images:null);
      view.slot=nextSlot;view.rect=rect;
      if(visible) ensureFrame(i,0);
    });
    title.textContent=projetos[center].titulo;
    description.textContent=projetos[center].descricao;
  }
  async function ensureFrame(index,direction){
    const view=views[index],project=projetos[index],src=project.frames[project.frame];
    if(view.desired===src) return;
    view.desired=src;
    const ticket=++view.request;
    view.el.setAttribute('aria-busy','true');
    try{
      const source=await load(src,index===center?'high':'auto');
      if(ticket!==view.request) return;
      await view.swap;
      if(ticket!==view.request) return;
      const layer=document.createElement('div');layer.className='project-slide';
      const image=source.cloneNode();image.className='project-image';image.alt=`${project.titulo} — imagem ${project.frame+1} de ${project.frames.length}`;
      image.dataset.ratio=source.naturalWidth/source.naturalHeight;
      image.style.width='1000px';image.style.height=1000/Number(image.dataset.ratio)+'px';
      image.style.transform=imagePose(view.rect,Number(image.dataset.ratio),view.slot);
      layer.append(image);
      view.swap=replaceFrame(view.frame,layer,direction||1);
      await view.swap;
      if(index===center) prefetchFrames(index);
    }catch{
      if(ticket===view.request){view.desired=null;view.el.setAttribute('aria-label',`${project.titulo}. Imagem indisponível; toque para continuar.`);}
    }finally{
      if(ticket===view.request) view.el.setAttribute('aria-busy','false');
    }
  }
  function prefetchFrames(index){
    const p=projetos[index];
    [1,-1].forEach(step=>load(p.frames[(p.frame+step+p.frames.length)%p.frames.length],'low').catch(()=>{}));
  }
  function choose(index){
    userInteracted=true;stopAuto();
    if(index===center) return;
    center=index;render(true);prefetchFrames(center);
  }
  projetos.forEach((project,i)=>{
    const el=document.createElement('article');el.className='projeto pos-fila';el.dataset.index=i;
    el.setAttribute('role','button');el.setAttribute('aria-label',`Abrir ${project.titulo}`);
    const frame=document.createElement('div');frame.className='frame';el.append(frame);carousel.append(el);
    const view={el,frame,slot:99,rect:{x:0,y:0,w:1,h:1},animations:[],request:0,swap:Promise.resolve(),desired:null};views.push(view);
    el.addEventListener('click',event=>{
      if(mobile) return;
      if(i!==center){choose(i);return;}
      const image=view.frame.querySelector('img');
      if(!image) return;
      const bounds=image.getBoundingClientRect();
      if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom) return;
      userInteracted=true;stopAuto();
      const direction=event.clientX<bounds.left+bounds.width/2?-1:1;
      project.frame=(project.frame+direction+project.frames.length)%project.frames.length;
      ensureFrame(i,direction);
    });
    el.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();if(i!==center) choose(i);else{project.frame=(project.frame+1)%project.frames.length;ensureFrame(i,1);}}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();choose((center+(event.key==='ArrowLeft'?-1:1)+views.length)%views.length);}
    });
  });
  function measure(){
    resizeFrame=0;if(mobile) return;
    const width=carousel.clientWidth||innerWidth,vh=innerHeight;
    const gap=clamp(width*.028,16,36),textGap=clamp(width*.022,14,28);
    const sideWidth=clamp(width*.12,140,220)*.965;
    const mainWidth=clamp(width-2*clamp(width*.12,140,220)-2*gap,520,1600);
    gallery.style.setProperty('--main-w',mainWidth+'px');
    const probe=description.cloneNode(false);probe.removeAttribute('id');
    Object.assign(probe.style,{position:'absolute',top:'0',visibility:'hidden',transform:'none',pointerEvents:'none'});
    gallery.append(probe);
    let captionHeight=0;
    projetos.forEach(p=>{probe.textContent=p.descricao;captionHeight=Math.max(captionHeight,probe.getBoundingClientRect().height);});probe.remove();
    const top=Math.min(112,vh*.14),titleHeight=title.getBoundingClientRect().height||38;
    const mediaTop=top+titleHeight+textGap;
    const height=Math.max(80,Math.min(vh*.7,860,vh-mediaTop-textGap-captionHeight-28));
    layout={width,mainWidth,sideWidth,height,top:mediaTop};
    gallery.style.setProperty('--title-top',top+'px');gallery.style.setProperty('--media-top',mediaTop+'px');gallery.style.setProperty('--main-h',height+'px');
    render(false);
  }
  function stopAuto(){clearInterval(auto);auto=0;}
  function updateAuto(){
    stopAuto();
    if(mobile||hovered||focused||!inView||document.hidden||userInteracted||reduced.matches) return;
    auto=setInterval(()=>{center=(center+1)%views.length;render(true);prefetchFrames(center);},10000);
  }
  carousel.addEventListener('pointerenter',()=>{hovered=true;updateAuto();});
  carousel.addEventListener('pointerleave',()=>{hovered=false;updateAuto();});
  carousel.addEventListener('focusin',()=>{focused=true;updateAuto();});
  carousel.addEventListener('focusout',event=>{if(!carousel.contains(event.relatedTarget)){focused=false;updateAuto();}});
  document.addEventListener('visibilitychange',updateAuto);
  if('IntersectionObserver' in window) new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;updateAuto();},{threshold:.5}).observe(gallery);
  window.addEventListener('resize',()=>{if(!resizeFrame) resizeFrame=requestAnimationFrame(measure);},{passive:true});
  document.fonts.ready.then(measure);
  window.PortfolioDesktop={setMobile(value){mobile=value;if(mobile){stopAuto();views.forEach(v=>v.animations.forEach(a=>a.cancel()));}else{views.forEach(v=>v.desired=null);measure();updateAuto();}}};
})();
