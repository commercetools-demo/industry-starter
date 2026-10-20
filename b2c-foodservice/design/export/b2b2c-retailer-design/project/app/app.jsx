/* =========================================================================
   VELA — App: routing, cart/store/favs state, localStorage, mounts.
   ========================================================================= */
const { useState, useEffect, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "b2b": false,
  "b2bVolume": true,
  "b2bRole": "buyer"
}/*EDITMODE-END*/;

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e){ return fallback; }
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

// Colorways aren't JSON-stable references, so cart items store the color object inline (fine — small).
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const b2b = tweaks.b2b;
  const [route, setRoute] = useState(() => loadLS('vela_route', { page:'home', productId:null }));
  const [storeId, setStoreId] = useState(() => loadLS('vela_store', 'soho'));
  const [items, setItems] = useState(() => loadLS('vela_cart', []));
  const [favs, setFavs] = useState(() => loadLS('vela_favs', []));
  const [order, setOrder] = useState(() => loadLS('vela_lastorder', null));
  const [orders, setOrders] = useState(() => loadLS('vela_orders', []));
  const [query, setQuery] = useState('');

  const [locale, setLocale] = useState(() => {
    const l = loadLS('vela_locale', { region:'Europe', country:'Germany', ccy:'EUR', lang:'DE', langName:'Deutsch' });
    setCurrency(l.ccy);
    return l;
  });

  const [storeOpen, setStoreOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState({ msg:'', show:false });
  const [storePickerProduct, setStorePickerProduct] = useState(null);

  // B2B account context + chrome
  const [signedIn, setSignedIn] = useState(USER.signedIn);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [b2bUnitId, setB2BUnitId] = useState(() => loadLS('vela_bu', B2B_ACCOUNT[0].id));
  const [b2bStoreId, setB2BStoreId] = useState(() => loadLS('vela_bstore', B2B_ACCOUNT[0].stores[0].id));
  const [b2bLists, setB2BLists] = useState(() => loadLS('vela_b2blists', B2B_LISTS));
  const [b2bQuotes, setB2BQuotes] = useState(() => loadLS('vela_b2bquotes', B2B_QUOTES));
  const [focusQuote, setFocusQuote] = useState(null);
  useEffect(()=>saveLS('vela_bu', b2bUnitId), [b2bUnitId]);
  useEffect(()=>saveLS('vela_bstore', b2bStoreId), [b2bStoreId]);
  useEffect(()=>saveLS('vela_b2blists', b2bLists), [b2bLists]);
  useEffect(()=>saveLS('vela_b2bquotes', b2bQuotes), [b2bQuotes]);
  const changeUnit = useCallback((id)=>{ const u = B2B_ACCOUNT.find(x=>x.id===id) || B2B_ACCOUNT[0]; setB2BUnitId(id); setB2BStoreId(u.stores[0].id); }, []);

  // Purchase-list mutators shared by the PDP and the dashboard.
  const addToB2BList = useCallback((listId, item)=>{
    setB2BLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const ex = l.items.find(it => it.productId===item.productId && it.color===item.color && it.pack===item.pack);
      if (ex) return {...l, items: l.items.map(it => it===ex ? {...it, qty: it.qty + item.qty} : it)};
      return {...l, items: [...l.items, item]};
    }));
  }, []);
  const createB2BList = useCallback((name, item)=>{
    const id = 'list-' + Date.now();
    setB2BLists(prev => [...prev, { id, name, owner: USER.name, sharedWith: [], items: item ? [item] : [] }]);
    return id;
  }, []);

  // Turn the current cart into a quote request, then deep-link to it in the dashboard.
  const createQuote = useCallback(()=>{
    if (items.length === 0) return;
    const num = 'QR-' + (2070 + Math.floor(Math.random()*90));
    const today = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const qItems = items.map(i=>({ type:i.type, color:i.color, name:i.name, qty:i.qty, listPrice:i.price }));
    const total = items.reduce((a,i)=>a+i.price*i.qty,0);
    const summary = qItems.map(it=>`${it.qty}\u00d7 ${it.name}`).join(', ');
    const quote = {
      number:num, buyer:USER.name, date:today, status:'Requested', requested:total, current:total, items:qItems,
      thread:[{ id:'m'+Date.now(), who:'buyer', author:USER.name, time:'Just now',
        text:`Requesting a quote for: ${summary}. Can you share volume pricing for this basket?`, price:null, replies:[] }],
    };
    setB2BQuotes(prev=>[quote, ...prev]);
    setItems([]);
    setFocusQuote(num);
    setRoute({page:'account'});
    window.scrollTo(0,0);
    showToast('Quote '+num+' requested');
  }, [items, showToast]);

  const store = STORES.find(s=>s.id===storeId) || STORES[0];

  useEffect(()=>saveLS('vela_route', route), [route]);
  useEffect(()=>saveLS('vela_store', storeId), [storeId]);
  useEffect(()=>saveLS('vela_cart', items), [items]);
  useEffect(()=>saveLS('vela_favs', favs), [favs]);
  useEffect(()=>saveLS('vela_lastorder', order), [order]);
  useEffect(()=>saveLS('vela_orders', orders), [orders]);
  useEffect(()=>{ setCurrency(locale.ccy); saveLS('vela_locale', locale); }, [locale]);

  const toastTimer = React.useRef(null);
  const showToast = useCallback((msg)=>{
    setToast({ msg, show:true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToast(t=>({...t,show:false})), 2200);
  }, []);

  const go = useCallback((page, productId=null)=>{
    setMenuOpen(false);
    setFocusQuote(null);
    if (page==='leggings') { setRoute({page:'shop', filterCat:'Leggings'}); }
    else if (page==='bras') { setRoute({page:'shop', filterCat:'Sports Bras'}); }
    else if (page==='tops') { setRoute({page:'shop', filterCat:'Tops'}); }
    else if (page==='outerwear') { setRoute({page:'shop', filterCat:'Hoodies & Jackets'}); }
    else if (page==='search') { setRoute({page:'search'}); }
    else { setRoute({ page, productId }); }
    window.scrollTo(0,0);
  }, []);

  const openProduct = useCallback((productId)=>{ setRoute({page:'pdp', productId}); window.scrollTo(0,0); }, []);
  const openShop = useCallback((filterCat)=>{ setMenuOpen(false); setRoute(filterCat?{page:'shop', filterCat}:{page:'shop'}); window.scrollTo(0,0); }, []);

  const cartCount = items.reduce((a,i)=>a+i.qty,0);
  const subtotal = items.reduce((a,i)=>a+i.price*i.qty,0);

  const addToCart = useCallback((product, opts)=>{
    const o = opts || {};
    const color = o.color || product.colors[0];
    const size = o.size || (product.cat==='Accessories' ? 'One size' : 'M');
    const fulfillment = o.fulfillment || 'pickup';
    const qty = o.qty || 1;
    const price = o.price != null ? o.price : product.price;
    const key = `${product.id}|${color.name}|${size}|${fulfillment}`;
    setItems(prev=>{
      const ex = prev.find(i=>i.key===key);
      if (ex) return prev.map(i=>i.key===key?{...i,qty:i.qty+qty}:i);
      return [...prev, { key, id:product.id, name:product.name, type:product.type, price, color, size, qty, fulfillment }];
    });
    if (!opts || o.toast) showToast('Added to bag');
  }, [showToast]);

  const updateQty = useCallback((key, delta)=>{
    setItems(prev=>prev.map(i=>i.key===key?{...i,qty:Math.max(1,i.qty+delta)}:i));
  }, []);
  const removeItem = useCallback((key)=>setItems(prev=>prev.filter(i=>i.key!==key)), []);
  const setItemFulfillment = useCallback((key, f)=>{
    setItems(prev=>{
      const it = prev.find(i=>i.key===key); if(!it || it.fulfillment===f) return prev;
      const newKey = `${it.id}|${it.color.name}|${it.size}|${f}`;
      const dup = prev.find(i=>i.key===newKey);
      if (dup) {
        // merge into existing line with that fulfillment, drop the old one
        return prev.filter(i=>i.key!==key).map(i=>i.key===newKey?{...i,qty:i.qty+it.qty}:i);
      }
      return prev.map(i=>i.key===key?{...i,key:newKey,fulfillment:f}:i);
    });
  }, []);

  const toggleFav = useCallback((id)=>{
    setFavs(prev=> prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }, []);

  const setStore = useCallback((s)=>{ setStoreId(s.id); }, []);

  const openStoreFor = useCallback((product)=>{ setStorePickerProduct(product||null); setStoreOpen(true); }, []);

  const placeOrder = useCallback(({form, total})=>{
    const num = 'VELA-' + (48300 + Math.floor(Math.random()*900));
    const newOrder = {
      number: num, email: form.email, date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      total, fulfillment: items.some(i=>i.fulfillment==='pickup')?'pickup':'ship',
      status: items.some(i=>i.fulfillment==='pickup')?'Preparing':'Processing',
      items: items.map(i=>({...i})),
    };
    setOrder(newOrder);
    setOrders(prev=>[{...newOrder, items: newOrder.items.map(i=>({type:i.type,color:i.color}))}, ...prev]);
    setItems([]);
    setRoute({page:'confirmation'});
    window.scrollTo(0,0);
  }, [items]);

  // page render
  let page;
  const p = route.page;
  if (p==='home') page = <HomePage go={go} store={store} openStore={()=>openStoreFor(null)} addToCart={addToCart} favs={favs} toggleFav={toggleFav} openProduct={openProduct} />;
  else if (p==='shop') page = <ListingPage go={go} store={store} addToCart={addToCart} favs={favs} toggleFav={toggleFav} openProduct={openProduct} filterCat={route.filterCat} b2b={b2b} b2bVolume={tweaks.b2bVolume} />;
  else if (p==='search') page = <ListingPage go={go} store={store} addToCart={addToCart} favs={favs} toggleFav={toggleFav} openProduct={openProduct} query={query} title={query?null:'Search'} b2b={b2b} b2bVolume={tweaks.b2bVolume} />;
  else if (p==='pdp') page = <ProductDetail productId={route.productId} go={go} store={store} openStore={()=>openStoreFor(PRODUCTS.find(x=>x.id===route.productId))} addToCart={addToCart} favs={favs} toggleFav={toggleFav} openProduct={openProduct} showToast={showToast} b2b={b2b} b2bLists={b2bLists} addToList={addToB2BList} createList={createB2BList} />;
  else if (p==='cart') page = <CartPage go={go} items={items} updateQty={updateQty} removeItem={removeItem} setItemFulfillment={setItemFulfillment} store={store} openStore={()=>openStoreFor(null)} subtotal={subtotal} />;
  else if (p==='checkout') page = <CheckoutPage go={go} items={items} store={store} openStore={()=>openStoreFor(null)} subtotal={subtotal} placeOrder={placeOrder} setItemFulfillment={setItemFulfillment} user={USER} b2b={b2b} createQuote={createQuote} />;
  else if (p==='confirmation') page = <ConfirmationPage go={go} order={order} store={store} />;
  else if (p==='account') page = <AccountPage go={go} store={store} openStore={()=>openStoreFor(null)} orders={orders} favs={favs} openProduct={openProduct} addToCart={addToCart} toggleFav={toggleFav} b2b={b2b} role={tweaks.b2bRole} unit={B2B_ACCOUNT.find(u=>u.id===b2bUnitId) || B2B_ACCOUNT[0]} b2bLists={b2bLists} setB2BLists={setB2BLists} b2bQuotes={b2bQuotes} setB2BQuotes={setB2BQuotes} focusQuote={focusQuote} />;
  else page = <HomePage go={go} store={store} openStore={()=>openStoreFor(null)} addToCart={addToCart} favs={favs} toggleFav={toggleFav} openProduct={openProduct} />;

  const showSearchBar = p==='search';

  return (
    <React.Fragment>
      <Header route={ p==='shop' ? ({'Leggings':'leggings','Sports Bras':'bras','Tops':'tops','Hoodies & Jackets':'outerwear'}[route.filterCat] || '') : ({home:'',pdp:'',search:''}[p] || p) } go={go} openShop={openShop} cartCount={cartCount} store={store}
              openStore={()=>openStoreFor(null)} openCart={()=>setCartOpen(true)} openMenu={()=>setMenuOpen(true)}
              locale={locale} openLocale={()=>setLocaleOpen(true)}
              b2b={b2b} b2bUnits={B2B_ACCOUNT} b2bUnit={b2bUnitId} setB2BUnit={changeUnit} b2bStore={b2bStoreId} setB2BStore={setB2BStoreId}
              signedIn={signedIn} setSignedIn={setSignedIn} userMenuOpen={userMenuOpen} setUserMenuOpen={setUserMenuOpen}
              openLookup={()=>setLookupOpen(true)} user={USER} />
      {showSearchBar && (
        <div className="wrap" style={{paddingTop:24}}>
          <div className="search-wrap" style={{display:'flex',alignItems:'center',gap:12,background:'var(--surface)',border:'1px solid var(--line-2)',borderRadius:'var(--ct-radius-pill)',padding:'14px 22px'}}>
            <Icon name="search" size={20} style={{color:'var(--ink-3)'}}/>
            <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search leggings, hoodies, bras..." style={{flex:1,border:0,background:'transparent',outline:'none',fontSize:16,fontFamily:'var(--ct-font-body)',color:'var(--ink)'}}/>
            {query && <button className="x-btn" onClick={()=>setQuery('')}><Icon name="x" size={18}/></button>}
          </div>
        </div>
      )}
      {page}
      <Footer go={go} />

      <MobileNav show={menuOpen} close={()=>setMenuOpen(false)} go={go} />
      <StorePicker show={storeOpen} close={()=>setStoreOpen(false)} store={store} setStore={setStore} product={storePickerProduct} />
      <LocaleChooser show={localeOpen} close={()=>setLocaleOpen(false)} locale={locale} setLocale={setLocale} />
      <CartDrawer show={cartOpen} close={()=>setCartOpen(false)} items={items} updateQty={updateQty} removeItem={removeItem} store={store} go={go} subtotal={subtotal} />
      <LookupModal show={lookupOpen} close={()=>setLookupOpen(false)} addToCart={addToCart} applyVolume={tweaks.b2bVolume} />
      <Toast msg={toast.msg} show={toast.show} />

      <TweaksPanel>
        <TweakSection label="Commerce mode" />
        <TweakToggle label="B2B" value={tweaks.b2b} onChange={(v)=>setTweak('b2b', v)} />
        {tweaks.b2b && (
          <React.Fragment>
            <TweakToggle label="Volume pricing" value={tweaks.b2bVolume} onChange={(v)=>setTweak('b2bVolume', v)} />
            <TweakRadio label="Role" value={tweaks.b2bRole} options={['buyer','approver','admin']} onChange={(v)=>setTweak('b2bRole', v)} />
          </React.Fragment>
        )}
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
