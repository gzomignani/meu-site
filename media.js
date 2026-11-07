/* Decode once and replace a photo atomically, without animation or blank frames. */
(() => {
  const cache=new Map();
  function load(src,priority='auto'){
    if(cache.has(src)){
      const entry=cache.get(src);cache.delete(src);cache.set(src,entry);
      if(priority==='high') entry.image.fetchPriority='high';
      return entry.promise;
    }
    const image=new Image();image.decoding='async';image.fetchPriority=priority;
    image.src=encodeURI(src);
    const ready=image.decode?image.decode():new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
    const promise=ready.then(()=>{
      while(cache.size>6) cache.delete(cache.keys().next().value);
      return image;
    }).catch(error=>{cache.delete(src);throw error;});
    cache.set(src,{image,promise});return promise;
  }
  async function replaceFrame(container,next){container.replaceChildren(next);}
  window.PortfolioMedia={load,replaceFrame};
})();
