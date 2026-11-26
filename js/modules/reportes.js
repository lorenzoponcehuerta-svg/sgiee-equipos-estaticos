/**
 * SGIEE – Módulo: Reportes
 * Printable / exportable reports: Equipment Register, CML Summary,
 * RBI Portfolio, Inspection History, Upcoming Schedule
 */
const ModReportes = (() => {

  function render() {
    const el = document.getElementById('mod-reportes');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Reportes y Exportaciones</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="rep-printAll">🖨 Imprimir vista actual</button>
        </div>
      </div>

      <div class="alert alert-info mb-2">
        <span class="alert-icon">ℹ️</span>
        <div>Seleccione un reporte para generarlo. Todos los reportes pueden imprimirse o exportarse a CSV.</div>
      </div>

      <!-- Report cards -->
      <div class="grid-auto mb-3" id="rep-cards"></div>

      <!-- Report output -->
      <div id="rep-output"></div>`;

    _renderReportCards(el);
    el.querySelector('#rep-printAll').addEventListener('click', () => window.print());
  }

  /* ── Report card grid ───────────────────────────────────── */
  function _renderReportCards(el) {
    const reports = [
      { id:'equipo_register', icon:'🗄', title:'Registro de Equipos',
        desc:'Lista completa de equipos con datos de diseño, material y estado.',
        color:'var(--c-primary)' },
      { id:'cml_summary', icon:'📍', title:'Resumen CML / TML',
        desc:'Estado de todos los puntos de monitoreo: espesores, tasas de corrosión y vida remanente.',
        color:'var(--c-success)' },
      { id:'rbi_portfolio', icon:'⚠', title:'Portfolio RBI',
        desc:'Evaluaciones de riesgo vigentes ordenadas por nivel (Muy Alto → Bajo).',
        color:'var(--c-danger)' },
      { id:'insp_history', icon:'📋', title:'Historial de Inspecciones',
        desc:'Registro completo de inspecciones, hallazgos y recomendaciones.',
        color:'var(--c-info)' },
      { id:'upcoming_schedule', icon:'📅', title:'Programa de Inspecciones',
        desc:'Tareas programadas ordenadas por fecha con indicadores de vencimiento.',
        color:'var(--c-warning)' },
      { id:'corrosion_rates', icon:'📉', title:'Tasas de Corrosión',
        desc:'Tabla de tasas por CML con clasificación y tendencia.',
        color:'var(--c-accent)' },
    ];

    document.getElementById('rep-cards').innerHTML = reports.map(r => `
      <div class="card" style="cursor:pointer;transition:box-shadow .15s;border-top:4px solid ${r.color}"
        data-rep="${r.id}">
        <div class="card-body" style="padding:18px">
          <div style="font-size:1.8rem;margin-bottom:8px">${r.icon}</div>
          <div style="font-weight:700;margin-bottom:4px">${r.title}</div>
          <div class="text-sm text-muted">${r.desc}</div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-primary btn-sm" data-rep-gen="${r.id}">📊 Generar</button>
            <button class="btn btn-secondary btn-sm" data-rep-csv="${r.id}">⬇ CSV</button>
          </div>
        </div>
      </div>`).join('');

    document.querySelectorAll('[data-rep-gen]').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); _generateReport(b.dataset.repGen); })
    );
    document.querySelectorAll('[data-rep-csv]').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); _exportReport(b.dataset.repCsv); })
    );
  }

  /* ── Report generators ──────────────────────────────────── */
  function _generateReport(id) {
    const output = document.getElementById('rep-output');
    output.innerHTML = '<div class="text-muted text-sm" style="padding:12px">Generando…</div>';
    setTimeout(() => {
      switch(id) {
        case 'equipo_register':   output.innerHTML = _repEquipos(); break;
        case 'cml_summary':       output.innerHTML = _repCML(); break;
        case 'rbi_portfolio':     output.innerHTML = _repRBI(); break;
        case 'insp_history':      output.innerHTML = _repInspecciones(); break;
        case 'upcoming_schedule': output.innerHTML = _repProgramacion(); break;
        case 'corrosion_rates':   output.innerHTML = _repCorrosion(); break;
      }
      output.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 60);
  }

  /* ── CSV Export router ──────────────────────────────────── */
  function _exportReport(id) {
    switch(id) {
      case 'equipo_register':   _csvEquipos(); break;
      case 'cml_summary':       _csvCML(); break;
      case 'rbi_portfolio':     _csvRBI(); break;
      case 'insp_history':      _csvInspecciones(); break;
      case 'upcoming_schedule': _csvProgramacion(); break;
      case 'corrosion_rates':   _csvCorrosion(); break;
    }
  }

  /* ── Report header helper ───────────────────────────────── */
  function _repHeader(title, subtitle = '') {
    return `
      <div class="card mb-2">
        <div class="card-header" style="background:var(--c-surface-2)">
          <div>
            <h2 style="font-size:1.1rem">${title}</h2>
            ${subtitle ? `<div class="text-sm text-muted">${subtitle}</div>` : ''}
          </div>
          <div class="text-sm text-muted">
            Generado: ${Utils.fmtDatetime(new Date().toISOString())}
            <button class="btn btn-secondary btn-sm ml-auto" style="margin-left:12px" onclick="window.print()">🖨 Imprimir</button>
          </div>
        </div>
      </div>`;
  }

  /* ── 1. Equipment Register ──────────────────────────────── */
  function _repEquipos() {
    const all = DB.getAll('equipos').sort((a,b) => a.tag.localeCompare(b.tag));
    const rows = all.map(e => `<tr>
      <td class="font-mono font-bold">${Utils.escHtml(e.tag)}</td>
      <td>${Utils.escHtml(e.nombre)}</td>
      <td>${Utils.escHtml(e.tipo)}</td>
      <td>${Utils.escHtml(e.planta)}</td>
      <td>${Utils.escHtml(e.material)}</td>
      <td>${e.presion_diseno_kPa ? (e.presion_diseno_kPa/1000).toFixed(2)+' MPa' : '—'}</td>
      <td>${e.temp_diseno_C ? e.temp_diseno_C+'°C' : '—'}</td>
      <td>${e.espesor_nominal_mm ? e.espesor_nominal_mm+'mm' : '—'}</td>
      <td>${e.espesor_minimo_mm  ? e.espesor_minimo_mm +'mm' : '—'}</td>
      <td>${Utils.criticidadBadge(e.criticidad)}</td>
      <td>${Utils.estadoBadge(e.estado)}</td>
    </tr>`).join('');

    return _repHeader('Registro de Equipos Estáticos', `${all.length} equipos`)
      + `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>TAG</th><th>Nombre</th><th>Tipo</th><th>Planta</th><th>Material</th>
            <th>P Diseño</th><th>T Diseño</th><th>t_nom</th><th>t_min</th>
            <th>Criticidad</th><th>Estado</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _csvEquipos() {
    const all = DB.getAll('equipos');
    Utils.exportCSV(
      ['TAG','Nombre','Tipo','Planta','Sistema','Fluido','Material',
       'P_kPa','T_C','D_mm','L_mm','t_nom_mm','t_min_mm','CA_mm',
       'Criticidad','Estado','Norma','Fab.','Instalación'],
      all.map(e => [e.tag,e.nombre,e.tipo,e.planta,e.sistema,e.fluido,e.material,
        e.presion_diseno_kPa,e.temp_diseno_C,e.diametro_mm,e.longitud_mm,
        e.espesor_nominal_mm,e.espesor_minimo_mm,e.ca_mm,
        e.criticidad,e.estado,e.norma_diseno,e.fecha_fabricacion,e.fecha_instalacion]),
      `reporte_equipos_${Utils.today()}.csv`
    );
  }

  /* ── 2. CML Summary ─────────────────────────────────────── */
  function _repCML() {
    const cmls = DB.getAll('cmls');
    const rows = cmls.map(c => {
      const eq  = DB.getById('equipos', c.equipo_id);
      const lm  = DB.lastMedicion(c.id);
      const cr  = DB.calcCorrosionRate(c.id);
      const rl  = eq ? DB.remainingLife(c.id, eq.espesor_minimo_mm) : Infinity;
      const cbm = eq ? DB.nextInspectionCBM(c.id, eq.espesor_minimo_mm) : null;

      const rlCls = Utils.rlClass(rl);
      const rlTxt = isFinite(rl) ? rl.toFixed(2)+' a' : '∞';

      return `<tr>
        <td class="font-mono">${Utils.escHtml(eq?.tag||c.equipo_id)}</td>
        <td class="font-bold">${Utils.escHtml(c.nombre)}</td>
        <td>${Utils.escHtml(c.descripcion||'—')}</td>
        <td class="font-mono">${lm ? lm.espesor_mm+' mm' : '—'}</td>
        <td>${Utils.fmtDate(lm?.fecha)}</td>
        <td>${Utils.crBadge(cr)}</td>
        <td class="${rlCls} font-bold">${rlTxt}</td>
        <td>${cbm ? Utils.round(cbm,2)+' a' : '—'}</td>
        <td>${eq?.espesor_minimo_mm ? eq.espesor_minimo_mm+' mm' : '—'}</td>
        <td>${c.activo ? '✅' : '⬜'}</td>
      </tr>`;
    }).join('');

    return _repHeader('Resumen CML / TML – Estado de Monitoreo', `${cmls.length} puntos`)
      + `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Equipo</th><th>CML</th><th>Descripción</th>
            <th>Últ. Esp.</th><th>Fecha</th><th>Tasa Corr.</th>
            <th>Vida Rem.</th><th>Intervalo CBM</th><th>t_min</th><th>Activo</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _csvCML() {
    const cmls = DB.getAll('cmls');
    Utils.exportCSV(
      ['Equipo_TAG','CML','Descripción','Últ_Esp_mm','Fecha_Últ','CR_mmpa','RL_a','CBM_intervalo_a','t_min_mm','Activo'],
      cmls.map(c => {
        const eq = DB.getById('equipos', c.equipo_id);
        const lm = DB.lastMedicion(c.id);
        const cr = DB.calcCorrosionRate(c.id);
        const rl = eq ? DB.remainingLife(c.id, eq.espesor_minimo_mm) : Infinity;
        const cbm = eq ? DB.nextInspectionCBM(c.id, eq.espesor_minimo_mm) : null;
        return [eq?.tag||'', c.nombre, c.descripcion||'',
          lm?.espesor_mm||'', lm?.fecha||'',
          cr!==null ? cr.toFixed(4) : '', isFinite(rl) ? rl.toFixed(2) : '',
          cbm ? Utils.round(cbm,2) : '', eq?.espesor_minimo_mm||'', c.activo?'Sí':'No'];
      }),
      `reporte_cml_${Utils.today()}.csv`
    );
  }

  /* ── 3. RBI Portfolio ───────────────────────────────────── */
  function _repRBI() {
    const order = { vhigh:0, high:1, medium:2, low:3 };
    const rbis = DB.getAll('rbi_evaluaciones')
      .sort((a,b) => (order[a.riesgo_color]??4) - (order[b.riesgo_color]??4));

    const rows = rbis.map(r => {
      const eq = DB.getById('equipos', r.equipo_id);
      return `<tr>
        <td class="font-mono">${Utils.escHtml(eq?.tag||r.equipo_id)}</td>
        <td>${Utils.fmtDate(r.fecha_evaluacion)}</td>
        <td class="font-mono">${r.Df ?? '—'}</td>
        <td class="font-mono">${Utils.fmtSci(r.f_F, 2)} /a</td>
        <td class="font-mono">${Utils.fmtSci(r.R_A, 3)} m²/a</td>
        <td class="font-mono">${Utils.fmtSci(r.R_E, 1)} ${Utils.escHtml(r.moneda||'USD')}/a</td>
        <td>${Utils.riskBadge(r.riesgo_color)}</td>
        <td>${r.intervalo_inspeccion_a ? r.intervalo_inspeccion_a+' a' : '—'}</td>
        <td>${Utils.vencimientoBadge(r.proxima_inspeccion)}</td>
      </tr>`;
    }).join('');

    return _repHeader('Portfolio RBI – API RP 580 / 581 (Adelgazamiento Generalizado)', `${rbis.length} evaluaciones`)
      + `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Equipo</th><th>Fecha</th><th>D_f</th><th>f_F</th>
            <th>R_A (Área)</th><th>R_E (Econ.)</th><th>Riesgo</th><th>Intervalo</th><th>Próx. Insp.</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _csvRBI() {
    const rbis = DB.getAll('rbi_evaluaciones');
    Utils.exportCSV(
      ['Equipo_TAG','Mecanismo','Fecha','CR_mmpa','RL_a','POF_cat','POF_val',
       'COF_cat','COF_val','Riesgo','Intervalo_a','Próxima_insp'],
      rbis.map(r => {
        const eq = DB.getById('equipos', r.equipo_id);
        return [eq?.tag||'', r.mecanismo, r.fecha_evaluacion, r.tasa_corrosion_mmpa||'',
          r.vida_remanente_a||'', r.pof_categoria, r.pof_valor,
          r.cof_categoria, r.cof_valor, r.riesgo_categoria,
          r.intervalo_inspeccion_a, r.proxima_inspeccion||''];
      }),
      `reporte_rbi_${Utils.today()}.csv`
    );
  }

  /* ── 4. Inspection History ──────────────────────────────── */
  function _repInspecciones() {
    const insps = DB.getAll('inspecciones')
      .sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const rows = insps.map(i => {
      const eq = DB.getById('equipos', i.equipo_id);
      return `<tr>
        <td>${Utils.fmtDate(i.fecha)}</td>
        <td class="font-mono">${Utils.escHtml(eq?.tag||i.equipo_id)}</td>
        <td>${Utils.escHtml(i.tipo)}</td>
        <td>${Utils.resultadoBadge(i.resultado)}</td>
        <td>${Utils.escHtml(Utils.truncate(i.hallazgos||'—',60))}</td>
        <td>${Utils.escHtml(Utils.truncate(i.recomendaciones||'—',60))}</td>
        <td>${Utils.escHtml(i.tecnico||'—')}</td>
        <td>${Utils.estadoInsBadge(i.estado)}</td>
        <td>${Utils.vencimientoBadge(i.proxima_fecha)}</td>
      </tr>`;
    }).join('');

    return _repHeader('Historial de Inspecciones', `${insps.length} registros`)
      + `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Fecha</th><th>Equipo</th><th>Tipo</th><th>Resultado</th>
            <th>Hallazgos</th><th>Recomendaciones</th><th>Técnico</th>
            <th>Estado</th><th>Próx. Insp.</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _csvInspecciones() {
    const insps = DB.getAll('inspecciones');
    Utils.exportCSV(
      ['Equipo_TAG','Fecha','Tipo','Resultado','Hallazgos','Recomendaciones',
       'Técnico','Estado','Próxima_fecha'],
      insps.map(i => {
        const eq = DB.getById('equipos', i.equipo_id);
        return [eq?.tag||'', i.fecha, i.tipo, i.resultado,
          i.hallazgos||'', i.recomendaciones||'',
          i.tecnico||'', i.estado, i.proxima_fecha||''];
      }),
      `reporte_inspecciones_${Utils.today()}.csv`
    );
  }

  /* ── 5. Upcoming Schedule ───────────────────────────────── */
  function _repProgramacion() {
    const hoy = new Date();
    const planes = DB.getAll('planes')
      .sort((a,b) => new Date(a.fecha_prog) - new Date(b.fecha_prog));

    const rows = planes.map(p => {
      const eq   = DB.getById('equipos', p.equipo_id);
      const days = Utils.daysUntil(p.fecha_prog);
      const isOver = days !== null && days < 0 && p.estado === 'Programada';
      return `<tr ${isOver?'style="background:rgba(217,48,37,.04)"':''}>
        <td>${Utils.vencimientoBadge(p.fecha_prog)}</td>
        <td class="font-mono font-bold">${Utils.escHtml(eq?.tag||p.equipo_id)}</td>
        <td>${Utils.escHtml(eq?.nombre||'')}</td>
        <td>${Utils.escHtml(p.tipo_insp||'—')}</td>
        <td><span class="badge ${p.fuente==='RBI'?'badge-primary':'badge-info'}">${Utils.escHtml(p.fuente||'—')}</span></td>
        <td>${p.riesgo ? Utils.riskBadge(p.riesgo) : '—'}</td>
        <td>${Utils.escHtml(Utils.truncate(p.metodos||'—',40))}</td>
        <td>${p.prioridad === 1 ? '🔴 Alta' : p.prioridad === 2 ? '🟠 Media' : '🟢 Baja'}</td>
        <td>${_estadoPlanBadge(p.estado)}</td>
      </tr>`;
    }).join('');

    const venc = planes.filter(p => p.estado==='Programada' && new Date(p.fecha_prog) < hoy).length;
    return _repHeader('Programa de Inspecciones',
        `${planes.length} tareas · ${venc} vencidas`)
      + `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Fecha Prog.</th><th>TAG</th><th>Equipo</th><th>Tipo</th>
            <th>Fuente</th><th>Riesgo</th><th>Métodos</th><th>Prioridad</th><th>Estado</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _estadoPlanBadge(estado) {
    const map = { 'Programada':'badge-primary','En Ejecución':'badge-warning',
      'Completada':'badge-success','Vencida':'badge-danger','Cancelada':'badge-muted' };
    return `<span class="badge ${map[estado]||'badge-muted'}">${Utils.escHtml(estado)}</span>`;
  }

  function _csvProgramacion() {
    const planes = DB.getAll('planes');
    Utils.exportCSV(
      ['Equipo_TAG','Fecha_Prog','Tipo','Fuente','Riesgo','Métodos','Prioridad','Estado'],
      planes.map(p => {
        const eq = DB.getById('equipos', p.equipo_id);
        return [eq?.tag||'', p.fecha_prog, p.tipo_insp, p.fuente,
          p.riesgo||'', p.metodos||'', p.prioridad, p.estado];
      }),
      `reporte_programa_${Utils.today()}.csv`
    );
  }

  /* ── 6. Corrosion Rates ─────────────────────────────────── */
  function _repCorrosion() {
    const cmls = DB.getAll('cmls');
    const rows = cmls.map(c => {
      const eq  = DB.getById('equipos', c.equipo_id);
      const cr  = DB.calcCorrosionRate(c.id);
      const lm  = DB.lastMedicion(c.id);
      const meds = DB.query('mediciones', m => m.cml_id === c.id).length;
      const rl  = eq ? DB.remainingLife(c.id, eq.espesor_minimo_mm) : Infinity;
      const cls = Utils.crClass(cr);

      return `<tr>
        <td class="font-mono">${Utils.escHtml(eq?.tag||c.equipo_id)}</td>
        <td>${Utils.escHtml(c.nombre)}</td>
        <td>${Utils.escHtml(c.descripcion||'—')}</td>
        <td class="font-mono">${lm ? lm.espesor_mm+' mm' : '—'}</td>
        <td>${eq?.espesor_minimo_mm ? eq.espesor_minimo_mm+' mm' : '—'}</td>
        <td class="${cls} font-mono font-bold">${cr !== null ? cr.toFixed(4)+' mm/a' : '—'}</td>
        <td>${cr !== null ? (cr <= 0.1 ? '🟢 Baja' : cr <= 0.5 ? '🟠 Media' : '🔴 Alta') : '—'}</td>
        <td>${meds}</td>
        <td class="${Utils.rlClass(rl)} font-bold">${isFinite(rl) ? rl.toFixed(2)+' a' : '∞'}</td>
      </tr>`;
    }).sort((a,b) => a.localeCompare(b)).join('');

    return _repHeader('Tasas de Corrosión por CML', `${cmls.length} puntos de monitoreo`)
      + `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Equipo</th><th>CML</th><th>Descripción</th>
            <th>Últ. Esp.</th><th>t_min</th><th>Tasa (CR)</th><th>Clasificación</th>
            <th>N° Mediciones</th><th>Vida Rem.</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="text-xs text-muted mt-2">
        CR adoptada = máx(CR corto plazo, CR largo plazo) sobre lecturas comparables (API 510/570/653). Mínimo 2 mediciones comparables.
        🟢 CR ≤ 0.1 mm/a · 🟠 0.1–0.5 mm/a · 🔴 &gt;0.5 mm/a
      </div>`;
  }

  function _csvCorrosion() {
    const cmls = DB.getAll('cmls');
    Utils.exportCSV(
      ['Equipo_TAG','CML','Descripción','Últ_Esp_mm','t_min_mm',
       'CR_mmpa','Clasificación','N_mediciones','RL_a'],
      cmls.map(c => {
        const eq  = DB.getById('equipos', c.equipo_id);
        const lm  = DB.lastMedicion(c.id);
        const cr  = DB.calcCorrosionRate(c.id);
        const rl  = eq ? DB.remainingLife(c.id, eq.espesor_minimo_mm) : Infinity;
        const meds = DB.query('mediciones', m => m.cml_id === c.id).length;
        const cls = cr === null ? '—' : cr <= 0.1 ? 'Baja' : cr <= 0.5 ? 'Media' : 'Alta';
        return [eq?.tag||'', c.nombre, c.descripcion||'',
          lm?.espesor_mm||'', eq?.espesor_minimo_mm||'',
          cr !== null ? cr.toFixed(4) : '', cls, meds,
          isFinite(rl) ? rl.toFixed(2) : ''];
      }),
      `reporte_tasas_corrosion_${Utils.today()}.csv`
    );
  }

  return { render };
})();
