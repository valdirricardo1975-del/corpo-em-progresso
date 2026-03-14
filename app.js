const STORAGE_KEY = "corpo_em_progresso_final_v1";
let chartPeso = null;
let chartMedidas = null;

const defaultState = {
  perfilAtualId: "p1",
  perfis: [
    { id: "p1", nome: "Você", altura: 1.75, metaPeso: 80.0 },
    { id: "p2", nome: "Esposa", altura: 1.65, metaPeso: 60.0 }
  ],
  registros: { p1: [], p2: [] }
};

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function carregarEstado(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return clone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      perfilAtualId: parsed.perfilAtualId || "p1",
      perfis: Array.isArray(parsed.perfis) && parsed.perfis.length ? parsed.perfis : clone(defaultState.perfis),
      registros: parsed.registros || { p1: [], p2: [] }
    };
  }catch{
    return clone(defaultState);
  }
}
let state = carregarEstado();
function salvarEstado(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function $(id){ return document.getElementById(id); }
function format1(val, suffix=""){
  if(val === null || val === undefined || val === "" || Number.isNaN(Number(val))) return "--" + suffix;
  return Number(val).toFixed(1) + suffix;
}
function perfilAtual(){ return state.perfis.find(p => p.id === state.perfilAtualId) || state.perfis[0]; }
function registrosAtuais(){
  const lista = state.registros[state.perfilAtualId] || [];
  return [...lista].sort((a,b) => new Date(a.data) - new Date(b.data));
}
function calcularIMC(peso, altura){ if(!peso || !altura) return null; return peso / (altura * altura); }
function classificarIMC(imc){
  if(imc == null) return "--";
  if(imc < 18.5) return "Abaixo do peso";
  if(imc < 25) return "Normal";
  if(imc < 30) return "Sobrepeso";
  if(imc < 35) return "Obesidade I";
  if(imc < 40) return "Obesidade II";
  return "Obesidade III";
}
function dataHoje(){ return new Date().toISOString().split("T")[0]; }
function formatarDataBR(iso){ const [a,m,d] = iso.split("-"); return d + "/" + m + "/" + a; }

function preencherPerfilSelect(){
  const select = $("perfilSelect");
  select.innerHTML = "";
  state.perfis.forEach(perfil => {
    const opt = document.createElement("option");
    opt.value = perfil.id;
    opt.textContent = perfil.nome;
    if(perfil.id === state.perfilAtualId) opt.selected = true;
    select.appendChild(opt);
  });
}
function preencherPerfilForm(){
  const perfil = perfilAtual();
  $("nomePerfilInput").value = perfil.nome;
  $("alturaInput").value = Number(perfil.altura).toFixed(2);
  $("metaInput").value = Number(perfil.metaPeso).toFixed(1);
}
function mediaUltimos(regs, campo, qtd){
  const arr = regs.slice(-qtd).map(r => Number(r[campo])).filter(v => !Number.isNaN(v));
  if(!arr.length) return null;
  return arr.reduce((a,b) => a+b, 0) / arr.length;
}
function variacao30(regs){
  if(regs.length < 2) return null;
  const ultimo = regs[regs.length - 1];
  const alvo = new Date(ultimo.data);
  alvo.setDate(alvo.getDate() - 30);
  const antigo = regs.find(r => new Date(r.data) >= alvo) || regs[0];
  return Number(ultimo.peso) - Number(antigo.peso);
}

function atualizarResumo(){
  const perfil = perfilAtual();
  const regs = registrosAtuais();
  $("metaPeso").textContent = format1(perfil.metaPeso, " kg");

  if(!regs.length){
    $("pesoAtual").textContent = "-- kg";
    $("pesoSubinfo").textContent = "Sem registros";
    $("imc").textContent = "--";
    $("imcClass").textContent = "--";
    $("metaFalta").textContent = "--";
    $("media7").textContent = "-- kg";
    $("var30").textContent = "-- kg";
    $("metaStatus").textContent = "--";
    $("progressFill").style.width = "0%";
    $("ultimaGordura").textContent = "-- %";
    $("ultimaCintura").textContent = "-- cm";
    $("ultimoQuadril").textContent = "-- cm";
    $("ultimoBraco").textContent = "-- cm";
    $("ultimaCoxa").textContent = "-- cm";
    return;
  }

  const ultimo = regs[regs.length - 1];
  const peso = Number(ultimo.peso);
  $("pesoAtual").textContent = format1(peso, " kg");
  $("pesoSubinfo").textContent = "Último registro em " + formatarDataBR(ultimo.data);

  const imc = calcularIMC(peso, Number(perfil.altura));
  $("imc").textContent = imc ? Number(imc).toFixed(1) : "--";
  $("imcClass").textContent = classificarIMC(imc);

  const media7 = mediaUltimos(regs, "peso", 7);
  $("media7").textContent = media7 == null ? "-- kg" : Number(media7).toFixed(1) + " kg";

  const variacao = variacao30(regs);
  $("var30").textContent = variacao == null ? "-- kg" : ((variacao > 0 ? "+" : "") + Number(variacao).toFixed(1) + " kg");

  const falta = peso - Number(perfil.metaPeso);
  $("metaFalta").textContent = falta > 0 ? "Faltam " + falta.toFixed(1) + " kg" : (falta < 0 ? "Meta superada" : "Meta atingida");

  const inicial = Number(regs[0].peso);
  const total = Math.max(inicial - Number(perfil.metaPeso), 0.1);
  const perdido = Math.max(inicial - peso, 0);
  const progresso = Math.max(0, Math.min((perdido / total) * 100, 100));
  $("metaStatus").textContent = progresso.toFixed(0) + "%";
  $("progressFill").style.width = progresso + "%";

  $("ultimaGordura").textContent = format1(ultimo.gordura, " %");
  $("ultimaCintura").textContent = format1(ultimo.cintura, " cm");
  $("ultimoQuadril").textContent = format1(ultimo.quadril, " cm");
  $("ultimoBraco").textContent = format1(ultimo.braco, " cm");
  $("ultimaCoxa").textContent = format1(ultimo.coxa, " cm");
}

function renderHistorico(){
  const wrap = $("historicoLista");
  wrap.innerHTML = "";
  const regs = registrosAtuais().slice().reverse();
  if(!regs.length){
    wrap.innerHTML = '<div class="history-item">Nenhum registro ainda.</div>';
    return;
  }
  regs.forEach(reg => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-head">
        <div>
          <div class="history-date">${formatarDataBR(reg.data)}</div>
          <div class="history-weight">${format1(reg.peso, " kg")}</div>
        </div>
        <button class="delete-btn" data-date="${reg.data}">Excluir</button>
      </div>
      <div class="history-grid">
        <div>Gordura: ${format1(reg.gordura, " %")}</div>
        <div>Cintura: ${format1(reg.cintura, " cm")}</div>
        <div>Quadril: ${format1(reg.quadril, " cm")}</div>
        <div>Braço: ${format1(reg.braco, " cm")}</div>
        <div>Coxa: ${format1(reg.coxa, " cm")}</div>
        <div>${reg.obs ? "Obs.: " + reg.obs : "Sem observações"}</div>
      </div>
    `;
    wrap.appendChild(item);
  });
  wrap.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const data = btn.getAttribute("data-date");
      state.registros[state.perfilAtualId] = (state.registros[state.perfilAtualId] || []).filter(r => r.data !== data);
      salvarEstado();
      renderTudo();
    });
  });
}

function renderGraficoPeso(){
  const regs = registrosAtuais();
  const ctx = $("graficoPeso");
  if(chartPeso){ chartPeso.destroy(); chartPeso = null; }
  if(!regs.length) return;
  chartPeso = new Chart(ctx, {
    type: "line",
    data: {
      labels: regs.map(r => formatarDataBR(r.data)),
      datasets: [{
        data: regs.map(r => Number(r.peso)),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.18)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(34,197,94,0.08)" } } }
    }
  });
}

function renderGraficoMedidas(){
  const regs = registrosAtuais();
  const campo = $("medidaSelect").value;
  const ctx = $("graficoMedidas");
  if(chartMedidas){ chartMedidas.destroy(); chartMedidas = null; }
  const filtrados = regs.filter(r => r[campo] !== null && r[campo] !== undefined && r[campo] !== "");
  if(!filtrados.length) return;
  const rotulos = {
    gordura: "Gordura corporal (%)",
    cintura: "Cintura (cm)",
    quadril: "Quadril (cm)",
    braco: "Braço (cm)",
    coxa: "Coxa (cm)"
  };
  chartMedidas = new Chart(ctx, {
    type: "line",
    data: {
      labels: filtrados.map(r => formatarDataBR(r.data)),
      datasets: [{
        label: rotulos[campo],
        data: filtrados.map(r => Number(r[campo])),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22,163,74,0.15)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(22,163,74,0.08)" } } }
    }
  });
}

function renderCalendario(){
  const grid = $("calendarGrid");
  grid.innerHTML = "";
  const datas = new Set(registrosAtuais().map(r => r.data));
  const now = new Date();
  for(let i=34; i>=0; i--){
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const el = document.createElement("div");
    if(datas.has(iso)) el.classList.add("on");
    grid.appendChild(el);
  }
}

function valorOuNulo(v){
  const num = parseFloat(v);
  return Number.isNaN(num) ? null : num;
}

function limparFormulario(){
  $("dataInput").value = dataHoje();
  $("pesoInput").value = "";
  $("gorduraInput").value = "";
  $("cinturaInput").value = "";
  $("quadrilInput").value = "";
  $("bracoInput").value = "";
  $("coxaInput").value = "";
  $("obsInput").value = "";
}

function salvarRegistroAtual(){
  const data = $("dataInput").value || dataHoje();
  const peso = parseFloat($("pesoInput").value);
  if(Number.isNaN(peso)){ alert("Informe o peso."); return; }

  const novo = {
    data,
    peso,
    gordura: valorOuNulo($("gorduraInput").value),
    cintura: valorOuNulo($("cinturaInput").value),
    quadril: valorOuNulo($("quadrilInput").value),
    braco: valorOuNulo($("bracoInput").value),
    coxa: valorOuNulo($("coxaInput").value),
    obs: $("obsInput").value.trim()
  };

  const lista = state.registros[state.perfilAtualId] || [];
  state.registros[state.perfilAtualId] = lista.filter(r => r.data !== data);
  state.registros[state.perfilAtualId].push(novo);
  salvarEstado();
  limparFormulario();
  renderTudo();
  ativarTab("inicio");
}

function salvarPerfilAtual(){
  const perfil = perfilAtual();
  perfil.nome = $("nomePerfilInput").value.trim() || perfil.nome;
  perfil.altura = parseFloat($("alturaInput").value) || perfil.altura;
  perfil.metaPeso = parseFloat($("metaInput").value) || perfil.metaPeso;
  salvarEstado();
  preencherPerfilSelect();
  renderTudo();
  alert("Perfil salvo com sucesso.");
}

function exportarBackup(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "corpo-em-progresso-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importarBackup(file){
  try{
    const texto = await file.text();
    state = JSON.parse(texto);
    salvarEstado();
    renderTudo();
    alert("Backup importado com sucesso.");
  }catch{
    alert("Não foi possível importar o backup.");
  }
}

function ativarTab(tab){
  document.querySelectorAll(".tab-page").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
  $("tab-" + tab).classList.add("active");
  document.querySelector('.nav-btn[data-tab="' + tab + '"]').classList.add("active");
  if(tab === "graficos"){
    setTimeout(() => { renderGraficoPeso(); renderGraficoMedidas(); }, 80);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTudo(){
  preencherPerfilSelect();
  preencherPerfilForm();
  atualizarResumo();
  renderHistorico();
  renderGraficoPeso();
  renderGraficoMedidas();
  renderCalendario();
}

$("salvarRegistroBtn").addEventListener("click", salvarRegistroAtual);
$("salvarPerfilBtn").addEventListener("click", salvarPerfilAtual);
$("exportarBtn").addEventListener("click", exportarBackup);
$("importarInput").addEventListener("change", (e) => { if(e.target.files[0]) importarBackup(e.target.files[0]); });
$("medidaSelect").addEventListener("change", renderGraficoMedidas);
$("perfilSelect").addEventListener("change", (e) => {
  state.perfilAtualId = e.target.value;
  salvarEstado();
  renderTudo();
  limparFormulario();
});
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => ativarTab(btn.dataset.tab)));

$("dataInput").value = dataHoje();
renderTudo();
