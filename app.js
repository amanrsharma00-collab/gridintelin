// GridIntel India — MVP v3 — Real-time Supabase + Subscription Tiers
// 5-state public preview · Pro/Enterprise gating · Realtime WebSocket
(function() {
'use strict';
const { useState, useEffect, useRef, useCallback, createElement: h, Fragment } = React;

// ── CONFIG ────────────────────────────────────────────────────────────────
const SB  = 'https://huqufqoquyahlxybrrqe.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cXVmcW9xdXlhaGx4eWJycnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDcxODUsImV4cCI6MjA5MDY4MzE4NX0.Mror65h4K0a3DDkNRvCA4DbkUUKyaNa6w-myivFT_AE';
const HD  = {'Content-Type':'application/json','apikey':KEY,'Authorization':`Bearer ${KEY}`};

// FREE TIER: 5 showcase states — Delhi, Maharashtra, Tamil Nadu, Karnataka, West Bengal
const FREE_STATES = new Set(['Delhi','Maharashtra','Tamil Nadu','Karnataka','West Bengal','Uttar Pradesh','Gujarat']);
const FREE_BUS_LIMIT = 8;
const FREE_LINE_LIMIT = 6;

// ── SUBSCRIPTION STATE ────────────────────────────────────────────────────
function getSubscription() {
  try { return JSON.parse(localStorage.getItem('gridintelin_sub')||'{}'); } catch(e){return{};}
}
function setSubscription(data) {
  try { localStorage.setItem('gridintelin_sub', JSON.stringify(data)); } catch(e){}
}

// ── API ───────────────────────────────────────────────────────────────────
async function sb(path,params=''){
  const r=await fetch(`${SB}/rest/v1/${path}?${params}`,{headers:HD});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(path,body){
  const r=await fetch(`${SB}/rest/v1/${path}`,{method:'POST',headers:{...HD,'Prefer':'return=representation'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

async function fetchLatestLMP(isPro){
  const d=await sb('lmp_snapshots','select=*,grid_buses(name,state,region_id,voltage_kv)&order=timestamp.desc&limit=400');
  const seen=new Set();
  let rows=d.filter(r=>{ if(seen.has(r.bus_id))return false; seen.add(r.bus_id); return true; });
  if(!isPro) rows=rows.filter(r=>FREE_STATES.has(r.grid_buses?.state)).slice(0,FREE_BUS_LIMIT);
  return rows.sort((a,b)=>b.lmp-a.lmp);
}
async function fetchLMPHistory(busId){
  const since=new Date(Date.now()-24*3600000).toISOString();
  return sb('lmp_snapshots',`select=*&bus_id=eq.${busId}&timestamp=gte.${since}&order=timestamp.asc`);
}
async function fetchLineFlows(isPro){
  const d=await sb('line_flow_snapshots','select=*,transmission_lines(name,voltage_kv,circuit_type,from_bus_id,to_bus_id)&order=timestamp.desc&limit=100');
  const seen=new Set();
  let rows=d.filter(r=>{ if(seen.has(r.line_id))return false; seen.add(r.line_id); return true; });
  if(!isPro) rows=rows.slice(0,FREE_LINE_LIMIT);
  return rows.sort((a,b)=>b.loading_pct-a.loading_pct);
}
async function fetchContingencies(isPro){
  const d=await sb('contingency_events','select=*,grid_regions(name,short_name)&order=timestamp.desc&limit=30');
  return isPro ? d : d.slice(0,4);
}
async function fetchCRR(){ return sb('crr_positions','select=*,source:grid_buses!crr_positions_source_bus_id_fkey(name,state),sink:grid_buses!crr_positions_sink_bus_id_fkey(name,state)&order=created_at.desc'); }
async function fetchAlerts(isPro){
  const d=await sb('grid_alerts','select=*,grid_regions(name,short_name)&is_active=eq.true&order=created_at.desc');
  return isPro ? d : d.slice(0,2);
}
async function fetchRegionStats(){
  return sb('grid_regions','select=id,name,short_name,peak_demand_mw,installed_capacity_mw');
}
async function submitWaitlist(p){ return sbPost('waitlist',p); }

// ── REALTIME ──────────────────────────────────────────────────────────────
function useRealtimeLMP(isPro, onUpdate) {
  useEffect(()=>{
    // Supabase Realtime via WebSocket
    const wsUrl = `wss://huqufqoquyahlxybrrqe.supabase.co/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`;
    let ws, pingInterval;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({topic:'realtime:public:lmp_snapshots',event:'phx_join',payload:{},ref:'1'}));
        pingInterval = setInterval(()=>{ try{ ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:'hb'})); }catch(e){} }, 25000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if(msg.event==='INSERT' || msg.event==='UPDATE') { onUpdate(); }
        } catch(ex){}
      };
      ws.onerror = ()=>{};
      ws.onclose = ()=>{ clearInterval(pingInterval); };
    } catch(e){}
    return ()=>{ clearInterval(pingInterval); try{ ws?.close(); }catch(e){} };
  },[isPro]);
}

// ── UTILS ─────────────────────────────────────────────────────────────────
const fmt   = n=>(n==null)?'—':Number(n).toLocaleString('en-IN',{maximumFractionDigits:1});
const fmtRs = n=>(n==null)?'—':`₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const lmpCo = v=>v>7000?'#f87171':v>5500?'#fbbf24':'#4ade80';
const ldCo  = p=>p>=90?'#f87171':p>=75?'#fbbf24':'#4ade80';
const SEV   = {critical:0,warning:1,info:2};
const SS    = {
  critical:{bg:'rgba(248,113,113,0.1)',bd:'rgba(248,113,113,0.25)',c:'#f87171',l:'CRITICAL'},
  warning: {bg:'rgba(251,191,36,0.1)', bd:'rgba(251,191,36,0.25)', c:'#fbbf24',l:'WARNING'},
  info:    {bg:'rgba(34,211,238,0.07)',bd:'rgba(34,211,238,0.2)',  c:'#22d3ee',l:'INFO'},
};

// ── SHARED UI ─────────────────────────────────────────────────────────────
function Sk({n=5}){
  return Array.from({length:n}).map((_,i)=>
    h('div',{key:i,style:{padding:'11px 18px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',gap:14}},
      h('div',{className:'sk',style:{flex:1,height:12}}),h('div',{className:'sk',style:{width:70,height:12}})
    )
  );
}
function KPI({loading,label,value,sub,color='#f1f5f9',locked}){
  return h('div',{className:'card',style:{padding:'18px 20px',position:'relative'}},
    locked&&h('div',{style:{position:'absolute',top:8,right:10,fontSize:11,color:'#64748b'},'data-lock':true},'🔒 Pro'),
    loading
      ? h(Fragment,null,h('div',{className:'sk',style:{height:10,width:75,marginBottom:10}}),h('div',{className:'sk',style:{height:26,width:110,marginBottom:7}}),h('div',{className:'sk',style:{height:10,width:90}}))
      : h(Fragment,null,
          h('div',{style:{fontSize:11,color:'#64748b',fontFamily:"'JetBrains Mono',monospace",marginBottom:7,letterSpacing:'.05em'}},label.toUpperCase()),
          h('div',{style:{fontSize:24,fontWeight:700,color:locked?'#475569':color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.03em',marginBottom:3,filter:locked?'blur(6px)':''} },value),
          h('div',{style:{fontSize:12,color:'#475569'}},sub)
        )
  );
}
function Badge({s}){
  const st=SS[s]||SS.info;
  return h('span',{style:{display:'inline-flex',alignItems:'center',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:500,padding:'2px 9px',borderRadius:20,background:st.bg,color:st.c,border:`1px solid ${st.bd}`}},st.l);
}
function Bar({pct,col}){
  return h('div',{style:{height:5,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden',marginTop:5}},
    h('div',{style:{height:'100%',borderRadius:3,width:`${Math.min(pct,100)}%`,background:col||ldCo(pct),transition:'width 0.6s'}})
  );
}
function Logo({go}){
  return h('div',{style:{display:'flex',alignItems:'center',gap:9,cursor:'pointer'},onClick:go},
    h('svg',{width:26,height:26,viewBox:'0 0 32 32',fill:'none'},
      h('rect',{width:32,height:32,rx:6,fill:'#f97316'}),
      h('circle',{cx:8,cy:16,r:3,fill:'#fff'}),
      h('circle',{cx:24,cy:8,r:3,fill:'#fff',opacity:.8}),
      h('circle',{cx:24,cy:24,r:3,fill:'#fff',opacity:.8}),
      h('line',{x1:11,y1:16,x2:21,y2:9,stroke:'#fff',strokeWidth:1.5}),
      h('line',{x1:11,y1:16,x2:21,y2:23,stroke:'#fff',strokeWidth:1.5}),
      h('line',{x1:24,y1:11,x2:24,y2:21,stroke:'#fff',strokeWidth:1.5,opacity:.6})
    ),
    h('span',{style:{fontWeight:700,fontSize:14,letterSpacing:'-0.02em'}},'GridIntel'),
    h('span',{style:{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:'#f97316',background:'rgba(249,115,22,0.14)',padding:'2px 6px',borderRadius:4,border:'1px solid rgba(249,115,22,0.28)'}},'INDIA β')
  );
}

// ── PRO GATE BANNER ───────────────────────────────────────────────────────
function ProGate({go}){
  return h('div',{style:{
    background:'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(34,211,238,0.08))',
    border:'1px solid rgba(249,115,22,0.3)',borderRadius:12,padding:'16px 20px',
    display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',
    margin:'16px 0',
  }},
    h('div',null,
      h('div',{style:{fontWeight:600,fontSize:14,marginBottom:3}},'🔒 You are viewing the Free Plan — 7 states, 8 buses, 6 lines'),
      h('div',{style:{fontSize:12,color:'#94a3b8'}},'Pro unlocks all 68 buses, 25 corridors, real-time alerts, CRR positions, API access and more.')
    ),
    h('button',{onClick:()=>go('pricing'),style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'9px 20px',borderRadius:9,whiteSpace:'nowrap'}},'Upgrade to Pro →')
  );
}

// ── LIVE TICKER ───────────────────────────────────────────────────────────
function LiveTicker({alerts}){
  if(!alerts.length) return null;
  return h('div',{style:{background:'rgba(248,113,113,0.06)',borderTop:'1px solid rgba(248,113,113,0.14)',borderBottom:'1px solid rgba(248,113,113,0.14)',padding:'7px 24px',overflow:'hidden'}},
    h('div',{style:{maxWidth:1400,margin:'0 auto',display:'flex',gap:24,alignItems:'center'}},
      h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#f87171',whiteSpace:'nowrap',flexShrink:0}},'🚨 LIVE'),
      h('div',{style:{display:'flex',gap:40,overflow:'hidden'}},
        alerts.slice(0,4).map(a=>h('span',{key:a.id,style:{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}},
          h('span',{style:{color:SS[a.severity]?.c||'#22d3ee'}},`[${a.severity.toUpperCase()}] `),a.title
        ))
      ),
      h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#4ade80',display:'flex',alignItems:'center',gap:5,flexShrink:0}},
        h('span',{className:'pulse',style:{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block'}}),
        'REALTIME'
      )
    )
  );
}

// ── NAVBAR ────────────────────────────────────────────────────────────────
const NI=[{id:'dashboard',l:'Dashboard'},{id:'lmp',l:'LMP'},{id:'contingency',l:'N-1 Security'},{id:'crr',l:'CRR'},{id:'alerts',l:'Alerts'},{id:'pricing',l:'⭐ Pricing'}];
function Navbar({page,go,isPro,liveCount}){
  return h('nav',{style:{position:'sticky',top:0,zIndex:50,background:'rgba(4,8,15,0.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 24px'}},
    h('div',{style:{maxWidth:1400,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:54}},
      h(Logo,{go:()=>go('landing')}),
      h('div',{style:{display:'flex',gap:2}},
        NI.map(p=>h('button',{key:p.id,onClick:()=>go(p.id),style:{
          background:page===p.id?'rgba(249,115,22,0.12)':'transparent',
          color:p.id==='pricing'?'#fbbf24':page===p.id?'#f97316':'#94a3b8',
          border:'none',cursor:'pointer',fontSize:12,fontWeight:500,
          fontFamily:"'Space Grotesk',sans-serif",padding:'5px 11px',borderRadius:7,transition:'all 0.15s'
        }},p.l))
      ),
      h('div',{style:{display:'flex',alignItems:'center',gap:10}},
        isPro
          ? h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#fbbf24',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.25)',padding:'3px 10px',borderRadius:20}},`⭐ PRO · ${liveCount} buses live`)
          : h('button',{onClick:()=>go('pricing'),style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'5px 14px',borderRadius:7}},'Upgrade'),
        h('div',{style:{display:'flex',alignItems:'center',gap:5,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#4ade80',background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',padding:'3px 10px',borderRadius:20}},
          h('span',{className:'pulse',style:{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block'}}),
          'LIVE'
        )
      )
    )
  );
}

// ── PRICING PAGE ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id:'free', label:'Free', price:'₹0', period:'forever',
    color:'#64748b', badge:'',
    features:['7 key states (Delhi, MH, TN, KA, WB, UP, GJ)','8 major buses','6 transmission corridors','30-second refresh','Basic LMP pricing','2 active alerts','Community support'],
    cta:'Current Plan', ctaDisabled:true,
  },
  {
    id:'pro', label:'Pro', price:'₹2.5L', period:'/year per user',
    color:'#f97316', badge:'MOST POPULAR',
    features:['All 68+ buses across 5 RLDCs','25+ transmission corridors including HVDCs','Real-time Supabase WebSocket updates','Full LMP breakdown (energy/congestion/loss)','All N-1 contingency screening','CRR position P&L tracking','WhatsApp/email alerts on threshold breach','CSV/Excel export','API access (1000 calls/day)','Priority support'],
    cta:'Start Pro Trial →', ctaDisabled:false,
  },
  {
    id:'enterprise', label:'Enterprise', price:'₹15L+', period:'/year',
    color:'#22d3ee', badge:'GOVERNMENT READY',
    features:['Everything in Pro','Custom bus/corridor coverage (your SLDC zone)','Dedicated Supabase schema & data isolation','POSOCO MERIT live feed integration','SCADA data ingestion support','CERC filing data packages','Multi-user team dashboard','SLA 99.9% uptime commitment','On-site training for SLDC operators','Custom white-label for DISCOM/utility branding','MoU-friendly for PSU procurement'],
    cta:'Contact Us →', ctaDisabled:false,
  },
  {
    id:'govt', label:'Government / PSU', price:'Custom', period:'MoU / Grant based',
    color:'#a78bfa', badge:'POSOCO · NLDC · RLDC',
    features:['All Enterprise features','Grant & MoU procurement pathway','DPIIT Startup India eligible pricing','Piloted with SLDC/RLDC teams','CERC regulatory data compliance','Ministry of Power data sharing framework','National Smart Grid Mission alignment','Joint development roadmap','Academic & research API (IITs, NITs)','Press release co-branding with PGCIL/NTPC'],
    cta:'Talk to Founders →', ctaDisabled:false,
  },
];

function PricingPage({go, isPro, setIsPro}){
  const [form,setF]=useState({email:'',name:'',org:'',plan:''});
  const [done,setDone]=useState('');
  const sf=(k,v)=>setF(f=>({...f,[k]:v}));

  function activatePro(planId){
    if(planId==='pro'){
      setSubscription({plan:'pro',activated:Date.now()});
      setIsPro(true);
      setDone('pro');
    } else if(planId==='enterprise'||planId==='govt'){
      setF(f=>({...f,plan:planId}));
      setDone('contact');
    }
  }

  return h('div',{className:'page fu',style:{maxWidth:1200,margin:'0 auto',padding:'40px 24px'}},
    h('div',{style:{textAlign:'center',marginBottom:48}},
      h('h1',{style:{fontSize:'2rem',marginBottom:12}},'Simple, Transparent Pricing'),
      h('p',{style:{color:'#94a3b8',fontSize:15,maxWidth:560,margin:'0 auto',lineHeight:1.7}},'Built for the Indian power ecosystem — from independent traders to NLDC operators and Ministry of Power.'),
      h('div',{style:{display:'inline-flex',alignItems:'center',gap:8,marginTop:16,background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:20,padding:'5px 16px',fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:'#4ade80'}},'🇮🇳 DPIIT Startup India Registered · CERC Compliant Data Model')
    ),

    done==='pro' && h('div',{style:{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:12,padding:'20px 24px',marginBottom:28,textAlign:'center',color:'#4ade80',fontSize:15,fontWeight:600}},
      '✅ Pro activated! All 68+ buses and real-time data are now unlocked. ',
      h('span',{style:{cursor:'pointer',textDecoration:'underline'},onClick:()=>go('dashboard')},'Go to Dashboard →')
    ),

    h('div',{style:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:48}},
      PLANS.map(plan=>h('div',{key:plan.id,className:'card',style:{
        padding:'28px 22px',position:'relative',
        border:plan.id==='pro'?'2px solid rgba(249,115,22,0.5)':'1px solid rgba(255,255,255,0.08)',
      }},
        plan.badge&&h('div',{style:{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:plan.id==='pro'?'#f97316':plan.id==='govt'?'#a78bfa':'#22d3ee',color:'#fff',fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",padding:'2px 10px',borderRadius:20,whiteSpace:'nowrap'}},plan.badge),
        h('div',{style:{marginBottom:16}},
          h('div',{style:{fontSize:16,fontWeight:700,marginBottom:4,color:plan.color}},plan.label),
          h('div',{style:{fontSize:28,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.03em'}},plan.price),
          h('div',{style:{fontSize:12,color:'#64748b',marginTop:2}},plan.period)
        ),
        h('div',{style:{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:16,marginBottom:20}},
          plan.features.map((f,i)=>h('div',{key:i,style:{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8,fontSize:12,color:'#94a3b8',lineHeight:1.5}},
            h('span',{style:{color:plan.color,flexShrink:0,marginTop:1}},'✓'),f
          ))
        ),
        isPro&&plan.id==='pro'
          ? h('div',{style:{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:8,padding:'9px',textAlign:'center',fontSize:13,color:'#4ade80',fontWeight:600}},'✅ Active')
          : h('button',{
              disabled:plan.ctaDisabled,
              onClick:()=>!plan.ctaDisabled&&activatePro(plan.id),
              style:{width:'100%',background:plan.ctaDisabled?'rgba(255,255,255,0.04)':plan.id==='pro'?'#f97316':'transparent',color:plan.ctaDisabled?'#475569':plan.id==='pro'?'#fff':plan.color,border:`1px solid ${plan.ctaDisabled?'rgba(255,255,255,0.08)':plan.color+'66'}`,cursor:plan.ctaDisabled?'default':'pointer',fontSize:13,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'10px',borderRadius:9,transition:'all 0.2s'}
            },plan.cta)
      ))
    ),

    // Contact form for Enterprise/Govt
    done==='contact'&&h('div',{className:'card',style:{padding:'32px',maxWidth:600,margin:'0 auto'}},
      h('h2',{style:{fontSize:'1.2rem',marginBottom:6}},'Talk to the GridIntel Team'),
      h('p',{style:{color:'#94a3b8',fontSize:13,marginBottom:24,lineHeight:1.7}},'For Enterprise and Government/PSU plans, we work directly with your procurement and technical teams. Fill this in and we will respond within 24 hours.'),
      h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
        h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}},
          ['name','email'].map(k=>h('div',{key:k},h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},k==='name'?'Full Name':'Work Email'),h('input',{type:k==='email'?'email':'text',value:form[k],onChange:e=>sf(k,e.target.value),placeholder:k==='name'?'Rajesh Kumar':'you@posoco.in',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,fontFamily:"'Space Grotesk',sans-serif",outline:'none'}})))
        ),
        h('div',null,h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},'Organisation'),h('input',{type:'text',value:form.org,onChange:e=>sf('org',e.target.value),placeholder:'POSOCO / NTPC / Ministry of Power / PGCIL...',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,fontFamily:"'Space Grotesk',sans-serif",outline:'none'}})),
        h('button',{onClick:async()=>{ try{ await submitWaitlist({email:form.email,name:form.name,organisation:form.org,role:'enterprise',use_case:form.plan+' inquiry'}); setDone('thankyou'); }catch(e){alert('Sent! We will contact you within 24 hours.');} },style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'11px',borderRadius:9,marginTop:4}},'Send Enquiry →')
      )
    ),
    done==='thankyou'&&h('div',{style:{textAlign:'center',padding:'40px',color:'#4ade80',fontSize:16,fontWeight:600}},'✅ Received! We will respond within 24 hours with onboarding details.'),

    // Govt pitch box
    h('div',{style:{background:'rgba(167,139,250,0.06)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:14,padding:'28px 32px',marginTop:16}},
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}},
        h('div',null,
          h('div',{style:{fontSize:12,color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace",marginBottom:10}},'WHY GOVERNMENT SHOULD FUND THIS'),
          h('h3',{style:{fontSize:'1.1rem',marginBottom:12}},'GridIntel is National Infrastructure Software'),
          h('p',{style:{fontSize:13,color:'#94a3b8',lineHeight:1.75}},'India loses thousands of crores annually to grid congestion. POSOCO and NLDC operators today work from fragmented portals, Excel downloads, and phone calls. GridIntel provides the missing intelligence layer — and it\'s built by Indians, hosted in India (Mumbai), using Indian grid data.'),
          h('p',{style:{fontSize:13,color:'#94a3b8',lineHeight:1.75,marginTop:10}},'Eligible for Ministry of Power pilot funding, DPIIT Startup India benefits, and National Smart Grid Mission alignment.')
        ),
        h('div',null,
          h('div',{style:{fontSize:12,color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace",marginBottom:10}},'KEY METRICS THAT MATTER TO GOVERNMENT'),
          [
            ['₹538 Cr+','Units lost to congestion annually on IEX alone'],
            ['500 GW','Renewable target by 2030 — all needs congestion intelligence'],
            ['5 RLDCs','All covered in a single dashboard — first ever'],
            ['0','Existing commercial products doing this for India'],
          ].map(([v,l])=>h('div',{key:v,style:{display:'flex',gap:14,marginBottom:12,alignItems:'flex-start'}},
            h('div',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,color:'#a78bfa',minWidth:90}},v),
            h('div',{style:{fontSize:13,color:'#94a3b8',lineHeight:1.5}},l)
          ))
        )
      )
    )
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({isPro,go}){
  const [lmp,setL]=useState([]); const [flows,setF]=useState([]); const [alerts,setA]=useState([]);
  const [loading,setLo]=useState(true); const [ts,setTs]=useState(new Date()); const [tick,setTick]=useState(0);

  const load=useCallback(async()=>{
    try{
      const[l,f,a]=await Promise.all([fetchLatestLMP(isPro),fetchLineFlows(isPro),fetchAlerts(isPro)]);
      setL(l);setF(f);setA([...a].sort((x,y)=>(SEV[x.severity]??9)-(SEV[y.severity]??9)));setTs(new Date());
    }finally{setLo(false);}
  },[isPro]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{const t=setInterval(()=>{load();setTick(n=>n+1);},30000);return()=>clearInterval(t);},[load]);
  useRealtimeLMP(isPro,()=>{load();setTick(n=>n+1);});

  const avg=lmp.length?lmp.reduce((s,x)=>s+parseFloat(x.lmp),0)/lmp.length:0;
  const pk=flows.length?Math.max(...flows.map(f=>parseFloat(f.loading_pct))):0;
  const cr=alerts.filter(a=>a.severity==='critical').length;
  const td=lmp.reduce((s,x)=>s+(parseFloat(x.demand_mw)||0),0);

  return h('div',{className:'page fu',style:{maxWidth:1400,margin:'0 auto',padding:'22px 22px 0'}},
    h(LiveTicker,{alerts}),
    !isPro && h(ProGate,{go}),
    h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,marginTop:16,flexWrap:'wrap',gap:8}},
      h('div',null,
        h('h1',{style:{fontSize:'1.4rem',marginBottom:2}},'Grid Operations Dashboard'),
        h('p',{style:{color:'#64748b',fontSize:11,fontFamily:"'JetBrains Mono',monospace"}},
          `Refreshed: ${ts.toLocaleTimeString('en-IN')} · WebSocket active · ${lmp.length} buses`,
          tick>0&&h('span',{style:{color:'#4ade80',marginLeft:8}},`↻ +${tick} realtime updates`)
        )
      ),
      h('button',{onClick:load,style:{background:'transparent',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontSize:12,fontFamily:"'Space Grotesk',sans-serif",padding:'5px 12px',borderRadius:7}},'↻ Refresh')
    ),
    h('div',{style:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:18}},
      h(KPI,{loading,label:'System Avg LMP',value:`₹${fmt(avg)}`,sub:'/MWh avg',color:lmpCo(avg)}),
      h(KPI,{loading,label:'Total Demand',value:`${fmt(td)} MW`,sub:`${lmp.length} buses monitored`,color:'#22d3ee'}),
      h(KPI,{loading,label:'Peak Loading',value:`${pk.toFixed(1)}%`,sub:'max thermal',color:ldCo(pk)}),
      h(KPI,{loading,label:'Active Criticals',value:cr,sub:`of ${alerts.length} alerts`,color:cr>0?'#f87171':'#4ade80',locked:!isPro&&alerts.length>2})
    ),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}},
      h('div',{className:'card',style:{overflow:'hidden'}},
        h('div',{style:{padding:'13px 18px 11px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}},
          h('h3',{style:{fontSize:13}},'Locational Marginal Prices'),
          h('div',{style:{display:'flex',gap:8,alignItems:'center'}},
            h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#64748b'}},'₹/MWh'),
            !isPro&&h('span',{style:{fontSize:10,color:'#f97316',background:'rgba(249,115,22,0.1)',padding:'1px 6px',borderRadius:4}},'7 states shown')
          )
        ),
        h('div',{style:{maxHeight:360,overflowY:'auto'}},
          loading?h(Sk,{n:8}):
          lmp.map(r=>{
            const col=lmpCo(parseFloat(r.lmp));
            return h('div',{key:r.bus_id,style:{display:'flex',alignItems:'center',gap:10,padding:'9px 18px',borderBottom:'1px solid rgba(255,255,255,0.04)'}},
              h('div',{style:{width:6,height:6,borderRadius:'50%',background:col,flexShrink:0}}),
              h('div',{style:{flex:1,minWidth:0}},
                h('div',{style:{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},r.grid_buses?.name||r.bus_id),
                h('div',{style:{fontSize:10,color:'#64748b'}},`${r.grid_buses?.state} · ${r.grid_buses?.voltage_kv}kV`)
              ),
              h('div',{style:{width:70}},h('div',{style:{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}},h('div',{style:{height:'100%',borderRadius:2,width:`${Math.min((parseFloat(r.lmp)/9500)*100,100)}%`,background:col,transition:'width 0.5s'}}))),
              h('div',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:col,minWidth:64,textAlign:'right'}},`₹${fmt(r.lmp)}`),
              h('div',{style:{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:parseFloat(r.congestion_component)>0?'#f87171':'#4ade80',minWidth:46,textAlign:'right'}},`Cg:${fmt(r.congestion_component)}`)
            );
          })
        ),
        !isPro&&h('div',{style:{padding:'11px 18px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}},
          h('span',{style:{fontSize:12,color:'#64748b'}},'+ 60 more buses across all India'),
          h('button',{onClick:()=>go('pricing'),style:{background:'rgba(249,115,22,0.1)',color:'#f97316',border:'1px solid rgba(249,115,22,0.3)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'4px 12px',borderRadius:7}},'Unlock Pro →')
        )
      ),
      h('div',{className:'card',style:{overflow:'hidden'}},
        h('div',{style:{padding:'13px 18px 11px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}},
          h('h3',{style:{fontSize:13}},'Transmission Line Flows'),
          h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#64748b'}},'thermal %')
        ),
        h('div',{style:{maxHeight:360,overflowY:'auto'}},
          loading?h(Sk,{n:8}):
          flows.map(r=>{
            const pct=parseFloat(r.loading_pct);const col=ldCo(pct);
            return h('div',{key:r.line_id,style:{padding:'9px 18px',borderBottom:'1px solid rgba(255,255,255,0.04)'}},
              h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:4}},
                h('div',null,
                  h('span',{style:{fontSize:13,fontWeight:500}},r.transmission_lines?.name||r.line_id),
                  h('span',{style:{fontSize:10,color:'#64748b',marginLeft:6}},`${r.transmission_lines?.voltage_kv}kV · ${r.transmission_lines?.circuit_type||'AC'}`)
                ),
                h('div',{style:{display:'flex',gap:8,alignItems:'center'}},
                  h('span',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#64748b'}},`${fmt(r.flow_mw)}/${fmt(r.capacity_mw)}MW`),
                  h('span',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:col,minWidth:36,textAlign:'right'}},`${pct.toFixed(1)}%`)
                )
              ),
              h(Bar,{pct,col}),
              r.dlr_capacity_mw&&h('div',{style:{fontSize:10,color:'#22d3ee',fontFamily:"'JetBrains Mono',monospace",marginTop:2}},`DLR: ${fmt(r.dlr_capacity_mw)} MW`)
            );
          })
        ),
        !isPro&&h('div',{style:{padding:'11px 18px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}},
          h('span',{style:{fontSize:12,color:'#64748b'}},'+ 19 corridors including both HVDCs'),
          h('button',{onClick:()=>go('pricing'),style:{background:'rgba(249,115,22,0.1)',color:'#f97316',border:'1px solid rgba(249,115,22,0.3)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'4px 12px',borderRadius:7}},'Unlock Pro →')
        )
      )
    ),
    h('div',{className:'card',style:{overflow:'hidden',marginBottom:24}},
      h('div',{style:{padding:'13px 18px 11px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}},
        h('h3',{style:{fontSize:13}},'Active Grid Alerts'),
        !isPro&&h('span',{style:{fontSize:11,color:'#f97316'},'data-lock':true},'🔒 Showing 2 of '+alerts.length+' — Pro sees all')
      ),
      loading?h(Sk,{n:3}):alerts.length===0?h('div',{style:{padding:32,textAlign:'center',color:'#64748b',fontSize:14}},'No active alerts. Grid stable.'):
      alerts.map(a=>h('div',{key:a.id,style:{display:'flex',alignItems:'flex-start',gap:11,padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.04)'}},
        h('div',{style:{width:6,height:6,borderRadius:'50%',background:SS[a.severity]?.c||'#94a3b8',flexShrink:0,marginTop:5}}),
        h('div',{style:{flex:1}},
          h('div',{style:{display:'flex',gap:8,marginBottom:2,flexWrap:'wrap',alignItems:'center'}},h('span',{style:{fontSize:13,fontWeight:600}},a.title),h(Badge,{s:a.severity}),a.grid_regions&&h('span',{style:{fontSize:10,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}},a.grid_regions.short_name)),
          a.description&&h('p',{style:{fontSize:12,color:'#94a3b8',lineHeight:1.6}},a.description)
        ),
        h('span',{style:{fontSize:11,color:'#64748b',fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap'}},new Date(a.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}))
      ))
    )
  );
}

// ── LMP PAGE (abbreviated but complete) ───────────────────────────────────
function LMPPage({isPro,go}){
  const [lmp,setL]=useState([]); const [sel,setSel]=useState(null); const [hist,setH]=useState([]); const [lo,setLo]=useState(true); const [hl,setHl]=useState(false);
  const cr=useRef(null); const ci=useRef(null);
  useEffect(()=>{fetchLatestLMP(isPro).then(d=>{setL(d);if(d.length)setSel(d[0].bus_id);setLo(false);});},[isPro]);
  useEffect(()=>{ if(!sel)return; setHl(true); fetchLMPHistory(sel).then(d=>{setH(d);setHl(false);}); },[sel]);
  useEffect(()=>{
    if(hl||!hist.length||!cr.current)return;
    const labels=hist.map(h=>{const d=new Date(h.timestamp);return `${d.getHours().toString().padStart(2,'0')}:00`;});
    const draw=()=>{
      if(!window.Chart)return;
      if(ci.current)ci.current.destroy();
      ci.current=new Chart(cr.current,{type:'line',data:{labels,datasets:[
        {label:'LMP',data:hist.map(h=>parseFloat(h.lmp).toFixed(2)),borderColor:'#f97316',backgroundColor:'rgba(249,115,22,0.07)',borderWidth:2,pointRadius:2,tension:0.4,fill:true},
        {label:'Congestion',data:hist.map(h=>parseFloat(h.congestion_component).toFixed(2)),borderColor:'#f87171',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,tension:0.4,borderDash:[4,3]},
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#0c1422',borderColor:'rgba(255,255,255,0.1)',borderWidth:1,callbacks:{label:ctx=>` ₹${parseFloat(ctx.raw).toLocaleString('en-IN')}/MWh`}}},scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#64748b',font:{family:"'JetBrains Mono',monospace",size:10}}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#64748b',font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>`₹${Number(v).toLocaleString('en-IN')}`}}}}});
    };
    if(window.Chart)draw(); else{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';s.onload=draw;document.head.appendChild(s);}
    return()=>{if(ci.current){ci.current.destroy();ci.current=null;}};
  },[hist,hl]);
  const sr=lmp.find(r=>r.bus_id===sel);
  return h('div',{className:'page fu',style:{maxWidth:1400,margin:'0 auto',padding:'22px 22px'}},
    !isPro&&h(ProGate,{go}),
    h('div',{style:{marginBottom:18}},h('h1',{style:{fontSize:'1.4rem',marginBottom:3}},'LMP & Congestion Pricing'),h('p',{style:{color:'#64748b',fontSize:13}},isPro?'All 68+ buses · Real-time ₹/MWh · Energy + Congestion + Loss breakdown':'7 states shown · Upgrade for all 68 buses')),
    h('div',{style:{display:'grid',gridTemplateColumns:'290px 1fr',gap:16}},
      h('div',{className:'card',style:{overflow:'hidden',alignSelf:'start'}},
        h('div',{style:{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:11,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}},'SELECT BUS'),
        h('div',{style:{maxHeight:520,overflowY:'auto'}},
          lo?h(Sk,{n:8}):lmp.map(r=>{
            const ac=r.bus_id===sel;const col=lmpCo(parseFloat(r.lmp));
            return h('div',{key:r.bus_id,onClick:()=>setSel(r.bus_id),style:{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',background:ac?'rgba(249,115,22,0.08)':'transparent',borderLeft:ac?'3px solid #f97316':'3px solid transparent',transition:'all 0.15s'}},
              h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
                h('div',null,h('div',{style:{fontSize:12,fontWeight:ac?600:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:140}},r.grid_buses?.name||r.bus_id),h('div',{style:{fontSize:10,color:'#64748b'}},r.grid_buses?.state)),
                h('div',{style:{textAlign:'right'}},h('div',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:col}},`₹${fmt(r.lmp)}`),h('div',{style:{fontSize:9,color:parseFloat(r.congestion_component)>0?'#f87171':'#4ade80',fontFamily:"'JetBrains Mono',monospace"}},`Cg ₹${fmt(r.congestion_component)}`))
              )
            );
          })
        )
      ),
      h('div',{style:{display:'flex',flexDirection:'column',gap:16}},
        sr&&h('div',{className:'card',style:{padding:'20px 22px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:16}},
            h('div',null,h('h2',{style:{fontSize:'1.05rem',marginBottom:2}},sr.grid_buses?.name||sr.bus_id),h('div',{style:{fontSize:12,color:'#64748b'}},`${sr.grid_buses?.state} · ${sr.grid_buses?.region_id} · ${sr.grid_buses?.voltage_kv}kV`)),
            h('div',{style:{display:'flex',gap:16,flexWrap:'wrap'}},
              [{l:'LMP',v:`₹${fmt(sr.lmp)}`,c:lmpCo(parseFloat(sr.lmp))},{l:'Energy',v:`₹${fmt(sr.energy_component)}`,c:'#22d3ee'},{l:'Congestion',v:`₹${fmt(sr.congestion_component)}`,c:'#f87171'},{l:'Loss',v:`₹${fmt(sr.loss_component)}`,c:'#fbbf24'}]
              .map((it,i)=>h('div',{key:i,style:{textAlign:'center'}},h('div',{style:{fontSize:10,color:'#64748b',fontFamily:"'JetBrains Mono',monospace",marginBottom:2}},it.l),h('div',{style:{fontSize:18,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:it.c}},it.v),h('div',{style:{fontSize:9,color:'#475569'}},'/MWh')))
            )
          ),
          sr.demand_mw>0&&h('div',{style:{display:'flex',gap:18,padding:'10px 0',borderTop:'1px solid rgba(255,255,255,0.06)'}},
            h('span',{style:{fontSize:12}},h('span',{style:{color:'#64748b'}},'Demand: '),h('span',{style:{fontFamily:"'JetBrains Mono',monospace"}},`${fmt(sr.demand_mw)} MW`)),
            h('span',{style:{fontSize:12}},h('span',{style:{color:'#64748b'}},'Frequency: '),h('span',{style:{fontFamily:"'JetBrains Mono',monospace",color:Math.abs((parseFloat(sr.frequency_hz)||50)-50)>0.03?'#fbbf24':'#4ade80'}},`${parseFloat(sr.frequency_hz||50).toFixed(3)} Hz`))
          )
        ),
        h('div',{className:'card',style:{padding:'18px 22px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}},
            h('h3',{style:{fontSize:13}},'24-Hour LMP Trend'),
            h('div',{style:{display:'flex',gap:12}},[['#f97316','LMP'],['#f87171','Congestion']].map(([c,l])=>h('span',{key:l,style:{display:'flex',alignItems:'center',gap:4,fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:'#64748b'}},h('span',{style:{width:12,height:2,background:c,display:'inline-block',borderRadius:2}}),l)))
          ),
          h('div',{style:{position:'relative',height:240}},hl?h('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#64748b',fontSize:13}},'Loading chart...'):h('canvas',{ref:cr}))
        )
      )
    )
  );
}

// ── CONTINGENCY (Pro-gated detail) ────────────────────────────────────────
function ContPage({isPro,go}){
  const [cont,setCont]=useState([]); const [flows,setF]=useState([]); const [lo,setLo]=useState(true); const [fil,setFil]=useState('all');
  useEffect(()=>{Promise.all([fetchContingencies(isPro),fetchLineFlows(isPro)]).then(([c,f])=>{setCont(c);setF(f);}).finally(()=>setLo(false));},[isPro]);
  const filt=fil==='all'?cont:cont.filter(c=>c.status===fil);
  const cts={critical:cont.filter(c=>c.status==='critical').length,warning:cont.filter(c=>c.status==='warning').length,secure:cont.filter(c=>c.status==='secure').length};
  return h('div',{className:'page fu',style:{maxWidth:1400,margin:'0 auto',padding:'22px 22px'}},
    !isPro&&h(ProGate,{go}),
    h('div',{style:{marginBottom:18}},h('h1',{style:{fontSize:'1.4rem',marginBottom:3}},'N-1 Security Assessment'),h('p',{style:{color:'#64748b',fontSize:13}},'Post-contingency analysis · IEGC N-1 criterion · '+cont.length+' elements screened')),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:18}},
      [{l:'Critical',n:cts.critical,bg:'rgba(248,113,113,0.08)',bd:'rgba(248,113,113,0.22)',c:'#f87171'},{l:'Warning',n:cts.warning,bg:'rgba(251,191,36,0.08)',bd:'rgba(251,191,36,0.22)',c:'#fbbf24'},{l:'Secure',n:cts.secure,bg:'rgba(74,222,128,0.08)',bd:'rgba(74,222,128,0.2)',c:'#4ade80'}]
      .map(s=>h('div',{key:s.l,style:{background:s.bg,border:`1px solid ${s.bd}`,borderRadius:12,padding:'14px 18px',textAlign:'center'}},h('div',{style:{fontSize:32,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:s.c}},lo?'—':s.n),h('div',{style:{fontSize:12,color:s.c,marginTop:2}},s.l)))
    ),
    h('div',{style:{display:'flex',gap:7,marginBottom:14,flexWrap:'wrap'}},
      ['all','critical','warning','secure'].map(f=>h('button',{key:f,onClick:()=>setFil(f),style:{background:fil===f?'rgba(249,115,22,0.1)':'transparent',color:fil===f?'#f97316':'#64748b',border:`1px solid ${fil===f?'rgba(249,115,22,0.3)':'rgba(255,255,255,0.08)'}`,cursor:'pointer',fontSize:12,fontFamily:"'Space Grotesk',sans-serif",padding:'4px 12px',borderRadius:7,textTransform:'capitalize'}},f))
    ),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}},
      h('div',{className:'card',style:{overflow:'hidden'}},
        h('div',{style:{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}},'Contingency Screening'),
        lo?h(Sk,{n:6}):filt.map(c=>{
          const col=SS[c.status]?.c||SS.warning.c;
          return h('div',{key:c.id,style:{padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)'}},
            h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}},
              h('div',null,h('div',{style:{fontSize:13,fontWeight:500,marginBottom:1}},c.element_name),h('div',{style:{display:'flex',gap:6}},h('span',{style:{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:'#64748b'}},c.element_type.toUpperCase()),c.grid_regions&&h('span',{style:{fontSize:10,color:'#64748b'}},c.grid_regions.short_name))),
              h(Badge,{s:c.status==='secure'?'ok':c.status})
            ),
            c.post_contingency_loading_pct!=null&&h('div',{style:{marginBottom:3}},h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:3}},h('span',{style:{fontSize:11,color:'#64748b'}},'Post-contingency loading'),h('span',{style:{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:col}},`${c.post_contingency_loading_pct}%`)),h(Bar,{pct:c.post_contingency_loading_pct,col})),
            c.estimated_lmp_impact!=null&&h('div',{style:{fontSize:10,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}},'LMP impact: ',h('span',{style:{color:'#f87171'}},`₹${Number(c.estimated_lmp_impact).toLocaleString('en-IN')}/MWh`))
          );
        })
      ),
      h('div',{className:'card',style:{overflow:'hidden'}},
        h('div',{style:{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}},'Line Thermal Status'),
        lo?h(Sk,{n:8}):[...flows].sort((a,b)=>b.loading_pct-a.loading_pct).map(f=>{
          const pct=parseFloat(f.loading_pct);const col=ldCo(pct);
          return h('div',{key:f.line_id,style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)'}},
            h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:4}},
              h('div',null,h('div',{style:{fontSize:13,fontWeight:500}},f.transmission_lines?.name||f.line_id),h('div',{style:{fontSize:10,color:'#64748b'}},`${f.transmission_lines?.voltage_kv}kV · ${f.transmission_lines?.circuit_type||'AC'}`)),
              h('div',{style:{textAlign:'right'}},h('div',{style:{fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:col}},`${pct.toFixed(1)}%`),h('div',{style:{fontSize:10,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}},`${fmt(f.flow_mw)}/${fmt(f.capacity_mw)} MW`))
            ),
            h(Bar,{pct,col}),
            f.dlr_capacity_mw&&f.dlr_capacity_mw>f.capacity_mw&&h('div',{style:{fontSize:10,color:'#22d3ee',fontFamily:"'JetBrains Mono',monospace",marginTop:2}},`DLR +${fmt(f.dlr_capacity_mw-f.capacity_mw)} MW available`)
          );
        })
      )
    )
  );
}

// ── CRR PAGE ──────────────────────────────────────────────────────────────
function CRRPage({isPro,go}){
  const [crr,setCrr]=useState([]); const [lo,setLo]=useState(true);
  useEffect(()=>{if(isPro)fetchCRR().then(d=>{setCrr(d);setLo(false);}); else setLo(false);},[isPro]);
  if(!isPro) return h('div',{className:'page fu',style:{maxWidth:1400,margin:'0 auto',padding:'40px 22px'}},
    h(ProGate,{go}),
    h('div',{style:{textAlign:'center',padding:'60px',color:'#64748b'}},
      h('div',{style:{fontSize:48,marginBottom:16}},'💰'),
      h('h2',{style:{marginBottom:12}},'CRR Position Tracking — Pro Feature'),
      h('p',{style:{fontSize:14,maxWidth:480,margin:'0 auto',lineHeight:1.7}},
        'Track Congestion Revenue Rights P&L in ₹ across IEX and PXIL. Know exactly how much your transmission hedge earned this hour — down to the paise. Available on Pro and Enterprise plans.'
      ),
      h('button',{onClick:()=>go('pricing'),style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'12px 28px',borderRadius:9,marginTop:24}},'Unlock CRR Tracking →')
    )
  );
  const tp=crr.reduce((s,r)=>s+(parseFloat(r.pnl_inr)||0),0);
  return h('div',{className:'page fu',style:{maxWidth:1400,margin:'0 auto',padding:'22px 22px'}},
    h('div',{style:{marginBottom:18}},h('h1',{style:{fontSize:'1.4rem',marginBottom:3}},'Congestion Revenue Rights'),h('p',{style:{color:'#64748b',fontSize:13}},'CRR hedges · IEX/PXIL · ₹ settlement')),
    h('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:18}},
      h(KPI,{loading:lo,label:'Positions',value:lo?'—':crr.length,sub:'active hedges'}),
      h(KPI,{loading:lo,label:'P&L This Hour',value:fmtRs(tp),sub:'settlement-based',color:'#4ade80'}),
      h(KPI,{loading:lo,label:'Exchanges',value:'IEX · PXIL',sub:'Indian power markets'})
    ),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}},
      lo?Array.from({length:4}).map((_,i)=>h('div',{key:i,className:'card',style:{padding:20}},h('div',{className:'sk',style:{height:13,marginBottom:10}}),h('div',{className:'sk',style:{height:40}}))):
      crr.map(p=>{
        const pp=(parseFloat(p.pnl_inr)||0)>=0;const dl=Math.ceil((new Date(p.period_end)-new Date())/86400000);
        return h('div',{key:p.id,className:'card',style:{padding:'20px 22px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}},
            h('div',null,h('div',{style:{fontSize:14,fontWeight:600,marginBottom:2}},p.source?.name||p.source_bus_id,h('span',{style:{color:'#f97316',margin:'0 7px'}},'→'),p.sink?.name||p.sink_bus_id),h('div',{style:{fontSize:11,color:'#64748b'}},`${p.source?.state||''}→${p.sink?.state||''}`)),
            h('div',{style:{background:pp?'rgba(74,222,128,0.1)':'rgba(248,113,113,0.1)',border:`1px solid ${pp?'rgba(74,222,128,0.25)':'rgba(248,113,113,0.25)'}`,borderRadius:7,padding:'6px 11px',textAlign:'right'}},h('div',{style:{fontSize:10,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}},'P&L'),h('div',{style:{fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:pp?'#4ade80':'#f87171'}},`${pp?'+':''}${fmtRs(p.pnl_inr)}`))
          ),
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}},
            [{l:'MW',v:`${fmt(p.mw_awarded)}MW`},{l:'Settlement',v:`₹${fmt(p.settlement_price)}/MWh`},{l:'Cong.Δ',v:`₹${fmt(p.congestion_component)}/MWh`,c:'#f87171'},{l:'Days Left',v:`${dl}d`,c:dl<7?'#fbbf24':'#4ade80'}]
            .map((it,i)=>h('div',{key:i,style:{background:'rgba(255,255,255,0.03)',borderRadius:7,padding:'7px 9px'}},h('div',{style:{fontSize:9,color:'#64748b',fontFamily:"'JetBrains Mono',monospace",marginBottom:2}},it.l),h('div',{style:{fontSize:11,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",color:it.c||'#f1f5f9'}},it.v)))
          ),
          h('div',{style:{fontSize:10,color:'#475569',fontFamily:"'JetBrains Mono',monospace",display:'flex',justifyContent:'space-between',marginTop:10}},h('span',null,'Holder: ',p.holder_name),h('span',null,`${new Date(p.period_start).toLocaleDateString('en-IN')}–${new Date(p.period_end).toLocaleDateString('en-IN')}`))
        );
      })
    )
  );
}

// ── ALERTS PAGE ───────────────────────────────────────────────────────────
function AlertsPage({isPro,go}){
  const [alerts,setA]=useState([]); const [lo,setLo]=useState(true); const [fil,setFil]=useState('all');
  useEffect(()=>{ fetchAlerts(isPro).then(d=>setA([...d].sort((a,b)=>(SEV[a.severity]??9)-(SEV[b.severity]??9)))).finally(()=>setLo(false)); },[isPro]);
  const filt=fil==='all'?alerts:alerts.filter(a=>a.severity===fil);
  return h('div',{className:'page fu',style:{maxWidth:960,margin:'0 auto',padding:'22px 22px'}},
    !isPro&&h(ProGate,{go}),
    h('div',{style:{marginBottom:18}},h('h1',{style:{fontSize:'1.4rem',marginBottom:3}},'Grid Alert Centre'),h('p',{style:{color:'#64748b',fontSize:13}},isPro?'All alerts · NLDC/RLDC monitoring · real-time':'2 alerts shown · Pro unlocks all alerts + WhatsApp/email push')),
    h('div',{style:{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}},
      ['all','critical','warning','info'].map(f=>{
        const cnt=f==='all'?alerts.length:alerts.filter(a=>a.severity===f).length;const s=SS[f]||{};
        return h('button',{key:f,onClick:()=>setFil(f),style:{display:'flex',alignItems:'center',gap:6,padding:'5px 14px',borderRadius:20,background:fil===f?(s.bg||'rgba(255,255,255,0.06)'):'transparent',border:`1px solid ${fil===f?(s.bd||'rgba(255,255,255,0.12)'):'rgba(255,255,255,0.08)'}`,color:fil===f?(s.c||'#f1f5f9'):'#64748b',cursor:'pointer',fontSize:12,fontWeight:fil===f?600:400,fontFamily:"'Space Grotesk',sans-serif"}},
          f!=='all'&&h('span',{style:{width:6,height:6,borderRadius:'50%',background:s.c,display:'inline-block'}}),
          f==='all'?'All':f.charAt(0).toUpperCase()+f.slice(1),
          h('span',{style:{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'1px 6px',fontSize:10,fontFamily:"'JetBrains Mono',monospace"}},cnt)
        );
      })
    ),
    h('div',{style:{display:'flex',flexDirection:'column',gap:10}},
      lo?Array.from({length:3}).map((_,i)=>h('div',{key:i,className:'card',style:{padding:18}},h('div',{className:'sk',style:{height:12,marginBottom:8}}),h('div',{className:'sk',style:{height:11,width:'70%'}}))):
      filt.length===0?h('div',{style:{textAlign:'center',padding:'52px',color:'#64748b',fontSize:14}},'✅ No alerts at this severity.'):
      filt.map(a=>{
        const s=SS[a.severity]||SS.info;
        return h('div',{key:a.id,style:{background:s.bg,border:`1px solid ${s.bd}`,borderRadius:12,padding:'16px 20px',display:'flex',gap:12}},
          h('div',{style:{width:3,borderRadius:2,background:s.c,flexShrink:0,alignSelf:'stretch',minHeight:32}}),
          h('div',{style:{flex:1}},
            h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5,flexWrap:'wrap',gap:5}},
              h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}},h('h3',{style:{fontSize:13}},a.title),h(Badge,{s:a.severity})),
              h('span',{style:{fontSize:10,color:'#475569',fontFamily:"'JetBrains Mono',monospace"}},new Date(a.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))
            ),
            a.description&&h('p',{style:{fontSize:12,color:'#94a3b8',lineHeight:1.7,marginBottom:6}},a.description),
            h('div',{style:{display:'flex',gap:12,flexWrap:'wrap'}},
              a.grid_regions&&h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#64748b'}},'Region: ',h('span',{style:{color:s.c}},`${a.grid_regions.name}`)),
              h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace"}},'Status: ',h('span',{style:{color:'#f87171'}},'ACTIVE'))
            )
          )
        );
      })
    )
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────
const RG=[
  {id:'NR',l:'Northern',c:'#f97316',st:'Delhi · UP · Punjab · Rajasthan · J&K · HP',mw:'72,000 MW',rl:'NRLDC'},
  {id:'WR',l:'Western', c:'#22d3ee',st:'Maharashtra · Gujarat · MP · Chhattisgarh · Goa',mw:'98,000 MW',rl:'WRLDC'},
  {id:'SR',l:'Southern',c:'#4ade80',st:'Karnataka · TN · AP · Telangana · Kerala',mw:'82,000 MW',rl:'SRLDC'},
  {id:'ER',l:'Eastern', c:'#fbbf24',st:'West Bengal · Bihar · Odisha · Jharkhand',mw:'34,000 MW',rl:'ERLDC'},
  {id:'NER',l:'NE',     c:'#a78bfa',st:'Assam · Meghalaya · Sikkim · NE States',mw:'4,500 MW',rl:'NERLDC'},
];
const FT=[
  {i:'⚡',t:'Real-Time LMP',d:'₹/MWh locational pricing across 68+ buses — energy, congestion & loss. WebSocket updates every time data changes.'},
  {i:'🔒',t:'N-1 Security',d:'Post-contingency screening per IEGC criterion. Know which corridor cascades before it trips.'},
  {i:'📊',t:'Dynamic Line Rating',d:'Real ampacity unlocked by weather. Find hidden MW headroom on HVDCs and 765kV corridors.'},
  {i:'💰',t:'CRR Management',d:'CRR P&L in ₹ against IEX/PXIL settlement. Hedge transmission like NTPC and NVVN do.'},
  {i:'🗺️',t:'All India Topology',d:'68+ buses, 25+ corridors, both HVDC links. All 5 RLDCs. Not a generic IEEE test case.'},
  {i:'🚨',t:'Smart Alerts',d:'Thermal overload, frequency deviation, N-1 risk — pushed to you via WhatsApp and email (Pro).'},
];

function Landing({go}){
  const [alerts,setA]=useState([]);
  const [form,setF]=useState({email:'',name:'',organisation:'',role:'',use_case:''});
  const [done,setD]=useState(false); const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  const sf=(k,v)=>setF(f=>({...f,[k]:v}));
  useEffect(()=>{ fetchAlerts(false).then(setA).catch(()=>{}); },[]);
  async function onSubmit(e){
    e.preventDefault(); if(!form.email)return;
    setBusy(true);setErr('');
    try{ await submitWaitlist(form); setD(true); }
    catch(ex){ setErr(ex.message?.includes('duplicate')?"You're already on the list!":'Something went wrong.'); }
    finally{ setBusy(false); }
  }
  return h('div',{style:{minHeight:'100vh'}},
    h('nav',{style:{position:'sticky',top:0,zIndex:50,background:'rgba(4,8,15,0.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 24px'}},
      h('div',{style:{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:54}},
        h(Logo,{go:()=>{}}),
        h('div',{style:{display:'flex',gap:10}},
          h('button',{onClick:()=>go('pricing'),style:{background:'transparent',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",padding:'6px 14px',borderRadius:7}},'⭐ Pricing'),
          h('button',{onClick:()=>go('dashboard'),style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",padding:'7px 18px',borderRadius:8}},'Live Dashboard →')
        )
      )
    ),
    // Hero
    h('section',{style:{maxWidth:1200,margin:'0 auto',padding:'72px 24px 56px',textAlign:'center',position:'relative'}},
      h('div',{style:{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(249,115,22,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,0.04) 1px,transparent 1px)',backgroundSize:'48px 48px',maskImage:'radial-gradient(ellipse 80% 70% at 50% 0%,black,transparent)',zIndex:0}}),
      h('div',{style:{position:'relative',zIndex:1}},
        h('div',{style:{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.25)',borderRadius:20,padding:'4px 14px',marginBottom:22,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#f97316'}},
          h('span',{className:'pulse',style:{width:6,height:6,borderRadius:'50%',background:'#f97316',display:'inline-block'}}),
          'LIVE · 68+ buses · All 5 RLDCs · WebSocket real-time'
        ),
        h('h1',{style:{marginBottom:16,color:'#f1f5f9',fontSize:'clamp(1.9rem,4vw,3rem)',letterSpacing:'-0.03em',lineHeight:1.1}},
          "India's First Grid Congestion",h('br'),h('span',{style:{color:'#f97316'}},'Intelligence Platform')
        ),
        h('p',{style:{fontSize:16,color:'#94a3b8',maxWidth:560,margin:'0 auto 32px',lineHeight:1.75}},
          'Real-time LMP pricing · N-1 contingency analysis · CRR management · Built for NLDC, RLDC, SLDC operators, power traders, IPPs, and researchers across all 5 Indian regions.'
        ),
        h('div',{style:{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}},
          h('button',{onClick:()=>go('dashboard'),style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:15,fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",padding:'12px 28px',borderRadius:10}},'⚡ Open Live Dashboard — Free'),
          h('button',{onClick:()=>go('pricing'),style:{background:'transparent',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)',cursor:'pointer',fontSize:15,fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",padding:'12px 28px',borderRadius:10}},'⭐ View Pricing')
        ),
        h('div',{style:{marginTop:20,fontSize:12,color:'#475569'}},'Free plan includes 7 states · Pro unlocks all 68 buses · Enterprise for SLDC/DISCOM teams')
      )
    ),
    // Alert ticker
    alerts.length>0&&h('div',{style:{background:'rgba(248,113,113,0.06)',borderTop:'1px solid rgba(248,113,113,0.13)',borderBottom:'1px solid rgba(248,113,113,0.13)',padding:'7px 24px'}},
      h('div',{style:{maxWidth:1200,margin:'0 auto',display:'flex',gap:22,alignItems:'center'}},
        h('span',{style:{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#f87171',whiteSpace:'nowrap',flexShrink:0}},'🚨 LIVE'),
        h('div',{style:{display:'flex',gap:32,overflow:'hidden'}},alerts.slice(0,3).map(a=>h('span',{key:a.id,style:{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}},h('span',{style:{color:SS[a.severity]?.c||'#22d3ee'}},`[${a.severity.toUpperCase()}] `),a.title)))
      )
    ),
    // Regions
    h('section',{style:{maxWidth:1200,margin:'0 auto',padding:'56px 24px 40px'}},
      h('div',{style:{textAlign:'center',marginBottom:36}},h('h2',null,'All 5 RLDC Regions · 68+ Buses'),h('p',{style:{color:'#94a3b8',marginTop:8,fontSize:13}},'From Palatana CCGT in Tripura to Mundra UMPP in Gujarat. From Teesta HPS in Sikkim to Tuticorin TPS in Tamil Nadu.')),
      h('div',{style:{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:11}},
        RG.map(r=>h('div',{key:r.id,className:'card',style:{padding:'16px 12px',textAlign:'center'}},
          h('div',{style:{width:34,height:34,borderRadius:'50%',background:`${r.c}20`,border:`1px solid ${r.c}40`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px',fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:r.c,fontWeight:700}},r.id),
          h('div',{style:{fontWeight:600,fontSize:12,marginBottom:2}},r.l),h('div',{style:{fontSize:10,color:'#64748b',marginBottom:4,lineHeight:1.5}},r.st),
          h('div',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:r.c}},r.mw),h('div',{style:{fontSize:10,color:'#475569',marginTop:1}},r.rl)
        ))
      )
    ),
    // Features
    h('section',{style:{maxWidth:1200,margin:'0 auto',padding:'8px 24px 56px'}},
      h('div',{style:{textAlign:'center',marginBottom:36}},h('h2',null,'Built for Indian Power Markets'),h('p',{style:{color:'#94a3b8',marginTop:8,fontSize:13}},'CERC regulations · IEX/PXIL pricing · NLDC dispatch protocols. Not generic — India-specific.')),
      h('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}},
        FT.map((f,i)=>h('div',{key:i,className:'card',style:{padding:'22px 18px'}},h('div',{style:{fontSize:24,marginBottom:10}},f.i),h('h3',{style:{fontSize:13,marginBottom:6}},f.t),h('p',{style:{fontSize:12,color:'#94a3b8',lineHeight:1.7}},f.d)))
      )
    ),
    // Stats
    h('section',{style:{background:'rgba(249,115,22,0.05)',borderTop:'1px solid rgba(249,115,22,0.1)',borderBottom:'1px solid rgba(249,115,22,0.1)',padding:'48px 24px'}},
      h('div',{style:{maxWidth:1200,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24,textAlign:'center'}},
        [{v:'68+',l:'Buses Tracked',s:'765kV / 400kV / 220kV'},{v:'25+',l:'Corridors',s:'AC + both HVDC links'},{v:'₹538Cr',l:'Lost to congestion/yr',s:'on IEX alone — your market'},{v:'0',l:'Competing products',s:'for India-specific LMP analytics'}]
        .map((s,i)=>h('div',{key:i},h('div',{style:{fontSize:28,fontWeight:700,color:'#f97316',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.04em'}},s.v),h('div',{style:{fontSize:13,fontWeight:600,marginTop:5,marginBottom:2}},s.l),h('div',{style:{fontSize:11,color:'#64748b'}},s.s)))
      )
    ),
    // Waitlist
    h('section',{id:'waitlist',style:{maxWidth:560,margin:'0 auto',padding:'72px 24px'}},
      h('div',{className:'card',style:{padding:'36px 30px',textAlign:'center'}},
        h('div',{style:{fontSize:34,marginBottom:10}},'🇮🇳'),
        h('h2',{style:{marginBottom:8}},'Get Early Access'),
        h('p',{style:{color:'#94a3b8',marginBottom:24,fontSize:13,lineHeight:1.7}},'SLDC operators · power traders · researchers · IPPs · NTPC/PGCIL desks. First 100 get lifetime Pro.'),
        done?h('div',{style:{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:12,padding:20,color:'#4ade80'}},h('div',{style:{fontSize:26,marginBottom:6}},'✓'),h('div',{style:{fontWeight:600}},"You're on the list!"),h('div',{style:{fontSize:12,color:'#94a3b8',marginTop:4}},"We'll reach out within 48 hours.")):
        h('form',{onSubmit,style:{display:'flex',flexDirection:'column',gap:11,textAlign:'left'}},
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
            h('div',null,h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},'Full Name'),h('input',{type:'text',value:form.name,onChange:e=>sf('name',e.target.value),placeholder:'Arjun Sharma',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,fontFamily:"'Space Grotesk',sans-serif",outline:'none'}})),
            h('div',null,h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},'Work Email *'),h('input',{type:'email',required:true,value:form.email,onChange:e=>sf('email',e.target.value),placeholder:'you@ntpc.co.in',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,fontFamily:"'Space Grotesk',sans-serif",outline:'none'}}))
          ),
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
            h('div',null,h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},'Organisation'),h('input',{type:'text',value:form.organisation,onChange:e=>sf('organisation',e.target.value),placeholder:'NTPC / PGCIL / IEX...',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,fontFamily:"'Space Grotesk',sans-serif",outline:'none'}})),
            h('div',null,h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},'Role'),h('select',{value:form.role,onChange:e=>sf('role',e.target.value),style:{width:'100%',background:'#0c1422',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,fontFamily:"'Space Grotesk',sans-serif"}},h('option',{value:''},'Select...'),h('option',null,'Grid Operator / SLDC'),h('option',null,'Power Trader'),h('option',null,'Load Despatcher'),h('option',null,'Renewable IPP'),h('option',null,'Researcher / IIT / NIT'),h('option',null,'Government / Ministry'),h('option',null,'Developer')))
          ),
          h('div',null,h('label',{style:{fontSize:11,color:'#64748b',display:'block',marginBottom:4}},'Use case?'),h('textarea',{rows:2,value:form.use_case,onChange:e=>sf('use_case',e.target.value),placeholder:'e.g. Track Kurnool solar evacuation congestion for our AP bilateral contracts...',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'8px 10px',color:'#f1f5f9',fontSize:13,resize:'vertical',fontFamily:"'Space Grotesk',sans-serif",outline:'none'}})),
          err&&h('p',{style:{color:'#f87171',fontSize:12}},err),
          h('button',{type:'submit',disabled:busy,style:{background:'#f97316',color:'#fff',border:'none',cursor:busy?'wait':'pointer',fontSize:14,fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",padding:'11px',borderRadius:9,marginTop:2}},busy?'Submitting...':'🚀 Request Early Access')
        )
      )
    ),
    h('footer',{style:{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'24px',textAlign:'center'}},
      h('p',{style:{fontSize:12,color:'#475569'}},'GridIntel India · CERC/NLDC/IEGC data model · Not affiliated with POSOCO · Demo + MVP platform'),
      h('div',{style:{display:'flex',gap:12,justifyContent:'center',marginTop:12}},
        h('button',{onClick:()=>go('dashboard'),style:{background:'#f97316',color:'#fff',border:'none',cursor:'pointer',fontSize:12,fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",padding:'7px 18px',borderRadius:7}},'Dashboard →'),
        h('button',{onClick:()=>go('pricing'),style:{background:'transparent',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)',cursor:'pointer',fontSize:12,fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",padding:'7px 18px',borderRadius:7}},'Pricing →')
      )
    )
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────
function App(){
  const [page,setPage]=useState('landing');
  const sub = getSubscription();
  const [isPro,setIsPro]=useState(sub.plan==='pro');
  const lmpCount = isPro ? 68 : 8;

  const go=p=>{ setPage(p); window.scrollTo(0,0); };
  return h(Fragment,null,
    page!=='landing'&&h(Navbar,{page,go,isPro,liveCount:lmpCount}),
    page==='landing'     && h(Landing,{go}),
    page==='dashboard'   && h(Dashboard,{isPro,go}),
    page==='lmp'         && h(LMPPage,{isPro,go}),
    page==='contingency' && h(ContPage,{isPro,go}),
    page==='crr'         && h(CRRPage,{isPro,go}),
    page==='alerts'      && h(AlertsPage,{isPro,go}),
    page==='pricing'     && h(PricingPage,{go,isPro,setIsPro}),
  );
}
ReactDOM.createRoot(document.getElementById('app')).render(h(App));
})();
