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
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="cml-convBtn">📖 Convención CML</button>
          <button class="btn btn-secondary btn-sm" id="cml-exportBtn">⬇ CSV</button>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-body" style="padding:14px 20px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <label style="margin:0;white-space:nowrap;font-weight:600">Equipo:</label>
            <select class="form-control" id="cml-eqSel" style="max-width:440px">${_equipoOptions()}</select>
            <button class="btn btn-primary btn-sm" id="cml-newCmlBtn">＋ Nuevo CML</button>
            ${selectedEquipoId ? `<button class="btn btn-secondary btn-sm" id="cml-goIsoBtn">📐 Ver Esquema</button>` : ''}
          </div>
        </div>
      </div>

      <div class="grid-2" id="cml-mainGrid" style="align-items:start">
        <div>
          <div class="filter-bar" style="margin-bottom:12px">
            <div class="search-input flex-1">
              <input type="text" id="cml-search" placeholder="Buscar CML, componente, ubicación…" value="${Utils.escHtml(searchTerm)}">
            </div>
          </div>
          <div id="cml-listArea"></div>
        </div>
        <div id="cml-detailArea">
          <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:32px">
            <div class="empty-icon">📍</div>
            <h3>Seleccione un CML</h3>
            <p>Haga clic en un punto de monitoreo para ver tasas corto/largo plazo, tendencia y próxima inspección.</p>
          </div>
        </div>
      </div>`;

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

  function _applyEquipoSel() {
    _renderCmlList();
    if (selectedCmlId && DB.getById('cmls', selectedCmlId)) {
      _renderCmlDetail(selectedCmlId);
    }
  }

  /* ── CML List ───────────────────────────────────────────── */
  function _renderCmlList() {
    let cmls = selectedEquipoId
      ? DB.query('cmls', c => c.equipo_id === selectedEquipoId)
      : DB.getAll('cmls');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      cmls = cmls.filter(c =>
        [c.nombre, c.componente, c.descripcion, c.ubicacion]
          .some(v => (v || '').toLowerCase().includes(q))
      );
    }

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

  /* ── Real-data dimensional wall visualization (NO mocked values) ── */
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
    let projYears = 0;

    function draw() {
      const tProj = Math.max(0, actual0 - rate * projYears);
      const lossPct = Utils.clamp(((nominal - tProj) / nominal) * 100, 0, 100);
      const margin  = tProj - minimum;
      const color   = tProj < minimum ? '#d93025' : tProj <= alertT ? '#e8a020' : '#22a06b';
      const label   = tProj < minimum ? 'Bajo mínimo' : tProj <= alertT ? 'Alerta' : 'Normal';

      host.innerHTML = `
        <div class="card-header" style="padding:10px 14px">
          <h3 style="font-size:.9rem">🔎 Perfil de Pared Real – ${Utils.escHtml(cml.nombre)}</h3>
          <span class="badge" style="background:${color}18;color:${color};border:1px solid ${color}">${label}</span>
        </div>
        <div class="card-body" style="padding:14px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
            <span class="text-xs font-bold">Proyección lineal (+${projYears} años · CR=${rate.toFixed(3)} mm/a):</span>
            <input id="d-proj" type="range" min="0" max="15" step="1" value="${projYears}" style="flex:1;min-width:160px">
          </div>
          <div style="height:20px;border-radius:10px;background:#e6edf3;position:relative;overflow:hidden">
            <div style="position:absolute;left:${Utils.clamp((minimum/nominal)*100,0,100)}%;top:0;bottom:0;width:2px;background:#d93025;z-index:3" title="t_mín"></div>
            <div style="position:absolute;left:${Utils.clamp((alertT/nominal)*100,0,100)}%;top:0;bottom:0;width:2px;background:#e8a020;z-index:2" title="t_alerta"></div>
            <div style="width:${Utils.clamp((tProj/nominal)*100,0,100)}%;height:100%;background:${color};transition:width .2s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.74rem;margin-top:6px;flex-wrap:wrap;gap:8px">
            <span><strong>Espesor proyectado:</strong> <span class="font-mono">${tProj.toFixed(2)} mm</span> (${lossPct.toFixed(1)}% pérdida vs nominal)</span>
            <span><strong>Margen sobre t_mín:</strong> <span class="font-mono" style="color:${margin<0?'#d93025':'inherit'}">${margin>=0?'+':''}${margin.toFixed(2)} mm</span></span>
          </div>
        </div>`;

      host.querySelector('#d-proj')?.addEventListener('input', e => {
        projYears = Number(e.target.value);
        draw();
      });
    }
    draw();
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
        setTimeout(() => _renderCmlDetail(cmlId), 80);
      });
    }, 50);
  }

  function deleteMedicion(medId, cmlId) {
    Utils.confirm('¿Eliminar esta medición?', () => {
      DB.remove('mediciones', medId);
      if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
      Utils.toast('Eliminado', 'Medición eliminada.', 'warning');
      _renderCmlDetail(cmlId);
      _renderCmlList();
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
    el.querySelector('#cml-eqSel').addEventListener('change', e => {
      selectedEquipoId = e.target.value || null;
      selectedCmlId = null;
      render();
    });
    el.querySelector('#cml-newCmlBtn').addEventListener('click', () => openCmlForm(null));
    el.querySelector('#cml-convBtn').addEventListener('click', _openConventionModal);
    el.querySelector('#cml-goIsoBtn')?.addEventListener('click', () => window.App?.navigate('isometricos', selectedEquipoId));
    const deb = Utils.debounce(() => _renderCmlList());
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
