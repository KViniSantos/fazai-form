export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function maskCep(value: string): string {
  return normalizeCep(value).replace(/^(\d{5})(\d)/, '$1-$2');
}
