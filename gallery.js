/* Original desktop carousel; mobile presentation preserved with inline pinch zoom. */
(() => {
  const mobile = matchMedia('(max-width:768px)');
  const list = document.getElementById('listaMobile');
  const mobileViews = new Map();
  const imageCache = new Map();
  const mobileObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        showMobile(Number(entry.target.dataset.index)); mobileObserver.unobserve(entry.target);
      }
    });
  }, {rootMargin:'500px 0px'}) : null;
/* ===== GALERIA DESKTOP — 3-panel carousel with smooth transitions ===== */
const elCarousel = document.getElementById('carousel');
const elTitulo = document.getElementById('titulo');
const elDescricao = document.getElementById('descricao');
let centro = 0, autoInterval = null, restartTimeout = null;
let isAnimating = false;
let animationUnlock = null;

/* Precompute natural aspect ratios for smooth size transitions */
const naturalRatios = {};
function preloadRatio(src){
  if(naturalRatios[src] !== undefined || /^#/.test(src)) return;
  naturalRatios[src] = null; // mark as loading
  const img = new Image();
  img.src = encodeURI(src);
  const done = () => {
    if(img.naturalWidth && img.naturalHeight){
      naturalRatios[src] = img.naturalWidth / img.naturalHeight;
    }
  };
  if(img.decode) img.decode().then(done).catch(done);
  else { img.onload = done; img.onerror = done; }
}
// Preload all first frames
projetos.forEach(p => preloadRatio(p.frames[0]));

function criarProjetoDesktop(i){
  const el = document.createElement('article');
  el.className = 'projeto pos-fila'; el.dataset.index = i;

  const frame = document.createElement('div'); frame.className = 'frame';
  aplicarValorEmFrameDesktop(frame, projetos[i].frames[0]);
  el.appendChild(frame);

  el.addEventListener('click', (e) => {
    if(+el.dataset.index === centro){
      // Click left/right half of center panel to go prev/next frame
      const cr = el.getBoundingClientRect();
      const cx = e.clientX - cr.left;
      if(cx >= cr.width / 2){
        avancarFrame(i);
      } else {
        voltarFrame(i);
      }
      aplicarValorEmFrameDesktop(frame, projetos[i].frames[projetos[i].frame]);
    } else {
      trazerParaCentro(i);
    }
    resetAutoCountdown();
  });

  el.tabIndex = 0;
  el.setAttribute('role','button');
  el.setAttribute('aria-label', `Abrir ${projetos[i].titulo}`);
  el.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); } });
  return el;
}

function aplicarValorEmFrameDesktop(frameEl, value){
  if(frameEl.dataset.current === value) return;
  frameEl.dataset.current = value;
  const next = document.createElement('div');
  next.className = 'layer';
  if(/^#/.test(value)) next.style.background = value;
  else next.style.backgroundImage = `url("${encodeURI(value)}")`;
  next.style.opacity = '0';
  frameEl.appendChild(next);

  const layers = frameEl.querySelectorAll('.layer');
  const prev = layers.length > 1 ? layers[0] : null;

  const maybeFade = () => {
    requestAnimationFrame(() => {
      if(frameEl.dataset.current !== value){ next.remove(); return; }
      next.style.transition = 'opacity 280ms cubic-bezier(.4,0,.2,1)';
      next.style.opacity = '1';
      if(prev){
        prev.style.transition = 'opacity 280ms cubic-bezier(.4,0,.2,1)';
        prev.style.opacity = '0';
        prev.addEventListener('transitionend', () => prev.remove(), {once:true});
      }
    });
  };

  if(/^#/.test(value)){ maybeFade(); return; }
  const img = new Image();
  img.src = next.style.backgroundImage.slice(5, -2);
  if(img.decode) img.decode().then(maybeFade).catch(maybeFade);
  else if(img.complete) maybeFade();
  else { img.onload = maybeFade; img.onerror = maybeFade; }

  const all = frameEl.querySelectorAll('.layer');
  for(let j = 0; j < all.length - 2; j++) all[j].remove();
}

projetos.forEach((_, i) => elCarousel.appendChild(criarProjetoDesktop(i)));

/* Smooth carousel transitions via JS for better control */
const TRANSITION_DURATION = 650;
const TRANSITION_EASING = 'cubic-bezier(.22, .8, .25, 1)';

function setTransitions(el, enable){
  if(enable){
    el.style.transition = [
      `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`,
      `transform-origin ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`,
      `width ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`,
      `height ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`,
      `opacity ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`
    ].join(', ');
  } else {
    el.style.transition = 'none';
  }
}

function aplicarPosicoes(animate){
  const n = projetos.length, esq = (centro-1+n)%n, dir = (centro+1)%n;
  const children = [...elCarousel.children];

  if(animate) isAnimating = true;

  children.forEach(el => {
    const i = +el.dataset.index;
    let offset = (i - centro + n) % n;
    if(offset > n / 2) offset -= n;
    const previousOffset = Number(el.dataset.offset ?? offset);
    el.classList.remove('pos-esq','pos-centro','pos-dir','pos-fila');

    // Reposition hidden projects offscreen, without sweeping across the visible set.
    setTransitions(el, animate && !(Math.abs(previousOffset) > 1 && Math.abs(offset) > 1));
    el.dataset.offset = offset;
    el.tabIndex = Math.abs(offset) <= 1 ? 0 : -1;
    el.setAttribute('aria-hidden', String(Math.abs(offset) > 1));

    if(i === centro) el.classList.add('pos-centro');
    else if(i === esq) el.classList.add('pos-esq');
    else if(i === dir) el.classList.add('pos-dir');
    else {
      // Items going to queue: if they were visible, animate out; if not, just place
      el.classList.add('pos-fila');
    }
  });

  // Update text
  elTitulo.textContent = projetos[centro].titulo;
  elDescricao.textContent = projetos[centro].descricao;

  if(animate){
    clearTimeout(animationUnlock);
    animationUnlock = setTimeout(() => { isAnimating = false; }, TRANSITION_DURATION);
  }
}

aplicarPosicoes(false);

// Reserve the longest caption before sizing the image, so the set fits one screen.
function ajustarConjuntoDesktop(){
  if(mobile.matches || !window.innerHeight) return;
  const gallery = document.querySelector('.galeria');
  const measure = elDescricao.cloneNode(false);
  measure.removeAttribute('id');
  Object.assign(measure.style,{position:'absolute',visibility:'hidden',top:'0',transform:'none',pointerEvents:'none'});
  gallery.appendChild(measure);
  let captionHeight = 0;
  projetos.forEach(project => {
    measure.textContent = project.descricao;
    captionHeight = Math.max(captionHeight, measure.getBoundingClientRect().height);
  });
  measure.remove();
  const gap = parseFloat(getComputedStyle(gallery).getPropertyValue('--text-gap')) || 20;
  const top = Math.min(112, window.innerHeight * .14);
  const titleHeight = elTitulo.getBoundingClientRect().height;
  const mediaTop = top + titleHeight + gap;
  const available = window.innerHeight - mediaTop - gap - captionHeight - 28;
  gallery.style.setProperty('--title-top', `${top}px`);
  gallery.style.setProperty('--media-top', `${mediaTop}px`);
  gallery.style.setProperty('--main-h', `${Math.max(80, Math.min(window.innerHeight * .7, 860, available))}px`);
}
window.addEventListener('resize', ajustarConjuntoDesktop, {passive:true});
document.fonts?.ready.then(ajustarConjuntoDesktop);
ajustarConjuntoDesktop();

function passo(){
  if(isAnimating) return;
  centro = (centro+1) % projetos.length;
  aplicarPosicoes(true);
}
function startAuto(){ stopAuto(); autoInterval = setInterval(passo, 10000); }
function stopAuto(){ if(autoInterval){ clearInterval(autoInterval); autoInterval = null; } }
function resetAutoCountdown(){ stopAuto(); if(restartTimeout) clearTimeout(restartTimeout); restartTimeout = setTimeout(startAuto, 15000); }
startAuto();

function trazerParaCentro(idx){
  centro = idx;
  aplicarPosicoes(true);
}
function avancarFrame(i){ projetos[i].frame = (projetos[i].frame+1) % projetos[i].frames.length; }
function voltarFrame(i){ projetos[i].frame = (projetos[i].frame-1+projetos[i].frames.length) % projetos[i].frames.length; }


  function load(src) {
    if (!imageCache.has(src)) {
      const image = new Image(); image.decoding = 'async'; image.src = encodeURI(src);
      const ready = image.decode ? image.decode() : new Promise((resolve, reject) => {
        image.onload = resolve; image.onerror = reject;
      });
      imageCache.set(src, ready.then(() => image).catch(error => {
        imageCache.delete(src); throw error;
      }));
    }
    return imageCache.get(src);
  }
  function prefetch(index) {
    const p = projetos[index];
    [1, -1].forEach(step => load(p.frames[(p.frame + step + p.frames.length) % p.frames.length]).catch(() => {}));
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
      const view = {article, wrap, message, request:0, scale:1, x:0, y:0};
      mobileViews.set(index, view); attachZoom(view, index);
      // Keep the original article-wide tap navigation outside the zoom surface.
      let textTap = null;
      article.addEventListener('touchstart', event => {
        textTap = null;
        if (wrap.contains(event.target) || event.touches.length !== 1 || view.scale > 1.01) return;
        const t = event.touches[0]; textTap = {x:t.clientX,y:t.clientY,time:performance.now()};
      }, {passive:true});
      article.addEventListener('touchend', event => {
        if (!textTap || event.touches.length) return;
        const t = event.changedTouches[0], start = textTap; textTap = null;
        if (Math.hypot(t.clientX-start.x,t.clientY-start.y)<10 && performance.now()-start.time<300)
          step(index,t.clientX<innerWidth/2?-1:1);
      }, {passive:true});
      article.addEventListener('touchcancel', () => {textTap=null;}, {passive:true});
    });
  }
  async function showMobile(index) {
    const view = mobileViews.get(index); if (!view) return;
    const p = projetos[index], ticket = ++view.request;
    view.message.hidden = true;
    try {
      const source = await load(p.frames[p.frame]);
      if (ticket !== view.request) return;
      view.resetZoom();
      const image = source.cloneNode(); image.className = 'layer';
      image.alt = `${p.titulo} — imagem ${p.frame + 1} de ${p.frames.length}`;
      const previous = [...view.wrap.children];
      view.wrap.style.aspectRatio = `${source.naturalWidth} / ${source.naturalHeight}`;
      view.wrap.append(image);
      requestAnimationFrame(() => {
        if (ticket !== view.request) { image.remove(); return; }
        image.classList.add('on'); previous.forEach(el => el.classList.remove('on'));
        setTimeout(() => previous.forEach(el => el.remove()), 260);
      });
      view.message.textContent = ''; prefetch(index);
    } catch {
      if (ticket === view.request) {
        view.message.hidden = false;
        view.message.textContent = 'Não foi possível carregar esta imagem. Toque na imagem para continuar.';
      }
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
    showMobile(index);
  }
  function syncMode() {
    if (mobile.matches) {
      stopAuto(); buildMobile();
      mobileViews.forEach((view, i) => {
        if (mobileObserver) mobileObserver.observe(view.article); else showMobile(i);
      });
    } else {
      mobileObserver?.disconnect(); aplicarPosicoes(false); startAuto();
    }
  }
  mobile.addEventListener('change', syncMode); syncMode();
})();
