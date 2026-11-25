/* Karim Daily — los datos viven en una hoja de Google Sheets de tu Google Drive.
   En este equipo solo se guarda la configuración (enlace, clave y tu nombre), nunca los registros. */
'use strict';

/* ---------- utilidades ---------- */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PORCIONES = [[0.25, '¼'], [0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2+']];
const HIZO = ['Pipí', 'Popó', 'Pipí y Popó'];

/* Cuidados: baño, uñas y vacunas */
const CUIDADOS = {
  'Baño': { ico: 'i-bath', clase: 'bano', corto: 'Baño', titulo: 'baño', nombre: 'Baño',
    pregunta: '¿Dónde fue el baño?', opciones: ['En casa', 'Peluquería', 'Veterinario'],
    proximo: 'Próximo baño', sugerencias: [[14, '2 semanas'], [30, '1 mes'], [60, '2 meses']] },
  'Uñas': { ico: 'i-nails', clase: 'unas', corto: 'Uñas', titulo: 'corte de uñas', nombre: 'Corte de uñas',
    pregunta: '¿Dónde le cortaron las uñas?', opciones: ['En casa', 'Peluquería', 'Veterinario'],
    proximo: 'Próximo corte', sugerencias: [[21, '3 semanas'], [30, '1 mes'], [45, '6 semanas']] },
  'Vacuna': { ico: 'i-syringe', clase: 'vacuna', corto: 'Vacuna', titulo: 'vacuna', nombre: 'Vacuna',
    pregunta: '¿Qué vacuna le pusieron?', nombres: ['Rabia', 'Séxtuple', 'Óctuple', 'Tos de las perreras', 'Leptospirosis'],
    proximo: 'Próximo refuerzo', sugerencias: [[30, '1 mes'], [180, '6 meses'], [365, '1 año']] },
};
const TIPOS = ['Comida', 'Paseo', ...Object.keys(CUIDADOS)];
const ICONO = { Comida: 'i-food', Paseo: 'i-paw', 'Baño': 'i-bath', 'Uñas': 'i-nails', Vacuna: 'i-syringe' };
const CLASE = { Comida: 'comida', Paseo: 'paseo', 'Baño': 'bano', 'Uñas': 'unas', Vacuna: 'vacuna' };

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dos = n => String(n).padStart(2, '0');
const claveDia = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const hora = d => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
const textoFecha = d => `${claveDia(d)} ${hora(d)}`;
const leerFecha = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d; };
const diaCorto = d => `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
const diaLista = d => diaCorto(d) + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
const ico = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const chev = () => ico('i-right').replace('<svg', '<svg class="chev"');
const diaDe = iso => leerFecha(String(iso || '').slice(0, 10) + ' 12:00');
const lim = (v, a, b) => Math.min(b, Math.max(a, v));

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
function diasHasta(iso) {
  const d = diaDe(iso); if (!d) return null;
  const h = new Date();
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 864e5);
}
function cuandoTxt(n) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
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
  const tipo = TIPOS.includes(r.tipo) ? r.tipo : 'Comida';
  const proxima = String(r.proxima || '').slice(0, 10);
  return {
    id: String(r.id || ''), tipo, fecha,
    porcion: Math.max(0, Number(r.porcion) || 0),
    hizo: HIZO.includes(r.hizo) ? r.hizo : 'Pipí y Popó',
    nota: String(r.nota || '').slice(0, 280),
    quien: String(r.quien || '').slice(0, 40),
    detalle: String(r.detalle || '').slice(0, 80),
    proxima: /^\d{4}-\d{2}-\d{2}$/.test(proxima) ? proxima : '',
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

/* Encuadre de la portada: "x,y,zoom" guardado en el perfil (x e y en %, zoom de 1 a 4) */
function ajustePortada() {
  const p = String(E.perfil.portadaAjuste || '').split(',').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  return { x: lim(p[0], 0, 100), y: lim(p[1], 0, 100), z: lim(p[2], 1, 4) };
}
const estiloAjuste = a => `width:100%;object-position:${a.x}% ${a.y}%;transform:scale(${a.z});transform-origin:${a.x}% ${a.y}%`;

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
  const enDias = n => claveDia(new Date(h.getFullYear(), h.getMonth(), h.getDate() + n));
  return {
    perfil: { nombre: 'Karim', raza: 'Chihuahua', nacimiento: '2016-01-22', peso: '2.8', metaComidas: '2', notas: 'Nuestro pequeño gran amigo ❤️' },
    registros: [
      { id: 'd1', tipo: 'Comida', porcion: 0.5, fecha: f(0, 7, 30), quien: 'Ejemplo' },
      { id: 'd2', tipo: 'Paseo', hizo: 'Pipí y Popó', fecha: f(0, 8, 15), nota: 'Paseo corto', quien: 'Ejemplo' },
      { id: 'd3', tipo: 'Paseo', hizo: 'Pipí', fecha: f(1, 19, 20), quien: 'Ejemplo' },
      { id: 'd4', tipo: 'Comida', porcion: 1, fecha: f(2, 8, 0), quien: 'Ejemplo' },
      { id: 'd5', tipo: 'Baño', detalle: 'En casa', proxima: enDias(4), fecha: f(10, 11, 0), quien: 'Ejemplo' },
      { id: 'd6', tipo: 'Uñas', detalle: 'Peluquería', proxima: enDias(-2), fecha: f(30, 16, 0), quien: 'Ejemplo' },
      { id: 'd7', tipo: 'Vacuna', detalle: 'Rabia', proxima: enDias(40), fecha: f(325, 10, 0), quien: 'Ejemplo' },
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
    if (accion === 'foto') {
      const id = 'demo-' + Date.now(); demoFotos[id] = datos.data;
      demoDatos.perfil = { ...demoDatos.perfil, [datos.cual]: id, ...(datos.cual === 'fotoInicio' ? { portadaAjuste: '' } : {}) };
    }
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
/* Próximas fechas: la del último baño, la del último corte y la última de cada vacuna */
function pendientes() {
  const vistos = new Set(), lista = [];
  E.registros.forEach(r => {
    if (!CUIDADOS[r.tipo]) return;
    const clave = r.tipo === 'Vacuna' ? 'V:' + r.detalle.trim().toLowerCase() : r.tipo;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const dias = r.proxima ? diasHasta(r.proxima) : null;
    if (dias !== null) lista.push({ r, dias });
  });
  return lista.sort((a, b) => a.dias - b.dias);
}
const nombreCuidado = r => r.tipo === 'Vacuna' ? `Vacuna${r.detalle ? ': ' + r.detalle : ''}` : CUIDADOS[r.tipo].nombre;
const vacunasUsadas = () => [...new Set(E.registros.filter(r => r.tipo === 'Vacuna' && r.detalle).map(r => r.detalle))];

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

function botonesCuidado() {
  return `<div class="botones-cuidado">${Object.entries(CUIDADOS).map(([t, C]) =>
    `<button class="btn-cuidado" data-nuevo="${t}" ${sinDatos() ? 'disabled' : ''}><span class="burbuja-mini ${C.clase}">${ico(C.ico)}</span>${C.corto}</button>`).join('')}</div>`;
}
function recordatorioHTML(p) {
  const n = p.dias, r = p.r, estado = n < 0 ? ' vencido' : n <= 7 ? ' pronto' : '';
  const detalle = r.tipo === 'Vacuna' && r.detalle ? ` data-detalle="${esc(r.detalle)}"` : '';
  return `<button class="recordatorio${estado}" data-nuevo="${r.tipo}"${detalle}>
    <span class="punto ${CLASE[r.tipo]}">${ico(ICONO[r.tipo])}</span>
    <span class="fila-txt"><b>${esc(nombreCuidado(r))}</b><small>${n < 0 ? 'Tocaba' : 'Toca'} ${cuandoTxt(n)}, ${fechaLarga(r.proxima)}</small></span>${ico('i-right')}</button>`;
}

function vistaInicio() {
  const h = deHoy(), hoy = new Date(), a = ajustePortada();
  const proximos = pendientes().filter(p => p.dias <= 14);
  return `${barra('Karim Daily', 'i-paw', true)}
  <div class="hero"><img src="${fotoDe('fotoInicio')}" alt="Foto de ${esc(E.perfil.nombre || 'Karim')}" class="${E.fotos.fotoInicio ? 'personal' : ''}"${a ? ` style="${estiloAjuste(a)}"` : ''}>
    <button class="hero-ajustar" data-ajustar aria-label="Mover o acercar la foto de portada" ${sinDatos() ? 'disabled' : ''}>${ico('i-move')}</button></div>
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
    ${proximos.length ? `<h2 class="titulo-sec">${ico('i-heart')}Próximos cuidados</h2><div class="recordatorios">${proximos.map(recordatorioHTML).join('')}</div>` : ''}
    <h2 class="titulo-sec">¿Qué quieres registrar?</h2>
    <div class="botones">
      <button class="btn-grande comida" data-nuevo="Comida" ${sinDatos() ? 'disabled' : ''}>${ico('i-food')}<span>Registrar<br>comida</span></button>
      <button class="btn-grande paseo" data-nuevo="Paseo" ${sinDatos() ? 'disabled' : ''}>${ico('i-paw')}<span>Registrar<br>paseo</span></button>
    </div>
    ${botonesCuidado()}
  </section>`;
}

function filaHTML(r) {
  let texto;
  if (r.tipo === 'Comida') texto = `${fraccion(r.porcion)} ${r.porcion > 1 ? 'porciones' : 'porción'} · ${hora(r.fecha)}`;
  else if (r.tipo === 'Paseo') texto = `${r.hizo} · ${hora(r.fecha)}`;
  else texto = esc(nombreCuidado(r)) + (r.tipo !== 'Vacuna' && r.detalle ? ` · ${esc(r.detalle)}` : '');
  const extra = [r.proxima && `Próximo: ${fechaLarga(r.proxima)}`, r.nota, r.quien && `por ${r.quien}`].filter(Boolean).map(esc).join(' · ');
  return `<button class="fila" data-editar="${esc(r.id)}">
    <span class="punto ${CLASE[r.tipo]}">${ico(ICONO[r.tipo])}</span>
    <span class="fila-txt num">${texto}${extra ? `<small>${extra}</small>` : ''}</span>${ico('i-right')}</button>`;
}
function listaDias(lista, vacioTitulo, vacioTexto) {
  if (!lista.length) return `<div class="vacio">${ico('i-paw')}<b>${vacioTitulo}</b><span>${vacioTexto}</span></div>`;
  return `<div class="dias">${agruparPorDia(lista).map(rs => `<div class="dia"><h3>${claveDia(rs[0].fecha) === claveDia(new Date()) ? 'Hoy, ' + rs[0].fecha.getDate() + ' ' + MESES[rs[0].fecha.getMonth()] : diaLista(rs[0].fecha)}</h3>${rs.map(filaHTML).join('')}</div>`).join('')}</div>`;
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
    ${listaDias(delMes(E.registros), 'Sin registros este mes', 'Aquí aparecerán las comidas, salidas y cuidados de Karim.')}</div>`;
}
function vistaTipo(tipo) {
  const comida = tipo === 'Comida';
  return `${barra(comida ? 'Comidas' : 'Paseos', comida ? 'i-food' : 'i-paw')}<div class="contenido">${notaEstado()}
    <button class="btn-grande ${comida ? 'comida' : 'paseo'}" data-nuevo="${tipo}" ${sinDatos() ? 'disabled' : ''}>${ico(comida ? 'i-food' : 'i-paw')}<span>Registrar ${comida ? 'comida' : 'paseo'}</span></button>
    ${selectorMes()}
    ${listaDias(delMes(E.registros.filter(r => r.tipo === tipo)), comida ? 'Sin comidas este mes' : 'Sin paseos este mes', comida ? 'Cada comida que registres aparecerá aquí.' : 'Cada salida que registres aparecerá aquí.')}</div>`;
}
function vistaCuidados() {
  const prox = pendientes();
  return `${barra('Cuidados', 'i-heart')}<div class="contenido">${notaEstado()}
    ${botonesCuidado()}
    <h2 class="titulo-sec">${ico('i-cal')}Próximas fechas</h2>
    ${prox.length ? `<div class="recordatorios">${prox.map(recordatorioHTML).join('')}</div>`
      : `<p class="ayuda sin-margen">Cuando registres un baño, un corte de uñas o una vacuna con fecha para la próxima vez, aparecerá aquí.</p>`}
    <h2 class="titulo-sec">${ico('i-note')}Registros</h2>
    ${listaDias(E.registros.filter(r => CUIDADOS[r.tipo]), 'Sin cuidados registrados', 'Aquí aparecerán los baños, cortes de uñas y vacunas.')}</div>`;
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
  const ultimo = t => E.registros.find(r => r.tipo === t);
  const bano = ultimo('Baño'), unas = ultimo('Uñas');
  const vacuna = pendientes().find(x => x.r.tipo === 'Vacuna' && x.dias >= -30);
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
  <h2 class="titulo-sec perfil-sec">${ico('i-heart')}Cuidados</h2>
  <div class="datos">
    <div class="dato">${ico('i-bath')}<span>Último baño</span><b>${bano ? hace(bano.fecha) : '—'}</b></div>
    <div class="dato">${ico('i-nails')}<span>Último corte de uñas</span><b>${unas ? hace(unas.fecha) : '—'}</b></div>
    <div class="dato">${ico('i-syringe')}<span>Próxima vacuna</span><b class="num">${vacuna ? `${esc(vacuna.r.detalle || 'Vacuna')}, ${fechaLarga(vacuna.r.proxima)}` : '—'}</b></div>
    <button class="dato ver-todo" data-ir="cuidados">${ico('i-cal')}<span>Ver todos los cuidados</span>${chev()}</button>
  </div>
  <div style="height:22px"></div>`;
}

function pintar() {
  const v = { inicio: vistaInicio, comidas: () => vistaTipo('Comida'), paseos: () => vistaTipo('Paseo'), cuidados: vistaCuidados, historial: vistaHistorial, karim: vistaKarim }[E.pestana];
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
  if (compacto) return `<label class="campo compacto">${ico('i-clock')}<span>${etiqueta}</span><input id="f-hora" type="time" value="${hora(fecha)}" required>${chev()}</label>`;
  return `<label class="campo grande">${ico('i-clock')}<span class="campo-etq"><small>${etiqueta}</small><input id="f-hora" type="time" value="${hora(fecha)}" required></span><span></span>${chev()}</label>`;
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

function abrirForm(tipo, reg, detalle) {
  if (tipo === 'Comida') formComida(reg);
  else if (tipo === 'Paseo') formPaseo(reg);
  else if (CUIDADOS[tipo]) formCuidado(tipo, reg, detalle);
}

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

/* Baño, corte de uñas o vacuna */
function formCuidado(tipo, reg, detallePre) {
  const C = CUIDADOS[tipo];
  const base = reg ? reg.fecha : new Date();
  const anterior = E.registros.find(r => r.tipo === tipo && r.detalle);
  let detalle = reg ? reg.detalle : (detallePre || (C.opciones ? (anterior && C.opciones.includes(anterior.detalle) ? anterior.detalle : C.opciones[0]) : ''));
  const nombres = C.nombres ? [...new Set(C.nombres.concat(vacunasUsadas()))] : [];
  abrir(`${reg ? 'Editar' : 'Registrar'} ${C.titulo}`, `
    <svg class="huella"><use href="#i-paw"/></svg>
    <div class="pregunta"><div class="burbuja ${C.clase}">${ico(C.ico)}</div><h2>${C.pregunta}</h2></div>
    ${C.opciones
      ? `<div class="chips" role="group" aria-label="Dónde">${C.opciones.map(o => `<button type="button" class="chip" data-d="${esc(o)}" aria-pressed="${o === detalle}">${esc(o)}</button>`).join('')}</div>`
      : `<div class="texto-campo"><label for="f-detalle">Nombre de la vacuna</label><input id="f-detalle" list="l-vacunas" maxlength="80" autocomplete="off" value="${esc(detalle)}" placeholder="Ej. Rabia"></div>
         <datalist id="l-vacunas">${nombres.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`}
    <label class="campo compacto">${ico('i-cal')}<span>Día</span><input id="f-dia" type="date" value="${claveDia(base)}" max="${claveDia(new Date())}" required>${chev()}</label>
    <div class="proxima">
      <div class="texto-campo"><label for="f-proxima">${C.proximo} (opcional)</label><input id="f-proxima" type="date" value="${esc(reg ? reg.proxima : '')}"></div>
      <div class="sugerencias" role="group" aria-label="Elegir la próxima fecha">
        ${C.sugerencias.map(([d, l]) => `<button type="button" data-mas="${d}">En ${l}</button>`).join('')}
        <button type="button" data-mas="">Sin fecha</button>
      </div>
    </div>
    <div class="area">${ico('i-chat')}<label for="f-nota">Observaciones (opcional)</label><textarea id="f-nota" maxlength="280" rows="2" placeholder="${tipo === 'Vacuna' ? 'Ej. Veterinario, lote…' : 'Ej. Se portó muy bien'}">${reg ? esc(reg.nota) : ''}</textarea></div>
    ${pieFormulario(reg)}`, c => {
    c.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
      detalle = b.dataset.d; c.querySelectorAll('[data-d]').forEach(x => x.setAttribute('aria-pressed', x === b));
    }));
    c.querySelectorAll('[data-mas]').forEach(b => b.addEventListener('click', () => {
      const prox = $('#f-proxima', c);
      if (b.dataset.mas === '') { prox.value = ''; return; }
      const d = diaDe($('#f-dia', c).value) || new Date();
      d.setDate(d.getDate() + Number(b.dataset.mas));
      prox.value = claveDia(d);
    }));
    $('#f-guardar', c).addEventListener('click', async ev => {
      const boton = ev.currentTarget;
      if (!C.opciones) {
        detalle = $('#f-detalle', c).value.trim();
        if (!detalle) { avisar('Escribe el nombre de la vacuna'); $('#f-detalle', c).focus(); return; }
      }
      const dia = $('#f-dia', c).value;
      if (!diaDe(dia)) { avisar('Elige el día'); return; }
      boton.disabled = true;
      const datos = {
        id: reg ? reg.id : nuevoId(), tipo, detalle,
        fecha: `${dia} ${hora(base)}`,
        proxima: $('#f-proxima', c).value,
        nota: $('#f-nota', c).value.trim(),
        quien: reg ? reg.quien : (CFG.nombre || ''),
      };
      if (await escribir('guardar', datos, reg ? 'Registro actualizado' : `Anotado: ${C.titulo}`)) cerrar(); else boton.disabled = false;
    });
    conectarEliminar(c, reg);
  });
}

/* Mover y acercar la foto de portada */
function formPortada() {
  let a = ajustePortada() || { x: 50, y: E.fotos.fotoInicio ? 35 : 30, z: 1 };
  const anchoPortada = Math.min(window.innerWidth, 440);
  abrir('Ajustar portada', `
    <p class="ayuda sin-margen">Arrastra la foto para moverla. Para acercarla, pellizca con dos dedos o usa la barra.</p>
    <div class="ajuste-caja" id="a-caja" style="aspect-ratio:${anchoPortada} / 290">
      <img id="a-img" src="${fotoDe('fotoInicio')}" alt="" draggable="false">
      <div class="ajuste-tapa" aria-hidden="true"></div>
    </div>
    <p class="ayuda sin-margen">La franja clara de abajo queda tapada por el resumen.</p>
    <div class="zoom"><span aria-hidden="true">−</span><input id="a-zoom" type="range" min="1" max="4" step="0.01" aria-label="Acercar o alejar"><span aria-hidden="true">+</span></div>
    <button type="button" class="btn-cancelar" id="a-centrar">Volver a centrar</button>
    <div class="empuje"></div>
    <button class="btn-guardar" id="a-guardar">Guardar portada</button>
    <button class="btn-cancelar" data-cerrar>Cancelar</button>`, c => {
    const caja = $('#a-caja', c), img = $('#a-img', c), zoom = $('#a-zoom', c);
    const dibujar = () => { img.style.cssText = estiloAjuste(a); zoom.value = a.z; };
    // Mueve la foto lo mismo que el dedo (calcula cuánto sobra de la imagen en cada lado)
    const mover = (dx, dy) => {
      const w = caja.clientWidth, h = caja.clientHeight;
      const nw = img.naturalWidth || w, nh = img.naturalHeight || h;
      const k = Math.max(w / nw, h / nh), sobraX = nw * k * a.z - w, sobraY = nh * k * a.z - h;
      if (sobraX > 0.5) a.x = lim(a.x - dx * 100 / sobraX, 0, 100);
      if (sobraY > 0.5) a.y = lim(a.y - dy * 100 / sobraY, 0, 100);
    };
    const dedos = new Map(); let ultimo = null;
    const centro = () => {
      const v = [...dedos.values()];
      if (v.length === 1) return { x: v[0].x, y: v[0].y };
      return { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2, d: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) };
    };
    caja.addEventListener('pointerdown', e => {
      caja.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); ultimo = centro();
    });
    caja.addEventListener('pointermove', e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const s = centro();
      if (ultimo) {
        if (s.d && ultimo.d) a.z = lim(a.z * s.d / ultimo.d, 1, 4);
        mover(s.x - ultimo.x, s.y - ultimo.y);
        dibujar();
      }
      ultimo = s;
    });
    const soltar = e => { dedos.delete(e.pointerId); ultimo = dedos.size ? centro() : null; };
    caja.addEventListener('pointerup', soltar);
    caja.addEventListener('pointercancel', soltar);
    caja.addEventListener('wheel', e => { e.preventDefault(); a.z = lim(a.z * Math.exp(-e.deltaY * 0.0015), 1, 4); dibujar(); }, { passive: false });
    zoom.addEventListener('input', () => { a.z = Number(zoom.value); dibujar(); });
    $('#a-centrar', c).addEventListener('click', () => { a = { x: 50, y: 35, z: 1 }; dibujar(); });
    $('#a-guardar', c).addEventListener('click', async ev => {
      const boton = ev.currentTarget; boton.disabled = true;
      const valor = [a.x.toFixed(1), a.y.toFixed(1), a.z.toFixed(2)].join(',');
      if (await escribir('perfil', { portadaAjuste: valor }, 'Portada guardada')) cerrar(); else boton.disabled = false;
    });
    dibujar();
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
    ${tarjetaFoto('fotoInicio', 'Foto de portada', 'ancha')}
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
        estado.textContent = cual === 'fotoInicio' ? 'Guardada. Para encuadrarla, usa el botón de flechas en la portada.' : 'Foto guardada';
        avisar('Foto actualizada');
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
  const t = ev.target.closest('[data-tab],[data-ir],[data-nuevo],[data-editar],[data-mes],[data-cerrar],[data-perfil],[data-ajustar],[data-config],[data-menu],[data-menu-cerrar],[data-recargar]');
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.tab || d.ir) { E.pestana = d.tab || d.ir; $('#menu').hidden = true; pintar(); scrollTo(0, 0); }
  else if (d.nuevo) abrirForm(d.nuevo, null, d.detalle);
  else if (d.editar) { const r = E.registros.find(x => x.id === d.editar); if (r) abrirForm(r.tipo, r); }
  else if (d.mes) { E.mes = new Date(E.mes.getFullYear(), E.mes.getMonth() + Number(d.mes), 1); pintar(); }
  else if ('cerrar' in d) cerrar();
  else if ('perfil' in d) formPerfil();
  else if ('ajustar' in d) formPortada();
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
