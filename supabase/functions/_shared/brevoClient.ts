export type BrevoParam = string | number | boolean | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PARAM_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_PARAMS = 50;
const MAX_STRING_LENGTH = 2_000;

export function sanitizeBrevoParams(
  input: Record<string, unknown>,
): Record<string, BrevoParam> {
  const entries = Object.entries(input);
  if (entries.length > MAX_PARAMS) {
    throw new Error('Too many Brevo template parameters');
  }

  return Object.fromEntries(entries.map(([key, value]) => {
    const validPrimitive = value === null
      || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))
      || (typeof value === 'string' && value.length <= MAX_STRING_LENGTH);
    if (!PARAM_KEY_RE.test(key) || !validPrimitive) {
      throw new Error('Invalid Brevo template parameter');
    }
    return [key, value as BrevoParam];
  }));
}

export async function sendBrevoTemplate(input: {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  to: string;
  templateId: number;
  params: Record<string, unknown>;
  idempotencyKey: string;
  tags?: string[];
  fetchImpl?: typeof fetch;
}): Promise<{ messageId: string }> {
  const email = input.to.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    throw new Error('Invalid Brevo recipient');
  }
  if (!Number.isInteger(input.templateId) || input.templateId <= 0) {
    throw new Error('Invalid Brevo template id');
  }
  if (!input.apiKey || !input.senderEmail || !input.senderName) {
    throw new Error('Missing Brevo configuration');
  }
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(input.idempotencyKey)) {
    throw new Error('Invalid Brevo idempotency key');
  }

  const response = await (input.fetchImpl ?? fetch)(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        'api-key': input.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      signal: AbortSignal.timeout(4_000),
      body: JSON.stringify({
        sender: {
          email: input.senderEmail,
          name: input.senderName,
        },
        to: [{ email }],
        templateId: input.templateId,
        params: sanitizeBrevoParams(input.params),
        ...(input.tags?.length
          ? { tags: input.tags.slice(0, 10).map((tag) => tag.slice(0, 64)) }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    console.error('Brevo transactional email rejected', {
      status: response.status,
      templateId: input.templateId,
    });
    throw new Error('Brevo email delivery failed');
  }

  const result = await response.json().catch(() => ({})) as { messageId?: unknown };
  return {
    messageId: typeof result.messageId === 'string' ? result.messageId : '',
  };
}
