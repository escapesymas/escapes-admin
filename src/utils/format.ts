const locale = 'es-ES';
const currency = 'EUR';

const formatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatPrice = (cents: number): string => {
  if (typeof cents !== 'number' || isNaN(cents)) return formatter.format(0);
  return formatter.format(cents / 100);
};

export const formatEuros = (euros: number): string => {
  if (typeof euros !== 'number' || isNaN(euros)) return formatter.format(0);
  return formatter.format(euros);
};
