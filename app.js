const STORAGE_KEY = 'corpoEmProgressoV2';
const DEFAULT_STATE = {
  activeProfileId: 'perfil-1',
  selectedRange: '30',
  selectedMetric: 'waist',
  profiles: [
    { id: 'perfil-1', name: 'Você', height: 1.75, goalWeight: 80 },
    { id: 'perfil-2', name: 'Esposa', height: 1.65, goalWeight: 65 }
  ],
  entries: []
};

let state = loadState();
let deferredPrompt = null;
let editingEntryId = null;

const els = {
  installBtn: document.getElementById('installBtn'),
  profileSelect: document.getElementById('profileSelect'),
  openProfileBtn: document.getElementById('openProfileBtn'),
  openProfileBtn2: document.getElementById('openProfileBtn2'),
  profileDialog: document.getElementById('profileDialog'),
  profilesEditor: document.getElementById('profilesEditor'),
  saveProfilesBtn: document.getElementById('saveProfilesBtn'),
  navBtns: [...document.querySelectorAll('.nav-btn')],
  views: [...document.querySelectorAll('.view')],
  rangeBtns: [...document.querySelectorAll('.range-btn')],
  metricBtns: [...document.querySelectorAll('.metric-btn')],
  entryForm: document.getElementById('entryForm'),
  comparePhotosBtn: document.getElementById('comparePhotosBtn'),
  comparisonCard: document.getElementById('comparisonCard'),
  comparisonGrid: document.getElementById('comparisonGrid'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  historyList: document.getElementById('historyList'),
  photoGrid: document.getElementById('photoGrid'),
  heroWeight: document.getElementById('heroWeight'),
  heroDelta: document.getElementById('heroDelta'),
  heroGoal: document.getElementById('heroGoal'),
  statImc: document.getElementById('statImc'),
  statImcLabel: document.getElementById('statImcLabel'),
  statHeight: document.getElementById('statHeight'),
  stat7d: document.getElementById('stat7d'),
  stat30d: document.getElementById('stat30d'),
  summaryText: document.getElementById('summaryText'),
  goalProgressText: document.getElementById('goalProgressText'),
  goalProgressBar: document.getElementById('goalProgressBar'),
  pesoChart: document.getElementById('pesoChart'),
  waistChart: document.getElementById('waistChart'),
  weightFullChart: document.getElementById('weightFullChart'),
  metricChart: document.getElementById('metricChart'),
  pesoLegend: document.getElementById('pesoLegend'),
  waistLegend: document.getElementById('waistLegend'),
  weightFullLegend: document.getElementById('weightFullLegend'),
  metricLegend: document.getElementById('metricLegend'),
  profileNameText: document.getElementById('profileNameText'),
  profileHeightText: document.getElementById('profileHeightText'),
  profileGoalText: document.getElementById('profileGoalText'),
  profileImcText: document.getElementById('profileImcText'),
  historyItemTemplate: document.getElementById('historyItemTemplate')
};

init();

function init() {
  bindNav();
  bindProfile();
  bindForm();
  bindPhotos();
  bindBackup();
  bindInstall();
  registerServiceWorker();
  els.entryForm.date.value = todayISO();
  renderAll();
}

function bindNav() {
  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => activateView(btn.dataset.view));
  });
  els.rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedRange = btn.dataset.range;
      saveState();
      renderCharts();
      renderDashboard();
      updateRangeButtons();
    });
  });
  els.metricBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedMetric = btn.dataset.metric;
      saveState();
      renderMetricChart();
      updateMetricButtons();
    });
  });
}

function bindProfile() {
  const openDialog = () => {
    renderProfilesEditor();
    els.profileDialog.showModal();
  };
  els.openProfileBtn.addEventListener('click', openDialog);
  els.openProfileBtn2.addEventListener('click', openDialog);
  els.profileSelect.addEventListener('change', () => {
    state.activeProfileId = els.profileSelect.value;
    saveState();
    renderAll();
  });
  els.saveProfilesBtn.addEventListener('click', () => {
    const cards = [...els.profilesEditor.querySelectorAll('[data-profile-id]')];
    state.profiles = cards.map(card => ({
      id: card.dataset.profileId,
      name: card.querySelector('[name="name"]').value.trim() || 'Perfil',
      height: toNum(card.querySelector('[name="height"]').value),
      goalWeight: toNum(card.querySelector('[name="goalWeight"]').value)
    }));
    if (!state.profiles.find(p => p.id === state.activeProfileId)) {
      state.activeProfileId = state.profiles[0]?.id || 'perfil-1';
    }
    saveState();
    els.profileDialog.close();
    renderAll();
  });
}

function bindForm() {
  els.entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(els.entryForm);
    const file = fd.get('photo');
    let photo = keepOldPhoto(editingEntryId);
    if (file && file.size > 0) photo = await fileToDataURL(file);

    const entry = {
      id: editingEntryId || crypto.randomUUID(),
      profileId: state.activeProfileId,
      date: fd.get('date'),
      weight: toNum(fd.get('weight')),
      bodyFat: toNum(fd.get('bodyFat')),
      waist: toNum(fd.get('waist')),
      hip: toNum(fd.get('hip')),
      arm: toNum(fd.get('arm')),
      thigh: toNum(fd.get('thigh')),
      notes: String(fd.get('notes') || '').trim(),
      photo
    };

    if (editingEntryId) {
      state.entries = state.entries.map(item => item.id === editingEntryId ? entry : item);
      editingEntryId = null;
    } else {
      state.entries.push(entry);
    }

    state.entries.sort((a, b) => b.date.localeCompare(a.date));
    saveState();
    els.entryForm.reset();
    els.entryForm.date.value = todayISO();
    renderAll();
    activateView('perfil');
  });
}

function bindPhotos() {
  els.comparePhotosBtn.addEventListener('click', () => {
    const photos = activeEntries().filter(e => e.photo).sort((a, b) => a.date.localeCompare(b.date));
    if (photos.length < 2) {
      alert('É preciso ter pelo menos duas fotos no perfil ativo.');
      return;
    }
    const selected = [photos[0], photos[photos.length - 1]];
    els.comparisonGrid.innerHTML = selected.map(item => `
      <div class="comparison-tile">
        <img src="${item.photo}" alt="Foto ${formatDate(item.date)}" />
        <div class="photo-meta">
          <strong>${formatDate(item.date)}</strong>
          <p class="muted">${item.weight ? `${item.weight.toFixed(1)} kg` : 'Sem peso informado'}</p>
        </div>
      </div>
    `).join('');
    els.comparisonCard.classList.remove('hidden');
  });
}

function bindBackup() {
  els.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corpo-em-progresso-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!json.profiles || !json.entries) throw new Error('Arquivo inválido');
      state = {
        ...DEFAULT_STATE,
        ...json,
        selectedRange: json.selectedRange || '30',
        selectedMetric: json.selectedMetric || 'waist'
      };
      saveState();
      renderAll();
      alert('Backup importado com sucesso.');
    } catch {
      alert('Não foi possível importar este arquivo.');
    }
    e.target.value = '';
  });
}

function bindInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function renderAll() {
  renderProfileSelect();
  renderProfilesEditor();
  renderDashboard();
  renderCharts();
  renderMetricChart();
  renderHistory();
  renderPhotos();
  renderProfileSummary();
  updateRangeButtons();
  updateMetricButtons();
}

function renderProfileSelect() {
  els.profileSelect.innerHTML = state.profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  els.profileSelect.value = state.activeProfileId;
}

function renderProfilesEditor() {
  els.profilesEditor.innerHTML = state.profiles.map(profile => `
    <section class="profile-editor-card" data-profile-id="${profile.id}">
      <div class="profile-editor-grid">
        <label>Nome
          <input name="name" type="text" value="${escapeHtml(profile.name)}" />
        </label>
        <label>Altura (m)
          <input name="height" type="number" step="0.01" value="${profile.height || ''}" />
        </label>
        <label>Meta de peso (kg)
          <input name="goalWeight" type="number" step="0.1" value="${profile.goalWeight || ''}" />
        </label>
      </div>
    </section>
  `).join('');
}

function renderDashboard() {
  const profile = currentProfile();
  const entries = activeEntriesSortedAsc();
  const latest = entries.at(-1);
  const imc = latest?.weight && profile.height ? calcImc(latest.weight, profile.height) : null;
  const imcLabel = imc ? classifyImc(imc) : 'Sem dados';
  const delta7 = diffWithinDays(entries, 7, 'weight');
  const delta30 = diffWithinDays(entries, 30, 'weight');
  const progress = calcGoalProgress(entries, profile.goalWeight);

  els.heroWeight.textContent = latest?.weight ? `${latest.weight.toFixed(1)} kg` : '--';
  els.heroGoal.textContent = profile.goalWeight ? `${profile.goalWeight.toFixed(1)} kg` : '--';
  els.heroDelta.textContent = latest
    ? `${formatSigned(delta30, 'kg')} nos últimos 30 dias`
    : 'Adicione registros para acompanhar a evolução.';

  els.statImc.textContent = imc ? imc.toFixed(1) : '--';
  els.statImcLabel.textContent = imcLabel;
  els.statHeight.textContent = profile.height ? `${profile.height.toFixed(2)} m` : '--';
  els.stat7d.textContent = latest ? formatSigned(delta7, 'kg') : '--';
  els.stat30d.textContent = latest ? formatSigned(delta30, 'kg') : '--';

  els.summaryText.textContent = latest
    ? `${profile.name} registrou ${latest.weight.toFixed(1)} kg em ${formatDate(latest.date)}. ${latest.bodyFat ? `Gordura corporal: ${latest.bodyFat.toFixed(1)}%. ` : ''}${latest.waist ? `Cintura: ${latest.waist.toFixed(1)} cm.` : ''}`
    : 'Nenhum registro ainda. Use o botão Registrar para adicionar peso, medidas e fotos.';

  els.goalProgressText.textContent = progress.text;
  els.goalProgressBar.style.width = `${progress.percent}%`;
}

function renderCharts() {
  const entries = filterByRange(activeEntriesSortedAsc(), state.selectedRange);
  const weightPoints = entries.filter(e => e.weight).map(e => ({ x: formatDateShort(e.date), y: e.weight }));
  const waistPoints = entries.filter(e => e.waist).map(e => ({ x: formatDateShort(e.date), y: e.waist }));

  renderLineChart(els.pesoChart, weightPoints, 'kg', '#22c55e');
  renderLineChart(els.waistChart, waistPoints, 'cm', '#0f9d58');
  renderLineChart(els.weightFullChart, activeEntriesSortedAsc().filter(e => e.weight).map(e => ({ x: formatDateShort(e.date), y: e.weight })), 'kg', '#16a34a');

  els.pesoLegend.textContent = buildLegend(weightPoints, 'peso');
  els.waistLegend.textContent = buildLegend(waistPoints, 'cintura');
  els.weightFullLegend.textContent = buildLegend(activeEntriesSortedAsc().filter(e => e.weight).map(e => ({ x: formatDateShort(e.date), y: e.weight })), 'peso');
}

function renderMetricChart() {
  const metric = state.selectedMetric;
  const labelMap = { waist: 'cintura', hip: 'quadril', arm: 'braço', thigh: 'coxa' };
  const points = activeEntriesSortedAsc().filter(e => e[metric]).map(e => ({ x: formatDateShort(e.date), y: e[metric] }));
  renderLineChart(els.metricChart, points, 'cm', '#34d399');
  els.metricLegend.textContent = buildLegend(points, labelMap[metric]);
}

function renderHistory() {
  const entries = [...activeEntries()].sort((a, b) => b.date.localeCompare(a.date));
  if (!entries.length) {
    els.historyList.className = 'history-list empty-state';
    els.historyList.textContent = 'Nenhum registro encontrado.';
    return;
  }
  els.historyList.className = 'history-list';
  els.historyList.innerHTML = '';
  entries.forEach(entry => {
    const node = els.historyItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.history-date').textContent = formatDate(entry.date);
    node.querySelector('.history-measures').textContent = compactMeasures(entry);
    node.querySelector('.history-notes').textContent = entry.notes || 'Sem observações.';
    node.querySelector('.edit-entry').addEventListener('click', () => startEdit(entry.id));
    node.querySelector('.delete-entry').addEventListener('click', () => deleteEntry(entry.id));
    els.historyList.appendChild(node);
  });
}

function renderPhotos() {
  const photos = [...activeEntries()].filter(e => e.photo).sort((a, b) => b.date.localeCompare(a.date));
  if (!photos.length) {
    els.photoGrid.className = 'photo-grid empty-state';
    els.photoGrid.textContent = 'Nenhuma foto adicionada.';
    els.comparisonCard.classList.add('hidden');
    return;
  }
  els.photoGrid.className = 'photo-grid';
  els.photoGrid.innerHTML = photos.map(item => `
    <article class="photo-tile">
      <img src="${item.photo}" alt="Foto ${formatDate(item.date)}" />
      <div class="photo-meta">
        <strong>${formatDate(item.date)}</strong>
        <p class="muted">${item.weight ? `${item.weight.toFixed(1)} kg` : 'Sem peso informado'}</p>
      </div>
    </article>
  `).join('');
}

function renderProfileSummary() {
  const profile = currentProfile();
  const latest = activeEntriesSortedAsc().at(-1);
  const imc = latest?.weight && profile.height ? calcImc(latest.weight, profile.height) : null;
  els.profileNameText.textContent = profile.name || '--';
  els.profileHeightText.textContent = profile.height ? `${profile.height.toFixed(2)} m` : '--';
  els.profileGoalText.textContent = profile.goalWeight ? `${profile.goalWeight.toFixed(1)} kg` : '--';
  els.profileImcText.textContent = imc ? `${imc.toFixed(1)} · ${classifyImc(imc)}` : '--';
}

function activateView(view) {
  els.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  els.views.forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateRangeButtons() {
  els.rangeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.range === state.selectedRange));
}

function updateMetricButtons() {
  els.metricBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.metric === state.selectedMetric));
}

function startEdit(id) {
  const entry = state.entries.find(item => item.id === id);
  if (!entry) return;
  editingEntryId = id;
  setFormValue('date', entry.date);
  setFormValue('weight', entry.weight);
  setFormValue('bodyFat', entry.bodyFat);
  setFormValue('waist', entry.waist);
  setFormValue('hip', entry.hip);
  setFormValue('arm', entry.arm);
  setFormValue('thigh', entry.thigh);
  setFormValue('notes', entry.notes);
  activateView('registro');
}

function deleteEntry(id) {
  if (!confirm('Deseja excluir este registro?')) return;
  state.entries = state.entries.filter(item => item.id !== id);
  saveState();
  renderAll();
}

function renderLineChart(container, points, unit, color) {
  if (!points.length) {
    container.innerHTML = '<div class="chart-empty">Sem dados para exibir.</div>';
    return;
  }

  const width = 800;
  const height = container.classList.contains('large') ? 320 : 260;
  const padX = 54;
  const padTop = 24;
  const padBottom = 42;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const values = points.map(p => p.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const coords = points.map((point, i) => {
    const x = padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padTop + ((max - point.y) / range) * innerH;
    return { ...point, x, y };
  });

  const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L ${coords.at(-1).x} ${height - padBottom} L ${coords[0].x} ${height - padBottom} Z`;
  const yTicks = Array.from({ length: 4 }, (_, i) => (min + (range * (3 - i) / 3)));

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Gráfico">
      <defs>
        <linearGradient id="fill-${slug(color)}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.28" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${yTicks.map((tick, i) => {
        const y = padTop + (i / 3) * innerH;
        return `<g>
          <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="rgba(19,34,24,.08)" stroke-width="1" />
          <text x="12" y="${y + 4}" fill="rgba(102,117,107,.95)" font-size="12">${tick.toFixed(1)} ${unit}</text>
        </g>`;
      }).join('')}
      <path d="${areaPath}" fill="url(#fill-${slug(color)})"></path>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${coords.map((p, i) => `<g>
        <circle cx="${p.x}" cy="${p.y}" r="5.5" fill="#fff" stroke="${color}" stroke-width="3" />
        <title>${escapeHtml(points[i].x)} · ${points[i].y.toFixed(1)} ${unit}</title>
      </g>`).join('')}
      ${coords.map((p, i) => i % Math.ceil(points.length / 4 || 1) === 0 || i === points.length - 1 ? `<text x="${p.x}" y="${height - 14}" text-anchor="middle" fill="rgba(102,117,107,.95)" font-size="12">${escapeHtml(points[i].x)}</text>` : '').join('')}
    </svg>
  `;
}

function buildLegend(points, label) {
  if (!points.length) return 'Sem dados';
  const first = points[0];
  const last = points.at(-1);
  const delta = last.y - first.y;
  return `De ${first.x} a ${last.x} · ${formatSigned(delta, points.length && label === 'peso' ? 'kg' : 'cm')} de variação de ${label}.`;
}

function activeEntries() {
  return state.entries.filter(entry => entry.profileId === state.activeProfileId);
}

function activeEntriesSortedAsc() {
  return [...activeEntries()].sort((a, b) => a.date.localeCompare(b.date));
}

function currentProfile() {
  return state.profiles.find(p => p.id === state.activeProfileId) || state.profiles[0];
}

function filterByRange(entries, range) {
  if (range === 'all') return entries;
  const days = Number(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const iso = cutoff.toISOString().slice(0, 10);
  return entries.filter(e => e.date >= iso);
}

function diffWithinDays(entries, days, metric) {
  const filtered = filterByRange(entries.filter(e => e[metric]), String(days));
  if (filtered.length < 2) return 0;
  return filtered.at(-1)[metric] - filtered[0][metric];
}

function calcGoalProgress(entries, goalWeight) {
  const weightEntries = entries.filter(e => e.weight);
  if (!weightEntries.length || !goalWeight) return { percent: 0, text: 'Defina uma meta e registre seu peso.' };
  const first = weightEntries[0].weight;
  const latest = weightEntries.at(-1).weight;
  const totalDistance = Math.abs(first - goalWeight) || 1;
  const covered = Math.abs(first - latest);
  const percent = Math.max(0, Math.min(100, (covered / totalDistance) * 100));
  const diff = latest - goalWeight;
  return {
    percent,
    text: diff === 0
      ? 'Meta atingida.'
      : diff > 0
        ? `Faltam ${diff.toFixed(1)} kg para a meta.`
        : `Você está ${Math.abs(diff).toFixed(1)} kg abaixo da meta.`
  };
}

function calcImc(weight, height) {
  if (!weight || !height) return null;
  return weight / (height * height);
}

function classifyImc(imc) {
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade I';
  if (imc < 40) return 'Obesidade II';
  return 'Obesidade III';
}

function compactMeasures(entry) {
  const parts = [];
  if (entry.weight) parts.push(`Peso ${entry.weight.toFixed(1)} kg`);
  if (entry.bodyFat) parts.push(`Gordura ${entry.bodyFat.toFixed(1)}%`);
  if (entry.waist) parts.push(`Cintura ${entry.waist.toFixed(1)} cm`);
  if (entry.hip) parts.push(`Quadril ${entry.hip.toFixed(1)} cm`);
  if (entry.arm) parts.push(`Braço ${entry.arm.toFixed(1)} cm`);
  if (entry.thigh) parts.push(`Coxa ${entry.thigh.toFixed(1)} cm`);
  return parts.join(' · ');
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed ? { ...DEFAULT_STATE, ...parsed } : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function setFormValue(name, value) {
  const input = els.entryForm.elements.namedItem(name);
  if (input) input.value = value ?? '';
}

function keepOldPhoto(id) {
  if (!id) return null;
  return state.entries.find(entry => entry.id === id)?.photo || null;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00'));
}

function formatDateShort(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(date + 'T12:00:00'));
}

function formatSigned(value, unit) {
  if (!value) return `0 ${unit}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} ${unit}`;
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slug(value) {
  return String(value).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}
