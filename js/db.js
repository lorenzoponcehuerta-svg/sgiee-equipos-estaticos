/**
 * SGIEE – Data Layer (LocalStorage-backed + JSON Project Backup/Restore)
 * Collections: equipos, cmls, mediciones, inspecciones, isometricos, rbi_evaluaciones, planes
 */
const DB = (() => {
  const PREFIX = 'sgiee_';
  const SCHEMA_KEY = 'sgiee_schema_version';
  const SCHEMA_VERSION = '2.0';
  const STORES = ['equipos', 'cmls', 'mediciones', 'inspecciones', 'isometricos', 'rbi_evaluaciones', 'planes'];

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    const currentVer = localStorage.getItem(SCHEMA_KEY);
    if (currentVer !== SCHEMA_VERSION) {
      // Upgrade seamlessly to v2.0 complete demo dataset
      STORES.forEach(s => localStorage.removeItem(PREFIX + s));
      localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    }
    STORES.forEach(s => {
      if (!localStorage.getItem(PREFIX + s)) {
        localStorage.setItem(PREFIX + s, JSON.stringify([]));
      }
    });
    _seedIfEmpty();
  }

  /* ── Core CRUD ───────────────────────────────────────────── */
  function getAll(store) {
    return JSON.parse(localStorage.getItem(PREFIX + store) || '[]');
  }

  function getById(store, id) {
    return getAll(store).find(r => r.id === id) || null;
  }

  function insert(store, record) {
    const list = getAll(store);
    record.id = record.id || _uid();
    record._createdAt = record._createdAt || new Date().toISOString();
    record._updatedAt = new Date().toISOString();
    list.push(record);
    _save(store, list);
    return record;
  }

  function update(store, id, patch) {
    const list = getAll(store);
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, _updatedAt: new Date().toISOString() };
    _save(store, list);
    return list[idx];
  }

  function remove(store, id) {
    const list = getAll(store).filter(r => r.id !== id);
    _save(store, list);
  }

  function query(store, filterFn) {
    return getAll(store).filter(filterFn);
  }

  function _save(store, data) {
    localStorage.setItem(PREFIX + store, JSON.stringify(data));
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ── Project Backup / Restore / Reset (Sección 6) ────────── */
  function exportProject() {
    const stores = {};
    STORES.forEach(s => { stores[s] = getAll(s); });
    return {
      app: 'SGIEE',
      schema_version: SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      stores
    };
  }

  function importProject(payload) {
    if (!payload || typeof payload !== 'object' || !payload.stores) {
      throw new Error('Formato de archivo de proyecto inválido. Falta el objeto "stores".');
    }
    const counts = {};
    STORES.forEach(s => {
      const arr = Array.isArray(payload.stores[s]) ? payload.stores[s] : [];
      _save(s, arr);
      counts[s] = arr.length;
    });
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    return counts;
  }

  function resetDemoData() {
    STORES.forEach(s => _save(s, []));
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    _seedIfEmpty();
  }

  /* ── Seed data: Complete 3-family academic demo case ─────── */
  function _seedIfEmpty() {
    if (getAll('equipos').length > 0) return;

    const equiposSeed = [
      {
        id: 'EQ-001',
        tag: 'V-101',
        nombre: 'Separador de Gas Primario',
        descripcion: 'Recipiente separador bifásico gas/condensado con envolvente cilíndrica',
        tipo: 'Vasija a Presión',
        planta: 'Planta Procesos Norte',
        area: 'Área 100 – Separación',
        sistema: 'Separación Primaria',
        componente: 'Envolvente cilíndrica',
        circuito_inspeccion: '',
        clase_tuberia: '',
        servicio: 'Separación gas-líquido de proceso',
        fluido: 'Gas Natural / Condensado',
        material: 'SA-516-70',
        diametro_mm: 1200,
        longitud_mm: 4000,
        presion_diseno_kPa: 2500,
        temp_diseno_C: 120,
        presion_operacion_kPa: 2100,
        temp_operacion_C: 95,
        eficiencia_junta: 1.0,
        tolerancia_fab_pct: 0,
        espesor_nominal_mm: 16.0,
        espesor_requerido_mm: 10.99,
        espesor_minimo_mm: 10.99,
        espesor_alerta_mm: 11.79,
        ca_mm: 3.0,
        plazo_intervencion_a: 2.0,
        fecha_fabricacion: '2014-06-15',
        fecha_instalacion: '2015-03-01',
        estado: 'Activo',
        criticidad: 'Alta',
        norma_diseno: 'ASME VIII Div.1',
        notas: 'Caso demostrativo Recipiente (ASME VIII Div.1 / API 510). Incluye CML normal y un CML con datos insuficientes (CML-V3).'
      },
      {
        id: 'EQ-002',
        tag: 'P-201A',
        nombre: 'Línea Principal de Crudo 6" Sch 40',
        descripcion: 'Tramo recto de tubería de proceso NPS 6" Sch 40 (OD 168.3 mm)',
        tipo: 'Tubería a Presión',
        planta: 'Planta Procesos Norte',
        area: 'Área 200 – Transferencia',
        sistema: 'Transferencia de Crudo',
        componente: 'Tramo recto NPS 6" Sch 40',
        circuito_inspeccion: 'CI-CRU-201',
        clase_tuberia: 'Clase 1',
        servicio: 'Transporte de crudo ácido hacia unidad de estabilización',
        fluido: 'Crudo con trazas de H2S',
        material: 'API 5L Gr.B',
        diametro_mm: 168.3,
        longitud_mm: 18500,
        presion_diseno_kPa: 4500,
        temp_diseno_C: 90,
        presion_operacion_kPa: 3800,
        temp_operacion_C: 75,
        eficiencia_junta: 1.0,
        tolerancia_fab_pct: 12.5,
        espesor_nominal_mm: 7.11,
        espesor_requerido_mm: 2.71,
        espesor_minimo_mm: 2.71,
        espesor_alerta_mm: 3.60,
        ca_mm: 1.5,
        plazo_intervencion_a: 2.0,
        fecha_fabricacion: '2015-05-10',
        fecha_instalacion: '2015-11-01',
        estado: 'Activo',
        criticidad: 'Alta',
        norma_diseno: 'ASME B31.3',
        notas: 'Caso demostrativo Tuberías (ASME B31.3 / API 570). Incluye punto en Alerta (CML-P1), punto Bajo Mínimo (CML-P2) y punto con Reemplazo de tramo (CML-P3).'
      },
      {
        id: 'EQ-004',
        tag: 'TK-401',
        nombre: 'Tanque de Almacenamiento de Crudo',
        descripcion: 'Tanque atmosférico vertical soldado de techo cónico, D=18 m, H=12 m (virolas del manto)',
        tipo: 'Tanque Atmosférico',
        planta: 'Terminal Almacenamiento Sur',
        area: 'Área 400 – Patio de Tanques',
        sistema: 'Almacenamiento Crudo Estabilizado',
        componente: 'Virolas del manto (1ª a 3ª virola)',
        circuito_inspeccion: '',
        clase_tuberia: '',
        servicio: 'Almacenamiento atmosférico de crudo estabilizado',
        fluido: 'Crudo Estabilizado (G=0.88)',
        material: 'A-36',
        diametro_mm: 18000,
        longitud_mm: 12000,
        altura_liquido_m: 11.5,
        gravedad_especifica: 0.88,
        numero_virola: 1,
        smys_MPa: 250,
        uts_MPa: 400,
        presion_diseno_kPa: 10,
        temp_diseno_C: 60,
        presion_operacion_kPa: 5,
        temp_operacion_C: 40,
        eficiencia_junta: 0.85,
        tolerancia_fab_pct: 0,
        espesor_nominal_mm: 9.0,
        espesor_requerido_mm: 5.44,
        espesor_minimo_mm: 5.96,
        espesor_alerta_mm: 6.50,
        ca_mm: 1.5,
        plazo_intervencion_a: 2.0,
        fecha_fabricacion: '2011-04-20',
        fecha_instalacion: '2011-11-01',
        estado: 'Activo',
        criticidad: 'Alta',
        norma_diseno: 'API 650',
        notas: 'Caso demostrativo Tanques (API 650 / API 653). Alcance declarado sobre virolas del manto; fondo, techo y asentamiento requieren datos complementarios.'
      },
      {
        id: 'EQ-003',
        tag: 'E-301',
        nombre: 'Intercambiador de Calor Carcasa-Tubos',
        descripcion: 'Intercambiador TEMA tipo AEL, servicio condensado / vapor',
        tipo: 'Intercambiador',
        planta: 'Planta Procesos Norte',
        area: 'Área 300 – Precalentamiento',
        sistema: 'Recuperación Térmica',
        componente: 'Carcasa cilíndrica',
        circuito_inspeccion: '',
        clase_tuberia: '',
        servicio: 'Precalentamiento de condensado',
        fluido: 'Condensado / Vapor',
        material: 'SA-516-60',
        diametro_mm: 800,
        longitud_mm: 3200,
        presion_diseno_kPa: 1800,
        temp_diseno_C: 200,
        presion_operacion_kPa: 1500,
        temp_operacion_C: 175,
        eficiencia_junta: 0.85,
        tolerancia_fab_pct: 0,
        espesor_nominal_mm: 11.0,
        espesor_requerido_mm: 7.26,
        espesor_minimo_mm: 7.26,
        espesor_alerta_mm: 7.80,
        ca_mm: 2.5,
        plazo_intervencion_a: 2.0,
        fecha_fabricacion: '2016-02-10',
        fecha_instalacion: '2016-09-01',
        estado: 'Activo',
        criticidad: 'Media',
        norma_diseno: 'ASME VIII Div.1',
        notas: 'Equipo adicional en condición normal.'
      }
    ];

    const cmlsSeed = [
      // Recipiente V-101 (3 CML)
      {
        id: 'CML-001', equipo_id: 'EQ-001', nombre: 'CML-V1',
        componente: 'Envolvente cilíndrica – Virola superior',
        descripcion: 'Zona de interfaz gas/líquido, 0° Norte',
        ubicacion: 'Elevación +2.8 m / 0°',
        convencion: 'CML-[Familia][Número]: V=Vasija, P=Tubería, T=Tanque; posición horaria 0°=Norte.',
        activo: true
      },
      {
        id: 'CML-002', equipo_id: 'EQ-001', nombre: 'CML-V2',
        componente: 'Envolvente cilíndrica – Virola media',
        descripcion: 'Cuerpo zona líquida, 180° Sur',
        ubicacion: 'Elevación +1.5 m / 180°',
        convencion: 'CML-[Familia][Número]: V=Vasija; lectura mínima en cuadrante de 4 puntos.',
        activo: true
      },
      {
        id: 'CML-003', equipo_id: 'EQ-001', nombre: 'CML-V3',
        componente: 'Envolvente cilíndrica – Zona inferior',
        descripcion: 'Punto nuevo de control (1 sola campaña – datos insuficientes)',
        ubicacion: 'Elevación +0.4 m / 270°',
        convencion: 'CML-[Familia][Número]: punto recién habilitado para demostrar condición de información insuficiente.',
        activo: true
      },
      // Tubería P-201A (3 CML)
      {
        id: 'CML-004', equipo_id: 'EQ-002', nombre: 'CML-P1',
        componente: 'Tramo recto – Entrada rack (6" Sch 40)',
        descripcion: 'Generatriz inferior 6 h (zona de sedimento – Alerta)',
        ubicacion: 'Isométrico ISO-P201A · Km 0+015 · 180°',
        convencion: 'CML-P#: P=Tubería circuito CI-CRU-201; orientación horaria vista en dirección de flujo.',
        activo: true
      },
      {
        id: 'CML-005', equipo_id: 'EQ-002', nombre: 'CML-P2',
        componente: 'Tramo recto – Aguas abajo válvula control',
        descripcion: 'Zona de alta turbulencia (espesor bajo el mínimo)',
        ubicacion: 'Isométrico ISO-P201A · Km 0+042 · 180°',
        convencion: 'CML-P#: punto crítico bajo t_mín para demostración de alerta roja.',
        activo: true
      },
      {
        id: 'CML-006', equipo_id: 'EQ-002', nombre: 'CML-P3',
        componente: 'Tramo recto – Salida unidad (reemplazado en 2022)',
        descripcion: 'Tramo recto reemplazado con spool nuevo en parada 2022',
        ubicacion: 'Isométrico ISO-P201A · Km 0+095 · 90°',
        convencion: 'CML-P#: incluye evento de Reemplazo para demostrar reinicio de línea base.',
        activo: true
      },
      // Tanque TK-401 (3 CML en virolas del manto)
      {
        id: 'CML-007', equipo_id: 'EQ-004', nombre: 'CML-T1',
        componente: 'Virola 1 del manto (inferior)',
        descripcion: 'Primer anillo del manto sobre cordón fondo-manto (0° N)',
        ubicacion: 'Virola 1 · h = 0.5 m · 0° Norte',
        convencion: 'CML-T#: T=Tanque atmosférico; numeración ascendente desde Virola 1 (base) a Virola 3.',
        activo: true
      },
      {
        id: 'CML-008', equipo_id: 'EQ-004', nombre: 'CML-T2',
        componente: 'Virola 2 del manto (intermedia)',
        descripcion: 'Segundo anillo del manto zona de nivel variable (90° E)',
        ubicacion: 'Virola 2 · h = 3.2 m · 90° Este',
        convencion: 'CML-T#: lectura UT por haz recto sobre virola 2.',
        activo: true
      },
      {
        id: 'CML-009', equipo_id: 'EQ-004', nombre: 'CML-T3',
        componente: 'Virola 3 del manto (superior)',
        descripcion: 'Tercer anillo del manto en interfaz vapor-crudo (180° S)',
        ubicacion: 'Virola 3 · h = 6.0 m · 180° Sur',
        convencion: 'CML-T#: lectura UT sobre virola 3.',
        activo: true
      },
      // Intercambiador E-301 (1 CML)
      {
        id: 'CML-010', equipo_id: 'EQ-003', nombre: 'CML-E1',
        componente: 'Carcasa cilíndrica – Boquilla entrada',
        descripcion: 'Zona de entrada lado carcasa',
        ubicacion: 'Carcasa · 0° Superior',
        convencion: 'CML-E#: E=Intercambiador.',
        activo: true
      }
    ];

    const medicionesSeed = [
      // V-101: 3 campañas históricas (2020, 2022, 2024) + 1 lectura en CML-V3
      { id:'M-001', cml_id:'CML-001', equipo_id:'EQ-001', fecha:'2020-05-15', espesor_mm:15.40, valor_original:15.40, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'López J.', notas:'Campaña 2020 – espesor inicial en servicio' },
      { id:'M-002', cml_id:'CML-001', equipo_id:'EQ-001', fecha:'2022-05-20', espesor_mm:14.70, valor_original:14.70, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Martínez R.', notas:'Campaña 2022 – desgaste uniforme leve' },
      { id:'M-003', cml_id:'CML-001', equipo_id:'EQ-001', fecha:'2024-05-20', espesor_mm:13.90, valor_original:13.90, unidad:'mm', metodo:'UT-B (B-Scan)',      evento:'Normal', tecnico:'López J.', notas:'Campaña 2024 – leve aumento de CR en corto plazo' },

      { id:'M-004', cml_id:'CML-002', equipo_id:'EQ-001', fecha:'2020-05-15', espesor_mm:15.60, valor_original:15.60, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'López J.', notas:'Campaña 2020' },
      { id:'M-005', cml_id:'CML-002', equipo_id:'EQ-001', fecha:'2022-05-20', espesor_mm:15.30, valor_original:15.30, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Martínez R.', notas:'Campaña 2022' },
      { id:'M-006', cml_id:'CML-002', equipo_id:'EQ-001', fecha:'2024-05-20', espesor_mm:15.00, valor_original:15.00, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'López J.', notas:'Campaña 2024 – estable' },

      { id:'M-007', cml_id:'CML-003', equipo_id:'EQ-001', fecha:'2024-05-20', espesor_mm:14.80, valor_original:14.80, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'López J.', notas:'Primera lectura registrada (datos insuficientes para CR)' },

      // P-201A: 3 campañas históricas (2020, 2022, 2024)
      // CML-P1: Alerta (t_act = 3.45 mm <= t_alerta 3.60 mm, > t_min 2.71 mm)
      { id:'M-008', cml_id:'CML-004', equipo_id:'EQ-002', fecha:'2020-06-10', espesor_mm:5.40, valor_original:5.40, unidad:'mm', metodo:'UT-B (B-Scan)', evento:'Normal', tecnico:'García P.', notas:'Campaña 2020' },
      { id:'M-009', cml_id:'CML-004', equipo_id:'EQ-002', fecha:'2022-06-15', espesor_mm:4.45, valor_original:4.45, unidad:'mm', metodo:'UT-B (B-Scan)', evento:'Normal', tecnico:'García P.', notas:'Campaña 2022 – corrosión por sedimentos' },
      { id:'M-010', cml_id:'CML-004', equipo_id:'EQ-002', fecha:'2024-06-15', espesor_mm:3.45, valor_original:3.45, unidad:'mm', metodo:'UT-B (B-Scan)', evento:'Normal', tecnico:'García P.', notas:'Campaña 2024 – en zona de alerta, planificar intervención' },

      // CML-P2: Espesor BAJO EL MÍNIMO (t_act = 2.40 mm < t_min 2.71 mm)
      { id:'M-011', cml_id:'CML-005', equipo_id:'EQ-002', fecha:'2020-06-10', espesor_mm:4.90, valor_original:4.90, unidad:'mm', metodo:'UT-B (B-Scan)', evento:'Normal', tecnico:'García P.', notas:'Campaña 2020 – erosión aguas abajo de válvula' },
      { id:'M-012', cml_id:'CML-005', equipo_id:'EQ-002', fecha:'2022-06-15', espesor_mm:3.65, valor_original:3.65, unidad:'mm', metodo:'UT-B (B-Scan)', evento:'Normal', tecnico:'García P.', notas:'Campaña 2022 – desgaste acelerado' },
      { id:'M-013', cml_id:'CML-005', equipo_id:'EQ-002', fecha:'2024-06-15', espesor_mm:2.40, valor_original:2.40, unidad:'mm', metodo:'UT-C (C-Scan)', evento:'Normal', tecnico:'García P.', notas:'Campaña 2024 – ESPESOR BAJO t_mín (2.71 mm), requiere reemplazo inmediato' },

      // CML-P3: Con evento de REEMPLAZO en 2022
      { id:'M-014', cml_id:'CML-006', equipo_id:'EQ-002', fecha:'2020-06-10', espesor_mm:4.20, valor_original:4.20, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal',    tecnico:'García P.', notas:'Campaña 2020 – spool original desgastado' },
      { id:'M-015', cml_id:'CML-006', equipo_id:'EQ-002', fecha:'2022-06-15', espesor_mm:7.05, valor_original:7.05, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Reemplazo', tecnico:'García P.', notas:'Spool reemplazado por tubería nueva 6" Sch 40 (reinicia línea base)' },
      { id:'M-016', cml_id:'CML-006', equipo_id:'EQ-002', fecha:'2024-06-15', espesor_mm:6.65, valor_original:6.65, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal',    tecnico:'García P.', notas:'Campaña 2024 – primer seguimiento post-reemplazo' },

      // TK-401: 3 campañas históricas (2018, 2021, 2024) en las 3 virolas del manto
      { id:'M-017', cml_id:'CML-007', equipo_id:'EQ-004', fecha:'2018-09-10', espesor_mm:8.50, valor_original:8.50, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2018 – Virola 1' },
      { id:'M-018', cml_id:'CML-007', equipo_id:'EQ-004', fecha:'2021-09-15', espesor_mm:7.65, valor_original:7.65, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2021 – Virola 1' },
      { id:'M-019', cml_id:'CML-007', equipo_id:'EQ-004', fecha:'2024-09-15', espesor_mm:6.45, valor_original:6.45, unidad:'mm', metodo:'UT-B (B-Scan)',       evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2024 – Virola 1 en Alerta (≤ 6.50 mm)' },

      { id:'M-020', cml_id:'CML-008', equipo_id:'EQ-004', fecha:'2018-09-10', espesor_mm:7.80, valor_original:7.80, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2018 – Virola 2' },
      { id:'M-021', cml_id:'CML-008', equipo_id:'EQ-004', fecha:'2021-09-15', espesor_mm:7.45, valor_original:7.45, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2021 – Virola 2' },
      { id:'M-022', cml_id:'CML-008', equipo_id:'EQ-004', fecha:'2024-09-15', espesor_mm:7.10, valor_original:7.10, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2024 – Virola 2 normal' },

      { id:'M-023', cml_id:'CML-009', equipo_id:'EQ-004', fecha:'2018-09-10', espesor_mm:6.90, valor_original:6.90, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2018 – Virola 3' },
      { id:'M-024', cml_id:'CML-009', equipo_id:'EQ-004', fecha:'2021-09-15', espesor_mm:6.70, valor_original:6.70, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2021 – Virola 3' },
      { id:'M-025', cml_id:'CML-009', equipo_id:'EQ-004', fecha:'2024-09-15', espesor_mm:6.55, valor_original:6.55, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Rodríguez L.', notas:'Campaña 2024 – Virola 3 normal' },

      // E-301
      { id:'M-026', cml_id:'CML-010', equipo_id:'EQ-003', fecha:'2020-09-10', espesor_mm:10.60, valor_original:10.60, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Martínez R.', notas:'Campaña 2020' },
      { id:'M-027', cml_id:'CML-010', equipo_id:'EQ-003', fecha:'2022-09-10', espesor_mm:10.35, valor_original:10.35, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Martínez R.', notas:'Campaña 2022' },
      { id:'M-028', cml_id:'CML-010', equipo_id:'EQ-003', fecha:'2024-09-10', espesor_mm:10.10, valor_original:10.10, unidad:'mm', metodo:'UT-A (Convencional)', evento:'Normal', tecnico:'Martínez R.', notas:'Campaña 2024' }
    ];

    // 1 esquema precargado por familia con marcadores CML posicionados
    const isometricosSeed = [
      {
        id: 'ISO-001',
        equipo_id: 'EQ-001',
        tipo: 'Plano Mecánico',
        titulo: 'Esquema de Monitoreo CML – Separador V-101',
        numero: 'DWG-V101-CML-01',
        revision: 'B',
        fecha: '2024-05-20',
        autor: 'Ing. Integridad Mecánica',
        estado_doc: 'Vigente',
        url_externa: '',
        descripcion: 'Ubicación de puntos CML-V1, CML-V2 y CML-V3 sobre la envolvente cilíndrica (ASME VIII Div.1 / API 510).',
        cml_pins: [
          { cml_id: 'CML-001', x: 35, y: 34 },
          { cml_id: 'CML-002', x: 52, y: 66 },
          { cml_id: 'CML-003', x: 70, y: 68 }
        ]
      },
      {
        id: 'ISO-002',
        equipo_id: 'EQ-002',
        tipo: 'Isométrico',
        titulo: 'Isométrico de Inspección – Circuito CI-CRU-201 (P-201A)',
        numero: 'ISO-P201A-001',
        revision: 'C',
        fecha: '2024-06-15',
        autor: 'Ing. Tuberías',
        estado_doc: 'Vigente',
        url_externa: '',
        descripcion: 'Ubicación de CML-P1 (alerta), CML-P2 (bajo mínimo) y CML-P3 (tramo reemplazado 2022) en tramo recto 6" Sch 40.',
        cml_pins: [
          { cml_id: 'CML-004', x: 25, y: 50 },
          { cml_id: 'CML-005', x: 55, y: 50 },
          { cml_id: 'CML-006', x: 82, y: 50 }
        ]
      },
      {
        id: 'ISO-003',
        equipo_id: 'EQ-004',
        tipo: 'Plano Mecánico',
        titulo: 'Esquema de Virolas del Manto – Tanque TK-401',
        numero: 'DWG-TK401-SHL-01',
        revision: 'A',
        fecha: '2024-09-15',
        autor: 'Ing. Tanques API 653',
        estado_doc: 'Vigente',
        url_externa: '',
        descripcion: 'Distribución vertical de CML-T1 (Virola 1), CML-T2 (Virola 2) y CML-T3 (Virola 3) sobre el manto atmosférico.',
        cml_pins: [
          { cml_id: 'CML-007', x: 42, y: 78 },
          { cml_id: 'CML-008', x: 52, y: 56 },
          { cml_id: 'CML-009', x: 60, y: 34 }
        ]
      }
    ];

    const inspeccionesSeed = [
      {
        id:'INS-001', equipo_id:'EQ-001', fecha:'2024-05-20', tipo:'UT General', resultado:'Satisfactorio',
        hallazgos:'Desgaste uniforme controlado en CML-V1 y CML-V2; habilitado nuevo punto CML-V3.',
        recomendaciones:'Completar segunda campaña en CML-V3 para obtener tasa de corrosión.',
        tecnico:'López J.', proxima_fecha:'2028-02-01', estado:'Cerrada'
      },
      {
        id:'INS-002', equipo_id:'EQ-002', fecha:'2024-06-15', tipo:'UT General', resultado:'Crítico',
        hallazgos:'CML-P2 por debajo de espesor mínimo admisible (2.40 mm < 2.71 mm). CML-P1 en condición de alerta.',
        recomendaciones:'Reemplazar tramo crítico CML-P2 de inmediato y programar intervención en CML-P1.',
        tecnico:'García P.', proxima_fecha:'2024-12-15', estado:'Abierta'
      },
      {
        id:'INS-003', equipo_id:'EQ-004', fecha:'2024-09-15', tipo:'UT General', resultado:'Atención Requerida',
        hallazgos:'Adelgazamiento acelerado en Virola 1 (CML-T1 = 6.45 mm). Virolas 2 y 3 en rango normal.',
        recomendaciones:'Mantener seguimiento API 653 sobre manto y programar inspección de fondo pendiente.',
        tecnico:'Rodríguez L.', proxima_fecha:'2025-05-01', estado:'Abierta'
      },
      {
        id:'INS-004', equipo_id:'EQ-003', fecha:'2024-09-10', tipo:'Externa', resultado:'Satisfactorio',
        hallazgos:'Sin anomalías externas ni pérdida significativa en carcasa.',
        recomendaciones:'Mantener programa estándar API 510.',
        tecnico:'Martínez R.', proxima_fecha:'2029-09-10', estado:'Cerrada'
      }
    ];

    // Pre-computed full API RP 581 quantitative RBI case(s)
    const rbiCalcV101 = ThicknessCalc.calcRBI581({
      familia: 'Vasija a Presión',
      t_trd_mm: 13.90,
      t_min_mm: 10.99,
      t_nom_mm: 16.0,
      CR_mmpa: 0.40,
      age_a: 2.0,
      S_MPa: 138,
      E_joint: 1.0,
      SMYS_MPa: 260,
      UTS_MPa: 485,
      insp_eff: 'B',
      insp_count: 2,
      F_MS: 1.0,
      CA_m2: 185,
      CE_val: 450000,
      moneda: 'USD',
      base_valoracion: 'Reposición de recipiente + 7 días de parada de planta + mitigación ambiental'
    });

    const rbiCalcP201 = ThicknessCalc.calcRBI581({
      familia: 'Tubería a Presión',
      t_trd_mm: 3.45,
      t_min_mm: 2.71,
      t_nom_mm: 7.11,
      CR_mmpa: 0.50,
      age_a: 1.5,
      S_MPa: 138,
      E_joint: 1.0,
      SMYS_MPa: 241,
      UTS_MPa: 414,
      insp_eff: 'C',
      insp_count: 1,
      F_MS: 1.0,
      CA_m2: 120,
      CE_val: 280000,
      moneda: 'USD',
      base_valoracion: 'Reemplazo de tramo + contención de derrame + pérdida de bombeo'
    });

    const riskLabels = { low: 'Bajo', medium: 'Medio', high: 'Alto', vhigh: 'Muy Alto' };
    const rbiSeed = [
      {
        id: 'RBI-001',
        equipo_id: 'EQ-001',
        fecha_evaluacion: '2024-06-01',
        mecanismo: 'Adelgazamiento generalizado (API RP 581 Parte 2 §4)',
        tasa_corrosion_mmpa: 0.40,
        espesor_actual_mm: 13.90,
        espesor_minimo_mm: 10.99,
        espesor_nominal_mm: 16.0,
        age_a: 2.0,
        insp_eff: 'B',
        insp_count: 2,
        gff: rbiCalcV101.entradas.gff,
        F_MS: 1.0,
        Df: Number(rbiCalcV101.Df.toFixed(2)),
        f_F: rbiCalcV101.f_F,
        PoF_1a: rbiCalcV101.PoF_T,
        CA_m2: 185,
        CE_val: 450000,
        moneda: 'USD',
        base_valoracion: rbiCalcV101.base_valoracion,
        R_A: rbiCalcV101.R_A,
        R_E: rbiCalcV101.R_E,
        vida_remanente_a: Number(rbiCalcV101.remaining_life_a.toFixed(2)),
        pof_categoria: rbiCalcV101.pof_cat,
        pof_valor: `Cat. ${rbiCalcV101.pof_cat}`,
        cof_categoria: rbiCalcV101.cof_area_cat,
        cof_econ_categoria: rbiCalcV101.cof_econ_cat,
        cof_valor: `Área ${rbiCalcV101.cof_area_cat} / Econ ${rbiCalcV101.cof_econ_cat}`,
        riesgo_area_color: rbiCalcV101.risk_area_color,
        riesgo_econ_color: rbiCalcV101.risk_econ_color,
        riesgo_categoria: riskLabels[rbiCalcV101.risk_gov_color],
        riesgo_color: rbiCalcV101.risk_gov_color,
        prioridad: rbiCalcV101.prioridad,
        intervalo_inspeccion_a: rbiCalcV101.intervalo_a,
        proxima_inspeccion: '2029-06-01',
        estado: 'Vigente',
        notas: 'Caso completo demostrativo RBI API RP 581 para recipiente V-101.'
      },
      {
        id: 'RBI-002',
        equipo_id: 'EQ-002',
        fecha_evaluacion: '2024-06-20',
        mecanismo: 'Adelgazamiento generalizado (API RP 581 Parte 2 §4)',
        tasa_corrosion_mmpa: 0.50,
        espesor_actual_mm: 3.45,
        espesor_minimo_mm: 2.71,
        espesor_nominal_mm: 7.11,
        age_a: 1.5,
        insp_eff: 'C',
        insp_count: 1,
        gff: rbiCalcP201.entradas.gff,
        F_MS: 1.0,
        Df: Number(rbiCalcP201.Df.toFixed(2)),
        f_F: rbiCalcP201.f_F,
        PoF_1a: rbiCalcP201.PoF_T,
        CA_m2: 120,
        CE_val: 280000,
        moneda: 'USD',
        base_valoracion: rbiCalcP201.base_valoracion,
        R_A: rbiCalcP201.R_A,
        R_E: rbiCalcP201.R_E,
        vida_remanente_a: Number(rbiCalcP201.remaining_life_a.toFixed(2)),
        pof_categoria: rbiCalcP201.pof_cat,
        pof_valor: `Cat. ${rbiCalcP201.pof_cat}`,
        cof_categoria: rbiCalcP201.cof_area_cat,
        cof_econ_categoria: rbiCalcP201.cof_econ_cat,
        cof_valor: `Área ${rbiCalcP201.cof_area_cat} / Econ ${rbiCalcP201.cof_econ_cat}`,
        riesgo_area_color: rbiCalcP201.risk_area_color,
        riesgo_econ_color: rbiCalcP201.risk_econ_color,
        riesgo_categoria: riskLabels[rbiCalcP201.risk_gov_color],
        riesgo_color: rbiCalcP201.risk_gov_color,
        prioridad: rbiCalcP201.prioridad,
        intervalo_inspeccion_a: rbiCalcP201.intervalo_a,
        proxima_inspeccion: '2025-06-20',
        estado: 'Vigente',
        notas: 'Caso de riesgo alto en tubería P-201A.'
      }
    ];

    equiposSeed.forEach(e => insert('equipos', e));
    cmlsSeed.forEach(c => insert('cmls', c));
    medicionesSeed.forEach(m => insert('mediciones', m));
    isometricosSeed.forEach(iso => insert('isometricos', iso));
    inspeccionesSeed.forEach(i => insert('inspecciones', i));
    rbiSeed.forEach(r => insert('rbi_evaluaciones', r));
  }

  /* ═══════════════════════════════════════════════════════════
     COMPUTED INTEGRITY HELPERS (Short/Long-Term CR, Events, Alerts)
     ═══════════════════════════════════════════════════════════ */
  function lastMedicion(cml_id) {
    return getAll('mediciones')
      .filter(m => m.cml_id === cml_id)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
  }

  /**
   * Complete CML corrosion & remaining life analysis (Sección 4.4 & 4.5)
   */
  function analyzeCML(cml_id, equipoObj = null) {
    const cml = getById('cmls', cml_id);
    const eq = equipoObj || (cml ? getById('equipos', cml.equipo_id) : null);
    const allMeds = getAll('mediciones')
      .filter(m => m.cml_id === cml_id)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const warnings = [];
    const hoy = new Date();
    const MS_YR = 365.25 * 24 * 3600 * 1000;

    // Check date inconsistencies (duplicates, invalid, future)
    const seenDates = new Set();
    allMeds.forEach(m => {
      const d = new Date(m.fecha);
      if (isNaN(d)) {
        warnings.push(`Fecha inválida detectada en medición ${m.id}.`);
      } else {
        if (d > hoy) warnings.push(`Fecha futura detectada (${m.fecha}): revisar consistencia.`);
        if (seenDates.has(m.fecha)) warnings.push(`Fechas duplicadas detectadas (${m.fecha}): puede distorsionar velocidad de corto plazo.`);
        seenDates.add(m.fecha);
      }
    });

    // Identify baseline reset events (Reparación / Reemplazo / Cambio de punto)
    let resetIdx = -1;
    let resetEvent = null;
    for (let i = allMeds.length - 1; i >= 0; i--) {
      if (['Reparación', 'Reemplazo', 'Cambio de punto'].includes(allMeds[i].evento)) {
        resetIdx = i;
        resetEvent = allMeds[i];
        break;
      }
    }

    const comparable = resetIdx >= 0 ? allMeds.slice(resetIdx) : allMeds;
    if (resetEvent) {
      warnings.push(`Evento "${resetEvent.evento}" registrado el ${resetEvent.fecha}: las tasas de corrosión se calculan solo con las ${comparable.length} mediciones comparables posteriores.`);
    }

    const last = comparable.length > 0 ? comparable[comparable.length - 1] : null;
    const t_min = eq?.espesor_minimo_mm !== undefined && eq?.espesor_minimo_mm !== null ? Number(eq.espesor_minimo_mm) : null;
    const t_nom = eq?.espesor_nominal_mm !== undefined && eq?.espesor_nominal_mm !== null ? Number(eq.espesor_nominal_mm) : null;
    const ca    = Number(eq?.ca_mm || 0);
    const plazo = Number(eq?.plazo_intervencion_a || 2.0);

    let cr_st = null, cr_lt = null, cr_reg = null, cr_adoptada = null;
    let cr_justificacion = 'Datos insuficientes: se requieren al menos 2 mediciones comparables con fechas distintas.';
    let insufficient = comparable.length < 2;

    if (comparable.length >= 2) {
      const first = comparable[0];
      const prev  = comparable[comparable.length - 2];
      const yrLT  = (new Date(last.fecha) - new Date(first.fecha)) / MS_YR;
      const yrST  = (new Date(last.fecha) - new Date(prev.fecha)) / MS_YR;

      if (yrLT > 0) cr_lt = (Number(first.espesor_mm) - Number(last.espesor_mm)) / yrLT;
      if (yrST > 0) cr_st = (Number(prev.espesor_mm) - Number(last.espesor_mm)) / yrST;
      cr_reg = ThicknessCalc.corrosionRateFromReadings(comparable);

      if (yrLT <= 0 || yrST <= 0) {
        warnings.push('Intervalo temporal nulo (fechas repetidas o inconsistentes): no es posible calcular la velocidad de corrosión.');
        insufficient = true;
      } else {
        if (cr_st < 0 || cr_lt < 0) {
          warnings.push(`Velocidad negativa detectada (ST=${cr_st.toFixed(3)}, LT=${cr_lt.toFixed(3)} mm/a): posible error de calibración/lectura o reparación no registrada.`);
        } else if (cr_st === 0 && cr_lt === 0) {
          warnings.push('Velocidad de corrosión nula (0.000 mm/a): sin pérdida detectable entre campañas.');
        }

        // Adopt conservative governing rate per API 510 / API 570
        const maxPos = Math.max(cr_st, cr_lt);
        if (maxPos > 0) {
          cr_adoptada = maxPos;
          if (comparable.length === 2) {
            cr_justificacion = `Con 2 lecturas comparables, CR corto plazo = CR largo plazo = ${cr_adoptada.toFixed(3)} mm/a.`;
          } else if (cr_st >= cr_lt) {
            cr_justificacion = `Se adopta CR de corto plazo (${cr_st.toFixed(3)} mm/a ≥ largo plazo ${cr_lt.toFixed(3)} mm/a) por criterio conservador (API 510/570) ante aceleración reciente.`;
          } else {
            cr_justificacion = `Se adopta CR de largo plazo (${cr_lt.toFixed(3)} mm/a > corto plazo ${cr_st.toFixed(3)} mm/a) por criterio conservador (API 510/570) reflejando tendencia histórica.`;
          }
        } else {
          cr_adoptada = 0;
          cr_justificacion = 'Ambas velocidades son nulas o negativas: se adopta 0.000 mm/a (sin desgaste activo confirmado; revisar lecturas).';
        }
      }
    }

    // Alert thickness (calculated dynamically from adopted CR and intervention lead time)
    let t_alerta = eq?.espesor_alerta_mm ? Number(eq.espesor_alerta_mm) : null;
    let alerta_justificacion = '';
    if (t_min !== null) {
      const aInfo = ThicknessCalc.calcAlertThickness(t_min, cr_adoptada || 0, plazo, ca);
      t_alerta = aInfo.t_alerta_mm;
      alerta_justificacion = aInfo.justificacion;
    }

    // Remaining Life
    let rl = Infinity;
    if (last && t_min !== null) {
      if (Number(last.espesor_mm) < t_min) {
        rl = cr_adoptada && cr_adoptada > 0 ? (Number(last.espesor_mm) - t_min) / cr_adoptada : -1;
        warnings.push(`ESPESOR BAJO EL MÍNIMO: ${Number(last.espesor_mm).toFixed(2)} mm < t_mín (${t_min.toFixed(2)} mm).`);
      } else if (cr_adoptada && cr_adoptada > 0) {
        rl = (Number(last.espesor_mm) - t_min) / cr_adoptada;
      }
    } else {
      rl = null;
    }

    // Next inspection per family standard (API 510 / 570 / 653)
    const nextInsp = eq ? ThicknessCalc.calcNextInspection({
      tipoEquipo: eq.tipo,
      tipoInspeccion: 'Medición de espesores',
      fechaReferencia: last?.fecha || new Date().toISOString().split('T')[0],
      rl_a: rl,
      cr_mmpa: insufficient ? null : cr_adoptada,
      claseTuberia: eq.clase_tuberia || 'Clase 1',
      t_actual_mm: last ? Number(last.espesor_mm) : null,
      t_min_mm: t_min,
      t_alerta_mm: t_alerta
    }) : null;

    // Overall condition
    let condicion = 'Normal';
    if (last && t_min !== null && Number(last.espesor_mm) < t_min) {
      condicion = 'Espesor bajo el mínimo';
    } else if (insufficient || t_min === null) {
      condicion = 'Información insuficiente';
    } else if (nextInsp?.vencida) {
      condicion = 'Inspección vencida';
    } else if (last && t_alerta !== null && Number(last.espesor_mm) <= t_alerta) {
      condicion = 'Alerta';
    }

    return {
      cml,
      equipo: eq,
      allMeds,
      comparable,
      resetEvent,
      last,
      t_nom,
      t_min,
      t_alerta,
      alerta_justificacion,
      cr_st,
      cr_lt,
      cr_reg,
      cr_adoptada,
      cr_justificacion,
      rl,
      nextInsp,
      condicion,
      insufficient,
      warnings
    };
  }

  /**
   * Governing corrosion rate (mm/yr) – maintains backward compatibility
   */
  function calcCorrosionRate(cml_id) {
    const a = analyzeCML(cml_id);
    return a.insufficient ? null : a.cr_adoptada;
  }

  /**
   * Remaining life in years for a CML
   */
  function remainingLife(cml_id, t_min_mm) {
    const a = analyzeCML(cml_id);
    if (!a.last || t_min_mm === undefined || t_min_mm === null) return Infinity;
    const t_act = Number(a.last.espesor_mm);
    if (t_act < t_min_mm) {
      return (a.cr_adoptada && a.cr_adoptada > 0) ? (t_act - t_min_mm) / a.cr_adoptada : -0.1;
    }
    if (!a.cr_adoptada || a.cr_adoptada <= 0) return Infinity;
    return (t_act - t_min_mm) / a.cr_adoptada;
  }

  /**
   * Next inspection interval (years) applying API 510 / 570 / 653 rules
   */
  function nextInspectionCBM(cml_id, t_min_mm) {
    const a = analyzeCML(cml_id);
    if (a.nextInsp && a.nextInsp.intervalo_a !== null) return a.nextInsp.intervalo_a;
    const rl = remainingLife(cml_id, t_min_mm);
    if (!isFinite(rl)) return null;
    return Math.max(0, rl / 2);
  }

  /**
   * Equipment-level worst condition & summary across all active CMLs
   */
  function evaluateEquipoStatus(equipo_id) {
    const eq = getById('equipos', equipo_id);
    if (!eq) return null;
    const cmls = query('cmls', c => c.equipo_id === equipo_id && c.activo !== false);
    if (cmls.length === 0) {
      return {
        equipo: eq,
        condicion: 'Información insuficiente',
        worstCML: null,
        maxCR: null,
        minRL: Infinity,
        nextInsp: null,
        analyses: []
      };
    }
    const analyses = cmls.map(c => analyzeCML(c.id, eq));
    const priority = {
      'Espesor bajo el mínimo':   5,
      'Inspección vencida':       4,
      'Alerta':                   3,
      'Normal':                   2,
      'Información insuficiente': 1
    };

    // Check also overdue inspection plans for this equipment
    const hoy = new Date();
    const hasOverduePlan = query('planes', p => p.equipo_id === equipo_id && p.estado === 'Programada' && p.fecha_prog && new Date(p.fecha_prog) < hoy).length > 0;

    let worst = analyses[0];
    let maxCR = null;
    let minRL = Infinity;

    analyses.forEach(a => {
      const pA = priority[a.condicion] || 0;
      const pW = priority[worst.condicion] || 0;
      if (pA > pW) {
        worst = a;
      } else if (pA === pW) {
        // Tie-breaker: lowest remaining life, then lowest measured thickness
        const rlA = (a.rl !== null && isFinite(a.rl)) ? a.rl : Infinity;
        const rlW = (worst.rl !== null && isFinite(worst.rl)) ? worst.rl : Infinity;
        const tA  = a.last ? Number(a.last.espesor_mm) : Infinity;
        const tW  = worst.last ? Number(worst.last.espesor_mm) : Infinity;
        if (rlA < rlW || (rlA === rlW && tA < tW)) worst = a;
      }
      if (a.cr_adoptada !== null && (maxCR === null || a.cr_adoptada > maxCR)) maxCR = a.cr_adoptada;
      if (a.rl !== null && isFinite(a.rl) && a.rl < minRL) minRL = a.rl;
    });

    const allInsufficient = analyses.every(a => a.condicion === 'Información insuficiente');
    let condicion = allInsufficient ? 'Información insuficiente' : worst.condicion;
    if (hasOverduePlan && priority['Inspección vencida'] > (priority[condicion] || 0)) {
      condicion = 'Inspección vencida';
    }

    // Governing next inspection (earliest valid date)
    const validInsps = analyses.map(a => a.nextInsp).filter(n => n && n.proxima_fecha);
    validInsps.sort((a, b) => new Date(a.proxima_fecha) - new Date(b.proxima_fecha));

    return {
      equipo: eq,
      condicion,
      worstCML: worst,
      maxCR,
      minRL,
      nextInsp: validInsps[0] || null,
      analyses
    };
  }

  function dashboardStats() {
    const equipos = getAll('equipos');
    const cmls    = getAll('cmls');
    const insp    = getAll('inspecciones');
    const rbis    = getAll('rbi_evaluaciones');
    const planes  = getAll('planes');

    const hoy = new Date();
    const vencidas = planes.filter(p => p.estado === 'Programada' && p.fecha_prog && new Date(p.fecha_prog) < hoy);
    const proximas = planes.filter(p => {
      if (p.estado !== 'Programada' || !p.fecha_prog) return false;
      const diff = (new Date(p.fecha_prog) - hoy) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= 90;
    });
    const rbi_alto = rbis.filter(r => ['high', 'vhigh'].includes(r.riesgo_color));

    return {
      total_equipos:   equipos.length,
      equipos_activos: equipos.filter(e => e.estado === 'Activo').length,
      total_cmls:      cmls.length,
      insp_vencidas:   vencidas.length,
      insp_proximas:   proximas.length,
      rbi_alto:        rbi_alto.length,
      total_planes:    planes.length,
    };
  }

  return {
    init, getAll, getById, insert, update, remove, query,
    exportProject, importProject, resetDemoData,
    lastMedicion, analyzeCML, calcCorrosionRate, remainingLife, nextInspectionCBM,
    evaluateEquipoStatus, dashboardStats,
    STORES, SCHEMA_VERSION
  };
})();
