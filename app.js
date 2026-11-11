/* Karim Daily — los datos viven en una hoja de Google Sheets de tu Google Drive.
   En este equipo solo se guarda la configuración (enlace, clave y tu nombre), nunca los registros. */
'use strict';

/* ---------- utilidades ---------- */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PORCIONES = [[0.25, '¼'], [0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2+']];
const HIZO = ['Pipí', 'Popó', 'Pipí y Popó'];

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dos = n => String(n).padStart(2, '0');
const claveDia = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const hora = d => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
const textoFecha = d => `${claveDia(d)} ${hora(d)}`;
const leerFecha = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d; };
const diaCorto = d => `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
const ico = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

function fraccion(v) {
  const e = Math.floor(v + 1e-9), f = Math.round((v - e) * 4);
  return ((e ? String(e) : '') + (['', '¼', '½', '¾'][f] || '')) || '0';
}
const porcionTxt = v => `${fraccion(v)} ${v > 1 ? 'porciones' : 'porción'}`;
function hace(d) {
  const m = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h${h < 6 && m % 60 ? ` ${m % 60} min` : ''}`;
  const dd = Math.floor(h / 24);
  return dd === 1 ? 'ayer' : `hace ${dd} días`;
}
function iconosHizo(h) {
  if (h === 'Pipí') return ico('i-drop');
  if (h === 'Popó') return ico('i-poop');
  return ico('i-drop') + ico('i-poop');
}

/* ---------- configuración del dispositivo (no son datos de Karim) ---------- */
const CFG_KEY = 'karim-daily-config';
function leerConfig() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; } }
function guardarConfig(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} }
let CFG = leerConfig();

// Enlace para configurar un teléfono de una vez: ...?api=URL&clave=CLAVE
(function configDesdeEnlace() {
  const p = new URLSearchParams(location.search);
  if (p.get('api') && p.get('clave')) {
    CFG = { ...CFG, api: p.get('api'), clave: p.get('clave') };
    guardarConfig(CFG);
    history.replaceState(null, '', location.pathname);
  }
})();
const DEMO = new URLSearchParams(location.search).has('demo');

/* ---------- estado (solo en memoria) ---------- */
const E = {
  pestana: 'inicio',
  registros: [],
  perfil: {},
  cargado: false,
  error: '',
  ocupado: false,
  fotos: {},     // imágenes ya descargadas de Drive (solo en memoria)
  fotoIds: {},   // id de Drive de cada imagen descargada
  mes: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
};

function normalizar(r) {
  const fecha = leerFecha(r.fecha);
  if (!fecha) return null;
  const tipo = r.tipo === 'Paseo' ? 'Paseo' : 'Comida';
  return {
    id: String(r.id || ''), tipo, fecha,
    porcion: Math.max(0, Number(r.porcion) || 0),
    hizo: HIZO.includes(r.hizo) ? r.hizo : 'Pipí y Popó',
    nota: String(r.nota || '').slice(0, 280),
    quien: String(r.quien || '').slice(0, 40),
  };
}
function aplicar(respuesta) {
  E.registros = (respuesta.registros || []).map(normalizar).filter(Boolean).sort((a, b) => b.fecha - a.fecha);
  E.perfil = respuesta.perfil || {};
  E.cargado = true; E.error = '';
  cargarFotos();
}

/* Fotos de Karim guardadas en Drive: "foto" (perfil) y "fotoInicio" (portada) */
const FOTOS = { foto: 'img/karim-perfil.jpg', fotoInicio: 'img/karim-inicio.jpg' };
const fotoDe = cual => E.fotos[cual] || FOTOS[cual];
async function cargarFotos() {
  for (const cual of Object.keys(FOTOS)) {
    const id = E.perfil[cual] || '';
    if (id === (E.fotoIds[cual] || '')) continue;
    E.fotoIds[cual] = id;
    if (!id) { delete E.fotos[cual]; pintar(); continue; }
    try {
      const r = await api('verFoto', { id });
      if (E.fotoIds[cual] === id && r.data) { E.fotos[cual] = r.data; pintar(); }
    } catch (e) { E.fotoIds[cual] = ''; }
  }
}

/* Achica la foto en el teléfono antes de subirla (máx. 1000 px, JPG) */
function prepararFoto(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const max = 1000, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('imagen')); };
    img.src = url;
  });
}
const meta = () => { const m = Number(E.perfil.metaComidas); return m > 0 && m < 10 ? m : 2; };

/* ---------- conexión con Google Drive (Apps Script) ---------- */
const demoDatos = (() => {
  const h = new Date(), f = (dd, hh, mm) => textoFecha(new Date(h.getFullYear(), h.getMonth(), h.getDate() - dd, hh, mm));
  return {
    perfil: { nombre: 'Karim', raza: 'Chihuahua', nacimiento: '2016-01-22', peso: '2.8', metaComidas: '2', notas: 'Nuestro pequeño gran amigo ❤️' },
    registros: [
      { id: 'd1', tipo: 'Comida', porcion: 0.5, fecha: f(0, 7, 30), quien: 'Ejemplo' },
      { id: 'd2', tipo: 'Paseo', hizo: 'Pipí y Popó', fecha: f(0, 8, 15), nota: 'Paseo corto', quien: 'Ejemplo' },
      { id: 'd3', tipo: 'Paseo', hizo: 'Pipí', fecha: f(1, 19, 20), quien: 'Ejemplo' },
      { id: 'd4', tipo: 'Comida', porcion: 1, fecha: f(2, 8, 0), quien: 'Ejemplo' },
    ],
  };
})();

const demoFotos = {};
async function api(accion, datos) {
  if (DEMO) {
    await new Promise(r => setTimeout(r, 150));
    if (accion === 'guardar') { demoDatos.registros = demoDatos.registros.filter(r => r.id !== datos.id); demoDatos.registros.push(datos); }
    if (accion === 'borrar') demoDatos.registros = demoDatos.registros.filter(r => r.id !== datos.id);
    if (accion === 'perfil') demoDatos.perfil = { ...demoDatos.perfil, ...datos };
    if (accion === 'foto') { const id = 'demo-' + Date.now(); demoFotos[id] = datos.data; demoDatos.perfil = { ...demoDatos.perfil, [datos.cual]: id }; }
    if (accion === 'verFoto') return { ok: true, data: demoFotos[datos.id] };
    return JSON.parse(JSON.stringify({ ok: true, ...demoDatos }));
  }
  if (!CFG.api || !CFG.clave) throw new Error('sin-config');
  let res;
  if (accion === 'leer' || accion === 'verFoto') {
    const u = new URL(CFG.api);
    u.searchParams.set('accion', accion); u.searchParams.set('clave', CFG.clave); u.searchParams.set('t', Date.now());
    if (datos && datos.id) u.searchParams.set('id', datos.id);
    res = await fetch(u.toString(), { redirect: 'follow' });
  } else {
    // texto plano para que Google lo acepte sin verificación previa del navegador
    res = await fetch(CFG.api, { method: 'POST', redirect: 'follow', body: JSON.stringify({ clave: CFG.clave, accion, datos }) });
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'error');
  return json;
}

async function cargar(silencioso) {
  if (!DEMO && (!CFG.api || !CFG.clave)) { E.cargado = true; E.error = 'sin-config'; pintar(); return; }
  try { aplicar(await api('leer')); }
  catch (e) { E.cargado = true; E.error = e.message === 'clave' ? 'clave' : 'conexion'; if (!silencioso) avisar('No se pudo leer Google Drive'); }
  pintar();
}

async function escribir(accion, datos, mensaje) {
  try {
    aplicar(await api(accion, datos));
    pintar(); avisar(mensaje);
    return true;
  } catch (e) {
    avisar(e.message === 'clave' ? 'La clave de la casa no coincide' : e.message === 'sin-config' ? 'Primero conecta la app con Google Drive' : 'No se pudo guardar. Revisa tu conexión.');
    return false;
  }
}

/* ---------- cálculos ---------- */
function deHoy() {
  const k = claveDia(new Date());
  const hoy = E.registros.filter(r => claveDia(r.fecha) === k);
  const comidas = hoy.filter(r => r.tipo === 'Comida');
  return {
    porciones: comidas.reduce((s, r) => s + r.porcion, 0),
    paseos: hoy.filter(r => r.tipo === 'Paseo').length,
    ultimaComida: E.registros.find(r => r.tipo === 'Comida'),
    ultimoPaseo: E.registros.find(r => r.tipo === 'Paseo'),
  };
}
function agruparPorDia(lista) {
  const m = new Map();
  lista.forEach(r => { const k = claveDia(r.fecha); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return [...m.values()];
}

/* ---------- vistas ---------- */
function barra(titulo, icono, marca) {
  return `<header class="barra">
    <button class="barra-btn" data-menu aria-label="Abrir menú">${ico('i-menu')}</button>
    <h1 class="barra-titulo${marca ? ' marca' : ''}">${icono ? ico(icono) : ''}${titulo}</h1>
    ${marca ? `<button class="barra-btn" data-config aria-label="Configuración">${ico('i-gear')}</button>` : '<span class="barra-btn"></span>'}
  </header>`;
}
function notaEstado() {
  if (DEMO) return `<div class="nota-estado">${ico('i-paw')}<span>Modo de prueba: estos registros son de ejemplo y no se guardan.</span></div>`;
  if (E.error === 'sin-config') return `<div class="nota-estado">${ico('i-gear')}<span>Falta conectar la app con tu Google Drive. <button data-config>Conectar ahora</button></span></div>`;
  if (E.error === 'clave') return `<div class="nota-estado">${ico('i-gear')}<span>La clave de la casa no coincide con la de Google. <button data-config>Revisar</button></span></div>`;
  if (E.error === 'conexion') return `<div class="nota-estado">${ico('i-sync')}<span>No se pudo conectar con Google Drive. <button data-recargar>Reintentar</button></span></div>`;
  if (!E.cargado) return `<div class="cargando">Cargando desde Google Drive…</div>`;
  return '';
}
const sinDatos = () => !DEMO && E.error === 'sin-config';

function vistaInicio() {
  const h = deHoy(), hoy = new Date();
  return `${barra('Karim Daily', 'i-paw', true)}
  <div class="hero"><img src="${fotoDe('fotoInicio')}" alt="Foto de ${esc(E.perfil.nombre || 'Karim')}" class="${E.fotos.fotoInicio ? 'personal' : ''}"><div class="hola" aria-hidden="true">Hola,<br>Karim!${ico('i-heart')}</div></div>
  <section class="resumen">
    <div class="resumen-cab"><h2 class="titulo-sec">${ico('i-cal')}Resumen de hoy</h2><span class="chip-fecha">${ico('i-clock')}${diaCorto(hoy)}</span></div>
    ${notaEstado()}
    <div class="tarjetas">
      <div class="tarjeta comida"><svg class="ico"><use href="#i-food"/></svg><h2>Comidas</h2>
        <div class="grande num">${fraccion(h.porciones)} / ${fraccion(meta())}</div><div class="unidad">porciones</div>
        <div class="ultima">${h.ultimaComida ? 'Última ' + hace(h.ultimaComida.fecha) : '&nbsp;'}</div></div>
      <div class="tarjeta paseo"><svg class="ico"><use href="#i-paw"/></svg><h2>Paseos</h2>
        <div class="grande num">${h.paseos}</div><div class="unidad">${h.paseos === 1 ? 'salida' : 'salidas'}</div>
        <div class="ultima">${h.ultimoPaseo ? 'Última ' + hace(h.ultimoPaseo.fecha) : '&nbsp;'}</div></div>
    </div>
    <h2 class="titulo-sec">¿Qué quieres registrar?</h2>
    <div class="botones">
      <button class="btn-grande comida" data-nuevo="Comida" ${sinDatos() ? 'disabled' : ''}>${ico('i-food')}<span>Registrar<br>comida</span></button>
      <button class="btn-grande paseo" data-nuevo="Paseo" ${sinDatos() ? 'disabled' : ''}>${ico('i-paw')}<span>Registrar<br>paseo</span></button>
    </div>
  </section>`;
}

function filaHTML(r) {
  const texto = r.tipo === 'Comida' ? `${fraccion(r.porcion)} ${r.porcion > 1 ? 'porciones' : 'porción'} · ${hora(r.fecha)}` : `${r.hizo} · ${hora(r.fecha)}`;
  const extra = [r.nota, r.quien && `por ${r.quien}`].filter(Boolean).map(esc).join(' · ');
  return `<button class="fila" data-editar="${esc(r.id)}">
    <span class="punto ${r.tipo === 'Comida' ? 'comida' : 'paseo'}">${ico(r.tipo === 'Comida' ? 'i-food' : 'i-paw')}</span>
    <span class="fila-txt num">${texto}${extra ? `<small>${extra}</small>` : ''}</span>${ico('i-right')}</button>`;
}
function listaDias(lista, vacioTitulo, vacioTexto) {
  if (!lista.length) return `<div class="vacio">${ico('i-paw')}<b>${vacioTitulo}</b><span>${vacioTexto}</span></div>`;
  return `<div class="dias">${agruparPorDia(lista).map(rs => `<div class="dia"><h3>${claveDia(rs[0].fecha) === claveDia(new Date()) ? 'Hoy, ' + rs[0].fecha.getDate() + ' ' + MESES[rs[0].fecha.getMonth()] : diaCorto(rs[0].fecha)}</h3>${rs.map(filaHTML).join('')}</div>`).join('')}</div>`;
}
function selectorMes() {
  const y = E.mes.getFullYear(), m = E.mes.getMonth(), n = new Date();
  const actual = y === n.getFullYear() && m === n.getMonth();
  return `<div class="mes"><button data-mes="-1" aria-label="Mes anterior">${ico('i-left')}</button><b>${MESES_L[m]} ${y}</b><button data-mes="1" aria-label="Mes siguiente" ${actual ? 'disabled' : ''}>${ico('i-right')}</button></div>`;
}
function delMes(lista) {
  const y = E.mes.getFullYear(), m = E.mes.getMonth();
  return lista.filter(r => r.fecha.getFullYear() === y && r.fecha.getMonth() === m);
}
function vistaHistorial() {
  return `${barra('Historial', 'i-cal')}<div class="contenido">${notaEstado()}${selectorMes()}
    ${listaDias(delMes(E.registros), 'Sin registros este mes', 'Aquí aparecerán las comidas y salidas de Karim.')}</div>`;
}
function vistaTipo(tipo) {
  const comida = tipo === 'Comida';
  return `${barra(comida ? 'Comidas' : 'Paseos', comida ? 'i-food' : 'i-paw')}<div class="contenido">${notaEstado()}
    <button class="btn-grande ${comida ? 'comida' : 'paseo'}" data-nuevo="${tipo}" ${sinDatos() ? 'disabled' : ''}>${ico(comida ? 'i-food' : 'i-paw')}<span>Registrar ${comida ? 'comida' : 'paseo'}</span></button>
    ${selectorMes()}
    ${listaDias(delMes(E.registros.filter(r => r.tipo === tipo)), comida ? 'Sin comidas este mes' : 'Sin paseos este mes', comida ? 'Cada comida que registres aparecerá aquí.' : 'Cada salida que registres aparecerá aquí.')}</div>`;
}
function edad(iso) {
  const b = leerFecha(iso + ' 12:00'); if (!b) return '';
  const n = new Date(); let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 ? `${a} ${a === 1 ? 'año' : 'años'}` : '';
}
function fechaLarga(iso) { const d = leerFecha(iso + ' 12:00'); return d ? `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}` : '—'; }
function vistaKarim() {
  const p = E.perfil, nombre = p.nombre || 'Karim';
  return `${barra(esc(nombre), 'i-paw')}
  ${notaEstado() ? `<div class="contenido" style="padding-bottom:0">${notaEstado()}</div>` : ''}
  <div class="perfil">
    <div class="foto-perfil"><div class="foto${E.fotos.foto ? ' personal' : ''}" role="img" aria-label="Foto de ${esc(nombre)}" style="background-image:url('${fotoDe('foto')}')"></div><button data-perfil aria-label="Editar foto y datos de ${esc(nombre)}" ${sinDatos() ? 'disabled' : ''}>${ico('i-pencil')}</button></div>
    <h2>${esc(nombre)} ${ico('i-heart')}</h2>
  </div>
  <div class="datos">
    <div class="dato">${ico('i-paw')}<span>Raza</span><b>${esc(p.raza || '—')}</b></div>
    <div class="dato">${ico('i-cal')}<span>Fecha de nacimiento</span><b class="num">${p.nacimiento ? fechaLarga(p.nacimiento) : '—'}</b></div>
    <div class="dato">${ico('i-cake')}<span>Edad</span><b>${p.nacimiento ? edad(p.nacimiento) : '—'}</b></div>
    <div class="dato">${ico('i-scale')}<span>Peso</span><b class="num">${p.peso ? esc(String(p.peso).replace('.', ',')) + ' kg' : '—'}</b></div>
    <div class="dato">${ico('i-bowl')}<span>Comidas al día</span><b class="num">${porcionTxt(meta())}</b></div>
    <div class="dato notas">${ico('i-note')}<div><span>Notas</span><b>${esc(p.notas || '—')}</b></div></div>
  </div>
  <div style="height:22px"></div>`;
}

function pintar() {
  const v = { inicio: vistaInicio, comidas: () => vistaTipo('Comida'), paseos: () => vistaTipo('Paseo'), historial: vistaHistorial, karim: vistaKarim }[E.pestana];
  $('#vista').innerHTML = v();
  document.querySelectorAll('.tab').forEach(b => b.dataset.tab === E.pestana ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
}

/* ---------- pantallas superpuestas ---------- */
let volverA = null;
function abrir(titulo, html, montar) {
  volverA = document.activeElement;
  $('#pantallaTitulo').textContent = titulo;
  $('#pantallaCuerpo').innerHTML = html;
  $('#pantalla').hidden = false;
  document.body.style.overflow = 'hidden';
  montar && montar($('#pantallaCuerpo'));
  setTimeout(() => $('#pantalla .barra-btn').focus(), 30);
}
function cerrar() {
  $('#pantalla').hidden = true; $('#pantallaCuerpo').innerHTML = ''; document.body.style.overflow = '';
  volverA && volverA.focus && volverA.focus();
}
function campoHora(etiqueta, fecha, compacto) {
  if (compacto) return `<label class="campo compacto">${ico('i-clock')}<span>${etiqueta}</span><input id="f-hora" type="time" value="${hora(fecha)}" required>${ico('i-right').replace('<svg', '<svg class="chev"')}</label>`;
  return `<label class="campo grande">${ico('i-clock')}<span class="campo-etq"><small>${etiqueta}</small><input id="f-hora" type="time" value="${hora(fecha)}" required></span><span></span>${ico('i-right').replace('<svg', '<svg class="chev"')}</label>`;
}
function fechaElegida(cuerpo, base) {
  const [hh, mm] = ($('#f-hora', cuerpo).value || hora(base)).split(':').map(Number);
  const d = new Date(base); d.setHours(hh, mm, 0, 0);
  return d;
}
function pieFormulario(reg) {
  return `<div class="empuje"></div>
    <button class="btn-guardar" id="f-guardar">Guardar</button>
    ${reg ? `${reg.quien ? `<div class="quien">Registrado por ${esc(reg.quien)}</div>` : ''}<button class="btn-eliminar" id="f-eliminar">Eliminar registro</button>` : ''}
    <button class="btn-cancelar" data-cerrar>Cancelar</button>`;
}
function conectarEliminar(cuerpo, reg) {
  const b = $('#f-eliminar', cuerpo); if (!b) return;
  let armado = false, t;
  b.addEventListener('click', async () => {
    if (!armado) {
      armado = true; b.classList.add('armado'); b.textContent = 'Toca otra vez para eliminar';
      t = setTimeout(() => { armado = false; b.classList.remove('armado'); b.textContent = 'Eliminar registro'; }, 4000);
      return;
    }
    clearTimeout(t); b.disabled = true;
    if (await escribir('borrar', { id: reg.id }, 'Registro eliminado')) cerrar(); else b.disabled = false;
  });
}
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function formComida(reg) {
  const base = reg ? reg.fecha : new Date();
  let porcion = reg ? reg.porcion : 1;
  const opciones = PORCIONES.some(p => p[0] === porcion) ? PORCIONES : PORCIONES.concat([[porcion, fraccion(porcion)]]);
  abrir(reg ? 'Editar comida' : 'Registrar comida', `
    <svg class="huella"><use href="#i-paw"/></svg>
    <div class="pregunta"><div class="burbuja comida">${ico('i-food')}</div><h2>¿Cuánto comió ${esc(E.perfil.nombre || 'Karim')}?</h2></div>
    <div class="porciones" role="group" aria-label="Porciones" style="grid-template-columns:repeat(${opciones.length},1fr)">
      ${opciones.map(([v, l]) => `<button type="button" data-p="${v}" aria-pressed="${v === porcion}">${l}</button>`).join('')}</div>
    ${campoHora('Hora', base)}
    ${reg ? `<div class="ayuda">Día: ${diaCorto(base)}</div>` : ''}
    ${pieFormulario(reg)}`, c => {
    c.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
      porcion = Number(b.dataset.p); c.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', x === b));
    }));
    $('#f-guardar', c).addEventListener('click', async ev => {
      ev.currentTarget.disabled = true;
      const datos = { id: reg ? reg.id : nuevoId(), tipo: 'Comida', porcion, fecha: textoFecha(fechaElegida(c, base)), nota: reg ? reg.nota : '', quien: reg ? reg.quien : (CFG.nombre || '') };
      if (await escribir('guardar', datos, reg ? 'Comida actualizada' : `Anotado: ${porcionTxt(porcion)}`)) cerrar(); else ev.target.disabled = false;
    });
    conectarEliminar(c, reg);
  });
}
function formPaseo(reg) {
  const base = reg ? reg.fecha : new Date();
  let hizo = reg ? reg.hizo : 'Pipí y Popó';
  abrir(reg ? 'Editar paseo' : 'Registrar paseo', `
    <svg class="huella"><use href="#i-paw"/></svg>
    <div class="pregunta"><div class="burbuja paseo">${ico('i-paw')}</div><h2>¿Qué hizo ${esc(E.perfil.nombre || 'Karim')}?</h2></div>
    <div class="opciones" role="group" aria-label="Qué hizo">
      ${HIZO.map(h => `<button type="button" class="opcion" data-h="${h}" aria-pressed="${h === hizo}"><span class="circulo${h === 'Pipí y Popó' ? ' doble' : ''}">${iconosHizo(h)}</span>${h === 'Pipí y Popó' ? 'Pipí y<br>Popó' : h}</button>`).join('')}</div>
    ${campoHora('Hora de salida', base, true)}
    ${reg ? `<div class="ayuda">Día: ${diaCorto(base)}</div>` : ''}
    <div class="area">${ico('i-chat')}<label for="f-nota">Observaciones (opcional)</label><textarea id="f-nota" maxlength="280" rows="2" placeholder="Ej. Paseo corto…">${reg ? esc(reg.nota) : ''}</textarea></div>
    ${pieFormulario(reg)}`, c => {
    c.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => {
      hizo = b.dataset.h; c.querySelectorAll('[data-h]').forEach(x => x.setAttribute('aria-pressed', x === b));
    }));
    $('#f-guardar', c).addEventListener('click', async ev => {
      ev.currentTarget.disabled = true;
      const datos = { id: reg ? reg.id : nuevoId(), tipo: 'Paseo', hizo, fecha: textoFecha(fechaElegida(c, base)), nota: $('#f-nota', c).value.trim(), quien: reg ? reg.quien : (CFG.nombre || '') };
      if (await escribir('guardar', datos, reg ? 'Paseo actualizado' : `Anotado: ${hizo.toLowerCase()}`)) cerrar(); else ev.target.disabled = false;
    });
    conectarEliminar(c, reg);
  });
}
function formPerfil() {
  const p = E.perfil;
  const tarjetaFoto = (cual, titulo, clase) => `
    <div class="cambiar-foto">
      <div class="miniatura ${clase}${E.fotos[cual] ? ' personal' : ''}" id="m-${cual}" style="background-image:url('${fotoDe(cual)}')"></div>
      <div class="cambiar-foto-txt"><b>${titulo}</b><span id="e-${cual}">Toca para elegir otra</span></div>
      <label class="btn-foto">Cambiar<input type="file" accept="image/*" data-subir="${cual}" hidden></label>
    </div>`;
  abrir('Editar perfil', `
    ${tarjetaFoto('foto', 'Foto de perfil', 'redonda')}
    ${tarjetaFoto('fotoInicio', 'Foto de inicio', 'ancha')}
    <div class="texto-campo"><label for="p-nombre">Nombre</label><input id="p-nombre" maxlength="40" value="${esc(p.nombre || 'Karim')}"></div>
    <div class="texto-campo"><label for="p-raza">Raza</label><input id="p-raza" maxlength="60" value="${esc(p.raza || '')}"></div>
    <div class="dos">
      <div class="texto-campo"><label for="p-nac">Fecha de nacimiento</label><input id="p-nac" type="date" value="${esc(p.nacimiento || '')}"></div>
      <div class="texto-campo"><label for="p-peso">Peso (kg)</label><input id="p-peso" inputmode="decimal" maxlength="6" value="${esc(String(p.peso || '').replace('.', ','))}"></div>
    </div>
    <div class="texto-campo"><label for="p-meta">Porciones al día</label><select id="p-meta">${[1, 1.5, 2, 2.5, 3, 4].map(v => `<option value="${v}" ${v === meta() ? 'selected' : ''}>${porcionTxt(v)}</option>`).join('')}</select></div>
    <div class="texto-campo"><label for="p-notas">Notas</label><textarea id="p-notas" maxlength="280">${esc(p.notas || '')}</textarea></div>
    <div class="empuje"></div>
    <button class="btn-guardar" id="p-guardar">Guardar</button>
    <button class="btn-cancelar" data-cerrar>Cancelar</button>`, c => {
    c.querySelectorAll('[data-subir]').forEach(inp => inp.addEventListener('change', async () => {
      const archivo = inp.files && inp.files[0]; inp.value = '';
      if (!archivo) return;
      const cual = inp.dataset.subir, estado = $('#e-' + cual, c), boton = inp.parentElement;
      boton.classList.add('ocupado'); estado.textContent = 'Subiendo a Google Drive…';
      try {
        const data = await prepararFoto(archivo);
        const r = await api('foto', { cual, data });
        E.fotos[cual] = data; E.fotoIds[cual] = (r.perfil || {})[cual] || '';
        aplicar(r); pintar();
        const m = $('#m-' + cual, c); m.style.backgroundImage = `url('${data}')`; m.classList.add('personal');
        estado.textContent = 'Foto guardada'; avisar('Foto actualizada');
      } catch (e) {
        estado.textContent = e.message === 'imagen' ? 'No se pudo leer esa imagen. Prueba con otra.' : 'No se pudo subir. Revisa tu conexión.';
      }
      boton.classList.remove('ocupado');
    }));
    $('#p-guardar', c).addEventListener('click', async ev => {
      ev.currentTarget.disabled = true;
      const datos = { nombre: $('#p-nombre', c).value.trim() || 'Karim', raza: $('#p-raza', c).value.trim(), nacimiento: $('#p-nac', c).value,
        peso: $('#p-peso', c).value.trim().replace(',', '.'), metaComidas: $('#p-meta', c).value, notas: $('#p-notas', c).value.trim() };
      if (await escribir('perfil', datos, 'Perfil guardado')) cerrar(); else ev.target.disabled = false;
    });
  });
}
function formConfig() {
  // El enlace y la clave nunca se muestran: solo se pueden reemplazar.
  const conectado = !!(CFG.api && CFG.clave);
  abrir('Configuración', `
    <img src="img/logo.png" alt="Karim Daily — Cada día, con Karim" class="logo-config">
    <div class="texto-campo"><label for="c-nombre">Tu nombre (para saber quién registró)</label><input id="c-nombre" maxlength="40" value="${esc(CFG.nombre || '')}" placeholder="Ej. Mamá"></div>
    ${conectado ? `<div class="conexion" id="c-estado">${ico('i-check')}<span><b>Conectado a Google Drive</b><small>El enlace y la clave están guardados y ocultos.</small></span><button type="button" id="c-cambiar">Cambiar</button></div>` : ''}
    <div id="c-campos" ${conectado ? 'hidden' : ''} style="display:grid;gap:18px">
      <div class="texto-campo"><label for="c-api">Enlace de Google (termina en /exec)</label><input id="c-api" type="password" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec"></div>
      <div class="texto-campo"><label for="c-clave">Clave de la casa</label><input id="c-clave" type="password" autocomplete="off"></div>
    </div>
    <p class="ayuda">Los registros se guardan en la hoja “Karim Daily” de tu Google Drive. En este teléfono solo quedan tu nombre y la conexión.</p>
    <div class="empuje"></div>
    <button class="btn-guardar" id="c-guardar">${conectado ? 'Guardar' : 'Guardar y conectar'}</button>
    <button class="btn-cancelar" data-cerrar>Cancelar</button>`, c => {
    const cambiar = $('#c-cambiar', c);
    if (cambiar) cambiar.addEventListener('click', () => { $('#c-estado', c).hidden = true; $('#c-campos', c).hidden = false; $('#c-api', c).focus(); });
    $('#c-guardar', c).addEventListener('click', async ev => {
      const nuevaApi = $('#c-api', c).value.trim(), nuevaClave = $('#c-clave', c).value.trim();
      const reemplaza = !$('#c-campos', c).hidden;
      if (reemplaza && (!nuevaApi || !nuevaClave)) { avisar('Escribe el enlace y la clave'); return; }
      if (reemplaza && !/^https:\/\/script\.google(usercontent)?\.com\//.test(nuevaApi)) { avisar('El enlace debe empezar con https://script.google.com'); return; }
      const nombre = $('#c-nombre', c).value.trim();
      if (!reemplaza) {
        CFG = { ...CFG, nombre }; guardarConfig(CFG); cerrar(); avisar('Guardado'); return;
      }
      ev.currentTarget.disabled = true;
      CFG = { nombre, api: nuevaApi, clave: nuevaClave };
      guardarConfig(CFG);
      E.cargado = false; E.error = ''; pintar();
      await cargar();
      if (!E.error) { cerrar(); avisar('Conectado con Google Drive'); } else ev.target.disabled = false;
    });
  });
}

let avisoT;
function avisar(msg) {
  const a = $('#aviso'); a.innerHTML = ico('i-check') + '<span></span>'; a.querySelector('span').textContent = msg; a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 2600);
}

/* ---------- eventos ---------- */
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-tab],[data-ir],[data-nuevo],[data-editar],[data-mes],[data-cerrar],[data-perfil],[data-config],[data-menu],[data-menu-cerrar],[data-recargar]');
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.tab || d.ir) { E.pestana = d.tab || d.ir; $('#menu').hidden = true; pintar(); scrollTo(0, 0); }
  else if (d.nuevo) (d.nuevo === 'Comida' ? formComida : formPaseo)(null);
  else if (d.editar) { const r = E.registros.find(x => x.id === d.editar); if (r) (r.tipo === 'Comida' ? formComida : formPaseo)(r); }
  else if (d.mes) { E.mes = new Date(E.mes.getFullYear(), E.mes.getMonth() + Number(d.mes), 1); pintar(); }
  else if ('cerrar' in d) cerrar();
  else if ('perfil' in d) formPerfil();
  else if ('config' in d) { $('#menu').hidden = true; formConfig(); }
  else if ('menu' in d) $('#menu').hidden = false;
  else if ('menuCerrar' in d) $('#menu').hidden = true;
  else if ('recargar' in d) { $('#menu').hidden = true; E.cargado = false; E.error = ''; pintar(); cargar().then(() => { if (!E.error) avisar('Datos actualizados'); }); }
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (!$('#menu').hidden) $('#menu').hidden = true;
  else if (!$('#pantalla').hidden) cerrar();
});
// Traer lo que registró el resto de la casa: al volver a la app y cada 2 minutos
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('#pantalla').hidden) cargar(true); });
setInterval(() => { if (document.visibilityState === 'visible' && $('#pantalla').hidden) cargar(true); }, 120000);

pintar();
cargar(true).then(() => { if (!DEMO && E.error === 'sin-config') formConfig(); });
