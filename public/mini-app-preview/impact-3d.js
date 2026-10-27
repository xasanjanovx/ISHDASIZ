import * as THREE from './assets/three/three.module.min.js';

// One real WebGL object. Product controls and text are ordinary accessible HTML.
const app=document.getElementById('app'),content=document.getElementById('content');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
let disposeCurrent=()=>{};

function mountImpactScene(stage){
  const mount=stage.querySelector('.impact-3d-mount');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}
  catch{stage.dataset.three='fallback';return()=>{};}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.25;
  renderer.setClearColor(0x000000,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-2.5,2.5,2.25,-2.25,.1,50);
  camera.position.set(0,0,10);
  const ambient=new THREE.HemisphereLight(0xffffff,0x77745c,2.6);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xfff7df,4.1);key.position.set(-3,5,8);scene.add(key);
  const rim=new THREE.DirectionalLight(0xffffff,3.0);rim.position.set(5,1,4);scene.add(rim);

  // A procedural studio environment makes metal reflect real shapes, not flat yellow.
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x74716a);
  const shell=new THREE.Mesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshBasicMaterial({color:0x77756a,side:THREE.BackSide}));studio.add(shell);
  const lightPanels=[];
  for(const [x,y,z,rx,ry,w,h,color] of [
    [-4,2,1,0,Math.PI/2,4,9,0xffffff],[4,3,-1,0,-Math.PI/2,3,8,0xfff9db],
    [0,5,0,Math.PI/2,0,8,3,0xffffff],[0,0,6,0,Math.PI,2,8,0x252724],
  ]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
    panel.position.set(x,y,z);panel.rotation.set(rx,ry,0);studio.add(panel);lightPanels.push(panel);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromScene(studio,.04);scene.environment=environment.texture;pmrem.dispose();
  shell.geometry.dispose();shell.material.dispose();for(const panel of lightPanels){panel.geometry.dispose();panel.material.dispose();}

  const gold=new THREE.MeshPhysicalMaterial({color:0xe0ac39,metalness:.91,roughness:.23,clearcoat:1,clearcoatRoughness:.13});
  const graphite=new THREE.MeshPhysicalMaterial({color:0x202624,metalness:.62,roughness:.25,clearcoat:.6});
  const ivory=new THREE.MeshPhysicalMaterial({color:0xf8f6e9,metalness:.13,roughness:.36,clearcoat:.2});
  const search=new THREE.Group();scene.add(search);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.96,.115,20,96),gold);search.add(ring);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(.841,.018,8,80),graphite);inner.position.z=.02;search.add(inner);
  const glass=new THREE.Mesh(new THREE.CircleGeometry(.825,64),new THREE.MeshPhysicalMaterial({color:0xfdfbe8,transparent:true,opacity:.035,metalness:.1,roughness:.08,clearcoat:1,side:THREE.DoubleSide,depthWrite:false}));search.add(glass);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.31,24),gold);neck.position.y=-1.10;search.add(neck);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.14,.15,.78,28),graphite);handle.position.y=-1.57;search.add(handle);
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(.151,.151,.075,28),gold);tip.position.y=-1.96;search.add(tip);
  const papers=new THREE.Group();scene.add(papers);
  for(let i=0;i<2;i++){
    const card=new THREE.Mesh(new THREE.BoxGeometry(.91,1.27,.045),ivory);card.position.set(-1.05+i*.16,-.54+i*.12,-.45-i*.1);card.rotation.set(-.06,.25,-.20+i*.13);papers.add(card);
    for(let line=0;line<3;line++){
      const stroke=new THREE.Mesh(new THREE.BoxGeometry(line===2?.35:.58,.018,.008),graphite);stroke.position.set(-1.05+i*.16,-.40+i*.12-line*.15,-.405-i*.1);stroke.rotation.z=card.rotation.z;papers.add(stroke);
    }
  }

  let frame=0,raf=0,disposed=false,elapsed=0,last=performance.now(),lastDraw=0,blend=stage.dataset.scene==='career'?1:0,intersecting=true;
  function isPaused(){return document.hidden||!intersecting||reduced.matches||app.classList.contains('motion-paused')||app.classList.contains('focus-paused');}
  function draw(now,once=false){
    if(disposed)return;
    const delta=Math.min((now-last)/1000,.06);last=now;
    if(!once&&!isPaused())elapsed+=delta;
    const target=stage.dataset.scene==='career'?1:0;
    blend=once&&isPaused()?target:THREE.MathUtils.lerp(blend,target,1-Math.exp(-delta*5));
    search.position.set(THREE.MathUtils.lerp(1.38,-1.02,blend),.92+Math.sin(elapsed*.72)*.045,.2);
    search.rotation.set(-.13+Math.sin(elapsed*.45)*.16,THREE.MathUtils.lerp(-.35,.38,blend)+Math.sin(elapsed*.6)*.2,THREE.MathUtils.lerp(-.57,.57,blend)+Math.sin(elapsed*.5)*.045);
    papers.rotation.y=Math.sin(elapsed*.4)*.1;
    papers.position.x=blend*.45;
    renderer.render(scene,camera);frame++;lastDraw=now;
    if(!once&&!isPaused())raf=requestAnimationFrame(tick);
  }
  function tick(now){if(disposed)return;if(now-lastDraw<30){raf=requestAnimationFrame(tick);return;}draw(now);}
  function wake(){cancelAnimationFrame(raf);last=performance.now();draw(last,true);if(!isPaused())raf=requestAnimationFrame(tick);}
  const resize=new ResizeObserver(()=>{
    const width=mount.clientWidth,height=mount.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);const halfHeight=2.25;camera.left=-halfHeight*width/height;camera.right=halfHeight*width/height;camera.updateProjectionMatrix();wake();
  });resize.observe(mount);
  const stateObserver=new MutationObserver(wake);stateObserver.observe(stage,{attributes:true,attributeFilter:['data-scene']});stateObserver.observe(app,{attributes:true,attributeFilter:['class','data-theme']});
  const visibility=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;wake()});visibility.observe(stage);
  document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',wake);
  stage.__impact3d={get frames(){return frame},get paused(){return isPaused()},renderer:'webgl2'};
  stage.dataset.three='ready';wake();
  return()=>{
    disposed=true;cancelAnimationFrame(raf);resize.disconnect();stateObserver.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',wake);reduced.removeEventListener('change',wake);
    const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material)});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  };
}

function sync(){disposeCurrent();disposeCurrent=()=>{};const stage=content.querySelector('.professional-stage');if(stage)disposeCurrent=mountImpactScene(stage)}
const routeObserver=new MutationObserver(sync);routeObserver.observe(content,{childList:true});
sync();
window.addEventListener('pagehide',()=>{disposeCurrent();disposeCurrent=()=>{};routeObserver.disconnect()});
window.addEventListener('pageshow',event=>{if(event.persisted){routeObserver.observe(content,{childList:true});sync()}});
