// @ts-nocheck
// Verbatim port of the template's WebGL scripts (three.js r128). The template code is kept as-is on purpose,
// so strict typing is waived for this file only. Cleanup shims (raf, listen) stop loops on unmount.
import { makeHelpers } from './helpers';

export function initHero(THREE, { reduce, raf, listen }) {
  const { canvasTex, rng, watchVisible } = makeHelpers(THREE);
  const stage=document.getElementById('stage'),canvas=document.getElementById('hero3d');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(30,1,.1,100);

  // studio environment for reflections
  const env=new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30,30,30),new THREE.MeshBasicMaterial({color:0xcfc6b8,side:THREE.BackSide})));
  const soft=(w,h,x,y,z,c,i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m);};
  soft(10,6,0,12,4,0xffffff,3.2);soft(6,10,-12,3,4,0xfff1dc,2.2);soft(6,10,12,2,-3,0xffe7cc,1.6);soft(14,3,0,-2,-12,0x7c1522,1.4);soft(8,4,4,6,13,0xffffff,1.8);
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(env,0.04).texture;

  scene.add(new THREE.HemisphereLight(0xfff6e8,0xd8cbb8,.55));
  const key=new THREE.DirectionalLight(0xfff0dc,1.9);key.position.set(5,9,6);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:30});key.shadow.bias=-.0004;key.shadow.radius=6;
  scene.add(key);
  const rim=new THREE.DirectionalLight(0xc84050,.7);rim.position.set(-6,4,-6);scene.add(rim);

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.ShadowMaterial({opacity:.13}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

  // materials
  const brass=new THREE.MeshPhysicalMaterial({color:0xc39445,metalness:1,roughness:.26,clearcoat:.4,clearcoatRoughness:.2});
  const brassDark=new THREE.MeshPhysicalMaterial({color:0x9a6f2c,metalness:1,roughness:.34});
  const r=rng(7);
  const marbleMap=canvasTex(1024,512,(g,w,h)=>{
    const grd=g.createLinearGradient(0,0,w,h);grd.addColorStop(0,'#f7f3ec');grd.addColorStop(1,'#ece5da');g.fillStyle=grd;g.fillRect(0,0,w,h);
    for(let i=0;i<26;i++){g.beginPath();let x=r()*w,y=-10;g.moveTo(x,y);const dx=(r()-.5)*3;
      while(y<h+10){x+=(r()-.5)*26+dx*8;y+=h/30;g.lineTo(x,y);}
      g.strokeStyle=`rgba(${110+r()*30|0},${95+r()*20|0},${90+r()*20|0},${.05+r()*.16})`;g.lineWidth=.4+r()*2.2;g.stroke();}
    for(let i=0;i<5;i++){g.beginPath();let x=r()*w,y=-10;g.moveTo(x,y);while(y<h+10){x+=(r()-.5)*18;y+=h/40;g.lineTo(x,y);}g.strokeStyle='rgba(124,21,34,.08)';g.lineWidth=1.2;g.stroke();}
  });
  marbleMap.wrapS=THREE.RepeatWrapping;
  const marble=new THREE.MeshPhysicalMaterial({map:marbleMap,roughness:.32,clearcoat:.7,clearcoatRoughness:.18});
  const crimson=new THREE.MeshPhysicalMaterial({color:0x7c1522,roughness:.42,clearcoat:.5,clearcoatRoughness:.3});
  const porcelain=new THREE.MeshPhysicalMaterial({color:0xf6eedf,roughness:.22,clearcoat:1,clearcoatRoughness:.08,sheen:0});
  const coinFace=canvasTex(512,512,(g,w)=>{
    const rg=g.createRadialGradient(w*.4,w*.35,10,w/2,w/2,w/2);rg.addColorStop(0,'#fff0b8');rg.addColorStop(.6,'#e2b65a');rg.addColorStop(1,'#a87a2a');
    g.fillStyle=rg;g.fillRect(0,0,w,w);
    g.strokeStyle='rgba(90,60,15,.55)';g.lineWidth=10;g.beginPath();g.arc(w/2,w/2,w*.42,0,7);g.stroke();
    g.lineWidth=3;g.beginPath();g.arc(w/2,w/2,w*.36,0,7);g.stroke();
    for(let i=0;i<64;i++){const a=i/64*Math.PI*2;g.beginPath();g.moveTo(w/2+Math.cos(a)*w*.44,w/2+Math.sin(a)*w*.44);g.lineTo(w/2+Math.cos(a)*w*.48,w/2+Math.sin(a)*w*.48);g.lineWidth=4;g.stroke();}
    g.fillStyle='rgba(90,60,15,.7)';g.font='700 230px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText('F',w/2,w/2+12);
  });
  const gold=new THREE.MeshPhysicalMaterial({color:0xd8aa48,metalness:1,roughness:.2});
  const goldFace=new THREE.MeshPhysicalMaterial({map:coinFace,metalness:1,roughness:.24});

  const cast=m=>{m.castShadow=true;m.receiveShadow=true;return m;};
  const rig=new THREE.Group();scene.add(rig);

  // pedestal
  const add=(geo,mat,y,p=rig)=>{const m=cast(new THREE.Mesh(geo,mat));m.position.y=y;p.add(m);return m;};
  add(new THREE.CylinderGeometry(2.05,2.12,.32,96),marble,.16);
  add(new THREE.CylinderGeometry(1.72,1.72,.06,96),crimson,.35);
  add(new THREE.CylinderGeometry(1.62,1.7,.52,96),marble,.64);
  add(new THREE.TorusGeometry(1.63,.028,12,120),brass,.9).rotation.x=Math.PI/2;
  add(new THREE.CylinderGeometry(1.5,1.56,.1,96),marble,.95);
  // scale foot + post
  add(new THREE.CylinderGeometry(.38,.62,.2,64),brass,1.1);
  add(new THREE.CylinderGeometry(.2,.3,.16,48),brassDark,1.28);
  add(new THREE.CylinderGeometry(.065,.085,2.35,32),brass,2.5);
  [1.6,2.4,3.2].forEach(y=>add(new THREE.TorusGeometry(.085,.02,10,32),brassDark,y).rotation.x=Math.PI/2);
  const PIV=3.62;
  add(new THREE.SphereGeometry(.12,32,24),brass,3.8);
  add(new THREE.ConeGeometry(.06,.22,24),brass,4.01);
  const hub=add(new THREE.CylinderGeometry(.13,.13,.22,40),brassDark,PIV);hub.rotation.x=Math.PI/2;

  // beam
  const beam=new THREE.Group();beam.position.y=PIV;rig.add(beam);
  const ARM=1.72;
  [-1,1].forEach(s=>{
    const arm=cast(new THREE.Mesh(new THREE.CylinderGeometry(.03,.055,ARM,24),brass));
    arm.rotation.z=Math.PI/2;arm.position.x=s*ARM/2;if(s<0)arm.rotation.z=-Math.PI/2;beam.add(arm);
    const tip=cast(new THREE.Mesh(new THREE.SphereGeometry(.055,24,16),brass));tip.position.x=s*ARM;beam.add(tip);
    const curl=cast(new THREE.Mesh(new THREE.TorusGeometry(.09,.016,10,32,Math.PI*1.4),brass));curl.position.set(s*(ARM-.02),-.09,0);curl.rotation.z=s>0?-.4:Math.PI+.4;beam.add(curl);
  });
  const pointer=cast(new THREE.Mesh(new THREE.ConeGeometry(.035,.55,16),brass));pointer.position.y=-.38;pointer.rotation.x=Math.PI;beam.add(pointer);

  // pans
  const panProfile=[[0,0],[.25,0],[.45,.02],[.58,.07],[.65,.14],[.67,.17],[.645,.175]].map(p=>new THREE.Vector2(p[0],p[1]));
  const panGeo=new THREE.LatheGeometry(panProfile,96);
  function cylBetween(a,b,rad,mat,parent){const d=new THREE.Vector3().subVectors(b,a);const m=cast(new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,d.length(),8),mat));
    m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());parent.add(m);}
  const DROP=1.52;
  function makePan(){const g=new THREE.Group();
    const bowl=cast(new THREE.Mesh(panGeo,new THREE.MeshPhysicalMaterial({color:0xc39445,metalness:1,roughness:.24,side:THREE.DoubleSide})));g.add(bowl);
    const rimT=cast(new THREE.Mesh(new THREE.TorusGeometry(.66,.018,10,96),crimson));rimT.rotation.x=Math.PI/2;rimT.position.y=.172;g.add(rimT);
    const top=new THREE.Vector3(0,DROP,0);
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/6;cylBetween(top,new THREE.Vector3(Math.cos(a)*.62,.17,Math.sin(a)*.62),.007,brassDark,g);}
    const ring=cast(new THREE.Mesh(new THREE.TorusGeometry(.05,.012,8,24),brass));ring.position.y=DROP;g.add(ring);
    rig.add(g);return g;}
  const panL=makePan(),panR=makePan();

  // coin (left)
  const coin=cast(new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.075,96),[gold,goldFace,goldFace]));
  coin.position.set(0,.095,.02);coin.rotation.set(.08,.6,-.05);panL.add(coin);
  const coin2=cast(new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.06,96),[gold,goldFace,goldFace]));
  coin2.position.set(.1,.03+.0,-.08);coin2.rotation.set(-.04,1.4,.03);coin2.position.y=.04;panL.add(coin2);

  // speech bubble (right)
  const sh=new THREE.Shape(),w=.86,h=.58,rr=.16,x0=-w/2,y0=-h/2;
  sh.moveTo(x0+rr,y0);sh.lineTo(x0+.2,y0);sh.lineTo(x0+.1,y0-.2);sh.lineTo(x0+.38,y0);sh.lineTo(x0+w-rr,y0);
  sh.quadraticCurveTo(x0+w,y0,x0+w,y0+rr);sh.lineTo(x0+w,y0+h-rr);sh.quadraticCurveTo(x0+w,y0+h,x0+w-rr,y0+h);
  sh.lineTo(x0+rr,y0+h);sh.quadraticCurveTo(x0,y0+h,x0,y0+h-rr);sh.lineTo(x0,y0+rr);sh.quadraticCurveTo(x0,y0,x0+rr,y0);
  const bGeo=new THREE.ExtrudeGeometry(sh,{depth:.14,bevelEnabled:true,bevelThickness:.06,bevelSize:.055,bevelSegments:6,curveSegments:24});
  bGeo.center();
  const bubble=new THREE.Group();const bm=cast(new THREE.Mesh(bGeo,porcelain));bubble.add(bm);
  for(let i=-1;i<=1;i++){const d=cast(new THREE.Mesh(new THREE.SphereGeometry(.05,24,16),crimson));d.position.set(i*.17,.05,.14);d.scale.z=.6;bubble.add(d);}
  bGeo.computeBoundingBox();const bh=bGeo.boundingBox.max.y-bGeo.boundingBox.min.y;
  bubble.position.set(0,bh/2+.03,0);bubble.rotation.y=-.35;panR.add(bubble);

  // orbit of chain tokens
  const orbitTilt=new THREE.Group();orbitTilt.position.y=2.15;orbitTilt.rotation.set(.32,0,-.12);rig.add(orbitTilt);
  const R=3.05;
  const ringMesh=new THREE.Mesh(new THREE.TorusGeometry(R,.008,8,256),new THREE.MeshBasicMaterial({color:0x7c1522,transparent:true,opacity:.45}));
  ringMesh.rotation.x=Math.PI/2;orbitTilt.add(ringMesh);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(R+.22,.004,8,256),new THREE.MeshBasicMaterial({color:0x4a4f57,transparent:true,opacity:.25}));
  ring2.rotation.x=Math.PI/2;orbitTilt.add(ring2);
  const spin=new THREE.Group();orbitTilt.add(spin);
  const chains=[['ETH','#2c2f35'],['SOL','#7c1522'],['BASE','#2c2f35'],['ARB','#7c1522'],['BNB','#c98c10'],['HOOD','#2f6b4f']];
  const holders=[];
  chains.forEach(([lab,col],i)=>{
    const face=canvasTex(256,256,(g,s)=>{g.fillStyle='#f7f2e8';g.fillRect(0,0,s,s);g.strokeStyle=col;g.lineWidth=10;g.beginPath();g.arc(s/2,s/2,s*.4,0,7);g.stroke();
      g.fillStyle=col;g.font=`600 ${lab.length>3?62:76}px "IBM Plex Mono",monospace`;g.textAlign='center';g.textBaseline='middle';g.fillText(lab,s/2,s/2+4);});
    const disc=cast(new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.06,64),[brass,new THREE.MeshPhysicalMaterial({map:face,roughness:.3,clearcoat:.8}),brass]));
    disc.rotation.x=Math.PI/2;
    const hold=new THREE.Group();hold.add(disc);
    const a=i/chains.length*Math.PI*2;hold.position.set(Math.cos(a)*R,0,Math.sin(a)*R);
    spin.add(hold);holders.push(hold);
  });

  // floating accents (like the isometric refs)
  const cube=(s,mat,x,y,z)=>{const m=cast(new THREE.Mesh(new THREE.BoxGeometry(s,s,s),mat));m.position.set(x,y,z);scene.add(m);return m;};
  const fl=[cube(.32,crimson,-3.2,3.9,-1.2),cube(.22,new THREE.MeshPhysicalMaterial({color:0xc98c10,roughness:.35,clearcoat:.6}),3.4,4.3,-.8),cube(.18,porcelain,2.9,.9,1.6)];
  const wire=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.6,.6,.6)),new THREE.LineBasicMaterial({color:0x2c2f35,transparent:true,opacity:.7}));
  wire.position.set(-3.4,1.1,1.2);scene.add(wire);

  // camera fit
  const target=new THREE.Vector3(0,2.15,0);
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;
    const d=Math.max(11.2,15.4/camera.aspect)*(w<600?.82:1);
    const ty2=w<600?1.2:target.y;camera.position.set(0,ty2+d*.2,d);camera.lookAt(0,ty2,0);camera.updateProjectionMatrix();}
  listen('resize',resize);resize();

  let mx=0,my=0,tx=0,ty=0;
  stage.addEventListener('pointermove',e=>{const b=stage.getBoundingClientRect();tx=((e.clientX-b.left)/b.width-.5);ty=((e.clientY-b.top)/b.height-.5);});
  stage.addEventListener('pointerleave',()=>{tx=0;ty=0;});

  const clock=new THREE.Clock();let visible=true;
  function frame(){
    const t=clock.getElapsedTime();
    mx+=(tx-mx)*.05;my+=(ty-my)*.05;
    rig.rotation.y=-.35+mx*.5+(reduce?0:Math.sin(t*.25)*.08);
    rig.rotation.x=my*.08;
    const th=reduce?0:Math.sin(t*.8)*.028+mx*.06;
    beam.rotation.z=th;
    panL.position.set(-ARM*Math.cos(th),PIV-ARM*Math.sin(th)-DROP,0);
    panR.position.set(ARM*Math.cos(th),PIV+ARM*Math.sin(th)-DROP,0);
    panL.rotation.z=panR.rotation.z=reduce?0:Math.sin(t*1.1)*.012;
    spin.rotation.y=reduce?.3:t*.14;
    holders.forEach(hld=>hld.lookAt(camera.position));
    fl.forEach((c,i)=>{c.rotation.x=t*.3+i;c.rotation.y=t*.4+i;c.position.y+=Math.sin(t*1.2+i*2)*.0016;});
    wire.rotation.y=t*.2;wire.rotation.x=t*.12;
    renderer.render(scene,camera);
  }
  if(reduce){frame();listen('resize',frame);return;}
  watchVisible(stage,v=>visible=v);
  (function loop(){raf(loop);if(visible&&!document.hidden)frame();})();
}

export function initLadder(THREE, { reduce, raf, listen }) {
  const { watchVisible } = makeHelpers(THREE);
  const wrap=document.getElementById('ladderWrap'),canvas=document.getElementById('ladder3d');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
  camera.position.set(12,10,12);camera.lookAt(0,1.1,0);
  scene.add(new THREE.AmbientLight(0xffffff,.62));
  const dl=new THREE.DirectionalLight(0xffffff,.55);dl.position.set(-4,10,7);scene.add(dl);
  const dl2=new THREE.DirectionalLight(0xffffff,.22);dl2.position.set(8,3,-2);scene.add(dl2);

  const C={t:0x2f6b4f,s:0xc98c10,d:0x7c1522,n:0xb6b4b0};
  const side=new THREE.MeshLambertMaterial({color:0xf3eee5});
  const edgeMat=new THREE.LineBasicMaterial({color:0x2c2f35});
  const grades=[['AAA',3.4,'t'],['AA',3.05,'t'],['A',2.7,'t'],['BBB',2.35,'t'],['BB',1.95,'s'],['B',1.65,'s'],['CCC',1.3,'s'],['CC',1.0,'s'],['C',.75,'s'],['D',.45,'d'],['NR',.45,'n']];
  const S=.82,G=.08,N=grades.length;
  // base slab
  const baseG=new THREE.BoxGeometry(N*(S+G)+.6,.18,S+1.2);
  const base=new THREE.Mesh(baseG,side);base.position.y=-.09;scene.add(base);
  const be=new THREE.LineSegments(new THREE.EdgesGeometry(baseG),edgeMat);be.position.copy(base.position);scene.add(be);
  // cut marker between BBB and BB
  const cutX=(3.5-(N-1)/2)*(S+G)+0;
  const cut=new THREE.Mesh(new THREE.BoxGeometry(.035,.02,S+1.2),new THREE.MeshBasicMaterial({color:0x7c1522}));cut.position.set(cutX,.011,0);scene.add(cut);

  const blocks=[];
  grades.forEach(([lab,h,b],i)=>{
    const geo=new THREE.BoxGeometry(S,h,S);geo.translate(0,h/2,0);
    const top=new THREE.MeshLambertMaterial({color:C[b]});
    const front=new THREE.MeshLambertMaterial({color:b==='n'?0xe6e3de:0xf3eee5});
    const m=new THREE.Mesh(geo,[front,front,top,front,front,front]);
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat);
    const g=new THREE.Group();g.add(m,e);
    g.position.set((i-(N-1)/2)*(S+G),0,0);
    if(b==='n'){g.position.z=0;}
    scene.add(g);
    const el=document.createElement('span');el.className='lbl3d';el.textContent=lab;wrap.appendChild(el);
    blocks.push({g,h,el,i});
  });
  // floating cubes
  const fc=(s,c,x,y,z,wire)=>{const geo=new THREE.BoxGeometry(s,s,s);const grp=new THREE.Group();
    if(!wire)grp.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c})));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat));grp.position.set(x,y,z);scene.add(grp);return grp;};
  const floaters=[fc(.42,0x7c1522,-3.2,4.6,-1.5),fc(.3,0xc98c10,2.8,3.6,-1.2),fc(.7,0,-1.2,5.2,-2,true),fc(.26,0xf3eee5,4.6,1.8,.8)];

  const v=new THREE.Vector3();
  function placeLabels(){const w=wrap.clientWidth,h=wrap.clientHeight;
    blocks.forEach(b=>{v.set(b.g.position.x,b.h*b.g.scale.y+.02,b.g.position.z+S/2-.15).project(camera);
      b.el.style.left=((v.x+1)/2*w)+'px';b.el.style.top=((1-v.y)/2*h-4)+'px';});}
  function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);
    const a=w/h;const span=a>1.2?9.2:Math.max(9.2,12.4/a);
    camera.left=-span*a/2;camera.right=span*a/2;camera.top=span/2;camera.bottom=-span/2;camera.zoom=1;camera.updateProjectionMatrix();placeLabels();}
  listen('resize',()=>{resize();render();});resize();

  function render(){placeLabels();renderer.render(scene,camera);}
  let started=false,t0=0,visible=false;
  function rise(now){const t=(now-t0)/1000;let done=true;
    blocks.forEach(b=>{const k=Math.min(1,Math.max(0,(t-b.i*.07)/.6));const e=1-Math.pow(1-k,3);b.g.scale.y=Math.max(.001,e);
      if(k>=1)b.el.classList.add('show');else done=false;});
    return done;}
  if(reduce){blocks.forEach(b=>b.el.classList.add('show'));render();return;}
  blocks.forEach(b=>b.g.scale.y=.001);render();
  watchVisible(wrap,vv=>{visible=vv;if(vv&&!started){started=true;t0=performance.now();}});
  (function loop(now){raf(loop);if(!visible||document.hidden)return;
    if(started)rise(now);
    const t=now/1000;floaters.forEach((f,i)=>{f.rotation.y=t*.4+i;f.rotation.x=t*.25+i;f.position.y+=Math.sin(t*1.3+i*1.7)*.002;});
    render();})(performance.now());
}
