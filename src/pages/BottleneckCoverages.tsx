<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Substrate Coverage — mockup v2</title>
<style>
  :root{
    --bg:#0c0f13;--panel:#12161c;--panel-2:#161b22;--line:#232a33;--line-soft:#1b2129;
    --ink:#e6ebf1;--ink-dim:#8b97a6;--ink-faint:#5b6675;
    --owned:#3fbf9f;--owned-bg:rgba(63,191,159,.14);
    --toehold:#d9a441;--toehold-bg:rgba(217,164,65,.12);
    --gap:#4d6b9a;--gap-bg:rgba(77,107,154,.10);
    --nopipe:#c65f5f;--nopipe-bg:rgba(198,95,95,.10);
    --struct:#3a424d;--keystone:#8b7fd4;
    --mono:"SFMono-Regular",ui-monospace,"Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;
    line-height:1.45;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1120px;margin:0 auto;padding:28px 22px 60px}

  .masthead{display:flex;justify-content:space-between;align-items:flex-end;
    border-bottom:1px solid var(--line);padding-bottom:14px;flex-wrap:wrap;gap:12px}
  .masthead h1{font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin:0}
  .masthead h1 span{color:var(--ink-faint)}
  .tag{font-family:var(--mono);font-size:10.5px;color:var(--ink-faint);letter-spacing:.08em}
  .illus{font-family:var(--mono);font-size:10px;color:var(--toehold);
    border:1px solid rgba(217,164,65,.35);padding:3px 8px;border-radius:2px;letter-spacing:.06em;white-space:nowrap}

  .legend{display:flex;gap:16px;flex-wrap:wrap;padding:12px 0 22px;font-family:var(--mono);
    font-size:11px;color:var(--ink-dim);letter-spacing:.03em}
  .legend b{font-weight:400;color:var(--ink)}
  .swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:7px;vertical-align:-1px}
  .sw-owned{background:var(--owned)}.sw-toehold{background:var(--toehold)}
  .sw-gap{background:transparent;border:1px solid var(--gap)}
  .sw-nopipe{background:transparent;border:1px solid var(--nopipe)}
  .sw-struct{background:repeating-linear-gradient(45deg,var(--struct),var(--struct) 2px,transparent 2px,transparent 4px)}
  .sw-key{background:var(--keystone)}

  .stack{background:var(--panel);border:1px solid var(--line);border-radius:4px;margin-bottom:18px;overflow:hidden}
  .stack-head{display:flex;align-items:center;gap:18px;padding:16px 18px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}
  .stack-name{font-size:16px;font-weight:600;margin:0;min-width:180px}
  .stack-name em{display:block;font-style:normal;font-family:var(--mono);font-size:10.5px;
    color:var(--ink-faint);letter-spacing:.08em;text-transform:uppercase;margin-top:3px}
  .spark{margin-left:6px}
  .cov{display:flex;align-items:baseline;gap:10px;margin-left:auto}
  .cov-num{font-family:var(--mono);font-size:30px;font-weight:600;line-height:1}
  .cov-lab{font-family:var(--mono);font-size:10px;color:var(--ink-faint);letter-spacing:.09em;text-transform:uppercase;text-align:right}
  .cov-bar{flex-basis:100%;height:4px;background:var(--line-soft);border-radius:2px;overflow:hidden;margin-top:2px}
  .cov-bar i{display:block;height:100%}

  .grid{display:flex;gap:6px;padding:14px;flex-wrap:wrap}
  .cell{position:relative;border-radius:3px;padding:11px 12px 12px;min-height:82px;cursor:pointer;
    border:1px solid var(--line-soft);transition:transform .12s ease,box-shadow .12s ease;
    display:flex;flex-direction:column;justify-content:space-between}
  .cell:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.35)}
  .cell.owned{background:var(--owned-bg);border-color:rgba(63,191,159,.4)}
  .cell.toehold{background:var(--toehold-bg);border-color:rgba(217,164,65,.4)}
  .cell.gap{background:var(--gap-bg);border-color:rgba(77,107,154,.35);border-style:dashed}
  .cell.nopipe{background:var(--nopipe-bg);border-color:rgba(198,95,95,.4);border-style:dashed}
  .cell.struct{background:var(--panel-2);border-color:var(--line);
    background-image:repeating-linear-gradient(45deg,rgba(58,66,77,.35),rgba(58,66,77,.35) 3px,transparent 3px,transparent 8px)}
  .cell .sub{font-size:12.5px;font-weight:500;line-height:1.25;padding-right:14px}
  .cell.struct .sub,.cell.gap .sub,.cell.nopipe .sub{color:var(--ink-dim)}
  .key-badge{position:absolute;top:8px;right:8px;width:14px;height:14px;border-radius:3px;
    background:rgba(139,127,212,.18);border:1px solid var(--keystone);display:flex;align-items:center;justify-content:center}
  .key-badge::after{content:"";width:5px;height:5px;background:var(--keystone);border-radius:50%}
  .cell .cand{font-family:var(--mono);font-size:10px;line-height:1.35;margin-top:8px}
  .cell.owned .cand,.cell.toehold .cand{color:var(--ink-dim)}
  .cand .nm{color:var(--owned)}
  .cell.toehold .cand .nm{color:var(--toehold)}
  .cand .wl{color:var(--gap)}
  .cell.nopipe .cand{color:var(--nopipe)}
  .cell .foot-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
  .irr{font-family:var(--mono);font-size:9.5px;color:var(--ink-faint);letter-spacing:.05em}
  .more{font-family:var(--mono);font-size:9.5px;color:var(--ink-faint)}

  .stackfoot{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);
    font-family:var(--mono);font-size:11px;color:var(--ink-faint);line-height:1.7}
  .stackfoot b{color:var(--ink-dim);font-weight:400}

  .scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .2s}
  .scrim.open{opacity:1;pointer-events:auto}
  .drawer{position:fixed;top:0;right:0;height:100%;width:min(440px,92vw);background:var(--panel);
    border-left:1px solid var(--line);transform:translateX(100%);transition:transform .22s ease;
    z-index:10;overflow-y:auto;padding:22px 22px 40px}
  .drawer.open{transform:translateX(0)}
  .dr-close{position:absolute;top:16px;right:18px;background:none;border:none;color:var(--ink-faint);
    font-size:20px;cursor:pointer;line-height:1}
  .dr-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint)}
  .dr-title{font-size:20px;font-weight:600;margin:6px 0 2px}
  .dr-badges{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}
  .badge{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;padding:3px 8px;border-radius:2px;text-transform:uppercase}
  .b-key{color:var(--keystone);border:1px solid var(--keystone)}
  .b-irr{color:var(--ink-dim);border:1px solid var(--line)}
  .b-state{border:1px solid currentColor}
  .dr-note{font-size:13px;line-height:1.6;color:var(--ink-dim);border-left:2px solid var(--line);padding-left:14px;margin:0 0 20px}
  .dr-note strong{color:var(--ink);font-weight:600}
  .dr-h{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--ink-faint);margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line-soft)}
  .sup{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-soft)}
  .sup .snm{font-family:var(--mono);font-size:12px;flex:1}
  .sup .stat{font-family:var(--mono);font-size:9px;letter-spacing:.06em;padding:2px 7px;border-radius:2px}
  .st-held{color:var(--owned);border:1px solid var(--owned)}
  .st-wl{color:var(--gap);border:1px solid var(--gap)}
  .st-uni{color:var(--ink-faint);border:1px solid var(--line)}
  .sup .ssc{font-family:var(--mono);font-size:11px;color:var(--ink-dim);width:34px;text-align:right}
  .sup .slink{font-family:var(--mono);font-size:10px;color:var(--gap);text-decoration:none;white-space:nowrap}
  .sup .slink:hover{color:var(--owned)}
  .dr-kill{font-family:var(--mono);font-size:11px;color:var(--nopipe);margin-top:8px;line-height:1.6}

  @media(max-width:640px){.cov-num{font-size:24px}.cell{flex-basis:calc(50% - 3px)!important}
    .stack-name{min-width:100%}.cov{margin-left:0}}
</style>
</head>
<body>
<div class="wrap">
  <div class="masthead">
    <h1>Substrate&nbsp;Coverage <span>/ bottleneck map</span></h1>
    <div style="display:flex;gap:14px;align-items:center">
      <span class="tag">JOIN: MAP × HOLDINGS × SCORES × WATCHLIST</span>
      <span class="illus">ILLUSTRATIVE — not live sheet data</span>
    </div>
  </div>

  <div class="legend">
    <span><span class="swatch sw-owned"></span><b>Owned</b></span>
    <span><span class="swatch sw-toehold"></span><b>Toehold</b></span>
    <span><span class="swatch sw-gap"></span><b>Gap</b> · pipeline exists</span>
    <span><span class="swatch sw-nopipe"></span><b>Gap</b> · no pipeline → sourcing brief</span>
    <span><span class="swatch sw-struct"></span><b>Structural</b> · no pure-play</span>
    <span><span class="swatch sw-key"></span><b>Keystone</b> · serves &gt;1 stack</span>
  </div>

  <div class="stack">
    <div class="stack-head">
      <h2 class="stack-name">AI Datacentre<em>Compute layer</em></h2>
      <svg class="spark" width="66" height="22" viewBox="0 0 66 22"><polyline points="0,15 13,14 26,12 39,11 52,9 66,8" fill="none" stroke="#3fbf9f" stroke-width="1.5"/><circle cx="66" cy="8" r="2" fill="#3fbf9f"/></svg>
      <div class="cov"><span class="cov-num" style="color:var(--owned)">58<span style="font-size:16px">%</span></span><span class="cov-lab">coverage<br>ratio</span></div>
      <div class="cov-bar"><i style="width:58%;background:linear-gradient(90deg,var(--owned),#5fd3b6)"></i></div>
    </div>
    <div class="grid" id="grid-ai"></div>
  </div>

  <div class="stack">
    <div class="stack-head">
      <h2 class="stack-name">Humanoid Robot<em>Robotics · −2.2pp vs target</em></h2>
      <svg class="spark" width="66" height="22" viewBox="0 0 66 22"><polyline points="0,17 13,17 26,16 39,16 52,15 66,15" fill="none" stroke="#d9a441" stroke-width="1.5"/><circle cx="66" cy="15" r="2" fill="#d9a441"/></svg>
      <div class="cov"><span class="cov-num" style="color:var(--toehold)">14<span style="font-size:16px">%</span></span><span class="cov-lab">coverage<br>ratio</span></div>
      <div class="cov-bar"><i style="width:14%;background:linear-gradient(90deg,var(--toehold),#e6bd6b)"></i></div>
    </div>
    <div class="grid" id="grid-robo"></div>
  </div>

  <div class="stackfoot">
    <b>Click any subsystem</b> for its vault note + full supplier pipeline. <b>Sparkline</b> = coverage trend, last 6 snapshots.<br>
    <b>Red-dashed tiles</b> have no pipeline: those are directed sourcing briefs, not deployment decisions.
  </div>
</div>

<div class="scrim" id="scrim" onclick="closeDrawer()"></div>
<aside class="drawer" id="drawer">
  <button class="dr-close" onclick="closeDrawer()">×</button>
  <div id="drawer-body"></div>
</aside>

<script>
  const STATE_LABEL={owned:"Owned",toehold:"Toehold",gap:"Gap",nopipe:"Gap · no pipeline",struct:"Structural"};
  const STATE_COLR={owned:"var(--owned)",toehold:"var(--toehold)",gap:"var(--gap)",nopipe:"var(--nopipe)",struct:"var(--struct)"};

  const AI=[
    {sub:"Compute silicon",irr:5,state:"owned",key:false,
     note:"Foundry-scale qualified incumbency in accelerator silicon. 4-name oligopoly; multi-year design-in cycles bind hyperscaler roadmaps.",
     suppliers:[{nm:"NVDA",st:"held",sc:88},{nm:"AVGO",st:"held",sc:84}]},
    {sub:"Engineered wafers / substrates",irr:5,state:"owned",key:false,
     note:"Litho tooling + leading-edge foundry. Copy-exactly moat: qualification measured in years, no second source at node.",
     suppliers:[{nm:"ASML",st:"held",sc:91},{nm:"TSM",st:"held",sc:86},{nm:"Soitec",st:"wl",sc:74}]},
    {sub:"Optical interconnect / photonics",irr:5,state:"gap",key:true,
     note:"The scale-out chokepoint as copper reach collapses. Co-packaged optics moves this from application to substrate. <strong>Pre-reclassification window open</strong>: market still labels these as component vendors.",
     suppliers:[{nm:"Lumentum",st:"wl",sc:72},{nm:"Coherent",st:"wl",sc:69},{nm:"POET",st:"uni",sc:null}],
     kill:"Thesis fails if silicon-photonics integration commoditises discrete optics."},
    {sub:"Thermal / cooling fluid",irr:5,state:"struct",key:true,
     note:"Direct-to-chip and immersion dielectric fluids are indispensable at rack density, but the pure-plays are private or conglomerate-buried. <strong>Uninvestable as pure-play substrate.</strong> Flagged to structural-gap register → candidate for macro-hedge, not direct ownership.",
     suppliers:[]},
    {sub:"Etch / clean process gas",irr:4,state:"owned",key:false,
     note:"NF3 monopoly-tier position. WF6 line exited on China feedstock controls; NF3 revenue compensation is the 12 Aug hard gate.",
     suppliers:[{nm:"4047.T Kanto Denka",st:"held",sc:80}],
     kill:"Q1 FY27 must show NF3 covers &ge;70% of lost WF6 run-rate."},
    {sub:"Memory interface",irr:4,state:"toehold",key:false,
     note:"HBM interface + controller IP. Held exposure is marginal vs the subsystem's penetration leaders.",
     suppliers:[{nm:"held (marginal)",st:"held",sc:null},{nm:"Rambus",st:"uni",sc:null}]},
    {sub:"Power conversion",irr:4,state:"gap",key:true,
     note:"48V-to-core power delivery at rack scale. Keystone: same substrate serves humanoid actuation and grid. SiC content is the reclassification vector.",
     suppliers:[{nm:"Vicor",st:"wl",sc:71},{nm:"Monolithic Power",st:"uni",sc:null}]},
    {sub:"Advanced packaging",irr:4,state:"toehold",key:false,
     note:"CoWoS / advanced substrate held indirectly via foundry. No direct packaging-substrate pure-play in book.",
     suppliers:[{nm:"via TSM",st:"held",sc:null},{nm:"Ibiden",st:"uni",sc:null}]},
    {sub:"Timing chips",irr:3,state:"gap",key:false,
     note:"Reference clocks / jitter attenuators. Lower irreplaceability; multiple qualified sources reduce chokepoint depth.",
     suppliers:[{nm:"SiTime",st:"wl",sc:66}]},
  ];

  const ROBO=[
    {sub:"Harmonic reducer",irr:5,state:"owned",key:false,
     note:"Strain-wave gearing: the actuator substrate humanoid motion routes through. Multi-year qualification, 2-name effective oligopoly.",
     suppliers:[{nm:"6268.T Nabtesco",st:"wl",sc:78},{nm:"6324.T Harmonic Drive",st:"wl",sc:74}],
     kill:"IRR-BB below 20% deploy floor on Harmonic; Nabtesco gated on Bordier cash reconciliation."},
    {sub:"Force / torque sensor",irr:5,state:"nopipe",key:false,
     note:"6-axis F/T sensing is indispensable for manipulation, yet no listed pure-play worked up. <strong>Directed sourcing brief</strong>: scan ATI / OnRobot supply chain, SEMICON + automation exhibitor lists.",
     suppliers:[]},
    {sub:"Servo motor",irr:4,state:"gap",key:true,
     note:"Frameless torque motors. Keystone: overlaps precision-motion demand from semiconductor tooling.",
     suppliers:[{nm:"Kollmorgen",st:"uni",sc:null},{nm:"6594.T Nidec",st:"uni",sc:null}]},
    {sub:"Encoder",irr:4,state:"nopipe",key:false,
     note:"Absolute optical/inductive position feedback. No pipeline. <strong>Sourcing brief</strong>: Renishaw supply chain, precision-metrology names.",
     suppliers:[]},
    {sub:"Industrial vision",irr:4,state:"gap",key:false,
     note:"Machine-vision sensing + processing. Borderline application-layer; test substrate depth before scoring.",
     suppliers:[{nm:"Cognex",st:"uni",sc:null},{nm:"Basler",st:"uni",sc:null}]},
    {sub:"Actuator fluidics",irr:3,state:"toehold",key:true,
     note:"Pneumatic / hydraulic motion control. Keystone into factory automation. Watch-only at current price.",
     suppliers:[{nm:"6273.T SMC",st:"wl",sc:70}]},
    {sub:"End effector",irr:3,state:"gap",key:false,
     note:"Grippers / hands. High customisation, weaker switching-cost moat: lower irreplaceability.",
     suppliers:[{nm:"OnRobot",st:"uni",sc:null}]},
    {sub:"Machine safety",irr:3,state:"gap",key:false,
     note:"Safety-rated controllers / light curtains. Regulated but multi-source.",
     suppliers:[{nm:"Pilz",st:"uni",sc:null}]},
  ];

  function render(id,data){
    const el=document.getElementById(id);
    el.innerHTML=data.map((c,i)=>{
      let cand="";
      if(c.state==="owned"||c.state==="toehold"){
        const held=c.suppliers.filter(s=>s.st==="held").map(s=>s.nm).join(" · ");
        cand=`<div class="cand"><span class="nm">${held}</span></div>`;
      }else if(c.state==="gap"){
        const wl=c.suppliers.filter(s=>s.st==="wl")[0];
        const uni=c.suppliers.filter(s=>s.st==="uni").length;
        if(wl){cand=`<div class="cand"><span class="wl">&#9656; ${wl.nm} &middot; sc ${wl.sc} &middot; WL</span></div>`;}
        else if(uni){cand=`<div class="cand"><span class="wl">&#9656; ${uni} universe name${uni>1?"s":""}</span></div>`;}
      }else if(c.state==="nopipe"){
        cand=`<div class="cand">&#9656; no pipeline &middot; source</div>`;
      }else if(c.state==="struct"){
        cand=`<div class="cand" style="color:var(--ink-faint)">no pure-play</div>`;
      }
      return `<div class="cell ${c.state}" style="flex:${c.irr} 1 ${96+c.irr*12}px" onclick="openDrawer('${id}',${i})">
        ${c.key?'<span class="key-badge" title="Keystone: serves >1 stack"></span>':''}
        <div class="sub">${c.sub}</div>
        ${cand}
        <div class="foot-row"><span class="irr">irr ${c.irr}</span>${c.suppliers.length>1?`<span class="more">+${c.suppliers.length} names</span>`:''}</div>
      </div>`;
    }).join("");
  }

  const DATA={"grid-ai":AI,"grid-robo":ROBO};
  function openDrawer(grid,i){
    const c=DATA[grid][i];
    const statBadge={held:"st-held",wl:"st-wl",uni:"st-uni"};
    const statTxt={held:"HELD",wl:"WATCHLIST",uni:"UNIVERSE"};
    let sup = c.suppliers.length
      ? c.suppliers.map(s=>`<div class="sup">
          <span class="snm">${s.nm}</span>
          <span class="stat ${statBadge[s.st]}">${statTxt[s.st]}</span>
          <span class="ssc">${s.sc??"&mdash;"}</span>
          ${s.st==="wl"?'<a class="slink" href="#">open WL &rsaquo;</a>':(s.st==="uni"?'<a class="slink" href="#">score &rsaquo;</a>':'<span class="slink" style="color:var(--ink-faint)">held</span>')}
        </div>`).join("")
      : `<div style="font-family:var(--mono);font-size:11px;color:var(--ink-faint);padding:10px 0">No listed supplier in universe.</div>`;
    document.getElementById("drawer-body").innerHTML=`
      <div class="dr-eyebrow">${grid==="grid-ai"?"AI Datacentre":"Humanoid Robot"} &middot; bottleneck note</div>
      <div class="dr-title">${c.sub}</div>
      <div class="dr-badges">
        ${c.key?'<span class="badge b-key">&#9670; keystone</span>':''}
        <span class="badge b-state" style="color:${STATE_COLR[c.state]}">${STATE_LABEL[c.state]}</span>
        <span class="badge b-irr">irreplaceability ${c.irr}/5</span>
      </div>
      <p class="dr-note">${c.note}</p>
      ${c.kill?`<div class="dr-kill">&#9888; kill / gate: ${c.kill}</div>`:''}
      <div class="dr-h">Supplier pipeline</div>
      ${sup}
      <div class="dr-h">from vault</div>
      <div style="font-family:var(--mono);font-size:10.5px;color:var(--ink-faint);line-height:1.7">
        bottlenecks/${c.sub.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.md<br>
        indexed &middot; type=bottleneck &middot; vault_notes_meta
      </div>`;
    document.getElementById("drawer").classList.add("open");
    document.getElementById("scrim").classList.add("open");
  }
  function closeDrawer(){
    document.getElementById("drawer").classList.remove("open");
    document.getElementById("scrim").classList.remove("open");
  }
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer()});
  render("grid-ai",AI);render("grid-robo",ROBO);
</script>
</body>
</html>
