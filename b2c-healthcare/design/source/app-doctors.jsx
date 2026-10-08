function Doctors({mode}){const{bookings}=useApp();const[q,setQ]=useState('');const[spec,setSpec]=useState('');const[city,setCity]=useState('');const[today,setToday]=useState(false);
const list=DOCTORS.filter(d=>(!q||(d.name+d.spec).toLowerCase().includes(q.toLowerCase()))&&(!spec||d.spec===spec)&&(mode==='remote'||!city||d.city===city)&&(!today||(nextSlot(d,bookings)||{}).day===0));
return <><Head title={mode==='remote'?'Remote sessions':'Office visits'} sub={mode==='remote'?'See a licensed doctor by video from wherever you are. No account needed to book.':'Book an in-person appointment at a clinic near you. No account needed to book.'}>
<div className="seg" style={{marginTop:20}}><button className={mode==='remote'?'on':''} onClick={()=>go('/doctors/remote')}>Remote session</button><button className={mode==='office'?'on':''} onClick={()=>go('/doctors/office')}>Office visit</button></div></Head>
<main><div className="w"><div className="filters"><input className="inp grow" placeholder="Search by name or specialty" value={q} onChange={e=>setQ(e.target.value)}/>
<select className="inp" value={spec} onChange={e=>setSpec(e.target.value)}><option value="">All specialties</option>{SPECS.map(s=><option key={s}>{s}</option>)}</select>
{mode==='office'&&<select className="inp" value={city} onChange={e=>setCity(e.target.value)}><option value="">All cities</option>{CITIES.map(s=><option key={s}>{s}</option>)}</select>}
<label className="chk"><input type="checkbox" checked={today} onChange={e=>setToday(e.target.checked)}/>Available today</label></div>
<p className="muted" style={{margin:'24px 0 16px',fontSize:14}}>{list.length} doctor{list.length!==1&&'s'}</p>
<div className="stack">{list.map(d=>{const n=nextSlot(d,bookings);return <div key={d.id} className="dcard" onClick={()=>go('/doctor/'+d.id+'?m='+mode)}>
<div className="av">{initials(d.name)}</div><div><h3>{d.name}</h3><div className="meta">{d.spec} · {d.yrs} yrs experience</div><div className="meta">★ {d.rating} ({d.rev} reviews){mode==='office'&&' · '+d.clinic}</div></div>
<div className="stack" style={{gap:8,justifyItems:'end',textAlign:'right'}}>{n&&<span className={'badge '+(n.day===0?'b-ok':'b-info')}>{n.day===0?'Available today':'Next: '+DAYS[n.day].toLocaleDateString('en-US',{weekday:'short',day:'numeric'})}</span>}<b style={{color:'var(--color-navy-700)'}}>{money(d[mode])}</b><span className="btn sm">View profile</span></div></div>})}
{!list.length&&<div className="card muted">No doctors match. Try clearing a filter.</div>}</div></div></main></>}
function DoctorDetail({id,mode:m0}){const{bookings,user,addBooking}=useApp();const doc=DOCTORS.find(d=>d.id===id);const[mode,setMode]=useState(m0);const[di,setDi]=useState(0);const[pick,setPick]=useState(null);
if(!doc)return <div className="w"><p style={{padding:40}}>Doctor not found. <a href="#/doctors/remote">Back to search</a></p></div>;
const slots=slotsFor(doc,di,bookings);
return <main><div className="w"><div className="crumb"><a href={'#/doctors/'+m0}>← All doctors</a></div>
<div className="two"><div className="stack" style={{gap:24}}>
<div className="card row" style={{gap:24,flexWrap:'nowrap'}}><div className="av lg">{initials(doc.name)}</div><div><h1 style={{fontSize:28}}>{doc.name}</h1><div className="meta" style={{fontSize:16}}>{doc.spec}</div><div className="row" style={{marginTop:10,gap:8}}><span className="badge b-ok">★ {doc.rating} · {doc.rev} reviews</span><span className="badge b-info">{doc.yrs} yrs experience</span></div></div></div>
<div className="card stack"><h2>About</h2><p>{doc.bio}</p><dl className="kv"><dt>Education</dt><dd>{doc.edu}</dd><dt>Languages</dt><dd>{doc.langs}</dd><dt>Clinic</dt><dd>{doc.clinic}</dd></dl></div>
<div className="card stack"><h2>Patient reviews</h2>{[['“Listened carefully and explained everything clearly. Booked in two minutes.”','Verified patient · Sep 2026'],['“On time, thorough, and the prescription was waiting at the pharmacy.”','Verified patient · Aug 2026']].map(([t,a])=><div key={a}><p>{t}</p><span className="meta">{a}</span></div>)}</div></div>
<aside className="card sticky stack"><div className="row sp"><h2>Book a time</h2><b style={{color:'var(--color-navy-700)',fontSize:20}}>{money(doc[mode])}</b></div>
<div className="seg" style={{display:'flex'}}><button style={{flex:1}} className={mode==='remote'?'on':''} onClick={()=>setMode('remote')}>Video</button><button style={{flex:1}} className={mode==='office'?'on':''} onClick={()=>setMode('office')}>In office</button></div>
<div className="days" style={{margin:0}}>{DAYS.map((d,i)=><div key={i} className={'day'+(i===di?' on':'')} onClick={()=>setDi(i)}>{d.toLocaleDateString('en-US',{weekday:'short'})}<b>{d.getDate()}</b></div>)}</div>
<div className="muted" style={{fontSize:13}}>{fmtDate(dayKey(DAYS[di]))}</div>
{slots.length?<div className="slots">{slots.map(t=><button key={t} className="slot" onClick={()=>setPick(t)}>{t}</button>)}</div>:<div className="note">No times left on this day. Try another date.</div>}
<p className="meta">{user?'Booking as '+user.name:'No account needed. You can book as a guest.'}</p></aside></div></div>
{pick&&<BookModal doc={doc} mode={mode} date={dayKey(DAYS[di])} time={pick} onClose={()=>setPick(null)}/>}</main>}
function BookModal({doc,mode,date,time,onClose}){const{user,addBooking}=useApp();const[f,setF]=useState({name:user?user.name:'',email:user?user.email:'',phone:'',reason:''});const set=k=>e=>setF({...f,[k]:e.target.value});
const submit=e=>{e.preventDefault();const id='BK-'+Math.floor(10000+Math.random()*89999);addBooking({id,docId:doc.id,mode,date,time,fee:doc[mode],guest:!user,...f});go('/booked/'+id)};
return <div className="ov" onClick={onClose}><form className="modal" onClick={e=>e.stopPropagation()} onSubmit={submit}>
<div className="row sp"><h2>Confirm your booking</h2><a onClick={onClose}>Close</a></div>
<div className="note"><b>{doc.name}</b> · {mode==='remote'?'Video session':'Office visit'}<br/>{fmtDate(date)} at {time} · {money(doc[mode])}</div>
{user?<p className="meta">Booking as <b>{user.name}</b> ({user.email})</p>:<p className="meta">Booking as a guest. <a href="#/login">Sign in instead</a></p>}
{!user&&<label className="fld">Full name<input className="inp" required value={f.name} onChange={set('name')}/></label>}
<div className="f2">{!user&&<label className="fld">Email<input className="inp" type="email" required value={f.email} onChange={set('email')}/></label>}<label className="fld">Phone<input className="inp" type="tel" required value={f.phone} onChange={set('phone')} placeholder="(555) 010-2030"/></label></div>
<label className="fld">Reason for visit<textarea className="inp" required value={f.reason} onChange={set('reason')} placeholder="Briefly describe your symptoms or question"/></label>
<button className="btn full">Confirm booking</button></form></div>}
function Booked({id}){const{bookings}=useApp();const b=bookings.find(x=>x.id===id);if(!b)return <div className="w"><p style={{padding:40}}>Booking not found.</p></div>;const doc=DOCTORS.find(d=>d.id===b.docId);
return <main><div className="w" style={{maxWidth:640}}><div className="card stack" style={{marginTop:48}}><span className="badge b-ok" style={{justifySelf:'start'}}>Booking confirmed</span><h1 style={{fontSize:30}}>You're booked, {b.name.split(' ')[0]}.</h1><p>A confirmation was sent to {b.email}.</p>
<dl className="kv"><dt>Reference</dt><dd>{b.id}</dd><dt>Doctor</dt><dd>{doc.name} · {doc.spec}</dd><dt>When</dt><dd>{fmtDate(b.date)} at {b.time}</dd><dt>Type</dt><dd>{b.mode==='remote'?'Video session':'Office visit'}</dd><dt>{b.mode==='remote'?'Join':'Where'}</dt><dd>{b.mode==='remote'?'A secure video link will arrive by email 15 minutes before.':doc.clinic}</dd><dt>Fee</dt><dd>{money(b.fee)} · pay at the visit</dd></dl>
{b.guest&&<div className="note">Booked as a guest. <a href="#/login">Create an account</a> to manage appointments and see prescriptions and lab results.</div>}
<div className="row"><a className="btn" href={user_()?'#/account/appointments':'#/doctors/remote'}>{user_()?'My appointments':'Book another'}</a><a className="btn o" href="Malva Healthcare.html">Back to home</a></div></div></div></main>}
const user_=()=>{try{return JSON.parse(localStorage.getItem('malva_user'))}catch(e){return null}};
Object.assign(window,{Doctors,DoctorDetail,Booked});
