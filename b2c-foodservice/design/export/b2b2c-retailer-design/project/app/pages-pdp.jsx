/* =========================================================================
   VELA — Product Detail Page (PDP) with BOPIS pickup availability,
   gallery, color/size selectors, fulfillment, accordions, related.
   ========================================================================= */

function SizeGuide({ show, close }) {
  const rows = [['XS','0–2','31–33"','24–25"'],['S','4–6','33–35"','26–27"'],['M','8–10','35–37"','28–29"'],['L','12–14','37–40"','30–32"'],['XL','16–18','40–43"','33–35"'],['XXL','20–22','43–46"','36–38"']];
  return (
    <React.Fragment>
      <div className={'overlay'+(show?' show':'')} onClick={close} />
      <div className={'modal'+(show?' show':'')} role="dialog">
        <div className="modal-head"><h3>Size guide</h3><button className="x-btn" onClick={close}><Icon name="x"/></button></div>
        <div className="modal-body">
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
            <thead><tr style={{textAlign:'left',color:'var(--ink-3)'}}>
              {['Size','US','Bust','Waist'].map(h=><th key={h} style={{padding:'10px 8px',borderBottom:'1px solid var(--line-2)',fontWeight:600}}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map(r=>(
              <tr key={r[0]}>{r.map((c,i)=><td key={i} style={{padding:'11px 8px',borderBottom:'1px solid var(--line)',fontWeight:i===0?600:400}}>{c}</td>)}</tr>
            ))}</tbody>
          </table>
          <p style={{fontSize:12.5,color:'var(--ink-3)',marginTop:16,marginBottom:0}}>Between sizes? We recommend sizing down for a compressive fit, up for a relaxed fit.</p>
        </div>
      </div>
    </React.Fragment>
  );
}

function Accordion({ title, children, open: initOpen }) {
  const [open, setOpen] = React.useState(!!initOpen);
  return (
    <div style={{borderBottom:'1px solid var(--line)'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 0',background:'none',border:0,fontFamily:'var(--ct-font-display)',fontWeight:600,fontSize:15,color:'var(--ink)'}}>
        {title} <Icon name={open?'chevD':'chevR'} size={18} style={{color:'var(--ink-3)'}}/>
      </button>
      {open && <div style={{paddingBottom:20,fontSize:14,color:'var(--ink-2)',lineHeight:1.6}} className="fade-up">{children}</div>}
    </div>
  );
}

function ProductDetail({ productId, go, store, openStore, addToCart, favs, toggleFav, openProduct, showToast, b2b, b2bLists, addToList, createList }) {
  const product = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];
  const [colorIdx, setColorIdx] = React.useState(0);
  const [size, setSize] = React.useState(null);
  const [qty, setQty] = React.useState(1);
  const [fulfillment, setFulfillment] = React.useState('pickup');
  const [view, setView] = React.useState(0);
  const [sizeGuide, setSizeGuide] = React.useState(false);

  React.useEffect(()=>{ setColorIdx(0); setSize(null); setQty(1); setView(0); window.scrollTo(0,0); }, [productId]);

  const color = product.colors[colorIdx];
  const status = pickupStatus(product.id, store.id);
  const isFav = favs.includes(product.id);
  const isAccessory = product.cat === 'Accessories';
  const sizes = product.sizes;
  const galleryTypes = [product.type, product.type, product.type];

  const sizeAvailForPickup = (sz) => fulfillment !== 'pickup' || sizeInStock(product.id, color.name, sz, store.id);
  const canAdd = (isAccessory || size) && (fulfillment !== 'pickup' || status.state !== 'out');

  function doAdd() {
    if (!canAdd) return;
    addToCart(product, { color, size: isAccessory ? 'One size' : size, qty, fulfillment });
    showToast('Added to bag');
  }

  const related = PRODUCTS.filter(p => p.cat === product.cat && p.id !== product.id).slice(0,4);
  const relatedFill = related.length < 4 ? PRODUCTS.filter(p=>p.id!==product.id && !related.includes(p)).slice(0,4-related.length) : [];

  return (
    <main className="fade-up">
      <div className="wrap">
        <div className="crumbs">
          <a onClick={()=>go('home')}>Home</a><Icon name="chevR" size={13}/>
          <a onClick={()=>go('shop')}>{product.cat}</a><Icon name="chevR" size={13}/>
          <span>{product.name}</span>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(0,0.95fr)',gap:48,padding:'14px 0 64px'}} className="pdp-grid">
          {/* GALLERY */}
          <div style={{display:'flex',gap:16,minWidth:0}} className="pdp-gallery">
            <div style={{display:'flex',flexDirection:'column',gap:12}} className="pdp-thumbs">
              {galleryTypes.map((t,i)=>(
                <button key={i} onClick={()=>setView(i)} style={{width:72,height:88,borderRadius:'var(--ct-radius-md)',overflow:'hidden',border:'1px solid '+(view===i?'var(--ink)':'var(--line-2)'),background:'var(--canvas-2)',padding:0}}>
                  <Garment type={t} colorway={color} bgTint="#F4F0E8" />
                </button>
              ))}
            </div>
            <div style={{flex:1,borderRadius:'var(--ct-radius-xl)',overflow:'hidden',background:'var(--canvas-2)',aspectRatio:'5/6',position:'relative'}}>
              <Garment type={galleryTypes[view]} colorway={color} bgTint="#F1ECE3" />
              {product.badge && <span className={'pcard-badge'+(product.badge==='New'?' accent':'')} style={{top:18,left:18}}>{product.badge}</span>}
              {!b2b && (
                <button className="iconbtn" onClick={()=>toggleFav(product.id)} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.85)'}}>
                  <Icon name="heart" size={20} fill={isFav?'currentColor':'none'} style={{color:isFav?'var(--accent)':'var(--ink)'}}/>
                </button>
              )}
            </div>
          </div>

          {/* BUY BOX */}
          <div style={{maxWidth:480}}>
            <div className="pcard-cat" style={{marginBottom:6}}>{product.cat}</div>
            <h1 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:'-0.02em',margin:'0 0 10px',lineHeight:1.08}}>{product.name}</h1>
            <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
              <span style={{fontSize:22,fontWeight:600}}>{money(product.price)}</span>
              <Rating value={product.rating} count={product.reviews} />
            </div>
            <p style={{fontSize:15.5,color:'var(--ink-2)',lineHeight:1.55,marginBottom:24}}>{product.tagline}</p>

            {/* COLOR */}
            <div style={{marginBottom:22}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600}}>Color — <span style={{color:'var(--ink-2)',fontWeight:400}}>{color.name}</span></span>
              </div>
              <div className="opt-row">
                {product.colors.map((c,i)=>(
                  <button key={i} className={'color-btn'+(colorIdx===i?' sel':'')} style={{background:c.dot}} onClick={()=>setColorIdx(i)} aria-label={c.name} title={c.name}/>
                ))}
              </div>
            </div>

            {/* SIZE */}
            {!isAccessory && (
              <div style={{marginBottom:22}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:600}}>Size{size?<span style={{color:'var(--ink-2)',fontWeight:400}}> — {size}</span>:''}</span>
                  <button className="link-underline" style={{fontSize:13,background:'none',border:0,display:'flex',alignItems:'center',gap:5,color:'var(--ink-2)'}} onClick={()=>setSizeGuide(true)}><Icon name="ruler" size={14}/> Size guide</button>
                </div>
                <div className="opt-row">
                  {sizes.map(sz=>{
                    const avail = sizeAvailForPickup(sz);
                    return <button key={sz} className={'size-btn'+(size===sz?' sel':'')} disabled={!avail} onClick={()=>setSize(sz)} title={!avail?'Not available for pickup at this store':''}>{sz}</button>;
                  })}
                </div>
                {fulfillment==='pickup' && <p style={{fontSize:12,color:'var(--ink-3)',margin:'9px 0 0'}}>Greyed sizes aren't in stock for pickup at {store.name.replace('VELA ','')}.</p>}
              </div>
            )}

            {/* FULFILLMENT */}
            <div style={{marginBottom:20}}>
              <span style={{fontSize:13,fontWeight:600,display:'block',marginBottom:10}}>How would you like it?</span>
              <div className="fulfill">
                <div className={'fulfill-opt'+(fulfillment==='pickup'?' sel':'')} onClick={()=>setFulfillment('pickup')}>
                  <div className="ftop"><Icon name="store"/> Pickup</div>
                  <p>Free · ready in 2 hours</p>
                </div>
                <div className={'fulfill-opt'+(fulfillment==='ship'?' sel':'')} onClick={()=>setFulfillment('ship')}>
                  <div className="ftop"><Icon name="truck"/> Ship</div>
                  <p>Free over $75 · 2–4 days</p>
                </div>
              </div>

              {/* pickup availability block */}
              {fulfillment==='pickup' && (
                <div style={{marginTop:12,border:'1px solid var(--line-2)',borderRadius:'var(--ct-radius-lg)',padding:'14px 16px',background:'var(--surface)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                    <div style={{display:'flex',gap:10}}>
                      <span className={'dot '+(status.state==='in'?'dot-in':status.state==='low'?'dot-low':'dot-out')} style={{marginTop:6,width:9,height:9}}/>
                      <div>
                        <div style={{fontWeight:600,fontSize:14,color: status.state==='out'?'var(--ink-2)':'var(--ink)'}}>
                          {status.state==='out' ? 'Unavailable' : status.label} at {store.name.replace('VELA ','')}
                        </div>
                        <div style={{fontSize:12.5,color:'var(--ink-3)',marginTop:2}}>{store.addr} · {store.dist}</div>
                        {status.state!=='out' && <div style={{fontSize:12.5,color:'var(--teal)',fontWeight:600,marginTop:4,display:'flex',alignItems:'center',gap:5}}><Icon name="clock" size={13}/> Ready today, in about 2 hours</div>}
                      </div>
                    </div>
                    <button className="link-underline" style={{fontSize:13,background:'none',border:0,whiteSpace:'nowrap',color:'var(--accent)'}} onClick={openStore}>Change</button>
                  </div>
                </div>
              )}
              {fulfillment==='ship' && (
                <div style={{marginTop:12,fontSize:13,color:'var(--ink-2)',display:'flex',alignItems:'center',gap:8}}>
                  <Icon name="truck" size={16} style={{color:'var(--accent)'}}/> Order in the next 6 hrs for delivery by <b style={{color:'var(--ink)',marginLeft:3}}>{['Thu','Fri','Sat'][hashStr(product.id)%3]}</b>.
                </div>
              )}
            </div>

            {/* ADD */}
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:14}}>
              <div className="stepper">
                <button onClick={()=>setQty(q=>Math.max(1,q-1))}><Icon name="minus" size={16}/></button>
                <span>{qty}</span>
                <button onClick={()=>setQty(q=>q+1)}><Icon name="plus" size={16}/></button>
              </div>
              <button className="btn btn-ink btn-lg" style={{flex:1}} disabled={!canAdd} onClick={doAdd}>
                {!isAccessory && !size ? 'Select a size'
                  : fulfillment==='pickup' && status.state==='out' ? 'Unavailable for pickup'
                  : fulfillment==='pickup' ? 'Reserve for pickup' : 'Add to bag'} {canAdd && <span style={{opacity:0.7}}>· {money(product.price*qty)}</span>}
              </button>
            </div>
            {/* ADD TO PURCHASE LIST (B2B) */}
            {b2b && (
              <AddToListMenu product={product} color={color} qty={qty} lists={b2bLists} addToList={addToList} createList={createList} showToast={showToast} />
            )}
            <div style={{display:'flex',gap:18,fontSize:12.5,color:'var(--ink-3)',marginBottom:26,flexWrap:'wrap'}}>
              <span style={{display:'flex',alignItems:'center',gap:6}}><Icon name="repeat" size={14}/> 90-day returns</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><Icon name="shield" size={14}/> Quality guarantee</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><Icon name="leaf" size={14}/> Responsibly made</span>
            </div>

            {/* DETAILS */}
            <div>
              <Accordion title="Details & fit" open>
                <p style={{marginTop:0}}>{product.fabric}</p>
                <ul style={{margin:'10px 0 0',paddingLeft:18}}>
                  {product.details.map(d=><li key={d} style={{marginBottom:5}}>{d}</li>)}
                </ul>
              </Accordion>
              <Accordion title="Fabric & care">Machine wash cold with like colors. Tumble dry low. Do not iron decoration. Designed and tested for {product.cat.toLowerCase()} performance.</Accordion>
              <Accordion title="Shipping & pickup">Free standard shipping on orders over $75. Free in-store pickup, typically ready within 2 hours during open hours. 90-day returns in store or by mail.</Accordion>
            </div>
          </div>
        </div>

        {/* RELATED */}
        <section style={{paddingBottom:72}}>
          <div className="section-head"><h2 className="serif" style={{fontSize:28}}>You may also like</h2></div>
          <div className="grid-4">
            {[...related, ...relatedFill].map(p => <ProductCard key={p.id} product={p} store={store} onOpen={openProduct} onQuickAdd={(pr)=>{addToCart(pr); showToast('Added to bag');}} favs={favs} toggleFav={toggleFav} />)}
          </div>
        </section>
      </div>
      <SizeGuide show={sizeGuide} close={()=>setSizeGuide(false)} />
    </main>
  );
}

// ---- Add to purchase list (B2B PDP) ----
function AddToListMenu({ product, color, qty, lists, addToList, createList, showToast }) {
  const [open, setOpen] = React.useState(false);
  const [pack, setPack] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCreating(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const item = () => ({ productId: product.id, color: color.name, pack, qty });
  const onAdd = (l) => { addToList(l.id, item()); showToast('Added to ' + l.name); setOpen(false); };
  const onCreate = () => { if (!name.trim()) return; createList(name.trim(), item()); showToast('Created “' + name.trim() + '”'); setName(''); setCreating(false); setOpen(false); };
  return (
    <div className="atl" ref={ref}>
      <button className="btn btn-ghost btn-lg btn-block" onClick={() => setOpen(o => !o)}><Icon name="list" size={17} /> Add to purchase list</button>
      {open && (
        <div className="atl-pop">
          <div className="atl-head">Add to a purchase list</div>
          <div className="atl-packs">
            <span>Pack size</span>
            {B2B_PACKS.map(p => <button key={p.code} className={'chip' + (pack === p.size ? ' active' : '')} onClick={() => setPack(p.size)}>{p.size}</button>)}
          </div>
          <div className="atl-lists">
            {lists.length === 0 && <div className="atl-empty">No lists yet — create one below.</div>}
            {lists.map(l => (
              <button key={l.id} className="atl-list" onClick={() => onAdd(l)}>
                <span className="atl-list-name"><Icon name="list" size={15} /> {l.name}</span>
                <span className="atl-list-meta">{l.items.length} item{l.items.length === 1 ? '' : 's'} <Icon name="plus" size={15} /></span>
              </button>
            ))}
          </div>
          {creating ? (
            <div className="atl-create">
              <input className="input" autoFocus placeholder="New list name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onCreate(); }} />
              <button className="btn btn-ink" onClick={onCreate}>Create</button>
            </div>
          ) : (
            <button className="atl-newbtn" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Create new list</button>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProductDetail, AddToListMenu });
