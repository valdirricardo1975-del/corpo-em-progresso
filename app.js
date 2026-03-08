const STORAGE_KEY = 'corpo-em-progresso-v1';
const defaultState = {
  activeProfileId: 'p1',
  profiles: [
    { id: 'p1', name: 'Você', height: 1.75, goalWeight: 80 },
    { id: 'p2', name: 'Esposa', height: 1.65, goalWeight: 65 }
  ],
  entries: []
};

let state = loadState();
let deferredPrompt = null;
let editingEntryId = null;

const els = {
  profileSelect: document.getElementById('profileSelect'),
  profilesDialog: document.getElementById('profilesDialog'),
  profilesEditor: document.getElementById('profilesEditor'),
  saveProfilesBtn: document.getElementById('saveProfilesBtn'),
  manageProfilesBtn: document.getElementById('manageProfilesBtn'),
  entryForm: document.getElementById('entryForm'),
  historyList: document.getElementById('historyList'),
  photoGrid: document.getElementById('photoGrid'),
  comparePhotosBtn: document.getElementById('comparePhotosBtn'),
  comparisonCard: document.getElementById('comparisonCard'),
  comparisonGrid: document.getElementById('comparisonGrid'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  installBtn: document.getElementById('installBtn'),
  statPeso: document.getElementById('statPeso'),
  statMeta: document.getElementById('statMeta'),
  statImc: document.getElementById('statImc'),
  statVariacao: document.getElementById('statVariacao'),
  summaryText: document.getElementById('summaryText'),
  pesoRange: document.getElementById('pesoRange'),
  cinturaRange: document.getElementById('cinturaRange'),
  pesoChart: document.getElementById('pesoChart'),
  cinturaChart: document.getElementById('cinturaChart')
};

init();

function init() {
  bindTabs();
  bindProfileControls();
  bindForm();
  bindBackup();
  bindInstall();
  renderAll();
  registerServiceWorker();
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function bindProfileControls() {
  els.profileSelect.addEventListener('change', () => {
    state.activeProfileId = els.profileSelect.value;
    saveState();
    renderAll();
  });

  els.manageProfilesBtn.addEventListener('click', () => {
    renderProfilesEditor();
    els.profilesDialog.showModal();
  });

  els.saveProfilesBtn.addEventListener('click', () => {
    const cards = [...els.profilesEditor.querySelectorAll('[data-profile-id]')];
    state.profiles = cards.map(card => ({
      id: card.dataset.profileId,
      name: card.querySelector('[name="name"]').value.trim() || 'Perfil',
      height: Number(card.querySelector('[name="height"]').value) || 0,
      goalWeight: Number(card.querySelector('[name="goalWeight"]').value) || 0
    }));
    saveState();
    els.profilesDialog.close();
    renderAll();
  });
}

function bindForm() {
  els.entryForm.date.value = todayISO();
  els.entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(els.entryForm);
    const photoFile = fd.get('photo');
    let photoDataUrl = null;
    if (photoFile && photoFile.size > 0) {
      photoDataUrl = await fileToDataURL(photoFile);
    }
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
      photo: photoDataUrl || keepOldPhoto(editingEntryId)
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
    activateTab('historico');
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
      state = json;
      saveState();
      renderAll();
      alert('Backup importado com sucesso.');
    } catch {
      alert('Não foi possível importar este arquivo.');
    }
    e.target.value = '';
  });

  els.comparePhotosBtn.addEventListener('click', () => {
    const photos = activeEntries().filter(e => e.photo).sort((a, b) => a.date.localeCompare(b.date));
    if (photos.length < 2) {
      alert('É preciso ter pelo menos duas fotos no perfil ativo.');
      return;
    }
    const selected = [photos[0], photos[photos.length - 1]];
    els.comparisonGrid.innerHTML = selected.map(item => `
      <div>
        <img src="${item.photo}" alt="Foto ${formatDate(item.date)}" />
        <p>${formatDate(item.date)}</p>
      </div>
    `).join('');
    els.comparisonCard.classList.remove('hidden');
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
  renderDashboard();
  renderHistory();
  renderPhotos();
}

function renderProfileSelect() {
  els.profileSelect.innerHTML = state.profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  els.profileSelect.value = state.activeProfileId;
}

function renderProfilesEditor() {
  els.profilesEditor.innerHTML = state.profiles.map(profile => `
    <section class="card" data-profile-id="${profile.id}" style="margin-bottom:12px">
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
  const entries = activeEntries().sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries.at(-1);
  const first = entries[0];
  els.statPeso.textContent = latest?.weight ? `${latest.weight.toFixed(1)} kg` : '--';
  els.statMeta.textContent = profile.goalWeight ? `${profile.goalWeight.toFixed(1)} kg` : '--';
  els.statImc.textContent = latest?.weight && profile.height ? calcImc(latest.weight, profile.height) : '--';
  els.statVariacao.textContent = latest?.weight && first?.weight ? formatSigned(latest.weight - first.weight, 'kg') : '--';
  els.summaryText.textContent = latest
    ? `${profile.name} registrou ${latest.weight.toFixed(1)} kg em ${formatDate(latest.date)}. ${latest.waist ? `Cintura atual: ${latest.waist.toFixed(1)} cm.` : ''}`
    : 'Nenhum registro ainda.';

  const weightPoints = entries.filter(e => e.weight).map(e => ({ x: formatDateShort(e.date), y: e.weight }));
  const waistPoints = entries.filter(e => e.waist).map(e => ({ x: formatDateShort(e.date), y: e.waist }));

  els.pesoRange.textContent = weightPoints.length ? `${weightPoints[0].x} → ${weightPoints.at(-1).x}` : 'Sem dados';
  els.cinturaRange.textContent = waistPoints.length ? `${waistPoints[0].x} → ${waistPoints.at(-1).x}` : 'Sem dados';

  drawChart(els.pesoChart, weightPoints, 'kg');
  drawChart(els.cinturaChart, waistPoints, 'cm');
}

function renderHistory() {
  const entries = activeEntries().sort((a, b) => b.date.localeCompare(a.date));
  if (!entries.length) {
    els.historyList.className = 'history-list empty-state';
    els.historyList.textContent = 'Nenhum registro encontrado.';
    return;
  }
  els.historyList.className = 'history-list';
  const tpl = document.getElementById('historyItemTemplate');
  els.historyList.innerHTML = '';
  entries.forEach(entry => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.history-date').textContent = formatDate(entry.date);
    node.querySelector('.history-measures').textContent = compactMeasures(entry);
    node.querySelector('.history-notes').textContent = entry.notes || '';
    node.querySelector('.delete-entry').addEventListener('click', () => {
      if (!confirm('Deseja excluir este registro?')) return;
      state.entries = state.entries.filter(item => item.id !== entry.id);
      saveState();
      renderAll();
    });
    node.querySelector('.edit-entry').addEventListener('click', () => startEdit(entry));
    els.historyList.appendChild(node);
  });
}

function renderPhotos() {
  const photos = activeEntries().filter(e => e.photo).sort((a, b) => b.date.localeCompare(a.date));
  if (!photos.length) {
    els.photoGrid.className = 'photo-grid empty-state';
    els.photoGrid.textContent = 'Nenhuma foto adicionada.';
    return;
  }
  els.photoGrid.className = 'photo-grid';
  els.photoGrid.innerHTML = photos.map(item => `
    <article class="photo-card">
      <img src="${item.photo}" alt="Foto ${formatDate(item.date)}" />
      <div class="meta">
        <strong>${formatDate(item.date)}</strong><br>
        ${item.weight ? `${item.weight.toFixed(1)} kg` : 'Sem peso'}
      </div>
    </article>
  `).join('');
}

function startEdit(entry) {
  editingEntryId = entry.id;
  activateTab('registro');
  const f = els.entryForm;
  f.date.value = entry.date;
  f.weight.value = entry.weight ?? '';
  f.bodyFat.value = entry.bodyFat ?? '';
  f.waist.value = entry.waist ?? '';
  f.hip.value = entry.hip ?? '';
  f.arm.value = entry.arm ?? '';
  f.thigh.value = entry.thigh ?? '';
  f.notes.value = entry.notes ?? '';
}

function drawChart(canvas, points, suffix) {
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = 260;
  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { top: 20, right: 16, bottom: 34, left: 40 };
  const innerW = cssWidth - pad.left - pad.right;
  const innerH = cssHeight - pad.top - pad.bottom;

  ctx.strokeStyle = '#dbe4ef';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad.top + innerH * (i / 3);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(cssWidth - pad.right, y);
    ctx.stroke();
  }

  if (!points.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('Sem dados para exibir', pad.left, cssHeight / 2);
    return;
  }

  const vals = points.map(p => p.y);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad.left + (innerW * (points.length === 1 ? 0.5 : i / (points.length - 1)));
    const y = pad.top + innerH - ((p.y - min) / range) * innerH;
    return { ...p, x, y };
  });

  ctx.beginPath();
  coords.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 3;
  ctx.stroke();

  coords.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f766e';
    ctx.fill();
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  coords.forEach(p => {
    ctx.fillText(p.x.length > 6 ? p.x.slice(0, 5) : p.x, p.x - 12, cssHeight - 10);
  });

  ctx.fillStyle = '#0f172a';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${max.toFixed(1)} ${suffix}`, 4, pad.top + 6);
  ctx.fillText(`${min.toFixed(1)} ${suffix}`, 4, pad.top + innerH);
}

function activeEntries() {
  return state.entries.filter(e => e.profileId === state.activeProfileId);
}
function currentProfile() {
  return state.profiles.find(p => p.id === state.activeProfileId) || state.profiles[0];
}
function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return structuredClone(defaultState);
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function toNum(v) { return v === '' || v == null ? null : Number(v); }
function calcImc(weight, height) { return (weight / (height * height)).toFixed(1); }
function formatDate(iso) { return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR'); }
function formatDateShort(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function formatSigned(num, suffix) { return `${num > 0 ? '+' : ''}${num.toFixed(1)} ${suffix}`; }
function compactMeasures(e) {
  return [
    e.weight && `Peso ${e.weight.toFixed(1)} kg`,
    e.bodyFat && `Gordura ${e.bodyFat.toFixed(1)}%`,
    e.waist && `Cintura ${e.waist.toFixed(1)} cm`,
    e.hip && `Quadril ${e.hip.toFixed(1)} cm`,
    e.arm && `Braço ${e.arm.toFixed(1)} cm`,
    e.thigh && `Coxa ${e.thigh.toFixed(1)} cm`
  ].filter(Boolean).join(' • ');
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function keepOldPhoto(id) {
  if (!id) return null;
  return state.entries.find(e => e.id === id)?.photo || null;
}
function escapeHtml(str) {
  return str.replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function activateTab(id) {
  document.querySelector(`.tab[data-tab="${id}"]`).click();
}
function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
