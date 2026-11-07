/* Time-based motion primitives shared by the opening and the gallery. */
(() => {
  const clamp = (n,min=0,max=1) => Math.max(min,Math.min(max,n));
  const mix = (a,b,p) => a+(b-a)*p;
  const smooth = p => p*p*(3-2*p);
  function logoPose(origin,target,progress){
    const p=smooth(clamp(progress));
    return {x:mix(origin.x,target.x,p),y:mix(origin.y,target.y,p),scale:Math.exp(mix(Math.log(origin.size/90),Math.log(target.size/90),p))};
  }
  function offset(index,center,count){
    let value=(index-center+count)%count;
    return value>count/2 ? value-count : value;
  }
  function slotRect(slot,layout){
    const {width,mainWidth,height,top,sideWidth}=layout;
    if(slot===0) return {x:(width-mainWidth)/2,y:top,w:mainWidth,h:height};
    const h=height*.88*.965;
    return {x:slot===-1?0:slot===1?width-sideWidth:slot<0?-sideWidth-48:width+48,
      y:top+(height-h)/2,w:sideWidth,h};
  }
  function fitImage(rect,ratio,slot){
    const width=1000,height=1000/ratio;
    const fit=slot===0?Math.min:Math.max;
    const scale=fit(rect.w/width,rect.h/height);
    const anchor=slot<0?1:slot>0?0:.5;
    return {x:(rect.w-width*scale)*anchor,y:(rect.h-height*scale)/2,scale};
  }
  function zoomPan(base,viewport,scale,x,y){
    function axis(value,start,size,viewportStart,viewportSize){
      const end=viewportStart+viewportSize-start-size*scale;
      const beginning=viewportStart-start;
      return clamp(value,Math.min(size*(1-scale),beginning,end),Math.max(0,beginning,end));
    }
    return {x:axis(x,base.left,base.width,viewport.left,viewport.width),y:axis(y,base.top,base.height,viewport.top,viewport.height)};
  }
  const api={clamp,mix,smooth,logoPose,offset,slotRect,fitImage,zoomPan};
  if(typeof module!=='undefined') module.exports=api;
  else window.PortfolioMotion=api;
})();
