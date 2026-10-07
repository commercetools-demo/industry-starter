/**
 * Stock photography for the homepage (clean URLs, picked by hand from the pexels.com search; M-M-3: replace with brand photography).
 * Category images are keyed by the category `key` (the same in every locale), not the localized slug.
 */
export const CATEGORY_IMAGES: Record<string, string> = {
  'fresh-produce': 'https://media.istockphoto.com/id/947078656/photo/farmers-market-vegetables-with-tomatoes.jpg',
  'dairy-eggs': 'https://media.istockphoto.com/id/177360383/photo/cheese-bread-milk-and-eggs.jpg',
  bakery: 'https://media.istockphoto.com/id/475263838/photo/many-mixed-breads-and-rolls-shot-from-above.jpg',
  pantry: 'https://media.istockphoto.com/id/1212928413/photo/shelf-in-the-kitchen-with-various-cereals-and-seeds-peas-split-sunflower-and-pumpkin-seeds.jpg',
  drinks: 'https://media.istockphoto.com/id/973357338/photo/assorted-fruit-juice.jpg',
  household: 'https://media.istockphoto.com/id/1309230401/photo/brushes-sponges-rubber-gloves-and-natural-cleaning-products-in-the-basket.jpg',
};

export const HERO_GRID_IMAGES = {
  a: 'https://media.istockphoto.com/id/1357625017/photo/shot-of-a-young-family-enjoying-a-meal-together.jpg',
  b: 'https://media.istockphoto.com/id/2187645615/photo/colorful-display-of-fresh-fruits-vegetables-in-farmer-market-stall-during-day.jpg',
  c: 'https://media.istockphoto.com/id/2170880572/photo/baker-holding-fresh-artisan-bread-in-paper-bag.jpg',
  d: 'https://media.istockphoto.com/id/1453229786/photo/organised-pantry-items-non-perishable-food-staples-healthy-eatings-fruits-vegetables-and.jpg',
  e: 'https://media.istockphoto.com/id/1222581489/photo/farmer-woman-holding-wooden-box-full-of-fresh-raw-vegetables.jpg',
} as const;

export const EDITORIAL_IMAGE_URL = 'https://media.istockphoto.com/id/1996314747/photo/woman-smelling-food-cooking-in-a-pot-on-her-kitchen-stove.jpg';
