/* =========================================================================
   VELA — Cart, Checkout (with BOPIS pickup step), My Account
   ========================================================================= */

// ---------------- CART ----------------
function CartPage({ go, items, updateQty, removeItem, setItemFulfillment, store, openStore, subtotal }) {
  const shipItems = items.filter(i=>i.fulfillment==='ship');
  const pickupItems = items.filter(i=>i.fulfillment==='pickup');
  const shipping = subtotal >= 75 || subtotal===0 ? 0 : 6;
  const tax = +(subtotal * 0.08875).toFixed(2);
  const total = subtotal + shipping + tax;

  if (items.length === 0) {
    return (
      <main className="wrap fade-up" style={{textAlign:'center',padding:'100px 20px 120px'}}>
        <Icon name="bag" size={48} style={{margin:'0 auto 18px',color:'var(--ink-3)'}}/>
        <h1 className="serif" style={{fontSize:32,fontWeight:700}}>Your bag is empty</h1>
        <p style={{color:'var(--ink-3)',marginBottom:24}}>Let's find something to move in.</p>
        <button className="btn btn-ink btn-lg" onClick={()=>go('shop')}>Shop activewear</button>
      </main>
    );
  }

  function Line({ it }) {
    return (
      <div className="cart-line">
        <div className="ci-img" style={{width:96,height:116}}><Garment type={it.type} colorway={it.color} bgTint="#F4F0E8" /></div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <h4 style={{fontSize:15.5}}>{it.name}</h4>
            <span style={{fontWeight:600}}>{money(it.price*it.qty)}</span>
          </div>
          <div className="ci-meta">{it.color.name} · {it.size}</div>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button className={'chip'+(it.fulfillment==='pickup'?' active':'')} style={{fontSize:12,padding:'6px 12px',display:'flex',alignItems:'center',gap:6}} onClick={()=>setItemFulfillment(it.key,'pickup')}><Icon name="store" size={13}/> Pickup</button>
            <button className={'chip'+(it.fulfillment==='ship'?' active':'')} style={{fontSize:12,padding:'6px 12px',display:'flex',alignItems:'center',gap:6}} onClick={()=>setItemFulfillment(it.key,'ship')}><Icon name="truck" size={13}/> Ship</button>
          </div>
          {it.fulfillment==='pickup' && (
            <div style={{fontSize:12.5,color: pickupStatus(it.id,store.id).state==='out'?'var(--ct-amber-600)':'var(--teal)',marginTop:8,display:'flex',alignItems:'center',gap:6}}>
              <span className={'dot '+(pickupStatus(it.id,store.id).state==='out'?'dot-low':'dot-in')}/>
              {pickupStatus(it.id,store.id).state==='out' ? 'Not in stock at '+store.name.replace('VELA ','')+' — try ship' : 'Ready for pickup at '+store.name.replace('VELA ','')}
            </div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
            <div className="stepper">
              <button onClick={()=>updateQty(it.key,-1)}><Icon name="minus" size={14}/></button>
              <span>{it.qty}</span>
              <button onClick={()=>updateQty(it.key,1)}><Icon name="plus" size={14}/></button>
            </div>
            <button className="link-underline" style={{fontSize:13,color:'var(--ink-3)',background:'none',border:0}} onClick={()=>removeItem(it.key)}>Remove</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="wrap fade-up" style={{paddingBottom:80}}>
      <div className="crumbs"><a onClick={()=>go('home')}>Home</a><Icon name="chevR" size={13}/><span>Bag</span></div>
      <h1 className="serif" style={{fontSize:38,fontWeight:800,letterSpacing:'-0.025em',margin:'6px 0 28px'}}>Your bag</h1>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.5fr) minmax(0,0.8fr)',gap:48,alignItems:'start'}} className="cart-grid">
        <div>
          {pickupItems.length>0 && (
            <div style={{marginBottom:28}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <h3 className="serif" style={{fontSize:17,fontWeight:600,display:'flex',alignItems:'center',gap:9,margin:0}}><Icon name="store" size={18} style={{color:'var(--accent)'}}/> Pickup · {store.name.replace('VELA ','')}</h3>
                <button className="link-underline" style={{fontSize:13,background:'none',border:0,color:'var(--ink-2)'}} onClick={openStore}>Change store</button>
              </div>
              <p style={{fontSize:12.5,color:'var(--ink-3)',margin:'0 0 6px'}}>{store.addr} · ready in ~2 hours</p>
              {pickupItems.map(it=><Line key={it.key} it={it}/>)}
            </div>
          )}
          {shipItems.length>0 && (
            <div>
              <h3 className="serif" style={{fontSize:17,fontWeight:600,display:'flex',alignItems:'center',gap:9,margin:'0 0 6px'}}><Icon name="truck" size={18} style={{color:'var(--accent)'}}/> Shipping to you</h3>
              <p style={{fontSize:12.5,color:'var(--ink-3)',margin:'0 0 6px'}}>Free standard over $75 · 2–4 business days</p>
              {shipItems.map(it=><Line key={it.key} it={it}/>)}
            </div>
          )}
        </div>

        {/* SUMMARY */}
        <div className="card" style={{position:'sticky',top:96}}>
          <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:'0 0 16px'}}>Order summary</h3>
          {[['Subtotal',money(subtotal)],['Shipping',shipping===0?'Free':money(shipping)],['Estimated tax',money(tax)]].map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:14,padding:'7px 0',color:'var(--ink-2)'}}><span>{k}</span><span style={{color:'var(--ink)'}}>{v}</span></div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:17,padding:'14px 0 4px',borderTop:'1px solid var(--line)',marginTop:8}}><span>Total</span><span>{money(total)}</span></div>
          <button className="btn btn-ink btn-block btn-lg" style={{marginTop:18}} onClick={()=>go('checkout')}>Checkout</button>
          <div style={{display:'flex',alignItems:'center',gap:7,justifyContent:'center',fontSize:12,color:'var(--ink-3)',marginTop:12}}><Icon name="shield" size={14}/> Secure checkout</div>
          <div style={{marginTop:16,padding:'12px 14px',background:'var(--canvas-2)',borderRadius:'var(--ct-radius-md)',fontSize:12.5,color:'var(--ink-2)',display:'flex',gap:9}}>
            <Icon name="gift" size={16} style={{flex:'none',color:'var(--accent)'}}/> Add a gift note at checkout — free.
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------- CHECKOUT ----------------
function CheckoutPage({ go, items, store, openStore, subtotal, placeOrder, setItemFulfillment, user, b2b, createQuote }) {
  const hasPickup = items.some(i=>i.fulfillment==='pickup');
  const hasShip = items.some(i=>i.fulfillment==='ship');
  const signedIn = !!(user && user.signedIn);
  const savedAddrs = (signedIn && user.addresses) ? user.addresses : [];
  const defaultAddr = savedAddrs.find(a=>a.isDefault) || savedAddrs[0];

  const [step, setStep] = React.useState(1); // 1 details, 2 fulfillment, 3 payment
  const [pickupPerson, setPickupPerson] = React.useState('me');
  const [shipMethod, setShipMethod] = React.useState('standard');
  const [selectedAddrId, setSelectedAddrId] = React.useState(hasShip && defaultAddr ? defaultAddr.id : 'new');

  const [form, setForm] = React.useState(()=>({
    email: signedIn ? user.email : '',
    first: signedIn ? user.first : '',
    last:  signedIn ? user.last : '',
    addr: defaultAddr ? defaultAddr.line : '',
    city: defaultAddr ? defaultAddr.city : '',
    state: defaultAddr ? defaultAddr.state : '',
    zip:  defaultAddr ? defaultAddr.zip : '',
    phone: defaultAddr ? defaultAddr.phone : (signedIn ? user.phone : ''),
    card:'', exp:'', cvc:'', altname:'',
  }));
  const set = (k)=>(e)=>setForm(f=>({...f,[k]:e.target.value}));
  const pickAddress = (a)=>{
    setSelectedAddrId(a.id);
    setForm(f=>({...f, addr:a.line, city:a.city, state:a.state, zip:a.zip, phone:a.phone, first:a.name.split(' ')[0]||f.first, last:a.name.split(' ').slice(1).join(' ')||f.last}));
  };

  // ---- identity: members skip Contact; guests/anonymous fill it in ----
  const [guest, setGuest] = React.useState(false);
  const anon = !signedIn || guest;
  const becomeGuest = ()=>{ setGuest(true); setSelectedAddrId('new'); setForm(f=>({...f, email:'', first:'', last:'', addr:'', city:'', state:'', zip:'', phone:''})); };
  const becomeMember = ()=>{ setGuest(false); const a=defaultAddr; setSelectedAddrId(hasShip&&a?a.id:'new'); setForm(f=>({...f, email:user.email, first:user.first, last:user.last, addr:a?a.line:'', city:a?a.city:'', state:a?a.state:'', zip:a?a.zip:'', phone:a?a.phone:user.phone})); };

  // ---- promo codes (multiple, stackable) ----
  const [codes, setCodes] = React.useState([]);
  const [codeInput, setCodeInput] = React.useState('');
  const [codeErr, setCodeErr] = React.useState('');
  const addCode = ()=>{
    const c = codeInput.trim().toUpperCase();
    if(!c) return;
    if(!PROMOS[c]) { setCodeErr(`"${c}" isn't a valid code.`); return; }
    if(codes.includes(c)) { setCodeErr('That code is already applied.'); return; }
    setCodes(prev=>[...prev, c]); setCodeInput(''); setCodeErr('');
  };
  const removeCode = (c)=>{ setCodes(prev=>prev.filter(x=>x!==c)); setCodeErr(''); };

  // ---- totals ----
  const pctOff  = codes.filter(c=>PROMOS[c].type==='pct').reduce((a,c)=>a+PROMOS[c].value,0);
  const flatOff = codes.filter(c=>PROMOS[c].type==='flat').reduce((a,c)=>a+PROMOS[c].value,0);
  const freeShip = codes.some(c=>PROMOS[c].type==='ship');
  const discount = Math.min(subtotal, subtotal*pctOff + flatOff);
  const baseShip = hasShip ? (shipMethod==='express' ? 14 : (subtotal>=75 ? 0 : 6)) : 0;
  const shipping = freeShip ? 0 : baseShip;
  const taxed = Math.max(0, subtotal - discount);
  const tax = +(taxed*0.08875).toFixed(2);
  const total = taxed + shipping + tax;
  const codeSaving = (c)=>{ const p=PROMOS[c]; if(p.type==='pct') return money(subtotal*p.value); if(p.type==='flat') return money(p.value); return 'Free shipping'; };

  if (items.length===0) {
    return <main className="wrap fade-up" style={{textAlign:'center',padding:'100px 20px'}}>
      <h1 className="serif" style={{fontSize:30}}>Nothing to check out</h1>
      <button className="btn btn-ink btn-lg" style={{marginTop:16}} onClick={()=>go('shop')}>Shop activewear</button>
    </main>;
  }

  const steps = [[1,'Details'],[2,'Fulfillment'],[3,'Payment']];

  return (
    <main className="wrap fade-up" style={{paddingBottom:80}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'24px 0 26px',flexWrap:'wrap',gap:16}}>
        <h1 className="serif" style={{fontSize:30,fontWeight:800,letterSpacing:'-0.02em',margin:0}}>Checkout</h1>
        <div className="steps">
          {steps.map(([n,l],i)=>(
            <React.Fragment key={n}>
              <div className={'step'+(step===n?' active':step>n?' done':'')} onClick={()=>{ if(step>n) setStep(n); }} style={{cursor: step>n?'pointer':'default'}}>
                <span className="num">{step>n?<Icon name="check" size={13}/>:n}</span>{l}
              </div>
              {i<steps.length-1 && <span className="step-div"/>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.5fr) minmax(0,0.8fr)',gap:48,alignItems:'start'}} className="cart-grid">
        <div>
          {/* STEP 1 — CONTACT & SHIPPING ADDRESS */}
          {step===1 && (
            <div className="fade-up">
              {anon ? (
                <div className="card" style={{marginBottom:18}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:6}}>
                    <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:0}}>Contact</h3>
                    {signedIn && <button className="link-underline" style={{fontSize:13,background:'none',border:0,color:'var(--accent)'}} onClick={becomeMember}>Use my account</button>}
                  </div>
                  <p style={{fontSize:13,color:'var(--ink-3)',margin:'0 0 14px'}}>We'll send your receipt and order updates here.</p>
                  <div className="field"><label>Email</label><input className="input" placeholder="you@email.com" value={form.email} onChange={set('email')}/></div>
                  <div className="row-2" style={{marginBottom:0}}>
                    <div className="field" style={{marginBottom:0}}><label>First name</label><input className="input" value={form.first} onChange={set('first')}/></div>
                    <div className="field" style={{marginBottom:0}}><label>Last name</label><input className="input" value={form.last} onChange={set('last')}/></div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{marginBottom:18,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:999,background:'rgba(11,191,191,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flex:'none'}}><Icon name="check" size={20} style={{color:'var(--teal)'}}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="serif" style={{fontWeight:700,fontSize:15}}>Signed in as {user.first}</div>
                    <div style={{fontSize:13,color:'var(--ink-3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
                  </div>
                  <button className="link-underline" style={{fontSize:13,background:'none',border:0,color:'var(--ink-2)',flex:'none'}} onClick={becomeGuest}>Check out as guest</button>
                </div>
              )}

              {hasShip ? (
                <div className="card">
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <Icon name="truck" size={20} style={{color:'var(--accent)'}}/>
                    <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:0}}>Shipping address</h3>
                  </div>
                  <p style={{fontSize:13.5,color:'var(--ink-2)',margin:'0 0 16px'}}>{items.filter(i=>i.fulfillment==='ship').length} item(s) shipping to you. Choose a delivery speed next.</p>

                  {!anon && savedAddrs.length>0 && (
                    <React.Fragment>
                      {savedAddrs.map(a=>(
                        <div key={a.id} className={'store-opt'+(selectedAddrId===a.id?' sel':'')} onClick={()=>pickAddress(a)}>
                          <span className="radio"/>
                          <div style={{flex:1}}>
                            <h4 style={{display:'flex',alignItems:'center',gap:8}}>{a.label}
                              {a.isDefault && <span style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--accent)',background:'rgba(99,89,255,0.1)',padding:'2px 8px',borderRadius:999}}>Default</span>}
                            </h4>
                            <p>{a.name}</p>
                            <p>{a.line}, {a.city}, {a.state} {a.zip}</p>
                            <p style={{marginTop:2}}>{a.phone}</p>
                          </div>
                        </div>
                      ))}
                      <div className={'store-opt'+(selectedAddrId==='new'?' sel':'')} onClick={()=>setSelectedAddrId('new')}>
                        <span className="radio"/>
                        <div style={{flex:1}}>
                          <h4 style={{display:'flex',alignItems:'center',gap:8}}><Icon name="plus" size={15}/> Use a new address</h4>
                          <p>Ship to a different location</p>
                        </div>
                      </div>
                    </React.Fragment>
                  )}

                  {(anon || selectedAddrId==='new') && (
                    <div className="fade-up" style={{marginTop: (!anon && savedAddrs.length>0)?14:0}}>
                      <div className="field"><label>Street address</label><input className="input" placeholder="123 Main St, Apt 2" value={form.addr} onChange={set('addr')}/></div>
                      <div className="row-2">
                        <div className="field"><label>City</label><input className="input" value={form.city} onChange={set('city')}/></div>
                        <div className="row-2" style={{gap:14}}>
                          <div className="field"><label>State</label><input className="input" value={form.state} onChange={set('state')}/></div>
                          <div className="field"><label>ZIP</label><input className="input" value={form.zip} onChange={set('zip')}/></div>
                        </div>
                      </div>
                      <div className="field" style={{marginBottom:0}}><label>Phone</label><input className="input" placeholder="(212) 555-0000" value={form.phone} onChange={set('phone')}/></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                  <Icon name="store" size={20} style={{flex:'none',color:'var(--accent)',marginTop:2}}/>
                  <div>
                    <h3 className="serif" style={{fontSize:16,fontWeight:700,margin:'0 0 4px'}}>Pickup only — no address needed</h3>
                    <p style={{fontSize:13.5,color:'var(--ink-2)',margin:0}}>We'll email and text you when your order is ready at {store.name.replace('VELA ','')}. Set the pickup details next.</p>
                  </div>
                </div>
              )}

              <button className="btn btn-ink btn-lg btn-block" style={{marginTop:20}} onClick={()=>setStep(2)}>Continue to fulfillment</button>
            </div>
          )}

          {/* STEP 2 — FULFILLMENT (pickup + shipping method) */}
          {step===2 && (
            <div className="fade-up">
              {hasPickup && (
                <div className="card" style={{marginBottom:18}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <Icon name="store" size={20} style={{color:'var(--accent)'}}/>
                    <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:0}}>Pickup location</h3>
                  </div>
                  <p style={{fontSize:13.5,color:'var(--ink-2)',margin:'0 0 16px'}}>{items.filter(i=>i.fulfillment==='pickup').length} item(s) ready for in-store pickup.</p>
                  <div className="store-opt sel" style={{cursor:'default'}}>
                    <span className="radio"/>
                    <div style={{flex:1}}>
                      <h4>{store.name}</h4>
                      <p>{store.addr} · {store.dist}</p>
                      <p style={{marginTop:2}}>Open today {store.hours} · {store.phone}</p>
                      <div className="badge-stock" style={{color:'var(--teal)'}}><Icon name="clock" size={14}/> Ready in about 2 hours</div>
                    </div>
                    <button className="link-underline" style={{fontSize:13,background:'none',border:0,color:'var(--accent)'}} onClick={openStore}>Change</button>
                  </div>
                  <div style={{marginTop:16}}>
                    <span style={{fontSize:13,fontWeight:600,display:'block',marginBottom:10}}>Who's picking up?</span>
                    <div className="fulfill">
                      <div className={'fulfill-opt'+(pickupPerson==='me'?' sel':'')} onClick={()=>setPickupPerson('me')}>
                        <div className="ftop"><Icon name="user"/> It's me</div>
                        <p>Bring a photo ID & order number</p>
                      </div>
                      <div className={'fulfill-opt'+(pickupPerson==='other'?' sel':'')} onClick={()=>setPickupPerson('other')}>
                        <div className="ftop"><Icon name="gift"/> Someone else</div>
                        <p>Add an alternate pickup person</p>
                      </div>
                    </div>
                    {pickupPerson==='other' && (
                      <div className="field fade-up" style={{marginTop:14,marginBottom:0}}>
                        <label>Alternate pickup name</label>
                        <input className="input" placeholder="Full name" value={form.altname} onChange={set('altname')}/>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {hasShip && (
                <div className="card">
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <Icon name="truck" size={20} style={{color:'var(--accent)'}}/>
                    <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:0}}>Delivery method</h3>
                  </div>
                  <p style={{fontSize:13,color:'var(--ink-3)',margin:'0 0 14px',display:'flex',alignItems:'center',gap:7}}>
                    <Icon name="pin" size={14} style={{color:'var(--accent)'}}/> Shipping to {form.addr}{form.city?', '+form.city:''} {form.zip}
                  </p>
                  <div style={{display:'flex',gap:10}}>
                    {[['standard','Standard', (subtotal>=75?'Free':money(6))+' · 2–4 days'],['express','Express', money(14)+' · 1–2 days']].map(([id,t,d])=>(
                      <div key={id} className={'fulfill-opt'+(shipMethod===id?' sel':'')} style={{flex:1}} onClick={()=>setShipMethod(id)}>
                        <div className="ftop">{t}{freeShip && id==='standard' && <span style={{color:'var(--teal)',fontSize:11}}> · code applied</span>}</div><p>{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:'flex',gap:12,marginTop:20}}>
                <button className="btn btn-ghost" onClick={()=>setStep(1)}>Back</button>
                <button className="btn btn-ink btn-lg" style={{flex:1}} onClick={()=>setStep(3)}>Continue to payment</button>
              </div>
            </div>
          )}

          {/* STEP 3 — PAYMENT */}
          {step===3 && (
            <div className="card fade-up">
              <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:'0 0 6px'}}>Payment</h3>
              <p style={{fontSize:12.5,color:'var(--ink-3)',margin:'0 0 16px',display:'flex',alignItems:'center',gap:7}}><Icon name="shield" size={14}/> Encrypted & secure. This is a demo — no real charge.</p>
              <div className="field"><label>Card number</label>
                <div style={{position:'relative'}}>
                  <input className="input" placeholder="1234 5678 9012 3456" value={form.card} onChange={set('card')}/>
                  <Icon name="card" size={18} style={{position:'absolute',right:14,top:13,color:'var(--ink-3)'}}/>
                </div>
              </div>
              <div className="row-2">
                <div className="field"><label>Expiry</label><input className="input" placeholder="MM / YY" value={form.exp} onChange={set('exp')}/></div>
                <div className="field"><label>CVC</label><input className="input" placeholder="123" value={form.cvc} onChange={set('cvc')}/></div>
              </div>
              <div style={{display:'flex',gap:12,marginTop:8}}>
                <button className="btn btn-ghost" onClick={()=>setStep(2)}>Back</button>
                <button className="btn btn-accent btn-lg" style={{flex:1}} onClick={()=>placeOrder({form,pickupPerson,total,codes})}>Place order · {money(total)}</button>
                {b2b && <button className="btn btn-ink btn-lg" style={{flex:1}} onClick={createQuote}><Icon name="message" size={17}/> Create a quote</button>}
              </div>
            </div>
          )}
        </div>

        {/* SUMMARY */}
        <div className="card" style={{position:'sticky',top:96}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,margin:'0 0 14px'}}>{items.reduce((a,i)=>a+i.qty,0)} items</h3>
          <div style={{maxHeight:200,overflowY:'auto',marginBottom:8}}>
            {items.map(it=>(
              <div key={it.key} style={{display:'flex',gap:12,padding:'9px 0',borderBottom:'1px solid var(--line)'}}>
                <div style={{width:48,height:58,borderRadius:8,overflow:'hidden',background:'var(--canvas-2)',flex:'none'}}><Garment type={it.type} colorway={it.color} bgTint="#F4F0E8"/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,lineHeight:1.2}}>{it.name}</div>
                  <div style={{fontSize:11.5,color:'var(--ink-3)'}}>{it.color.name} · {it.size} · ×{it.qty}</div>
                  <div style={{fontSize:11,color: it.fulfillment==='pickup'?'var(--teal)':'var(--ink-3)',display:'flex',alignItems:'center',gap:4,marginTop:2}}><Icon name={it.fulfillment==='pickup'?'store':'truck'} size={11}/>{it.fulfillment==='pickup'?'Pickup':'Ship'}</div>
                </div>
                <span style={{fontSize:13,fontWeight:600}}>{money(it.price*it.qty)}</span>
              </div>
            ))}
          </div>

          {/* PROMO CODES */}
          <div style={{padding:'12px 0',borderTop:'1px solid var(--line)',borderBottom:'1px solid var(--line)',margin:'4px 0 10px'}}>
            <label style={{fontSize:12.5,fontWeight:600,color:'var(--ink-2)',display:'block',marginBottom:8}}>Promo codes</label>
            <div style={{display:'flex',gap:8}}>
              <input className="input" style={{flex:1,padding:'10px 12px',textTransform:'uppercase'}} placeholder="Add a code"
                     value={codeInput} onChange={e=>{setCodeInput(e.target.value); setCodeErr('');}}
                     onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addCode(); } }}/>
              <button className="btn btn-ghost" style={{padding:'10px 16px'}} onClick={addCode}>Add</button>
            </div>
            {codeErr && <div style={{fontSize:12,color:'var(--ct-danger)',marginTop:7,display:'flex',alignItems:'center',gap:5}}><Icon name="x" size={13}/>{codeErr}</div>}
            {codes.length>0 && (
              <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:10}}>
                {codes.map(c=>(
                  <div key={c} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,background:'rgba(11,191,191,0.08)',border:'1px solid rgba(11,191,191,0.28)',borderRadius:'var(--ct-radius-pill)',padding:'7px 8px 7px 13px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                      <span className="mono" style={{fontSize:12.5,fontWeight:700,color:'var(--ink)'}}>{c}</span>
                      <span style={{fontSize:11.5,color:'var(--ink-3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{PROMOS[c].label}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4,flex:'none'}}>
                      <span style={{fontSize:12,fontWeight:600,color:'var(--teal)',whiteSpace:'nowrap'}}>−{codeSaving(c)}</span>
                      <button className="x-btn" style={{width:24,height:24}} onClick={()=>removeCode(c)} aria-label={'Remove '+c}><Icon name="x" size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {[['Subtotal',money(subtotal)]].map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13.5,padding:'5px 0',color:'var(--ink-2)'}}><span>{k}</span><span style={{color:'var(--ink)'}}>{v}</span></div>
          ))}
          {discount>0 && (
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13.5,padding:'5px 0',color:'var(--teal)',fontWeight:600}}><span>Discount</span><span>−{money(discount)}</span></div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',fontSize:13.5,padding:'5px 0',color:'var(--ink-2)'}}><span>Shipping</span><span style={{color: shipping===0?'var(--teal)':'var(--ink)'}}>{shipping===0?'Free':money(shipping)}</span></div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:13.5,padding:'5px 0',color:'var(--ink-2)'}}><span>Tax</span><span style={{color:'var(--ink)'}}>{money(tax)}</span></div>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:16,padding:'12px 0 0',borderTop:'1px solid var(--line)',marginTop:6}}><span>Total</span><span>{money(total)}</span></div>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { CartPage, CheckoutPage });
