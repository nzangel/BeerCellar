export type CellarType = 'beer' | 'wine' | 'rum' | 'whisky';

export const CELLAR_TYPES: { key: CellarType; label: string; emoji: string }[] = [
  { key: 'beer',   label: 'Bière',  emoji: '🍺' },
  { key: 'wine',   label: 'Vin',    emoji: '🍷' },
  { key: 'rum',    label: 'Rhum',   emoji: '🍹' },
  { key: 'whisky', label: 'Whisky', emoji: '🥃' },
];

type CellarLabels = {
  newItem: string;
  addItem: string;
  emptyScanHint: string;
  brewery: string;
  breweryPlaceholder: string;
  style: string;
  stylePlaceholder: string;
  namePlaceholder: string;
  showIbu: boolean;
  showYear: boolean;
  yearLabel: string;
};

const LABELS: Record<CellarType, CellarLabels> = {
  beer: {
    newItem: 'Nouvelle bière',
    addItem: 'Ajouter une bière',
    emptyScanHint: 'Scanne ta première bière ou ajoute-la manuellement.',
    brewery: 'Brasserie',
    breweryPlaceholder: 'Bières de Chimay',
    style: 'Style',
    stylePlaceholder: 'IPA, Stout, Lager…',
    namePlaceholder: 'Chimay Bleue',
    showIbu: true,
    showYear: false,
    yearLabel: 'Année',
  },
  wine: {
    newItem: 'Nouveau vin',
    addItem: 'Ajouter un vin',
    emptyScanHint: 'Scanne ta première bouteille ou ajoute-la manuellement.',
    brewery: 'Vignoble',
    breweryPlaceholder: 'Château Margaux',
    style: 'Cépage',
    stylePlaceholder: 'Cabernet Sauvignon, Chardonnay…',
    namePlaceholder: 'Château Margaux 2019',
    showIbu: false,
    showYear: true,
    yearLabel: 'Millésime',
  },
  rum: {
    newItem: 'Nouveau rhum',
    addItem: 'Ajouter un rhum',
    emptyScanHint: 'Scanne ta première bouteille ou ajoute-la manuellement.',
    brewery: 'Distillerie',
    breweryPlaceholder: 'Distillerie du Simon',
    style: 'Type',
    stylePlaceholder: 'Blanc, Ambré, Vieux…',
    namePlaceholder: 'Clément XO',
    showIbu: false,
    showYear: true,
    yearLabel: 'Année',
  },
  whisky: {
    newItem: 'Nouveau whisky',
    addItem: 'Ajouter un whisky',
    emptyScanHint: 'Scanne ta première bouteille ou ajoute-la manuellement.',
    brewery: 'Distillerie',
    breweryPlaceholder: 'Glenfiddich',
    style: 'Type',
    stylePlaceholder: 'Single Malt, Blend, Bourbon…',
    namePlaceholder: 'Glenfiddich 12 ans',
    showIbu: false,
    showYear: true,
    yearLabel: 'Année',
  },
};

export function getCellarTypeLabels(type?: string | null): CellarLabels {
  return LABELS[(type as CellarType) ?? 'beer'] ?? LABELS.beer;
}
