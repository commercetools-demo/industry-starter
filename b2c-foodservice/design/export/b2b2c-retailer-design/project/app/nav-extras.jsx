/* =========================================================================
   VELA — MegaMenu (full-width shop dropdown) + LocaleChooser (region/
   currency/language drawer). Built on the VELA tokens + commercetools style.
   ========================================================================= */

/* ---- Per-category MegaMenu content (cat = real ListingPage filter; null = all) ---- */
const MEGA_ACTIVITY = ['Yoga & Pilates', 'Running', 'Training', 'Lounge', 'Tennis & Padel', 'Hiking'];

const MEGA_BY_KEY = {
  leggings: {
    cat: 'Leggings',
    feature: [
      ['New In Leggings', 'Leggings'],
      ['Bestselling Leggings', 'Leggings'],
      ['The Legging Shop', 'Leggings'],
      ['Matching Sets', null],
      ['Final Sale', null],
    ],
    shopTitle: 'Shop Leggings',
    cols: [
      [['High-Rise', 'Leggings'], ['7/8 Length', 'Leggings'], ['Full Length', 'Leggings'], ['Cropped', 'Leggings']],
      [['Run Tights', 'Leggings'], ['Pocket Leggings', 'Leggings'], ['Compressive', 'Leggings'], ['Buttery-Soft', 'Leggings']],
    ],
    more: [['Sports Bras', 'Sports Bras'], ['Tops', 'Tops'], ['Shorts', 'Shorts'], ['Joggers', 'Joggers'], ['Accessories', 'Accessories']],
    promo: { type: 'leggings', cw: CW.violet, tint: '#ECEBFF', h: 'Squat-proof. Sweat-proof.', p: 'Featherweight Nulu\u2122 tights with the buttery hand-feel that started it all.' },
  },
  bras: {
    cat: 'Sports Bras',
    feature: [
      ['New In Bras', 'Sports Bras'],
      ['Bestselling Bras', 'Sports Bras'],
      ['High Support', 'Sports Bras'],
      ['Light Support', 'Sports Bras'],
      ['Final Sale', null],
    ],
    shopTitle: 'Shop Sports Bras',
    cols: [
      [['High Support', 'Sports Bras'], ['Medium Support', 'Sports Bras'], ['Light Support', 'Sports Bras'], ['Strappy', 'Sports Bras']],
      [['Longline', 'Sports Bras'], ['Seamless', 'Sports Bras'], ['Adjustable', 'Sports Bras'], ['Padded', 'Sports Bras']],
    ],
    more: [['Leggings', 'Leggings'], ['Tops', 'Tops'], ['Shorts', 'Shorts'], ['Outerwear', 'Hoodies & Jackets'], ['Accessories', 'Accessories']],
    promo: { type: 'bra', cw: CW.teal, tint: '#E4F6F4', h: 'Locked-in support.', p: 'From flow class to the squat rack \u2014 a fit for every level of impact.' },
  },
  tops: {
    cat: 'Tops',
    feature: [
      ['New In Tops', 'Tops'],
      ['Bestselling Tops', 'Tops'],
      ['Tanks', 'Tops'],
      ['Tees', 'Tops'],
      ['Long Sleeves', 'Tops'],
    ],
    shopTitle: 'Shop Tops',
    cols: [
      [['Tank Tops', 'Tops'], ['T-Shirts', 'Tops'], ['Short Sleeves', 'Tops'], ['Long Sleeves', 'Tops']],
      [['Cropped Tops', 'Tops'], ['Bodysuits', null], ['Seamless', 'Tops'], ['Layering', 'Tops']],
    ],
    more: [['Leggings', 'Leggings'], ['Sports Bras', 'Sports Bras'], ['Outerwear', 'Hoodies & Jackets'], ['Joggers', 'Joggers'], ['Accessories', 'Accessories']],
    promo: { type: 'tee', cw: CW.clay, tint: '#F6EBE4', h: 'Featherlight layers.', p: 'Breathable, anti-stink tops that disappear the moment you start moving.' },
  },
  outerwear: {
    cat: 'Hoodies & Jackets',
    feature: [
      ['New In Outerwear', 'Hoodies & Jackets'],
      ['Bestsellers', 'Hoodies & Jackets'],
      ['Hoodies', 'Hoodies & Jackets'],
      ['Jackets', 'Hoodies & Jackets'],
      ['Final Sale', null],
    ],
    shopTitle: 'Shop Hoodies & Jackets',
    cols: [
      [['Hoodies', 'Hoodies & Jackets'], ['Sweatshirts', 'Hoodies & Jackets'], ['Crews', 'Hoodies & Jackets'], ['Quarter-Zips', 'Hoodies & Jackets']],
      [['Jackets', 'Hoodies & Jackets'], ['Vests', 'Hoodies & Jackets'], ['Shells', 'Hoodies & Jackets'], ['Packable', 'Hoodies & Jackets']],
    ],
    more: [['Leggings', 'Leggings'], ['Tops', 'Tops'], ['Joggers', 'Joggers'], ['Shorts', 'Shorts'], ['Accessories', 'Accessories']],
    promo: { type: 'hoodie', cw: CW.ink, tint: '#ECEBFF', h: 'Cult cozy.', p: 'Oversized hoods and brushed fleece \u2014 impossible to take off.' },
  },
};

function MegaMenu({ menuKey, openShop, onEnter, onLeave }) {
  const entry = menuKey ? MEGA_BY_KEY[menuKey] : null;
  const handle = (cat) => openShop(cat);
  return (
    <div className={'mega' + (entry ? ' show' : '')} onMouseEnter={onEnter} onMouseLeave={onLeave} aria-hidden={!entry}>
      {entry && (
        <React.Fragment>
          <div className="wrap mega-inner">
            <div className="mega-col mega-feature">
              {entry.feature.map(([label, cat]) => (
                <a key={label} className="mega-feature-link" onClick={() => handle(cat)}>{label}</a>
              ))}
            </div>

            <div className="mega-col">
              <h4 className="mega-head">{entry.shopTitle}</h4>
              <div className="mega-2col">
                {entry.cols.map((col, i) => (
                  <div key={i} className="mega-list">
                    {col.map(([label, cat]) => (
                      <a key={label} className="mega-link" onClick={() => handle(cat)}>{label}</a>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mega-col">
              <h4 className="mega-head">More from VELA</h4>
              <div className="mega-list">
                {entry.more.map(([label, cat]) => (
                  <a key={label} className="mega-link" onClick={() => handle(cat)}>{label}</a>
                ))}
              </div>
            </div>

            <div className="mega-promo" onClick={() => handle(entry.cat)}>
              <div className="mega-promo-img" style={{background: entry.promo.tint}}>
                <Garment type={entry.promo.type} colorway={entry.promo.cw} bgTint={entry.promo.tint} />
              </div>
              <h3 className="mega-promo-h">{entry.promo.h}</h3>
              <p className="mega-promo-p">{entry.promo.p}</p>
              <span className="mega-promo-cta">Shop {entry.cat} →</span>
            </div>
          </div>

          <div className="mega-activity">
            <div className="wrap mega-activity-inner">
              <span className="mega-activity-label">Activity</span>
              <div className="mega-activity-links">
                {MEGA_ACTIVITY.map(a => <a key={a} onClick={() => handle(entry.cat)}>{a}</a>)}
              </div>
              <a className="mega-shopall" onClick={() => handle(entry.cat)}>Shop all {entry.cat}</a>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ---- Locale / currency / language data ---- */
const LOCALES = {
  'North America': [
    { country: 'United States', ccy: 'USD', langs: [['EN', 'English'], ['ES', 'Espa\u00f1ol']] },
    { country: 'Canada',        ccy: 'CAD', langs: [['EN', 'English'], ['FR', 'Fran\u00e7ais']] },
    { country: 'Mexico',        ccy: 'MXN', langs: [['ES', 'Espa\u00f1ol'], ['EN', 'English']] },
  ],
  'Europe': [
    { country: 'United Kingdom', ccy: 'GBP', langs: [['EN', 'English']] },
    { country: 'Germany',        ccy: 'EUR', langs: [['DE', 'Deutsch'], ['EN', 'English']] },
    { country: 'France',         ccy: 'EUR', langs: [['FR', 'Fran\u00e7ais'], ['EN', 'English']] },
    { country: 'Italy',          ccy: 'EUR', langs: [['IT', 'Italiano'], ['EN', 'English']] },
    { country: 'Spain',          ccy: 'EUR', langs: [['ES', 'Espa\u00f1ol'], ['EN', 'English']] },
    { country: 'Netherlands',    ccy: 'EUR', langs: [['NL', 'Nederlands'], ['EN', 'English']] },
    { country: 'Switzerland',    ccy: 'CHF', langs: [['DE', 'Deutsch'], ['FR', 'Fran\u00e7ais'], ['EN', 'English']] },
    { country: 'Sweden',         ccy: 'SEK', langs: [['SV', 'Svenska'], ['EN', 'English']] },
  ],
  'Asia Pacific': [
    { country: 'Australia',   ccy: 'AUD', langs: [['EN', 'English']] },
    { country: 'New Zealand', ccy: 'NZD', langs: [['EN', 'English']] },
    { country: 'Japan',       ccy: 'JPY', langs: [['JA', '\u65e5\u672c\u8a9e'], ['EN', 'English']] },
    { country: 'Singapore',   ccy: 'SGD', langs: [['EN', 'English']] },
    { country: 'Hong Kong',   ccy: 'HKD', langs: [['EN', 'English'], ['ZH', '\u4e2d\u6587']] },
    { country: 'South Korea', ccy: 'KRW', langs: [['KO', '\ud55c\uad6d\uc5b4'], ['EN', 'English']] },
  ],
  'South America': [
    { country: 'Brazil',    ccy: 'BRL', langs: [['PT', 'Portugu\u00eas'], ['EN', 'English']] },
    { country: 'Argentina', ccy: 'USD', langs: [['ES', 'Espa\u00f1ol'], ['EN', 'English']] },
    { country: 'Chile',     ccy: 'USD', langs: [['ES', 'Espa\u00f1ol'], ['EN', 'English']] },
  ],
  'The Middle East': [
    { country: 'United Arab Emirates', ccy: 'AED', langs: [['EN', 'English'], ['AR', '\u0627\u0644\u0639\u0631\u0628\u064a\u0629']] },
    { country: 'Saudi Arabia',         ccy: 'SAR', langs: [['AR', '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'], ['EN', 'English']] },
    { country: 'Israel',               ccy: 'USD', langs: [['EN', 'English'], ['HE', '\u05e2\u05d1\u05e8\u05d9\u05ea']] },
  ],
  'Africa': [
    { country: 'South Africa', ccy: 'ZAR', langs: [['EN', 'English']] },
    { country: 'Nigeria',      ccy: 'USD', langs: [['EN', 'English']] },
    { country: 'Egypt',        ccy: 'USD', langs: [['AR', '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'], ['EN', 'English']] },
  ],
};
const REGION_ORDER = ['Africa', 'Asia Pacific', 'Europe', 'North America', 'South America', 'The Middle East'];

function LocaleChooser({ show, close, locale, setLocale }) {
  const { useState, useEffect } = React;
  const [expanded, setExpanded] = useState(locale.region || 'Europe');
  const current = (() => {
    for (const r of REGION_ORDER) {
      const hit = (LOCALES[r] || []).find(c => c.country === locale.country);
      if (hit) return hit;
    }
    return LOCALES['North America'][0];
  })();

  useEffect(() => { if (show) setExpanded(locale.region || 'Europe'); }, [show]);

  const pickCountry = (region, c) => {
    const lang = c.langs[0];
    setLocale({ region, country: c.country, ccy: c.ccy, lang: lang[0], langName: lang[1] });
  };
  const pickLang = (e) => {
    const code = e.target.value;
    const lang = current.langs.find(l => l[0] === code) || current.langs[0];
    setLocale({ ...locale, lang: lang[0], langName: lang[1] });
  };

  return (
    <React.Fragment>
      <div className={'overlay' + (show ? ' show' : '')} onClick={close} />
      <aside className={'drawer locale-drawer' + (show ? ' show' : '')} aria-label="Choose your location">
        <button className="x-btn locale-x" onClick={close} aria-label="Close"><Icon name="x" /></button>
        <div className="drawer-body locale-body">
          <div className="locale-current">
            <Icon name="globe" size={22} />
            <h3>{current.country} ({locale.ccy})</h3>
          </div>
          <p className="locale-sub">
            Your current selected location is {current.country} and your order will be billed in {locale.ccy}.
          </p>

          <div className="locale-lang">
            <select value={locale.lang} onChange={pickLang} aria-label="Language">
              {current.langs.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <Icon name="chevD" size={20} />
          </div>

          <h2 className="locale-title">Choose your location</h2>

          <div className="locale-regions">
            {REGION_ORDER.map(region => {
              const isOpen = expanded === region;
              return (
                <div key={region} className={'locale-region' + (isOpen ? ' open' : '')}>
                  <button className="locale-region-head" onClick={() => setExpanded(isOpen ? null : region)}>
                    <span>{region}</span>
                    <Icon name={isOpen ? 'minus' : 'plus'} size={20} />
                  </button>
                  {isOpen && (
                    <div className="locale-countries">
                      {LOCALES[region].map(c => {
                        const sel = c.country === locale.country;
                        return (
                          <button key={c.country} className={'locale-country' + (sel ? ' sel' : '')} onClick={() => pickCountry(region, c)}>
                            <span>{c.country}</span>
                            <span className="locale-country-ccy">{sel && <Icon name="check" size={16} />}{c.ccy}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { MegaMenu, LocaleChooser });
