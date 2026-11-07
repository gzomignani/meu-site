const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {logoPose,offset,slotRect,fitImage}=require('./motion.js');

test('logo starts at the source and ends exactly at the dock without a visibility handoff',()=>{
  const source={x:900,y:260,size:160},target={x:675,y:24,size:90};
  const first=logoPose(source,target,0),last=logoPose(source,target,1);
  assert.equal(first.x,source.x);assert.equal(first.y,source.y);
  assert.equal(last.x,target.x);assert.equal(last.y,target.y);assert.equal(last.scale,1);
  const before=logoPose(source,target,.000099),after=logoPose(source,target,.000101);
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<.001);
});
test('logo position is directly reversible with scroll, with no accumulated lag',()=>{
  const source={x:900,y:260,size:160},target={x:675,y:24,size:90};
  const halfway=logoPose(source,target,.5);
  logoPose(source,target,1);
  assert.deepEqual(logoPose(source,target,.5),halfway);
});
test('hidden projects leave through their own side, including the circular wrap',()=>{
  const layout={width:1440,mainWidth:1024,height:640,top:170,sideWidth:167};
  assert.equal(offset(4,0,5),-1);
  assert.equal(offset(4,1,5),-2);
  const left=slotRect(-2,layout),right=slotRect(2,layout);
  assert.ok(left.x+left.w<0);
  assert.ok(right.x>layout.width);
});
test('central images keep their aspect ratio and fit the available frame',()=>{
  const rect={w:1024,h:640};
  for(const ratio of [.5,1,1.414,16/9,2.5]){
    const pose=fitImage(rect,ratio,0);
    const width=1000*pose.scale,height=1000/ratio*pose.scale;
    assert.ok(width<=rect.w+.00001&&height<=rect.h+.00001);
    assert.ok(Math.abs(width/height-ratio)<1e-10);
    assert.ok(pose.x>=0&&pose.y>=0);
  }
});
function mediaHarness(){
  const window={};let decodeCount=0,fail=false;
  class Image{decode(){decodeCount++;return fail?Promise.reject(Error('offline')):Promise.resolve();}}
  vm.runInNewContext(fs.readFileSync(__dirname+'/media.js','utf8'),{window,Image,matchMedia:()=>({matches:false}),encodeURI});
  return {api:window.PortfolioMedia,decodeCount:()=>decodeCount,fail:value=>fail=value};
}
test('concurrent requests share a decode and failed images remain retryable',async()=>{
  const h=mediaHarness();
  await Promise.all([h.api.load('one'),h.api.load('one')]);assert.equal(h.decodeCount(),1);
  h.fail(true);await assert.rejects(h.api.load('two'));
  h.fail(false);await h.api.load('two');assert.equal(h.decodeCount(),3);
});
test('photo changes replace the frame directly without scheduling any animation',async()=>{
  const h=mediaHarness();let animations=0;
  const old={animate(){animations++;}},next={animate(){animations++;}};
  const container={children:[old],replaceChildren(el){this.children=[el];}};
  await h.api.replaceFrame(container,next);
  assert.deepEqual(container.children,[next]);assert.equal(animations,0);
});
