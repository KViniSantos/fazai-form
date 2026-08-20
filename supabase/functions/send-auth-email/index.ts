import { Webhook } from 'npm:standardwebhooks@1.0.0';
import {
  AuthEmailHookPayload,
  AuthTemplateKey,
  buildAuthEmailDeliveries,
  buildAuthEmailFallback,
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

async function stableIdempotencyKey(source: string): Promise<string> {
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
      if (payload.email_data.email_action_type === 'magiclink') {
        throw new Error('OTP uses branded transactional email');
      }
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
        const fallback = buildAuthEmailFallback(delivery);
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
