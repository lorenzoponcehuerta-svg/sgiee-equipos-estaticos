/**
 * SGIEE – Módulo: Cálculo de Espesores de Evaluación (Sección 4.2)
 * Distingue: espesor nominal, requerido por cálculo, mínimo admisible en servicio, medido y de alerta.
 * Explica CA, tolerancia de fabricación y justificación de alerta.
 * Incluye vista gráfica interactiva por familia (sección transversal / perfil de manto,
 * gráfico comparativo de los 5 espesores y proyección lineal de desgaste vs. tiempo).
 */
const ModEspesores = (() => {

  let currentTab = 'b313';
  let lastResult = null;
  let lastMeta   = null;
  let linkedEquipoId = null;

  function render() {
    const el = document.getElementById('mod-espesores');
    if (!el) return;

    const eqOpts = DB.getAll('equipos').sort((a, b) => a.tag.localeCompare(b.tag))
      .map(e => `<option value="${e.id}" ${linkedEquipoId===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)} (${Utils.escHtml(e.tipo)})</option>`).join('');

    el.innerHTML = `
      <div class="section-header">
        <h2>Cálculo de Espesores de Evaluación</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="esp-clearBtn">🗑 Limpiar</button>
          <button class="btn btn-primary btn-sm" id="esp-reportBtn">🖨 Imprimir</button>
        </div>
      </div>

      <!-- Cargar desde equipo registrado -->
      <div class="card mb-2">
        <div class="card-body" style="padding:12px 18px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <label style="margin:0;font-weight:600;white-space:nowrap">Cargar equipo registrado:</label>
            <select class="form-control" id="esp-eqSelect" style="max-width:440px">
              <option value="">— Seleccionar equipo para precargar datos —</option>
              ${eqOpts}
            </select>
            <button class="btn btn-primary btn-sm" id="esp-loadEqBtn">📥 Cargar y Calcular</button>
            <button class="btn btn-secondary btn-sm" id="esp-applyEqBtn" style="display:none">💾 Actualizar equipo con este cálculo</button>
          </div>
        </div>
      </div>

      <div class="tab-nav" id="espTabNav">
        <button class="tab-btn active" data-tab="b313">ASME B31.3-2018<br><small>Tuberías (API 570)</small></button>
        <button class="tab-btn" data-tab="viii_shell">ASME VIII Div.1-2019<br><small>Envolvente (API 510)</small></button>
        <button class="tab-btn" data-tab="viii_heads">ASME VIII – Cabezas<br><small>UG-27 / UG-32</small></button>
        <button class="tab-btn" data-tab="api653">API 650 / API 653<br><small>Virolas del Manto</small></button>
        <button class="tab-btn" data-tab="ffs">API 579-1 Nivel 1<br><small>FFS Adelgazamiento</small></button>
      </div>

      <div class="grid-2" style="align-items:start">
        <div>
          <div class="tab-panel active" id="tp-b313">${renderB313Form()}</div>
          <div class="tab-panel"        id="tp-viii_shell">${renderVIIIShellForm()}</div>
          <div class="tab-panel"        id="tp-viii_heads">${renderVIIIHeadsForm()}</div>
          <div class="tab-panel"        id="tp-api653">${renderAPI650Form()}</div>
          <div class="tab-panel"        id="tp-ffs">${renderFFSForm()}</div>
        </div>
        <div id="espResultPanel">${renderEmptyResult()}</div>
      </div>

      <div class="card mt-3" id="matRefCard">
        <div class="card-header">
          <h3>📚 Catálogo de Materiales – Esfuerzos Admisibles (ASME II-D / ASME B31.3 / API 650)</h3>
          <button class="btn btn-secondary btn-sm" id="toggleMatRef">Ver tabla</button>
        </div>
        <div class="card-body" id="matRefBody" style="display:none">${renderMaterialTable()}</div>
      </div>`;

    _bindEvents(el);
  }

  function renderB313Form() {
    const mats = ThicknessCalc.getMaterials().map(m => `<option value="${m.key}" ${m.key==='API 5L Gr.B'?'selected':''}>${m.nombre}</option>`).join('');
    const joints = ThicknessCalc.getJointEfficiencies().map(j => `<option value="${j.value}">${j.key}</option>`).join('');
    return `
      <div class="card">
        <div class="card-header"><h3>ASME B31.3-2018 §304.1.2 – Tubería de Proceso (Tramo Recto)</h3></div>
        <div class="card-body">
          <div class="form-row cols-2">
            <div class="form-group"><label>Presión diseño P (kPa)<span class="required">*</span></label><input type="number" class="form-control" id="b313_P" value="4500" min="0" step="1"></div>
            <div class="form-group"><label>Temperatura diseño T (°C)<span class="required">*</span></label><input type="number" class="form-control" id="b313_T" value="90" step="1"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Diámetro exterior OD (mm)<span class="required">*</span></label><input type="number" class="form-control" id="b313_OD" value="168.3" min="1" step="0.1"></div>
            <div class="form-group"><label>Espesor nominal t<sub>nom</sub> (mm)</label><input type="number" class="form-control" id="b313_tnom" value="7.11" min="0" step="0.01"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Material (Tabla A-1)<span class="required">*</span></label><select class="form-control" id="b313_mat">${mats}</select></div>
            <div class="form-group"><label>Factor de calidad E</label><select class="form-control" id="b313_E">${joints}</select></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Factor soldadura W</label><input type="number" class="form-control" id="b313_W" value="1.0" min="0.5" max="1.0" step="0.05"></div>
            <div class="form-group"><label>Sobreespesor CA (mm)</label><input type="number" class="form-control" id="b313_CA" value="1.5" min="0" step="0.1"></div>
            <div class="form-group"><label>Tol. fabricación (%)</label><input type="number" class="form-control" id="b313_mill" value="12.5" min="0" max="20" step="0.5"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Espesor medido (mm)</label><input type="number" class="form-control" id="b313_tact" value="3.45" min="0" step="0.01"></div>
            <div class="form-group"><label>Tasa corrosión CR (mm/a)</label><input type="number" class="form-control" id="b313_CR" value="0.50" min="0" step="0.01"></div>
            <div class="form-group"><label>Plazo interv. alerta (a)</label><input type="number" class="form-control" id="b313_plazo" value="2.0" min="0.5" step="0.5"></div>
          </div>
          <button class="btn btn-primary w-full" id="b313_calcBtn">⚙ Calcular ASME B31.3</button>
        </div>
      </div>`;
  }

  function renderVIIIShellForm() {
    const mats = ThicknessCalc.getMaterials().map(m => `<option value="${m.key}" ${m.key==='SA-516-70'?'selected':''}>${m.nombre}</option>`).join('');
    const joints = ThicknessCalc.getJointEfficiencies().map(j => `<option value="${j.value}">${j.key}</option>`).join('');
    return `
      <div class="card">
        <div class="card-header"><h3>ASME VIII Div.1-2019 UG-27 – Envolvente Cilíndrica</h3></div>
        <div class="card-body">
          <div class="form-row cols-2">
            <div class="form-group"><label>Presión diseño P (kPa)<span class="required">*</span></label><input type="number" class="form-control" id="viii_P" value="2500" min="0"></div>
            <div class="form-group"><label>Temperatura diseño T (°C)<span class="required">*</span></label><input type="number" class="form-control" id="viii_T" value="120"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Diámetro interior ID (mm)<span class="required">*</span></label><input type="number" class="form-control" id="viii_ID" value="1200" min="1"></div>
            <div class="form-group"><label>Espesor nominal t<sub>nom</sub> (mm)</label><input type="number" class="form-control" id="viii_tnom" value="16.0" min="0" step="0.01"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Material (ASME II-D Tabla 1A)<span class="required">*</span></label><select class="form-control" id="viii_mat">${mats}</select></div>
            <div class="form-group"><label>Eficiencia de junta E (UW-12)</label><select class="form-control" id="viii_E">${joints}</select></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Sobreespesor corrosión CA (mm)</label><input type="number" class="form-control" id="viii_CA" value="3.0" min="0" step="0.1"></div>
            <div class="form-group"><label>Plazo intervención alerta (a)</label><input type="number" class="form-control" id="viii_plazo" value="2.0" min="0.5" step="0.5"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Espesor medido actual (mm)</label><input type="number" class="form-control" id="viii_tact" value="13.90" min="0" step="0.01"></div>
            <div class="form-group"><label>Tasa corrosión CR (mm/a)</label><input type="number" class="form-control" id="viii_CR" value="0.40" min="0" step="0.01"></div>
          </div>
          <button class="btn btn-primary w-full" id="viii_calcBtn">⚙ Calcular ASME VIII Div.1</button>
        </div>
      </div>`;
  }

  function renderVIIIHeadsForm() {
    const mats = ThicknessCalc.getMaterials().map(m => `<option value="${m.key}">${m.nombre}</option>`).join('');
    const joints = ThicknessCalc.getJointEfficiencies().map(j => `<option value="${j.value}">${j.key}</option>`).join('');
    return `
      <div class="card">
        <div class="card-header"><h3>ASME VIII Div.1-2019 – Cabezas (UG-27 / UG-32)</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label>Tipo de cabeza</label>
            <select class="form-control" id="head_tipo">
              <option value="hemi">Hemisférica (UG-27d)</option>
              <option value="ellip" selected>Elipsoidal 2:1 (UG-32d)</option>
              <option value="tori">Torisférica (UG-32e)</option>
            </select>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Presión diseño (kPa)<span class="required">*</span></label><input type="number" class="form-control" id="head_P" value="2500" min="0"></div>
            <div class="form-group"><label>Temperatura diseño (°C)<span class="required">*</span></label><input type="number" class="form-control" id="head_T" value="120"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Diámetro interior ID (mm)<span class="required">*</span></label><input type="number" class="form-control" id="head_ID" value="1200" min="1"></div>
            <div class="form-group"><label id="head_L_lbl" style="display:none">Radio corona L (mm)</label><input type="number" class="form-control" id="head_L" placeholder="= ID" style="display:none"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Material</label><select class="form-control" id="head_mat">${mats}</select></div>
            <div class="form-group"><label>Eficiencia junta E</label><select class="form-control" id="head_E">${joints}</select></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Corrosión adm. CA (mm)</label><input type="number" class="form-control" id="head_CA" value="3.0" min="0" step="0.1"></div>
            <div class="form-group"><label>Esp. nominal t<sub>nom</sub> (mm)</label><input type="number" class="form-control" id="head_tnom" value="16.0" min="0" step="0.1"></div>
            <div class="form-group"><label>Esp. medido (mm)</label><input type="number" class="form-control" id="head_tact" value="14.2" min="0" step="0.01"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label>Tasa corrosión CR (mm/a)</label><input type="number" class="form-control" id="head_CR" value="0.25" min="0" step="0.01"></div>
            <div class="form-group"><label>Plazo interv. alerta (a)</label><input type="number" class="form-control" id="head_plazo" value="2.0" min="0.5" step="0.5"></div>
          </div>
          <button class="btn btn-primary w-full" id="head_calcBtn">⚙ Calcular Cabeza</button>
        </div>
      </div>`;
  }

  function renderAPI650Form() {
    return `
      <div class="card">
        <div class="card-header"><h3>API 650 (2013) / API 653 (2014) – Virolas del Manto</h3></div>
        <div class="card-body">
          <div class="form-row cols-2">
            <div class="form-group"><label>Diámetro tanque D (m)<span class="required">*</span></label><input type="number" class="form-control" id="tk_D" value="18.0" min="0.5" step="0.1"></div>
            <div class="form-group"><label>Altura líquido sobre virola H (m)<span class="required">*</span></label><input type="number" class="form-control" id="tk_H" value="11.5" min="0.4" step="0.1"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Material</label>
              <select class="form-control" id="tk_mat">
                <option value="A-36" selected>ASTM A36 (SMYS 250 / UTS 400)</option>
                <option value="A-283-C">ASTM A283 Gr.C (SMYS 205 / UTS 380)</option>
                <option value="SA-516-70">SA-516 Gr.70 (SMYS 260 / UTS 485)</option>
              </select>
            </div>
            <div class="form-group"><label>Virola N°</label><input type="number" class="form-control" id="tk_virola" value="1" min="1" max="12" step="1"></div>
            <div class="form-group"><label>Gravedad esp. G</label><input type="number" class="form-control" id="tk_G" value="0.88" min="0.5" max="2.0" step="0.01"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Eficiencia junta E (API 653)</label><input type="number" class="form-control" id="tk_E" value="0.85" min="0.7" max="1.0" step="0.05"></div>
            <div class="form-group"><label>Sobreespesor CA (mm)</label><input type="number" class="form-control" id="tk_CA" value="1.5" min="0" step="0.1"></div>
            <div class="form-group"><label>Esp. nominal t<sub>nom</sub> (mm)</label><input type="number" class="form-control" id="tk_tnom" value="9.0" min="0" step="0.1"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>Esp. medido actual (mm)</label><input type="number" class="form-control" id="tk_tact" value="6.45" min="0" step="0.01"></div>
            <div class="form-group"><label>Tasa corrosión CR (mm/a)</label><input type="number" class="form-control" id="tk_CR" value="0.40" min="0" step="0.01"></div>
            <div class="form-group"><label>Plazo interv. (a)</label><input type="number" class="form-control" id="tk_plazo" value="2.0" min="0.5" step="0.5"></div>
          </div>
          <button class="btn btn-primary w-full" id="tk_calcBtn">⚙ Calcular API 650 / 653</button>
        </div>
      </div>`;
  }

  function renderFFSForm() {
    return `
      <div class="card">
        <div class="card-header"><h3>API 579-1 Parte 4 – FFS Nivel 1 (Adelgazamiento General)</h3></div>
        <div class="card-body">
          <div class="alert alert-info mb-2"><span class="alert-icon">ℹ️</span>
            <div>Criterio Nivel 1 (§4.4.2): el componente es aceptable si <strong>t<sub>actual</sub> − FCA ≥ t<sub>mín</sub></strong> (donde FCA = CR × período hasta inspección).</div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>t<sub>nominal</sub> (mm)<span class="required">*</span></label><input type="number" class="form-control" id="ffs_tnom" value="16.0" min="0.1" step="0.01"></div>
            <div class="form-group"><label>t<sub>actual</sub> (mm)<span class="required">*</span></label><input type="number" class="form-control" id="ffs_tact" value="13.90" min="0.1" step="0.01"></div>
            <div class="form-group"><label>t<sub>mín</sub> en servicio (mm)<span class="required">*</span></label><input type="number" class="form-control" id="ffs_tmin" value="10.99" min="0.1" step="0.01"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label>CR (mm/año)<span class="required">*</span></label><input type="number" class="form-control" id="ffs_CR" value="0.40" min="0" step="0.001"></div>
            <div class="form-group"><label>RSF admisible</label><input type="number" class="form-control" id="ffs_RSFa" value="0.90" min="0.5" max="1.0" step="0.01"></div>
            <div class="form-group"><label>Período futuro (años)</label><input type="number" class="form-control" id="ffs_fut" value="2.0" min="0" step="0.5"></div>
          </div>
          <button class="btn btn-primary w-full" id="ffs_calcBtn">⚙ Evaluar FFS Nivel 1</button>
        </div>
      </div>`;
  }

  function renderEmptyResult() {
    return `<div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px">
      <div class="empty-icon">🔧</div><h3>Resultados y Vista Gráfica</h3>
      <p>Cargue un equipo registrado o presione Calcular para ver los 5 espesores, la vista gráfica de pared, la comparativa en escala mm y la proyección de desgaste.</p></div>`;
  }

  /* ═══════════════════════════════════════════════════════════
     VISTA GRÁFICA DE ESPESORES (Sección + Barras 5 Espesores + Proyección)
     ═══════════════════════════════════════════════════════════ */
  function _renderGraphicalView({
    mode = 'cylinder', // 'pipe' | 'cylinder' | 'head' | 'tank' | 'ffs'
    title = '',
    tNom = null,
    tReq = null,
    tMin = null,
    tAlerta = null,
    tMed = null,
    CA = 0,
    CR = 0,
    D_m = null,
    H_m = null,
    virola = 1
  }) {
    const valid = v => v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0;
    const refMax = Math.max(
      valid(tNom) ? Number(tNom) : 0,
      valid(tMed) ? Number(tMed) : 0,
      valid(tAlerta) ? Number(tAlerta) : 0,
      valid(tMin) ? Number(tMin) : 0,
      valid(tReq) ? Number(tReq) : 0
    ) || 10;

    const nomVal = valid(tNom) ? Number(tNom) : refMax;
    const medVal = valid(tMed) ? Number(tMed) : null;
    const minVal = valid(tMin) ? Number(tMin) : 0;
    const alVal  = valid(tAlerta) ? Number(tAlerta) : minVal;
    const reqVal = valid(tReq) ? Number(tReq) : minVal;

    const belowMin = medVal !== null && minVal > 0 && medVal < minVal;
    const inAlert  = medVal !== null && !belowMin && alVal > 0 && medVal <= alVal;
    const stateColor = belowMin ? '#d93025' : inAlert ? '#e8a020' : '#22a06b';
    const stateLabel = medVal === null ? 'Solo diseño (sin medición)'
      : belowMin ? '⛔ Bajo mínimo en servicio'
      : inAlert  ? '⚠️ En zona de alerta'
      : '✅ Condición normal';

    const lossMm  = medVal !== null && valid(tNom) ? Math.max(0, nomVal - medVal) : 0;
    const lossPct = medVal !== null && valid(tNom) ? Utils.clamp((lossMm / nomVal) * 100, 0, 100) : 0;
    const margin  = medVal !== null && minVal > 0 ? medVal - minVal : null;

    /* ── 1. Esquema geométrico de pared (izquierda) ───────── */
    let geomSvg = '';
    if (mode === 'tank') {
      // Perfil vertical del manto de tanque con carga hidrostática y virola evaluada
      const wallW = 46;
      const remFrac = medVal !== null ? Utils.clamp(medVal / nomVal, 0.08, 1) : 1;
      const minFrac = Utils.clamp(minVal / nomVal, 0.08, 1);
      const alFrac  = Utils.clamp(alVal  / nomVal, 0.08, 1);
      const remW = wallW * remFrac;
      const minX = 110 + wallW * minFrac;
      const alX  = 110 + wallW * alFrac;

      geomSvg = `
        <div class="text-xs font-bold mb-1">Perfil de Virola ${virola} del Manto (API 650 / 653)</div>
        <svg viewBox="0 0 260 205" width="260" height="205" style="max-width:100%;margin:0 auto;display:block">
          <!-- Fluido con carga hidrostática -->
          <rect x="20" y="34" width="90" height="142" fill="#1a6fc418" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="4,3"/>
          <polygon points="108,36 108,174 36,174" fill="#1a6fc422"/>
          <text x="64" y="26" text-anchor="middle" font-size="9" font-weight="700" fill="#1a6fc4">Nivel H = ${H_m ?? '—'} m</text>
          <text x="64" y="158" text-anchor="middle" font-size="8.5" fill="#1a6fc4">Presión hidrostática</text>
          <!-- Plancha nominal (fondo gris) -->
          <rect x="110" y="34" width="${wallW}" height="142" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>
          <!-- Espesor perdido (si existe medición) -->
          ${medVal !== null && lossMm > 0 ? `<rect x="${110 + remW}" y="34" width="${Math.max(0, wallW - remW)}" height="142" fill="${stateColor}" opacity="0.32"/>` : ''}
          <!-- Espesor remanente -->
          <rect x="110" y="34" width="${remW}" height="142" fill="#64748b" opacity="0.55"/>
          <!-- Líneas t_min y t_alerta -->
          <line x1="${minX}" y1="28" x2="${minX}" y2="182" stroke="#d93025" stroke-width="1.8" stroke-dasharray="4,3"/>
          <line x1="${alX}"  y1="28" x2="${alX}"  y2="182" stroke="#e8a020" stroke-width="1.6" stroke-dasharray="3,2"/>
          <!-- Base fondo -->
          <rect x="16" y="176" width="170" height="7" rx="2" fill="#94a3b8"/>
          <!-- Etiquetas -->
          <text x="168" y="64" font-size="9" fill="#334155" font-weight="700">t_nom: ${nomVal.toFixed(2)} mm</text>
          <text x="168" y="84" font-size="9" fill="${stateColor}" font-weight="700">t_med: ${medVal !== null ? medVal.toFixed(2)+' mm' : '—'}</text>
          <text x="168" y="104" font-size="9" fill="#e8a020" font-weight="700">t_alerta: ${alVal.toFixed(2)} mm</text>
          <text x="168" y="124" font-size="9" fill="#d93025" font-weight="700">t_mín: ${minVal.toFixed(2)} mm</text>
          <text x="168" y="148" font-size="8.5" fill="#64748b">D = ${D_m ?? '—'} m</text>
          <text x="130" y="198" text-anchor="middle" font-size="9" fill="#64748b">Pérdida observada: ${lossPct.toFixed(1)}%</text>
        </svg>`;
    } else {
      // Corte transversal anular (Tubería / Recipiente / Cabeza / FFS)
      const rOut = 78;
      const wallPx = 32;
      const rInNom = rOut - wallPx; // 46
      const lossPx = medVal !== null ? Utils.clamp((nomVal - medVal) / nomVal, 0, 1) * wallPx : 0;
      const rActualIn = rInNom + lossPx;
      const rMinLimit = rOut - Utils.clamp(minVal / nomVal, 0, 1) * wallPx;
      const rAlertLim = rOut - Utils.clamp(alVal  / nomVal, 0, 1) * wallPx;

      geomSvg = `
        <div class="text-xs font-bold mb-1">Sección Transversal – Pared y Límites Normativos</div>
        <svg viewBox="0 0 230 205" width="230" height="205" style="max-width:100%;margin:0 auto;display:block">
          <!-- Metal nominal -->
          <circle cx="115" cy="96" r="${rOut}" fill="#cbd5e1" stroke="#475569" stroke-width="2.5"/>
          <!-- Zona perdida por corrosión interna -->
          ${medVal !== null && lossPx > 0 ? `<circle cx="115" cy="96" r="${rActualIn}" fill="${stateColor}" opacity="0.32"/>` : ''}
          <!-- Interior (fluido) -->
          <circle cx="115" cy="96" r="${rInNom}" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3,2"/>
          <!-- Borde real actual -->
          ${medVal !== null ? `<circle cx="115" cy="96" r="${rActualIn}" fill="none" stroke="${stateColor}" stroke-width="2.2"/>` : ''}
          <!-- Anillo límite t_alerta -->
          <circle cx="115" cy="96" r="${rAlertLim}" fill="none" stroke="#e8a020" stroke-width="1.6" stroke-dasharray="4,3"/>
          <!-- Anillo límite t_mín -->
          <circle cx="115" cy="96" r="${rMinLimit}" fill="none" stroke="#d93025" stroke-width="2" stroke-dasharray="5,3"/>
          <!-- Texto central -->
          <text x="115" y="90" text-anchor="middle" font-size="11.5" font-weight="800" fill="#1e293b">
            ${medVal !== null ? medVal.toFixed(2) + ' mm' : nomVal.toFixed(2) + ' mm'}
          </text>
          <text x="115" y="106" text-anchor="middle" font-size="9.5" font-weight="700" fill="${stateColor}">
            ${medVal !== null ? lossPct.toFixed(1) + '% pérdida' : 'Espesor nominal'}
          </text>
          <!-- Leyenda compacta -->
          <text x="115" y="186" text-anchor="middle" font-size="8.5" fill="#d93025">┈ Anillo rojo: t_mín (${minVal.toFixed(2)} mm)</text>
          <text x="115" y="198" text-anchor="middle" font-size="8.5" fill="#e8a020">┈ Anillo ámbar: t_alerta (${alVal.toFixed(2)} mm)</text>
        </svg>`;
    }

    /* ── 2. Gráfico comparativo en escala real de los 5 espesores (derecha) ── */
    const barsData = [
      { label: 'Nominal (t_nom)',      val: valid(tNom) ? Number(tNom) : null,    color: '#475569' },
      { label: 'Medido (t_med)',       val: medVal,                                color: stateColor },
      { label: 'Alerta (t_alerta)',    val: valid(tAlerta) ? Number(tAlerta) : null, color: '#e8a020' },
      { label: 'Mín. serv. (t_mín)',   val: valid(tMin) ? Number(tMin) : null,    color: '#d93025' },
      { label: 'Requerido (t_req)',    val: valid(tReq) ? Number(tReq) : null,    color: '#1a6fc4' },
    ].filter(b => b.val !== null);

    const maxBarVal = Math.max(...barsData.map(b => b.val), 1) * 1.12;
    const bW = 290, bH = barsData.length * 32 + 24;
    const minLineX = minVal > 0 ? 102 + (minVal / maxBarVal) * (bW - 154) : null;
    const alLineX  = alVal > 0  ? 102 + (alVal  / maxBarVal) * (bW - 154) : null;

    const barsSvg = `
      <div class="text-xs font-bold mb-1">Comparativa a Escala de los 5 Espesores (mm)</div>
      <svg viewBox="0 0 ${bW} ${bH}" width="${bW}" height="${bH}" style="max-width:100%;display:block;margin:0 auto">
        ${minLineX ? `<line x1="${minLineX}" y1="6" x2="${minLineX}" y2="${bH - 12}" stroke="#d93025" stroke-width="1.2" stroke-dasharray="3,3" opacity=".7"/>` : ''}
        ${alLineX  ? `<line x1="${alLineX}"  y1="6" x2="${alLineX}"  y2="${bH - 12}" stroke="#e8a020" stroke-width="1.2" stroke-dasharray="3,3" opacity=".7"/>` : ''}
        ${barsData.map((b, i) => {
          const y = i * 32 + 12;
          const w = Math.max(3, (b.val / maxBarVal) * (bW - 154));
          return `
            <text x="96" y="${y + 13}" text-anchor="end" font-size="9.5" font-weight="600" fill="#334155">${b.label}</text>
            <rect x="102" y="${y}" width="${w}" height="18" rx="4" fill="${b.color}" opacity=".88"/>
            <text x="${102 + w + 5}" y="${y + 13}" font-size="9.5" font-weight="700" fill="${b.color}" font-family="Consolas,monospace">${b.val.toFixed(2)}</text>`;
        }).join('')}
      </svg>`;

    /* ── 3. Proyección lineal Espesor vs. Tiempo (cuando hay t_med y CR > 0) ── */
    let projSvg = '';
    const crNum = Number(CR);
    if (medVal !== null && crNum > 0 && minVal > 0) {
      const rl = (medVal - minVal) / crNum;
      const tToAlert = (medVal - alVal) / crNum;
      const horizon = Utils.clamp(Math.ceil(Math.max(rl * 1.25, 4)), 4, 25);
      const PW = 520, PH = 140, pad = { t: 16, b: 28, l: 44, r: 22 };
      const iw = PW - pad.l - pad.r, ih = PH - pad.t - pad.b;
      const yMaxP = Math.max(medVal, nomVal, alVal, minVal) * 1.08;
      const yMinP = Math.max(0, Math.min(minVal, medVal - crNum * horizon) * 0.85);
      const xS = yr => pad.l + (yr / horizon) * iw;
      const yS = v  => pad.t + ih - ((v - yMinP) / (yMaxP - yMinP || 1)) * ih;

      const tEnd = Math.max(yMinP, medVal - crNum * horizon);
      const endYr = (medVal - tEnd) / crNum;
      const rlClamped = rl > 0 && rl <= horizon ? rl : null;
      const alClamped = tToAlert > 0 && tToAlert <= horizon ? tToAlert : null;

      projSvg = `
        <div class="mt-2 pt-2" style="border-top:1px solid var(--c-border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:6px">
            <span class="text-xs font-bold">📉 Proyección de Adelgazamiento (CR = ${crNum.toFixed(3)} mm/año)</span>
            <span class="text-xs text-muted">
              ${rl < 0 ? '⛔ Espesor ya por debajo de t_mín' : `Tiempo a t_alerta: <strong>${tToAlert > 0 ? tToAlert.toFixed(1)+' a' : 'En alerta'}</strong> · Vida remanente (t_mín): <strong>${rl.toFixed(2)} a</strong>`}
            </span>
          </div>
          <svg viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" style="max-width:100%;display:block">
            ${[0, 0.5, 1].map(f => {
              const y = pad.t + f * ih;
              const v = yMaxP - f * (yMaxP - yMinP);
              return `<line x1="${pad.l}" y1="${y}" x2="${PW - pad.r}" y2="${y}" stroke="var(--c-border)" stroke-width=".6"/>
                <text x="${pad.l - 5}" y="${y + 3}" font-size="8.5" text-anchor="end" fill="#64748b">${v.toFixed(1)}</text>`;
            }).join('')}
            <!-- Zona crítica bajo t_mín -->
            <rect x="${pad.l}" y="${yS(minVal)}" width="${iw}" height="${Math.max(0, pad.t + ih - yS(minVal))}" fill="#d9302512"/>
            <line x1="${pad.l}" y1="${yS(minVal)}" x2="${PW - pad.r}" y2="${yS(minVal)}" stroke="#d93025" stroke-width="1.3" stroke-dasharray="4,3"/>
            <text x="${PW - pad.r - 2}" y="${yS(minVal) - 3}" font-size="8.5" font-weight="700" fill="#d93025" text-anchor="end">t_mín (${minVal.toFixed(2)} mm)</text>
            <line x1="${pad.l}" y1="${yS(alVal)}" x2="${PW - pad.r}" y2="${yS(alVal)}" stroke="#e8a020" stroke-width="1.2" stroke-dasharray="4,3"/>
            <text x="${PW - pad.r - 2}" y="${yS(alVal) - 3}" font-size="8.5" font-weight="700" fill="#e8a020" text-anchor="end">t_alerta (${alVal.toFixed(2)} mm)</text>
            <!-- Curva lineal de desgaste -->
            <line x1="${xS(0)}" y1="${yS(medVal)}" x2="${xS(Math.min(endYr, horizon))}" y2="${yS(tEnd)}" stroke="#1a6fc4" stroke-width="2.4"/>
            <circle cx="${xS(0)}" cy="${yS(medVal)}" r="4" fill="#1a6fc4" stroke="#fff" stroke-width="1.5"/>
            ${alClamped ? `<circle cx="${xS(alClamped)}" cy="${yS(alVal)}" r="4" fill="#e8a020" stroke="#fff" stroke-width="1.5"/>` : ''}
            ${rlClamped ? `<circle cx="${xS(rlClamped)}" cy="${yS(minVal)}" r="4.5" fill="#d93025" stroke="#fff" stroke-width="1.5"/>
              <text x="${xS(rlClamped)}" y="${yS(minVal) + 12}" font-size="8.5" font-weight="700" fill="#d93025" text-anchor="middle">RL=${rl.toFixed(1)}a</text>` : ''}
            <!-- Eje X -->
            ${[0, 0.25, 0.5, 0.75, 1].map(f => {
              const yr = f * horizon;
              return `<text x="${xS(yr)}" y="${PH - 8}" font-size="8.5" text-anchor="middle" fill="#64748b">+${yr.toFixed(0)} a</text>`;
            }).join('')}
          </svg>
        </div>`;
    }

    return `
      <div class="card mt-2" style="background:var(--c-surface)">
        <div class="card-header" style="padding:10px 14px">
          <h3 style="font-size:.92rem">📊 Vista Gráfica de Espesores – ${Utils.escHtml(title)}</h3>
          <span class="badge" style="background:${stateColor}18;color:${stateColor};border:1px solid ${stateColor}">${stateLabel}</span>
        </div>
        <div class="card-body" style="padding:14px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:16px;align-items:center">
            <div style="text-align:center">${geomSvg}</div>
            <div>${barsSvg}</div>
          </div>
          ${projSvg}
          <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px solid var(--c-border)" class="text-xs">
            <span><strong>Margen sobre t<sub>mín</sub>:</strong> ${margin !== null ? `<span class="font-mono" style="color:${margin<0?'#d93025':'inherit'}">${margin>=0?'+':''}${margin.toFixed(2)} mm</span>` : '—'}</span>
            <span><strong>CA diseño:</strong> <span class="font-mono">${Number(CA||0).toFixed(2)} mm</span></span>
            <span><strong>Pérdida vs nominal:</strong> <span class="font-mono">${medVal !== null && valid(tNom) ? `${lossMm.toFixed(2)} mm (${lossPct.toFixed(1)}%)` : '—'}</span></span>
          </div>
        </div>
      </div>`;
  }

  /* ── Unified transparent result card + graphical view ───── */
  function _renderStandardResult(d, title, extras = [], graphMeta = {}) {
    if (d.error) return `<div class="alert alert-danger"><span class="alert-icon">❌</span><div><strong>Error:</strong> ${Utils.escHtml(d.error)}</div></div>`;
    const tMed = d.t_measured_mm ?? d.t_actual_mm ?? graphMeta.tMed ?? null;
    const tNom = d.t_nominal_mm ?? graphMeta.tNom ?? null;
    let statusCls = 'ok', statusTxt = '✅ Cálculo verificado';
    if (tMed !== null && d.t_min_servicio_mm !== undefined) {
      if (tMed < d.t_min_servicio_mm) { statusCls = 'critical'; statusTxt = '⛔ ESPESOR MEDIDO BAJO EL MÍNIMO EN SERVICIO'; }
      else if (d.t_alerta_mm && tMed <= d.t_alerta_mm) { statusCls = 'warn'; statusTxt = '⚠️ CONDICIÓN DE ALERTA (t_med ≤ t_alerta)'; }
      else { statusCls = 'ok'; statusTxt = '✅ CONDICIÓN NORMAL (t_med > t_alerta)'; }
    }

    const inputChips = Object.entries(d.entradas || {})
      .filter(([, val]) => val !== null && val !== undefined && val !== '')
      .map(([k, val]) => `<span class="badge badge-muted" style="font-family:var(--font-mono)">${Utils.escHtml(k)}: ${Utils.escHtml(String(val))}</span>`).join(' ');

    const graphHtml = _renderGraphicalView({
      mode: graphMeta.mode || 'cylinder',
      title,
      tNom,
      tReq: d.t_req_mm,
      tMin: d.t_min_servicio_mm,
      tAlerta: d.t_alerta_mm,
      tMed,
      CA: d.entradas?.CA_mm ?? 0,
      CR: d.entradas?.CR_mmpa ?? graphMeta.CR ?? 0,
      D_m: d.entradas?.D_m ?? null,
      H_m: d.entradas?.H_m ?? null,
      virola: d.entradas?.virola ?? 1
    });

    return `
      <div class="result-box">
        <h3>${Utils.escHtml(title)}</h3>
        <div class="text-xs" style="opacity:.8;margin-bottom:10px">📖 ${Utils.escHtml(d.norm)} · Material: ${Utils.escHtml(d.ref_material || '—')}</div>

        <div class="result-grid">
          <div class="result-item"><label>1. Nominal (t_nom)</label><span class="val">${tNom ? Number(tNom).toFixed(2) : '—'}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>2. Requerido (t_req)</label><span class="val">${d.t_req_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>3. Mín. servicio (t_mín)</label><span class="val" style="color:#ff9090">${d.t_min_servicio_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>4. Alerta (t_alerta)</label><span class="val" style="color:#f5c451">${d.t_alerta_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>5. Medido (t_med)</label><span class="val">${tMed !== null ? Number(tMed).toFixed(2) : '—'}</span><span class="unit">mm</span></div>
          ${extras.map(([lbl, val, unit]) => `<div class="result-item"><label>${lbl}</label><span class="val">${val}</span>${unit ? `<span class="unit">${unit}</span>` : ''}</div>`).join('')}
        </div>

        <div class="result-status ${statusCls}">${statusTxt}</div>
        ${d.warning ? `<div style="margin-top:8px;font-size:.78rem;color:#f5c451">⚠️ ${Utils.escHtml(d.warning)}</div>` : ''}
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.15);font-size:.76rem;font-family:var(--font-mono)">
          <strong>Ecuación:</strong> ${Utils.escHtml(d.formula)}
        </div>
      </div>

      ${graphHtml}

      <div class="card mt-2">
        <div class="card-body" style="font-size:.82rem">
          <div class="mb-2"><strong>Entradas utilizadas:</strong><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${inputChips}</div></div>
          ${d.explicacion_CA ? `<div class="mb-1"><strong>Sobreespesor por corrosión (CA):</strong> ${Utils.escHtml(d.explicacion_CA)}</div>` : ''}
          ${d.explicacion_tol ? `<div class="mb-1"><strong>Tolerancia de fabricación:</strong> ${Utils.escHtml(d.explicacion_tol)}</div>` : ''}
          ${d.alerta_justificacion ? `<div class="mb-1"><strong>Justificación de espesor de alerta:</strong> ${Utils.escHtml(d.alerta_justificacion)}</div>` : ''}
          ${d.alcance_manto ? `<div class="alert alert-warning mt-2 mb-0"><span class="alert-icon">⚠️</span><div>${Utils.escHtml(d.alcance_manto)}</div></div>` : ''}
        </div>
      </div>`;
  }

  function renderFFSResult(r, inputs) {
    if (r.error) return `<div class="alert alert-danger"><span class="alert-icon">❌</span><div>${Utils.escHtml(r.error)}</div></div>`;
    const statusCls = r.acceptable ? 'ok' : 'critical';
    const statusTxt = r.acceptable ? '✅ ACEPTABLE – Apto para continuar en servicio (API 579-1 Nivel 1)' : '⛔ NO ACEPTABLE – Requiere reparación, reemplazo o evaluación Nivel 2/3';
    const graphHtml = _renderGraphicalView({
      mode: 'ffs',
      title: 'API 579-1 Nivel 1 (Adelgazamiento General)',
      tNom: inputs.t_nominal_mm,
      tReq: inputs.t_min_mm,
      tMin: inputs.t_min_mm,
      tAlerta: inputs.t_min_mm + r.FCA_mm,
      tMed: inputs.t_actual_mm,
      CA: 0,
      CR: inputs.CR_mmpa
    });
    return `
      <div class="result-box">
        <h3>${Utils.escHtml(r.norm)}</h3>
        <div class="result-grid">
          <div class="result-item"><label>RSF equivalente</label><span class="val">${r.RSF.toFixed(3)}</span></div>
          <div class="result-item"><label>RSF admisible</label><span class="val">${r.RSF_a.toFixed(2)}</span></div>
          <div class="result-item"><label>FCA (pérdida futura)</label><span class="val">${r.FCA_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>t futuro (t_act − FCA)</label><span class="val">${r.t_future_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>Razón t_fut / t_mín</label><span class="val">${r.ratio_future.toFixed(3)}</span></div>
          <div class="result-item"><label>Vida remanente</label><span class="val">${isFinite(r.remaining_life_a) ? r.remaining_life_a.toFixed(2) : '∞'}</span><span class="unit">años</span></div>
        </div>
        <div class="result-status ${statusCls}">${statusTxt}</div>
        <div style="margin-top:10px;font-size:.75rem;font-family:var(--font-mono)">${Utils.escHtml(r.formula)}</div>
      </div>
      ${graphHtml}`;
  }

  function renderMaterialTable() {
    const mats = ThicknessCalc.getMaterials();
    const rows = mats.map(m => {
      const mat = ThicknessCalc.MATERIALS[m.key];
      const p8 = (mat.points_VIII || []).slice(0, 6).map(p => `${p[0]}°C:${p[1]}`).join(' | ');
      const p3 = (mat.points_B313 || []).slice(0, 6).map(p => `${p[0]}°C:${p[1]}`).join(' | ');
      return `<tr>
        <td class="font-mono font-bold">${Utils.escHtml(m.key)}</td>
        <td>${Utils.escHtml(m.nombre)}</td>
        <td class="text-xs font-mono">${p8}</td>
        <td class="text-xs font-mono">${p3}</td>
        <td class="text-xs font-mono">${mat.Sd_API650 ? `Sd=${mat.Sd_API650} / St=${mat.St_API650}` : '—'}</td>
      </tr>`;
    }).join('');
    return `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Material</th><th>Descripción</th><th>ASME II-D Tabla 1A (MPa)</th><th>ASME B31.3 Tabla A-1 (MPa)</th><th>API 650 Tabla 5-2a (MPa)</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="text-xs text-muted mt-1">Interpolación lineal automática entre temperaturas tabuladas.</p>`;
  }

  function _switchTab(el, tab) {
    currentTab = tab;
    el.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    el.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tp-${tab}`));
  }

  function _loadFromEquipo(el) {
    const eqId = el.querySelector('#esp-eqSelect')?.value;
    if (!eqId) { Utils.toast('Seleccione un equipo', 'Elija un equipo registrado para cargar sus datos.', 'warning'); return; }
    const eq = DB.getById('equipos', eqId);
    if (!eq) return;
    linkedEquipoId = eqId;
    const st = DB.evaluateEquipoStatus(eqId);
    const tact = st?.worstCML?.last?.espesor_mm ?? '';
    const cr   = st?.maxCR ?? 0;

    if (eq.tipo === 'Tubería a Presión') {
      _switchTab(el, 'b313');
      document.getElementById('b313_P').value = eq.presion_diseno_kPa ?? 4500;
      document.getElementById('b313_T').value = eq.temp_diseno_C ?? 90;
      document.getElementById('b313_OD').value = eq.diametro_mm ?? 168.3;
      document.getElementById('b313_tnom').value = eq.espesor_nominal_mm ?? 7.11;
      document.getElementById('b313_mat').value = eq.material || 'API 5L Gr.B';
      document.getElementById('b313_CA').value = eq.ca_mm ?? 1.5;
      document.getElementById('b313_mill').value = eq.tolerancia_fab_pct ?? 12.5;
      document.getElementById('b313_tact').value = tact;
      document.getElementById('b313_CR').value = cr ? Number(cr).toFixed(3) : 0;
      document.getElementById('b313_plazo').value = eq.plazo_intervencion_a ?? 2.0;
      runB313();
    } else if (eq.tipo === 'Tanque Atmosférico') {
      _switchTab(el, 'api653');
      document.getElementById('tk_D').value = (Number(eq.diametro_mm || 18000) / 1000).toFixed(2);
      document.getElementById('tk_H').value = eq.altura_liquido_m ?? 11.5;
      document.getElementById('tk_G').value = eq.gravedad_especifica ?? 0.88;
      document.getElementById('tk_virola').value = eq.numero_virola ?? 1;
      document.getElementById('tk_E').value = eq.eficiencia_junta ?? 0.85;
      document.getElementById('tk_CA').value = eq.ca_mm ?? 1.5;
      document.getElementById('tk_tnom').value = eq.espesor_nominal_mm ?? 9.0;
      document.getElementById('tk_tact').value = tact;
      document.getElementById('tk_CR').value = cr ? Number(cr).toFixed(3) : 0;
      document.getElementById('tk_plazo').value = eq.plazo_intervencion_a ?? 2.0;
      runAPI650();
    } else {
      _switchTab(el, 'viii_shell');
      document.getElementById('viii_P').value = eq.presion_diseno_kPa ?? 2500;
      document.getElementById('viii_T').value = eq.temp_diseno_C ?? 120;
      document.getElementById('viii_ID').value = eq.diametro_mm ?? 1200;
      document.getElementById('viii_tnom').value = eq.espesor_nominal_mm ?? 16.0;
      document.getElementById('viii_mat').value = eq.material || 'SA-516-70';
      document.getElementById('viii_CA').value = eq.ca_mm ?? 3.0;
      document.getElementById('viii_tact').value = tact;
      document.getElementById('viii_CR').value = cr ? Number(cr).toFixed(3) : 0;
      document.getElementById('viii_plazo').value = eq.plazo_intervencion_a ?? 2.0;
      runVIIIShell();
    }
    const applyBtn = el.querySelector('#esp-applyEqBtn');
    if (applyBtn) applyBtn.style.display = 'inline-flex';
  }

  function _bindEvents(el) {
    el.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _switchTab(el, btn.dataset.tab);
        document.getElementById('espResultPanel').innerHTML = renderEmptyResult();
      });
    });

    el.querySelector('#esp-loadEqBtn')?.addEventListener('click', () => _loadFromEquipo(el));
    el.querySelector('#esp-applyEqBtn')?.addEventListener('click', () => {
      if (!linkedEquipoId || !lastResult || lastResult.error) return;
      const d = lastResult.design ?? lastResult;
      if (d.t_min_servicio_mm === undefined) return;

      const patch = {
        espesor_requerido_mm: Number(d.t_req_mm.toFixed(2)),
        espesor_minimo_mm:    Number(d.t_min_servicio_mm.toFixed(2)),
        espesor_alerta_mm:    Number(d.t_alerta_mm.toFixed(2)),
      };
      if (lastMeta?.syncPatch) Object.assign(patch, lastMeta.syncPatch);
      DB.update('equipos', linkedEquipoId, patch);
      if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
      const eq = DB.getById('equipos', linkedEquipoId);
      Utils.toast('Equipo actualizado', `Variables de diseño y espesores (t_mín = ${d.t_min_servicio_mm.toFixed(2)} mm) sincronizados en ${eq?.tag}.`, 'success');
    });

    el.querySelector('#head_tipo')?.addEventListener('change', e => {
      const isTori = e.target.value === 'tori';
      el.querySelector('#head_L').style.display = isTori ? 'block' : 'none';
      el.querySelector('#head_L_lbl').style.display = isTori ? 'block' : 'none';
    });

    el.querySelector('#b313_calcBtn')?.addEventListener('click', runB313);
    el.querySelector('#viii_calcBtn')?.addEventListener('click', runVIIIShell);
    el.querySelector('#head_calcBtn')?.addEventListener('click', runHeads);
    el.querySelector('#tk_calcBtn')?.addEventListener('click', runAPI650);
    el.querySelector('#ffs_calcBtn')?.addEventListener('click', runFFS);

    el.querySelector('#esp-clearBtn')?.addEventListener('click', () => {
      document.getElementById('espResultPanel').innerHTML = renderEmptyResult();
      lastResult = null;
      lastMeta = null;
    });
    el.querySelector('#esp-reportBtn')?.addEventListener('click', () => window.print());
    el.querySelector('#toggleMatRef')?.addEventListener('click', () => {
      const body = document.getElementById('matRefBody');
      const btn  = document.getElementById('toggleMatRef');
      const vis  = body.style.display !== 'none';
      body.style.display = vis ? 'none' : 'block';
      btn.textContent = vis ? 'Ver tabla' : 'Ocultar';
    });
  }

  function getVal(id) { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; }
  function getStr(id) { const el = document.getElementById(id); return el ? el.value : ''; }

  function runB313() {
    const P = getVal('b313_P'), T = getVal('b313_T'), OD = getVal('b313_OD');
    if ([P, T, OD].some(isNaN)) { Utils.toast('Campos requeridos', 'Complete P, T y OD.', 'error'); return; }
    const d = ThicknessCalc.calcB313({
      P_kPa: P, temp_C: T, OD_mm: OD,
      material: getStr('b313_mat'),
      E_joint: getVal('b313_E'),
      W: getVal('b313_W') || 1.0,
      CA_mm: getVal('b313_CA') || 0,
      mill_tol_pct: getVal('b313_mill') || 12.5,
      t_nominal_mm: isNaN(getVal('b313_tnom')) ? null : getVal('b313_tnom'),
      t_measured_mm: isNaN(getVal('b313_tact')) ? undefined : getVal('b313_tact'),
      CR_mmpa: getVal('b313_CR') || 0,
      plazo_intervencion_a: getVal('b313_plazo') || 2.0,
    });
    lastResult = d;
    lastMeta = {
      syncPatch: {
        presion_diseno_kPa: P, temp_diseno_C: T, diametro_mm: OD,
        material: getStr('b313_mat'), eficiencia_junta: getVal('b313_E'),
        ca_mm: getVal('b313_CA') || 0, tolerancia_fab_pct: getVal('b313_mill') || 12.5,
        ...(isNaN(getVal('b313_tnom')) ? {} : { espesor_nominal_mm: getVal('b313_tnom') })
      }
    };
    const extras = [
      ['t_mín + CA', d.t_min_CA_mm?.toFixed(3), 'mm'],
      ['t_nom compra', d.t_nominal_req_mm?.toFixed(3), 'mm'],
      ['Esfuerzo S', d.S_MPa?.toFixed(1), 'MPa'],
      ['Coef. Y', d.Y?.toFixed(1), ''],
      ...(d.MAOP_kPa ? [['MAOP actual', (d.MAOP_kPa/1000).toFixed(2), 'MPa']] : []),
      ...(d.remaining_life_a !== null ? [['Vida rem.', isFinite(d.remaining_life_a) ? d.remaining_life_a.toFixed(2) : '∞', 'años']] : []),
    ];
    document.getElementById('espResultPanel').innerHTML = _renderStandardResult(d, 'ASME B31.3-2018 – Tubería de Proceso', extras, { mode: 'pipe' });
  }

  function runVIIIShell() {
    const P = getVal('viii_P'), T = getVal('viii_T'), ID = getVal('viii_ID');
    if ([P, T, ID].some(isNaN)) { Utils.toast('Campos requeridos', 'Complete P, T e ID.', 'error'); return; }
    const d = ThicknessCalc.calcVIII_cylinder({
      P_kPa: P, temp_C: T, ID_mm: ID,
      material: getStr('viii_mat'),
      E_joint: getVal('viii_E'),
      CA_mm: getVal('viii_CA') || 0,
      t_nominal_mm: isNaN(getVal('viii_tnom')) ? null : getVal('viii_tnom'),
      t_actual_mm: isNaN(getVal('viii_tact')) ? undefined : getVal('viii_tact'),
      CR_mmpa: getVal('viii_CR') || 0,
      plazo_intervencion_a: getVal('viii_plazo') || 2.0,
    });
    lastResult = d;
    lastMeta = {
      syncPatch: {
        presion_diseno_kPa: P, temp_diseno_C: T, diametro_mm: ID,
        material: getStr('viii_mat'), eficiencia_junta: getVal('viii_E'),
        ca_mm: getVal('viii_CA') || 0,
        ...(isNaN(getVal('viii_tnom')) ? {} : { espesor_nominal_mm: getVal('viii_tnom') })
      }
    };
    const extras = [
      ['t_diseño (+CA)', d.t_min_CA_mm?.toFixed(3), 'mm'],
      ['Esfuerzo S', d.S_MPa?.toFixed(1), 'MPa'],
      ['Radio R', d.R_mm?.toFixed(1), 'mm'],
      ...(d.MAWP_kPa ? [['MAWP actual', (d.MAWP_kPa/1000).toFixed(2), 'MPa']] : []),
      ...(d.remaining_life_a !== null ? [['Vida rem.', isFinite(d.remaining_life_a) ? d.remaining_life_a.toFixed(2) : '∞', 'años']] : []),
    ];
    document.getElementById('espResultPanel').innerHTML = _renderStandardResult(d, 'ASME VIII Div.1-2019 – Envolvente Cilíndrica', extras, { mode: 'cylinder' });
  }

  function runHeads() {
    const tipo = getStr('head_tipo');
    const P = getVal('head_P'), T = getVal('head_T'), ID = getVal('head_ID');
    if ([P, T, ID].some(isNaN)) { Utils.toast('Campos requeridos', 'Complete P, T e ID.', 'error'); return; }
    const cr = getVal('head_CR') || 0;
    const tnom = isNaN(getVal('head_tnom')) ? null : getVal('head_tnom');
    const tact = isNaN(getVal('head_tact')) ? null : getVal('head_tact');
    const params = {
      P_kPa: P, temp_C: T, ID_mm: ID,
      material: getStr('head_mat'), E_joint: getVal('head_E'), CA_mm: getVal('head_CA') || 0,
      CR_mmpa: cr, plazo_intervencion_a: getVal('head_plazo') || 2.0,
      L_crown_mm: tipo === 'tori' ? (getVal('head_L') || ID) : undefined,
    };
    const fnMap = { hemi: ThicknessCalc.calcVIII_hemi, ellip: ThicknessCalc.calcVIII_ellip, tori: ThicknessCalc.calcVIII_tori };
    const d = fnMap[tipo](params);
    lastResult = d;
    lastMeta = null;
    document.getElementById('espResultPanel').innerHTML = _renderStandardResult(
      d, `ASME VIII Div.1 – ${d.tipo}`,
      [['t_diseño (+CA)', d.t_min_CA_mm?.toFixed(3), 'mm'], ['Esfuerzo S', d.S_MPa?.toFixed(1), 'MPa']],
      { mode: 'head', tNom: tnom, tMed: tact, CR: cr }
    );
  }

  function runAPI650() {
    const D = getVal('tk_D'), H = getVal('tk_H');
    if ([D, H].some(isNaN)) { Utils.toast('Campos requeridos', 'Complete D y H.', 'error'); return; }
    const d = ThicknessCalc.calcAPI650({
      D_m: D, H_m: H, G: getVal('tk_G') || 1.0,
      material: getStr('tk_mat'),
      virola: parseInt(getStr('tk_virola'), 10) || 1,
      E_joint: getVal('tk_E') || 0.85,
      CA_mm: getVal('tk_CA') || 0,
      t_nominal_mm: isNaN(getVal('tk_tnom')) ? null : getVal('tk_tnom'),
      t_actual_mm: isNaN(getVal('tk_tact')) ? undefined : getVal('tk_tact'),
      CR_mmpa: getVal('tk_CR') || 0,
      plazo_intervencion_a: getVal('tk_plazo') || 2.0,
    });
    lastResult = d;
    lastMeta = {
      syncPatch: {
        diametro_mm: D * 1000, altura_liquido_m: H, gravedad_especifica: getVal('tk_G') || 1.0,
        material: getStr('tk_mat'), numero_virola: parseInt(getStr('tk_virola'), 10) || 1,
        eficiencia_junta: getVal('tk_E') || 0.85, ca_mm: getVal('tk_CA') || 0,
        ...(isNaN(getVal('tk_tnom')) ? {} : { espesor_nominal_mm: getVal('tk_tnom') })
      }
    };
    const extras = [
      ['t_req API 650', d.t_min_CA_mm?.toFixed(3), 'mm'],
      ['t_hidrostática', d.t_hydro_mm?.toFixed(3), 'mm'],
      ['S_d (API 650)', d.S_d_MPa?.toFixed(1), 'MPa'],
      ['S (API 653)', d.S_653_MPa?.toFixed(1), 'MPa'],
      ...(d.remaining_life_a !== null ? [['Vida rem.', isFinite(d.remaining_life_a) ? d.remaining_life_a.toFixed(2) : '∞', 'años']] : []),
    ];
    document.getElementById('espResultPanel').innerHTML = _renderStandardResult(d, `API 650 / API 653 – ${d.tipo}`, extras, { mode: 'tank' });
  }

  function runFFS() {
    const tnom = getVal('ffs_tnom'), tact = getVal('ffs_tact'), tmin = getVal('ffs_tmin'), CR = getVal('ffs_CR');
    if ([tnom, tact, tmin, CR].some(isNaN)) { Utils.toast('Campos requeridos', 'Complete espesores y CR.', 'error'); return; }
    const params = {
      t_nominal_mm: tnom, t_actual_mm: tact, t_min_mm: tmin,
      CR_mmpa: CR, RSF_a: getVal('ffs_RSFa') || 0.90, future_inspect_a: getVal('ffs_fut') || 0,
    };
    const r = ThicknessCalc.calcFFS_thinning(params);
    lastResult = r;
    lastMeta = null;
    document.getElementById('espResultPanel').innerHTML = renderFFSResult(r, params);
  }

  return { render };
})();
