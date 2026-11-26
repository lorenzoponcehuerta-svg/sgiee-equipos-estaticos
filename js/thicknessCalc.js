/**
 * SGIEE – Engineering Calculation Engine
 *
 * Covers:
 *  1. ASME B31.3-2018       – Process Piping (§304.1.2, Table 304.1.1, Table A-1)
 *  2. ASME VIII Div.1-2019  – Pressure Vessels (UG-27, UG-32, UW-12) + ASME II-D-2019 (Table 1A)
 *  3. API 650 12th Ed.(2013)– Welded Tanks for Oil Storage (§5.6.3 One-Foot Method, Table 5-2a)
 *  4. API 653 5th Ed.(2014) – Tank Inspection, Repair, Alteration (§4.3.3 Shell, §6.3 Intervals)
 *  5. API 510 (2014) / API 570 (2016) / API 653 (2014) – Next inspection rules by family
 *  6. API RP 580 (2016) / API RP 581 (2016) Part 2 §4 – Quantitative Thinning RBI (simplified academic model)
 *  7. API 579-1/ASME FFS-1  – Part 4 Level 1 General Metal Loss
 *
 * Units: SI (pressure [kPa], thickness/diameter [mm] except tank D/H [m], stress [MPa], temp [°C])
 */
const ThicknessCalc = (() => {

  /* ═══════════════════════════════════════════════════════════
     1. STANDARD EDITIONS & SCOPE REGISTRY
     ═══════════════════════════════════════════════════════════ */
  const STANDARDS = {
    'ASME B31.3': {
      edition: 'ASME B31.3-2018',
      section: '§304.1.2, Tabla 304.1.1, Tabla A-1',
      inService: 'API 570 (4ª Ed., 2016)',
      file: 'ASME B31.3 (2018)',
      appliesTo: ['Tubería a Presión'],
      description: 'Diseño de tuberías de proceso a presión (tramo recto).'
    },
    'ASME VIII Div.1': {
      edition: 'ASME BPVC Sec. VIII Div. 1-2019',
      section: 'UG-27, UG-32, Tabla UW-12',
      inService: 'API 510 (10ª Ed., 2014)',
      file: 'ASME BPVC VIII Div.1 (2019)',
      appliesTo: ['Vasija a Presión', 'Intercambiador', 'Caldera / Horno'],
      description: 'Diseño de recipientes a presión (envolvente cilíndrica y cabezas).'
    },
    'ASME II-D': {
      edition: 'ASME BPVC Sec. II Parte D-2019',
      section: 'Tabla 1A (Esfuerzos admisibles)',
      inService: 'Referencia de materiales',
      file: 'ASME BPVC II-D (2019)',
      appliesTo: ['Vasija a Presión', 'Intercambiador', 'Caldera / Horno'],
      description: 'Esfuerzos admisibles en tensión para recipientes a presión.'
    },
    'API 650': {
      edition: 'API 650 12ª Ed. (2013)',
      section: '§5.6.3 Método de un pie, Tabla 5-2a',
      inService: 'API 653 (5ª Ed., 2014)',
      file: 'API 650 (2013)',
      appliesTo: ['Tanque Atmosférico'],
      description: 'Diseño de virolas del manto de tanques soldados de almacenamiento atmosférico.'
    }
  };

  /* ═══════════════════════════════════════════════════════════
     2. MATERIAL DATABASE WITH SEPARATE CODE TABLES & LINEAR INTERPOLATION
        points: [[T_C, S_MPa], ...] sorted ascending by T_C
        Ref:
         - VIII: ASME BPVC II-D (2019) Table 1A (metric)
         - B313: ASME B31.3 (2018) Table A-1 (metric)
         - API650: API 650 (2013) Table 5-2a (Sd, St, SMYS, UTS)
     ═══════════════════════════════════════════════════════════ */
  const MATERIALS = {
    'SA-516-70': {
      nombre: 'SA-516 Gr.70 (Acero al Carbono – Recipientes)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 260,
      UTS_MPa: 485,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      ref_API650: 'API 650 (2013) Tabla 5-2a',
      Sd_API650: 173, St_API650: 194,
      points_VIII: [[-30,138],[40,138],[100,138],[150,138],[200,138],[250,138],[300,134],[325,130],[350,125],[375,120],[400,114],[425,102]],
      points_B313: [[-30,138],[40,138],[100,138],[200,138],[250,138],[300,134],[350,125],[400,114],[425,102]],
      tablaS: [[-30,250,138],[250,300,134],[300,375,120],[375,425,102]]
    },
    'SA-516-60': {
      nombre: 'SA-516 Gr.60 (Acero al Carbono – Recipientes)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 220,
      UTS_MPa: 415,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      ref_API650: 'API 650 (2013) Tabla 5-2a',
      Sd_API650: 147, St_API650: 165,
      points_VIII: [[-30,118],[40,118],[100,118],[200,118],[250,118],[300,118],[350,111],[375,107],[400,101],[425,90]],
      points_B313: [[-30,118],[40,118],[200,118],[300,118],[350,111],[400,101],[425,90]],
      tablaS: [[-30,300,118],[300,350,111],[350,425,90]]
    },
    'SA-516-55': {
      nombre: 'SA-516 Gr.55 (Acero al Carbono)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 205,
      UTS_MPa: 380,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      Sd_API650: 137, St_API650: 154,
      points_VIII: [[-30,108],[40,108],[200,108],[300,108],[350,102],[400,93],[425,83]],
      points_B313: [[-30,108],[40,108],[200,108],[300,108],[350,102],[400,93]],
      tablaS: [[-30,300,108],[300,350,102],[350,425,83]]
    },
    'SA-285-C': {
      nombre: 'SA-285 Gr.C (Acero al Carbono)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 205,
      UTS_MPa: 380,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      Sd_API650: 137, St_API650: 154,
      points_VIII: [[-30,108],[40,108],[200,108],[300,108],[345,102]],
      points_B313: [[-30,108],[40,108],[200,108],[300,108],[345,102]],
      tablaS: [[-30,300,108],[300,345,102]]
    },
    'A-36': {
      nombre: 'ASTM A36 (Acero Estructural – Tanques API 650)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 250,
      UTS_MPa: 400,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      ref_API650: 'API 650 (2013) Tabla 5-2a',
      Sd_API650: 160, St_API650: 171,
      points_VIII: [[-30,114],[40,114],[200,114],[300,114],[345,106]],
      points_B313: [[-30,114],[40,114],[200,114],[300,114],[345,106]],
      tablaS: [[-30,300,114],[300,345,106]]
    },
    'A-283-C': {
      nombre: 'ASTM A283 Gr.C (Plancha – Tanques API 650)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 205,
      UTS_MPa: 380,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      ref_API650: 'API 650 (2013) Tabla 5-2a',
      Sd_API650: 137, St_API650: 154,
      points_VIII: [[-30,108],[40,108],[200,108],[300,108]],
      points_B313: [[-30,108],[40,108],[200,108],[300,108]],
      tablaS: [[-30,300,108]]
    },
    'API 5L Gr.B': {
      nombre: 'API 5L Gr.B (Tubería de Proceso)',
      familia: 'ferritic',
      E_MPa: 207000,
      SMYS_MPa: 241,
      UTS_MPa: 414,
      ref_VIII: 'ASME II-D (2019) ref. equiv.',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,118],[40,118],[200,118],[300,118],[370,110]],
      points_B313: [[-29,138],[38,138],[100,138],[150,138],[204,138],[260,130],[316,119],[343,114],[371,110]],
      tablaS: [[-29,204,138],[204,260,130],[260,316,119],[316,371,110]]
    },
    'SA-106-B': {
      nombre: 'ASTM A106 Gr.B / SA-106-B (Tubería Sin Costura)',
      familia: 'ferritic',
      E_MPa: 200000,
      SMYS_MPa: 240,
      UTS_MPa: 415,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,118],[40,118],[200,118],[300,118],[350,114],[400,103],[425,90]],
      points_B313: [[-29,138],[38,138],[100,138],[150,138],[204,138],[260,130],[316,119],[343,114],[371,110],[400,90]],
      tablaS: [[-29,204,138],[204,260,130],[260,316,119],[316,371,110]]
    },
    'API 5L X42': {
      nombre: 'API 5L X42 (Tubería)',
      familia: 'ferritic',
      E_MPa: 207000,
      SMYS_MPa: 290,
      UTS_MPa: 414,
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,118],[204,118],[316,114]],
      points_B313: [[-29,138],[38,138],[204,138],[260,130],[316,119]],
      tablaS: [[-29,204,138],[204,316,119]]
    },
    'API 5L X52': {
      nombre: 'API 5L X52 (Tubería)',
      familia: 'ferritic',
      E_MPa: 207000,
      SMYS_MPa: 359,
      UTS_MPa: 455,
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,130],[204,130],[316,122]],
      points_B313: [[-29,152],[38,152],[204,152],[260,143],[316,131]],
      tablaS: [[-29,204,152],[204,316,131]]
    },
    'SA-312-TP304': {
      nombre: 'SA-312 TP304 (Acero Inoxidable Austenítico)',
      familia: 'austenitic',
      E_MPa: 195000,
      SMYS_MPa: 205,
      UTS_MPa: 515,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,138],[40,138],[100,115],[150,104],[200,96],[250,91],[300,86],[350,83],[400,80],[450,78]],
      points_B313: [[-30,138],[38,138],[100,138],[150,138],[200,129],[250,121],[300,115],[350,111],[400,107],[450,104]],
      tablaS: [[-30,150,138],[150,250,121],[250,350,111],[350,450,104]]
    },
    'SA-312-TP316': {
      nombre: 'SA-312 TP316 (Acero Inoxidable Austenítico)',
      familia: 'austenitic',
      E_MPa: 195000,
      SMYS_MPa: 205,
      UTS_MPa: 515,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,138],[40,138],[100,138],[150,125],[200,115],[250,108],[300,103],[350,99],[400,95],[450,92]],
      points_B313: [[-30,138],[38,138],[100,138],[150,138],[200,133],[250,124],[300,117],[350,112],[400,108],[450,106]],
      tablaS: [[-30,150,138],[150,250,124],[250,350,112],[350,450,106]]
    },
    'SA-240-304': {
      nombre: 'SA-240 Gr.304 (Plancha Inox. Austenítico)',
      familia: 'austenitic',
      E_MPa: 195000,
      SMYS_MPa: 205,
      UTS_MPa: 515,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,138],[40,138],[100,115],[150,104],[200,96],[250,91],[300,86],[350,83],[400,80],[450,78]],
      points_B313: [[-30,138],[38,138],[150,138],[250,121],[350,111],[450,104]],
      tablaS: [[-30,100,138],[100,200,96],[200,350,83],[350,450,78]]
    },
    'SA-335-P11': {
      nombre: 'SA-335 P11 (1.25Cr-0.5Mo Tubería)',
      familia: 'ferritic',
      E_MPa: 198000,
      SMYS_MPa: 205,
      UTS_MPa: 415,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,118],[40,118],[200,118],[300,118],[375,115],[425,110],[480,99]],
      points_B313: [[-30,138],[40,138],[200,138],[300,134],[375,127],[425,118],[480,99]],
      tablaS: [[-30,200,138],[200,375,127],[375,480,99]]
    },
    'SA-387-11': {
      nombre: 'SA-387 Gr.11 Cl.2 (1.25Cr-0.5Mo Plancha)',
      familia: 'ferritic',
      E_MPa: 198000,
      SMYS_MPa: 310,
      UTS_MPa: 515,
      ref_VIII: 'ASME II-D (2019) Tabla 1A',
      ref_B313: 'ASME B31.3 (2018) Tabla A-1',
      points_VIII: [[-30,147],[40,147],[200,147],[300,147],[375,143],[425,138],[480,121]],
      points_B313: [[-30,147],[40,147],[300,147],[425,138],[480,121]],
      tablaS: [[-30,300,147],[300,425,138],[425,480,121]]
    }
  };

  /* ═══════════════════════════════════════════════════════════
     3. NPS / SCHEDULE LOOKUP (ASME B36.10M) & JOINT EFFICIENCIES
     ═══════════════════════════════════════════════════════════ */
  const PIPE_SCHEDULES = {
    '0.5-40':  { od:21.3,  t:2.77 }, '0.5-80':  { od:21.3,  t:3.73 },
    '0.75-40': { od:26.7,  t:2.87 }, '0.75-80': { od:26.7,  t:3.91 },
    '1-40':    { od:33.4,  t:3.38 }, '1-80':    { od:33.4,  t:4.55 },
    '1.5-40':  { od:48.3,  t:3.68 }, '1.5-80':  { od:48.3,  t:5.08 },
    '2-40':    { od:60.3,  t:3.91 }, '2-80':    { od:60.3,  t:5.54 },
    '2.5-40':  { od:73.0,  t:5.16 }, '2.5-80':  { od:73.0,  t:7.01 },
    '3-40':    { od:88.9,  t:5.49 }, '3-80':    { od:88.9,  t:7.62 },
    '4-40':    { od:114.3, t:6.02 }, '4-80':    { od:114.3, t:8.56 },
    '6-40':    { od:168.3, t:7.11 }, '6-80':    { od:168.3, t:10.97},
    '8-40':    { od:219.1, t:8.18 }, '8-80':    { od:219.1, t:12.70},
    '10-40':   { od:273.1, t:9.27 }, '10-80':   { od:273.1, t:15.09},
    '12-40':   { od:323.9, t:9.53 }, '12-80':   { od:323.9, t:17.48},
    '14-40':   { od:355.6, t:9.53 }, '14-80':   { od:355.6, t:19.05},
    '16-40':   { od:406.4, t:9.53 }, '16-80':   { od:406.4, t:21.44},
    '18-40':   { od:457.2, t:9.53 }, '18-80':   { od:457.2, t:23.83},
    '20-40':   { od:508.0, t:9.53 }, '20-80':   { od:508.0, t:26.19},
    '24-40':   { od:609.6, t:9.53 }, '24-80':   { od:609.6, t:30.96},
  };

  const JOINT_EFF = {
    'Full RT / Sin costura (E=1.00)': 1.00,
    'Spot RT / ERW (E=0.85)':         0.85,
    'Sin RT – Tipo 1 (E=0.70)':       0.70,
    'Sin RT – Tipo 2 (E=0.65)':       0.65,
    'Sin RT – Tipo 3 (E=0.60)':       0.60,
  };

  /* ═══════════════════════════════════════════════════════════
     4. ALLOWABLE STRESS WITH LINEAR INTERPOLATION (NO GAPS)
     ═══════════════════════════════════════════════════════════ */
  function getAllowableStress(material, temp_C, code = 'VIII') {
    const mat = MATERIALS[material];
    if (!mat) return null;
    const pts = (code === 'B313' && mat.points_B313) ? mat.points_B313 : (mat.points_VIII || mat.points_B313);
    if (!pts || pts.length === 0) return null;

    const minT = pts[0][0];
    const maxT = pts[pts.length - 1][0];

    if (temp_C < minT) {
      return {
        S: pts[0][1],
        ref: code === 'B313' ? (mat.ref_B313 || 'ASME B31.3 Tabla A-1') : (mat.ref_VIII || 'ASME II-D Tabla 1A'),
        warning: `Temperatura ${temp_C} °C inferior al límite tabulado (${minT} °C). Verificar tenacidad/MDMT.`
      };
    }
    if (temp_C > maxT) {
      return {
        S: pts[pts.length - 1][1],
        ref: code === 'B313' ? (mat.ref_B313 || 'ASME B31.3 Tabla A-1') : (mat.ref_VIII || 'ASME II-D Tabla 1A'),
        warning: `Temperatura ${temp_C} °C excede el límite tabulado (${maxT} °C). Verificar en norma vigente.`
      };
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const [t1, s1] = pts[i];
      const [t2, s2] = pts[i + 1];
      if (temp_C >= t1 && temp_C <= t2) {
        const S = t2 === t1 ? s1 : s1 + ((temp_C - t1) / (t2 - t1)) * (s2 - s1);
        return Number(S.toFixed(2));
      }
    }
    return pts[pts.length - 1][1];
  }

  /* ── ASME B31.3 Table 304.1.1 Coefficient Y ─────────────── */
  function _getB313CoeffY(material, temp_C) {
    const mat = MATERIALS[material];
    const isAust = mat?.familia === 'austenitic' || /304|316|321/.test(material || '');
    if (isAust) {
      if (temp_C <= 566) return 0.4;
      if (temp_C <= 593) return 0.5;
      return 0.7;
    }
    // Ferritic steels
    if (temp_C <= 482) return 0.4;
    if (temp_C <= 510) return 0.5;
    return 0.7;
  }

  /* ── Alert thickness helper with justification ──────────── */
  function calcAlertThickness(t_min_serv, CR_mmpa = 0, plazo_intervencion_a = 2.0, CA_mm = 0) {
    const plazo = Number(plazo_intervencion_a) > 0 ? Number(plazo_intervencion_a) : 2.0;
    const cr = Number(CR_mmpa) > 0 ? Number(CR_mmpa) : 0;
    if (cr > 0) {
      const margen = cr * plazo;
      return {
        t_alerta_mm: t_min_serv + margen,
        margen_mm: margen,
        justificacion: `t_alerta = t_mín_serv (${t_min_serv.toFixed(2)} mm) + CR (${cr.toFixed(3)} mm/a) × plazo de intervención (${plazo} años) = ${(t_min_serv + margen).toFixed(2)} mm.`
      };
    }
    const margenFallback = Math.max(CA_mm > 0 ? 0.25 * CA_mm : 0.5, 0.5);
    return {
      t_alerta_mm: t_min_serv + margenFallback,
      margen_mm: margenFallback,
      justificacion: `Sin tasa de corrosión activa: se adopta margen preventivo de ${margenFallback.toFixed(2)} mm sobre t_mín_serv (máx. entre 25 % de CA y 0.50 mm) para gestión de intervención.`
    };
  }

  /* ═══════════════════════════════════════════════════════════
     5. ASME B31.3-2018 – TUBERÍAS DE PROCESO (TRAMO RECTO)
        §304.1.2 Eq.(3a): t = P·D / [2·(S·E·W + P·Y)]
     ═══════════════════════════════════════════════════════════ */
  function calcB313(params) {
    const {
      P_kPa, OD_mm, material, temp_C, E_joint = 1.0, W = 1.0,
      CA_mm = 0, mill_tol_pct = 12.5,
      t_nominal_mm = null, t_measured_mm = undefined,
      CR_mmpa = 0, plazo_intervencion_a = 2.0, t_structural_min_mm = 0
    } = params;

    if (!(P_kPa >= 0) || !(OD_mm > 0)) return { error: 'Presión P ≥ 0 kPa y diámetro exterior OD > 0 mm son obligatorios.' };
    const P = P_kPa / 1000; // MPa
    const D = OD_mm;        // mm
    const SA = getAllowableStress(material, temp_C, 'B313');
    if (!SA) return { error: `Material "${material}" no reconocido en catálogo.` };

    const S_val = typeof SA === 'object' ? SA.S : SA;
    const warning = typeof SA === 'object' ? SA.warning : null;
    const matRef = MATERIALS[material]?.ref_B313 || 'ASME B31.3-2018 Tabla A-1';
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const Y = _getB313CoeffY(material, temp_C);

    // 1) Required pressure thickness (sin CA)
    const t_req = (P * D) / (2 * (S_val * E * W + P * Y));
    // 2) Minimum design thickness with corrosion allowance
    const t_min_CA = t_req + CA_mm;
    // 3) Minimum nominal thickness to purchase considering mill under-tolerance (ASME B36.10M: 12.5%)
    const mill_factor = 1 / (1 - mill_tol_pct / 100);
    const t_nominal_req = t_min_CA * mill_factor;
    // 4) Minimum allowable in-service retirement thickness (API 570: max(t_req, t_structural))
    const t_min_serv = Math.max(t_req, Number(t_structural_min_mm) || 0);
    // 5) Alert thickness
    const alertInfo = calcAlertThickness(t_min_serv, CR_mmpa, plazo_intervencion_a, CA_mm);

    // MAOP and Remaining Life based on in-service minimum (NO double-counting CA!)
    let MAOP = null, RL = null;
    if (t_measured_mm !== undefined && t_measured_mm !== null && !isNaN(t_measured_mm)) {
      const t_act = Number(t_measured_mm);
      MAOP = (2 * S_val * E * W * t_act) / (D - 2 * Y * t_act) * 1000; // kPa
      if (CR_mmpa > 0) {
        RL = (t_act - t_min_serv) / CR_mmpa;
      }
    }

    return {
      norm: 'ASME B31.3-2018 §304.1.2 (en servicio: API 570)',
      ref_material: matRef,
      entradas: {
        P_kPa, P_MPa: P, temp_C, OD_mm: D, material, E_joint: E, W, Y,
        CA_mm, mill_tol_pct, t_nominal_mm, t_measured_mm, CR_mmpa, plazo_intervencion_a
      },
      P_MPa: P,
      S_MPa: S_val,
      E_joint: E,
      W,
      Y,
      t_design_mm: t_req,
      t_req_mm: t_req,
      t_min_CA_mm: t_min_CA,
      t_nominal_req_mm: t_nominal_req,
      t_min_servicio_mm: t_min_serv,
      t_alerta_mm: alertInfo.t_alerta_mm,
      alerta_justificacion: alertInfo.justificacion,
      t_nominal_mm: t_nominal_mm,
      t_measured_mm: t_measured_mm ?? null,
      MAOP_kPa: MAOP,
      remaining_life_a: RL,
      warning,
      formula: 't_req = P·D / [2·(S·E·W + P·Y)] ; t_m = t_req + CA ; t_nom,req = t_m / (1 - tol/100)',
      explicacion_CA: `Sobreespesor por corrosión CA = ${CA_mm} mm reservado para pérdida durante la vida útil; en servicio el retiro estructural gobierna en t_mín_serv = ${t_min_serv.toFixed(3)} mm.`,
      explicacion_tol: `Tolerancia de laminación = ${mill_tol_pct}% (ASME B36.10M: -12.5% para tubería sin costura). Divide t_m por (1 - ${(mill_tol_pct/100).toFixed(3)}) para definir el espesor nominal mínimo de compra (${t_nominal_req.toFixed(3)} mm).`
    };
  }

  /* ═══════════════════════════════════════════════════════════
     6. ASME VIII DIV.1-2019 – RECIPIENTES A PRESIÓN
        UG-27(c)(1) Envolvente cilíndrica: t = P·R / (S·E - 0.6·P)
     ═══════════════════════════════════════════════════════════ */
  function calcVIII_cylinder(params) {
    const {
      P_kPa, ID_mm, material, temp_C, E_joint = 1.0, CA_mm = 0,
      t_nominal_mm = null, t_actual_mm = undefined,
      CR_mmpa = 0, plazo_intervencion_a = 2.0, tol_fab_mm = 0.3
    } = params;

    if (!(P_kPa >= 0) || !(ID_mm > 0)) return { error: 'Presión P ≥ 0 kPa y diámetro interior ID > 0 mm son obligatorios.' };
    const P = P_kPa / 1000; // MPa
    const R = ID_mm / 2;    // mm

    const SA = getAllowableStress(material, temp_C, 'VIII');
    if (!SA) return { error: `Material "${material}" no reconocido.` };
    const S_val = typeof SA === 'object' ? SA.S : SA;
    let warning = typeof SA === 'object' ? SA.warning : null;
    const matRef = MATERIALS[material]?.ref_VIII || 'ASME II-D (2019) Tabla 1A';
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);

    if (P > 0.385 * S_val * E) {
      warning = (warning ? warning + ' ' : '') + 'P > 0.385·S·E: excede límite de pared delgada UG-27(c)(1); aplicar Apéndice 1-2.';
    }

    // Required pressure thickness (sin CA)
    const t_req = (P * R) / (S_val * E - 0.6 * P);
    // Minimum required thickness per UG-16(b) (1.5 mm excl. CA for pressure vessels)
    const t_min_serv = Math.max(t_req, 1.5);
    // Design thickness including CA
    const t_min_CA = t_req + CA_mm;
    const t_nominal_req = t_min_CA + (Number(tol_fab_mm) || 0);
    const alertInfo = calcAlertThickness(t_min_serv, CR_mmpa, plazo_intervencion_a, CA_mm);

    let MAWP = null, RL = null;
    const t_eval = (t_actual_mm !== undefined && t_actual_mm !== null && !isNaN(t_actual_mm)) ? Number(t_actual_mm) : null;
    if (t_eval !== null) {
      MAWP = (S_val * E * t_eval) / (R + 0.6 * t_eval) * 1000; // kPa (en condición actual medida)
      if (CR_mmpa > 0) {
        RL = (t_eval - t_min_serv) / CR_mmpa;
      }
    }

    const sigma_H = (P * R) / (t_eval ?? t_min_CA);
    const eta = sigma_H / (S_val * E);

    return {
      norm: 'ASME BPVC Sec. VIII Div. 1-2019 UG-27(c)(1) (en servicio: API 510)',
      ref_material: matRef,
      tipo: 'Envolvente cilíndrica',
      entradas: {
        P_kPa, P_MPa: P, temp_C, ID_mm, R_mm: R, material, E_joint: E,
        CA_mm, tol_fab_mm, t_nominal_mm, t_actual_mm: t_eval, CR_mmpa, plazo_intervencion_a
      },
      P_MPa: P,
      R_mm: R,
      S_MPa: S_val,
      E_joint: E,
      t_design_mm: t_req,
      t_req_mm: t_req,
      t_min_CA_mm: t_min_CA,
      t_nominal_req_mm: t_nominal_req,
      t_min_servicio_mm: t_min_serv,
      t_alerta_mm: alertInfo.t_alerta_mm,
      alerta_justificacion: alertInfo.justificacion,
      t_nominal_mm,
      t_actual_mm: t_eval,
      MAWP_kPa: MAWP,
      remaining_life_a: RL,
      eta_pct: eta * 100,
      warning,
      formula: 't_req = P·R / (S·E – 0.6·P) ; t_diseño = t_req + CA ; t_mín_serv = max(t_req, 1.5 mm)',
      explicacion_CA: `Sobreespesor por corrosión CA = ${CA_mm} mm considerado en diseño (t_diseño = ${t_min_CA.toFixed(3)} mm). En servicio (API 510), la vida remanente se calcula hasta t_mín_serv = ${t_min_serv.toFixed(3)} mm.`,
      explicacion_tol: `Tolerancia de plancha (SA-20 / ASME II-A): tolerancia negativa típica ${tol_fab_mm} mm considerada para definir espesor nominal comercial (${t_nominal_req.toFixed(3)} mm).`
    };
  }

  function calcVIII_hemi(params) {
    const { P_kPa, ID_mm, material, temp_C, E_joint = 1.0, CA_mm = 0, CR_mmpa = 0, plazo_intervencion_a = 2.0 } = params;
    const P = P_kPa / 1000;
    const R = ID_mm / 2;
    const SA = getAllowableStress(material, temp_C, 'VIII');
    if (!SA) return { error: 'Material no reconocido.' };
    const S = typeof SA === 'object' ? SA.S : SA;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const t_req = (P * R) / (2 * S * E - 0.2 * P);
    const t_min_serv = Math.max(t_req, 1.5);
    const alertInfo = calcAlertThickness(t_min_serv, CR_mmpa, plazo_intervencion_a, CA_mm);
    return {
      norm: 'ASME VIII Div. 1-2019 UG-27(d)',
      ref_material: MATERIALS[material]?.ref_VIII || 'ASME II-D (2019) Tabla 1A',
      tipo: 'Cabeza hemisférica',
      entradas: { P_kPa, temp_C, ID_mm, material, E_joint: E, CA_mm },
      P_MPa: P, S_MPa: S, E_joint: E,
      t_design_mm: t_req, t_req_mm: t_req,
      t_min_CA_mm: t_req + CA_mm,
      t_min_servicio_mm: t_min_serv,
      t_alerta_mm: alertInfo.t_alerta_mm,
      alerta_justificacion: alertInfo.justificacion,
      formula: 't_req = P·R / (2·S·E – 0.2·P)',
      warning: typeof SA === 'object' ? SA.warning : null,
    };
  }

  function calcVIII_ellip(params) {
    const { P_kPa, ID_mm, material, temp_C, E_joint = 1.0, CA_mm = 0, CR_mmpa = 0, plazo_intervencion_a = 2.0 } = params;
    const P = P_kPa / 1000;
    const D = ID_mm;
    const SA = getAllowableStress(material, temp_C, 'VIII');
    if (!SA) return { error: 'Material no reconocido.' };
    const S = typeof SA === 'object' ? SA.S : SA;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const t_req = (P * D) / (2 * S * E - 0.2 * P);
    const t_min_serv = Math.max(t_req, 1.5);
    const alertInfo = calcAlertThickness(t_min_serv, CR_mmpa, plazo_intervencion_a, CA_mm);
    return {
      norm: 'ASME VIII Div. 1-2019 UG-32(d)',
      ref_material: MATERIALS[material]?.ref_VIII || 'ASME II-D (2019) Tabla 1A',
      tipo: 'Cabeza elipsoidal 2:1',
      entradas: { P_kPa, temp_C, ID_mm, material, E_joint: E, CA_mm },
      P_MPa: P, S_MPa: S, E_joint: E,
      t_design_mm: t_req, t_req_mm: t_req,
      t_min_CA_mm: t_req + CA_mm,
      t_min_servicio_mm: t_min_serv,
      t_alerta_mm: alertInfo.t_alerta_mm,
      alerta_justificacion: alertInfo.justificacion,
      formula: 't_req = P·D / (2·S·E – 0.2·P)',
      warning: typeof SA === 'object' ? SA.warning : null,
    };
  }

  function calcVIII_tori(params) {
    const { P_kPa, ID_mm, L_crown_mm, material, temp_C, E_joint = 1.0, CA_mm = 0, CR_mmpa = 0, plazo_intervencion_a = 2.0 } = params;
    const P = P_kPa / 1000;
    const L = L_crown_mm || ID_mm;
    const SA = getAllowableStress(material, temp_C, 'VIII');
    if (!SA) return { error: 'Material no reconocido.' };
    const S = typeof SA === 'object' ? SA.S : SA;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const t_req = (0.885 * P * L) / (S * E - 0.1 * P);
    const t_min_serv = Math.max(t_req, 1.5);
    const alertInfo = calcAlertThickness(t_min_serv, CR_mmpa, plazo_intervencion_a, CA_mm);
    return {
      norm: 'ASME VIII Div. 1-2019 UG-32(e)',
      ref_material: MATERIALS[material]?.ref_VIII || 'ASME II-D (2019) Tabla 1A',
      tipo: 'Cabeza torisférica',
      entradas: { P_kPa, temp_C, ID_mm, L_crown_mm: L, material, E_joint: E, CA_mm },
      P_MPa: P, S_MPa: S, E_joint: E, L_crown_mm: L,
      t_design_mm: t_req, t_req_mm: t_req,
      t_min_CA_mm: t_req + CA_mm,
      t_min_servicio_mm: t_min_serv,
      t_alerta_mm: alertInfo.t_alerta_mm,
      alerta_justificacion: alertInfo.justificacion,
      formula: 't_req = 0.885·P·L / (S·E – 0.1·P)',
      warning: typeof SA === 'object' ? SA.warning : null,
    };
  }

  /* ═══════════════════════════════════════════════════════════
     7. API 650 (2013) §5.6.3 & API 653 (2014) §4.3.3 – TANQUES ATMOSFÉRICOS
        Diseño (API 650):
          t_d = 4.9·D·(H - 0.3)·G / S_d + CA
          t_t = 4.9·D·(H - 0.3) / S_t
          S_d = min(2/3·SMYS, 2/5·UTS)  (o Tabla 5-2a)
          S_t = min(3/4·SMYS, 3/7·UTS)
        En servicio (API 653 §4.3.3):
          t_min = max(4.9·D·(H - 0.3)·G / (S_653·E), 2.54 mm)
          S_653 = min(0.80·SMYS, 0.429·UTS) para virolas 1–2
                  min(0.88·SMYS, 0.472·UTS) para virolas ≥ 3
     ═══════════════════════════════════════════════════════════ */
  function _api650NominalMin(D_m) {
    // API 650 §5.6.1.1 minimum nominal shell plate thickness
    if (D_m < 15) return 5.0;
    if (D_m < 36) return 6.0;
    if (D_m <= 60) return 8.0;
    return 10.0;
  }

  function calcAPI650(params) {
    const {
      D_m, H_m, G = 1.0, material = 'A-36',
      SMYS_MPa, UTS_MPa, CA_mm = 0,
      E_joint = 0.85, virola = 1,
      t_nominal_mm = null, t_actual_mm = undefined,
      CR_mmpa = 0, plazo_intervencion_a = 2.0
    } = params;

    if (!(D_m > 0) || !(H_m > 0.3)) {
      return { error: 'Se requiere diámetro D > 0 m y altura de líquido H > 0.3 m.' };
    }
    const mat = MATERIALS[material];
    const smys = Number(SMYS_MPa) > 0 ? Number(SMYS_MPa) : (mat?.SMYS_MPa || 250);
    const uts  = Number(UTS_MPa)  > 0 ? Number(UTS_MPa)  : (mat?.UTS_MPa  || 400);
    const E    = Number(E_joint)  > 0 ? Number(E_joint)  : 0.85;
    const course = parseInt(virola, 10) || 1;

    // API 650 design & hydro stresses (Table 5-2a / §5.6.2)
    const S_d = (mat && !SMYS_MPa && mat.Sd_API650) ? mat.Sd_API650 : Math.min((2 / 3) * smys, 0.40 * uts);
    const S_t = (mat && !SMYS_MPa && mat.St_API650) ? mat.St_API650 : Math.min(0.75 * smys, (3 / 7) * uts);

    const t_d_sinCA = (4.9 * D_m * (H_m - 0.3) * G) / S_d;
    const t_d_CA    = t_d_sinCA + CA_mm;
    const t_hydro   = (4.9 * D_m * (H_m - 0.3)) / S_t;
    const t_const   = _api650NominalMin(D_m);
    const t_req_650 = Math.max(t_d_CA, t_hydro, t_const);

    // API 653 §4.3.3 in-service retirement thickness for shell course
    const S_653 = course <= 2
      ? Math.min(0.80 * smys, 0.429 * uts)
      : Math.min(0.88 * smys, 0.472 * uts);
    const t_653_calc = (4.9 * D_m * (H_m - 0.3) * G) / (S_653 * E);
    const t_min_serv = Math.max(t_653_calc, 2.54); // API 653 §4.3.3.1 (0.10 in = 2.54 mm)

    const alertInfo = calcAlertThickness(t_min_serv, CR_mmpa, plazo_intervencion_a, CA_mm);

    let RL = null;
    const t_eval = (t_actual_mm !== undefined && t_actual_mm !== null && !isNaN(t_actual_mm)) ? Number(t_actual_mm) : null;
    if (t_eval !== null && CR_mmpa > 0) {
      RL = (t_eval - t_min_serv) / CR_mmpa;
    }

    return {
      norm: 'API 650 12ª Ed. (2013) §5.6.3 / API 653 5ª Ed. (2014) §4.3.3',
      ref_material: mat?.ref_API650 || 'API 650 Tabla 5-2a / API 653 Tabla 4-1',
      tipo: `Virola ${course} del manto`,
      entradas: { D_m, H_m, G, material, SMYS_MPa: smys, UTS_MPa: uts, CA_mm, E_joint: E, virola: course, t_nominal_mm, t_actual_mm: t_eval, CR_mmpa },
      S_d_MPa: S_d,
      S_hydro_MPa: S_t,
      S_653_MPa: S_653,
      E_joint: E,
      t_design_mm: t_d_sinCA,
      t_req_mm: t_d_sinCA,
      t_hydro_mm: t_hydro,
      t_constructivo_mm: t_const,
      t_min_CA_mm: t_req_650,
      t_min_servicio_mm: t_min_serv,
      t_alerta_mm: alertInfo.t_alerta_mm,
      alerta_justificacion: alertInfo.justificacion,
      t_nominal_mm,
      t_actual_mm: t_eval,
      remaining_life_a: RL,
      alcance_manto: 'Alcance: cálculo aplicado exclusivamente a virolas del manto (Método de un pie). Datos pendientes para evaluación integral del tanque: fondo (MFL/prueba de vacío), techo, boquillas y asentamiento diferencial.',
      warning: 'Verificar también cargas sísmicas/viento y criterio de inspección del fondo/techo según API 653.',
      formula: 'API 650: t_d = 4.9·D·(H-0.3)·G/S_d + CA | API 653: t_mín = max(4.9·D·(H-0.3)·G/(S·E), 2.54 mm)',
      explicacion_CA: `CA = ${CA_mm} mm se suma al espesor de diseño API 650 (t_req,650 = ${t_req_650.toFixed(3)} mm considerando t_d+CA, hidrostática y mínimo constructivo ${t_const} mm). En servicio (API 653), el mínimo admisible es t_mín_serv = ${t_min_serv.toFixed(3)} mm.`,
      explicacion_tol: `Plancha comercial según ASTM A6 (tolerancia negativa típica 0.3 mm). Mínimo constructivo API 650 §5.6.1.1 para D=${D_m} m es ${t_const.toFixed(1)} mm.`
    };
  }

  // Backward-compatible alias for API 653 direct calls
  function calcAPI653(params) {
    return calcAPI650(params);
  }

  /* ═══════════════════════════════════════════════════════════
     8. API 579-1 PART 4 LEVEL 1 – GENERAL METAL LOSS (CORRECTED)
        Level 1 acceptance: t_am - FCA >= t_min  (Rt = (t_actual - FCA) / t_min >= 1.0)
        Also reports MAWP reduction ratio RSF_est = min(1, (t_actual - FCA) / t_min)
     ═══════════════════════════════════════════════════════════ */
  function calcFFS_thinning(params) {
    const {
      t_nominal_mm,
      t_actual_mm,
      t_min_mm,
      CR_mmpa = 0,
      RSF_a = 0.90,
      future_inspect_a = 0
    } = params;

    if (!(t_actual_mm > 0) || !(t_min_mm > 0)) {
      return { error: 'Se requieren t_actual > 0 y t_min > 0.' };
    }

    const FCA = Math.max(0, CR_mmpa * future_inspect_a);
    const t_future = t_actual_mm - FCA;
    // Level 1 uniform thinning criterion (API 579-1 §4.4.2): t_actual - FCA >= t_min
    const ratio_actual = t_actual_mm / t_min_mm;
    const ratio_future = t_future / t_min_mm;
    // Effective RSF for uniform thinning = min(1.0, t_actual / t_min)
    const RSF = Math.min(1.0, ratio_actual);
    const RSF_future = Math.min(1.0, Math.max(0, ratio_future));
    const acceptable = t_future >= t_min_mm && RSF >= RSF_a;

    // Limit thickness at RSF_a (for rerated MAWP) vs code t_min
    const t_lim = Math.max(t_min_mm * RSF_a, t_min_mm);
    const RL = CR_mmpa > 0 ? (t_actual_mm - t_min_mm) / CR_mmpa : Infinity;
    const max_interval = isFinite(RL) && RL > 0 ? RL / 2 : null;

    return {
      norm: 'API 579-1 / ASME FFS-1 Parte 4 – Nivel 1 (Adelgazamiento general)',
      RSF,
      RSF_a,
      ratio_actual,
      ratio_future,
      FCA_mm: FCA,
      acceptable,
      t_lim_mm: t_lim,
      remaining_life_a: RL,
      max_cbm_interval_a: max_interval,
      t_future_mm: t_future,
      RSF_future,
      nivel_ffs: acceptable ? 'ACEPTABLE' : 'NO ACEPTABLE',
      formula: 'Nivel 1 (§4.4.2): t_actual – FCA ≥ t_mín ; RSF_eq = min(1, t_actual / t_mín) ≥ RSF_a',
    };
  }

  /* ═══════════════════════════════════════════════════════════
     9. NEXT INSPECTION INTERVALS BY FAMILY (API 510 / 570 / 653)
     ═══════════════════════════════════════════════════════════ */
  function calcNextInspection({
    tipoEquipo,
    tipoInspeccion = 'Medición de espesores',
    fechaReferencia,
    rl_a,
    cr_mmpa,
    claseTuberia = 'Clase 1',
    t_actual_mm = null,
    t_min_mm = null,
    t_alerta_mm = null
  }) {
    const refDate = fechaReferencia || new Date().toISOString().split('T')[0];
    const hasRL = rl_a !== null && rl_a !== undefined && !isNaN(rl_a);
    const isBelowMin = (t_actual_mm !== null && t_min_mm !== null && t_actual_mm < t_min_mm) || (hasRL && rl_a < 0);

    let norma = 'API 510 (10ª Ed., 2014)';
    let topeNormativo = 10;
    let intervalo = null;
    let criterio = '';
    let declaracionAlcance = null;

    if (tipoEquipo === 'Tubería a Presión') {
      norma = `API 570 (4ª Ed., 2016) – ${claseTuberia}`;
      const topesEsp = { 'Clase 1': 5, 'Clase 2': 10, 'Clase 3': 10 };
      const topesExt = { 'Clase 1': 5, 'Clase 2': 5,  'Clase 3': 10 };
      topeNormativo = tipoInspeccion === 'Externa'
        ? (topesExt[claseTuberia] || 5)
        : (topesEsp[claseTuberia] || 5);

      if (isBelowMin) {
        intervalo = 0;
        criterio = 'Espesor bajo el mínimo admisible (t_med < t_mín): acción inmediata / evaluación FFS.';
      } else if (tipoInspeccion === 'Externa') {
        intervalo = topeNormativo;
        criterio = `Tope normativo API 570 Tabla 1 (inspección externa ${claseTuberia}: máx. ${topeNormativo} años).`;
      } else if (!hasRL || !isFinite(rl_a)) {
        intervalo = topeNormativo;
        criterio = cr_mmpa === null
          ? `Sin tasa de corrosión confirmada: se aplica tope máximo API 570 ${claseTuberia} (${topeNormativo} años) sujeto a seguimiento.`
          : `Sin pérdida de espesor activa (CR ≤ 0): gobierna tope máximo API 570 ${claseTuberia} (${topeNormativo} años).`;
      } else {
        const halfRL = rl_a / 2;
        if (halfRL < topeNormativo) {
          intervalo = halfRL;
          criterio = `Regla de vida media API 570 (RL/2 = ${halfRL.toFixed(2)} a < tope ${topeNormativo} a de ${claseTuberia}).`;
        } else {
          intervalo = topeNormativo;
          criterio = `Tope normativo API 570 ${claseTuberia} (${topeNormativo} a ≤ RL/2 = ${halfRL.toFixed(2)} a).`;
        }
      }
    } else if (tipoEquipo === 'Tanque Atmosférico') {
      norma = 'API 653 (5ª Ed., 2014) – §6.3 (Manto)';
      declaracionAlcance = 'Alcance: mediciones de espesor e inspección externa sobre virolas del manto (API 653 §6.3.2–§6.3.3). Datos pendientes para otras inspecciones: inspección interna y de fondo (MFL/vacío, §6.4), techo, boquillas y asentamiento.';
      if (isBelowMin) {
        intervalo = 0;
        criterio = 'Espesor de virola bajo el mínimo API 653 §4.3.3: acción inmediata / reducción de nivel o reparación.';
      } else if (tipoInspeccion === 'Externa') {
        topeNormativo = 5;
        const quarterRL = (hasRL && isFinite(rl_a)) ? rl_a / 4 : Infinity;
        intervalo = Math.min(quarterRL, 5);
        criterio = quarterRL < 5
          ? `API 653 §6.3.2 (RCA/4N = ${quarterRL.toFixed(2)} a < tope 5 años).`
          : 'Tope normativo API 653 §6.3.2 (inspección externa máx. 5 años).';
      } else {
        // UT thickness measurements of shell (§6.3.3)
        if (cr_mmpa === null || cr_mmpa === undefined) {
          topeNormativo = 5;
          intervalo = 5;
          criterio = 'API 653 §6.3.3.2(a): tasa de corrosión desconocida → intervalo máximo 5 años.';
        } else if (!hasRL || !isFinite(rl_a)) {
          topeNormativo = 15;
          intervalo = 15;
          criterio = 'API 653 §6.3.3.2(b): CR conocida sin desgaste activo → tope máximo 15 años.';
        } else {
          topeNormativo = 15;
          const halfRL = rl_a / 2;
          if (halfRL < 15) {
            intervalo = halfRL;
            criterio = `API 653 §6.3.3.2(b) – Vida media del manto (RL/2 = ${halfRL.toFixed(2)} a < tope 15 años).`;
          } else {
            intervalo = 15;
            criterio = `Tope normativo API 653 §6.3.3.2(b) (15 años ≤ RL/2 = ${halfRL.toFixed(2)} a).`;
          }
        }
      }
    } else {
      // Pressure Vessels & Heat Exchangers -> API 510
      norma = 'API 510 (10ª Ed., 2014) – §6.4 / §6.5';
      topeNormativo = tipoInspeccion === 'Externa' ? 5 : 10;
      if (isBelowMin) {
        intervalo = 0;
        criterio = 'Espesor bajo el mínimo admisible API 510: acción inmediata / evaluación FFS API 579-1.';
      } else if (tipoInspeccion === 'Externa') {
        intervalo = 5;
        criterio = 'Tope normativo API 510 §6.4.1 (inspección externa cada 5 años máx.).';
      } else if (!hasRL || !isFinite(rl_a)) {
        intervalo = 10;
        criterio = cr_mmpa === null
          ? 'Sin tasa de corrosión confirmada: referencia máxima 10 años (API 510 §6.5.1), requiere completar mediciones.'
          : 'Sin desgaste activo (CR ≤ 0): gobierna tope máximo API 510 §6.5.1 (10 años).';
      } else if (rl_a < 4) {
        intervalo = Math.min(rl_a, 2);
        criterio = `API 510 §6.5.1.1 (RL = ${rl_a.toFixed(2)} a < 4 años → intervalo máx. min(RL, 2 años) = ${intervalo.toFixed(2)} a).`;
      } else {
        const halfRL = rl_a / 2;
        if (halfRL < 10) {
          intervalo = halfRL;
          criterio = `Regla de vida media API 510 §6.5.1 (RL/2 = ${halfRL.toFixed(2)} a < tope 10 años).`;
        } else {
          intervalo = 10;
          criterio = `Tope normativo API 510 §6.5.1 (10 años ≤ RL/2 = ${halfRL.toFixed(2)} a).`;
        }
      }
    }

    // Compute next date
    let proximaFecha = refDate;
    if (intervalo !== null && intervalo > 0) {
      const d = new Date(refDate);
      if (!isNaN(d)) {
        d.setDate(d.getDate() + Math.round(intervalo * 365.25));
        proximaFecha = d.toISOString().split('T')[0];
      }
    }

    const hoy = new Date();
    const vencida = proximaFecha ? new Date(proximaFecha) < hoy : false;

    let estado = 'Normal';
    if (isBelowMin) estado = 'Espesor bajo el mínimo';
    else if (cr_mmpa === null) estado = 'Información insuficiente';
    else if (vencida) estado = 'Inspección vencida';
    else if (t_actual_mm !== null && t_alerta_mm !== null && t_actual_mm <= t_alerta_mm) estado = 'Alerta';

    return {
      norma,
      tipo_inspeccion: tipoInspeccion,
      fecha_referencia: refDate,
      intervalo_a: intervalo !== null ? Number(intervalo.toFixed(2)) : null,
      proxima_fecha: proximaFecha,
      tope_normativo_a: topeNormativo,
      criterio_gobernante: criterio,
      vencida,
      estado_condicion: estado,
      declaracion_alcance: declaracionAlcance
    };
  }

  /* ═══════════════════════════════════════════════════════════
     10. QUANTITATIVE RBI – API RP 580 / API RP 581 PART 2 §4
         General Thinning Damage Factor (Academic Simplified Model)
     ═══════════════════════════════════════════════════════════ */
  // Standard normal CDF using Abramowitz & Stegun 7.1.26 erf approximation
  function _normCDF(x) {
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return 0.5 * (1 + sign * erf);
  }

  // API RP 581 (3rd Ed.) Table 4.5 / 4.6 Conditional Probabilities (Medium confidence prior)
  const API581_PRIOR = [0.70, 0.20, 0.10]; // [Pr_p1 (1xCR), Pr_p2 (2xCR), Pr_p3 (4xCR)]
  const API581_COND = {
    A: [0.90, 0.09, 0.01], // Highly Effective
    B: [0.70, 0.20, 0.10], // Usually Effective
    C: [0.50, 0.30, 0.20], // Fairly Effective
    D: [0.40, 0.33, 0.27], // Poorly Effective
    E: [0.33, 0.33, 0.34], // Ineffective / None
  };
  // Conditional probabilities matrix Co_ij = P(inspect says state 1 | true state j)
  // Per API RP 581 Table 4.6 (Low/Medium/High damage state discrimination)
  const API581_CO = {
    A: [0.90, 0.09, 0.01],
    B: [0.70, 0.20, 0.10],
    C: [0.50, 0.30, 0.20],
    D: [0.40, 0.33, 0.27],
    E: [0.33, 0.33, 0.34],
  };

  // Generic Failure Frequencies (API RP 581 Table 3.1 total gff, failures/year)
  const API581_GFF = {
    'Vasija a Presión':   { gff: 3.06e-5, ref: 'API RP 581 Tabla 3.1 (Drum/Vessel total)' },
    'Intercambiador':     { gff: 3.06e-5, ref: 'API RP 581 Tabla 3.1 (HEX Shell total)' },
    'Tubería a Presión':  { gff: 3.06e-5, ref: 'API RP 581 Tabla 3.1 (PIPE-6 total)' },
    'Tanque Atmosférico': { gff: 1.00e-4, ref: 'API RP 581 Tabla 3.1 (Tank Shell Course total)' },
  };

  function calcRBI581(params) {
    const {
      familia = 'Vasija a Presión',
      t_trd_mm,           // thickness at last inspection (or nominal if never inspected)
      t_min_mm,           // minimum required thickness in service
      t_nom_mm,
      CR_mmpa,            // expected corrosion rate (mm/yr)
      age_a = 1.0,        // years since last thickness measurement
      S_MPa = 138,        // allowable stress
      E_joint = 1.0,
      SMYS_MPa = 260,
      UTS_MPa = 485,
      insp_eff = 'C',     // A, B, C, D, E
      insp_count = 1,     // number of inspections at that effectiveness (0..6)
      gff = null,         // override generic failure frequency [1/yr]
      F_MS = 1.0,         // management systems factor
      CA_m2 = 50,         // consequence area [m2]
      CE_val = 100000,    // financial consequence [currency]
      moneda = 'USD',
      base_valoracion = 'Reposición + pérdida de producción + mitigación',
      horizonte_a = 1.0   // temporal horizon for PoF (default 1 year)
    } = params;

    if (!(t_trd_mm > 0) || !(t_min_mm > 0)) {
      return { error: 'Se requieren espesor de referencia (t_trd > 0) y espesor mínimo (t_mín > 0).' };
    }
    if (CR_mmpa < 0 || age_a < 0) {
      return { error: 'La tasa de corrosión CR y el tiempo transcurrido deben ser ≥ 0.' };
    }

    const gffInfo = API581_GFF[familia] || { gff: 3.06e-5, ref: 'API RP 581 Tabla 3.1' };
    const gff_val = Number(gff) > 0 ? Number(gff) : gffInfo.gff;
    const fms_val = Number(F_MS) > 0 ? Number(F_MS) : 1.0;

    // 1) Wall loss fraction Art = (CR * age) / t_trd (API 581 Eq. 2.11)
    const Art = Math.min(0.999, Math.max(0, (CR_mmpa * age_a) / t_trd_mm));
    const t_actual_est = Math.max(0, t_trd_mm - CR_mmpa * age_a);

    // 2) Flow stress FS and Strength Ratio SR (API 581 Eq. 2.12–2.14)
    const FS_MPa = ((SMYS_MPa + UTS_MPa) / 2) * 1.1;
    const SR = (S_MPa * E_joint / FS_MPa) * (t_min_mm / t_trd_mm);

    // 3) Bayesian posterior probabilities for damage states 1 (1×CR), 2 (2×CR), 3 (4×CR)
    const effKey = API581_CO[insp_eff] ? insp_eff : 'E';
    const nInsp = effKey === 'E' ? 0 : Math.max(0, Math.min(6, parseInt(insp_count, 10) || 0));
    const co = API581_CO[effKey];
    const I_vals = [0, 1, 2].map(i => API581_PRIOR[i] * Math.pow(co[i], nInsp));
    const sumI = I_vals[0] + I_vals[1] + I_vals[2] || 1;
    const post = I_vals.map(v => v / sumI);

    // 4) Reliability indices beta_i (API 581 Eq. 2.16)
    const COV_dt = 0.20, COV_Sf = 0.20, COV_P = 0.05;
    const DS = [1, 2, 4];
    const betas = DS.map(ds => {
      const num = 1 - ds * Art - SR;
      const den = Math.sqrt(
        Math.pow(ds * Art * COV_dt, 2) +
        Math.pow((1 - ds * Art) * COV_Sf, 2) +
        Math.pow(SR * COV_P, 2)
      );
      return den > 0 ? num / den : -10;
    });

    // 5) Thinning Damage Factor Df (API 581 Eq. 2.17)
    const pf_states = betas.map(b => _normCDF(-b));
    const p_weighted = post[0] * pf_states[0] + post[1] * pf_states[1] + post[2] * pf_states[2];
    const Df_raw = p_weighted / 1.56e-4;
    const Df = Math.min(5000, Math.max(0.1, Df_raw));

    // 6) Failure frequency f_F [failures/year] and PoF(T) (distinct from Df!)
    const f_F = Math.min(1.0, gff_val * Df * fms_val);
    const PoF_T = 1 - Math.exp(-f_F * horizonte_a);

    // 7) Separate Risks: Area Risk RA [m2/yr] and Financial Risk RE [currency/yr]
    const R_A = f_F * CA_m2;
    const R_E = f_F * CE_val;

    // 8) 5×5 API 581 Risk Matrix Categories
    // PoF category (1..5) based on annual failure frequency f_F (API 581 Table 4.1)
    let pof_cat = 1;
    if (f_F > 1e-2) pof_cat = 5;
    else if (f_F > 1e-3) pof_cat = 4;
    else if (f_F > 1e-4) pof_cat = 3;
    else if (f_F > 1e-5) pof_cat = 2;
    else pof_cat = 1;

    // Area CoF category (A..E) based on CA [m2] (API 581 Table 4.2 metric approx: 10, 100, 1000, 10000 m2)
    const _cofAreaCat = (ca) => ca > 10000 ? 'E' : ca > 1000 ? 'D' : ca > 100 ? 'C' : ca > 10 ? 'B' : 'A';
    // Financial CoF category (A..E) based on CE (reference USD-equivalent thresholds: 10k, 100k, 1M, 10M)
    const _cofEconCat = (ce) => ce > 1e7 ? 'E' : ce > 1e6 ? 'D' : ce > 1e5 ? 'C' : ce > 1e4 ? 'B' : 'A';

    const cof_area_cat = _cofAreaCat(CA_m2);
    const cof_econ_cat = _cofEconCat(CE_val);

    const MATRIX = [
      ['low',    'low',    'low',    'medium', 'medium'], // POF 1
      ['low',    'low',    'medium', 'medium', 'high'  ], // POF 2
      ['low',    'medium', 'medium', 'high',   'high'  ], // POF 3
      ['medium', 'medium', 'high',   'high',   'vhigh' ], // POF 4
      ['medium', 'high',   'high',   'vhigh',  'vhigh' ], // POF 5
    ];
    const cols = ['A', 'B', 'C', 'D', 'E'];
    const risk_area_color = MATRIX[pof_cat - 1][cols.indexOf(cof_area_cat)];
    const risk_econ_color = MATRIX[pof_cat - 1][cols.indexOf(cof_econ_cat)];

    // Governing risk = worst between Area and Economic
    const rank = { low: 1, medium: 2, high: 3, vhigh: 4 };
    const risk_gov_color = rank[risk_area_color] >= rank[risk_econ_color] ? risk_area_color : risk_econ_color;
    const gov_source = rank[risk_area_color] >= rank[risk_econ_color] ? 'Riesgo por Área (Seguridad)' : 'Riesgo Económico';

    const PRIORITY = { vhigh: 'Prioridad 1 – Crítica (Inmediata)', high: 'Prioridad 2 – Alta', medium: 'Prioridad 3 – Media', low: 'Prioridad 4 – Baja' };
    const INTERVAL = { vhigh: 1, high: 3, medium: 5, low: 10 };

    const rl = CR_mmpa > 0 ? (t_actual_est - t_min_mm) / CR_mmpa : Infinity;

    return {
      modelo: 'Modelo académico simplificado – API RP 580 (3ª Ed.) / API RP 581 (3ª Ed., Parte 2 §4)',
      familia,
      entradas: {
        t_trd_mm, t_min_mm, t_nom_mm, CR_mmpa, age_a, S_MPa, E_joint, SMYS_MPa, UTS_MPa,
        insp_eff: effKey, insp_count: nInsp, gff: gff_val, gff_ref: gffInfo.ref, F_MS: fms_val,
        CA_m2, CE_val, moneda, base_valoracion, horizonte_a
      },
      intermedios: {
        Art,
        t_actual_est_mm: t_actual_est,
        FS_MPa,
        SR,
        post_probs: post,
        betas,
        pf_states,
        p_weighted
      },
      Df,
      f_F,
      PoF_T,
      horizonte_a,
      R_A,
      R_E,
      moneda,
      base_valoracion,
      pof_cat,
      cof_area_cat,
      cof_econ_cat,
      risk_area_color,
      risk_econ_color,
      risk_gov_color,
      gov_source,
      prioridad: PRIORITY[risk_gov_color],
      intervalo_a: INTERVAL[risk_gov_color],
      remaining_life_a: rl,
      nota_incertidumbre: 'Una inspección de mayor eficacia (A/B) o mayor cantidad N concentra la probabilidad posterior en el estado 1×CR, reduciendo la incertidumbre y el factor de daño D_f; sin embargo, inspeccionar NO recupera el espesor perdido (A_rt y t_actual permanecen iguales).',
      ecuaciones: [
        'A_rt = (CR · age) / t_trd',
        'S_R = (S · E / FS) · (t_mín / t_trd)',
        'Pr_pi = (Pr_prior,i · Co_i^N) / Σ(Pr_prior,k · Co_k^N)',
        'β_i = (1 - D_Si·A_rt - S_R) / √[(D_Si·A_rt·0.20)² + ((1-D_Si·A_rt)·0.20)² + (S_R·0.05)²]',
        'D_f = [Σ Pr_pi · Φ(-β_i)] / (1.56×10⁻⁴)',
        'f_F = gff · D_f · F_MS   [fallas/año]',
        'R_A = f_F · C_A   [m²/año]   |   R_E = f_F · C_E   [moneda/año]'
      ]
    };
  }

  /* ═══════════════════════════════════════════════════════════
     11. COMBINED ASSESSMENT & UTILITIES
     ═══════════════════════════════════════════════════════════ */
  function fullAssessment(tipo, designParams, ffsParams) {
    let design;
    switch (tipo) {
      case 'B313':       design = calcB313(designParams);          break;
      case 'VIII_shell': design = calcVIII_cylinder(designParams); break;
      case 'VIII_hemi':  design = calcVIII_hemi(designParams);     break;
      case 'VIII_ellip': design = calcVIII_ellip(designParams);    break;
      case 'VIII_tori':  design = calcVIII_tori(designParams);     break;
      case 'API653':     design = calcAPI653(designParams);        break;
      case 'API650':     design = calcAPI650(designParams);        break;
      default: return { error: 'Tipo de cálculo no reconocido.' };
    }
    if (design.error) return design;
    const t_min = design.t_min_servicio_mm ?? design.t_min_CA_mm;
    const ffs = ffsParams ? calcFFS_thinning({ ...ffsParams, t_min_mm: t_min }) : null;
    return { design, ffs };
  }

  function calcForEquipo(eq, overrides = {}) {
    if (!eq) return null;
    const d = { ...eq, ...overrides };
    const CR = Number(overrides.CR_mmpa ?? d.cr_ref_mmpa ?? 0);
    const plazo = Number(d.plazo_intervencion_a || 2.0);

    if (d.tipo === 'Tubería a Presión' || d.norma_diseno === 'ASME B31.3') {
      return calcB313({
        P_kPa: Number(d.presion_diseno_kPa || 0),
        OD_mm: Number(d.diametro_mm || 168.3),
        material: d.material || 'API 5L Gr.B',
        temp_C: Number(d.temp_diseno_C ?? 60),
        E_joint: Number(d.eficiencia_junta ?? 1.0),
        W: 1.0,
        CA_mm: Number(d.ca_mm ?? 1.5),
        mill_tol_pct: Number(d.tolerancia_fab_pct ?? 12.5),
        t_nominal_mm: Number(d.espesor_nominal_mm || 0) || null,
        t_measured_mm: overrides.t_measured_mm,
        CR_mmpa: CR,
        plazo_intervencion_a: plazo
      });
    }
    if (d.tipo === 'Tanque Atmosférico' || d.norma_diseno === 'API 650') {
      return calcAPI650({
        D_m: Number(d.diametro_mm || 12000) / 1000,
        H_m: Number(d.altura_liquido_m || (Number(d.longitud_mm || 8000) / 1000)),
        G: Number(d.gravedad_especifica ?? 0.88),
        material: d.material || 'A-36',
        SMYS_MPa: d.smys_MPa ? Number(d.smys_MPa) : undefined,
        UTS_MPa: d.uts_MPa ? Number(d.uts_MPa) : undefined,
        CA_mm: Number(d.ca_mm ?? 1.5),
        E_joint: Number(d.eficiencia_junta ?? 0.85),
        virola: Number(d.numero_virola || 1),
        t_nominal_mm: Number(d.espesor_nominal_mm || 0) || null,
        t_actual_mm: overrides.t_measured_mm,
        CR_mmpa: CR,
        plazo_intervencion_a: plazo
      });
    }
    return calcVIII_cylinder({
      P_kPa: Number(d.presion_diseno_kPa || 0),
      ID_mm: Number(d.diametro_mm || 1200),
      material: d.material || 'SA-516-70',
      temp_C: Number(d.temp_diseno_C ?? 100),
      E_joint: Number(d.eficiencia_junta ?? 1.0),
      CA_mm: Number(d.ca_mm ?? 3.0),
      t_nominal_mm: Number(d.espesor_nominal_mm || 0) || null,
      t_actual_mm: overrides.t_measured_mm,
      CR_mmpa: CR,
      plazo_intervencion_a: plazo
    });
  }

  function getMaterials() {
    return Object.entries(MATERIALS).map(([key, v]) => ({ key, nombre: v.nombre }));
  }

  function getJointEfficiencies() {
    return Object.entries(JOINT_EFF).map(([k, v]) => ({ key: k, value: v }));
  }

  function getPipeSchedules() {
    return Object.entries(PIPE_SCHEDULES).map(([k, v]) => ({
      key: k, nps: k.split('-')[0], sch: k.split('-')[1],
      od_mm: v.od, t_mm: v.t
    }));
  }

  function getApplicableStandards(equipmentType) {
    return Object.entries(STANDARDS)
      .filter(([, standard]) => standard.appliesTo.includes(equipmentType))
      .map(([key, standard]) => ({ key, ...standard }));
  }

  function validateStandardForEquipment(equipmentType, standard) {
    const applicable = getApplicableStandards(equipmentType);
    if (applicable.length === 0) return true;
    return applicable.some(item => item.key === standard);
  }

  function corrosionRateFromReadings(readings) {
    if (!readings || readings.length < 2) return null;
    const pts = readings
      .map(r => ({ t: new Date(r.fecha).getTime(), e: Number(r.espesor_mm) }))
      .filter(p => !isNaN(p.t) && !isNaN(p.e))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) return null;

    const n = pts.length;
    const t0 = pts[0].t;
    const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
    const xs = pts.map(p => (p.t - t0) / MS_PER_YEAR);
    const ys = pts.map(p => p.e);

    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const den = n * sumX2 - sumX * sumX;
    if (Math.abs(den) < 1e-12) return null;

    const slope = (n * sumXY - sumX * sumY) / den;
    return -slope; // mm/yr (positive = thinning)
  }

  return {
    calcB313,
    calcVIII_cylinder,
    calcVIII_hemi,
    calcVIII_ellip,
    calcVIII_tori,
    calcAPI653,
    calcAPI650,
    calcFFS_thinning,
    calcAlertThickness,
    calcNextInspection,
    calcRBI581,
    calcForEquipo,
    fullAssessment,
    getMaterials,
    getJointEfficiencies,
    getPipeSchedules,
    getApplicableStandards,
    validateStandardForEquipment,
    getAllowableStress,
    corrosionRateFromReadings,
    MATERIALS,
    JOINT_EFF,
    PIPE_SCHEDULES,
    STANDARDS,
    API581_GFF,
  };
})();
