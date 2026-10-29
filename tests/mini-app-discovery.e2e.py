from pathlib import Path
import base64,sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8778/'
TILE=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')

def new_page(browser,welcome=False,account=None):
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',geolocation={'latitude':41.3111,'longitude':69.2797},permissions=['geolocation'])
    context.route('https://tile.openstreetmap.org/**',lambda route:route.fulfill(body=TILE,content_type='image/png'))
    if not welcome:context.add_init_script("localStorage.setItem('ishdasiz-v13-welcome-guest','true')")
    if account:context.add_init_script(f"sessionStorage.setItem('ishdasiz-v12-account',JSON.stringify({{phone:'{account}'}}));localStorage.setItem('ishdasiz-v13-welcome-{account[1:]}','true')")
    context.add_init_script("window.locationCalls=0;const originalPosition=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=(...args)=>{window.locationCalls++;return originalPosition(...args)}")
    return context.new_page()

def next_step(page):page.locator('#action-bar [data-step="next"]').click()
def select(page,key,query,title):
    page.locator(f'[data-field="{key}"]').fill(query)
    page.get_by_role('option',name=title,exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch();errors=[];apis=[]
    page=new_page(browser,welcome=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='networkidle')
    assert page.locator('.flow-intent').count()==0
    assert page.locator('.flow-home .hiring strong').inner_text()=='Xodim\nizlash'
    assert page.locator('.flow-home .career strong').inner_text()=='Ish\ntopish'
    assert page.evaluate('window.locationCalls')==0
    assert page.evaluate('flow.discoveryMap.getZoom()')==12
    assert page.locator('#discovery-job-count').inner_text()=='2'
    assert page.locator('#discovery-resume-count').inner_text()=='1'
    assert page.locator('.discovery-welcome').count()==0
    page.locator('.discovery-welcome').wait_for(timeout=5000)
    page.locator('[data-discovery-welcome="resume"]').click()
    assert page.locator('#app').get_attribute('data-screen')=='resume'
    page.evaluate("ISHDASIZFresh.navigate('home')")
    page.wait_for_timeout(3200)
    assert page.locator('.discovery-welcome').count()==0,'Welcome repeated'
    boxes=[b.bounding_box() for b in page.locator('.discovery-account-row>button').all()]
    assert len(boxes)==3 and max(b['y'] for b in boxes)-min(b['y'] for b in boxes)<1
    page.get_by_role('button',name='Xaritadagi vakansiyalar',exact=True).click()
    assert page.locator('.fresh-result-card').count()==2
    page.evaluate("ISHDASIZFresh.navigate('home')")
    page.get_by_role('button',name='Xaritadagi rezyumelar',exact=True).click()
    assert page.locator('.discovery-gate').is_visible()
    assert 'Namuna nomzod' not in page.locator('#content').inner_html()
    page.close()
    page=new_page(browser,welcome=True,account='+998901234567')
    page.add_init_script("sessionStorage.setItem('ishdasiz-v12-records',JSON.stringify([{id:'existing',account:'998901234567',kind:'resume',name:'Existing'}]))")
    page.goto(URL,wait_until='networkidle');page.wait_for_timeout(3200)
    assert page.locator('.discovery-welcome').count()==0
    page.close()
    print('PASS intent cards, no duplicate small actions, three-account row, honest map counts, no automatic geolocation, first 3-second welcome/dismissal and existing-record suppression',flush=True)

    page=new_page(browser,account='+998909876543')
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='networkidle');page.locator('.flow-home .hiring').click()
    select(page,'position','sot','Sotuvchi');page.locator('[data-field="company"]').fill('Demo Local');next_step(page)
    page.locator('[data-field="salaryMax"]').fill('6000000');next_step(page)
    select(page,'region','toshkent shah','Toshkent shahri')
    page.locator('[data-field="address"]').fill('Demo ish joyi')
    next_step(page)
    assert page.locator('[data-map]').is_visible(),'On-site vacancy accepted no work point'
    page.locator('[data-map]').click();page.locator('#discovery-picker').click(position={'x':140,'y':120});page.locator('[data-discovery-save-point]').click()
    next_step(page);next_step(page)
    page.locator('[data-field="description"]').fill('Savdo zalida mijozlarga yordam berish.')
    next_step(page);next_step(page)
    assert not page.locator('#flow-channel').is_checked()
    page.locator('[data-flow-publish]').click()
    assert page.locator('.discovery-gate').is_visible()
    assert not page.evaluate('discoveryUnlocked(flowRecords()[0])')
    page.locator('[data-discovery-unlock]').click();page.locator('[data-flow-publish]').click()
    assert page.evaluate('discoveryUnlocked(flowRecords()[0])')
    assert page.locator('.flow-match-card').count()==1
    page.close()
    print('PASS actual six-step vacancy, required on-site work point, free website save remains gated, explicit first free channel confirmation unlocks that job',flush=True)

    page=new_page(browser,account='+998901234567')
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:apis.append(r.url) if '/api/' in r.url else None)
    page.goto(URL,wait_until='networkidle')
    page.locator('.flow-home .career').click()
    page.locator('[data-field="name"]').fill('Demo Nomzod')
    select(page,'position','sot','Sotuvchi');next_step(page)
    select(page,'skills','ex','Excel');next_step(page)
    select(page,'region','toshkent shah','Toshkent shahri')
    page.locator('[data-field="salaryMin"]').fill('4000000')
    page.locator('[data-chip-key="workMode"][data-chip-value="Ish joyida"]').click()
    assert page.evaluate('window.locationCalls')==0
    page.locator('[data-discovery-locate="resume"]').click()
    page.wait_for_function('Array.isArray(state.form.resume.coordinates)')
    assert page.evaluate('window.locationCalls')==1
    page.locator('[data-discovery-clear-location]').click()
    assert page.evaluate('state.form.resume.coordinates===null&&window.locationCalls===1')
    page.locator('[data-discovery-locate="resume"]').click()
    page.wait_for_function('Array.isArray(state.form.resume.coordinates)')
    next_step(page);next_step(page)
    assert page.locator('#flow-channel').count()==0
    page.locator('[data-flow-publish]').click()
    assert page.evaluate('flowRecords()[0].kind===\'resume\'&&flowRecords()[0].channel===false')
    assert page.evaluate("flowFree('resume')")
    assert page.locator('.flow-match-card').count()==1,'Expected matching sample Sotuvchi job'
    page.locator('.flow-match-card [data-flow-detail]').click()
    assert page.get_by_role('dialog').get_by_role('heading',name='Sotuvchi',exact=True).is_visible()
    assert 'Ish joyida' in page.get_by_role('dialog').inner_text()
    page.get_by_role('button',name='Yopish',exact=True).first.click()
    page.evaluate("ISHDASIZFresh.navigate('listings')")
    assert page.locator('[data-flow-repost]').count()==0
    page.evaluate("state.kind='resume';ISHDASIZFresh.navigate('plans')")
    assert page.locator('#app').get_attribute('data-screen')=='plans'
    assert page.evaluate("state.kind==='vacancy'")
    assert page.locator('[data-tariff-kind=resume],.flow-price-options,#flow-channel').count()==0
    assert '59 000' in page.locator('.plans').inner_text()
    page.evaluate("ISHDASIZFlow.begin('resume')")
    assert page.locator('.flow-price-options').count()==0
    assert page.locator('#app').get_attribute('data-screen')=='resume'
    page.close()
    print('PASS full resume form, explicit geolocation, database-only save, no CV channel/tariff/quota, matched jobs and detailed vacancy',flush=True)

    page=new_page(browser,account='+998919998877')
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:apis.append(r.url) if '/api/' in r.url else None)
    page.goto(URL,wait_until='networkidle')
    page.evaluate('''()=>{
      const base={kind:'resume',account:'998901111111',position:'Sotuvchi',name:'PRIVATE_CANDIDATE',phone:'+998901111111',workMode:'Ish joyida',region:'Toshkent shahri',district:'Chilonzor',salaryMin:'4000000',experience:'1–3 yil',coordinates:[41.315,69.285]};
      const own={id:'job-a',kind:'vacancy',account:'998919998877',position:'Sotuvchi',company:'Demo Market',description:'Savdo jarayonida yordam berish.',workMode:'Ish joyida',region:'Toshkent shahri',district:'Chilonzor',salaryMin:'4000000',salaryMax:'6000000',experience:'1 yil',coordinates:[41.3111,69.2797]};
      sessionStorage.setItem('ishdasiz-v12-records',JSON.stringify([
        own,{...own,id:'job-b',position:'Buxgalter'},
        {...base,id:'cv-a'},
        {...base,id:'cv-salary',name:'PRIVATE_PARTIAL',salaryMin:'8000000'},
        {...base,id:'cv-wrong',name:'PRIVATE_WRONG_ROLE',position:'Buxgalter'},
        {...base,id:'cv-remote',name:'PRIVATE_WRONG_MODE',workMode:'Masofaviy'},
        {...base,id:'cv-unknown',name:'PRIVATE_UNKNOWN_MODE',workMode:''},
        {...base,id:'cv-archived',name:'PRIVATE_ARCHIVED',archived:true}
      ]));
      discoverySetContext('job-a');state.searchType='resumes';ISHDASIZFresh.navigate('search');
    }''')
    assert page.locator('.discovery-gate').is_visible()
    assert 'PRIVATE_' not in page.locator('#content').inner_html()
    page.evaluate("flowDetails('cv-a')")
    assert 'PRIVATE_' not in page.get_by_role('dialog').inner_html()
    assert page.evaluate("flowViewStats({id:'cv-a'}).views") == 0
    page.get_by_role('button',name='Yopish',exact=True).first.click()
    page.locator('[data-discovery-unlock="job-a"]').click()
    assert page.locator('#flow-channel').is_checked()
    assert not page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-a'))")
    page.locator('[data-flow-publish]').click()
    assert page.locator('#app').get_attribute('data-screen')=='done'
    assert page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-a'))")
    assert not page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-b'))")
    assert 'PRIVATE_CANDIDATE' in page.locator('.flow-candidates').inner_text()
    assert 'PRIVATE_WRONG' not in page.locator('#content').inner_html()
    assert 'PRIVATE_UNKNOWN' not in page.locator('#content').inner_html()
    assert 'PRIVATE_ARCHIVED' not in page.locator('#content').inner_html()
    page.locator('[data-discovery-match-tab="partial"]').click()
    assert 'PRIVATE_PARTIAL' in page.locator('.flow-candidates').inner_text()
    assert 'Kutilgan maosh' in page.locator('.flow-candidates').inner_text()
    page.evaluate("flowDetails('cv-a')")
    assert 'km' in page.get_by_role('dialog').inner_text()
    assert 'openstreetmap.org/?mlat' not in page.get_by_role('dialog').inner_html(),'Private home point exposed'
    page.get_by_role('button',name='Yopish',exact=True).first.click()
    page.evaluate("flowDetails('cv-wrong')")
    assert 'PRIVATE_WRONG_ROLE' not in page.get_by_role('dialog').inner_html()
    page.get_by_role('button',name='Yopish',exact=True).first.click()
    page.reload(wait_until='networkidle')
    assert page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-a'))")
    page.evaluate("discoveryOpenCandidates('job-b')")
    assert page.locator('.discovery-gate').is_visible()
    assert 'PRIVATE_WRONG_ROLE' not in page.get_by_role('dialog').inner_html()
    page.get_by_role('button',name='Yopish',exact=True).first.click()
    page.evaluate("flowWrite('ishdasiz-v12-records',flowRecords().map(r=>r.id==='job-a'?{...r,position:'Buxgalter'}:r));ISHDASIZFresh.navigate('listings')")
    assert not page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-a'))"),'Edited criteria reused old publication grant'
    assert not page.evaluate("flowFree('vacancy')"),'Publication allowance reset'
    # A new channel confirmation for the changed vacancy must use the paid path.
    page.evaluate("discoverySetContext('job-a');discoveryOpenCandidates('job-a')")
    page.locator('[data-discovery-unlock="job-a"]').click()
    page.locator('[data-flow-buy]').click()
    page.locator('[data-flow-plan="0"]').click()
    assert page.locator('#app').get_attribute('data-screen')=='schedule'
    page.locator('[data-pay]').click();page.locator('[data-demo-paid]').click()
    assert not page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-a'))"),'Checkout alone granted candidate access'
    page.locator('[data-flow-publish]').click()
    assert page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-a'))")
    assert not page.evaluate("discoveryUnlocked(flowOwnRecords().find(r=>r.id==='job-b'))")
    assert 'PRIVATE_WRONG_ROLE' in page.locator('.flow-candidates').inner_text(),'Newly published role did not update matching'
    page.evaluate("discoverySetContext('job-a');flowDetails('cv-a')")
    assert 'PRIVATE_CANDIDATE' not in page.get_by_role('dialog').inner_html()
    page.get_by_role('button',name='Yopish',exact=True).first.click()
    page.evaluate("ISHDASIZFresh.navigate('vacancy',{step:2})")
    page.locator('[data-map]').click()
    page.locator('#discovery-picker').click(position={'x':100,'y':100})
    page.locator('[data-discovery-save-point]').click()
    assert page.evaluate('discoveryPoint(state.form.vacancy)!==null')
    assert page.evaluate('window.locationCalls')==0,'Map point picker requested private geolocation'
    assert page.evaluate("discoveryDistance({},{})===''&&Math.abs(discoveryKm([41,69],[41.01,69])-1.11195)<.001")
    assert not errors,errors
    assert not apis,apis
    page.close();browser.close()
print('PASS job-specific publication grant, no pre-post identity/contact leaks, exact role/mode, partial salary matches, private straight-line distance, reload, other-job isolation, criteria-change revocation, map picking and no fabricated distance; no APIs/SMS/payments/posts')
