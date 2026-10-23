/* =========================================================================
   VELA — shared components: Icon, Header, StorePicker, CartDrawer,
   ProductCard, Footer, Toast, small UI atoms.
   ========================================================================= */

// ---- Inline icon set (Lucide-style: 1.75 stroke, round caps) ----
const ICONS = {
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M21 21l-4.3-4.3',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3 5.5 5.5 0 0 0 12 6.36 5.5 5.5 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0 M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  star: 'M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z',
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-9-6 9-6',
  x: 'M18 6 6 18 M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  truck: 'M14 18V6a1 1 0 0 0-1-1H2v12 M14 9h4l3 3v3a1 1 0 0 1-1 1h-2 M2 17h2 M7.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0 M16.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
  store: 'M3 9 4 4h16l1 5 M4 9v11h16V9 M4 9h16 M9 20v-6h6v6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  pkg: 'M21 8 12 3 3 8v8l9 5 9-5Z M3 8l9 5 9-5 M12 13v8',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2',
  ruler: 'M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z M7.5 10.5l2 2 M11 7l2 2 M14.5 3.5l2 2',
  gift: 'M20 12v8H4v-8 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7 M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7',
  card: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z M2 10h20',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  arrowR: 'M5 12h14 M13 5l7 7-7 7',
  minus: 'M5 12h14',
  plus: 'M12 5v14 M5 12h14',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  repeat: 'M17 2l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6',
  globe: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z',
  filter: 'M3 5h18 M6 12h12 M10 19h4',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
  building: 'M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-3 M9 9v.01 M9 13v.01 M9 17v.01',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  trash: 'M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
  lock: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M8 11V7a4 4 0 0 1 8 0v4',
  send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
  corner: 'M9 14 4 9l5-5 M4 9h11a4 4 0 0 1 4 4v7',
  x2: 'M18 6 6 18 M6 6l12 12',
};

function Icon({ name, size, style, className, fill }) {
  const d = ICONS[name] || '';
  return (
    <svg width={size||20} height={size||20} viewBox="0 0 24 24" fill={fill||'none'}
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
         style={style} className={className} aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i===0?seg:'M'+seg)} />)}
    </svg>
  );
}

// ---- atoms ----
function Rating({ value, count, small }) {
  return (
    <div className="rating">
      <Icon name="star" size={small?12:14} fill="currentColor" />
      <span style={{fontWeight:600}}>{value.toFixed(1)}</span>
      {count != null && <span style={{color:'var(--ink-3)'}}>({count.toLocaleString()})</span>}
    </div>
  );
}

function Swatches({ colors, max }) {
  const m = max || 4;
  return (
    <div className="swatches">
      {colors.slice(0, m).map((c, i) => <span key={i} className="sw" style={{background:c.dot}} title={c.name} />)}
      {colors.length > m && <span className="sw more">+{colors.length - m}</span>}
    </div>
  );
}

function PickupBadge({ status, storeName }) {
  const cls = status.state === 'in' ? 'dot-in' : status.state === 'low' ? 'dot-low' : 'dot-out';
  return (
    <div className="pickup-line">
      <span className={'dot ' + cls} />
      <span>{status.state === 'out' ? 'Not available at' : status.label + ' at'} {storeName}</span>
    </div>
  );
}

// ---- Product card ----
function ProductCard({ product, store, onOpen, onQuickAdd, favs, toggleFav }) {
  const cw = product.colors[0];
  const status = pickupStatus(product.id, store.id);
  const isFav = favs.includes(product.id);
  return (
    <div className="pcard" onClick={() => onOpen(product.id)}>
      <div className="pcard-imgwrap">
        <Garment type={product.type} colorway={cw} bgTint="#F4F0E8" />
        {product.badge && <span className={'pcard-badge' + (product.badge==='New'?' accent':'')}>{product.badge}</span>}
        <button className={'pcard-fav' + (isFav?' on':'')} onClick={(e)=>{e.stopPropagation(); toggleFav(product.id);}} aria-label="Save">
          <Icon name="heart" size={17} fill={isFav?'currentColor':'none'} />
        </button>
        <div className="quick-add">
          <button className="btn btn-ink btn-block" onClick={(e)=>{e.stopPropagation(); onQuickAdd(product);}}>Quick add</button>
        </div>
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{product.cat}</div>
        <h3 className="pcard-name">{product.name}</h3>
        <div className="pcard-meta">
          <span className="pcard-price">{money(product.price)}</span>
          <Swatches colors={product.colors} />
        </div>
        <PickupBadge status={status} storeName={store.name.replace('VELA ','')} />
      </div>
    </div>
  );
}

// ---- B2B account bar: Business Unit + Store selectors (above header) ----
function BarSelect({ icon, options, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const current = options.find(o => o.id === value) || options[0];
  if (options.length <= 1) {
    return <span className="acct-item acct-static"><Icon name={icon} size={15} /> {current.label}</span>;
  }
  return (
    <div className="acct-item" ref={ref}>
      <button className={'acct-btn' + (open?' open':'')} onClick={() => setOpen(o => !o)}>
        <Icon name={icon} size={15} /> {current.label}
        <Icon name="chevD" size={14} className="acct-chev" />
      </button>
      {open && (
        <div className="acct-pop">
          {options.map(o => (
            <button key={o.id} className={'acct-opt' + (o.id===value?' sel':'')} onClick={() => { onChange(o.id); setOpen(false); }}>
              <span>{o.label}</span>{o.id===value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function B2BAccountBar({ units, unitId, setUnitId, storeId, setStoreId }) {
  const unit = units.find(u => u.id === unitId) || units[0];
  return (
    <div className="acctbar">
      <div className="wrap acctbar-row">
        <BarSelect icon="building" value={unit.id} onChange={setUnitId}
                   options={units.map(u => ({ id:u.id, label:u.name }))} />
        <span className="acct-div" />
        <BarSelect icon="store" value={storeId} onChange={setStoreId}
                   options={unit.stores.map(s => ({ id:s.id, label:s.name }))} />
      </div>
    </div>
  );
}

// ---- User menu: avatar + dropdown when signed in ----
function UserMenu({ user, signedIn, open, setOpen, go, onSignOut, onSignIn }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, setOpen]);
  if (!signedIn) {
    return <button className="iconbtn" onClick={onSignIn} aria-label="Sign in"><Icon name="user" /></button>;
  }
  const initials = (user.first[0] + user.last[0]).toUpperCase();
  return (
    <div className="usermenu" ref={ref}>
      <button className={'avatar-btn' + (open?' open':'')} onClick={() => setOpen(o => !o)} aria-label="Account">
        <span className="avatar">{initials}</span>
        <Icon name="chevD" size={14} className="avatar-chev" />
      </button>
      {open && (
        <div className="um-pop">
          <div className="um-id">
            <div className="um-name">{user.name}</div>
            <div className="um-email">{user.email}</div>
          </div>
          <button className="um-item" onClick={() => { setOpen(false); go('account'); }}><Icon name="user" size={17} /> Dashboard</button>
          <button className="um-item" onClick={() => { setOpen(false); onSignOut(); }}><Icon name="logout" size={17} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

// ---- Header ----
function Header({ route, go, openShop, cartCount, store, openStore, openCart, openMenu, locale, openLocale,
                  b2b, b2bUnits, b2bUnit, setB2BUnit, b2bStore, setB2BStore,
                  signedIn, setSignedIn, userMenuOpen, setUserMenuOpen, openLookup, user }) {
  const links = [['leggings','Leggings'],['bras','Sports Bras'],['tops','Tops'],['outerwear','Outerwear']];
  const [mega, setMega] = React.useState(null);
  const megaTimer = React.useRef(null);
  const openMega = (key) => { clearTimeout(megaTimer.current); setMega(key); };
  const keepMega = () => { clearTimeout(megaTimer.current); };
  const closeMega = () => { clearTimeout(megaTimer.current); megaTimer.current = setTimeout(()=>setMega(null), 130); };
  const shopThenClose = (cat) => { clearTimeout(megaTimer.current); setMega(null); openShop(cat); };
  return (
    <React.Fragment>
      {b2b
        ? <B2BAccountBar units={b2bUnits} unitId={b2bUnit} setUnitId={setB2BUnit} storeId={b2bStore} setStoreId={setB2BStore} />
        : <div className="topbar">Free shipping over $75 · <b>Free in-store pickup, ready in 2 hours</b> · 90-day returns</div>}
      <header className="hdr" onMouseLeave={closeMega}>
        <div className="wrap hdr-row">
          <button className="iconbtn menu-toggle" onClick={openMenu} aria-label="Menu"><Icon name="menu" /></button>
          <a className="brand" onClick={()=>go('home')} style={{cursor:'pointer'}}>VELA</a>
          <nav className="nav">
            {links.map(([key,label]) => (
              <a key={key}
                 className={(route===key||mega===key)?'active':''}
                 onMouseEnter={()=>openMega(key)}
                 onClick={()=>{ setMega(null); go(key); }}>{label}</a>
            ))}
          </nav>
          <div className="hdr-actions">
            {b2b
              ? <button className="lookup-btn" onClick={openLookup} aria-label="Look up product"><Icon name="zap" size={16} /> <span className="lookup-txt">Look up product</span></button>
              : <button className="store-pill" onClick={openStore} aria-label="Choose store">
                  <Icon name="pin" size={16} />
                  <span className="sp-txt"><span>Pickup at</span> {store.name.replace('VELA ','')}</span>
                </button>}
            <button className="locale-pill" onClick={openLocale} aria-label="Choose location and currency">
              <Icon name="globe" size={17} />
              <span className="lp-txt">{locale.country} ({locale.ccy}) <span className="lp-div">|</span> {locale.lang}</span>
            </button>
            <button className="iconbtn" onClick={()=>go('search')} aria-label="Search"><Icon name="search" /></button>
            <UserMenu user={user} signedIn={signedIn} open={userMenuOpen} setOpen={setUserMenuOpen}
                      go={go} onSignOut={()=>setSignedIn(false)} onSignIn={()=>setSignedIn(true)} />
            <button className="iconbtn" onClick={openCart} aria-label="Cart">
              <Icon name="bag" />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </div>
        <MegaMenu menuKey={mega} openShop={shopThenClose} onEnter={keepMega} onLeave={closeMega} />
      </header>
    </React.Fragment>
  );
}

function MobileNav({ show, close, go }) {
  const links = [['leggings','Leggings'],['bras','Sports Bras'],['tops','Tops'],['outerwear','Outerwear'],['account','My Account']];
  return (
    <div className={'mobile-nav' + (show?' show':'')}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <span className="brand">VELA</span>
        <button className="x-btn" onClick={close}><Icon name="x" /></button>
      </div>
      {links.map(([k,l]) => <a key={k} onClick={()=>{go(k); close();}}>{l}</a>)}
    </div>
  );
}

// ---- Store picker modal ----
function StorePicker({ show, close, store, setStore, product }) {
  return (
    <React.Fragment>
      <div className={'overlay' + (show?' show':'')} onClick={close} />
      <div className={'modal' + (show?' show':'')} role="dialog" aria-label="Choose pickup store">
        <div className="modal-head">
          <h3>Choose your store</h3>
          <button className="x-btn" onClick={close}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <p style={{color:'var(--ink-3)',fontSize:13.5,marginTop:0,marginBottom:18}}>
            Set your pickup location to see real-time availability across the site.
          </p>
          <div className="field" style={{marginBottom:18}}>
            <div className="input" style={{display:'flex',alignItems:'center',gap:10,color:'var(--ink-3)'}}>
              <Icon name="search" size={16} /> New York, NY 10012
            </div>
          </div>
          {STORES.map(s => {
            const st = product ? pickupStatus(product.id, s.id) : null;
            return (
              <div key={s.id} className={'store-opt' + (store.id===s.id?' sel':'')} onClick={()=>{ setStore(s); close(); }}>
                <span className="radio" />
                <div style={{flex:1}}>
                  <h4>{s.name}</h4>
                  <p>{s.addr} · {s.dist}</p>
                  <p style={{marginTop:2}}>Open today {s.hours}</p>
                  {st && (
                    <div className="badge-stock" style={{color: st.state==='in'?'var(--teal)':st.state==='low'?'var(--ct-amber-600)':'var(--ink-3)'}}>
                      <span className={'dot ' + (st.state==='in'?'dot-in':st.state==='low'?'dot-low':'dot-out')} />
                      {st.state==='out' ? 'Unavailable for this item' : st.label + ' for this item'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

// ---- Cart drawer ----
function CartDrawer({ show, close, items, updateQty, removeItem, store, go, subtotal }) {
  const freeShipAt = 75;
  const remain = Math.max(0, freeShipAt - subtotal);
  return (
    <React.Fragment>
      <div className={'overlay' + (show?' show':'')} onClick={close} />
      <aside className={'drawer' + (show?' show':'')} aria-label="Cart">
        <div className="drawer-head">
          <h3>Your bag ({items.reduce((a,i)=>a+i.qty,0)})</h3>
          <button className="x-btn" onClick={close}><Icon name="x" /></button>
        </div>
        {items.length === 0 ? (
          <div className="drawer-body" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',gap:14,color:'var(--ink-3)'}}>
            <Icon name="bag" size={40} />
            <p style={{margin:0}}>Your bag is empty.</p>
            <button className="btn btn-ink" onClick={()=>{close(); go('shop');}}>Start shopping</button>
          </div>
        ) : (
          <React.Fragment>
            <div className="drawer-body">
              {remain > 0 ? (
                <div style={{background:'var(--canvas-2)',borderRadius:'var(--ct-radius-md)',padding:'12px 14px',fontSize:12.5,margin:'10px 0 4px'}}>
                  Add <b>{money(remain)}</b> for free shipping
                  <div style={{height:5,borderRadius:99,background:'var(--line-2)',marginTop:8,overflow:'hidden'}}>
                    <div style={{height:'100%',width:Math.min(100,(subtotal/freeShipAt)*100)+'%',background:'var(--teal)'}} />
                  </div>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--teal)',fontSize:13,fontWeight:600,margin:'10px 0 4px'}}>
                  <Icon name="check" size={16} /> You've unlocked free shipping
                </div>
              )}
              {items.map(it => (
                <div className="cart-line" key={it.key}>
                  <div className="ci-img"><Garment type={it.type} colorway={it.color} bgTint="#F4F0E8" /></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                      <h4>{it.name}</h4>
                      <span style={{fontWeight:600,fontSize:14}}>{money(it.price*it.qty)}</span>
                    </div>
                    <div className="ci-meta">{it.color.name} · {it.size}</div>
                    <div className="ci-meta" style={{display:'flex',alignItems:'center',gap:6,marginTop:3,color: it.fulfillment==='pickup'?'var(--teal)':'var(--ink-3)'}}>
                      <Icon name={it.fulfillment==='pickup'?'store':'truck'} size={13} />
                      {it.fulfillment==='pickup' ? 'Pickup · '+store.name.replace('VELA ','') : 'Ship to me'}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                      <div className="stepper">
                        <button onClick={()=>updateQty(it.key,-1)}><Icon name="minus" size={14}/></button>
                        <span>{it.qty}</span>
                        <button onClick={()=>updateQty(it.key,1)}><Icon name="plus" size={14}/></button>
                      </div>
                      <button className="link-underline" style={{fontSize:12.5,color:'var(--ink-3)',background:'none',border:0}} onClick={()=>removeItem(it.key)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-foot">
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:14,fontWeight:600}}>
                <span>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <button className="btn btn-ink btn-block btn-lg" onClick={()=>{close(); go('cart');}}>View bag</button>
              <button className="btn btn-ghost btn-block" style={{marginTop:10}} onClick={()=>{close(); go('checkout');}}>Checkout</button>
            </div>
          </React.Fragment>
        )}
      </aside>
    </React.Fragment>
  );
}

// ---- Footer ----
function Footer({ go }) {
  const cols = [
    ['Shop', ['New arrivals','Leggings','Sports bras','Tops','Outerwear','Accessories']],
    ['Pickup', ['Find a store','Buy online, pick up','Same-day pickup','Order status']],
    ['Help', ['Shipping & returns','Size guide','Track order','Contact us']],
    ['Company', ['Our story','Sustainability','Careers','Store locator']],
  ];
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <div>
            <div className="fbrand">VELA</div>
            <p className="ftag">Engineered movement. Activewear built to be lived in — from the studio floor to the walk home.</p>
            <div className="newsletter">
              <input placeholder="Email for early access" />
              <button className="btn btn-accent" style={{padding:'11px 18px'}}>Join</button>
            </div>
          </div>
          {cols.map(([h, links]) => (
            <div key={h}>
              <h4>{h}</h4>
              {links.map(l => <a key={l} onClick={()=>go('shop')}>{l}</a>)}
            </div>
          ))}
        </div>
        <div className="footer-bot">
          <span>© 2026 VELA Movement. A composable commerce demo on commercetools.</span>
          <span style={{display:'flex',gap:18}}>
            <a onClick={()=>go('shop')}>Privacy</a><a onClick={()=>go('shop')}>Terms</a><a onClick={()=>go('shop')}>Accessibility</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function Toast({ msg, show }) {
  return <div className={'toast' + (show?' show':'')}><Icon name="check" size={18} />{msg}</div>;
}

Object.assign(window, { Icon, Rating, Swatches, PickupBadge, ProductCard, Header, MobileNav, StorePicker, CartDrawer, Footer, Toast, BarSelect, B2BAccountBar, UserMenu });
