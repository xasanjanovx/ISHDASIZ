"""Responsive audit of every form stage; API responses are synthetic fixtures."""
import json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
TILE=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
with sync_playwright() as p:
 b=p.chromium.launch();errors=[];checks=0
 for width,height in [(320,568),(390,844),(768,1024),(1440,1000)]:
  c=b.new_context(viewport={'width':width,'height':height},reduced_motion='reduce');c.add_init_script("localStorage.setItem('ishdasiz-v13-welcome-guest','true')")
  def api(r):
   path=r.request.url
   if '/bootstrap' in path:r.fulfill(json={'regions':[],'districts':[],'categories':[],'stats':{'availableJobs':0,'byRegion':[]},'resumeCount':0,'storageReady':False})
   elif '/catalog' in path:r.fulfill(json={'data':[],'count':0})
   elif '/map/jobs' in path:r.fulfill(json={'jobs':[],'total':0})
   elif '/salary' in path:r.fulfill(json={'estimate':None})
   else:r.fulfill(status=401,json={'user':None,'error':'Kiring'})
  c.route('**/api/**',api);c.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(body=TILE,content_type='image/png'))
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8778/',wait_until='networkidle')
  for theme in ['light','dark']:
   page.evaluate('(theme)=>state.theme=theme',theme)
   for kind in ['vacancy','resume']:
    for step in range(7):
     page.evaluate('([kind,step])=>navigate(kind,{step})',[kind,step]);checks+=1
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme,kind,step,'page overflow')
     assert page.locator('#content').evaluate('el=>el.scrollWidth<=el.clientWidth'),(width,theme,kind,step,'content overflow')
     button=page.locator('#action-bar .primary').bounding_box();assert button and button['height']>=44 and button['y']+button['height']<=height+1,(width,theme,kind,step,'footer')
     assert page.locator('.polish-publication-note').count()==(1 if step==0 else 0)
     if step>0:assert page.locator('.journey-stage-art').count()==1
   for screen in ['home','search','profile','listings','applications','auth','settings','review','done','admin','broadcast']:
    page.evaluate('(screen)=>navigate(screen)',screen);checks+=1
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme,screen)
   page.evaluate("navigate('vacancy',{step:0})");page.locator('[data-field=position]').fill('sot');popup=page.locator('#flow-options');popup.wait_for();box=popup.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1
   page.locator('[data-field=position]').press('ArrowDown');assert page.locator('[data-field=position]').get_attribute('aria-activedescendant');page.keyboard.press('Escape');assert popup.count()==0
   if width==390:
    page.screenshot(path='tests/journey-first-'+theme+'.png')
    page.evaluate("navigate('vacancy',{step:4})");page.screenshot(path='tests/journey-description-'+theme+'.png')
  c.close()
 assert not errors,errors
 print(json.dumps({'checked_screens_and_stages':checks,'sizes':4,'themes':2,'errors':errors}));b.close()
