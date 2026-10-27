/* Focused review of the home/search UX; all data remains local demonstration data. */
const previousSearchScreen=screenRender.search;
state.layout='focused';
state.region='Butun O‘zbekiston';

function focusedHero(){
  return `<div class="focus-hero"><h1>Sizga<br>mos ish.</h1><div class="focus-portrait" aria-hidden="true">${professions.map((p,i)=>`<div class="portrait-layer ${i===state.scene?'active':''}"><img src="assets/${p[1]}" alt=""></div>`).join('')}</div></div>`;
}

function focusedSearch(){
  return `<form id="home-search" class="focus-form">
    <label class="focus-query"><span>Qanday ish qidiryapsiz?</span><div>${icon('search')}<input name="query" aria-label="Kasb yoki kompaniya" placeholder="Masalan, sotuvchi" value="${esc(state.query)}" autocomplete="off"></div></label>
    <label class="focus-region">${icon('pin')}<select name="region" aria-label="Qayerda ishlamoqchisiz?"><option ${state.region==='Butun O‘zbekiston'?'selected':''}>Butun O‘zbekiston</option>${regions.map(r=>`<option ${state.region===r?'selected':''}>${esc(r)}</option>`).join('')}</select></label>
    <button class="focus-submit" type="submit">Ish qidirish ${icon('right')}</button>
  </form>`;
}

function focusedHome(){
  return `<section class="view focus-home"><div class="focus-search-panel">${focusedHero()}${focusedSearch()}</div>
    <div class="focus-actions" aria-label="Yangi e’lon yaratish">
      <button data-nav="resume" class="focus-action"><span class="focus-action-icon">${icon('file')}</span><strong>Rezyume yaratish</strong>${icon('right')}</button>
      <button data-nav="vacancy" class="focus-action"><span class="focus-action-icon hiring">${icon('briefcase')}</span><strong>Vakansiya joylash</strong>${icon('right')}</button>
    </div></section>`;
}

function normalizeRegion(value){return value.toLowerCase().replace(/shahri|viloyati/g,'').replace(/[‘’ʻʼ']/g,'').trim()}

function focusedResults(){
  if(state.searchType==='resumes')return previousSearchScreen();
  const query=state.query.toLowerCase().trim();
  const filtered=jobs.filter(j=>(j.title+' '+j.company).toLowerCase().includes(query)&&(state.region==='Butun O‘zbekiston'||normalizeRegion(state.region).includes(normalizeRegion(j.region))));
  return `<section class="view focus-results">${title('Ish va nomzodlar')}
    <div class="tabs"><button data-search-type="jobs" class="active">Vakansiyalar</button><button data-search-type="resumes">Rezyumelar</button></div>
    <form id="results-search"><label class="search-input">${icon('search')}<input name="query" value="${esc(state.query)}" aria-label="Qidiruv" placeholder="Kasb yoki kompaniya" autocomplete="off"><button type="submit" aria-label="Qidirish">${icon('right')}</button></label></form>
    <div class="filters"><button class="filter" data-filter="region">${icon('pin')}${esc(state.region)}</button><button class="filter" data-filter="salary">Maosh</button><button class="filter" data-filter="all">${icon('filter')}Filtrlar</button></div>
    ${filtered.length?filtered.map(j=>`<article class="job-row focus-job"><div class="job-top"><div><h2>${j.title}</h2><p class="company">${j.company}</p></div><button class="text-button" data-save aria-label="Vakansiyani saqlash">${icon('bookmark')}</button></div><p class="salary">${j.salary}</p><p class="job-meta">${icon('pin')}${j.region} · ${j.mode}</p><p class="job-meta">${icon('briefcase')}${j.experience}</p><button class="secondary full" data-job="${jobs.indexOf(j)}">Batafsil ${icon('right')}</button></article>`).join(''):`<div class="empty">Bu qidiruv bo‘yicha vakansiya topilmadi.<br>Boshqa kasb yoki hududni tanlang.</div><button class="secondary full" data-reset-search>Barcha ishlarni ko‘rish</button>`}
  </section>`;
}

// Capture the region before the shared search-submit handler navigates.
document.addEventListener('submit',event=>{
  if(event.target.id==='home-search')state.region=String(new FormData(event.target).get('region')||'Butun O‘zbekiston');
},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-reset-search]');
  if(button){state.query='';state.region='Butun O‘zbekiston';navigate('search')}
});
screenRender.home=focusedHome;
screenRender.search=focusedResults;
navigate(state.screen,{step:state.step});
