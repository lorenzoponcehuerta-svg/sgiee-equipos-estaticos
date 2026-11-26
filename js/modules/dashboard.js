/**
 * SGIEE – Módulo: Dashboard Principal (Sección 6)
 * Panel ejecutivo con filtros por ubicación, familia y condición,
 * KPIs, tabla de estado de integridad, distribución RBI, heatmap de CML y tasas de corrosión.
 */
const ModDashboard = (() => {

  let filterPlanta = '';
  let filterFamilia = '';
  let filterCondicion = '';

  function render() {
    const el = document.getElementById('mod-dashboard');
    if (!el) return;

    if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();

    const allEquipos = DB.getAll('equipos');
    const plantas = [...new Set(allEquipos.map(e => e.planta).filter(Boolean))].sort();
    const familias = [...new Set(allEquipos.map(e => e.tipo).filter(Boolean))].sort();

    // Evaluate status of every equipment
    const evaluated = allEquipos.map(eq => ({ eq, st: DB.evaluateEquipoStatus(eq.id) }));
    const filtered = evaluated.filter(({ eq, st }) => {
      if (filterPlanta && eq.planta !== filterPlanta) return false;
      if (filterFamilia && eq.tipo !== filterFamilia) return false;
      if (filterCondicion && st?.condicion !== filterCondicion) return false;
      return true;
    });

    const filteredIds = new Set(filtered.map(x => x.eq.id));
    const equipos = filtered.map(x => x.eq);
    const cmls    = DB.getAll('cmls').filter(c => filteredIds.has(c.equipo_id));
    const meds    = DB.getAll('mediciones').filter(m => filteredIds.has(m.equipo_id));
    const insps   = DB.getAll('inspecciones').filter(i => filteredIds.has(i.equipo_id));
    const rbis    = DB.getAll('rbi_evaluaciones').filter(r => filteredIds.has(r.equipo_id));
    const planes  = DB.getAll('planes').filter(p => filteredIds.has(p.equipo_id));

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="font-size:1.3rem;font-weight:700">Panel de Integridad de Equipos Estáticos</h2>
          <p class="text-muted text-sm">
            ${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            · SGIEE v2.0 · ASME B31.3 / ASME VIII Div.1 / API 650 / API 510-570-653 / API RP 580-581
          </p>
        </div>
      </div>

      <!-- Filtros por ubicación, familia y condición (Sección 6) -->
      <div class="card mb-2">
        <div class="card-body" style="padding:12px 16px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <span class="text-xs font-bold text-muted" style="text-transform:uppercase">Filtros:</span>
            <select class="form-control" id="dash-fPlanta" style="width:210px">
              <option value="">Todas las ubicaciones</option>
              ${plantas.map(p => `<option value="${Utils.escHtml(p)}" ${filterPlanta===p?'selected':''}>${Utils.escHtml(p)}</option>`).join('')}
            </select>
            <select class="form-control" id="dash-fFamilia" style="width:190px">
              <option value="">Todas las familias</option>
              ${familias.map(f => `<option value="${Utils.escHtml(f)}" ${filterFamilia===f?'selected':''}>${Utils.escHtml(f)}</option>`).join('')}
            </select>
            <select class="form-control" id="dash-fCond" style="width:205px">
              <option value="">Todas las condiciones</option>
              ${['Normal','Alerta','Espesor bajo el mínimo','Inspección vencida','Información insuficiente']
                .map(c => `<option value="${c}" ${filterCondicion===c?'selected':''}>${c}</option>`).join('')}
            </select>
            ${(filterPlanta || filterFamilia || filterCondicion)
              ? `<button class="btn btn-ghost btn-sm" id="dash-clearFilters">✕ Limpiar filtros</button>` : ''}
            <span class="text-xs text-muted" style="margin-left:auto">Mostrando <strong>${equipos.length}</strong> de ${allEquipos.length} equipos</span>
          </div>
        </div>
      </div>

      <!-- KPI cards -->
      <div class="kpi-grid" id="dash-kpis"></div>

      <!-- Alert banner -->
      <div id="dash-alerts"></div>

      <!-- Tabla resumen de equipos filtrados -->
      <div class="card mt-2 mb-2">
        <div class="card-header">
          <h3>🏭 Resumen de Integridad por Equipo</h3>
          <button class="btn btn-ghost btn-sm" data-nav="equipos">Gestionar equipos →</button>
        </div>
        <div class="card-body" style="padding:0" id="dash-eqTable"></div>
      </div>

      <!-- Main grid -->
      <div class="grid-2 dashboard-main-grid mt-2" style="gap:20px">
        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card">
            <div class="card-header"><h3>📊 Distribución de Riesgo (RBI API 581)</h3></div>
            <div class="card-body" id="dash-riskDist"></div>
          </div>
          <div class="card">
            <div class="card-header"><h3>🔥 Estado de CMLs – Margen de Pared</h3></div>
            <div class="card-body" id="dash-cmlHeat"></div>
          </div>
          <div class="card">
            <div class="card-header"><h3>📉 Tasas de Corrosión Adoptadas por Equipo</h3></div>
            <div class="card-body" id="dash-crChart"></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card">
            <div class="card-header">
              <h3>📅 Próximas Inspecciones y Vencidas</h3>
              <button class="btn btn-ghost btn-sm" data-nav="planificacion">Ver programación →</button>
            </div>
            <div class="card-body" style="padding:0" id="dash-upcoming"></div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3>⚠ Ranking de Riesgo RBI (R_A y R_E)</h3>
              <button class="btn btn-ghost btn-sm" data-nav="rbi">Ir a RBI →</button>
            </div>
            <div class="card-body" style="padding:0" id="dash-rbiRank"></div>
          </div>
          <div class="card">
            <div class="card-header"><h3>🕐 Actividad Reciente</h3></div>
            <div class="card-body" id="dash-activity"></div>
          </div>
          <div class="card">
            <div class="card-header"><h3>⚡ Acciones Rápidas</h3></div>
            <div class="card-body" id="dash-quick"></div>
          </div>
        </div>
      </div>`;

    _renderKPIs(filtered, cmls, rbis, planes);
    _renderAlerts(filtered, planes, insps);
    _renderEquipoTable(filtered);
    _renderRiskDist(rbis);
    _renderCMLHeat(equipos, cmls);
    _renderCRChart(filtered);
    _renderUpcoming(planes);
    _renderRBIRank(rbis);
    _renderActivity(insps, meds);
    _renderQuickActions();
    _bindDashboardEvents(el);
  }

  function _renderKPIs(filtered, cmls, rbis, planes) {
    const hoy  = new Date();
    const venc = planes.filter(p => p.estado === 'Programada' && p.fecha_prog && new Date(p.fecha_prog) < hoy).length;
    const bajoMin = filtered.filter(x => x.st?.condicion === 'Espesor bajo el mínimo').length;
    const alerta  = filtered.filter(x => x.st?.condicion === 'Alerta').length;
    const altoRBI = rbis.filter(r => ['high','vhigh'].includes(r.riesgo_color)).length;

    const kpis = [
      { label:'Equipos Filtrados', value: filtered.length, cls:'kpi-primary', icon:'🗄', sub:`${cmls.length} CMLs vinculados`, nav:'equipos' },
      { label:'Bajo Mínimo', value: bajoMin, cls: bajoMin > 0 ? 'kpi-danger':'kpi-success', icon:'⛔', sub: bajoMin > 0 ? 'Acción inmediata' : 'Sin críticos', nav:'cml' },
      { label:'En Alerta', value: alerta, cls: alerta > 0 ? 'kpi-warning':'kpi-success', icon:'⚠️', sub:'t_med ≤ t_alerta', nav:'cml' },
      { label:'Insp. Vencidas', value: venc, cls: venc > 0 ? 'kpi-danger':'kpi-success', icon:'⏰', sub: venc > 0 ? 'Reprogramar' : 'Al día', nav:'planificacion' },
      { label:'RBI Alto / Muy Alto', value: altoRBI, cls: altoRBI > 0 ? 'kpi-danger':'kpi-success', icon:'⚠', sub:`de ${rbis.length} evaluaciones`, nav:'rbi' },
    ];

    document.getElementById('dash-kpis').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}" data-nav="${k.nav}" style="cursor:pointer">
        <span class="kpi-icon">${k.icon}</span>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`).join('');
  }

  function _renderAlerts(filtered, planes, insps) {
    const hoy = new Date();
    const bajoMin = filtered.filter(x => x.st?.condicion === 'Espesor bajo el mínimo');
    const pVenc = planes.filter(p => p.estado === 'Programada' && p.fecha_prog && new Date(p.fecha_prog) < hoy);
    const iAbiertas = insps.filter(i => i.estado === 'Abierta');

    let html = '';
    if (bajoMin.length > 0) {
      html += `<div class="alert alert-danger mb-1"><span class="alert-icon">⛔</span>
        <div><strong>${bajoMin.length} equipo(s) con ESPESOR BAJO EL MÍNIMO:</strong> ${bajoMin.map(x => Utils.escHtml(x.eq.tag)).join(', ')}
          <button class="btn btn-ghost btn-sm" data-nav="cml" data-nav-param="${bajoMin[0].eq.id}" style="margin-left:10px">Revisar CML →</button>
        </div></div>`;
    }
    if (pVenc.length > 0) {
      const tags = [...new Set(pVenc.map(p => DB.getById('equipos', p.equipo_id)?.tag || p.equipo_id))].join(', ');
      html += `<div class="alert alert-danger mb-1"><span class="alert-icon">⏰</span>
        <div><strong>${pVenc.length} tarea(s) de inspección VENCIDA(S):</strong> ${Utils.escHtml(tags)}
          <button class="btn btn-ghost btn-sm" data-nav="planificacion" style="margin-left:10px">Ver programación →</button>
        </div></div>`;
    }
    if (iAbiertas.length > 0) {
      html += `<div class="alert alert-warning mb-1"><span class="alert-icon">⚠️</span>
        <div><strong>${iAbiertas.length} hallazgo(s) abierto(s)</strong> en historial de inspecciones.
          <button class="btn btn-ghost btn-sm" data-nav="historial" style="margin-left:10px">Revisar →</button>
        </div></div>`;
    }
    document.getElementById('dash-alerts').innerHTML = html;
  }

  function _renderEquipoTable(filtered) {
    const host = document.getElementById('dash-eqTable');
    if (!host) return;
    if (filtered.length === 0) {
      host.innerHTML = `<div class="empty-state" style="padding:20px"><p>Ningún equipo coincide con los filtros seleccionados.</p></div>`;
      return;
    }
    const rows = filtered.map(({ eq, st }) => {
      const worst = st?.worstCML;
      const rlTxt = st && isFinite(st.minRL) ? `${st.minRL.toFixed(1)} a` : '—';
      const ni = st?.nextInsp;
      return `<tr>
        <td><strong class="font-mono">${Utils.escHtml(eq.tag)}</strong><div class="text-xs text-muted">${Utils.escHtml(eq.nombre)}</div></td>
        <td><span class="badge badge-muted">${Utils.escHtml(eq.tipo)}</span><div class="text-xs text-muted">${Utils.escHtml(eq.norma_diseno||'')}</div></td>
        <td class="text-xs">${Utils.escHtml([eq.planta, eq.area].filter(Boolean).join(' · '))}</td>
        <td class="font-mono text-xs">${worst?.last ? `${Number(worst.last.espesor_mm).toFixed(2)} / ${eq.espesor_minimo_mm ?? '—'} mm` : '—'}</td>
        <td>${Utils.crBadge(st?.maxCR ?? null)}</td>
        <td class="font-bold ${Utils.rlClass(st?.minRL ?? Infinity)}">${rlTxt}</td>
        <td>${ni ? Utils.vencimientoBadge(ni.proxima_fecha) : '—'}</td>
        <td>${Utils.condicionBadge(st?.condicion)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-nav="cml" data-nav-param="${eq.id}" title="CML / Mediciones">📍</button>
          <button class="btn btn-ghost btn-sm" data-nav="isometricos" data-nav-param="${eq.id}" title="Esquema">📐</button>
        </td>
      </tr>`;
    }).join('');
    host.innerHTML = `<div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Equipo</th><th>Familia / Código</th><th>Ubicación</th><th>t_med / t_mín</th>
          <th>CR máx.</th><th>RL mín.</th><th>Próx. Insp.</th><th>Condición</th><th class="col-actions">Ir</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function _renderRiskDist(rbis) {
    const dist = { low:0, medium:0, high:0, vhigh:0 };
    rbis.forEach(r => { if (dist[r.riesgo_color] !== undefined) dist[r.riesgo_color]++; });
    const total = rbis.length || 1;
    const labels = { low:'Bajo', medium:'Medio', high:'Alto', vhigh:'Muy Alto' };
    const colors = { low:'#22a06b', medium:'#e8a020', high:'#e05d20', vhigh:'#d93025' };

    if (rbis.length === 0) {
      document.getElementById('dash-riskDist').innerHTML = '<p class="text-muted text-sm">Sin evaluaciones RBI para los filtros actuales.</p>';
      return;
    }

    const bars = Object.entries(dist).map(([k, v]) => {
      const pct = ((v / total) * 100).toFixed(1);
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:${colors[k]}"></span><span class="text-sm font-bold">${labels[k]}</span></span>
          <span class="text-sm font-mono">${v} (${pct}%)</span>
        </div>
        <div class="progress-bar" style="height:9px"><div style="height:100%;width:${pct}%;background:${colors[k]};border-radius:4px"></div></div>
      </div>`;
    }).join('');

    const R = 40, CX = 50, CY = 50, strokeW = 18;
    const circumference = 2 * Math.PI * R;
    let offset = 0;
    const slices = Object.entries(dist).filter(([, v]) => v > 0).map(([k, v]) => {
      const dash = (v / total) * circumference;
      const slice = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${colors[k]}" stroke-width="${strokeW}"
        stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${CX} ${CY})"/>`;
      offset += dash;
      return slice;
    }).join('');

    document.getElementById('dash-riskDist').innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <svg width="100" height="100" viewBox="0 0 100 100" style="flex-shrink:0">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--c-border)" stroke-width="${strokeW}"/>
          ${slices}
          <text x="${CX}" y="${CY+5}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--c-text-primary)">${rbis.length}</text>
        </svg>
        <div style="flex:1">${bars}</div>
      </div>`;
  }

  function _renderCMLHeat(equipos, cmls) {
    const container = document.getElementById('dash-cmlHeat');
    if (!container) return;
    if (equipos.length === 0) { container.innerHTML = '<p class="text-muted text-sm">Sin equipos.</p>'; return; }

    const cells = equipos.map(eq => {
      const eqCmls = cmls.filter(c => c.equipo_id === eq.id);
      if (eqCmls.length === 0) {
        return `<div data-nav="cml" data-nav-param="${eq.id}" style="text-align:center;padding:8px;border:1px dashed var(--c-border);border-radius:var(--r-md);cursor:pointer">
          <div class="font-mono text-sm font-bold">${Utils.escHtml(eq.tag)}</div><div class="text-xs text-muted">Sin CMLs</div></div>`;
      }
      let worstPct = 100;
      eqCmls.forEach(c => {
        const lm = DB.lastMedicion(c.id);
        if (lm && eq.espesor_nominal_mm && eq.espesor_minimo_mm) {
          const pct = Utils.clamp(((lm.espesor_mm - eq.espesor_minimo_mm) / (eq.espesor_nominal_mm - eq.espesor_minimo_mm || 1)) * 100, 0, 100);
          if (pct < worstPct) worstPct = pct;
        }
      });
      const bg = worstPct < 20 ? '#d9302520' : worstPct < 40 ? '#e8a02018' : worstPct < 70 ? '#e8f0fe' : '#22a06b15';
      const bd = worstPct < 20 ? '#d93025' : worstPct < 40 ? '#e8a020' : worstPct < 70 ? '#1a6fc4' : '#22a06b';
      const icon = worstPct < 20 ? '🔴' : worstPct < 40 ? '🟠' : worstPct < 70 ? '🔵' : '🟢';
      return `<div data-nav="cml" data-nav-param="${eq.id}" style="text-align:center;padding:8px;background:${bg};border:1px solid ${bd};border-radius:var(--r-md);cursor:pointer" title="Ir a CML de ${eq.tag}">
        <div class="font-mono text-sm font-bold">${Utils.escHtml(eq.tag)}</div>
        <div>${icon}</div>
        <div style="font-size:.72rem;color:${bd};font-weight:700">${worstPct.toFixed(0)}%</div>
        <div class="text-xs text-muted">${eqCmls.length} CML</div>
      </div>`;
    }).join('');

    container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:8px">${cells}</div>
      <div class="text-xs text-muted mt-2">🟢 &gt;70% · 🔵 40–70% · 🟠 20–40% · 🔴 &lt;20% margen sobre t_mín</div>`;
  }

  function _renderCRChart(filtered) {
    const container = document.getElementById('dash-crChart');
    if (!container) return;
    const data = filtered.map(({ eq, st }) => ({
      id: eq.id,
      tag: eq.tag,
      cr: st?.maxCR || 0,
      rl: st?.minRL ?? Infinity,
    })).filter(d => d.cr > 0).sort((a, b) => b.cr - a.cr);

    if (data.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">Sin tasas de corrosión activas para los filtros actuales.</p>';
      return;
    }

    const maxCR = Math.max(...data.map(d => d.cr)) * 1.15 || 1;
    const W = 500, H = data.length * 32 + 16, barH = 20;
    const bars = data.map((d, i) => {
      const barW = (d.cr / maxCR) * (W - 160);
      const y = i * 32 + 8;
      const color = d.cr > 0.5 ? '#d93025' : d.cr > 0.1 ? '#e8a020' : '#22a06b';
      const rlStr = isFinite(d.rl) ? (d.rl < 0 ? 'Bajo mín.' : `RL ${d.rl.toFixed(1)}a`) : '∞';
      return `<g data-nav="cml" data-nav-param="${d.id}" style="cursor:pointer">
        <text x="0" y="${y + 14}" font-size="11" font-weight="700" fill="var(--c-text-primary)">${Utils.escHtml(d.tag)}</text>
        <rect x="70" y="${y}" width="${Math.max(barW, 4)}" height="${barH}" rx="3" fill="${color}" opacity=".85"/>
        <text x="${70 + Math.max(barW, 4) + 6}" y="${y + 14}" font-size="10" font-weight="700" fill="${color}" font-family="Consolas,monospace">${d.cr.toFixed(3)} mm/a</text>
        <text x="${W - 4}" y="${y + 14}" font-size="9.5" text-anchor="end" fill="var(--c-text-muted)">${rlStr}</text>
      </g>`;
    }).join('');

    container.innerHTML = `<div style="overflow-x:auto"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%">${bars}</svg></div>`;
  }

  function _renderUpcoming(planes) {
    const upcoming = planes
      .filter(p => p.estado !== 'Completada' && p.estado !== 'Cancelada')
      .sort((a, b) => new Date(a.fecha_prog) - new Date(b.fecha_prog))
      .slice(0, 6);
    const container = document.getElementById('dash-upcoming');
    if (!container) return;
    if (upcoming.length === 0) { container.innerHTML = '<div class="empty-state" style="padding:18px"><p>Sin tareas programadas.</p></div>'; return; }

    container.innerHTML = upcoming.map(p => {
      const eq = DB.getById('equipos', p.equipo_id);
      const days = Utils.daysUntil(p.fecha_prog);
      const isOver = days !== null && days < 0;
      return `<div data-nav="planificacion" style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--c-border);cursor:pointer;${isOver?'background:rgba(217,48,37,.04)':''}">
        <div style="min-width:54px;text-align:center">
          <div style="font-size:1.05rem;font-weight:800;color:${isOver?'var(--c-danger)':days<=30?'var(--c-warning)':'var(--c-primary)'}">${isOver ? Math.abs(days)+'d' : days+'d'}</div>
          <div class="text-xs text-muted">${isOver ? 'vencida' : 'rest.'}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="font-bold text-sm">${Utils.escHtml(eq?.tag || p.equipo_id)} · ${Utils.escHtml(p.tipo_insp || '')}</div>
          <div class="text-xs text-muted">${Utils.fmtDate(p.fecha_prog)} · ${Utils.escHtml(Utils.truncate(p.criterio_gobernante || p.notas || '', 65))}</div>
        </div>
        <span class="badge ${p.fuente==='RBI'?'badge-primary':'badge-info'}">${Utils.escHtml(p.fuente || '')}</span>
      </div>`;
    }).join('');
  }

  function _renderRBIRank(rbis) {
    const container = document.getElementById('dash-rbiRank');
    if (!container) return;
    const latest = {};
    rbis.forEach(r => {
      if (!latest[r.equipo_id] || new Date(r.fecha_evaluacion) > new Date(latest[r.equipo_id].fecha_evaluacion)) latest[r.equipo_id] = r;
    });
    const order = { vhigh: 0, high: 1, medium: 2, low: 3 };
    const sorted = Object.values(latest).sort((a, b) => (order[a.riesgo_color] ?? 4) - (order[b.riesgo_color] ?? 4));
    if (sorted.length === 0) { container.innerHTML = '<div class="empty-state" style="padding:18px"><p>Sin evaluaciones RBI.</p></div>'; return; }

    container.innerHTML = sorted.map((r, i) => {
      const eq = DB.getById('equipos', r.equipo_id);
      return `<div data-nav="rbi" style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--c-border);cursor:pointer">
        <div style="font-weight:800;color:var(--c-text-muted);min-width:20px">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div class="font-bold text-sm">${Utils.escHtml(eq?.tag || r.equipo_id)} – ${Utils.escHtml(eq?.nombre || '')}</div>
          <div class="text-xs text-muted font-mono">D_f=${r.Df ?? '—'} · R_A=${Utils.fmtSci(r.R_A, 2)} m²/a · R_E=${Utils.fmtSci(r.R_E, 1)} ${r.moneda||'USD'}/a</div>
        </div>
        <div>${Utils.riskBadge(r.riesgo_color)}</div>
      </div>`;
    }).join('');
  }

  function _renderActivity(insps, meds) {
    const container = document.getElementById('dash-activity');
    if (!container) return;
    const events = [
      ...insps.map(i => ({
        date: i.fecha, icon: '🔍',
        text: `Inspección ${i.tipo} – ${DB.getById('equipos', i.equipo_id)?.tag || i.equipo_id}`,
        nav: 'historial', navParam: '', badge: Utils.resultadoBadge(i.resultado)
      })),
      ...meds.map(m => {
        const cml = DB.getById('cmls', m.cml_id);
        const eq = DB.getById('equipos', m.equipo_id || cml?.equipo_id);
        const min = Number(eq?.espesor_minimo_mm);
        const badge = min > 0
          ? `<span class="badge ${Number(m.espesor_mm) < min ? 'badge-danger' : 'badge-success'}">${Number(m.espesor_mm) < min ? 'Bajo mín.' : 'OK'}</span>`
          : '';
        return {
          date: m.fecha, icon: '📏',
          text: `${Number(m.espesor_mm).toFixed(2)} mm – ${cml?.nombre || m.cml_id} (${eq?.tag || ''})`,
          nav: 'cml', navParam: eq?.id || '', badge
        };
      })
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

    if (events.length === 0) { container.innerHTML = '<p class="text-muted text-sm">Sin actividad reciente.</p>'; return; }
    container.innerHTML = `<div class="timeline">${events.map(e => `
      <div class="timeline-item" data-nav="${e.nav}" data-nav-param="${e.navParam}" style="cursor:pointer">
        <div class="timeline-date">${Utils.fmtDate(e.date)}</div>
        <div class="timeline-title">${e.icon} ${Utils.escHtml(e.text)} ${e.badge}</div>
      </div>`).join('')}</div>`;
  }

  function _renderQuickActions() {
    const container = document.getElementById('dash-quick');
    if (!container) return;
    const actions = [
      { icon:'📏', label:'Nueva Medición CML', nav:'cml', action:'openNewMeasurement', color:'var(--c-success)' },
      { icon:'🔧', label:'Calcular Espesores', nav:'espesores', color:'var(--c-primary)' },
      { icon:'⚠',  label:'Evaluar RBI (581)',  nav:'rbi', color:'var(--c-warning)' },
      { icon:'📐', label:'Esquemas / PNG',     nav:'isometricos', color:'var(--c-accent)' },
      { icon:'📅', label:'Programación API',   nav:'planificacion', color:'var(--c-info)' },
      { icon:'✔',  label:'Validaciones',       nav:'validacion', color:'var(--c-primary)' },
    ];
    container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${actions.map(a => `<button class="btn btn-secondary w-full" data-quick-nav="${a.nav}" data-quick-action="${a.action || ''}"
        style="flex-direction:column;padding:10px 6px;gap:5px;height:66px;border-left:3px solid ${a.color}">
        <span style="font-size:1.2rem">${a.icon}</span>
        <span style="font-size:.73rem;text-align:center;line-height:1.2">${a.label}</span>
      </button>`).join('')}
    </div>`;
    container.querySelectorAll('[data-quick-nav]').forEach(b =>
      b.addEventListener('click', () => window.App?.navigate(b.dataset.quickNav, null, b.dataset.quickAction || null))
    );
  }

  function _bindDashboardEvents(el) {
    el.querySelector('#dash-fPlanta')?.addEventListener('change', e => { filterPlanta = e.target.value; render(); });
    el.querySelector('#dash-fFamilia')?.addEventListener('change', e => { filterFamilia = e.target.value; render(); });
    el.querySelector('#dash-fCond')?.addEventListener('change', e => { filterCondicion = e.target.value; render(); });
    el.querySelector('#dash-clearFilters')?.addEventListener('click', () => {
      filterPlanta = ''; filterFamilia = ''; filterCondicion = ''; render();
    });

    el.addEventListener('click', e => {
      const navTarget = e.target.closest('[data-nav]');
      if (navTarget) {
        e.preventDefault();
        window.App?.navigate(navTarget.dataset.nav, navTarget.dataset.navParam || null);
      }
    });
  }

  return { render };
})();
