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
