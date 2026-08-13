export const PRODUCTS = {
  1: {
    level: 1,
    price: 100,
    jadeBonus: 100,
    entryLimit: 10,
    payoutLimit: 200,
    urcBonus: 0,
    hongbaoBonus: 0,
    cheotanTickets: 0,
  },
  2: {
    level: 2,
    price: 500,
    jadeBonus: 550,
    entryLimit: 50,
    payoutLimit: 1250,
    urcBonus: 1,
    hongbaoBonus: 1,
    cheotanTickets: 1,
  },
  3: {
    level: 3,
    price: 1000,
    jadeBonus: 1200,
    entryLimit: 100,
    payoutLimit: 3000,
    urcBonus: 3,
    hongbaoBonus: 3,
    cheotanTickets: 3,
  },
} as const;

export function getProduct(level: unknown) {
  const numericLevel = Number(level) as keyof typeof PRODUCTS;
  return PRODUCTS[numericLevel] ?? null;
}
