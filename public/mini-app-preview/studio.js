/* Fresh UI prototype. All search/form/order data remains local demonstration data. */
state.layout='studio';state.theme=localStorage.getItem('ishdasiz-fresh-theme')||'light';state.region='Butun O‘zbekiston';
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
  return `<div class="studio-create" aria-label="E’lon joylash"><button class="studio-create-tile hiring" data-nav="vacancy"><span class="studio-tile-top"><small>Xodim kerakmi?</small><span class="studio-tile-plus">${icon('plus')}</span></span>${studioObject('vacancy')}<strong>Vakansiya<br>joylash</strong><span class="studio-tile-bottom"><small>Saytda bepul</small>${icon('right')}</span></button><button class="studio-create-tile career" data-nav="resume"><span class="studio-tile-top"><small>Ish izlayapsizmi?</small><span class="studio-tile-plus">${icon('plus')}</span></span>${studioObject('resume')}<strong>Rezyume<br>joylash</strong><span class="studio-tile-bottom"><small>Saytda bepul</small>${icon('right')}</span></button></div>`;
}
function freshHome(){
  const first=!state.freeResumeUsed;
  return `<section class="view studio-home"><div class="studio-home-heading"><h1>Ish va xodim<br> topish oson.</h1><p>Kerakli insonlar.<br>Yangi imkoniyatlar.</p></div>${studioCreateTiles()}
  <div class="studio-find" aria-label="Qidirish"><button data-fresh-intent="hiring">${icon('users')}<span>Xodim topish</span>${icon('right')}</button><button data-fresh-intent="career">${icon('search')}<span>Ish topish</span>${icon('right')}</button></div>
  <div class="studio-professions"><div class="studio-profession-intro"><small>Har bir kasb uchun</small><b>O‘z joyingizni<br>toping.</b></div>${freshHero()}</div>
  <section class="studio-channel" aria-labelledby="channel-title"><div class="studio-channel-heading"><span class="studio-telegram-mark">${icon('send')}</span><span>@ishdasiz<small>Telegram kanali</small></span><span class="studio-channel-tag">${first?'1-rezyume':'Rezyumelar'}</span></div><div class="studio-channel-body"><h2 id="channel-title">${first?'Birinchi rezyume.<br>Kanalda ham bepul.':'Rezyumeni<br>kanalga joylang.'}</h2><span class="studio-channel-price" aria-hidden="true">${first?'<b>0</b><small>so‘m</small>':icon('send')}</span></div><p>${first?'Rezyumeni to‘ldiring. Ish beruvchilar bilan kanalda ham uchrashing.':'Keyingi rezyume uchun mos tarifni tanlang.'}</p><button class="studio-channel-action" ${first?'data-nav="resume"':'data-home-plans="resume"'}><span>${first?'Bepul rezyume joylash':'Rezyume tariflari'}</span><i>${icon('right')}</i></button><small class="studio-channel-terms">${first?'Faqat birinchi rezyume bepul. Vakansiyalar va keyingi rezyumelar — tarif bo‘yicha.':'Saytda barcha rezyumelar doim bepul.'}</small></section>
  <div class="studio-home-links"><button data-nav="listings">${icon('file')}<span>Mening e’lonlarim</span>${icon('right')}</button><button data-nav="profile">${icon('user')}<span>Shaxsiy kabinet</span>${icon('right')}</button></div>
  </section>`;
}
function freshSearch(){
  const resumes=state.searchType==='resumes';
  const normalize=value=>value.toLowerCase().replace(/shahri|viloyati/g,'').replace(/[‘’ʻʼ']/g,'').trim();
  const matches=jobs.filter(job=>(job.title+' '+job.company).toLowerCase().includes(state.query.toLowerCase().trim())&&(state.region==='Butun O‘zbekiston'||normalize(state.region).includes(normalize(job.region))));
  return `<section class="view fresh-results">${freshTitle(resumes?'Xodim topish':'Ish topish')}
    <div class="tabs"><button class="${!resumes?'active':''}" data-search-type="jobs">Vakansiyalar</button><button class="${resumes?'active':''}" data-search-type="resumes">Rezyumelar</button></div>
    <form id="results-search" class="fresh-search-form"><label>${icon('search')}<input name="query" aria-label="Qidiruv" placeholder="Kasb yoki kompaniya" value="${esc(state.query)}" autocomplete="off"></label><button type="submit" aria-label="Qidirish">${icon('right')}</button></form>
    <div class="fresh-search-tools"><button data-filter="region">${icon('pin')}${esc(state.region)}</button><button data-filter="all">${icon('filter')}Filtr</button></div>
    <button class="fresh-inline-create" data-nav="${resumes?'vacancy':'resume'}">${icon('plus')}<span>${resumes?'Vakansiya joylash':'Rezyume joylash'}<small>Saytda bepul</small></span>${icon('right')}</button>
    <p class="fresh-result-caption">${resumes?'Nomzod namunasi':'Vakansiya namunalari'}</p>
    ${resumes?`<article class="fresh-result-card"><div class="fresh-card-header"><span class="fresh-initial">A</span><div><h2>Sotuvchi</h2><p>Namuna rezyume · Toshkent</p></div></div><p class="fresh-salary">4 mln so‘mdan</p><div class="fresh-tags"><span>1–3 yil tajriba</span><span>To‘liq kun</span></div><button class="primary full" data-contact>${icon('phone')}${state.loggedIn?'Kontaktni ko‘rish':'Kontakt uchun kirish'}</button><p class="fresh-private">${icon('shield')}Telefon faqat kirganlarga ko‘rinadi</p></article>`:
    matches.map((job,i)=>`<article class="fresh-result-card" style="--card-index:${i}"><div class="fresh-card-header"><span class="fresh-company-icon">${icon('briefcase')}</span><div><p>${job.company}</p><h2>${job.title}</h2></div><button class="fresh-save" data-save aria-label="Vakansiyani saqlash">${icon('bookmark')}</button></div><p class="fresh-salary">${job.salary}</p><p class="fresh-location">${icon('pin')}${job.region}</p><div class="fresh-tags"><span>${job.mode}</span><span>${job.experience}</span></div><button class="secondary full" data-job="${jobs.indexOf(job)}">Batafsil ${icon('right')}</button></article>`).join('')||`<div class="fresh-empty">${icon('search')}<h2>Hozircha topilmadi</h2><p>Boshqa so‘z yoki hududni tanlang.</p><button class="secondary full" data-fresh-reset>Barcha vakansiyalar</button></div>`}
  </section>`;
}
function freshForm(){
  const steps=formSteps[state.kind];state.step=Math.min(state.step,steps.length-1);const [heading,subtitle]=steps[state.step];
  return `<section class="view fresh-form">${freshTitle(state.kind==='vacancy'?'Vakansiya joylash':'Rezyume joylash')}<div class="studio-form-meta"><span class="studio-step-number">${state.step+1}<small>/${steps.length}</small></span><div><b>${state.kind==='vacancy'?'Yangi vakansiya':'Yangi rezyume'}</b><small>Saytga joylash bepul</small></div><span class="studio-form-free">${icon('check')}Bepul</span></div><div class="step-track" aria-label="${state.step+1} / ${steps.length} qadam">${steps.map((_,i)=>`<i class="${i<=state.step?'done':''}"></i>`).join('')}</div><div class="fresh-question"><h2 class="form-title">${heading}</h2><p>${subtitle}</p></div><div class="form-surface"><div class="fields">${formContent()}</div></div><p class="saved-row">${icon('shield')}Ma’lumotlaringiz shu shaklda saqlanadi</p><div class="form-footer"><button class="secondary" data-step="back">${icon('back')}<span>Orqaga</span></button><button class="primary" data-step="next">${state.step===steps.length-1?'Bepul joylash':'Davom etish'}<span class="studio-button-end">${icon('right')}</span></button></div></section>`;
}
function freshProfile(){
  return `<section class="view fresh-profile">${freshTitle('Shaxsiy kabinet')}<div class="studio-identity"><span class="studio-identity-avatar">${state.loggedIn?esc((state.form.resume.name||'I').slice(0,1)):icon('user')}<i>${icon('check')}</i></span><div><h2>${state.loggedIn?esc(state.form.resume.name||'Xush kelibsiz'):'Sizning profilingiz'}</h2><p>${state.loggedIn?esc(state.phone):'Ish va xodim uchun bitta profil'}</p></div></div>${state.loggedIn?'':`<button class="primary full studio-profile-login" data-nav="auth">${icon('phone')}Profilga kirish<span class="studio-button-end">${icon('right')}</span></button>`}<div class="studio-section-label"><h2>Yangi e’lon</h2><span>Saytda bepul</span></div>${studioCreateTiles()}<div class="studio-section-label"><h2>Mening e’lonlarim</h2></div><div class="studio-profile-list"><button data-fresh-list="resumes"><span class="studio-list-mark resume">${icon('file')}</span><span><b>Rezyumelarim</b><small>Ko‘rish va boshqarish</small></span>${icon('right')}</button><button data-fresh-list="jobs"><span class="studio-list-mark vacancy">${icon('briefcase')}</span><span><b>Vakansiyalarim</b><small>Ko‘rish va boshqarish</small></span>${icon('right')}</button></div><div class="fresh-menu-list">${[['wallet','Kanal tariflari','plans'],['bell','Bildirishnomalar','notifications'],['filter','Sozlamalar','settings']].map(([ic,label,route])=>`<button ${route==='notifications'?'data-notifications':`data-nav="${route}"`}>${icon(ic)}<span>${label}</span>${icon('right')}</button>`).join('')}</div></section>`;
}
function freshListings(){
  const vacancy=state.form.vacancy,resume=state.form.resume;
  return `<section class="view">${freshTitle('Mening e’lonlarim','profile')}<div class="tabs"><button class="${state.listTab==='all'?'active':''}" data-list-tab="all">Barchasi</button><button class="${state.listTab==='jobs'?'active':''}" data-list-tab="jobs">Vakansiya</button><button class="${state.listTab==='resumes'?'active':''}" data-list-tab="resumes">Rezyume</button></div>
  ${state.listTab!=='resumes'?`<article class="fresh-listing"><div class="fresh-listing-top"><span class="fresh-company-icon">${icon('briefcase')}</span><span class="fresh-status">Saytda · namuna</span></div><h2>${esc(vacancy.position||'Vakansiya')}</h2><p>${esc(vacancy.company||'Kompaniya')} · ${esc(vacancy.region||'Hudud')}</p><strong class="fresh-listing-free">Saytda bepul</strong><button class="primary full" data-channel-kind="vacancy">Kanalga joylash <small>Pullik</small>${icon('send')}</button><div class="fresh-edit-actions"><button data-nav="vacancy">${icon('edit')}Tahrirlash</button><button data-delete="vacancy">${icon('trash')}Olib tashlash</button></div></article>`:''}
  ${state.listTab!=='jobs'?`<article class="fresh-listing"><div class="fresh-listing-top"><span class="fresh-company-icon mint">${icon('file')}</span><span class="fresh-status">Saytda · namuna</span></div><h2>Mening rezyumem</h2><p>${esc(resume.position||'Kasb')} · ${esc(resume.experience||'Tajriba')}</p><strong class="fresh-listing-free">${state.freeResumeUsed?'Saytda bepul':'Kanalda birinchisi bepul'}</strong><button class="primary full" data-channel-kind="resume">${state.freeResumeUsed?'Kanal tarifini tanlash':'Kanalga bepul joylash'}${icon('send')}</button><div class="fresh-edit-actions"><button data-nav="resume">${icon('edit')}Tahrirlash</button><button data-delete="resume">${icon('trash')}Olib tashlash</button></div></article>`:''}
  <button class="secondary full" data-create>${icon('plus')}Yangi e’lon yaratish</button></section>`;
}
function freshTariffs(){
  return `<section class="view fresh-tariffs">${freshTitle('Kanalga joylashtirish','listings','@ishdasiz uchun tarifni tanlang')}
    <div class="tabs"><button class="${state.kind==='vacancy'?'active':''}" data-tariff-kind="vacancy">Vakansiya</button><button class="${state.kind==='resume'?'active':''}" data-tariff-kind="resume">Rezyume</button></div>
    ${state.kind==='resume'?`<div class="fresh-first-free"><span>${icon('gift')}</span><div><b>Birinchi rezyume — bepul</b><p>Quyidagi tariflar keyingi joylashlar uchun.</p></div></div>`:''}
    <div class="plans">${plans.map((plan,index)=>`<button class="plan ${state.selectedPlan===index?'selected':''}" data-plan="${index}" aria-pressed="${state.selectedPlan===index}"><span class="plan-radio">${state.selectedPlan===index?icon('check'):''}</span><span class="plan-duration">${plan.days}<small>${plan.count} ta post · har kuni</small>${plan.pin?'<em>Zakrep sovg‘a</em>':''}</span><span class="plan-prices"><strong>${money(tariffPrice(plan))}</strong><small>so‘m</small></span></button>`).join('')}</div>
    <div class="fresh-site-note">${icon('check')}Saytga joylash doim bepul. Bu to‘lov — faqat kanal uchun.</div>
    <p class="subtext">1 hafta va 1 oyda birinchi post butun muddatga zakrep qilinadi.</p>
    <section class="broadcast-choice"><button class="toggle-row ${state.broadcast?'active':''}" data-broadcast-toggle role="switch" aria-checked="${state.broadcast}"><span class="toggle"></span><span class="toggle-copy">Botda tarqatma<small>Alohida xizmat, obuna bo‘lgan auditoriyaga</small></span></button>${state.broadcast?`<div class="broadcast-config"><label><input type="radio" name="audience" value="all" ${state.broadcastTarget==='all'?'checked':''}>Barcha obunachilar</label><label><input type="radio" name="audience" value="regions" ${state.broadcastTarget==='regions'?'checked':''}>Tanlangan hududlar</label><p class="subtext">Narx alohida kelishiladi.</p></div>`:''}</section></section>`;
}
function freshAuth(){
  return `<section class="view fresh-auth">${freshTitle('Profilga kirish','profile')}<div class="fresh-auth-intro"><span>${icon('phone')}</span><h2>Bitta raqam.<br>Barcha imkoniyatlar.</h2><p>Sayt va botdagi e’lonlaringiz bitta profilda.</p></div><div class="form-surface"><form id="phone-form"><label class="field"><span>Telefon raqamingiz</span><span class="auth-phone"><b>+998</b><input id="phone-value" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="90 123 45 67" maxlength="17" aria-label="Telefon raqami" required></span></label><p class="fresh-auth-hint">Raqamni SMS orqali tasdiqlaysiz.</p><button type="submit" class="primary full">Davom etish ${icon('right')}</button></form><button class="secondary full" data-telegram-contact>${icon('send')}Telegram raqamim bilan</button></div><p class="auth-sample">Maket: 90 123 45 67 — mavjud profil namunasi. Boshqa raqam uchun avval ro‘yxatdan o‘tish so‘raladi. SMS yuborilmaydi.</p></section>`;
}
function freshSettings(){
  return `<section class="view">${freshTitle('Sozlamalar','profile')}<div class="fresh-settings-card"><div class="fresh-setting-row"><span><b>Tungi rejim</b><small>Ko‘rinishni o‘zingizga moslang</small></span><button class="fresh-switch ${state.theme==='dark'?'on':''}" data-fresh-theme role="switch" aria-checked="${state.theme==='dark'}" aria-label="Tungi rejim"><i></i></button></div><div class="fresh-setting-row"><span><b>Animatsiyalar</b><small>Kasblar almashishi va harakatlar</small></span><button class="fresh-switch ${freshMotion?'on':''}" data-fresh-motion role="switch" aria-checked="${freshMotion}" aria-label="Animatsiyalar"><i></i></button></div><button class="fresh-language-row" data-fresh-language><span><b>Til</b><small>O‘zbekcha</small></span>${icon('right')}</button></div></section>`;
}
function freshPreview(){
  const isResume=state.kind==='resume',draft=state.form[state.kind],free=isResume&&!state.freeResumeUsed&&!state.orderPaid,eligible=free||state.orderPaid;
  const position=esc(draft.position||(isResume?'Rezyume':'Vakansiya'));
  const salary=esc(draft.salaryMin||'Kelishiladi')+(draft.salaryMax?' — '+esc(draft.salaryMax):'');
  return `<section class="view fresh-post-preview">${freshTitle('Kanal posti','listings')}<div class="fresh-site-note">${icon('check')}Saytda bepul. Kanal uchun joylashtirish alohida.</div>
    <article class="fresh-telegram-post"><header><span>${icon('send')}</span><div><strong>@ishdasiz</strong><small>${free?'Birinchi rezyume — bepul':isResume?'Rezyume namunasi':'Vakansiya namunasi'}</small></div></header>
    ${!isResume&&state.orderPaid?`<div class="media-cover"><img src="assets/profession-salesperson-v1.webp" alt="Kanal muqovasi namunasi"><span class="cover-type">${esc(draft.company||'Kompaniya')}</span><strong class="cover-title">${position}</strong><b class="cover-bottom">${salary} so‘m</b></div>`:''}
    <div class="fresh-post-copy"><h2>${position}</h2><p>${isResume?esc(draft.name||'Ism va familiya'):esc(draft.company||'Kompaniya')}</p><strong>${salary} so‘m</strong><p>${esc(draft.region||'Hudud')} · ${esc(draft.experience||'Tajriba')}</p><p>${esc(isResume?draft.skills||'Ko‘nikmalar':draft.description||'Ish haqida')}</p></div></article>
    ${!isResume?`<div class="fresh-media-note">${icon('image')}<span>${state.orderPaid?'Muqova — namuna. O‘z foto yoki videongizni ham tanlashingiz mumkin.':'AI muqova to‘lov tasdiqlangandan keyin tayyorlanadi.'}</span></div>${state.orderPaid?`<div class="media-actions"><button class="secondary" data-upload="media">${icon('image')}Foto / video</button><button class="secondary" data-upload="logo">${icon('plus')}Logo qo‘shish</button></div>`:''}`:''}
    <p class="subtext" style="margin:20px 0">${eligible?'Matn va kontaktlarni tekshiring. Tasdiqlashdan so‘ng kanalga yuborish bosqichi ochiladi.':'Kanalga chiqarish uchun avval tarif va vaqtni tanlang.'}</p>
    ${eligible?`<button class="primary full" data-publish-channel>Kanalga yuborish ${icon('send')}</button>`:`<button class="primary full" data-nav="plans">Tarifni tanlash ${icon('right')}</button>`}</section>`;
}

function freshMenu(){
  modal(`<div class="fresh-sheet-title"><h2>Menyu</h2><p>Bugun nimadan boshlaymiz?</p></div><div class="studio-menu-create"><button data-nav="vacancy">${icon('briefcase')}<span>Vakansiya joylash</span>${icon('plus')}</button><button data-nav="resume">${icon('file')}<span>Rezyume joylash</span>${icon('plus')}</button></div><div class="fresh-menu-list">${[['home','Asosiy sahifa','home'],['user','Shaxsiy kabinet','profile'],['file','Mening e’lonlarim','listings'],['wallet','Kanal tariflari','plans'],['filter','Sozlamalar','settings']].map(([ic,label,route])=>`<button data-nav="${route}">${icon(ic)}<span>${label}</span>${icon('right')}</button>`).join('')}</div>`);
  $('#modal-root .modal').setAttribute('aria-label','Menyu');
}

const freshBaseRender=render,freshBaseNavigate=navigate,freshBaseModal=modal,freshBaseClose=closeModal;
modal=function(html){modalTrigger=document.activeElement;freshBaseModal(html);app.classList.add('sheet-open');$('#content').inert=true;$('.app-header').inert=true;$('#action-bar').inert=true;scheduleFreshScene()};
closeModal=function(){freshBaseClose();app.classList.remove('sheet-open');$('#content').inert=false;$('.app-header').inert=false;$('#action-bar').inert=false;if(modalTrigger?.isConnected)modalTrigger.focus();modalTrigger=null;scheduleFreshScene()};
navigate=function(screen,options={}){freshBaseNavigate(screen,options);if(freshCampaignParams.length){const url=new URL(location.href);for(const [key,value]of freshCampaignParams)url.searchParams.set(key,value);history.replaceState(null,'',url)}};
render=function(){freshBaseRender();clearInterval(sceneTimer);$('#bottom-nav').replaceChildren();$('#bottom-nav').hidden=true;app.dataset.screen=state.screen;app.classList.toggle('motion-disabled',!freshMotion);$('#top-marquee').hidden=state.screen!=='home';app.classList.add('fresh-ready');scheduleFreshScene()};
function scheduleFreshScene(){clearTimeout(freshTimer);const paused=document.hidden||app.classList.contains('sheet-open')||app.classList.contains('focus-paused');app.classList.toggle('home-motion-paused',paused);if(state.screen!=='home'||!freshMotion||freshReduced.matches||paused)return;freshTimer=setTimeout(()=>{setFreshScene((state.scene+1)%freshScenes.length);scheduleFreshScene()},4800)}
function setFreshScene(index){state.scene=(index+freshScenes.length)%freshScenes.length;const stage=$('.fresh-stage');if(!stage)return;stage.dataset.scene=String(state.scene);stage.style.setProperty('--scene-color',freshScenes[state.scene].color);stage.querySelector('.fresh-word').innerHTML=letterWord(freshScenes[state.scene].name);stage.querySelectorAll('.fresh-portrait').forEach((el,i)=>el.classList.toggle('active',i===state.scene));stage.querySelector('.fresh-scene-count').innerHTML=String(state.scene+1).padStart(2,'0')+' <small>/ 08</small>'}

Object.assign(screenRender,{home:freshHome,search:freshSearch,vacancy:freshForm,resume:freshForm,profile:freshProfile,listings:freshListings,plans:freshTariffs,auth:freshAuth,settings:freshSettings,preview:freshPreview});
const tickerGroup='<span>Rezyume va vakansiyalar — saytda bepul</span><i></i><span>Ish va xodim topish oson</span><i></i>';
$('#top-marquee').innerHTML=`<div class="fresh-marquee-track" aria-hidden="true"><div>${tickerGroup}</div><div>${tickerGroup}</div></div>`;
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
document.addEventListener('focusin',event=>{if(event.target.closest('.studio-home')&&event.target.matches(':focus-visible')){app.classList.add('focus-paused');scheduleFreshScene()}});
document.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest('.studio-home')){app.classList.remove('focus-paused');scheduleFreshScene()}});
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
