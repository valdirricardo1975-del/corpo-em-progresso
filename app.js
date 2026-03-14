
const hoje=new Date().toISOString().split("T")[0];
document.getElementById("dataInput").value=hoje;
let registros=JSON.parse(localStorage.getItem("peso_registros")||"[]");

function salvarRegistro(){
let peso=parseFloat(document.getElementById("pesoInput").value);
let data=document.getElementById("dataInput").value;
registros=registros.filter(r=>r.data!==data);
registros.push({peso,data});
localStorage.setItem("peso_registros",JSON.stringify(registros));
carregar();
}

function calcularIMC(p,a){return (p/(a*a));}

function carregar(){
if(registros.length==0)return;
registros.sort((a,b)=>new Date(a.data)-new Date(b.data));
let ultimo=registros[registros.length-1];
document.getElementById("pesoAtual").innerText=ultimo.peso.toFixed(1)+" kg";
let altura=1.75;
let imc=calcularIMC(ultimo.peso,altura);
document.getElementById("imc").innerText=imc.toFixed(1);
let meta=80;
document.getElementById("metaPeso").innerText=meta+" kg";
let falta=ultimo.peso-meta;
document.getElementById("metaFalta").innerText=falta>0?"faltam "+falta.toFixed(1)+" kg":"meta atingida";
let inicial=registros[0].peso;
let progresso=((inicial-ultimo.peso)/(inicial-meta))*100;
document.getElementById("metaStatus").innerText=Math.max(0,progresso).toFixed(0)+"%";
document.getElementById("progressFill").style.width=Math.max(0,progresso)+"%";
let labels=registros.map(r=>r.data);
let pesos=registros.map(r=>r.peso);
let ctx=document.getElementById("graficoPeso");
new Chart(ctx,{type:"line",data:{labels:labels,datasets:[{data:pesos,borderColor:"#22c55e",backgroundColor:"rgba(34,197,94,0.2)",fill:true,tension:0.4}]}});
let grid=document.getElementById("calendarGrid");
grid.innerHTML="";
let set=new Set(registros.map(r=>r.data));
let now=new Date();
for(let i=34;i>=0;i--){
let d=new Date(now);d.setDate(now.getDate()-i);
let iso=d.toISOString().split("T")[0];
let el=document.createElement("div");
if(set.has(iso))el.classList.add("on");
grid.appendChild(el);
}
}
carregar();
