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
