/**
 * SGIEE – Módulo: RBI Cuantitativo por Adelgazamiento Generalizado (Sección 5)
 * Referencias: API RP 580 (3ª Ed., 2016) y API RP 581 (3ª Ed., 2016, Parte 2 §4)
 *
 * Cumple los 5 requisitos obligatorios:
 *  1. Factor de daño D_f por adelgazamiento generalizado con ecuaciones, parámetros e historial de inspección.
 *  2. Frecuencia anual de falla f_F = gff · D_f · F_MS (distinta de D_f) y PoF(T) con horizonte explícito.
 *  3. Entrada directa de Área de Consecuencia C_A [m²] y Consecuencia Económica C_E [moneda y base de valoración].
 *  4. Presentación separada de Riesgo por Área R_A = f_F·C_A [m²/año] y Riesgo Económico R_E = f_F·C_E [moneda/año].
 *  5. Matriz 5×5, clasificación de riesgo y prioridad de inspección.
 *  + Declaración de modelo académico simplificado y explicación del efecto de la inspección sobre la incertidumbre.
 */
const ModRBI = (() => {

  const MATRIX = [
    ['low',    'low',    'low',    'medium', 'medium'], // POF 1
    ['low',    'low',    'medium', 'medium', 'high'  ], // POF 2
    ['low',    'medium', 'medium', 'high',   'high'  ], // POF 3
    ['medium', 'medium', 'high',   'high',   'vhigh' ], // POF 4
    ['medium', 'high',   'high',   'vhigh',  'vhigh' ], // POF 5
  ];

  const POF_LABELS = ['', '≤10⁻⁵/a', '10⁻⁵–10⁻⁴', '10⁻⁴–10⁻³', '10⁻³–10⁻²', '>10⁻²/a'];
  const COF_AREA_LABELS = { A:'≤10 m²', B:'10–100', C:'100–1k', D:'1k–10k', E:'>10k m²' };
  const COF_ECON_LABELS = { A:'≤10k', B:'10k–100k', C:'100k–1M', D:'1M–10M', E:'>10M' };
  const RISK_LABELS = { low:'Bajo', medium:'Medio', high:'Alto', vhigh:'Muy Alto' };
  const RISK_COLORS = { low:'#22a06b', medium:'#e8a020', high:'#e05d20', vhigh:'#d93025' };

  const RECOMMENDED_METHODS = {
    low:    ['Visual externa', 'UT spot check (10%)'],
    medium: ['UT escáner (25–50%)', 'Monitoreo CML dirigido'],
    high:   ['UT escáner (>50%)', 'TOFD / RT perfil en zonas críticas', 'Revisión de tasa CR'],
    vhigh:  ['Inspección interna completa / UT 100%', 'Evaluación FFS API 579-1', 'Mitigación inmediata'],
  };

  let lastEval = null;

  function render() {
    const el = document.getElementById('mod-rbi');
    if (!el) return;

    const evals = DB.getAll('rbi_evaluaciones')
      .sort((a, b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion));

    el.innerHTML = `
      <div class="section-header">
        <h2>RBI – Adelgazamiento Generalizado (API RP 580 / 581)</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="rbi-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="rbi-newBtn">＋ Nueva Evaluación</button>
        </div>
      </div>

      <div class="alert alert-warning mb-2">
        <span class="alert-icon">⚠️</span>
        <div class="text-xs">
          <strong>Modelo académico simplificado</strong> basado en <strong>API RP 580 (3ª Ed.)</strong> (proceso) y
          <strong>API RP 581 (3ª Ed., Parte 2 §4)</strong> (factor de daño por adelgazamiento generalizado).
          Las consecuencias (C<sub>A</sub> en m² y C<sub>E</sub> económica) son ingresadas directamente por el usuario (no se modela dispersión física).
          <strong>Efecto de la inspección:</strong> una inspección de mayor eficacia (A/B) o mayor cantidad N reduce la incertidumbre sobre la velocidad de corrosión (disminuyendo D<sub>f</sub> y f<sub>F</sub>), <em>pero no recupera el espesor perdido</em>.
        </div>
      </div>

      <div id="rbi-kpis" class="mini-stat-row mb-2"></div>

      <div class="grid-2" style="align-items:start;gap:24px">
        <div>
          <div class="card">
            <div class="card-header"><h3>⚙ Calculadora Cuantitativa RBI (API RP 581)</h3></div>
            <div class="card-body" id="rbi-calcPanel">${_buildCalcForm()}</div>
          </div>
        </div>

        <div>
          <div id="rbi-resultPanel">
            <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px">
              <div class="empty-icon">⚠</div>
              <h3>Resultado Cuantitativo RBI</h3>
              <p>Seleccione un equipo (o cargue desde CML), ajuste consecuencias C<sub>A</sub> / C<sub>E</sub> y presione "Evaluar Riesgo".</p>
            </div>
          </div>

          <div class="card mt-2">
            <div class="card-header">
              <h3>📋 Evaluaciones Registradas</h3>
              <span class="badge badge-primary">${evals.length}</span>
            </div>
            <div class="card-body" style="padding:0">${_buildHistoryTable(evals)}</div>
          </div>
        </div>
      </div>`;

    _bindCalcEvents(el);
    _renderKPIs();
  }

  function _renderKPIs() {
    const all = DB.getAll('rbi_evaluaciones');
    const dist = { low: 0, medium: 0, high: 0, vhigh: 0 };
    all.forEach(r => { if (dist[r.riesgo_color] !== undefined) dist[r.riesgo_color]++; });
    document.getElementById('rbi-kpis').innerHTML = `
      <div class="mini-stat"><div class="ms-label">Total Evaluaciones</div><div class="ms-val" style="color:var(--c-primary)">${all.length}</div></div>
      <div class="mini-stat"><div class="ms-label">Riesgo Muy Alto</div><div class="ms-val" style="color:#d93025">${dist.vhigh}</div></div>
      <div class="mini-stat"><div class="ms-label">Riesgo Alto</div><div class="ms-val" style="color:#e05d20">${dist.high}</div></div>
      <div class="mini-stat"><div class="ms-label">Riesgo Medio</div><div class="ms-val" style="color:#e8a020">${dist.medium}</div></div>
      <div class="mini-stat"><div class="ms-label">Riesgo Bajo</div><div class="ms-val" style="color:#22a06b">${dist.low}</div></div>`;
  }

  function _buildCalcForm() {
    const equipos = DB.getAll('equipos').sort((a, b) => a.tag.localeCompare(b.tag));
    const eqOpts = equipos.map(e => `<option value="${e.id}">${e.tag} – ${Utils.escHtml(e.nombre)} (${Utils.escHtml(e.tipo)})</option>`).join('');

    return `
      <form id="rbi-form">
        <div class="form-section">
          <div class="form-section-title">1. Equipo y Datos de Adelgazamiento (CML)</div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Equipo<span class="required">*</span></label>
              <select class="form-control" id="rf_eq"><option value="">Seleccionar equipo…</option>${eqOpts}</select>
            </div>
            <div class="form-group">
              <label>Fecha evaluación</label>
              <input type="date" class="form-control" id="rf_fecha" value="${Utils.today()}">
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm mb-2" id="rbi-autofillBtn">📍 Cargar datos del peor CML del equipo</button>

          <div class="form-row cols-3">
            <div class="form-group"><label>t_trd última insp. (mm)<span class="required">*</span></label><input type="number" class="form-control" id="rf_tact" value="13.90" min="0.1" step="0.01"></div>
            <div class="form-group"><label>t_mín servicio (mm)<span class="required">*</span></label><input type="number" class="form-control" id="rf_tmin" value="10.99" min="0.1" step="0.01"></div>
            <div class="form-group"><label>t_nominal (mm)</label><input type="number" class="form-control" id="rf_tnom" value="16.0" min="0.1" step="0.01"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Tasa corrosión CR (mm/a)<span class="required">*</span></label><input type="number" class="form-control" id="rf_cr" value="0.40" min="0" step="0.001"></div>
            <div class="form-group"><label>Años desde últ. insp. (age)<span class="required">*</span></label><input type="number" class="form-control" id="rf_age" value="2.0" min="0" step="0.1"></div>
            <div class="form-group"><label>Horizonte PoF (años)</label><input type="number" class="form-control" id="rf_hor" value="1.0" min="0.5" step="0.5"></div>
          </div>
          <div class="form-row cols-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
            <div class="form-group"><label>S admisible (MPa)</label><input type="number" class="form-control" id="rf_S" value="138" step="1"></div>
            <div class="form-group"><label>Eficiencia E</label><input type="number" class="form-control" id="rf_E" value="1.0" min="0.5" max="1.0" step="0.05"></div>
            <div class="form-group"><label>SMYS (MPa)</label><input type="number" class="form-control" id="rf_smys" value="260" step="1"></div>
            <div class="form-group"><label>UTS (MPa)</label><input type="number" class="form-control" id="rf_uts" value="485" step="1"></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">2. Antecedentes de Inspección, gff y F_MS (API RP 581)</div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Eficacia de inspección (API 581 Tabla 4.6)</label>
              <select class="form-control" id="rf_insp_eff">
                <option value="A">A – Altamente efectiva (cobertura >90%)</option>
                <option value="B" selected>B – Usualmente efectiva (cobertura 50–90%)</option>
                <option value="C">C – Regularmente efectiva (cobertura 20–50%)</option>
                <option value="D">D – Pobremente efectiva (spot <20%)</option>
                <option value="E">E – Sin inspección previa</option>
              </select>
            </div>
            <div class="form-group">
              <label>Número de inspecciones (N)</label>
              <input type="number" class="form-control" id="rf_insp_n" value="2" min="0" max="6" step="1">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Frecuencia genérica gff (fallas/año)</label>
              <input type="number" class="form-control" id="rf_gff" value="0.0000306" step="0.000001">
              <div class="form-hint">API 581 Tabla 3.1: Recipiente/Tubería 3.06×10⁻⁵ · Tanque 1.00×10⁻⁴</div>
            </div>
            <div class="form-group">
              <label>Factor sistemas de gestión F_MS</label>
              <input type="number" class="form-control" id="rf_fms" value="1.0" min="0.1" max="10" step="0.1">
              <div class="form-hint">1.0 = gestión promedio estándar</div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">3. Consecuencias Ingresadas por el Usuario (Área y Económica)</div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Área de consecuencia C_A (m²)<span class="required">*</span></label>
              <input type="number" class="form-control" id="rf_CA" value="185" min="0" step="1">
              <div class="form-hint">Área de afectación por liberación</div>
            </div>
            <div class="form-group">
              <label>Consecuencia económica C_E<span class="required">*</span></label>
              <input type="number" class="form-control" id="rf_CE" value="450000" min="0" step="1000">
            </div>
            <div class="form-group">
              <label>Moneda<span class="required">*</span></label>
              <select class="form-control" id="rf_moneda">
                <option value="USD" selected>USD</option>
                <option value="CLP">CLP</option>
                <option value="EUR">EUR</option>
                <option value="UF">UF</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Base de valoración económica<span class="required">*</span></label>
            <input class="form-control" id="rf_base_val" value="Reposición de equipo + lucro cesante por parada + mitigación ambiental">
          </div>
          <div class="form-group">
            <label>Notas / Escenario de falla</label>
            <textarea class="form-control" id="rf_notas" rows="2" placeholder="Escenario de falla consistente para área y costo (ej. ruptura/fuga por adelgazamiento generalizado)."></textarea>
          </div>
        </div>

        <button type="button" class="btn btn-primary w-full" id="rbi-evalBtn" style="font-size:.98rem;padding:10px">
          ⚙ Calcular D_f, f_F, R_A y R_E (API RP 581)
        </button>
      </form>`;
  }

  function _buildMatrixHTML(activePOF = null, activeCOFArea = null, activeCOFEcon = null, mode = 'area') {
    const cofCols = ['A', 'B', 'C', 'D', 'E'];
    const labels = mode === 'econ' ? COF_ECON_LABELS : COF_AREA_LABELS;
    const activeCOF = mode === 'econ' ? activeCOFEcon : activeCOFArea;

    return `
      <div style="display:flex;gap:6px;align-items:flex-end">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:22px;min-height:175px">
          <span style="font-size:.68rem;font-weight:700;color:var(--c-text-secondary);writing-mode:vertical-rl;transform:rotate(180deg)">f_F (PoF) →</span>
        </div>
        <div style="flex:1">
          <div style="display:grid;grid-template-columns:56px repeat(5,1fr);gap:3px;margin-bottom:3px">
            <div></div>
            ${cofCols.map(c => `<div style="text-align:center;font-size:.7rem;font-weight:700">${c}<br><span style="font-weight:400;font-size:.6rem;color:var(--c-text-muted)">${labels[c]}</span></div>`).join('')}
          </div>
          ${[5,4,3,2,1].map(pof => `
            <div style="display:grid;grid-template-columns:56px repeat(5,1fr);gap:3px;margin-bottom:3px">
              <div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding-right:4px;font-size:.66rem;font-weight:700">
                <span>${pof}</span><span style="font-weight:400;font-size:.58rem;color:var(--c-text-muted)">${POF_LABELS[pof]}</span>
              </div>
              ${cofCols.map((cof, ci) => {
                const color = MATRIX[pof - 1][ci];
                const isActive = activePOF === pof && activeCOF === cof;
                return `<div style="height:34px;border-radius:4px;background:${RISK_COLORS[color]};opacity:${isActive?1:0.65};
                  border:${isActive?'3px solid #17202a':'1px solid transparent'};
                  display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:800;color:#fff;
                  transform:${isActive?'scale(1.07)':'scale(1)'}">
                  ${isActive ? '★' : RISK_LABELS[color].charAt(0)}
                </div>`;
              }).join('')}
            </div>`).join('')}
          <div style="text-align:center;font-size:.68rem;font-weight:700;color:var(--c-text-secondary);margin-top:3px">
            ${mode === 'econ' ? 'Consecuencia Económica C_E →' : 'Área de Consecuencia C_A (m²) →'}
          </div>
        </div>
      </div>`;
  }

  function _buildHistoryTable(evals) {
    if (evals.length === 0) {
      return `<div class="empty-state" style="padding:20px"><p>Sin evaluaciones RBI registradas.</p></div>`;
    }
    const rows = evals.map(r => {
      const eq = DB.getById('equipos', r.equipo_id);
      return `<tr>
        <td>${Utils.fmtDate(r.fecha_evaluacion)}</td>
        <td class="font-mono font-bold">${Utils.escHtml(eq?.tag || r.equipo_id)}</td>
        <td class="font-mono">${r.Df ?? '—'}</td>
        <td class="font-mono text-xs">${Utils.fmtSci(r.f_F, 2)} /a</td>
        <td class="font-mono text-xs">${Utils.fmtSci(r.R_A, 3)} m²/a</td>
        <td class="font-mono text-xs">${Utils.fmtSci(r.R_E, 1)} ${Utils.escHtml(r.moneda || 'USD')}/a</td>
        <td>${Utils.riskBadge(r.riesgo_color)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-rbi-action="view" data-id="${r.id}" title="Ver detalle">🔍</button>
          <button class="btn btn-ghost btn-sm" data-rbi-action="del"  data-id="${r.id}" title="Eliminar" style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    return `<div class="table-wrapper" style="border-radius:0 0 var(--r-lg) var(--r-lg)">
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Equipo</th><th>D_f</th><th>f_F</th><th>R_A (Área)</th><th>R_E (Econ.)</th><th>Riesgo</th><th class="col-actions">Acc.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function _evaluate() {
    const eqId = document.getElementById('rf_eq')?.value;
    if (!eqId) { Utils.toast('Requerido', 'Seleccione un equipo.', 'error'); return; }
    const eq = DB.getById('equipos', eqId);

    const gN = id => parseFloat(document.getElementById(id)?.value);
    const params = {
      familia: eq?.tipo || 'Vasija a Presión',
      t_trd_mm: gN('rf_tact'),
      t_min_mm: gN('rf_tmin'),
      t_nom_mm: gN('rf_tnom') || eq?.espesor_nominal_mm || 14,
      CR_mmpa:  gN('rf_cr'),
      age_a:    gN('rf_age'),
      horizonte_a: gN('rf_hor') || 1.0,
      S_MPa:    gN('rf_S') || 138,
      E_joint:  gN('rf_E') || 1.0,
      SMYS_MPa: gN('rf_smys') || 260,
      UTS_MPa:  gN('rf_uts') || 485,
      insp_eff: document.getElementById('rf_insp_eff')?.value || 'C',
      insp_count: parseInt(document.getElementById('rf_insp_n')?.value, 10) || 0,
      gff:      gN('rf_gff'),
      F_MS:     gN('rf_fms') || 1.0,
      CA_m2:    gN('rf_CA'),
      CE_val:   gN('rf_CE'),
      moneda:   document.getElementById('rf_moneda')?.value || 'USD',
      base_valoracion: document.getElementById('rf_base_val')?.value?.trim() || 'Valoración de ingeniería',
    };

    if ([params.t_trd_mm, params.t_min_mm, params.CR_mmpa, params.age_a, params.CA_m2, params.CE_val].some(isNaN)) {
      Utils.toast('Campos requeridos', 'Complete espesores, CR, edad, C_A y C_E.', 'error'); return;
    }

    const res = ThicknessCalc.calcRBI581(params);
    if (res.error) { Utils.toast('Error de cálculo', res.error, 'error'); return; }

    // Also compute a comparison with 1 additional Effective B inspection to demonstrate uncertainty effect
    const simExtra = ThicknessCalc.calcRBI581({ ...params, insp_eff: 'B', insp_count: Math.min(6, params.insp_count + 1) });

    const fecha = document.getElementById('rf_fecha')?.value || Utils.today();
    const notas = document.getElementById('rf_notas')?.value?.trim() || '';
    const nextInsp = Utils.addYears(fecha, res.intervalo_a);

    lastEval = { eq, fecha, notas, nextInsp, res, simExtra };
    _showResult(lastEval);
  }

  function _showResult(ctx) {
    const { eq, fecha, notas, nextInsp, res, simExtra } = ctx;
    const panel = document.getElementById('rbi-resultPanel');
    if (!panel) return;

    const riskHex = RISK_COLORS[res.risk_gov_color];
    const riskLabel = RISK_LABELS[res.risk_gov_color];
    const methods = RECOMMENDED_METHODS[res.risk_gov_color] || [];

    panel.innerHTML = `
      <div class="card" style="border-left:4px solid ${riskHex}">
        <div class="card-header" style="background:${riskHex}18">
          <div>
            <div class="text-xs text-muted">${Utils.escHtml(res.modelo)} · ${Utils.fmtDate(fecha)}</div>
            <h3 style="font-size:1.05rem">${Utils.escHtml(eq.tag)} – ${Utils.escHtml(eq.nombre)}</h3>
          </div>
          <span class="risk-badge risk-${res.risk_gov_color}" style="font-size:.95rem;padding:6px 14px">${riskLabel}</span>
        </div>
        <div class="card-body">

          <!-- 1. Factor de daño vs Frecuencia / PoF -->
          <div class="result-box" style="margin-top:0">
            <h3>1. Factor de Daño (D_f) vs. Frecuencia de Falla (f_F)</h3>
            <div class="result-grid">
              <div class="result-item"><label>Factor de Daño D_f (adim.)</label><span class="val">${res.Df.toFixed(2)}</span><span class="unit">NO es probabilidad</span></div>
              <div class="result-item"><label>Frecuencia falla f_F</label><span class="val">${Utils.fmtSci(res.f_F, 2)}</span><span class="unit">fallas/año</span></div>
              <div class="result-item"><label>PoF (horizonte ${res.horizonte_a} a)</label><span class="val">${(res.PoF_T * 100).toExponential(2)}</span><span class="unit">%</span></div>
              <div class="result-item"><label>A_rt (pérdida pared)</label><span class="val">${(res.intermedios.Art * 100).toFixed(2)}</span><span class="unit">%</span></div>
              <div class="result-item"><label>Razón esfuerzo S_R</label><span class="val">${res.intermedios.SR.toFixed(3)}</span></div>
              <div class="result-item"><label>Cat. PoF (API 581)</label><span class="val">${res.pof_cat}</span><span class="unit">${POF_LABELS[res.pof_cat]}</span></div>
            </div>
            <div style="margin-top:8px;font-size:.72rem;opacity:.85;font-family:var(--font-mono)">
              Pr_post = [${res.intermedios.post_probs.map(p => p.toFixed(3)).join(', ')}] ·
              β = [${res.intermedios.betas.map(b => b.toFixed(2)).join(', ')}] ·
              gff = ${Utils.fmtSci(res.entradas.gff, 2)} (${Utils.escHtml(res.entradas.gff_ref)}) · F_MS = ${res.entradas.F_MS}
            </div>
          </div>

          <!-- 2. Riesgos separados: Área vs Económico -->
          <div class="grid-2 mt-2" style="gap:12px">
            <div class="card" style="border-top:3px solid ${RISK_COLORS[res.risk_area_color]}">
              <div class="card-body" style="padding:12px">
                <div class="text-xs text-muted font-bold">RIESGO POR ÁREA (R_A = f_F · C_A)</div>
                <div style="font-size:1.3rem;font-weight:800;font-family:var(--font-mono);margin:4px 0">${Utils.fmtSci(res.R_A, 3)} <span class="text-xs">m²/año</span></div>
                <div class="text-xs text-muted">C_A = ${res.entradas.CA_m2} m² (Cat. ${res.cof_area_cat}) · Nivel: ${Utils.riskBadge(res.risk_area_color)}</div>
              </div>
            </div>
            <div class="card" style="border-top:3px solid ${RISK_COLORS[res.risk_econ_color]}">
              <div class="card-body" style="padding:12px">
                <div class="text-xs text-muted font-bold">RIESGO ECONÓMICO (R_E = f_F · C_E)</div>
                <div style="font-size:1.3rem;font-weight:800;font-family:var(--font-mono);margin:4px 0">${Utils.fmtSci(res.R_E, 2)} <span class="text-xs">${Utils.escHtml(res.moneda)}/año</span></div>
                <div class="text-xs text-muted">C_E = ${res.entradas.CE_val.toLocaleString('es-ES')} ${Utils.escHtml(res.moneda)} (Cat. ${res.cof_econ_cat}) · Nivel: ${Utils.riskBadge(res.risk_econ_color)}</div>
                <div class="text-xs text-muted mt-1">Base: ${Utils.escHtml(res.base_valoracion)}</div>
              </div>
            </div>
          </div>

          <!-- 3. Prioridad e intervalo -->
          <div class="alert alert-info mt-2 mb-2">
            <span class="alert-icon">🎯</span>
            <div class="text-xs">
              <strong>Prioridad de inspección:</strong> ${Utils.escHtml(res.prioridad)} (gobernado por ${Utils.escHtml(res.gov_source)})<br>
              <strong>Intervalo sugerido RBI:</strong> ${res.intervalo_a} años → Próxima inspección: <strong>${Utils.fmtDate(nextInsp)}</strong><br>
              <strong>Métodos sugeridos:</strong> ${methods.join(' · ')}
            </div>
          </div>

          <!-- 4. Matrices 5x5 separadas (Área y Económica) -->
          <div class="grid-2 mt-2" style="gap:12px">
            <div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:10px">
              <div class="text-xs font-bold mb-1">Matriz 5×5 – Riesgo por Área</div>
              ${_buildMatrixHTML(res.pof_cat, res.cof_area_cat, res.cof_econ_cat, 'area')}
            </div>
            <div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:10px">
              <div class="text-xs font-bold mb-1">Matriz 5×5 – Riesgo Económico</div>
              ${_buildMatrixHTML(res.pof_cat, res.cof_area_cat, res.cof_econ_cat, 'econ')}
            </div>
          </div>

          <!-- 5. Efecto de la inspección sobre la incertidumbre -->
          <div class="alert alert-warning mt-2" style="font-size:.8rem">
            <span class="alert-icon">🔬</span>
            <div>
              <strong>Efecto de una inspección adicional (eficacia B):</strong> ${Utils.escHtml(res.nota_incertidumbre)}<br>
              <span class="font-mono">Escenario actual: D_f = ${res.Df.toFixed(2)}, f_F = ${Utils.fmtSci(res.f_F,2)}/a, t_est = ${res.intermedios.t_actual_est_mm.toFixed(2)} mm</span><br>
              <span class="font-mono">Con +1 insp. (B): D_f = ${simExtra.Df.toFixed(2)}, f_F = ${Utils.fmtSci(simExtra.f_F,2)}/a, t_est = ${simExtra.intermedios.t_actual_est_mm.toFixed(2)} mm (espesor idéntico)</span>
            </div>
          </div>

          <!-- Ecuaciones usadas -->
          <details class="mt-2">
            <summary class="text-xs font-bold" style="cursor:pointer;color:var(--c-primary)">📐 Ver ecuaciones y referencias API RP 581 aplicadas</summary>
            <div class="mt-1 p-2 font-mono text-xs" style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:8px;line-height:1.6">
              ${res.ecuaciones.map(eqStr => `<div>${Utils.escHtml(eqStr)}</div>`).join('')}
            </div>
          </details>

          <div class="mt-2 d-flex gap-2" style="justify-content:flex-end">
            <button class="btn btn-secondary" id="rbi-discardBtn">↩ Descartar</button>
            <button class="btn btn-primary"   id="rbi-saveEvalBtn">💾 Guardar Evaluación</button>
          </div>
        </div>
      </div>`;

    document.getElementById('rbi-saveEvalBtn')?.addEventListener('click', () => {
      const record = {
        equipo_id:              eq.id,
        fecha_evaluacion:       fecha,
        mecanismo:              'Adelgazamiento generalizado (API RP 581 Parte 2 §4)',
        tasa_corrosion_mmpa:    res.entradas.CR_mmpa,
        espesor_actual_mm:      res.entradas.t_trd_mm,
        espesor_minimo_mm:      res.entradas.t_min_mm,
        espesor_nominal_mm:     res.entradas.t_nom_mm,
        age_a:                  res.entradas.age_a,
        insp_eff:               res.entradas.insp_eff,
        insp_count:             res.entradas.insp_count,
        gff:                    res.entradas.gff,
        F_MS:                   res.entradas.F_MS,
        Df:                     Number(res.Df.toFixed(2)),
        f_F:                    res.f_F,
        PoF_1a:                 res.PoF_T,
        CA_m2:                  res.entradas.CA_m2,
        CE_val:                 res.entradas.CE_val,
        moneda:                 res.moneda,
        base_valoracion:        res.base_valoracion,
        R_A:                    res.R_A,
        R_E:                    res.R_E,
        vida_remanente_a:       isFinite(res.remaining_life_a) ? Utils.round(res.remaining_life_a, 2) : null,
        pof_categoria:          res.pof_cat,
        pof_valor:              `Cat. ${res.pof_cat}`,
        cof_categoria:          res.cof_area_cat,
        cof_econ_categoria:     res.cof_econ_cat,
        cof_valor:              `Área ${res.cof_area_cat} / Econ ${res.cof_econ_cat}`,
        riesgo_area_color:      res.risk_area_color,
        riesgo_econ_color:      res.risk_econ_color,
        riesgo_categoria:       riskLabel,
        riesgo_color:           res.risk_gov_color,
        prioridad:              res.prioridad,
        intervalo_inspeccion_a: res.intervalo_a,
        proxima_inspeccion:     nextInsp,
        estado:                 'Vigente',
        notas:                  notas || res.base_valoracion,
      };
      DB.insert('rbi_evaluaciones', record);
      if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
      Utils.toast('Evaluación RBI guardada', `D_f=${record.Df} · R_A=${Utils.fmtSci(record.R_A,2)} m²/a · R_E=${Utils.fmtSci(record.R_E,1)} ${record.moneda}/a`, 'success');
      render();
    });

    document.getElementById('rbi-discardBtn')?.addEventListener('click', () => {
      panel.innerHTML = `<div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px"><div class="empty-icon">⚠</div><h3>Resultado RBI</h3><p>Complete el formulario y presione Calcular.</p></div>`;
    });
  }

  function _autofillFromCML() {
    const eqId = document.getElementById('rf_eq')?.value;
    if (!eqId) { Utils.toast('Seleccione equipo', 'Primero elija un equipo.', 'warning'); return; }
    const eq = DB.getById('equipos', eqId);
    const st = DB.evaluateEquipoStatus(eqId);
    if (!eq) return;

    const mat = ThicknessCalc.MATERIALS[eq.material];
    const S = ThicknessCalc.getAllowableStress(eq.material, eq.temp_diseno_C ?? 100, eq.tipo === 'Tubería a Presión' ? 'B313' : 'VIII');
    const S_val = typeof S === 'object' ? S?.S : S;
    const gffObj = ThicknessCalc.API581_GFF[eq.tipo];

    const worstA = st?.worstCML;
    const tact = worstA?.last?.espesor_mm ?? eq.espesor_nominal_mm;
    const cr   = (worstA && !worstA.insufficient && worstA.cr_adoptada !== null) ? worstA.cr_adoptada : (st?.maxCR ?? 0.25);
    const age  = worstA?.last?.fecha ? Math.max(0.5, (new Date() - new Date(worstA.last.fecha)) / (365.25 * 24 * 3600 * 1000)) : 2.0;

    if (tact) document.getElementById('rf_tact').value = Number(tact).toFixed(2);
    if (eq.espesor_minimo_mm) document.getElementById('rf_tmin').value = eq.espesor_minimo_mm;
    if (eq.espesor_nominal_mm) document.getElementById('rf_tnom').value = eq.espesor_nominal_mm;
    document.getElementById('rf_cr').value = Number(cr).toFixed(3);
    document.getElementById('rf_age').value = Number(age).toFixed(1);
    if (S_val) document.getElementById('rf_S').value = S_val;
    document.getElementById('rf_E').value = eq.eficiencia_junta ?? 1.0;
    if (mat?.SMYS_MPa) document.getElementById('rf_smys').value = mat.SMYS_MPa;
    if (mat?.UTS_MPa)  document.getElementById('rf_uts').value  = mat.UTS_MPa;
    if (gffObj?.gff)   document.getElementById('rf_gff').value  = gffObj.gff;

    Utils.toast('Datos cargados', `Equipo ${eq.tag} · CML: ${worstA?.cml?.nombre || 'N/A'} · CR=${Number(cr).toFixed(3)} mm/a`, 'success');
  }

  function _bindCalcEvents(el) {
    el.querySelector('#rbi-evalBtn')?.addEventListener('click', _evaluate);
    el.querySelector('#rbi-autofillBtn')?.addEventListener('click', _autofillFromCML);
    el.querySelector('#rbi-newBtn')?.addEventListener('click', openNewEvaluation);
    el.querySelector('#rbi-exportBtn')?.addEventListener('click', _exportCSV);
    el.querySelector('#rf_eq')?.addEventListener('change', () => {
      if (document.getElementById('rf_eq')?.value) _autofillFromCML();
    });

    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-rbi-action]');
      if (!btn) return;
      const { rbiAction, id } = btn.dataset;
      if (rbiAction === 'view') _viewEval(id);
      if (rbiAction === 'del')  _deleteEval(id);
    });
  }

  function _viewEval(id) {
    const r = DB.getById('rbi_evaluaciones', id);
    if (!r) return;
    const eq = DB.getById('equipos', r.equipo_id);
    Utils.openModal(`🔍 Evaluación RBI (API RP 581) – ${eq?.tag || r.equipo_id}`, `
      <div class="form-row cols-2">
        <div class="form-section">
          <div class="form-section-title">Factor de Daño y Frecuencia</div>
          ${_dRow('Equipo', eq ? `${eq.tag} – ${eq.nombre}` : r.equipo_id)}
          ${_dRow('Fecha', Utils.fmtDate(r.fecha_evaluacion))}
          ${_dRow('Inspecciones previas', `N=${r.insp_count ?? '—'} · Eficacia ${r.insp_eff || '—'}`)}
          ${_dRow('Factor de daño D_f', r.Df ?? '—')}
          ${_dRow('gff / F_MS', `${Utils.fmtSci(r.gff, 2)} / ${r.F_MS ?? 1.0}`)}
          ${_dRow('Frecuencia anual f_F', `${Utils.fmtSci(r.f_F, 2)} fallas/año`)}
        </div>
        <div class="form-section">
          <div class="form-section-title">Consecuencias y Riesgos Separados</div>
          ${_dRow('Área consecuencia C_A', `${r.CA_m2 ?? '—'} m² (Cat. ${r.cof_categoria || '—'})`)}
          ${_dRow('Riesgo por Área R_A', `${Utils.fmtSci(r.R_A, 3)} m²/año`)}
          ${_dRow('Consecuencia econ. C_E', `${r.CE_val ? Number(r.CE_val).toLocaleString('es-ES') : '—'} ${r.moneda || 'USD'} (Cat. ${r.cof_econ_categoria || '—'})`)}
          ${_dRow('Riesgo Económico R_E', `${Utils.fmtSci(r.R_E, 2)} ${r.moneda || 'USD'}/año`)}
          ${_dRow('Riesgo gobernante', '', true, Utils.riskBadge(r.riesgo_color))}
          ${_dRow('Prioridad', r.prioridad || '—')}
          ${_dRow('Próxima inspección', '', true, Utils.vencimientoBadge(r.proxima_inspeccion))}
        </div>
      </div>
      <div class="text-xs text-muted mt-1"><strong>Base de valoración:</strong> ${Utils.escHtml(r.base_valoracion || r.notas || '—')}</div>
    `, { size: 'modal-lg' });
  }

  function _dRow(label, val, raw = false, rawVal = '') {
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--c-border);font-size:.86rem">
      <span style="color:var(--c-text-muted)">${label}</span>
      <span style="font-weight:600">${raw ? rawVal : Utils.escHtml(String(val ?? '—'))}</span>
    </div>`;
  }

  function _deleteEval(id) {
    Utils.confirm('¿Eliminar esta evaluación RBI?', () => {
      DB.remove('rbi_evaluaciones', id);
      if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
      Utils.toast('Eliminado', 'Evaluación RBI eliminada.', 'warning');
      render();
    });
  }

  function _exportCSV() {
    const all = DB.getAll('rbi_evaluaciones');
    const headers = ['ID','Equipo_TAG','Fecha','CR_mmpa','t_trd_mm','t_min_mm','age_a','Insp_Eff','Insp_N','gff','F_MS','Df','f_F_1_yr','CA_m2','R_A_m2_yr','CE','Moneda','R_E_yr','Riesgo','Prioridad','Próx_Insp'];
    const rows = all.map(r => {
      const eq = DB.getById('equipos', r.equipo_id);
      return [r.id, eq?.tag||'', r.fecha_evaluacion, r.tasa_corrosion_mmpa, r.espesor_actual_mm, r.espesor_minimo_mm,
        r.age_a||'', r.insp_eff||'', r.insp_count??'', r.gff||'', r.F_MS||'', r.Df??'', r.f_F??'',
        r.CA_m2??'', r.R_A??'', r.CE_val??'', r.moneda||'USD', r.R_E??'', r.riesgo_categoria, r.prioridad||'', r.proxima_inspeccion||''];
    });
    Utils.exportCSV(headers, rows, `rbi_api581_${Utils.today()}.csv`);
  }

  function openNewEvaluation() {
    document.getElementById('rf_eq')?.focus();
    document.getElementById('rbi-resultPanel')?.scrollIntoView({ behavior: 'smooth' });
  }

  return { render, openNewEvaluation };
})();
