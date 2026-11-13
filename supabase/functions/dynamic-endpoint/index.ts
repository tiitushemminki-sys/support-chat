import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_MODEL = "qwen/qwen3.8-27b";

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const out = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });

async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function token() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map(x => x.toString(16).padStart(2, "0")).join("");
}
async function admin(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return false;
  const jwt = h.slice(7);
  const c = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await c.auth.getUser(jwt);
  return !error && data.user?.app_metadata?.role === "admin";
}
async function owns(id: string, t: string) {
  const { data, error } = await db.from("conversations")
    .select("visitor_token_hash").eq("id", id).maybeSingle();
  return !error && !!data?.visitor_token_hash && data.visitor_token_hash === await hash(t);
}

/** Generate and save one automatic reply. AI failures never prevent the customer's message from being saved. */
async function createAiReply(conversationId: string) {
  if (!GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is missing; skipping automatic reply.");
    return;
  }

  const { data: conversation } = await db.from("conversations")
    .select("visitor_name, language, status").eq("id", conversationId).maybeSingle();
  // Once an admin replies, the conversation is handed over to a human.
  // Do not generate any more AI replies in human or closed conversations.
  if (!conversation || conversation.status === "closed" || conversation.status === "human") return;

  const { data: rows, error } = await db.from("messages")
    .select("sender, body").eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(12);
  if (error) throw error;

  const history = (rows || []).reverse().map(m => ({
    role: m.sender === "customer" ? "user" : "assistant",
    content: String(m.body).slice(0, 3000),
  }));

  const systemPrompt = `Olet TulosteKaupan ystävällinen asiakaspalvelija. Vastaa asiakkaalle aina samalla kielellä, jolla hän kirjoittaa. Tunnista asiakkaan käyttämä kieli automaattisesti ja vastaa sillä kielellä, vaikka se olisi mikä tahansa kieli. Tämä koskee myös harvinaisempia kieliä. Älä vaihda kieltä kesken keskustelun, ellei asiakas itse vaihda kieltä. Jos asiakas kirjoittaa suomeksi, vastaa suomeksi. Pidä vastaukset selkeinä, ystävällisinä ja melko lyhyinä.

TULOSTEKAUPAN TUOTTEET JA HINNAT:
- Puhelinteline, säädettävä kulma: 8 €.
- Kasviruukku, pieni ruukku vesikourulla: 12 €.
- Nimiavaimenperä, oma nimi tai teksti: 5 €.
- Kuulokekoukku, kiinnittyy pöydän reunaan: 9 €.
- Joulukoristeet, koristeita kuuseen ja ikkunaan: 3 € / kpl.
- Mausteen sirottimet: 6 € / kpl.
- Personoidut 3D-tilaukset asiakkaan idean mukaan: alkaen 15 €. Lopullinen hinta riippuu tuotteesta ja työstä, joten pyydä asiakkaalta kuvaus tai luonnos ja kerro, että ylläpito vahvistaa hinnan.
- Oman nimen tai tekstin lisääminen esineeseen: +2 €.
- Nouto sovitusta paikasta: 0 €.
- Postitus Postin pakettina koko Suomeen: alkaen 7 €.
- Ilmainen postitus, kun tilauksen arvo on vähintään 200 €.

MAKSAMINEN JA TILAAMINEN:
- Hyväksytyt maksutavat ovat MobilePay ja käteinen. Älä lupaa muita maksutapoja.
- Noutopaikka sovitaan asiakkaan kanssa erikseen.
- Toimitusaika sovitaan tilauskohtaisesti. Älä lupaa tiettyä toimituspäivää.
- Asiakas voi kysyä personoitua tuotetta ja ehdottaa lähes mitä tahansa 3D-tulostettavaksi sopivaa ideaa. Älä lupaa toteutusta ennen kuin ylläpito on tarkistanut idean ja hinnan.
- Yhteydenotto sähköpostitse: tiitus.hemminki@gmail.com.
- Jos tuote on viallinen, väärä tai asiakas haluaa tehdä palautuksen, pyydä ottamaan yhteyttä ja kerro, että tilanne selvitetään tapauskohtaisesti. Älä lupaa automaattisesti hyvitystä tai ilmaista korvaavaa tuotetta.

TOIMINTAOHJEET:
- Vastaa itsenäisesti tavallisiin kysymyksiin tuotteista, hinnoista, maksutavoista, postituksesta, noudosta ja personoinnista yllä olevien tietojen perusteella.
- Laske ostoskorin tuotteiden hinnat oikein, jos asiakas kertoo tuotteet ja määrät. Muista +2 € tekstilisä ja 200 € ilmaisen postituksen raja. Postituksen tarkka hinta alkaa 7 eurosta, joten älä väitä sen olevan aina täsmälleen 7 €.
- Älä keksi varastosaldoja, materiaalivaihtoehtoja, värejä, mittoja, tilauksen tilaa, tarkkaa toimitusaikaa tai muita tietoja, joita tässä tietopaketissa ei ole. Kerro ystävällisesti, että ylläpito varmistaa asian.
- Jos asiakas haluaa tilata, kerro miten hän voi ottaa yhteyttä tai käyttää verkkosivun tilaus-/yhteydenottolomaketta, jos se on käytettävissä. Älä väitä tilausta tehdyksi chatissa.
- Ohjaa vaikeat, epäselvät, reklamaatioihin liittyvät ja lopullista erikoistilaushintaa vaativat asiat ylläpidolle.
- Älä pyydä salasanoja, maksukorttitietoja tai muita arkaluonteisia tietoja.
- Älä väitä olevasi ihminen. Jos asiakas kysyy, kerro olevasi TulosteKaupan tekoälyavustaja.
- TÄRKEÄ IHMISASIAKASPALVELUUN OHJAAMINEN: Vastaa vain asioihin, joihin vastaus löytyy varmasti yllä olevista TulosteKaupan tiedoista tai jotka voidaan laskea niiden perusteella. Jos asiakas kysyy esimerkiksi tuotteen varastotilanteesta, tarkasta väristä/materiaalista/mitoista, tilauksen etenemisestä, toimituspäivästä, takuusta tai muusta tiedosta, jota tässä ei ole, älä arvaa äläkä kirjoita selitystä. Palauta täsmälleen ja ainoastaan [[HUMAN_HANDOFF]]. Sama koskee kaikkia epäselviä kysymyksiä. Älä koskaan vastaa "en tiedä", "voin selvittää" tai "kysy ylläpidolta" omin sanoin, vaan käytä aina merkintää [[HUMAN_HANDOFF]].
Asiakkaan nimi: ${String(conversation.visitor_name || "Asiakas").slice(0, 80)}.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...history],
      temperature: 0.4,
      max_tokens: 350,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Groq API error:", response.status, detail.slice(0, 1000));
    return;
  }

  const result = await response.json();
  const answer = String(result.choices?.[0]?.message?.content || "").trim();
  if (!answer) return;

  // Catch both the explicit handoff marker and common uncertainty responses.
  // This prevents the AI from leaving the customer without a human-support route
  // if the model ignores the marker instruction.
  const needsHuman =
    answer.includes("[[HUMAN_HANDOFF]]") ||
    /en (?:tiedä|pysty vahvistamaan|voi vahvistaa)|en ole varma|pitää (?:tarkistaa|varmistaa)|varmistan (?:asian|tämän)|kysy(?:ä)? ylläpidolta|ylläpito (?:voi|varmistaa|vahvistaa)|en löydä (?:tietoa|vastausta)/i.test(answer);

  let customerAnswer = answer;
  if (needsHuman) {
    const handoffFinnish = "Ihminen vastaa kysymykseesi mahdollisimman nopeasti. Voit myös soittaa numeroon 045 246 5522 tai odottaa, niin vastaamme chat-viestiisi.";
    // Translate the handoff notice into the language used in the customer's latest message.
    const latestCustomerMessage = [...history].reverse().find(m => m.role === "user")?.content || "";
    try {
      const translationResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a professional translator. Detect the language of the customer's message and translate the provided Finnish customer-service notice into that exact language. Preserve the phone number exactly. Output only the translated notice, with no explanation or quotation marks. If the message is too short to identify a language, use the conversation language if clear; otherwise use English.",
            },
            {
              role: "user",
              content: `Customer's message (detect language from this): ${latestCustomerMessage.slice(0, 1000)}\n\nTranslate this notice: ${handoffFinnish}`,
            },
          ],
          temperature: 0,
          max_tokens: 180,
        }),
      });
      if (translationResponse.ok) {
        const translationResult = await translationResponse.json();
        const translated = String(translationResult.choices?.[0]?.message?.content || "").trim();
        if (translated) customerAnswer = translated;
        else customerAnswer = handoffFinnish;
      } else {
        console.error("Handoff translation failed:", translationResponse.status);
        customerAnswer = handoffFinnish;
      }
    } catch (translationError) {
      console.error("Handoff translation error:", translationError);
      customerAnswer = handoffFinnish;
    }
  }

  const { error: insertError } = await db.from("messages").insert({
    conversation_id: conversationId,
    sender: "agent",
    body: customerAnswer.slice(0, 4000),
    language: String(conversation.language || "auto").slice(0, 12),
  });
  if (insertError) throw insertError;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Use POST" }, 405);

  try {
    const x = await req.json();
    const action = String(x.action || "");
    const isAdmin = await admin(req);

    if (action === "create_conversation") {
      const t = token();
      const { data, error } = await db.from("conversations").insert({
        visitor_name: String(x.name || "Asiakas").slice(0, 80),
        language: String(x.language || "fi").slice(0, 12),
        visitor_token_hash: await hash(t),
      }).select("id,created_at").single();
      if (error) throw error;
      return out({ success: true, conversation: data, visitor_token: t });
    }

    if (action === "send_message") {
      const id = String(x.conversation_id || "");
      const body = String(x.body || "").trim();
      const visitor = String(x.visitor_token || "");
      if (!id || !body || body.length > 4000)
        return out({ error: "Virheelliset viestitiedot" }, 400);
      if (!isAdmin && !(visitor && await owns(id, visitor)))
        return out({ error: "Ei käyttöoikeutta" }, 403);

      const sender = isAdmin && x.sender === "agent" ? "agent" : "customer";
      const { data, error } = await db.from("messages").insert({
        conversation_id: id,
        sender,
        body,
        language: String(x.language || "fi").slice(0, 12),
      }).select("id,conversation_id,sender,body,language,created_at").single();
      if (error) throw error;

      // An admin reply hands this conversation over to a human.
      // Future customer messages will no longer trigger AI replies.
      if (sender === "agent") {
        const { error: handoffError } = await db.from("conversations")
          .update({ status: "human" }).eq("id", id);
        if (handoffError) throw handoffError;
      }

      // AI replies only while the conversation is still in automatic support.
      if (sender === "customer") {
        try {
          await createAiReply(id);
        } catch (aiError) {
          console.error("Automatic AI reply failed:", aiError);
        }
      }
      return out({ success: true, message: data });
    }

    if (action === "list_conversations") {
      if (!isAdmin) return out({ error: "Ylläpitäjän kirjautuminen vaaditaan" }, 401);
      const { data, error } = await db.from("conversations")
        .select("id,visitor_name,language,status,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;

      // Include the newest message in each conversation so the admin inbox
      // can show previews and detect incoming customer replies.
      const ids = (data || []).map((c: any) => c.id);
      const latestByConversation = new Map<string, any>();
      if (ids.length) {
        const { data: recentMessages, error: messagesError } = await db.from("messages")
          .select("id,conversation_id,sender,body,created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false });
        if (messagesError) throw messagesError;
        for (const message of recentMessages || []) {
          if (!latestByConversation.has(message.conversation_id)) {
            latestByConversation.set(message.conversation_id, message);
          }
        }
      }
      const withLatest = (data || []).map((conversation: any) => ({
        ...conversation,
        latest_message: latestByConversation.get(conversation.id) || null,
      }));
      return out({ success: true, conversations: withLatest });
    }

    if (action === "list_messages") {
      const id = String(x.conversation_id || "");
      const visitor = String(x.visitor_token || "");
      if (!id || (!isAdmin && !(visitor && await owns(id, visitor))))
        return out({ error: "Ei käyttöoikeutta" }, 403);
      const { data, error } = await db.from("messages")
        .select("id,conversation_id,sender,body,language,created_at")
        .eq("conversation_id", id).order("created_at", { ascending: true }).limit(300);
      if (error) throw error;
      return out({ success: true, messages: data });
    }

    if (action === "delete_conversation") {
      if (!isAdmin) return out({ error: "Ylläpitäjän kirjautuminen vaaditaan" }, 401);
      const id = String(x.conversation_id || "");
      if (!id) return out({ error: "Keskustelun tunniste puuttuu" }, 400);
      // Delete messages first, then the conversation. Only admins can do this.
      const { error: messagesError } = await db.from("messages").delete().eq("conversation_id", id);
      if (messagesError) throw messagesError;
      const { error: conversationError } = await db.from("conversations").delete().eq("id", id);
      if (conversationError) throw conversationError;
      return out({ success: true });
    }

    if (action === "close_conversation") {
      if (!isAdmin) return out({ error: "Ylläpitäjän kirjautuminen vaaditaan" }, 401);
      const { error } = await db.from("conversations")
        .update({ status: "closed" }).eq("id", String(x.conversation_id || ""));
      if (error) throw error;
      return out({ success: true });
    }

    return out({ error: "Tuntematon toiminto" }, 400);
  } catch (e) {
    console.error(e);
    return out({ error: "Palvelinvirhe" }, 500);
  }
});
