/* Interactive visual prototype. Accounts, listings and checkout remain local demos. */
state.layout='impact';
const professionalScenes=[
  {mode:'hiring',image:'studio-professionals.png',title:'Xodim topish',copy:'Jamoangizga\nmos mutaxassis.',icon:'users',word:'JAMOA',type:'Rezyumelar'},
  {mode:'career',image:'studio-professionals.png',title:'Ish topish',copy:'Sizga mos ish.\nYangi imkoniyat.',icon:'briefcase',word:'KARYERA',type:'Vakansiyalar'},
];
// The shared bootstrap navigates once; params retains the original campaign URL.
const campaignIntent=['hiring','career'].includes(params.get('audience'))?params.get('audience'):null;
const campaignParameters=[...params].filter(([key])=>key==='audience'||key.startsWith('utm_'));
const navigateBeforeCampaign=navigate;
navigate=function(screen,options={}){
  navigateBeforeCampaign(screen,options);
  if(campaignParameters.length){const url=new URL(location.href);for(const [key,value] of campaignParameters)url.searchParams.set(key,value);history.replaceState(null,'',url)}
};
let professionalScene=campaignIntent==='career'?1:0,professionalTimer;
if(state.screen==='search'&&campaignIntent)state.searchType=campaignIntent==='hiring'?'resumes':'jobs';
const reducedProfessionalMotion=matchMedia('(prefers-reduced-motion:reduce)');

function professionalStage(){
  const paused=app.classList.contains('motion-paused');
  return `<div class="professional-stage" data-scene="${professionalScenes[professionalScene].mode}" role="region" aria-label="Ish va xodim topish">
    <div class="impact-atmosphere" aria-hidden="true"></div><div class="scene-floor" aria-hidden="true"></div>
    <div class="scene-world" aria-hidden="true">${professionalScenes.map((scene,index)=>`
      <div class="professional-scene ${index===professionalScene?'is-active':''}">
        <span class="scene-word">${scene.word}</span>
        <div class="professional-portrait ${scene.mode}"><img src="assets/${scene.image}" alt="" width="1536" height="1024" ${index===0?'fetchpriority="high"':''}></div>
      </div>`).join('')}</div>
    <div class="impact-3d-mount" aria-hidden="true"><div class="impact-3d-fallback"><span></span></div></div>
    <div class="impact-card-layer" aria-hidden="true">${professionalScenes.map((scene,index)=>`<div class="signal-card ${index===professionalScene?'is-active':''}"><span class="signal-label">${icon(scene.icon)}${scene.type}</span><strong>${scene.copy.split('\n').join('<br>')}</strong><span class="signal-foot">${scene.title}${icon('arrow')}</span></div>`).join('')}</div>
    <button class="stage-pause" data-motion-toggle aria-pressed="${paused}" aria-label="${paused?'Animatsiyani davom ettirish':'Animatsiyani to‘xtatish'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paused?'m9 5 11 7-11 7Z':'M8 6v12M16 6v12'}"/></svg></button>
    <div class="scene-position" aria-hidden="true"><span class="scene-index">${String(professionalScene+1).padStart(2,'0')}</span><span class="scene-divider"></span><span>02</span></div>
  </div>`;
}

function professionalTicker(){
  const group=`<span>Ish topish</span><i></i><span>Xodim topish</span><i></i><span>ISHDASIZ</span><i></i>`;
  return `<div class="professional-ticker" role="region" aria-label="Ish topish. Xodim topish. ISHDASIZ."><div class="official-ticker-track" aria-hidden="true"><div class="official-ticker-group">${group}</div><div class="official-ticker-group">${group}</div></div></div>`;
}

function professionalHome(){
  return `<section class="view professional-home">
    <div class="professional-heading"><h1>Ish va xodim<br>topish <span>oson.</span></h1><p>Yangi ish. Kuchli jamoa.<br>Barchasi bir joyda.</p></div>
    ${professionalStage()}
    <div class="professional-intents" aria-label="Nima qidirmoqchisiz?">
      <button class="intent-button ${professionalScene===0?'is-current':''}" data-intent="hiring"><span class="intent-top">${icon('users')}${icon('arrow')}</span><strong>Xodim topish</strong></button>
      <button class="intent-button ${professionalScene===1?'is-current':''}" data-intent="career"><span class="intent-top">${icon('briefcase')}${icon('arrow')}</span><strong>Ish topish</strong></button>
    </div>
    <p class="impact-benefit">${icon('check')}Saytda e’lon joylash — bepul</p>
    ${professionalTicker()}
  </section>`;
}

function paintProfessionalScene(index){
  professionalScene=index;
  const stage=$('.professional-stage');if(!stage)return;
  stage.dataset.scene=professionalScenes[index].mode;
  stage.querySelectorAll('.professional-scene').forEach((element,i)=>element.classList.toggle('is-active',index===i));
  stage.querySelectorAll('.impact-card-layer .signal-card').forEach((element,i)=>element.classList.toggle('is-active',index===i));
  stage.querySelector('.scene-index').textContent=String(index+1).padStart(2,'0');
  document.querySelectorAll('.intent-button').forEach((element,i)=>element.classList.toggle('is-current',index===i));
}

function scheduleProfessionalScene(){
  clearTimeout(professionalTimer);
  if(state.screen!=='home'||reducedProfessionalMotion.matches||document.hidden||app.classList.contains('motion-paused')||app.classList.contains('focus-paused'))return;
  professionalTimer=setTimeout(()=>{paintProfessionalScene((professionalScene+1)%professionalScenes.length);scheduleProfessionalScene()},5200);
}

const renderBeforeProfessional=render;
render=function(){
  renderBeforeProfessional();clearInterval(sceneTimer);
  const oldNavigation=$('#bottom-nav');oldNavigation.replaceChildren();oldNavigation.hidden=true;
  app.dataset.screen=state.screen;
  if(state.screen!=='home')app.classList.remove('focus-paused');
  scheduleProfessionalScene();
};
const searchBeforeProfessional=screenRender.search;
screenRender.search=()=>`<div class="search-route-cta"><button class="secondary full" data-nav="${state.searchType==='resumes'?'vacancy':'resume'}">${icon(state.searchType==='resumes'?'plus':'file')}${state.searchType==='resumes'?'Vakansiya joylash':'Rezyume yaratish'}${icon('arrow')}</button></div>${searchBeforeProfessional()}`;
screenRender.home=professionalHome;

document.addEventListener('click',event=>{
  const intent=event.target.closest('[data-intent]');
  if(intent){window.dispatchEvent(new CustomEvent('ishdasiz:intent',{detail:{intent:intent.dataset.intent,placement:'hero',audience:campaignIntent||'all'}}));state.searchType=intent.dataset.intent==='hiring'?'resumes':'jobs';state.query='';state.region='Butun O‘zbekiston';navigate('search');return}
  const pause=event.target.closest('[data-motion-toggle]');if(!pause)return;
  const paused=app.classList.toggle('motion-paused');
  if(!paused)app.classList.remove('focus-paused');
  pause.setAttribute('aria-pressed',String(paused));
  pause.setAttribute('aria-label',paused?'Animatsiyani davom ettirish':'Animatsiyani to‘xtatish');
  pause.querySelector('path').setAttribute('d',paused?'m9 5 11 7-11 7Z':'M8 6v12M16 6v12');
  scheduleProfessionalScene();
});
document.addEventListener('pointerover',event=>{const button=event.target.closest('[data-intent]');if(button&&!reducedProfessionalMotion.matches){paintProfessionalScene(button.dataset.intent==='hiring'?0:1);scheduleProfessionalScene()}});
document.addEventListener('focusin',event=>{const button=event.target.closest('[data-intent]');if(button&&!reducedProfessionalMotion.matches)paintProfessionalScene(button.dataset.intent==='hiring'?0:1);if(event.target.closest('.professional-home')){app.classList.add('focus-paused');clearTimeout(professionalTimer)}});
document.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest('.professional-home')){app.classList.remove('focus-paused');scheduleProfessionalScene()}});
document.addEventListener('visibilitychange',scheduleProfessionalScene);
reducedProfessionalMotion.addEventListener('change',scheduleProfessionalScene);
const pointerDepth=matchMedia('(hover:hover) and (pointer:fine)');
document.addEventListener('pointermove',event=>{
  if(!pointerDepth.matches||reducedProfessionalMotion.matches||app.classList.contains('motion-paused'))return;
  const stage=event.target.closest('.professional-stage');if(!stage)return;
  const bounds=stage.getBoundingClientRect();
  stage.style.setProperty('--scene-x',`${(event.clientX-bounds.left-bounds.width/2)*.012}deg`);
  stage.style.setProperty('--scene-y',`${-(event.clientY-bounds.top-bounds.height/2)*.008}deg`);
});
document.addEventListener('pointerout',event=>{const stage=event.target.closest('.professional-stage');if(stage&&!stage.contains(event.relatedTarget)){stage.style.setProperty('--scene-x','0deg');stage.style.setProperty('--scene-y','0deg')}});
navigate(state.screen,{step:state.step});
