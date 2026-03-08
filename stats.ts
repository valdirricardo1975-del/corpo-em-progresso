import { Entry } from '../types';

export const sortDesc = (items: Entry[]) => [...items].sort((a, b) => b.date.localeCompare(a.date));
export const sortAsc = (items: Entry[]) => [...items].sort((a, b) => a.date.localeCompare(b.date));

export const latestEntry = (items: Entry[]) => sortDesc(items)[0];

export const getImc = (peso?: number, alturaCm?: number) => {
  if (!peso || !alturaCm) return undefined;
  const altura = alturaCm / 100;
  return peso / (altura * altura);
};

export const getVariation = (items: Entry[]) => {
  const withPeso = sortAsc(items).filter((item) => item.peso !== undefined);
  if (withPeso.length < 2) return undefined;
  return (withPeso[withPeso.length - 1].peso || 0) - (withPeso[0].peso || 0);
};

export const chartPoints = (items: Entry[], field: keyof Entry) => {
  const sorted = sortAsc(items).filter((item) => typeof item[field] === 'number').slice(-8);
  return sorted.map((item) => ({ label: item.date.slice(5), value: Number(item[field]) }));
};
