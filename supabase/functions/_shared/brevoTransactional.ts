export async function sendBrevoTransactional(input: {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  to: string;
  subject: string;
  html: string;
}) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': input.apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(4_000),
    body: JSON.stringify({ sender: { email: input.senderEmail, name: input.senderName }, to: [{ email: input.to }], subject: input.subject, htmlContent: input.html, tags: ['fazai', 'support'] }),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Brevo support email delivery failed');
  }
}
