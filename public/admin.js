(()=> {
const $=id=>document.getElementById(id);
let jwt="",selected="",timer=null,activeTab="open",knownIds=new Set(),firstLoad=true,conversations=[];
function notifyNew(items){
 if(!items.length)return;
 const n=items.length;
 $("notice").textContent=n===1? `Uusi keskustelu avattu: ${items[0].visitor_name}`:`${n} uutta keskustelua avattu`;
 $("notice").classList.remove("hidden");
 $("notice").classList.add("show");
 if("vibrate" in navigator) navigator.vibrate([120,60,120]);
}
async function load(){
 const d=await SupportChatAPI.call("list_conversations",{},jwt);
 conversations=d.conversations||[];
 const fresh=conversations.filter(c=>!knownIds.has(c.id)&&c.status!=="closed");
 if(firstLoad){conversations.forEach(c=>knownIds.add(c.id));firstLoad=false;}
 else if(fresh.length){notifyNew(fresh);conversations.forEach(c=>knownIds.add(c.id));}
 else conversations.forEach(c=>knownIds.add(c.id));
 renderList();
 if(selected){const current=conversations.find(c=>c.id===selected);if(!current){selected="";showEmpty();}else if(current.status==="closed"&&activeTab==="open"){selected="";showEmpty();}else await messages();}
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
async function select(c){selected=c.id;$("threadTitle").textContent=c.visitor_name||"Asiakas";const archived=c.status==="closed";$("replyText").disabled=archived;$("sendReply").disabled=archived;$("closeConversation").classList.toggle("hidden",archived);$("closeConversation").textContent="Siirrä arkistoon";renderList();await messages();}
async function messages(){if(!selected)return;const d=await SupportChatAPI.call("list_messages",{conversation_id:selected},jwt);const root=$("messages");root.innerHTML="";(d.messages||[]).forEach(m=>{const box=document.createElement("div");box.className="message "+m.sender;const p=document.createElement("p");p.textContent=m.body;box.append(p);root.append(box)});root.scrollTop=root.scrollHeight;}
$("loginForm").onsubmit=async e=>{e.preventDefault();try{const d=await SupportChatAPI.login($("email").value,$("password").value);jwt=d.access_token;firstLoad=true;knownIds.clear();await load();$("login").classList.add("hidden");$("inbox").classList.remove("hidden");timer=setInterval(()=>load().catch(e=>console.error(e)),8000);}catch(e){$("loginError").textContent=e.message;}};
$("refresh").onclick=()=>load().catch(e=>alert(e.message));
$("openTab").onclick=()=>{activeTab="open";$("openTab").classList.add("active");$("archiveTab").classList.remove("active");if(selected&&conversations.find(c=>c.id===selected)?.status==="closed"){selected="";showEmpty();}renderList();};
$("archiveTab").onclick=()=>{activeTab="archive";$("archiveTab").classList.add("active");$("openTab").classList.remove("active");if(selected&&conversations.find(c=>c.id===selected)?.status!=="closed"){selected="";showEmpty();}renderList();};
$("closeConversation").onclick=async()=>{if(!selected)return;try{await SupportChatAPI.call("close_conversation",{conversation_id:selected},jwt);const c=conversations.find(x=>x.id===selected);if(c)c.status="closed";selected="";showEmpty();renderList();$("notice").textContent="Keskustelu siirretty arkistoon.";$("notice").classList.remove("hidden");}catch(e){alert(e.message);}};
$("replyForm").onsubmit=async e=>{e.preventDefault();const body=$("replyText").value.trim();if(!body||!selected)return;try{await SupportChatAPI.call("send_message",{conversation_id:selected,body,sender:"agent",language:"fi"},jwt);$("replyText").value="";await messages();}catch(e){alert(e.message);}};
$("logout").onclick=()=>{clearInterval(timer);jwt="";selected="";conversations=[];knownIds.clear();firstLoad=true;$("inbox").classList.add("hidden");$("login").classList.remove("hidden");$("notice").classList.add("hidden");};
})();