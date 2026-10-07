import savedImages from './product-images.json';

// Compact catalog definition. `buildProductDrafts()` turns it into commercetools product drafts.
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'each';
type Flag = 'W' | 'A' | 'OOS' | 'R';
interface Variant { value: number; unit: Unit; label: string; usd: number }
interface Def {
  category: string; key: string; en: string; de: string; flags: Flag[]; variants: Variant[];
  storage: 'ambient' | 'chilled' | 'frozen'; dietary: string[]; brand: string; sub?: string;
}

const each = (label: string, usd: number): Variant[] => [{ value: 1, unit: 'each', label, usd }];

export const DEFS: Def[] = [
  { category: 'fresh-produce', key: 'bananas', en: 'Bananas', de: 'Bananen', flags: ['W', 'A'], storage: 'ambient', dietary: ['vegan', 'organic'], brand: 'Orchard Fresh', sub: 'gala-apples',
    variants: [{ value: 500, unit: 'g', label: '500 g', usd: 149 }, { value: 1, unit: 'kg', label: '1 kg', usd: 279 }] },
  { category: 'fresh-produce', key: 'roma-tomatoes', en: 'Roma tomatoes', de: 'Roma-Tomaten', flags: ['W', 'A'], storage: 'ambient', dietary: ['vegan'], brand: 'Orchard Fresh',
    variants: [{ value: 500, unit: 'g', label: '500 g', usd: 229 }, { value: 1, unit: 'kg', label: '1 kg', usd: 429 }] },
  { category: 'fresh-produce', key: 'gala-apples', en: 'Gala apples', de: 'Gala-Äpfel', flags: ['W', 'A'], storage: 'ambient', dietary: ['vegan', 'organic'], brand: 'Orchard Fresh', sub: 'bananas',
    variants: [{ value: 1, unit: 'kg', label: '1 kg', usd: 349 }, { value: 2, unit: 'kg', label: '2 kg', usd: 649 }] },
  { category: 'fresh-produce', key: 'strawberries', en: 'Strawberries', de: 'Erdbeeren', flags: ['W', 'A'], storage: 'chilled', dietary: ['vegan'], brand: 'Orchard Fresh',
    variants: [{ value: 250, unit: 'g', label: '250 g', usd: 329 }, { value: 500, unit: 'g', label: '500 g', usd: 599 }] },
  { category: 'fresh-produce', key: 'potatoes', en: 'Potatoes', de: 'Kartoffeln', flags: ['W', 'A'], storage: 'ambient', dietary: ['vegan'], brand: 'Orchard Fresh',
    variants: [{ value: 1, unit: 'kg', label: '1 kg', usd: 199 }, { value: 2, unit: 'kg', label: '2 kg', usd: 369 }] },
  { category: 'fresh-produce', key: 'carrots', en: 'Carrots', de: 'Karotten', flags: ['W', 'A'], storage: 'chilled', dietary: ['vegan', 'organic'], brand: 'Orchard Fresh',
    variants: [{ value: 500, unit: 'g', label: '500 g', usd: 129 }, { value: 1, unit: 'kg', label: '1 kg', usd: 229 }] },

  { category: 'dairy-eggs', key: 'whole-milk', en: 'Whole milk 1 L', de: 'Vollmilch 1 l', flags: ['R'], storage: 'chilled', dietary: ['vegetarian'], brand: 'Meadow', sub: 'oat-drink', variants: each('1 L', 199) },
  { category: 'dairy-eggs', key: 'oat-drink', en: 'Oat drink 1 L', de: 'Haferdrink 1 l', flags: ['R'], storage: 'ambient', dietary: ['vegan'], brand: 'Meadow', sub: 'whole-milk', variants: each('1 L', 229) },
  { category: 'dairy-eggs', key: 'free-range-eggs', en: 'Free-range eggs 12', de: 'Freilandeier 12', flags: ['R'], storage: 'chilled', dietary: ['vegetarian'], brand: 'Meadow', variants: each('12 pack', 429) },
  { category: 'dairy-eggs', key: 'greek-yogurt', en: 'Greek yogurt 500 g', de: 'Griechischer Joghurt 500 g', flags: [], storage: 'chilled', dietary: ['vegetarian'], brand: 'Meadow', variants: each('500 g', 349) },
  { category: 'dairy-eggs', key: 'cheddar', en: 'Cheddar block', de: 'Cheddar-Block', flags: ['W', 'OOS'], storage: 'chilled', dietary: ['vegetarian'], brand: 'Meadow',
    variants: [{ value: 200, unit: 'g', label: '200 g', usd: 449 }, { value: 400, unit: 'g', label: '400 g', usd: 849 }] },
  { category: 'dairy-eggs', key: 'salted-butter', en: 'Salted butter 250 g', de: 'Gesalzene Butter 250 g', flags: [], storage: 'chilled', dietary: ['vegetarian'], brand: 'Meadow', variants: each('250 g', 399) },

  { category: 'bakery', key: 'sourdough-loaf', en: 'Sourdough loaf', de: 'Sauerteigbrot', flags: ['OOS'], storage: 'ambient', dietary: ['vegan'], brand: 'Hearth Bakery', sub: 'wholemeal-bread', variants: each('800 g', 549) },
  { category: 'bakery', key: 'wholemeal-bread', en: 'Wholemeal bread', de: 'Vollkornbrot', flags: ['R'], storage: 'ambient', dietary: ['vegan'], brand: 'Hearth Bakery', variants: each('750 g', 399) },
  { category: 'bakery', key: 'croissants', en: 'Croissants 4', de: 'Croissants 4', flags: [], storage: 'ambient', dietary: ['vegetarian'], brand: 'Hearth Bakery', variants: each('4 pack', 449) },
  { category: 'bakery', key: 'bagels', en: 'Bagels 6', de: 'Bagels 6', flags: [], storage: 'ambient', dietary: ['vegan'], brand: 'Hearth Bakery', variants: each('6 pack', 399) },
  { category: 'bakery', key: 'rye-bread', en: 'Rye bread', de: 'Roggenbrot', flags: [], storage: 'ambient', dietary: ['vegan'], brand: 'Hearth Bakery', variants: each('500 g', 349) },
  { category: 'bakery', key: 'brioche-buns', en: 'Brioche buns 6', de: 'Brioche-Brötchen 6', flags: [], storage: 'ambient', dietary: ['vegetarian'], brand: 'Hearth Bakery', variants: each('6 pack', 429) },

  { category: 'pantry', key: 'basmati-rice', en: 'Basmati rice', de: 'Basmatireis', flags: ['W', 'R'], storage: 'ambient', dietary: ['vegan', 'gluten-free'], brand: 'Pantry Co.',
    variants: [{ value: 1, unit: 'kg', label: '1 kg', usd: 399 }, { value: 2, unit: 'kg', label: '2 kg', usd: 749 }] },
  { category: 'pantry', key: 'spaghetti', en: 'Spaghetti 500 g', de: 'Spaghetti 500 g', flags: ['R'], storage: 'ambient', dietary: ['vegan'], brand: 'Pantry Co.', variants: each('500 g', 179) },
  { category: 'pantry', key: 'olive-oil', en: 'Olive oil 500 ml', de: 'Olivenöl 500 ml', flags: [], storage: 'ambient', dietary: ['vegan', 'gluten-free'], brand: 'Pantry Co.', variants: each('500 ml', 899) },
  { category: 'pantry', key: 'rolled-oats', en: 'Rolled oats 1 kg', de: 'Haferflocken 1 kg', flags: ['R'], storage: 'ambient', dietary: ['vegan'], brand: 'Pantry Co.', variants: each('1 kg', 249) },
  { category: 'pantry', key: 'chickpeas', en: 'Chickpeas can', de: 'Kichererbsen Dose', flags: [], storage: 'ambient', dietary: ['vegan', 'gluten-free'], brand: 'Pantry Co.', variants: each('400 g', 129) },
  { category: 'pantry', key: 'peanut-butter', en: 'Peanut butter 340 g', de: 'Erdnussbutter 340 g', flags: [], storage: 'ambient', dietary: ['vegan'], brand: 'Pantry Co.', variants: each('340 g', 449) },

  { category: 'drinks', key: 'sparkling-water', en: 'Sparkling water 6×1 L', de: 'Sprudelwasser 6×1 l', flags: ['R'], storage: 'ambient', dietary: ['vegan'], brand: 'Spring', variants: each('6 × 1 L', 399) },
  { category: 'drinks', key: 'orange-juice', en: 'Orange juice 1 L', de: 'Orangensaft 1 l', flags: ['OOS'], storage: 'chilled', dietary: ['vegan'], brand: 'Spring', sub: 'apple-juice', variants: each('1 L', 349) },
  { category: 'drinks', key: 'green-tea', en: 'Green tea 20 bags', de: 'Grüner Tee 20 Beutel', flags: [], storage: 'ambient', dietary: ['vegan'], brand: 'Spring', variants: each('20 bags', 299) },
  { category: 'drinks', key: 'ground-coffee', en: 'Ground coffee 250 g', de: 'Gemahlener Kaffee 250 g', flags: [], storage: 'ambient', dietary: ['vegan'], brand: 'Spring', variants: each('250 g', 799) },
  { category: 'drinks', key: 'apple-juice', en: 'Apple juice 1 L', de: 'Apfelsaft 1 l', flags: [], storage: 'chilled', dietary: ['vegan'], brand: 'Spring', variants: each('1 L', 329) },
  { category: 'drinks', key: 'kombucha', en: 'Kombucha 330 ml', de: 'Kombucha 330 ml', flags: [], storage: 'chilled', dietary: ['vegan'], brand: 'Spring', variants: each('330 ml', 349) },

  { category: 'household', key: 'dish-soap', en: 'Dish soap 500 ml', de: 'Spülmittel 500 ml', flags: [], storage: 'ambient', dietary: [], brand: 'Clean Home', variants: each('500 ml', 349) },
  { category: 'household', key: 'paper-towels', en: 'Paper towels 4 rolls', de: 'Küchenrolle 4 Rollen', flags: ['R'], storage: 'ambient', dietary: [], brand: 'Clean Home', variants: each('4 rolls', 599) },
  { category: 'household', key: 'laundry-liquid', en: 'Laundry liquid 1.5 L', de: 'Flüssigwaschmittel 1,5 l', flags: [], storage: 'ambient', dietary: [], brand: 'Clean Home', variants: each('1.5 L', 899) },
  { category: 'household', key: 'sponges', en: 'Sponges 6', de: 'Schwämme 6', flags: [], storage: 'ambient', dietary: [], brand: 'Clean Home', variants: each('6 pack', 299) },
  { category: 'household', key: 'trash-bags', en: 'Trash bags 20', de: 'Müllbeutel 20', flags: [], storage: 'ambient', dietary: [], brand: 'Clean Home', variants: each('20 bags', 349) },
  { category: 'household', key: 'beeswax-wraps', en: 'Beeswax wraps', de: 'Bienenwachstücher', flags: [], storage: 'ambient', dietary: [], brand: 'Clean Home', variants: each('3 pack', 1199) },
];

export const skuOf = (key: string, v: Variant) => `${key}-${v.value}${v.unit}`.toUpperCase();
export const eurCents = (usd: number) => Math.round(usd * 0.9);

const loc = (en: string, de: string) => ({ 'en-US': en, 'de-DE': de });
const attr = (name: string, value: unknown) => ({ name, value });

/** `substitutes` resolves product keys to ids (second pass); the first pass omits them. */
export function buildProductDrafts(): Record<string, unknown>[] {
  return DEFS.map((d) => {
    const weighed = d.flags.includes('W');
    const variants = d.variants.map((v) => ({
      sku: skuOf(d.key, v),
      key: skuOf(d.key, v),
      prices: [
        { value: { currencyCode: 'USD', centAmount: v.usd }, country: 'US' },
        { value: { currencyCode: 'EUR', centAmount: eurCents(v.usd) }, country: 'DE' },
      ],
      // Photos picked by `npm run seed:images` when present, else a placeholder.
      images: (savedImages as Record<string, { url: string; dimensions: { w: number; h: number } }[]>)[d.key] ?? [
        { url: `https://picsum.photos/seed/${skuOf(d.key, v).toLowerCase()}/800/800`, dimensions: { w: 800, h: 800 } },
      ],
      attributes: [
        ...productAttrs(d),
        attr('incrementValue', v.value),
        attr('incrementUnit', v.unit),
        attr('approximateWeight', d.flags.includes('A')),
        attr('packLabel', loc(v.label, v.label.replace('.', ','))),
      ],
    }));
    const [master, ...rest] = variants;
    return {
      key: d.key,
      productType: { typeId: 'product-type', key: 'grocery-product' },
      taxCategory: { typeId: 'tax-category', key: d.category === 'household' ? 'non-food' : 'food' },
      categories: [{ typeId: 'category', key: d.category }],
      name: loc(d.en, d.de),
      slug: loc(d.key, `${d.key}-de`),
      description: loc(
        `${d.en} from ${d.brand}. ${weighed ? 'Sold by weight in fixed increments.' : 'Sold as a single unit.'}`,
        `${d.de} von ${d.brand}. ${weighed ? 'Verkauf nach Gewicht in festen Mengen.' : 'Verkauf als Einzelartikel.'}`,
      ),
      metaTitle: loc(`${d.en} | MALVA`, `${d.de} | MALVA`),
      masterVariant: master,
      variants: rest,
      publish: true,
    };
  });
}

function productAttrs(d: Def) {
  return [
    attr('brand', d.brand),
    attr('origin', 'Various'),
    attr('dietary', d.dietary),
    attr('storage', d.storage),
    attr('allergens', []),
    attr('recurringEligible', d.flags.includes('R')),
  ];
}

export const substituteMap = (): Record<string, string> =>
  Object.fromEntries(DEFS.filter((d) => d.sub).map((d) => [d.key, d.sub as string]));
export const skuQuantities = (): { sku: string; quantity: number }[] =>
  DEFS.flatMap((d) => d.variants.map((v) => ({ sku: skuOf(d.key, v), quantity: d.flags.includes('OOS') ? 0 : 50 })));
