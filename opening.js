/* One animation clock: stable type, reversible scroll and a continuous logo handoff. */
(() => {
  const {clamp,smooth,logoPose}=window.PortfolioMotion;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const compact=matchMedia('(max-width:768px), (hover:none) and (pointer:coarse)');
  const sticky=document.querySelector('.hero__sticky');
  const name=document.querySelector('.landing-name');
  const surname=document.getElementById('decryptZomignani');
  const info=document.getElementById('landingInfo');
  const icon=document.getElementById('landingIcon');
  const dock=document.getElementById('brandIcon');
  // Animate one actual logo, leaving an empty placeholder in the wordmark.
  const placeholder=document.createElement('span');placeholder.className='landing-icon';
  placeholder.setAttribute('aria-hidden','true');
  const iconRatio=icon.naturalWidth&&icon.naturalHeight?icon.naturalWidth/icon.naturalHeight:1;
  placeholder.style.width=`${.8*iconRatio}em`;
  icon.replaceWith(placeholder);icon.classList.remove('landing-icon');
  Object.assign(icon.style,{width:'100%',height:'100%',margin:'0',display:'block'});
  dock.replaceChildren(icon);dock.style.opacity='1';
  const context=document.createElement('canvas').getContext('2d');
  const characters='abcdefghkmnprstuvxyz234578@#$%';
  const ids=['decryptGabriel','decryptZomignani','decryptLine1','decryptLine2','decryptEmail'];
  const start=performance.now();
  let frame=0,lastShuffle=-Infinity;
  let origin={x:0,y:0,size:90};
  let dockOffset={x:0,y:0};
  let measuredWidth=0;
  let measuredHeight=0;
  const nativeScroll=CSS.supports('animation-timeline:scroll(root block)')&&CSS.supports('animation-range:0px 100px');
  function usesNativeScroll(){return compact.matches&&nativeScroll&&!reduced.matches;}
  let lineDelay=0;
  const groups=ids.map((id,i)=>{
    const el=document.getElementById(id),text=el.textContent;
    el.setAttribute('aria-label',text);
    const letters=[...text].map(char=>{
      const span=document.createElement('span');
      span.className='decrypt-slot';span.setAttribute('aria-hidden','true');
      span.textContent=char===' '?' ':characters[Math.floor(Math.random()*characters.length)];
      return {char,span,pool:characters,revealed:char===' '};
    });
    if(!reduced.matches) el.replaceChildren(...letters.map(l=>l.span));
    const duration=[360,440,410,390,480][i],delay=lineDelay;
    lineDelay+=duration+60;
    return {el,text,letters,delay,duration,done:reduced.matches};
  });
  function measure(){
    // Measure original words, never their randomized replacements.
    const metrics=groups.map(group=>{
      const style=getComputedStyle(group.el);
      context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      let prefix='',previous=0;
      const widths=group.letters.map(letter=>{
        prefix+=letter.char;
        const current=context.measureText(prefix).width;
        const width=current-previous;previous=current;return width;
      });
      return {group,widths,width:previous,lineHeight:parseFloat(style.lineHeight)};
    });
    metrics.forEach(({group,widths,width,lineHeight},i)=>{
      if(i<2) group.el.style.width=width+'px';
      group.el.style.height=lineHeight+'px';
      if(!group.done){
        const style=getComputedStyle(group.el);
        context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const candidates=[...characters].map(char=>({char,width:context.measureText(char).width}));
        group.letters.forEach((letter,j)=>{
          letter.span.style.width=widths[j]+'px';
          letter.pool=candidates.filter(candidate=>candidate.width<=widths[j]*1.05&&candidate.width>=widths[j]*.6).map(candidate=>candidate.char).join('')||letter.char;
          if(!letter.revealed) letter.span.textContent=letter.pool[Math.floor(Math.random()*letter.pool.length)];
        });
      }
    });
    info.style.width=surname.offsetWidth+'px';
    const rect=placeholder.getBoundingClientRect(),parent=sticky.getBoundingClientRect();
    const nameTransform=getComputedStyle(name).transform;
    const nameY=nameTransform==='none'?0:new DOMMatrixReadOnly(nameTransform).m42;
    origin={x:rect.left,y:rect.top-parent.top-nameY,size:rect.width};
    const dockStyle=getComputedStyle(dock);
    dockOffset={x:parseFloat(dockStyle.left)||0,y:parseFloat(dockStyle.top)||0};
    measuredWidth=window.innerWidth;
    measuredHeight=sticky.clientHeight;
    const distance=sticky.clientHeight*.85;
    const native=usesNativeScroll();
    document.documentElement.classList.toggle('native-opening-motion',native);
    dock.style.setProperty('--logo-from-x',`${origin.x-dockOffset.x}px`);
    dock.style.setProperty('--logo-from-y',`${origin.y-dockOffset.y}px`);
    dock.style.setProperty('--logo-from-scale',origin.size/90);
    dock.style.setProperty('--opening-distance',`${distance}px`);
    [name,surname,info].forEach((el,i)=>{
      el.style.setProperty('--exit-y',`${-[56,42,28][i]}px`);
      el.style.setProperty('--exit-start',`${distance*i*.035}px`);
      el.style.setProperty('--exit-end',`${distance*(.9+i*.035)}px`);
      if(native){el.style.removeProperty('transform');el.style.removeProperty('opacity');el.style.removeProperty('filter');}
    });
    if(native) dock.style.removeProperty('transform');
  }
  function wake(){if(!frame) frame=requestAnimationFrame(tick);}
  function tick(now){
    frame=0;
    const vh=compact.matches?sticky.clientHeight:(window.innerHeight||1);
    const progress=clamp(window.scrollY/(vh*.85));
    if(!usesNativeScroll()) [name,surname,info].forEach((el,i)=>{
      const p=smooth(clamp((progress-i*.035)/.9));
      el.style.transform=reduced.matches?'none':`translate3d(0,${-[56,42,28][i]*p}px,0)`;
      el.style.opacity=reduced.matches?'1':String(1-p);
      // Keep expensive blur restrained and off the moving logo itself.
      el.style.filter=compact.matches||reduced.matches||p<.02?'none':`blur(${[2,1.5,.8][i]*p}px)`;
    });
    const p=reduced.matches?(progress>.5?1:0):smooth(progress);
    const size=compact.matches?50:90;
    const x=compact.matches?16+dockOffset.x:(window.innerWidth-size)/2;
    const y=compact.matches?16+dockOffset.y:24;
    const pose=logoPose(origin,{x,y,size},reduced.matches?p:progress);
    if(!usesNativeScroll()) dock.style.transform=`translate3d(${pose.x-dockOffset.x}px,${pose.y-dockOffset.y}px,0) scale(${pose.scale})`;
    let decrypting=false;
    if(now-lastShuffle>=28){
      lastShuffle=now;
      groups.forEach(group=>{
        if(group.done) return;
        const p=clamp((now-start-90-group.delay)/group.duration);
        const revealed=Math.floor(p*group.letters.length);
        group.letters.forEach((letter,i)=>{
          letter.revealed=i<revealed||letter.char===' ';
          letter.span.textContent=letter.revealed?letter.char:letter.pool[Math.floor(Math.random()*letter.pool.length)];
        });
        if(p===1){group.done=true;group.el.textContent=group.text;}
      });
    }
    decrypting=groups.some(group=>!group.done);
    if(decrypting) wake();
  }
  function resize(){measure();wake();}
  window.addEventListener('scroll',()=>{if(!usesNativeScroll()) wake();},{passive:true});
  // Safari changes innerHeight while its toolbar retracts. The mobile layout
  // uses svh/lvh, so those events must not remeasure text or restart the path.
  window.addEventListener('resize',()=>{
    if(!compact.matches||window.innerWidth!==measuredWidth) resize();
  },{passive:true});
  // A real layout/orientation change still updates the origin. Unlike the
  // visual viewport, this svh-sized box stays stable as Safari's bars move.
  new ResizeObserver(()=>{
    if(compact.matches&&sticky.clientHeight!==measuredHeight) resize();
  }).observe(sticky);
  reduced.addEventListener('change',()=>{
    if(reduced.matches) groups.forEach(group=>{group.done=true;group.el.textContent=group.text;});
    resize();
  });
  document.fonts.ready.then(resize);
  measure();wake();
})();
