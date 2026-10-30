"""Compensation behavior with explicit synthetic QA fixtures; no live salary claims."""
import base64,sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8778/'
TILE=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
with sync_playwright() as p:
    browser=p.chromium.launch();errors=[]
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    context.add_init_script("localStorage.setItem('ishdasiz-v13-welcome-guest','true')")
    context.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(body=TILE,content_type='image/png'))
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL+'?screen=vacancy',wait_until='networkidle')
    assert page.evaluate('formSteps.vacancy.length===7&&formSteps.resume.length===5')
    page.evaluate("ISHDASIZFresh.navigate('vacancy',{step:1})")
    assert page.locator('[data-field=salaryMin]').count()==0
    page.evaluate("ISHDASIZFresh.navigate('vacancy',{step:5})")
    assert page.locator('.pay-periods button').count()==4
    assert page.locator('.pay-guide-empty').is_visible()
    assert page.locator('[data-pay-use-range]').count()==0,'Invented a benchmark from demo jobs'
    page.locator('[data-field=salaryMin]').fill('4000000')
    assert page.locator('[data-field=salaryMin]').input_value()=='4 000 000'
    page.locator('[data-field=salaryMax]').fill('6000000')
    page.locator('[data-pay-period=hour]').click()
    assert page.locator('[data-field=salaryMin]').input_value()=='','Converted monthly pay silently'
    page.locator('[data-field=salaryMin]').fill('50000')
    assert 'so‘m / soat' in page.locator('.pay-entered').inner_text()
    page.locator('[data-pay-period=month]').click()
    assert page.locator('[data-field=salaryMin]').input_value()=='4 000 000'
    page.reload(wait_until='networkidle')
    page.locator('[data-pay-period=hour]').click()
    assert page.locator('[data-field=salaryMin]').input_value()=='50 000','Per-period draft lost'
    page.locator('[data-field=salaryMin]').fill('0')
    assert not page.evaluate('payValidate()')
    page.locator('#pay-negotiable').check()
    assert page.evaluate('payValidate()')
    assert page.locator('[data-field=salaryMin]').count()==0
    page.locator('[data-pay-period=shift]').click()
    assert not page.evaluate('payValidate()')
    page.locator('[data-field=shiftHours]').fill('25')
    assert not page.evaluate('payValidate()')
    page.locator('[data-field=shiftHours]').fill('8')
    assert page.evaluate('payValidate()')
    page.locator('[data-pay-period=service]').click()
    assert not page.evaluate('payValidate()')
    page.locator('[data-field=salaryScope]').fill('1 ta logotip')
    assert page.evaluate('payValidate()')
    # Deterministic independently identified employers, not real salary records.
    result=page.evaluate('''()=>{
      const subject={kind:'vacancy',position:'Sotuvchi',region:'Toshkent shahri',workMode:'Ish joyida',employment:'To‘liq kun',experience:'1–3 yil',salaryPeriod:'month',salaryCurrency:'UZS'},now=Date.now();
      const rows=[4,5,6,7,8,2000].map((n,i)=>({...subject,id:'qa-'+i,company:'QA employer '+i,account:'qa-employer-'+i,salaryMin:n*1000000,salaryMax:n*1000000,createdAt:new Date(now).toISOString()}));
      window.payQA={subject,rows};
      const excluded=[{sample:true},{archived:true},{salaryPeriod:'hour'},{salaryCurrency:'USD'},{workMode:'Masofaviy'},{region:'Samarqand viloyati'},{position:'Buxgalter'},{experience:'5+ yil'},{employment:'Yarim kun'},{salaryPeriod:undefined},{createdAt:new Date(now-91*86400000).toISOString()},{salaryMax:0},{salaryNegotiable:true}].map((patch,i)=>({...rows[0],id:'exclude-'+i,account:'excluded-'+i,...patch}));
      const estimate=payBenchmark(subject,[...rows,...excluded],now);
      return {estimate,few:payBenchmark(subject,rows.slice(0,4),now),duplicates:payBenchmark(subject,rows.map(r=>({...r,account:'one-employer'})),now),shift:paySameBasis({salaryPeriod:'shift',shiftHours:8},{salaryPeriod:'shift',shiftHours:12}),service:paySameBasis({salaryPeriod:'service',salaryScope:'1 ta logotip'},{salaryPeriod:'service',salaryScope:'1 ta sayt'})};
    }''')
    assert result['estimate']=={'median':6000000,'low':5000000,'high':7000000,'count':5,'period':'month'},result
    assert result['few'] is None and result['duplicates'] is None
    assert not result['shift'] and not result['service']
    for period in ['shift','hour','service']:
        assert page.evaluate('''period=>{const d={...payQA.subject,salaryPeriod:period,shiftHours:8,salaryScope:'1 ta logotip'};return payBenchmark(d,payQA.rows.map(r=>({...r,...d}))).count===5}''',period)
    page.evaluate("Object.assign(state.form.vacancy,payQA.subject,{salaryMin:'',salaryMax:'',salaryNegotiable:false});flowWrite('ishdasiz-v12-records',payQA.rows);ISHDASIZFresh.navigate('vacancy',{step:5})")
    assert '6 000 000' in page.locator('.pay-guide>strong').inner_text()
    page.locator('[data-pay-use-range]').click()
    assert page.locator('[data-field=salaryMin]').input_value()=='5 000 000'
    page.locator('[data-field=salaryMin]').fill('100')
    page.locator('[data-field=salaryMax]').fill('200')
    assert page.locator('.pay-warning').inner_text()
    assert page.evaluate('payValidate()'),'Market warning blocked an intentional offer'
    assert page.evaluate("discoveryMatch({...payQA.subject,salaryMin:1000000,salaryMax:2000000},{...payQA.subject,salaryPeriod:'hour',salaryMin:50000}).issues.includes('To‘lov davri yoki hajmi farq qiladi')")
    assert page.evaluate("discoveryFingerprint(payQA.subject)!==discoveryFingerprint({...payQA.subject,salaryPeriod:'hour'})")
    page.evaluate("flow.salaryFrom='1';flow.salaryFilterPeriod='month'")
    assert not page.evaluate("flowMatches({...payQA.subject,salaryPeriod:'hour',salaryMin:50000})")
    page.evaluate("flow.salaryFrom='';flow.salaryTo='';flow.salaryFilterPeriod='';state.searchType='jobs';state.query='';state.region='Butun O‘zbekiston';ISHDASIZFresh.navigate('search')")
    page.locator('[data-filter=all]').click()
    page.locator('#flow-salary-from').fill('1000')
    page.locator('[data-flow-apply-filters]').click()
    assert page.locator('#filter-pay-period').get_attribute('aria-invalid')=='true'
    page.locator('#filter-pay-period').select_option('hour')
    page.locator('[data-flow-apply-filters]').click()
    assert page.evaluate("flow.salaryFilterPeriod==='hour'")
    assert page.locator('.fresh-result-card').count()==0,'Monthly offers leaked into hourly numeric filter'
    # Resume a legacy contact step after the new payment step is inserted.
    page.evaluate("flow.salaryFilterPeriod='';flow.salaryFrom='';flowSaveDraft();let d=JSON.parse(sessionStorage.getItem('ishdasiz-v12-draft'));delete d.payLayout;d.kind='vacancy';d.step=5;sessionStorage.setItem('ishdasiz-v12-draft',JSON.stringify(d))")
    page.goto(URL+'?screen=vacancy',wait_until='networkidle')
    assert page.evaluate('state.step===6')
    assert page.locator('[data-field=phone]').count()==1
    for width,height in [(320,568),(390,844),(768,1024),(844,390),(1440,1000)]:
        page.set_viewport_size({'width':width,'height':height})
        for theme in ['light','dark']:
            page.evaluate('theme=>{state.theme=theme;ISHDASIZFresh.navigate("vacancy",{step:5})}',theme)
            assert page.locator('#content').evaluate('el=>el.scrollWidth<=el.clientWidth'),(width,theme)
            assert page.locator('.polish-publication-note button').count()==0
            note=page.locator('.polish-publication-note').bounding_box();fields=page.locator('.fields').bounding_box()
            assert abs(note['x']+note['width']-fields['x']-fields['width'])<2,(width,theme,'badge not right-aligned')
            for button in page.locator('.pay-periods button').all():
                box=button.bounding_box();assert box['height']>=44
    page.emulate_media(reduced_motion='no-preference')
    assert page.locator('.polish-offer-seal').evaluate('el=>getComputedStyle(el,"::before").animationName')=='polishSealShine'
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.polish-offer-seal').evaluate('el=>getComputedStyle(el,"::before").animationName')=='none'
    page.emulate_media(reduced_motion='no-preference');page.evaluate("app.classList.add('motion-disabled')")
    assert page.locator('.polish-offer-seal').evaluate('el=>getComputedStyle(el,"::before").animationName')=='none'
    assert not errors,errors
    browser.close()
print('PASS explicit pay units, late steps, scoped robust estimates/insufficient data, independent employers, outliers, amount drafts, formatting, warnings, matching/filtering, responsive animated seal and reduced motion')
