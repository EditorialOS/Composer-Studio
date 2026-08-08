// Composer Studio operator console — a single self-contained page served at
// the app root. It calls the same-origin REST API (so no CORS, and it ships
// and deploys with the server). This is the human screen over the engine:
// type a brief, watch the package get built.

export const STUDIO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Composer Studio</title>
<style>
  :root {
    --paper:#F4F6F8; --surface:#fff; --surface-2:#FBFBFD; --ink:#15171C; --ink-soft:#565C68;
    --ink-faint:#878D99; --line:#E2E5EB; --accent:#4A43B0; --accent-soft:#ECEBF8;
    --ok:#17835F; --ok-soft:#E2F1EB; --warn:#A66C06; --warn-soft:#F6EDDA;
    --fail:#B4362F; --fail-soft:#F7E6E4; --idle:#667085; --idle-soft:#EBEDF1;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --serif:Georgia,"Iowan Old Style","Times New Roman",serif;
    --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
    --shadow:0 1px 2px rgba(20,22,30,.04),0 8px 24px -12px rgba(20,22,30,.12);
  }
  @media (prefers-color-scheme:dark){:root{
    --paper:#0F1116; --surface:#161921; --surface-2:#1B1E27; --ink:#EAECF0; --ink-soft:#9AA1AD;
    --ink-faint:#6C7382; --line:#262A34; --accent:#928BEA; --accent-soft:#20213A;
    --ok:#3FC793; --ok-soft:#14261F; --warn:#E2A94F; --warn-soft:#2A2213;
    --fail:#F0827A; --fail-soft:#2A1614; --idle:#8A91A0; --idle-soft:#20242E;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 12px 30px -14px rgba(0,0,0,.6);
  }}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
  header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
    padding:16px clamp(16px,4vw,32px);border-bottom:1px solid var(--line);background:var(--surface)}
  .brand{font-family:var(--serif);font-weight:600;font-size:20px;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}
  .brand .mark{width:22px;height:22px;border-radius:6px;background:var(--accent);display:inline-block}
  .modechip{font-size:12px;font-weight:600;letter-spacing:.04em;padding:5px 12px;border-radius:999px;background:var(--idle-soft);color:var(--ink-soft)}
  .modechip.real{background:var(--ok-soft);color:var(--ok)}
  .caps{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--ink-faint)}
  .caps span{display:inline-flex;align-items:center;gap:6px}
  .cdot{width:8px;height:8px;border-radius:50%;background:var(--idle)}
  .cdot.on{background:var(--ok)}
  main{max-width:1120px;margin:0 auto;padding:clamp(18px,3vw,30px) clamp(16px,4vw,32px) 80px;
    display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:28px;align-items:start}
  @media (max-width:820px){main{grid-template-columns:1fr}}
  .panel{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:20px}
  .panel h2{font-family:var(--serif);font-weight:600;font-size:17px;margin:0 0 4px}
  .panel .hint{color:var(--ink-faint);font-size:12.5px;margin:0 0 16px}
  label{display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-faint);margin:16px 0 6px}
  input[type=text],textarea,select{width:100%;font-family:inherit;font-size:14px;color:var(--ink);
    background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:10px 12px}
  textarea{min-height:120px;resize:vertical;line-height:1.5}
  input[type=text]{font-family:var(--mono);font-size:13px}
  .opts{display:flex;flex-wrap:wrap;gap:8px}
  .opt{font-size:13px;border:1px solid var(--line);border-radius:8px;padding:7px 11px;cursor:pointer;background:var(--surface-2);user-select:none}
  .opt.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600}
  .row{display:flex;gap:12px;align-items:end}
  .row>div{flex:1}
  button.go{margin-top:20px;width:100%;background:var(--accent);color:#fff;border:0;border-radius:10px;
    padding:13px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
  button.go:disabled{opacity:.55;cursor:default}
  .empty{color:var(--ink-faint);font-size:14px;text-align:center;padding:60px 20px}
  .verdict{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;margin-bottom:8px}
  .verdict .v{font-family:var(--serif);font-weight:600;font-size:16px}
  .verdict.approved{background:var(--ok-soft);color:var(--ok)}
  .verdict.revise{background:var(--warn-soft);color:var(--warn)}
  .verdict p{margin:0;color:var(--ink-soft);font-size:13.5px;font-weight:400}
  .badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
    background:var(--fail);color:#fff;padding:3px 9px;border-radius:6px;margin-bottom:10px}
  .headline{font-family:var(--serif);font-weight:600;font-size:22px;line-height:1.2;margin:6px 0 2px;letter-spacing:-.01em}
  .subhead{color:var(--ink-soft);font-size:13.5px;margin:0 0 18px}
  .block{margin-top:22px}
  .block>.t{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:10px}
  .gate{display:flex;gap:11px;padding:9px 0;border-top:1px solid var(--line)}
  .gate:first-of-type{border-top:0}
  .gdot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex:none}
  .gdot.pass{background:var(--ok)} .gdot.warn{background:var(--warn)} .gdot.fail{background:var(--fail)}
  .gate .gn{font-weight:650;font-size:13.5px} .gate .go2{color:var(--ink-soft);font-size:13px}
  .assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
  .asset{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface-2)}
  .asset img{width:100%;height:96px;object-fit:cover;display:block;background:var(--idle-soft)}
  .asset .meta{padding:8px 9px}
  .asset .rp{font-size:10px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:5px;display:inline-block}
  .rp.cleared{background:var(--ok-soft);color:var(--ok)} .rp.expiring{background:var(--warn-soft);color:var(--warn)}
  .rp.check{background:var(--warn-soft);color:var(--warn)} .rp.unknown{background:var(--idle-soft);color:var(--idle)}
  .asset .ph{font-size:11.5px;color:var(--ink-soft);margin-top:4px}
  .fact{font-size:13.5px;padding:8px 0;border-top:1px solid var(--line)}
  .fact:first-child{border-top:0}
  .fact a{color:var(--accent);font-size:12px;text-decoration:none}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{font-size:12px;font-weight:600;color:#fff;padding:4px 10px;border-radius:999px}
  .delv{display:flex;gap:9px;padding:7px 0;font-size:13.5px;align-items:baseline}
  .delv .dd{width:9px;height:9px;border-radius:3px;flex:none;position:relative;top:4px}
  .delv b{font-weight:650} .delv span{color:var(--ink-soft)}
  details{margin-top:24px;font-size:12px}
  details summary{cursor:pointer;color:var(--ink-faint);font-weight:600}
  pre{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;
    font-family:var(--mono);font-size:11.5px;line-height:1.5;max-height:340px}
  .err{background:var(--fail-soft);color:var(--fail);border-radius:10px;padding:12px 14px;font-size:13.5px}
  .spin{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;vertical-align:-2px;margin-right:8px}
  @keyframes sp{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.spin{animation:none}}
  :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
</head>
<body>
<header>
  <div class="brand"><span class="mark"></span>Composer&nbsp;Studio</div>
  <div class="caps" id="caps"><span class="modechip" id="mode">connecting…</span></div>
</header>
<main>
  <form class="panel" id="form" autocomplete="off">
    <h2>New package</h2>
    <p class="hint">One brief in. The engine runs the editorial gate, finds assets, and pulls market context.</p>
    <label for="key">API key</label>
    <input type="text" id="key" value="demo" spellcheck="false" />
    <details class="conn">
      <summary>Connections &mdash; use your own accounts (optional)</summary>
      <p class="hint" style="margin:10px 0 4px">Stored only in this browser and sent with each request. Leave blank to use demo data. Get free keys from cloudinary.com, serper.dev, and beehiiv.</p>
      <label for="ck_anthropicApiKey">Anthropic API key &mdash; AI editorial gate</label>
      <input type="text" id="ck_anthropicApiKey" spellcheck="false" placeholder="sk-ant-… (already set on the server)" />
      <label for="ck_cloudinaryCloudName">Cloudinary cloud name</label>
      <input type="text" id="ck_cloudinaryCloudName" spellcheck="false" />
      <label for="ck_cloudinaryApiKey">Cloudinary API key</label>
      <input type="text" id="ck_cloudinaryApiKey" spellcheck="false" />
      <label for="ck_cloudinaryApiSecret">Cloudinary API secret</label>
      <input type="text" id="ck_cloudinaryApiSecret" spellcheck="false" />
      <label for="ck_serperApiKey">Serper API key &mdash; market search</label>
      <input type="text" id="ck_serperApiKey" spellcheck="false" />
      <label for="ck_braveApiKey">Brave Search API key &mdash; alternative to Serper</label>
      <input type="text" id="ck_braveApiKey" spellcheck="false" />
      <label for="ck_beehiivApiKey">beehiiv API key</label>
      <input type="text" id="ck_beehiivApiKey" spellcheck="false" />
      <label for="ck_beehiivPublicationId">beehiiv publication ID</label>
      <input type="text" id="ck_beehiivPublicationId" spellcheck="false" />
      <label for="ck_cmsWebhookUrl">CMS webhook URL</label>
      <input type="text" id="ck_cmsWebhookUrl" spellcheck="false" />
    </details>
    <label for="brief">Story brief</label>
    <textarea id="brief" placeholder="e.g. Breaking: 6.8 earthquake off the coast of Chile, tsunami watch issued">Breaking: 6.8 earthquake off the coast of Chile, tsunami watch issued</textarea>
    <label>Platforms</label>
    <div class="opts" id="platforms"></div>
    <label for="depth">Archive depth</label>
    <select id="depth"><option value="shallow">Shallow</option><option value="standard" selected>Standard</option><option value="deep">Deep</option></select>
    <button class="go" id="go" type="submit">Compose package</button>
  </form>
  <div class="panel" id="result"><div class="empty">Your composed package will appear here.</div></div>
</main>
<script>
(function(){
  var PLATFORMS=["Newsletter","Instagram","Web article","X/Threads","LinkedIn"];
  var chosen={"Newsletter":true};
  var pc=document.getElementById("platforms");
  PLATFORMS.forEach(function(p){
    var el=document.createElement("div");
    el.className="opt"+(chosen[p]?" on":"");
    el.textContent=p;
    el.onclick=function(){chosen[p]=!chosen[p];el.className="opt"+(chosen[p]?" on":"")};
    pc.appendChild(el);
  });
  function key(){return document.getElementById("key").value.trim()||"demo"}
  var CK=["anthropicApiKey","cloudinaryCloudName","cloudinaryApiKey","cloudinaryApiSecret","serperApiKey","braveApiKey","beehiivApiKey","beehiivPublicationId","cmsWebhookUrl"];
  (function restore(){
    var k=localStorage.getItem("composer_key"); if(k){document.getElementById("key").value=k;}
    CK.forEach(function(name){ var v=localStorage.getItem("composer_ck_"+name); var el=document.getElementById("ck_"+name); if(v&&el) el.value=v; });
  })();
  document.getElementById("key").addEventListener("input",function(){localStorage.setItem("composer_key",document.getElementById("key").value.trim());});
  CK.forEach(function(name){ var el=document.getElementById("ck_"+name); if(el) el.addEventListener("input",function(){localStorage.setItem("composer_ck_"+name,el.value.trim());}); });
  function keysObj(){ var o={}; CK.forEach(function(name){ var el=document.getElementById("ck_"+name); var v=el?el.value.trim():""; if(v) o[name]=v; }); return o; }
  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
  function api(path,opts){
    opts=opts||{};
    opts.headers=Object.assign({"Authorization":"Bearer "+key()},opts.headers||{});
    return fetch("/api"+path,opts);
  }
  function loadCaps(){
    api("/capabilities").then(function(r){return r.json()}).then(function(c){
      var mode=document.getElementById("mode");
      mode.textContent=c.mode==="real"?"REAL MODE":"DEMO MODE";
      mode.className="modechip"+(c.mode==="real"?" real":"");
      var caps=document.getElementById("caps");
      var parts=[["Search",c.webSearch&&c.webSearch.webSearch],["Assets",c.imageLibrary&&c.imageLibrary.tagSearch],
        ["Send",c.send&&(c.send.beehiivDraft||c.send.cmsDraft)],["LLM",c.llm&&c.llm.provider==="anthropic"]];
      parts.forEach(function(p){
        var s=document.createElement("span");
        s.innerHTML='<span class="cdot'+(p[1]?" on":"")+'"></span>'+p[0];
        caps.appendChild(s);
      });
    }).catch(function(){document.getElementById("mode").textContent="offline"});
  }
  function gateRow(g){
    return '<div class="gate"><span class="gdot '+esc(g.status)+'"></span><div><div class="gn">'+esc(g.gate)+
      '</div><div class="go2">'+esc(g.note)+'</div></div></div>';
  }
  function render(p){
    var h="";
    var appr=p.evaluation.verdict==="APPROVED";
    h+='<div class="verdict '+(appr?"approved":"revise")+'"><span class="v">'+esc(p.evaluation.verdict)+
       '</span><p>'+esc(p.evaluation.verdictSummary)+'</p></div>';
    if(p.badge){h+='<span class="badge">'+esc(p.badge)+'</span>';}
    h+='<div class="headline">'+esc(p.headline)+'</div><div class="subhead">'+esc(p.subhead)+'</div>';
    h+='<div class="block"><div class="t">Editorial gates</div>'+p.evaluation.gates.map(gateRow).join("")+'</div>';
    if(p.evaluation.requiredRevisions&&p.evaluation.requiredRevisions.length){
      h+='<div class="block"><div class="t">Required revisions</div><ul style="margin:0;padding-left:18px;color:var(--ink-soft);font-size:13.5px">'+
        p.evaluation.requiredRevisions.map(function(r){return "<li>"+esc(r)+"</li>"}).join("")+'</ul></div>';
    }
    if(p.assets&&p.assets.length){
      h+='<div class="block"><div class="t">Matched assets ('+p.assets.length+')</div><div class="assets">'+
        p.assets.map(function(a){
          var img=a.thumbnailUrl||a.url||"";
          return '<div class="asset">'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy" />':'')+
            '<div class="meta"><span class="rp '+esc(a.rightsStatus)+'">'+esc((a.rightsStatus||"").toUpperCase())+
            '</span><div class="ph">'+esc(a.photographer||a.id)+'</div></div></div>';
        }).join("")+'</div></div>';
    }
    var m=p.market||{};
    if(m.competitors&&m.competitors.length){
      h+='<div class="block"><div class="t">Competitors</div><div class="chips">'+
        m.competitors.map(function(c){return '<span class="chip" style="background:'+esc(c.color||"#667085")+'">'+esc(c.name)+'</span>'}).join("")+'</div></div>';
    }
    if(m.facts&&m.facts.length){
      h+='<div class="block"><div class="t">Sourced facts</div>'+
        m.facts.map(function(f){return '<div class="fact">'+esc(f.text)+
          (f.sourceUrl?' <a href="'+esc(f.sourceUrl)+'" target="_blank" rel="noopener">'+esc(f.sourceName||"source")+' &#8599;</a>':'')+'</div>'}).join("")+'</div>';
    }
    if(typeof m.droppedFactCount==="number"&&m.droppedFactCount>0){
      h+='<div class="hint" style="margin-top:8px">'+m.droppedFactCount+' fact(s) dropped — no source URL.</div>';
    }
    if(p.deliverables&&p.deliverables.length){
      h+='<div class="block"><div class="t">Deliverables</div>'+
        p.deliverables.map(function(d){return '<div class="delv"><span class="dd" style="background:'+esc(d.color||"#4A43B0")+'"></span><div><b>'+
          esc(d.title)+'</b> &mdash; <span>'+esc(d.detail)+'</span></div></div>'}).join("")+'</div>';
    }
    h+='<details><summary>Raw package JSON</summary><pre>'+esc(JSON.stringify(p,null,2))+'</pre></details>';
    document.getElementById("result").innerHTML=h;
  }
  document.getElementById("form").addEventListener("submit",function(e){
    e.preventDefault();
    var brief=document.getElementById("brief").value.trim();
    var res=document.getElementById("result");
    if(!brief){res.innerHTML='<div class="err">Please enter a brief.</div>';return;}
    var plats=PLATFORMS.filter(function(p){return chosen[p]});
    var go=document.getElementById("go");
    go.disabled=true;go.innerHTML='<span class="spin"></span>Composing…';
    res.innerHTML='<div class="empty">Running the editorial gate, asset search, and market scan…</div>';
    api("/compose",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({brief:brief,platforms:plats.length?plats:["Newsletter"],archiveDepth:document.getElementById("depth").value,keys:keysObj()})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
    .then(function(o){ if(!o.ok){res.innerHTML='<div class="err">'+esc((o.j&&o.j.message)||"Request failed")+'</div>';} else {render(o.j);} })
    .catch(function(err){res.innerHTML='<div class="err">'+esc(String(err))+'</div>';})
    .finally(function(){go.disabled=false;go.textContent="Compose package";});
  });
  loadCaps();
})();
</script>
</body>
</html>`;
