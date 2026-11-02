"""Atomic work-location confirmation. Provider/GPS fixtures never touch real users."""
import base64,sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8778/'
TILE=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
FEATURE={'features':[{'properties':{'state':'City of Tashkent','district':'Yunusabad district','city':'Tashkent','street':'QA street','housenumber':'12','countrycode':'UZ'},'geometry':{'type':'Point','coordinates':[69.2797,41.3111]}}]}
with sync_playwright() as p:
    browser=p.chromium.launch();errors=[];calls=[]
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    context.add_init_script("""localStorage.setItem('ishdasiz-v13-welcome-guest','true');window.geoRequests=[];navigator.geolocation.getCurrentPosition=(yes,no)=>geoRequests.push({yes,no});""")
    context.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(body=TILE,content_type='image/png'))
    context.route('https://photon.komoot.io/**',lambda r:(calls.append(r.request.url),r.fulfill(json=FEATURE)))
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL+'?screen=vacancy',wait_until='networkidle')
    assert page.evaluate('geoRequests.length')==0 and not calls
    assert page.locator('[data-field=region]').count()==0
    page.evaluate("Object.assign(state.form.vacancy,{position:'Sotuvchi',company:'QA org'})")
    original=page.evaluate('JSON.stringify(state.form.vacancy)')
    page.locator('[data-location-start]').click()
    assert page.evaluate('geoRequests.length')==1
    page.evaluate('geoRequests[0].yes({coords:{latitude:41.3111,longitude:69.2797,accuracy:18}})')
    page.locator('[data-discovery-save-point]').wait_for()
    assert page.evaluate('JSON.stringify(state.form.vacancy)')==original,'GPS committed before confirmation'
    assert 'Toshkent shahri' in page.locator('#work-location-details').inner_text()
    assert 'Yunusobod tumani' in page.locator('#work-location-details').inner_text()
    assert 'QA street, 12' in page.locator('#work-location-details').inner_text()
    page.locator('[data-location-edit]').click()
    page.locator('[data-location-field=address]').fill('QA corrected entrance')
    assert page.evaluate('JSON.stringify(state.form.vacancy)')==original,'Editing proposal mutated saved form'
    page.locator('[data-discovery-save-point]').click()
    assert page.evaluate("state.form.vacancy.address==='QA corrected entrance'&&state.form.vacancy.city==='Toshkent'&&state.form.vacancy.district==='Yunusobod tumani'&&state.form.vacancy.coordinateAccuracyM===18&&!!state.form.vacancy.locationConfirmedAt")
    assert page.evaluate('JSON.stringify(state.form.vacancy.coordinates)')=='[41.3111,69.2797]'
    assert page.locator('.work-location-saved').is_visible()
    page.reload(wait_until='networkidle')
    assert page.locator('.work-location-saved').is_visible(),'Confirmed address did not survive reload'
    saved=page.evaluate('JSON.stringify(state.form.vacancy)')
    # An identical explicit lookup uses only the memory cache in this page.
    page.evaluate("workLocationOpen('gps');geoRequests[0].yes({coords:{latitude:41.3111,longitude:69.2797,accuracy:18}})")
    page.locator('[data-discovery-save-point]').wait_for()
    count=len(calls);page.get_by_role('button',name='Bekor qilish',exact=True).click()
    assert page.evaluate('JSON.stringify(state.form.vacancy)')==saved
    page.evaluate("workLocationOpen('gps');geoRequests[1].yes({coords:{latitude:41.3111,longitude:69.2797,accuracy:18}})")
    page.locator('[data-discovery-save-point]').wait_for()
    assert len(calls)==count,'Repeated point was fetched instead of using cache'
    page.get_by_role('button',name='Bekor qilish',exact=True).click()
    # A late GPS response after cancellation must neither send coordinates nor save them.
    page.evaluate("workLocationOpen('gps')")
    page.get_by_role('button',name='Bekor qilish',exact=True).click()
    before=len(calls);page.evaluate('geoRequests[2].yes({coords:{latitude:41.32,longitude:69.29,accuracy:20}})')
    assert len(calls)==before and page.locator('[data-location-dialog]').count()==0
    assert page.evaluate('JSON.stringify(state.form.vacancy)')==saved
    # Permission denial has a real manual path and preserves the old location.
    page.evaluate("workLocationOpen('gps');geoRequests[3].no({code:1})")
    assert 'ruxsat berilmadi' in page.get_by_role('dialog').inner_text()
    page.locator('[data-location-manual]').click()
    assert page.locator('[data-field=region]').is_visible()
    assert page.evaluate('JSON.stringify(state.form.vacancy)')==saved
    # Moving a confirmed point clears the proposed address, not the existing saved one.
    page.evaluate("workLocationOpen('map');flow.pickerSelect([41.32,69.29])")
    assert page.evaluate("flow.workGeo.proposal.address===''&&flow.workGeo.proposal.region===''")
    assert page.evaluate('JSON.stringify(state.form.vacancy)')==saved
    page.locator('[data-discovery-save-point]').click()
    assert page.locator('[data-location-field=region]').get_attribute('aria-invalid')=='true'
    page.locator('[data-location-field=region]').fill('Toshkent shahri')
    page.locator('[data-location-field=address]').fill('QA next address')
    page.locator('[data-discovery-save-point]').click()
    assert page.evaluate("state.form.vacancy.address==='QA next address'&&state.form.vacancy.coordinates[0]===41.32")
    # Provider failure leaves empty proposal fields for explicit editing, no guesses.
    context.unroute('https://photon.komoot.io/**')
    context.route('https://photon.komoot.io/**',lambda r:r.fulfill(status=503,body='unavailable'))
    page.evaluate("workLocationOpen('gps');geoRequests[4].yes({coords:{latitude:41.33,longitude:69.30,accuracy:180}})")
    page.locator('[data-location-field=region]').wait_for()
    assert 'avtomatik topilmadi' in page.locator('#work-location-status').inner_text()
    assert page.locator('[data-location-field=region]').input_value()==''
    assert page.evaluate("state.form.vacancy.address==='QA next address'")
    page.get_by_role('button',name='Bekor qilish',exact=True).click()
    # Location on a CV is voluntary and never calls the workplace geocoder.
    page.evaluate("ISHDASIZFresh.navigate('resume',{step:2})")
    before=len(calls);page.locator('[data-discovery-locate=resume]').click()
    page.evaluate('geoRequests[5].yes({coords:{latitude:41.30,longitude:69.27,accuracy:25}})')
    assert len(calls)==before
    assert page.evaluate('state.form.resume.coordinates[0]===41.30')
    assert page.locator('[data-location-dialog]').count()==0
    # Both creation forms retain a compact, readable header and usable action bar.
    for width,height in [(320,568),(390,844),(768,1024),(844,390),(1440,1000)]:
        page.set_viewport_size({'width':width,'height':height})
        for theme in ['light','dark']:
            for kind,length in [('vacancy',7),('resume',5)]:
                for step in range(length):
                    page.evaluate('(x)=>{state.theme=x.theme;ISHDASIZFresh.navigate(x.kind,{step:x.step})}',{'theme':theme,'kind':kind,'step':step})
                    assert page.locator('#content').evaluate('el=>el.scrollWidth<=el.clientWidth'),(width,theme,kind,step)
                    header=page.locator('.flow-step-heading').bounding_box();note=page.locator('.polish-publication-note').bounding_box()
                    assert note['x']>header['x']+header['width']/2 and note['y']>=header['y']-1 and note['y']+note['height']<=header['y']+header['height']+1
                    assert page.locator('.polish-offer-seal>strong').inner_text()=='0 so‘m'
                    action=page.locator('#action-bar .primary').bounding_box();assert action['y']+action['height']<=height+1
            page.evaluate("ISHDASIZFresh.navigate('vacancy');workLocationOpen('map')")
            box=page.get_by_role('dialog').bounding_box();close=page.get_by_role('button',name='Yopish',exact=True).bounding_box()
            assert close['y']>=box['y'] and close['y']+close['height']<=box['y']+box['height']+1,'Close button outside dialog'
            assert page.get_by_role('dialog').evaluate('el=>el.scrollWidth<=el.clientWidth')
            page.get_by_role('button',name='Yopish',exact=True).click()
    page.evaluate("app.classList.add('telegram-native');app.style.setProperty('--mini-top','76px');app.style.setProperty('--mini-bottom','20px');ISHDASIZFresh.navigate('vacancy');workLocationOpen('map')")
    native=page.get_by_role('dialog').bounding_box()
    assert native['y']>=76,'Location dialog ignored native top safe area'
    page.get_by_role('button',name='Yopish',exact=True).click()
    assert not errors,errors
    browser.close()
print('PASS explicit GPS, address parsing, atomic confirmation/edit/cancel, cache, stale response isolation, permission/provider failures, changed-point address reset, reload, private CV coordinates, all creation steps in five viewports/both themes and compact 0-so‘m header')
