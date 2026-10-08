const {useState,useEffect,createContext,useContext,useMemo}=React;
const Ctx=createContext(null);const useApp=()=>useContext(Ctx);
const go=p=>{location.hash=p};
function useHash(){const[h,setH]=useState(location.hash.slice(1)||'/');useEffect(()=>{const f=()=>{setH(location.hash.slice(1)||'/');window.scrollTo(0,0)};addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[]);return h}
function useStore(key,init){const[v,setV]=useState(()=>{try{const s=JSON.parse(localStorage.getItem(key));return s==null?init:s}catch(e){return init}});useEffect(()=>{localStorage.setItem(key,JSON.stringify(v))},[v]);return[v,setV]}
const money=n=>'$'+Number(n).toFixed(2);
const initials=n=>n.replace(/^Dr\.\s*/,'').split(' ').map(s=>s[0]).slice(0,2).join('');
const DOCTORS=[
{id:'d1',name:'Dr. Amara Okafor',spec:'General Practice',yrs:12,rating:4.9,rev:312,remote:35,office:55,clinic:'Malva Clinic · Midtown',city:'New York',langs:'English, Igbo',edu:'MD, Johns Hopkins University',bio:'Family doctor focused on preventive care, chronic condition management and same-day concerns such as infections, rashes and fatigue.'},
{id:'d2',name:'Dr. Daniel Reyes',spec:'Dermatology',yrs:9,rating:4.8,rev:204,remote:60,office:90,clinic:'Skin & Co · Chelsea',city:'New York',langs:'English, Spanish',edu:'MD, NYU Grossman School of Medicine',bio:'Treats acne, eczema, psoriasis and skin checks. Photo-based remote reviews are available before your session.'},
{id:'d3',name:'Dr. Priya Nair',spec:'Psychiatry',yrs:15,rating:5.0,rev:158,remote:70,office:110,clinic:'Calm Practice · Brooklyn Heights',city:'New York',langs:'English, Hindi, Malayalam',edu:'MD, Columbia University',bio:'Supports adults with anxiety, depression, ADHD and sleep problems through therapy and medication management.'},
{id:'d4',name:'Dr. Marcus Lee',spec:'Pediatrics',yrs:11,rating:4.9,rev:421,remote:45,office:70,clinic:'Little Steps Pediatrics · Austin',city:'Austin',langs:'English, Mandarin',edu:'MD, Baylor College of Medicine',bio:'Well-child visits, vaccinations, and care for common childhood illnesses, with calm, parent-friendly guidance.'},
{id:'d5',name:'Dr. Sofia Marchetti',spec:'Cardiology',yrs:18,rating:4.9,rev:187,remote:95,office:140,clinic:'Heartline Center · Austin',city:'Austin',langs:'English, Italian',edu:'MD, University of Texas Southwestern',bio:'Blood pressure, cholesterol, palpitations and long-term heart health, including review of lab and ECG results.'},
{id:'d6',name:'Dr. James Whitfield',spec:'Orthopedics',yrs:14,rating:4.7,rev:133,remote:80,office:125,clinic:'MoveWell Ortho · Chicago',city:'Chicago',langs:'English',edu:'MD, Northwestern University',bio:'Joint, back and sports injuries. Remote sessions cover imaging review and rehab planning.'},
{id:'d7',name:'Dr. Leila Haddad',spec:'Gynecology',yrs:10,rating:4.9,rev:265,remote:65,office:100,clinic:'Women’s Health Studio · Chicago',city:'Chicago',langs:'English, Arabic, French',edu:'MD, University of Chicago',bio:'Routine exams, contraception, pregnancy planning and menopause care in a private, unhurried setting.'},
{id:'d8',name:'Dr. Tomás Alvarez',spec:'General Practice',yrs:7,rating:4.6,rev:96,remote:30,office:50,clinic:'Malva Clinic · Austin Central',city:'Austin',langs:'English, Spanish',edu:'MD, University of Texas Health Science Center',bio:'Quick, practical primary care for adults, including travel health, sick notes and prescription renewals.'}];
const SPECS=[...new Set(DOCTORS.map(d=>d.spec))];const CITIES=[...new Set(DOCTORS.map(d=>d.city))];
const BASE=['09:00','09:30','10:00','10:30','11:30','13:00','14:30','15:00','16:00','17:30'];
const dayKey=d=>d.toISOString().slice(0,10);
const DAYS=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);return d});
const slotsFor=(doc,di,booked)=>{const n=DOCTORS.indexOf(doc);return BASE.filter((t,k)=>(n*7+di*3+k*2)%3!==0&&!booked.some(b=>b.docId===doc.id&&b.date===dayKey(DAYS[di])&&b.time===t))};
const nextSlot=(doc,booked)=>{for(let i=0;i<7;i++){const s=slotsFor(doc,i,booked);if(s.length)return{day:i,time:s[0]}}return null};
const fmtDate=k=>new Date(k+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const RX={
'RX-48213':{doctor:'Dr. Amara Okafor',date:'2026-10-02',patient:'Sam Rivera',refills:0,meds:[{id:'m1',name:'Amoxicillin 500 mg capsules',sig:'1 capsule, 3× daily for 7 days',qty:21,price:14.5},{id:'m2',name:'Ibuprofen 400 mg tablets',sig:'1 tablet every 8 h as needed, with food',qty:20,price:6.2},{id:'m3',name:'Cetirizine 10 mg tablets',sig:'1 tablet daily',qty:30,price:8.9}]},
'RX-77102':{doctor:'Dr. Sofia Marchetti',date:'2026-09-24',patient:'Sam Rivera',refills:3,meds:[{id:'m4',name:'Atorvastatin 20 mg tablets',sig:'1 tablet nightly',qty:30,price:18.75},{id:'m5',name:'Lisinopril 10 mg tablets',sig:'1 tablet each morning',qty:30,price:11.4}]}};
const LABS=[
{id:'l1',name:'Complete blood count',date:'2026-10-03',status:'ready',by:'Dr. Amara Okafor',lab:'Quest Diagnostics · Midtown',note:'All values are within the expected range. No action needed.',res:[['Hemoglobin',14.2,'g/dL',12,17.5],['White blood cells',6.8,'×10³/µL',4,11],['Platelets',262,'×10³/µL',150,400],['Hematocrit',42,'%',36,52]]},
{id:'l2',name:'Lipid panel',date:'2026-09-24',status:'ready',by:'Dr. Sofia Marchetti',lab:'Quest Diagnostics · Midtown',note:'LDL cholesterol is above the target. Your cardiologist has adjusted your atorvastatin and will recheck in 12 weeks.',res:[['Total cholesterol',221,'mg/dL',0,200],['LDL cholesterol',148,'mg/dL',0,100],['HDL cholesterol',52,'mg/dL',40,100],['Triglycerides',118,'mg/dL',0,150]]},
{id:'l3',name:'HbA1c',date:'2026-09-24',status:'ready',by:'Dr. Sofia Marchetti',lab:'Quest Diagnostics · Midtown',note:'Blood sugar control is in the normal range.',res:[['HbA1c',5.4,'%',4,5.7],['Estimated average glucose',108,'mg/dL',70,117]]},
{id:'l4',name:'Vitamin D (25-OH)',date:'2026-08-12',status:'ready',by:'Dr. Amara Okafor',lab:'Labcorp · Chelsea',note:'Level is low. Consider a daily supplement of 2,000 IU and retest in 3 months.',res:[['25-OH Vitamin D',19,'ng/mL',30,100]]},
{id:'l5',name:'Thyroid panel (TSH)',date:'2026-10-06',status:'processing',by:'Dr. Amara Okafor',lab:'Labcorp · Chelsea',note:'Your sample was received. Results usually arrive within 48 hours.',res:[]}];
const flag=(v,lo,hi)=>v<lo?'lo':v>hi?'hi':'ok';
function Nav({route}){const{user,cart}=useApp();const L=[['/doctors/remote','Remote sessions',/^\/(doctors\/remote)/],['/doctors/office','Office visits',/^\/doctors\/office/],['/prescriptions','Prescriptions',/^\/(prescriptions|cart|checkout|order)/],['/labs','Lab tests',/^\/(labs|account\/labs)/]];
return <nav className="top"><div className="w"><a className="logo" href="Malva Healthcare.html"><i>M</i>Malva</a><div className="l">{L.map(([h,t,re])=><a key={h} className={re.test(route)?'on':''} href={'#'+h}>{t}</a>)}</div>
<a className="btn o sm cartb" href="#/cart">Cart{cart.length>0&&<b>{cart.length}</b>}</a>
{user?<a className="row" href="#/account" style={{gap:8}}><span className="av me">{initials(user.name)}</span></a>:<a className="btn sm" href="#/login">Sign in</a>}</div></nav>}
function Foot(){return <footer className="f"><div className="w row sp"><span>© 2026 Malva Healthcare</span><span>Not for emergencies — call your local emergency number.</span></div></footer>}
function Head({title,sub,children}){return <div className="phead"><div className="w"><h1>{title}</h1>{sub&&<p>{sub}</p>}{children}</div></div>}
function Login({reason,next}){const{setUser}=useApp();const[mode,setMode]=useState('in');const[name,setName]=useState('');const[email,setEmail]=useState('sam.rivera@example.com');
const submit=e=>{e.preventDefault();setUser({name:mode==='up'&&name?name:'Sam Rivera',email});if(next)go(next)};
return <div className="w"><form className="card login" onSubmit={submit}><div><h2>{mode==='in'?'Sign in to Malva':'Create your account'}</h2>{reason&&<p className="muted" style={{marginTop:6,fontSize:14}}>{reason}</p>}</div>
{mode==='up'&&<label className="fld">Full name<input className="inp" value={name} onChange={e=>setName(e.target.value)} placeholder="Sam Rivera" required/></label>}
<label className="fld">Email<input className="inp" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
<label className="fld">Password<input className="inp" type="password" defaultValue="demo1234" required/></label>
<button className="btn full">{mode==='in'?'Sign in':'Create account'}</button>
<p style={{fontSize:14,textAlign:'center'}}>{mode==='in'?<>New to Malva? <a onClick={()=>setMode('up')}>Create an account</a></>:<>Have an account? <a onClick={()=>setMode('in')}>Sign in</a></>}</p>
<p className="note">Demo: any email and password will sign you in.</p></form></div>}
function Protected({user,reason,route,children}){return user?children:<Login reason={reason} next={route}/>}
Object.assign(window,{Ctx,useApp,go,useHash,useStore,money,initials,DOCTORS,SPECS,CITIES,DAYS,dayKey,slotsFor,nextSlot,fmtDate,RX,LABS,flag,Nav,Foot,Head,Login,Protected});
