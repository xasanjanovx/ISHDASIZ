/* Fresh UI prototype. All search/form/order data remains local demonstration data. */
state.layout='flow';state.theme=localStorage.getItem('ishdasiz-fresh-theme')||'light';state.region='Butun O‘zbekiston';

const flow=flowInitialize();
formSteps.resume.length=4;
if(['review','done','applications'].includes(params.get('screen')))state.screen=params.get('screen');
flowSyncAllowance();
const freshReduced=matchMedia('(prefers-reduced-motion:reduce)');
let freshMotion=localStorage.getItem('ishdasiz-fresh-motion')!=='off',freshTimer,modalTrigger;
const freshColors=['#4668ee','#e99356','#39a9be','#7960de','#e98676','#bd77af','#5da58c','#568acb'];
const freshScenes=professions.map((p,i)=>({name:p[0],image:p[1],color:freshColors[i]}));
const freshCampaign=['hiring','career'].includes(params.get('audience'))?params.get('audience'):null;
const freshCampaignParams=[...params].filter(([key])=>key==='audience'||key.startsWith('utm_'));
if(state.screen==='search'&&freshCampaign)state.searchType=freshCampaign==='hiring'?'resumes':'jobs';
if(params.get('screen')==='settings')state.screen='settings';

function freshTitle(text,back='home',description=''){
  return `<div class="fresh-page-title"><button class="fresh-back" data-nav="${back}" aria-label="Orqaga">${icon('back')}</button><div><h1>${text}</h1>${description?`<p>${description}</p>`:''}</div></div>`;
}
function freshFree(compact=false){
  return `<button class="fresh-free ${compact?'compact':''}" data-create aria-label="Saytda bepul e’lon yaratish"><span><b>Saytda doim bepul</b><small>Vakansiya va rezyume joylash</small></span><strong>0<small>so‘m</small></strong><span class="free-arrow">${icon('arrow')}</span></button>`;
}
function freshHero(){
  const current=freshScenes[state.scene];
  return `<div class="fresh-stage" data-scene="${state.scene}" style="--scene-color:${current.color}" role="region" aria-label="Kasblar galereyasi">
    <div class="fresh-stage-panel" aria-hidden="true"></div><div class="fresh-stage-orbit" aria-hidden="true"></div>
    <div class="fresh-word" aria-hidden="true">${letterWord(current.name)}</div>
    <div class="fresh-portraits" aria-hidden="true">${freshScenes.map((scene,i)=>`<div class="fresh-portrait ${i===state.scene?'active':''}"><img src="assets/${scene.image}" alt="" width="1024" height="1536" ${i===0?'fetchpriority="high"':''}></div>`).join('')}</div>
    <svg class="fresh-wires" viewBox="0 0 350 240" fill="none" aria-hidden="true"><path class="fresh-wire" d="M15 170C70 170 72 76 150 62S250 76 330 35M30 215C114 210 180 225 255 184S300 111 343 110"/><path class="fresh-wire-pulse" pathLength="1" d="M15 170C70 170 72 76 150 62S250 76 330 35M30 215C114 210 180 225 255 184S300 111 343 110"/><circle cx="15" cy="170" r="4"/><circle cx="343" cy="110" r="4"/></svg>
    <div class="fresh-scene-controls"><span class="fresh-scene-count">${String(state.scene+1).padStart(2,'0')} <small>/ 08</small></span><button data-fresh-prev aria-label="Oldingi kasb">${icon('back')}</button><button data-fresh-next aria-label="Keyingi kasb">${icon('right')}</button></div>
  </div>`;
}
function studioObject(kind){
  return kind==='vacancy'?'<span class="studio-case" aria-hidden="true"><i class="case-handle"></i><i class="case-body"></i><i class="case-flap"></i><i class="case-lock"></i></span>':'<span class="studio-document" aria-hidden="true"><i class="document-back"></i><i class="document-page"><b></b><em></em><em></em><em></em></i><i class="document-seal">'+icon('check')+'</i></span>';
}
function studioCreateTiles(){
  return `<div class="flow-posting"><button class="studio-create-tile hiring" data-flow-start="vacancy"><span class="studio-tile-top"><small>Ish beruvchilar uchun</small><span class="studio-tile-plus">${icon('plus')}</span></span>${studioObject('vacancy')}<strong>Xodim<br>izlash</strong><span class="studio-tile-bottom"><small>Vakansiya joylash</small>${icon('right')}</span></button><button class="studio-create-tile career" data-flow-start="resume"><span class="studio-tile-top"><small>Ish izlovchilar uchun</small><span class="studio-tile-plus">${icon('plus')}</span></span>${studioObject('resume')}<strong>Ish<br>topish</strong><span class="studio-tile-bottom"><small>Rezyume yaratish</small>${icon('right')}</span></button></div>`;
}
function freshHome(){
  return `<section class="view flow-home"><div class="flow-hero">${flowHeroMessage()}<div class="flow-hero-visual">${freshHero()}</div></div>${studioCreateTiles()}${discoveryHomeMap()}${flowHomeAccount()}</section>`;
}
function freshSearch(){
  return `<section class="view fresh-results flow-search">${freshTitle(state.searchType==='resumes'?'Xodim topish':'Ish topish')}<div class="tabs"><button class="${state.searchType==='jobs'?'active':''}" data-search-type="jobs">Vakansiyalar</button><button class="${state.searchType==='resumes'?'active':''}" data-search-type="resumes">Rezyumelar</button></div><form id="results-search" class="fresh-search-form"><label>${icon('search')}<input id="flow-query" name="query" aria-label="Qidiruv" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" placeholder="Lavozim yoki kompaniya" value="${esc(state.query)}" autocomplete="off" maxlength="120" data-flow-combo="query"></label><button type="submit" aria-label="Qidirish">${icon('right')}</button></form><div class="fresh-search-tools"><button data-filter="region">${icon('pin')}${esc(state.region)}</button><button data-filter="all">${icon('filter')}Filtr${flow.salaryFrom||flow.salaryTo||flow.salaryFilterPeriod?' · 1':''}</button></div><div id="flow-results" aria-live="polite">${flowResults()}</div></section>`;
}
function freshForm(){
  const steps=formSteps[state.kind];state.step=Math.min(state.step,steps.length-1);const [heading]=steps[state.step];
  const stageKey=state.kind+':'+state.step+':'+flow.activeId,entering=flow.formStage!==stageKey;flow.formStage=stageKey;
  return `<section class="view fresh-form ${entering?'stage-enter':''}">${freshTitle(state.kind==='vacancy'?'Vakansiya joylash':'Rezyume joylash')}<div class="flow-step-heading"><span>${state.step+1}<small> / ${steps.length}</small></span><b>${heading}</b>${polishPublicationNote()}</div><div class="step-track" aria-label="${state.step+1} / ${steps.length} qadam">${steps.map((_,i)=>`<i class="${i<=state.step?'done':''}"></i>`).join('')}</div>${journeyIntro()}<div class="form-surface"><div class="fields">${formContent()}</div></div><div class="form-footer"><button class="secondary" data-step="back">${icon('back')}<span>Orqaga</span></button><button class="primary" data-step="next">${state.step===steps.length-1?'Ko‘rib chiqish':'Davom etish'}<span class="studio-button-end">${icon('right')}</span></button></div></section>`;
}
function freshProfile(){
  return `<section class="view fresh-profile">${freshTitle('Shaxsiy kabinet')}<div class="studio-identity"><span class="studio-identity-avatar">${state.loggedIn?esc((state.form.resume.name||'I').slice(0,1)):icon('user')}<i>${icon('check')}</i></span><div><h2>${state.loggedIn?esc(state.form.resume.name||'Xush kelibsiz'):'Sizning profilingiz'}</h2><p>${state.loggedIn?esc(state.phone):'Ish va xodim uchun bitta profil'}</p></div></div>${state.loggedIn?'':`<button class="primary full studio-profile-login" data-nav="auth">${icon('phone')}Profilga kirish<span class="studio-button-end">${icon('right')}</span></button>`}${flowProfileStats()}<div class="studio-section-label"><h2>Yangi e’lon</h2><span>Saytda bepul</span></div>${studioCreateTiles()}<div class="studio-section-label"><h2>Mening e’lonlarim</h2></div><div class="studio-profile-list"><button data-fresh-list="resumes"><span class="studio-list-mark resume">${icon('file')}</span><span><b>Rezyumelarim</b></span>${icon('right')}</button><button data-fresh-list="jobs"><span class="studio-list-mark vacancy">${icon('briefcase')}</span><span><b>Vakansiyalarim</b></span>${icon('right')}</button></div><div class="fresh-menu-list">${[['send','Arizalarim','applications'],['bell','Bildirishnomalar','notifications'],['filter','Sozlamalar','settings']].map(([ic,label,route])=>`<button ${route==='notifications'?'data-notifications':`data-nav="${route}"`}>${icon(ic)}<span>${label}</span>${icon('right')}</button>`).join('')}</div>${state.loggedIn?`<button class="text-button full" data-flow-account>Boshqa raqam bilan kirish</button>`:""}</section>`;
}
function freshListings(){
  const records=flowOwnRecords().filter(record=>!record.archived&&(state.listTab==='all'||record.kind===(state.listTab==='jobs'?'vacancy':'resume')));
  return `<section class="view">${freshTitle('Mening e’lonlarim','profile')}<button class="primary full flow-new-listing" data-create>${icon('plus')}E’lon joylash</button><div class="tabs"><button class="${state.listTab==='all'?'active':''}" data-list-tab="all">Barchasi</button><button class="${state.listTab==='jobs'?'active':''}" data-list-tab="jobs">Vakansiya</button><button class="${state.listTab==='resumes'?'active':''}" data-list-tab="resumes">Rezyume</button></div>${records.map(record=>`<article class="fresh-listing"><div class="fresh-listing-top"><span class="fresh-company-icon ${record.kind==='resume'?'mint':''}">${icon(record.kind==='resume'?'file':'briefcase')}</span><span class="fresh-status">${record.kind==='resume'?'Rezyume bazasi':record.channel?'Sayt + kanal ko‘rinishi':'Saytdagi ko‘rinish'}</span></div><h2>${esc(record.position)}</h2><p>${esc(record.kind==='vacancy'?record.company:record.name)} · ${esc(record.region)}</p><strong class="fresh-listing-free">${flowSalaryLabel(record)}</strong>${record.kind==='resume'?flowResumeStats(record):`<button class="secondary full flow-candidate-link" data-flow-candidates="${esc(record.id)}">${icon('users')}Mos xodimlar ${icon('right')}</button>`}${record.kind==='vacancy'?`<button class="primary full" data-flow-repost="${esc(record.id)}">Kanalga joylash ${icon('send')}</button>`:''}<div class="fresh-edit-actions"><button data-flow-edit-record="${esc(record.id)}">${icon('edit')}Tahrirlash</button><button data-flow-archive="${esc(record.id)}">${icon('trash')}Olib tashlash</button></div></article>`).join('')||`<div class="fresh-empty">${icon('file')}<h2>Hali e’lon yo‘q</h2><button class="secondary full" data-create>E’lon joylash</button></div>`}</section>`;
}
function freshTariffs(){state.kind='vacancy';
  return `<section class="view fresh-tariffs">${freshTitle('Kanal tariflari','review')}
    <div class="tabs"><button class="${state.kind==='vacancy'?'active':''}" data-tariff-kind="vacancy">Vakansiya</button></div>

    <div class="plans">${plans.map((plan,index)=>`<button class="plan ${state.selectedPlan===index?'selected':''}" data-plan="${index}" aria-pressed="${state.selectedPlan===index}"><span class="plan-radio">${state.selectedPlan===index?icon('check'):''}</span><span class="plan-duration">${plan.days}<small>${plan.count} ta post · har kuni</small>${plan.pin?'<em>Zakrep sovg‘a</em>':''}</span><span class="plan-prices"><strong>${money(tariffPrice(plan))}</strong><small>so‘m</small></span></button>`).join('')}</div>
    <div class="fresh-site-note">${icon('check')}Saytga joylash bepul. Tarif — kanal uchun.</div>

    <section class="broadcast-choice"><button class="toggle-row ${state.broadcast?'active':''}" data-broadcast-toggle role="switch" aria-checked="${state.broadcast}"><span class="toggle"></span><span class="toggle-copy">Botda tarqatma<small>Alohida xizmat, obuna bo‘lgan auditoriyaga</small></span></button>${state.broadcast?`<div class="broadcast-config"><label><input type="radio" name="audience" value="all" ${state.broadcastTarget==='all'?'checked':''}>Barcha obunachilar</label><label><input type="radio" name="audience" value="regions" ${state.broadcastTarget==='regions'?'checked':''}>Tanlangan hududlar</label><p class="subtext">Narx alohida kelishiladi.</p></div>`:''}</section></section>`;
}
function freshAuth(){
  return `<section class="view fresh-auth">${freshTitle('Profilga kirish','profile')}<div class="fresh-auth-intro"><span>${icon('phone')}</span><h2>Bitta raqam.<br>Barcha imkoniyatlar.</h2></div><div class="form-surface"><form id="phone-form"><label class="field"><span>Telefon raqamingiz</span><span class="auth-phone"><b>+998</b><input id="phone-value" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="90 123 45 67" maxlength="17" aria-label="Telefon raqami" required></span></label><button type="submit" class="primary full">Davom etish ${icon('right')}</button></form><button class="secondary full" data-telegram-contact>${icon('send')}Telegram raqamim bilan</button></div><p class="auth-sample">Demo: SMS yuborilmaydi.</p></section>`;
}
function freshSettings(){
  return `<section class="view">${freshTitle('Sozlamalar','profile')}<div class="fresh-settings-card"><div class="fresh-setting-row"><span><b>Tungi rejim</b></span><button class="fresh-switch ${state.theme==='dark'?'on':''}" data-fresh-theme role="switch" aria-checked="${state.theme==='dark'}" aria-label="Tungi rejim"><i></i></button></div><div class="fresh-setting-row"><span><b>Animatsiyalar</b></span><button class="fresh-switch ${freshMotion?'on':''}" data-fresh-motion role="switch" aria-checked="${freshMotion}" aria-label="Animatsiyalar"><i></i></button></div><button class="fresh-language-row" data-fresh-language><span><b>Til</b><small>O‘zbekcha</small></span>${icon('right')}</button></div></section>`;
}
function freshPreview(){
  const draft=state.form[state.kind],resume=state.kind==='resume';if(resume)return discoveryReview();
  const media=!resume&&flow.media?`<div class="flow-user-media">${flow.media.type.startsWith('video/')?`<video src="${esc(flow.media.url)}" controls playsinline></video>`:`<img src="${esc(flow.media.url)}" alt="Tanlangan foto">`}</div>`:!resume&&state.orderPaid?`<div class="media-cover"><img src="assets/profession-salesperson-v1.webp" alt="Muqova namunasi"><strong class="cover-title">${esc(draft.position)}</strong>${flow.logo?`<img class="flow-cover-logo" src="${esc(flow.logo.url)}" alt="Kompaniya logotipi">`:''}</div>`:'';
  return `<section class="view fresh-post-preview">${freshTitle('Kanal posti','review')}<article class="fresh-telegram-post"><header><span>${icon('send')}</span><div><strong>@ishdasiz</strong><small>${resume?'Rezyume':'Vakansiya'}</small></div></header>${media}<div class="fresh-post-copy"><h2>${esc(draft.position||'Lavozim')}</h2><p>${esc(resume?draft.name:draft.company)}</p><strong>${flowSalaryLabel(draft)}</strong><p>${esc(draft.region)} · ${esc(draft.experience||'')}</p><p>${esc(resume?draft.skills:draft.description)}</p></div></article>${!resume?`<div class="media-actions"><button class="secondary" data-upload="media">${icon('image')}Foto / video</button>${state.orderPaid?`<button class="secondary" data-upload="logo">${icon('plus')}Logo</button>`:''}</div>`:''}<button class="primary full flow-preview-back" data-nav="review">Joylashga qaytish ${icon('right')}</button></section>`;
}
function freshMenu(){
  modal(`<div class="fresh-sheet-title"><h2>Menyu</h2></div><div class="studio-menu-create"><button data-flow-start="vacancy">${icon('briefcase')}<span>Vakansiya joylash</span>${icon('plus')}</button><button data-flow-start="resume">${icon('file')}<span>Rezyume joylash</span>${icon('plus')}</button></div><div class="fresh-menu-list">${[['home','Asosiy sahifa','home'],['user','Shaxsiy kabinet','profile'],['file','Mening e’lonlarim','listings'],['send','Arizalarim','applications'],['filter','Sozlamalar','settings']].map(([ic,label,route])=>`<button data-nav="${route}">${icon(ic)}<span>${label}</span>${icon('right')}</button>`).join('')}</div>`);
  $('#modal-root .modal').setAttribute('aria-label','Menyu');
}

const freshBaseRender=render,freshBaseNavigate=navigate,freshBaseModal=modal,freshBaseClose=closeModal;
modal=function(html){modalTrigger=document.activeElement;freshBaseModal(html);app.classList.add('sheet-open');$('#content').inert=true;$('.app-header').inert=true;$('#action-bar').inert=true;scheduleFreshScene()};
closeModal=function(){freshBaseClose();app.classList.remove('sheet-open');$('#content').inert=false;$('.app-header').inert=false;$('#action-bar').inert=false;if(modalTrigger?.isConnected)modalTrigger.focus();modalTrigger=null;scheduleFreshScene()};
navigate=function(screen,options={}){freshBaseNavigate(screen,options);if(freshCampaignParams.length){const url=new URL(location.href);for(const [key,value]of freshCampaignParams)url.searchParams.set(key,value);history.replaceState(null,'',url)}};
render=function(){freshBaseRender();clearInterval(sceneTimer);$('#bottom-nav').replaceChildren();$('#bottom-nav').hidden=true;app.dataset.screen=state.screen;app.classList.toggle('motion-disabled',!freshMotion);app.classList.add('fresh-ready');scheduleFreshScene()};
function scheduleFreshScene(){clearTimeout(freshTimer);const paused=document.hidden||app.classList.contains('sheet-open')||app.classList.contains('focus-paused');app.classList.toggle('home-motion-paused',paused);if(state.screen!=='home'||!freshMotion||freshReduced.matches||paused)return;freshTimer=setTimeout(()=>{setFreshScene((state.scene+1)%freshScenes.length);scheduleFreshScene()},4800)}
function setFreshScene(index){flowSyncHero(index);state.scene=(index+freshScenes.length)%freshScenes.length;const stage=$('.fresh-stage');if(!stage)return;stage.dataset.scene=String(state.scene);stage.style.setProperty('--scene-color',freshScenes[state.scene].color);stage.querySelector('.fresh-word').innerHTML=letterWord(freshScenes[state.scene].name);stage.querySelectorAll('.fresh-portrait').forEach((el,i)=>el.classList.toggle('active',i===state.scene));stage.querySelector('.fresh-scene-count').innerHTML=String(state.scene+1).padStart(2,'0')+' <small>/ 08</small>'}

Object.assign(screenRender,{applications:flowApplications,review:flowReview,done:flowDone,home:freshHome,search:freshSearch,vacancy:freshForm,resume:freshForm,profile:freshProfile,listings:freshListings,plans:freshTariffs,auth:freshAuth,settings:freshSettings,preview:freshPreview});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-fresh-menu')){freshMenu();return}
  if(button.dataset.homePlans){state.orderPaid=false;navigate('plans',{kind:button.dataset.homePlans});return}
  if(button.dataset.freshIntent){state.searchType=button.dataset.freshIntent==='hiring'?'resumes':'jobs';state.query='';state.region='Butun O‘zbekiston';window.dispatchEvent(new CustomEvent('ishdasiz:intent',{detail:{intent:button.dataset.freshIntent,audience:freshCampaign||'all'}}));navigate('search');return}
  if(button.hasAttribute('data-fresh-prev')||button.hasAttribute('data-fresh-next')){setFreshScene(state.scene+(button.hasAttribute('data-fresh-next')?1:-1));scheduleFreshScene();return}
  if(button.dataset.freshList){state.listTab=button.dataset.freshList;navigate('listings');return}
  if(button.hasAttribute('data-fresh-reset')){state.query='';state.region='Butun O‘zbekiston';navigate('search');return}
  if(button.hasAttribute('data-fresh-theme')){$('#theme').click();localStorage.setItem('ishdasiz-fresh-theme',state.theme);render();return}
  if(button.hasAttribute('data-fresh-motion')){freshMotion=!freshMotion;localStorage.setItem('ishdasiz-fresh-motion',freshMotion?'on':'off');render();return}
  if(button.hasAttribute('data-fresh-language')){$('#language').click();return}
});
document.addEventListener('focusin',event=>{if(event.target.closest('.flow-home')&&event.target.matches(':focus-visible')){app.classList.add('focus-paused');scheduleFreshScene()}});
document.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest('.flow-home')){app.classList.remove('focus-paused');scheduleFreshScene()}});
document.addEventListener('visibilitychange',scheduleFreshScene);freshReduced.addEventListener('change',scheduleFreshScene);
window.ISHDASIZFresh={state,navigate,setFreshScene,get motion(){return freshMotion}};
navigate(state.screen,{step:state.step});

const studioBaseRender=render;
render=function(){
  studioBaseRender();
  if(['vacancy','resume'].includes(state.screen)){
    const footer=document.querySelector('#content .form-footer');
    if(footer)document.querySelector('#action-bar').append(footer);
  }
};
render();
const studioPointer=matchMedia('(hover:hover) and (pointer:fine)');
document.addEventListener('pointermove',event=>{
  if(!studioPointer.matches||!freshMotion||freshReduced.matches)return;
  const tile=event.target.closest('.studio-create-tile');if(!tile)return;
  const box=tile.getBoundingClientRect();
  tile.style.setProperty('--tilt-x',`${(event.clientY-box.top-box.height/2)/box.height*-6}deg`);
  tile.style.setProperty('--tilt-y',`${(event.clientX-box.left-box.width/2)/box.width*6}deg`);
});
document.addEventListener('pointerout',event=>{const tile=event.target.closest('.studio-create-tile');if(tile&&!tile.contains(event.relatedTarget)){tile.style.removeProperty('--tilt-x');tile.style.removeProperty('--tilt-y')}});

/* Shared interactions. connected-features.js owns production actions; local fixtures require an explicit QA flag. */
function flowRead(key,fallback,store=sessionStorage){try{return JSON.parse(store.getItem(key))??fallback}catch{return fallback}}
function flowWrite(key,value,store=sessionStorage){try{store.setItem(key,JSON.stringify(value))}catch{/* The current page remains usable without browser storage. */}}
function flowId(){return crypto.randomUUID?.()||'demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function flowInitialize(){
  const defaults=structuredClone(state.form);for(const kind of ['vacancy','resume'])for(const key of ['position','company','name','salaryMin','salaryMax','description','skills','phone','telegram'])if(key in defaults[kind])defaults[kind][key]='';
  const draft=miniLive()?null:flowRead('ishdasiz-v12-draft',null),account=miniLive()?null:flowRead('ishdasiz-v12-account',null);
  if(draft?.form?.vacancy&&draft?.form?.resume)state.form=draft.form;
  else{for(const kind of ['vacancy','resume'])for(const key of ['position','company','name','salaryMin','salaryMax','description','skills','phone','telegram'])if(key in state.form[kind])state.form[kind][key]='';}
  if(account&&/^\+998\d{9}$/.test(account.phone)){state.phone=account.phone;state.loggedIn=true;}
  const formScreen=['vacancy','resume'].includes(params.get('screen'));
  if(!formScreen&&['vacancy','resume'].includes(draft?.kind))state.kind=draft.kind;
  if(['vacancy','resume'].includes(params.get('kind')))state.kind=params.get('kind');
  const continuing=draft&&!(formScreen&&(draft.kind!==state.kind||draft.confirmedTx===draft.tx));
  if(continuing&&!params.has('step')&&formScreen&&Number.isInteger(draft.step))state.step=Math.max(0,Math.min(draft.step,6));
  state.orderPaid=!!(continuing&&draft.paid&&draft.paidTx===draft.tx&&draft.kind===state.kind);
  if(continuing&&Number.isInteger(draft.plan)&&draft.plan>=0&&draft.plan<plans.length)state.selectedPlan=draft.plan;
  if(continuing&&draft.schedule){state.startDate=draft.schedule.startDate||state.startDate;state.scheduleMode=draft.schedule.mode||'same';state.scheduleTime=draft.schedule.time||'18:00';state.dailyTimes=draft.schedule.dailyTimes||{};}
  return {legacyPayContact:!!(continuing&&!draft.payLayout&&formScreen&&!params.has('step')&&draft.step===(state.kind==='vacancy'?5:3)),salaryAmounts:continuing?draft.salaryAmounts||{}:{},defaults,activeId:continuing?draft.activeId||flowId():flowId(),tx:continuing?draft.tx||flowId():flowId(),channel:continuing?draft.channel!==false:true,confirmedTx:continuing?draft.confirmedTx||null:null,lastId:flowRead('ishdasiz-v12-last',''),pendingAuth:draft?.pendingAuth||null,pendingApplication:draft?.pendingApplication||null,switchAccount:false,priceTarget:'review',salaryFrom:'',salaryTo:'',preselectedPaid:!!(continuing&&draft.preselectedPaid),confirming:false};
}
function flowSaveDraft(){flowWrite('ishdasiz-v12-draft',{payLayout:1,salaryAmounts:flow.salaryAmounts||{},form:state.form,kind:state.kind,step:state.step,activeId:flow.activeId,tx:flow.tx,channel:flow.channel,confirmedTx:flow.confirmedTx,pendingAuth:flow.pendingAuth,pendingApplication:flow.pendingApplication,paid:state.orderPaid,paidTx:flow.tx,plan:state.selectedPlan,preselectedPaid:flow.preselectedPaid,schedule:{startDate:state.startDate,mode:state.scheduleMode,time:state.scheduleTime,dailyTimes:state.dailyTimes}});}
function flowAccount(){return state.loggedIn?state.phone.replace(/\D/g,''):'guest'}
function flowAllowances(){return flowRead('ishdasiz-v12-allowances',{},localStorage)}
function flowFree(kind){return kind==='resume'||!flowAllowances()[flowAccount()]?.[kind]}
function flowSyncAllowance(){state.freeResumeUsed=!flowFree('resume');state.freeVacancyUsed=!flowFree('vacancy')}
function flowRecords(){return flowRead('ishdasiz-v12-records',[]).filter(v=>v&&typeof v.id==='string')}
function flowOwnRecords(){return flowRecords().filter(v=>v.account===flowAccount())}
function flowClearMedia(){for(const key of ['media','logo']){if(flow[key]?.url)URL.revokeObjectURL(flow[key].url);flow[key]=null;}}
function flowBegin(kind,siteOnly=false,skipPrice=false){
  if(kind==='resume')siteOnly=true;state.kind=kind;state.orderPaid=false;flow.discoveryPartial=false;flowSyncAllowance();
  flowClearMedia();flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=false;flow.preselectedPaid=skipPrice;flow.pendingAuth=null;flow.pendingApplication=null;
  navigate(kind);flowSaveDraft();
}
function flowPrices(kind){
  flowCloseCombo();if(kind==='resume'){flow.channel=false;navigate('review');return;}state.kind=kind;
  modal(`<h2>Kanalga joylash</h2><div class="flow-price-options">${plans.map((p,index)=>`<button data-flow-plan="${index}"><span>${p.days}<small>${p.count} ta post${p.pin?' · Zakrep sovg‘a':''}</small></span><b>${money(kind==='resume'?p.resumePrice:p.price)}<small>so‘m</small></b>${icon('right')}</button>`).join('')}</div><button class="secondary full" data-flow-site-only>Saytga bepul joylash</button>`);
}
function flowReview(){return discoveryReview();}
function flowDone(){return discoveryDone();}
function flowViewStats(record){
  const events=flowRead('ishdasiz-v12-resume-events',{}),value=events[record.id]||{};
  return {views:Array.isArray(value.views)?value.views.length:0,contacts:Array.isArray(value.contacts)?value.contacts.length:0};
}
function flowTrackResume(record,event){
  if(!record||record.sample||record.kind!=='resume'||record.account===flowAccount()||!['views','contacts'].includes(event))return;
  let visitor=flowRead('ishdasiz-v12-visitor',null);if(!visitor){visitor=flowId();flowWrite('ishdasiz-v12-visitor',visitor);}
  const events=flowRead('ishdasiz-v12-resume-events',{}),stats=events[record.id]||{views:[],contacts:[]};
  const seen=new Set(Array.isArray(stats[event])?stats[event]:[]);seen.add(visitor);stats[event]=[...seen];events[record.id]=stats;flowWrite('ishdasiz-v12-resume-events',events);
}
function flowStatsMarkup(views,contacts){
  return `<div class="flow-resume-stats" aria-label="Rezyume statistikasi"><div>${icon('eye')}<strong>${money(views)}</strong><span>Ko‘rishlar</span></div><div>${icon('phone')}<strong>${money(contacts)}</strong><span>Kontakt ochilishi</span></div></div>`;
}
function flowResumeStats(record){const stats=flowViewStats(record);return flowStatsMarkup(stats.views,stats.contacts);}
function flowProfileStats(){
  if(!state.loggedIn)return '';const records=flowOwnRecords().filter(r=>r.kind==='resume'&&!r.archived);if(!records.length)return '';
  const total=records.reduce((sum,r)=>{const stats=flowViewStats(r);return {views:sum.views+stats.views,contacts:sum.contacts+stats.contacts};},{views:0,contacts:0});
  return `<section class="flow-profile-stats"><h2>Rezyumelarim natijasi</h2>${flowStatsMarkup(total.views,total.contacts)}</section>`;
}
function flowPositionTerms(value){
  const title=flowNormalize(value);if(!title)return new Set();
  const catalog=window.ISHDASIZ_POSITIONS||[],definition=catalog.find(p=>(' '+flowNormalize(p.aliases)+' ').includes(' '+title+' '))||catalog.find(p=>flowNormalize(p.title)===title);
  return new Set([definition?flowNormalize(definition.title):title]);
}
function flowCandidates(vacancy){return discoveryMatches({...vacancy,kind:'vacancy'});}
function flowCandidateSection(vacancy){return discoveryCandidateSection(vacancy);}
function flowPublish(){
  polishInferCurrent();state.form[state.kind].salaryPeriod=payPeriod(state.form[state.kind]);state.form[state.kind].salaryCurrency||='UZS';
  if(state.kind==='resume'){flow.channel=false;state.orderPaid=false;}
  if(flow.confirming)return;
  if(flow.confirmedTx===flow.tx){navigate('done');return;}
  if(!flowValidateAll())return;
  if(!state.loggedIn){flow.pendingAuth='review';flowSaveDraft();navigate('auth');return;}
  flowSyncAllowance();
  if(flow.channel&&!flowFree(state.kind)&&!state.orderPaid){flow.priceTarget='review';flowPrices(state.kind);return;}
  flow.confirming=true;
  const record={...state.form[state.kind],id:flow.activeId,kind:state.kind,account:flowAccount(),phone:state.form[state.kind].phone||state.phone,channel:flow.channel,channelPaid:flow.channel&&state.orderPaid,createdAt:new Date().toISOString()};
  const records=flowRecords(),index=records.findIndex(v=>v.id===record.id);if(index<0)records.unshift(record);else records[index]={...records[index],...record};
  if(flow.channel&&!state.orderPaid){const allowances=flowAllowances();allowances[flowAccount()]={...allowances[flowAccount()],[state.kind]:true};flowWrite('ishdasiz-v12-allowances',allowances,localStorage);}
  flowWrite('ishdasiz-v12-records',records);if(record.kind==='vacancy'&&record.channel)discoveryGrant(record);flow.lastId=record.id;flow.confirmedTx=flow.tx;flowWrite('ishdasiz-v12-last',record.id);flowSaveDraft();flow.confirming=false;flowSyncAllowance();navigate('done');
}
function flowNormalize(value){
  const map={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh','ы':'i','э':'e','ю':'yu','я':'ya','ў':'o','қ':'q','ғ':'g','ҳ':'h','ь':'','ъ':''};
  return String(value||'').toLowerCase().replace(/[‘’ʻʼ'`]/g,'').replace(/[а-яёўқғҳ]/g,c=>map[c]??c).replace(/[^a-z0-9]+/g,' ').trim();
}
function flowNumber(value){const n=Number(String(value||'').replace(/[^\d.]/g,''));return Number.isFinite(n)?n:0}
function flowRegionKey(value){const key=flowNormalize(value);if(key.startsWith('toshkent'))return key.includes('viloyat')?'toshkent-viloyati':'toshkent-shahri';return key.replace(/viloyati|shahri|respublikasi/g,'').trim()}
function flowSalaryLabel(d){if(d.salaryNegotiable)return 'Kelishiladi';const low=flowNumber(d.salaryMin),high=flowNumber(d.salaryMax);return low||high?`${low?money(low):''}${low&&high?' — ':''}${high?money(high):''} ${payUnit(d)}`:esc(d.salary||'Kelishiladi')}
function flowSampleJobs(){return jobs.map((j,i)=>({...j,id:'sample-job-'+i,kind:'vacancy',position:j.title,salaryMin:[4000000,5000000,6000000][i],salaryMax:[6000000,8000000,9000000][i],employment:j.mode,workMode:'Ish joyida',sample:true}))}
function flowSearchRecords(){
  const sampleCV={id:'sample-resume',kind:'resume',position:'Sotuvchi',name:'Namuna nomzod',salaryMin:4000000,region:'Toshkent shahri',employment:'To‘liq kun',workMode:'Ish joyida',experience:'1–3 yil',sample:true};
  return [...flowRecords().filter(v=>!v.archived),...flowSampleJobs(),sampleCV];
}
function flowMatches(record){
  const q=flowNormalize(state.query),title=record.position||record.title||'',definition=(window.ISHDASIZ_POSITIONS||[]).find(v=>flowNormalize(v.title)===flowNormalize(title));
  const text=flowNormalize(title+' '+(record.company||record.name||'')+' '+(definition?.aliases||''));
  if(q&&!q.split(' ').every(term=>text.includes(term)))return false;
  if(state.region!=='Butun O‘zbekiston'&&flowRegionKey(state.region)!==flowRegionKey(record.region))return false;
  const low=flowNumber(record.salaryMin),high=flowNumber(record.salaryMax)||low;
  if(flow.salaryFilterPeriod&&payPeriod(record)!==flow.salaryFilterPeriod)return false;
  if((flow.salaryFrom||flow.salaryTo)&&(record.salaryCurrency||'UZS')!=='UZS')return false;
  if(flow.salaryFrom&&high<flowNumber(flow.salaryFrom))return false;
  if(flow.salaryTo&&low>flowNumber(flow.salaryTo))return false;
  return true;
}
function discoveryOriginalResults(){
  const resume=state.searchType==='resumes',records=flowSearchRecords().filter(v=>v.kind===(resume?'resume':'vacancy')&&flowMatches(v));
  const create=`<button class="fresh-inline-create" data-flow-start="${resume?'vacancy':'resume'}">${icon('plus')}<span>${resume?'Vakansiya joylash':'Rezyume joylash'}</span>${icon('right')}</button>`;
  return create+`<p class="fresh-result-caption">${records.length} ta ${resume?'rezyume':'vakansiya'}</p>`+records.map(record=>`<article class="fresh-result-card"><div class="fresh-card-header"><span class="fresh-company-icon ${resume?'mint':''}">${icon(resume?'user':'briefcase')}</span><div><p>${esc(record.company||record.name||'')}${record.sample?' · Namuna':''}</p><h2>${esc(record.position||record.title)}</h2></div>${!resume?`<button class="fresh-save ${flowRead('ishdasiz-v12-saved',[]).includes(record.id)?'saved':''}" data-flow-save="${esc(record.id)}" aria-label="Vakansiyani saqlash" aria-pressed="${flowRead('ishdasiz-v12-saved',[]).includes(record.id)}">${icon('bookmark')}</button>`:''}</div><p class="fresh-salary">${flowSalaryLabel(record)}</p><p class="fresh-location">${icon('pin')}${esc(record.region)}</p><div class="fresh-tags"><span>${esc(record.employment||record.mode||'To‘liq kun')}</span><span>${esc(record.experience||'')}</span></div><button class="secondary full" data-flow-detail="${esc(record.id)}">${resume?'Rezyumeni ko‘rish':'Batafsil'} ${icon('right')}</button></article>`).join('')+(records.length?'':`<div class="fresh-empty">${icon('search')}<h2>E’lon topilmadi</h2><button class="secondary full" data-flow-reset>Barchasini ko‘rish</button></div>`);
}
function flowResults(){return discoveryResults();}
function flowSearchUpdate(){const results=$('#flow-results');if(results)results.innerHTML=flowResults()}
function flowDetails(id){return discoveryDetails(id);}
function flowFilters(){
  modal(`<h2>Filtrlar</h2><div class="fields"><label class="field"><span>Hudud</span><select id="filter-region">${['Butun O‘zbekiston',...regions].map(r=>`<option ${r===state.region?'selected':''}>${r}</option>`).join('')}</select></label><label class="field"><span>To‘lov davri</span><select id="filter-pay-period"><option value="">Barcha davrlar</option>${Object.entries(payPeriods()).map(([key,p])=>`<option value="${key}" ${key===flow.salaryFilterPeriod?'selected':''}>${p.label}</option>`).join('')}</select></label><div class="field-pair"><label class="field"><span>Maosh, dan</span><input id="flow-salary-from" inputmode="numeric" value="${esc(flow.salaryFrom)}" placeholder="0"></label><label class="field"><span>gacha</span><input id="flow-salary-to" inputmode="numeric" value="${esc(flow.salaryTo)}" placeholder="0"></label></div></div><div class="spacer"></div><button class="primary full" data-flow-apply-filters>Qo‘llash</button><button class="text-button" data-flow-clear-filters>Tozalash</button>`);
}
function flowClearError(input){input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');const hint=input.closest('.field')?.querySelector('.polish-field-hint');if(hint)input.setAttribute('aria-describedby',hint.id);input.closest('.field')?.querySelector('.flow-field-error')?.remove()}
function flowError(input,text){flowClearError(input);input.setAttribute('aria-invalid','true');const note=document.createElement('small');note.className='flow-field-error';note.id='error-'+(input.id||input.dataset.field||'field');note.setAttribute('role','alert');note.textContent=text;input.setAttribute('aria-describedby',note.id);input.closest('.field')?.append(note);input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}
function flowValidateStep(){
  for(const input of document.querySelectorAll('#content input,#content textarea,#content select')){
    flowClearError(input);
    if(input.required&&!input.value.trim()){flowError(input,'Bu maydonni to‘ldiring');return false;}
    if(!input.checkValidity()){flowError(input,input.type==='date'?'Sanani tekshiring':'Ma’lumotni tekshiring');return false;}
  }
  const d=state.form[state.kind];
  if(false){flow.locationManualOpen=true;render();flowError(document.querySelector('[data-field="region"]'),'Ish joyini yuboring yoki hududni tanlang');return false;}
  if(state.kind==='vacancy'&&state.step===2&&d.workMode!=='Masofaviy'&&!discoveryPoint(d)){toast('Ish joyini xaritada belgilang');document.querySelector('[data-map]')?.focus();return false;}
  if(state.kind==='resume'&&state.step===4&&!d.workMode){toast('Ish shaklini tanlang');return false;}
  for(const [lowKey,highKey] of [['salaryMin','salaryMax'],['ageMin','ageMax']]){if(d[lowKey]&&d[highKey]&&flowNumber(d[lowKey])>flowNumber(d[highKey])){const input=document.querySelector(`[data-field="${highKey}"]`);if(input){flowError(input,'Bu qiymat boshlang‘ich qiymatdan kam bo‘lmasin');return false;}}}
  return payValidate();
}
function flowValidateAll(){const d=state.form[state.kind];if(state.kind==='vacancy'&&d.workMode!=='Masofaviy'&&!discoveryPoint(d)){navigate('vacancy',{step:2});toast('Ish joyini xaritada belgilang');return false;}if(state.kind==='resume'&&!d.workMode){navigate('resume',{step:2});toast('Ish shaklini tanlang');return false;}const required=state.kind==='vacancy'?[['position',0],['company',0],['description',4]]:[['name',0],['position',0]];for(const [key,step]of required){if(!String(d[key]||'').trim()){navigate(state.kind,{step});const input=document.querySelector(`[data-field="${key}"]`);if(input)flowError(input,'Bu maydonni to‘ldiring');return false;}}return payValidateAll()}

let flowCombo=null;
const flowOriginalField=field;
field=function(label,key,options={}){
  if(options.options&&!['position','region','district','skills'].includes(key))return polishSelectField(label,key,options);
  if(['position','region','district','skills'].includes(key)){
    const value=state.form[state.kind][key]||'',id='flow-'+state.kind+'-'+key;
    const markup=`<label class="field flow-combo-field"><span>${esc(label)}${options.required?' *':''}</span><span class="flow-input-shell">${icon(key==='region'?'pin':'search')}<input id="${id}" data-field="${key}" data-flow-combo="${key}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" type="text" value="${esc(value)}" placeholder="${key==='position'?'Lavozimni qidiring':key==='region'?'Hududni qidiring':key==='district'?'Tumanni qidiring':'Ko‘nikmalar'}" autocomplete="off" maxlength="${key==='skills'?300:120}" ${options.required?'required':''}><button type="button" data-flow-clear="${id}" aria-label="${key==='position'?'Lavozimni':key==='region'?'Hududni':key==='district'?'Tumanni':'Ko‘nikmalarni'} tozalash" ${value?'':'hidden'}>${icon('close')}</button></span></label>`;return polishHintMarkup(markup,key);
  }
  const markup=flowOriginalField(label,key,{...options,hint:''});
  return polishHintMarkup(markup.replace('<textarea ','<textarea maxlength="2000" ').replace('<input ',`<input id="flow-${state.kind}-${key}" maxlength="${['salaryMin','salaryMax'].includes(key)?14:key==='phone'?22:120}" ${['salaryMin','salaryMax','ageMin','ageMax'].includes(key)?'inputmode="numeric" pattern="[0-9 ]*"':''} ${options.type==='date'?'max="2026-10-30"':key==='shiftHours'?'min="1" max="24" step="0.5"':''} `),key);
};
function flowSuggestions(input){
  if(input.dataset.flowCombo==='place')return journeyPlaceSuggestions(input);
  const kind=input.dataset.flowCombo,raw=kind==='skills'?input.value.split(',').at(-1):input.value,q=flowNormalize(raw);
  if((kind==='position'||kind==='query')&&!/[a-zа-яёўқғҳ]/i.test(raw))return [];
  const preferLatin=/[a-z]/i.test(raw)&&!/[а-яёўқғҳ]/i.test(raw),priority=entry=>entry.score+(preferLatin&&!/[а-яёўқғҳ]/i.test(entry.title)?1.5:0);
  let list=kind==='region'?regions.map(title=>({title,aliases:''})):kind==='district'?((window.ISHDASIZ_LOCATIONS||[]).find(v=>flowRegionKey(v.title)===flowRegionKey(input.dataset.locationField&&flow.workGeo?flow.workGeo.proposal.region:state.form[state.kind].region))?.districts||[]).map(title=>({title,aliases:''})):kind==='skills'?['Excel','Savdo','Mijozlar bilan muloqot','Rus tili','Ingliz tili','Word','SMM','Jamoada ishlash','Hisobotlar','Dasturlash'].map(title=>({title,aliases:''})):(window.ISHDASIZ_POSITIONS||[]);
  return list.map(v=>({...v,score:!q?1:flowNormalize(v.title)===q?5:(' '+flowNormalize(v.aliases)+' ').includes(' '+q+' ')?4:flowNormalize(v.title).startsWith(q)?3:flowNormalize(v.title+' '+v.aliases).includes(q)?2:0})).filter(v=>v.score).sort((a,b)=>priority(b)-priority(a)).slice(0,6);
}
function flowCloseCombo(){if(flowCombo?.input?.isConnected){flowCombo.input.setAttribute('aria-expanded','false');flowCombo.input.removeAttribute('aria-activedescendant')}$('#flow-options')?.remove();flowCombo=null}
function flowPositionCombo(){
  const popup=$('#flow-options');if(!flowCombo||!popup)return;
  const box=(flowCombo.input.closest('.polish-choice-shell')||flowCombo.input.closest('.flow-input-shell')||flowCombo.input.closest('.fresh-search-form')||flowCombo.input).getBoundingClientRect(),view=window.visualViewport,topLimit=Math.max($('.app-header').getBoundingClientRect().bottom+5,view?.offsetTop||0),bottom=(view?.height||innerHeight)+(view?.offsetTop||0)-8-(parseFloat(getComputedStyle(app).getPropertyValue('--mini-bottom'))||0);
  const below=bottom-box.bottom-7,above=box.top-topLimit-7,flip=below<150&&above>below,height=Math.min(272,Math.max(80,flip?above:below));
  popup.style.left=Math.max(12,box.left-4)+'px';popup.style.width=Math.min(innerWidth-24,box.width+8)+'px';popup.style.maxHeight=height+'px';popup.style.top=(flip?Math.max(topLimit,box.top-7-Math.min(height,popup.scrollHeight)):box.bottom+7)+'px';
}
function flowOpenCombo(input){
  if(input.dataset.flowSelect){polishOpenSelect(input);return;}
  const matches=flowSuggestions(input);flowCloseCombo();if(!matches.length)return;
  const popup=document.createElement('div');popup.id='flow-options';popup.className='flow-options';popup.setAttribute('role','listbox');popup.setAttribute('aria-label',input.dataset.flowCombo==='region'?'Hududlar':'Takliflar');popup.innerHTML=matches.map((entry,index)=>`<div role="option" id="flow-option-${index}" aria-selected="false" data-flow-option="${index}"><i>${icon(['region','district','place'].includes(input.dataset.flowCombo)?'pin':input.dataset.flowCombo==='skills'?'spark':'briefcase')}</i><span>${flowHighlight(entry.title,input.value)}${entry.subtitle?`<small>${esc(entry.subtitle)}</small>`:``}</span><b>${icon('right')}</b></div>`).join('');app.append(popup);flowCombo={input,matches,index:-1};input.setAttribute('aria-expanded','true');flowPositionCombo();
}
function flowHighlight(title,query){
  const text=String(title),q=String(query).trim();if(!q)return esc(text);
  const start=text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());if(start<0)return esc(text);
  return esc(text.slice(0,start))+'<mark>'+esc(text.slice(start,start+q.length))+'</mark>'+esc(text.slice(start+q.length));
}
function flowChoose(index){
  if(!flowCombo)return;const {input,matches}=flowCombo,entry=matches[index];if(!entry)return;
  if(input.dataset.flowCombo==='place'){journeyChoosePlace(input,entry);return;}
  if(flowCombo.selectKey){const key=flowCombo.selectKey,top=$('#content').scrollTop;state.form[state.kind][key]=entry.title;flowCloseCombo();flowSaveDraft();render();$('#content').scrollTop=top;document.querySelector(`[data-flow-select="${key}"]`)?.focus({preventScroll:true});return;}
  let value=entry.title;if(input.dataset.flowCombo==='skills'){const current=input.value.split(',').slice(0,-1).map(v=>v.trim()).filter(Boolean);value=[...current,entry.title].join(', ');}
  input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));flowCloseCombo();input.focus();if(input.dataset.flowCombo==='query'){state.query=value;flowSearchUpdate();}flowSaveDraft();
}
function flowMoveOption(index){if(!flowCombo)return;flowCombo.index=(index+flowCombo.matches.length)%flowCombo.matches.length;const popup=$('#flow-options');popup.querySelectorAll('[role="option"]').forEach((el,i)=>el.setAttribute('aria-selected',String(i===flowCombo.index)));const active=popup.children[flowCombo.index];flowCombo.input.setAttribute('aria-activedescendant',active.id);if(active.offsetTop<popup.scrollTop)popup.scrollTop=active.offsetTop;else if(active.offsetTop+active.offsetHeight>popup.scrollTop+popup.clientHeight)popup.scrollTop=active.offsetTop+active.offsetHeight-popup.clientHeight;}

const flowOriginalRender=render;
render=function(){if(state.screen==='plans')state.kind='vacancy';if(state.kind==='resume'&&['schedule','preview'].includes(state.screen))state.screen='review';flowCloseCombo();flowSyncAllowance();polishInferCurrent();discoveryBeforeRender();flowOriginalRender();if(!document.activeElement.closest?.('.flow-home'))app.classList.remove('focus-paused');scheduleFreshScene();if(state.screen==='review'){const footer=$('#content .form-footer');if(footer)$('#action-bar').append(footer);}document.querySelectorAll('.form-details .field>small').forEach(el=>el.remove());discoveryAfterRender();};
const flowOriginalNavigate=navigate;
navigate=function(screen,options={}){if(state.screen==='auth'&&screen!=='auth'){flow.pendingAuth=null;flow.pendingApplication=null;flow.switchAccount=false;}flowCloseCombo();flowOriginalNavigate(screen,options);flowSaveDraft();};
const flowOriginalModal=modal;
modal=function(html){flowCloseCombo();flowOriginalModal(html)};
const discoveryOriginalClose=closeModal;closeModal=function(){workLocationCancel();if(flow.discoveryPicker){flow.discoveryPicker.remove();flow.discoveryPicker=null;flow.pickedMarker=null;}discoveryOriginalClose();};

document.addEventListener('input',event=>{
  const input=event.target;if(input.dataset.field){if(flow.confirmedTx===flow.tx){flow.tx=flowId();flow.activeId=flowId();flow.confirmedTx=null;state.orderPaid=false;}if(input.dataset.field==='region'&&state.form[state.kind].region!==input.value){state.form[state.kind].district='';if(state.kind==='vacancy')state.form.vacancy.coordinates=null;const district=document.querySelector('[data-field="district"]');if(district)district.value='';}if(state.kind==='vacancy'&&['district','address','city'].includes(input.dataset.field)&&state.form.vacancy[input.dataset.field]!==input.value){state.form.vacancy.coordinates=null;state.form.vacancy.locationConfirmedAt=null;}state.form[state.kind][input.dataset.field]=input.value;if(input.dataset.field==='position')polishInferCurrent();flowClearError(input);const clear=input.closest('.field')?.querySelector('[data-flow-clear]');if(clear)clear.hidden=!input.value;flowSaveDraft();}
  if(input.dataset.flowCombo==='query'){state.query=input.value;flowSearchUpdate();}
  if(input.dataset.flowCombo)flowOpenCombo(input);
},true);
document.addEventListener('focusin',event=>{if(event.target.dataset.flowCombo)flowOpenCombo(event.target)});
document.addEventListener('pointerdown',event=>{const option=event.target.closest('[data-flow-option]');if(option){event.preventDefault();flowChoose(Number(option.dataset.flowOption));return}if(flowCombo&&!event.target.closest('.flow-options')&&!flowCombo.input.contains(event.target))flowCloseCombo();},true);
document.addEventListener('keydown',event=>{
  if(!event.target.dataset.flowCombo&&!event.target.dataset.flowSelect)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopImmediatePropagation();if(!flowCombo)flowOpenCombo(event.target);if(flowCombo)flowMoveOption(flowCombo.index+(event.key==='ArrowDown'?1:-1));}
  else if(event.key==='Enter'&&flowCombo?.index>=0){event.preventDefault();event.stopImmediatePropagation();flowChoose(flowCombo.index);}
  else if(event.key==='Escape'&&flowCombo){event.preventDefault();event.stopImmediatePropagation();flowCloseCombo();}
  else if(event.key==='Tab')flowCloseCombo();
},true);
document.addEventListener('scroll',()=>{if(flowCombo)flowPositionCombo()},true);window.visualViewport?.addEventListener('resize',flowPositionCombo);window.addEventListener('resize',flowPositionCombo);
document.addEventListener('change',event=>{if(event.target.id==='schedule-start')flowSaveDraft();if(event.target.id==='flow-channel'){flow.channel=event.target.checked;flowSaveDraft();render();}});
document.addEventListener('change',event=>{const input=event.target;if(input.id!=='flow-upload')return;const file=input.files?.[0];if(!file)return;const mode=input.dataset.mode;if(!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime))$/.test(file.type)||(mode==='logo'&&!file.type.startsWith('image/'))||file.size>20*1024*1024){flowError(input,'Rasm yoki video tanlang, 20 MB gacha');return;}if(flow[mode]?.url)URL.revokeObjectURL(flow[mode].url);flow[mode]={url:URL.createObjectURL(file),type:file.type,name:file.name};closeModal();render();});
window.addEventListener('storage',event=>{if(event.key==='ishdasiz-v12-allowances'){flowSyncAllowance();if(['home','profile','review'].includes(state.screen))render();}});
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  const stop=()=>{event.preventDefault();event.stopImmediatePropagation()};
  if(b.dataset.slot!==undefined||b.dataset.scheduleMode||b.dataset.scheduleDay!==undefined||b.dataset.plan!==undefined||b.dataset.tariffKind||b.dataset.step==='back')queueMicrotask(flowSaveDraft);
  if(b.hasAttribute('data-pay')){stop();if(state.kind==='resume'){navigate('review');return;}if(!validSchedule()){toast('Boshqa vaqtni tanlang');return;}const plan=plans[state.selectedPlan];modal(`<h2>To‘lov</h2><div class="flow-checkout-summary"><span>${state.kind==='resume'?'Rezyume':'Vakansiya'} · ${plan.days}</span><strong>${money(tariffPrice(plan))}<small>so‘m</small></strong><p>${shortDate(calendarDates()[0])} · ${state.scheduleMode==='same'?state.scheduleTime:'Tanlangan vaqtlar'}${plan.pin?'<br>Zakrep — butun muddatga':''}</p></div><p>Demo: pul yechilmaydi.</p><button class="primary full" data-demo-paid>To‘lov ko‘rinishini tasdiqlash</button><button class="text-button full" data-close>Orqaga</button>`);return;}
  if(b.dataset.upload){stop();const mode=b.dataset.upload;modal(`<h2>${mode==='logo'?'Kompaniya logotipi':'Foto yoki video'}</h2><label class="field"><span>Faylni tanlang</span><input type="file" id="flow-upload" data-mode="${mode}" accept="${mode==='logo'?'image/png,image/jpeg,image/webp,image/gif':'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime'}"></label>`);return;}
  if(b.hasAttribute('data-flow-account')){stop();flow.switchAccount=true;flow.pendingAuth='profile';navigate('auth');return;}
  if(b.dataset.flowStart){stop();flowBegin(b.dataset.flowStart);return;}
  if(b.hasAttribute('data-create')){stop();modal(`<h2>E’lon joylash</h2><div class="studio-menu-create"><button data-flow-start="vacancy">${icon('briefcase')}Vakansiya joylash${icon('plus')}</button><button data-flow-start="resume">${icon('file')}Rezyume joylash${icon('plus')}</button></div>`);return;}
  if(b.dataset.flowPlan!==undefined){stop();state.selectedPlan=Number(b.dataset.flowPlan);const kind=state.kind;if(flow.priceTarget==='start'){closeModal();flowBegin(kind,false,true);}else{flow.preselectedPaid=true;navigate('schedule');}return;}
  if(b.hasAttribute('data-flow-site-only')){stop();if(flow.priceTarget==='start')flowBegin(state.kind,true,true);else{flow.channel=false;closeModal();render();}return;}
  if(b.dataset.flowEdit!==undefined){stop();navigate(state.kind,{step:Number(b.dataset.flowEdit)});return;}
  if(b.dataset.step==='next'){stop();flowCloseCombo();if(!flowValidateStep())return;if(state.step<formSteps[state.kind].length-1){state.step++;flowSaveDraft();render();$('#content').scrollTop=0;}else{flowSaveDraft();navigate('review');}return;}
  if(b.hasAttribute('data-flow-publish')||b.hasAttribute('data-channel-confirm')){stop();flowPublish();return;}
  if(b.hasAttribute('data-flow-buy')){stop();if(!flowValidateAll())return;if(flow.preselectedPaid)navigate('schedule');else{flow.priceTarget='review';flowPrices(state.kind);}return;}
  if(b.hasAttribute('data-demo-paid')){stop();if(state.orderPaid){closeModal();navigate('review');return;}if(!validSchedule()){toast('Boshqa vaqtni tanlang');return}state.orderPaid=true;flow.channel=true;state.demoReservations.push(...selectedSchedule());navigate('review');return;}
  if(b.hasAttribute('data-verify-sms')){stop();if(!/^\d{5}$/.test($('#sms-code').value)){flowError($('#sms-code'),'5 xonali kodni kiriting');return;}if(flow.switchAccount){flowClearMedia();state.form=structuredClone(flow.defaults);flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=false;state.orderPaid=false;flow.switchAccount=false;}state.loggedIn=true;state.phone='+998'+state.phone.replace(/\D/g,'').slice(-9);flowWrite('ishdasiz-v12-account',{phone:state.phone});flowSyncAllowance();const target=flow.pendingAuth||'profile',application=flow.pendingApplication;flow.pendingAuth=null;flow.pendingApplication=null;navigate(target);if(application)flowApplicationModal(application);return;}
  if(b.dataset.flowClear){stop();const input=document.getElementById(b.dataset.flowClear);input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return;}
  if(b.dataset.filter&&state.screen==='search'){stop();flowFilters();return;}
  if(b.hasAttribute('data-flow-apply-filters')){stop();const low=$('#flow-salary-from'),high=$('#flow-salary-to');if((low.value||high.value)&&!$('#filter-pay-period').value){flowError($('#filter-pay-period'),'To‘lov davrini tanlang');return;}if(flowNumber(low.value)&&flowNumber(high.value)&&flowNumber(low.value)>flowNumber(high.value)){flowError(high,'Qiymat boshlang‘ich maoshdan kam bo‘lmasin');return;}state.region=$('#filter-region').value;flow.salaryFilterPeriod=$('#filter-pay-period').value;flow.salaryFrom=low.value;flow.salaryTo=high.value;closeModal();render();return;}
  if(b.hasAttribute('data-flow-clear-filters')||b.hasAttribute('data-flow-reset')){stop();state.region='Butun O‘zbekiston';state.query='';flow.salaryFrom='';flow.salaryTo='';flow.salaryFilterPeriod='';closeModal();render();return;}
  if(b.dataset.flowCandidates){stop();discoveryOpenCandidates(b.dataset.flowCandidates);return;}
  if(b.dataset.flowDetail){stop();flowDetails(b.dataset.flowDetail);return;}
  if(b.dataset.flowSave){stop();const saved=new Set(flowRead('ishdasiz-v12-saved',[]));saved.has(b.dataset.flowSave)?saved.delete(b.dataset.flowSave):saved.add(b.dataset.flowSave);flowWrite('ishdasiz-v12-saved',[...saved]);flowSearchUpdate();return;}
  if(b.dataset.flowContact){stop();if(!state.loggedIn){flow.pendingAuth='search';navigate('auth');return;}const record=flowSearchRecords().find(v=>v.id===b.dataset.flowContact);if(!record)return;if(record.kind==='resume'&&!discoveryCanReadResume(record)){modal(discoveryGate(discoveryContext()));return;}flowTrackResume(record,'contacts');modal(discoveryContactMarkup(record));return;}
  if(b.dataset.flowRepost||b.dataset.flowEditRecord){stop();const record=flowOwnRecords().find(v=>v.id===(b.dataset.flowRepost||b.dataset.flowEditRecord));if(!record)return;if(b.dataset.flowRepost&&record.kind==='resume'){toast('Rezyume faqat bazada saqlanadi');return;}state.kind=record.kind;state.form[record.kind]={...record};flow.activeId=record.id;flow.tx=flowId();flow.confirmedTx=null;flow.channel=!!b.dataset.flowRepost;state.orderPaid=false;navigate(b.dataset.flowRepost?'review':record.kind);return;}
  if(b.dataset.flowArchive){stop();modal(`<h2>E’lonni olib tashlash?</h2><button class="primary full" data-flow-archive-confirm="${esc(b.dataset.flowArchive)}">Olib tashlash</button><button class="secondary full" data-close>Bekor qilish</button>`);return;}
  if(b.dataset.flowArchiveConfirm){stop();flowWrite('ishdasiz-v12-records',flowRecords().map(v=>v.id===b.dataset.flowArchiveConfirm&&v.account===flowAccount()?{...v,archived:true}:v));closeModal();render();return;}
},true);
paths.eye='M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0';
render();
window.ISHDASIZFlow={flow,free:flowFree,records:flowRecords,begin:flowBegin,publish:flowPublish,closeCombo:flowCloseCombo};

/* Local account and application preview. No employer messages or API calls. */
function flowHeroLetters(text,offset=0){return Array.from(text).map((letter,i)=>`<span class="flow-copy-letter" style="--letter:${i+offset}">${esc(letter)}</span>`).join('');}
function flowHeroMessage(){
  const phase=((state.scene%4)+4)%4,word=phase===1?'Ish':'Xodim';
  return `<h1 class="flow-hero-title" data-phase="${phase}" aria-label="Xodim yoki ish kerakmi? Unda hoziroq e’lon bering. Saytda mutlaqo bepul."><span class="flow-message-panels" aria-hidden="true"><span class="flow-message-question"><span class="flow-hero-word"><span class="${phase!==1?'active':''}">${flowHeroLetters('Xodim')}</span><span class="${phase===1?'active':''}">${flowHeroLetters('Ish')}</span></span><em data-flow-type="question">${flowHeroLetters('kerakmi?',word.length+1)}</em></span><span class="flow-message-pitch"><span class="flow-message-lead" data-flow-type="lead">${flowHeroLetters('Unda hoziroq')}</span><strong><span data-flow-type="post">${flowHeroLetters('E’lon',13)}</span><br><span data-flow-type="post-end" data-caret>${flowHeroLetters('bering.',19)}</span></strong></span><span class="flow-message-free"><span class="flow-message-lead" data-flow-type="site">${flowHeroLetters('Saytda')}</span><strong><span data-flow-type="free">${flowHeroLetters('Mutlaqo',7)}</span><br><span data-flow-type="free-end" data-caret>${flowHeroLetters('bepul.',15)}</span></strong></span></span><span class="flow-hero-signals" aria-hidden="true"><i></i><i></i><i></i><i></i></span><svg class="flow-hero-arrow" viewBox="0 0 120 64" fill="none" aria-hidden="true"><path class="flow-arrow-line" pathLength="1" d="M8 3C4 30 66 6 77 31S80 51 97 59"/><path class="flow-arrow-head" d="m89 50 8 9-12 1"/></svg></h1>`;
}
function flowSyncHero(index){
  const title=document.querySelector('.flow-hero-title');if(!title)return;
  const phase=((index%4)+4)%4;title.dataset.phase=String(phase);
  title.querySelectorAll('.flow-hero-word>span').forEach((el,i)=>el.classList.toggle('active',i===(phase===1?1:0)));
  const word=phase===1?'Ish':'Xodim';
  if(phase<2){title.querySelector('.flow-hero-word>span.active').innerHTML=flowHeroLetters(word);title.querySelector('[data-flow-type="question"]').innerHTML=flowHeroLetters('kerakmi?',word.length+1);}
  else for(const [key,text,offset] of phase===2?[['lead','Unda hoziroq',0],['post','E’lon',13],['post-end','bering.',19]]:[['site','Saytda',0],['free','Mutlaqo',7],['free-end','bepul.',15]])title.querySelector(`[data-flow-type="${key}"]`).innerHTML=flowHeroLetters(text,offset);
}
function flowAllApplications(){return flowRead('ishdasiz-v12-applications',[]).filter(a=>a&&typeof a.id==='string');}
function flowAccountApplications(received=false){
  if(!state.loggedIn)return [];
  const ownJobs=new Set(flowOwnRecords().filter(r=>r.kind==='vacancy').map(r=>r.id));
  return flowAllApplications().filter(a=>received?ownJobs.has(a.jobId):a.account===flowAccount());
}
function flowHomeAccount(){
  return `<nav class="discovery-account-row" aria-label="Shaxsiy kabinet"><button data-nav="profile">${icon('identity')}<span>Profilim</span></button><button data-nav="listings">${icon('portfolio')}<span>Mening<br>e’lonlarim</span></button><button data-nav="applications">${icon('applications')}<span>Arizalarim</span></button></nav>`;
}
function flowApplications(){return discoveryApplications();}
function flowApplicationModal(jobId){
  const job=flowSearchRecords().find(r=>r.id===jobId&&r.kind==='vacancy');
  if(!job){toast('Vakansiya mavjud emas');return;}
  if(!state.loggedIn){flow.pendingApplication=jobId;flow.pendingAuth='applications';flowSaveDraft();navigate('auth');return;}
  if(job.account===flowAccount()){toast('Bu sizning vakansiyangiz');return;}
  if(flowAccountApplications().some(a=>a.jobId===jobId)){navigate('applications');return;}
  const resumes=flowOwnRecords().filter(r=>r.kind==='resume'&&!r.archived);
  if(!resumes.length){modal(`<h2>Rezyume qo‘shing</h2><button class="primary full" data-flow-start="resume">Rezyume joylash ${icon('plus')}</button>`);return;}
  modal(`<h2>Ariza topshirish</h2><p>${esc(job.position)} · ${esc(job.company)}</p><label class="field flow-application-select"><span>Rezyume</span><select id="flow-application-resume">${resumes.map(r=>`<option value="${esc(r.id)}">${esc(r.position)} · ${esc(r.name)}</option>`).join('')}</select></label><p class="flow-demo-note">Demo: ariza ish beruvchiga yuborilmaydi.</p><button class="primary full" data-flow-app-confirm="${esc(jobId)}">Tasdiqlash ${icon('right')}</button>`);
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  const stop=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(b.dataset.flowAppTab){stop();flow.applicationTab=b.dataset.flowAppTab;render();return;}
  if(b.hasAttribute('data-flow-app-login')){stop();flow.pendingAuth='applications';navigate('auth');return;}
  if(b.dataset.flowApply){stop();flowApplicationModal(b.dataset.flowApply);return;}
  if(b.dataset.flowAppResume){stop();const job=flowOwnRecords().find(r=>r.id===b.dataset.discoveryJob);if(job)discoverySetContext(job.id);flowDetails(b.dataset.flowAppResume);return;}
  if(b.dataset.flowAppConfirm){
    stop();if(!state.loggedIn)return;
    const job=flowSearchRecords().find(r=>r.id===b.dataset.flowAppConfirm&&r.kind==='vacancy'),resume=flowOwnRecords().find(r=>r.id===$('#flow-application-resume')?.value&&r.kind==='resume'&&!r.archived);
    if(!job||!resume||job.account===flowAccount()){toast('Vakansiya yoki rezyume mavjud emas');return;}
    const entries=flowAllApplications();if(!entries.some(a=>a.account===flowAccount()&&a.jobId===job.id)){
      entries.unshift({id:flowId(),account:flowAccount(),jobId:job.id,resumeId:resume.id,position:job.position,company:job.company,candidateName:resume.name,resumePosition:resume.position,createdAt:new Date().toISOString()});
      flowWrite('ishdasiz-v12-applications',entries);
    }
    flow.applicationTab='sent';navigate('applications');return;
  }
},true);

/* V13 discovery preview: local records, explicit publication grants and voluntary coordinates. */
function discoveryPoint(record){const p=record?.coordinates;return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180?p:null;}
function discoveryKm(a,b){if(!a||!b)return null;const r=v=>v*Math.PI/180,dlat=r(b[0]-a[0]),dlon=r(b[1]-a[1]),s=Math.sin(dlat/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(s),Math.sqrt(Math.max(0,1-s)));}
function discoveryDistance(a,b){const n=discoveryKm(discoveryPoint(a),discoveryPoint(b));return n===null?'':`≈ ${new Intl.NumberFormat('uz-UZ',{maximumFractionDigits:1}).format(n)} km · to‘g‘ri chiziq`;}
function discoveryExperience(value){const text=flowNormalize(value);if(!text)return null;if(text.includes('tajribasiz')||text.includes('ahamiyatsiz'))return 0;const n=text.match(/\d+/);return n?Number(n[0]):null;}
function discoveryMatch(vacancy,resume){
  const sameRole=[...flowPositionTerms(vacancy.position)].some(t=>flowPositionTerms(resume.position).has(t));
  const work=flowNormalize(vacancy.workMode),desired=flowNormalize(resume.workMode),sameMode=!!work&&!!desired&&(work===desired||desired==='farqi yoq');
  if(!sameRole||!sameMode)return {eligible:false,reasons:[],issues:[]};
  const reasons=['Lavozim mos',work==='masofaviy'?'Masofaviy ish':'Ish shakli mos'],issues=[];
  const min=flowNumber(resume.salaryMin),max=flowNumber(vacancy.salaryMax)||flowNumber(vacancy.salaryMin);
  if(!paySameBasis(vacancy,resume))issues.push('To‘lov davri yoki hajmi farq qiladi');
  else if(vacancy.salaryNegotiable||resume.salaryNegotiable)issues.push('Maosh kelishiladi');
  else if(min&&max){if(min>max)issues.push('Kutilgan maosh yuqoriroq');else reasons.push('Maosh mos');}else issues.push('Maosh aniqlashtiriladi');
  if(vacancy.employment&&resume.employment&&flowNormalize(vacancy.employment)!==flowNormalize(resume.employment))issues.push('Bandlik turi farq qiladi');
  if(vacancy.days&&resume.days&&flowNormalize(vacancy.days)!==flowNormalize(resume.days))issues.push('Ish kunlari farq qiladi');
  const neededLanguages=String(vacancy.languages||'').split(',').map(flowNormalize).filter(Boolean),knownLanguages=String(resume.languages||'').split(',').map(flowNormalize);
  if(neededLanguages.some(language=>!knownLanguages.includes(language)))issues.push('Til talabi aniqlashtiriladi');
  const need=discoveryExperience(vacancy.experience),have=discoveryExperience(resume.experience);
  if(need!==null&&need>0){if(have===null)issues.push('Tajriba aniqlashtiriladi');else if(have<need)issues.push('Ko‘proq tajriba talab qilinadi');else reasons.push('Tajriba mos');}
  const km=discoveryKm(discoveryPoint(vacancy),discoveryPoint(resume));
  if(work!=='masofaviy'){
    if(vacancy.region&&resume.region&&flowRegionKey(vacancy.region)!==flowRegionKey(resume.region))issues.push('Boshqa hudud');
    if(km!==null){reasons.push(discoveryDistance(vacancy,resume));if(resume.maxDistanceKm&&km>Number(resume.maxDistanceKm))issues.push('Belgilangan masofadan uzoq');}
    else if(vacancy.region&&resume.region&&flowRegionKey(vacancy.region)===flowRegionKey(resume.region))reasons.push(vacancy.district&&resume.district&&flowNormalize(vacancy.district)===flowNormalize(resume.district)?'Bir tuman':'Bir hudud');
  }
  return {eligible:true,reasons,issues,exact:issues.length===0,distance:km,score:reasons.length-(issues.length*3)};
}
function discoveryMatches(subject){return flowSearchRecords().filter(r=>r.kind!==(subject.kind||state.kind)&&r.account!==flowAccount()).flatMap(record=>{const match=subject.kind==='resume'||(!subject.kind&&state.kind==='resume')?discoveryMatch(record,subject):discoveryMatch(subject,record);return match.eligible?[{record,...match}]:[];}).sort((a,b)=>Number(b.exact)-Number(a.exact)||(a.distance??Infinity)-(b.distance??Infinity)||b.score-a.score);}
function discoveryFingerprint(job){return JSON.stringify({role:[...flowPositionTerms(job.position)],mode:flowNormalize(job.workMode),employment:flowNormalize(job.employment),days:flowNormalize(job.days),languages:flowNormalize(job.languages),region:flowRegionKey(job.region),district:flowNormalize(job.district),salaryPeriod:payPeriod(job),salaryCurrency:job.salaryCurrency||'UZS',salaryNegotiable:!!job.salaryNegotiable,shiftHours:payPeriod(job)==='shift'?Number(job.shiftHours):null,salaryScope:payPeriod(job)==='service'?flowNormalize(job.salaryScope):null,salaryMin:flowNumber(job.salaryMin),salaryMax:flowNumber(job.salaryMax),experience:discoveryExperience(job.experience),coordinates:discoveryPoint(job)?.map(v=>Number(v.toFixed(5)))||null});}
function discoveryGrants(){return flowRead('ishdasiz-v13-channel-grants',{},localStorage);}
function discoveryUnlocked(job){const saved=job?.id&&flowOwnRecords().find(r=>r.id===job.id&&r.kind==='vacancy'&&!r.archived),grant=job?.id&&discoveryGrants()[job.id];return !!(state.loggedIn&&saved&&grant?.account===flowAccount()&&grant.fingerprint===discoveryFingerprint(saved)&&grant.fingerprint===discoveryFingerprint(job));}
function discoveryGrant(job){const grants=discoveryGrants();grants[job.id]={account:flowAccount(),fingerprint:discoveryFingerprint(job),confirmedAt:new Date().toISOString()};flowWrite('ishdasiz-v13-channel-grants',grants,localStorage);}
function discoveryContext(){const id=flowRead('ishdasiz-v13-candidate-context',{})[flowAccount()];return flowOwnRecords().find(r=>r.id===id&&r.kind==='vacancy'&&!r.archived)||null;}
function discoverySetContext(id){const contexts=flowRead('ishdasiz-v13-candidate-context',{});contexts[flowAccount()]=id;flowWrite('ishdasiz-v13-candidate-context',contexts);}
function discoveryCanReadResume(record){if(record.account===flowAccount()&&state.loggedIn)return true;const job=discoveryContext();return !!(discoveryUnlocked(job)&&discoveryMatch(job,record).eligible);}
function discoveryGate(job){
  const total=flowSearchRecords().filter(r=>r.kind==='resume'&&r.account!==flowAccount()).length,matches=job?discoveryMatches({...job,kind:'vacancy'}).length:0;
  return `<section class="discovery-gate"><span class="discovery-lock">${icon('shield')}</span><h2>Vakansiyangizga mos nomzodlar</h2><div class="discovery-counts"><div><strong>${total}</strong><span>Bazadagi rezyume</span></div><div><strong>${matches}</strong><span>Mos kelishi mumkin</span></div></div><p>Nomzodlarni ko‘rish uchun shu vakansiyani kanalga joylang.</p><button class="primary full" ${job?`data-discovery-unlock="${esc(job.id||'draft')}"`:'data-flow-start="vacancy"'}>${job?(flowFree('vacancy')?'Kanalga bepul joylash':'Kanalga joylash'):'Vakansiya yaratish'}${icon('send')}</button></section>`;
}
function discoveryOpenCandidates(id){const job=id==='draft'?{...state.form.vacancy,kind:'vacancy'}:flowOwnRecords().find(r=>r.id===id&&r.kind==='vacancy');if(!job)return;if(job.id)discoverySetContext(job.id);state.searchType='resumes';state.query='';state.region='Butun O‘zbekiston';flow.salaryFrom='';flow.salaryTo='';flow.salaryFilterPeriod='';if(!discoveryUnlocked(job)){modal(discoveryGate(job));return;}navigate('search');}
function discoveryMatchCards(subject){
  const entries=discoveryMatches(subject).filter(m=>state.screen!=='search'||state.searchType!=='resumes'||flowMatches(m.record)),partial=flow.discoveryPartial===true,shown=entries.filter(m=>m.exact!==partial),resumes=subject.kind==='vacancy';
  return `<section class="flow-candidates discovery-matches"><div class="flow-candidates-heading"><span>${icon(resumes?'users':'briefcase')}</span><div><h2>${resumes?'Mos nomzodlar':'Sizga mos ishlar'}</h2><p>${esc(subject.position)} · ${esc(subject.region||'')}</p></div><b>${entries.length}</b></div><div class="tabs discovery-match-tabs"><button data-discovery-match-tab="exact" class="${!partial?'active':''}">Mos · ${entries.filter(m=>m.exact).length}</button><button data-discovery-match-tab="partial" class="${partial?'active':''}">Aniqlashtirish · ${entries.filter(m=>!m.exact).length}</button></div>${shown.slice(0,12).map(({record,reasons,issues})=>`<article class="flow-match-card"><span class="flow-match-avatar">${icon(resumes?'user':'briefcase')}</span><div><h3>${esc(record.position)}</h3><p>${esc(resumes?record.name:record.company)}${record.sample?' · Namuna':''}</p><span class="flow-match-region">${esc(record.region||'')} · ${flowSalaryLabel(record)}</span><div class="flow-match-reasons">${reasons.map(reason=>`<span>${icon('check')}${esc(reason)}</span>`).join('')}${issues.map(issue=>`<span class="discovery-mismatch">${esc(issue)}</span>`).join('')}</div></div><button data-flow-detail="${esc(record.id)}" aria-label="${resumes?'Rezyumeni':'Vakansiyani'} ko‘rish">${icon('right')}</button></article>`).join('')||`<div class="flow-match-empty">${partial?'Aniqlashtirish talab qiladigan e’lon yo‘q.':'Hozircha to‘liq mos e’lon yo‘q.'}</div>`}</section>`;
}
function discoveryCandidateSection(job){const subject={...job,kind:'vacancy'};return discoveryUnlocked(subject)?discoveryMatchCards(subject):discoveryGate(subject);}
function discoveryReview(){
  const resume=state.kind==='resume',d=state.form[state.kind];
  return `<section class="view flow-review">${freshTitle(resume?'Rezyumeni saqlash':'Vakansiyani tekshirish')}<article class="flow-summary"><div class="flow-summary-label"><span>${icon(resume?'file':'briefcase')}${resume?'Rezyume':'Vakansiya'}</span><button data-flow-edit="0">${icon('edit')}Tahrirlash</button></div><h2>${esc(d.position||'Lavozim')}</h2><p>${esc(resume?d.name:d.company)}</p><strong>${flowSalaryLabel(d)}</strong><span class="flow-summary-region">${icon('pin')}${esc(d.region||'Hudud')} · ${esc(d.district||'')}</span></article>${resume?`<div class="discovery-base-note">${icon('shield')}Rezyume bazada saqlanadi. Kanalga yuborilmaydi.</div>`:`<div class="flow-destinations"><div class="flow-destination"><span class="flow-dest-icon">${icon('home')}</span><div><b>ishdasiz.uz</b><small>Saytda bepul</small></div>${icon('check')}</div><label class="flow-destination channel"><span class="flow-dest-icon">${icon('send')}</span><span><b>@ishdasiz</b><small>${flowFree('vacancy')?'Bepul joylash':state.orderPaid?'Tarif tanlandi':'Kanalda e’lon qilish'}</small></span><input type="checkbox" id="flow-channel" ${flow.channel?'checked':''}></label></div>${discoveryCandidateSection({...d,id:flow.activeId})}`}
  <p class="flow-demo-note">Demo: haqiqiy e’lon va to‘lov yuborilmaydi.</p><div class="form-footer"><button class="secondary" data-flow-edit="${formSteps[state.kind].length-1}">${icon('back')}Orqaga</button><button class="primary" data-flow-publish>${!state.loggedIn?'Kirish':resume?'Rezyumeni saqlash':flow.channel?'Sayt va kanalga joylash':'Saytga saqlash'}<span class="studio-button-end">${icon('right')}</span></button></div></section>`;
}
function discoveryDone(){
  const record=flowOwnRecords().find(r=>r.id===flow.lastId),resume=record?.kind==='resume';
  if(record&&!resume&&discoveryUnlocked(record))discoverySetContext(record.id);
  return `<section class="view flow-done"><span class="flow-done-mark">${icon('check')}</span><h1>${resume?'Rezyume saqlandi.':'Vakansiya saqlandi.'}</h1>${record?`<p>${esc(record.position)}</p>${resume?flowResumeStats(record)+discoveryMatchCards(record):discoveryCandidateSection(record)}`:''}<button class="secondary full" data-nav="listings">E’lonlarim ${icon('right')}</button><button class="text-button" data-nav="home">Bosh sahifa</button><small>Demo: ma’lumotlar shu brauzerda saqlandi.</small></section>`;
}
function discoveryResults(){if(state.searchType==='resumes'){const job=discoveryContext();return discoveryUnlocked(job)?discoveryMatchCards(job):discoveryGate(job);}return discoveryOriginalResults();}
function discoveryDetails(id){
  const d=flowSearchRecords().find(r=>r.id===id);if(!d){toast('E’lon mavjud emas');return;}
  if(d.kind==='resume'&&!discoveryCanReadResume(d)){modal(discoveryGate(discoveryContext()));return;}
  flowTrackResume(d,'views');
  const resume=d.kind==='resume',own=flowOwnRecords().find(r=>r.kind==='resume'&&!r.archived),distance=!resume&&own?discoveryDistance(d,own):resume&&discoveryContext()?discoveryDistance(discoveryContext(),d):'',point=!resume&&discoveryPoint(d);
  modal(`<h2>${esc(d.position)}</h2><p>${esc(resume?d.name:d.company)}${d.sample?' · Namuna':''}</p><strong class="flow-detail-salary">${flowSalaryLabel(d)}</strong><div class="discovery-detail-grid">${[['Hudud',[d.region,d.district].filter(Boolean).join(' · ')],['Manzil',!resume?d.address:''],['Ish shakli',d.workMode],['Bandlik',d.employment],['Ish vaqti',!resume?[d.days,d.hours].filter(Boolean).join(' · '):''],['Tajriba',d.experience]].filter(([,value])=>value).map(([label,value])=>`<div><span>${label}</span><b>${esc(value)}</b></div>`).join('')}</div>${distance?`<p class="discovery-distance">${icon('pin')}${esc(distance)}</p>`:''}${point?`<a class="secondary full discovery-map-link" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${point[0]}&mlon=${point[1]}#map=16/${point[0]}/${point[1]}">${icon('pin')}Xaritada ko‘rish</a>`:''}${[['',d.description||d.skills],['Vazifalar',d.duties],['Talablar',d.requirements],['Qulayliklar',d.benefits]].filter(([,value])=>value).map(([label,value])=>`<div class="discovery-detail-copy">${label?`<b>${label}</b>`:''}<p>${esc(value)}</p></div>`).join('')}${!resume&&d.account!==flowAccount()?`<button class="primary full flow-apply-action" data-flow-apply="${esc(d.id)}">Ariza topshirish ${icon('send')}</button>`:''}<button class="${resume?'primary':'secondary'} full" data-flow-contact="${esc(d.id)}">${icon('phone')}${state.loggedIn?'Kontaktni ko‘rish':'Kontakt uchun kirish'}</button>`);
}
function discoveryContactMarkup(record){
  if(record.sample)return '<h2>Aloqa</h2><p>Demo: haqiqiy kontakt yo‘q.</p><button class="secondary full" data-close>Yopish</button>';
  const phone=String(record.phone||'').replace(/[^+0-9]/g,''),username=String(record.telegram||'').replace(/^@/,'');
  return `<h2>Aloqa</h2>${record.hr?`<p>${esc(record.hr)}</p>`:''}<p>${esc(record.phone||'Kontakt kiritilmagan')}</p>${/^\+?\d{7,16}$/.test(phone)?`<a class="secondary full discovery-map-link" href="tel:${phone}">${icon('phone')}Qo‘ng‘iroq qilish</a>`:''}${/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)?`<a class="secondary full discovery-map-link" target="_blank" rel="noopener noreferrer" href="https://t.me/${username}">${icon('send')}Telegram</a>`:''}<button class="text-button full" data-close>Yopish</button>`;
}
function discoveryApplications(){
  const received=flow.applicationTab==='received',entries=flowAccountApplications(received);
  return `<section class="view flow-applications">${freshTitle('Arizalarim')}<div class="tabs"><button data-flow-app-tab="sent" class="${!received?'active':''}">Yuborganlarim</button><button data-flow-app-tab="received" class="${received?'active':''}">Kelganlar</button></div>${!state.loggedIn?`<div class="flow-app-empty">${icon('user')}<h2>Profilga kiring</h2><button class="primary full" data-flow-app-login>Kirish ${icon('right')}</button></div>`:entries.length?entries.map(a=>{
    const job=flowOwnRecords().find(r=>r.id===a.jobId),resume=flowSearchRecords().find(r=>r.id===a.resumeId),readable=!received||(resume&&discoveryUnlocked(job)&&discoveryMatch(job,resume).eligible);
    return `<article class="flow-application-card"><div class="flow-application-meta"><span>${icon('send')}Demo ariza</span><time>${esc(new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short'}).format(new Date(a.createdAt)))}</time></div><h2>${esc(a.position)}</h2><p>${esc(received?(readable?a.candidateName:'Nomzod ma’lumoti yopiq'):a.company)}</p>${readable?`<div class="flow-application-resume">${icon('file')}${esc(a.resumePosition)}</div>`:''}<button class="secondary full" ${received?readable?`data-flow-app-resume="${esc(a.resumeId)}" data-discovery-job="${esc(a.jobId)}"`:`data-discovery-unlock="${esc(a.jobId)}"`:`data-flow-detail="${esc(a.jobId)}"`}>${received?(readable?'Rezyumeni ko‘rish':'Shu vakansiya uchun nomzodlarni ochish'):'Vakansiyani ko‘rish'}${icon('right')}</button></article>`;
  }).join(''):`<div class="flow-app-empty">${icon(received?'users':'send')}<h2>${received?'Hali ariza kelmagan':'Hali ariza yo‘q'}</h2><button class="primary full" ${received?'data-flow-start="vacancy"':'data-fresh-intent="career"'}>${received?'Vakansiya joylash':'Ish topish'}${icon('right')}</button></div>`}</section>`;
}
function discoveryHomeMap(){
  const counts=discoveryMapCounts(null);
  return `<section class="discovery-map-card"><header><div><span>${icon('pin')}Toshkent</span><h2>Yaqindagi imkoniyatlar</h2></div></header><div class="discovery-map-surface"><div id="discovery-map" aria-label="Toshkentdagi ishlar xaritasi"></div><div class="discovery-map-tools"><button data-discovery-locate="map" aria-label="Joylashuvim">${icon('pin')}</button></div><div class="discovery-map-error" hidden>Xarita yuklanmadi. Ro‘yxatni ochishingiz mumkin.</div></div><div class="discovery-map-counts"><button data-discovery-map-list="jobs">${icon('briefcase')}<span><b id="discovery-job-count">${counts.jobs}</b> vakansiya</span>${icon('right')}</button><button data-discovery-map-list="resumes">${icon('users')}<span><b id="discovery-resume-count">${counts.resumes}</b> rezyume</span>${icon('right')}</button></div><small>Raqamni bosing — mos ro‘yxat ochiladi.</small></section>`;
}
function discoveryMapCounts(bounds){
  const center=[41.3111,69.2797],records=flowSearchRecords().filter(r=>{const point=r.kind==='vacancy'?discoveryPoint(r):null;if(point)return !bounds||bounds.contains(point);return flowRegionKey(r.region)==='toshkent-shahri'&&(!bounds||bounds.contains(center));});
  return {jobs:records.filter(r=>r.kind==='vacancy').length,resumes:records.filter(r=>r.kind==='resume').length};
}
function discoveryMountMap(){
  const target=$('#discovery-map');if(!target||target.dataset.ready)return;
  target.dataset.ready='true';if(!window.L){target.parentElement.querySelector('.discovery-map-error').hidden=false;return;}
  const map=L.map(target,{center:flow.mapCenter||[41.3111,69.2797],zoom:12,zoomControl:false,scrollWheelZoom:false,attributionControl:true});flow.discoveryMap=map;
  L.control.zoom({position:'bottomright'}).addTo(map);map.attributionControl.setPrefix(false);
  let loaded=false;const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
  tiles.on('tileload',()=>{loaded=true;target.parentElement.querySelector('.discovery-map-error').hidden=true;});tiles.on('tileerror',()=>{if(!loaded)target.parentElement.querySelector('.discovery-map-error').hidden=false;});
  const layers=L.layerGroup().addTo(map),update=()=>{
    const counts=discoveryMapCounts(map.getBounds());const cityLabel=$('.discovery-map-card>header>div>span');if(cityLabel)cityLabel.innerHTML=icon('pin')+(map.getBounds().contains([41.3111,69.2797])?'Toshkent':'Tanlangan hudud');$('#discovery-job-count').textContent=counts.jobs;$('#discovery-resume-count').textContent=counts.resumes;layers.clearLayers();
    const city=[41.3111,69.2797];if(map.getBounds().contains(city))L.marker(city,{icon:L.divIcon({className:'discovery-map-cluster',html:`<button data-discovery-map-list="jobs" aria-label="Xaritadagi vakansiyalar">${icon('briefcase')}<b>${counts.jobs}</b></button><button data-discovery-map-list="resumes" aria-label="Xaritadagi rezyumelar">${icon('users')}<b>${counts.resumes}</b></button>`,iconSize:[120,48],iconAnchor:[60,24]})}).addTo(layers).bindTooltip('Hudud bo‘yicha jami — aniq ish yoki uy manzili emas');
    for(const record of flowSearchRecords().filter(r=>r.kind==='vacancy'&&discoveryPoint(r))){const marker=L.circleMarker(discoveryPoint(record),{radius:7,color:'#fff',weight:2,fillColor:'#185bec',fillOpacity:1}).addTo(layers);marker.on('click',()=>flowDetails(record.id));}
  };map.on('moveend',update);update();
}
function discoveryMapPicker(){workLocationOpen('map');}
function discoveryLocate(mode){
  if(!navigator.geolocation){toast('Bu qurilmada geolokatsiya mavjud emas');return;}
  const button=document.querySelector(`[data-discovery-locate="${mode}"]`);if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
  navigator.geolocation.getCurrentPosition(position=>{
    if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}
    const point=[position.coords.latitude,position.coords.longitude];if(!discoveryPoint({coordinates:point}))return;
    if(mode==='resume'){state.form.resume.coordinates=point;state.form.resume.coordinateAccuracyM=position.coords.accuracy;flowSaveDraft();render();}else{flow.mapCenter=point;if(flow.discoveryMap)flow.discoveryMap.setView(point,13,{animate:!freshReduced.matches&&freshMotion});}
  },()=>{if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}toast('Joylashuv olinmadi. Hududni qo‘lda tanlang.');},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}
function discoveryWelcomeKey(){return 'ishdasiz-v13-welcome-'+flowAccount();}
function discoveryPlanWelcome(){
  clearTimeout(flow.welcomeTimer);
  if(window.self!==window.top||document.hidden||state.screen!=='home'||flowRead(discoveryWelcomeKey(),false,localStorage)||flowOwnRecords().length||state.form.vacancy.position||state.form.vacancy.company||state.form.resume.name||state.form.resume.position)return;
  flow.welcomeTimer=setTimeout(()=>{
    if(document.hidden||state.screen!=='home'||$('.modal')||flowOwnRecords().length||state.form.vacancy.position||state.form.resume.name||state.form.resume.position)return;
    flowWrite(discoveryWelcomeKey(),true,localStorage);
    modal(`<div class="discovery-welcome-art" aria-hidden="true">${studioObject('vacancy')}${studioObject('resume')}</div><span class="discovery-welcome-eyebrow">ISHDASIZ</span><h2>Nimadan boshlaymiz?</h2><div class="discovery-welcome-choices"><button data-discovery-welcome="vacancy">${icon('users')}<span>Xodim<br>izlayapman</span>${icon('right')}</button><button data-discovery-welcome="resume">${icon('briefcase')}<span>Ish<br>izlayapman</span>${icon('right')}</button></div><button class="text-button full" data-close>Keyinroq</button>`);const welcome=$('.modal');welcome.classList.add('discovery-welcome');welcome.closest('.modal-backdrop').classList.add('polish-centered');const heading=welcome.querySelector('h2');heading.id='discovery-welcome-title';heading.tabIndex=-1;welcome.setAttribute('aria-labelledby',heading.id);heading.focus({preventScroll:true});
  },3000);
}
function discoveryBeforeRender(){
  if(flow.discoveryMap){flow.discoveryMap.off();flow.discoveryMap.stop();flow.discoveryMap.remove();flow.discoveryMap=null;}
}
function discoveryAfterRender(){
  if(flow.discoveryMap&&!$('#discovery-map')?.contains(flow.discoveryMap.getContainer())){flow.discoveryMap.remove();flow.discoveryMap=null;}
  if(state.screen==='home')discoveryMountMap();if(state.screen==='vacancy'&&state.step===2&&discoveryPoint(state.form.vacancy)&&document.querySelector('[data-map]'))document.querySelector('[data-map]').innerHTML=icon('check')+'Ish joyi belgilandi';
  if(false&&state.screen==='resume'&&state.step===4){const fields=$('#content .fields');if(fields&&!$('#discovery-resume-location'))fields.insertAdjacentHTML('beforeend',`<div id="discovery-resume-location"><button class="secondary full" data-discovery-locate="resume">${icon('pin')}${discoveryPoint(state.form.resume)?'Joylashuv qo‘shildi':'Joylashuvimni qo‘shish'}</button>${discoveryPoint(state.form.resume)?'<button class="text-button full" data-discovery-clear-location>Joylashuvni o‘chirish</button>':''}<small>Faqat masofani hisoblash uchun. Aniq nuqta nomzodlar xaritasida ko‘rsatilmaydi.</small></div>`);}
  discoveryPlanWelcome();
}
document.addEventListener('visibilitychange',discoveryPlanWelcome);
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;const stop=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(b.dataset.discoveryWelcome){stop();closeModal();flowBegin(b.dataset.discoveryWelcome);return;}
  if(b.dataset.discoveryMapList){stop();state.searchType=b.dataset.discoveryMapList;state.query='';state.region='Toshkent shahri';navigate('search');return;}
  if(b.dataset.discoveryMatchTab){stop();flow.discoveryPartial=b.dataset.discoveryMatchTab==='partial';render();return;}
  if(b.dataset.discoveryUnlock){
    stop();if(b.dataset.discoveryUnlock!=='draft'){const job=flowOwnRecords().find(r=>r.id===b.dataset.discoveryUnlock&&r.kind==='vacancy');if(!job)return;state.form.vacancy={...job};flow.activeId=job.id;flow.tx=flowId();flow.confirmedTx=null;}
    state.kind='vacancy';flow.channel=true;state.orderPaid=false;flowSaveDraft();navigate('review');return;
  }
  if(b.hasAttribute('data-discovery-clear-location')){stop();state.form.resume.coordinates=null;state.form.resume.coordinateAccuracyM=null;flowSaveDraft();render();return;}
  if(b.hasAttribute('data-map')){stop();discoveryMapPicker();return;}
  if(b.hasAttribute('data-discovery-picker-center')){stop();const center=flow.discoveryPicker?.getCenter();if(center)flow.pickerSelect([center.lat,center.lng]);return;}
  if(b.hasAttribute('data-discovery-save-point')){stop();workLocationConfirm();return;}
  if(b.dataset.discoveryLocate){stop();discoveryLocate(b.dataset.discoveryLocate);return;}
},true);
discoveryAfterRender();

/* Compensation preview: explicit units, comparable offers, no invented market data. */
function payPeriods(){return {month:{label:'Oyiga',unit:'oy'},shift:{label:'Smenaga',unit:'smena'},hour:{label:'Soatiga',unit:'soat'},service:{label:'Xizmat uchun',unit:'xizmat'}};}
function payPeriod(d){return Object.hasOwn(payPeriods(),d?.salaryPeriod)?d.salaryPeriod:'month';}
function payUnit(d){return `so‘m / ${payPeriods()[payPeriod(d)].unit}`;}
function paySameBasis(a,b){const period=payPeriod(a);return period===payPeriod(b)&&(a.salaryCurrency||'UZS')===(b.salaryCurrency||'UZS')&&(period!=='shift'||Number(a.shiftHours)>0&&Number(a.shiftHours)===Number(b.shiftHours))&&(period!=='service'||!!flowNormalize(a.salaryScope)&&flowNormalize(a.salaryScope)===flowNormalize(b.salaryScope));}
function payQuantile(values,p){const sorted=[...values].sort((a,b)=>a-b),index=(sorted.length-1)*p,low=Math.floor(index);return sorted[low]+(sorted[Math.ceil(index)]-sorted[low])*(index-low);}
function payBenchmark(subject,records=flowSearchRecords(),now=Date.now()){
  const roles=flowPositionTerms(subject.position),period=payPeriod(subject),region=flowRegionKey(subject.region),mode=flowNormalize(subject.workMode),employment=flowNormalize(subject.employment),experience=discoveryExperience(subject.experience);
  if(!subject.position||!region||!mode||!employment||experience===null)return null;
  const byEmployer=new Map(),seen=new Set();
  for(const r of records){
    if(r.kind!=='vacancy'||r.sample||r.archived||r.id===subject.id||r.account===flowAccount()||r.salaryNegotiable||r.salaryPeriod!==period||r.salaryCurrency!=='UZS'||!paySameBasis(subject,r))continue;
    const age=now-Date.parse(r.createdAt),employer=r.account||flowNormalize(r.company);
    if(!r.id||seen.has(r.id)||!employer||!Number.isFinite(age)||age<0||age>90*86400000)continue;
    if(![...flowPositionTerms(r.position)].some(role=>roles.has(role))||flowRegionKey(r.region)!==region||flowNormalize(r.workMode)!==mode||flowNormalize(r.employment)!==employment||discoveryExperience(r.experience)!==experience)continue;
    const low=Number(String(r.salaryMin||'').replaceAll(' ','')),high=Number(String(r.salaryMax||'').replaceAll(' ',''));
    if(!Number.isSafeInteger(low)||!Number.isSafeInteger(high)||low<=0||high<low||high>2147483647)continue;
    seen.add(r.id);const values=byEmployer.get(employer)||[];values.push((low+high)/2);byEmployer.set(employer,values);
  }
  // One contribution per employer prevents repeated posts from dominating the estimate.
  let values=[...byEmployer.values()].map(v=>payQuantile(v,.5));if(values.length<5)return null;
  const q1=payQuantile(values,.25),q3=payQuantile(values,.75),spread=q3-q1;
  values=values.filter(v=>spread?v>=q1-1.5*spread&&v<=q3+1.5*spread:v===q1);
  if(values.length<5)return null;
  return {median:Math.round(payQuantile(values,.5)),low:Math.round(payQuantile(values,.25)),high:Math.round(payQuantile(values,.75)),count:values.length,period};
}
function payGuide(subject){
  const estimate=payBenchmark(subject);
  if(!estimate)return `<div class="pay-guide pay-guide-empty">${icon('chart')}<div><b>Hozircha yetarli o‘xshash taklif yo‘q</b><p>Summani o‘zingiz kiriting yoki «Kelishiladi»ni tanlang.</p></div></div>`;
  return `<section class="pay-guide" aria-label="O‘xshash e’lonlardagi to‘lov"><div class="pay-guide-heading">${icon('chart')}<span>O‘xshash e’lonlardagi o‘rtacha taklif</span></div><strong>${money(estimate.median)} <small>${payUnit(subject)}</small></strong><p>${money(estimate.low)} — ${money(estimate.high)} so‘m · odatiy oraliq</p><small>Mediana · ${estimate.count} ta ish beruvchi · so‘nggi 90 kun</small><button type="button" class="text-button" data-pay-use-range>Shu oraliqni qo‘yish ${icon('right')}</button></section>`;
}
function payWarning(d){
  if(d.salaryNegotiable)return '';const min=flowNumber(d.salaryMin),max=flowNumber(d.salaryMax),estimate=payBenchmark(d);
  if(estimate&&((max||min)>0&&(max||min)<estimate.low/2||min>estimate.high*2))return 'O‘xshash takliflardan ancha farq qiladi. Summani tekshiring.';
  return '';
}
function payEntered(d){if(d.salaryNegotiable)return 'To‘lov kelishiladi';const a=flowNumber(d.salaryMin),b=flowNumber(d.salaryMax);return a||b?`${a?money(a):''}${a&&b?' — ':''}${b?money(b):''} ${payUnit(d)}`:'';}
function payStepContent(){
  const d=state.form[state.kind],period=payPeriod(d);
  return `<div class="pay-period-field"><span>To‘lov davri</span><div class="pay-periods" role="group" aria-label="To‘lov davri">${Object.entries(payPeriods()).map(([key,p])=>`<button type="button" data-pay-period="${key}" aria-pressed="${key===period}">${icon(key==='hour'||key==='shift'?'clock':key==='service'?'file':'wallet')}<span>${p.label}</span>${key===period?icon('check'):''}</button>`).join('')}</div></div>${period==='shift'?field('Bir smena necha soat?','shiftHours',{type:'number',required:true,placeholder:'Masalan: 8'}):period==='service'?field('Bitta xizmat nimani o‘z ichiga oladi?','salaryScope',{required:true,placeholder:'Masalan: 1 ta logotip tayyorlash'}):''}<div id="pay-guide-slot">${payGuide({...d,id:flow.activeId})}</div><label class="pay-negotiable"><input type="checkbox" id="pay-negotiable" ${d.salaryNegotiable?'checked':''}><span>Kelishiladi</span></label>${!d.salaryNegotiable?`<div class="field-pair">${field(state.kind==='resume'?'Kutilgan to‘lov, dan':'To‘lov, dan','salaryMin',{placeholder:'0'})}${field('Gacha','salaryMax',{placeholder:'0'})}</div>`:''}<p class="pay-entered" aria-live="polite">${esc(payEntered(d))}</p><p class="pay-warning" role="status">${esc(payWarning(d))}</p>`;
}
function payDataError(d){
  if(payPeriod(d)==='shift'&&(!Number.isFinite(Number(d.shiftHours))||Number(d.shiftHours)<1||Number(d.shiftHours)>24))return ['shiftHours','1 dan 24 gacha soat kiriting'];
  if(payPeriod(d)==='service'&&!String(d.salaryScope||'').trim())return ['salaryScope','Bitta xizmatni qisqa ta’riflang'];
  if(d.salaryNegotiable)return null;
  for(const key of ['salaryMin','salaryMax'])if(String(d[key]||'').trim()){
    const raw=String(d[key]),value=flowNumber(raw);if(!/^[0-9 ]+$/.test(raw)||!Number.isSafeInteger(value)||value<=0||value>2147483647)return [key,'Musbat summani so‘mda kiriting'];
  }
  if(!flowNumber(d.salaryMin)&&!flowNumber(d.salaryMax))return ['salaryMin','Summani kiriting yoki «Kelishiladi»ni tanlang'];
  if(flowNumber(d.salaryMax)&&flowNumber(d.salaryMin)>flowNumber(d.salaryMax))return ['salaryMax','Yuqori summa pastki summadan kam bo‘lmasin'];return null;
}
function payValidate(){
  if(state.step!==5)return true;const error=payDataError(state.form[state.kind]);if(!error)return true;flowError(document.querySelector(`[data-field="${error[0]}"]`),error[1]);return false;
}
function payValidateAll(){
  const error=payDataError(state.form[state.kind]);if(!error)return true;navigate(state.kind,{step:5});flowError(document.querySelector(`[data-field="${error[0]}"]`),error[1]);return false;
}
function payInitialize(){
  formSteps.vacancy[1]=['Ish tartibi','Ish shakli va jadval.'];formSteps.vacancy.splice(5,0,['To‘lov va maosh','To‘lov davri va miqdori.']);
  formSteps.resume.splice(3,0,['Kutilgan to‘lov','Sizga mos miqdor.']);
  if(flow.legacyPayContact)state.step=state.kind==='vacancy'?6:4;
  for(const kind of ['vacancy','resume']){Object.assign(flow.defaults[kind],{salaryPeriod:'month',salaryCurrency:'UZS',salaryNegotiable:false});state.form[kind].salaryPeriod=payPeriod(state.form[kind]);state.form[kind].salaryCurrency='UZS';}
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.payPeriod){
    event.preventDefault();event.stopImmediatePropagation();const d=state.form[state.kind],old=payPeriod(d),next=b.dataset.payPeriod;if(!Object.hasOwn(payPeriods(),next)||old===next)return;
    const key=`${flow.activeId}:${state.kind}`;flow.salaryAmounts||={};flow.salaryAmounts[key]||={};flow.salaryAmounts[key][old]={salaryMin:d.salaryMin,salaryMax:d.salaryMax};Object.assign(d,{salaryMin:'',salaryMax:''},flow.salaryAmounts[key][next]||{},{salaryPeriod:next});flowSaveDraft();const top=$('#content').scrollTop;render();$('#content').scrollTop=top;document.querySelector(`[data-pay-period="${next}"]`)?.focus({preventScroll:true});
  }
  if(b.hasAttribute('data-pay-use-range')){event.preventDefault();event.stopImmediatePropagation();const d=state.form[state.kind],estimate=payBenchmark({...d,id:flow.activeId});if(!estimate)return;Object.assign(d,{salaryMin:money(estimate.low),salaryMax:money(estimate.high),salaryNegotiable:false});flowSaveDraft();const top=$('#content').scrollTop;render();$('#content').scrollTop=top;document.querySelector('[data-field="salaryMin"]')?.focus({preventScroll:true});}
},true);
document.addEventListener('change',event=>{if(event.target.id==='pay-negotiable'){state.form[state.kind].salaryNegotiable=event.target.checked;flowSaveDraft();render();document.querySelector('#pay-negotiable')?.focus({preventScroll:true});}});
document.addEventListener('input',event=>{
  const input=event.target;if(['salaryScope','shiftHours'].includes(input.dataset.field)){const slot=$('#pay-guide-slot');if(slot)slot.innerHTML=payGuide({...state.form[state.kind],id:flow.activeId});const warning=$('.pay-warning');if(warning)warning.textContent=payWarning(state.form[state.kind]);return;}if(!['salaryMin','salaryMax'].includes(input.dataset.field))return;
  const caret=input.selectionStart,raw=input.value,before=raw.slice(0,caret).replace(/\D/g,'').length,digits=raw.replace(/\D/g,'');
  if(/^[\d ]*$/.test(raw)){
    const value=digits.replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,' ');input.value=value;state.form[state.kind][input.dataset.field]=value;
    let position=0,count=0;while(position<value.length&&count<before){if(/\d/.test(value[position]))count++;position++;}input.setSelectionRange(position,position);flowSaveDraft();
  }
  const entered=$('.pay-entered'),warning=$('.pay-warning');if(entered)entered.textContent=payEntered(state.form[state.kind]);if(warning)warning.textContent=payWarning(state.form[state.kind]);
},true);
payInitialize();

/* Explicit work-location lookup. Seeker coordinates never enter this provider flow. */
function workGeoText(value){return typeof value==='string'?value.trim().slice(0,300):'';}
function workGeoName(value){
  const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya',ў:'o',қ:'q',ғ:'g',ҳ:'h'};
  return flowNormalize(String(value||'').toLowerCase().replace(/[а-яёўқғҳ]/g,c=>letters[c]||c)).replace(/\b(viloyati?|shahri?|tumani?|region|province|district|city|oblast|oblasti|rayon|respublikasi|republic|of)\b/g,'').replace(/[^a-z0-9]/g,'');
}
function workGeoRegion(value){
  const raw=flowNormalize(value),key=workGeoName(value),catalog=window.ISHDASIZ_LOCATIONS||[];
  const exact=catalog.find(r=>flowNormalize(r.title)===raw);if(exact)return exact.title;
  const aliases={andijan:'andijon',bukhara:'buxoro',jizzakh:'jizzax',djizak:'jizzax',kashkadarya:'qashqadaryo',qashqadaryo:'qashqadaryo',navoi:'navoiy',samarkand:'samarqand',surkhandarya:'surxondaryo',sirdarya:'sirdaryo',syrdarya:'sirdaryo',fergana:'fargona',farghona:'fargona',khorezm:'xorazm',karakalpakstan:'qoraqalpogiston',tashkent:'toshkent'};
  const normalized=aliases[key]||key;
  if(normalized==='toshkent'){
    if(/viloy|region|province|oblast/.test(raw))return 'Toshkent viloyati';
    if(/shahr|city|gorod/.test(raw))return 'Toshkent shahri';
    return '';
  }
  return catalog.find(r=>workGeoName(r.title)===normalized)?.title||'';
}
function workGeoDistrict(value,region){const text=workGeoText(value),aliases={chilanzar:'chilonzor',chilanzor:'chilonzor',yunusabad:'yunusobod',mirabad:'mirobod',yakkasaray:'yakkasaroy',shaykhantakhur:'shayxontohur',shayxantaxur:'shayxontohur',sergeli:'sergeli',uchtepa:'uchtepa',bektemir:'bektemir'},key=aliases[workGeoName(text)]||workGeoName(text);return (window.ISHDASIZ_LOCATIONS||[]).find(r=>r.title===region)?.districts.find(d=>workGeoName(d)===key)||text;}
function workGeoParsed(data,point){
  const f=Array.isArray(data?.features)?data.features[0]:null,p=f?.properties||{},geometry=f?.geometry?.coordinates;
  if(!f||!Array.isArray(geometry)||geometry.length!==2||!discoveryPoint({coordinates:[geometry[1],geometry[0]]})||discoveryKm(point,[geometry[1],geometry[0]])>.5)return null;
  if(p.countrycode&&String(p.countrycode).toUpperCase()!=='UZ')return null;
  const region=workGeoRegion(p.state||p.region||'')||(!p.state&&!p.region&&['tashkent','toshkent'].includes(workGeoName(p.city))?'Toshkent shahri':''),district=workGeoDistrict(p.district||p.county||'',region),city=workGeoName(p.city)==='tashkent'?'Toshkent':workGeoText(p.city||p.town||p.village||'');
  const street=[p.street,p.housenumber].map(workGeoText).filter(Boolean).join(', '),name=workGeoText(p.name);
  return {region,district,city,address:street||(![p.state,p.city,p.district,p.country].includes(name)?name:''),addressSource:'photon'};
}
function workGeoActive(op){return !!(op&&flow.workGeo===op&&op.activeId===flow.activeId&&op.account===flowAccount()&&state.kind==='vacancy'&&state.screen==='vacancy'&&document.querySelector('[data-location-dialog]'));}
function workLocationCancel(){const op=flow.workGeo;if(op){op.controller?.abort();clearTimeout(op.timeout);flow.workGeo=null;}}
function workGeoDropMap(){if(flow.discoveryPicker){flow.discoveryPicker.off();flow.discoveryPicker.stop();flow.discoveryPicker.remove();flow.discoveryPicker=null;}flow.pickedMarker=null;}
function workGeoFields(op){
  const q=op.proposal,defs=[['region','Viloyat / shahar'],['district','Tuman'],['city','Shahar / aholi punkti'],['address','Ko‘cha, bino yoki mo‘ljal']];
  return `<div class="work-address-grid">${defs.map(([key,label])=>`<div class="${['address','city'].includes(key)?'work-address-wide':''}"><small>${label}</small><b>${esc(q[key]||'Aniqlashtiring')}</b></div>`).join('')}</div>${op.editing?`<div class="work-address-edit">${defs.map(([key,label])=>`<label class="field"><span>${label}${['region','address'].includes(key)?' *':''}</span><input id="work-location-${key}" data-location-field="${key}" ${['region','district'].includes(key)?`data-flow-combo="${key}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" autocomplete="off"`:''} value="${esc(q[key]||'')}" maxlength="${key==='address'?300:100}"></label>`).join('')}</div>`:''}<button type="button" class="text-button" data-location-edit>${icon('edit')}${op.editing?'Tahrirni tugatish':'Manzilni tahrirlash'}</button>`;
}
function workGeoRefresh(op){
  if(!workGeoActive(op))return;const details=$('#work-location-details');if(details)details.innerHTML=workGeoFields(op);
  const note=$('#work-location-status');if(note)note.textContent=op.notice||'';
  const confirm=$('[data-discovery-save-point]');if(confirm)confirm.disabled=!discoveryPoint({coordinates:op.point});
  const lookup=$('[data-location-lookup]');if(lookup)lookup.disabled=!op.point;
}
function workGeoSelect(op,point){
  if(!workGeoActive(op)||!discoveryPoint({coordinates:point}))return;
  if(op.point&&discoveryKm(op.point,point)>.002){op.proposal={region:'',district:'',city:'',address:'',addressSource:'manual'};op.notice='Nuqta o‘zgardi. Manzilni aniqlang yoki maydonlarni to‘ldiring.';op.editing=false;}
  op.point=point;op.accuracyM=null;op.origin='map';flow.pickedPoint=point;
  if(flow.pickedMarker)flow.pickedMarker.remove();flow.pickedMarker=L.circleMarker(point,{radius:9,color:'#fff',weight:3,fillColor:'#185bec',fillOpacity:1}).addTo(flow.discoveryPicker);workGeoRefresh(op);
}
function workGeoMountMap(op){
  if(!window.L||!document.querySelector('#discovery-picker'))return;
  const map=L.map('discovery-picker',{center:op.point||[41.3111,69.2797],zoom:op.point?16:12,scrollWheelZoom:false});flow.discoveryPicker=map;map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
  if(op.point)flow.pickedMarker=L.circleMarker(op.point,{radius:9,color:'#fff',weight:3,fillColor:'#185bec',fillOpacity:1}).addTo(map);
  if(op.point&&op.accuracyM>0&&op.accuracyM<5000)L.circle(op.point,{radius:op.accuracyM,weight:1,color:'#185bec',fillOpacity:.07}).addTo(map);
  flow.pickerSelect=point=>workGeoSelect(op,point);map.on('click',e=>workGeoSelect(op,[e.latlng.lat,e.latlng.lng]));
}
function workGeoDialog(op){
  if(flow.workGeo!==op)return;workGeoDropMap();
  const pending=['locating','looking'].includes(op.phase);
  const content=pending?`<div class="work-location-wait"><span>${icon('pin')}</span><h2>${op.phase==='locating'?'Joylashuv aniqlanmoqda':'Manzil aniqlanmoqda'}</h2><p>${op.phase==='locating'?'Qurilmangizda joylashuvga ruxsat bering.':'Topilgan ish joyini keyingi oynada tekshirasiz.'}</p><button class="secondary full" data-close>Bekor qilish</button></div>`:op.phase==='error'?`<div class="work-location-wait"><span>${icon('pin')}</span><h2>Joylashuv olinmadi</h2><p>${esc(op.notice)}</p><button class="primary full" data-location-retry>Qayta urinish</button><button class="text-button full" data-location-manual>Qo‘lda tanlash</button></div>`:`<span class="work-location-eyebrow">MANZILNI TASDIQLASH</span><h2 id="work-location-title">Ish joyi to‘g‘rimi?</h2><div id="discovery-picker" aria-label="Ish joyini xaritada tanlang"></div><div class="work-location-map-actions"><button type="button" class="text-button" data-discovery-picker-center>${icon('pin')}Markazni tanlash</button><button type="button" class="text-button" data-location-lookup ${op.point?'':'disabled'}>${icon('search')}Manzilni aniqlash</button><button type="button" class="text-button" data-location-start aria-label="Ish joyi lokatsiyasini qayta yuborish">${icon('pin')}Joyim</button></div><p id="work-location-status" role="status">${esc(op.notice||'')}</p>${op.accuracyM>100?`<p class="work-location-accuracy">GPS aniqligi ≈ ${money(Math.round(op.accuracyM))} m. Nuqtani tekshiring.</p>`:''}<div id="work-location-details">${workGeoFields(op)}</div><button class="primary full work-location-confirm" data-discovery-save-point ${op.point?'':'disabled'}>Ha, shu ish joyi ${icon('check')}</button><button class="text-button full" data-close>Bekor qilish</button><small class="work-location-source"><a href="https://github.com/komoot/photon" target="_blank" rel="noopener noreferrer">OpenStreetMap / Photon</a></small>`;
  modal(`<div data-location-dialog>${content}</div>`);const dialog=$('#modal-root .modal');dialog.classList.add('work-location-dialog');dialog.setAttribute('aria-label','Ish joyini tasdiqlash');const heading=dialog.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});dialog.scrollTop=0;
  if(!pending&&op.phase!=='error')workGeoMountMap(op);
}
async function workGeoConfig(){
  if(!flow.workGeoConfigPromise)flow.workGeoConfigPromise=fetch('geocoding.json',{credentials:'omit',cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('config');return r.json();}).then(config=>{const u=new URL(config.reverseUrl,location.href);if(u.protocol!=='https:'&&u.origin!==location.origin)throw Error('provider');return {...config,reverseUrl:u.href};}).catch(()=>{flow.workGeoConfigPromise=null;return null;});
  return flow.workGeoConfigPromise;
}
async function workGeoLookup(op){
  if(!workGeoActive(op)||!op.point)return;const version=op.lookupVersion=(op.lookupVersion||0)+1,current=()=>workGeoActive(op)&&op.lookupVersion===version;op.phase='looking';op.controller?.abort();const controller=op.controller=new AbortController();let timeout;workGeoDialog(op);
  const requestPoint=[...op.point],key=requestPoint.map(v=>v.toFixed(5)).join(','),cache=flow.workGeoCache||=new Map();
  let result=cache.get(key);if(result&&Date.now()-result.at>1800000)result=null;
  try{
    if(!result){
      const config=await workGeoConfig();if(!config||!current())throw Error('unavailable');
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,1500-(Date.now()-(flow.workGeoLastAt||0)))));if(!current())return;
      const url=new URL(config.reverseUrl);url.searchParams.set('lat',requestPoint[0]);url.searchParams.set('lon',requestPoint[1]);url.searchParams.set('limit','1');url.searchParams.set('radius','0.2');url.searchParams.set('lang','en');flow.workGeoLastAt=Date.now();
      timeout=op.timeout=setTimeout(()=>controller.abort(),8000);
      const response=await fetch(url.href,{credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('lookup');
      const data=await response.json();clearTimeout(timeout);const proposal=workGeoParsed(data,requestPoint);if(!proposal)throw Error('no-address');result={proposal,at:Date.now()};if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,result);
    }
    if(!current())return;op.proposal={...result.proposal};op.notice='Manzilni va xaritadagi nuqtani tekshirib tasdiqlang.';
  }catch{if(!current())return;op.proposal={region:'',district:'',city:'',address:'',addressSource:'manual'};op.notice='Manzil avtomatik topilmadi. Maydonlarni to‘ldirib tasdiqlang.';}
  finally{clearTimeout(timeout);}
  if(!current())return;op.phase='confirm';op.editing=!op.proposal.region||!op.proposal.address;workGeoDialog(op);
}
function workLocationOpen(origin='gps'){
  if(state.kind!=='vacancy'||state.screen!=='vacancy')return;workLocationCancel();
  const d=state.form.vacancy,op={activeId:flow.activeId,account:flowAccount(),origin,phase:origin==='gps'?'locating':'confirm',point:origin==='map'?discoveryPoint(d):null,accuracyM:null,proposal:origin==='map'?{region:d.region||'',district:d.district||'',city:d.city||'',address:d.address||'',addressSource:d.addressSource||'manual'}:{region:'',district:'',city:'',address:'',addressSource:'manual'},editing:false,notice:origin==='map'?'Xaritadan ish joyini tanlab, manzilni tekshiring.':''};flow.workGeo=op;workGeoDialog(op);
  if(origin==='map')return;
  const fail=error=>{if(!workGeoActive(op))return;op.phase='error';op.notice=error?.code===1?'Joylashuvga ruxsat berilmadi. Hududni qo‘lda tanlashingiz mumkin.':'GPS ishlamadi. Qayta urinib ko‘ring yoki joyni xaritadan tanlang.';workGeoDialog(op);};
  if(!navigator.geolocation){fail();return;}
  navigator.geolocation.getCurrentPosition(position=>{
    if(!workGeoActive(op))return;const point=[position.coords.latitude,position.coords.longitude];if(!discoveryPoint({coordinates:point})){fail();return;}op.point=point;op.accuracyM=Number.isFinite(position.coords.accuracy)&&position.coords.accuracy>0?position.coords.accuracy:null;workGeoLookup(op);
  },fail,{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}
function workLocationConfirm(){
  const op=flow.workGeo;if(!workGeoActive(op)||op.phase!=='confirm'||!discoveryPoint({coordinates:op.point}))return;
  const region=workGeoRegion(op.proposal.region),address=workGeoText(op.proposal.address);
  if(miniLive()&&miniState().bootstrap){const r=journeyLocations().find(r=>workGeoName(r.title)===workGeoName(region)),district=workGeoDistrict(op.proposal.district,region),t=r?.districts.find(t=>workGeoName(t.title)===workGeoName(district));if(!t){op.editing=true;workGeoRefresh(op);flowError(document.querySelector('[data-location-field=\"district\"]'),'Tumanni ro‘yxatdan tanlang');return;}op.proposal.district=t.title;}
  if(!region||!address){op.editing=true;workGeoRefresh(op);flowError(document.querySelector(`[data-location-field="${!region?'region':'address'}"]`),!region?'Ro‘yxatdan viloyat yoki shaharni tanlang':'Ko‘cha va bino yoki mo‘ljalni kiriting');return;}
  Object.assign(state.form.vacancy,{region,district:workGeoDistrict(op.proposal.district,region),city:workGeoText(op.proposal.city),address,coordinates:[...op.point],coordinateAccuracyM:op.accuracyM,locationConfirmedAt:new Date().toISOString(),locationSource:op.origin,addressSource:op.proposal.addressSource});flowSaveDraft();closeModal();render();document.querySelector('.work-location-saved')?.focus({preventScroll:true});
}
function workLocationField(){
  const d=state.form.vacancy,point=discoveryPoint(d),confirmed=point&&d.locationConfirmedAt;
  return `<section class="work-location-field" aria-label="Ish joylashgan hudud"><span class="work-location-label">Ish joylashgan hudud *</span>${confirmed?workLocationCard():`<button type="button" class="work-location-trigger" data-location-start><span class="work-location-emblem">${icon('pin')}</span><span><b>Ish joyi lokatsiyasini yuborish</b><small>Viloyat, tuman va manzilni aniqlaymiz</small></span>${icon('right')}</button><small class="work-location-hint">Ish joyida bo‘lsangiz, lokatsiyani yuboring.</small>`}<button type="button" class="text-button work-location-manual" ${confirmed?'data-map':'data-location-manual'}>${icon('edit')}${confirmed?'Manzilni o‘zgartirish':'Hududni qo‘lda tanlash'}</button>${flow.locationManualOpen?`<div class="work-location-manual-fields">${field('Viloyat yoki shahar','region',{required:true})}</div>`:''}</section>`;
}
function workLocationCard(){const d=state.form.vacancy;return `<div class="work-location-saved" tabindex="-1" role="group" aria-label="Ish joyi tasdiqlandi"><span class="work-location-emblem">${icon('pin')}</span><div><span class="work-location-verified">${icon('check')}Tasdiqlangan ish joyi</span><b>${esc(d.address)}</b><p>${esc([...new Set([d.region,d.district,d.city].filter(Boolean))].join(' · '))}</p></div></div>`;}
function workLocationDetails(){
  const d=state.form.vacancy;if(discoveryPoint(d)&&d.locationConfirmedAt)return workLocationCard()+`<button type="button" class="secondary full" data-map>${icon('pin')}Xaritada tekshirish</button>`+field('Mo‘ljal yoki qo‘shimcha izoh','landmark',{placeholder:'Masalan: bino kirishi, qavat'});
  return `<div class="polish-location-summary"><span>${icon('pin')}${esc(d.region||'Hudud tanlanmagan')}</span><button data-polish-edit-region>O‘zgartirish${icon('edit')}</button></div>`+`<button class="work-location-trigger" data-location-start><span class="work-location-emblem">${icon('pin')}</span><span><b>Lokatsiyadan manzilni to‘ldirish</b><small>Ish joyini tekshirib tasdiqlaysiz</small></span>${icon('right')}</button>`+field('Tuman yoki shahar','district')+field('Ish manzili','address',{placeholder:'Ko‘cha, bino va mo‘ljal'})+`<button class="secondary full" data-map>${icon('pin')}Xaritadan belgilash</button>`;
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;const stop=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(b.hasAttribute('data-location-start')||b.hasAttribute('data-location-retry')){stop();workLocationOpen('gps');}
  if(b.hasAttribute('data-location-manual')){stop();closeModal();flow.locationManualOpen=true;if(state.step!==0)navigate('vacancy',{step:0});else render();document.querySelector('[data-field="region"]')?.focus();}
  if(b.hasAttribute('data-location-edit')){stop();const op=flow.workGeo;if(workGeoActive(op)){op.editing=!op.editing;workGeoRefresh(op);if(op.editing)document.querySelector('[data-location-field="region"]')?.focus();}}
  if(b.hasAttribute('data-location-lookup')){stop();if(flow.workGeo)workGeoLookup(flow.workGeo);}
},true);
document.addEventListener('input',event=>{const input=event.target,key=input.dataset.locationField,op=flow.workGeo;if(!key||!workGeoActive(op))return;op.proposal[key]=input.value;op.proposal.addressSource='manual';if(key==='region'){op.proposal.district='';op.proposal.city='';for(const field of ['district','city']){const el=document.querySelector(`[data-location-field="${field}"]`);if(el)el.value='';}}flowClearError(input);});
Object.assign(flow.defaults.vacancy,{region:'',district:'',city:'',address:'',coordinates:null,locationConfirmedAt:null});
if(!flowRead('ishdasiz-v12-draft',null))Object.assign(state.form.vacancy,{region:'',district:'',city:'',address:'',coordinates:null,locationConfirmedAt:null});

/* Public-reference sector inference and accessible form choices. No AI/network calls. */
function polishSectorRules(){
  return [
    [1,'Dasturiy ta’minot',['frontend','backend','fullstack','dasturchi','developer','programmist','программист','flutter','android','ios']],
    [1,'Sinov va sifat nazorati',['qa','tester','testirov','тестировщик']],
    [1,'IT infratuzilmasi',['devops','tizim administrator','sistemniy administrator','сисадмин','network','tarmoq administrator']],
    [1,'Ma’lumotlar va sun’iy intellekt',['data analyst','data scientist','machine learning','malumotlar tahlil','ai engineer']],
    [1,'Kiberxavfsizlik',['kiber','cyber','axborot xavfsiz']],
    [1,'Raqamli dizayn',['ui','ux','grafik dizayner','web dizayn','graphic designer']],
    [2,'To‘qimachilik va tikuvchilik',['tikuvchi','швея','toquvchi','tekstil','bichuvchi']],
    [2,'Ishlab chiqarish texnologiyasi',['texnolog','stanok','tokar','ishlab chiqarish operator','технолог']],
    [2,'Muhandislik va mexanika',['muhandis','инженер','mexanik','механик']],
    [3,'Ovqatlanish xizmatlari',['oshpaz','повар','ofitsiant','официант','barista','barmen','qandolatchi']],
    [3,'Mehmonxona va turizm',['mehmonxona','hotel','turizm','tourism','gid','reception']],
    [3,'Go‘zallik xizmatlari',['sartarosh','парикмахер','barber','manikyur','kosmetolog','vizajist']],
    [3,'Tozalash xizmatlari',['farrosh','уборщик','уборщица','cleaner','tozalovchi']],
    [3,'Xavfsizlik xizmatlari',['qoriqchi','qorovul','охранник','security']],
    [3,'Foto va video xizmatlari',['fotograf','videograf','montaj','фотограф']],
    [4,'Ta’lim va o‘qitish',['oqituvchi','учитель','преподаватель','teacher','repetitor','ustoz']],
    [4,'Maktabgacha ta’lim',['tarbiyachi','воспитатель','bogcha']],
    [4,'Sport va murabbiylik',['murabbiy','trener','тренер','coach']],
    [4,'Madaniyat va san’at',['artist','aktyor','musiqa','raqqos','артист']],
    [5,'Tibbiyot',['shifokor','врач','doctor','jarroh','pediatr','terapevt']],
    [5,'Hamshiralik',['hamshira','медсестра','nurse','feldsher']],
    [5,'Farmatsiya',['farmatsevt','farmacevt','фармацевт','dorixona']],
    [5,'Stomatologiya',['stomatolog','стоматолог','dentist','tish shifokor']],
    [6,'Buxgalteriya va audit',['buxgalter','бухгалтер','hisobchi','accountant','auditor']],
    [6,'Bank va moliya',['bank','moliya','finance','kredit','iqtisodchi']],
    [6,'Kadrlar va yollash',['hr','recruiter','rekruter','kadr','рекрутер']],
    [6,'Huquq va boshqaruv',['yurist','юрист','advokat','rahbar','direktor','boshqaruvchi']],
    [7,'Qurilish va arxitektura',['quruvchi','строитель','qurilish','arxitektor','architect','prorab']],
    [7,'Elektr va montaj ishlari',['elektrik','электрик','elektromont','santexnik','сантехник','payvandchi','сварщик']],
    [8,'Dehqonchilik',['agronom','fermer','dehqon','qishloq xojali','bogbon']],
    [8,'Chorvachilik va veterinariya',['veterinar','chorva','parranda','ветеринар']],
    [9,'Transport va haydovchilik',['haydovchi','водитель','driver','taksi','avtobus']],
    [9,'Logistika va ombor',['logist','логист','omborchi','кладовщик','ekspeditor']],
    [9,'Yetkazib berish',['kuryer','kurier','курьер','courier']],
    [10,'Chakana savdo',['sotuvchi','продавец','kassir','кассир','seller','cashier']],
    [10,'Marketing va reklama',['marketolog','marketing','smm','reklama','kontent menejer','copywriter']],
    [10,'Savdo boshqaruvi',['savdo vakili','sotuv menejer','sales','merchandiser','менеджер продаж']],
    [10,'Mijozlar bilan ishlash',['call markaz','call center','koll markaz','operator koll','operator call','колл центр']]
  ];
}
function polishResolveSector(position){
  const title=flowNormalize(position);if(!title)return {category:'',categoryId:null,sectorDetail:null,sectorSource:'unclassified'};
  const sectors=window.ISHDASIZ_SECTORS||[],canonical=[...flowPositionTerms(position)][0]||title;
  if(!flow.sectorIndex){flow.sectorIndex=new Map();for(const row of window.ISHDASIZ_PROFESSION_SECTORS||[]){const key=flowNormalize(row.title);if(!flow.sectorIndex.has(key))flow.sectorIndex.set(key,row.categoryId);}}
  const referenceId=flow.sectorIndex.get(title)||flow.sectorIndex.get(canonical),words=title.split(' ');
  const matching=polishSectorRules().filter(([,detail,terms])=>terms.some(raw=>{const term=flowNormalize(raw);return term.includes(' ')?(' '+title+' ').includes(' '+term):words.some(word=>term.length<5?word===term:word.startsWith(term));}));
  const rule=matching.find(([number])=>!referenceId||referenceId===`a${String(number).padStart(7,'0')}-${String(number).padStart(4,'0')}-4000-8000-${String(number).padStart(12,'0')}`);
  const ruleId=rule?`a${String(rule[0]).padStart(7,'0')}-${String(rule[0]).padStart(4,'0')}-4000-8000-${String(rule[0]).padStart(12,'0')}`:null;
  const category=sectors.find(s=>s.id===(referenceId||ruleId));
  return category?{category:category.name_uz,categoryId:category.id,sectorDetail:rule?.[1]||null,sectorSource:referenceId?'reference':'rule'}:{category:'',categoryId:null,sectorDetail:null,sectorSource:'unclassified'};
}
function polishInferCurrent(){Object.assign(state.form[state.kind],polishResolveSector(state.form[state.kind].position));}
function polishHint(key){
  const tips={position:'Kamida 1 harf yozing. Mos lavozimni tanlang yoki o‘zingiz kiriting.',company:'Kompaniya, do‘kon yoki tashkilotning nomini yozing.',region:'Ish qidiriladigan hududni tanlang.',district:'Hududga mos tuman yoki shaharni tanlang.',salaryMin:'Summani so‘mda kiriting. Masalan: 4 000 000.',salaryMax:'Pastki summadan kam bo‘lmasin.',address:'Ko‘cha, bino va mo‘ljalni yozing; xaritada aniq nuqtani belgilang.',description:'Asosiy vazifalar va ish shartlarini qisqa yozing.',skills:'Ko‘nikmalarni vergul bilan ajrating.',phone:'Aloqa uchun boshqa raqamni ham yozishingiz mumkin.'};
  let text=tips[key]||'';if(key==='region'&&state.kind==='vacancy')text='Ish joylashgan hududni tanlang. Aniq manzil keyingi qadamda.';
  if(key==='salaryMin')text=payUnit(state.form[state.kind])+'. Summani to‘liq kiriting.';
  return text?`<small class="polish-field-hint" id="polish-hint-${state.kind}-${key}">${esc(text)}</small>`:'';
}
function polishHintMarkup(markup,key){const hint=polishHint(key);return hint?markup.replace(/<\/(label)>$/,hint+'</label>').replace(/(<(?:input|textarea)\b[^>]*)(>)/,`$1 aria-describedby="polish-hint-${state.kind}-${key}"$2`):markup;}
function polishSelectField(label,key,options){
  const current=String(state.form[state.kind][key]||''),choices=[...options.options];if(current&&!choices.includes(current))choices.unshift(current);
  (flow.selectChoices||={})[key]=choices;
  return `<label class="field polish-select-field"><span id="polish-label-${key}">${esc(label)}${options.required?' *':''}</span><span class="polish-choice-shell"><span class="polish-choice-mark">${icon('file')}</span><button type="button" class="polish-select-button" data-flow-select="${esc(key)}" aria-labelledby="polish-label-${key}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="flow-options"><span>${esc(current||'Tanlang')}</span>${icon('right')}</button></span><input type="hidden" data-field="${esc(key)}" value="${esc(current)}" ${options.required?'required':''}></label>`;
}
function polishOpenSelect(button){
  const key=button.dataset.flowSelect,choices=flow.selectChoices?.[key]||[],matches=choices.map(title=>({title}));flowCloseCombo();if(!matches.length)return;
  const popup=document.createElement('div');popup.id='flow-options';popup.className='flow-options polish-choice-options';popup.setAttribute('role','listbox');popup.setAttribute('aria-labelledby',button.getAttribute('aria-labelledby'));
  const current=state.form[state.kind][key];popup.innerHTML=matches.map((entry,index)=>`<div role="option" id="flow-option-${index}" aria-selected="${entry.title===current}" data-flow-option="${index}"><i>${icon('file')}</i><span>${esc(entry.title)}</span><b>${icon(entry.title===current?'check':'right')}</b></div>`).join('');app.append(popup);flowCombo={input:button,matches,index:matches.findIndex(v=>v.title===current),selectKey:key};button.setAttribute('aria-expanded','true');flowPositionCombo();
}
function polishPublicationNote(){
  const place=state.kind==='resume'?'Rezyume':flowFree('vacancy')?'Sayt + kanal':'Sayt';
  return `<div class="polish-publication-note" role="note" aria-label="${place}: 0 so‘m"><span class="polish-offer-seal"><strong>0 <small>so‘m</small></strong><span>${place}</span><i aria-hidden="true">${icon('spark')}</i></span></div>`;
}
function polishBaseStep(step){const current=state.step;try{state.step=step;return polishOriginalFormContent();}finally{state.step=current;}}
const polishOriginalFormContent=formContent;
formContent=function(){
  if(state.kind==='vacancy'&&state.step===0)return field('Lavozim','position',{required:true})+field('Kompaniya yoki tashkilot nomi','company',{required:true})+workLocationField();
  if(state.kind==='vacancy'&&state.step===1)return chips('Bandlik turi','employment',['To‘liq kun','Yarim kun','Shartnoma','Amaliyot'])+chips('Ish shakli','workMode',['Ish joyida','Masofaviy','Gibrid'])+chips('Ish haftasi','days',['5/2','6/1','Smenali','Moslashuvchan'])+field('Ish vaqti','hours',{placeholder:'09:00–18:00'});
  if(state.kind==='vacancy'&&state.step===2)return workLocationDetails();
  if(state.kind==='vacancy'&&state.step===5||state.kind==='resume'&&state.step===3)return payStepContent();
  if(state.kind==='vacancy'&&state.step===6)return polishBaseStep(5);
  if(state.kind==='resume'&&state.step===4)return polishBaseStep(3);
  if(state.kind==='resume'&&state.step===2)return field('Hudud','region',{options:regions})+field('Tuman yoki shahar','district')+chips('Bandlik turi','employment',['To‘liq kun','Yarim kun','Amaliyot'])+chips('Ish shakli','workMode',['Ish joyida','Masofaviy','Gibrid'])+chips('Ish haftasi','days',['5/2','6/1','Moslashuvchan']);
  return polishOriginalFormContent();
};
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.flowSelect){event.preventDefault();event.stopImmediatePropagation();if(flowCombo?.input===button)flowCloseCombo();else polishOpenSelect(button);}
  if(button.hasAttribute('data-polish-edit-region')){event.preventDefault();event.stopImmediatePropagation();flow.locationManualOpen=true;navigate('vacancy',{step:0});document.querySelector('[data-field="region"]')?.focus();}
},true);
render();

/* First-time-user creation journey. Suggestions never replace confirmed facts. */
function journeyStages(kind=state.kind){return kind==='vacancy'?[
 ['Kasb va hudud','Lavozim va ish joylashadigan tuman yoki shaharni tanlang.','briefcase'],
 ['Ish tartibi','Nomzod ish vaqti va ishlash shaklini shu yerda bilib oladi.','clock'],
 ['Aniq ish manzili','Xodim ish joyini oson topishi uchun manzilni aniqlashtiring.','pin'],
 ['Nomzodga talablar','Talab bo‘lmagan joyda «Ahamiyatsiz»ni tanlashingiz mumkin.','users'],
 ['Ish haqida va imkoniyatlar','Vazifalarni yozing. AI matnni tartibga keltirishga yordam beradi.','gift'],
 ['To‘lov va maosh','To‘lov davrini tanlab, summani to‘liq so‘mda kiriting.','wallet'],
 ['Aloqa va tekshirish','Nomzod kim bilan va qaysi raqam orqali bog‘lanadi?','phone'],
 ]:[
 ['Kasb va hudud','Qaysi kasb bo‘yicha, qaysi shahar yoki tumanda ish izlayapsiz?','briefcase'],
 ['O‘zingiz haqingizda','O‘zingizni qisqa tanishtiring. AI faqat siz bergan ma’lumotdan foydalanadi.','user'],
 ['Tajriba va ko‘nikmalar','Biladigan ishlaringizni belgilang. Tajribangiz bo‘lmasa ham davom eting.','chart'],
 ['Ta’lim va tillar','Ma’lumotingiz va biladigan tillaringizni ko‘rsating.','file'],
 ['Sizga mos ish shartlari','Siz uchun qulay ish shakli va jadvalni tanlang.','clock'],
 ['Kutilgan to‘lov','Kutayotgan summangizni yoki «Kelishiladi»ni belgilang.','wallet'],
 ['Aloqa va tekshirish','Ish beruvchi siz bilan bog‘lanishi uchun raqam kiriting.','phone'],
 ];}
function journeyStageArt(){const ic=journeyStages()[state.step]?.[2]||'file';return `<span class="journey-stage-art" aria-hidden="true"><i></i><span>${icon(ic)}</span><b>${icon('check')}</b></span>`;}
function journeyIntro(){return `<div class="journey-intro"><p>${journeyStages()[state.step]?.[1]||''}</p><span class="journey-draft-status" role="status">${icon('check')}${miniState().draftError?'Qoralamani saqlab bo‘lmadi':'Qoralama qurilmangizda saqlanadi'}</span></div>`;}
function journeyLocations(){
 const data=miniState().bootstrap;
 if(data?.regions)return data.regions.map(r=>({id:r.id,title:r.name_uz,aliases:r.name_ru,districts:data.districts.filter(d=>d.region_id===r.id).map(d=>({id:d.id,title:d.name_uz,aliases:d.name_ru}))}));
 return (window.ISHDASIZ_LOCATIONS||[]).map((r,i)=>({...r,id:miniLive()?null:i+1,districts:r.districts.map((title,j)=>({title,id:miniLive()?null:(i+1)*1000+j+1}))}));
}
function journeyPlaceSuggestions(input){
 const q=flowNormalize(input.value),d=state.form[state.kind],regions=journeyLocations();
 let rows=[];for(const r of regions){rows.push({title:r.title,subtitle:'Viloyat / shahar',placeType:'region',region:r.title,regionId:r.id,aliases:r.aliases||''});for(const t of r.districts)rows.push({title:t.title,subtitle:r.title,placeType:/shahar/i.test(t.title)?'city':'district',district:t.title,districtId:t.id,region:r.title,regionId:r.id,aliases:[t.aliases,r.title,r.aliases].filter(Boolean).join(' ')});}
 if(!q)rows=d.region?rows.filter(r=>r.placeType!=='region'&&r.region===d.region):rows.filter(r=>r.placeType==='region');
 return rows.map(r=>({...r,score:!q?1:flowNormalize(r.title)===q?5:flowNormalize(r.title).startsWith(q)?4:flowNormalize(r.title+' '+r.aliases).includes(q)?2:0})).filter(r=>r.score).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,q?12:20);
}
function journeyChoosePlace(input,entry){
 const d=state.form[state.kind];Object.assign(d,{region:entry.region,regionId:entry.regionId,district:entry.district||'',districtId:entry.districtId||null,city:entry.placeType==='city'?entry.title:'',coordinates:null,locationConfirmedAt:null,place:''});
 flowCloseCombo();flowSaveDraft();render();const next=document.querySelector('[data-flow-combo="place"]');if(next){next.focus({preventScroll:true});if(entry.placeType==='region')flowOpenCombo(next);}
}
function journeyPlaceField(){const d=state.form[state.kind];return `<label class="field flow-combo-field journey-place"><span>${state.kind==='vacancy'?'Ish joylashgan tuman yoki shahar':'Ish qidiriladigan tuman yoki shahar'} *</span><span class="flow-input-shell">${icon('pin')}<input id="journey-place" data-field="place" data-flow-combo="place" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" autocomplete="off" placeholder="${d.region?'Tumanni yoki shaharni qidiring':'Masalan: Chilonzor, Samarqand'}" value="${esc(d.place||d.district||'')}" maxlength="100"></span><small class="polish-field-hint">Tuman yoki shaharni tanlasangiz, viloyat avtomatik aniqlanadi.</small></label>${d.region?`<div class="journey-region-resolved">${icon('pin')}<span>${esc(d.region)}${d.district?' · '+esc(d.district):''}</span>${d.district?icon('check'):''}</div>`:''}<details class="journey-optional"><summary>Mahalla yoki aholi punktini qo‘shish</summary>${field('Shahar, mahalla yoki aholi punkti','city',{placeholder:'Ixtiyoriy'})}</details>`;}
function journeyAI(kind=state.kind){return `<button type="button" class="journey-ai-button" data-mini-ai><span class="journey-ai-orb">${icon('spark')}</span><span><b>${kind==='vacancy'?'Vazifalar va talablarni AI bilan yozish':'O‘zim haqimda AI bilan yozish'}</b><small>${kind==='vacancy'?'Lavozimga mos takliflarni ko‘rib, o‘zingiz tanlaysiz':'Faqat siz kiritgan tajriba va ko‘nikmalar asosida'}</small></span>${icon('right')}</button>`;}
function journeyChoiceArt(type){const shapes={meal:'M5 3v7M8 3v7M11 3v7M5 7h6M8 10v11M18 3v18M18 3c-4 4-4 8 0 8',transport:'M4 6h16v11H4ZM7 3h10M7 17v4M17 17v4M4 11h16M7 14h.01M17 14h.01',bonus:'M12 3 4 7v10l8 4 8-4V7ZM4 7l8 4 8-4M12 11v10M9 4l8 4M8 14h.01',learning:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3ZM12 6v15M6 8h3M15 8h3M6 12h3M15 12h3',official:'M6 3h10l3 3v15H6ZM15 3v5h4M9 12h7M9 16l2 2 4-4',health:'M12 21s-9-5-9-12c0-6 7-7 9-3 2-4 9-3 9 3 0 7-9 12-9 12ZM8 12h8M12 8v8',student:'m2 8 10-5 10 5-10 5ZM6 10v7c4 3 8 3 12 0v-7M22 8v8',graduate:'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h4M15 16l2 3 2-3',access:'M12 3h.01M9 7h6M12 7v7l-5 7M12 14l5 7M6 10l6 2 6-2'};return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${shapes[type]||shapes.official}"/></svg>`;}
function journeyBenefits(){const d=state.form.vacancy,selected=String(d.benefits||'').split(', '),rows=[['Rasmiy ish','Mehnat shartnomasi','official'],['Bepul tushlik','Ovqat xarajatini qoplaysiz','meal'],['Transport','Yo‘l yoki xizmat transporti','transport'],['Bonuslar','Natijaga qarab pul mukofoti','bonus'],['Ta’lim','Kurs yoki o‘qitish hisobingizdan','learning'],['Sug‘urta','Sug‘urta xarajatini qoplaysiz','health']];return `<section class="journey-benefits"><div class="journey-section-head"><span>${icon('gift')}</span><div><h2>Xodim uchun yana nimalar bor?</h2><p>Siz taqdim etadigan imkoniyatlarni belgilang.</p></div></div><div class="journey-benefit-grid">${rows.map(([value,subtitle,art])=>`<button type="button" class="journey-benefit ${selected.includes(value)?'active':''}" data-chip-key="benefits" data-chip-value="${value}" data-multi aria-pressed="${selected.includes(value)}"><span class="journey-benefit-art ${art}">${journeyChoiceArt(art)}</span><i>${icon(selected.includes(value)?'check':'plus')}</i><b>${value}</b><small>${subtitle}</small></button>`).join('')}</div>${selected.includes('Bonuslar')?field('Pul mukofoti qanday beriladi?','benefitDetails',{placeholder:'Masalan: sotuv natijasiga qarab, har oy',rows:2}):''}</section>`;}
function journeyAudience(){const d=state.form.vacancy,selected=String(d.special||'').split(', ');return `<section class="journey-audience"><h2>Quyidagilar uchun ham mos bo‘lsa, belgilang</h2><p>Bir nechta variantni tanlash mumkin.</p><div>${[['Talabalar','O‘qish bilan birga ishlash','student'],['Bitiruvchilar','Birinchi ish uchun ham mos','graduate'],['Nogironligi bor shaxslar','Sharoit va vazifalar mos','access']].map(([value,detail,art])=>`<button type="button" class="${selected.includes(value)?'active':''}" data-chip-key="special" data-chip-value="${value}" data-multi aria-pressed="${selected.includes(value)}"><span>${journeyChoiceArt(art)}</span><span><b>${value}</b><small>${detail}</small></span><i>${icon(selected.includes(value)?'check':'plus')}</i></button>`).join('')}</div></section>`;}
function journeyContent(){
 const d=state.form[state.kind],required=miniLive();
 if(state.kind==='vacancy')return [
  ()=>field('Qaysi lavozimga xodim kerak?','position',{required:true})+field('Kompaniya yoki tashkilot nomi','company',{required:true})+journeyPlaceField(),
  ()=>chips('Bandlik turi','employment',['To‘liq kun','Yarim kun','Shartnoma','Amaliyot'])+chips('Qayerda ishlaydi?','workMode',['Ish joyida','Masofaviy','Gibrid'])+chips('Ish kunlari','days',['5/2','6/1','Smenali','Moslashuvchan'])+field('Ish vaqti','hours',{placeholder:'Masalan: 09:00–18:00',required:required&&d.days!=='Moslashuvchan'}),
  ()=>`<div class="journey-region-resolved">${icon('pin')}<span>${esc([d.region,d.district,d.city].filter(Boolean).join(' · '))}</span><button data-flow-edit="0" aria-label="Hududni o‘zgartirish">${icon('edit')}</button></div>`+(d.workMode==='Masofaviy'?`<div class="journey-remote-note">${icon('home')}Masofaviy ish: aniq ofis nuqtasi shart emas.</div>`:discoveryPoint(d)&&d.locationConfirmedAt?workLocationCard()+`<button class="secondary full" data-map>${icon('pin')}Manzilni o‘zgartirish</button>`:field('Ko‘cha, bino va mo‘ljal','address',{required,placeholder:'Masalan: Amir Temur ko‘chasi, 12'})+`<button class="work-location-trigger" data-location-start><span class="work-location-emblem">${icon('pin')}</span><span><b>Ish joyi lokatsiyasini yuborish</b><small>Nuqta va topilgan manzilni tekshirib tasdiqlaysiz</small></span>${icon('right')}</button><button class="text-button full" data-map>Xaritadan o‘zim belgilayman</button>`)+field('Qo‘shimcha mo‘ljal','landmark',{placeholder:'Ixtiyoriy: kirish eshigi yoki qavat'}),
  ()=>chips('Qancha tajriba kerak?','experience',['Tajribasiz','1 yil','1–3 yil','3–5 yil','5+ yil'])+field('Ma’lumot talabi','education',{options:['Ahamiyatsiz','O‘rta','O‘rta maxsus','Oliy','Magistr']})+chips('Jins bo‘yicha talab','gender',['Ahamiyatsiz','Ayol','Erkak'])+`<details class="journey-optional"><summary>Yosh bo‘yicha talab qo‘shish</summary><div class="field-pair">${field('Yosh, dan','ageMin',{type:'number'})}${field('Gacha','ageMax',{type:'number'})}</div></details>`+chips('Qaysi tillar kerak?','languages',['O‘zbek','Rus','Ingliz'],true)+journeyAudience(),
  ()=>journeyAI()+field('Ish haqida qisqacha','description',{rows:4,required:true,placeholder:'Xodim nima qiladi? Asosiy vazifalarni oddiy qilib yozing.'})+`<details class="journey-optional" ${d.duties||d.requirements?'open':''}><summary>Vazifalar va talablarni alohida yozish</summary><div class="fields">${field('Asosiy vazifalar','duties',{rows:3})}${field('Nomzod nimalarni bilishi kerak?','requirements',{rows:3})}</div></details>`+journeyBenefits(),
  ()=>payStepContent(),
  ()=>field('Bog‘lanish uchun mas’ul shaxs','hr',{required,placeholder:'Ism yoki ism-familiya'})+field('Aloqa telefon raqami','phone',{required,type:'tel',placeholder:'+998 90 123 45 67'})+field('Telegram username','telegram',{placeholder:'Ixtiyoriy: @username'}),
 ][state.step]();
 return [
  ()=>field('Ism va familiyangiz','name',{required:true})+field('Qaysi kasb bo‘yicha ish izlayapsiz?','position',{required:true})+journeyPlaceField(),
  ()=>field('Tug‘ilgan sana','birthdate',{type:'date',required})+chips('Jins','gender',['Ayol','Erkak'])+journeyAI()+field('O‘zingiz haqingizda','about',{rows:4,required,placeholder:'Nimalarni bilasiz va qanday ish izlayapsiz?'}),
  ()=>chips('Ish tajribangiz','experience',['Tajribasiz','1 yil','1–3 yil','3–5 yil','5+ yil'])+(d.experience&&d.experience!=='Tajribasiz'?`<div class="journey-history"><h2>Oxirgi ish joyingiz</h2>${field('Kompaniya yoki tashkilot','workplace',{required})}${field('Ishlagan lavozimingiz','worktitle',{required})}<div class="field-pair">${field('Boshlagan yil','workstart',{type:'number',required})}${!d.workCurrent?field('Tugatgan yil','workend',{type:'number',required}):''}</div><label class="journey-check"><input type="checkbox" data-journey-toggle="workCurrent" ${d.workCurrent?'checked':''}>Hozir ham shu yerda ishlayman</label></div>`:'')+field('Ko‘nikmalaringiz','skills',{required,placeholder:'Masalan: Excel, savdo, rus tili'})+`<button class="text-button" data-mini-ai>${icon('spark')}Ko‘nikmalarni AI bilan tartiblash</button>`,
  ()=>field('Ma’lumotingiz','education',{options:['O‘rta','O‘rta maxsus','Tugallanmagan oliy','Oliy','Magistr']})+(['Oliy','Magistr'].includes(d.education)?`<div class="journey-history"><h2>Ta’lim tafsilotlari</h2>${field('O‘quv yurti','school',{required})}${field('Yo‘nalish yoki mutaxassislik','specialty',{required})}<div class="field-pair">${field('Boshlagan yil','schoolstart',{type:'number',required})}${!d.schoolCurrent?field('Tugatgan yil','schoolend',{type:'number',required}):''}</div><label class="journey-check"><input type="checkbox" data-journey-toggle="schoolCurrent" ${d.schoolCurrent?'checked':''}>Hozir ham o‘qiyman</label></div>`:'')+chips('Qaysi tillarni bilasiz?','languages',['O‘zbek','Rus','Ingliz'],true),
  ()=>chips('Qayerda ishlash qulay?','workMode',['Ish joyida','Masofaviy','Gibrid'])+chips('Bandlik turi','employment',['To‘liq kun','Yarim kun','Amaliyot'])+chips('Ish kunlari','days',['5/2','6/1','Moslashuvchan'])+`<button class="secondary full" data-discovery-locate="resume">${icon('pin')}${discoveryPoint(d)?'Joylashuv qo‘shildi':'Yaqin ishlarni topish uchun joylashuvim'}</button><small class="polish-field-hint">Ixtiyoriy. Aniq nuqtangiz ommaviy xaritada ko‘rsatilmaydi.</small>`,
  ()=>payStepContent(),
  ()=>field('Bog‘lanish uchun telefon','phone',{required,type:'tel',placeholder:'+998 90 123 45 67'})+field('Telegram username','telegram',{placeholder:'Ixtiyoriy: @username'}),
 ][state.step]();
}
function journeyFirstError(at=null){
 const d=state.form[state.kind],live=miniLive(),missing=(key,step,message)=>!String(d[key]||'').trim()?{key,step,message}:null;
 for(const [key,step] of state.kind==='vacancy'?[['position',0],['company',0],['description',4],...(live?[['hr',6],['phone',6]]:[])]:[['name',0],['position',0],...(live?[['birthdate',1],['gender',1],['about',1],['skills',2],['languages',3],['phone',6]]:[])]){if(at!==null&&at!==step)continue;const e=missing(key,step,'Bu maydonni to‘ldiring');if(e)return e;}
 if(at===null||at===0){if(String(d.position||'').trim().length<3)return {key:'position',step:0,message:'Lavozimni to‘liq yozing yoki ro‘yxatdan tanlang'};if(state.kind==='vacancy'&&String(d.company||'').trim().length<3)return {key:'company',step:0,message:'Kompaniya yoki tashkilot nomini to‘liq yozing'};if(state.kind==='resume'&&(String(d.name||'').match(/\p{L}/gu)||[]).length<3)return {key:'name',step:0,message:'Ism va familiyangizni to‘liq yozing'};}
 if((at===null||at===0)&&(!d.region||!d.district||live&&(!d.regionId||!d.districtId)))return {key:'place',step:0,message:'Ro‘yxatdan tuman yoki shaharni tanlang'};
 const workStep=state.kind==='vacancy'?1:4;for(const key of ['workMode','employment','days'])if(live&&(at===null||at===workStep)&&!d[key])return {key,step:workStep,message:'Mos variantni tanlang'};
 if(live&&(at===null||at===6)&&state.kind==='vacancy'&&!d.hr.trim().match(/\p{L}.*\p{L}.*\p{L}/u))return {key:'hr',step:6,message:'Mas’ul shaxsning ismini to‘liq kiriting'};
 if(live&&(at===null||at===6)&&d.phone&&!/^\+?998\d{9}$/.test(d.phone.replace(/[\s()-]/g,'')))return {key:'phone',step:6,message:'+998 va 9 ta raqam kiriting'};
 if((at===null||at===2)&&state.kind==='vacancy'&&d.workMode!=='Masofaviy'&&!discoveryPoint(d))return {key:'address',step:2,message:'Ish joyini xaritada tasdiqlang'};
 if(live&&(at===null||at===2)&&state.kind==='resume'&&d.experience!=='Tajribasiz')for(const key of ['workplace','worktitle','workstart',...(!d.workCurrent?['workend']:[])]){const e=missing(key,2,'Ish tajribasi ma’lumotini kiriting');if(e)return e;}
 if(live&&(at===null||at===3)&&state.kind==='resume'&&['Oliy','Magistr'].includes(d.education))for(const key of ['school','specialty','schoolstart',...(!d.schoolCurrent?['schoolend']:[])]){const e=missing(key,3,'Ta’lim ma’lumotini kiriting');if(e)return e;}
 return null;
}
function journeyShowError(error){if(state.step!==error.step)navigate(state.kind,{step:error.step});const input=document.querySelector(`[data-field="${error.key}"]`);if(input)flowError(input,error.message);else{toast(error.message);document.querySelector(`[data-chip-key="${error.key}"], [data-map]`)?.focus();}return false;}
function journeyInitialize(){
 for(const kind of ['vacancy','resume']){formSteps[kind]=journeyStages(kind).map(([title,help])=>[title,help]);Object.assign(flow.defaults[kind],{place:'',region:'',district:'',regionId:null,districtId:null,city:'',ageMin:'',ageMax:'',about:'',skills:'',hr:'',languages:'',workCurrent:false,schoolCurrent:false,birthdate:'',workplace:'',worktitle:'',workstart:'',workend:'',school:'',specialty:'',schoolstart:'',schoolend:'',benefits:'',benefitDetails:'',description:'',duties:'',requirements:'',special:'',coordinates:null,locationConfirmedAt:'',address:'',landmark:'',hours:'',experience:'Tajribasiz'});}
 flow.defaults.resume.gender=''; const priorForm=formContent;formContent=function(){return ['vacancy','resume'].includes(state.kind)?journeyContent():priorForm();};
 polishPublicationNote=function(){if(state.step!==0)return journeyStageArt();return `<div class="polish-publication-note" role="note" aria-label="E’lon joylash bepul: 0 so‘m"><span class="polish-offer-seal"><strong>0 <small>so‘m</small></strong><span>E’lon joylash bepul</span><i aria-hidden="true">${icon('spark')}</i></span></div>`;};
 const oldHint=polishHint;polishHint=function(key){const lines={position:'Kamida 1 harf yozing. Ro‘yxatdan tanlang yoki lavozimni o‘zingiz yozing.',company:'Do‘kon, korxona yoki tashkilot nomini yozing.',phone:'Nomzod yoki ish beruvchi shu raqamga bog‘lanadi. Boshqa raqam ham mumkin.',description:'Xodim nima qiladi va nimalarni bilishi kerak? 2–3 gap bilan boshlang.',about:'Ko‘nikma va ish izlash maqsadingizni qisqa yozing.',skills:'Bir nechta ko‘nikmani vergul bilan ajrating.',workstart:'Faqat yil: masalan, 2022.',workend:'Faqat yil. Hali ishlasangiz pastdagi belgi orqali ko‘rsating.'};return lines[key]?`<small class="polish-field-hint" id="polish-hint-${state.kind}-${key}">${lines[key]}</small>`:oldHint(key);};
 const oldValidate=flowValidateStep;flowValidateStep=function(){const error=journeyFirstError(state.step);if(error)return journeyShowError(error);return oldValidate();};
 flowValidateAll=function(){const error=journeyFirstError();if(error)return journeyShowError(error);return payValidateAll();};
}
document.addEventListener('change',event=>{const key=event.target.dataset.journeyToggle;if(key){state.form[state.kind][key]=event.target.checked;flowSaveDraft();const top=$('#content').scrollTop;render();$('#content').scrollTop=top;}});
document.addEventListener('input',event=>{if(event.target.dataset.field==='place'){Object.assign(state.form[state.kind],{districtId:null,regionId:null,district:'',city:'',coordinates:null,locationConfirmedAt:null});miniState().touched=true;}});
journeyInitialize();

/* Real endpoints are the default. Demo mode is only an explicit QA harness flag. */
function miniLive(){return window.ISHDASIZ_DEMO!==true;}
function miniState(){return flow.mini||=( {user:null,bootstrap:null,own:[],jobs:[],mapJobs:[],mapPage:0,mapTotal:null,jobCount:null,resumeCount:null,sessionReady:false,touched:false,loading:false,applications:[],candidateCache:{}} );}
async function miniAPI(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(path.includes('/assistant')||options.method==='POST'&&path.includes('/records')?60000:path.includes('/map/jobs')?35000:20000),...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.error||'Xizmat vaqtincha mavjud emas. Qoralama saqlangan.');error.status=response.status;error.data=data;throw error;}return data;
}
function miniOwner(){return miniState().user?.id||'guest';}
function miniDraftList(owner=miniOwner()){return flowRead('ishdasiz-mini-drafts:'+owner,[],localStorage).filter(d=>d&&typeof d.id==='string'&&['vacancy','resume'].includes(d.kind));}
function miniSaveDraft(){
 if(!miniLive()||!['vacancy','resume','review','auth'].includes(state.screen)||flow.confirmedTx===flow.tx)return;
 const form=state.form[state.kind];if(!form.position&&!form.name&&!form.company)return;
 const m=miniState(),list=miniDraftList(),entry={id:flow.activeId,kind:state.kind,form:structuredClone(form),step:state.step,updatedAt:new Date().toISOString()},index=list.findIndex(d=>d.id===entry.id);if(index<0)list.push(entry);else list[index]=entry;
 try{localStorage.setItem('ishdasiz-mini-drafts:'+miniOwner(),JSON.stringify(list));m.draftError=false;}catch{m.draftError=true;}
}
function miniDeleteDraft(id){for(const owner of new Set([miniOwner(),'guest'])){try{localStorage.setItem('ishdasiz-mini-drafts:'+owner,JSON.stringify(miniDraftList(owner).filter(d=>d.id!==id)));}catch{miniState().draftError=true;}}}
function miniResumeDraft(draft){
 state.kind=draft.kind;state.form[draft.kind]={...structuredClone(flow.defaults[draft.kind]),...draft.form};flow.activeId=draft.id;flow.tx=flowId();flow.confirmedTx=null;flow.channel=false;state.orderPaid=false;navigate(draft.kind,{step:Math.min(6,Math.max(0,draft.step||0))});miniResolveStoredPlaces();
}
function miniNewDraft(kind){
 flowClearMedia();state.kind=kind;state.form[kind]=structuredClone(flow.defaults[kind]);if(miniState().user?.phone)state.form[kind].phone=miniState().user.phone;flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=false;state.orderPaid=false;navigate(kind,{step:0});
}
async function miniStart(kind){
 miniSaveDraft();if(miniState().bootPromise)try{await miniState().bootPromise;}catch{miniState().bootstrapError=true;}const drafts=miniDraftList().filter(d=>d.kind===kind).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 if(!drafts.length){miniNewDraft(kind);return;}miniState().pendingDraft=drafts[0];miniState().pendingKind=kind;
 modal(`<span class="journey-modal-kicker">QORALAMA SAQLANGAN</span><h2>To‘xtagan joyingizdan davom eting</h2><p>${esc(drafts[0].form.position||'Yangi e’lon')} · ${drafts[0].step+1} / 7 qadam</p><button class="primary full" data-mini-resume-draft>Davom ettirish ${icon('right')}</button><button class="text-button full" data-mini-new-draft>Yangi e’lon boshlash</button>`);
}
function miniResolveStoredPlaces(){
 for(const kind of ['vacancy','resume']){const d=state.form[kind],region=journeyLocations().find(r=>flowRegionKey(r.title)===flowRegionKey(d.region)),district=region?.districts.find(t=>workGeoName(t.title)===workGeoName(d.district));if(region&&district){d.region=region.title;d.district=district.title;d.regionId=region.id;d.districtId=district.id;}else{d.regionId=null;d.districtId=null;}}
}
const miniRelation=v=>Array.isArray(v)?v[0]||{}:v||{};
function miniJob(row,metadata=null){
 const modes={'onsite':'Ish joyida','remote':'Masofaviy','hybrid':'Gibrid','1':'Ish joyida','2':'Masofaviy','3':'Masofaviy','4':'Gibrid'},employment={'full_time':'To‘liq kun','part_time':'Yarim kun','contract':'Shartnoma','internship':'Amaliyot'};
 const meta=metadata||row.compensation||{};return {...meta,id:row.id,kind:'vacancy',remote:true,position:row.title_uz||row.title_ru,company:row.company_name,region:miniRelation(row.regions).name_uz||'',district:miniRelation(row.districts).name_uz||'',regionId:row.region_id,districtId:row.district_id,
 salaryMin:row.salary_min??'',salaryMax:row.salary_max??'',salaryUnitUnknown:!meta.salaryPeriod,employment:employment[row.employment_type]||row.employment_type||'',workMode:modes[row.work_mode]||row.work_mode||'',description:row.description_uz||row.description_ru||meta.description||'',address:row.address||meta.address||'',
 coordinates:Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)?[row.latitude,row.longitude]:null,createdAt:row.created_at,views:row.views_count,phone:row.contact_phone||row.phone||'',telegram:row.contact_telegram||'',isImported:row.is_imported===true};
}
function miniOwnRow(row,entry,kind){const metadata=entry?.metadata||{};if(kind==='vacancy')return {...miniJob(row,metadata),id:row.id,kind,account:miniOwner(),remote:false,updatedAt:row.updated_at};return {...metadata,id:row.id,kind,account:miniOwner(),remote:false,position:row.title,name:row.full_name,phone:row.phone,about:row.about??metadata.about,skills:Array.isArray(row.skills)?row.skills.join(', '):metadata.skills,salaryUnitUnknown:!metadata.salaryPeriod,region:miniRelation(row.regions).name_uz||metadata.region||'',district:miniRelation(row.districts).name_uz||metadata.district||'',salaryMin:row.expected_salary_min??'',salaryMax:row.expected_salary_max??'',views:row.views??row.views_count,createdAt:row.created_at,updatedAt:row.updated_at};}
async function miniLoadOwn(){if(!miniState().user)return;const owner=miniOwner();try{const data=await miniAPI('/api/mini-app/records');const m=miniState();if(miniOwner()!==owner)return;m.own=[...(data.jobs||[]).map(r=>miniOwnRow(r,data.entries?.find(e=>e.id===r.id),'vacancy')),...(data.resumes||[]).map(r=>miniOwnRow(r,data.entries?.find(e=>e.id===r.id),'resume'))];m.ownCounts=data.counts;m.ownError=false;}catch(e){if(e.status===401)miniForgetUser();else miniState().ownError=true;}}
function miniForgetUser(){const m=miniState();m.user=null;m.own=[];m.candidateCache={};m.applications=[];m.ownCounts=null;m.lastSaved=null;m.candidateJob=null;m.applicationKey=null;m.recommendations=[];m.recommendationKey=null;state.loggedIn=false;state.phone='';}
async function miniSession(){try{const data=await miniAPI('/api/auth/session');miniState().user=data.user;state.loggedIn=!!data.user;state.phone=data.user?.phone||'';}catch(e){miniForgetUser();if(e.status!==401)miniState().sessionError=true;}miniState().sessionReady=true;}
async function miniBoot(){
 if(!miniLive())return;const m=miniState();m.bootPromise=(async()=>{
  const result=await Promise.allSettled([miniAPI('/api/mini-app/bootstrap'),miniSession()]);
  if(result[0].status==='fulfilled'){m.bootstrap=result[0].value;m.jobCount=m.bootstrap.stats.availableJobs;m.resumeCount=m.bootstrap.resumeCount;miniResolveStoredPlaces();}else m.bootstrapError=true;
  if(!m.user&&!m.sessionError&&window.Telegram?.WebApp?.initData){try{const auth=await miniAPI('/api/telegram/webapp-auth',{method:'POST',body:JSON.stringify({initData:window.Telegram.WebApp.initData})});if(auth.user?.id){m.user=auth.user;state.loggedIn=true;state.phone=auth.user.phone;}}catch{/* Phone verification remains available at publication. */}}
  await miniLoadOwn();if(['vacancy','resume'].includes(state.screen)&&!m.touched){const saved=miniDraftList().filter(d=>d.kind===state.kind).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];if(saved)miniResumeDraft(saved);}
  render();miniLoadCatalog();miniLoadMap();
 })();await m.bootPromise;
}
function miniFilterParams(){const p=new URLSearchParams(),m=miniState();if(state.query.trim())p.set('q',state.query.trim());const region=m.bootstrap?.regions.find(r=>flowRegionKey(r.name_uz)===flowRegionKey(state.region));if(region)p.set('region',region.id);if(flow.salaryFrom||flow.salaryTo)p.set('salary',(flowNumber(flow.salaryFrom)||0)+'-'+(flowNumber(flow.salaryTo)||''));if(flow.salaryFilterPeriod)p.set('period',flow.salaryFilterPeriod);return p;}
async function miniLoadCatalog(more=false){
 if(!miniLive())return;const m=miniState(),p=miniFilterParams(),signature=p.toString();if(m.loading&&(more||m.querySignature===signature))return;
 m.catalogAbort?.abort();m.catalogAbort=new AbortController();m.querySignature=signature;const page=more?(m.page||1)+1:1;p.set('page',page);m.loading=true;m.catalogError=false;if(state.screen==='search')flowSearchUpdate();
 try{const data=await miniAPI('/api/mini-app/catalog?'+p,{signal:m.catalogAbort.signal});if(m.querySignature!==signature)return;const combined=more?[...m.jobs,...data.data.map(r=>miniJob(r))]:data.data.map(r=>miniJob(r));m.jobs=[...new Map(combined.map(r=>[r.id,r])).values()];m.page=page;m.catalogCount=data.count;}
 catch(e){if(e.name==='AbortError')return;m.catalogError=true;if(!more)m.jobs=[];}finally{if(m.querySignature===signature){m.loading=false;if(state.screen==='search')flowSearchUpdate();}}
}
async function miniLoadMap(){
 const m=miniState();if(!miniLive()||m.mapLoading||m.mapTotal!==null&&m.mapJobs.length>=m.mapTotal)return;m.mapLoading=true;
 try{for(let i=0;i<4;i++){const data=await miniAPI('/api/map/jobs?page='+m.mapPage);m.mapTotal=data.total;const ids=new Set(m.mapJobs.map(r=>r.id));m.mapJobs.push(...data.jobs.filter(r=>!ids.has(r.id)).map(r=>miniJob(r)));m.mapPage++;miniUpdateMap();if(m.mapJobs.length>=data.total)break;}m.mapError=false;}catch{m.mapError=true;}finally{m.mapLoading=false;miniUpdateMap();}
}
function miniMapCounts(){return {jobs:miniState().jobCount??'—',resumes:miniState().resumeCount??'—'};}
function miniHomeMap(){const counts=miniMapCounts();return `<section class="discovery-map-card"><header><div><span>${icon('pin')}O‘zbekiston bo‘ylab</span><h2>Haqiqiy ish imkoniyatlari</h2></div></header><div class="discovery-map-surface"><div id="discovery-map" aria-label="Vakansiyalar xaritasi"></div><div class="discovery-map-tools"><button data-discovery-locate="map" aria-label="Joylashuvim">${icon('pin')}</button></div><div class="discovery-map-error" ${miniState().bootstrapError?'':'hidden'}>Ma’lumot yuklanmadi. Qayta urinib ko‘ring.</div></div><div class="discovery-map-counts"><button data-mini-find-jobs>${icon('briefcase')}<span><b id="discovery-job-count">${typeof counts.jobs==='number'?money(counts.jobs):counts.jobs}</b> vakansiya</span>${icon('right')}</button><button data-discovery-map-list="resumes">${icon('users')}<span><b id="discovery-resume-count">${typeof counts.resumes==='number'?money(counts.resumes):counts.resumes}</b> rezyume</span>${icon('right')}</button></div><button type="button" class="text-button journey-map-more" data-mini-more-map>Ko‘proq joylarni ko‘rsatish ${icon('plus')}</button></section>`;}
function miniMountMap(){const target=$('#discovery-map');if(!target||target.dataset.ready)return;target.dataset.ready='true';if(!window.L)return;const m=miniState(),map=L.map(target,{center:flow.mapCenter||[41.3111,69.2797],zoom:flow.mapZoom||12,scrollWheelZoom:false,zoomControl:false});flow.discoveryMap=map;L.control.zoom({position:'bottomright'}).addTo(map);map.attributionControl.setPrefix(false);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);m.mapLayers=L.layerGroup().addTo(map);map.on('moveend',()=>{const c=map.getCenter();flow.mapCenter=[c.lat,c.lng];flow.mapZoom=map.getZoom();});miniUpdateMap();}
function miniUpdateMap(){const m=miniState(),map=flow.discoveryMap;if(!map||!m.mapLayers||m.mapLayers._map!==map)return;m.mapLayers.clearLayers();
 const city=m.bootstrap?.stats.byRegion.find(r=>/toshkent.*shah/i.test(r.name_uz||''));if(city)L.marker([41.3111,69.2797],{icon:L.divIcon({className:'discovery-map-cluster',html:`<button data-mini-city-jobs aria-label="Toshkent shahri bo‘yicha vakansiyalar">${icon('briefcase')}<b>${money(city.count)}</b></button>`,iconSize:[88,46],iconAnchor:[44,23]})}).addTo(m.mapLayers).bindTooltip('Toshkent shahri bo‘yicha jami');
 for(const r of m.mapJobs){if(!discoveryPoint(r))continue;L.circleMarker(r.coordinates,{radius:5,color:'#fff',weight:1.5,fillColor:'#185bec',fillOpacity:.8}).addTo(m.mapLayers).bindTooltip(esc(r.position)).on('click',()=>miniDetails(r.id));}
 const error=$('.discovery-map-error');if(error){error.hidden=!m.mapError;error.textContent='Xaritadagi nuqtalarni yuklab bo‘lmadi. Qayta urinib ko‘ring.';}
 const more=$('[data-mini-more-map]');if(more){more.disabled=m.mapLoading;more.textContent=m.mapLoading?'Joylar yuklanmoqda…':m.mapError?'Xaritani qayta yuklash':m.mapTotal!==null&&m.mapJobs.length>=m.mapTotal?'Xaritadagi joylar yuklandi':`Yana nuqtalar · ${money(m.mapJobs.length)} / ${money(m.mapTotal||0)}`;}
}
function miniResults(){const m=miniState();if(state.searchType==='resumes')return miniCandidateSection();if(m.catalogError)return `<div class="fresh-empty">${icon('search')}<h2>Qidiruvni yuklab bo‘lmadi</h2><button class="secondary full" data-mini-retry-search>Qayta urinish</button></div>`;if(m.loading&&!m.jobs.length)return `<div class="journey-loading" role="status">${icon('search')}Vakansiyalar yuklanmoqda…</div>`;
 return `<p class="fresh-result-caption">${m.catalogCount??'…'} ta vakansiya</p>`+m.jobs.map(r=>`<article class="fresh-result-card"><div class="fresh-card-header"><span class="fresh-company-icon">${icon('briefcase')}</span><div><p>${esc(r.company)}</p><h2>${esc(r.position)}</h2></div></div><p class="fresh-salary">${flowSalaryLabel(r)}</p><p class="fresh-location">${icon('pin')}${esc([r.region,r.district].filter(Boolean).join(' · '))}</p><button class="secondary full" data-flow-detail="${r.id}">Batafsil ${icon('right')}</button></article>`).join('')+(m.jobs.length<(m.catalogCount||0)?'<button class="secondary full" data-mini-more-search>Yana vakansiyalar</button>':m.jobs.length?'':`<div class="fresh-empty"><h2>Hozircha mos vakansiya topilmadi</h2><button class="secondary full" data-flow-reset>Filtrlarni tozalash</button></div>`);
}
async function miniDetails(id){
 const own=miniState().own.find(r=>r.id===id);if(own?.kind==='resume'){modal(`<h2>${esc(own.position)}</h2><p>${esc(own.name)}</p><strong class="flow-detail-salary">${flowSalaryLabel(own)}</strong><p>${esc(own.about||'')}</p><p>${esc(own.skills||'')}</p><button class="secondary full" data-flow-contact="${id}">${icon('phone')}Kontakt</button>`);return;}
 try{const data=await miniAPI('/api/jobs/'+encodeURIComponent(id)),r=miniJob(data.job);miniState().detail=r;modal(`<h2>${esc(r.position)}</h2><p>${esc(r.company)}</p><strong class="flow-detail-salary">${flowSalaryLabel(r)}</strong><p>${esc([r.region,r.district,r.address].filter(Boolean).join(' · '))}</p><p class="journey-detail-copy">${esc(r.description)}</p>${discoveryPoint(r)?`<a class="secondary full" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${r.coordinates[0]}&mlon=${r.coordinates[1]}#map=16/${r.coordinates[0]}/${r.coordinates[1]}">${icon('pin')}Xaritada ko‘rish</a>`:''}<button class="primary full" data-flow-contact="${id}">${icon('phone')}Bog‘lanish</button>${!r.isImported?`<button class="secondary full" data-mini-apply="${id}">Ariza topshirish ${icon('right')}</button>`:''}`);}catch(e){toast(e.message);}
}
function miniReview(){const d=state.form[state.kind],resume=state.kind==='resume';return `<section class="view flow-review">${freshTitle(resume?'Rezyumeni tekshiring':'Vakansiyani tekshiring')}<article class="flow-summary"><div class="flow-summary-label"><span>${icon(resume?'file':'briefcase')}${resume?'Rezyume':'Vakansiya'}</span><button data-flow-edit="0">${icon('edit')}Tahrirlash</button></div><h2>${esc(d.position)}</h2><p>${esc(resume?d.name:d.company)}</p><strong>${flowSalaryLabel(d)}</strong><span class="flow-summary-region">${icon('pin')}${esc([d.region,d.district,d.city].filter(Boolean).join(' · '))}</span><p class="journey-detail-copy">${esc(resume?d.about:[d.description,d.duties].filter(Boolean).join('\n\n'))}</p></article>${!resume?`<label class="journey-channel-option"><span>${icon('telegram')}</span><span><b>Kanalda ham joylash</b><small>@ishdasiz</small></span><input type="checkbox" id="flow-channel" ${flow.confirming?'disabled':''} ${flow.channel?'checked':''}></label>`:`<div class="discovery-base-note">${icon('shield')}Rezyumengiz nomzodlar bazasida saqlanadi.</div>`}<div class="journey-review-note">${icon('check')}Joylashdan oldin matn va kontaktlarni tekshiring.</div><div class="form-footer"><button class="secondary" data-flow-edit="6">Orqaga</button><button class="primary" data-flow-publish ${flow.confirming?'disabled':''}>${flow.confirming?'Tekshirilmoqda…':state.loggedIn?'Tasdiqlash va joylash':'Kirish va joylash'} ${icon('right')}</button></div></section>`;}
function miniAuth(){const m=miniState();return `<section class="view fresh-auth">${freshTitle(m.pendingPublish?'E’lonni joylash uchun kirish':'Profilga kirish',m.pendingPublish?'review':'profile')}<div class="journey-auth-card"><span>${icon('shield')}</span><h2>${m.pendingPublish?'Qoralamangiz tayyor.':'Bitta raqam. Bitta profil.'}</h2><p>${m.pendingPublish?'Raqamingizni tasdiqlang — kiritgan ma’lumotlaringiz saqlanadi.':'Rezyume, vakansiya va arizalaringiz shu yerda.'}</p></div>${window.Telegram?.WebApp?.initData?`<button class="primary full journey-auth-telegram" data-mini-telegram>${icon('telegram')}Telegram orqali kirish</button>`:''}${m.authStage==='otp'?`<form id="mini-otp-form" class="fields"><label class="field"><span>${esc(m.authPhone)} raqamiga yuborilgan kod</span><input id="mini-otp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="5" pattern="[0-9]{5}" required></label><button class="primary full" type="submit">Tasdiqlash va davom etish ${icon('right')}</button></form><button class="text-button full" data-mini-resend>Kod kelmadimi? Qayta yuborish</button><button class="text-button full" data-mini-auth-reset>Boshqa raqam</button>`:`<form id="mini-phone-form" class="fields"><label class="field"><span>Telefon raqamingiz</span><input id="mini-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998 90 123 45 67" value="${esc(m.authPhone||state.form[state.kind].phone||'')}" required></label><button class="primary full" type="submit">Davom etish ${icon('right')}</button></form>`}<p class="journey-auth-error" role="alert">${esc(m.authError||'')}</p></section>`;}
async function miniPhoneSubmit(){const m=miniState(),phone=$('#mini-phone').value.replace(/[\s()-]/g,'');if(!/^\+?998\d{9}$/.test(phone)){flowError($('#mini-phone'),'+998 va 9 ta raqam kiriting');return;}m.authPhone=phone.startsWith('+')?phone:'+'+phone;m.authError='';try{const data=await miniAPI('/api/auth/check-user',{method:'POST',body:JSON.stringify({phone:m.authPhone})});if(!data.exists){modal(`<h2>Bu raqamda hisob topilmadi</h2><p>${esc(m.authPhone)} bilan ro‘yxatdan o‘tishni xohlaysizmi?</p><button class="primary full" data-mini-register>Ha, ro‘yxatdan o‘tish</button><button class="text-button full" data-close>Boshqa raqam kiritaman</button>`);return;}await miniSendOtp();}catch(e){m.authError=e.message;render();}}
async function miniSendOtp(){const m=miniState();if(m.authBusy)return;m.authBusy=true;closeModal();try{await miniAPI('/api/auth/send-otp',{method:'POST',body:JSON.stringify({phone:m.authPhone})});m.authStage='otp';m.authError='';render();$('#mini-otp-code')?.focus();}catch(e){m.authError=e.message;render();}finally{m.authBusy=false;}}
async function miniVerify(){const m=miniState(),code=$('#mini-otp-code').value.trim();if(!/^\d{5}$/.test(code)){flowError($('#mini-otp-code'),'5 xonali kodni kiriting');return;}try{const result=await miniAPI('/api/auth/verify-otp',{method:'POST',body:JSON.stringify({phone:m.authPhone,code,role:state.kind==='vacancy'?'employer':'job_seeker'})});if(result.needsRestoration){m.authError='Hisob yopilgan. Sayt orqali hisobni tiklang.';render();return;}await miniAuthDone(result.user);}catch(e){m.authError=e.message;render();}}
async function miniTelegram(){try{const result=await miniAPI('/api/telegram/webapp-auth',{method:'POST',body:JSON.stringify({initData:window.Telegram?.WebApp?.initData})});await miniAuthDone(result.user);}catch(e){miniState().authError=e.status===404?'Telegram raqami bog‘lanmagan. Telefon orqali tasdiqlang.':e.message;render();}}
async function miniAuthDone(user){if(!user?.id)throw Error('Kirish tasdiqlanmadi');const m=miniState();if(m.user&&m.user.id!==user.id){miniSaveDraft();miniForgetUser();if(!m.pendingPublish)miniClearFormMemory();}m.user=user;state.loggedIn=true;state.phone=user.phone;m.authError='';m.authStage='phone';if(!state.form[state.kind].phone)state.form[state.kind].phone=user.phone;miniSaveDraft();await miniLoadOwn();if(m.pendingPublish){m.pendingPublish=false;navigate('review');await miniPublish();}else navigate(m.afterAuth||'profile');}
async function miniPublish(){
 if(flow.confirming||!flowValidateAll())return;miniSaveDraft();const m=miniState();if(!m.user){m.pendingPublish=true;flow.pendingAuth='review';navigate('auth');return;}
 const id=flow.activeId,kind=state.kind,transaction=flow.tx,form=structuredClone(state.form[kind]),channel=kind==='vacancy'&&flow.channel;flow.confirming=true;render();
 try{
  const result=await miniAPI('/api/mini-app/records',{method:'POST',body:JSON.stringify({id,kind,form})});if(!result.saved)throw Error('Saqlash tasdiqlanmadi');m.lastSaved={...result.record.form,id,kind,account:miniOwner()};flow.lastId=id;miniDeleteDraft(id);
  const current=flow.activeId===id&&flow.tx===transaction,unchanged=current&&state.kind===kind&&JSON.stringify(state.form[kind])===JSON.stringify(form);
  if(unchanged)flow.confirmedTx=transaction;
  else if(current){flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;miniSaveDraft();}
  await miniLoadOwn();if(unchanged&&state.screen==='review')navigate('done');else toast('E’lon saqlandi. E’lonlarimdan ochishingiz mumkin.');if(channel)await miniChannel(id);
 }
 catch(e){miniSaveDraft();if(e.status===401){miniForgetUser();m.pendingPublish=true;navigate('auth');}else{m.publishError=e.message;toast(e.message);}}
 finally{flow.confirming=false;if(state.screen==='review')render();}
}
async function miniChannel(id){try{const data=await miniAPI('/api/mini-app/channel',{method:'POST',body:JSON.stringify({id})});miniState().channelStatus=data.status;toast(data.status==='confirmed'?'Kanalga joylangan':'Kanalga yuborish navbatiga qo‘shildi');if(state.screen==='done')render();}catch(e){if(e.status===402){modal(`<h2>Kanalga joylash</h2><p>Davom etish uchun tarif tanlang.</p><div class="flow-price-options">${(e.data.plans||[]).map(p=>`<div><span>${p.days} kun</span><strong>${money(p.price)} so‘m</strong></div>`).join('')}</div><p>To‘lov xizmati hozircha mavjud emas. Vakansiyangiz saytda saqlangan.</p><button class="secondary full" data-close>Vakansiyaga qaytish</button>`);}else toast(e.message);}}
function miniDone(){
 const m=miniState(),r=m.lastSaved||m.own.find(r=>r.id===flow.lastId),resume=r?.kind==='resume';
 return `<section class="view flow-done"><span class="flow-done-mark">${icon('check')}</span><h1>${resume?'Rezyume saqlandi':'Vakansiya saytda joylandi'}</h1><p>${esc(r?.position||'')}</p>${!resume?`${m.candidateCache[r?.id]?miniCandidateSection():`<div class="journey-loading" role="status">Mos nomzodlar soni tekshirilmoqda…</div><button class="primary full" data-flow-candidates="${r?.id}">Mos nomzodlarni ko‘rish ${icon('users')}</button>`}${m.channelStatus==='queued'?'<p>Kanalga yuborish navbatida. Nashr tasdiqlangach nomzodlar ochiladi.</p>':''}`:miniRecommendationSection(r?.id)}<button class="secondary full" data-nav="listings">Mening e’lonlarim</button><button class="text-button full" data-nav="home">Bosh sahifa</button></section>`;
}
function miniRecommendationSection(id){
 const m=miniState(),loaded=m.recommendationKey===id&&!m.recommendationLoading,entries=loaded?m.recommendations||[]:[],partial=flow.discoveryPartial,shown=entries.filter(r=>partial?!r.exact:r.exact);
 return `<section class="journey-recommendations"><h2>Sizga mos ishlar</h2>${!loaded?'<p role="status">Takliflar tekshirilmoqda…</p>':m.recommendationError?'<p>Takliflarni hozir yuklab bo‘lmadi. Rezyumengiz saqlangan.</p>':`<div class="tabs"><button data-discovery-match-tab="exact" class="${!partial?'active':''}">Mos · ${entries.filter(r=>r.exact).length}</button><button data-discovery-match-tab="partial" class="${partial?'active':''}">Aniqlashtirish · ${entries.filter(r=>!r.exact).length}</button></div>${shown.map(match=>{const r=miniJob(match.job);return `<article class="fresh-result-card"><h3>${esc(r.position)}</h3><p>${esc(r.company)}</p><strong>${flowSalaryLabel(r)}</strong><p>${esc([r.region,r.district].filter(Boolean).join(' · '))}</p><div class="flow-match-reasons">${match.reasons.map(v=>`<span>${esc(v)}</span>`).join('')}${match.issues.map(v=>`<span class="discovery-mismatch">${esc(v)}</span>`).join('')}</div><button class="secondary full" data-flow-detail="${r.id}">Batafsil ${icon('right')}</button></article>`;}).join('')||'<p>Hozircha tasdiqlangan shartlarga mos taklif yo‘q.</p>'}` }<button class="secondary full" data-mini-find-jobs>Barcha ishlarni qidirish ${icon('search')}</button></section>`;
}
async function miniLoadRecommendations(id){
 const m=miniState();if(m.recommendationKey===id)return;m.recommendationKey=id;m.recommendationLoading=true;m.recommendationError=false;
 try{const data=await miniAPI('/api/mini-app/recommendations?id='+encodeURIComponent(id));if(m.recommendationKey===id)m.recommendations=data.matches||[];}catch{m.recommendationError=true;}finally{m.recommendationLoading=false;if(state.screen==='done')render();}
}
async function miniDoneCandidates(id){const m=miniState(),owner=miniOwner();if(m.doneCandidateKey===id)return;m.doneCandidateKey=id;try{const data=await miniAPI('/api/mini-app/candidates?id='+encodeURIComponent(id));if(miniOwner()!==owner)return;m.candidateJob=id;m.candidateCache[id]=data;if(state.screen==='done')render();}catch{/* The explicit retry remains available. */}}
function miniCandidateSection(){const m=miniState(),jobId=m.candidateJob;if(!m.user)return `<div class="discovery-gate"><h2>O‘zingizga mos nomzodlarni toping</h2><p>Vakansiyani saqlang va kanalga joylang.</p><button class="primary full" data-flow-start="vacancy">Vakansiya yaratish ${icon('right')}</button></div>`;const data=m.candidateCache[jobId];if(!data)return `<div class="discovery-gate"><h2>Qaysi vakansiya uchun?</h2><p>Nomzodlarni ko‘rish uchun o‘z vakansiyangizni tanlang.</p>${m.own.filter(r=>r.kind==='vacancy').map(r=>`<button class="secondary full" data-flow-candidates="${r.id}">${esc(r.position)} ${icon('right')}</button>`).join('')}</div>`;
 if(data.locked)return `<div class="discovery-gate"><h2>Vakansiyangizga mos nomzodlar</h2><div class="discovery-counts"><div><strong>${data.total??'—'}</strong><span>Bazadagi rezyume</span></div><div><strong>${data.potential??'—'}</strong><span>Mos bo‘lishi mumkin</span></div></div><p>Shu vakansiyani kanalga joylang. Nashr tasdiqlangach mos nomzodlar ochiladi.</p><button class="primary full" data-mini-channel="${jobId}">${icon('telegram')}Kanalga joylash</button><button class="text-button full" data-flow-candidates="${jobId}">Tasdiqni tekshirish</button></div>`;
 return `<section class="flow-candidates"><h2>${data.candidates.filter(r=>r.exact).length} ta mos nomzod</h2><div class="tabs"><button data-discovery-match-tab="exact" class="${!flow.discoveryPartial?'active':''}">Mos</button><button data-discovery-match-tab="partial" class="${flow.discoveryPartial?'active':''}">Aniqlashtirish</button></div>${data.candidates.filter(r=>flow.discoveryPartial?!r.exact:r.exact).map(r=>`<article class="flow-match-card"><span class="flow-match-avatar">${icon('user')}</span><div><h3>${esc(r.title)}</h3><p>${esc(r.full_name)}</p><p>${esc(r.location||'')}</p><div class="flow-match-reasons">${(r.reasons||[]).map(s=>`<span>${esc(s)}</span>`).join('')}${(r.issues||[]).map(s=>`<span class="discovery-mismatch">${esc(s)}</span>`).join('')}</div></div><button data-mini-candidate-view="${r.id}" aria-label="Rezyumeni ko‘rish">${icon('file')}</button></article>`).join('')||'<p>Hozircha tasdiqlangan shartlarga to‘liq mos nomzod yo‘q.</p>'}</section>`;
}
async function miniCandidates(id){const owner=miniOwner();try{const data=await miniAPI('/api/mini-app/candidates?id='+encodeURIComponent(id));if(miniOwner()!==owner)return;miniState().candidateJob=id;miniState().candidateCache[id]=data;state.searchType='resumes';navigate('search');}catch(e){toast(e.message);}}
async function miniContact(id){const m=miniState();if(!m.user){m.afterAuth='search';m.pendingPublish=false;navigate('auth');return;}try{let r=m.own.find(r=>r.id===id)||m.detail;if(!r||r.id!==id){const data=await miniAPI('/api/jobs/'+encodeURIComponent(id));r=miniJob(data.job);}const phone=String(r.phone||'').replace(/[^+0-9]/g,''),tg=String(r.telegram||'').replace(/^@/,'');modal(`<h2>Bog‘lanish</h2><p>${esc(r.company||r.name||'')}</p>${/^\+?\d{7,16}$/.test(phone)?`<a class="primary full" href="tel:${phone}">${icon('phone')}${esc(phone)}</a>`:'<p>Telefon ko‘rsatilmagan</p>'}${/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(tg)?`<a class="secondary full" target="_blank" rel="noopener noreferrer" href="https://t.me/${tg}">${icon('telegram')}Telegram</a>`:''}`);}catch(e){toast(e.message);}}
async function miniSalary(){const m=miniState(),d=state.form[state.kind],p=new URLSearchParams({position:d.position||'',region:d.regionId||'',period:payPeriod(d),workMode:miniNativeOption('workMode',d.workMode),employment:miniNativeOption('employment',d.employment),experience:miniExperienceCode(d.experience),shiftHours:d.shiftHours||'',scope:d.salaryScope||''}),key=p.toString();if(m.salaryKey===key)return;m.salaryKey=key;m.salaryEstimate=null;
 try{const data=await miniAPI('/api/mini-app/salary?'+p);if(m.salaryKey!==key)return;m.salaryEstimate=data.estimate||null;const slot=$('#pay-guide-slot');if(slot)slot.innerHTML=payGuide(d);}catch{if(m.salaryKey===key)m.salaryEstimate=null;}}
function miniNativeOption(key,value){return ({workMode:{'Ish joyida':'onsite','Masofaviy':'remote','Gibrid':'hybrid'},employment:{'To‘liq kun':'full_time','Yarim kun':'part_time','Shartnoma':'contract','Amaliyot':'internship'}})[key]?.[value]||value||'';}
function miniExperienceCode(value){return ({'Tajribasiz':'1','1 yil':'2','1–3 yil':'3','3–5 yil':'4','5+ yil':'5'})[value]||'';}
function miniSalaryGuide(d){const e=miniState().salaryEstimate;if(!e)return '';return `<section class="pay-guide"><div class="pay-guide-heading">${icon('chart')}<span>Shu kasb bo‘yicha e’lonlardagi taklif</span></div><strong>${money(e.median)} <small>${payUnit(d)}</small></strong><small>Mediana · ${e.count} ish beruvchi · so‘nggi ${e.windowDays} kun</small><div class="journey-salary-recommendation"><span>Tavsiya: orientirdan 10% yuqori</span><b>${money(e.recommended)} ${payUnit(d)}</b><small>Summani o‘zingiz tanlaysiz.</small></div><button class="text-button" data-mini-use-salary>Shu tavsiyani qo‘yish ${icon('right')}</button></section>`;}
function miniAfterRender(){if(!miniLive())return;if(state.screen==='home')miniMountMap();if(['vacancy','resume'].includes(state.screen)&&state.step===5)miniSalary();if(state.screen==='applications')miniApplications();if(state.screen==='done'){const r=miniState().lastSaved;if(r?.kind==='resume')miniLoadRecommendations(r.id);else if(r?.id)miniDoneCandidates(r.id);}if(state.screen==='search'&&state.searchType==='jobs'&&miniState().querySignature!==miniFilterParams().toString())miniLoadCatalog();}
async function miniApplications(){
 const m=miniState(),role=flow.applicationTab==='received'?'employer':'job_seeker',key=role+':'+miniOwner(),owner=miniOwner();if(!m.user||m.applicationKey===key)return;m.applicationKey=key;m.applicationsLoading=true;m.applicationsError=false;
 try{const data=await miniAPI('/api/mini-app/applications?role='+role);if(miniOwner()!==owner||m.applicationKey!==key)return;m.applications=data.applications||[];}catch{if(miniOwner()===owner&&m.applicationKey===key){m.applicationsError=true;m.applications=[];}}finally{if(miniOwner()===owner&&m.applicationKey===key){m.applicationsLoading=false;if(state.screen==='applications')render();}}
}
function miniApplicationsView(){const m=miniState();return `<section class="view flow-applications">${freshTitle('Arizalarim')}<div class="tabs"><button data-flow-app-tab="sent" class="${flow.applicationTab!=='received'?'active':''}">Yuborganlarim</button><button data-flow-app-tab="received" class="${flow.applicationTab==='received'?'active':''}">Kelganlar</button></div>${!m.user?'<div class="fresh-empty"><h2>Arizalarni ko‘rish uchun kiring</h2><button class="primary full" data-mini-profile-login>Kirish</button></div>':m.applicationsError?'<div class="fresh-empty"><h2>Arizalarni yuklab bo‘lmadi</h2><button class="secondary full" data-mini-retry-apps>Qayta urinish</button></div>':m.applicationsLoading?'<p role="status">Arizalar yuklanmoqda…</p>':m.applications.map(a=>`<article class="flow-application-card"><span class="fresh-status">${esc(a.status||'pending')}</span><h2>${esc(a.jobs?.title_uz||a.jobs?.title_ru||'Vakansiya')}</h2><p>${esc(a.jobs?.company_name||'')}</p>${a.locked?'<p>Nomzod ma’lumoti yopiq</p>':`<p>${esc(a.full_name||'')}</p>`}<button class="secondary full" data-flow-detail="${a.job_id}">Vakansiya ${icon('right')}</button></article>`).join('')||'<div class="fresh-empty"><h2>Hozircha ariza yo‘q</h2><button class="primary full" data-mini-find-jobs>Ishlarni ko‘rish</button></div>'}</section>`;}
async function miniApply(id){const m=miniState();if(!m.user){m.pendingPublish=false;m.afterAuth='search';navigate('auth');return;}const resumes=m.own.filter(r=>r.kind==='resume');if(!resumes.length){modal('<h2>Avval rezyume qo‘shing</h2><button class="primary full" data-flow-start="resume">Rezyume yaratish</button>');return;}m.applyJob=id;modal(`<h2>Ariza topshirish</h2><label class="field"><span>Rezyumengiz</span><select id="mini-apply-resume">${resumes.map(r=>`<option value="${r.id}">${esc(r.position)}</option>`).join('')}</select></label><button class="primary full" data-mini-confirm-apply>Arizani yuborish ${icon('right')}</button>`);}
async function miniConfirmApply(){const m=miniState(),resume=m.own.find(r=>r.id===$('#mini-apply-resume').value);try{await miniAPI('/api/account/applications',{method:'POST',body:JSON.stringify({job_id:m.applyJob,resume_id:resume.id,phone:resume.phone||m.user.phone})});m.applicationKey=null;flow.applicationTab='sent';navigate('applications');}catch(e){toast(e.message);}}
async function miniAssistant(){const m=miniState(),d=state.form[state.kind];if(!d.position||d.position.length<3){toast('Avval lavozimni tanlang');return;}if(m.aiLoading)return;m.aiLoading=true;const kind=state.kind,id=flow.activeId;const source=kind==='vacancy'?[d.description,d.duties,d.requirements].filter(Boolean).join('\n'):[d.about,d.workplace,d.worktitle,d.specialty].filter(Boolean).join('\n');const button=$('[data-mini-ai]');if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
 try{const data=await miniAPI('/api/mini-app/assistant',{method:'POST',body:JSON.stringify({kind,position:d.position,source,skills:d.skills||'',experience:d.experience||''})});if(id!==flow.activeId||kind!==state.kind)return;m.aiResult=data.result;m.aiFor=id;modal(`<span class="journey-modal-kicker">AI TAKLIFI</span><h2>Ko‘rib, keraklisini oling</h2><div class="journey-ai-preview">${Object.entries(data.result).map(([key,value])=>`<section><b>${({description:'Ish haqida',duties:'Vazifalar',requirements:'Talablar',about:'O‘zingiz haqingizda',skills:'Ko‘nikmalar'})[key]||key}</b><p>${esc(Array.isArray(value)?value.join(', '):value)}</p></section>`).join('')}</div><button class="primary full" data-mini-apply-ai>Matnni qo‘llash ${icon('check')}</button><button class="text-button full" data-close>O‘zim yozaman</button>`);}catch(e){toast(e.message);}finally{m.aiLoading=false;if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}}}
window.addEventListener('submit',event=>{if(!miniLive())return;const form=event.target;if(['mini-phone-form','mini-otp-form','results-search'].includes(form.id)){event.preventDefault();event.stopImmediatePropagation();if(form.id==='mini-phone-form')miniPhoneSubmit();else if(form.id==='mini-otp-form')miniVerify();else{state.query=$('#flow-query').value;miniLoadCatalog();}}},true);
window.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;const stop=()=>{event.preventDefault();event.stopImmediatePropagation();};
 if(b.hasAttribute('data-mini-ai')){stop();miniAssistant();return;}
 if(b.hasAttribute('data-mini-apply-ai')){stop();const m=miniState();if(m.aiFor!==flow.activeId)return;for(const [key,value]of Object.entries(m.aiResult||{}))if(['description','duties','requirements','about','skills'].includes(key))state.form[state.kind][key]=Array.isArray(value)?value.join(', '):value;flowSaveDraft();closeModal();render();return;}
 if(!miniLive())return;
 if(b.hasAttribute('data-mini-resume-draft')){stop();miniResumeDraft(miniState().pendingDraft);return;}if(b.hasAttribute('data-mini-new-draft')){stop();miniNewDraft(miniState().pendingKind);return;}
 if(b.hasAttribute('data-mini-resend')){stop();miniSendOtp();return;}
 if(b.hasAttribute('data-mini-register')){stop();miniSendOtp();return;}if(b.hasAttribute('data-mini-telegram')||b.hasAttribute('data-telegram-contact')){stop();miniTelegram();return;}
 if(b.hasAttribute('data-mini-retry-apps')){stop();miniState().applicationKey=null;render();return;}
 if(b.hasAttribute('data-mini-auth-reset')){stop();miniState().authStage='phone';miniState().authError='';render();return;}
 if(b.hasAttribute('data-verify-sms')){stop();return;}if(b.hasAttribute('data-mini-more-search')){stop();miniLoadCatalog(true);return;}if(b.hasAttribute('data-mini-retry-search')){stop();miniLoadCatalog();return;}
 if(b.hasAttribute('data-mini-more-map')){stop();miniLoadMap();return;}
 if(b.hasAttribute('data-mini-find-jobs')||b.hasAttribute('data-mini-city-jobs')){stop();state.searchType='jobs';state.query='';state.region=b.hasAttribute('data-mini-city-jobs')?'Toshkent shahri':'Butun O‘zbekiston';navigate('search');miniLoadCatalog();return;}
 if(b.dataset.flowCandidates){stop();miniCandidates(b.dataset.flowCandidates);return;}if(b.dataset.miniChannel||b.dataset.flowRepost){stop();miniChannel(b.dataset.miniChannel||b.dataset.flowRepost);return;}
 if(b.dataset.miniCandidateView){stop();miniCandidateView(b.dataset.miniCandidateView);return;}
 if(b.dataset.miniCandidateContact){stop();miniCandidateContact(b.dataset.miniCandidateContact);return;}
 if(b.dataset.flowContact){stop();miniContact(b.dataset.flowContact);return;}if(b.dataset.miniApply){stop();miniApply(b.dataset.miniApply);return;}if(b.hasAttribute('data-mini-confirm-apply')){stop();miniConfirmApply();return;}
 if(b.hasAttribute('data-mini-use-salary')){stop();const e=miniState().salaryEstimate;if(e){Object.assign(state.form[state.kind],{salaryMin:money(e.recommended),salaryMax:money(e.recommended),salaryNegotiable:false});flowSaveDraft();render();}return;}
 if(b.hasAttribute('data-mini-profile-login')||b.hasAttribute('data-flow-app-login')||b.hasAttribute('data-flow-account')){stop();miniState().pendingPublish=false;miniState().afterAuth='profile';navigate('auth');return;}
 if(b.hasAttribute('data-mini-logout')){stop();miniSaveDraft();miniAPI('/api/auth/session',{method:'DELETE'}).then(()=>{miniForgetUser();miniClearFormMemory();navigate('home');}).catch(e=>toast(e.message));return;}
 if(b.dataset.flowEditRecord){stop();const r=miniState().own.find(r=>r.id===b.dataset.flowEditRecord);if(r){miniSaveDraft();location.assign(`/profile/${r.kind==='vacancy'?'employer/vacancies':'job-seeker/resumes'}/${r.id}`);}return;}
 if(b.dataset.flowArchive){stop();miniArchive(b.dataset.flowArchive);return;}
 if(b.hasAttribute('data-demo-paid')||b.hasAttribute('data-pay')||b.hasAttribute('data-flow-buy')){stop();toast('To‘lov xizmati hozircha mavjud emas. Qoralama saqlandi.');return;}
},true);
async function miniArchive(id){const r=miniState().own.find(r=>r.id===id);if(!r)return;modal(`<h2>E’lonni olib tashlaysizmi?</h2><p>${esc(r.position)}</p><button class="primary full" data-mini-archive-confirm="${id}">Ha, olib tashlash</button><button class="text-button full" data-close>Bekor qilish</button>`);}
window.addEventListener('click',async event=>{const b=event.target.closest('[data-mini-archive-confirm]');if(!b||!miniLive())return;event.preventDefault();event.stopImmediatePropagation();const r=miniState().own.find(r=>r.id===b.dataset.miniArchiveConfirm);try{const base='/api/account/'+(r.kind==='vacancy'?'vacancies':'resumes')+'/'+r.id,info=await miniAPI(base),row=info.vacancy||info.resume;await miniAPI(base,{method:r.kind==='vacancy'?'PATCH':'DELETE',body:JSON.stringify({action:'archive',expected_updated_at:row.updated_at??null})});await miniLoadOwn();closeModal();render();}catch(e){toast(e.message);}},true);
document.addEventListener('input',event=>{if(event.target.dataset.field){miniState().touched=true;miniSaveDraft();}if(event.target.dataset.flowCombo==='query'&&miniLive()){clearTimeout(miniState().searchTimer);miniState().searchTimer=setTimeout(()=>miniLoadCatalog(),300);}});
window.addEventListener('pagehide',miniSaveDraft);
function miniInitialize(){
 const priorNavigate=navigate;navigate=function(screen,options={}){if(state.screen==='auth'&&screen!=='auth')miniState().pendingPublish=false;return priorNavigate(screen,options);};
 const originalUnit=payUnit;payUnit=d=>d?.salaryUnitUnknown?'so‘m':originalUnit(d);
 const originalSave=flowSaveDraft;flowSaveDraft=function(){if(miniLive())miniSaveDraft();else originalSave();};
 const originalResults=flowResults;flowResults=()=>miniLive()?miniResults():originalResults();
 const originalReview=discoveryReview;discoveryReview=()=>miniLive()?miniReview():originalReview();
 const originalDone=discoveryDone;discoveryDone=()=>miniLive()?miniDone():originalDone();
 const originalDetail=flowDetails;flowDetails=id=>miniLive()?miniDetails(id):originalDetail(id);
 const originalMap=discoveryHomeMap;discoveryHomeMap=()=>miniLive()?miniHomeMap():originalMap();
 const originalMount=discoveryMountMap;discoveryMountMap=()=>miniLive()?miniMountMap():originalMount();
 const originalAfter=discoveryAfterRender;discoveryAfterRender=()=>{originalAfter();miniAfterRender();};
 if(!miniLive())return;state.loggedIn=false;state.phone='';for(const kind of ['vacancy','resume'])state.form[kind]=structuredClone(flow.defaults[kind]);
 flowAccount=miniOwner;flowOwnRecords=()=>miniState().own;flowRecords=()=>miniState().own;flowSearchRecords=()=>[...miniState().jobs,...miniState().own];
 flowPublish=miniPublish;flowFree=()=>true;flowSyncAllowance=()=>{};
 flowResumeStats=r=>Number.isFinite(r.views)?flowStatsMarkup(r.views,'—'):'<p class="journey-stat-pending">Statistika hozircha mavjud emas</p>';
 flowProfileStats=()=>`<div class="flow-profile-stats"><span>${miniState().ownCounts?.jobs??miniState().own.filter(r=>r.kind==='vacancy').length} vakansiya</span><span>${miniState().ownCounts?.resumes??miniState().own.filter(r=>r.kind==='resume').length} rezyume</span></div>`;
 const originalConfirm=workLocationConfirm;workLocationConfirm=()=>{originalConfirm();miniResolveStoredPlaces();flowSaveDraft();render();};
 const originalProfile=freshProfile;screenRender.profile=()=>originalProfile().replace('</section>',`${miniState().user?'<button class="text-button full" data-mini-logout>Hisobdan chiqish</button>':''}</section>`);
 for(const route of ['admin','broadcast'])screenRender[route]=()=>`<section class="view">${freshTitle('Boshqaruv')}<a class="primary full" href="/admin">Administrator kabineti ${icon('right')}</a></section>`;
 const oldBegin=flowBegin;flowBegin=function(kind,...args){return miniLive()?miniStart(kind):oldBegin(kind,...args);};
 payWarning=function(d){const e=miniState().salaryEstimate;if(!e||d.salaryNegotiable)return '';const value=flowNumber(d.salaryMin)||flowNumber(d.salaryMax);return value>0&&(value<e.median/4||value>e.median*4)?'Summa o‘xshash takliflardan ancha farq qiladi. To‘lov davri va raqamlarni tekshiring.':'';};
 const oldPayGuide=payGuide;payGuide=function(d){return miniLive()?miniSalaryGuide(d):oldPayGuide(d);};
 screenRender.auth=miniAuth;screenRender.applications=miniApplicationsView;
}
miniInitialize();render();miniBoot().catch(()=>{miniState().bootstrapError=true;render();});
async function miniCandidateContact(id){const owner=miniOwner();try{const data=await miniAPI('/api/mini-app/candidates?'+new URLSearchParams({id:miniState().candidateJob,resume_id:id})),phone=String(data.contact.phone||'').replace(/[^+0-9]/g,'');if(miniOwner()!==owner)return;modal(`<h2>${esc(data.contact.full_name)}</h2>${/^\+?\d{7,16}$/.test(phone)?`<a class="primary full" href="tel:${phone}">${icon('phone')}${esc(phone)}</a>`:'<p>Telefon ko‘rsatilmagan</p>'}`);}catch(e){toast(e.message);}}

async function miniCandidateView(id){const owner=miniOwner();try{const data=await miniAPI('/api/mini-app/candidates?'+new URLSearchParams({id:miniState().candidateJob,resume_id:id,action:'view'}));if(miniOwner()!==owner)return;const r=data.resume;modal(`<h2>${esc(r.title)}</h2><p>${esc(r.full_name)}</p><p class="journey-detail-copy">${esc(r.about)}</p><p>${esc((r.skills||[]).join(', '))}</p><button class="primary full" data-mini-candidate-contact="${id}">${icon('phone')}Bog‘lanish</button>`);}catch(e){toast(e.message);}}

function miniClearFormMemory(){flowClearMedia();for(const kind of ['vacancy','resume'])state.form[kind]=structuredClone(flow.defaults[kind]);flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=false;}
