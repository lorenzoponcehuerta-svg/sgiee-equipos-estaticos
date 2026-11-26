/**
 * SGIEE – Módulo: Historial de Inspecciones
 * Full inspection records CRUD with timeline view, findings tracking,
 * upcoming/overdue alerts, and per-equipment inspection history
 */
const ModHistorial = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let searchTerm    = '';
  let filterEquipo  = '';
  let filterTipo    = '';
  let filterEstado  = '';
  let viewMode      = 'table';   // 'table' | 'timeline'
  let sortKey       = 'fecha';
  let sortDir       = 'desc';
  let page          = 1;
  const PAGE_SIZE   = 12;

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    const el = document.getElementById('mod-historial');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Historial de Inspecciones</h2>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" id="hi-viewToggle" title="Cambiar vista">📋 Vista</button>
          <button class="btn btn-secondary btn-sm" id="hi-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="hi-newBtn">＋ Nueva Inspección</button>
        </div>
      </div>

      <!-- Alert strip (overdue / upcoming) -->
      <div id="hi-alerts"></div>

      <!-- KPI strip -->
      <div id="hi-kpis" class="mini-stat-row mb-2"></div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-input" style="min-width:220px;flex:1">
          <input type="text" id="hi-search"
            placeholder="Buscar por equipo, tipo, hallazgo…">
        </div>
        <select class="form-control" id="hi-fEq" style="width:200px">
          <option value="">Todos los equipos</option>
          ${DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
            .map(e=>`<option value="${e.id}">${e.tag} – ${Utils.escHtml(e.nombre)}</option>`).join('')}
        </select>
        <select class="form-control" id="hi-fTipo" style="width:150px">
          <option value="">Todos los tipos</option>
          ${['Interna','Externa','Visual','UT General','Fondo','Hidrostática','NDE Avanzado']
            .map(t=>`<option>${t}</option>`).join('')}
        </select>
        <select class="form-control" id="hi-fEst" style="width:140px">
          <option value="">Todos los estados</option>
          <option>Cerrada</option>
          <option>Abierta</option>
          <option>Cancelada</option>
        </select>
      </div>

      <!-- Main content -->
      <div id="hi-content"></div>
      <div id="hi-pagination"></div>`;

    _bindTopEvents(el);
    _renderKPIs();
    _renderAlerts();
    _renderContent();
  }

  /* ── KPIs ───────────────────────────────────────────────── */
  function _renderKPIs() {
    const all   = DB.getAll('inspecciones');
    const hoy   = new Date();
    const venc  = all.filter(i => i.proxima_fecha && new Date(i.proxima_fecha) < hoy && i.estado !== 'Cancelada').length;
    const prox  = all.filter(i => {
      if (!i.proxima_fecha) return false;
      const d = (new Date(i.proxima_fecha) - hoy) / (1000*3600*24);
      return d >= 0 && d <= 90;
    }).length;
    const abierto = all.filter(i => i.estado === 'Abierta').length;
    const sat     = all.filter(i => i.resultado === 'Satisfactorio').length;

    document.getElementById('hi-kpis').innerHTML = `
      <div class="mini-stat">
        <div class="ms-label">Total Registros</div>
        <div class="ms-val" style="color:var(--c-primary)">${all.length}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Vencidas</div>
        <div class="ms-val" style="color:${venc>0?'var(--c-danger)':'var(--c-success)'}">${venc}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Próx. 90 días</div>
        <div class="ms-val" style="color:${prox>0?'var(--c-warning)':'var(--c-success)'}">${prox}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Con Hallazgos Abiertos</div>
        <div class="ms-val" style="color:${abierto>0?'var(--c-warning)':'var(--c-success)'}">${abierto}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Satisfactorias</div>
        <div class="ms-val" style="color:var(--c-success)">${sat}</div>
      </div>`;
  }

  /* ── Alerts ─────────────────────────────────────────────── */
  function _renderAlerts() {
    const hoy = new Date();
    const all = DB.getAll('inspecciones');

    const vencidas = all.filter(i =>
      i.proxima_fecha && new Date(i.proxima_fecha) < hoy && i.estado !== 'Cancelada'
    );
    const proximas = all.filter(i => {
      if (!i.proxima_fecha) return false;
      const d = (new Date(i.proxima_fecha) - hoy) / (1000*3600*24);
      return d >= 0 && d <= 30;
    });

    let html = '';
    if (vencidas.length > 0) {
      const tags = vencidas.map(i => {
        const eq = DB.getById('equipos', i.equipo_id);
        return eq?.tag || i.equipo_id;
      }).join(', ');
      html += `<div class="alert alert-danger mb-1">
        <span class="alert-icon">⛔</span>
        <div><strong>${vencidas.length} inspección(es) VENCIDA(S):</strong> ${Utils.escHtml(tags)}</div>
      </div>`;
    }
    if (proximas.length > 0) {
      const tags = proximas.map(i => {
        const eq = DB.getById('equipos', i.equipo_id);
        const days = Math.round((new Date(i.proxima_fecha) - hoy) / (1000*3600*24));
        return `${eq?.tag || i.equipo_id} (${days}d)`;
      }).join(', ');
      html += `<div class="alert alert-warning mb-1">
        <span class="alert-icon">⚠️</span>
        <div><strong>${proximas.length} inspección(es) próximas (≤ 30 días):</strong> ${Utils.escHtml(tags)}</div>
      </div>`;
    }
    document.getElementById('hi-alerts').innerHTML = html;
  }

  /* ── Content (table or timeline) ───────────────────────── */
  function _renderContent() {
    let rows = _getFiltered();
    const total = rows.length;
    const start = (page-1) * PAGE_SIZE;
    const paged = rows.slice(start, start + PAGE_SIZE);

    const content = document.getElementById('hi-content');
    if (!content) return;

    if (total === 0) {
      content.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📋</div><h3>Sin inspecciones</h3>
        <p>No se encontraron registros con los filtros actuales.</p></div>`;
      document.getElementById('hi-pagination').innerHTML = '';
      return;
    }

    content.innerHTML = viewMode === 'timeline'
      ? _buildTimeline(paged)
      : _buildTable(paged);

    _renderPagination(total);
    _bindRowEvents();
  }

  function _getFiltered() {
    let rows = DB.getAll('inspecciones');
    if (filterEquipo) rows = rows.filter(i => i.equipo_id === filterEquipo);
    if (filterTipo)   rows = rows.filter(i => i.tipo === filterTipo);
    if (filterEstado) rows = rows.filter(i => i.estado === filterEstado);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(i => {
        const eq = DB.getById('equipos', i.equipo_id);
        return [eq?.tag, eq?.nombre, i.tipo, i.hallazgos, i.recomendaciones, i.tecnico]
          .some(v => (v||'').toLowerCase().includes(q));
      });
    }
    rows.sort((a,b) => {
      const va = (a[sortKey]||'').toString().toLowerCase();
      const vb = (b[sortKey]||'').toString().toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return rows;
  }

  /* ── Table view ─────────────────────────────────────────── */
  function _buildTable(rows) {
    const ths = [
      {l:'Fecha',       s:'fecha'},
      {l:'Equipo',      s:'equipo_id'},
      {l:'Tipo'},
      {l:'Resultado'},
      {l:'Técnico',     s:'tecnico'},
      {l:'Próx. Insp.', s:'proxima_fecha'},
      {l:'Estado',      s:'estado'},
      {l:'Acciones',    cls:'col-actions'},
    ].map(h => {
      let cls = h.cls||'';
      if (h.s && h.s === sortKey) cls += ' ' + (sortDir==='asc'?'sorted-asc':'sorted-desc');
      return `<th${h.s?` data-sort="${h.s}"`:''}${cls?` class="${cls.trim()}"`:''}>
        ${h.l}</th>`;
    }).join('');

    const trs = rows.map(ins => {
      const eq = DB.getById('equipos', ins.equipo_id);
      return `<tr>
        <td>${Utils.fmtDate(ins.fecha)}</td>
        <td>
          <strong class="font-mono">${Utils.escHtml(eq?.tag||ins.equipo_id)}</strong>
          <div class="text-xs text-muted">${Utils.escHtml(eq?.nombre||'')}</div>
        </td>
        <td><span class="badge badge-muted">${Utils.escHtml(ins.tipo)}</span></td>
        <td>${Utils.resultadoBadge(ins.resultado)}</td>
        <td>${Utils.escHtml(ins.tecnico||'—')}</td>
        <td>${Utils.vencimientoBadge(ins.proxima_fecha)}</td>
        <td>${Utils.estadoInsBadge(ins.estado)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-hi-action="view"   data-id="${ins.id}" title="Ver">🔍</button>
          <button class="btn btn-ghost btn-sm" data-hi-action="edit"   data-id="${ins.id}" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" data-hi-action="del"    data-id="${ins.id}" title="Eliminar"
            style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    return `<div class="table-wrapper">
      <table class="data-table" id="hi-table">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
  }

  /* ── Timeline view ──────────────────────────────────────── */
  function _buildTimeline(rows) {
    const items = rows.map(ins => {
      const eq = DB.getById('equipos', ins.equipo_id);
      const dotColor = ins.resultado === 'Satisfactorio' ? 'var(--c-success)'
        : ins.resultado === 'Atención Requerida' ? 'var(--c-warning)' : 'var(--c-danger)';

      return `
        <div class="timeline-item" style="padding-bottom:24px">
          <div style="position:absolute;left:-21px;top:4px;width:12px;height:12px;
            border-radius:50%;background:${dotColor};border:2px solid var(--c-surface);
            box-shadow:0 0 0 2px ${dotColor}"></div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <div class="text-xs text-muted">${Utils.fmtDate(ins.fecha)}</div>
              <div style="font-weight:700;font-size:.95rem;margin:2px 0">
                ${Utils.escHtml(eq?.tag||ins.equipo_id)} – ${Utils.escHtml(ins.tipo)}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">
                ${Utils.resultadoBadge(ins.resultado)}
                ${Utils.estadoInsBadge(ins.estado)}
                <span class="badge badge-muted">${Utils.escHtml(ins.tecnico||'')}</span>
              </div>
              ${ins.hallazgos ? `<div class="text-sm mt-1" style="color:var(--c-text-secondary)">
                <strong>Hallazgos:</strong> ${Utils.escHtml(Utils.truncate(ins.hallazgos, 120))}</div>` : ''}
              ${ins.recomendaciones ? `<div class="text-sm mt-1" style="color:var(--c-text-muted)">
                <em>${Utils.escHtml(Utils.truncate(ins.recomendaciones, 100))}</em></div>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:flex-start;flex-shrink:0">
              ${Utils.vencimientoBadge(ins.proxima_fecha)}
              <button class="btn btn-ghost btn-sm" data-hi-action="view" data-id="${ins.id}">🔍</button>
              <button class="btn btn-ghost btn-sm" data-hi-action="edit" data-id="${ins.id}">✏️</button>
            </div>
          </div>
        </div>`;
    }).join('');

    return `<div class="timeline" style="margin-top:8px">${items}</div>`;
  }

  /* ── Pagination ─────────────────────────────────────────── */
  function _renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) { document.getElementById('hi-pagination').innerHTML = ''; return; }
    let html = `<span class="pagination-info">
      ${Math.min((page-1)*PAGE_SIZE+1,total)}–${Math.min(page*PAGE_SIZE,total)} de ${total}</span>`;
    html += `<button class="page-btn" data-p="${page-1}" ${page===1?'disabled':''}>‹</button>`;
    for (let i=1;i<=pages;i++) {
      if (i===1||i===pages||Math.abs(i-page)<=1)
        html += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
      else if (Math.abs(i-page)===2)
        html += `<span class="page-btn" style="pointer-events:none">…</span>`;
    }
    html += `<button class="page-btn" data-p="${page+1}" ${page===pages?'disabled':''}>›</button>`;
    document.getElementById('hi-pagination').innerHTML = `<div class="pagination">${html}</div>`;
    document.querySelectorAll('#hi-pagination .page-btn[data-p]').forEach(b =>
      b.addEventListener('click', () => { page = parseInt(b.dataset.p); _renderContent(); })
    );
  }

  /* ── Event binding ──────────────────────────────────────── */
  function _bindTopEvents(el) {
    el.querySelector('#hi-newBtn').addEventListener('click', () => openForm(null));
    el.querySelector('#hi-exportBtn').addEventListener('click', exportCSV);
    el.querySelector('#hi-viewToggle').addEventListener('click', () => {
      viewMode = viewMode === 'table' ? 'timeline' : 'table';
      el.querySelector('#hi-viewToggle').textContent = viewMode === 'table' ? '📋 Vista' : '⏱ Vista';
      _renderContent();
    });

    const deb = Utils.debounce(() => { page=1; _renderContent(); });
    el.querySelector('#hi-search').addEventListener('input', e => { searchTerm = e.target.value; deb(); });
    el.querySelector('#hi-fEq').addEventListener('change', e => { filterEquipo = e.target.value; page=1; _renderContent(); });
    el.querySelector('#hi-fTipo').addEventListener('change', e => { filterTipo = e.target.value; page=1; _renderContent(); });
    el.querySelector('#hi-fEst').addEventListener('change', e => { filterEstado = e.target.value; page=1; _renderContent(); });
  }

  function _bindRowEvents() {
    document.querySelectorAll('#hi-table thead th[data-sort]').forEach(th =>
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
        sortKey = key; _renderContent();
      })
    );
    document.querySelectorAll('[data-hi-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { hiAction, id } = btn.dataset;
        if (hiAction === 'view') openDetail(id);
        if (hiAction === 'edit') openForm(id);
        if (hiAction === 'del')  deleteInsp(id);
      });
    });
  }

  /* ── Detail modal ───────────────────────────────────────── */
  function openDetail(id) {
    const ins = DB.getById('inspecciones', id);
    if (!ins) return;
    const eq = DB.getById('equipos', ins.equipo_id);

    Utils.openModal(
      `🔍 Inspección – ${eq?.tag || ins.equipo_id} · ${Utils.fmtDate(ins.fecha)}`,
      `
      <div class="form-row cols-2">
        <div>
          <div class="form-section">
            <div class="form-section-title">Identificación</div>
            ${_dr('Equipo',    eq ? `${eq.tag} – ${eq.nombre}` : ins.equipo_id)}
            ${_dr('Tipo',      ins.tipo)}
            ${_dr('Fecha',     Utils.fmtDate(ins.fecha))}
            ${_dr('Técnico',   ins.tecnico)}
            ${_dr('Resultado', '', true, Utils.resultadoBadge(ins.resultado))}
            ${_dr('Estado',    '', true, Utils.estadoInsBadge(ins.estado))}
            ${_dr('Próx. insp.', '', true, Utils.vencimientoBadge(ins.proxima_fecha))}
          </div>
        </div>
        <div>
          <div class="form-section">
            <div class="form-section-title">Hallazgos y Recomendaciones</div>
            <div class="form-group">
              <label class="text-xs">Hallazgos</label>
              <div style="font-size:.88rem;white-space:pre-wrap">${Utils.escHtml(ins.hallazgos||'—')}</div>
            </div>
            <div class="form-group mt-2">
              <label class="text-xs">Recomendaciones</label>
              <div style="font-size:.88rem;white-space:pre-wrap">${Utils.escHtml(ins.recomendaciones||'—')}</div>
            </div>
          </div>
        </div>
      </div>`,
      {
        size: 'modal-lg',
        footerHtml: `
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cerrar</button>
          <button class="btn btn-primary"   id="det-editBtn">✏️ Editar</button>`
      }
    );
    setTimeout(() => {
      document.getElementById('det-editBtn')?.addEventListener('click', () => {
        Utils.closeModal(); openForm(id);
      });
    }, 50);
  }

  function _dr(label, val, raw=false, rawVal='') {
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;
      border-bottom:1px solid var(--c-border);font-size:.88rem">
      <span style="color:var(--c-text-muted)">${label}</span>
      <span style="font-weight:600">${raw ? rawVal : Utils.escHtml(String(val||'—'))}</span>
    </div>`;
  }

  /* ── Form modal ─────────────────────────────────────────── */
  function openForm(id) {
    const ins   = id ? DB.getById('inspecciones', id) : null;
    const title = ins ? `✏️ Editar Inspección – ${Utils.fmtDate(ins.fecha)}` : '＋ Nueva Inspección';

    const eqOpts = DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
      .map(e=>`<option value="${e.id}" ${ins?.equipo_id===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
      .join('');
    const v = (f,d='') => Utils.escHtml(ins ? (ins[f]??d) : d);
    const sel = (f,val) => ins?.[f]===val ? 'selected' : '';

    const body = `
      <form id="hi-form">
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Equipo<span class="required">*</span></label>
            <select class="form-control" id="hf_eq">${eqOpts}</select>
          </div>
          <div class="form-group">
            <label>Fecha de inspección<span class="required">*</span></label>
            <input type="date" class="form-control" id="hf_fecha" value="${v('fecha', Utils.today())}">
          </div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label>Tipo de inspección<span class="required">*</span></label>
            <select class="form-control" id="hf_tipo">
              ${['Interna','Externa','Visual','UT General','Fondo','Hidrostática','NDE Avanzado']
                .map(t=>`<option ${sel('tipo',t)}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Resultado<span class="required">*</span></label>
            <select class="form-control" id="hf_res">
              ${['Satisfactorio','Atención Requerida','No Satisfactorio','Crítico']
                .map(r=>`<option ${sel('resultado',r)}>${r}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select class="form-control" id="hf_est">
              ${['Cerrada','Abierta','Cancelada'].map(s=>`<option ${sel('estado',s)}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Técnico inspector</label>
            <input class="form-control" id="hf_tec" value="${v('tecnico')}">
          </div>
          <div class="form-group">
            <label>Próxima fecha de inspección</label>
            <input type="date" class="form-control" id="hf_prox" value="${v('proxima_fecha')}">
          </div>
        </div>
        <div class="form-group">
          <label>Hallazgos<span class="required">*</span></label>
          <textarea class="form-control" id="hf_hal" rows="3">${v('hallazgos')}</textarea>
        </div>
        <div class="form-group">
          <label>Recomendaciones</label>
          <textarea class="form-control" id="hf_rec" rows="3">${v('recomendaciones')}</textarea>
        </div>
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-lg',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="hi-saveBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      document.getElementById('hi-saveBtn').addEventListener('click', () => {
        const eq_id    = document.getElementById('hf_eq')?.value;
        const fecha    = document.getElementById('hf_fecha')?.value;
        const hallazgos = document.getElementById('hf_hal')?.value?.trim();
        if (!eq_id || !fecha || !hallazgos) {
          Utils.toast('Requerido','Complete equipo, fecha y hallazgos.','error'); return;
        }
        const data = {
          equipo_id:        eq_id,
          fecha,
          tipo:             document.getElementById('hf_tipo')?.value,
          resultado:        document.getElementById('hf_res')?.value,
          estado:           document.getElementById('hf_est')?.value||'Cerrada',
          tecnico:          document.getElementById('hf_tec')?.value?.trim()||'',
          proxima_fecha:    document.getElementById('hf_prox')?.value||null,
          hallazgos,
          recomendaciones:  document.getElementById('hf_rec')?.value?.trim()||'',
        };
        if (id) { DB.update('inspecciones',id,data); Utils.toast('Actualizado','Inspección actualizada.','success'); }
        else    { DB.insert('inspecciones',data);    Utils.toast('Guardado','Inspección registrada.','success'); }
        Utils.closeModal();
        render();
      });
    }, 50);
  }

  /* ── Delete ─────────────────────────────────────────────── */
  function deleteInsp(id) {
    const ins = DB.getById('inspecciones',id);
    if (!ins) return;
    const eq = DB.getById('equipos',ins.equipo_id);
    Utils.confirm(
      `¿Eliminar inspección del ${Utils.fmtDate(ins.fecha)} para ${eq?.tag||ins.equipo_id}?`,
      () => {
        DB.remove('inspecciones',id);
        Utils.toast('Eliminado','Inspección eliminada.','warning');
        render();
      }
    );
  }

  /* ── CSV Export ─────────────────────────────────────────── */
  function exportCSV() {
    const all = DB.getAll('inspecciones');
    const headers = ['ID','Equipo_TAG','Equipo_Nombre','Fecha','Tipo','Resultado',
      'Técnico','Hallazgos','Recomendaciones','Próxima_Fecha','Estado'];
    const rows = all.map(i => {
      const eq = DB.getById('equipos',i.equipo_id);
      return [i.id, eq?.tag||'', eq?.nombre||'', i.fecha, i.tipo, i.resultado,
        i.tecnico, i.hallazgos, i.recomendaciones, i.proxima_fecha||'', i.estado];
    });
    Utils.exportCSV(headers, rows, `historial_inspecciones_${Utils.today()}.csv`);
  }

  return { render, openNewInspection: () => openForm(null) };
})();
