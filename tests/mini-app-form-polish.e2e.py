from pathlib import Path
import base64,sys
from playwright.sync_api import sync_playwright

URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8778/'
ROOT=Path(__file__).parent
TILE=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
with sync_playwright() as p:
    browser=p.chromium.launch();errors=[];apis=[]
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    context.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(body=TILE,content_type='image/png'))
    context.add_init_script("localStorage.setItem('ishdasiz-v13-welcome-guest','true')")
    page=context.new_page();page.on('pageerror',lambda e:(errors.append(getattr(e,'stack',str(e))),print(getattr(e,'stack',str(e)),flush=True)))
    page.on('request',lambda r:apis.append(r.url) if '/api/' in r.url else None)
    page.goto(URL+'?screen=vacancy',wait_until='networkidle')
    assert page.locator('[data-field=category],select').count()==0
    assert 'Faoliyat sohasi' not in page.locator('#content').inner_text()
    assert page.get_by_text('Kompaniya yoki tashkilot nomi *',exact=True).is_visible()
    assert page.locator('[data-field=region]').is_visible()
    assert page.locator('.polish-form-credit').count()==0
    assert ' '.join(page.locator('.polish-publication-note').inner_text().split()).casefold()=='sayt va kanalda bepul joylang'
    assert page.locator('.polish-publication-note button').count()==0
    page.evaluate('document.fonts.ready')
    assert 'Inter Variable' in page.locator('body').evaluate('el=>getComputedStyle(el).fontFamily')
    assert page.evaluate("document.fonts.check('500 16px \"Inter Variable\"')")
    assert 'Birinchi vakansiya' not in page.locator('#content').inner_text()
    assert page.locator('.flow-step-heading>i').count()==0
    field=page.locator('[data-field=position]')
    for text,number in [('Sotuvchi',10),('Buxgalter',6),('Frontend dasturchi',1),('QA engineer',1),('Shifokor',5),('Haydovchi',9),('Quruvchi',7),('Ingliz tili o‘qituvchisi',4),('продавец',10)]:
        field.fill(text)
        category=page.evaluate('state.form.vacancy.categoryId')
        assert category==f'a{number:07}-{number:04}-4000-8000-{number:012}',(text,category)
    field.fill('Yangi noma’lum kasb')
    assert page.evaluate("state.form.vacancy.categoryId===null&&state.form.vacancy.sectorSource==='unclassified'")
    assert page.locator('[data-field=category]').count()==0
    field.fill('Buxgalter');page.locator('[data-field=company]').fill('Demo tashkilot')
    page.reload(wait_until='networkidle')
    assert page.evaluate("state.form.vacancy.categoryId==='a0000006-0006-4000-8000-000000000006'")
    assert page.locator('[data-field=company]').input_value()=='Demo tashkilot'
    page.evaluate("ISHDASIZFresh.navigate('vacancy',{step:3})")
    choice=page.locator('[data-flow-select=education]')
    choice.focus();choice.press('ArrowDown')
    assert page.locator('#flow-options').is_visible()
    choice.press('Enter')
    assert page.evaluate("state.form.vacancy.education==='O‘rta'")
    choice.click();page.get_by_role('option',name='Oliy',exact=True).click()
    assert page.evaluate("state.form.vacancy.education==='Oliy'")
    assert page.locator('[data-flow-select=education]').get_attribute('aria-expanded')=='false'
    choice.click();choice.press('Escape');assert page.locator('#flow-options').count()==0
    page.evaluate("ISHDASIZFresh.navigate('vacancy',{step:0})")
    hint=page.locator('[data-field=position]').get_attribute('aria-describedby')
    page.locator('[data-field=position]').fill('Sotuvchi')
    assert page.locator('[data-field=position]').get_attribute('aria-describedby')==hint
    page.evaluate("ISHDASIZFresh.navigate('vacancy',{step:2})")
    assert page.locator('[data-field=region]').count()==0,'Region question repeated'
    page.locator('[data-polish-edit-region]').click()
    assert page.locator('[data-field=region]').evaluate('el=>document.activeElement===el')
    page.evaluate("ISHDASIZFresh.navigate('home')")
    assert 'demo' not in page.locator('.discovery-map-card').inner_text().lower()
    assert 'namuna' not in page.locator('.discovery-map-card').inner_text().lower()
    assert 'OpenStreetMap' in page.locator('.discovery-map-card').inner_text(),'Attribution removed'
    print('PASS hidden sector/reference and modern-role inference, unknown fallback, draft reload, company/location labels, custom select pointer/keyboard/Escape, contextual hint ARIA and map copy',flush=True)
    for width,height in [(320,568),(390,844),(768,1024),(844,390),(1440,1000)]:
        page.set_viewport_size({'width':width,'height':height})
        for theme in ['light','dark']:
            page.evaluate('theme=>{state.theme=theme;ISHDASIZFresh.navigate("vacancy",{step:3})}',theme)
            page.locator('[data-flow-select=education]').click()
            box=page.locator('#flow-options').bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width+1,(width,'popup width')
            assert box['y']>=0 and box['y']+box['height']<=height+1,(width,'popup height')
            page.locator('[data-flow-select=education]').press('Escape')
            assert page.locator('#content').evaluate('el=>el.scrollWidth<=el.clientWidth'),(width,theme)
            page.evaluate("ISHDASIZFresh.navigate('home');localStorage.removeItem(discoveryWelcomeKey());state.form.vacancy.position='';state.form.vacancy.company='';state.form.resume.name='';state.form.resume.position='';discoveryPlanWelcome()")
            page.locator('.discovery-welcome').wait_for(timeout=5000)
            modal=page.locator('.discovery-welcome').bounding_box()
            assert abs(modal['x']+modal['width']/2-width/2)<2,(width,theme,'horizontal centering')
            assert abs(modal['y']+modal['height']/2-height/2)<2,(width,theme,'vertical centering')
            if width==390 and theme=='light':
                page.evaluate("app.classList.add('telegram-native');app.style.setProperty('--mini-top','76px');app.style.setProperty('--mini-bottom','20px')")
                safe=page.locator('.discovery-welcome').bounding_box()
                assert safe['y']>=76 and safe['y']+safe['height']<=height-20
                page.evaluate("app.classList.remove('telegram-native');app.style.removeProperty('--mini-top');app.style.removeProperty('--mini-bottom')")
            page.get_by_role('button',name='Keyinroq',exact=True).click()
    assert not errors,errors
    assert not apis,apis
    browser.close()
print('PASS centered animated welcome and polished dropdown in five viewports/both themes; no APIs, AI calls or production writes')
