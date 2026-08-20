export type AuthEmailAction =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'reauthentication';

export type AuthTemplateKey =
  | 'auth_confirmation'
  | 'auth_recovery'
  | 'auth_email_change'
  | 'auth_reauthentication';

export interface AuthEmailHookPayload {
  user: {
    id: string;
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    email_action_type: string;
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
  };
}

export interface AuthEmailEnvironment {
  supabaseUrl: string;
  appUrl: string;
  allowedRedirectOrigins: string[];
}

export interface AuthEmailDelivery {
  to: string;
  templateKey: AuthTemplateKey;
  params: Record<string, string>;
  idempotencySource: string;
}

export function resolveAuthTemplateKey(action: string): AuthTemplateKey {
  switch (action) {
    case 'signup':
    case 'magiclink':
      return 'auth_confirmation';
    case 'recovery':
      return 'auth_recovery';
    case 'email_change':
      return 'auth_email_change';
    case 'reauthentication':
      return 'auth_reauthentication';
    default:
      throw new Error('Unsupported authentication email action');
  }
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function resolveRedirect(
  requestedRedirectTo: string | undefined,
  fallbackRedirectTo: string,
  allowedRedirectOrigins: string[],
): string {
  const allowedOrigins = new Set(
    allowedRedirectOrigins
      .map(normalizeOrigin)
      .filter((origin): origin is string => origin !== null),
  );
  const fallbackOrigin = normalizeOrigin(fallbackRedirectTo);
  if (fallbackOrigin) allowedOrigins.add(fallbackOrigin);

  if (requestedRedirectTo) {
    try {
      const requested = new URL(requestedRedirectTo);
      if (allowedOrigins.has(requested.origin)) return requested.toString();
    } catch {
      // The configured fallback below is the only safe alternative.
    }
  }
  return new URL(fallbackRedirectTo).toString();
}

export function buildAuthVerifyUrl(input: {
  supabaseUrl: string;
  tokenHash: string;
  actionType: string;
  requestedRedirectTo?: string;
  fallbackRedirectTo: string;
  allowedRedirectOrigins: string[];
}): string {
  if (!input.tokenHash) throw new Error('Missing authentication token hash');
  const url = new URL('/auth/v1/verify', input.supabaseUrl);
  url.searchParams.set('token', input.tokenHash);
  url.searchParams.set('type', input.actionType);
  url.searchParams.set(
    'redirect_to',
    resolveRedirect(
      input.requestedRedirectTo,
      input.fallbackRedirectTo,
      input.allowedRedirectOrigins,
    ),
  );
  return url.toString();
}

function requiredEmail(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Missing or invalid authentication email recipient');
  }
  return normalized;
}

function requiredToken(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function displayName(payload: AuthEmailHookPayload): string {
  const metadataName = payload.user.user_metadata?.nome
    ?? payload.user.user_metadata?.name
    ?? payload.user.user_metadata?.full_name;
  return typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim().slice(0, 120)
    : 'pessoa';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function verificationDelivery(
  payload: AuthEmailHookPayload,
  environment: AuthEmailEnvironment,
  input: {
    to: string;
    templateKey: AuthTemplateKey;
    token?: string;
    tokenHash?: string;
    extraParams?: Record<string, string>;
  },
): AuthEmailDelivery {
  const tokenHash = requiredToken(input.tokenHash, 'authentication token hash');
  return {
    to: requiredEmail(input.to),
    templateKey: input.templateKey,
    params: {
      name: displayName(payload),
      code: requiredToken(input.token, 'authentication token'),
      action_type: payload.email_data.email_action_type,
      action_url: buildAuthVerifyUrl({
        supabaseUrl: environment.supabaseUrl,
        tokenHash,
        actionType: payload.email_data.email_action_type,
        requestedRedirectTo: payload.email_data.redirect_to,
        fallbackRedirectTo: environment.appUrl,
        allowedRedirectOrigins: environment.allowedRedirectOrigins,
      }),
      ...input.extraParams,
    },
    idempotencySource: [
      payload.user.id,
      payload.email_data.email_action_type,
      requiredEmail(input.to),
      tokenHash,
    ].join(':'),
  };
}

export function buildAuthEmailDeliveries(
  payload: AuthEmailHookPayload,
  environment: AuthEmailEnvironment,
): AuthEmailDelivery[] {
  const action = payload.email_data.email_action_type;
  const templateKey = resolveAuthTemplateKey(action);

  if (action === 'reauthentication') {
    const to = requiredEmail(payload.user.email);
    return [{
      to,
      templateKey,
      params: {
        name: displayName(payload),
        code: requiredToken(payload.email_data.token, 'reauthentication code'),
      },
      idempotencySource: [
        payload.user.id,
        action,
        to,
        payload.email_data.token,
      ].join(':'),
    }];
  }

  if (action === 'email_change') {
    const oldEmail = requiredEmail(payload.user.email);
    const newEmail = requiredEmail(payload.user.new_email);
    const common = { old_email: oldEmail, new_email: newEmail };
    const deliveries: AuthEmailDelivery[] = [];

    if (payload.email_data.token_hash_new) {
      deliveries.push(verificationDelivery(payload, environment, {
        to: oldEmail,
        templateKey,
        token: payload.email_data.token,
        tokenHash: payload.email_data.token_hash_new,
        extraParams: common,
      }));
    }

    deliveries.push(verificationDelivery(payload, environment, {
      to: newEmail,
      templateKey,
      token: payload.email_data.token_new ?? payload.email_data.token,
      tokenHash: payload.email_data.token_hash,
      extraParams: common,
    }));
    return deliveries;
  }

  return [verificationDelivery(payload, environment, {
    to: requiredEmail(payload.user.email),
    templateKey,
    token: payload.email_data.token,
    tokenHash: payload.email_data.token_hash,
  })];
}

export function buildAuthEmailFallback(delivery: AuthEmailDelivery): { subject: string; html: string } {
  const code = escapeHtml(delivery.params.code || '');
  const isOtp = delivery.params.action_type === 'magiclink';
  const title = delivery.templateKey === 'auth_recovery'
    ? 'Redefina sua senha'
    : delivery.templateKey === 'auth_email_change'
      ? 'Confirme seu novo e-mail'
      : isOtp ? 'Seu código de confirmação' : 'Confirme seu cadastro';
  const content = delivery.templateKey === 'auth_recovery'
    ? 'Recebemos um pedido para redefinir sua senha.'
    : isOtp
      ? 'Use o código abaixo para confirmar seu e-mail e continuar o pré-cadastro.'
      : delivery.templateKey === 'auth_email_change'
        ? 'Confirme a alteração do seu endereço de e-mail.'
        : 'Confirme seu e-mail para concluir seu cadastro.';
  const action = isOtp
    ? `<div style="margin:24px 0;padding:18px 22px;border:1px solid #f3b6c1;border-radius:14px;background:#fff5f6;color:#a8223a;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center">${code}</div>`
    : delivery.params.action_url
      ? `<a href="${escapeHtml(delivery.params.action_url)}" style="display:inline-block;background:#d92f4b;color:#ffffff;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:700">Continuar com segurança</a>`
      : `<div style="font-size:28px;font-weight:700;letter-spacing:6px;color:#a8223a">${code}</div>`;

  return {
    subject: isOtp ? 'Seu código de confirmação do FazAí' : title,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f8fb;font-family:Arial,sans-serif;color:#252b38"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e8eaf0;border-radius:18px;overflow:hidden"><tr><td style="padding:22px 28px;background:#d92f4b;color:#ffffff;font-size:22px;font-weight:700">FazAí</td></tr><tr><td style="padding:30px 28px"><h1 style="margin:0 0 14px;color:#171b24;font-size:26px">${title}</h1><p style="margin:0 0 12px;font-size:16px;line-height:1.55">Bem-vindo ao FazAí!</p><p style="margin:0 0 20px;color:#5c6372;font-size:15px;line-height:1.6">${content}</p>${action}<p style="margin:20px 0 0;color:#7a8290;font-size:13px;line-height:1.5">Se você não solicitou isso, ignore este e-mail.</p></td></tr><tr><td style="padding:18px 28px;color:#7a8290;background:#fbfbfd;font-size:12px">FazAí — conectando pessoas a bons serviços.</td></tr></table></td></tr></table></body></html>`,
  };
}
