/* =========================================================================
   VELA — store data: brand, colorways, products, retail locations
   ========================================================================= */

// Reusable fabric colorways (base / shade / light / seam)
const CW = {
  black:   { name: 'Black',          base: '#23222B', shade: '#0E0E14', light: '#3A3945', seam: 'rgba(255,255,255,0.10)', dot: '#23222B' },
  ink:     { name: 'Deep Ink',       base: '#191741', shade: '#0E0D29', light: '#2C295E', seam: 'rgba(255,255,255,0.10)', dot: '#191741' },
  slate:   { name: 'Storm Slate',    base: '#5B6472', shade: '#3D4450', light: '#7C8493', seam: 'rgba(255,255,255,0.12)', dot: '#5B6472' },
  fog:     { name: 'Fog Grey',       base: '#C6C2BC', shade: '#A8A39B', light: '#DEDAD4', seam: 'rgba(0,0,0,0.10)', dot: '#C6C2BC' },
  bone:    { name: 'Bone',           base: '#ECE7DD', shade: '#D6CFC2', light: '#F7F2EA', seam: 'rgba(0,0,0,0.08)', dot: '#ECE7DD' },
  violet:  { name: 'Electric Violet',base: '#6359FF', shade: '#4242B2', light: '#8F8FFF', seam: 'rgba(255,255,255,0.16)', dot: '#6359FF' },
  teal:    { name: 'Tidal Teal',     base: '#0BBFBF', shade: '#0A948F', light: '#5FE6DF', seam: 'rgba(255,255,255,0.16)', dot: '#0BBFBF' },
  clay:    { name: 'Clay',           base: '#C06B4E', shade: '#9A4F36', light: '#D98E73', seam: 'rgba(255,255,255,0.12)', dot: '#C06B4E' },
  sand:    { name: 'Desert Sand',    base: '#C9A66B', shade: '#A88649', light: '#E0C490', seam: 'rgba(0,0,0,0.10)', dot: '#C9A66B' },
  forest:  { name: 'Pine',           base: '#2F4A3E', shade: '#1E332A', light: '#456657', seam: 'rgba(255,255,255,0.12)', dot: '#2F4A3E' },
  plum:    { name: 'Plum',           base: '#5A2E4D', shade: '#3F1F36', light: '#7C4A6D', seam: 'rgba(255,255,255,0.12)', dot: '#5A2E4D' },
  amber:   { name: 'Amber',          base: '#FFB000', shade: '#D98E00', light: '#FFD03B', seam: 'rgba(0,0,0,0.12)', dot: '#FFB000' },
};

const SIZES_APPAREL = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SIZES_OS = ['One size'];

// stockBySize: per-store availability simulated via product+store hash later.
function P(o) { return o; }

const PRODUCTS = [
  P({ id:'flux-legging', name:'Flux High-Rise Legging', cat:'Leggings', type:'leggings',
      price:118, rating:4.8, reviews:2140, badge:'Bestseller',
      tagline:'25" sculpting tight with the buttery hand-feel that started it all.',
      fabric:'Featherweight Nulu™ stretch · 4-way recovery · squat-proof',
      details:['High-rise, 25" inseam','Hidden waistband pocket','Sweat-wicking, breathable knit','Designed for yoga & low-impact training'],
      colors:[CW.black, CW.ink, CW.slate, CW.violet, CW.clay], sizes:SIZES_APPAREL }),

  P({ id:'momentum-legging', name:'Momentum Train Tight', cat:'Leggings', type:'leggings',
      price:128, rating:4.7, reviews:1180, badge:null,
      tagline:'Compressive 7/8 tight engineered for the studio floor and the squat rack.',
      fabric:'Power-knit compression · cool-touch · matte finish',
      details:['High-rise, 7/8 length','Two side drop-in pockets','Locked-in compressive support','Built for HIIT & strength'],
      colors:[CW.black, CW.forest, CW.plum, CW.teal], sizes:SIZES_APPAREL }),

  P({ id:'aero-bra', name:'Aero Strappy Bra', cat:'Sports Bras', type:'bra',
      price:62, rating:4.6, reviews:860, badge:null,
      tagline:'Light-support bra with a strappy back that earns its keep in flow class.',
      fabric:'Nulu™ jersey · removable cups · light support',
      details:['Light support, A–C','Removable pads','Strappy open back','Yoga & studio'],
      colors:[CW.black, CW.bone, CW.violet, CW.clay, CW.teal], sizes:SIZES_APPAREL }),

  P({ id:'anchor-bra', name:'Anchor High-Support Bra', cat:'Sports Bras', type:'bra',
      price:74, rating:4.8, reviews:1320, badge:'Bestseller',
      tagline:'Locked-down high-support bra for runs that don\'t negotiate.',
      fabric:'Power-knit · encapsulated cups · high support',
      details:['High support, A–E','Encapsulated cups','Adjustable straps','Run & high-impact'],
      colors:[CW.black, CW.ink, CW.slate, CW.amber], sizes:SIZES_APPAREL }),

  P({ id:'breeze-tank', name:'Breeze Racerback Tank', cat:'Tops', type:'tank',
      price:58, rating:4.5, reviews:540, badge:null,
      tagline:'Featherlight racerback that disappears the moment you start moving.',
      fabric:'Airflow mesh-back jersey · anti-stink finish',
      details:['Relaxed racerback','Mesh ventilation panel','Hip-length','Train & everyday'],
      colors:[CW.bone, CW.black, CW.slate, CW.teal, CW.sand], sizes:SIZES_APPAREL }),

  P({ id:'pace-tee', name:'Pace Performance Tee', cat:'Tops', type:'tee',
      price:68, rating:4.7, reviews:980, badge:null,
      tagline:'The do-everything training tee — soft enough to live in.',
      fabric:'Cool-touch Metal Vent blend · seamless sides',
      details:['Standard fit','Seamless underarm','Drop tail hem','Train & travel'],
      colors:[CW.black, CW.fog, CW.forest, CW.violet, CW.clay], sizes:SIZES_APPAREL }),

  P({ id:'ascent-ls', name:'Ascent Long-Sleeve', cat:'Tops', type:'longsleeve',
      price:88, rating:4.6, reviews:610, badge:'New',
      tagline:'A brushed long-sleeve for cold starts and warm-down miles.',
      fabric:'Brushed thermal knit · thumbholes · reflective hit',
      details:['Slim fit','Thumbholes','Reflective logo','Run & layer'],
      colors:[CW.ink, CW.black, CW.slate, CW.plum], sizes:SIZES_APPAREL }),

  P({ id:'haven-hoodie', name:'Haven Scuba Hoodie', cat:'Hoodies & Jackets', type:'hoodie',
      price:138, rating:4.9, reviews:3020, badge:'Bestseller',
      tagline:'The cult cozy hoodie — oversized hood, cotton-soft, impossible to take off.',
      fabric:'Brushed scuba fleece · cotton-blend · oversized fit',
      details:['Oversized fit','Jumbo hood','Kangaroo pocket','Studio to street'],
      colors:[CW.bone, CW.black, CW.slate, CW.clay, CW.forest], sizes:SIZES_APPAREL }),

  P({ id:'range-jacket', name:'Range Run Jacket', cat:'Hoodies & Jackets', type:'jacket',
      price:158, rating:4.7, reviews:740, badge:'New',
      tagline:'Packable wind-and-water shell that stuffs into its own pocket.',
      fabric:'Ripstop Glyde™ shell · water-repellent · packable',
      details:['Slim run fit','Packs into pocket','Water-repellent finish','Reflective trim'],
      colors:[CW.black, CW.ink, CW.teal, CW.amber], sizes:SIZES_APPAREL }),

  P({ id:'pivot-short', name:'Pivot 5" Lined Short', cat:'Shorts', type:'shorts',
      price:72, rating:4.6, reviews:1410, badge:null,
      tagline:'Lined 5" short that handles sprints, lifts, and the walk home.',
      fabric:'Swift-knit shell · liner · zip pocket',
      details:['5" inseam','Built-in liner','Zip back pocket','Train & run'],
      colors:[CW.black, CW.forest, CW.slate, CW.clay], sizes:SIZES_APPAREL }),

  P({ id:'drift-jogger', name:'Drift Everyday Jogger', cat:'Joggers', type:'joggers',
      price:128, rating:4.8, reviews:1660, badge:null,
      tagline:'Tapered French-terry jogger built for rest days and rush hours.',
      fabric:'French terry · tapered leg · zip pockets',
      details:['Tapered fit','Cuffed ankle','Zip side pockets','Lounge & travel'],
      colors:[CW.slate, CW.black, CW.bone, CW.forest, CW.plum], sizes:SIZES_APPAREL }),

  P({ id:'surge-tight', name:'Surge 7/8 Run Tight', cat:'Leggings', type:'leggings',
      price:128, rating:4.7, reviews:520, badge:'New',
      tagline:'No-bounce run tight with cargo pockets for everything you carry.',
      fabric:'Power-knit · cargo pockets · reflective',
      details:['High-rise, 7/8','Two cargo pockets','Reflective detailing','Run & trail'],
      colors:[CW.black, CW.ink, CW.forest, CW.amber], sizes:SIZES_APPAREL }),

  // Accessories
  P({ id:'crest-cap', name:'Crest Run Cap', cat:'Accessories', type:'cap',
      price:38, rating:4.5, reviews:330, badge:null,
      tagline:'Lightweight, sweat-wicking cap that packs flat.',
      fabric:'Featherweight ripstop · adjustable',
      details:['One size, adjustable','Sweat-wicking band','Packable','Run & everyday'],
      colors:[CW.black, CW.bone, CW.violet, CW.teal], sizes:SIZES_OS }),

  P({ id:'haul-tote', name:'Haul Studio Tote', cat:'Accessories', type:'bag',
      price:78, rating:4.6, reviews:280, badge:null,
      tagline:'Wipe-clean studio tote with a wet pocket and shoe base.',
      fabric:'Coated canvas · 22L · wet pocket',
      details:['22L capacity','Wet/shoe pocket','Wipe-clean lining','Studio & travel'],
      colors:[CW.black, CW.bone, CW.clay], sizes:SIZES_OS }),

  P({ id:'flow-bottle', name:'Flow 24oz Bottle', cat:'Accessories', type:'bottle',
      price:34, rating:4.7, reviews:410, badge:null,
      tagline:'Insulated stainless bottle that keeps cold for 24 hours.',
      fabric:'Double-wall stainless · 24oz · leak-proof',
      details:['24oz / 710ml','Keeps cold 24h','Leak-proof lid','Everyday'],
      colors:[CW.black, CW.bone, CW.teal, CW.amber], sizes:SIZES_OS }),

  P({ id:'core-bra', name:'Core Seamless Bra', cat:'Sports Bras', type:'bra',
      price:54, rating:4.4, reviews:470, badge:null,
      tagline:'Second-skin seamless bra for layering and low-impact days.',
      fabric:'Seamless knit · medium support',
      details:['Medium support','Seamless construction','Pull-on','Train & layer'],
      colors:[CW.bone, CW.black, CW.fog, CW.plum], sizes:SIZES_APPAREL }),
];

const CATEGORIES = ['Leggings', 'Sports Bras', 'Tops', 'Hoodies & Jackets', 'Shorts', 'Joggers', 'Accessories'];

// B2B account context: the signed-in buyer belongs to one or more Business Units;
// each Business Unit can purchase from one or more Stores (channels).
const B2B_ACCOUNT = [
  { id:'pulse', name:'Pulse Fitness Group', code:'pulse-retail-eu', stores:[
      { id:'eu-dist',  name:'EU Distribution Center' },
      { id:'de-flag',  name:'Berlin Flagship' },
      { id:'uk-online',name:'UK Online' },
  ]},
  { id:'apex', name:'Apex Sportswear Co.', code:'apex-wholesale-us', stores:[
      { id:'us-west', name:'US West DC' },
      { id:'us-east', name:'US East DC' },
  ]},
];

// Members of the buyer's business unit (Pulse Fitness Group). Roles drive the dashboard.
const B2B_MEMBERS = [
  { id:'maya',  name:'Maya Okonkwo', email:'maya.okonkwo@pulsefitness.com', role:'buyer',    self:true },
  { id:'liam',  name:'Liam Decker',  email:'liam.decker@pulsefitness.com',  role:'buyer' },
  { id:'sofia', name:'Sofia Reyes',  email:'sofia.reyes@pulsefitness.com',  role:'approver' },
  { id:'noah',  name:'Noah Berg',    email:'noah.berg@pulsefitness.com',    role:'admin' },
];

// Orders across the whole business unit. approval: 'none'|'pending'|'approved'|'rejected'.
const B2B_ORDERS = [
  { number:'PO-100488', buyer:'Maya Okonkwo', date:'Jun 24, 2026', approval:'pending', status:'Awaiting approval', total:8460,
    items:[{type:'hoodie',color:CW.bone,name:'Haven Scuba Hoodie',qty:24,price:138},{type:'leggings',color:CW.black,name:'Flux High-Rise Legging',qty:24,price:118}] },
  { number:'PO-100479', buyer:'Liam Decker', date:'Jun 22, 2026', approval:'pending', status:'Awaiting approval', total:11280,
    items:[{type:'jacket',color:CW.ink,name:'Range Run Jacket',qty:48,price:158},{type:'joggers',color:CW.slate,name:'Drift Everyday Jogger',qty:24,price:128}] },
  { number:'PO-100471', buyer:'Liam Decker', date:'Jun 20, 2026', approval:'approved', status:'Processing', total:3120,
    items:[{type:'tee',color:CW.black,name:'Pace Performance Tee',qty:24,price:68},{type:'bra',color:CW.violet,name:'Aero Strappy Bra',qty:24,price:62}] },
  { number:'PO-100455', buyer:'Maya Okonkwo', date:'Jun 14, 2026', approval:'none', status:'Shipped', total:1840,
    items:[{type:'leggings',color:CW.forest,name:'Momentum Train Tight',qty:12,price:128}] },
  { number:'PO-100430', buyer:'Sofia Reyes', date:'Jun 03, 2026', approval:'rejected', status:'Rejected', total:12200,
    items:[{type:'hoodie',color:CW.slate,name:'Haven Scuba Hoodie',qty:48,price:138},{type:'bra',color:CW.black,name:'Anchor High-Support Bra',qty:48,price:74}] },
  { number:'PO-100399', buyer:'Liam Decker', date:'May 22, 2026', approval:'approved', status:'Delivered', total:5400,
    items:[{type:'joggers',color:CW.plum,name:'Drift Everyday Jogger',qty:24,price:128},{type:'longsleeve',color:CW.ink,name:'Ascent Long-Sleeve',qty:24,price:88}] },
];

// Quotes across the business unit. thread is a nested discussion tree.
const B2B_QUOTES = [
  { number:'QR-2061', buyer:'Maya Okonkwo', date:'Jun 26, 2026', status:'In negotiation', requested:18960, current:16560,
    items:[{type:'jacket',color:CW.ink,name:'Range Run Jacket',qty:120,listPrice:158}],
    thread:[
      { id:'m1', who:'buyer', author:'Maya Okonkwo', time:'Jun 26 · 09:14', price:null,
        text:'Requesting a quote for 120 units of the Range Run Jacket (Deep Ink) for our Q3 studio rollout. Can we do better than list given the annual commitment?',
        replies:[
          { id:'m2', who:'rep', author:'VELA Trade Desk', time:'Jun 26 · 11:02', price:18600,
            text:'Thanks Maya. For 120 units we can offer €155/unit — 2% off list.',
            replies:[
              { id:'m3', who:'buyer', author:'Maya Okonkwo', time:'Jun 26 · 14:30', price:16200,
                text:'We were targeting €135/unit. With a committed Q4 reorder, can you get closer?',
                replies:[
                  { id:'m4', who:'rep', author:'VELA Trade Desk', time:'Jun 27 · 08:45', price:16560,
                    text:'We can do €138/unit if you commit to a matching Q4 volume. Revised quote attached.', replies:[] },
                ] },
            ] },
        ] },
    ] },
  { number:'QR-2058', buyer:'Liam Decker', date:'Jun 19, 2026', status:'Quoted', requested:9480, current:8900,
    items:[{type:'hoodie',color:CW.bone,name:'Haven Scuba Hoodie',qty:60,listPrice:138}],
    thread:[
      { id:'q1', who:'buyer', author:'Liam Decker', time:'Jun 19 · 10:20', price:null, text:'Quote request: 60 Haven hoodies (Bone) for the front-desk team refresh.', replies:[
        { id:'q2', who:'rep', author:'VELA Trade Desk', time:'Jun 19 · 16:40', price:8900, text:'Quoted at €148/unit, valid 30 days.', replies:[] },
      ] },
    ] },
  { number:'QR-2044', buyer:'Maya Okonkwo', date:'Jun 02, 2026', status:'Accepted', requested:4200, current:4200,
    items:[{type:'bottle',color:CW.teal,name:'Flow 24oz Bottle',qty:140,listPrice:34}],
    thread:[
      { id:'a1', who:'buyer', author:'Maya Okonkwo', time:'Jun 02 · 09:00', price:null, text:'140 branded bottles for the member welcome kits.', replies:[
        { id:'a2', who:'rep', author:'VELA Trade Desk', time:'Jun 02 · 12:10', price:4200, text:'€30/unit with co-branding included. Accepted — order confirmed.', replies:[] },
      ] },
    ] },
];

// Shared purchase (shopping) lists. Items reference real products by id + colorway name + pack size.
const B2B_LISTS = [
  { id:'restock-q3', name:'Q3 Studio Restock', owner:'Maya Okonkwo', sharedWith:['Liam Decker','Sofia Reyes'],
    items:[ {productId:'flux-legging', color:'Black', pack:6, qty:4}, {productId:'haven-hoodie', color:'Bone', pack:6, qty:3}, {productId:'anchor-bra', color:'Black', pack:24, qty:1} ] },
  { id:'uniforms', name:'Front-desk Uniforms', owner:'Liam Decker', sharedWith:['Maya Okonkwo'],
    items:[ {productId:'pace-tee', color:'Black', pack:24, qty:2}, {productId:'drift-jogger', color:'Storm Slate', pack:6, qty:5} ] },
];

// Shipping + billing addresses for the business unit.
const B2B_ADDRESSES = [
  { id:'ship-eu', kind:'shipping', label:'EU Distribution Center', company:'Pulse Fitness Group', line:'Industriestraße 14', city:'Berlin', zip:'10115', country:'Germany', isDefault:true },
  { id:'ship-uk', kind:'shipping', label:'UK Online Hub',          company:'Pulse Fitness UK Ltd', line:'48 Curtain Road',   city:'London', zip:'EC2A 3PT', country:'United Kingdom', isDefault:false },
  { id:'bill-hq', kind:'billing',  label:'HQ Finance',             company:'Pulse Fitness Group', line:'Friedrichstraße 200', city:'Berlin', zip:'10117', country:'Germany', isDefault:true },
];

// Admin: approval flows. trigger = order total threshold (EUR); approverRole = who signs off.
const B2B_FLOWS = [
  { id:'std',   name:'Standard procurement', trigger:5000,  approverRole:'approver', status:'Active' },
  { id:'capex', name:'Capital equipment',    trigger:10000, approverRole:'admin',    status:'Active' },
];

const STORES = [
  { id:'soho',     name:'VELA SoHo',           addr:'118 Spring St, New York, NY',     dist:'0.6 mi', hours:'10am–8pm', phone:'(212) 555-0118' },
  { id:'flatiron', name:'VELA Flatiron',       addr:'901 Broadway, New York, NY',      dist:'1.2 mi', hours:'10am–8pm', phone:'(212) 555-0901' },
  { id:'williamsburg', name:'VELA Williamsburg',addr:'242 Bedford Ave, Brooklyn, NY',  dist:'3.4 mi', hours:'11am–7pm', phone:'(718) 555-0242' },
  { id:'uws',      name:'VELA Upper West Side', addr:'2030 Broadway, New York, NY',     dist:'4.1 mi', hours:'10am–8pm', phone:'(212) 555-2030' },
  { id:'hoboken',  name:'VELA Hoboken',         addr:'225 Washington St, Hoboken, NJ',  dist:'5.7 mi', hours:'10am–7pm', phone:'(201) 555-0225' },
];

// Signed-in demo member + their stored addresses (used by checkout)
const USER = {
  signedIn: true,
  first: 'Maya', last: 'Okonkwo', name: 'Maya Okonkwo',
  email: 'maya@email.com', phone: '(212) 555-0140',
  addresses: [
    { id:'home', label:'Home', name:'Maya Okonkwo', line:'118 Spring St, Apt 4B', city:'New York', state:'NY', zip:'10012', phone:'(212) 555-0140', isDefault:true },
    { id:'work', label:'Work', name:'Maya Okonkwo', line:'620 Eighth Ave, Floor 12', city:'New York', state:'NY', zip:'10018', phone:'(212) 555-0177', isDefault:false },
  ],
};

// Promo / discount codes (stackable; case-insensitive entry)
const PROMOS = {
  MOVE10:    { label:'10% off your order',   type:'pct',  value:0.10 },
  SUMMER20:  { label:'20% summer markdown',  type:'pct',  value:0.20 },
  WELCOME15: { label:'$15 off first order',  type:'flat', value:15 },
  FREESHIP:  { label:'Free standard shipping', type:'ship' },
};

// Deterministic pseudo-random for per-store / per-size stock
function hashStr(s) { let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
function pickupStatus(productId, storeId) {
  const h = hashStr(productId + '|' + storeId);
  const r = h % 100;
  if (r < 62) return { state:'in', label:'In stock' };
  if (r < 82) return { state:'low', label:'Low stock' };
  return { state:'out', label:'Out of stock' };
}
function sizeInStock(productId, colorName, size, storeId) {
  const h = hashStr(productId + colorName + size + storeId);
  return (h % 10) > 2; // ~70% in stock
}

// ---- Currency (driven by the locale chooser) ----
const CURRENCIES = {
  USD: { symbol:'$',    rate:1,    code:'USD' },
  CAD: { symbol:'CA$',  rate:1.37, code:'CAD' },
  MXN: { symbol:'MX$',  rate:17,   code:'MXN' },
  EUR: { symbol:'€',    rate:0.92, code:'EUR' },
  GBP: { symbol:'£',    rate:0.79, code:'GBP' },
  CHF: { symbol:'CHF ', rate:0.88, code:'CHF' },
  SEK: { symbol:'kr ',  rate:10.6, code:'SEK' },
  AUD: { symbol:'A$',   rate:1.52, code:'AUD' },
  NZD: { symbol:'NZ$',  rate:1.64, code:'NZD' },
  JPY: { symbol:'¥',    rate:155,  code:'JPY' },
  SGD: { symbol:'S$',   rate:1.35, code:'SGD' },
  HKD: { symbol:'HK$',  rate:7.8,  code:'HKD' },
  KRW: { symbol:'₩',    rate:1350, code:'KRW' },
  BRL: { symbol:'R$',   rate:5.1,  code:'BRL' },
  AED: { symbol:'AED ', rate:3.67, code:'AED' },
  SAR: { symbol:'SAR ', rate:3.75, code:'SAR' },
  ZAR: { symbol:'R ',   rate:18.5, code:'ZAR' },
};
let CURRENT_CCY = 'USD';
function setCurrency(code) { if (CURRENCIES[code]) CURRENT_CCY = code; }
function money(n) {
  const c = CURRENCIES[CURRENT_CCY] || CURRENCIES.USD;
  return c.symbol + Math.round(n * c.rate).toLocaleString('en-US');
}

Object.assign(window, { CW, PRODUCTS, CATEGORIES, B2B_ACCOUNT, B2B_MEMBERS, B2B_ORDERS, B2B_QUOTES, B2B_LISTS, B2B_ADDRESSES, B2B_FLOWS, STORES, SIZES_APPAREL, pickupStatus, sizeInStock, money, hashStr, CURRENCIES, setCurrency, USER, PROMOS });
