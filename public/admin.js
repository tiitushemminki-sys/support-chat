(()=> {
const $=id=>document.getElementById(id);
let jwt="",selected="",timer=null,activeTab="open",knownIds=new Set(),firstLoad=true,conversations=[],loading=false;
function notice(message,kind="info"){
 const n=$("notice");n.textContent=message;n.classList.remove("hidden","show","error-notice");if(kind==="error")n.classList.add("error-notice");void n.offsetWidth;n.classList.add("show");
}
function notifyNew(items){
 if(!items.length)return;
 const names=items.slice(0,3).map(c=>c.visitor_name||"Asiakas").join(", ");
 notice(items.length===1? `Uusi keskustelu avattu: ${names}`:`${items.length} uutta keskustelua avattu: ${names}`);
 if("vibrate" in navigator)navigator.vibrate([120,60,120]);
}
async function load(){
 if(loading||!jwt)return;
 loading=true;
 try{
  const d=await SupportChatAPI.call("list_conversations",{},jwt);
  conversations=d.conversations||[];
  const fresh=conversations.filter(c=>!knownIds.has(c.id)&&c.status!=="closed");
  if(firstLoad){conversations.forEach(c=>knownIds.add(c.id));firstLoad=false;}
  else if(fresh.length){conversations.forEach(c=>knownIds.add(c.id));notifyNew(fresh);}
  else conversations.forEach(c=>knownIds.add(c.id));
  renderList();
  if(selected){
   const current=conversations.find(c=>c.id===selected);
   if(!current||(current.status==="closed"&&activeTab==="open")||(current.status!=="closed"&&activeTab==="archive")){selected="";showEmpty();}
   else await messages();
  }
 }catch(e){
  console.error("Keskustelujen lataus epäonnistui:",e);
  notice("Yhteysvirhe: keskusteluja ei voitu päivittää. Tarkista internetyhteys ja kirjaudu tarvittaessa uudelleen.","error");
 }finally{loading=false;}
}
function renderList(){
 const root=$("conversations");root.innerHTML="";
 const visible=conversations.filter(c=>activeTab==="archive"?c.status==="closed":c.status!=="closed");
 if(!visible.length){const p=document.createElement("p");p.className="muted empty";p.textContent=activeTab==="archive"?"Arkisto on tyhjä.":"Ei avoimia keskusteluja.";root.append(p);}
 visible.forEach(c=>{
  const b=document.createElement("button");b.className="conversation"+(selected===c.id?" selected":"");b.type="button";
  const t=document.createElement("strong");t.textContent=c.visitor_name||"Asiakas";
  const s=document.createElement("small");s.textContent=`${c.language||"fi"} · ${c.status==="closed"?"Arkistoitu":"Avoin"}`;
  b.append(t,s);b.onclick=()=>select(c);root.append(b);
 });
}
function showEmpty(){$("threadTitle").textContent="Valitse keskustelu";$("messages").textContent="Valitse keskustelu.";$("replyText").disabled=true;$("sendReply").disabled=true;$("closeConversation").classList.add("hidden");}
async function select(c){selected=c.id;$("threadTitle").textContent=c.visitor_name||"Asiakas";const archived=c.status==="closed";$("replyText").disabled=archived;$("sendReply").disabled=archived;$("closeConversation").classList.toggle("hidden",archived);$("closeConversation").textContent="Siirrä arkistoon";renderList();try{await messages();}catch(e){notice("Viestien lataus epäonnistui: "+e.message,"error");}}
async function messages(){if(!selected)return;const d=await SupportChatAPI.call("list_messages",{conversation_id:selected},jwt);const root=$("messages");root.innerHTML="";(d.messages||[]).forEach(m=>{const box=document.createElement("div");box.className="message "+m.sender;const p=document.createElement("p");p.textContent=m.body;box.append(p);root.append(box)});root.scrollTop=root.scrollHeight;}
$("loginForm").onsubmit=async e=>{e.preventDefault();try{const d=await SupportChatAPI.login($("email").value,$("password").value);jwt=d.access_token;firstLoad=true;knownIds.clear();await load();$("login").classList.add("hidden");$("inbox").classList.remove("hidden");if(timer)clearInterval(timer);timer=setInterval(()=>load(),8000);}catch(e){$("loginError").textContent=e.message;}};
$("refresh").onclick=()=>load();
$("openTab").onclick=async()=>{activeTab="open";$("openTab").classList.add("active");$("archiveTab").classList.remove("active");if(selected&&conversations.find(c=>c.id===selected)?.status==="closed"){selected="";showEmpty();}await load();renderList();};
$("archiveTab").onclick=async()=>{activeTab="archive";$("archiveTab").classList.add("active");$("openTab").classList.remove("active");if(selected&&conversations.find(c=>c.id===selected)?.status!=="closed"){selected="";showEmpty();}await load();renderList();};
$("closeConversation").onclick=async()=>{if(!selected)return;try{await SupportChatAPI.call("close_conversation",{conversation_id:selected},jwt);const c=conversations.find(x=>x.id===selected);if(c)c.status="closed";selected="";showEmpty();renderList();notice("Keskustelu siirretty arkistoon.");}catch(e){notice("Arkistointi epäonnistui: "+e.message,"error");}};
$("replyForm").onsubmit=async e=>{e.preventDefault();const body=$("replyText").value.trim();if(!body||!selected)return;try{await SupportChatAPI.call("send_message",{conversation_id:selected,body,sender:"agent",language:"fi"},jwt);$("replyText").value="";await messages();}catch(e){notice("Viestin lähetys epäonnistui: "+e.message,"error");}};
$("logout").onclick=()=>{if(timer)clearInterval(timer);timer=null;jwt="";selected="";conversations=[];knownIds.clear();firstLoad=true;$("inbox").classList.add("hidden");$("login").classList.remove("hidden");$("notice").classList.add("hidden");};
})();