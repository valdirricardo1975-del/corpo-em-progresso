/* =====================================================================
   Corpo em Progresso — controle de peso e medidas corporais
   Local-first (localStorage) + sincronização opcional na nuvem
   ===================================================================== */

const STORAGE_KEY = "corpo_em_progresso_v2";
const STORAGE_KEY_V1 = "corpo_em_progresso_final_v1";
const SYNC_API = "https://jsonblob.com/api/jsonBlob";
const CAMPOS_MEDIDAS = ["gordura", "cintura", "quadril", "braco", "coxa", "peito", "pescoco"];
const ROTULOS = {
  gordura: "Gordura corporal (%)",
  cintura: "Cintura (cm)",
  quadril: "Quadril (cm)",
  braco: "Braço (cm)",
  coxa: "Coxa (cm)",
  peito: "Peito (cm)",
  pescoco: "Pescoço (cm)"
};

const charts = {};
let periodoDias = 90;

/* ===================== Estado ===================== */

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function agora() { return Date.now(); }

function estadoPadrao() {
  return {
    version: 2,
    perfilAtualId: "p1",
    perfis: [{ id: "p1", nome: "Você", altura: 1.75, metaPeso: 80.0, updatedAt: agora() }],
    registros: { p1: [] },
    tombstones: {},          // { pid: { "YYYY-MM-DD": deletedAtMs } }
    perfisExcluidos: {},     // { pid: deletedAtMs }
    sync: { blobId: null, lastSyncAt: null, pendente: false }
  };
}

function migrarV1(v1) {
  const novo = estadoPadrao();
  novo.perfilAtualId = v1.perfilAtualId || "p1";
  if (Array.isArray(v1.perfis) && v1.perfis.length) {
    novo.perfis = v1.perfis.map(p => ({ ...p, updatedAt: agora() }));
  }
  novo.registros = {};
  Object.keys(v1.registros || {}).forEach(pid => {
    novo.registros[pid] = (v1.registros[pid] || []).map(r => ({ ...r, updatedAt: agora() }));
  });
  if (!novo.perfis.find(p => p.id === novo.perfilAtualId)) novo.perfilAtualId = novo.perfis[0].id;
  return novo;
}

function carregarEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = estadoPadrao();
      const st = {
        ...base,
        ...parsed,
        sync: { ...base.sync, ...(parsed.sync || {}) }
      };
      if (!Array.isArray(st.perfis) || !st.perfis.length) st.perfis = base.perfis;
      if (!st.registros) st.registros = {};
      if (!st.tombstones) st.tombstones = {};
      if (!st.perfisExcluidos) st.perfisExcluidos = {};
      if (!st.perfis.find(p => p.id === st.perfilAtualId)) st.perfilAtualId = st.perfis[0].id;
      return st;
    }
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) return migrarV1(JSON.parse(rawV1));
  } catch (e) { /* estado corrompido: recomeça */ }
  return estadoPadrao();
}

let state = carregarEstado();

function salvarEstado(dadosMudaram = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (dadosMudaram && state.sync.blobId) {
    state.sync.pendente = true;
    agendarSync();
  }
}

/* ===================== Utilidades ===================== */

function $(id) { return document.getElementById(id); }

function format1(val, suffix = "") {
  if (val === null || val === undefined || val === "" || Number.isNaN(Number(val))) return "--" + suffix;
  return Number(val).toFixed(1) + suffix;
}

function hojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatarDataBR(iso) {
  const [a, m, d] = iso.split("-");
  return d + "/" + m + "/" + a;
}

function formatarMes(yyyymm) {
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [a, m] = yyyymm.split("-");
  return nomes[Number(m) - 1] + "/" + a;
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.classList.remove("show"); el.hidden = true; }, 2600);
}

function perfilAtual() {
  return state.perfis.find(p => p.id === state.perfilAtualId) || state.perfis[0];
}

function registrosAtuais() {
  const lista = state.registros[state.perfilAtualId] || [];
  return [...lista].sort((a, b) => a.data.localeCompare(b.data));
}

function valorOuNulo(v) {
  const num = parseFloat(v);
  return Number.isNaN(num) ? null : num;
}

/* ===================== Cálculos ===================== */

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

function mediaCampo(regs, campo) {
  const arr = regs.map(r => Number(r[campo])).filter(v => !Number.isNaN(v));
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variacao30(regs) {
  if (regs.length < 2) return null;
  const ultimo = regs[regs.length - 1];
  const alvo = new Date(ultimo.data + "T12:00:00");
  alvo.setDate(alvo.getDate() - 30);
  const alvoISO = alvo.toISOString().split("T")[0];
  const antigo = regs.find(r => r.data >= alvoISO) || regs[0];
  if (antigo === ultimo) return null;
  return Number(ultimo.peso) - Number(antigo.peso);
}

// inclinação (kg/dia) por regressão linear nos últimos `dias` dias
function tendenciaKgPorDia(regs, dias = 30) {
  if (regs.length < 2) return null;
  const ultimo = regs[regs.length - 1];
  const fim = new Date(ultimo.data + "T12:00:00").getTime();
  const inicio = fim - dias * 86400000;
  const pontos = regs
    .map(r => ({ x: new Date(r.data + "T12:00:00").getTime(), y: Number(r.peso) }))
    .filter(p => p.x >= inicio && !Number.isNaN(p.y));
  if (pontos.length < 2) return null;
  const n = pontos.length;
  const mx = pontos.reduce((s, p) => s + p.x, 0) / n;
  const my = pontos.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  pontos.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) * (p.x - mx); });
  if (den === 0) return null;
  return (num / den) * 86400000; // kg por dia
}

function sequenciaDias(regs) {
  const datas = new Set(regs.map(r => r.data));
  let streak = 0;
  const d = new Date();
  // se hoje não tem registro, a sequência pode terminar ontem
  if (!datas.has(hojeISO())) d.setDate(d.getDate() - 1);
  for (;;) {
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (!datas.has(iso)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function ultimoValor(regs, campo) {
  for (let i = regs.length - 1; i >= 0; i--) {
    const v = regs[i][campo];
    if (v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function mediaMovel(valores, janela) {
  return valores.map((_, i) => {
    const ini = Math.max(0, i - janela + 1);
    const fatia = valores.slice(ini, i + 1).filter(v => v != null);
    if (!fatia.length) return null;
    return fatia.reduce((a, b) => a + b, 0) / fatia.length;
  });
}

function resumoMensal(regs) {
  const meses = {};
  regs.forEach(r => {
    const m = r.data.slice(0, 7);
    (meses[m] = meses[m] || []).push(Number(r.peso));
  });
  const chaves = Object.keys(meses).sort();
  return chaves.map((m, i) => {
    const arr = meses[m];
    const media = arr.reduce((a, b) => a + b, 0) / arr.length;
    let delta = null;
    if (i > 0) {
      const ant = meses[chaves[i - 1]];
      delta = media - ant.reduce((a, b) => a + b, 0) / ant.length;
    }
    return { mes: m, qtd: arr.length, media, min: Math.min(...arr), max: Math.max(...arr), delta };
  });
}

/* ===================== Sincronização ===================== */

let syncTimer = null;
let syncEmAndamento = false;

function agendarSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sincronizar(), 1500);
}

function dadosParaNuvem() {
  return {
    version: 2,
    perfis: state.perfis,
    registros: state.registros,
    tombstones: state.tombstones,
    perfisExcluidos: state.perfisExcluidos,
    pushedAt: agora()
  };
}

function mesclar(local, remoto) {
  const out = {
    perfis: [],
    registros: {},
    tombstones: {},
    perfisExcluidos: { ...(local.perfisExcluidos || {}) }
  };
  // tombstones de perfis: fica o mais recente
  Object.entries(remoto.perfisExcluidos || {}).forEach(([pid, t]) => {
    out.perfisExcluidos[pid] = Math.max(out.perfisExcluidos[pid] || 0, t);
  });
  // perfis: união, vence o updatedAt mais novo, exclusão vence se for mais nova
  const mapaPerfis = {};
  [...(local.perfis || []), ...(remoto.perfis || [])].forEach(p => {
    const atual = mapaPerfis[p.id];
    if (!atual || (p.updatedAt || 0) > (atual.updatedAt || 0)) mapaPerfis[p.id] = p;
  });
  Object.values(mapaPerfis).forEach(p => {
    const excluidoEm = out.perfisExcluidos[p.id] || 0;
    if (excluidoEm <= (p.updatedAt || 0)) out.perfis.push(p);
  });
  out.perfis.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  // tombstones de registros: fica o mais recente
  const pids = new Set([
    ...Object.keys(local.tombstones || {}), ...Object.keys(remoto.tombstones || {}),
    ...Object.keys(local.registros || {}), ...Object.keys(remoto.registros || {})
  ]);
  pids.forEach(pid => {
    const tl = (local.tombstones || {})[pid] || {};
    const tr = (remoto.tombstones || {})[pid] || {};
    const t = { ...tl };
    Object.entries(tr).forEach(([d, ts]) => { t[d] = Math.max(t[d] || 0, ts); });
    if (Object.keys(t).length) out.tombstones[pid] = t;
    // registros: por data, vence o mais novo; tombstone mais novo apaga
    const mapa = {};
    [...((local.registros || {})[pid] || []), ...((remoto.registros || {})[pid] || [])].forEach(r => {
      const atual = mapa[r.data];
      if (!atual || (r.updatedAt || 0) > (atual.updatedAt || 0)) mapa[r.data] = r;
    });
    const lista = Object.values(mapa).filter(r => (t[r.data] || 0) <= (r.updatedAt || 0));
    if (lista.length || (state.registros || {})[pid]) out.registros[pid] = lista;
  });
  return out;
}

function setSyncStatus(texto, classe) {
  const badge = $("syncBadge");
  const status = $("syncStatus");
  badge.textContent = texto;
  badge.className = "sync-badge " + (classe || "muted");
  status.textContent = texto;
}

function atualizarSyncUI() {
  const ligado = !!state.sync.blobId;
  $("syncOff").hidden = ligado;
  $("syncOn").hidden = !ligado;
  if (ligado) {
    $("codigoAtual").value = state.sync.blobId;
    if (state.sync.lastSyncAt) {
      const h = new Date(state.sync.lastSyncAt);
      setSyncStatus("Sincronizado às " + h.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), "ok");
    } else {
      setSyncStatus("Sincronização ativada", "ok");
    }
    if (state.sync.pendente) setSyncStatus("Alterações aguardando sincronização…", "warn");
  } else {
    setSyncStatus("Sincronização desativada", "muted");
  }
}

async function sincronizar(interativo = false) {
  if (!state.sync.blobId || syncEmAndamento) return;
  if (!navigator.onLine) { setSyncStatus("Sem internet — sincroniza quando voltar", "warn"); return; }
  syncEmAndamento = true;
  try {
    const resp = await fetch(SYNC_API + "/" + state.sync.blobId, {
      headers: { "Accept": "application/json" }, cache: "no-store"
    });
    if (resp.status === 404) {
      setSyncStatus("Código expirou na nuvem — crie um novo em Ajustes", "err");
      return;
    }
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const remoto = await resp.json();
    const local = dadosParaNuvem();
    const mesclado = mesclar(local, remoto);

    const localStr = JSON.stringify({ p: local.perfis, r: local.registros, t: local.tombstones, e: local.perfisExcluidos });
    const mescStr = JSON.stringify({ p: mesclado.perfis, r: mesclado.registros, t: mesclado.tombstones, e: mesclado.perfisExcluidos });
    const remotoStr = JSON.stringify({ p: remoto.perfis || [], r: remoto.registros || {}, t: remoto.tombstones || {}, e: remoto.perfisExcluidos || {} });

    let mudouLocal = false;
    if (mescStr !== localStr) {
      state.perfis = mesclado.perfis.length ? mesclado.perfis : estadoPadrao().perfis;
      state.registros = mesclado.registros;
      state.tombstones = mesclado.tombstones;
      state.perfisExcluidos = mesclado.perfisExcluidos;
      if (!state.perfis.find(p => p.id === state.perfilAtualId)) state.perfilAtualId = state.perfis[0].id;
      mudouLocal = true;
    }
    if (mescStr !== remotoStr) {
      const put = await fetch(SYNC_API + "/" + state.sync.blobId, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ ...mesclado, version: 2, pushedAt: agora() })
      });
      if (!put.ok) throw new Error("HTTP " + put.status);
    }
    state.sync.pendente = false;
    state.sync.lastSyncAt = agora();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (mudouLocal) renderTudo();
    atualizarSyncUI();
    if (interativo) toast("Sincronizado com sucesso.");
  } catch (e) {
    setSyncStatus("Falha ao sincronizar — tentaremos de novo", "err");
    if (interativo) toast("Não foi possível sincronizar agora.");
  } finally {
    syncEmAndamento = false;
  }
}

async function criarCodigo() {
  const btn = $("criarCodigoBtn");
  btn.disabled = true;
  btn.textContent = "Criando…";
  try {
    const resp = await fetch(SYNC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(dadosParaNuvem())
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const loc = resp.headers.get("Location") || resp.headers.get("location");
    if (!loc) throw new Error("sem Location");
    const id = loc.split("/").filter(Boolean).pop();
    state.sync.blobId = id;
    state.sync.lastSyncAt = agora();
    state.sync.pendente = false;
    salvarEstado(false);
    atualizarSyncUI();
    toast("Código criado. Digite-o no outro aparelho.");
  } catch (e) {
    toast("Não foi possível criar o código. Verifique a internet e tente de novo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Criar código de sincronização";
  }
}

async function conectarCodigo() {
  const codigo = $("codigoInput").value.trim().split("/").filter(Boolean).pop();
  if (!codigo) { toast("Cole o código gerado no outro aparelho."); return; }
  const btn = $("conectarBtn");
  btn.disabled = true;
  try {
    const resp = await fetch(SYNC_API + "/" + codigo, { headers: { "Accept": "application/json" }, cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    state.sync.blobId = codigo;
    state.sync.pendente = true;
    salvarEstado(false);
    await sincronizar(true);
    atualizarSyncUI();
    $("codigoInput").value = "";
  } catch (e) {
    toast("Código não encontrado. Confira se digitou igual ao outro aparelho.");
  } finally {
    btn.disabled = false;
  }
}

function desconectarSync() {
  if (!confirm("Desativar a sincronização neste aparelho? Os dados locais são mantidos.")) return;
  state.sync = { blobId: null, lastSyncAt: null, pendente: false };
  salvarEstado(false);
  atualizarSyncUI();
}

/* ===================== Dashboard ===================== */

function atualizarResumo() {
  const perfil = perfilAtual();
  const regs = registrosAtuais();
  $("metaPeso").textContent = format1(perfil.metaPeso, " kg");

  const setMedidas = (ultimo) => {
    $("ultimaGordura").textContent = format1(ultimo ? ultimoValor(regs, "gordura") : null, " %");
    $("ultimaCintura").textContent = format1(ultimo ? ultimoValor(regs, "cintura") : null, " cm");
    $("ultimoQuadril").textContent = format1(ultimo ? ultimoValor(regs, "quadril") : null, " cm");
    $("ultimoBraco").textContent = format1(ultimo ? ultimoValor(regs, "braco") : null, " cm");
    $("ultimaCoxa").textContent = format1(ultimo ? ultimoValor(regs, "coxa") : null, " cm");
    $("ultimoPeito").textContent = format1(ultimo ? ultimoValor(regs, "peito") : null, " cm");
    $("ultimoPescoco").textContent = format1(ultimo ? ultimoValor(regs, "pescoco") : null, " cm");
    const c = ultimo ? ultimoValor(regs, "cintura") : null;
    const q = ultimo ? ultimoValor(regs, "quadril") : null;
    $("ultimoRCQ").textContent = (c && q) ? (c / q).toFixed(2) : "--";
  };

  if (!regs.length) {
    $("pesoAtual").textContent = "-- kg";
    $("pesoSubinfo").textContent = "Sem registros";
    $("imc").textContent = "--";
    $("imcClass").textContent = "--";
    $("metaFalta").textContent = "--";
    $("media7").textContent = "--";
    $("media7Comp").textContent = "Últimos registros";
    $("var30").textContent = "--";
    $("streak").textContent = "0";
    $("tendencia").textContent = "--";
    $("previsaoMeta").textContent = "--";
    $("metaStatus").textContent = "--";
    $("progressFill").style.width = "0%";
    setMedidas(null);
    renderGaugeIMC(null);
    return;
  }

  const ultimo = regs[regs.length - 1];
  const peso = Number(ultimo.peso);
  $("pesoAtual").textContent = format1(peso, " kg");
  $("pesoSubinfo").textContent = "Último registro em " + formatarDataBR(ultimo.data);

  const imc = calcularIMC(peso, Number(perfil.altura));
  $("imc").textContent = imc ? imc.toFixed(1) : "--";
  $("imcClass").textContent = classificarIMC(imc);
  renderGaugeIMC(imc);

  const m7 = mediaCampo(regs.slice(-7), "peso");
  $("media7").textContent = m7 == null ? "--" : m7.toFixed(1) + " kg";
  const m7ant = regs.length > 7 ? mediaCampo(regs.slice(-14, -7), "peso") : null;
  if (m7 != null && m7ant != null) {
    const d = m7 - m7ant;
    $("media7Comp").textContent = (d <= 0 ? "▼ " : "▲ ") + Math.abs(d).toFixed(1) + " kg vs 7 dias antes";
  } else {
    $("media7Comp").textContent = "Últimos registros";
  }

  const v30 = variacao30(regs);
  $("var30").textContent = v30 == null ? "--" : (v30 > 0 ? "+" : "") + v30.toFixed(1) + " kg";

  $("streak").textContent = String(sequenciaDias(regs));

  const slope = tendenciaKgPorDia(regs, 30);
  $("tendencia").textContent = slope == null ? "--" : (slope * 7 > 0 ? "+" : "") + (slope * 7).toFixed(2);

  // previsão de quando atinge a meta mantendo o ritmo
  const falta = Number(perfil.metaPeso) - peso;
  if (slope != null && Math.abs(slope) >= 0.005 && falta !== 0 && Math.sign(falta) === Math.sign(slope)) {
    const dias = falta / slope;
    if (dias > 0 && dias < 730) {
      const alvo = new Date();
      alvo.setDate(alvo.getDate() + Math.round(dias));
      $("previsaoMeta").textContent = String(alvo.getDate()).padStart(2, "0") + "/" +
        String(alvo.getMonth() + 1).padStart(2, "0") + "/" + alvo.getFullYear();
    } else {
      $("previsaoMeta").textContent = "--";
    }
  } else {
    $("previsaoMeta").textContent = "--";
  }

  const diff = peso - Number(perfil.metaPeso);
  $("metaFalta").textContent = diff > 0.05 ? "Faltam " + diff.toFixed(1) + " kg"
    : (diff < -0.05 ? "Meta superada" : "Meta atingida");

  const inicial = Number(regs[0].peso);
  const total = Math.max(Math.abs(inicial - Number(perfil.metaPeso)), 0.1);
  const feito = Math.max(Math.abs(inicial - peso) * (Math.sign(inicial - peso) === Math.sign(inicial - Number(perfil.metaPeso)) ? 1 : -1), 0);
  const progresso = Math.max(0, Math.min((feito / total) * 100, 100));
  $("metaStatus").textContent = progresso.toFixed(0) + "%";
  $("progressFill").style.width = progresso + "%";

  setMedidas(ultimo);
}

/* ===================== Gauge de IMC ===================== */

const needlePlugin = {
  id: "needle",
  afterDatasetDraw(chart) {
    const valor = chart.options.plugins.needle && chart.options.plugins.needle.valor;
    if (valor == null) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;
    const arc = meta.data[0];
    const cx = arc.x, cy = arc.y;
    const min = 15, max = 40;
    const frac = Math.max(0, Math.min((valor - min) / (max - min), 1));
    const ang = Math.PI + frac * Math.PI;
    const r = arc.outerRadius * 0.92;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fillStyle = "#122118";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

function renderGaugeIMC(imc) {
  const ctx = $("graficoIMC");
  if (charts.imc) { charts.imc.destroy(); charts.imc = null; }
  // faixas: 15–18.5–25–30–40
  charts.imc = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [3.5, 6.5, 5, 10],
        backgroundColor: ["#93c5fd", "#22c55e", "#facc15", "#ef4444"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "72%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        needle: { valor: imc }
      }
    },
    plugins: [needlePlugin]
  });
}

/* ===================== Tabelas ===================== */

function renderTabelaHistorico() {
  const tbody = $("tabelaHistorico").querySelector("tbody");
  tbody.innerHTML = "";
  const regs = registrosAtuais();
  $("totalRegistros").textContent = regs.length ? regs.length + " registro" + (regs.length > 1 ? "s" : "") : "";

  if (!regs.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.className = "empty";
    td.textContent = "Nenhum registro ainda. Use o formulário acima para começar.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const desc = [...regs].reverse();
  desc.forEach((reg, i) => {
    const anterior = desc[i + 1];
    const delta = anterior ? Number(reg.peso) - Number(anterior.peso) : null;
    const tr = document.createElement("tr");
    if (reg.obs) tr.title = "Obs.: " + reg.obs;

    const tdData = document.createElement("td");
    tdData.textContent = formatarDataBR(reg.data) + (reg.obs ? " ✎" : "");
    tdData.className = "td-data";
    tr.appendChild(tdData);

    const tdPeso = document.createElement("td");
    tdPeso.textContent = format1(reg.peso, " kg");
    tdPeso.className = "td-peso";
    tr.appendChild(tdPeso);

    const tdDelta = document.createElement("td");
    if (delta == null || Math.abs(delta) < 0.05) {
      tdDelta.textContent = delta == null ? "—" : "=";
      tdDelta.className = "delta-neutro";
    } else {
      tdDelta.textContent = (delta > 0 ? "▲ +" : "▼ ") + delta.toFixed(1);
      tdDelta.className = delta > 0 ? "delta-sobe" : "delta-desce";
    }
    tr.appendChild(tdDelta);

    CAMPOS_MEDIDAS.forEach(campo => {
      const td = document.createElement("td");
      td.textContent = reg[campo] != null && reg[campo] !== "" ? Number(reg[campo]).toFixed(1) : "—";
      tr.appendChild(td);
    });

    const tdAcoes = document.createElement("td");
    tdAcoes.className = "td-acoes";
    const btnEditar = document.createElement("button");
    btnEditar.className = "mini-btn";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => editarRegistro(reg));
    const btnExcluir = document.createElement("button");
    btnExcluir.className = "mini-btn danger";
    btnExcluir.textContent = "Excluir";
    btnExcluir.addEventListener("click", () => excluirRegistro(reg.data));
    tdAcoes.appendChild(btnEditar);
    tdAcoes.appendChild(btnExcluir);
    tr.appendChild(tdAcoes);

    tbody.appendChild(tr);
  });
}

function renderTabelaMensal() {
  const tbody = $("tabelaMensal").querySelector("tbody");
  tbody.innerHTML = "";
  const resumo = resumoMensal(registrosAtuais());
  if (!resumo.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "empty";
    td.textContent = "Sem dados ainda.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  [...resumo].reverse().forEach(m => {
    const tr = document.createElement("tr");
    const celulas = [
      formatarMes(m.mes),
      String(m.qtd),
      m.media.toFixed(1) + " kg",
      m.min.toFixed(1) + " kg",
      m.max.toFixed(1) + " kg"
    ];
    celulas.forEach((txt, idx) => {
      const td = document.createElement("td");
      td.textContent = txt;
      if (idx === 0) td.className = "td-data";
      tr.appendChild(td);
    });
    const tdDelta = document.createElement("td");
    if (m.delta == null) {
      tdDelta.textContent = "—";
      tdDelta.className = "delta-neutro";
    } else {
      tdDelta.textContent = (m.delta > 0 ? "▲ +" : "▼ ") + Math.abs(m.delta).toFixed(1) + " kg";
      tdDelta.className = m.delta > 0 ? "delta-sobe" : "delta-desce";
    }
    tr.appendChild(tdDelta);
    tbody.appendChild(tr);
  });
}

/* ===================== Gráficos ===================== */

function filtrarPeriodo(regs) {
  if (!periodoDias || !regs.length) return regs;
  const fim = new Date(regs[regs.length - 1].data + "T12:00:00").getTime();
  const inicio = fim - periodoDias * 86400000;
  return regs.filter(r => new Date(r.data + "T12:00:00").getTime() >= inicio);
}

function renderGraficoPeso() {
  const ctx = $("graficoPeso");
  if (charts.peso) { charts.peso.destroy(); charts.peso = null; }
  const todos = registrosAtuais();
  if (!todos.length) return;
  const pesos = todos.map(r => Number(r.peso));
  const mm7 = mediaMovel(pesos, 7);
  const regs = filtrarPeriodo(todos);
  const offset = todos.length - regs.length;
  const meta = Number(perfilAtual().metaPeso);

  charts.peso = new Chart(ctx, {
    type: "line",
    data: {
      labels: regs.map(r => formatarDataBR(r.data)),
      datasets: [
        {
          label: "Peso (kg)",
          data: regs.map(r => Number(r.peso)),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: regs.length > 60 ? 0 : 3,
          pointHoverRadius: 5
        },
        {
          label: "Média móvel 7 dias",
          data: mm7.slice(offset),
          borderColor: "#0ea5e9",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: false
        },
        {
          label: "Meta",
          data: regs.map(() => meta),
          borderColor: "#f59e0b",
          borderDash: [8, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 18 } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: "rgba(34,197,94,0.08)" } }
      }
    }
  });
}

function renderGraficoMedidas() {
  const ctx = $("graficoMedidas");
  if (charts.medidas) { charts.medidas.destroy(); charts.medidas = null; }
  const campo = $("medidaSelect").value;
  const filtrados = registrosAtuais().filter(r => r[campo] != null && r[campo] !== "");
  if (!filtrados.length) return;
  charts.medidas = new Chart(ctx, {
    type: "line",
    data: {
      labels: filtrados.map(r => formatarDataBR(r.data)),
      datasets: [{
        label: ROTULOS[campo],
        data: filtrados.map(r => Number(r[campo])),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22,163,74,0.15)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: filtrados.length > 60 ? 0 : 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: "rgba(22,163,74,0.08)" } }
      }
    }
  });
}

function renderGraficoRCQ() {
  const ctx = $("graficoRCQ");
  if (charts.rcq) { charts.rcq.destroy(); charts.rcq = null; }
  const pares = registrosAtuais().filter(r =>
    r.cintura != null && r.cintura !== "" && r.quadril != null && r.quadril !== "" && Number(r.quadril) > 0);
  if (!pares.length) return;
  charts.rcq = new Chart(ctx, {
    type: "line",
    data: {
      labels: pares.map(r => formatarDataBR(r.data)),
      datasets: [{
        label: "Cintura / Quadril",
        data: pares.map(r => Number(r.cintura) / Number(r.quadril)),
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139,92,246,0.12)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: pares.length > 60 ? 0 : 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
        y: { grid: { color: "rgba(139,92,246,0.08)" } }
      }
    }
  });
}

function renderGraficoMensal() {
  const ctx = $("graficoMensal");
  if (charts.mensal) { charts.mensal.destroy(); charts.mensal = null; }
  const resumo = resumoMensal(registrosAtuais()).filter(m => m.delta != null);
  if (!resumo.length) return;
  const perfil = perfilAtual();
  const regs = registrosAtuais();
  // se a meta é abaixo do peso inicial, perder peso é bom (verde)
  const perderEhBom = !regs.length || Number(perfil.metaPeso) <= Number(regs[0].peso);
  charts.mensal = new Chart(ctx, {
    type: "bar",
    data: {
      labels: resumo.map(m => formatarMes(m.mes)),
      datasets: [{
        label: "Variação da média mensal (kg)",
        data: resumo.map(m => m.delta),
        backgroundColor: resumo.map(m =>
          (m.delta <= 0) === perderEhBom ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.75)"),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(34,197,94,0.08)" } }
      }
    }
  });
}

function renderCalendario() {
  const grid = $("calendarGrid");
  grid.innerHTML = "";
  const datas = new Set(registrosAtuais().map(r => r.data));
  const now = new Date();
  for (let i = 34; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const el = document.createElement("div");
    el.title = formatarDataBR(iso);
    el.textContent = String(d.getDate());
    if (datas.has(iso)) el.classList.add("on");
    if (i === 0) el.classList.add("today");
    grid.appendChild(el);
  }
}

function renderGraficos() {
  renderGraficoPeso();
  renderGraficoMedidas();
  renderGraficoRCQ();
  renderGraficoMensal();
  renderCalendario();
}

/* ===================== Formulário ===================== */

function limparFormulario() {
  $("dataInput").value = hojeISO();
  ["peso", "gordura", "cintura", "quadril", "braco", "coxa", "peito", "pescoco"].forEach(c => { $(c + "Input").value = ""; });
  $("obsInput").value = "";
  $("tituloRegistro").textContent = "Novo registro";
}

function editarRegistro(reg) {
  $("dataInput").value = reg.data;
  $("pesoInput").value = reg.peso != null ? reg.peso : "";
  CAMPOS_MEDIDAS.forEach(c => { $(c + "Input").value = reg[c] != null ? reg[c] : ""; });
  $("obsInput").value = reg.obs || "";
  $("tituloRegistro").textContent = "Editando " + formatarDataBR(reg.data);
  ativarTab("registros");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirRegistro(data) {
  if (!confirm("Excluir o registro de " + formatarDataBR(data) + "?")) return;
  const pid = state.perfilAtualId;
  state.registros[pid] = (state.registros[pid] || []).filter(r => r.data !== data);
  (state.tombstones[pid] = state.tombstones[pid] || {})[data] = agora();
  salvarEstado();
  renderTudo();
}

function salvarRegistroAtual() {
  const data = $("dataInput").value || hojeISO();
  const peso = parseFloat($("pesoInput").value);
  if (Number.isNaN(peso) || peso <= 0) { toast("Informe o peso."); return; }

  const novo = { data, peso, obs: $("obsInput").value.trim(), updatedAt: agora() };
  CAMPOS_MEDIDAS.forEach(c => { novo[c] = valorOuNulo($(c + "Input").value); });

  const pid = state.perfilAtualId;
  const lista = state.registros[pid] || [];
  state.registros[pid] = lista.filter(r => r.data !== data);
  state.registros[pid].push(novo);
  if (state.tombstones[pid]) delete state.tombstones[pid][data];
  salvarEstado();
  limparFormulario();
  renderTudo();
  toast("Registro salvo.");
}

/* ===================== Perfis ===================== */

function preencherPerfilSelect() {
  const select = $("perfilSelect");
  select.innerHTML = "";
  state.perfis.forEach(perfil => {
    const opt = document.createElement("option");
    opt.value = perfil.id;
    opt.textContent = perfil.nome;
    if (perfil.id === state.perfilAtualId) opt.selected = true;
    select.appendChild(opt);
  });
}

function preencherPerfilForm() {
  const perfil = perfilAtual();
  $("nomePerfilInput").value = perfil.nome;
  $("alturaInput").value = Number(perfil.altura).toFixed(2);
  $("metaInput").value = Number(perfil.metaPeso).toFixed(1);
}

function salvarPerfilAtual() {
  const perfil = perfilAtual();
  perfil.nome = $("nomePerfilInput").value.trim() || perfil.nome;
  perfil.altura = parseFloat($("alturaInput").value) || perfil.altura;
  perfil.metaPeso = parseFloat($("metaInput").value) || perfil.metaPeso;
  perfil.updatedAt = agora();
  salvarEstado();
  renderTudo();
  toast("Perfil salvo.");
}

function novoPerfil() {
  const nome = prompt("Nome do novo perfil:");
  if (!nome || !nome.trim()) return;
  const id = "p" + agora().toString(36) + Math.random().toString(36).slice(2, 6);
  state.perfis.push({ id, nome: nome.trim(), altura: 1.70, metaPeso: 70.0, updatedAt: agora() });
  state.registros[id] = [];
  state.perfilAtualId = id;
  salvarEstado();
  renderTudo();
  toast("Perfil criado. Ajuste altura e meta abaixo.");
}

function excluirPerfilAtualFn() {
  if (state.perfis.length <= 1) { toast("É preciso ter ao menos um perfil."); return; }
  const perfil = perfilAtual();
  if (!confirm('Excluir o perfil "' + perfil.nome + '" e todos os seus registros?')) return;
  state.perfisExcluidos[perfil.id] = agora();
  state.perfis = state.perfis.filter(p => p.id !== perfil.id);
  delete state.registros[perfil.id];
  delete state.tombstones[perfil.id];
  state.perfilAtualId = state.perfis[0].id;
  salvarEstado();
  renderTudo();
}

/* ===================== Backup ===================== */

function exportarBackup() {
  const dados = clone(state);
  delete dados.sync;
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "corpo-em-progresso-backup-" + hojeISO() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importarBackup(file) {
  try {
    const texto = await file.text();
    const dados = JSON.parse(texto);
    if (!dados.perfis && !dados.registros) throw new Error("formato");
    const importado = dados.version === 2 ? dados : migrarV1(dados);
    // mescla com o que já existe em vez de substituir
    const mesclado = mesclar(dadosParaNuvem(), importado);
    state.perfis = mesclado.perfis.length ? mesclado.perfis : state.perfis;
    state.registros = mesclado.registros;
    state.tombstones = mesclado.tombstones;
    state.perfisExcluidos = mesclado.perfisExcluidos;
    if (!state.perfis.find(p => p.id === state.perfilAtualId)) state.perfilAtualId = state.perfis[0].id;
    salvarEstado();
    renderTudo();
    toast("Backup importado e mesclado com sucesso.");
  } catch (e) {
    toast("Não foi possível importar este arquivo.");
  }
}

function exportarCsv() {
  const perfil = perfilAtual();
  const regs = registrosAtuais();
  const linhas = [["data", "peso_kg", ...CAMPOS_MEDIDAS, "observacoes"].join(";")];
  regs.forEach(r => {
    linhas.push([
      r.data,
      Number(r.peso).toFixed(1),
      ...CAMPOS_MEDIDAS.map(c => r[c] != null && r[c] !== "" ? Number(r[c]).toFixed(1) : ""),
      '"' + String(r.obs || "").replace(/"/g, '""') + '"'
    ].join(";"));
  });
  const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "corpo-em-progresso-" + perfil.nome.toLowerCase().replace(/\s+/g, "-") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ===================== Navegação e render ===================== */

function ativarTab(tab) {
  document.querySelectorAll(".tab-page").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
  $("tab-" + tab).classList.add("active");
  document.querySelector('.nav-btn[data-tab="' + tab + '"]').classList.add("active");
  if (tab === "graficos") setTimeout(renderGraficos, 60);
  if (tab === "inicio") setTimeout(atualizarResumo, 60);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTudo() {
  preencherPerfilSelect();
  preencherPerfilForm();
  atualizarResumo();
  renderTabelaHistorico();
  renderTabelaMensal();
  if ($("tab-graficos").classList.contains("active")) renderGraficos();
  atualizarSyncUI();
}

/* ===================== Eventos ===================== */

$("salvarRegistroBtn").addEventListener("click", salvarRegistroAtual);
$("salvarPerfilBtn").addEventListener("click", salvarPerfilAtual);
$("novoPerfilBtn").addEventListener("click", novoPerfil);
$("excluirPerfilBtn").addEventListener("click", excluirPerfilAtualFn);
$("exportarBtn").addEventListener("click", exportarBackup);
$("exportarCsvBtn").addEventListener("click", exportarCsv);
$("importarInput").addEventListener("change", e => { if (e.target.files[0]) importarBackup(e.target.files[0]); e.target.value = ""; });
$("medidaSelect").addEventListener("change", renderGraficoMedidas);
$("perfilSelect").addEventListener("change", e => {
  state.perfilAtualId = e.target.value;
  salvarEstado(false);
  limparFormulario();
  renderTudo();
});
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => ativarTab(btn.dataset.tab)));
document.querySelectorAll("#periodoBtns button").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("#periodoBtns button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  periodoDias = Number(btn.dataset.dias);
  renderGraficoPeso();
}));

$("criarCodigoBtn").addEventListener("click", criarCodigo);
$("conectarBtn").addEventListener("click", conectarCodigo);
$("desconectarBtn").addEventListener("click", desconectarSync);
$("sincronizarAgoraBtn").addEventListener("click", () => sincronizar(true));
$("copiarCodigoBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.sync.blobId || "");
    toast("Código copiado.");
  } catch (e) {
    $("codigoAtual").select();
    toast("Selecione e copie o código.");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sincronizar();
});
window.addEventListener("online", () => sincronizar());
setInterval(() => { if (document.visibilityState === "visible") sincronizar(); }, 60000);

/* ===================== Inicialização ===================== */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

$("dataInput").value = hojeISO();
renderTudo();
sincronizar();
