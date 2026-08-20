import { Webhook } from 'npm:standardwebhooks@1.0.0';
import {
  AuthEmailHookPayload,
  AuthTemplateKey,
  buildAuthEmailDeliveries,
} from '../_shared/authEmail.ts';
import { sendBrevoTemplate } from '../_shared/brevoClient.ts';
import { sendBrevoTransactional } from '../_shared/brevoTransactional.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '');
const ADMIN_URL = (Deno.env.get('ADMIN_URL') ?? '').replace(/\/+$/, '');
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? '';
const SEND_EMAIL_HOOK_SECRET = (
  Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''
).replace(/^v1,whsec_/, '');

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getTemplateIds(): Record<AuthTemplateKey, number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Deno.env.get('BREVO_TEMPLATE_IDS') ?? '');
  } catch {
    throw new Error('Invalid Brevo template configuration');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid Brevo template configuration');
  }

  const required: AuthTemplateKey[] = [
    'auth_confirmation',
    'auth_recovery',
    'auth_email_change',
    'auth_reauthentication',
  ];
  return Object.fromEntries(required.map((key) => {
    const id = Number((parsed as Record<string, unknown>)[key]);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Invalid Brevo template configuration');
    }
    return [key, id];
  })) as Record<AuthTemplateKey, number>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function fallbackEmailTitle(templateKey: AuthTemplateKey): string {
  if (templateKey === 'auth_recovery') return 'Redefina sua senha';
  if (templateKey === 'auth_confirmation') return 'Confirme seu cadastro';
  if (templateKey === 'auth_email_change') return 'Confirme seu novo e-mail';
  return 'Código de segurança';
}

function fallbackEmail(delivery: { templateKey: AuthTemplateKey; params: Record<string, string> }): { subject: string; html: string } {
  const name = escapeHtml(delivery.params.name || 'pessoa');
  const actionUrl = delivery.params.action_url;
  const code = escapeHtml(delivery.params.code || '');
  const content = delivery.templateKey === 'auth_recovery'
    ? 'Recebemos um pedido para redefinir sua senha.'
    : delivery.templateKey === 'auth_confirmation'
      ? 'Confirme seu e-mail para concluir seu cadastro.'
      : delivery.templateKey === 'auth_email_change'
        ? 'Confirme a alteração do seu endereço de e-mail.'
        : 'Use o código abaixo para confirmar esta ação.';
  const action = actionUrl
    ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Continuar com segurança</a>`
    : `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>`;
  return {
    subject: delivery.templateKey === 'auth_recovery' ? 'Redefina sua senha' : 'Confirmação de segurança',
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px"><img src="https://fazaih.lovable.app/logo.png" width="48" height="48" alt="FazAí"><h1 style="margin:20px 0 12px">${escapeHtml(fallbackEmailTitle(delivery.templateKey))}</h1><p>Olá, ${name}.</p><p>${content}</p><p>${action}</p><p>Se você não solicitou isso, ignore este e-mail.</p></td></tr><tr><td style="padding:18px 28px;color:#64748b;font-size:12px">FazAí — segurança da sua conta em primeiro lugar.</td></tr></table></td></tr></table></body></html>`,
  };
}async function stableIdempotencyKey(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  );
  return `auth-${Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (
    !SUPABASE_URL
    || !APP_URL
    || !BREVO_API_KEY
    || !BREVO_SENDER_EMAIL
    || !BREVO_SENDER_NAME
    || !SEND_EMAIL_HOOK_SECRET
  ) {
    console.error('Auth email hook is missing required configuration');
    return json({ error: 'Email service unavailable' }, 503);
  }

  const rawPayload = await req.text();
  let payload: AuthEmailHookPayload;
  try {
    payload = new Webhook(SEND_EMAIL_HOOK_SECRET).verify(
      rawPayload,
      Object.fromEntries(req.headers),
    ) as AuthEmailHookPayload;
  } catch {
    return json({ error: 'Invalid webhook signature' }, 401);
  }

  try {
    const allowedOrigins = [
      APP_URL,
      ADMIN_URL,
      ...(Deno.env.get('AUTH_EMAIL_ALLOWED_REDIRECT_ORIGINS') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ].filter(Boolean);
    const deliveries = buildAuthEmailDeliveries(payload, {
      supabaseUrl: SUPABASE_URL,
      appUrl: APP_URL,
      allowedRedirectOrigins: allowedOrigins,
    });

    try {
      const templateIds = getTemplateIds();
      await Promise.all(deliveries.map(async (delivery) => {
        await sendBrevoTemplate({
          apiKey: BREVO_API_KEY, senderEmail: BREVO_SENDER_EMAIL, senderName: BREVO_SENDER_NAME,
          to: delivery.to, templateId: templateIds[delivery.templateKey], params: delivery.params,
          idempotencyKey: await stableIdempotencyKey(delivery.idempotencySource), tags: ['fazai', 'auth', delivery.templateKey],
        });
      }));
    } catch (templateError) {
      console.warn('Auth email template failed; using Brevo transactional fallback', {
        reason: templateError instanceof Error ? templateError.message : 'unknown',
        action: payload.email_data.email_action_type,
      });
      await Promise.all(deliveries.map(async (delivery) => {
        const fallback = fallbackEmail(delivery);
        await sendBrevoTransactional({
          apiKey: BREVO_API_KEY, senderEmail: BREVO_SENDER_EMAIL, senderName: BREVO_SENDER_NAME,
          to: delivery.to, subject: fallback.subject, html: fallback.html,
        });
      }));
    }

    return json({});
  } catch (error) {
    console.error('Auth email hook delivery failed', {
      reason: error instanceof Error ? error.message : 'unknown',
      action: payload?.email_data?.email_action_type ?? 'unknown',
      userId: payload?.user?.id ?? 'unknown',
    });
    return json({ error: 'Email delivery failed' }, 502);
  }
});
