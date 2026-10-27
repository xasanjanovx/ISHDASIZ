/* Telegram host integration; has no authentication or payment side effects. */
(()=>{
  let initialized=false;
  const start=()=>{
    const tg=window.Telegram?.WebApp;if(!tg?.initData||initialized)return;initialized=true;
    const app=document.getElementById('app');app.classList.add('telegram-native');
    const safely=fn=>{try{fn()}catch{/* The app remains usable when a native method is unsupported. */}};
    const sync=()=>{
      for(const side of ['top','bottom','left','right']){
        const system=Math.max(0,Number(tg.safeAreaInset?.[side])||0);
        const content=Math.max(0,Number(tg.contentSafeAreaInset?.[side])||0);
        app.style.setProperty(`--mini-${side}`,`${system+content}px`);
      }
    };
    sync();safely(()=>tg.ready());safely(()=>tg.expand());
    for(const event of ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','viewportChanged'])safely(()=>tg.onEvent?.(event,sync));
    safely(()=>tg.onEvent?.('fullscreenFailed',()=>{safely(()=>tg.expand());sync()}));
    const supported=typeof tg.isVersionAtLeast==='function'?tg.isVersionAtLeast('8.0'):parseFloat(tg.version)>=8;
    if(supported&&!tg.isFullscreen)safely(()=>tg.requestFullscreen?.());
    safely(()=>tg.setHeaderColor('#eeede6'));safely(()=>tg.setBackgroundColor('#eeede6'));
  };
  document.querySelector('script[src="https://telegram.org/js/telegram-web-app.js"]')?.addEventListener('load',start);
  window.addEventListener('pageshow',start);start();
})();
