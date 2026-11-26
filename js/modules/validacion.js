/**
 * SGIEE – Módulo: Validación Independiente, Ediciones Normativas y Alcance (Secciones 3, 6 y 9)
 * Ejecuta en vivo los 4 casos de verificación independiente (1 por familia + 1 RBI API RP 581)
 * comparando resultado esperado (verificado con Python) vs resultado del programa.
 */
const ModValidacion = (() => {

  function _runValidationCases() {
    // Caso 1: Tubería de proceso ASME B31.3-2018 §304.1.2
    // P=4500 kPa (4.5 MPa), OD=168.3 mm, API 5L Gr.B a 90°C (S=138 MPa), E=1.0, W=1.0, Y=0.4, CA=1.5 mm, tol=12.5%
    // Manual/Python: t_req = 4.5*168.3 / (2*(138*1*1 + 4.5*0.4)) = 757.35 / 279.6 = 2.708691 mm
    // t_m = 2.708691 + 1.5 = 4.208691 mm ; t_nom_req = 4.208691 / 0.875 = 4.809933 mm
    const c1 = ThicknessCalc.calcB313({
      P_kPa: 4500, OD_mm: 168.3, material: 'API 5L Gr.B', temp_C: 90,
      E_joint: 1.0, W: 1.0, CA_mm: 1.5, mill_tol_pct: 12.5
    });

    // Caso 2: Recipiente a presión ASME VIII Div.1-2019 UG-27(c)(1) + ASME II-D Tabla 1A
    // P=2500 kPa (2.5 MPa), ID=1200 mm (R=600 mm), SA-516-70 a 120°C (S=138 MPa), E=1.0, CA=3.0 mm
    // Manual/Python: t_req = 2.5*600 / (138*1.0 - 0.6*2.5) = 1500 / 136.5 = 10.989011 mm
    // t_dis_CA = 13.989011 mm
    const c2 = ThicknessCalc.calcVIII_cylinder({
      P_kPa: 2500, ID_mm: 1200, material: 'SA-516-70', temp_C: 120,
      E_joint: 1.0, CA_mm: 3.0
    });

    // Caso 3: Tanque atmosférico API 650 (2013) §5.6.3 & API 653 (2014) §4.3.3 (Virola 1 del manto)
    // D=18 m, H=11.5 m, G=0.88, A-36 (Sd=160 MPa, SMYS=250, UTS=400 -> S_653=min(200,171.6)=171.6 MPa), E=0.85, CA=1.5 mm
    // Manual/Python:
    //   API 650 sin CA: t_d = 4.9*18*(11.5-0.3)*0.88 / 160 = 869.2992 / 160 = 5.433120 mm (+1.5 CA = 6.933120 mm)
    //   API 653 servicio: t_min = 4.9*18*11.2*0.88 / (171.6*0.85) = 869.2992 / 145.86 = 5.959819 mm
    const c3 = ThicknessCalc.calcAPI650({
      D_m: 18.0, H_m: 11.5, G: 0.88, material: 'A-36', virola: 1, E_joint: 0.85, CA_mm: 1.5
    });

    // Caso 4: Módulo RBI cuantitativo API RP 581 Parte 2 §4 (Adelgazamiento generalizado – V-101)
    // t_trd=13.90, t_min=10.99, CR=0.40 mm/a, age=2.0 a, S=138, E=1.0, SMYS=260, UTS=485, Eff=B, N=2, gff=3.06e-5, F_MS=1.0, CA=185 m2, CE=450000 USD
    const c4 = ThicknessCalc.calcRBI581({
      familia: 'Vasija a Presión', t_trd_mm: 13.90, t_min_mm: 10.99, t_nom_mm: 16.0,
      CR_mmpa: 0.40, age_a: 2.0, S_MPa: 138, E_joint: 1.0, SMYS_MPa: 260, UTS_MPa: 485,
      insp_eff: 'B', insp_count: 2, gff: 3.06e-5, F_MS: 1.0, CA_m2: 185, CE_val: 450000, moneda: 'USD'
    });

    return [
      {
        familia: 'Tuberías de proceso',
        norma: 'ASME B31.3-2018 §304.1.2 (Tabla A-1)',
        entradas: 'P=4500 kPa, OD=168.3 mm, API 5L Gr.B @ 90 °C (S=138 MPa), E=1.0, W=1.0, Y=0.4, CA=1.5 mm, tol=12.5%',
        metrica: 't_req / t_nom,compra',
        esperado: 2.7087,
        obtenido: c1.t_req_mm,
        unidad: 'mm',
        extra: `t_m (+CA)=${c1.t_min_CA_mm.toFixed(3)} mm · t_nom,compra=${c1.t_nominal_req_mm.toFixed(3)} mm (esp. 4.810 mm)`
      },
      {
        familia: 'Recipientes a presión',
        norma: 'ASME VIII Div.1-2019 UG-27(c)(1) + ASME II-D Tabla 1A',
        entradas: 'P=2500 kPa, ID=1200 mm (R=600 mm), SA-516-70 @ 120 °C (S=138 MPa), E=1.0, CA=3.0 mm',
        metrica: 't_req (envolvente)',
        esperado: 10.9890,
        obtenido: c2.t_req_mm,
        unidad: 'mm',
        extra: `t_diseño (+CA)=${c2.t_min_CA_mm.toFixed(3)} mm (esp. 13.989 mm)`
      },
      {
        familia: 'Tanques atmosféricos',
        norma: 'API 650 (2013) §5.6.3 / API 653 (2014) §4.3.3',
        entradas: 'D=18.0 m, H=11.5 m, G=0.88, ASTM A36 (S_d=160 MPa, S_653=171.6 MPa), Virola 1, E=0.85, CA=1.5 mm',
        metrica: 't_mín en servicio (API 653)',
        esperado: 5.9598,
        obtenido: c3.t_min_servicio_mm,
        unidad: 'mm',
        extra: `API 650 t_d (sin CA)=${c3.t_req_mm.toFixed(3)} mm (esp. 5.433 mm) · t_req,650=${c3.t_min_CA_mm.toFixed(3)} mm`
      },
      {
        familia: 'Módulo RBI (Adelgazamiento)',
        norma: 'API RP 581 (3ª Ed., 2016) Parte 2 §4',
        entradas: 'V-101: t_trd=13.90 mm, t_mín=10.99 mm, CR=0.40 mm/a, age=2 a, Eff=B (N=2), gff=3.06×10⁻⁵, C_A=185 m², C_E=450k USD',
        metrica: 'Factor de Daño D_f / R_A / R_E',
        esperado: 1.1637,
        obtenido: c4.Df,
        unidad: 'adim.',
        extra: `f_F=${Utils.fmtSci(c4.f_F,3)} /a · R_A=${Utils.fmtSci(c4.R_A,3)} m²/a · R_E=${Utils.fmtSci(c4.R_E,2)} USD/a`
      }
    ];
  }

  function render() {
    const el = document.getElementById('mod-validacion');
    if (!el) return;

    const cases = _runValidationCases();
    const rows = cases.map(c => {
      const errPct = Math.abs(c.obtenido - c.esperado) / (Math.abs(c.esperado) || 1) * 100;
      const ok = errPct < 0.5;
      return `<tr>
        <td><strong>${Utils.escHtml(c.familia)}</strong><div class="text-xs text-muted">${Utils.escHtml(c.norma)}</div></td>
        <td class="text-xs" style="max-width:260px">${Utils.escHtml(c.entradas)}</td>
        <td class="font-mono text-xs">${Utils.escHtml(c.metrica)}</td>
        <td class="font-mono font-bold">${c.esperado.toFixed(4)} ${c.unidad}</td>
        <td class="font-mono font-bold" style="color:var(--c-primary)">${c.obtenido.toFixed(4)} ${c.unidad}<div class="text-xs text-muted" style="font-weight:400">${Utils.escHtml(c.extra)}</div></td>
        <td class="font-mono">${errPct.toFixed(3)} %</td>
        <td><span class="badge ${ok ? 'badge-success' : 'badge-danger'}">${ok ? '✅ PASA' : '❌ REVISAR'}</span></td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="section-header">
        <h2>Validación Independiente, Ediciones Normativas y Alcance</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨 Imprimir</button>
        </div>
      </div>

      <div class="alert alert-success mb-2">
        <span class="alert-icon">✅</span>
        <div>
          Todos los casos de verificación independiente (1 por familia + 1 RBI) se recalculan en tiempo real y se contrastan contra los valores de referencia verificados en Python (<code>validacion/test_validacion.py</code>).
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header"><h3>🧪 Casos de Comparación Independiente (Sección 6)</h3></div>
        <div class="card-body" style="padding:0">
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr>
                <th>Familia / Referencia</th><th>Entradas</th><th>Parámetro</th>
                <th>Resultado Esperado</th><th>Resultado Programa</th><th>Error</th><th>Estado</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid-2" style="gap:20px;align-items:start">
        <div class="card">
          <div class="card-header"><h3>📚 Ediciones Normativas Declaradas</h3></div>
          <div class="card-body" style="padding:0">
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Familia / Uso</th><th>Diseño / Referencia</th><th>Inspección en Servicio</th></tr></thead>
                <tbody>
                  <tr><td><strong>Tuberías de proceso</strong> (tramo recto)</td><td>ASME B31.3-2018 (§304.1.2, Tablas 304.1.1 y A-1)</td><td>API 570 (4ª Ed., 2016)</td></tr>
                  <tr><td><strong>Recipientes a presión</strong> (envolvente)</td><td>ASME VIII Div.1-2019 (UG-27, UG-32) + ASME II-D-2019 (Tabla 1A)</td><td>API 510 (10ª Ed., 2014)</td></tr>
                  <tr><td><strong>Tanques atmosféricos</strong> (virolas manto)</td><td>API 650 12ª Ed. (2013) (§5.6.3, Tabla 5-2a)</td><td>API 653 5ª Ed. (2014) (§4.3.3, §6.3)</td></tr>
                  <tr><td><strong>Evaluación RBI</strong> (adelgazamiento)</td><td>API RP 580 (3ª Ed., 2016)</td><td>API RP 581 (3ª Ed., 2016, Parte 2 §4)</td></tr>
                  <tr><td><strong>Ampliación FFS</strong></td><td colspan="2">API 579-1 / ASME FFS-1 Parte 4 – Nivel 1 (Adelgazamiento general)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>📌 Alcance, Supuestos y Limitaciones</h3></div>
          <div class="card-body text-sm" style="line-height:1.55">
            <ul style="list-style:disc;margin-left:18px">
              <li><strong>Prototipo académico:</strong> diseñado para demostrar el flujo integral de gestión de integridad en equipos estáticos sobre GitHub Pages.</li>
              <li><strong>Catálogo de materiales:</strong> cubre aceros al carbono, baja aleación e inoxidables frecuentes con interpolación lineal por temperatura dentro de los rangos declarados.</li>
              <li><strong>Tanques atmosféricos:</strong> el cálculo normativo y los intervalos cubren las <strong>virolas del manto</strong>; fondo (MFL/vacío), techo, boquillas y asentamiento diferencial se declaran como datos pendientes.</li>
              <li><strong>RBI cuantitativo simplificado:</strong> implementa el submodelo de <em>adelgazamiento generalizado</em> de API RP 581 (actualización bayesiana de estados de daño, D<sub>f</sub>, f<sub>F</sub>, R<sub>A</sub> y R<sub>E</sub>). Las consecuencias C<sub>A</sub> y C<sub>E</sub> son ingresadas por el usuario; no se modelan efectos físicos de dispersión/incendio.</li>
              <li><strong>Conservación de datos:</strong> utiliza <code>localStorage</code> más exportación/importación completa en archivo <code>.json</code> incluyendo esquemas y adjuntos.</li>
            </ul>
          </div>
        </div>
      </div>`;
  }

  return { render };
})();
