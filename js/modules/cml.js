/**
 * SGIEE – Módulo: CML / TML Management (Secciones 4.3, 4.4 y 4.5)
 * - Vincula cada CML/TML con equipo, componente, ubicación, convención e historial.
 * - Calcula tasas de corrosión de corto y largo plazo, justifica la adoptada y estima vida remanente.
 * - Detecta datos insuficientes, fechas inconsistentes, velocidades nulas/negativas, bajo mínimo,
 *   cambios de punto, reparaciones y reemplazos.
 * - Calcula próxima inspección según API 510 / API 570 / API 653 con criterio gobernante.
 */
const ModCML = (() => {

  let selectedEquipoId = null;
  let selectedCmlId    = null;
  let searchTerm       = '';
  let viewMode         = 'list'; // 'list' | 'graphic'

  function render(equipoId = null) {
    if (equipoId) {
      selectedEquipoId = equipoId;
      const firstCml = DB.query('cmls', c => c.equipo_id === equipoId)[0];
      selectedCmlId = firstCml ? firstCml.id : null;
    }

    const el = document.getElementById('mod-cml');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>CML / TML – Puntos de Monitoreo de Corrosión</h2>
        <div class="actions" style="flex-wrap:wrap">
          <div style="display:inline-flex;border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;background:var(--c-surface)">
            <button class="btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}" id="cml-modeListBtn" style="border-radius:0">📋 Lista y Detalle</button>
            <button class="btn btn-sm ${viewMode === 'graphic' ? 'btn-primary' : 'btn-ghost'}" id="cml-modeGraphBtn" style="border-radius:0">📊 Vista Gráfica</button>
          </div>
          <button class="btn btn-secondary btn-sm" id="cml-convBtn">📖 Convención CML</button>
          <button class="btn btn-secondary btn-sm" id="cml-exportBtn">⬇ CSV</button>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-body" style="padding:14px 20px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <label style="margin:0;white-space:nowrap;font-weight:600">Equipo:</label>
            <select class="form-control" id="cml-eqSel" style="max-width:440px">${_equipoOptions()}</select>
            <div class="search-input" style="min-width:210px;flex:1;max-width:300px">
              <input type="text" id="cml-search" placeholder="Buscar CML, componente, ubicación…" value="${Utils.escHtml(searchTerm)}">
            </div>
            <button class="btn btn-primary btn-sm" id="cml-newCmlBtn">＋ Nuevo CML</button>
            ${selectedEquipoId ? `<button class="btn btn-secondary btn-sm" id="cml-goIsoBtn">📐 Ver Esquema</button>` : ''}
          </div>
        </div>
      </div>

      ${viewMode === 'graphic'
        ? `<div id="cml-graphicArea"></div>`
        : `<div class="grid-2" id="cml-mainGrid" style="align-items:start">
            <div id="cml-listArea"></div>
            <div id="cml-detailArea">
              <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:32px">
                <div class="empty-icon">📍</div>
                <h3>Seleccione un CML</h3>
                <p>Haga clic en un punto de monitoreo para ver tasas corto/largo plazo, tendencia, corte de pared y próxima inspección.</p>
              </div>
            </div>
          </div>`}`;

    _bindEvents(el);
    _applyEquipoSel();
  }

  function _equipoOptions() {
    const equipos = DB.getAll('equipos').sort((a, b) => a.tag.localeCompare(b.tag));
    return `<option value="">— Todos los equipos —</option>` +
      equipos.map(e =>
        `<option value="${e.id}" ${selectedEquipoId === e.id ? 'selected' : ''}>${e.tag} – ${Utils.escHtml(e.nombre)} (${Utils.escHtml(e.tipo)})</option>`
      ).join('');
  }

  function _getFilteredCmls() {
    let cmls = selectedEquipoId
      ? DB.query('cmls', c => c.equipo_id === selectedEquipoId)
      : DB.getAll('cmls');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      cmls = cmls.filter(c => {
        const eq = DB.getById('equipos', c.equipo_id);
        return [c.nombre, c.componente, c.descripcion, c.ubicacion, eq?.tag, eq?.nombre]
          .some(v => (v || '').toLowerCase().includes(q));
      });
    }
    return cmls;
  }

  function _condColor(cond) {
    if (cond === 'Espesor bajo el mínimo' || cond === 'Inspección vencida') return '#d93025';
    if (cond === 'Alerta') return '#e8a020';
    if (cond === 'Información insuficiente') return '#6c7a89';
    return '#22a06b';
  }

  function _applyEquipoSel() {
    if (viewMode === 'graphic') {
      _renderGraphicalView();
      return;
    }
    _renderCmlList();
    if (selectedCmlId && DB.getById('cmls', selectedCmlId)) {
      _renderCmlDetail(selectedCmlId);
    }
  }

  /* ── CML List ───────────────────────────────────────────── */
  function _renderCmlList() {
    const cmls = _getFilteredCmls();

    const listArea = document.getElementById('cml-listArea');
    if (!listArea) return;

    if (cmls.length === 0) {
      listArea.innerHTML = `<div class="empty-state"><div class="empty-icon">📍</div><h3>Sin CMLs</h3><p>Agregue puntos de monitoreo para este equipo.</p></div>`;
      return;
    }

    listArea.innerHTML = cmls.map(c => {
      const eq = DB.getById('equipos', c.equipo_id);
      const a  = DB.analyzeCML(c.id, eq);
      const isSelected = c.id === selectedCmlId;
      const rlTxt = a.rl !== null && isFinite(a.rl) ? `${a.rl.toFixed(1)} a` : (a.insufficient ? '—' : '∞');

      return `
        <div class="cml-card ${isSelected ? 'selected' : ''}" data-cml="${c.id}"
          style="background:var(--c-surface);border:1px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-border)'};
          border-radius:var(--r-lg);padding:14px 16px;margin-bottom:10px;cursor:pointer;
          ${isSelected ? 'box-shadow:0 0 0 3px rgba(26,111,196,.15)' : ''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div>
              <div style="font-weight:700;font-size:.95rem">${Utils.escHtml(c.nombre)} · <span class="font-mono text-xs">${Utils.escHtml(eq?.tag || '')}</span></div>
              <div class="text-xs font-bold" style="color:var(--c-primary)">${Utils.escHtml(c.componente || 'Componente no especificado')}</div>
              <div class="text-xs text-muted">${Utils.escHtml(c.descripcion || '—')} · ${Utils.escHtml(c.ubicacion || '')}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" data-cml-action="edit" data-cml="${c.id}" title="Editar CML">✏️</button>
              <button class="btn btn-ghost btn-sm" data-cml-action="del"  data-cml="${c.id}" title="Eliminar" style="color:var(--c-danger)">🗑</button>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;align-items:center">
            <div><div class="text-xs text-muted">Últ. esp.</div><div class="font-mono font-bold">${a.last ? Number(a.last.espesor_mm).toFixed(2)+' mm' : '—'}</div></div>
            <div><div class="text-xs text-muted">CR adoptada</div><div>${Utils.crBadge(a.insufficient ? null : a.cr_adoptada)}</div></div>
            <div><div class="text-xs text-muted">Vida rem.</div><div class="font-bold ${Utils.rlClass(a.rl ?? Infinity)}">${rlTxt}</div></div>
            <div><div class="text-xs text-muted">Lecturas</div><div class="font-bold">${a.allMeds.length}</div></div>
            <div style="margin-left:auto">${Utils.condicionBadge(a.condicion)}</div>
          </div>
        </div>`;
    }).join('');

    listArea.querySelectorAll('.cml-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        selectedCmlId = card.dataset.cml;
        _renderCmlList();
        _renderCmlDetail(selectedCmlId);
      });
    });

    listArea.querySelectorAll('[data-cml-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { cmlAction, cml } = btn.dataset;
        if (cmlAction === 'edit') openCmlForm(cml);
        if (cmlAction === 'del')  deleteCml(cml);
      });
    });
  }

  /* ── CML Detail Panel ───────────────────────────────────── */
  function _renderCmlDetail(cmlId) {
    const cml = DB.getById('cmls', cmlId);
    const detArea = document.getElementById('cml-detailArea');
    if (!cml || !detArea) return;

    const eq = DB.getById('equipos', cml.equipo_id);
    const a  = DB.analyzeCML(cmlId, eq);

    const warnBanner = a.warnings.length > 0 ? `
      <div class="alert ${a.condicion==='Espesor bajo el mínimo' ? 'alert-danger' : 'alert-warning'} mb-2">
        <span class="alert-icon">${a.condicion==='Espesor bajo el mínimo' ? '⛔' : '⚠️'}</span>
        <div>
          <strong>Observaciones de calidad y condición:</strong>
          <ul style="margin:4px 0 0 16px;list-style:disc;font-size:.82rem">
            ${a.warnings.map(w => `<li>${Utils.escHtml(w)}</li>`).join('')}
          </ul>
        </div>
      </div>` : '';

    const medRows = [...a.allMeds].reverse().map(m => {
      const evBadge = m.evento && m.evento !== 'Normal'
        ? `<span class="badge badge-warning">${Utils.escHtml(m.evento)}</span>`
        : `<span class="badge badge-muted">Normal</span>`;
      const dispOrig = m.unidad === 'in' && m.valor_original
        ? `${Number(m.espesor_mm).toFixed(2)} mm <span class="text-xs text-muted">(${Number(m.valor_original).toFixed(3)} in)</span>`
        : `${Number(m.espesor_mm).toFixed(2)} mm`;
      return `<tr>
        <td>${Utils.fmtDate(m.fecha)}</td>
        <td class="font-mono font-bold">${dispOrig}</td>
        <td>${Utils.escHtml(m.unidad || 'mm')}</td>
        <td>${Utils.escHtml(m.metodo)}</td>
        <td>${evBadge}</td>
        <td>${Utils.escHtml(m.tecnico || '—')}</td>
        <td class="text-xs">${Utils.escHtml(m.notas || '—')}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-med-action="edit" data-med="${m.id}">✏️</button>
          <button class="btn btn-ghost btn-sm" data-med-action="del"  data-med="${m.id}" style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    detArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>📍 ${Utils.escHtml(cml.nombre)} – ${Utils.escHtml(eq?.tag || '')}</h3>
            <div class="text-xs text-muted">${Utils.escHtml(cml.componente || '')} · ${Utils.escHtml(cml.ubicacion || '')}</div>
          </div>
          <div class="d-flex gap-2 align-center">
            ${Utils.condicionBadge(a.condicion)}
            <button class="btn btn-primary btn-sm" id="cml-newMedBtn">＋ Nueva Medición</button>
          </div>
        </div>
        <div class="card-body">

          ${warnBanner}

          <!-- 5 Espesores de evaluación (Sección 4.2) -->
          <div class="form-section">
            <div class="form-section-title">Espesores de Evaluación (mm)</div>
            <div class="mini-stat-row">
              <div class="mini-stat"><div class="ms-label">Nominal (t_nom)</div><div class="ms-val font-mono">${a.t_nom !== null ? a.t_nom.toFixed(2) : '—'}</div></div>
              <div class="mini-stat"><div class="ms-label">Requerido (t_req)</div><div class="ms-val font-mono">${eq?.espesor_requerido_mm ? Number(eq.espesor_requerido_mm).toFixed(2) : (a.t_min !== null ? a.t_min.toFixed(2) : '—')}</div></div>
              <div class="mini-stat"><div class="ms-label">Mín. servicio (t_mín)</div><div class="ms-val font-mono" style="color:var(--c-danger)">${a.t_min !== null ? a.t_min.toFixed(2) : '—'}</div></div>
              <div class="mini-stat"><div class="ms-label">Alerta (t_alerta)</div><div class="ms-val font-mono" style="color:var(--c-warning)">${a.t_alerta !== null ? a.t_alerta.toFixed(2) : '—'}</div></div>
              <div class="mini-stat"><div class="ms-label">Medido (t_med)</div><div class="ms-val font-mono" style="color:var(--c-primary)">${a.last ? Number(a.last.espesor_mm).toFixed(2) : '—'}</div></div>
            </div>
            ${a.alerta_justificacion ? `<div class="text-xs text-muted mt-1"><strong>Justificación alerta:</strong> ${Utils.escHtml(a.alerta_justificacion)}</div>` : ''}
          </div>

          <!-- Velocidades Corto vs Largo Plazo y Justificación (Sección 4.4) -->
          <div class="form-section">
            <div class="form-section-title">Velocidades de Corrosión y Vida Remanente</div>
            <div class="mini-stat-row">
              <div class="mini-stat">
                <div class="ms-label">CR Corto Plazo (ST)</div>
                <div class="ms-val font-mono" style="font-size:1rem">${a.cr_st !== null ? a.cr_st.toFixed(3)+' mm/a' : '—'}</div>
              </div>
              <div class="mini-stat">
                <div class="ms-label">CR Largo Plazo (LT)</div>
                <div class="ms-val font-mono" style="font-size:1rem">${a.cr_lt !== null ? a.cr_lt.toFixed(3)+' mm/a' : '—'}</div>
              </div>
              <div class="mini-stat">
                <div class="ms-label">CR Adoptada</div>
                <div class="ms-val font-mono" style="font-size:1.05rem;color:var(--c-primary)">${!a.insufficient && a.cr_adoptada !== null ? a.cr_adoptada.toFixed(3)+' mm/a' : '—'}</div>
              </div>
              <div class="mini-stat">
                <div class="ms-label">Vida Remanente (RL)</div>
                <div class="ms-val ${Utils.rlClass(a.rl ?? Infinity)}">${a.rl !== null && isFinite(a.rl) ? a.rl.toFixed(2)+' a' : (a.insufficient ? '—' : '∞')}</div>
              </div>
            </div>
            <div class="text-xs text-muted mt-1">
              <strong>Justificación de tasa adoptada:</strong> ${Utils.escHtml(a.cr_justificacion)}
              ${a.cr_reg !== null ? ` <em>(Ref. regresión lineal: ${a.cr_reg.toFixed(3)} mm/a)</em>` : ''}
            </div>
          </div>

          <!-- Gráfico Espesor vs Tiempo -->
          ${_buildTrendChart(a)}

          <!-- Próxima inspección según norma por familia (Sección 4.5) -->
          ${_buildNextInspectionBox(a)}

          <!-- Visor dimensional con datos reales (sin mock) -->
          <div id="corrosion-interactive" class="card mb-2"></div>

          <!-- Convención utilizada -->
          ${cml.convencion ? `<div class="text-xs text-muted mb-2"><strong>Convención CML/TML:</strong> ${Utils.escHtml(cml.convencion)}</div>` : ''}

          <!-- Tabla de mediciones -->
          <div class="section-header mt-2">
            <h3 class="text-sm">Historial de Mediciones (${a.allMeds.length} registros · ${a.comparable.length} comparables)</h3>
          </div>
          ${a.allMeds.length === 0
            ? `<div class="empty-state" style="padding:20px"><p>Sin mediciones registradas aún.</p></div>`
            : `<div class="table-wrapper">
                <table class="data-table" id="med-table">
                  <thead><tr>
                    <th>Fecha</th><th>Espesor</th><th>Unid.</th><th>Técnica</th><th>Evento</th><th>Inspector</th><th>Observaciones</th><th class="col-actions">Acc.</th>
                  </tr></thead>
                  <tbody>${medRows}</tbody>
                </table>
               </div>`}
        </div>
      </div>`;

    _bindRealCorrosionVisual(detArea, cml, eq, a);
    document.getElementById('cml-newMedBtn')?.addEventListener('click', () => openMedForm(cmlId, null));
    detArea.querySelectorAll('[data-med-action]').forEach(btn => {
      const { medAction, med } = btn.dataset;
      btn.addEventListener('click', () => {
        if (medAction === 'edit') openMedForm(cmlId, med);
        if (medAction === 'del')  deleteMedicion(med, cmlId);
      });
    });
  }

  /* ── Trend chart SVG (includes t_nom, t_alerta, t_min + events) ── */
  function _buildTrendChart(a) {
    const meds = a.allMeds;
    if (meds.length < 2) {
      return `<div class="alert alert-info mb-2"><span class="alert-icon">📉</span>
        <div>Información insuficiente para graficar tendencia (se requieren al menos 2 mediciones en fechas distintas).</div></div>`;
    }

    const W = 500, H = 175, PAD = { t: 16, b: 34, l: 48, r: 24 };
    const iW = W - PAD.l - PAD.r;
    const iH = H - PAD.t - PAD.b;

    const dates = meds.map(m => new Date(m.fecha).getTime());
    const esps  = meds.map(m => Number(m.espesor_mm));
    const tFirst = Math.min(...dates);
    const tLast  = Math.max(...dates);

    // Extend x-axis up to 2 years projection if CR > 0
    const hasProj = !a.insufficient && a.cr_adoptada > 0 && a.last;
    const projYears = hasProj ? Math.min(3, Math.max(1, isFinite(a.rl) && a.rl > 0 ? a.rl : 2)) : 0;
    const tProj = hasProj ? tLast + projYears * 365.25 * 24 * 3600 * 1000 : tLast;
    const tMax = Math.max(tLast, tProj);

    const allY = [...esps];
    if (a.t_min !== null) allY.push(a.t_min);
    if (a.t_alerta !== null) allY.push(a.t_alerta);
    if (a.t_nom !== null) allY.push(a.t_nom);
    if (hasProj) allY.push(Math.max(0, Number(a.last.espesor_mm) - a.cr_adoptada * projYears));

    const yMin = Math.max(0, Math.min(...allY) * 0.9);
    const yMax = Math.max(...allY) * 1.08;

    const xScale = d => ((d - tFirst) / (tMax - tFirst || 1)) * iW + PAD.l;
    const yScale = v => iH - ((v - yMin) / (yMax - yMin || 1)) * iH + PAD.t;

    const hLine = (val, color, label, dash = '4,3') => {
      if (val === null || val === undefined || isNaN(val)) return '';
      const y = yScale(val);
      return `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="${color}" stroke-width="1.2" stroke-dasharray="${dash}"/>
        <text x="${W - PAD.r - 2}" y="${y - 3}" font-size="9" font-weight="700" fill="${color}" text-anchor="end">${label} (${val.toFixed(2)})</text>`;
    };

    const pts = meds.map(m => `${xScale(new Date(m.fecha).getTime())},${yScale(Number(m.espesor_mm))}`).join(' ');
    const circles = meds.map(m => {
      const cx = xScale(new Date(m.fecha).getTime());
      const cy = yScale(Number(m.espesor_mm));
      const isEv = m.evento && m.evento !== 'Normal';
      return `<circle cx="${cx}" cy="${cy}" r="${isEv ? 5.5 : 4}" fill="${isEv ? '#e8a020' : 'var(--c-primary)'}" stroke="#fff" stroke-width="1.5">
        <title>${m.fecha}: ${Number(m.espesor_mm).toFixed(2)} mm (${m.evento || 'Normal'})</title>
      </circle>
      <text x="${cx}" y="${cy - 7}" font-size="8.5" text-anchor="middle" fill="var(--c-text-primary)" font-weight="600">${Number(m.espesor_mm).toFixed(2)}</text>`;
    }).join('');

    let projLine = '';
    if (hasProj) {
      const x1 = xScale(tLast), y1 = yScale(Number(a.last.espesor_mm));
      const projVal = Math.max(0, Number(a.last.espesor_mm) - a.cr_adoptada * projYears);
      const x2 = xScale(tProj), y2 = yScale(projVal);
      projLine = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e05d20" stroke-width="1.8" stroke-dasharray="5,3"/>`;
    }

    const fmtD = ms => new Date(ms).toLocaleDateString('es-ES', { month: '2-digit', year: '2-digit' });

    return `
      <div class="mb-2" style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:10px 12px">
        <div class="text-xs text-muted mb-1" style="font-weight:700;text-transform:uppercase">Gráfico Espesor vs. Tiempo (mm)</div>
        <div style="overflow-x:auto">
          <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%">
            ${[0,0.25,0.5,0.75,1].map(f => {
              const y = PAD.t + f * iH;
              const v = yMax - f * (yMax - yMin);
              return `<line x1="${PAD.l}" y1="${y}" x2="${W-PAD.r}" y2="${y}" stroke="var(--c-border)" stroke-width=".5"/>
                <text x="${PAD.l - 5}" y="${y + 3}" font-size="9" fill="var(--c-text-muted)" text-anchor="end">${v.toFixed(1)}</text>`;
            }).join('')}
            ${hLine(a.t_nom,    '#5a6a80', 't_nom', '2,3')}
            ${hLine(a.t_alerta, '#e8a020', 't_alerta', '5,3')}
            ${hLine(a.t_min,    '#d93025', 't_mín', '4,3')}
            ${projLine}
            <polyline points="${pts}" fill="none" stroke="var(--c-primary)" stroke-width="2.2"/>
            ${circles}
            <text x="${PAD.l}" y="${H - 6}" font-size="9" fill="var(--c-text-muted)">${fmtD(tFirst)}</text>
            <text x="${xScale(tLast)}" y="${H - 6}" font-size="9" fill="var(--c-text-muted)" text-anchor="middle">${fmtD(tLast)}</text>
            ${hasProj ? `<text x="${W - PAD.r}" y="${H - 6}" font-size="9" fill="#e05d20" text-anchor="end">Proy. ${fmtD(tProj)}</text>` : ''}
            <text x="12" y="${H/2}" font-size="9" fill="var(--c-text-muted)" transform="rotate(-90 12 ${H/2})">Espesor (mm)</text>
          </svg>
        </div>
        <div class="text-xs text-muted" style="display:flex;gap:12px;flex-wrap:wrap">
          <span>🔵 Mediciones</span><span>🟠 Evento (Reparación/Reemplazo)</span>
          <span>┈ Proyección CR adoptada</span><span style="color:#e8a020">— t_alerta</span><span style="color:#d93025">— t_mín</span>
        </div>
      </div>`;
  }

  /* ── Next Inspection Box per API 510 / 570 / 653 (Sección 4.5) ── */
  function _buildNextInspectionBox(a) {
    const ni = a.nextInsp;
    if (!ni) return '';
    const cls = a.condicion === 'Espesor bajo el mínimo' || ni.vencida ? 'alert-danger'
      : a.condicion === 'Alerta' ? 'alert-warning'
      : a.condicion === 'Información insuficiente' ? 'alert-info' : 'alert-success';

    return `
      <div class="alert ${cls} mb-2">
        <span class="alert-icon">📅</span>
        <div style="width:100%">
          <strong>Próxima Inspección – ${Utils.escHtml(ni.norma)}</strong>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:6px">
            <div><div class="text-xs text-muted">Tipo inspección</div><div class="font-bold text-sm">${Utils.escHtml(ni.tipo_inspeccion)}</div></div>
            <div><div class="text-xs text-muted">Fecha referencia</div><div class="font-bold text-sm">${Utils.fmtDate(ni.fecha_referencia)}</div></div>
            <div><div class="text-xs text-muted">Intervalo calculado</div><div class="font-bold text-sm">${ni.intervalo_a !== null ? ni.intervalo_a + ' años' : '—'}</div></div>
            <div><div class="text-xs text-muted">Próxima fecha</div><div class="font-bold text-sm">${Utils.vencimientoBadge(ni.proxima_fecha)}</div></div>
          </div>
          <div class="text-xs mt-1"><strong>Criterio gobernante:</strong> ${Utils.escHtml(ni.criterio_gobernante)}</div>
          ${ni.declaracion_alcance ? `<div class="text-xs mt-1" style="opacity:.9"><strong>Alcance Tanques:</strong> ${Utils.escHtml(ni.declaracion_alcance)}</div>` : ''}
        </div>
      </div>`;
  }

  /* ── Real-data dimensional wall visualization (SVG cross-section / tank wall) ── */
  function _bindRealCorrosionVisual(detArea, cml, eq, a) {
    const host = detArea?.querySelector('#corrosion-interactive');
    if (!host) return;
    if (!a.last || a.t_nom === null || a.t_min === null) {
      host.innerHTML = `<div class="card-body text-xs text-muted">Agregue espesor nominal, mínimo y al menos una medición para visualizar el corte de pared.</div>`;
      return;
    }

    const nominal = a.t_nom;
    const minimum = a.t_min;
    const alertT  = a.t_alerta ?? minimum;
    const actual0 = Number(a.last.espesor_mm);
    const rate    = (!a.insufficient && a.cr_adoptada > 0) ? a.cr_adoptada : 0;
    const isTank  = eq?.tipo === 'Tanque Atmosférico';
    let projYears = 0;

    function draw() {
      const tProj = Math.max(0, actual0 - rate * projYears);
      const lossMm  = Math.max(0, nominal - tProj);
      const lossPct = Utils.clamp((lossMm / nominal) * 100, 0, 100);
      const margin  = tProj - minimum;
      const color   = tProj < minimum ? '#d93025' : tProj <= alertT ? '#e8a020' : '#22a06b';
      const label   = tProj < minimum ? 'Bajo mínimo' : tProj <= alertT ? 'Alerta' : 'Normal';

      let sectionSvg = '';
      if (isTank) {
        const wallW = 44;
        const remW  = wallW * Utils.clamp(tProj / nominal, 0.05, 1);
        const minX  = 78 + wallW * Utils.clamp(minimum / nominal, 0.05, 1);
        const alX   = 78 + wallW * Utils.clamp(alertT / nominal, 0.05, 1);
        sectionSvg = `
          <svg viewBox="0 0 215 135" width="215" height="135" style="max-width:100%;display:block;margin:0 auto">
            <rect x="14" y="18" width="64" height="96" fill="#1a6fc418" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="3,2"/>
            <polygon points="76,20 76,112 26,112" fill="#1a6fc422"/>
            <text x="46" y="13" text-anchor="middle" font-size="8.5" font-weight="700" fill="#1a6fc4">Fluido</text>
            <rect x="78" y="18" width="${wallW}" height="96" fill="#e2e8f0" stroke="#475569" stroke-width="1.8"/>
            ${lossMm > 0 ? `<rect x="${78 + remW}" y="18" width="${Math.max(0, wallW - remW)}" height="96" fill="${color}" opacity="0.34"/>` : ''}
            <rect x="78" y="18" width="${remW}" height="96" fill="#64748b" opacity="0.55"/>
            <line x1="${minX}" y1="14" x2="${minX}" y2="118" stroke="#d93025" stroke-width="1.6" stroke-dasharray="3,2"/>
            <line x1="${alX}"  y1="14" x2="${alX}"  y2="118" stroke="#e8a020" stroke-width="1.4" stroke-dasharray="3,2"/>
            <rect x="10" y="114" width="128" height="6" rx="2" fill="#94a3b8"/>
            <text x="132" y="38" font-size="8.5" font-weight="700" fill="#334155">t_nom: ${nominal.toFixed(2)}</text>
            <text x="132" y="56" font-size="8.5" font-weight="700" fill="${color}">t_proy: ${tProj.toFixed(2)}</text>
            <text x="132" y="74" font-size="8.5" font-weight="700" fill="#e8a020">t_alerta: ${alertT.toFixed(2)}</text>
            <text x="132" y="92" font-size="8.5" font-weight="700" fill="#d93025">t_mín: ${minimum.toFixed(2)}</text>
            <text x="132" y="110" font-size="8" fill="#64748b">Pérdida: ${lossPct.toFixed(1)}%</text>
          </svg>`;
      } else {
        const rOut = 54, wallPx = 24, rInNom = rOut - wallPx;
        const lossPx = Utils.clamp((nominal - tProj) / nominal, 0, 1) * wallPx;
        const rActIn = rInNom + lossPx;
        const rMin   = rOut - Utils.clamp(minimum / nominal, 0, 1) * wallPx;
        const rAl    = rOut - Utils.clamp(alertT  / nominal, 0, 1) * wallPx;
        sectionSvg = `
          <svg viewBox="0 0 155 135" width="155" height="135" style="max-width:100%;display:block;margin:0 auto">
            <circle cx="77" cy="64" r="${rOut}" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
            ${lossPx > 0 ? `<circle cx="77" cy="64" r="${rActIn}" fill="${color}" opacity="0.34"/>` : ''}
            <circle cx="77" cy="64" r="${rInNom}" fill="#f8fafc" stroke="#64748b" stroke-width="1.2" stroke-dasharray="3,2"/>
            <circle cx="77" cy="64" r="${rActIn}" fill="none" stroke="${color}" stroke-width="2"/>
            <circle cx="77" cy="64" r="${rAl}" fill="none" stroke="#e8a020" stroke-width="1.4" stroke-dasharray="3,2"/>
            <circle cx="77" cy="64" r="${rMin}" fill="none" stroke="#d93025" stroke-width="1.8" stroke-dasharray="4,2"/>
            <text x="77" y="61" text-anchor="middle" font-size="10" font-weight="800" fill="#1e293b">${tProj.toFixed(2)} mm</text>
            <text x="77" y="74" text-anchor="middle" font-size="8.2" font-weight="700" fill="${color}">-${lossPct.toFixed(1)}%</text>
            <text x="77" y="130" text-anchor="middle" font-size="8" fill="#64748b">Corte transversal de pared</text>
          </svg>`;
      }

      host.innerHTML = `
        <div class="card-header" style="padding:10px 14px">
          <h3 style="font-size:.9rem">🔎 Corte de Pared Interactivo – ${Utils.escHtml(cml.nombre)}</h3>
          <span class="badge" style="background:${color}18;color:${color};border:1px solid ${color}">${label}</span>
        </div>
        <div class="card-body" style="padding:14px">
          <div style="display:grid;grid-template-columns:minmax(150px,215px) 1fr;gap:14px;align-items:center">
            <div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:6px">${sectionSvg}</div>
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
                <span class="text-xs font-bold">Proyección lineal (+${projYears} años · CR=${rate.toFixed(3)} mm/a):</span>
                <input id="d-proj" type="range" min="0" max="15" step="1" value="${projYears}" style="flex:1;min-width:140px">
              </div>
              <div style="height:18px;border-radius:9px;background:#e6edf3;position:relative;overflow:hidden">
                <div style="position:absolute;left:${Utils.clamp((minimum/nominal)*100,0,100)}%;top:0;bottom:0;width:2px;background:#d93025;z-index:3" title="t_mín"></div>
                <div style="position:absolute;left:${Utils.clamp((alertT/nominal)*100,0,100)}%;top:0;bottom:0;width:2px;background:#e8a020;z-index:2" title="t_alerta"></div>
                <div style="width:${Utils.clamp((tProj/nominal)*100,0,100)}%;height:100%;background:${color};transition:width .18s"></div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:.76rem;margin-top:8px">
                <div><strong>Espesor proyectado:</strong> <span class="font-mono">${tProj.toFixed(2)} mm</span></div>
                <div><strong>Pérdida vs nominal:</strong> <span class="font-mono">${lossMm.toFixed(2)} mm (${lossPct.toFixed(1)}%)</span></div>
                <div><strong>Margen sobre t<sub>mín</sub>:</strong> <span class="font-mono" style="color:${margin<0?'#d93025':'inherit'}">${margin>=0?'+':''}${margin.toFixed(2)} mm</span></div>
                <div><strong>Límites:</strong> <span style="color:#e8a020">t<sub>a</sub>=${alertT.toFixed(2)}</span> · <span style="color:#d93025">t<sub>m</sub>=${minimum.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>`;

      host.querySelector('#d-proj')?.addEventListener('input', e => {
        projYears = Number(e.target.value);
        draw();
      });
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════════
     VISTA GRÁFICA INTEGRAL DE CML / TML
     (Mapa Esquemático + Barras Espesor + CR ST/LT & RL + Multi-Tendencia)
     ═══════════════════════════════════════════════════════════ */
  function _renderGraphicalView() {
    const area = document.getElementById('cml-graphicArea');
    if (!area) return;

    const cmls = _getFilteredCmls();
    if (cmls.length === 0) {
      area.innerHTML = `<div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:36px">
        <div class="empty-icon">📊</div>
        <h3>Sin puntos CML / TML para graficar</h3>
        <p>Ajuste los filtros o cree un nuevo CML/TML para visualizar su comportamiento gráfico.</p>
      </div>`;
      return;
    }

    const items = cmls.map(c => {
      const eq = DB.getById('equipos', c.equipo_id);
      const a  = DB.analyzeCML(c.id, eq);
      return { cml: c, eq, a, color: _condColor(a.condicion) };
    });

    if (!selectedCmlId || !items.some(i => i.cml.id === selectedCmlId)) {
      selectedCmlId = items[0].cml.id;
    }
    const activeItem = items.find(i => i.cml.id === selectedCmlId) || items[0];

    const nNorm = items.filter(i => i.a.condicion === 'Normal').length;
    const nAlrt = items.filter(i => i.a.condicion === 'Alerta').length;
    const nCrit = items.filter(i => i.a.condicion === 'Espesor bajo el mínimo' || i.a.condicion === 'Inspección vencida').length;
    const nIns  = items.filter(i => i.a.condicion === 'Información insuficiente').length;
    const validCRs = items.filter(i => !i.a.insufficient && i.a.cr_adoptada !== null).map(i => i.a.cr_adoptada);
    const maxCR = validCRs.length ? Math.max(...validCRs) : null;

    area.innerHTML = `
      <!-- KPIs rápidos -->
      <div class="kpi-grid mb-2" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <div class="kpi-card"><div class="kpi-label">CMLs / TMLs visibles</div><div class="kpi-value">${items.length}</div><div class="kpi-sub">${selectedEquipoId ? Utils.escHtml(activeItem.eq?.tag || '') : 'Todos los equipos'}</div></div>
        <div class="kpi-card"><div class="kpi-label">Normal</div><div class="kpi-value" style="color:var(--c-success)">${nNorm}</div><div class="kpi-sub">Sobre t_alerta</div></div>
        <div class="kpi-card"><div class="kpi-label">En Alerta</div><div class="kpi-value" style="color:var(--c-warning)">${nAlrt}</div><div class="kpi-sub">t_mín ≤ t_med ≤ t_alerta</div></div>
        <div class="kpi-card"><div class="kpi-label">Crítico / Vencido</div><div class="kpi-value" style="color:var(--c-danger)">${nCrit}</div><div class="kpi-sub">Bajo t_mín o vencido</div></div>
        <div class="kpi-card"><div class="kpi-label">Info. Insuficiente</div><div class="kpi-value" style="color:#6c7a89">${nIns}</div><div class="kpi-sub">&lt; 2 lecturas comparables</div></div>
        <div class="kpi-card"><div class="kpi-label">Peor CR Adoptada</div><div class="kpi-value" style="color:var(--c-primary)">${maxCR !== null ? maxCR.toFixed(3) : '—'}</div><div class="kpi-sub">mm/año</div></div>
      </div>

      <!-- Fila 1: Mapa esquemático de puntos + Comparativa de espesores -->
      <div class="grid-2 mb-2" style="align-items:stretch">
        <div class="card">
          <div class="card-header">
            <h3>🗺 Mapa Visual de Puntos CML / TML</h3>
            <span class="text-xs text-muted">Haga clic en un punto para inspeccionarlo</span>
          </div>
          <div class="card-body">
            ${_buildGraphicSchematicPanel(items, activeItem)}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>📏 Comparativa de Espesores por CML (mm)</h3>
            <span class="text-xs text-muted">t_nom vs t_med con límites t_alerta y t_mín</span>
          </div>
          <div class="card-body" style="overflow-x:auto">
            ${_buildGraphicThicknessBars(items, activeItem.cml.id)}
          </div>
        </div>
      </div>

      <!-- Fila 2: Tasas de corrosión ST/LT/Adoptada + Vida Remanente -->
      <div class="grid-2 mb-2" style="align-items:stretch">
        <div class="card">
          <div class="card-header">
            <h3>⚡ Tasas de Corrosión: Corto vs. Largo Plazo (mm/año)</h3>
            <span class="text-xs text-muted">CR<sub>ST</sub> · CR<sub>LT</sub> · CR<sub>adoptada</sub></span>
          </div>
          <div class="card-body" style="overflow-x:auto">
            ${_buildGraphicCorrosionRates(items, activeItem.cml.id)}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>⏳ Vida Remanente (RL) por CML / TML</h3>
            <span class="text-xs text-muted">Zonas crítica (&lt;2a), precaución (2–5a) y segura (&gt;5a)</span>
          </div>
          <div class="card-body" style="overflow-x:auto">
            ${_buildGraphicRemainingLife(items, activeItem.cml.id)}
          </div>
        </div>
      </div>

      <!-- Fila 3: Tendencia Multi-CML Superpuesta + Tarjeta interactiva del punto seleccionado -->
      <div class="grid-2 mb-2" style="align-items:start">
        <div class="card">
          <div class="card-header">
            <h3>📈 ${selectedEquipoId ? `Tendencia Multi-CML Superpuesta (${Utils.escHtml(activeItem.eq?.tag || '')})` : 'Tendencia Comparativa (% Espesor Remanente vs. Tiempo)'}</h3>
            <span class="text-xs text-muted">Evolución histórica y proyección</span>
          </div>
          <div class="card-body" style="overflow-x:auto">
            ${_buildMultiCmlTrendChart(items, Boolean(selectedEquipoId))}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>🎯 Punto Seleccionado: ${Utils.escHtml(activeItem.cml.nombre)} · <span class="font-mono">${Utils.escHtml(activeItem.eq?.tag || '')}</span></h3>
              <div class="text-xs text-muted">${Utils.escHtml(activeItem.cml.componente || '')} · ${Utils.escHtml(activeItem.cml.ubicacion || '')}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="cml-gNewMedBtn">＋ Medición</button>
              <button class="btn btn-secondary btn-sm" id="cml-gOpenDetBtn">📋 Ver Detalle</button>
            </div>
          </div>
          <div class="card-body">
            <div class="mini-stat-row mb-2">
              <div class="mini-stat"><div class="ms-label">Condición</div><div class="ms-val" style="font-size:.82rem">${Utils.condicionBadge(activeItem.a.condicion)}</div></div>
              <div class="mini-stat"><div class="ms-label">Últ. Espesor</div><div class="ms-val font-mono">${activeItem.a.last ? Number(activeItem.a.last.espesor_mm).toFixed(2)+' mm' : '—'}</div></div>
              <div class="mini-stat"><div class="ms-label">CR Adoptada</div><div class="ms-val font-mono" style="color:var(--c-primary)">${!activeItem.a.insufficient && activeItem.a.cr_adoptada !== null ? activeItem.a.cr_adoptada.toFixed(3)+' mm/a' : '—'}</div></div>
              <div class="mini-stat"><div class="ms-label">Vida Rem.</div><div class="ms-val ${Utils.rlClass(activeItem.a.rl ?? Infinity)}">${activeItem.a.rl !== null && isFinite(activeItem.a.rl) ? activeItem.a.rl.toFixed(1)+' a' : (activeItem.a.insufficient ? '—' : '∞')}</div></div>
            </div>
            <div id="corrosion-interactive" class="card mb-2"></div>
            ${activeItem.a.nextInsp ? `<div class="text-xs text-muted"><strong>Próxima inspección (${Utils.escHtml(activeItem.a.nextInsp.norma)}):</strong> ${Utils.vencimientoBadge(activeItem.a.nextInsp.proxima_fecha)} · ${Utils.escHtml(activeItem.a.nextInsp.criterio_gobernante)}</div>` : ''}
          </div>
        </div>
      </div>`;

    // Bind live SVG wall section inside the selected point card
    _bindRealCorrosionVisual(area, activeItem.cml, activeItem.eq, activeItem.a);

    // Clicking any graphic pin / bar / row selects that CML and refreshes the graphical dashboard
    area.querySelectorAll('[data-select-cml]').forEach(node => {
      node.addEventListener('click', () => {
        selectedCmlId = node.dataset.selectCml;
        _renderGraphicalView();
      });
    });

    area.querySelector('#cml-gNewMedBtn')?.addEventListener('click', () => openMedForm(activeItem.cml.id, null));
    area.querySelector('#cml-gOpenDetBtn')?.addEventListener('click', () => {
      selectedCmlId = activeItem.cml.id;
      viewMode = 'list';
      render();
    });
  }

  /* ── Panel A: Interactive Schematic Map of CML/TML points ── */
  function _buildGraphicSchematicPanel(items, activeItem) {
    // Group items by equipment
    const byEq = new Map();
    items.forEach(it => {
      const k = it.cml.equipo_id || 'sin_eq';
      if (!byEq.has(k)) byEq.set(k, { eq: it.eq, list: [] });
      byEq.get(k).list.push(it);
    });

    const groups = [...byEq.values()];
    const multi = groups.length > 1;

    const cards = groups.map(({ eq, list }) => {
      const doc = eq ? DB.query('isometricos', d => d.equipo_id === eq.id)[0] : null;
      const pinMap = new Map((doc?.cml_pins || []).map(p => [p.cml_id, p]));
      const tipo = eq?.tipo || '';

      // Compute fallback coordinates cleanly distributed by family
      const positioned = list.map((it, idx) => {
        const saved = pinMap.get(it.cml.id);
        let x, y;
        if (saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y))) {
          x = Utils.clamp(Number(saved.x), 8, 92);
          y = Utils.clamp(Number(saved.y), 12, 88);
        } else if (tipo === 'Tanque Atmosférico') {
          x = 42 + (idx % 2) * 18;
          y = 74 - (idx / Math.max(1, list.length - 1)) * 42;
        } else if (tipo === 'Tubería a Presión') {
          x = 18 + ((idx + 0.5) / list.length) * 64;
          y = 50;
        } else {
          x = 26 + ((idx + 0.5) / list.length) * 48;
          y = 38 + (idx % 2) * 24;
        }
        return { ...it, x, y, auto: !saved };
      });

      const bgVisual = doc?.image_data
        ? `<img src="${doc.image_data}" alt="${Utils.escHtml(eq?.tag || '')}" style="width:100%;height:${multi ? 165 : 250}px;object-fit:contain;display:block;background:#f8fafc">`
        : _buildFamilyMiniSvg(eq, multi ? 165 : 250);

      const pinsHtml = positioned.map(p => {
        const isSel = p.cml.id === activeItem.cml.id;
        return `
          <button type="button" data-select-cml="${p.cml.id}"
            title="${Utils.escHtml(p.cml.nombre)} · ${p.a.last ? Number(p.a.last.espesor_mm).toFixed(2)+' mm' : 'Sin medición'} · ${Utils.escHtml(p.a.condicion)}"
            style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);
            display:inline-flex;align-items:center;gap:4px;padding:${isSel ? '4px 8px' : '3px 7px'};
            border-radius:999px;background:${p.color};color:#fff;font-size:.72rem;font-weight:700;
            border:${isSel ? '2.5px solid #0f1e35' : '1.5px solid #fff'};
            box-shadow:${isSel ? '0 0 0 4px rgba(26,111,196,.30), 0 3px 10px rgba(0,0,0,.28)' : '0 2px 6px rgba(0,0,0,.25)'};
            z-index:${isSel ? 12 : 5};cursor:pointer;white-space:nowrap">
            <span>${Utils.escHtml(p.cml.nombre)}</span>
            <span style="font-family:var(--font-mono);font-size:.66rem;opacity:.95">${p.a.last ? Number(p.a.last.espesor_mm).toFixed(1) : '—'}</span>
          </button>`;
      }).join('');

      return `
        <div style="border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;background:#fafbfc">
          <div style="padding:6px 10px;background:var(--c-surface-2);border-bottom:1px solid var(--c-border);display:flex;justify-content:space-between;align-items:center;gap:6px">
            <span class="text-xs font-bold">${Utils.escHtml(eq?.tag || 'Equipo')} · ${Utils.escHtml(eq?.tipo || '')}</span>
            <span class="text-xs text-muted">${list.length} CML${list.length > 1 ? 's' : ''}</span>
          </div>
          <div style="position:relative;width:100%;height:${multi ? 165 : 250}px;overflow:hidden">
            ${bgVisual}
            ${pinsHtml}
          </div>
        </div>`;
    }).join('');

    return `
      <div style="display:grid;grid-template-columns:${multi ? 'repeat(auto-fit,minmax(220px,1fr))' : '1fr'};gap:10px">
        ${cards}
      </div>
      <div class="text-xs text-muted mt-1" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#22a06b"></span> Normal</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e8a020"></span> Alerta</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#d93025"></span> Bajo mínimo / Vencida</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#6c7a89"></span> Info. insuficiente</span>
      </div>`;
  }

  function _buildFamilyMiniSvg(eq, heightPx) {
    const tipo = eq?.tipo || '';
    let body = '';
    if (tipo === 'Tanque Atmosférico') {
      body = `
        <rect x="140" y="54" width="220" height="162" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <polygon points="132,54 250,20 368,54" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <line x1="140" y1="108" x2="360" y2="108" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="5,4"/>
        <line x1="140" y1="162" x2="360" y2="162" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="5,4"/>
        <text x="128" y="84" font-size="10" fill="#5a6a80" text-anchor="end">V3</text>
        <text x="128" y="138" font-size="10" fill="#5a6a80" text-anchor="end">V2</text>
        <text x="128" y="192" font-size="10" fill="#5a6a80" text-anchor="end">V1</text>
        <rect x="115" y="216" width="270" height="10" rx="2" fill="#94a3b8"/>`;
    } else if (tipo === 'Tubería a Presión') {
      body = `
        <rect x="36" y="106" width="428" height="44" fill="#e8f4ff" stroke="#1a6fc4" stroke-width="2"/>
        <rect x="34" y="96" width="8" height="64" fill="#64748b"/>
        <rect x="458" y="96" width="8" height="64" fill="#64748b"/>
        <line x1="160" y1="128" x2="340" y2="128" stroke="#1a6fc4" stroke-width="1.8" stroke-dasharray="6,4"/>
        <polygon points="340,122 352,128 340,134" fill="#1a6fc4"/>
        <text x="250" y="182" font-size="11" fill="#5a6a80" text-anchor="middle">Circuito ${Utils.escHtml(eq?.circuito_inspeccion || eq?.tag || '')} · Sentido de flujo →</text>`;
    } else {
      body = `
        <rect x="96" y="64" width="308" height="122" rx="10" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <ellipse cx="96" cy="125" rx="22" ry="61" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <ellipse cx="404" cy="125" rx="22" ry="61" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <rect x="226" y="38" width="48" height="26" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <rect x="226" y="186" width="48" height="24" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <rect x="142" y="186" width="32" height="34" fill="#cbd5e1" stroke="#64748b"/>
        <rect x="326" y="186" width="32" height="34" fill="#cbd5e1" stroke="#64748b"/>`;
    }
    return `<svg viewBox="0 0 500 250" width="100%" height="${heightPx}" preserveAspectRatio="xMidYMid meet" style="display:block;background:#f8fafc">${body}</svg>`;
  }

  /* ── Panel B: Comparative Thickness Bar Chart per CML ────── */
  function _buildGraphicThicknessBars(items, activeId) {
    const rowH = 34;
    const W = 520, H = Math.max(120, items.length * rowH + 34);
    const leftX = 112, rightPad = 118;
    const barMaxW = W - leftX - rightPad;

    const maxT = Math.max(
      ...items.map(i => Math.max(
        i.a.t_nom || 0,
        i.a.last ? Number(i.a.last.espesor_mm) : 0,
        i.a.t_alerta || 0,
        i.a.t_min || 0
      )),
      5
    ) * 1.08;

    const xS = v => leftX + (Utils.clamp(v, 0, maxT) / maxT) * barMaxW;

    const rowsSvg = items.map((it, idx) => {
      const y = idx * rowH + 14;
      const isSel = it.cml.id === activeId;
      const tNom = it.a.t_nom || 0;
      const tMed = it.a.last ? Number(it.a.last.espesor_mm) : null;
      const tAl  = it.a.t_alerta;
      const tMin = it.a.t_min;
      const margin = (tMed !== null && tMin !== null) ? (tMed - tMin) : null;

      return `
        <g data-select-cml="${it.cml.id}" style="cursor:pointer">
          ${isSel ? `<rect x="2" y="${y - 4}" width="${W - 4}" height="${rowH - 4}" rx="6" fill="#1a6fc414" stroke="#1a6fc4" stroke-width="1"/>` : ''}
          <text x="${leftX - 8}" y="${y + 11}" text-anchor="end" font-size="10" font-weight="700" fill="${isSel ? '#1a6fc4' : '#1a2235'}">${Utils.escHtml(it.cml.nombre)}</text>
          <text x="${leftX - 8}" y="${y + 22}" text-anchor="end" font-size="8" fill="#64748b">${Utils.escHtml(it.eq?.tag || '')}</text>
          ${tNom > 0 ? `<rect x="${leftX}" y="${y + 3}" width="${Math.max(2, xS(tNom) - leftX)}" height="18" rx="4" fill="#e2e8f0" stroke="#cbd5e1" stroke-width=".8"/>` : ''}
          ${tMed !== null ? `<rect x="${leftX}" y="${y + 3}" width="${Math.max(2, xS(tMed) - leftX)}" height="18" rx="4" fill="${it.color}" opacity=".9"/>` : ''}
          ${tAl !== null ? `<line x1="${xS(tAl)}" y1="${y + 1}" x2="${xS(tAl)}" y2="${y + 23}" stroke="#e8a020" stroke-width="2"/>` : ''}
          ${tMin !== null ? `<line x1="${xS(tMin)}" y1="${y + 1}" x2="${xS(tMin)}" y2="${y + 23}" stroke="#d93025" stroke-width="2.2"/>` : ''}
          <text x="${W - rightPad + 8}" y="${y + 12}" font-size="9.5" font-weight="700" font-family="Consolas,monospace" fill="${it.color}">${tMed !== null ? tMed.toFixed(2)+' mm' : 'Sin lect.'}</text>
          <text x="${W - rightPad + 8}" y="${y + 23}" font-size="8" fill="${margin !== null && margin < 0 ? '#d93025' : '#64748b'}">${margin !== null ? `Δmín: ${margin >= 0 ? '+' : ''}${margin.toFixed(2)}` : (tNom ? `nom: ${tNom.toFixed(1)}` : '—')}</text>
        </g>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;display:block">
        ${[0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = f * maxT;
          const x = xS(v);
          return `<line x1="${x}" y1="6" x2="${x}" y2="${H - 20}" stroke="var(--c-border)" stroke-width=".6"/>
            <text x="${x}" y="${H - 6}" font-size="8.5" text-anchor="middle" fill="#64748b">${v.toFixed(1)}</text>`;
        }).join('')}
        ${rowsSvg}
      </svg>
      <div class="text-xs text-muted mt-1" style="display:flex;gap:12px;flex-wrap:wrap">
        <span>⬜ Barra gris: t<sub>nom</sub></span>
        <span>🟩🟧🟥 Barra color: t<sub>med</sub></span>
        <span style="color:#e8a020">┃ t<sub>alerta</sub></span>
        <span style="color:#d93025">┃ t<sub>mín</sub></span>
      </div>`;
  }

  /* ── Panel C1: Corrosion Rates Comparison (ST vs LT vs Adopted) ── */
  function _buildGraphicCorrosionRates(items, activeId) {
    const rowH = 34;
    const W = 500, H = Math.max(120, items.length * rowH + 34);
    const leftX = 104, rightPad = 92;
    const barMaxW = W - leftX - rightPad;

    const maxCR = Math.max(
      ...items.map(i => Math.max(
        i.a.cr_st !== null && i.a.cr_st > 0 ? i.a.cr_st : 0,
        i.a.cr_lt !== null && i.a.cr_lt > 0 ? i.a.cr_lt : 0,
        !i.a.insufficient && i.a.cr_adoptada > 0 ? i.a.cr_adoptada : 0
      )),
      0.5
    ) * 1.15;

    const xS = v => leftX + (Utils.clamp(Math.max(0, v), 0, maxCR) / maxCR) * barMaxW;

    const rowsSvg = items.map((it, idx) => {
      const y = idx * rowH + 14;
      const isSel = it.cml.id === activeId;
      const st = it.a.cr_st;
      const lt = it.a.cr_lt;
      const ad = !it.a.insufficient ? it.a.cr_adoptada : null;
      const adColor = ad === null ? '#6c7a89' : ad >= 0.5 ? '#d93025' : ad >= 0.25 ? '#e8a020' : '#22a06b';

      return `
        <g data-select-cml="${it.cml.id}" style="cursor:pointer">
          ${isSel ? `<rect x="2" y="${y - 4}" width="${W - 4}" height="${rowH - 4}" rx="6" fill="#1a6fc414" stroke="#1a6fc4" stroke-width="1"/>` : ''}
          <text x="${leftX - 8}" y="${y + 11}" text-anchor="end" font-size="10" font-weight="700" fill="${isSel ? '#1a6fc4' : '#1a2235'}">${Utils.escHtml(it.cml.nombre)}</text>
          <text x="${leftX - 8}" y="${y + 22}" text-anchor="end" font-size="8" fill="#64748b">${Utils.escHtml(it.eq?.tag || '')}</text>
          ${st !== null && st > 0 ? `<rect x="${leftX}" y="${y + 2}" width="${Math.max(2, xS(st) - leftX)}" height="8" rx="3" fill="#2d87e0"/>` : ''}
          ${lt !== null && lt > 0 ? `<rect x="${leftX}" y="${y + 13}" width="${Math.max(2, xS(lt) - leftX)}" height="8" rx="3" fill="#64748b"/>` : ''}
          ${ad !== null && ad > 0 ? `<circle cx="${xS(ad)}" cy="${y + 11.5}" r="4.5" fill="${adColor}" stroke="#fff" stroke-width="1.5"/>` : ''}
          <text x="${W - rightPad + 8}" y="${y + 11}" font-size="9.2" font-weight="700" font-family="Consolas,monospace" fill="${adColor}">${ad !== null ? ad.toFixed(3)+' mm/a' : 'Insuf.'}</text>
          <text x="${W - rightPad + 8}" y="${y + 22}" font-size="7.8" fill="#64748b">${st !== null ? `ST:${st.toFixed(2)}` : 'ST:—'} ${lt !== null ? `LT:${lt.toFixed(2)}` : ''}</text>
        </g>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;display:block">
        ${[0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = f * maxCR;
          const x = xS(v);
          return `<line x1="${x}" y1="6" x2="${x}" y2="${H - 20}" stroke="var(--c-border)" stroke-width=".6"/>
            <text x="${x}" y="${H - 6}" font-size="8.5" text-anchor="middle" fill="#64748b">${v.toFixed(2)}</text>`;
        }).join('')}
        ${rowsSvg}
      </svg>
      <div class="text-xs text-muted mt-1" style="display:flex;gap:12px;flex-wrap:wrap">
        <span style="color:#2d87e0">▬ CR Corto Plazo (ST)</span>
        <span style="color:#64748b">▬ CR Largo Plazo (LT)</span>
        <span>● CR Adoptada (máx ST/LT)</span>
      </div>`;
  }

  /* ── Panel C2: Remaining Life (RL) Comparison Chart ──────── */
  function _buildGraphicRemainingLife(items, activeId) {
    const rowH = 34;
    const W = 500, H = Math.max(120, items.length * rowH + 34);
    const leftX = 104, rightPad = 92;
    const barMaxW = W - leftX - rightPad;
    const capYr = 20;
    const xS = v => leftX + (Utils.clamp(v, 0, capYr) / capYr) * barMaxW;

    const rowsSvg = items.map((it, idx) => {
      const y = idx * rowH + 14;
      const isSel = it.cml.id === activeId;
      const rl = it.a.rl;
      const ins = it.a.insufficient;
      const isInf = !ins && (rl === null || !isFinite(rl));
      const rlVal = ins ? 0 : isInf ? capYr : Math.max(0, rl);
      const col = ins ? '#6c7a89' : rlVal < 2 ? '#d93025' : rlVal < 5 ? '#e8a020' : '#22a06b';
      const lbl = ins ? 'Insuf.' : isInf ? '>20 a (∞)' : rl < 0 ? '0.0 a (Bajo mín)' : `${rl.toFixed(1)} a`;

      return `
        <g data-select-cml="${it.cml.id}" style="cursor:pointer">
          ${isSel ? `<rect x="2" y="${y - 4}" width="${W - 4}" height="${rowH - 4}" rx="6" fill="#1a6fc414" stroke="#1a6fc4" stroke-width="1"/>` : ''}
          <text x="${leftX - 8}" y="${y + 11}" text-anchor="end" font-size="10" font-weight="700" fill="${isSel ? '#1a6fc4' : '#1a2235'}">${Utils.escHtml(it.cml.nombre)}</text>
          <text x="${leftX - 8}" y="${y + 22}" text-anchor="end" font-size="8" fill="#64748b">${Utils.escHtml(it.eq?.tag || '')}</text>
          <rect x="${leftX}" y="${y + 4}" width="${Math.max(ins ? 0 : 4, xS(rlVal) - leftX)}" height="16" rx="4" fill="${col}" opacity="${isInf ? '.45' : '.88'}"/>
          <text x="${W - rightPad + 8}" y="${y + 12}" font-size="9.2" font-weight="700" font-family="Consolas,monospace" fill="${col}">${lbl}</text>
          <text x="${W - rightPad + 8}" y="${y + 23}" font-size="7.8" fill="#64748b">${it.a.nextInsp?.proxima_fecha ? Utils.fmtDate(it.a.nextInsp.proxima_fecha) : '—'}</text>
        </g>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;display:block">
        <!-- Franjas de criticidad -->
        <rect x="${leftX}" y="6" width="${xS(2) - leftX}" height="${H - 26}" fill="#d9302510"/>
        <rect x="${xS(2)}" y="6" width="${xS(5) - xS(2)}" height="${H - 26}" fill="#e8a02010"/>
        <rect x="${xS(5)}" y="6" width="${xS(capYr) - xS(5)}" height="${H - 26}" fill="#22a06b08"/>
        ${[0, 2, 5, 10, 15, 20].map(yr => {
          const x = xS(yr);
          return `<line x1="${x}" y1="6" x2="${x}" y2="${H - 20}" stroke="${yr===2?'#d93025':yr===5?'#e8a020':'var(--c-border)'}" stroke-width="${yr===2||yr===5?'1.2':'.6'}" ${yr===2||yr===5?'stroke-dasharray="3,2"':''}/>
            <text x="${x}" y="${H - 6}" font-size="8.5" text-anchor="middle" fill="#64748b">${yr === 20 ? '20+ a' : yr + ' a'}</text>`;
        }).join('')}
        ${rowsSvg}
      </svg>
      <div class="text-xs text-muted mt-1" style="display:flex;gap:12px;flex-wrap:wrap">
        <span style="color:#d93025">■ Crítico (&lt;2 años)</span>
        <span style="color:#e8a020">■ Precaución (2–5 años)</span>
        <span style="color:#22a06b">■ Seguro (&gt;5 años)</span>
        <span>Escala acotada a 20 años</span>
      </div>`;
  }

  /* ── Panel D: Multi-CML Overlaid Trend Chart ─────────────── */
  function _buildMultiCmlTrendChart(items, singleEquipment) {
    const withMeds = items.filter(i => i.a.allMeds.length > 0);
    if (withMeds.length === 0) {
      return `<div class="empty-state" style="padding:20px"><p>No hay mediciones registradas en los CML seleccionados.</p></div>`;
    }

    const palette = ['#1a6fc4', '#d93025', '#22a06b', '#e8a020', '#7c3aed', '#0891b2', '#be185d', '#475569'];
    const W = 540, H = 220, PAD = { t: 18, b: 34, l: 48, r: 22 };
    const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

    const allDates = [];
    const allY = [];
    withMeds.forEach(it => {
      it.a.allMeds.forEach(m => {
        allDates.push(new Date(m.fecha).getTime());
        const val = singleEquipment
          ? Number(m.espesor_mm)
          : (it.a.t_nom ? (Number(m.espesor_mm) / it.a.t_nom) * 100 : 100);
        allY.push(val);
      });
    });

    const tMinX = Math.min(...allDates);
    let tMaxX = Math.max(...allDates);
    if (tMaxX === tMinX) tMaxX = tMinX + 365.25 * 24 * 3600 * 1000;

    const eqRef = singleEquipment ? withMeds[0].a : null;
    if (singleEquipment && eqRef) {
      if (eqRef.t_nom !== null) allY.push(eqRef.t_nom);
      if (eqRef.t_alerta !== null) allY.push(eqRef.t_alerta);
      if (eqRef.t_min !== null) allY.push(eqRef.t_min);
    } else {
      allY.push(100, 50);
    }

    const yMin = singleEquipment ? Math.max(0, Math.min(...allY) * 0.88) : Math.max(0, Math.min(...allY) - 8);
    const yMax = singleEquipment ? Math.max(...allY) * 1.07 : Math.max(105, Math.max(...allY) + 5);

    const xS = d => PAD.l + ((d - tMinX) / (tMaxX - tMinX || 1)) * iW;
    const yS = v => PAD.t + iH - ((v - yMin) / (yMax - yMin || 1)) * iH;

    const seriesSvg = withMeds.map((it, idx) => {
      const col = palette[idx % palette.length];
      const pts = it.a.allMeds.map(m => {
        const yv = singleEquipment
          ? Number(m.espesor_mm)
          : (it.a.t_nom ? (Number(m.espesor_mm) / it.a.t_nom) * 100 : 100);
        return { x: xS(new Date(m.fecha).getTime()), y: yS(yv), raw: yv, m };
      });
      const poly = pts.length >= 2
        ? `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${it.cml.id === selectedCmlId ? 2.8 : 1.9}" opacity="${it.cml.id === selectedCmlId ? 1 : 0.8}"/>`
        : '';
      const dots = pts.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="${it.cml.id === selectedCmlId ? 4.5 : 3.5}" fill="${col}" stroke="#fff" stroke-width="1.3" data-select-cml="${it.cml.id}" style="cursor:pointer">
          <title>${Utils.escHtml(it.cml.nombre)} (${Utils.escHtml(it.eq?.tag || '')}) · ${p.m.fecha}: ${Number(p.m.espesor_mm).toFixed(2)} mm${!singleEquipment ? ` (${p.raw.toFixed(1)}% nom.)` : ''}</title>
        </circle>`).join('');
      return poly + dots;
    }).join('');

    let refLines = '';
    if (singleEquipment && eqRef) {
      const addH = (val, color, lbl, dash) => {
        if (val === null || val === undefined) return '';
        const y = yS(val);
        return `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="${color}" stroke-width="1.2" stroke-dasharray="${dash}"/>
          <text x="${W - PAD.r - 2}" y="${y - 3}" font-size="8.5" font-weight="700" fill="${color}" text-anchor="end">${lbl} (${val.toFixed(2)})</text>`;
      };
      refLines = addH(eqRef.t_nom, '#5a6a80', 't_nom', '2,3')
        + addH(eqRef.t_alerta, '#e8a020', 't_alerta', '4,3')
        + addH(eqRef.t_min, '#d93025', 't_mín', '5,3');
    }

    const fmtD = ms => new Date(ms).toLocaleDateString('es-ES', { month: '2-digit', year: '2-digit' });
    const legendHtml = withMeds.map((it, idx) => {
      const col = palette[idx % palette.length];
      const isSel = it.cml.id === selectedCmlId;
      return `<button type="button" data-select-cml="${it.cml.id}" style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;border:1px solid ${isSel ? col : 'var(--c-border)'};background:${isSel ? col+'18' : 'var(--c-surface-2)'};font-size:.74rem;font-weight:${isSel ? 700 : 500};cursor:pointer">
        <span style="width:9px;height:9px;border-radius:50%;background:${col}"></span>
        ${Utils.escHtml(it.cml.nombre)}${!singleEquipment ? ` (${Utils.escHtml(it.eq?.tag || '')})` : ''}
      </button>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;display:block">
        ${[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = PAD.t + f * iH;
          const v = yMax - f * (yMax - yMin);
          return `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="var(--c-border)" stroke-width=".6"/>
            <text x="${PAD.l - 6}" y="${y + 3}" font-size="8.5" text-anchor="end" fill="#64748b">${singleEquipment ? v.toFixed(1) : v.toFixed(0)+'%'}</text>`;
        }).join('')}
        ${refLines}
        ${seriesSvg}
        <text x="${PAD.l}" y="${H - 8}" font-size="8.5" fill="#64748b">${fmtD(tMinX)}</text>
        <text x="${PAD.l + iW / 2}" y="${H - 8}" font-size="8.5" text-anchor="middle" fill="#64748b">${fmtD((tMinX + tMaxX) / 2)}</text>
        <text x="${W - PAD.r}" y="${H - 8}" font-size="8.5" text-anchor="end" fill="#64748b">${fmtD(tMaxX)}</text>
        <text x="12" y="${H / 2}" font-size="8.5" fill="#64748b" transform="rotate(-90 12 ${H / 2})">${singleEquipment ? 'Espesor (mm)' : '% Esp. nominal'}</text>
      </svg>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${legendHtml}</div>`;
  }

  /* ── CML Form ───────────────────────────────────────────── */
  function openCmlForm(cmlId) {
    const cml = cmlId ? DB.getById('cmls', cmlId) : null;
    const title = cml ? `✏️ Editar CML – ${cml.nombre}` : '＋ Nuevo CML / TML';
    const equipoOpts = DB.getAll('equipos').sort((a, b) => a.tag.localeCompare(b.tag))
      .map(e => `<option value="${e.id}" ${(cml?.equipo_id === e.id || (!cml && selectedEquipoId === e.id)) ? 'selected' : ''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
      .join('');
    const v = (f, d = '') => Utils.escHtml(cml ? (cml[f] ?? d) : d);

    Utils.openModal(title, `
      <form id="cml-form">
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Equipo<span class="required">*</span></label>
            <select class="form-control" id="cf_eq">${equipoOpts}</select>
          </div>
          <div class="form-group">
            <label>Código CML / TML<span class="required">*</span></label>
            <input class="form-control" id="cf_nombre" value="${v('nombre')}" placeholder="p.ej. CML-V1, CML-P1, CML-T1">
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Componente<span class="required">*</span></label>
            <input class="form-control" id="cf_comp" value="${v('componente')}" placeholder="p.ej. Envolvente cilíndrica / Tramo recto / Virola 1">
          </div>
          <div class="form-group">
            <label>Ubicación física</label>
            <input class="form-control" id="cf_ubic" value="${v('ubicacion')}" placeholder="p.ej. Elev. +2.5 m / 180° Sur / Km 0+15">
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Descripción</label>
            <input class="form-control" id="cf_desc" value="${v('descripcion')}" placeholder="Zona de monitoreo y mecanismo esperado">
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select class="form-control" id="cf_activo">
              <option value="true"  ${cml?.activo !== false ? 'selected' : ''}>Activo</option>
              <option value="false" ${cml?.activo === false ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Convención de nomenclatura aplicada</label>
          <input class="form-control" id="cf_conv" value="${v('convencion', 'CML-[Familia][#]: V=Vasija, P=Tubería, T=Tanque; posición horaria 0°=Norte.')}">
        </div>
      </form>`, {
      size: 'modal-lg',
      footerHtml: `<button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
                   <button class="btn btn-primary" id="cml-saveBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      document.getElementById('cml-saveBtn').addEventListener('click', () => {
        const nombre = document.getElementById('cf_nombre')?.value?.trim();
        const eq_id  = document.getElementById('cf_eq')?.value;
        if (!nombre || !eq_id) { Utils.toast('Requerido', 'Complete Equipo y Código CML.', 'error'); return; }
        const data = {
          equipo_id:   eq_id,
          nombre,
          componente:  document.getElementById('cf_comp')?.value?.trim() || '',
          descripcion: document.getElementById('cf_desc')?.value?.trim() || '',
          ubicacion:   document.getElementById('cf_ubic')?.value?.trim() || '',
          convencion:  document.getElementById('cf_conv')?.value?.trim() || '',
          activo:      document.getElementById('cf_activo')?.value === 'true',
        };
        if (cmlId) { DB.update('cmls', cmlId, data); Utils.toast('Actualizado', 'CML actualizado.', 'success'); }
        else { const rec = DB.insert('cmls', data); selectedCmlId = rec.id; Utils.toast('Creado', 'CML creado.', 'success'); }
        Utils.closeModal();
        selectedEquipoId = data.equipo_id;
        render();
      });
    }, 50);
  }

  function deleteCml(cmlId) {
    const cml = DB.getById('cmls', cmlId);
    if (!cml) return;
    Utils.confirm(`¿Eliminar CML "${cml.nombre}" y todas sus mediciones?`, () => {
      DB.query('mediciones', m => m.cml_id === cmlId).forEach(m => DB.remove('mediciones', m.id));
      DB.remove('cmls', cmlId);
      if (selectedCmlId === cmlId) selectedCmlId = null;
      if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
      Utils.toast('Eliminado', 'CML y mediciones eliminados.', 'warning');
      render();
    });
  }

  /* ── Measurement Form (with Unit + Event type + live preview) ── */
  function openMedForm(cmlId, medId) {
    const cml = DB.getById('cmls', cmlId);
    const med = medId ? DB.getById('mediciones', medId) : null;
    const eq  = cml ? DB.getById('equipos', cml.equipo_id) : null;
    const title = med ? '✏️ Editar Medición' : '＋ Nueva Medición de Espesor';
    const v = (f, d = '') => Utils.escHtml(med ? (med[f] ?? d) : d);

    Utils.openModal(title, `
      <form id="med-form">
        <div class="alert alert-info mb-2">
          <span class="alert-icon">📍</span>
          <div>
            <strong>${Utils.escHtml(cml?.nombre || cmlId)}</strong> – ${Utils.escHtml(cml?.componente || cml?.descripcion || '')}
            ${eq ? `<br><span class="text-xs">Equipo: ${eq.tag} · t_nom: ${eq.espesor_nominal_mm ?? '—'} mm · t_mín: ${eq.espesor_minimo_mm ?? '—'} mm</span>` : ''}
          </div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label>Fecha<span class="required">*</span></label>
            <input type="date" class="form-control" id="mf_fecha" value="${v('fecha', Utils.today())}" required>
          </div>
          <div class="form-group">
            <label>Espesor medido<span class="required">*</span></label>
            <input type="number" class="form-control" id="mf_esp" value="${v('valor_original', v('espesor_mm'))}" min="0.01" step="0.01" required>
          </div>
          <div class="form-group">
            <label>Unidad<span class="required">*</span></label>
            <select class="form-control" id="mf_unidad">
              <option value="mm" ${(!med || med.unidad === 'mm') ? 'selected' : ''}>mm (milímetros)</option>
              <option value="in" ${med?.unidad === 'in' ? 'selected' : ''}>in (pulgadas → conv. auto a mm)</option>
            </select>
          </div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label>Técnica de inspección</label>
            <select class="form-control" id="mf_metodo">
              ${['UT-A (Convencional)','UT-B (B-Scan)','UT-C (C-Scan)','UT-TOFD','Radiografía perfil','MFL','Calibrador/Galga'].map(m =>
                `<option ${med?.metodo === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de evento</label>
            <select class="form-control" id="mf_evento">
              ${['Normal','Cambio de punto','Reparación','Reemplazo'].map(ev =>
                `<option ${(med?.evento || 'Normal') === ev ? 'selected' : ''}>${ev}</option>`).join('')}
            </select>
            <div class="form-hint">Reparación/Reemplazo/Cambio reinicia la serie comparable.</div>
          </div>
          <div class="form-group">
            <label>Inspector</label>
            <input class="form-control" id="mf_tec" value="${v('tecnico')}" placeholder="Nombre inspector">
          </div>
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <textarea class="form-control" id="mf_notas" rows="2">${v('notas')}</textarea>
        </div>
        <div id="mf_preview" style="display:none" class="result-box mt-2">
          <h3>Vista previa en tiempo real</h3>
          <div class="result-grid" id="mf_previewVals"></div>
        </div>
      </form>`, {
      size: 'modal-lg',
      footerHtml: `<button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
                   <button class="btn btn-primary" id="med-saveBtn">💾 Guardar Medición</button>`
    });

    setTimeout(() => {
      const updatePreview = () => {
        if (!eq) return;
        const val = parseFloat(document.getElementById('mf_esp')?.value);
        const unit = document.getElementById('mf_unidad')?.value || 'mm';
        if (isNaN(val) || val <= 0) return;
        const tact = unit === 'in' ? val * 25.4 : val;
        const tmin = eq.espesor_minimo_mm;
        const preview = document.getElementById('mf_preview');
        const pv = document.getElementById('mf_previewVals');
        if (!preview || !pv) return;
        preview.style.display = 'block';
        const margin = tmin ? tact - tmin : null;
        pv.innerHTML = `
          <div class="result-item"><label>Espesor normalizado</label><span class="val">${tact.toFixed(2)}</span><span class="unit">mm</span></div>
          ${margin !== null ? `<div class="result-item"><label>Margen sobre t_mín</label>
            <span class="val" style="color:${margin<0?'#ff7070':margin<1.5?'#f0c060':'#4de0a4'}">${margin.toFixed(2)}</span><span class="unit">mm</span></div>` : ''}`;
      };
      document.getElementById('mf_esp')?.addEventListener('input', updatePreview);
      document.getElementById('mf_unidad')?.addEventListener('change', updatePreview);

      document.getElementById('med-saveBtn').addEventListener('click', () => {
        const fecha  = document.getElementById('mf_fecha')?.value;
        const rawVal = parseFloat(document.getElementById('mf_esp')?.value);
        const unidad = document.getElementById('mf_unidad')?.value || 'mm';
        if (!fecha || isNaN(rawVal) || rawVal <= 0) {
          Utils.toast('Requerido', 'Ingrese una fecha y un espesor positivo.', 'error'); return;
        }
        const esp_mm = unidad === 'in' ? Utils.round(rawVal * 25.4, 3) : rawVal;
        const data = {
          cml_id:         cmlId,
          equipo_id:      cml?.equipo_id,
          fecha,
          espesor_mm:     esp_mm,
          valor_original: rawVal,
          unidad,
          metodo:         document.getElementById('mf_metodo')?.value || 'UT-A (Convencional)',
          evento:         document.getElementById('mf_evento')?.value || 'Normal',
          tecnico:        document.getElementById('mf_tec')?.value?.trim() || '',
          notas:          document.getElementById('mf_notas')?.value?.trim() || '',
        };
        if (medId) { DB.update('mediciones', medId, data); Utils.toast('Actualizado', 'Medición actualizada y evaluación recalculada.', 'success'); }
        else       { DB.insert('mediciones', data);        Utils.toast('Guardado', 'Medición registrada; tasas y próxima inspección actualizadas.', 'success'); }

        if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
        Utils.closeModal();
        selectedCmlId = cmlId;
        render();
        if (viewMode === 'list') setTimeout(() => _renderCmlDetail(cmlId), 80);
      });
    }, 50);
  }

  function deleteMedicion(medId, cmlId) {
    Utils.confirm('¿Eliminar esta medición?', () => {
      DB.remove('mediciones', medId);
      if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
      Utils.toast('Eliminado', 'Medición eliminada.', 'warning');
      if (viewMode === 'graphic') {
        _renderGraphicalView();
      } else {
        _renderCmlDetail(cmlId);
        _renderCmlList();
      }
    });
  }

  function openNewMeasurement() {
    const cml = (selectedCmlId && DB.getById('cmls', selectedCmlId)) || DB.getAll('cmls').find(c => c.activo !== false);
    if (!cml) { openCmlForm(null); return; }
    openMedForm(cml.id, null);
  }

  function _openConventionModal() {
    Utils.openModal('📖 Convención de Nomenclatura CML / TML', `
      <div class="form-section">
        <div class="form-section-title">Estructura del código</div>
        <p class="text-sm"><strong>CML-[Familia][Número]</strong></p>
        <ul style="list-style:disc;margin:8px 0 0 18px;font-size:.86rem;line-height:1.6">
          <li><strong>V#</strong>: Recipientes a presión (ASME VIII Div.1 / API 510) — ubicaciones sobre envolvente cilíndrica por elevación y orientación horaria (0° Norte, 90° Este, 180° Sur, 270° Oeste).</li>
          <li><strong>P#</strong>: Tuberías de proceso (ASME B31.3 / API 570) — ubicaciones en circuito de inspección por kilometraje/isométrico y generatriz horaria en dirección del flujo (6 h / 180° inferior).</li>
          <li><strong>T#</strong>: Tanques atmosféricos (API 650 / API 653) — numeración ascendente sobre virolas del manto (Virola 1 base → Virola 3 superior).</li>
        </ul>
      </div>
      <div class="form-section">
        <div class="form-section-title">Eventos que reinician la serie comparable</div>
        <p class="text-sm">Cuando se registra un <strong>Cambio de punto</strong>, <strong>Reparación</strong> o <strong>Reemplazo</strong>, el sistema conserva el historial previo pero calcula las velocidades de corto y largo plazo únicamente desde ese evento en adelante para evitar tasas erróneas o negativas artificiales.</p>
      </div>`, { size: 'modal-md' });
  }

  function _bindEvents(el) {
    el.querySelector('#cml-modeListBtn')?.addEventListener('click', () => {
      if (viewMode === 'list') return;
      viewMode = 'list';
      render();
    });
    el.querySelector('#cml-modeGraphBtn')?.addEventListener('click', () => {
      if (viewMode === 'graphic') return;
      viewMode = 'graphic';
      render();
    });
    el.querySelector('#cml-eqSel').addEventListener('change', e => {
      selectedEquipoId = e.target.value || null;
      selectedCmlId = null;
      render();
    });
    el.querySelector('#cml-newCmlBtn').addEventListener('click', () => openCmlForm(null));
    el.querySelector('#cml-convBtn').addEventListener('click', _openConventionModal);
    el.querySelector('#cml-goIsoBtn')?.addEventListener('click', () => window.App?.navigate('isometricos', selectedEquipoId));
    const deb = Utils.debounce(() => _applyEquipoSel());
    el.querySelector('#cml-search').addEventListener('input', e => { searchTerm = e.target.value; deb(); });
    el.querySelector('#cml-exportBtn').addEventListener('click', () => {
      const all = DB.getAll('cmls');
      const headers = ['CML_ID','Equipo_TAG','Nombre','Componente','Ubicación','Últ_Esp_mm','CR_ST_mmpa','CR_LT_mmpa','CR_Adoptada_mmpa','Vida_Rem_a','Condición','Próx_Insp'];
      const rows = all.map(c => {
        const eq = DB.getById('equipos', c.equipo_id);
        const a  = DB.analyzeCML(c.id, eq);
        return [c.id, eq?.tag||'', c.nombre, c.componente||'', c.ubicacion||'',
          a.last?.espesor_mm ?? '', a.cr_st!==null?a.cr_st.toFixed(4):'', a.cr_lt!==null?a.cr_lt.toFixed(4):'',
          !a.insufficient&&a.cr_adoptada!==null?a.cr_adoptada.toFixed(4):'',
          a.rl!==null&&isFinite(a.rl)?a.rl.toFixed(2):'', a.condicion, a.nextInsp?.proxima_fecha || ''];
      });
      Utils.exportCSV(headers, rows, `cml_tml_${Utils.today()}.csv`);
    });
  }

  return { render, openNewMeasurement };
})();
