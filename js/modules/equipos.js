/**
 * SGIEE – Módulo: Registro de Equipos Estáticos y Ubicaciones Técnicas (Sección 4.1)
 * Estructura jerárquica: Planta > Área > Sistema > Equipo o Línea > Componente
 * Incluye condiciones de diseño y operación, circuito de inspección (tuberías) y recálculo en vivo de espesores.
 */
const ModEquipos = (() => {

  let searchTerm   = '';
  let filterTipo   = '';
  let filterEstado = '';
  let filterCond   = '';
  let sortKey      = 'tag';
  let sortDir      = 'asc';
  let page         = 1;
  const PAGE_SIZE  = 10;

  function render() {
    const el = document.getElementById('mod-equipos');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Registro de Equipos y Ubicaciones Técnicas</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="eq-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="eq-newBtn">＋ Nuevo Equipo</button>
        </div>
      </div>

      <div id="eq-kpis" class="mini-stat-row mb-2"></div>

      <div class="filter-bar" id="eq-filterBar">
        <div class="search-input flex-1">
          <input type="text" id="eq-search" placeholder="Buscar por TAG, planta, área, sistema, circuito, fluido…" autocomplete="off" value="${Utils.escHtml(searchTerm)}">
        </div>
        <select class="form-control" id="eq-filterTipo" style="width:180px">
          <option value="">Todas las familias</option>
          ${['Vasija a Presión','Tubería a Presión','Tanque Atmosférico','Intercambiador','Caldera / Horno','Dispositivo de Alivio']
            .map(t => `<option ${filterTipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <select class="form-control" id="eq-filterCond" style="width:190px">
          <option value="">Todas las condiciones</option>
          ${['Normal','Alerta','Espesor bajo el mínimo','Inspección vencida','Información insuficiente']
            .map(c => `<option ${filterCond===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select class="form-control" id="eq-filterEstado" style="width:140px">
          <option value="">Todos los estados</option>
          ${['Activo','Inactivo','Parado','Retirado']
            .map(s => `<option ${filterEstado===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>

      <div id="eq-tableArea"></div>
      <div id="eq-pagination"></div>`;

    _bindListEvents(el);
    _renderKPIs();
    _renderTable();
  }

  function _renderKPIs() {
    const all = DB.getAll('equipos');
    const statuses = all.map(e => DB.evaluateEquipoStatus(e.id));
    const normales = statuses.filter(s => s?.condicion === 'Normal').length;
    const alertas  = statuses.filter(s => s?.condicion === 'Alerta').length;
    const criticos = statuses.filter(s => ['Espesor bajo el mínimo','Inspección vencida'].includes(s?.condicion)).length;
    const insuf    = statuses.filter(s => s?.condicion === 'Información insuficiente').length;

    document.getElementById('eq-kpis').innerHTML = `
      <div class="mini-stat"><div class="ms-label">Total Equipos</div><div class="ms-val" style="color:var(--c-primary)">${all.length}</div></div>
      <div class="mini-stat"><div class="ms-label">Normal</div><div class="ms-val" style="color:var(--c-success)">${normales}</div></div>
      <div class="mini-stat"><div class="ms-label">En Alerta</div><div class="ms-val" style="color:var(--c-warning)">${alertas}</div></div>
      <div class="mini-stat"><div class="ms-label">Bajo Mín. / Vencida</div><div class="ms-val" style="color:var(--c-danger)">${criticos}</div></div>
      <div class="mini-stat"><div class="ms-label">Info. Insuficiente</div><div class="ms-val">${insuf}</div></div>`;
  }

  function _renderTable() {
    const all = DB.getAll('equipos');
    const enriched = all.map(e => ({ eq: e, st: DB.evaluateEquipoStatus(e.id) }));

    let rows = enriched.filter(({ eq: e, st }) => {
      const hayTerm = searchTerm
        ? [e.tag, e.nombre, e.descripcion, e.planta, e.area, e.sistema, e.componente, e.circuito_inspeccion, e.fluido, e.material, e.servicio]
            .some(v => (v || '').toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const hayTipo   = filterTipo   ? e.tipo === filterTipo : true;
      const hayEstado = filterEstado ? e.estado === filterEstado : true;
      const hayCond   = filterCond   ? st?.condicion === filterCond : true;
      return hayTerm && hayTipo && hayEstado && hayCond;
    });

    rows.sort((a, b) => {
      const va = (a.eq[sortKey] ?? '').toString().toLowerCase();
      const vb = (b.eq[sortKey] ?? '').toString().toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const total = rows.length;
    const start = (page - 1) * PAGE_SIZE;
    const paged = rows.slice(start, start + PAGE_SIZE);

    const trs = paged.map(({ eq, st }) => {
      const cmls = DB.query('cmls', c => c.equipo_id === eq.id);
      const rbi = DB.query('rbi_evaluaciones', r => r.equipo_id === eq.id)
        .sort((a, b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion))[0];

      return `<tr>
        <td>
          <strong class="font-mono">${Utils.escHtml(eq.tag)}</strong>
          ${eq.circuito_inspeccion ? `<div class="text-xs text-muted">Circ: ${Utils.escHtml(eq.circuito_inspeccion)}</div>` : ''}
        </td>
        <td>
          <div>${Utils.escHtml(eq.nombre)}</div>
          <div class="text-xs text-muted">${Utils.escHtml(eq.componente || '')}</div>
        </td>
        <td>
          <span class="badge badge-muted">${Utils.escHtml(eq.tipo)}</span>
          <div class="text-xs text-muted">${Utils.escHtml(eq.norma_diseno || '')}</div>
        </td>
        <td>
          <div>${Utils.escHtml(eq.planta || '—')}</div>
          <div class="text-xs text-muted">${Utils.escHtml([eq.area, eq.sistema].filter(Boolean).join(' · '))}</div>
        </td>
        <td>${Utils.escHtml(eq.material)}</td>
        <td class="font-mono text-xs">
          <div>Dis: ${eq.presion_diseno_kPa ? (eq.presion_diseno_kPa/1000).toFixed(2)+' MPa' : '—'} / ${eq.temp_diseno_C ?? '—'}°C</div>
          <div class="text-muted">Op: ${eq.presion_operacion_kPa ? (eq.presion_operacion_kPa/1000).toFixed(2)+' MPa' : '—'} / ${eq.temp_operacion_C ?? '—'}°C</div>
        </td>
        <td class="font-mono text-xs">
          <div>t_nom: ${eq.espesor_nominal_mm ?? '—'} mm</div>
          <div>t_mín: ${eq.espesor_minimo_mm ?? '—'} mm</div>
        </td>
        <td>${Utils.condicionBadge(st?.condicion)}</td>
        <td>${rbi ? Utils.riskBadge(rbi.riesgo_color) : '<span class="badge badge-muted">Sin RBI</span>'}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-action="detail" data-id="${eq.id}" title="Ver detalle">🔍</button>
          <button class="btn btn-ghost btn-sm" data-action="edit"   data-id="${eq.id}" title="Editar y recalcular">✏️</button>
          <button class="btn btn-ghost btn-sm" data-action="cmls"   data-id="${eq.id}" title="Ver CMLs" style="color:var(--c-primary)">${cmls.length} CML</button>
          <button class="btn btn-ghost btn-sm" data-action="iso"    data-id="${eq.id}" title="Ver esquema">📐</button>
          <button class="btn btn-ghost btn-sm" data-action="del"    data-id="${eq.id}" title="Eliminar" style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    const headers = [
      { label:'TAG / Circuito', sortKey:'tag' },
      { label:'Equipo / Componente', sortKey:'nombre' },
      { label:'Familia / Código' },
      { label:'Ubicación Técnica', sortKey:'planta' },
      { label:'Material' },
      { label:'Diseño / Operación' },
      { label:'Espesores' },
      { label:'Condición' },
      { label:'Riesgo RBI' },
      { label:'Acciones', cls:'col-actions' },
    ].map(h => {
      let cls = h.cls || '';
      if (h.sortKey && h.sortKey === sortKey) cls += ' ' + (sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      return `<th${h.sortKey ? ` data-sort="${h.sortKey}"` : ''}${cls ? ` class="${cls.trim()}"` : ''}>${h.label}</th>`;
    }).join('');

    document.getElementById('eq-tableArea').innerHTML = rows.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🗄</div><h3>Sin equipos</h3><p>No se encontraron equipos con los filtros actuales.</p></div>`
      : `<div class="table-wrapper"><table class="data-table" id="eq-table"><thead><tr>${headers}</tr></thead><tbody>${trs}</tbody></table></div>`;

    _renderPagination(total);
    _bindTableEvents();
  }

  function _renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) { document.getElementById('eq-pagination').innerHTML = ''; return; }
    let btns = `<span class="pagination-info">Mostrando ${Math.min((page-1)*PAGE_SIZE+1,total)}–${Math.min(page*PAGE_SIZE,total)} de ${total}</span>`;
    btns += `<button class="page-btn" data-p="${page-1}" ${page===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
        btns += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
      } else if (Math.abs(i - page) === 2) {
        btns += `<span class="page-btn" style="pointer-events:none">…</span>`;
      }
    }
    btns += `<button class="page-btn" data-p="${page+1}" ${page===pages?'disabled':''}>›</button>`;
    document.getElementById('eq-pagination').innerHTML = `<div class="pagination">${btns}</div>`;
    document.querySelectorAll('#eq-pagination .page-btn[data-p]').forEach(b =>
      b.addEventListener('click', () => { page = parseInt(b.dataset.p, 10); _renderTable(); })
    );
  }

  function _bindListEvents(el) {
    el.querySelector('#eq-newBtn').addEventListener('click', () => openForm(null));
    el.querySelector('#eq-exportBtn').addEventListener('click', exportCSV);
    const debouncedSearch = Utils.debounce(() => { page = 1; _renderTable(); });
    el.querySelector('#eq-search').addEventListener('input', e => { searchTerm = e.target.value; debouncedSearch(); });
    el.querySelector('#eq-filterTipo').addEventListener('change', e => { filterTipo = e.target.value; page = 1; _renderTable(); });
    el.querySelector('#eq-filterCond').addEventListener('change', e => { filterCond = e.target.value; page = 1; _renderTable(); });
    el.querySelector('#eq-filterEstado').addEventListener('change', e => { filterEstado = e.target.value; page = 1; _renderTable(); });
  }

  function _bindTableEvents() {
    document.querySelectorAll('#eq-table thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        _renderTable();
      });
    });
    document.querySelectorAll('#eq-tableArea [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        if (action === 'detail') openDetail(id);
        if (action === 'edit')   openForm(id);
        if (action === 'del')    deleteEquipo(id);
        if (action === 'cmls')   window.App?.navigate('cml', id);
        if (action === 'iso')    window.App?.navigate('isometricos', id);
      });
    });
  }

  /* ── Detail modal ───────────────────────────────────────── */
  function openDetail(id) {
    const eq = DB.getById('equipos', id);
    if (!eq) return;

    const st   = DB.evaluateEquipoStatus(id);
    const cmls = DB.query('cmls', c => c.equipo_id === id);
    const insps = DB.query('inspecciones', i => i.equipo_id === id).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const rbi = DB.query('rbi_evaluaciones', r => r.equipo_id === id).sort((a,b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion))[0];
    const calc = ThicknessCalc.calcForEquipo(eq);

    const cmlRows = cmls.map(c => {
      const a = DB.analyzeCML(c.id, eq);
      return `<tr>
        <td><strong>${Utils.escHtml(c.nombre)}</strong><div class="text-xs text-muted">${Utils.escHtml(c.componente || '')}</div></td>
        <td>${a.last ? `${Number(a.last.espesor_mm).toFixed(2)} mm` : '—'}</td>
        <td>${Utils.crBadge(a.insufficient ? null : a.cr_adoptada)}</td>
        <td class="${Utils.rlClass(a.rl ?? Infinity)}">${a.rl !== null && isFinite(a.rl) ? a.rl.toFixed(1) + ' a' : '—'}</td>
        <td>${Utils.condicionBadge(a.condicion)}</td>
      </tr>`;
    }).join('');

    const insp_rows = insps.slice(0, 4).map(i => `
      <div class="timeline-item">
        <div class="timeline-date">${Utils.fmtDate(i.fecha)} · ${Utils.escHtml(i.tipo)}</div>
        <div class="timeline-title">${Utils.resultadoBadge(i.resultado)} ${Utils.estadoInsBadge(i.estado)}</div>
        <div class="timeline-body">${Utils.escHtml(i.hallazgos || '—')}</div>
      </div>`).join('');

    const body = `
      <div class="tab-nav" id="detTabNav">
        <button class="tab-btn active" data-dtab="info">Ubicación y Generales</button>
        <button class="tab-btn" data-dtab="dis">Diseño, Operación y Espesores</button>
        <button class="tab-btn" data-dtab="cmls">CML / TML (${cmls.length})</button>
        <button class="tab-btn" data-dtab="hist">Historial (${insps.length})</button>
        ${rbi ? '<button class="tab-btn" data-dtab="rbi">RBI (API 581)</button>' : ''}
      </div>

      <div class="tab-panel active" id="dtp-info">
        <div class="alert alert-info mb-2">
          <span class="alert-icon">🏭</span>
          <div><strong>Ubicación técnica:</strong> ${Utils.escHtml([eq.planta, eq.area, eq.sistema, eq.tag, eq.componente].filter(Boolean).join(' → '))}</div>
        </div>
        <div class="form-row cols-3">
          ${_detRow('TAG', eq.tag)}
          ${_detRow('Nombre', eq.nombre)}
          ${_detRow('Familia / Tipo', eq.tipo)}
          ${_detRow('Planta', eq.planta)}
          ${_detRow('Área', eq.area)}
          ${_detRow('Sistema', eq.sistema)}
          ${_detRow('Componente', eq.componente)}
          ${_detRow('Servicio', eq.servicio)}
          ${_detRow('Fluido', eq.fluido)}
          ${eq.tipo === 'Tubería a Presión' ? _detRow('Circuito de inspección', eq.circuito_inspeccion || '—') : ''}
          ${eq.tipo === 'Tubería a Presión' ? _detRow('Clase tubería (API 570)', eq.clase_tuberia || 'Clase 1') : ''}
          ${_detRow('Condición Integridad', Utils.condicionBadge(st?.condicion), true)}
          ${_detRow('Estado Operativo', Utils.estadoBadge(eq.estado), true)}
          ${_detRow('Criticidad', Utils.criticidadBadge(eq.criticidad), true)}
          ${_detRow('Fabricación / Instalación', `${Utils.fmtDate(eq.fecha_fabricacion)} / ${Utils.fmtDate(eq.fecha_instalacion)}`)}
        </div>
        ${eq.descripcion ? `<div class="mt-1 text-sm"><strong>Descripción:</strong> ${Utils.escHtml(eq.descripcion)}</div>` : ''}
        ${eq.notas ? `<div class="alert alert-info mt-2"><span class="alert-icon">📝</span><div>${Utils.escHtml(eq.notas)}</div></div>` : ''}
      </div>

      <div class="tab-panel" id="dtp-dis">
        <div class="form-row cols-3">
          ${_detRow('Código diseño', eq.norma_diseno)}
          ${_detRow('Material', eq.material)}
          ${_detRow('Eficiencia junta E', eq.eficiencia_junta ?? 1.0)}
          ${_detRow('P Diseño / P Operación', `${eq.presion_diseno_kPa ?? '—'} / ${eq.presion_operacion_kPa ?? '—'} kPa`)}
          ${_detRow('T Diseño / T Operación', `${eq.temp_diseno_C ?? '—'} / ${eq.temp_operacion_C ?? '—'} °C`)}
          ${_detRow('Dimensiones (D × L)', `${eq.diametro_mm ?? '—'} mm × ${eq.longitud_mm ?? '—'} mm`)}
          ${_detRow('Espesor nominal (t_nom)', eq.espesor_nominal_mm ? eq.espesor_nominal_mm + ' mm' : '—')}
          ${_detRow('Requerido por cálculo (t_req)', calc && !calc.error ? calc.t_req_mm.toFixed(3) + ' mm' : (eq.espesor_requerido_mm ? eq.espesor_requerido_mm + ' mm' : '—'))}
          ${_detRow('Mínimo en servicio (t_mín)', eq.espesor_minimo_mm ? eq.espesor_minimo_mm + ' mm' : '—')}
          ${_detRow('Espesor de alerta (t_alerta)', eq.espesor_alerta_mm ? eq.espesor_alerta_mm + ' mm' : '—')}
          ${_detRow('Sobreespesor corrosión (CA)', eq.ca_mm ? eq.ca_mm + ' mm' : '0 mm')}
          ${_detRow('Tolerancia fab. / Plazo interv.', `${eq.tolerancia_fab_pct ?? 0}% · ${eq.plazo_intervencion_a ?? 2} años`)}
        </div>
        ${calc && !calc.error ? `<div class="alert alert-info mt-2"><span class="alert-icon">📐</span><div class="text-xs"><strong>Referencia:</strong> ${Utils.escHtml(calc.norm)} (${Utils.escHtml(calc.ref_material)})<br><span class="font-mono">${Utils.escHtml(calc.formula)}</span><br>${Utils.escHtml(calc.alerta_justificacion || '')}</div></div>` : ''}
        ${st?.nextInsp?.declaracion_alcance ? `<div class="alert alert-warning mt-1"><span class="alert-icon">⚠️</span><div class="text-xs">${Utils.escHtml(st.nextInsp.declaracion_alcance)}</div></div>` : ''}
        ${_renderLifeBar(eq)}
      </div>

      <div class="tab-panel" id="dtp-cmls">
        ${cmls.length === 0
          ? '<p class="text-muted text-sm">Sin CMLs registrados para este equipo.</p>'
          : `<div class="table-wrapper"><table class="data-table">
              <thead><tr><th>CML / Componente</th><th>Último esp.</th><th>CR adoptada</th><th>Vida rem.</th><th>Condición</th></tr></thead>
              <tbody>${cmlRows}</tbody>
            </table></div>`}
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-primary btn-sm" data-action="gomod" data-module="cml" data-eq="${id}">📍 Gestionar CMLs</button>
          <button class="btn btn-secondary btn-sm" data-action="gomod" data-module="isometricos" data-eq="${id}">📐 Ver Esquema / Isométrico</button>
        </div>
      </div>

      <div class="tab-panel" id="dtp-hist">
        ${insps.length === 0
          ? '<p class="text-muted text-sm">Sin inspecciones registradas.</p>'
          : `<div class="timeline">${insp_rows}</div>`}
      </div>

      ${rbi ? `
      <div class="tab-panel" id="dtp-rbi">
        <div class="mini-stat-row">
          <div class="mini-stat"><div class="ms-label">Factor Daño D_f</div><div class="ms-val font-mono">${rbi.Df ?? '—'}</div></div>
          <div class="mini-stat"><div class="ms-label">Frecuencia f_F</div><div class="ms-val font-mono">${Utils.fmtSci(rbi.f_F, 2)} /a</div></div>
          <div class="mini-stat"><div class="ms-label">Riesgo Área R_A</div><div class="ms-val font-mono">${Utils.fmtSci(rbi.R_A, 3)} m²/a</div></div>
          <div class="mini-stat"><div class="ms-label">Riesgo Econ. R_E</div><div class="ms-val font-mono">${Utils.fmtSci(rbi.R_E, 1)} ${Utils.escHtml(rbi.moneda||'USD')}/a</div></div>
          <div class="mini-stat"><div class="ms-label">Riesgo</div><div class="ms-val">${Utils.riskBadge(rbi.riesgo_color)}</div></div>
        </div>
      </div>` : ''}`;

    Utils.openModal(`🔍 ${Utils.escHtml(eq.tag)} – ${Utils.escHtml(eq.nombre)}`, body, { size: 'modal-xl' });

    setTimeout(() => {
      document.querySelectorAll('#detTabNav .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#detTabNav .tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.modal-body .tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `dtp-${btn.dataset.dtab}`);
          });
        });
      });
      document.querySelectorAll('[data-action="gomod"]').forEach(b => {
        b.addEventListener('click', () => {
          Utils.closeModal();
          window.App?.navigate(b.dataset.module, b.dataset.eq);
        });
      });
    }, 50);
  }

  function _detRow(label, val, raw = false) {
    return `<div class="form-group mb-1">
      <label class="text-xs" style="margin-bottom:2px">${label}</label>
      <div class="text-sm font-bold">${raw ? val : Utils.escHtml(String(val ?? '—'))}</div>
    </div>`;
  }

  function _renderLifeBar(eq) {
    if (!eq.espesor_nominal_mm || !eq.espesor_minimo_mm) return '';
    const cmls = DB.query('cmls', c => c.equipo_id === eq.id);
    if (cmls.length === 0) return '';
    const bars = cmls.map(c => {
      const lm = DB.lastMedicion(c.id);
      if (!lm) return '';
      const tact = lm.espesor_mm;
      const tnom = eq.espesor_nominal_mm;
      const tmin = eq.espesor_minimo_mm;
      const pct  = Utils.clamp(((tact - tmin) / (tnom - tmin || 1)) * 100, 0, 100);
      const cls  = tact < tmin ? 'danger' : pct > 60 ? 'success' : pct > 30 ? 'warn' : 'danger';
      return `<div class="mb-1">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:3px">
          <span>${Utils.escHtml(c.nombre)} (${Utils.escHtml(c.componente || c.descripcion || '')})</span>
          <span class="font-mono">${tact} mm (${pct.toFixed(0)}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="gauge-label"><span>t_mín=${tmin} mm</span><span>t_nom=${tnom} mm</span></div>
      </div>`;
    }).join('');
    return `<div class="form-section mt-2"><div class="form-section-title">Margen de Pared Remanente (CMLs)</div>${bars}</div>`;
  }

  /* ── Form modal with live thickness recalculation ───────── */
  function openForm(id) {
    const eq = id ? DB.getById('equipos', id) : null;
    const title = eq ? `✏️ Editar Equipo – ${eq.tag}` : '＋ Nuevo Equipo';

    const mats = ThicknessCalc.getMaterials()
      .map(m => `<option value="${m.key}" ${eq?.material===m.key?'selected':''}>${m.nombre}</option>`).join('');
    const v = (field, def = '') => Utils.escHtml(eq ? (eq[field] ?? def) : def);
    const sel = (field, val) => eq?.[field] === val ? 'selected' : '';

    const body = `
      <form id="eq-form" autocomplete="off">
        <div class="form-section">
          <div class="form-section-title">1. Ubicación Técnica e Identificación (Planta → Área → Sistema → Equipo/Línea → Componente)</div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>TAG (Equipo o Línea)<span class="required">*</span></label>
              <input class="form-control" id="f_tag" value="${v('tag')}" placeholder="p.ej. V-101, P-201A, TK-401" required>
            </div>
            <div class="form-group">
              <label>Nombre<span class="required">*</span></label>
              <input class="form-control" id="f_nombre" value="${v('nombre')}" required>
            </div>
            <div class="form-group">
              <label>Familia / Tipo<span class="required">*</span></label>
              <select class="form-control" id="f_tipo">
                <option value="" ${sel('tipo','')}>Seleccionar…</option>
                ${['Vasija a Presión','Tubería a Presión','Tanque Atmosférico','Intercambiador','Caldera / Horno','Dispositivo de Alivio']
                  .map(t=>`<option ${sel('tipo',t)}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row cols-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
            <div class="form-group">
              <label>Planta</label>
              <input class="form-control" id="f_planta" value="${v('planta')}" placeholder="p.ej. Planta Norte">
            </div>
            <div class="form-group">
              <label>Área</label>
              <input class="form-control" id="f_area" value="${v('area')}" placeholder="p.ej. Área 100">
            </div>
            <div class="form-group">
              <label>Sistema</label>
              <input class="form-control" id="f_sistema" value="${v('sistema')}" placeholder="p.ej. Separación">
            </div>
            <div class="form-group">
              <label>Componente evaluado</label>
              <input class="form-control" id="f_comp" value="${v('componente')}" placeholder="p.ej. Envolvente / Tramo recto / Virola 1">
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Servicio</label>
              <input class="form-control" id="f_servicio" value="${v('servicio')}" placeholder="p.ej. Separación gas-líquido">
            </div>
            <div class="form-group">
              <label>Fluido</label>
              <input class="form-control" id="f_fluido" value="${v('fluido')}" placeholder="p.ej. Gas / Condensado">
            </div>
            <div class="form-group">
              <label>Descripción técnica</label>
              <input class="form-control" id="f_desc" value="${v('descripcion')}" placeholder="Breve descripción del equipo">
            </div>
          </div>

          <!-- Solo Tuberías -->
          <div id="f_pipe_fields" class="form-row cols-2" style="display:none">
            <div class="form-group">
              <label>Circuito de inspección (API 570)</label>
              <input class="form-control" id="f_circuito" value="${v('circuito_inspeccion')}" placeholder="p.ej. CI-CRU-201">
            </div>
            <div class="form-group">
              <label>Clase de tubería (API 570 §6.3)</label>
              <select class="form-control" id="f_clase_tub">
                ${['Clase 1','Clase 2','Clase 3'].map(c => `<option ${sel('clase_tuberia', c)}>${c}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row cols-3">
            <div class="form-group">
              <label>Código de diseño aplicable</label>
              <select class="form-control" id="f_norma">
                ${['ASME VIII Div.1','ASME B31.3','API 650','ASME II-D']
                  .map(n=>`<option ${sel('norma_diseno',n)}>${n}</option>`).join('')}
              </select>
              <div class="form-hint" id="f_norma_hint"></div>
            </div>
            <div class="form-group">
              <label>Estado operativo</label>
              <select class="form-control" id="f_estado">
                ${['Activo','Inactivo','Parado','Retirado'].map(s=>`<option ${sel('estado',s)}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Criticidad</label>
              <select class="form-control" id="f_criticidad">
                ${['Alta','Media','Baja'].map(c=>`<option ${sel('criticidad',c)}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>2. Condiciones de Diseño, Operación y Dimensiones</span>
            <button type="button" class="btn btn-secondary btn-sm" id="eq-recalcBtn">⚙ Recalcular espesores en vivo</button>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Material</label>
              <select class="form-control" id="f_material">${mats}</select>
            </div>
            <div class="form-group">
              <label>Presión de diseño (kPa)</label>
              <input type="number" class="form-control" id="f_P" value="${v('presion_diseno_kPa')}" min="0" step="1">
            </div>
            <div class="form-group">
              <label>Temperatura de diseño (°C)</label>
              <input type="number" class="form-control" id="f_T" value="${v('temp_diseno_C')}" step="1">
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Presión de operación (kPa)</label>
              <input type="number" class="form-control" id="f_Pop" value="${v('presion_operacion_kPa')}" min="0" step="1">
            </div>
            <div class="form-group">
              <label>Temperatura de operación (°C)</label>
              <input type="number" class="form-control" id="f_Top" value="${v('temp_operacion_C')}" step="1">
            </div>
            <div class="form-group">
              <label>Eficiencia de junta E</label>
              <input type="number" class="form-control" id="f_E" value="${v('eficiencia_junta', 1.0)}" min="0.5" max="1.0" step="0.05">
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label id="f_diam_lbl">Diámetro (mm)</label>
              <input type="number" class="form-control" id="f_diam" value="${v('diametro_mm')}" min="0" step="0.1">
            </div>
            <div class="form-group">
              <label>Longitud / Altura total (mm)</label>
              <input type="number" class="form-control" id="f_long" value="${v('longitud_mm')}" min="0" step="1">
            </div>
            <div class="form-group">
              <label>Sobreespesor corrosión CA (mm)</label>
              <input type="number" class="form-control" id="f_ca" value="${v('ca_mm', 1.5)}" min="0" step="0.1">
            </div>
          </div>

          <!-- Solo Tanques -->
          <div id="f_tank_fields" class="form-row cols-3" style="display:none">
            <div class="form-group">
              <label>Altura de líquido H (m)</label>
              <input type="number" class="form-control" id="f_H" value="${v('altura_liquido_m', 10)}" min="0.4" step="0.1">
            </div>
            <div class="form-group">
              <label>Gravedad específica G</label>
              <input type="number" class="form-control" id="f_G" value="${v('gravedad_especifica', 0.88)}" min="0.5" max="2.0" step="0.01">
            </div>
            <div class="form-group">
              <label>Virola evaluada N°</label>
              <input type="number" class="form-control" id="f_virola" value="${v('numero_virola', 1)}" min="1" max="12" step="1">
            </div>
          </div>

          <div class="form-row cols-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
            <div class="form-group">
              <label>Esp. nominal t_nom (mm)</label>
              <input type="number" class="form-control" id="f_tnom" value="${v('espesor_nominal_mm')}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label>Requerido t_req (mm)</label>
              <input type="number" class="form-control" id="f_treq" value="${v('espesor_requerido_mm')}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label>Mín. servicio t_mín (mm)</label>
              <input type="number" class="form-control" id="f_tmin" value="${v('espesor_minimo_mm')}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label>Esp. alerta t_alerta (mm)</label>
              <input type="number" class="form-control" id="f_talert" value="${v('espesor_alerta_mm')}" min="0" step="0.01">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Tolerancia de fabricación (%)</label>
              <input type="number" class="form-control" id="f_tol" value="${v('tolerancia_fab_pct', 0)}" min="0" max="20" step="0.5">
            </div>
            <div class="form-group">
              <label>Plazo de intervención para alerta (años)</label>
              <input type="number" class="form-control" id="f_plazo" value="${v('plazo_intervencion_a', 2)}" min="0.5" max="10" step="0.5">
            </div>
          </div>
          <div id="f_calc_live" class="alert alert-info" style="display:none;font-size:.82rem"></div>
        </div>

        <div class="form-section">
          <div class="form-section-title">3. Fechas y Notas</div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Fecha de fabricación</label>
              <input type="date" class="form-control" id="f_ffab" value="${v('fecha_fabricacion')}">
            </div>
            <div class="form-group">
              <label>Fecha de instalación</label>
              <input type="date" class="form-control" id="f_fins" value="${v('fecha_instalacion')}">
            </div>
          </div>
          <div class="form-group">
            <label>Notas</label>
            <textarea class="form-control" id="f_notas" rows="2">${v('notas')}</textarea>
          </div>
        </div>
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-xl',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="eq-saveBtn">💾 Guardar Equipo</button>`
    });

    setTimeout(() => {
      const tipoSelect  = document.getElementById('f_tipo');
      const normaSelect = document.getElementById('f_norma');
      const hint        = document.getElementById('f_norma_hint');
      const pipeFields  = document.getElementById('f_pipe_fields');
      const tankFields  = document.getElementById('f_tank_fields');
      const diamLbl     = document.getElementById('f_diam_lbl');

      const updateVisibilityAndNormas = () => {
        const tipo = tipoSelect?.value;
        if (pipeFields) pipeFields.style.display = tipo === 'Tubería a Presión' ? 'grid' : 'none';
        if (tankFields) tankFields.style.display = tipo === 'Tanque Atmosférico' ? 'grid' : 'none';
        if (diamLbl) {
          diamLbl.textContent = tipo === 'Tubería a Presión' ? 'Diámetro exterior OD (mm)'
            : tipo === 'Tanque Atmosférico' ? 'Diámetro del tanque D (mm)'
            : 'Diámetro interior ID (mm)';
        }
        if (!tipo || !normaSelect) return;
        const items = ThicknessCalc.getApplicableStandards(tipo);
        if (items.length === 0) return;
        const previous = normaSelect.value;
        normaSelect.innerHTML = items.map(s => `<option value="${s.key}" ${previous===s.key?'selected':''}>${s.edition}</option>`).join('');
        if (!items.some(s => s.key === previous)) {
          const primary = items.find(s => s.key !== 'ASME II-D') || items[0];
          normaSelect.value = primary.key;
        }
        const selected = items.find(s => s.key === normaSelect.value);
        hint.textContent = selected ? `${selected.description} (${selected.inService})` : '';
      };

      const runLiveCalc = (showToast = false) => {
        const tipo = tipoSelect?.value;
        if (!tipo) return;
        const fakeEq = {
          tipo,
          norma_diseno: normaSelect?.value,
          material: document.getElementById('f_material')?.value,
          presion_diseno_kPa: parseFloat(document.getElementById('f_P')?.value),
          temp_diseno_C: parseFloat(document.getElementById('f_T')?.value),
          diametro_mm: parseFloat(document.getElementById('f_diam')?.value),
          longitud_mm: parseFloat(document.getElementById('f_long')?.value),
          eficiencia_junta: parseFloat(document.getElementById('f_E')?.value) || 1.0,
          ca_mm: parseFloat(document.getElementById('f_ca')?.value) || 0,
          tolerancia_fab_pct: parseFloat(document.getElementById('f_tol')?.value) || 0,
          espesor_nominal_mm: parseFloat(document.getElementById('f_tnom')?.value) || null,
          altura_liquido_m: parseFloat(document.getElementById('f_H')?.value) || 10,
          gravedad_especifica: parseFloat(document.getElementById('f_G')?.value) || 1.0,
          numero_virola: parseInt(document.getElementById('f_virola')?.value, 10) || 1,
          plazo_intervencion_a: parseFloat(document.getElementById('f_plazo')?.value) || 2.0,
        };
        const res = ThicknessCalc.calcForEquipo(fakeEq);
        const box = document.getElementById('f_calc_live');
        if (!res || res.error) {
          if (box) { box.style.display = 'flex'; box.innerHTML = `<span class="alert-icon">⚠️</span><div>${Utils.escHtml(res?.error || 'Complete los parámetros de diseño para recalcular.')}</div>`; }
          return;
        }
        document.getElementById('f_treq').value   = res.t_req_mm.toFixed(2);
        document.getElementById('f_tmin').value   = res.t_min_servicio_mm.toFixed(2);
        document.getElementById('f_talert').value = res.t_alerta_mm.toFixed(2);
        if (box) {
          box.style.display = 'flex';
          box.innerHTML = `<span class="alert-icon">✅</span><div>
            <strong>Recálculo normativo (${Utils.escHtml(res.norm)}):</strong>
            t_req = <strong>${res.t_req_mm.toFixed(3)} mm</strong> ·
            t_mín_serv = <strong>${res.t_min_servicio_mm.toFixed(3)} mm</strong> ·
            t_alerta = <strong>${res.t_alerta_mm.toFixed(3)} mm</strong>
            ${res.S_MPa ? ` · S = ${res.S_MPa} MPa` : res.S_d_MPa ? ` · S_d = ${res.S_d_MPa.toFixed(1)} MPa / S_653 = ${res.S_653_MPa.toFixed(1)} MPa` : ''}
            <div class="text-xs text-muted mt-1 font-mono">${Utils.escHtml(res.formula)}</div>
          </div>`;
        }
        if (showToast) Utils.toast('Espesores recalculados', `t_mín_serv = ${res.t_min_servicio_mm.toFixed(2)} mm actualizado en el formulario.`, 'success');
      };

      tipoSelect?.addEventListener('change', () => { updateVisibilityAndNormas(); runLiveCalc(false); });
      document.getElementById('eq-recalcBtn')?.addEventListener('click', () => runLiveCalc(true));
      ['f_P','f_T','f_diam','f_material','f_E','f_ca','f_tol','f_H','f_G','f_virola','f_plazo'].forEach(fid => {
        document.getElementById(fid)?.addEventListener('change', () => runLiveCalc(false));
      });

      updateVisibilityAndNormas();
      document.getElementById('eq-saveBtn').addEventListener('click', () => saveEquipo(eq?.id));
    }, 50);
  }

  function saveEquipo(id) {
    const g  = sid => document.getElementById(sid)?.value?.trim() || '';
    const gn = sid => { const val = parseFloat(document.getElementById(sid)?.value); return isNaN(val) ? null : val; };

    const tag    = g('f_tag');
    const nombre = g('f_nombre');
    const tipo   = g('f_tipo');
    if (!tag || !nombre || !tipo) {
      Utils.toast('Campos requeridos', 'TAG, Nombre y Familia/Tipo son obligatorios.', 'error'); return;
    }

    const norma = g('f_norma');
    if (!ThicknessCalc.validateStandardForEquipment(tipo, norma)) {
      Utils.toast('Norma no aplicable', `La norma ${norma || '(vacía)'} no corresponde a ${tipo}.`, 'error'); return;
    }

    const data = {
      tag, nombre, tipo,
      descripcion:           g('f_desc'),
      planta:                g('f_planta'),
      area:                  g('f_area'),
      sistema:               g('f_sistema'),
      componente:            g('f_comp'),
      circuito_inspeccion:   tipo === 'Tubería a Presión' ? g('f_circuito') : '',
      clase_tuberia:         tipo === 'Tubería a Presión' ? (g('f_clase_tub') || 'Clase 1') : '',
      servicio:              g('f_servicio'),
      fluido:                g('f_fluido'),
      estado:                g('f_estado') || 'Activo',
      criticidad:            g('f_criticidad') || 'Media',
      norma_diseno:          norma,
      material:              g('f_material'),
      presion_diseno_kPa:    gn('f_P'),
      temp_diseno_C:         gn('f_T'),
      presion_operacion_kPa: gn('f_Pop'),
      temp_operacion_C:      gn('f_Top'),
      eficiencia_junta:      gn('f_E') ?? 1.0,
      diametro_mm:           gn('f_diam'),
      longitud_mm:           gn('f_long'),
      altura_liquido_m:      tipo === 'Tanque Atmosférico' ? gn('f_H') : null,
      gravedad_especifica:   tipo === 'Tanque Atmosférico' ? gn('f_G') : null,
      numero_virola:         tipo === 'Tanque Atmosférico' ? (parseInt(g('f_virola'), 10) || 1) : null,
      ca_mm:                 gn('f_ca') ?? 0,
      tolerancia_fab_pct:    gn('f_tol') ?? 0,
      plazo_intervencion_a:  gn('f_plazo') ?? 2.0,
      espesor_nominal_mm:    gn('f_tnom'),
      espesor_requerido_mm:  gn('f_treq'),
      espesor_minimo_mm:     gn('f_tmin'),
      espesor_alerta_mm:     gn('f_talert'),
      fecha_fabricacion:     g('f_ffab') || null,
      fecha_instalacion:     g('f_fins') || null,
      notas:                 g('f_notas'),
    };

    if (id) {
      DB.update('equipos', id, data);
      Utils.toast('Actualizado', `Equipo ${tag} actualizado y espesores vinculados.`, 'success');
    } else {
      data.id = 'EQ-' + Date.now().toString(36).toUpperCase();
      DB.insert('equipos', data);
      Utils.toast('Creado', `Equipo ${tag} registrado.`, 'success');
    }
    if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
    Utils.closeModal();
    render();
  }

  function deleteEquipo(id) {
    const eq = DB.getById('equipos', id);
    if (!eq) return;
    Utils.confirm(
      `¿Eliminar el equipo ${eq.tag}? Se eliminarán también sus CMLs, mediciones, esquemas, inspecciones, RBI y planes asociados.`,
      () => {
        DB.remove('equipos', id);
        DB.query('cmls', c => c.equipo_id === id).forEach(c => {
          DB.query('mediciones', m => m.cml_id === c.id).forEach(m => DB.remove('mediciones', m.id));
          DB.remove('cmls', c.id);
        });
        DB.query('mediciones', m => m.equipo_id === id).forEach(m => DB.remove('mediciones', m.id));
        DB.query('isometricos', d => d.equipo_id === id).forEach(d => DB.remove('isometricos', d.id));
        DB.query('inspecciones', i => i.equipo_id === id).forEach(i => DB.remove('inspecciones', i.id));
        DB.query('rbi_evaluaciones', r => r.equipo_id === id).forEach(r => DB.remove('rbi_evaluaciones', r.id));
        DB.query('planes', p => p.equipo_id === id).forEach(p => DB.remove('planes', p.id));
        Utils.toast('Eliminado', `Equipo ${eq.tag} y todos sus registros asociados eliminados.`, 'warning');
        render();
      }
    );
  }

  function exportCSV() {
    const all = DB.getAll('equipos');
    const headers = ['TAG','Nombre','Familia','Planta','Área','Sistema','Componente','Circuito','Servicio','Fluido','Material',
      'P_dis_kPa','T_dis_C','P_op_kPa','T_op_C','Diámetro_mm','t_nom_mm','t_req_mm','t_min_mm','t_alerta_mm','CA_mm',
      'Estado','Norma'];
    const rows = all.map(e => [
      e.tag, e.nombre, e.tipo, e.planta, e.area||'', e.sistema, e.componente||'', e.circuito_inspeccion||'', e.servicio||'', e.fluido, e.material,
      e.presion_diseno_kPa, e.temp_diseno_C, e.presion_operacion_kPa||'', e.temp_operacion_C||'', e.diametro_mm,
      e.espesor_nominal_mm, e.espesor_requerido_mm||'', e.espesor_minimo_mm, e.espesor_alerta_mm||'', e.ca_mm,
      e.estado, e.norma_diseno
    ]);
    Utils.exportCSV(headers, rows, `equipos_${Utils.today()}.csv`);
  }

  return { render, openDetail, openForm };
})();
