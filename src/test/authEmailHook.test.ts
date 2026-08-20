import { describe, expect, it } from 'vitest';
import { buildAuthEmailDeliveries, buildAuthEmailFallback, resolveAuthTemplateKey } from '../../supabase/functions/_shared/authEmail';

describe('pre-registration Auth email hook', () => {
  it('routes passwordless magiclink OTP through the existing confirmation template', () => {
    expect(resolveAuthTemplateKey('magiclink')).toBe('auth_confirmation');

    const [delivery] = buildAuthEmailDeliveries({
      user: { id: 'user-1', email: 'prestador@example.com', user_metadata: {} },
      email_data: {
        email_action_type: 'magiclink',
        token: '123456',
        token_hash: 'otp-token-hash',
        redirect_to: 'https://fazaih.lovable.app',
      },
    }, {
      supabaseUrl: 'https://project.supabase.co',
      appUrl: 'https://fazaih.lovable.app',
      allowedRedirectOrigins: ['https://fazaih.lovable.app'],
    });

    expect(delivery).toMatchObject({
      to: 'prestador@example.com',
      templateKey: 'auth_confirmation',
      params: { code: '123456' },
    });
    expect(new URL(delivery.params.action_url).searchParams.get('type')).toBe('magiclink');
  });

  it('renders a branded code email without a user name or application redirect', () => {
    const [delivery] = buildAuthEmailDeliveries({
      user: { id: 'user-1', email: 'prestador@example.com', user_metadata: { nome: 'Pessoa Teste' } },
      email_data: {
        email_action_type: 'magiclink',
        token: '123456',
        token_hash: 'otp-token-hash',
      },
    }, {
      supabaseUrl: 'https://project.supabase.co',
      appUrl: 'https://fazaih.lovable.app',
      allowedRedirectOrigins: [],
    });

    const fallback = buildAuthEmailFallback(delivery);

    expect(fallback.html).toContain('Bem-vindo ao FazAí!');
    expect(fallback.html).toContain('123456');
    expect(fallback.html).not.toContain('Pessoa Teste');
    expect(fallback.html).not.toContain('Olá, pessoa');
    expect(fallback.html).not.toContain('Continuar com segurança');
    expect(fallback.html).not.toContain('fazaih.lovable.app');
    expect(fallback.html).toContain('#d92f4b');
  });
});
