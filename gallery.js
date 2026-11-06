/* Shared project state; images decode before replacing the visible frame. */
(() => {
  const mobile = matchMedia('(max-width:768px)');
  const stage = document.querySelector('.stage');
  const carousel = document.getElementById('carousel');
  const title = document.getElementById('titulo');
  const description = document.getElementById('descricao');
  const list = document.getElementById('listaMobile');
  const nav = document.createElement('nav');
  nav.className = 'project-nav'; nav.setAttribute('aria-label', 'Escolher projeto');
  stage.prepend(nav);
  const footer = document.createElement('div'); footer.className = 'gallery-footer';
  carousel.after(footer); footer.append(description);
  const status = document.createElement('p'); status.className = 'gallery-status';
  status.setAttribute('role', 'status'); footer.after(status);
  carousel.setAttribute('role', 'region'); carousel.setAttribute('aria-label', 'Imagens do projeto');
  carousel.tabIndex = 0;
  let selected = 0, desktopRequest = 0;
  const mobileViews = new Map();
  const mobileObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.dataset.index);
        showMobile(index); mobileObserver.unobserve(entry.target);
      }
    });
  }, {rootMargin:'500px 0px'}) : null;
  const imageCache = new Map();

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
  function controls(index, change) {
    const el = document.createElement('div'); el.className = 'image-controls';
    const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '←';
    prev.setAttribute('aria-label', 'Imagem anterior');
    const count = document.createElement('output'); count.setAttribute('aria-live', 'polite');
    const next = document.createElement('button'); next.type = 'button'; next.textContent = '→';
    next.setAttribute('aria-label', 'Próxima imagem');
    prev.onclick = () => change(-1); next.onclick = () => change(1);
    el.append(prev, count, next);
    return {el, update(i) { const p = projetos[i]; count.textContent = `${p.frame + 1} / ${p.frames.length}`; }};
  }
  function step(index, amount) {
    const p = projetos[index]; p.frame = (p.frame + amount + p.frames.length) % p.frames.length;
    if (mobile.matches) showMobile(index); else showDesktop();
  }
  const desktopControls = controls(0, amount => step(selected, amount));
  footer.append(desktopControls.el);
  projetos.forEach((p, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = p.titulo;
    button.onclick = () => { selected = index; showDesktop(); };
    nav.append(button);
  });
  async function showDesktop() {
    const ticket = ++desktopRequest, index = selected, p = projetos[index];
    title.textContent = p.titulo; description.textContent = p.descricao;
    [...nav.children].forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
    desktopControls.update(index); status.textContent = 'carregando imagem…';
    carousel.setAttribute('aria-busy', 'true');
    try {
      const source = await load(p.frames[p.frame]);
      if (ticket !== desktopRequest) return;
      const image = source.cloneNode(); image.className = 'gallery-image';
      image.alt = `${p.titulo} — imagem ${p.frame + 1} de ${p.frames.length}`;
      const previous = [...carousel.children]; carousel.append(image);
      requestAnimationFrame(() => {
        if (ticket !== desktopRequest) { image.remove(); return; }
        image.classList.add('on'); previous.forEach(el => el.classList.remove('on'));
        setTimeout(() => previous.forEach(el => el.remove()), 300);
      });
      status.textContent = ''; prefetch(index);
    } catch {
      if (ticket === desktopRequest) status.textContent = 'Não foi possível carregar esta imagem. Tente as setas para continuar.';
    } finally {
      if (ticket === desktopRequest) carousel.setAttribute('aria-busy', 'false');
    }
  }
  carousel.addEventListener('click', event => {
    const rect = carousel.getBoundingClientRect(); step(selected, event.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });
  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault(); step(selected, event.key === 'ArrowLeft' ? -1 : 1);
  });

  function buildMobile() {
    if (mobileViews.size) return;
    projetos.forEach((p, index) => {
      const article = document.createElement('article'); article.className = 'projMobile';
      article.dataset.index = index;
      const heading = document.createElement('h3'); heading.className = 'tituloMobile'; heading.textContent = p.titulo;
      const frame = document.createElement('div'); frame.className = 'frameMobile';
      const wrap = document.createElement('div'); wrap.className = 'mediaWrap'; frame.append(wrap);
      const control = controls(index, amount => step(index, amount));
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'zoom-reset';
      reset.textContent = 'repor zoom'; reset.hidden = true; control.el.prepend(reset);
      const desc = document.createElement('p'); desc.className = 'descricaoMobile'; desc.textContent = p.descricao;
      const message = document.createElement('p'); message.className = 'mobile-hint'; message.setAttribute('role','status');
      article.append(heading, frame, control.el, desc, message); list.append(article);
      const view = {article, wrap, reset, control, message, request:0, scale:1, x:0, y:0};
      mobileViews.set(index, view); attachZoom(view, index);
    });
  }
  async function showMobile(index) {
    const view = mobileViews.get(index); if (!view) return;
    const p = projetos[index], ticket = ++view.request;
    view.control.update(index); view.message.textContent = 'carregando imagem…';
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
      if (ticket === view.request) view.message.textContent = 'Não foi possível carregar esta imagem. Use as setas para continuar.';
    }
  }

  function attachZoom(view, index) {
    const {wrap, reset} = view;
    let gesture = null, tap = null, consumed = false, resetTimer;
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    function paint() {
      view.x = clamp(view.x, wrap.clientWidth * (1 - view.scale), 0);
      view.y = clamp(view.y, wrap.clientHeight * (1 - view.scale), 0);
      wrap.querySelectorAll('img').forEach(img => img.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`);
      wrap.classList.toggle('is-zoomed', view.scale > 1.01); reset.hidden = view.scale <= 1.01;
    }
    view.resetZoom = () => {
      view.scale = 1; view.x = view.y = 0; gesture = null;
      wrap.classList.add('is-resetting'); paint();
      clearTimeout(resetTimer); resetTimer = setTimeout(() => wrap.classList.remove('is-resetting'), 240);
    };
    reset.onclick = view.resetZoom;
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
  function syncMode() {
    if (mobile.matches) {
      ++desktopRequest; buildMobile();
      mobileViews.forEach((view, i) => {
        view.control.update(i);
        if (mobileObserver) mobileObserver.observe(view.article); else showMobile(i);
      });
    } else {
      mobileObserver?.disconnect(); showDesktop();
    }
  }
  mobile.addEventListener('change', syncMode); syncMode();
})();
