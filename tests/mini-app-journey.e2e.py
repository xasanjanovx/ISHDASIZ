"""Mobile connected journey. Every API, SMS, AI and publication is a local fixture."""
import json,sys,base64
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8778/'
TILE=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
USER={'id':'00000000-0000-4000-8000-000000000001','phone':'+998901111111'}
JOB='10000000-0000-4000-8000-000000000001'
CATEGORY='a0000010-0010-4000-8000-000000000010'
REGION={'id':1,'name_uz':'Toshkent shahri','name_ru':'Ташкент','slug':'toshkent-shahri'}
DISTRICTS=[{'id':10,'region_id':1,'name_uz':'Chilonzor tumani','name_ru':'Чиланзарский район'},{'id':11,'region_id':1,'name_uz':'Yunusobod tumani','name_ru':'Юнусабадский район'}]
FIXTURE_JOB={'id':JOB,'title_uz':'Sotuvchi','company_name':'QA company','region_id':1,'district_id':10,'regions':{'name_uz':'Toshkent shahri'},'districts':{'name_uz':'Chilonzor tumani'},'salary_min':4000000,'salary_max':6000000,'latitude':41.31,'longitude':69.25,'description_uz':'QA job','employment_type':'full_time','work_mode':'onsite','is_imported':False}
BOOT={'regions':[REGION],'districts':DISTRICTS,'categories':[{'id':CATEGORY,'name_uz':'Savdo'}],'stats':{'availableJobs':11868,'byRegion':[dict(REGION,count=7000)]},'resumeCount':126,'storageReady':True}
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');c.add_init_script("localStorage.setItem('ishdasiz-v13-welcome-guest','true');window.geoRequests=[];navigator.geolocation.getCurrentPosition=(yes,no)=>geoRequests.push({yes,no});")
 state={'user':None,'saved':[],'sms':0,'channel':0,'requests':[],'unlocked':False};errors=[]
 def api(route):
  req=route.request;path=urlparse(req.url).path;state['requests'].append((path,req.method));body=json.loads(req.post_data or '{}');status=200;data={}
  if path=='/api/mini-app/bootstrap':data=BOOT
  elif path=='/api/auth/session':data={'user':state['user']};status=200 if state['user'] else 401
  elif path=='/api/mini-app/catalog':data={'data':[FIXTURE_JOB],'count':1}
  elif path=='/api/jobs/'+JOB:data={'job':FIXTURE_JOB}
  elif path=='/api/map/jobs':data={'total':1} if parse_qs(urlparse(req.url).query).get('mode')==['count'] else {'jobs':[FIXTURE_JOB],'total':None,'hasMore':False}
  elif path=='/api/mini-app/records':
   if req.method=='GET':
    data={'jobs':[{**FIXTURE_JOB,'id':r['id']} for r in state['saved'] if r['kind']=='vacancy'],'resumes':[{'id':r['id'],'title':r['form']['position'],'full_name':r['form']['name'],'phone':r['form']['phone'],'views':7,'regions':{'name_uz':REGION['name_uz']}} for r in state['saved'] if r['kind']=='resume'],'entries':[{'id':r['id'],'metadata':r['form'],'kind':r['kind']} for r in state['saved']]}
   else:
    assert state['user'],'Publication before verified auth'
    if state.get('hold_save'):
     state['held_route']=route;state['held_body']=body;return
    state['saved'].append(body);data={'record':body,'saved':True};status=201
  elif path=='/api/auth/check-user':data={'exists':False}
  elif path=='/api/auth/send-otp':state['sms']+=1;data={'success':True}
  elif path=='/api/auth/verify-otp':
   if body.get('code')!='12345':status=400;data={'error':'Kod noto‘g‘ri'}
   else:state['user']=USER;data={'user':USER}
  elif path=='/api/mini-app/assistant':data={'result':{'description':'Xaridorlarga mahsulot tanlashda yordam bering.','duties':'Savdo zalini tartibli saqlang.','requirements':'Mijozlar bilan xushmuomala bo‘ling.'} if body['kind']=='vacancy' else {'about':'Savdo bo‘yicha ish izlayman.','skills':['Savdo','Excel']}}
  elif path=='/api/mini-app/salary':data={'estimate':{'median':5000000,'recommended':5500000,'count':8,'windowDays':90}}
  elif path=='/api/mini-app/channel':
   state['channel']+=1
   if state['channel']==1:data={'status':'queued'}
   else:status=402;data={'plans':[{'days':1,'price':59000},{'days':2,'price':89000}]}
  elif path=='/api/mini-app/candidates':
   query=parse_qs(urlparse(req.url).query)
   if query.get('action')==['view']:data={'resume':{'id':'20000000-0000-4000-8000-000000000001','title':'Sotuvchi','full_name':'QA candidate','about':'QA skills','skills':['Savdo']}}
   elif 'resume_id' in query:data={'contact':{'full_name':'QA candidate','phone':'+998902222222'}}
   elif state['unlocked']:data={'locked':False,'candidates':[{'id':'20000000-0000-4000-8000-000000000001','title':'Sotuvchi','full_name':'QA candidate','reasons':['Kasb mos'],'issues':['To‘lovni aniqlashtiring'],'exact':False}]}
   else:data={'locked':True,'total':126,'potential':12}
  elif path=='/api/mini-app/recommendations':data={'matches':[{'job':FIXTURE_JOB,'exact':False,'reasons':['Kasb mos','Ish shakli mos'],'issues':['To‘lovni aniqlashtiring'],'distanceKm':None}]}
  elif path=='/api/mini-app/applications':data={'applications':[]}
  else:raise AssertionError('Unexpected API '+path)
  route.fulfill(status=status,json=data)
 c.route('**/api/**',api);c.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(body=TILE,content_type='image/png'))
 c.route('https://photon.komoot.io/**',lambda r:r.fulfill(json={'features':[{'properties':{'state':'City of Tashkent','district':'Chilanzar district','city':'Tashkent','street':'QA street','housenumber':'12','countrycode':'UZ'},'geometry':{'type':'Point','coordinates':[69.25,41.31]}}]}))
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(URL+'?screen=vacancy',wait_until='networkidle')
 def fill(key,value):page.locator('[data-field='+key+']').fill(value)
 def next():page.locator('[data-step=next]').click()
 def stage(n):assert page.evaluate('state.step')==n,(n,page.evaluate('state.step'),page.locator('#toast').inner_text(),page.evaluate('journeyFirstError(state.step)'))
 def place():
  fill('place','Chil');page.get_by_role('option').filter(has_text='Chilonzor tumani').first.click();page.locator('[data-field=company]').click() if page.locator('[data-field=company]').count() else page.locator('[data-field=name]').click()
 assert not any(path in ['/api/map/jobs','/api/mini-app/catalog'] for path,method in state['requests']),'Hidden catalogs loaded while completing a form'
 assert page.locator('[data-field=category]').count()==0
 assert page.locator('.polish-publication-note').is_visible()
 position=page.locator('[data-field=position]');position.click();assert page.locator('#flow-options').count()==0
 fill('position','Sot');assert page.get_by_role('option').count()>0
 fill('position','Sotuvchi');page.keyboard.press('Escape');fill('company','QA company');place()
 assert page.evaluate('state.form.vacancy.regionId===1&&state.form.vacancy.districtId===10')
 page.reload(wait_until='networkidle');assert page.locator('[data-field=company]').input_value()=='QA company';next();stage(1)
 assert page.locator('.polish-publication-note').count()==0 and page.locator('.journey-stage-art').is_visible()
 fill('hours','09:00–18:00');next();stage(2)
 page.locator('[data-location-start]').click();page.evaluate('geoRequests.at(-1).yes({coords:{latitude:41.31,longitude:69.25,accuracy:18}})');page.locator('[data-discovery-save-point]').wait_for();assert page.evaluate('state.form.vacancy.coordinates===null');page.locator('[data-discovery-save-point]').click();assert page.evaluate('!!state.form.vacancy.locationConfirmedAt');next();stage(3);next();stage(4)
 page.locator('[data-mini-ai]').first.click();page.locator('[data-mini-apply-ai]').wait_for();assert page.locator('[data-field=description]').input_value()=='';page.locator('[data-mini-apply-ai]').click();assert 'Xaridorlarga' in page.locator('[data-field=description]').input_value()
 page.locator('[data-chip-value="Bepul tushlik"]').click();page.locator('[data-chip-value="Bonuslar"]').click();fill('benefitDetails','Har oy sotuv natijasiga qarab');page.screenshot(path='tests/journey-benefits.png');next();stage(5)
 page.locator('[data-mini-use-salary]').wait_for();assert '10%' in page.locator('#pay-guide-slot').inner_text();page.locator('[data-mini-use-salary]').click();assert page.evaluate('flowNumber(state.form.vacancy.salaryMin)===5500000');next();stage(6)
 fill('hr','QA manager');fill('phone','+998901111111');next();assert page.evaluate('state.screen')=='review';assert state['saved']==[];page.locator('[data-flow-publish]').click();assert page.evaluate('state.screen')=='auth',(page.evaluate('state.screen'),page.locator('#toast').inner_text(),page.evaluate('journeyFirstError()'),page.evaluate('state.form.vacancy'));assert state['sms']==0
 page.locator('#mini-phone').fill('+998901111111');page.locator('#mini-phone-form button').click();page.locator('[data-mini-register]').wait_for();assert state['sms']==0;page.locator('[data-mini-register]').click();page.locator('#mini-otp-code').fill('99999');page.locator('#mini-otp-form button').click();page.get_by_text('Kod noto‘g‘ri',exact=True).wait_for();assert not state['saved'];page.locator('#mini-otp-code').fill('12345');page.locator('#mini-otp-form button').click();page.locator('.flow-done').wait_for();assert len(state['saved'])==1 and state['channel']==0
 saved=state['saved'][0];assert saved['form']['regionId']==1 and saved['form']['districtId']==10 and saved['form']['benefitDetails']
 page.locator('[data-flow-candidates]').click();page.get_by_text('126',exact=True).wait_for();assert 'QA candidate' not in page.locator('#content').inner_text();page.locator('[data-mini-channel]').click();assert state['channel']==1
 state['unlocked']=True;page.locator('[data-flow-candidates]').click();page.locator('[data-discovery-match-tab=partial]').click();page.get_by_text('QA candidate',exact=True).wait_for();assert page.locator('a[href^="tel:"]').count()==0;page.locator('[data-mini-candidate-view]').click();page.locator('[data-mini-candidate-contact]').wait_for();page.locator('[data-mini-candidate-contact]').click();page.locator('a[href="tel:+998902222222"]').wait_for();page.locator('[data-close]').first.click()
 page.evaluate("navigate('home')");page.locator('[data-flow-start=resume]').first.click();fill('name','QA Candidate');fill('position','Sotuvchi');page.keyboard.press('Escape');place();next();stage(1);fill('birthdate','1999-01-01');page.locator('[data-chip-value=Erkak]').click();fill('about','Savdo bo‘yicha ish izlayman.');next();stage(2);fill('skills','Savdo, Excel');next();stage(3);page.locator('[data-chip-value="O‘zbek"]').click();next();stage(4);page.locator('[data-chip-value="Ish joyida"]').click();page.locator('[data-chip-value="5/2"]').click();next();stage(5)
 page.locator('#pay-negotiable').check();next();stage(6);fill('phone','+998902222222');next();assert page.locator('#flow-channel').count()==0;page.locator('[data-flow-publish]').click();page.locator('.flow-done').wait_for();assert len(state['saved'])==2 and state['channel']==1
 page.evaluate("navigate('listings')");assert page.get_by_text('7',exact=True).is_visible();page.evaluate("navigate('home')");assert page.locator('#discovery-job-count').inner_text()=='11 868';page.screenshot(path='tests/journey-home.png')
 page.evaluate("navigate('vacancy',{step:0})");fill('position','Buxgalter');fill('company','Saved draft');page.evaluate("navigate('home')");page.locator('[data-flow-start=vacancy]').first.click();page.locator('[data-mini-resume-draft]').wait_for();page.locator('[data-mini-resume-draft]').click();assert page.locator('[data-field=company]').input_value()=='Saved draft'
 for width in [320,390,430,768]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 state['hold_save']=True
 page.evaluate('(record)=>{state.kind="vacancy";state.form.vacancy=structuredClone(record.form);flow.activeId=flowId();flow.tx=flowId();flow.confirmedTx=null;flow.channel=false;navigate("review");}',saved)
 page.locator('[data-flow-publish]').click();page.wait_for_function('flow.confirming')
 page.evaluate("navigate('vacancy',{step:4})");fill('description','Updated while saving, keep this draft.')
 held=state['held_body'];state['saved'].append(held);state['held_route'].fulfill(status=201,json={'record':held,'saved':True});page.wait_for_function('!flow.confirming')
 assert page.evaluate('state.screen')=='vacancy' and page.locator('[data-field=description]').input_value()=='Updated while saving, keep this draft.'
 assert page.evaluate('flow.activeId')!=held['id']
 assert page.evaluate('miniDraftList().some(d=>d.id===flow.activeId&&d.form.description.includes("Updated while saving"))')
 assert not errors,errors
 print(json.dumps({'passed':'vacancy+resume/auth/AI/drafts/salary/map/candidate gate','publications':len(state['saved']),'sms_fixtures':state['sms'],'errors':errors},ensure_ascii=False));b.close()
