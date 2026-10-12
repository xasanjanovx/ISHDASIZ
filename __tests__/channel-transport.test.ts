/** @jest-environment node */
import { sendChannelMessage, sendMessage, TelegramRequestError } from '@/lib/telegram/telegram-api';
const originalFetch=global.fetch;
const token='synthetic-channel-token';
beforeEach(()=>{process.env.TELEGRAM_BOT_TOKEN=token;delete process.env.TELEGRAM_DRY_RUN;global.fetch=jest.fn();});
afterEach(()=>{global.fetch=originalFetch;});
const reply=(status:number,body:any)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status});
test.each([
 ['network',()=>Promise.reject(new Error('https://api.telegram.org/bot'+token+'/sendMessage'))],
 ['server error',()=>Promise.resolve(reply(503,{ok:false,error_code:503,description:'Temporary error'}))],
 ['invalid JSON',()=>Promise.resolve(reply(200,'response interrupted'))],
 ['proxy rejection',()=>Promise.resolve(reply(502,{ok:false,error_code:400,description:"can't parse entities"}))],
 ['unproven rejection',()=>Promise.resolve(reply(400,'Gateway error'))],
])('channel %s failures are ambiguous and never automatically resend',async(_name,respond)=>{
 (global.fetch as jest.Mock).mockImplementation(respond);await expect(sendChannelMessage('@ishdasiz_andijon','<b>Public CV</b>')).rejects.toMatchObject({definitiveRejection:false});expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('an explicit rate-limit rejection remains distinguishable from a possibly accepted send',async()=>{
 (global.fetch as jest.Mock).mockResolvedValue(reply(429,{ok:false,error_code:429,description:'Too Many Requests',parameters:{retry_after:60}}));await expect(sendChannelMessage('@ishdasiz_andijon','Public CV')).rejects.toMatchObject({definitiveRejection:true});expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('an acknowledged send returns its external receipt in exactly one request',async()=>{
 (global.fetch as jest.Mock).mockResolvedValue(reply(200,{ok:true,result:{message_id:11}}));expect(await sendChannelMessage('@ishdasiz_andijon','<b>Public CV</b>')).toEqual({message_id:11});expect(global.fetch).toHaveBeenCalledTimes(1);expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({parse_mode:'HTML',disable_web_page_preview:true});
});
test('custom emoji fallback is permitted only after Telegram explicitly rejects the first payload',async()=>{
 (global.fetch as jest.Mock).mockResolvedValueOnce(reply(400,{ok:false,error_code:400,description:"Bad Request: can't parse entities"})).mockResolvedValueOnce(reply(200,{ok:true,result:{message_id:11}}));expect(await sendChannelMessage('@ishdasiz_andijon','<tg-emoji emoji-id="123">💼</tg-emoji> <b>CV</b>')).toEqual({message_id:11});expect(global.fetch).toHaveBeenCalledTimes(2);expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).text).toBe('💼 <b>CV</b>');
});
test('a lost response on the safe fallback becomes uncertain without a third request',async()=>{
 (global.fetch as jest.Mock).mockResolvedValueOnce(reply(400,{ok:false,error_code:400,description:'ENTITY_TEXT_INVALID'})).mockRejectedValueOnce(new Error(token));await expect(sendChannelMessage('@ishdasiz_andijon','<tg-emoji emoji-id="123">💼</tg-emoji>')).rejects.toMatchObject({definitiveRejection:false});expect(global.fetch).toHaveBeenCalledTimes(2);
});
test('transport errors never expose the bot token',async()=>{
 (global.fetch as jest.Mock).mockResolvedValue(reply(403,{ok:false,error_code:403,description:'Forbidden '+token}));try{await sendChannelMessage('@ishdasiz_andijon','CV');throw new Error('Expected rejection');}catch(error){expect(error).toBeInstanceOf(TelegramRequestError);expect((error as Error).message).not.toContain(token);}
});
test.each(['network','server'])('a reserved private notification never retries an ambiguous %s failure',async kind=>{
 if(kind==='network')(global.fetch as jest.Mock).mockRejectedValue(new Error('lost response'));
 else (global.fetch as jest.Mock).mockResolvedValue(reply(503,{ok:false,error_code:503}));
 await expect(sendMessage(103,'Public job',{singleAttempt:true,disablePremiumEmoji:true})).rejects.toMatchObject({definitiveRejection:false});expect(global.fetch).toHaveBeenCalledTimes(1);
});
