const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Small DOM boundary for testing the real touch handlers without a browser driver.
class Element {
  constructor(tag='div') {
    this.tag = tag; this.children=[]; this.style={}; this.listeners={}; this.attributes={};
    this.clientWidth=400; this.clientHeight=200; this.dataset={};
    const classes = new Set();
    this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),toggle:(n,on)=>on?classes.add(n):classes.delete(n),contains:n=>classes.has(n)};
  }
  append(...elements) { elements.forEach(el=>{el.parent=this;this.children.push(el);}); }
  appendChild(el) {this.append(el);return el;}
  prepend(el) {el.parent=this;this.children.unshift(el);}
  after(el) { this.parent.append(el); }
  remove() {if(this.parent) this.parent.children=this.parent.children.filter(el=>el!==this);}
  setAttribute(name,value) {this.attributes[name]=value;}
  addEventListener(name,fn) {(this.listeners[name] ||= []).push(fn);}
  getBoundingClientRect() {return {left:0,top:0,width:400,height:200};}
  querySelectorAll(selector) {return this.children.flatMap(el=>[...(selector==='img'&&el.tag==='img'?[el]:[]),...el.querySelectorAll(selector)]);}
  emit(name,touches=[],changedTouches=touches) {
    const event={touches,changedTouches,prevented:false,preventDefault(){this.prevented=true;}};
    (this.listeners[name]||[]).forEach(fn=>fn(event));return event;
  }
}
async function setup(mobile=true) {
  const ids=Object.fromEntries(['carousel','titulo','descricao','listaMobile'].map(id=>[id,new Element()]));
  const stage=new Element();stage.append(...Object.values(ids));
  const media={matches:mobile,addEventListener(name,fn){this.change=fn;}};
  const window=new Element();
  const projetos=[{titulo:'Projeto',descricao:'Descrição',frames:['one.jpg','two.jpg','three.jpg'],frame:0}];
  let raf=[];
  class Image extends Element {
    constructor(){super('img');this.naturalWidth=800;this.naturalHeight=400;}
    decode(){return Promise.resolve();}
    cloneNode(){return new Image();}
  }
  vm.runInNewContext(fs.readFileSync(__dirname+'/gallery.js','utf8'),{
    document:{querySelector:()=>stage,getElementById:id=>ids[id],createElement:tag=>new Element(tag)},
    matchMedia:()=>media,Image,window,projetos,performance,
    requestAnimationFrame:fn=>raf.push(fn),setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}
  });
  async function settle(){for(let i=0;i<8;i++) await Promise.resolve(); const pending=raf;raf=[];pending.forEach(fn=>fn());}
  await settle();
  const article=ids.listaMobile.children[0];
  return {ids,stage,media,window,projetos,settle,article,wrap:article?.children[1].children[0]};
}
const touch=(clientX,clientY)=>({clientX,clientY});

test('pinch scales just the image, stays anchored and does not advance on release',async()=>{
  const {wrap,projetos,article}=await setup();
  assert.equal(wrap.emit('touchstart',[touch(100,100),touch(300,100)]).prevented,true);
  assert.equal(wrap.emit('touchmove',[touch(0,100),touch(400,100)]).prevented,true);
  const image=wrap.children.at(-1);
  assert.equal(image.style.transform,'translate3d(-200px,-100px,0) scale(2)');
  assert.equal(article.style.transform,undefined);
  wrap.emit('touchend',[touch(200,100)],[touch(400,100)]);
  wrap.emit('touchend',[],[touch(200,100)]);
  assert.equal(projetos[0].frame,0);
  wrap.emit('touchcancel');
  assert.equal(image.style.transform,'translate3d(0px,0px,0) scale(1)');
  assert.equal(article.children.some(el=>el.className==='image-controls'),false);
});
test('single-finger scrolling remains native, while a tap advances',async()=>{
  const {wrap,projetos,settle}=await setup();
  assert.equal(wrap.emit('touchstart',[touch(300,100)]).prevented,false);
  assert.equal(wrap.emit('touchmove',[touch(300,10)]).prevented,false);
  wrap.emit('touchend',[],[touch(300,10)]);
  assert.equal(projetos[0].frame,0);
  wrap.emit('touchstart',[touch(300,100)]);
  wrap.emit('touchend',[],[touch(300,100)]);
  await settle();assert.equal(projetos[0].frame,1);
});
test('zoom and pan are bounded; cancel and resize reset the image',async()=>{
  const {wrap,window}=await setup();
  wrap.emit('touchstart',[touch(150,100),touch(250,100)]);
  wrap.emit('touchmove',[touch(-1000,100),touch(1000,100)]);
  assert.match(wrap.children.at(-1).style.transform,/scale\(4\)/);
  wrap.emit('touchend',[touch(100,100)]);
  wrap.emit('touchmove',[touch(9999,9999)]);
  assert.equal(wrap.children.at(-1).style.transform,'translate3d(0px,0px,0) scale(4)');
  wrap.emit('touchcancel');
  assert.match(wrap.children.at(-1).style.transform,/scale\(1\)/);
  wrap.emit('touchstart',[touch(100,100),touch(300,100)]);
  wrap.emit('touchmove',[touch(0,100),touch(400,100)]);
  window.emit('resize');
  assert.equal(wrap.children.at(-1).style.transform,'translate3d(0px,0px,0) scale(1)');
});
test('desktop retains the original carousel without project menus or image controls',async()=>{
  const {ids,stage}=await setup(false);
  assert.equal(ids.carousel.children.length,1);
  assert.equal(ids.carousel.children[0].classList.contains('pos-centro'),true);
  assert.equal(stage.children.some(el=>el.className==='project-nav'||el.className==='gallery-footer'),false);
});
