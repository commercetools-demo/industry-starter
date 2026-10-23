/* =========================================================================
   VELA — B2B direct variant listing (Trade).
   Renders each product as an expanded row: image + spec + pack-size selector,
   with a per-variant (colorway) table — each row has its own item no., price,
   quantity stepper and add-to-cart. Activated by the "B2B" tweak.
   ========================================================================= */

// Trade pack sizes. Larger packs carry volume discounts.
const B2B_PACKS = [
  { size: 1,  code: '01', label: 'Single',     disc: 0    },
  { size: 6,  code: '06', label: 'Pack of 6',  disc: 0.08 },
  { size: 24, code: '24', label: 'Case of 24', disc: 0.15 },
];

function packPrice(unit, packSize, applyVolume) {
  const p = B2B_PACKS.find(x => x.size === packSize) || B2B_PACKS[0];
  const disc = applyVolume === false ? 0 : p.disc;
  return Math.round(unit * packSize * (1 - disc));
}

function colorAbbr(name) { return name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(); }
function prodAbbr(id)   { return id.split('-')[0].slice(0, 3).toUpperCase(); }
function skuFor(product, color, pack) {
  return `VELA-${prodAbbr(product.id)}-${colorAbbr(color.name)}-${pack.code}`;
}

// One purchasable variant (colorway) at the selected pack size.
function B2BVariantRow({ product, color, pack, applyVolume, addToCart }) {
  const [qty, setQty] = React.useState(1);
  const unit = packPrice(product.price, pack.size, applyVolume);
  const sku = skuFor(product, color, pack);
  const add = () => {
    addToCart(product, { color, size: pack.label, qty, fulfillment: 'ship', price: unit, toast: true });
    setQty(1);
  };
  return (
    <div className="b2b-trow">
      <a className="b2b-sku" onClick={add}>{sku}</a>
      <div className="b2b-col"><span className="sw" style={{ background: color.dot }} /> {color.name}</div>
      <div className="b2b-pack">{pack.label}</div>
      <div className="b2b-price">{money(unit)}<span className="b2b-ex">ex. VAT · per {pack.size === 1 ? 'unit' : 'pack'}</span></div>
      <div className="stepper">
        <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease"><Icon name="minus" size={14} /></button>
        <span>{qty}</span>
        <button onClick={() => setQty(q => q + 1)} aria-label="Increase"><Icon name="plus" size={14} /></button>
      </div>
      <button className="btn btn-ink b2b-add" onClick={add}><Icon name="bag" size={16} /> Add to cart</button>
    </div>
  );
}

// One product, expanded into its variant table.
function B2BProductRow({ product, applyVolume, addToCart, openProduct }) {
  const [pack, setPack] = React.useState(B2B_PACKS[0]);
  const cw = product.colors[0];
  return (
    <div className="b2b-row">
      <div className="b2b-rhead">
        <div className="b2b-thumb"><Garment type={product.type} colorway={cw} bgTint="#F4F0E8" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pcard-cat">{product.cat}</div>
          <h3 className="b2b-title" onClick={() => openProduct(product.id)}>{product.name}</h3>
          <div className="b2b-fabric">{product.fabric}</div>
          <a className="b2b-docs"><Icon name="pkg" size={15} /> Spec sheet &amp; care guide (PDF)</a>
        </div>
        <div className="b2b-packsel">
          <span className="b2b-packsel-lbl">Pack size</span>
          <div className="chips">
            {B2B_PACKS.map(p => (
              <button key={p.code} className={'chip' + (pack.size === p.size ? ' active' : '')} onClick={() => setPack(p)}>{p.size}</button>
            ))}
          </div>
          {applyVolume !== false && pack.disc > 0 && <div className="b2b-disc">−{Math.round(pack.disc * 100)}% volume price</div>}
        </div>
      </div>
      <div className="b2b-table">
        <div className="b2b-thead">
          <span>Item no.</span><span>Colour</span><span>Pack size</span><span>Unit price</span><span>Qty</span><span></span>
        </div>
        {product.colors.map(c => (
          <B2BVariantRow key={c.name} product={product} color={c} pack={pack} applyVolume={applyVolume} addToCart={addToCart} />
        ))}
      </div>
    </div>
  );
}

function B2BList({ products, applyVolume, addToCart, openProduct }) {
  return (
    <div className="b2b-list">
      {products.map(p => (
        <B2BProductRow key={p.id} product={p} applyVolume={applyVolume} addToCart={addToCart} openProduct={openProduct} />
      ))}
    </div>
  );
}

// Resolve a typed item number back to a product / colorway / pack.
function resolveSku(raw) {
  const sku = (raw || '').trim().toUpperCase();
  if (!sku) return null;
  for (const product of PRODUCTS) {
    for (const color of product.colors) {
      for (const pack of B2B_PACKS) {
        if (skuFor(product, color, pack) === sku) return { product, color, pack };
      }
    }
  }
  return null;
}

// "Look up product" — quick-order by item number or CSV upload.
function LookupModal({ show, close, addToCart, applyVolume }) {
  const [sku, setSku] = React.useState('');
  const [lines, setLines] = React.useState([]); // { sku, product, color, pack, qty }
  const [msg, setMsg] = React.useState(null);    // { type:'err'|'ok', text }
  const fileRef = React.useRef(null);

  const stage = (raw, qty) => {
    const r = resolveSku(raw);
    if (!r) return false;
    const id = skuFor(r.product, r.color, r.pack);
    setLines(prev => {
      const ex = prev.find(l => l.sku === id);
      if (ex) return prev.map(l => l.sku === id ? { ...l, qty: l.qty + (qty || 1) } : l);
      return [...prev, { sku: id, ...r, qty: qty || 1 }];
    });
    return true;
  };

  const onLookup = () => {
    if (!sku.trim()) return;
    if (stage(sku, 1)) { setSku(''); setMsg(null); }
    else setMsg({ type: 'err', text: `No product found for "${sku.trim()}"` });
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let added = 0, failed = 0;
      String(rd.result).split(/\r?\n/).forEach(line => {
        const parts = line.split(/[,;\t]/);
        const s = (parts[0] || '').trim();
        if (!s) return;
        const q = parseInt(parts[1], 10) || 1;
        if (stage(s, q)) added += 1; else failed += 1;
      });
      setMsg({ type: failed ? 'err' : 'ok', text: `${added} line${added===1?'':'s'} matched${failed ? ` · ${failed} not found` : ''}` });
    };
    rd.readAsText(f);
    e.target.value = '';
  };

  const setQty = (id, delta) => setLines(prev => prev.map(l => l.sku === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  const removeLine = (id) => setLines(prev => prev.filter(l => l.sku !== id));

  const totalItems = lines.reduce((a, l) => a + l.qty, 0);
  const totalValue = lines.reduce((a, l) => a + packPrice(l.product.price, l.pack.size, applyVolume) * l.qty, 0);

  const submit = () => {
    lines.forEach(l => {
      const unit = packPrice(l.product.price, l.pack.size, applyVolume);
      addToCart(l.product, { color: l.color, size: l.pack.label, qty: l.qty, fulfillment: 'ship', price: unit, toast: true });
    });
    setLines([]); setSku(''); setMsg(null); close();
  };

  const onClose = () => { close(); };

  return (
    <React.Fragment>
      <div className={'overlay' + (show ? ' show' : '')} onClick={onClose} />
      <div className={'modal lookup-modal' + (show ? ' show' : '')} role="dialog" aria-label="Look up product">
        <div className="modal-head">
          <h3>Look up product</h3>
          <button className="x-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 22 }}>
            <label>Look up by item number</label>
            <div className="lookup-row">
              <input className="input" placeholder="e.g. VELA-FLU-BLA-06" value={sku}
                     onChange={e => setSku(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') onLookup(); }} />
              <button className="btn btn-ghost" onClick={onLookup}>Look up</button>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label>Or upload CSV</label>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 10px' }}>CSV format: item number, quantity (one per line)</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: 'none' }} />
            <button className="btn btn-ghost" onClick={() => fileRef.current && fileRef.current.click()}>
              <Icon name="upload" size={16} /> Choose file
            </button>
          </div>

          {msg && <div className={'lookup-msg ' + msg.type}>{msg.text}</div>}

          {lines.length > 0 && (
            <div className="lookup-lines">
              {lines.map(l => (
                <div className="lookup-line" key={l.sku}>
                  <span className="sw" style={{ background: l.color.dot }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ll-name">{l.product.name}</div>
                    <div className="ll-meta">{l.sku} · {l.color.name} · {l.pack.label}</div>
                  </div>
                  <div className="stepper">
                    <button onClick={() => setQty(l.sku, -1)}><Icon name="minus" size={13} /></button>
                    <span>{l.qty}</span>
                    <button onClick={() => setQty(l.sku, 1)}><Icon name="plus" size={13} /></button>
                  </div>
                  <span className="ll-price">{money(packPrice(l.product.price, l.pack.size, applyVolume) * l.qty)}</span>
                  <button className="x-btn" style={{ width: 30, height: 30 }} onClick={() => removeLine(l.sku)}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lookup-foot">
          <div className="lookup-sum">{totalItems > 0 && <span>{money(totalValue)} <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>ex. VAT</span></span>}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-accent" disabled={totalItems === 0} onClick={submit}>
              Add {totalItems} item{totalItems === 1 ? '' : 's'} to cart
            </button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { B2BList, B2BProductRow, B2BVariantRow, B2B_PACKS, packPrice, skuFor, resolveSku, LookupModal });
