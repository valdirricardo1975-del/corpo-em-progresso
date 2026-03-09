const STORAGE_KEY = "corpo_em_progresso_v4";
let chartPeso = null;

const hoje = new Date().toISOString().split("T")[0];

const defaultState = {
  perfilAtualId: "p1",
  perfis: [
    { id: "p1", nome: "Você", altura: 1.75, metaPeso: 80.0 },
    { id: "p2", nome: "Esposa", altura: 1.65, metaPeso: 60.0 }
  ],
  registros: {
    p1: [],
    p2: []
  }
};

function cloneData(data) {
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
}

function carregarEstado() {
  const salvo = localStorage.getItem(STORAGE_KEY);
  if (!salvo) return cloneData(defaultState);

  try {
    const estado = JSON.parse(salvo);
    return {
      perfilAtualId: estado.perfilAtualId || "p1",
      perfis: Array.isArray(estado.perfis) && estado.perfis.length ? estado.perfis : cloneData(defaultState.perfis),
      registros: estado.registros || { p1: [], p2: [] }
    };
  } catch {
    return cloneData(defaultState);
  }
}

let state = carregarEstado();

function salvarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function $(id) {
  return document.getElementById(id);
}

function format1(value, suffix = "") {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toFixed(1)}${suffix}`;
}

function getPerfilAtual() {
  return state.perfis.find(p => p.id === state.perfilAtualId) || state.perfis[0];
}

function getRegistrosAtual() {
  const lista = state.registros[state.perfilAtualId] || [];
  return [...lista].sort((a, b) => new Date(a.data) - new Date(b.data));
}

function calcularIMC(peso, altura) {
  if (!peso || !altura) return null;
  return peso / (altura * altura);
}

function classificarIMC(imc) {
  if (imc == null) return "--";
  if (imc < 18.5) return "Abaixo do peso";
  if (imc < 25) return "Normal";
  if (imc < 30) return "Sobrepeso";
  if (imc < 35) return "Obesidade I";
  if (imc < 40) return "Obesidade II";
  return "Obesidade III";
}

function popularPerfis() {
  const select = $("perfilSelect");
  select.innerHTML = "";
  state.perfis.forEach(perfil => {
    const option = document.createElement("option");
    option.value = perfil.id;
    option.textContent = perfil.nome;
    if (perfil.id === state.perfilAtualId) option.selected = true;
    select.appendChild(option);
  });
}

function preencherPerfil() {
  const perfil = getPerfilAtual();
  $("nomePerfilInput").value = perfil.nome;
  $("alturaInput").value = Number(perfil.altura).toFixed(2);
  $("metaInput").value = Number(perfil.metaPeso).toFixed(1);
}

function preencherDataHoje() {
  $("dataInput").value = hoje;
}

function mediaUltimosDias(registros, campo, dias = 7) {
  if (!registros.length) return null;
  const subset = registros.slice(-dias).map(r => Number(r[campo])).filter(v => !Number.isNaN(v));
  if (!subset.length) return null;
  return subset.reduce((a, b) => a + b, 0) / subset.length;
}

function variacao30Dias(registros) {
  if (registros.length < 2) return null;
  const ultimo = registros[registros.length - 1];
  const limite = new Date(ultimo.data);
  limite.setDate(limite.getDate() - 30);

  const anterior = registros.find(r => new Date(r.data) >= limite) || registros[0];
  if (!anterior || anterior === ultimo) return 0;
  return Number(ultimo.peso) - Number(anterior.peso);
}

function atualizarHero() {
  const perfil = getPerfilAtual();
  const registros = getRegistrosAtual();

  $("metaPeso").textContent = format1(perfil.metaPeso, " kg");

  if (!registros.length) {
    $("pesoAtual").textContent = "-- kg";
    $("pesoSubinfo").textContent = "Sem registros ainda";
    $("imcValor").textContent = "--";
    $("imcClassificacao").textContent = "--";
    $("media7dias").textContent = "-- kg";
    $("variacao30dias").textContent = "-- kg";
    $("faltamMeta").textContent = "--";
    $("progressoMetaTexto").textContent = "--";
    $("progressoMetaBar").style.width = "0%";
    return;
  }

  const ultimo = registros[registros.length - 1];
  const pesoAtual = Number(ultimo.peso);
  $("pesoAtual").textContent = format1(pesoAtual, " kg");
  $("pesoSubinfo").textContent = `Último registro em ${formatarDataBR(ultimo.data)}`;

  const imc = calcularIMC(pesoAtual, Number(perfil.altura));
  $("imcValor").textContent = imc ? Number(imc).toFixed(1) : "--";
  $("imcClassificacao").textContent = classificarIMC(imc);

  $("media7dias").textContent = format1(mediaUltimosDias(registros, "peso", 7), " kg");

  const variacao = variacao30Dias(registros);
  $("variacao30dias").textContent = variacao == null ? "-- kg" : `${variacao >= 0 ? "+" : ""}${Number(variacao).toFixed(1)} kg`;

  const faltam = pesoAtual - Number(perfil.metaPeso);
  if (faltam > 0) {
    $("faltamMeta").textContent = `Faltam ${faltam.toFixed(1)} kg`;
  } else if (faltam < 0) {
    $("faltamMeta").textContent = `Meta superada em ${Math.abs(faltam).toFixed(1)} kg`;
  } else {
    $("faltamMeta").textContent = "Meta atingida";
  }

  const primeiroPeso = Number(registros[0].peso);
  const totalParaPerder = Math.max(primeiroPeso - Number(perfil.metaPeso), 0.1);
  const jaPerdido = Math.max(primeiroPeso - pesoAtual, 0);
  const progresso = Math.max(0, Math.min((jaPerdido / totalParaPerder) * 100, 100));

  $("progressoMetaTexto").textContent = `${progresso.toFixed(0)}%`;
  $("progressoMetaBar").style.width = `${progresso}%`;
}

function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function renderGrafico() {
  const registros = getRegistrosAtual();
  const ctx = $("graficoPeso");

  if (chartPeso) {
    chartPeso.destroy();
    chartPeso = null;
  }

  if (!registros.length) return;

  chartPeso = new Chart(ctx, {
    type: "line",
    data: {
      labels: registros.map(r => formatarDataBR(r.data)),
      datasets: [
        {
          label: "Peso",
          data: registros.map(r => Number(r.peso)),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.12)",
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: false,
          grid: { color: "#edf4ee" }
        }
      }
    }
  });
}

function renderHistorico() {
  const registros = getRegistrosAtual().slice().reverse();
  const wrap = $("historicoLista");
  wrap.innerHTML = "";

  if (!registros.length) {
    wrap.innerHTML = `<div class="history-item">Nenhum registro ainda.</div>`;
    return;
  }

  registros.forEach(registro => {
    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">
        <div>
          <div class="history-date">${formatarDataBR(registro.data)}</div>
          <div class="history-peso">${format1(registro.peso, " kg")}</div>
        </div>
      </div>

      <div class="history-grid">
        <div>Gordura: ${format1(registro.gordura, "%")}</div>
        <div>Cintura: ${format1(registro.cintura, " cm")}</div>
        <div>Quadril: ${format1(registro.quadril, " cm")}</div>
        <div>Braço: ${format1(registro.braco, " cm")}</div>
        <div>Coxa: ${format1(registro.coxa, " cm")}</div>
        <div>${registro.obs ? `Obs.: ${registro.obs}` : "Sem observações"}</div>
      </div>

      <div class="history-actions">
        <button class="delete-btn" data-date="${registro.data}">Excluir</button>
      </div>
    `;

    wrap.appendChild(item);
  });

  wrap.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const data = btn.getAttribute("data-date");
      state.registros[state.perfilAtualId] = (state.registros[state.perfilAtualId] || []).filter(r => r.data !== data);
      salvarEstado();
      atualizarTudo();
    });
  });
}

function renderFotos() {
  const registros = getRegistrosAtual().filter(r => r.foto);
  const antesSelect = $("fotoAntesSelect");
  const depoisSelect = $("fotoDepoisSelect");

  antesSelect.innerHTML = "";
  depoisSelect.innerHTML = "";

  if (!registros.length) {
    antesSelect.innerHTML = `<option>Sem fotos</option>`;
    depoisSelect.innerHTML = `<option>Sem fotos</option>`;
    $("fotoAntesPreview").removeAttribute("src");
    $("fotoDepoisPreview").removeAttribute("src");
    return;
  }

  registros.forEach((registro, index) => {
    const texto = `${formatarDataBR(registro.data)} — ${format1(registro.peso, " kg")}`;

    const optionAntes = document.createElement("option");
    optionAntes.value = index;
    optionAntes.textContent = texto;

    const optionDepois = document.createElement("option");
    optionDepois.value = index;
    optionDepois.textContent = texto;

    antesSelect.appendChild(optionAntes);
    depoisSelect.appendChild(optionDepois);
  });

  antesSelect.value = "0";
  depoisSelect.value = String(registros.length - 1);

  function atualizarPreview() {
    const antes = registros[Number(antesSelect.value)];
    const depois = registros[Number(depoisSelect.value)];
    $("fotoAntesPreview").src = antes?.foto || "";
    $("fotoDepoisPreview").src = depois?.foto || "";
  }

  antesSelect.onchange = atualizarPreview;
  depoisSelect.onchange = atualizarPreview;
  atualizarPreview();
}

function atualizarTudo() {
  popularPerfis();
  preencherPerfil();
  atualizarHero();
  renderGrafico();
  renderHistorico();
  renderFotos();
}

function limparFormularioRegistro() {
  $("pesoInput").value = "";
  $("gorduraInput").value = "";
  $("cinturaInput").value = "";
  $("quadrilInput").value = "";
  $("bracoInput").value = "";
  $("coxaInput").value = "";
  $("obsInput").value = "";
  $("fotoInput").value = "";
  preencherDataHoje();
}

function lerArquivoComoBase64(file) {
  return new Promise(resolve => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

$("registroForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = $("dataInput").value || hoje;
  const peso = parseFloat($("pesoInput").value);

  if (Number.isNaN(peso)) {
    alert("Informe o peso.");
    return;
  }

  const fotoFile = $("fotoInput").files[0];
  const fotoBase64 = await lerArquivoComoBase64(fotoFile);

  const novoRegistro = {
    data,
    peso,
    gordura: parseFloat($("gorduraInput").value) || null,
    cintura: parseFloat($("cinturaInput").value) || null,
    quadril: parseFloat($("quadrilInput").value) || null,
    braco: parseFloat($("bracoInput").value) || null,
    coxa: parseFloat($("coxaInput").value) || null,
    obs: $("obsInput").value.trim(),
    foto: fotoBase64
  };

  const lista = state.registros[state.perfilAtualId] || [];
  const existente = lista.find(r => r.data === data);

  if (existente && !fotoBase64 && existente.foto) {
    novoRegistro.foto = existente.foto;
  }

  state.registros[state.perfilAtualId] = lista.filter(r => r.data !== data);
  state.registros[state.perfilAtualId].push(novoRegistro);

  salvarEstado();
  limparFormularioRegistro();
  atualizarTudo();
});

$("perfilForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const perfil = getPerfilAtual();
  perfil.nome = $("nomePerfilInput").value.trim() || perfil.nome;
  perfil.altura = parseFloat($("alturaInput").value) || perfil.altura;
  perfil.metaPeso = parseFloat($("metaInput").value) || perfil.metaPeso;

  salvarEstado();
  atualizarTudo();
});

$("perfilSelect").addEventListener("change", (e) => {
  state.perfilAtualId = e.target.value;
  salvarEstado();
  atualizarTudo();
  limparFormularioRegistro();
});

$("exportarBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "corpo-em-progresso-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

$("importarInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = parsed;
    salvarEstado();
    atualizarTudo();
    limparFormularioRegistro();
    alert("Backup importado com sucesso.");
  } catch {
    alert("Não foi possível importar o backup.");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

preencherDataHoje();
atualizarTudo();
