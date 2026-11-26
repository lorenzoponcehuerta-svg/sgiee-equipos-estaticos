/**
 * SGIEE – Utility functions
 */
const Utils = (() => {

  // ── Date helpers ──────────────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function fmtDatetime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function daysUntil(iso) {
    if (!iso) return null;
    return Math.round((new Date(iso) - new Date()) / (1000 * 3600 * 24));
  }

  function addYears(isoDate, years) {
    const d = new Date(isoDate);
    d.setFullYear(d.getFullYear() + Math.floor(years));
    const frac = years - Math.floor(years);
    d.setDate(d.getDate() + Math.round(frac * 365));
    return d.toISOString().split('T')[0];
  }

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  // ── Number helpers ────────────────────────────────────────────
  function round(v, dec = 2) {
    const f = Math.pow(10, dec);
    return Math.round(v * f) / f;
  }

  function fmt(v, dec = 2, suffix = '') {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (!isFinite(v)) return '∞';
    return round(v, dec).toFixed(dec) + (suffix ? ' ' + suffix : '');
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // ── String helpers ────────────────────────────────────────────
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── Badge generators ──────────────────────────────────────────
  function estadoBadge(estado) {
    const map = {
      'Activo':   'badge-success',
      'Inactivo': 'badge-muted',
      'Parado':   'badge-warning',
      'Retirado': 'badge-danger',
    };
    return `<span class="badge ${map[estado] || 'badge-muted'}">${escHtml(estado)}</span>`;
  }

  function criticidadBadge(c) {
    const map = { 'Alta':'badge-danger', 'Media':'badge-warning', 'Baja':'badge-success' };
    return `<span class="badge ${map[c] || 'badge-muted'}">${escHtml(c)}</span>`;
  }

  function riskBadge(color) {
    const labels = { low:'Bajo', medium:'Medio', high:'Alto', vhigh:'Muy Alto' };
    return `<span class="risk-badge risk-${color}">${labels[color] || color}</span>`;
  }

  function resultadoBadge(r) {
    const map = {
      'Satisfactorio':     'badge-success',
      'Atención Requerida':'badge-warning',
      'No Satisfactorio':  'badge-danger',
      'Crítico':           'badge-danger',
    };
    return `<span class="badge ${map[r] || 'badge-muted'}">${escHtml(r)}</span>`;
  }

  function estadoInsBadge(estado) {
    const map = { 'Cerrada':'badge-success', 'Abierta':'badge-warning', 'Cancelada':'badge-muted' };
    return `<span class="badge ${map[estado] || 'badge-muted'}">${escHtml(estado)}</span>`;
  }

  function vencimientoBadge(isoDate) {
    if (!isoDate) return '<span class="badge badge-muted">Sin fecha</span>';
    const days = daysUntil(isoDate);
    if (days < 0)   return `<span class="badge badge-danger">Vencida ${Math.abs(days)}d</span>`;
    if (days <= 30) return `<span class="badge badge-warning">${days}d restantes</span>`;
    if (days <= 90) return `<span class="badge badge-info">${days}d restantes</span>`;
    return `<span class="badge badge-success">${fmtDate(isoDate)}</span>`;
  }

  function crBadge(rate) {
    if (rate === null || rate === undefined) return '<span class="badge badge-muted">Sin datos</span>';
    if (rate < 0)    return `<span class="badge badge-warning">${rate.toFixed(3)} mm/a (Neg.)</span>`;
    if (rate === 0)  return '<span class="badge badge-success">0.000 mm/a</span>';
    if (rate <= 0.1) return `<span class="badge badge-success cr-low">${rate.toFixed(3)} mm/a</span>`;
    if (rate <= 0.5) return `<span class="badge badge-warning cr-medium">${rate.toFixed(3)} mm/a</span>`;
    return `<span class="badge badge-danger cr-high">${rate.toFixed(3)} mm/a</span>`;
  }

  function condicionBadge(cond) {
    const map = {
      'Normal':                   'badge-success',
      'Alerta':                   'badge-warning',
      'Espesor bajo el mínimo':   'badge-danger',
      'Inspección vencida':       'badge-danger',
      'Información insuficiente': 'badge-muted',
    };
    const icons = {
      'Normal':                   '✅ ',
      'Alerta':                   '⚠️ ',
      'Espesor bajo el mínimo':   '⛔ ',
      'Inspección vencida':       '⏰ ',
      'Información insuficiente': 'ℹ️ ',
    };
    return `<span class="badge ${map[cond] || 'badge-muted'}">${icons[cond] || ''}${escHtml(cond || '—')}</span>`;
  }

  function fmtSci(v, dec = 2) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (v === 0) return '0';
    if (Math.abs(v) < 0.01 || Math.abs(v) >= 1e6) return Number(v).toExponential(dec);
    return Number(v).toFixed(dec);
  }

  function downloadJSON(obj, filename = 'proyecto_sgiee.json') {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Toast ─────────────────────────────────────────────────────
  function toast(title, msg = '', type = 'info', duration = 4000) {
    const icons = { info:'ℹ️', success:'✅', warning:'⚠️', error:'❌' };
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-body">
        <div class="toast-title">${escHtml(title)}</div>
        ${msg ? `<div class="toast-msg">${escHtml(msg)}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    c.prepend(el);
    if (duration > 0) setTimeout(() => el.remove(), duration);
  }

  // ── Modal ─────────────────────────────────────────────────────
  function openModal(titleHtml, bodyHtml, { size = 'modal-md', footerHtml = '' } = {}) {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');
    overlay.classList.add('open');
    container.classList.add('open');
    container.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h2>${titleHtml}</h2>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>`;
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal, { once: true });
  }

  function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');
    overlay.classList.remove('open');
    container.classList.remove('open');
    container.innerHTML = '';
  }

  // ── Confirm dialog ────────────────────────────────────────────
  function confirm(msg, onYes) {
    openModal('Confirmar acción',
      `<p style="font-size:.95rem;margin-bottom:8px;">${escHtml(msg)}</p>`,
      {
        size: 'modal-sm',
        footerHtml: `
          <button class="btn btn-secondary" id="confNo">Cancelar</button>
          <button class="btn btn-danger"    id="confYes">Confirmar</button>`
      });
    document.getElementById('confNo').addEventListener('click', closeModal);
    document.getElementById('confYes').addEventListener('click', () => {
      closeModal();
      onYes();
    });
  }

  // ── Simple table builder ──────────────────────────────────────
  function buildTable(headers, rows, { emptyMsg = 'Sin registros', id = '' } = {}) {
    if (rows.length === 0) {
      return `<div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Sin datos</h3>
        <p>${emptyMsg}</p>
      </div>`;
    }
    const ths = headers.map(h =>
      `<th${h.sortKey ? ` data-sort="${h.sortKey}"` : ''}${h.cls ? ` class="${h.cls}"` : ''}>${h.label}</th>`
    ).join('');
    const trs = rows.map(r => `<tr>${r}</tr>`).join('');
    return `
      <div class="table-wrapper">
        <table class="data-table"${id ? ` id="${id}"` : ''}>
          <thead><tr>${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`;
  }

  // ── Corrosion rate color class ────────────────────────────────
  function crClass(rate) {
    if (!rate || rate <= 0)  return 'cr-low';
    if (rate <= 0.1) return 'cr-low';
    if (rate <= 0.5) return 'cr-medium';
    return 'cr-high';
  }

  // ── Remaining life color class ────────────────────────────────
  function rlClass(years) {
    if (!isFinite(years)) return 'cr-low';
    if (years > 10) return 'cr-low';
    if (years > 5)  return 'cr-medium';
    return 'cr-high';
  }

  // ── Export to CSV ─────────────────────────────────────────────
  function exportCSV(headers, rows, filename = 'export.csv') {
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(','))
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Debounce ──────────────────────────────────────────────────
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  return {
    fmtDate, fmtDatetime, daysUntil, addYears, today,
    round, fmt, clamp,
    escHtml, truncate, capitalize,
    estadoBadge, criticidadBadge, riskBadge, resultadoBadge, estadoInsBadge, vencimientoBadge, crBadge, condicionBadge,
    fmtSci, downloadJSON,
    toast, openModal, closeModal, confirm,
    buildTable, crClass, rlClass,
    exportCSV, debounce,
  };
})();
