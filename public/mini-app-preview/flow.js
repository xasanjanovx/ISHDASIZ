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
  return `<section class="view fresh-results flow-search">${freshTitle(state.searchType==='resumes'?'Xodim topish':'Ish topish')}<div class="tabs"><button class="${state.searchType==='jobs'?'active':''}" data-search-type="jobs">Vakansiyalar</button><button class="${state.searchType==='resumes'?'active':''}" data-search-type="resumes">Rezyumelar</button></div><form id="results-search" class="fresh-search-form"><label>${icon('search')}<input id="flow-query" name="query" aria-label="Qidiruv" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" placeholder="Lavozim yoki kompaniya" value="${esc(state.query)}" autocomplete="off" maxlength="120" data-flow-combo="query"></label><button type="submit" aria-label="Qidirish">${icon('right')}</button></form><div class="fresh-search-tools"><button data-filter="region">${icon('pin')}${esc(state.region)}</button><button data-filter="all">${icon('filter')}Filtr${flow.salaryFrom||flow.salaryTo?' · 1':''}</button></div><div id="flow-results" aria-live="polite">${flowResults()}</div></section>`;
}
function freshForm(){
  const steps=formSteps[state.kind];state.step=Math.min(state.step,steps.length-1);const [heading]=steps[state.step];
  return `<section class="view fresh-form">${freshTitle(state.kind==='vacancy'?'Vakansiya joylash':'Rezyume joylash')}${polishPublicationNote()}<div class="flow-step-heading"><span>${state.step+1}<small> / ${steps.length}</small></span><b>${heading}</b></div><div class="step-track" aria-label="${state.step+1} / ${steps.length} qadam">${steps.map((_,i)=>`<i class="${i<=state.step?'done':''}"></i>`).join('')}</div><div class="form-surface"><div class="fields">${formContent()}</div></div><div class="form-footer"><button class="secondary" data-step="back">${icon('back')}<span>Orqaga</span></button><button class="primary" data-step="next">${state.step===steps.length-1?'Ko‘rib chiqish':'Davom etish'}<span class="studio-button-end">${icon('right')}</span></button></div></section>`;
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
  return {defaults,activeId:continuing?draft.activeId||flowId():flowId(),tx:continuing?draft.tx||flowId():flowId(),channel:continuing?draft.channel!==false:true,confirmedTx:continuing?draft.confirmedTx||null:null,lastId:flowRead('ishdasiz-v12-last',''),pendingAuth:draft?.pendingAuth||null,pendingApplication:draft?.pendingApplication||null,switchAccount:false,priceTarget:'review',salaryFrom:'',salaryTo:'',preselectedPaid:!!(continuing&&draft.preselectedPaid),confirming:false};
}
function flowSaveDraft(){flowWrite('ishdasiz-v12-draft',{form:state.form,kind:state.kind,step:state.step,activeId:flow.activeId,tx:flow.tx,channel:flow.channel,confirmedTx:flow.confirmedTx,pendingAuth:flow.pendingAuth,pendingApplication:flow.pendingApplication,paid:state.orderPaid,paidTx:flow.tx,plan:state.selectedPlan,preselectedPaid:flow.preselectedPaid,schedule:{startDate:state.startDate,mode:state.scheduleMode,time:state.scheduleTime,dailyTimes:state.dailyTimes}});}
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
  polishInferCurrent();
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
function flowSalaryLabel(d){const low=flowNumber(d.salaryMin),high=flowNumber(d.salaryMax);return low||high?`${low?money(low):''}${low&&high?' — ':''}${high?money(high):''} so‘m`:esc(d.salary||'Kelishiladi')}
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
  modal(`<h2>Filtrlar</h2><div class="fields"><label class="field"><span>Hudud</span><select id="filter-region">${['Butun O‘zbekiston',...regions].map(r=>`<option ${r===state.region?'selected':''}>${r}</option>`).join('')}</select></label><div class="field-pair"><label class="field"><span>Maosh, dan</span><input id="flow-salary-from" inputmode="numeric" value="${esc(flow.salaryFrom)}" placeholder="0"></label><label class="field"><span>gacha</span><input id="flow-salary-to" inputmode="numeric" value="${esc(flow.salaryTo)}" placeholder="0"></label></div></div><div class="spacer"></div><button class="primary full" data-flow-apply-filters>Qo‘llash</button><button class="text-button" data-flow-clear-filters>Tozalash</button>`);
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
  if(state.kind==='vacancy'&&state.step===2&&d.workMode!=='Masofaviy'&&!discoveryPoint(d)){toast('Ish joyini xaritada belgilang');document.querySelector('[data-map]')?.focus();return false;}
  if(state.kind==='resume'&&state.step===2&&!d.workMode){toast('Ish shaklini tanlang');return false;}
  for(const [lowKey,highKey] of [['salaryMin','salaryMax'],['ageMin','ageMax']]){if(d[lowKey]&&d[highKey]&&flowNumber(d[lowKey])>flowNumber(d[highKey])){const input=document.querySelector(`[data-field="${highKey}"]`);if(input){flowError(input,'Bu qiymat boshlang‘ich qiymatdan kam bo‘lmasin');return false;}}}
  return true;
}
function flowValidateAll(){const d=state.form[state.kind];if(state.kind==='vacancy'&&d.workMode!=='Masofaviy'&&!discoveryPoint(d)){navigate('vacancy',{step:2});toast('Ish joyini xaritada belgilang');return false;}if(state.kind==='resume'&&!d.workMode){navigate('resume',{step:2});toast('Ish shaklini tanlang');return false;}const required=state.kind==='vacancy'?[['position',0],['company',0],['description',4]]:[['name',0],['position',0]];for(const [key,step]of required){if(!String(d[key]||'').trim()){navigate(state.kind,{step});const input=document.querySelector(`[data-field="${key}"]`);if(input)flowError(input,'Bu maydonni to‘ldiring');return false;}}return true}

let flowCombo=null;
const flowOriginalField=field;
field=function(label,key,options={}){
  if(options.options&&!['position','region','district','skills'].includes(key))return polishSelectField(label,key,options);
  if(['position','region','district','skills'].includes(key)){
    const value=state.form[state.kind][key]||'',id='flow-'+state.kind+'-'+key;
    const markup=`<label class="field flow-combo-field"><span>${esc(label)}${options.required?' *':''}</span><span class="flow-input-shell">${icon(key==='region'?'pin':'search')}<input id="${id}" data-field="${key}" data-flow-combo="${key}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="flow-options" type="text" value="${esc(value)}" placeholder="${key==='position'?'Lavozimni qidiring':key==='region'?'Hududni qidiring':key==='district'?'Tumanni qidiring':'Ko‘nikmalar'}" autocomplete="off" maxlength="${key==='skills'?300:120}" ${options.required?'required':''}><button type="button" data-flow-clear="${id}" aria-label="${key==='position'?'Lavozimni':key==='region'?'Hududni':key==='district'?'Tumanni':'Ko‘nikmalarni'} tozalash" ${value?'':'hidden'}>${icon('close')}</button></span></label>`;return polishHintMarkup(markup,key);
  }
  const markup=flowOriginalField(label,key,{...options,hint:''});
  return polishHintMarkup(markup.replace('<textarea ','<textarea maxlength="2000" ').replace('<input ',`<input id="flow-${state.kind}-${key}" maxlength="${['salaryMin','salaryMax'].includes(key)?14:key==='phone'?22:120}" ${['salaryMin','salaryMax','ageMin','ageMax'].includes(key)?'inputmode="numeric" pattern="[0-9 ]*"':''} ${options.type==='date'?'max="2026-10-30"':''} `),key);
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
  const box=(flowCombo.input.closest('.polish-choice-shell')||flowCombo.input.closest('.flow-input-shell')||flowCombo.input.closest('.fresh-search-form')||flowCombo.input).getBoundingClientRect(),view=window.visualViewport,topLimit=Math.max($('.app-header').getBoundingClientRect().bottom+5,view?.offsetTop||0),bottom=(view?.height||innerHeight)+(view?.offsetTop||0)-8-(parseFloat(getComputedStyle(app).getPropertyValue('--mini-bottom'))||0);
  const below=bottom-box.bottom-7,above=box.top-topLimit-7,flip=below<150&&above>below,height=Math.min(272,Math.max(80,flip?above:below));
  popup.style.left=Math.max(12,box.left-4)+'px';popup.style.width=Math.min(innerWidth-24,box.width+8)+'px';popup.style.maxHeight=height+'px';popup.style.top=(flip?Math.max(topLimit,box.top-7-Math.min(height,popup.scrollHeight)):box.bottom+7)+'px';
}
function flowOpenCombo(input){
  if(input.dataset.flowSelect){polishOpenSelect(input);return;}
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
const discoveryOriginalClose=closeModal;closeModal=function(){if(flow.discoveryPicker){flow.discoveryPicker.remove();flow.discoveryPicker=null;flow.pickedMarker=null;}discoveryOriginalClose();};

document.addEventListener('input',event=>{
  const input=event.target;if(input.dataset.field){if(flow.confirmedTx===flow.tx){flow.tx=flowId();flow.activeId=flowId();flow.confirmedTx=null;state.orderPaid=false;}if(input.dataset.field==='region'&&state.form[state.kind].region!==input.value){state.form[state.kind].district='';if(state.kind==='vacancy')state.form.vacancy.coordinates=null;const district=document.querySelector('[data-field="district"]');if(district)district.value='';}if(state.kind==='vacancy'&&input.dataset.field==='district'&&state.form.vacancy.district!==input.value)state.form.vacancy.coordinates=null;state.form[state.kind][input.dataset.field]=input.value;if(input.dataset.field==='position')polishInferCurrent();flowClearError(input);const clear=input.closest('.field')?.querySelector('[data-flow-clear]');if(clear)clear.hidden=!input.value;flowSaveDraft();}
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
  if(b.hasAttribute('data-flow-apply-filters')){stop();const low=$('#flow-salary-from'),high=$('#flow-salary-to');if(flowNumber(low.value)&&flowNumber(high.value)&&flowNumber(low.value)>flowNumber(high.value)){flowError(high,'Qiymat boshlang‘ich maoshdan kam bo‘lmasin');return;}state.region=$('#filter-region').value;flow.salaryFrom=low.value;flow.salaryTo=high.value;closeModal();render();return;}
  if(b.hasAttribute('data-flow-clear-filters')||b.hasAttribute('data-flow-reset')){stop();state.region='Butun O‘zbekiston';state.query='';flow.salaryFrom='';flow.salaryTo='';closeModal();render();return;}
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
  return `<nav class="discovery-account-row" aria-label="Shaxsiy kabinet"><button data-nav="profile">${icon('user')}<span>Profilim</span></button><button data-nav="listings">${icon('file')}<span>Mening<br>e’lonlarim</span></button><button data-nav="applications">${icon('send')}<span>Arizalarim</span></button></nav>`;
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
  if(min&&max){if(min>max)issues.push('Kutilgan maosh yuqoriroq');else reasons.push('Maosh mos');}else issues.push('Maosh aniqlashtiriladi');
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
function discoveryFingerprint(job){return JSON.stringify({role:[...flowPositionTerms(job.position)],mode:flowNormalize(job.workMode),employment:flowNormalize(job.employment),days:flowNormalize(job.days),languages:flowNormalize(job.languages),region:flowRegionKey(job.region),district:flowNormalize(job.district),salaryMin:flowNumber(job.salaryMin),salaryMax:flowNumber(job.salaryMax),experience:discoveryExperience(job.experience),coordinates:discoveryPoint(job)?.map(v=>Number(v.toFixed(5)))||null});}
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
function discoveryOpenCandidates(id){const job=id==='draft'?{...state.form.vacancy,kind:'vacancy'}:flowOwnRecords().find(r=>r.id===id&&r.kind==='vacancy');if(!job)return;if(job.id)discoverySetContext(job.id);state.searchType='resumes';state.query='';state.region='Butun O‘zbekiston';flow.salaryFrom='';flow.salaryTo='';if(!discoveryUnlocked(job)){modal(discoveryGate(job));return;}navigate('search');}
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
function discoveryMapPicker(){
  modal(`<h2>Ish joyini belgilang</h2><div id="discovery-picker" aria-label="Ish joyini xaritada tanlang"></div><button class="text-button full" data-discovery-picker-center>Markazdagi nuqtani tanlash</button><p id="discovery-picked-point">Xaritadan ish joyini tanlang.</p><button class="primary full" data-discovery-save-point disabled>Shu joyni tanlash ${icon('check')}</button>`);
  if(!window.L)return;
  const map=L.map('discovery-picker',{center:discoveryPoint(state.form.vacancy)||[41.3111,69.2797],zoom:13,scrollWheelZoom:false});map.attributionControl.setPrefix(false);flow.discoveryPicker=map;flow.pickedPoint=null;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  const select=point=>{flow.pickedPoint=point;if(flow.pickedMarker)flow.pickedMarker.remove();flow.pickedMarker=L.circleMarker(point,{radius:10,color:'#fff',weight:3,fillColor:'#185bec',fillOpacity:1}).addTo(map);$('#discovery-picked-point').textContent=point.map(v=>v.toFixed(5)).join(', ');$('[data-discovery-save-point]').disabled=false;};
  flow.pickerSelect=select;map.on('click',e=>select([e.latlng.lat,e.latlng.lng]));if(discoveryPoint(state.form.vacancy))select(discoveryPoint(state.form.vacancy));
}
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
  if(state.screen==='resume'&&state.step===2){const fields=$('#content .fields');if(fields&&!$('#discovery-resume-location'))fields.insertAdjacentHTML('beforeend',`<div id="discovery-resume-location"><button class="secondary full" data-discovery-locate="resume">${icon('pin')}${discoveryPoint(state.form.resume)?'Joylashuv qo‘shildi':'Joylashuvimni qo‘shish'}</button>${discoveryPoint(state.form.resume)?'<button class="text-button full" data-discovery-clear-location>Joylashuvni o‘chirish</button>':''}<small>Faqat masofani hisoblash uchun. Aniq nuqta nomzodlar xaritasida ko‘rsatilmaydi.</small></div>`);}
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
  if(b.hasAttribute('data-discovery-save-point')){stop();if(!discoveryPoint({coordinates:flow.pickedPoint}))return;state.form.vacancy.coordinates=flow.pickedPoint;flowSaveDraft();closeModal();render();return;}
  if(b.dataset.discoveryLocate){stop();discoveryLocate(b.dataset.discoveryLocate);return;}
},true);
discoveryAfterRender();

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
  const tips={position:'Kamida 1 harf yozing. Mos lavozimni tanlang yoki o‘zingiz kiriting.',company:'Kompaniya, do‘kon yoki tashkilotning nomini yozing.',region:'Ish qidiriladigan hududni tanlang.',district:'Hududga mos tuman yoki shaharni tanlang.',salaryMin:'Oyiga, so‘mda. Masalan: 4 000 000.',salaryMax:'Eng kam maoshdan kam bo‘lmasin.',address:'Ko‘cha, bino va mo‘ljalni yozing; xaritada aniq nuqtani belgilang.',description:'Asosiy vazifalar va ish shartlarini qisqa yozing.',skills:'Ko‘nikmalarni vergul bilan ajrating.',phone:'Aloqa uchun boshqa raqamni ham yozishingiz mumkin.'};
  let text=tips[key]||'';if(key==='region'&&state.kind==='vacancy')text='Ish joylashgan hududni tanlang. Aniq manzil keyingi qadamda.';
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
  const text=state.kind==='resume'?'Bepul · Rezyume bazasida saqlanadi':flowFree('vacancy')?'Sayt va kanalda bepul joylang':'Saytda bepul joylang';
  return `<p class="polish-publication-note">${icon('check')}<span>${text}</span></p>`;
}
const polishOriginalFormContent=formContent;
formContent=function(){
  if(state.kind==='vacancy'&&state.step===0)return field('Lavozim','position',{required:true})+field('Kompaniya yoki tashkilot nomi','company',{required:true})+field('Ish joylashgan hudud','region',{required:true});
  if(state.kind==='vacancy'&&state.step===2)return `<div class="polish-location-summary"><span>${icon('pin')}${esc(state.form.vacancy.region||'Hudud tanlanmagan')}</span><button data-polish-edit-region>O‘zgartirish${icon('edit')}</button></div>`+field('Tuman yoki shahar','district')+field('Ish manzili','address',{placeholder:'Ko‘cha, bino va mo‘ljal'})+`<button class="secondary full" data-map>${icon('pin')}Xaritadan belgilash</button>`;
  return polishOriginalFormContent();
};
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.flowSelect){event.preventDefault();event.stopImmediatePropagation();if(flowCombo?.input===button)flowCloseCombo();else polishOpenSelect(button);}
  if(button.hasAttribute('data-polish-edit-region')){event.preventDefault();event.stopImmediatePropagation();navigate('vacancy',{step:0});document.querySelector('[data-field="region"]')?.focus();}
},true);
render();
