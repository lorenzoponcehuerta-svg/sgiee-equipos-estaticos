/**
 * SGIEE – Main Application Controller
 * Initialises DB, wires navigation, renders active module.
 */
const App = (() => {

  /* ── Module registry ────────────────────────────────────── */
  const MODULES = {
    dashboard:    { mod: ModDashboard,    title: 'Dashboard' },
    equipos:      { mod: ModEquipos,      title: 'Registro de Equipos' },
    cml:          { mod: ModCML,          title: 'CML / TML' },
    historial:    { mod: ModHistorial,    title: 'Historial de Inspecciones' },
    isometricos:  { mod: ModIsometricos,  title: 'Isométricos' },
    espesores:    { mod: ModEspesores,    title: 'Cálculo de Espesores' },
    rbi:          { mod: ModRBI,          title: 'RBI – Evaluación de Riesgo' },
    planificacion:{ mod: ModPlanificacion,title: 'Programación de Inspecciones' },
    reportes:     { mod: ModReportes,     title: 'Reportes' },
    validacion:   { mod: ModValidacion,   title: 'Validación y Alcance' },
  };

  let currentModule = 'dashboard';
  let navParam      = null;

  /* ── Boot ───────────────────────────────────────────────── */
  function init() {
    DB.init();
    if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
    _bindSidebarNav();
    _bindMobileToggle();
    _bindHelpBtn();
    _bindProjectBackup();
    navigate('dashboard');
    console.log('SGIEE v2.0 – Iniciado correctamente.');
  }

  /* ── Navigation ─────────────────────────────────────────── */
  function navigate(moduleKey, param = null, action = null) {
    if (!MODULES[moduleKey]) {
      console.warn('SGIEE: módulo desconocido:', moduleKey);
      return;
    }

    currentModule = moduleKey;
    navParam      = param;

    // Update active section
    document.querySelectorAll('.module-view').forEach(s =>
      s.classList.toggle('active', s.id === `mod-${moduleKey}`)
    );

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(a =>
      a.classList.toggle('active', a.dataset.module === moduleKey)
    );

    // Update page title
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = MODULES[moduleKey].title;

    // Render module (pass param if accepted)
    const mod = MODULES[moduleKey].mod;
    if (typeof mod.render === 'function') {
      mod.render(param);
    }

    if (action && typeof mod[action] === 'function') {
      setTimeout(() => mod[action](param), 80);
    }

    // Scroll to top of content
    const content = document.getElementById('contentArea');
    if (content) content.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Sidebar navigation ─────────────────────────────────── */
  function _bindSidebarNav() {
    // Sidebar toggle (collapse/expand)
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Nav item clicks
    document.querySelectorAll('.nav-item[data-module]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        navigate(a.dataset.module);
        // Close mobile menu if open
        document.getElementById('sidebar').classList.remove('mobile-open');
      });
    });
  }

  /* ── Mobile menu toggle ─────────────────────────────────── */
  function _bindMobileToggle() {
    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('mobile-open');
    });

    // Close on overlay click (mobile)
    document.getElementById('mainContent')?.addEventListener('click', e => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar.classList.contains('mobile-open') && !e.target.closest('#sidebar')) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }

  /* ── Help button ────────────────────────────────────────── */
  function _bindHelpBtn() {
    document.getElementById('helpBtn')?.addEventListener('click', () => {
      Utils.openModal(
        'ℹ️ Ayuda – SGIEE v1.0',
        `<div class="form-section">
          <div class="form-section-title">¿Qué es SGIEE?</div>
          <p class="text-sm">Sistema de Gestión de Integridad de Equipos Estáticos.
          Plataforma para inspección basada en riesgo (RBI) y condición (CBM) de
          equipos a presión en la industria de hidrocarburos y química.</p>
        </div>

        <div class="form-section">
          <div class="form-section-title">Módulos Disponibles</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[
              ['🗄 Equipos',     'Registro completo de equipos con datos de diseño'],
              ['📍 CML/TML',    'Puntos de monitoreo de corrosión con historial de espesores'],
              ['📋 Historial',  'Registro de inspecciones, hallazgos y recomendaciones'],
              ['📐 Isométricos','Documentos técnicos con pins de CML interactivos'],
              ['🔧 Espesores',  'Cálculo t_min: ASME B31.3, VIII Div.1, API 650, FFS API 579-1'],
              ['⚠ RBI',         'Evaluación de riesgo API 580 – mecanismo adelgazamiento'],
              ['📅 Programación','Planificación CBM+RBI con vista calendario y órdenes de trabajo'],
              ['📊 Reportes',   'Reportes imprimibles y exportación CSV'],
            ].map(([t,d])=>`<div style="background:var(--c-surface-2);border:1px solid var(--c-border);
              border-radius:var(--r-md);padding:8px 10px">
              <div class="text-sm font-bold">${t}</div>
              <div class="text-xs text-muted">${d}</div>
            </div>`).join('')}
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Normas Implementadas</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['API 650-2013','ASME B31.3-2018','ASME VIII Div.1-2019','ASME II-D-2019','API 580','API 579-1','API 510/570 (CBM)']
              .map(n=>`<span class="badge badge-primary">${n}</span>`).join('')}
          </div>
        </div>

        <div class="text-xs text-muted mt-2" style="border-top:1px solid var(--c-border);padding-top:8px">
          Los datos se almacenan localmente en el navegador (localStorage).
          Para producción se recomienda integrar con una base de datos servidor.
        </div>`,
        { size: 'modal-lg' }
      );
    });
  }

  /* ── Project Backup / Restore / Reset (Sección 6) ──────── */
  function _bindProjectBackup() {
    document.getElementById('exportProjectBtn')?.addEventListener('click', () => {
      const payload = DB.exportProject();
      Utils.downloadJSON(payload, `proyecto_sgiee_${Utils.today()}.json`);
      Utils.toast('Proyecto exportado', 'Archivo JSON descargado con equipos, CML, mediciones, RBI y adjuntos.', 'success');
    });

    const input = document.getElementById('importProjectInput');
    document.getElementById('importProjectBtn')?.addEventListener('click', () => {
      if (input) { input.value = ''; input.click(); }
    });

    input?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const counts = DB.importProject(parsed);
          if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
          Utils.toast('Proyecto recuperado',
            `Restaurados: ${counts.equipos} equipos, ${counts.cmls} CMLs, ${counts.mediciones} mediciones, ${counts.isometricos} esquemas.`, 'success', 5000);
          navigate(currentModule);
        } catch (err) {
          Utils.toast('Error al importar', err.message || 'El archivo JSON no es válido.', 'error');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('resetDemoBtn')?.addEventListener('click', () => {
      Utils.confirm('¿Restablecer el caso demostrativo completo (3 familias, 3 CML/familia, 3 campañas, esquemas y RBI)?', () => {
        DB.resetDemoData();
        if (window.ModPlanificacion?.syncPlans) ModPlanificacion.syncPlans();
        Utils.toast('Demo restablecido', 'Caso demostrativo completo cargado nuevamente.', 'success');
        navigate('dashboard');
      });
    });
  }

  return { init, navigate };
})();

// Expose navigation globally for cross-module dashboard/action links.
window.App = App;

/* ── Bootstrap ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());
