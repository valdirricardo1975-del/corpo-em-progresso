
const hoje = new Date().toISOString().split("T")[0];
document.getElementById("dataInput").value = hoje;

let registros = JSON.parse(localStorage.getItem("registros")) || [];

function salvarRegistro(){
const peso = parseFloat(document.getElementById("pesoInput").value);
const data = document.getElementById("dataInput").value;

registros = registros.filter(r => r.data !== data);
registros.push({peso,data});

localStorage.setItem("registros",JSON.stringify(registros));
carregar();
}

function calcularIMC(peso,altura){
return (peso/(altura*altura)).toFixed(1);
}

function classificarIMC(imc){
if(imc<18.5) return "Abaixo do peso";
if(imc<25) return "Normal";
if(imc<30) return "Sobrepeso";
return "Obesidade";
}

function carregar(){
if(registros.length===0) return;

registros.sort((a,b)=> new Date(a.data)-new Date(b.data));
const ultimo = registros[registros.length-1];

document.getElementById("pesoAtual").innerText = ultimo.peso.toFixed(1)+" kg";

const altura = 1.75;
const imc = calcularIMC(ultimo.peso,altura);

document.getElementById("imc").innerText = imc;
document.getElementById("imcClass").innerText = classificarIMC(imc);

criarGrafico();
}

function criarGrafico(){
const labels = registros.map(r=>r.data);
const pesos = registros.map(r=>r.peso);
const ctx = document.getElementById("graficoPeso");

new Chart(ctx,{
type:"line",
data:{
labels:labels,
datasets:[{
label:"Peso",
data:pesos,
borderColor:"#22c55e",
tension:0.4,
fill:true,
backgroundColor:"rgba(34,197,94,0.2)"
}]
}
});
}

carregar();
