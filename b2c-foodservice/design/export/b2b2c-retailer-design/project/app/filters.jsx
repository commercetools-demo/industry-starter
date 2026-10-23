/* =========================================================================
   VELA — Faceted filter sidebar for the listing / search pages.
   Control types: checkbox (multi), radio (single), colour chooser, size grid.
   Counts are faceted (computed against all OTHER active facets).
   ========================================================================= */

// ---- Activity tags derived from product copy (keeps filtering grounded in data) ----
const ACTIVITIES = ['Yoga & Pilates', 'Running', 'Training', 'Lounge & Travel'];
function productActivities(p) {
  const t = (p.tagline + ' ' + p.fabric + ' ' + (p.details||[]).join(' ') + ' ' + p.cat).toLowerCase();
  const out = [];
  if (/yoga|studio|flow|pilates|low-impact|barre/.test(t)) out.push('Yoga & Pilates');
  if (/run|trail|sprint|mile|jog/.test(t)) out.push('Running');
  if (/train|hiit|strength|squat|lift|high-impact|compress|gym/.test(t)) out.push('Training');
  if (/lounge|rest|travel|everyday|street|walk|layer|cozy/.test(t)) out.push('Lounge & Travel');
  return out.length ? out : ['Training'];
}

// ---- Unique colourways across the catalogue (for the colour chooser) ----
const ALL_COLORS = (function(){
  const seen = {}, out = [];
  PRODUCTS.forEach(p => p.colors.forEach(c => { if(!seen[c.name]){ seen[c.name]=1; out.push({name:c.name, dot:c.dot}); }}));
  return out;
})();

// ---- Facet definitions (rebuilt per render so price labels track currency) ----
function buildFacets() {
  return [
    { key:'cat', label:'Category', type:'checkbox',
      options: CATEGORIES.map(c => ({ id:c, label:c, test:p=>p.cat===c })) },
    { key:'activity', label:'Activity', type:'checkbox',
      options: ACTIVITIES.map(a => ({ id:a, label:a, test:p=>productActivities(p).includes(a) })) },
    { key:'color', label:'Colour', type:'color',
      options: ALL_COLORS.map(c => ({ id:c.name, label:c.name, dot:c.dot, test:p=>p.colors.some(x=>x.name===c.name) })) },
    { key:'size', label:'Size', type:'size',
      options: ['XS','S','M','L','XL','XXL','One size'].map(s => ({ id:s, label:s==='One size'?'OS':s, test:p=>p.sizes.includes(s) })) },
    { key:'price', label:'Price', type:'radio',
      options: [
        { id:'u50',     label:'Under '+money(50),               test:p=>p.price<50 },
        { id:'50-100',  label:money(50)+' – '+money(100),        test:p=>p.price>=50 && p.price<100 },
        { id:'100-150', label:money(100)+' – '+money(150),       test:p=>p.price>=100 && p.price<150 },
        { id:'150p',    label:money(150)+' & up',                test:p=>p.price>=150 },
      ] },
    { key:'rating', label:'Rating', type:'radio',
      options: [
        { id:'45', label:'4.5 & up', test:p=>p.rating>=4.5 },
        { id:'4',  label:'4.0 & up', test:p=>p.rating>=4.0 },
      ] },
    { key:'collection', label:'Collection', type:'checkbox',
      options: [
        { id:'Bestseller', label:'Bestsellers', test:p=>p.badge==='Bestseller' },
        { id:'New',        label:'New arrivals', test:p=>p.badge==='New' },
      ] },
  ];
}

function emptyFilters() {
  return { cat:[], activity:[], color:[], size:[], collection:[], price:null, rating:null };
}
function countSelected(filters) {
  let n = 0;
  Object.keys(filters).forEach(k => { const v = filters[k]; n += Array.isArray(v) ? v.length : (v?1:0); });
  return n;
}

// product passes all facets except `exceptKey` (for faceted counts)
function productMatches(p, facets, filters, exceptKey) {
  for (const f of facets) {
    if (f.key === exceptKey) continue;
    const sel = filters[f.key];
    if (f.type === 'radio') {
      if (sel) { const opt = f.options.find(o=>o.id===sel); if (opt && !opt.test(p)) return false; }
    } else {
      if (sel && sel.length) { const ok = f.options.some(o=>sel.includes(o.id) && o.test(p)); if (!ok) return false; }
    }
  }
  return true;
}

// ---- Sidebar component ----
function FilterSidebar({ facets, filters, toggleMulti, setRadio, clearAll, counts, activeCount, resultCount, mobileOpen, closeMobile }) {
  const [open, setOpen] = React.useState(() => { const o={}; facets.forEach(f=>{o[f.key]=true;}); return o; });
  const [showAll, setShowAll] = React.useState({});
  const toggleGroup = k => setOpen(s => ({...s, [k]:!s[k]}));

  const renderOptions = (f) => {
    const sel = filters[f.key];
    const collapsible = f.type==='color' || f.type==='checkbox';
    const cap = f.type==='color' ? 6 : 6;
    const all = showAll[f.key];
    const opts = (collapsible && !all && f.options.length>cap) ? f.options.slice(0,cap) : f.options;

    if (f.type === 'size') {
      return (
        <div className="f-sizes">
          {f.options.map(o => {
            const on = sel.includes(o.id);
            const cnt = counts[f.key][o.id];
            return (
              <button key={o.id} className={'f-size'+(on?' on':'')+(cnt===0&&!on?' empty':'')}
                      disabled={cnt===0 && !on} onClick={()=>toggleMulti(f.key,o.id)} title={o.id}>{o.label}</button>
            );
          })}
        </div>
      );
    }

    return (
      <React.Fragment>
        {opts.map(o => {
          const cnt = counts[f.key][o.id];
          if (f.type === 'radio') {
            const on = sel === o.id;
            return (
              <button key={o.id} className={'f-opt'+(on?' on':'')} onClick={()=>setRadio(f.key,o.id)} disabled={cnt===0 && !on}>
                <span className="f-radio"/>
                <span className="f-label">{o.label}</span>
                <span className="f-count">{cnt}</span>
              </button>
            );
          }
          const on = sel.includes(o.id);
          return (
            <button key={o.id} className={'f-opt'+(on?' on':'')+(f.type==='color'?' f-coloropt':'')} onClick={()=>toggleMulti(f.key,o.id)} disabled={cnt===0 && !on}>
              {f.type==='color' ? <span className="f-dot" style={{background:o.dot}}/> : <span className="f-box"><Icon name="check" size={11}/></span>}
              <span className="f-label">{o.label}</span>
              <span className="f-count">{cnt}</span>
            </button>
          );
        })}
        {collapsible && f.options.length>cap && (
          <button className="f-showmore" onClick={()=>setShowAll(s=>({...s,[f.key]:!all}))}>
            {all ? 'Show less' : `Show all ${f.options.length}`}
          </button>
        )}
      </React.Fragment>
    );
  };

  return (
    <React.Fragment>
      <div className={'f-scrim'+(mobileOpen?' show':'')} onClick={closeMobile} />
      <aside className={'plp-filters'+(mobileOpen?' mobile-open':'')}>
        <div className="filters-head">
          <h3 className="serif">Filters{activeCount>0 && <span className="filters-n">{activeCount}</span>}</h3>
          {activeCount>0 && <button className="filters-clear" onClick={clearAll}>Clear all</button>}
          <button className="x-btn filters-x" onClick={closeMobile} aria-label="Close filters"><Icon name="x"/></button>
        </div>

        <div className="filters-scroll">
          {facets.map(f => {
            const isOpen = open[f.key];
            const sel = filters[f.key];
            const grpCount = f.type==='radio' ? (sel?1:0) : sel.length;
            return (
              <div className={'fgroup'+(isOpen?' open':'')} key={f.key}>
                <button className="fgroup-head" onClick={()=>toggleGroup(f.key)}>
                  <span className="fgroup-title">{f.label}{grpCount>0 && <span className="fgroup-n">{grpCount}</span>}</span>
                  <Icon name={isOpen?'minus':'plus'} size={17}/>
                </button>
                {isOpen && <div className={'fgroup-body'+(f.type==='color'?' is-color':'')}>{renderOptions(f)}</div>}
              </div>
            );
          })}
        </div>

        {mobileOpen && (
          <div className="filters-apply">
            <button className="btn btn-ink btn-block btn-lg" onClick={closeMobile}>Show {resultCount} {resultCount===1?'result':'results'}</button>
          </div>
        )}
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { ACTIVITIES, productActivities, ALL_COLORS, buildFacets, emptyFilters, countSelected, productMatches, FilterSidebar });
