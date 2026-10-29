/* Fresh UI prototype. All search/form/order data remains local demonstration data. */
state.layout='flow';state.theme=localStorage.getItem('ishdasiz-fresh-theme')||'light';state.region='Butun O‘zbekiston';

const flow=flowInitialize();
formSteps.resume.length=4;
if(['review','done'].includes(params.get('screen')))state.screen=params.get('screen');
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
  return `<div class="flow-posting"><div class="flow-posting-group"><button class="studio-create-tile hiring" data-flow-start="vacancy"><span class="studio-tile-top"><small>Sayt + Telegram</small><span class="studio-tile-plus">${icon('plus')}</span></span>${studioObject('vacancy')}<strong>Vakansiya<br>joylash</strong><span class="studio-tile-bottom"><small>${flowFree('vacancy')?'Bepul boshlang':'E’lon yarating'}</small>${icon('right')}</span></button><button class="flow-intent" data-fresh-intent="hiring"><i>${icon('users')}</i><span>Xodim topish</span>${icon('right')}</button></div><div class="flow-posting-group"><button class="studio-create-tile career" data-flow-start="resume"><span class="studio-tile-top"><small>Sayt + Telegram</small><span class="studio-tile-plus">${icon('plus')}</span></span>${studioObject('resume')}<strong>Rezyume<br>joylash</strong><span class="studio-tile-bottom"><small>${flowFree('resume')?'Bepul boshlang':'E’lon yarating'}</small>${icon('right')}</span></button><button class="flow-intent" data-fresh-intent="career"><i>${icon('search')}</i><span>Ish topish</span>${icon('right')}</button></div></div>`;
}
function freshHome(){
  return `<section class="view flow-home"><div class="flow-hero"><h1 class="flow-hero-title"><button class="flow-hero-cta" data-flow-start="vacancy"><span class="flow-promo-tag">${icon('gift')}Bepul boshlang</span><strong>Vakansiya<br>joylash</strong><span class="flow-hero-cta-arrow">${icon('plus')}${icon('right')}</span></button></h1><div class="flow-hero-visual">${freshHero()}</div></div>${studioCreateTiles()}
  <section class="flow-offer"><div class="flow-offer-copy"><span class="flow-offer-label">${icon('gift')}Bepul joylash</span><h2>Saytda va kanalda<br>bepul e’lon joylang.</h2><button data-create>E’lon joylash ${icon('right')}</button></div><div class="flow-offer-art" aria-hidden="true"><span class="flow-promo-document">${icon('file')}<i></i><i></i></span><span class="flow-promo-plane">${icon('send')}</span><span class="flow-promo-zero"><b>0</b><small>so‘m</small></span><svg class="flow-promo-path" viewBox="0 0 140 130"><path pathLength="1" d="M10 115C-5 25 95 125 101 58S130 35 131 12"/></svg></div><p>Saytda doim bepul. Takroriy kanal e’lonlari — tarif asosida.</p></section>
  <div class="studio-home-links"><button data-nav="listings">${icon('file')}<span>Mening e’lonlarim</span>${icon('right')}</button><button data-nav="profile">${icon('user')}<span>Shaxsiy kabinet</span>${icon('right')}</button></div></section>`;
}
function freshSearch(){
  return `<section class="view fresh-results flow-search">${freshTitle(state.searchType==='resumes'?'Xodim topish':'Ish topish')}<div class="tabs"><button class="${state.searchType==='jobs'?'active':''}" data-search-type="jobs">Vakansiyalar</button><button class="${state.searchType==='resumes'?'active':''}" data-search-type="resumes">Rezyumelar</button></div><form id="results-search" class="fresh-search-form"><label>${icon('search')}<input id="flow-query" name="query" aria-label="Qidiruv" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" placeholder="Lavozim yoki kompaniya" value="${esc(state.query)}" autocomplete="off" maxlength="120" data-flow-combo="query"></label><button type="submit" aria-label="Qidirish">${icon('right')}</button></form><div class="fresh-search-tools"><button data-filter="region">${icon('pin')}${esc(state.region)}</button><button data-filter="all">${icon('filter')}Filtr${flow.salaryFrom||flow.salaryTo?' · 1':''}</button></div><div id="flow-results" aria-live="polite">${flowResults()}</div></section>`;
}
function freshForm(){
  const steps=formSteps[state.kind];state.step=Math.min(state.step,steps.length-1);const [heading]=steps[state.step];
  return `<section class="view fresh-form">${freshTitle(state.kind==='vacancy'?'Vakansiya joylash':'Rezyume joylash')}<div class="flow-step-heading"><span>${state.step+1}<small> / ${steps.length}</small></span><b>${heading}</b><i>${icon('check')}Bepul</i></div><div class="step-track" aria-label="${state.step+1} / ${steps.length} qadam">${steps.map((_,i)=>`<i class="${i<=state.step?'done':''}"></i>`).join('')}</div><div class="form-surface"><div class="fields">${formContent()}</div></div><div class="form-footer"><button class="secondary" data-step="back">${icon('back')}<span>Orqaga</span></button><button class="primary" data-step="next">${state.step===steps.length-1?'Ko‘rib chiqish':'Davom etish'}<span class="studio-button-end">${icon('right')}</span></button></div></section>`;
}
function freshProfile(){
  return `<section class="view fresh-profile">${freshTitle('Shaxsiy kabinet')}<div class="studio-identity"><span class="studio-identity-avatar">${state.loggedIn?esc((state.form.resume.name||'I').slice(0,1)):icon('user')}<i>${icon('check')}</i></span><div><h2>${state.loggedIn?esc(state.form.resume.name||'Xush kelibsiz'):'Sizning profilingiz'}</h2><p>${state.loggedIn?esc(state.phone):'Ish va xodim uchun bitta profil'}</p></div></div>${state.loggedIn?'':`<button class="primary full studio-profile-login" data-nav="auth">${icon('phone')}Profilga kirish<span class="studio-button-end">${icon('right')}</span></button>`}${flowProfileStats()}<div class="studio-section-label"><h2>Yangi e’lon</h2><span>Saytda bepul</span></div>${studioCreateTiles()}<div class="studio-section-label"><h2>Mening e’lonlarim</h2></div><div class="studio-profile-list"><button data-fresh-list="resumes"><span class="studio-list-mark resume">${icon('file')}</span><span><b>Rezyumelarim</b></span>${icon('right')}</button><button data-fresh-list="jobs"><span class="studio-list-mark vacancy">${icon('briefcase')}</span><span><b>Vakansiyalarim</b></span>${icon('right')}</button></div><div class="fresh-menu-list">${[['wallet','Kanal tariflari','plans'],['bell','Bildirishnomalar','notifications'],['filter','Sozlamalar','settings']].map(([ic,label,route])=>`<button ${route==='notifications'?'data-notifications':`data-nav="${route}"`}>${icon(ic)}<span>${label}</span>${icon('right')}</button>`).join('')}</div>${state.loggedIn?`<button class="text-button full" data-flow-account>Boshqa raqam bilan kirish</button>`:""}</section>`;
}
function freshListings(){
  const records=flowOwnRecords().filter(record=>!record.archived&&(state.listTab==='all'||record.kind===(state.listTab==='jobs'?'vacancy':'resume')));
  return `<section class="view">${freshTitle('Mening e’lonlarim','profile')}<button class="primary full flow-new-listing" data-create>${icon('plus')}E’lon joylash</button><div class="tabs"><button class="${state.listTab==='all'?'active':''}" data-list-tab="all">Barchasi</button><button class="${state.listTab==='jobs'?'active':''}" data-list-tab="jobs">Vakansiya</button><button class="${state.listTab==='resumes'?'active':''}" data-list-tab="resumes">Rezyume</button></div>${records.map(record=>`<article class="fresh-listing"><div class="fresh-listing-top"><span class="fresh-company-icon ${record.kind==='resume'?'mint':''}">${icon(record.kind==='resume'?'file':'briefcase')}</span><span class="fresh-status">${record.channel?'Sayt + kanal ko‘rinishi':'Saytdagi ko‘rinish'}</span></div><h2>${esc(record.position)}</h2><p>${esc(record.kind==='vacancy'?record.company:record.name)} · ${esc(record.region)}</p><strong class="fresh-listing-free">${flowSalaryLabel(record)}</strong>${record.kind==='resume'?flowResumeStats(record):`<button class="secondary full flow-candidate-link" data-flow-candidates="${esc(record.id)}">${icon('users')}Mos xodimlar ${icon('right')}</button>`}<button class="primary full" data-flow-repost="${esc(record.id)}">Kanalga joylash ${icon('send')}</button><div class="fresh-edit-actions"><button data-flow-edit-record="${esc(record.id)}">${icon('edit')}Tahrirlash</button><button data-flow-archive="${esc(record.id)}">${icon('trash')}Olib tashlash</button></div></article>`).join('')||`<div class="fresh-empty">${icon('file')}<h2>Hali e’lon yo‘q</h2><button class="secondary full" data-create>E’lon joylash</button></div>`}</section>`;
}
function freshTariffs(){
  return `<section class="view fresh-tariffs">${freshTitle('Kanal tariflari','review')}
    <div class="tabs"><button class="${state.kind==='vacancy'?'active':''}" data-tariff-kind="vacancy">Vakansiya</button><button class="${state.kind==='resume'?'active':''}" data-tariff-kind="resume">Rezyume</button></div>

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
  const draft=state.form[state.kind],resume=state.kind==='resume';
  const media=!resume&&flow.media?`<div class="flow-user-media">${flow.media.type.startsWith('video/')?`<video src="${esc(flow.media.url)}" controls playsinline></video>`:`<img src="${esc(flow.media.url)}" alt="Tanlangan foto">`}</div>`:!resume&&state.orderPaid?`<div class="media-cover"><img src="assets/profession-salesperson-v1.webp" alt="Muqova namunasi"><strong class="cover-title">${esc(draft.position)}</strong>${flow.logo?`<img class="flow-cover-logo" src="${esc(flow.logo.url)}" alt="Kompaniya logotipi">`:''}</div>`:'';
  return `<section class="view fresh-post-preview">${freshTitle('Kanal posti','review')}<article class="fresh-telegram-post"><header><span>${icon('send')}</span><div><strong>@ishdasiz</strong><small>${resume?'Rezyume':'Vakansiya'}</small></div></header>${media}<div class="fresh-post-copy"><h2>${esc(draft.position||'Lavozim')}</h2><p>${esc(resume?draft.name:draft.company)}</p><strong>${flowSalaryLabel(draft)}</strong><p>${esc(draft.region)} · ${esc(draft.experience||'')}</p><p>${esc(resume?draft.skills:draft.description)}</p></div></article>${!resume?`<div class="media-actions"><button class="secondary" data-upload="media">${icon('image')}Foto / video</button>${state.orderPaid?`<button class="secondary" data-upload="logo">${icon('plus')}Logo</button>`:''}</div>`:''}<button class="primary full flow-preview-back" data-nav="review">Joylashga qaytish ${icon('right')}</button></section>`;
}
function freshMenu(){
  modal(`<div class="fresh-sheet-title"><h2>Menyu</h2></div><div class="studio-menu-create"><button data-flow-start="vacancy">${icon('briefcase')}<span>Vakansiya joylash</span>${icon('plus')}</button><button data-flow-start="resume">${icon('file')}<span>Rezyume joylash</span>${icon('plus')}</button></div><div class="fresh-menu-list">${[['home','Asosiy sahifa','home'],['user','Shaxsiy kabinet','profile'],['file','Mening e’lonlarim','listings'],['wallet','Kanal tariflari','plans'],['filter','Sozlamalar','settings']].map(([ic,label,route])=>`<button data-nav="${route}">${icon(ic)}<span>${label}</span>${icon('right')}</button>`).join('')}</div>`);
  $('#modal-root .modal').setAttribute('aria-label','Menyu');
}

const freshBaseRender=render,freshBaseNavigate=navigate,freshBaseModal=modal,freshBaseClose=closeModal;
modal=function(html){modalTrigger=document.activeElement;freshBaseModal(html);app.classList.add('sheet-open');$('#content').inert=true;$('.app-header').inert=true;$('#action-bar').inert=true;scheduleFreshScene()};
closeModal=function(){freshBaseClose();app.classList.remove('sheet-open');$('#content').inert=false;$('.app-header').inert=false;$('#action-bar').inert=false;if(modalTrigger?.isConnected)modalTrigger.focus();modalTrigger=null;scheduleFreshScene()};
navigate=function(screen,options={}){freshBaseNavigate(screen,options);if(freshCampaignParams.length){const url=new URL(location.href);for(const [key,value]of freshCampaignParams)url.searchParams.set(key,value);history.replaceState(null,'',url)}};
render=function(){freshBaseRender();clearInterval(sceneTimer);$('#bottom-nav').replaceChildren();$('#bottom-nav').hidden=true;app.dataset.screen=state.screen;app.classList.toggle('motion-disabled',!freshMotion);app.classList.add('fresh-ready');scheduleFreshScene()};
function scheduleFreshScene(){clearTimeout(freshTimer);const paused=document.hidden||app.classList.contains('sheet-open')||app.classList.contains('focus-paused');app.classList.toggle('home-motion-paused',paused);if(state.screen!=='home'||!freshMotion||freshReduced.matches||paused)return;freshTimer=setTimeout(()=>{setFreshScene((state.scene+1)%freshScenes.length);scheduleFreshScene()},4800)}
function setFreshScene(index){state.scene=(index+freshScenes.length)%freshScenes.length;const stage=$('.fresh-stage');if(!stage)return;stage.dataset.scene=String(state.scene);stage.style.setProperty('--scene-color',freshScenes[state.scene].color);stage.querySelector('.fresh-word').innerHTML=letterWord(freshScenes[state.scene].name);stage.querySelectorAll('.fresh-portrait').forEach((el,i)=>el.classList.toggle('active',i===state.scene));stage.querySelector('.fresh-scene-count').innerHTML=String(state.scene+1).padStart(2,'0')+' <small>/ 08</small>'}

Object.assign(screenRender,{review:flowReview,done:flowDone,home:freshHome,search:freshSearch,vacancy:freshForm,resume:freshForm,profile:freshProfile,listings:freshListings,plans:freshTariffs,auth:freshAuth,settings:freshSettings,preview:freshPreview});
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

/* Local interactive preview. No production identity, payment or publication API. */
function flowRead(key,fallback,store=sessionStorage){try{return JSON.parse(store.getItem(key))??fallback}catch{return fallback}}
function flowWrite(key,value,store=sessionStorage){try{store.setItem(key,JSON.stringify(value))}catch{/* The current page remains usable without browser storage. */}}
function flowId(){return crypto.randomUUID?.()||'demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function flowInitialize(){
  const defaults=structuredClone(state.form);for(const kind of ['vacancy','resume'])for(const key of ['position','company','name','salaryMin','salaryMax','description','skills','phone','telegram'])if(key in defaults[kind])defaults[kind][key]='';
  const draft=flowRead('ishdasiz-v12-draft',null),account=flowRead('ishdasiz-v12-account',null);
  if(draft?.form?.vacancy&&draft?.form?.resume)state.form=draft.form;
  else{for(const kind of ['vacancy','resume'])for(const key of ['position','company','name','salaryMin','salaryMax','description','skills','phone','telegram'])if(key in state.form[kind])state.form[kind][key]='';}
  if(account&&/^\+998\d{9}$/.test(account.phone)){state.phone=account.phone;state.loggedIn=true;}
  const formScreen=['vacancy','resume'].includes(params.get('screen'));
  if(!formScreen&&['vacancy','resume'].includes(draft?.kind))state.kind=draft.kind;
  if(['vacancy','resume'].includes(params.get('kind')))state.kind=params.get('kind');
  const continuing=draft&&!(formScreen&&(draft.kind!==state.kind||draft.confirmedTx===draft.tx));
  if(continuing&&!params.has('step')&&formScreen&&Number.isInteger(draft.step))state.step=Math.max(0,Math.min(draft.step,5));
  state.orderPaid=!!(continuing&&draft.paid&&draft.paidTx===draft.tx&&draft.kind===state.kind);
  if(continuing&&Number.isInteger(draft.plan)&&draft.plan>=0&&draft.plan<plans.length)state.selectedPlan=draft.plan;
  if(continuing&&draft.schedule){state.startDate=draft.schedule.startDate||state.startDate;state.scheduleMode=draft.schedule.mode||'same';state.scheduleTime=draft.schedule.time||'18:00';state.dailyTimes=draft.schedule.dailyTimes||{};}
  return {defaults,activeId:continuing?draft.activeId||flowId():flowId(),tx:continuing?draft.tx||flowId():flowId(),channel:continuing?draft.channel!==false:true,confirmedTx:continuing?draft.confirmedTx||null:null,lastId:flowRead('ishdasiz-v12-last',''),pendingAuth:draft?.pendingAuth||null,switchAccount:false,priceTarget:'review',salaryFrom:'',salaryTo:'',preselectedPaid:!!(continuing&&draft.preselectedPaid),confirming:false};
}
function flowSaveDraft(){flowWrite('ishdasiz-v12-draft',{form:state.form,kind:state.kind,step:state.step,activeId:flow.activeId,tx:flow.tx,channel:flow.channel,confirmedTx:flow.confirmedTx,pendingAuth:flow.pendingAuth,paid:state.orderPaid,paidTx:flow.tx,plan:state.selectedPlan,preselectedPaid:flow.preselectedPaid,schedule:{startDate:state.startDate,mode:state.scheduleMode,time:state.scheduleTime,dailyTimes:state.dailyTimes}});}
function flowAccount(){return state.loggedIn?state.phone.replace(/\D/g,''):'guest'}
function flowAllowances(){return flowRead('ishdasiz-v12-allowances',{},localStorage)}
function flowFree(kind){return !flowAllowances()[flowAccount()]?.[kind]}
function flowSyncAllowance(){state.freeResumeUsed=!flowFree('resume');state.freeVacancyUsed=!flowFree('vacancy')}
function flowRecords(){return flowRead('ishdasiz-v12-records',[]).filter(v=>v&&typeof v.id==='string')}
function flowOwnRecords(){return flowRecords().filter(v=>v.account===flowAccount())}
function flowClearMedia(){for(const key of ['media','logo']){if(flow[key]?.url)URL.revokeObjectURL(flow[key].url);flow[key]=null;}}
function flowBegin(kind,siteOnly=false,skipPrice=false){
  state.kind=kind;state.orderPaid=false;flowSyncAllowance();
  if(!siteOnly&&!skipPrice&&!flowFree(kind)){flow.priceTarget='start';flowPrices(kind);return;}
  flowClearMedia();flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=!siteOnly;flow.preselectedPaid=skipPrice;flow.pendingAuth=null;
  navigate(kind);flowSaveDraft();
}
function flowPrices(kind){
  flowCloseCombo();state.kind=kind;
  modal(`<h2>Kanalga joylash</h2><div class="flow-price-options">${plans.map((p,index)=>`<button data-flow-plan="${index}"><span>${p.days}<small>${p.count} ta post${p.pin?' · Zakrep sovg‘a':''}</small></span><b>${money(kind==='resume'?p.resumePrice:p.price)}<small>so‘m</small></b>${icon('right')}</button>`).join('')}</div><button class="secondary full" data-flow-site-only>Saytga bepul joylash</button>`);
}
function flowReview(){
  const d=state.form[state.kind],free=flowFree(state.kind),pay=flow.channel&&!free&&!state.orderPaid;
  return `<section class="view flow-review">${freshTitle('E’lonni joylash')}<article class="flow-summary"><div class="flow-summary-label"><span>${icon(state.kind==='vacancy'?'briefcase':'file')}${state.kind==='vacancy'?'Vakansiya':'Rezyume'}</span><button data-flow-edit="0">${icon('edit')}Tahrirlash</button></div><h2>${esc(d.position||'Lavozim')}</h2><p>${esc(state.kind==='vacancy'?d.company:d.name)}</p><strong>${flowSalaryLabel(d)}</strong><span class="flow-summary-region">${icon('pin')}${esc(d.region||'Hudud')}</span></article><div class="flow-destinations"><div class="flow-destination"><span class="flow-dest-icon">${icon('home')}</span><div><b>ishdasiz.uz</b><small>Saytda bepul</small></div><span class="flow-dest-check">${icon('check')}</span></div><label class="flow-destination channel"><span class="flow-dest-icon">${icon('send')}</span><span><b>@ishdasiz</b><small>${state.orderPaid?'Tarif tanlandi':free?'Kanalda bepul':(flow.preselectedPaid?money(tariffPrice(plans[state.selectedPlan]))+' so‘m':money(tariffPrice(plans[0]))+' so‘mdan')}</small></span><input type="checkbox" id="flow-channel" ${flow.channel?'checked':''}></label></div>${flow.channel?'<button class="text-button flow-show-post" data-nav="preview">Post ko‘rinishi '+icon('right')+'</button>':''}${state.kind==='vacancy'?flowCandidateSection(d):''}<p class="flow-demo-note">Demo: haqiqiy e’lon va to‘lov yuborilmaydi.</p><div class="form-footer"><button class="secondary" data-flow-edit="${formSteps[state.kind].length-1}">${icon('back')}Orqaga</button><button class="primary" ${pay?'data-flow-buy':'data-flow-publish'}>${pay?'Tarifni tanlash':state.loggedIn?'Joylash':'Kirish'}<span class="studio-button-end">${icon('right')}</span></button></div></section>`;
}
function flowDone(){
  const record=flowOwnRecords().find(v=>v.id===flow.lastId);
  return `<section class="view flow-done"><span class="flow-done-mark">${icon('check')}</span><h1>Ko‘rinish tayyor.</h1>${record?`<p>${esc(record.position)}</p><div class="flow-done-destinations"><span>${icon('check')}Sayt${record.channel?' + kanal':''}</span><span>${record.channel&&record.channelPaid?'Tanlangan tarif':'Bepul'}</span></div>${record.kind==='vacancy'?flowCandidateSection(record):flowResumeStats(record)}`:''}<button class="primary full" data-nav="listings">E’lonlarim ${icon('right')}</button><button class="secondary full" data-create>Yangi e’lon joylash</button><button class="text-button" data-nav="home">Bosh sahifa</button><small>Demo ko‘rinishi saqlandi.</small></section>`;
}
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
function flowCandidates(vacancy){
  const terms=flowPositionTerms(vacancy.position);if(!terms.size)return [];
  return flowSearchRecords().filter(r=>r.kind==='resume'&&r.account!==flowAccount()).flatMap(r=>{
    const titles=flowPositionTerms(r.position),sameRole=[...titles].some(t=>terms.has(t));if(!sameRole)return [];
    const sameRegion=!!vacancy.region&&!!r.region&&flowRegionKey(vacancy.region)===flowRegionKey(r.region);
    const vacancyLow=flowNumber(vacancy.salaryMin),vacancyHigh=flowNumber(vacancy.salaryMax)||vacancyLow,requested=flowNumber(r.salaryMin);
    const salaryFits=!!vacancyHigh&&!!requested&&requested<=vacancyHigh;
    const reasons=['Lavozim mos',...(sameRegion?['Bir hudud']:[]),...(salaryFits?['Maosh mos']:[])];
    return [{record:r,score:4+Number(sameRegion)*2+Number(salaryFits),reasons}];
  }).sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id));
}
function flowCandidateSection(vacancy){
  const matches=flowCandidates(vacancy),id=vacancy.id||'draft';
  return `<section class="flow-candidates"><div class="flow-candidates-heading"><span>${icon('users')}</span><div><h2>Mos xodimlar</h2><p>${esc(vacancy.position)}</p></div><b>${matches.length}</b></div>${matches.slice(0,3).map(({record,reasons})=>`<article class="flow-match-card"><span class="flow-match-avatar">${icon('user')}</span><div><h3>${esc(record.position)}</h3><p>${esc(record.name||'Nomzod')}${record.sample?' · Namuna':''}</p><span class="flow-match-region">${esc(record.region)} · ${flowSalaryLabel(record)}</span><div class="flow-match-reasons">${reasons.map(reason=>`<span>${icon('check')}${reason}</span>`).join('')}</div></div><button data-flow-detail="${esc(record.id)}" aria-label="${esc(record.name||'Nomzod')} rezyumesini ko‘rish">${icon('right')}</button></article>`).join('')||'<div class="flow-match-empty">Hozircha mos rezyume yo‘q.</div>'}<button class="secondary full" data-flow-candidates="${esc(id)}">${matches.length?'Barcha nomzodlar':'Xodimlarni qidirish'}${icon('search')}</button></section>`;
}
function flowPublish(){
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
  flowWrite('ishdasiz-v12-records',records);flow.lastId=record.id;flow.confirmedTx=flow.tx;flowWrite('ishdasiz-v12-last',record.id);flowSaveDraft();flow.confirming=false;flowSyncAllowance();navigate('done');
}
function flowNormalize(value){
  const map={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh','ы':'i','э':'e','ю':'yu','я':'ya','ў':'o','қ':'q','ғ':'g','ҳ':'h','ь':'','ъ':''};
  return String(value||'').toLowerCase().replace(/[‘’ʻʼ'`]/g,'').replace(/[а-яёўқғҳ]/g,c=>map[c]??c).replace(/[^a-z0-9]+/g,' ').trim();
}
function flowNumber(value){const n=Number(String(value||'').replace(/[^\d.]/g,''));return Number.isFinite(n)?n:0}
function flowRegionKey(value){const key=flowNormalize(value);if(key.startsWith('toshkent'))return key.includes('viloyat')?'toshkent-viloyati':'toshkent-shahri';return key.replace(/viloyati|shahri|respublikasi/g,'').trim()}
function flowSalaryLabel(d){const low=flowNumber(d.salaryMin),high=flowNumber(d.salaryMax);return low||high?`${low?money(low):''}${low&&high?' — ':''}${high?money(high):''} so‘m`:esc(d.salary||'Kelishiladi')}
function flowSampleJobs(){return jobs.map((j,i)=>({...j,id:'sample-job-'+i,kind:'vacancy',position:j.title,salaryMin:[4000000,5000000,6000000][i],salaryMax:[6000000,8000000,9000000][i],employment:j.mode,sample:true}))}
function flowSearchRecords(){
  const sampleCV={id:'sample-resume',kind:'resume',position:'Sotuvchi',name:'Namuna nomzod',salaryMin:4000000,region:'Toshkent shahri',employment:'To‘liq kun',experience:'1–3 yil',sample:true};
  return [...flowRecords().filter(v=>!v.archived),...flowSampleJobs(),sampleCV];
}
function flowMatches(record){
  const q=flowNormalize(state.query),title=record.position||record.title||'',definition=(window.ISHDASIZ_POSITIONS||[]).find(v=>flowNormalize(v.title)===flowNormalize(title));
  const text=flowNormalize(title+' '+(record.company||record.name||'')+' '+(definition?.aliases||''));
  if(q&&!q.split(' ').every(term=>text.includes(term)))return false;
  if(state.region!=='Butun O‘zbekiston'&&flowRegionKey(state.region)!==flowRegionKey(record.region))return false;
  const low=flowNumber(record.salaryMin),high=flowNumber(record.salaryMax)||low;
  if(flow.salaryFrom&&high<flowNumber(flow.salaryFrom))return false;
  if(flow.salaryTo&&low>flowNumber(flow.salaryTo))return false;
  return true;
}
function flowResults(){
  const resume=state.searchType==='resumes',records=flowSearchRecords().filter(v=>v.kind===(resume?'resume':'vacancy')&&flowMatches(v));
  const create=`<button class="fresh-inline-create" data-flow-start="${resume?'vacancy':'resume'}">${icon('plus')}<span>${resume?'Vakansiya joylash':'Rezyume joylash'}</span>${icon('right')}</button>`;
  return create+`<p class="fresh-result-caption">${records.length} ta ${resume?'rezyume':'vakansiya'}</p>`+records.map(record=>`<article class="fresh-result-card"><div class="fresh-card-header"><span class="fresh-company-icon ${resume?'mint':''}">${icon(resume?'user':'briefcase')}</span><div><p>${esc(record.company||record.name||'')}${record.sample?' · Namuna':''}</p><h2>${esc(record.position||record.title)}</h2></div>${!resume?`<button class="fresh-save ${flowRead('ishdasiz-v12-saved',[]).includes(record.id)?'saved':''}" data-flow-save="${esc(record.id)}" aria-label="Vakansiyani saqlash" aria-pressed="${flowRead('ishdasiz-v12-saved',[]).includes(record.id)}">${icon('bookmark')}</button>`:''}</div><p class="fresh-salary">${flowSalaryLabel(record)}</p><p class="fresh-location">${icon('pin')}${esc(record.region)}</p><div class="fresh-tags"><span>${esc(record.employment||record.mode||'To‘liq kun')}</span><span>${esc(record.experience||'')}</span></div><button class="secondary full" data-flow-detail="${esc(record.id)}">${resume?'Rezyumeni ko‘rish':'Batafsil'} ${icon('right')}</button></article>`).join('')+(records.length?'':`<div class="fresh-empty">${icon('search')}<h2>E’lon topilmadi</h2><button class="secondary full" data-flow-reset>Barchasini ko‘rish</button></div>`);
}
function flowSearchUpdate(){const results=$('#flow-results');if(results)results.innerHTML=flowResults()}
function flowDetails(id){
  const d=flowSearchRecords().find(v=>v.id===id);if(!d)return;
  flowTrackResume(d,'views');
  modal(`<h2>${esc(d.position||d.title)}</h2><p>${esc(d.company||d.name||'')} · ${esc(d.region)}</p><strong class="flow-detail-salary">${flowSalaryLabel(d)}</strong><p>${esc(d.description||d.skills||'')}</p><button class="primary full" data-flow-contact="${esc(d.id)}">${icon('phone')}${state.loggedIn?'Kontaktni ko‘rish':'Kontakt uchun kirish'}</button>`);
}
function flowFilters(){
  modal(`<h2>Filtrlar</h2><div class="fields"><label class="field"><span>Hudud</span><select id="filter-region">${['Butun O‘zbekiston',...regions].map(r=>`<option ${r===state.region?'selected':''}>${r}</option>`).join('')}</select></label><div class="field-pair"><label class="field"><span>Maosh, dan</span><input id="flow-salary-from" inputmode="numeric" value="${esc(flow.salaryFrom)}" placeholder="0"></label><label class="field"><span>gacha</span><input id="flow-salary-to" inputmode="numeric" value="${esc(flow.salaryTo)}" placeholder="0"></label></div></div><div class="spacer"></div><button class="primary full" data-flow-apply-filters>Qo‘llash</button><button class="text-button" data-flow-clear-filters>Tozalash</button>`);
}
function flowClearError(input){input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');input.closest('.field')?.querySelector('.flow-field-error')?.remove()}
function flowError(input,text){flowClearError(input);input.setAttribute('aria-invalid','true');const note=document.createElement('small');note.className='flow-field-error';note.id='error-'+(input.id||input.dataset.field||'field');note.setAttribute('role','alert');note.textContent=text;input.setAttribute('aria-describedby',note.id);input.closest('.field')?.append(note);input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}
function flowValidateStep(){
  for(const input of document.querySelectorAll('#content input,#content textarea,#content select')){
    flowClearError(input);
    if(input.required&&!input.value.trim()){flowError(input,'Bu maydonni to‘ldiring');return false;}
    if(!input.checkValidity()){flowError(input,input.type==='date'?'Sanani tekshiring':'Ma’lumotni tekshiring');return false;}
  }
  const d=state.form[state.kind];
  for(const [lowKey,highKey] of [['salaryMin','salaryMax'],['ageMin','ageMax']]){if(d[lowKey]&&d[highKey]&&flowNumber(d[lowKey])>flowNumber(d[highKey])){const input=document.querySelector(`[data-field="${highKey}"]`);if(input){flowError(input,'Bu qiymat boshlang‘ich qiymatdan kam bo‘lmasin');return false;}}}
  return true;
}
function flowValidateAll(){const d=state.form[state.kind],required=state.kind==='vacancy'?[['position',0],['company',0],['description',4]]:[['name',0],['position',0]];for(const [key,step]of required){if(!String(d[key]||'').trim()){navigate(state.kind,{step});const input=document.querySelector(`[data-field="${key}"]`);if(input)flowError(input,'Bu maydonni to‘ldiring');return false;}}return true}

let flowCombo=null;
const flowOriginalField=field;
field=function(label,key,options={}){
  if(['position','region','district','skills'].includes(key)){
    const value=state.form[state.kind][key]||'',id='flow-'+state.kind+'-'+key;
    return `<label class="field flow-combo-field"><span>${esc(label)}${options.required?' *':''}</span><span class="flow-input-shell">${icon(key==='region'?'pin':'search')}<input id="${id}" data-field="${key}" data-flow-combo="${key}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" type="text" value="${esc(value)}" placeholder="${key==='position'?'Lavozimni qidiring':key==='region'?'Hududni qidiring':key==='district'?'Tumanni qidiring':'Ko‘nikmalar'}" autocomplete="off" maxlength="${key==='skills'?300:120}" ${options.required?'required':''}><button type="button" data-flow-clear="${id}" aria-label="${key==='position'?'Lavozimni':key==='region'?'Hududni':key==='district'?'Tumanni':'Ko‘nikmalarni'} tozalash" ${value?'':'hidden'}>${icon('close')}</button></span></label>`;
  }
  const markup=flowOriginalField(label,key,{...options,hint:''});
  return markup.replace('<textarea ','<textarea maxlength="2000" ').replace('<input ',`<input id="flow-${state.kind}-${key}" maxlength="${['salaryMin','salaryMax'].includes(key)?14:key==='phone'?22:120}" ${['salaryMin','salaryMax','ageMin','ageMax'].includes(key)?'inputmode="numeric" pattern="[0-9 ]*"':''} ${options.type==='date'?'max="2026-10-28"':''} `);
};
function flowSuggestions(input){
  const kind=input.dataset.flowCombo,raw=kind==='skills'?input.value.split(',').at(-1):input.value,q=flowNormalize(raw);
  if((kind==='position'||kind==='query')&&!/[a-zа-яёўқғҳ]/i.test(raw))return [];
  const preferLatin=/[a-z]/i.test(raw)&&!/[а-яёўқғҳ]/i.test(raw),priority=entry=>entry.score+(preferLatin&&!/[а-яёўқғҳ]/i.test(entry.title)?1.5:0);
  let list=kind==='region'?regions.map(title=>({title,aliases:''})):kind==='district'?((window.ISHDASIZ_LOCATIONS||[]).find(v=>flowRegionKey(v.title)===flowRegionKey(state.form[state.kind].region))?.districts||[]).map(title=>({title,aliases:''})):kind==='skills'?['Excel','Savdo','Mijozlar bilan muloqot','Rus tili','Ingliz tili','Word','SMM','Jamoada ishlash','Hisobotlar','Dasturlash'].map(title=>({title,aliases:''})):(window.ISHDASIZ_POSITIONS||[]);
  return list.map(v=>({...v,score:!q?1:flowNormalize(v.title)===q?5:(' '+flowNormalize(v.aliases)+' ').includes(' '+q+' ')?4:flowNormalize(v.title).startsWith(q)?3:flowNormalize(v.title+' '+v.aliases).includes(q)?2:0})).filter(v=>v.score).sort((a,b)=>priority(b)-priority(a)).slice(0,6);
}
function flowCloseCombo(){if(flowCombo?.input?.isConnected){flowCombo.input.setAttribute('aria-expanded','false');flowCombo.input.removeAttribute('aria-activedescendant')}$('#flow-options')?.remove();flowCombo=null}
function flowPositionCombo(){
  const popup=$('#flow-options');if(!flowCombo||!popup)return;
  const box=(flowCombo.input.closest('.flow-input-shell')||flowCombo.input.closest('.fresh-search-form')||flowCombo.input).getBoundingClientRect(),view=window.visualViewport,topLimit=Math.max($('.app-header').getBoundingClientRect().bottom+5,view?.offsetTop||0),bottom=(view?.height||innerHeight)+(view?.offsetTop||0)-8-(parseFloat(getComputedStyle(app).getPropertyValue('--mini-bottom'))||0);
  const below=bottom-box.bottom-7,above=box.top-topLimit-7,flip=below<150&&above>below,height=Math.min(272,Math.max(80,flip?above:below));
  popup.style.left=Math.max(12,box.left-4)+'px';popup.style.width=Math.min(innerWidth-24,box.width+8)+'px';popup.style.maxHeight=height+'px';popup.style.top=(flip?Math.max(topLimit,box.top-7-Math.min(height,popup.scrollHeight)):box.bottom+7)+'px';
}
function flowOpenCombo(input){
  const matches=flowSuggestions(input);flowCloseCombo();if(!matches.length)return;
  const popup=document.createElement('div');popup.id='flow-options';popup.className='flow-options';popup.setAttribute('role','listbox');popup.setAttribute('aria-label',input.dataset.flowCombo==='region'?'Hududlar':'Takliflar');popup.innerHTML=matches.map((entry,index)=>`<div role="option" id="flow-option-${index}" aria-selected="false" data-flow-option="${index}"><i>${icon(['region','district'].includes(input.dataset.flowCombo)?'pin':input.dataset.flowCombo==='skills'?'spark':'briefcase')}</i><span>${flowHighlight(entry.title,input.value)}</span><b>${icon('right')}</b></div>`).join('');app.append(popup);flowCombo={input,matches,index:-1};input.setAttribute('aria-expanded','true');flowPositionCombo();
}
function flowHighlight(title,query){
  const text=String(title),q=String(query).trim();if(!q)return esc(text);
  const start=text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());if(start<0)return esc(text);
  return esc(text.slice(0,start))+'<mark>'+esc(text.slice(start,start+q.length))+'</mark>'+esc(text.slice(start+q.length));
}
function flowChoose(index){
  if(!flowCombo)return;const {input,matches}=flowCombo,entry=matches[index];if(!entry)return;
  let value=entry.title;if(input.dataset.flowCombo==='skills'){const current=input.value.split(',').slice(0,-1).map(v=>v.trim()).filter(Boolean);value=[...current,entry.title].join(', ');}
  input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));flowCloseCombo();input.focus();if(input.dataset.flowCombo==='query'){state.query=value;flowSearchUpdate();}flowSaveDraft();
}
function flowMoveOption(index){if(!flowCombo)return;flowCombo.index=(index+flowCombo.matches.length)%flowCombo.matches.length;const popup=$('#flow-options');popup.querySelectorAll('[role="option"]').forEach((el,i)=>el.setAttribute('aria-selected',String(i===flowCombo.index)));const active=popup.children[flowCombo.index];flowCombo.input.setAttribute('aria-activedescendant',active.id);if(active.offsetTop<popup.scrollTop)popup.scrollTop=active.offsetTop;else if(active.offsetTop+active.offsetHeight>popup.scrollTop+popup.clientHeight)popup.scrollTop=active.offsetTop+active.offsetHeight-popup.clientHeight;}

const flowOriginalRender=render;
render=function(){flowCloseCombo();flowSyncAllowance();flowOriginalRender();if(!document.activeElement.closest?.('.flow-home'))app.classList.remove('focus-paused');scheduleFreshScene();if(state.screen==='review'){const footer=$('#content .form-footer');if(footer)$('#action-bar').append(footer);}document.querySelectorAll('.form-details .field>small').forEach(el=>el.remove());};
const flowOriginalNavigate=navigate;
navigate=function(screen,options={}){if(state.screen==='auth'&&screen!=='auth'){flow.pendingAuth=null;flow.switchAccount=false;}flowCloseCombo();flowOriginalNavigate(screen,options);flowSaveDraft();};
const flowOriginalModal=modal;
modal=function(html){flowCloseCombo();flowOriginalModal(html)};

document.addEventListener('input',event=>{
  const input=event.target;if(input.dataset.field){if(flow.confirmedTx===flow.tx){flow.tx=flowId();flow.activeId=flowId();flow.confirmedTx=null;state.orderPaid=false;}if(input.dataset.field==='region'&&state.form[state.kind].region!==input.value){state.form[state.kind].district='';const district=document.querySelector('[data-field="district"]');if(district)district.value='';}state.form[state.kind][input.dataset.field]=input.value;flowClearError(input);const clear=input.closest('.field')?.querySelector('[data-flow-clear]');if(clear)clear.hidden=!input.value;flowSaveDraft();}
  if(input.dataset.flowCombo==='query'){state.query=input.value;flowSearchUpdate();}
  if(input.dataset.flowCombo)flowOpenCombo(input);
},true);
document.addEventListener('focusin',event=>{if(event.target.dataset.flowCombo)flowOpenCombo(event.target)});
document.addEventListener('pointerdown',event=>{const option=event.target.closest('[data-flow-option]');if(option){event.preventDefault();flowChoose(Number(option.dataset.flowOption));return}if(flowCombo&&!event.target.closest('.flow-options')&&event.target!==flowCombo.input)flowCloseCombo();},true);
document.addEventListener('keydown',event=>{
  if(!event.target.dataset.flowCombo)return;
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
  if(b.hasAttribute('data-pay')){stop();if(!validSchedule()){toast('Boshqa vaqtni tanlang');return;}const plan=plans[state.selectedPlan];modal(`<h2>To‘lov</h2><div class="flow-checkout-summary"><span>${state.kind==='resume'?'Rezyume':'Vakansiya'} · ${plan.days}</span><strong>${money(tariffPrice(plan))}<small>so‘m</small></strong><p>${shortDate(calendarDates()[0])} · ${state.scheduleMode==='same'?state.scheduleTime:'Tanlangan vaqtlar'}${plan.pin?'<br>Zakrep — butun muddatga':''}</p></div><p>Demo: pul yechilmaydi.</p><button class="primary full" data-demo-paid>To‘lov ko‘rinishini tasdiqlash</button><button class="text-button full" data-close>Orqaga</button>`);return;}
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
  if(b.hasAttribute('data-verify-sms')){stop();if(!/^\d{5}$/.test($('#sms-code').value)){flowError($('#sms-code'),'5 xonali kodni kiriting');return;}if(flow.switchAccount){flowClearMedia();state.form=structuredClone(flow.defaults);flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=true;state.orderPaid=false;flow.switchAccount=false;}state.loggedIn=true;state.phone='+998'+state.phone.replace(/\D/g,'').slice(-9);flowWrite('ishdasiz-v12-account',{phone:state.phone});flowSyncAllowance();const target=flow.pendingAuth||'profile';flow.pendingAuth=null;navigate(target);return;}
  if(b.dataset.flowClear){stop();const input=document.getElementById(b.dataset.flowClear);input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return;}
  if(b.dataset.filter&&state.screen==='search'){stop();flowFilters();return;}
  if(b.hasAttribute('data-flow-apply-filters')){stop();const low=$('#flow-salary-from'),high=$('#flow-salary-to');if(flowNumber(low.value)&&flowNumber(high.value)&&flowNumber(low.value)>flowNumber(high.value)){flowError(high,'Qiymat boshlang‘ich maoshdan kam bo‘lmasin');return;}state.region=$('#filter-region').value;flow.salaryFrom=low.value;flow.salaryTo=high.value;closeModal();render();return;}
  if(b.hasAttribute('data-flow-clear-filters')||b.hasAttribute('data-flow-reset')){stop();state.region='Butun O‘zbekiston';state.query='';flow.salaryFrom='';flow.salaryTo='';closeModal();render();return;}
  if(b.dataset.flowCandidates){stop();const vacancy=b.dataset.flowCandidates==='draft'?state.form.vacancy:flowOwnRecords().find(r=>r.id===b.dataset.flowCandidates);if(!vacancy)return;state.searchType='resumes';state.query=vacancy.position||'';state.region='Butun O‘zbekiston';flow.salaryFrom='';flow.salaryTo='';navigate('search');return;}
  if(b.dataset.flowDetail){stop();flowDetails(b.dataset.flowDetail);return;}
  if(b.dataset.flowSave){stop();const saved=new Set(flowRead('ishdasiz-v12-saved',[]));saved.has(b.dataset.flowSave)?saved.delete(b.dataset.flowSave):saved.add(b.dataset.flowSave);flowWrite('ishdasiz-v12-saved',[...saved]);flowSearchUpdate();return;}
  if(b.dataset.flowContact){stop();if(!state.loggedIn){flow.pendingAuth='search';navigate('auth');return;}const record=flowSearchRecords().find(v=>v.id===b.dataset.flowContact);if(!record)return;flowTrackResume(record,'contacts');modal(`<h2>Aloqa</h2><p>${record.sample?'Demo: haqiqiy kontakt yo‘q.':esc(record.phone||'Kontakt kiritilmagan')}</p><button class="secondary full" data-close>Yopish</button>`);return;}
  if(b.dataset.flowRepost||b.dataset.flowEditRecord){stop();const record=flowOwnRecords().find(v=>v.id===(b.dataset.flowRepost||b.dataset.flowEditRecord));if(!record)return;state.kind=record.kind;state.form[record.kind]={...record};flow.activeId=record.id;flow.tx=flowId();flow.confirmedTx=null;flow.channel=!!b.dataset.flowRepost;state.orderPaid=false;if(b.dataset.flowRepost&&!flowFree(record.kind)){flow.priceTarget='review';flowPrices(record.kind);}else navigate(b.dataset.flowRepost?'review':record.kind);return;}
  if(b.dataset.flowArchive){stop();modal(`<h2>E’lonni olib tashlash?</h2><button class="primary full" data-flow-archive-confirm="${esc(b.dataset.flowArchive)}">Olib tashlash</button><button class="secondary full" data-close>Bekor qilish</button>`);return;}
  if(b.dataset.flowArchiveConfirm){stop();flowWrite('ishdasiz-v12-records',flowRecords().map(v=>v.id===b.dataset.flowArchiveConfirm&&v.account===flowAccount()?{...v,archived:true}:v));closeModal();render();return;}
},true);
paths.eye='M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0';
render();
window.ISHDASIZFlow={flow,free:flowFree,records:flowRecords,begin:flowBegin,publish:flowPublish,closeCombo:flowCloseCombo};
