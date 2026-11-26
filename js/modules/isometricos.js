/**
 * SGIEE – Módulo: Isométricos, Esquemas y Documentación Técnica (Sección 4.3)
 * - Admite imágenes PNG o JPG subidas por el usuario (almacenadas en base64 y exportables en el proyecto).
 * - Admite archivos PDF adjuntos para consulta directa.
 * - Mantiene esquemas SVG por familia cuando no hay imagen cargada.
 * - Posicionamiento de marcadores CML/TML mediante coordenadas X/Y (%) en formulario o clic directo sobre el plano.
 */
const ModIsometricos = (() => {

  let selectedEquipoId = null;
  let activeDocId      = null;
  let searchTerm       = '';

  function render(equipoId = null) {
    if (equipoId) {
      selectedEquipoId = equipoId;
      const firstDoc = DB.query('isometricos', d => d.equipo_id === equipoId)[0];
      activeDocId = firstDoc ? firstDoc.id : null;
    }

    const el = document.getElementById('mod-isometricos');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Documentación Técnica, Esquemas e Isométricos</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="iso-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="iso-newBtn">＋ Nuevo Esquema / Documento</button>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-body" style="padding:12px 20px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <label style="margin:0;font-weight:600">Equipo:</label>
            <select class="form-control" id="iso-eqSel" style="max-width:440px">
              <option value="">— Todos los equipos —</option>
              ${DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
                .map(e=>`<option value="${e.id}" ${selectedEquipoId===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)} (${Utils.escHtml(e.tipo)})</option>`)
                .join('')}
            </select>
            <div class="search-input" style="min-width:180px">
              <input type="text" id="iso-search" placeholder="Buscar documento…" value="${Utils.escHtml(searchTerm)}">
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2" id="iso-mainGrid" style="align-items:start">
        <div id="iso-listArea"></div>
        <div id="iso-viewerArea">
          <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:32px">
            <div class="empty-icon">📐</div>
            <h3>Seleccione un documento</h3>
            <p>Haga clic en un isométrico, esquema PNG/JPG o PDF para visualizarlo y posicionar marcadores CML/TML.</p>
          </div>
        </div>
      </div>`;

    _bindEvents(el);
    _renderDocList();
    if (activeDocId && DB.getById('isometricos', activeDocId)) {
      _openViewer(activeDocId);
    }
  }

  function _renderDocList() {
    let docs = selectedEquipoId
      ? DB.query('isometricos', d => d.equipo_id === selectedEquipoId)
      : DB.getAll('isometricos');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      docs = docs.filter(d => [d.titulo, d.numero, d.tipo, d.revision, d.descripcion].some(v => (v||'').toLowerCase().includes(q)));
    }
    docs.sort((a, b) => (a.equipo_id||'').localeCompare(b.equipo_id||'') || (a.numero||'').localeCompare(b.numero||''));

    const area = document.getElementById('iso-listArea');
    if (!area) return;

    if (docs.length === 0) {
      area.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><h3>Sin documentos</h3>
        <p>Agregue un esquema PNG/JPG, un PDF o un isométrico para este equipo.</p>
        <button class="btn btn-primary btn-sm mt-2" id="iso-newBtn2">＋ Nuevo Documento</button></div>`;
      area.querySelector('#iso-newBtn2')?.addEventListener('click', () => openDocForm(null));
      return;
    }

    area.innerHTML = docs.map(doc => {
      const eq = DB.getById('equipos', doc.equipo_id);
      const isActive = doc.id === activeDocId;
      const typeIcon = { 'Isométrico':'📐','Plano Mecánico':'📏','Fotografía':'📷','Datasheet':'📄','P&ID':'⚙','Procedimiento':'📋','Informe':'📊' }[doc.tipo] || '📁';
      const attachBadge = doc.image_data ? '<span class="badge badge-success">🖼 PNG/JPG</span>'
        : doc.pdf_data ? '<span class="badge badge-info">📄 PDF</span>'
        : '<span class="badge badge-muted">SVG</span>';

      return `
        <div class="iso-card ${isActive?'selected':''}" data-doc="${doc.id}"
          style="background:var(--c-surface);border:1px solid ${isActive?'var(--c-primary)':'var(--c-border)'};
          border-radius:var(--r-lg);padding:14px 16px;margin-bottom:10px;cursor:pointer;
          ${isActive?'box-shadow:0 0 0 3px rgba(26,111,196,.15)':''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:1.5rem">${typeIcon}</span>
              <div>
                <div style="font-weight:700;font-size:.94rem">${Utils.escHtml(doc.titulo)}</div>
                <div class="text-xs text-muted">${Utils.escHtml(doc.numero||'')} ${doc.revision ? '· Rev.'+Utils.escHtml(doc.revision) : ''} · ${Utils.fmtDate(doc.fecha)}</div>
                <div class="text-xs text-muted">${eq ? `${eq.tag} (${eq.tipo})` : ''} · ${(doc.cml_pins||[]).length} marcadores CML</div>
              </div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
              ${attachBadge}
              <span class="badge badge-muted">${Utils.escHtml(doc.tipo||'—')}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" data-doc-action="view" data-doc="${doc.id}">👁 Ver</button>
            <button class="btn btn-ghost btn-sm" data-doc-action="edit" data-doc="${doc.id}">✏️</button>
            <button class="btn btn-ghost btn-sm" data-doc-action="del"  data-doc="${doc.id}" style="color:var(--c-danger)">🗑</button>
          </div>
        </div>`;
    }).join('');

    area.querySelectorAll('.iso-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button, a')) return;
        activeDocId = card.dataset.doc;
        _renderDocList();
        _openViewer(activeDocId);
      });
    });
    area.querySelectorAll('[data-doc-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { docAction, doc } = btn.dataset;
        if (docAction === 'view') { activeDocId = doc; _renderDocList(); _openViewer(doc); }
        if (docAction === 'edit') openDocForm(doc);
        if (docAction === 'del')  deleteDoc(doc);
      });
    });
  }

  function _openViewer(docId) {
    const doc = DB.getById('isometricos', docId);
    if (!doc) return;
    const eq   = doc.equipo_id ? DB.getById('equipos', doc.equipo_id) : null;
    const cmls = doc.equipo_id ? DB.query('cmls', c => c.equipo_id === doc.equipo_id) : [];

    const viewArea = document.getElementById('iso-viewerArea');
    if (!viewArea) return;

    const pins = (doc.cml_pins || []).map(pin => {
      const cml = cmls.find(c => c.id === pin.cml_id);
      const a   = cml ? DB.analyzeCML(cml.id, eq) : null;
      const color = !a ? '#8a9ab0'
        : a.condicion === 'Espesor bajo el mínimo' || a.condicion === 'Inspección vencida' ? '#d93025'
        : a.condicion === 'Alerta' ? '#e8a020'
        : a.condicion === 'Información insuficiente' ? '#6c7a89'
        : '#22a06b';
      return { ...pin, cml, a, color };
    });

    viewArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 style="font-size:.95rem">${Utils.escHtml(doc.titulo)}</h3>
            <div class="text-xs text-muted">${Utils.escHtml(doc.numero||'')} · Rev.${Utils.escHtml(doc.revision||'—')} · ${eq ? eq.tag : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${cmls.length > 0 ? `<button class="btn btn-primary btn-sm" id="iso-addPinBtn">📍 Agregar/Mover Marcador</button>` : ''}
            ${doc.pdf_data ? `<a href="${doc.pdf_data}" download="${Utils.escHtml(doc.pdf_name || 'documento.pdf')}" class="btn btn-secondary btn-sm">📄 Descargar PDF</a>` : ''}
          </div>
        </div>
        <div class="card-body">

          <!-- Canvas / Imagen / PDF -->
          ${doc.pdf_data && !doc.image_data ? `
            <div class="alert alert-info mb-2">
              <span class="alert-icon">📄</span>
              <div>PDF adjunto: <strong>${Utils.escHtml(doc.pdf_name || 'documento.pdf')}</strong> (consulta directa debajo; la anotación sobre PDF es opcional).</div>
            </div>
            <iframe src="${doc.pdf_data}" style="width:100%;height:380px;border:1px solid var(--c-border);border-radius:var(--r-md)"></iframe>
          ` : `
            <div id="iso-svgWrap" style="position:relative;border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;background:#fafbfc;min-height:290px;cursor:crosshair" title="Haga clic sobre el esquema para obtener coordenadas X/Y (%)">
              ${_buildDrawing(doc, eq)}
              ${_buildPinOverlay(pins)}
            </div>
            <div class="text-xs text-muted mt-1">💡 Tip: Haga clic en cualquier marcador para inspeccionar el CML o haga clic sobre el plano para posicionar un marcador rápidamente.</div>
          `}

          ${doc.pdf_data && doc.image_data ? `
            <div class="mt-2">
              <a href="${doc.pdf_data}" target="_blank" class="btn btn-secondary btn-sm">📄 Consultar PDF adjunto (${Utils.escHtml(doc.pdf_name || 'archivo.pdf')})</a>
            </div>` : ''}

          <!-- Leyenda de marcadores CML -->
          ${pins.length > 0 ? `
          <div class="mt-2">
            <div class="text-xs text-muted mb-1" style="font-weight:700;text-transform:uppercase">Marcadores CML/TML en este esquema</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${pins.map(p => !p.cml ? '' : `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md)">
                  <span style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
                  <div>
                    <div class="text-xs font-bold">${Utils.escHtml(p.cml.nombre)} <span class="text-muted">(${p.x}%, ${p.y}%)</span></div>
                    <div class="text-xs text-muted">${p.a?.last ? Number(p.a.last.espesor_mm).toFixed(2)+' mm' : '—'} · ${Utils.escHtml(p.a?.condicion || '')}</div>
                  </div>
                  <button class="btn btn-ghost btn-sm" data-goto-cml="${p.cml.equipo_id}" title="Abrir CML" style="padding:2px 5px">↗</button>
                  <button class="btn btn-ghost btn-sm" data-del-pin="${p.cml_id}" title="Quitar marcador" style="padding:2px 5px;color:var(--c-danger)">✕</button>
                </div>`).join('')}
            </div>
          </div>` : ''}

          <!-- Metadatos -->
          <div class="form-section mt-2">
            <div class="form-section-title">Detalles del Documento</div>
            <div class="form-row cols-3">
              ${_dCell('Tipo', doc.tipo)}
              ${_dCell('N° Documento', doc.numero)}
              ${_dCell('Revisión', doc.revision)}
              ${_dCell('Fecha', Utils.fmtDate(doc.fecha))}
              ${_dCell('Autor', doc.autor)}
              ${_dCell('Estado', doc.estado_doc)}
            </div>
            ${doc.descripcion ? `<div class="mt-1 text-sm text-muted">${Utils.escHtml(doc.descripcion)}</div>` : ''}
            ${doc.url_externa ? `<div class="mt-1"><a href="${Utils.escHtml(doc.url_externa)}" target="_blank" class="btn btn-secondary btn-sm">🔗 Abrir enlace externo</a></div>` : ''}
          </div>
        </div>
      </div>`;

    document.getElementById('iso-addPinBtn')?.addEventListener('click', () => openAddPinModal(docId, cmls, doc.cml_pins || []));

    // Click on drawing canvas to quickly place a marker with prefilled coordinates
    const wrap = document.getElementById('iso-svgWrap');
    wrap?.addEventListener('click', e => {
      if (e.target.closest('.cml-pin') || cmls.length === 0) return;
      const rect = wrap.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
      openAddPinModal(docId, cmls, doc.cml_pins || [], x, y);
    });

    viewArea.querySelectorAll('.cml-pin').forEach(pinEl => {
      pinEl.addEventListener('click', e => {
        e.stopPropagation();
        const p = pins.find(item => item.cml_id === pinEl.dataset.cml);
        if (!p?.cml) return;
        Utils.toast(
          `${p.cml.nombre} (${p.a?.condicion || ''})`,
          `${p.cml.componente || p.cml.descripcion || ''} · Esp: ${p.a?.last ? Number(p.a.last.espesor_mm).toFixed(2)+' mm' : '—'} · CR: ${!p.a?.insufficient && p.a?.cr_adoptada !== null ? p.a.cr_adoptada.toFixed(3)+' mm/a' : 'Insuf.'}`,
          p.a?.condicion === 'Espesor bajo el mínimo' ? 'error' : p.a?.condicion === 'Alerta' ? 'warning' : 'info',
          5000
        );
      });
    });

    viewArea.querySelectorAll('[data-goto-cml]').forEach(btn =>
      btn.addEventListener('click', () => window.App?.navigate('cml', btn.dataset.gotoCml))
    );

    viewArea.querySelectorAll('[data-del-pin]').forEach(btn => {
      btn.addEventListener('click', () => {
        const remaining = (doc.cml_pins || []).filter(p => p.cml_id !== btn.dataset.delPin);
        DB.update('isometricos', docId, { cml_pins: remaining });
        _renderDocList();
        _openViewer(docId);
      });
    });
  }

  function _dCell(label, val) {
    return `<div><div class="text-xs text-muted">${label}</div><div class="text-sm font-bold">${Utils.escHtml(String(val||'—'))}</div></div>`;
  }

  function _buildDrawing(doc, eq) {
    if (doc.image_data) {
      return `<img src="${doc.image_data}" alt="${Utils.escHtml(doc.titulo)}" style="width:100%;height:auto;display:block;max-height:440px;object-fit:contain;margin:0 auto">`;
    }
    const tipo = eq?.tipo || '';
    const W = 500, H = 280;
    let shapes = '';
    if (tipo === 'Vasija a Presión' || tipo === 'Intercambiador') {
      shapes = `
        <rect x="100" y="75" width="300" height="125" rx="10" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <ellipse cx="100" cy="137" rx="22" ry="62" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <ellipse cx="400" cy="137" rx="22" ry="62" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <rect x="225" y="48" width="50" height="27" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <rect x="225" y="200" width="50" height="27" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <rect x="145" y="200" width="36" height="38" fill="#c0c8d8" stroke="#8a9ab0"/>
        <rect x="319" y="200" width="36" height="38" fill="#c0c8d8" stroke="#8a9ab0"/>
        <text x="${W/2}" y="264" text-anchor="middle" font-size="12" fill="#5a6a80">${Utils.escHtml(eq?.tag||'Vasija')} – Envolvente cilíndrica (ASME VIII Div.1)</text>`;
    } else if (tipo === 'Tubería a Presión') {
      shapes = `
        <rect x="40" y="120" width="420" height="40" fill="#e8f4ff" stroke="#1a6fc4" stroke-width="2"/>
        <rect x="38" y="112" width="7" height="56" fill="#8a9ab0"/>
        <rect x="455" y="112" width="7" height="56" fill="#8a9ab0"/>
        <line x1="160" y1="140" x2="340" y2="140" stroke="#1a6fc4" stroke-width="2" marker-end="url(#arrow)"/>
        <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 z" fill="#1a6fc4"/></marker></defs>
        <text x="${W/2}" y="220" text-anchor="middle" font-size="12" fill="#5a6a80">${Utils.escHtml(eq?.tag||'Tubería')} · Circuito ${Utils.escHtml(eq?.circuito_inspeccion||'—')} (ASME B31.3)</text>`;
    } else if (tipo === 'Tanque Atmosférico') {
      shapes = `
        <rect x="130" y="42" width="240" height="196" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <line x1="130" y1="107" x2="370" y2="107" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="5,3"/>
        <line x1="130" y1="173" x2="370" y2="173" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="5,3"/>
        <text x="378" y="80" font-size="10" fill="#5a6a80">Virola 3</text>
        <text x="378" y="145" font-size="10" fill="#5a6a80">Virola 2</text>
        <text x="378" y="210" font-size="10" fill="#5a6a80">Virola 1</text>
        <polygon points="130,42 250,12 370,42" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <ellipse cx="250" cy="238" rx="120" ry="10" fill="#c8d8f0" stroke="#1a6fc4" stroke-width="1.5"/>
        <text x="${W/2}" y="268" text-anchor="middle" font-size="12" fill="#5a6a80">${Utils.escHtml(eq?.tag||'Tanque')} – Virolas del Manto (API 650 / 653)</text>`;
    } else {
      shapes = `<rect x="140" y="75" width="220" height="130" rx="8" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <text x="${W/2}" y="145" text-anchor="middle" font-size="13" fill="#1a6fc4">${Utils.escHtml(eq?.tag||doc.titulo)}</text>`;
    }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;display:block;margin:0 auto">${shapes}</svg>`;
  }

  function _buildPinOverlay(pins) {
    return pins.map(p => `
      <div class="cml-pin" data-cml="${p.cml_id}"
        style="position:absolute;left:${p.x ?? 50}%;top:${p.y ?? 50}%;transform:translate(-50%,-50%);
        padding:2px 7px;border-radius:999px;background:${p.color};border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;font-size:.66rem;font-weight:800;color:#fff;white-space:nowrap"
        title="${Utils.escHtml(p.cml?.nombre || p.cml_id)} (${p.x}%, ${p.y}%)">
        ${Utils.escHtml(p.cml?.nombre || p.cml_id)}
      </div>`).join('');
  }

  function openAddPinModal(docId, cmls, existingPins, defX = 50, defY = 50) {
    const cmlOpts = cmls.map(c => `<option value="${c.id}">${Utils.escHtml(c.nombre)} – ${Utils.escHtml(c.componente || c.descripcion || '')}</option>`).join('');
    Utils.openModal('📍 Posicionar Marcador CML/TML', `
      <form id="pin-form">
        <div class="form-group">
          <label>CML a posicionar<span class="required">*</span></label>
          <select class="form-control" id="pin_cml">${cmlOpts}</select>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Coordenada X (%)<span class="required">*</span></label>
            <input type="number" class="form-control" id="pin_x" value="${defX}" min="0" max="100" step="1">
          </div>
          <div class="form-group">
            <label>Coordenada Y (%)<span class="required">*</span></label>
            <input type="number" class="form-control" id="pin_y" value="${defY}" min="0" max="100" step="1">
          </div>
        </div>
      </form>`, {
      size: 'modal-sm',
      footerHtml: `<button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
                   <button class="btn btn-primary" id="pin-saveBtn">📍 Guardar Marcador</button>`
    });

    setTimeout(() => {
      document.getElementById('pin-saveBtn')?.addEventListener('click', () => {
        const cmlId = document.getElementById('pin_cml')?.value;
        const x = Utils.clamp(parseFloat(document.getElementById('pin_x')?.value), 0, 100);
        const y = Utils.clamp(parseFloat(document.getElementById('pin_y')?.value), 0, 100);
        if (!cmlId || isNaN(x) || isNaN(y)) { Utils.toast('Requerido', 'Seleccione CML e ingrese X/Y.', 'error'); return; }
        const newPins = [...existingPins.filter(p => p.cml_id !== cmlId), { cml_id: cmlId, x, y }];
        DB.update('isometricos', docId, { cml_pins: newPins });
        Utils.toast('Marcador guardado', `CML ubicado en (${x}%, ${y}%).`, 'success');
        Utils.closeModal();
        activeDocId = docId;
        _renderDocList();
        _openViewer(docId);
      });
    }, 50);
  }

  function openDocForm(docId) {
    const doc = docId ? DB.getById('isometricos', docId) : null;
    const title = doc ? `✏️ Editar Documento – ${doc.titulo}` : '＋ Nuevo Esquema / Documento';
    const eqOpts = DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
      .map(e => `<option value="${e.id}" ${(doc?.equipo_id===e.id||(!doc&&selectedEquipoId===e.id))?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`).join('');
    const v = (f, d = '') => Utils.escHtml(doc ? (doc[f] ?? d) : d);
    const sel = (f, val) => doc?.[f] === val ? 'selected' : '';

    let pendingImgData = doc?.image_data || null;
    let pendingPdfData = doc?.pdf_data || null;
    let pendingPdfName = doc?.pdf_name || '';

    Utils.openModal(title, `
      <form id="iso-form">
        <div class="form-row cols-2">
          <div class="form-group"><label>Equipo asociado<span class="required">*</span></label><select class="form-control" id="df_eq">${eqOpts}</select></div>
          <div class="form-group"><label>Tipo de documento<span class="required">*</span></label>
            <select class="form-control" id="df_tipo">
              ${['Isométrico','Plano Mecánico','Fotografía','Datasheet','P&ID','Procedimiento','Informe'].map(t=>`<option ${sel('tipo',t)}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group"><label>Título<span class="required">*</span></label><input class="form-control" id="df_titulo" value="${v('titulo')}" placeholder="p.ej. Isométrico Línea P-201A"></div>
        <div class="form-row cols-3">
          <div class="form-group"><label>N° Documento</label><input class="form-control" id="df_num" value="${v('numero')}" placeholder="ISO-P201A-001"></div>
          <div class="form-group"><label>Revisión</label><input class="form-control" id="df_rev" value="${v('revision','A')}"></div>
          <div class="form-group"><label>Fecha</label><input type="date" class="form-control" id="df_fecha" value="${v('fecha', Utils.today())}"></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Subir imagen esquema / foto (PNG o JPG)</label>
            <input type="file" class="form-control" id="df_imgFile" accept="image/png,image/jpeg">
            <div class="form-hint" id="df_imgStatus">${pendingImgData ? '✅ Imagen cargada (se conservará al guardar).' : 'Opcional: si se omite se usa esquema SVG de la familia.'}</div>
          </div>
          <div class="form-group">
            <label>Adjuntar PDF para consulta (Opcional)</label>
            <input type="file" class="form-control" id="df_pdfFile" accept="application/pdf">
            <div class="form-hint" id="df_pdfStatus">${pendingPdfData ? `✅ PDF adjunto: ${Utils.escHtml(pendingPdfName)}` : 'Recomendado < 1.5 MB para respaldo en localStorage/JSON.'}</div>
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label>Autor / Emisor</label><input class="form-control" id="df_autor" value="${v('autor')}"></div>
          <div class="form-group"><label>URL externa (opcional)</label><input class="form-control" id="df_url" type="url" value="${v('url_externa')}" placeholder="https://…"></div>
        </div>
        <div class="form-group"><label>Descripción / Notas</label><textarea class="form-control" id="df_desc" rows="2">${v('descripcion')}</textarea></div>
      </form>`, {
      size: 'modal-lg',
      footerHtml: `<button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
                   <button class="btn btn-primary" id="iso-saveDocBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      document.getElementById('df_imgFile')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          pendingImgData = reader.result;
          document.getElementById('df_imgStatus').textContent = `✅ Imagen lista: ${file.name} (${(file.size/1024).toFixed(0)} KB)`;
        };
        reader.readAsDataURL(file);
      });

      document.getElementById('df_pdfFile')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2.5 * 1024 * 1024) {
          Utils.toast('PDF muy grande', 'Para almacenamiento local se recomienda PDFs menores a 2.5 MB.', 'warning');
        }
        const reader = new FileReader();
        reader.onload = () => {
          pendingPdfData = reader.result;
          pendingPdfName = file.name;
          document.getElementById('df_pdfStatus').textContent = `✅ PDF listo: ${file.name} (${(file.size/1024).toFixed(0)} KB)`;
        };
        reader.readAsDataURL(file);
      });

      document.getElementById('iso-saveDocBtn')?.addEventListener('click', () => {
        const titulo = document.getElementById('df_titulo')?.value?.trim();
        const eq_id  = document.getElementById('df_eq')?.value;
        if (!titulo || !eq_id) { Utils.toast('Requerido', 'Complete equipo y título.', 'error'); return; }
        const data = {
          equipo_id:   eq_id,
          tipo:        document.getElementById('df_tipo')?.value,
          titulo,
          numero:      document.getElementById('df_num')?.value?.trim() || '',
          revision:    document.getElementById('df_rev')?.value?.trim() || 'A',
          fecha:       document.getElementById('df_fecha')?.value || Utils.today(),
          autor:       document.getElementById('df_autor')?.value?.trim() || '',
          estado_doc:  'Vigente',
          url_externa: document.getElementById('df_url')?.value?.trim() || '',
          descripcion: document.getElementById('df_desc')?.value?.trim() || '',
          image_data:  pendingImgData,
          pdf_data:    pendingPdfData,
          pdf_name:    pendingPdfName,
          cml_pins:    doc?.cml_pins || [],
        };
        try {
          if (docId) { DB.update('isometricos', docId, data); activeDocId = docId; Utils.toast('Actualizado', 'Documento actualizado.', 'success'); }
          else { const rec = DB.insert('isometricos', data); activeDocId = rec.id; Utils.toast('Guardado', 'Documento registrado.', 'success'); }
          Utils.closeModal();
          selectedEquipoId = data.equipo_id;
          render();
        } catch (err) {
          Utils.toast('Error de almacenamiento', 'El archivo adjunto excede la cuota de localStorage. Pruebe con una imagen/PDF más liviano.', 'error');
        }
      });
    }, 50);
  }

  function deleteDoc(docId) {
    const doc = DB.getById('isometricos', docId);
    if (!doc) return;
    Utils.confirm(`¿Eliminar documento "${doc.titulo}"?`, () => {
      DB.remove('isometricos', docId);
      if (activeDocId === docId) activeDocId = null;
      Utils.toast('Eliminado', 'Documento eliminado.', 'warning');
      render();
    });
  }

  function _bindEvents(el) {
    el.querySelector('#iso-newBtn').addEventListener('click', () => openDocForm(null));
    el.querySelector('#iso-eqSel').addEventListener('change', e => {
      selectedEquipoId = e.target.value || null;
      activeDocId = null;
      render();
    });
    const deb = Utils.debounce(() => _renderDocList());
    el.querySelector('#iso-search').addEventListener('input', e => { searchTerm = e.target.value; deb(); });
    el.querySelector('#iso-exportBtn').addEventListener('click', () => {
      const all = DB.getAll('isometricos');
      const headers = ['ID','Equipo_TAG','Tipo','Título','Número','Revisión','Fecha','Adjunto','Marcadores_CML'];
      const rows = all.map(d => {
        const eq = DB.getById('equipos', d.equipo_id);
        return [d.id, eq?.tag||'', d.tipo, d.titulo, d.numero, d.revision, d.fecha,
          d.image_data ? 'Imagen' : d.pdf_data ? 'PDF' : 'SVG', (d.cml_pins||[]).length];
      });
      Utils.exportCSV(headers, rows, `documentacion_tecnica_${Utils.today()}.csv`);
    });
  }

  return { render, openNewDocument: () => openDocForm(null) };
})();
