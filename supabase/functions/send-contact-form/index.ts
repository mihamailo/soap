import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");
const contactEmail = Deno.env.get("CONTACT_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactFormRequest {
  name: string;
  phone: string;
  product: string;
  message?: string;
  source?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanString(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function sendTelegramMessage(text: string): Promise<void> {
  if (!telegramBotToken || !telegramChatId) {
    console.log("Telegram credentials not configured, skipping Telegram notification");
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error:", error);
    throw new Error(`Telegram API error: ${error}`);
  }
}

async function sendEmail(data: ContactFormRequest): Promise<void> {
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured, skipping email notification");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Luxe Soap <onboarding@resend.dev>",
      to: [contactEmail],
      subject: `Новая заявка от ${data.name}`,
      html: `
        <h2>Новая заявка с сайта Luxe Soap</h2>
        <p><strong>Имя:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Телефон:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Интересует:</strong> ${escapeHtml(data.product)}</p>
        ${data.message ? `<p><strong>Комментарий:</strong> ${escapeHtml(data.message)}</p>` : ""}
        ${data.source ? `<p><strong>Страница:</strong> ${escapeHtml(data.source)}</p>` : ""}
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend API error:", error);
    throw new Error(`Resend API error: ${error}`);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const data: ContactFormRequest = {
      name: cleanString(payload.name, 80),
      phone: cleanString(payload.phone, 40),
      product: cleanString(payload.product, 120),
      message: cleanString(payload.message, 600),
      source: cleanString(payload.source, 200),
    };

    if (!data.name || !data.phone) {
      return new Response(JSON.stringify({ error: "Имя и телефон обязательны" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telegramMessage = `<b>Новая заявка с сайта Luxe Soap</b>

<b>Имя:</b> ${escapeHtml(data.name)}
<b>Телефон:</b> ${escapeHtml(data.phone)}
<b>Интересует:</b> ${escapeHtml(data.product)}
${data.message ? `\n<b>Комментарий:</b>\n${escapeHtml(data.message)}` : ""}
${data.source ? `\n<b>Страница:</b> ${escapeHtml(data.source)}` : ""}`;

    const results = await Promise.allSettled([
      sendTelegramMessage(telegramMessage),
      sendEmail(data),
    ]);

    results.forEach((result, index) => {
      const service = index === 0 ? "Telegram" : "Email";
      if (result.status === "rejected") {
        console.error(`${service} notification failed:`, result.reason);
      }
    });

    if (!results.some((result) => result.status === "fulfilled")) {
      throw new Error("All notification methods failed");
    }

    return new Response(JSON.stringify({ success: true, message: "Заявка отправлена" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-contact-form function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
