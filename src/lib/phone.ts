export function normalizeBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return `+${digits}`;
  return `+55${digits}`;
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;

  return (localDigits.length === 10 || localDigits.length === 11)
    && localDigits.slice(0, 2) !== '00';
}

export function maskBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^55/, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}
