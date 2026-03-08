export const formatDate = (value?: string) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

export const formatValue = (value?: number, suffix = '') => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1).replace('.', ',')}${suffix}`;
};

export const toNumber = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const today = () => new Date().toISOString().slice(0, 10);
export const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
