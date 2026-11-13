(()=> {
const c=window.SUPPORT_CHAT_CONFIG;
if(!c||!c.SUPABASE_URL||!c.SUPABASE_PUBLISHABLE_KEY)return;
const endpoint=`${c.SUPABASE_URL}/functions/v1/${c.FUNCTION_NAME}`;
const headers={"Content-Type":"application/json",apikey:c.SUPABASE_PUBLISHABLE_KEY};
async function call(action,payload={}){
 const response=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify({action,...payload})});
 const data=await response.json().catch(()=>({error:"Palvelin palautti virheellisen vastauksen"}));
 if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
 return data;
}
const css=document.createElement("style");
css.textContent=`#scb{position:fixed;right:20px;bottom:20px;z-index:99999;background:#1769d2;color:#fff;border:0;border-radius:24px;padding:14px 18px;font:600 15px system-ui;cursor:pointer}#scw{display:none;position:fixed;right:16px;bottom:75px;z-index:99999;background:#fff;color:#172b3f;border:1px solid #dce5ee;border-radius:14px;width:min(350px,calc(100vw - 32px));height:450px;padding:14px;box-shadow:0 8px 35px #0003;font:14px system-ui}#scw input{width:100%;padding:11px;margin:6px 0;border:1px solid #cbd7e2;border-radius:8px;box-sizing:border-box;font:inherit}#sclog{height:315px;overflow:auto;margin:10px 0}#scw button{background:#1769d2;color:white;border:0;padding:10px 13px;border-radius:8px;cursor:pointer}#scform{display:flex;gap:7px}#scform input{flex:1;min-width:0}#scerror{color:#b42318;min-height:18px;font-size:12px}`;
document.head.append(css);
const button=document.createElement("button");button.id="scb";button.type="button";button.textContent="Asiakaspalvelu";document.body.append(button);
const panel=document.createElement("section");panel.id="scw";
panel.innerHTML='<b>Asiakaspalvelu</b><div id="scerror" role="status"></div><div id="scstart"><input id="scname" maxlength="80" placeholder="Nimi (valinnainen)"><button id="scbegin" type="button">Aloita keskustelu</button></div><div id="sclog" style="display:none"></div><form id="scform" style="display:none"><input id="sctext" maxlength="4000" placeholder="Kirjoita viesti…" required><button id="scsend">Lähetä</button></form>';
document.body.append(panel);
const $=id=>panel.querySelector("#"+id);
let conversationId="",visitorToken="",poll=null,busy=false;
const storageKey="support_chat_session_v1";
function showError(message){$("scerror").textContent=message||"";}
function sessionPayload(){return {conversation_id:conversationId,visitor_token:visitorToken};}
function showChat(){ $("scstart").style.display="none";$("sclog").style.display="block";$("scform").style.display="flex"; }
async function refresh(){
 if(!conversationId||!visitorToken)return;
 const data=await call("list_messages",sessionPayload());
 const log=$("sclog"),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<50;
 log.replaceChildren();
 (data.messages||[]).forEach(message=>{
  const item=document.createElement("div");
  item.style.cssText="padding:9px 11px;margin:7px 0;border-radius:10px;background:"+(message.sender==="agent"?"#e2efff":"#f0f3f6")+";white-space:pre-wrap;overflow-wrap:anywhere";
  const who=document.createElement("b");who.textContent=message.sender==="agent"?"Asiakaspalvelu":"Sinä";
  const body=document.createElement("div");body.textContent=message.body;
  item.append(who,body);log.append(item);
 });
 if(nearBottom)log.scrollTop=log.scrollHeight;
}
function startPolling(){if(poll)clearInterval(poll);poll=setInterval(()=>refresh().catch(e=>showError(e.message)),5000);}
function restore(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(storageKey)||"null");
  if(saved&&saved.id&&saved.token){conversationId=saved.id;visitorToken=saved.token;showChat();refresh().then(startPolling).catch(()=>{sessionStorage.removeItem(storageKey);conversationId="";visitorToken="";$("scstart").style.display="block";$("sclog").style.display="none";$("scform").style.display="none";});}
 }catch{sessionStorage.removeItem(storageKey);}
}
button.onclick=()=>{panel.style.display=panel.style.display==="block"?"none":"block";};
$("scbegin").onclick=async()=>{
 if(busy)return;busy=true;$("scbegin").disabled=true;showError("");
 try{
  const result=await call("create_conversation",{name:$("scname").value.trim(),language:(navigator.language||"fi").slice(0,12)});
  conversationId=result.conversation.id;visitorToken=result.visitor_token;
  sessionStorage.setItem(storageKey,JSON.stringify({id:conversationId,token:visitorToken}));
  showChat();await refresh();startPolling();
 }catch(e){showError("Keskustelun aloitus epäonnistui: "+e.message);}
 finally{busy=false;$("scbegin").disabled=false;}
};
$("scform").onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 const input=$("sctext"),body=input.value.trim();if(!body)return;
 busy=true;$("scsend").disabled=true;showError("");
 try{
  await call("send_message",{...sessionPayload(),body,language:(navigator.language||"fi").slice(0,12)});
  input.value="";await refresh();
 }catch(e){showError("Viestin lähetys epäonnistui: "+e.message);}
 finally{busy=false;$("scsend").disabled=false;}
};
restore();
})();