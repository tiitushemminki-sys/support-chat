import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const out = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers:cors});
async function hash(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function token(){return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function admin(req:Request){const h=req.headers.get("Authorization")||"";if(!h.startsWith("Bearer "))return false;const jwt=h.slice(7);const c=createClient(URL,ANON,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false}});const {data,error}=await c.auth.getUser(jwt);return !error && data.user?.app_metadata?.role==="admin";}
async function owns(id:string,t:string){const {data,error}=await db.from("conversations").select("visitor_token_hash").eq("id",id).maybeSingle();return !error && !!data?.visitor_token_hash && data.visitor_token_hash===await hash(t);}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return out({error:"Use POST"},405);
 try{
  const x=await req.json(), action=String(x.action||""), isAdmin=await admin(req);
  if(action==="create_conversation"){
   const t=token();const {data,error}=await db.from("conversations").insert({visitor_name:String(x.name||"Asiakas").slice(0,80),language:String(x.language||"fi").slice(0,12),visitor_token_hash:await hash(t)}).select("id,created_at").single();if(error)throw error;return out({success:true,conversation:data,visitor_token:t});
  }
  if(action==="send_message"){
   const id=String(x.conversation_id||""),body=String(x.body||"").trim(),visitor=String(x.visitor_token||"");if(!id||!body||body.length>4000)return out({error:"Virheelliset viestitiedot"},400);
   if(!isAdmin && !(visitor && await owns(id,visitor)))return out({error:"Ei käyttöoikeutta"},403);
   const sender=isAdmin && x.sender==="agent"?"agent":"customer";
   const {data,error}=await db.from("messages").insert({conversation_id:id,sender,body,language:String(x.language||"fi").slice(0,12)}).select("id,conversation_id,sender,body,language,created_at").single();if(error)throw error;return out({success:true,message:data});
  }
  if(action==="list_conversations"){
   if(!isAdmin)return out({error:"Ylläpitäjän kirjautuminen vaaditaan"},401);
   const {data,error}=await db.from("conversations").select("id,visitor_name,language,status,created_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;return out({success:true,conversations:data});
  }
  if(action==="list_messages"){
   const id=String(x.conversation_id||""),visitor=String(x.visitor_token||"");if(!id||(!isAdmin&&!(visitor&&await owns(id,visitor))))return out({error:"Ei käyttöoikeutta"},403);
   const {data,error}=await db.from("messages").select("id,conversation_id,sender,body,language,created_at").eq("conversation_id",id).order("created_at",{ascending:true}).limit(300);if(error)throw error;return out({success:true,messages:data});
  }
  if(action==="close_conversation"){
   if(!isAdmin)return out({error:"Ylläpitäjän kirjautuminen vaaditaan"},401);const {error}=await db.from("conversations").update({status:"closed"}).eq("id",String(x.conversation_id||""));if(error)throw error;return out({success:true});
  }
  return out({error:"Tuntematon toiminto"},400);
 }catch(e){console.error(e);return out({error:"Palvelinvirhe"},500);}
});
