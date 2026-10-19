(async()=>{
  const [cd,fd]=await Promise.all([fetch('/data/cities.json').then(r=>r.json()),fetch('/data/fleet.json').then(r=>r.json())]);
  const S=cd.statuses,esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // map
  const map=L.map('leaflet',{worldCopyJump:true,scrollWheelZoom:false}).setView([33,-96],4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  const order=Object.keys(S);
  [...cd.cities].sort((a,b)=>order.indexOf(b.status)-order.indexOf(a.status)).forEach(c=>{
    const s=S[c.status],live=c.status.startsWith('live');
    const area=c.service_area_sq_mi?`<br>~${c.service_area_sq_mi} sq mi (est.)`:'';
    const link=c.has_page?`<br><a href="/city/${c.slug}.html">Details →</a>`:`<br><a href="${esc(c.sources[0])}" target="_blank" rel="noopener nofollow">Request on X</a> · <a href="#newsletter">Get alerted</a>`;
    L.circleMarker([c.lat,c.lng],{radius:live?9:7,color:'#0b0f17',weight:2,fillColor:s.color,fillOpacity:.95}).addTo(map)
     .bindPopup(`<b>${esc(c.name)}${c.region?', '+esc(c.region):''}</b><br><span style="color:${s.color}">${s.label}</span>${area}${link}`);
  });
  document.getElementById('legend').innerHTML=order.map(k=>`<span><i class="dot" style="--c:${S[k].color}"></i>${S[k].label}</span>`).join('');
  document.getElementById('citylist').innerHTML=cd.cities.filter(c=>c.has_page).map(c=>`<a href="/city/${c.slug}.html"><span>${esc(c.name)}${c.region?', '+esc(c.region):''}</span><span class="small" style="color:${S[c.status].color}">${S[c.status].label}</span></a>`).join('');
  // charts
  Chart.defaults.color='#94a3b8';Chart.defaults.borderColor='#1f2937';
  const lab=fd.series.map(p=>p.date);
  new Chart(document.getElementById('fleetChart'),{type:'line',data:{labels:lab,datasets:[
    {label:'Total registered',data:fd.series.map(p=>p.total),borderColor:'#e5e7eb',spanGaps:true,tension:.25},
    {label:'Model Y',data:fd.series.map(p=>p.model_y),borderColor:'#3b82f6',spanGaps:true,tension:.25},
    {label:'Cybercab',data:fd.series.map(p=>p.cybercab),borderColor:'#e31937',backgroundColor:'rgba(227,25,55,.15)',fill:true,spanGaps:true,tension:.25}]},
    options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'}}}});
  const live=cd.cities.filter(c=>c.service_area_history&&c.service_area_history.length&&c.status.startsWith('live'));
  const norm=d=>d.length===7?d+'-15':d;const pal=['#22c55e','#3b82f6','#f59e0b','#a855f7','#e31937','#14b8a6','#eab308'];
  new Chart(document.getElementById('areaChart'),{type:'line',data:{datasets:live.map((c,i)=>({label:c.name,data:c.service_area_history.map(h=>({x:new Date(norm(h.date)).getTime(),y:h.sq_mi})),borderColor:pal[i%pal.length],stepped:'before',pointRadius:3}))},
    options:{maintainAspectRatio:false,parsing:true,scales:{x:{type:'linear',ticks:{callback:v=>new Date(v).toLocaleDateString('en-US',{month:'short',year:'2-digit'}),maxTicksLimit:6}},y:{title:{display:true,text:'sq mi (est.)'}}},plugins:{legend:{position:'bottom',labels:{boxWidth:10}},tooltip:{callbacks:{title:i=>new Date(i[0].parsed.x).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}}}}});
})().catch(e=>console.error('CabCount load failed',e));
