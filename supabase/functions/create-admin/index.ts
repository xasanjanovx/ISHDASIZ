// Retired with the server administration API. This function must not remain an
// alternate writer that bypasses current roles, disabled access or creation leases.
Deno.serve((request:Request)=>new Response(request.method==='OPTIONS'?null:JSON.stringify({error:'Создавайте администраторов через сайт / Administratorlarni sayt orqali yarating'}),{
 status:request.method==='OPTIONS'?204:410,
 headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://ishdasiz.uz','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey'},
}));
