/* =========================================================================
   VELA — B2B dashboard. Role-aware (buyer / approver / admin).
   Buyer:    Orders · Quotes · Purchase Lists · Addresses · Security
   Approver: + Approvals (filter, approve/reject with comment)
   Admin:    + Approval Flows · Business Unit
   Replaces the consumer dashboard (no Pickup / Saved) when B2B is active.
   ========================================================================= */

function bdInitials(name) { return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }

function roleLabel(r) { return { buyer:'Buyer', approver:'Approver', admin:'Admin' }[r] || r; }

// Resolve a purchase-list item to a real product / colorway / pack.
function listItemInfo(item) {
  const product = PRODUCTS.find(p => p.id === item.productId) || PRODUCTS[0];
  const color = product.colors.find(c => c.name === item.color) || product.colors[0];
  const pack = B2B_PACKS.find(p => p.size === item.pack) || B2B_PACKS[0];
  return { product, color, pack, unit: packPrice(product.price, pack.size, true), sku: skuFor(product, color, pack) };
}

function ApprovalBadge({ state, status }) {
  const map = {
    pending:  { t: status || 'Awaiting approval', bg: 'rgba(255,176,0,0.14)', c: 'var(--ct-amber-600)' },
    approved: { t: status && status !== 'Approved' ? status : 'Approved', bg: 'rgba(11,191,191,0.14)', c: 'var(--teal)' },
    rejected: { t: 'Rejected', bg: 'rgba(214,69,69,0.12)', c: 'var(--ct-danger)' },
    none:     { t: status || 'Processing', bg: 'var(--canvas-2)', c: 'var(--ink-2)' },
  };
  const m = map[state] || map.none;
  return <span className="bd-badge" style={{ background: m.bg, color: m.c }}>{m.t}</span>;
}

function ItemThumbs({ items }) {
  return (
    <div className="bd-thumbs">
      {items.map((it, i) => (
        <div key={i} className="bd-thumb" title={`${it.name} ×${it.qty}`}>
          <Garment type={it.type} colorway={it.color} bgTint="#F4F0E8" />
          {it.qty != null && <span className="bd-thumb-q">×{it.qty}</span>}
        </div>
      ))}
    </div>
  );
}

// ---------------- ORDERS (read-only, BU-wide) ----------------
function B2BOrders({ unitName }) {
  return (
    <div className="fade-up">
      <h2 className="bd-h2">Orders</h2>
      <p className="bd-sub">All orders across {unitName} — yours and your colleagues'.</p>
      {B2B_ORDERS.map(o => (
        <div className="card bd-card" key={o.number}>
          <div className="bd-row-top">
            <div>
              <div className="bd-num">{o.number}</div>
              <div className="bd-meta">{o.buyer} · {o.date} · <b>{money(o.total)}</b> ex. VAT</div>
            </div>
            <ApprovalBadge state={o.approval} status={o.status} />
          </div>
          <ItemThumbs items={o.items} />
          <div className="bd-actions">
            <button className="btn btn-ghost bd-sm">View details</button>
            {o.status === 'Delivered' && <button className="btn btn-ghost bd-sm">Reorder</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- APPROVALS (approver) ----------------
function B2BApprovals({ unitName }) {
  const [filter, setFilter] = React.useState('pending');
  const [decisions, setDecisions] = React.useState({}); // number -> {state, comment}
  const [draft, setDraft] = React.useState(null);        // {number, action, comment}

  const effState = (o) => (decisions[o.number] ? decisions[o.number].state : o.approval);
  const list = B2B_ORDERS.filter(o => filter === 'all' ? true : effState(o) === filter);

  const start = (number, action) => setDraft({ number, action, comment: '' });
  const confirm = () => {
    setDecisions(d => ({ ...d, [draft.number]: { state: draft.action, comment: draft.comment } }));
    setDraft(null);
  };

  return (
    <div className="fade-up">
      <h2 className="bd-h2">Approvals</h2>
      <p className="bd-sub">Review orders from {unitName} that require sign-off.</p>

      <div className="bd-filterbar">
        <span className="bd-filter-lbl">Filter</span>
        {[['pending','Awaiting approval'],['approved','Approved'],['rejected','Rejected'],['all','All']].map(([k, l]) => (
          <button key={k} className={'chip' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {list.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '40px 20px' }}>Nothing to show for this filter.</div>}

      {list.map(o => {
        const st = effState(o);
        const dec = decisions[o.number];
        return (
          <div className="card bd-card" key={o.number}>
            <div className="bd-row-top">
              <div>
                <div className="bd-num">{o.number}</div>
                <div className="bd-meta">{o.buyer} · {o.date} · <b>{money(o.total)}</b> ex. VAT</div>
              </div>
              <ApprovalBadge state={st} status={st === 'pending' ? 'Awaiting approval' : null} />
            </div>
            <ItemThumbs items={o.items} />

            {dec && dec.comment && (
              <div className={'bd-decision ' + dec.state}>
                <Icon name={dec.state === 'approved' ? 'check' : 'x'} size={15} />
                <span><b>{dec.state === 'approved' ? 'Approved' : 'Rejected'}</b> — “{dec.comment}”</span>
              </div>
            )}

            {st === 'pending' && draft && draft.number === o.number ? (
              <div className="bd-approve-box">
                <label className="bd-field-lbl">{draft.action === 'approved' ? 'Approval' : 'Rejection'} comment</label>
                <textarea className="input" rows={2} autoFocus value={draft.comment}
                          onChange={e => setDraft(d => ({ ...d, comment: e.target.value }))}
                          placeholder={draft.action === 'approved' ? 'Add an optional note…' : 'Tell the buyer why…'} />
                <div className="bd-actions" style={{ marginTop: 10 }}>
                  <button className={'btn ' + (draft.action === 'approved' ? 'btn-accent' : 'btn-ink')} onClick={confirm}>
                    Confirm {draft.action === 'approved' ? 'approval' : 'rejection'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
                </div>
              </div>
            ) : st === 'pending' ? (
              <div className="bd-actions">
                <button className="btn btn-accent bd-sm" onClick={() => start(o.number, 'approved')}><Icon name="check" size={15} /> Approve</button>
                <button className="btn btn-ghost bd-sm" style={{ color: 'var(--ct-danger)' }} onClick={() => start(o.number, 'rejected')}><Icon name="x" size={15} /> Reject</button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- QUOTES + negotiation tree ----------------
function addReply(tree, parentId, msg) {
  return tree.map(n => {
    if (n.id === parentId) return { ...n, replies: [...(n.replies || []), msg] };
    return { ...n, replies: addReply(n.replies || [], parentId, msg) };
  });
}

function flattenThread(tree, out) { (tree || []).forEach(n => { out.push(n); flattenThread(n.replies, out); }); return out; }
function lastThreadId(tree) { const a = flattenThread(tree, []); return a.length ? a[a.length - 1].id : null; }

// iMessage-style negotiation chat. Buyer ("me") bubbles right + violet; trade desk left + grey.
function QuoteChat({ thread, onReply, me, locked }) {
  const msgs = flattenThread(thread, []);
  const [text, setText] = React.useState('');
  const [price, setPrice] = React.useState('');
  const endRef = React.useRef(null);
  const send = () => {
    if (!text.trim()) return;
    onReply(lastThreadId(thread), { id: 'r' + Date.now(), who: 'buyer', author: me, time: 'Just now', text: text.trim(), price: price ? +price : null, replies: [] });
    setText(''); setPrice('');
  };
  return (
    <div className="imsg">
      <div className="imsg-thread">
        {msgs.map((n, i) => {
          const mine = n.who === 'buyer';
          const prev = msgs[i - 1];
          const showWho = !prev || prev.who !== n.who;
          return (
            <div key={n.id} className={'imsg-row ' + (mine ? 'me' : 'them')}>
              {showWho && <div className="imsg-who">{mine ? 'You' : n.author}</div>}
              <div className="imsg-bubble">
                {n.text}
                {n.price != null && <div className="imsg-price">Proposed {money(n.price)} ex. VAT</div>}
              </div>
              <div className="imsg-time">{n.time}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {!locked && (
        <div className="imsg-compose">
          <input className="imsg-price-in" placeholder="€ counter" value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9]/g, ''))} />
          <input className="imsg-input" placeholder="Message the trade desk…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} />
          <button className="imsg-send" onClick={send} aria-label="Send" disabled={!text.trim()}><Icon name="send" size={17} /></button>
        </div>
      )}
    </div>
  );
}

function B2BQuotes({ unitName, me, quotes, setQuotes, focusQuote }) {
  const [openNum, setOpenNum] = React.useState(focusQuote || null);
  const quote = quotes.find(q => q.number === openNum);

  const onReply = (parentId, msg) => setQuotes(qs => qs.map(q => q.number === openNum ? { ...q, thread: addReply(q.thread, parentId, msg) } : q));

  if (quote) {
    return (
      <div className="fade-up">
        <button className="bd-link" style={{ marginBottom: 14 }} onClick={() => setOpenNum(null)}><Icon name="chevL" size={15} /> All quotes</button>
        <div className="bd-row-top" style={{ marginBottom: 6 }}>
          <h2 className="bd-h2" style={{ margin: 0 }}>{quote.number}</h2>
          <ApprovalBadge state={quote.status === 'Accepted' ? 'approved' : quote.status === 'In negotiation' ? 'pending' : 'none'} status={quote.status} />
        </div>
        <p className="bd-sub">{quote.buyer} · {quote.date}</p>

        <div className="card" style={{ marginBottom: 18 }}>
          {quote.items.map((it, i) => (
            <div key={i} className="bd-quote-line">
              <div className="bd-thumb"><Garment type={it.type} colorway={it.color} bgTint="#F4F0E8" /></div>
              <div style={{ flex: 1 }}>
                <div className="bd-num">{it.name}</div>
                <div className="bd-meta">{it.qty} units · list {money(it.listPrice)}/unit</div>
              </div>
            </div>
          ))}
          <div className="bd-quote-totals">
            <span>Requested <b>{money(quote.requested)}</b></span>
            <span>Current offer <b style={{ color: 'var(--accent)' }}>{money(quote.current)}</b> ex. VAT</span>
          </div>
        </div>

        <h3 className="bd-h3">Negotiation</h3>
        <QuoteChat thread={quote.thread} onReply={onReply} me={me} locked={quote.status === 'Accepted'} />
        {quote.status !== 'Accepted' && (
          <div className="bd-actions" style={{ marginTop: 18 }}>
            <button className="btn btn-accent">Accept current offer</button>
            <button className="btn btn-ghost">Request revision</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="bd-row-top">
        <div><h2 className="bd-h2" style={{ margin: 0 }}>Quotes</h2><p className="bd-sub" style={{ margin: '4px 0 0' }}>Negotiated pricing across {unitName}.</p></div>
        <button className="btn btn-ink bd-sm"><Icon name="plus" size={15} /> Request quote</button>
      </div>
      <div style={{ marginTop: 18 }}>
        {quotes.map(q => (
          <div className="card bd-card bd-clickable" key={q.number} onClick={() => setOpenNum(q.number)}>
            <div className="bd-row-top">
              <div>
                <div className="bd-num">{q.number}</div>
                <div className="bd-meta">{q.buyer} · {q.date} · {q.items[0].name} ×{q.items[0].qty}</div>
              </div>
              <ApprovalBadge state={q.status === 'Accepted' ? 'approved' : q.status === 'In negotiation' ? 'pending' : 'none'} status={q.status} />
            </div>
            <div className="bd-quote-totals" style={{ borderTop: 0, paddingTop: 6 }}>
              <span>Current offer <b style={{ color: 'var(--accent)' }}>{money(q.current)}</b> ex. VAT</span>
              <span className="bd-link">Open negotiation <Icon name="chevR" size={14} /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- PURCHASE LISTS ----------------
function B2BLists({ lists, setLists, addToCart }) {
  const setQty = (li, ii, delta) => setLists(ls => ls.map((l, i) => i !== li ? l : { ...l, items: l.items.map((it, j) => j !== ii ? it : { ...it, qty: Math.max(1, it.qty + delta) }) }));
  const remove = (li, ii) => setLists(ls => ls.map((l, i) => i !== li ? l : { ...l, items: l.items.filter((_, j) => j !== ii) }));
  const newList = () => setLists(ls => [...ls, { id: 'list-' + Date.now(), name: 'Untitled list', owner: USER.name, sharedWith: [], items: [] }]);
  const addOne = (item) => { const info = listItemInfo(item); addToCart(info.product, { color: info.color, size: info.pack.label, qty: item.qty, fulfillment: 'ship', price: info.unit, toast: true }); };
  const addAll = (l) => l.items.forEach(addOne);

  return (
    <div className="fade-up">
      <div className="bd-row-top">
        <div><h2 className="bd-h2" style={{ margin: 0 }}>Purchase Lists</h2><p className="bd-sub" style={{ margin: '4px 0 0' }}>Shared shopping lists for your team.</p></div>
        <button className="btn btn-ink bd-sm" onClick={newList}><Icon name="plus" size={15} /> New list</button>
      </div>

      {lists.map((l, li) => {
        const total = l.items.reduce((a, it) => a + listItemInfo(it).unit * it.qty, 0);
        return (
          <div className="card bd-card" key={l.id}>
            <div className="bd-row-top" style={{ alignItems: 'center' }}>
              <div>
                <div className="bd-num" style={{ fontSize: 16 }}>{l.name}</div>
                <div className="bd-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Shared with
                  <span className="bd-avstack">{l.sharedWith.map((n, i) => <span key={i} className="bd-avatar sm" title={n}>{bdInitials(n)}</span>)}</span>
                </div>
              </div>
              <button className="btn btn-accent bd-sm" disabled={l.items.length === 0} onClick={() => addAll(l)}><Icon name="bag" size={15} /> Add all to cart</button>
            </div>

            {l.items.length === 0 && <div className="bd-meta" style={{ padding: '12px 0' }}>This list is empty.</div>}
            {l.items.map((it, ii) => {
              const info = listItemInfo(it);
              return (
                <div className="bd-list-line" key={ii}>
                  <div className="bd-thumb sm"><Garment type={info.product.type} colorway={info.color} bgTint="#F4F0E8" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bd-num" style={{ fontSize: 14 }}>{info.product.name}</div>
                    <div className="bd-meta bd-mono">{info.sku} · {info.color.name} · {info.pack.label}</div>
                  </div>
                  <div className="stepper">
                    <button onClick={() => setQty(li, ii, -1)}><Icon name="minus" size={13} /></button>
                    <span>{it.qty}</span>
                    <button onClick={() => setQty(li, ii, 1)}><Icon name="plus" size={13} /></button>
                  </div>
                  <span className="bd-line-price">{money(info.unit * it.qty)}</span>
                  <button className="btn btn-ghost bd-sm" onClick={() => addOne(it)}>Add</button>
                  <button className="x-btn" style={{ width: 32, height: 32 }} onClick={() => remove(li, ii)} aria-label="Remove"><Icon name="trash" size={16} /></button>
                </div>
              );
            })}
            {l.items.length > 0 && <div className="bd-list-foot">List total <b>{money(total)}</b> ex. VAT</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- ADDRESSES ----------------
function AddressCard({ addr, onSave, onDelete, onDefault }) {
  const [editing, setEditing] = React.useState(addr.isNew || false);
  const [f, setF] = React.useState(addr);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  if (editing) {
    return (
      <div className="card bd-addr">
        <div className="field"><label>Label</label><input className="input" value={f.label} onChange={e => set('label', e.target.value)} /></div>
        <div className="field"><label>Company</label><input className="input" value={f.company} onChange={e => set('company', e.target.value)} /></div>
        <div className="field"><label>Street address</label><input className="input" value={f.line} onChange={e => set('line', e.target.value)} /></div>
        <div className="row-2">
          <div className="field"><label>City</label><input className="input" value={f.city} onChange={e => set('city', e.target.value)} /></div>
          <div className="field"><label>Postal code</label><input className="input" value={f.zip} onChange={e => set('zip', e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>Country</label><input className="input" value={f.country} onChange={e => set('country', e.target.value)} /></div>
        <div className="bd-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-ink bd-sm" onClick={() => { onSave(f); setEditing(false); }}>Save address</button>
          <button className="btn btn-ghost bd-sm" onClick={() => { if (addr.isNew) onDelete(); else { setF(addr); setEditing(false); } }}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card bd-addr">
      <div className="bd-row-top">
        <div className="bd-num">{addr.label}{addr.isDefault && <span className="bd-default">Default</span>}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="x-btn" style={{ width: 32, height: 32 }} onClick={() => setEditing(true)} aria-label="Edit"><Icon name="edit" size={16} /></button>
          <button className="x-btn" style={{ width: 32, height: 32 }} onClick={onDelete} aria-label="Delete"><Icon name="trash" size={16} /></button>
        </div>
      </div>
      <div className="bd-addr-body">{addr.company}<br />{addr.line}<br />{addr.city} {addr.zip}<br />{addr.country}</div>
      {!addr.isDefault && <button className="bd-link" onClick={onDefault}>Set as default</button>}
    </div>
  );
}

function B2BAddresses() {
  const [addrs, setAddrs] = React.useState(() => JSON.parse(JSON.stringify(B2B_ADDRESSES)));
  const save = (id, data) => setAddrs(a => a.map(x => x.id === id ? { ...data, id, isNew: false } : x));
  const del = (id) => setAddrs(a => a.filter(x => x.id !== id));
  const setDefault = (id, kind) => setAddrs(a => a.map(x => x.kind === kind ? { ...x, isDefault: x.id === id } : x));
  const add = (kind) => setAddrs(a => [...a, { id: 'new' + Date.now(), kind, label: '', company: 'Pulse Fitness Group', line: '', city: '', zip: '', country: 'Germany', isDefault: false, isNew: true }]);

  const section = (kind, title) => (
    <div style={{ marginBottom: 28 }}>
      <div className="bd-row-top" style={{ marginBottom: 12 }}>
        <h3 className="bd-h3" style={{ margin: 0 }}>{title}</h3>
        <button className="btn btn-ghost bd-sm" onClick={() => add(kind)}><Icon name="plus" size={15} /> Add</button>
      </div>
      <div className="bd-addr-grid">
        {addrs.filter(a => a.kind === kind).map(a => (
          <AddressCard key={a.id} addr={a} onSave={(data) => save(a.id, data)} onDelete={() => del(a.id)} onDefault={() => setDefault(a.id, kind)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      <h2 className="bd-h2">Addresses</h2>
      <p className="bd-sub">Shipping and billing addresses for your business unit.</p>
      {section('shipping', 'Shipping addresses')}
      {section('billing', 'Billing addresses')}
    </div>
  );
}

// ---------------- SECURITY ----------------
function B2BSecurity({ email }) {
  const [cur, setCur] = React.useState('');
  const [nw, setNw] = React.useState('');
  const [conf, setConf] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const mismatch = conf.length > 0 && nw !== conf;
  const ok = cur && nw.length >= 8 && nw === conf;
  return (
    <div className="fade-up">
      <h2 className="bd-h2">Security</h2>
      <p className="bd-sub">Signed in as {email}.</p>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3 className="bd-h3" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="lock" size={18} style={{ color: 'var(--accent)' }} /> Change password</h3>
        <div className="field"><label>Current password</label><input className="input" type="password" value={cur} onChange={e => { setCur(e.target.value); setSaved(false); }} /></div>
        <div className="field"><label>New password</label><input className="input" type="password" value={nw} onChange={e => { setNw(e.target.value); setSaved(false); }} placeholder="At least 8 characters" /></div>
        <div className="field" style={{ marginBottom: 6 }}><label>Confirm new password</label><input className="input" type="password" value={conf} onChange={e => { setConf(e.target.value); setSaved(false); }} /></div>
        {mismatch && <div className="bd-warn">Passwords don't match.</div>}
        {saved && <div className="bd-ok"><Icon name="check" size={15} /> Password updated.</div>}
        <button className="btn btn-ink" style={{ marginTop: 14 }} disabled={!ok} onClick={() => { setSaved(true); setCur(''); setNw(''); setConf(''); }}>Update password</button>
      </div>
    </div>
  );
}

// ---------------- APPROVAL FLOWS (admin) ----------------
function B2BFlows() {
  const [flows, setFlows] = React.useState(() => JSON.parse(JSON.stringify(B2B_FLOWS)));
  const [adding, setAdding] = React.useState(false);
  const [nf, setNf] = React.useState({ name: '', trigger: '', approverRole: 'approver' });
  const toggle = (id) => setFlows(fl => fl.map(f => f.id === id ? { ...f, status: f.status === 'Active' ? 'Paused' : 'Active' } : f));
  const del = (id) => setFlows(fl => fl.filter(f => f.id !== id));
  const create = () => { if (!nf.name || !nf.trigger) return; setFlows(fl => [...fl, { id: 'f' + Date.now(), name: nf.name, trigger: +nf.trigger, approverRole: nf.approverRole, status: 'Active' }]); setNf({ name: '', trigger: '', approverRole: 'approver' }); setAdding(false); };

  return (
    <div className="fade-up">
      <div className="bd-row-top">
        <div><h2 className="bd-h2" style={{ margin: 0 }}>Approval Flows</h2><p className="bd-sub" style={{ margin: '4px 0 0' }}>Rules that route orders for sign-off.</p></div>
        <button className="btn btn-ink bd-sm" onClick={() => setAdding(a => !a)}><Icon name="plus" size={15} /> New flow</button>
      </div>

      {adding && (
        <div className="card bd-card" style={{ marginTop: 16 }}>
          <h3 className="bd-h3" style={{ marginTop: 0 }}>New approval flow</h3>
          <div className="field"><label>Flow name</label><input className="input" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} placeholder="e.g. High-value procurement" /></div>
          <div className="row-2">
            <div className="field"><label>Require approval when order total exceeds (€)</label><input className="input" value={nf.trigger} onChange={e => setNf({ ...nf, trigger: e.target.value.replace(/[^0-9]/g, '') })} placeholder="5000" /></div>
            <div className="field"><label>Approver role</label>
              <select className="input" value={nf.approverRole} onChange={e => setNf({ ...nf, approverRole: e.target.value })}>
                <option value="approver">Approver</option><option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="bd-actions"><button className="btn btn-ink bd-sm" onClick={create}>Create flow</button><button className="btn btn-ghost bd-sm" onClick={() => setAdding(false)}>Cancel</button></div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {flows.map(f => (
          <div className="card bd-card" key={f.id}>
            <div className="bd-row-top">
              <div>
                <div className="bd-num">{f.name} {f.status === 'Paused' && <span className="bd-default" style={{ background: 'var(--canvas-2)', color: 'var(--ink-3)' }}>Paused</span>}</div>
                <div className="bd-meta">Order total &gt; <b>{money(f.trigger)}</b> → approval by <b>{roleLabel(f.approverRole)}</b></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost bd-sm" onClick={() => toggle(f.id)}>{f.status === 'Active' ? 'Pause' : 'Activate'}</button>
                <button className="x-btn" style={{ width: 32, height: 32 }} onClick={() => del(f.id)} aria-label="Delete"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- BUSINESS UNIT (admin) ----------------
function B2BUnit({ unit }) {
  const [members, setMembers] = React.useState(() => JSON.parse(JSON.stringify(B2B_MEMBERS)));
  const [inviting, setInviting] = React.useState(false);
  const [nm, setNm] = React.useState({ name: '', email: '', role: 'buyer' });
  const setRole = (id, role) => setMembers(m => m.map(x => x.id === id ? { ...x, role } : x));
  const remove = (id) => setMembers(m => m.filter(x => x.id !== id));
  const invite = () => { if (!nm.name || !nm.email) return; setMembers(m => [...m, { id: 'u' + Date.now(), name: nm.name, email: nm.email, role: nm.role }]); setNm({ name: '', email: '', role: 'buyer' }); setInviting(false); };

  return (
    <div className="fade-up">
      <h2 className="bd-h2">Business Unit</h2>
      <p className="bd-sub">Manage {unit.name} and its members.</p>

      <div className="card bd-card">
        <div className="row-2">
          <div className="field"><label>Business unit name</label><input className="input" defaultValue={unit.name} /></div>
          <div className="field"><label>Unit code</label><input className="input bd-mono" defaultValue={unit.code} /></div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>Stores</label>
          <div className="chips">{unit.stores.map(s => <span key={s.id} className="chip" style={{ pointerEvents: 'none' }}><Icon name="store" size={13} /> {s.name}</span>)}</div>
        </div>
      </div>

      <div className="bd-row-top" style={{ marginTop: 22 }}>
        <h3 className="bd-h3" style={{ margin: 0 }}>Members</h3>
        <button className="btn btn-ink bd-sm" onClick={() => setInviting(a => !a)}><Icon name="plus" size={15} /> Invite member</button>
      </div>

      {inviting && (
        <div className="card bd-card" style={{ marginTop: 14 }}>
          <div className="row-2">
            <div className="field"><label>Full name</label><input className="input" value={nm.name} onChange={e => setNm({ ...nm, name: e.target.value })} /></div>
            <div className="field"><label>Email</label><input className="input" value={nm.email} onChange={e => setNm({ ...nm, email: e.target.value })} /></div>
          </div>
          <div className="field"><label>Role</label>
            <select className="input" value={nm.role} onChange={e => setNm({ ...nm, role: e.target.value })}>
              <option value="buyer">Buyer</option><option value="approver">Approver</option><option value="admin">Admin</option>
            </select>
          </div>
          <div className="bd-actions"><button className="btn btn-ink bd-sm" onClick={invite}>Send invite</button><button className="btn btn-ghost bd-sm" onClick={() => setInviting(false)}>Cancel</button></div>
        </div>
      )}

      <div className="card bd-card" style={{ marginTop: 14, padding: 0 }}>
        {members.map((m, i) => (
          <div className="bd-member" key={m.id} style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
            <span className="bd-avatar">{bdInitials(m.name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bd-num" style={{ fontSize: 14 }}>{m.name} {m.self && <span className="bd-default">You</span>}</div>
              <div className="bd-meta">{m.email}</div>
            </div>
            <select className="input bd-roleselect" value={m.role} onChange={e => setRole(m.id, e.target.value)}>
              <option value="buyer">Buyer</option><option value="approver">Approver</option><option value="admin">Admin</option>
            </select>
            <button className="x-btn" style={{ width: 32, height: 32 }} disabled={m.self} onClick={() => remove(m.id)} aria-label="Remove"><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- DASHBOARD SHELL ----------------
function tabsFor(role) {
  const t = [['orders', 'pkg', 'Orders'], ['quotes', 'card', 'Quotes'], ['lists', 'list', 'Purchase Lists'], ['addresses', 'pin', 'Addresses'], ['security', 'lock', 'Security']];
  if (role === 'approver') t.splice(1, 0, ['approvals', 'check', 'Approvals']);
  if (role === 'admin') t.splice(2, 0, ['flows', 'repeat', 'Approval Flows'], ['unit', 'building', 'Business Unit']);
  return t;
}

function B2BDashboard({ go, role, unit, addToCart, lists, setLists, quotes, setQuotes, focusQuote }) {
  const tabs = tabsFor(role);
  const [tab, setTab] = React.useState(() => focusQuote ? 'quotes' : role === 'approver' ? 'approvals' : 'orders');
  React.useEffect(() => { if (!tabs.some(t => t[0] === tab)) setTab(role === 'approver' ? 'approvals' : 'orders'); }, [role]); // eslint-disable-line

  return (
    <main className="wrap fade-up" style={{ paddingBottom: 80 }}>
      <div style={{ padding: '28px 0 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{unit.name}</div>
        <h1 className="serif" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>Hi, {USER.first}</h1>
        <p style={{ color: 'var(--ink-3)', margin: '4px 0 0' }}>Signed in as <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{roleLabel(role)}</span> · {USER.email}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 40, alignItems: 'start' }} className="acct-grid">
        <nav className="acct-tabs">
          {tabs.map(([k, ic, l]) => (
            <div key={k} className={'acct-tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}><Icon name={ic} size={18} />{l}</div>
          ))}
          <div className="acct-tab" onClick={() => go('home')} style={{ marginTop: 8, color: 'var(--ink-3)' }}><Icon name="logout" size={18} />Back to store</div>
        </nav>
        <div>
          {tab === 'orders' && <B2BOrders unitName={unit.name} />}
          {tab === 'approvals' && <B2BApprovals unitName={unit.name} />}
          {tab === 'quotes' && <B2BQuotes unitName={unit.name} me={USER.name} quotes={quotes} setQuotes={setQuotes} focusQuote={focusQuote} />}
          {tab === 'lists' && <B2BLists lists={lists} setLists={setLists} addToCart={addToCart} />}
          {tab === 'addresses' && <B2BAddresses />}
          {tab === 'security' && <B2BSecurity email={USER.email} />}
          {tab === 'flows' && <B2BFlows />}
          {tab === 'unit' && <B2BUnit unit={unit} />}
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { B2BDashboard });
