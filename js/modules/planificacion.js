/**
 * SGIEE – Módulo: Planificación y Programación de Inspecciones (Sección 4.5)
 * Aplica reglas específicas por familia: API 510 (Recipientes), API 570 (Tuberías), API 653 (Tanques - Manto)
 * y sincroniza automáticamente los planes CBM/RBI cuando se ingresan nuevas mediciones o evaluaciones.
 */
const ModPlanificacion = (() => {

  let viewMode     = 'list';
  let filterEstado = '';
  let filterEquipo = '';
  let currentYear  = new Date().getFullYear();
  let page         = 1;
  const PAGE_SIZE  = 15;

  function render() {
    const el = document.getElementById('mod-planificacion');
    if (!el) return;

    syncPlans();

    el.innerHTML = `
      <div class="section-header">
        <h2>Programación de Inspecciones (API 510 / 570 / 653 + RBI)</h2>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" id="plan-viewToggle">${viewMode==='list'?'📅 Calendario':'📋 Lista'}</button>
          <button class="btn btn-secondary btn-sm" id="plan-regen">♻ Sincronizar CBM/RBI</button>
          <button class="btn btn-secondary btn-sm" id="plan-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="plan-newBtn">＋ Nueva Tarea</button>
        </div>
      </div>

      <div class="alert alert-info mb-2">
        <span class="alert-icon">ℹ️</span>
        <div class="text-xs">
          <strong>Reglas normativas por familia:</strong>
          <strong>API 510</strong> (Recipientes): min(RL/2, 10 años) interna/UT; 5 años externa. ·
          <strong>API 570</strong> (Tuberías): min(RL/2, 5 años Clase 1 / 10 años Clases 2–3). ·
          <strong>API 653</strong> (Tanques – alcance sobre manto): min(RL/2, 15 años) con CR conocida ó 5 años sin CR.
          Los planes se actualizan automáticamente al ingresar nuevas mediciones CML o evaluaciones RBI.
        </div>
      </div>

      <div id="plan-kpis" class="mini-stat-row mb-2"></div>
      <div id="plan-alerts"></div>

      <div class="filter-bar">
        <select class="form-control" id="plan-fEq" style="width:240px">
          <option value="">Todos los equipos</option>
          ${DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
            .map(e=>`<option value="${e.id}" ${filterEquipo===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`).join('')}
        </select>
        <select class="form-control" id="plan-fEst" style="width:170px">
          <option value="">Todos los estados</option>
          ${['Programada','En Ejecución','Completada','Vencida','Cancelada']
            .map(s=>`<option ${filterEstado===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>

      <div id="plan-content"></div>
      <div id="plan-pagination"></div>`;

    _bindEvents(el);
    _renderKPIs();
    _renderAlerts();
    _renderContent();
  }

  /**
   * Synchronize (create OR update) active CBM & RBI plans for all equipment
   * without touching completed/manual tasks.
   */
  function syncPlans() {
    const equipos = DB.getAll('equipos');
    const existing = DB.getAll('planes');

    equipos.forEach(eq => {
      // 1) RBI-based plan (update if latest vigente RBI changed)
      const rbi = DB.query('rbi_evaluaciones', r => r.equipo_id === eq.id && r.estado === 'Vigente')
        .sort((a, b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion))[0];
      const existingRBI = existing.find(p => p.equipo_id === eq.id && p.fuente === 'RBI' && p.estado === 'Programada');
      if (rbi && rbi.proxima_inspeccion) {
        const patch = {
          equipo_id:  eq.id,
          fecha_prog: rbi.proxima_inspeccion,
          tipo_insp:  'RBI-Dirigida',
          fuente:     'RBI',
          norma:      'API RP 580 / 581',
          criterio_gobernante: `Intervalo RBI (${rbi.intervalo_inspeccion_a} a) · Riesgo ${rbi.riesgo_categoria} · D_f=${rbi.Df ?? '—'}`,
          riesgo:     rbi.riesgo_color,
          metodos:    _methodsFromRisk(rbi.riesgo_color),
          prioridad:  rbi.riesgo_color === 'vhigh' ? 1 : rbi.riesgo_color === 'high' ? 2 : 3,
          estado:     'Programada',
          notas:      `Sincronizado desde evaluación RBI (${rbi.fecha_evaluacion}). Prioridad: ${rbi.prioridad || ''}`,
          rbi_id:     rbi.id,
        };
        if (existingRBI) DB.update('planes', existingRBI.id, patch);
        else DB.insert('planes', patch);
      }

      // 2) Normative CBM plan (API 510 / API 570 / API 653) using governing CML
      const st = DB.evaluateEquipoStatus(eq.id);
      const ni = st?.nextInsp;
      const existingCBM = existing.find(p => p.equipo_id === eq.id && p.fuente === 'CBM' && p.estado === 'Programada');
      if (ni && ni.proxima_fecha) {
        const riskEst = st.condicion === 'Espesor bajo el mínimo' ? 'vhigh'
          : (st.condicion === 'Alerta' || ni.vencida) ? 'high'
          : (ni.intervalo_a !== null && ni.intervalo_a <= 3) ? 'medium' : 'low';
        const patch = {
          equipo_id:  eq.id,
          fecha_prog: ni.proxima_fecha,
          tipo_insp:  ni.tipo_inspeccion,
          fuente:     'CBM',
          norma:      ni.norma,
          criterio_gobernante: ni.criterio_gobernante,
          declaracion_alcance: ni.declaracion_alcance || '',
          riesgo:     riskEst,
          metodos:    eq.tipo === 'Tanque Atmosférico' ? 'UT manto (virolas API 653)' : 'UT medición de espesores CML',
          prioridad:  riskEst === 'vhigh' ? 1 : riskEst === 'high' ? 2 : 3,
          estado:     'Programada',
          notas:      `Ref: ${ni.fecha_referencia} · Intervalo: ${ni.intervalo_a} a · CML gobernante: ${st.worstCML?.cml?.nombre || '—'}`,
          cml_id:     st.worstCML?.cml?.id || null,
        };
        if (existingCBM) DB.update('planes', existingCBM.id, patch);
        else DB.insert('planes', patch);
      }
    });
  }

  function _renderKPIs() {
    const all  = DB.getAll('planes');
    const hoy  = new Date();
    const venc = all.filter(p => p.estado === 'Programada' && new Date(p.fecha_prog) < hoy).length;
    const prox90 = all.filter(p => {
      if (p.estado !== 'Programada') return false;
      const d = (new Date(p.fecha_prog) - hoy) / (1000 * 3600 * 24);
      return d >= 0 && d <= 90;
    }).length;
    const comp = all.filter(p => p.estado === 'Completada').length;
    const prog = all.filter(p => p.estado === 'Programada').length;

    document.getElementById('plan-kpis').innerHTML = `
      <div class="mini-stat"><div class="ms-label">Total Tareas</div><div class="ms-val" style="color:var(--c-primary)">${all.length}</div></div>
      <div class="mini-stat"><div class="ms-label">Programadas</div><div class="ms-val">${prog}</div></div>
      <div class="mini-stat"><div class="ms-label">Vencidas</div><div class="ms-val" style="color:${venc>0?'var(--c-danger)':'var(--c-success)'}">${venc}</div></div>
      <div class="mini-stat"><div class="ms-label">Próx. 90 días</div><div class="ms-val" style="color:${prox90>0?'var(--c-warning)':'var(--c-success)'}">${prox90}</div></div>
      <div class="mini-stat"><div class="ms-label">Completadas</div><div class="ms-val" style="color:var(--c-success)">${comp}</div></div>`;
  }

  function _renderAlerts() {
    const hoy = new Date();
    const venc = DB.getAll('planes').filter(p => p.estado === 'Programada' && new Date(p.fecha_prog) < hoy);
    if (venc.length === 0) { document.getElementById('plan-alerts').innerHTML = ''; return; }
    const tags = [...new Set(venc.map(p => DB.getById('equipos', p.equipo_id)?.tag || p.equipo_id))].join(', ');
    document.getElementById('plan-alerts').innerHTML = `
      <div class="alert alert-danger mb-2">
        <span class="alert-icon">⛔</span>
        <div><strong>${venc.length} inspección(es) VENCIDA(S):</strong> ${Utils.escHtml(tags)}</div>
      </div>`;
  }

  function _renderContent() {
    const content = document.getElementById('plan-content');
    if (!content) return;
    viewMode === 'calendar' ? _renderCalendar(content) : _renderList(content);
  }

  function _renderList(container) {
    let planes = DB.getAll('planes');
    if (filterEquipo) planes = planes.filter(p => p.equipo_id === filterEquipo);
    if (filterEstado) planes = planes.filter(p => p.estado === filterEstado);

    const hoy = new Date();
    planes.sort((a, b) => {
      const aV = new Date(a.fecha_prog) < hoy && a.estado === 'Programada';
      const bV = new Date(b.fecha_prog) < hoy && b.estado === 'Programada';
      if (aV !== bV) return aV ? -1 : 1;
      return new Date(a.fecha_prog) - new Date(b.fecha_prog);
    });

    const total = planes.length;
    const paged = planes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (total === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>Sin tareas programadas</h3></div>`;
      document.getElementById('plan-pagination').innerHTML = '';
      return;
    }

    const rows = paged.map(p => {
      const eq = DB.getById('equipos', p.equipo_id);
      const days = Utils.daysUntil(p.fecha_prog);
      const isOver = days !== null && days < 0 && p.estado === 'Programada';
      return `<tr ${isOver?'style="background:rgba(217,48,37,.04)"':''}>
        <td>${Utils.vencimientoBadge(p.fecha_prog)}</td>
        <td>
          <strong class="font-mono">${Utils.escHtml(eq?.tag || p.equipo_id)}</strong>
          <div class="text-xs text-muted">${Utils.escHtml(eq?.tipo || '')}</div>
        </td>
        <td><span class="badge badge-muted">${Utils.escHtml(p.tipo_insp || '—')}</span></td>
        <td>
          <span class="badge ${p.fuente==='RBI'?'badge-primary':'badge-info'}">${Utils.escHtml(p.fuente || '—')}</span>
          <div class="text-xs text-muted">${Utils.escHtml(p.norma || '')}</div>
        </td>
        <td class="text-xs" style="max-width:260px">
          <div>${Utils.escHtml(p.criterio_gobernante || p.notas || '—')}</div>
          ${p.declaracion_alcance ? `<div class="text-muted" style="font-size:.7rem">⚠ Alcance: manto (fondo/techo pendientes)</div>` : ''}
        </td>
        <td>${p.riesgo ? Utils.riskBadge(p.riesgo) : '—'}</td>
        <td>${_estadoPlanBadge(p.estado)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-plan-action="view"     data-id="${p.id}" title="Ver / OT">🔍</button>
          <button class="btn btn-ghost btn-sm" data-plan-action="edit"     data-id="${p.id}" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" data-plan-action="complete" data-id="${p.id}" title="Completar" ${p.estado==='Completada'?'disabled':''}>✅</button>
          <button class="btn btn-ghost btn-sm" data-plan-action="del"      data-id="${p.id}" title="Eliminar" style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `<div class="table-wrapper">
      <table class="data-table" id="plan-table">
        <thead><tr>
          <th>Fecha Prog.</th><th>Equipo</th><th>Tipo</th><th>Fuente / Norma</th>
          <th>Criterio Gobernante</th><th>Nivel</th><th>Estado</th><th class="col-actions">Acc.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

    _renderPagination(total);
    _bindTableEvents();
  }

  function _renderCalendar(container) {
    const planes = DB.getAll('planes').filter(p => p.fecha_prog && new Date(p.fecha_prog).getFullYear() === currentYear);
    const months = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(currentYear, i, 1).toLocaleDateString('es-ES', { month: 'short' }),
      month: i,
      items: planes.filter(p => new Date(p.fecha_prog).getMonth() === i)
    }));
    const monthCols = months.map(m => {
      const cells = m.items.map(p => {
        const eq = DB.getById('equipos', p.equipo_id);
        const bg = { vhigh:'#d93025', high:'#e05d20', medium:'#e8a020', low:'#22a06b' }[p.riesgo] || '#1a6fc4';
        return `<div style="background:${bg}18;border-left:3px solid ${bg};border-radius:3px;padding:3px 6px;margin-bottom:3px;font-size:.72rem;cursor:pointer" data-plan-cal="${p.id}">
          <strong>${Utils.escHtml(eq?.tag || p.equipo_id)}</strong> ${Utils.escHtml(p.fuente || '')}
        </div>`;
      }).join('');
      return `<div style="flex:1;min-width:80px;border-right:1px solid var(--c-border)">
        <div style="text-align:center;padding:6px 4px;font-size:.78rem;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--c-border)">${m.label}</div>
        <div style="padding:4px;min-height:80px">${cells}</div>
      </div>`;
    }).join('');

    container.innerHTML = `<div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm" id="cal-prevYear">‹</button>
          <h3>${currentYear}</h3>
          <button class="btn btn-ghost btn-sm" id="cal-nextYear">›</button>
        </div>
      </div>
      <div class="card-body" style="padding:0;overflow-x:auto"><div style="display:flex;min-width:960px">${monthCols}</div></div>
    </div>`;

    document.getElementById('cal-prevYear')?.addEventListener('click', () => { currentYear--; _renderContent(); });
    document.getElementById('cal-nextYear')?.addEventListener('click', () => { currentYear++; _renderContent(); });
    container.querySelectorAll('[data-plan-cal]').forEach(item => item.addEventListener('click', () => _openDetail(item.dataset.planCal)));
  }

  function _estadoPlanBadge(estado) {
    const map = { 'Programada':'badge-primary','En Ejecución':'badge-warning','Completada':'badge-success','Vencida':'badge-danger','Cancelada':'badge-muted' };
    return `<span class="badge ${map[estado]||'badge-muted'}">${Utils.escHtml(estado)}</span>`;
  }

  function _methodsFromRisk(risk) {
    return {
      low:    'Visual externa, UT spot check',
      medium: 'UT escáner 25–50%, Monitoreo CML',
      high:   'UT escáner >50%, TOFD en zonas críticas',
      vhigh:  'Inspección interna, UT 100%, FFS API 579-1',
    }[risk] || 'UT General';
  }

  function _openDetail(id) {
    const p = DB.getById('planes', id);
    if (!p) return;
    const eq = DB.getById('equipos', p.equipo_id);
    Utils.openModal(`📅 Tarea de Inspección – ${eq?.tag || p.equipo_id}`, `
      <div class="form-row cols-2">
        <div class="form-section">
          <div class="form-section-title">Programación</div>
          ${_dRow('Equipo', eq ? `${eq.tag} – ${eq.nombre}` : p.equipo_id)}
          ${_dRow('Tipo', p.tipo_insp)}
          ${_dRow('Fuente / Norma', `${p.fuente} · ${p.norma || ''}`)}
          ${_dRow('Fecha programada', Utils.fmtDate(p.fecha_prog))}
          ${_dRow('Estado', '', true, _estadoPlanBadge(p.estado))}
        </div>
        <div class="form-section">
          <div class="form-section-title">Criterio Gobernante y Métodos</div>
          <p class="text-sm mb-1">${Utils.escHtml(p.criterio_gobernante || '—')}</p>
          ${_dRow('Métodos', p.metodos)}
          ${_dRow('Notas', p.notas || '—')}
          ${p.declaracion_alcance ? `<div class="alert alert-warning mt-1 text-xs"><span>⚠️</span><div>${Utils.escHtml(p.declaracion_alcance)}</div></div>` : ''}
        </div>
      </div>
      <div class="form-section mt-2">
        <div class="form-section-title">Orden de Trabajo</div>
        <div id="wo-area"><button class="btn btn-secondary btn-sm" id="genWOBtn">🖨 Generar OT</button></div>
      </div>`, {
      size: 'modal-lg',
      footerHtml: `<button class="btn btn-secondary" onclick="Utils.closeModal()">Cerrar</button>
                   <button class="btn btn-primary" id="det-editPlanBtn">✏️ Editar</button>
                   <button class="btn btn-success" id="det-completePlanBtn" ${p.estado==='Completada'?'disabled':''}>✅ Completada</button>`
    });
    setTimeout(() => {
      document.getElementById('det-editPlanBtn')?.addEventListener('click', () => { Utils.closeModal(); _openForm(id); });
      document.getElementById('det-completePlanBtn')?.addEventListener('click', () => { _completePlan(id); Utils.closeModal(); });
      document.getElementById('genWOBtn')?.addEventListener('click', () => {
        document.getElementById('wo-area').innerHTML = `<div style="border:2px solid var(--c-border);border-radius:var(--r-md);padding:14px;font-size:.84rem">
          <strong>ORDEN DE TRABAJO OT-${Date.now().toString(36).toUpperCase()}</strong> · Emisión: ${Utils.fmtDate(Utils.today())}<br>
          Equipo: <strong>${Utils.escHtml(eq?.tag||'')}</strong> (${Utils.escHtml(eq?.tipo||'')}) · Fecha: <strong>${Utils.fmtDate(p.fecha_prog)}</strong><br>
          Norma: ${Utils.escHtml(p.norma||'')} · Métodos: ${Utils.escHtml(p.metodos||'')}<br>
          Criterio: ${Utils.escHtml(p.criterio_gobernante||'—')}
          <div class="mt-2"><button class="btn btn-secondary btn-sm" onclick="window.print()">🖨 Imprimir OT</button></div>
        </div>`;
      });
    }, 50);
  }

  function _dRow(label, val, raw = false, rawVal = '') {
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--c-border);font-size:.86rem">
      <span style="color:var(--c-text-muted)">${label}</span>
      <span style="font-weight:600">${raw ? rawVal : Utils.escHtml(String(val || '—'))}</span>
    </div>`;
  }

  function _openForm(id) {
    const p = id ? DB.getById('planes', id) : null;
    const eqOpts = DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
      .map(e=>`<option value="${e.id}" ${p?.equipo_id===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`).join('');
    const v = (f, d='') => Utils.escHtml(p ? (p[f] ?? d) : d);
    const sel = (f, val) => p?.[f] === val ? 'selected' : '';

    Utils.openModal(p ? '✏️ Editar Tarea' : '＋ Nueva Tarea de Inspección', `
      <form id="plan-form">
        <div class="form-row cols-2">
          <div class="form-group"><label>Equipo<span class="required">*</span></label><select class="form-control" id="pf_eq">${eqOpts}</select></div>
          <div class="form-group"><label>Fecha programada<span class="required">*</span></label><input type="date" class="form-control" id="pf_fecha" value="${v('fecha_prog', Utils.today())}"></div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group"><label>Tipo</label><select class="form-control" id="pf_tipo">
            ${['Medición de espesores','Interna','Externa','RBI-Dirigida','UT General','Fondo'].map(t=>`<option ${sel('tipo_insp',t)}>${t}</option>`).join('')}
          </select></div>
          <div class="form-group"><label>Fuente</label><select class="form-control" id="pf_fuente">
            ${['Manual','CBM','RBI','Legal/Normativa'].map(f=>`<option ${sel('fuente',f)}>${f}</option>`).join('')}
          </select></div>
          <div class="form-group"><label>Estado</label><select class="form-control" id="pf_estado">
            ${['Programada','En Ejecución','Completada','Cancelada'].map(s=>`<option ${sel('estado',s)}>${s}</option>`).join('')}
          </select></div>
        </div>
        <div class="form-group"><label>Criterio gobernante</label><input class="form-control" id="pf_crit" value="${v('criterio_gobernante')}"></div>
        <div class="form-group"><label>Métodos</label><input class="form-control" id="pf_metodos" value="${v('metodos')}"></div>
        <div class="form-group"><label>Notas</label><textarea class="form-control" id="pf_notas" rows="2">${v('notas')}</textarea></div>
      </form>`, {
      size: 'modal-lg',
      footerHtml: `<button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
                   <button class="btn btn-primary" id="plan-saveBtn">💾 Guardar</button>`
    });
    setTimeout(() => {
      document.getElementById('plan-saveBtn')?.addEventListener('click', () => {
        const eq_id = document.getElementById('pf_eq')?.value;
        const fecha = document.getElementById('pf_fecha')?.value;
        if (!eq_id || !fecha) { Utils.toast('Requerido', 'Complete equipo y fecha.', 'error'); return; }
        const data = {
          equipo_id: eq_id, fecha_prog: fecha,
          tipo_insp: document.getElementById('pf_tipo')?.value,
          fuente: document.getElementById('pf_fuente')?.value,
          estado: document.getElementById('pf_estado')?.value || 'Programada',
          criterio_gobernante: document.getElementById('pf_crit')?.value?.trim() || '',
          metodos: document.getElementById('pf_metodos')?.value?.trim() || '',
          notas: document.getElementById('pf_notas')?.value?.trim() || '',
          prioridad: 2,
        };
        if (id) DB.update('planes', id, data); else DB.insert('planes', data);
        Utils.toast('Guardado', 'Tarea de inspección guardada.', 'success');
        Utils.closeModal(); render();
      });
    }, 50);
  }

  function _completePlan(id) {
    DB.update('planes', id, { estado: 'Completada', fecha_completado: Utils.today() });
    Utils.toast('Completada', 'Tarea marcada como completada.', 'success');
    render();
  }

  function _deletePlan(id) {
    Utils.confirm('¿Eliminar esta tarea de inspección?', () => {
      DB.remove('planes', id);
      Utils.toast('Eliminado', 'Tarea eliminada.', 'warning');
      render();
    });
  }

  function _renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) { document.getElementById('plan-pagination').innerHTML = ''; return; }
    let html = `<span class="pagination-info">${Math.min((page-1)*PAGE_SIZE+1,total)}–${Math.min(page*PAGE_SIZE,total)} de ${total}</span>`;
    for (let i = 1; i <= pages; i++) html += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
    document.getElementById('plan-pagination').innerHTML = `<div class="pagination">${html}</div>`;
    document.querySelectorAll('#plan-pagination .page-btn[data-p]').forEach(b => b.addEventListener('click', () => { page = parseInt(b.dataset.p, 10); _renderContent(); }));
  }

  function _bindEvents(el) {
    el.querySelector('#plan-newBtn').addEventListener('click', () => _openForm(null));
    el.querySelector('#plan-exportBtn').addEventListener('click', _exportCSV);
    el.querySelector('#plan-regen').addEventListener('click', () => {
      syncPlans();
      Utils.toast('Sincronizado', 'Planes CBM (API 510/570/653) y RBI actualizados.', 'success');
      render();
    });
    el.querySelector('#plan-viewToggle').addEventListener('click', () => {
      viewMode = viewMode === 'list' ? 'calendar' : 'list';
      render();
    });
    el.querySelector('#plan-fEq').addEventListener('change', e => { filterEquipo = e.target.value; page = 1; _renderContent(); });
    el.querySelector('#plan-fEst').addEventListener('change', e => { filterEstado = e.target.value; page = 1; _renderContent(); });
  }

  function _bindTableEvents() {
    document.querySelectorAll('[data-plan-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { planAction, id } = btn.dataset;
        if (planAction === 'view')     _openDetail(id);
        if (planAction === 'edit')     _openForm(id);
        if (planAction === 'complete') _completePlan(id);
        if (planAction === 'del')      _deletePlan(id);
      });
    });
  }

  function _exportCSV() {
    const all = DB.getAll('planes');
    const headers = ['ID','Equipo_TAG','Tipo','Fuente','Norma','Fecha_prog','Criterio_Gobernante','Riesgo','Estado'];
    const rows = all.map(p => {
      const eq = DB.getById('equipos', p.equipo_id);
      return [p.id, eq?.tag||'', p.tipo_insp, p.fuente, p.norma||'', p.fecha_prog, p.criterio_gobernante||'', p.riesgo||'', p.estado];
    });
    Utils.exportCSV(headers, rows, `plan_inspecciones_${Utils.today()}.csv`);
  }

  return { render, syncPlans, openNewTask: () => _openForm(null) };
})();
