import { useEffect, useState } from 'react';
import { OTP_CODE_LENGTH } from '@/domain/constants';

interface OtpStepProps {
  initialEmail?: string;
  onRequestCode: (email: string) => boolean | void | Promise<boolean | void>;
  onVerifyCode: (token: string) => void | Promise<void>;
  cooldownSeconds?: number;
  isLoading?: boolean;
}

export default function OtpStep({ initialEmail = '', onRequestCode, onVerifyCode, cooldownSeconds = 30, isLoading = false }: OtpStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || cooldown > 0) return;
    const requested = await onRequestCode(normalizedEmail);
    if (requested === false) return;
    setSent(true);
    setCooldown(cooldownSeconds);
  };

  const verifyCode = async () => {
    if (code.length !== OTP_CODE_LENGTH) return;
    await onVerifyCode(code);
  };

  return (
    <section className="form-card" aria-labelledby="otp-title">
      <div className="section-heading"><p className="eyebrow">Confirmação segura</p><h2 id="otp-title">Confirme seu e-mail</h2><p>Enviaremos um código de oito dígitos. Não usamos nem enviamos senhas neste pré-cadastro.</p></div>
      <div className="form-field"><label htmlFor="otp-email">E-mail</label><input id="otp-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></div>
      <button type="button" className="secondary-button" onClick={() => { void requestCode(); }} disabled={!email.trim() || cooldown > 0 || isLoading}>{sent ? 'Reenviar código' : 'Enviar código'}</button>
      {sent ? <>
        <div className="form-field otp-code-field"><label htmlFor="otp-code">Código de {OTP_CODE_LENGTH} dígitos</label><input id="otp-code" inputMode="numeric" pattern="[0-9]*" maxLength={OTP_CODE_LENGTH} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH))} /></div>
        <button type="button" className="primary-button full-width" onClick={() => { void verifyCode(); }} disabled={code.length !== OTP_CODE_LENGTH || isLoading}>{isLoading ? 'Confirmando…' : 'Confirmar código'}</button>
        {cooldown > 0 ? <p className="field-hint">Você poderá pedir outro código em {cooldown}s.</p> : null}
      </> : null}
    </section>
  );
}
