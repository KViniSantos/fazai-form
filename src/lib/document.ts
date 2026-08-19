export function normalizeDocument(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskDocument(value: string, type: 'cpf' | 'cnpj' | ''): string {
  const digits = normalizeDocument(value).slice(0, type === 'cnpj' ? 14 : 11);
  if (type === 'cnpj') {
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d{1,2})$/, '$1-$2');
}

function isValidCpf(value: string): boolean {
  const digits = normalizeDocument(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(digits[index]) * (10 - index);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(digits[index]) * (11 - index);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(digits[10]);
}

function isValidCnpj(value: string): boolean {
  const digits = normalizeDocument(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calculateDigit = (weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(firstWeights) === Number(digits[12])
    && calculateDigit(secondWeights) === Number(digits[13]);
}

export function isValidCpfOrCnpj(value: string, type?: 'cpf' | 'cnpj' | ''): boolean {
  const normalized = normalizeDocument(value);
  if (type === 'cpf') return isValidCpf(normalized);
  if (type === 'cnpj') return isValidCnpj(normalized);
  if (normalized.length === 11) return isValidCpf(normalized);
  if (normalized.length === 14) return isValidCnpj(normalized);
  return false;
}
