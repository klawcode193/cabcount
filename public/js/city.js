(()=>{const c=window.CITY,el=document.getElementById('cityArea');if(!el||!c.history.length)return;
Chart.defaults.color='#94a3b8';Chart.defaults.borderColor='#1f2937';
new Chart(el,{type:'line',data:{labels:c.history.map(h=>h.date),datasets:[{label:c.name+' sq mi (est.)',data:c.history.map(h=>h.sq_mi),borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,.15)',fill:true,stepped:'before',pointRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});})();
