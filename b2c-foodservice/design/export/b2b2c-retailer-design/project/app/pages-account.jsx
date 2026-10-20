/* =========================================================================
   VELA — Order confirmation + My Account (orders, pickup status, profile)
   ========================================================================= */

function ConfirmationPage({ go, order, store }) {
  if (!order) { return <main className="wrap fade-up" style={{textAlign:'center',padding:'100px 20px'}}><h1 className="serif">No recent order</h1><button className="btn btn-ink" style={{marginTop:16}} onClick={()=>go('shop')}>Shop</button></main>; }
  const hasPickup = order.items.some(i=>i.fulfillment==='pickup');
  return (
    <main className="wrap fade-up" style={{maxWidth:760,paddingBottom:80}}>
      <div style={{textAlign:'center',padding:'40px 0 28px'}}>
        <div style={{width:64,height:64,borderRadius:999,background:'var(--teal)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}><Icon name="check" size={32} style={{color:'#fff'}}/></div>
        <h1 className="serif" style={{fontSize:32,fontWeight:800,letterSpacing:'-0.02em',margin:'0 0 8px'}}>Order confirmed</h1>
        <p style={{color:'var(--ink-2)',margin:0}}>Order <b className="mono">{order.number}</b> · confirmation sent to {order.email||'your email'}</p>
      </div>

      {hasPickup && (
        <div className="card" style={{marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <Icon name="store" size={20} style={{color:'var(--accent)'}}/>
            <h3 className="serif" style={{fontSize:18,fontWeight:700,margin:0}}>Pickup at {store.name.replace('VELA ','')}</h3>
          </div>
          <div className="status-track">
            {[['Ordered',true,false],['Preparing',false,true],['Ready',false,false],['Picked up',false,false]].map(([l,done,active],i)=>(
              <div key={l} className={'node'+(done?' done':active?' active':'')}>
                {i>0 && <div className="bar" style={{left:'-50%'}}/>}
                <div className="ring">{done && <Icon name="check" size={15}/>}</div>
                <div className="lbl">{l}</div>
              </div>
            ))}
          </div>
          <div style={{background:'var(--canvas-2)',borderRadius:'var(--ct-radius-md)',padding:'14px 16px',fontSize:13.5,color:'var(--ink-2)',marginTop:10}}>
            <b style={{color:'var(--ink)'}}>{store.addr}</b><br/>
            We'll text you when it's ready — usually within 2 hours. Bring your ID and order number.
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="serif" style={{fontSize:16,fontWeight:700,margin:'0 0 12px'}}>Your items</h3>
        {order.items.map(it=>(
          <div key={it.key} style={{display:'flex',gap:14,padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
            <div style={{width:60,height:72,borderRadius:8,overflow:'hidden',background:'var(--canvas-2)'}}><Garment type={it.type} colorway={it.color} bgTint="#F4F0E8"/></div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{it.name}</div>
              <div style={{fontSize:12.5,color:'var(--ink-3)'}}>{it.color.name} · {it.size} · ×{it.qty}</div>
              <div style={{fontSize:11.5,color: it.fulfillment==='pickup'?'var(--teal)':'var(--ink-3)',display:'flex',alignItems:'center',gap:5,marginTop:3}}><Icon name={it.fulfillment==='pickup'?'store':'truck'} size={12}/>{it.fulfillment==='pickup'?'Pickup':'Shipping'}</div>
            </div>
            <span style={{fontWeight:600,fontSize:14}}>{money(it.price*it.qty)}</span>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:16,paddingTop:14}}><span>Total</span><span>{money(order.total)}</span></div>
      </div>
      <div style={{display:'flex',gap:12,marginTop:22,justifyContent:'center'}}>
        <button className="btn btn-ink btn-lg" onClick={()=>go('account')}>View in My Account</button>
        <button className="btn btn-ghost btn-lg" onClick={()=>go('shop')}>Keep shopping</button>
      </div>
    </main>
  );
}

// ---------------- MY ACCOUNT ----------------
function AccountPage({ go, store, openStore, orders, favs, openProduct, addToCart, toggleFav, b2b, role, unit, b2bLists, setB2BLists, b2bQuotes, setB2BQuotes, focusQuote }) {
  if (b2b) return <B2BDashboard go={go} role={role} unit={unit} addToCart={addToCart} lists={b2bLists} setLists={setB2BLists} quotes={b2bQuotes} setQuotes={setB2BQuotes} focusQuote={focusQuote} />;
  const [tab, setTab] = React.useState('orders');
  const tabs = [['orders','pkg','Orders'],['pickup','store','Pickup'],['favs','heart','Saved'],['profile','user','Profile'],['settings','settings','Settings']];

  const sampleOrders = orders.length ? orders : DEMO_ORDERS;
  const favProducts = PRODUCTS.filter(p=>favs.includes(p.id));

  return (
    <main className="wrap fade-up" style={{paddingBottom:80}}>
      <div style={{padding:'28px 0 24px'}}>
        <div className="eyebrow" style={{marginBottom:6}}>My account</div>
        <h1 className="serif" style={{fontSize:36,fontWeight:800,letterSpacing:'-0.025em',margin:0}}>Hi, Maya</h1>
        <p style={{color:'var(--ink-3)',margin:'4px 0 0'}}>VELA Move member since 2024 · <span style={{color:'var(--accent)',fontWeight:600}}>1,240 points</span></p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:40,alignItems:'start'}} className="acct-grid">
        <nav className="acct-tabs">
          {tabs.map(([k,ic,l])=>(
            <div key={k} className={'acct-tab'+(tab===k?' active':'')} onClick={()=>setTab(k)}><Icon name={ic} size={18}/>{l}</div>
          ))}
          <div className="acct-tab" onClick={()=>go('home')} style={{marginTop:8,color:'var(--ink-3)'}}><Icon name="logout" size={18}/>Sign out</div>
        </nav>

        <div>
          {tab==='orders' && (
            <div className="fade-up">
              <h2 className="serif" style={{fontSize:22,fontWeight:700,margin:'0 0 18px'}}>Order history</h2>
              {sampleOrders.map(o=>(
                <div className="card" key={o.number} style={{marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:12}}>
                    <div>
                      <div style={{fontWeight:700,fontFamily:'var(--ct-font-display)'}}>{o.number}</div>
                      <div style={{fontSize:12.5,color:'var(--ink-3)'}}>{o.date} · {money(o.total)}</div>
                    </div>
                    <span style={{display:'inline-flex',alignItems:'center',gap:7,fontSize:12.5,fontWeight:600,padding:'6px 12px',borderRadius:999,background: o.status==='Ready for pickup'?'rgba(11,191,191,0.12)':o.status==='Delivered'?'var(--canvas-2)':'rgba(99,89,255,0.1)',color: o.status==='Ready for pickup'?'var(--teal)':o.status==='Delivered'?'var(--ink-2)':'var(--accent)'}}>
                      <Icon name={o.fulfillment==='pickup'?'store':'truck'} size={13}/>{o.status}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:10,marginBottom:14}}>
                    {o.items.map((it,i)=>(<div key={i} style={{width:52,height:62,borderRadius:8,overflow:'hidden',background:'var(--canvas-2)'}}><Garment type={it.type} colorway={it.color} bgTint="#F4F0E8"/></div>))}
                  </div>
                  {o.status==='Ready for pickup' && (
                    <div style={{background:'rgba(11,191,191,0.08)',border:'1px solid rgba(11,191,191,0.25)',borderRadius:'var(--ct-radius-md)',padding:'12px 14px',fontSize:13,color:'var(--ink)',display:'flex',gap:10,alignItems:'center'}}>
                      <Icon name="store" size={17} style={{color:'var(--teal)',flex:'none'}}/>
                      <span>Ready at {store.name.replace('VELA ','')} · {store.hours}. Bring your ID & this order number.</span>
                    </div>
                  )}
                  <div style={{display:'flex',gap:10,marginTop:14}}>
                    <button className="btn btn-ghost" style={{padding:'9px 16px',fontSize:13}}>View details</button>
                    {o.status==='Delivered' && <button className="btn btn-ghost" style={{padding:'9px 16px',fontSize:13}}>Buy again</button>}
                    {o.status==='Ready for pickup' && <button className="btn btn-accent" style={{padding:'9px 16px',fontSize:13}}>Get directions</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==='pickup' && (
            <div className="fade-up">
              <h2 className="serif" style={{fontSize:22,fontWeight:700,margin:'0 0 6px'}}>Your pickup store</h2>
              <p style={{color:'var(--ink-3)',margin:'0 0 18px'}}>We use this store for live availability and pickup orders.</p>
              <div className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
                <div style={{display:'flex',gap:14}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'rgba(99,89,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flex:'none'}}><Icon name="store" size={22} style={{color:'var(--accent)'}}/></div>
                  <div>
                    <h3 className="serif" style={{fontSize:17,fontWeight:700,margin:'0 0 3px'}}>{store.name}</h3>
                    <p style={{fontSize:13.5,color:'var(--ink-2)',margin:0}}>{store.addr}</p>
                    <p style={{fontSize:13,color:'var(--ink-3)',margin:'3px 0 0'}}>Open today {store.hours} · {store.phone}</p>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={openStore}>Change store</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:18}} className="grid-3">
                {[['clock','2-hour pickup','Most orders ready same day'],['repeat','In-store returns','Bring any order back free'],['gift','Member perks','Early access & free hemming']].map(([ic,t,d])=>(
                  <div className="card" key={t}><Icon name={ic} size={22} style={{color:'var(--accent)',marginBottom:10}}/><div className="serif" style={{fontWeight:600,fontSize:14.5,marginBottom:4}}>{t}</div><div style={{fontSize:12.5,color:'var(--ink-3)'}}>{d}</div></div>
                ))}
              </div>
            </div>
          )}

          {tab==='favs' && (
            <div className="fade-up">
              <h2 className="serif" style={{fontSize:22,fontWeight:700,margin:'0 0 18px'}}>Saved items</h2>
              {favProducts.length===0 ? (
                <div className="card" style={{textAlign:'center',padding:'48px 20px',color:'var(--ink-3)'}}><Icon name="heart" size={32} style={{margin:'0 auto 12px'}}/><p style={{margin:'0 0 16px'}}>Nothing saved yet. Tap the heart on any product.</p><button className="btn btn-ink" onClick={()=>go('shop')}>Browse</button></div>
              ) : (
                <div className="grid-3">{favProducts.map(p=><ProductCard key={p.id} product={p} store={store} onOpen={openProduct} onQuickAdd={addToCart} favs={favs} toggleFav={toggleFav}/>)}</div>
              )}
            </div>
          )}

          {tab==='profile' && (
            <div className="fade-up">
              <h2 className="serif" style={{fontSize:22,fontWeight:700,margin:'0 0 18px'}}>Profile</h2>
              <div className="card">
                <div className="row-2">
                  <div className="field"><label>First name</label><input className="input" defaultValue="Maya"/></div>
                  <div className="field"><label>Last name</label><input className="input" defaultValue="Okonkwo"/></div>
                </div>
                <div className="field"><label>Email</label><input className="input" defaultValue="maya@email.com"/></div>
                <div className="field"><label>Phone</label><input className="input" defaultValue="(212) 555-0140"/></div>
                <div className="field" style={{marginBottom:0}}><label>Default address</label><input className="input" defaultValue="118 Spring St, New York, NY 10012"/></div>
                <button className="btn btn-ink" style={{marginTop:18}}>Save changes</button>
              </div>
            </div>
          )}

          {tab==='settings' && (
            <div className="fade-up">
              <h2 className="serif" style={{fontSize:22,fontWeight:700,margin:'0 0 18px'}}>Settings</h2>
              <div className="card">
                {[['Email me about orders & pickup',true],['SMS pickup-ready alerts',true],['New arrivals & drops',false],['VELA Move points updates',true]].map(([l,on])=>(
                  <label key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',borderBottom:'1px solid var(--line)',cursor:'pointer'}}>
                    <span style={{fontSize:14}}>{l}</span>
                    <Toggle on={on}/>
                  </label>
                ))}
                <button className="btn btn-ghost" style={{marginTop:18,color:'var(--ct-danger)',borderColor:'var(--line-2)'}}>Delete account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Toggle({ on: initOn }) {
  const [on, setOn] = React.useState(!!initOn);
  return (
    <button onClick={()=>setOn(o=>!o)} style={{width:44,height:26,borderRadius:999,border:0,background: on?'var(--accent)':'var(--line-2)',position:'relative',transition:'background .2s'}}>
      <span style={{position:'absolute',top:3,left: on?22:3,width:20,height:20,borderRadius:999,background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
    </button>
  );
}

const DEMO_ORDERS = [
  { number:'VELA-48201', date:'May 28, 2026', total:256, fulfillment:'pickup', status:'Ready for pickup',
    items:[{type:'hoodie',color:CW.bone},{type:'leggings',color:CW.black}] },
  { number:'VELA-47755', date:'May 12, 2026', total:180, fulfillment:'ship', status:'Delivered',
    items:[{type:'bra',color:CW.violet},{type:'tee',color:CW.forest}] },
  { number:'VELA-46980', date:'Apr 30, 2026', total:128, fulfillment:'pickup', status:'Picked up',
    items:[{type:'joggers',color:CW.slate}] },
];

Object.assign(window, { ConfirmationPage, AccountPage, DEMO_ORDERS });
