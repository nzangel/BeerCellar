import type { Beer } from '../types';

type OpenFoodFactsProduct = {
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  image_url?: string;
  countries_tags?: string[];
  nutriments?: { alcohol?: number };
};

type OpenFoodFactsResponse = {
  status: number;
  product?: OpenFoodFactsProduct;
};

function detectBeerStyle(categories: string[]): string | null {
  const cat = categories.join(' ').toLowerCase();
  if (cat.includes('ipa') || cat.includes('india-pale-ale')) return 'IPA';
  if (cat.includes('stout')) return 'Stout';
  if (cat.includes('porter')) return 'Porter';
  if (cat.includes('lager')) return 'Lager';
  if (cat.includes('pilsner') || cat.includes('pilsen')) return 'Pilsner';
  if (cat.includes('wheat') || cat.includes('blanche') || cat.includes('weizen')) return 'Blanche';
  if (cat.includes('sour') || cat.includes('lambic') || cat.includes('geuze')) return 'Sour';
  if (cat.includes('trappist') || cat.includes('abbey') || cat.includes('abbaye')) return 'Abbaye';
  if (cat.includes('amber') || cat.includes('ambrée')) return 'Ambrée';
  if (cat.includes('pale-ale')) return 'Pale Ale';
  if (cat.includes('saison')) return 'Saison';
  if (cat.includes('bière') || cat.includes('beer')) return 'Bière';
  return null;
}

export async function lookupBeerByBarcode(barcode: string): Promise<Partial<Beer> | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const data: OpenFoodFactsResponse = await res.json();

    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const categories = p.categories_tags ?? [];
    const country = p.countries_tags?.[0]?.replace('en:', '').replace(/-/g, ' ') ?? null;

    return {
      barcode,
      name: p.product_name ?? 'Bière inconnue',
      brewery: p.brands ?? null,
      style: detectBeerStyle(categories),
      abv: p.nutriments?.alcohol ?? null,
      image_url: p.image_url ?? null,
      country: country ? country.charAt(0).toUpperCase() + country.slice(1) : null,
    };
  } catch {
    return null;
  }
}
