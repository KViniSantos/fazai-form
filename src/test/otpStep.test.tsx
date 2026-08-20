import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OtpStep from '@/components/steps/OtpStep';

describe('pre-registration OTP step', () => {
  it('sends only the e-mail, accepts an eight-digit code and allows resend after cooldown', async () => {
    const user = userEvent.setup();
    const onRequestCode = vi.fn();
    const onVerifyCode = vi.fn();
    render(<OtpStep initialEmail="prestador@example.com" onRequestCode={onRequestCode} onVerifyCode={onVerifyCode} cooldownSeconds={0} />);

    expect(screen.getByDisplayValue('prestador@example.com')).toHaveAttribute('type', 'email');
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /enviar código/i }));
    expect(onRequestCode).toHaveBeenCalledWith('prestador@example.com');
    await user.type(screen.getByLabelText(/código de 8 dígitos/i), '12345678');
    await user.click(screen.getByRole('button', { name: /confirmar código/i }));
    expect(onVerifyCode).toHaveBeenCalledWith('12345678');
    expect(screen.getByRole('button', { name: /reenviar código/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /reenviar código/i }));
    expect(onRequestCode).toHaveBeenCalledTimes(2);
  });
});
