/* =========================================================================
   VELA — shop pages: Home, ProductListing (PLP), ProductDetail (PDP)
   ========================================================================= */

// ---------------- HOME ----------------
function HomePage({ go, store, openStore, addToCart, favs, toggleFav, openProduct }) {
  const featured = PRODUCTS.filter(p => p.badge === 'Bestseller').slice(0, 4);
  const fresh = PRODUCTS.filter(p => p.badge === 'New');
  const heroCw = CW.violet;
  return (
    <main className="fade-up">
      {/* HERO */}
      <section className="hero" style={{background:'linear-gradient(180deg,#FBF9F5 0%,#F4F0E8 100%)'}}>
        <div className="wrap" style={{display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(0,0.95fr)',alignItems:'center',gap:40,padding:'40px 32px 24px',minHeight:520}}>
          <div>
            <div className="eyebrow" style={{color:'var(--accent)',marginBottom:18}}>The Movement Edit · Spring '26</div>
            <h1 className="serif" style={{fontSize:'clamp(44px,5.6vw,82px)',lineHeight:0.98,letterSpacing:'-0.03em',margin:'0 0 22px',fontWeight:800}}>
              Built to<br/>move with you.
            </h1>
            <p style={{fontSize:18,color:'var(--ink-2)',maxWidth:440,margin:'0 0 30px',lineHeight:1.5}}>
              Featherweight tights, cult hoodies, and run-ready layers. Order online, pick up in two hours.
            </p>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              <button className="btn btn-ink btn-lg" onClick={()=>go('shop')}>Shop the edit <Icon name="arrowR" size={16}/></button>
              <button className="btn btn-ghost btn-lg" onClick={openStore}><Icon name="pin" size={16}/> Find your store</button>
            </div>
            <div style={{display:'flex',gap:28,marginTop:38,flexWrap:'wrap'}}>
              {[['truck','Free shipping over $75'],['store','Pickup in 2 hours'],['repeat','90-day returns']].map(([ic,t])=>(
                <div key={t} style={{display:'flex',alignItems:'center',gap:9,fontSize:13,color:'var(--ink-2)',fontWeight:500}}>
                  <Icon name={ic} size={17} style={{color:'var(--accent)'}} />{t}
                </div>
              ))}
            </div>
          </div>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute',inset:'-8% -4%',background:'radial-gradient(closest-side, rgba(99,89,255,0.20), transparent 70%)',filter:'blur(8px)'}} />
            <div style={{position:'relative',borderRadius:'var(--ct-radius-2xl)',overflow:'hidden',background:'linear-gradient(160deg,#EDE9FF,#F4F0E8)',aspectRatio:'4/4.4',boxShadow:'var(--ct-shadow-lg)'}}>
              <Garment type="hoodie" colorway={CW.violet} bgTint="rgba(0,0,0,0)" />
            </div>
            <div style={{position:'absolute',bottom:18,left:18,right:18,background:'rgba(255,255,255,0.86)',backdropFilter:'blur(16px)',borderRadius:'var(--ct-radius-lg)',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-3)'}}>Cult favourite</div>
                <div className="serif" style={{fontWeight:600,fontSize:15}}>Haven Scuba Hoodie</div>
              </div>
              <button className="btn btn-ink" style={{padding:'10px 18px'}} onClick={()=>openProduct('haven-hoodie')}>{money(138)}</button>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY TILES */}
      <section className="wrap section-tight">
        <div className="grid-4">
          {[['Leggings','leggings',CW.ink,'leggings'],['Sports Bras','bra',CW.clay,'bras'],['Hoodies & Jackets','hoodie',CW.slate,'outerwear'],['Joggers','joggers',CW.forest,'shop']].map(([label,type,cw,route])=>(
            <div key={label} onClick={()=>go(route)} style={{cursor:'pointer',borderRadius:'var(--ct-radius-lg)',overflow:'hidden',position:'relative',background:'var(--canvas-2)',aspectRatio:'4/5'}}>
              <Garment type={type} colorway={cw} bgTint="#EFEAE1" />
              <div style={{position:'absolute',left:0,right:0,bottom:0,padding:'40px 18px 16px',background:'linear-gradient(180deg,transparent,rgba(25,23,65,0.55))'}}>
                <div className="serif" style={{color:'#fff',fontWeight:600,fontSize:17,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  {label} <Icon name="arrowR" size={16} style={{color:'#fff'}}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BOPIS BANNER */}
      <section className="wrap" style={{paddingBottom:8}}>
        <div style={{background:'var(--ink)',borderRadius:'var(--ct-radius-2xl)',padding:'44px 48px',display:'grid',gridTemplateColumns:'minmax(0,1.3fr) minmax(0,1fr)',gap:32,alignItems:'center',color:'#fff',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:'-6%',top:'-30%',width:380,height:380,background:'var(--ct-glow-violet)',opacity:0.5}} />
          <div style={{position:'relative'}}>
            <div className="eyebrow" style={{color:'#8F8FFF',marginBottom:14}}>Buy online, pick up in store</div>
            <h2 className="serif" style={{fontSize:34,fontWeight:700,margin:'0 0 12px',letterSpacing:'-0.02em',lineHeight:1.1}}>Ready in 2 hours at {store.name.replace('VELA ','')}.</h2>
            <p style={{color:'#C2C2FF',maxWidth:420,margin:'0 0 22px',fontSize:15}}>See live availability as you browse, reserve your size, and skip the line. Free, always.</p>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              <button className="btn btn-accent" onClick={openStore}><Icon name="pin" size={16}/> Change store</button>
              <button className="btn btn-ghost" style={{color:'#fff',borderColor:'rgba(255,255,255,0.3)'}} onClick={()=>go('shop')}>Shop pickup-eligible</button>
            </div>
          </div>
          <div style={{position:'relative',display:'flex',gap:12,justifyContent:'flex-end'}}>
            {[['clock','2-hour'],['shield','Reserved'],['leaf','No fees']].map(([ic,t],i)=>(
              <div key={t} style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.14)',borderRadius:'var(--ct-radius-lg)',padding:'18px 14px',textAlign:'center',flex:1}}>
                <Icon name={ic} size={22} style={{color:'var(--teal)',margin:'0 auto 8px'}} />
                <div style={{fontSize:12.5,fontWeight:600}}>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BESTSELLERS */}
      <section className="wrap section">
        <div className="section-head">
          <div>
            <div className="eyebrow" style={{marginBottom:8}}>Most-loved</div>
            <h2 className="serif">Bestsellers</h2>
          </div>
          <button className="link-underline serif" style={{fontWeight:600,background:'none',border:0,fontSize:14}} onClick={()=>go('shop')}>View all</button>
        </div>
        <div className="grid-4">
          {featured.map(p => <ProductCard key={p.id} product={p} store={store} onOpen={openProduct} onQuickAdd={addToCart} favs={favs} toggleFav={toggleFav} />)}
        </div>
      </section>

      {/* EDITORIAL STRIP */}
      <section style={{background:'var(--canvas-2)'}}>
        <div className="wrap" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:40,alignItems:'center',padding:'64px 32px'}}>
          <div style={{borderRadius:'var(--ct-radius-2xl)',overflow:'hidden',aspectRatio:'5/4',background:'linear-gradient(150deg,#E4F7F5,#F4F0E8)'}}>
            <Garment type="bra" colorway={CW.teal} bgTint="rgba(0,0,0,0)" />
          </div>
          <div>
            <div className="eyebrow" style={{color:'var(--teal)',marginBottom:14}}>The Nulu™ promise</div>
            <h2 className="serif" style={{fontSize:36,fontWeight:700,letterSpacing:'-0.02em',margin:'0 0 16px',lineHeight:1.08}}>Weightless fabric.<br/>Serious support.</h2>
            <p style={{fontSize:16,color:'var(--ink-2)',maxWidth:440,marginBottom:24}}>Engineered knits that move the way you do — buttery against the skin, locked-in where it counts, and built to outlast the season.</p>
            <button className="btn btn-ink" onClick={()=>go('shop')}>Explore the fabric</button>
          </div>
        </div>
      </section>

      {/* NEW ARRIVALS */}
      {fresh.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{marginBottom:8,color:'var(--accent)'}}>Just landed</div>
              <h2 className="serif">New arrivals</h2>
            </div>
            <button className="link-underline serif" style={{fontWeight:600,background:'none',border:0,fontSize:14}} onClick={()=>go('shop')}>View all</button>
          </div>
          <div className="grid-4">
            {fresh.map(p => <ProductCard key={p.id} product={p} store={store} onOpen={openProduct} onQuickAdd={addToCart} favs={favs} toggleFav={toggleFav} />)}
          </div>
        </section>
      )}
    </main>
  );
}

// ---------------- PRODUCT LISTING ----------------
function ListingPage({ go, store, addToCart, favs, toggleFav, openProduct, filterCat, title, query, b2b, b2bVolume }) {
  const [sort, setSort] = React.useState('featured');
  const [onlyPickup, setOnlyPickup] = React.useState(false);
  const [filters, setFilters] = React.useState(() => { const f = emptyFilters(); if (filterCat) f.cat = [filterCat]; return f; });
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(()=>{ const f = emptyFilters(); if (filterCat) f.cat = [filterCat]; setFilters(f); }, [filterCat, query]);

  const facets = buildFacets();

  const toggleMulti = (key, val) => setFilters(f => { const arr = f[key]; return {...f, [key]: arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val]}; });
  const setRadio = (key, val) => setFilters(f => ({...f, [key]: f[key]===val ? null : val}));
  const clearAll = () => setFilters(emptyFilters());

  // base = query + pickup prefilter (facets layer on top)
  let base = PRODUCTS.slice();
  if (query) { const q = query.toLowerCase(); base = base.filter(p => (p.name+p.cat+p.tagline).toLowerCase().includes(q)); }
  if (onlyPickup) base = base.filter(p => pickupStatus(p.id, store.id).state !== 'out');

  // faceted counts (each facet counted against all OTHER active facets)
  const counts = {};
  facets.forEach(f => {
    counts[f.key] = {};
    const pool = base.filter(p => productMatches(p, facets, filters, f.key));
    f.options.forEach(o => { counts[f.key][o.id] = pool.filter(o.test).length; });
  });

  let list = base.filter(p => productMatches(p, facets, filters, null));
  if (sort === 'price-asc') list.sort((a,b)=>a.price-b.price);
  else if (sort === 'price-desc') list.sort((a,b)=>b.price-a.price);
  else if (sort === 'rating') list.sort((a,b)=>b.rating-a.rating);

  const activeCount = countSelected(filters);

  // active filter chips
  const chips = [];
  facets.forEach(f => {
    if (f.type === 'radio') { if (filters[f.key]) { const o=f.options.find(x=>x.id===filters[f.key]); chips.push({key:f.key, id:o.id, label:o.label, type:'radio'}); } }
    else { filters[f.key].forEach(id => { const o=f.options.find(x=>x.id===id); if(o) chips.push({key:f.key, id, label:o.label, dot:o.dot, type:'multi'}); }); }
  });
  const removeChip = (c) => c.type==='radio' ? setRadio(c.key, c.id) : toggleMulti(c.key, c.id);

  const heading = title || (query ? `Results for "${query}"` : (filterCat || 'All activewear'));

  return (
    <main className="fade-up">
      <div className="wrap">
        <div className="crumbs"><a onClick={()=>go('home')}>Home</a><Icon name="chevR" size={13}/><span>{title || filterCat || (query?'Search':'Shop')}</span></div>
        <div style={{padding:'8px 0 24px'}}>
          <h1 className="serif" style={{fontSize:40,fontWeight:800,letterSpacing:'-0.025em',margin:'0 0 6px'}}>{heading}{b2b && <span className="b2b-flag"><Icon name="store" size={14}/> Trade account · prices ex. VAT</span>}</h1>
          <p style={{color:'var(--ink-3)',margin:0}}>{list.length} {list.length===1?'style':'styles'}{b2b ? ' · order by item number' : ''}</p>
        </div>

        <div className="plp-layout">
          <FilterSidebar facets={facets} filters={filters} toggleMulti={toggleMulti} setRadio={setRadio}
                         clearAll={clearAll} counts={counts} activeCount={activeCount} resultCount={list.length}
                         mobileOpen={mobileOpen} closeMobile={()=>setMobileOpen(false)} />

          <div className="plp-main">
            <div className="plp-toolbar">
              <button className="filter-toggle" onClick={()=>setMobileOpen(true)}>
                <Icon name="filter" size={16}/> Filters{activeCount>0 && <span className="filters-n">{activeCount}</span>}
              </button>
              <div style={{display:'flex',gap:12,alignItems:'center',marginLeft:'auto',flexWrap:'wrap'}}>
                <button className={'chip'+(onlyPickup?' active':'')} onClick={()=>setOnlyPickup(v=>!v)} style={{display:'flex',alignItems:'center',gap:7}}>
                  <Icon name="store" size={15}/> Available at {store.name.replace('VELA ','')}
                </button>
                <select className="input" style={{width:'auto',padding:'10px 14px',cursor:'pointer'}} value={sort} onChange={e=>setSort(e.target.value)}>
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="rating">Top rated</option>
                </select>
              </div>
            </div>

            {chips.length>0 && (
              <div className="fchips">
                {chips.map(c => (
                  <button key={c.key+c.id} className="fchip" onClick={()=>removeChip(c)}>
                    {c.dot && <span className="fchip-dot" style={{background:c.dot}}/>}
                    {c.label}<Icon name="x" size={13}/>
                  </button>
                ))}
                <button className="fchip-clear" onClick={clearAll}>Clear all</button>
              </div>
            )}

            {list.length === 0 ? (
              <div style={{textAlign:'center',padding:'80px 0',color:'var(--ink-3)'}}>
                <Icon name="search" size={36} style={{margin:'0 auto 14px'}}/>
                <p style={{marginBottom:16}}>No styles match these filters.</p>
                <button className="btn btn-ghost" onClick={clearAll}>Clear all filters</button>
              </div>
            ) : b2b ? (
              <B2BList products={list} applyVolume={b2bVolume} addToCart={addToCart} openProduct={openProduct} />
            ) : (
              <div className="plp-grid" style={{paddingBottom:72}}>
                {list.map(p => <ProductCard key={p.id} product={p} store={store} onOpen={openProduct} onQuickAdd={addToCart} favs={favs} toggleFav={toggleFav} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { HomePage, ListingPage });
