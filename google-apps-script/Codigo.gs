/**
 * Karim Daily — guarda los registros en una hoja de Google Sheets de tu Google Drive.
 *
 * Cómo usarlo (resumen; la guía completa está en LEEME.md):
 *  1. Crea una hoja de cálculo nueva en tu Google Drive llamada "Karim Daily".
 *  2. Menú Extensiones > Apps Script. Borra lo que haya y pega este archivo completo.
 *  3. Cambia la CLAVE de abajo por una palabra secreta de tu casa.
 *  4. Elige la función "configurar" y pulsa Ejecutar (acepta los permisos).
 *  5. Implementar > Nueva implementación > Aplicación web:
 *       Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 *     Copia la URL que termina en /exec y pégala en la app (botón de engranaje).
 */

const CLAVE = 'CAMBIA-ESTA-CLAVE';

const HOJA_REGISTROS = 'Registros';
const HOJA_PERFIL = 'Perfil';
const COLUMNAS = ['id', 'tipo', 'porcion', 'hizo', 'fecha', 'nota', 'quien', 'creado'];
const CAMPOS_PERFIL = ['nombre', 'raza', 'nacimiento', 'peso', 'metaComidas', 'notas'];
const CAMPOS_FOTO = ['foto', 'fotoInicio'];          // ids de archivos de Drive
const CARPETA_FOTOS = 'Karim Daily - fotos';

/** Ejecútala una sola vez: crea las pestañas con sus columnas y el perfil de Karim. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let reg = ss.getSheetByName(HOJA_REGISTROS);
  if (!reg) reg = ss.insertSheet(HOJA_REGISTROS);
  if (reg.getLastRow() === 0) {
    reg.getRange('A:H').setNumberFormat('@');
    reg.getRange('C:C').setNumberFormat('0.00');
    reg.appendRow(COLUMNAS);
    reg.setFrozenRows(1);
    reg.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#FFF2D9');
  }

  let per = ss.getSheetByName(HOJA_PERFIL);
  if (!per) per = ss.insertSheet(HOJA_PERFIL);
  if (per.getLastRow() === 0) {
    per.getRange('A:B').setNumberFormat('@');
    per.getRange(1, 1, 7, 2).setValues([
      ['campo', 'valor'],
      ['nombre', 'Karim'],
      ['raza', 'Chihuahua'],
      ['nacimiento', '2016-01-22'],
      ['peso', '2.8'],
      ['metaComidas', '2'],
      ['notas', 'Nuestro pequeño gran amigo ❤️'],
    ]);
    per.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#FFF2D9');
  }

  // Crea la carpeta de fotos (y pide el permiso de Drive en esta primera ejecución)
  if (!DriveApp.getFoldersByName(CARPETA_FOTOS).hasNext()) DriveApp.createFolder(CARPETA_FOTOS);

  const hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 2 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);
}

/** La app lee todo con GET: ?accion=leer&clave=... */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.clave !== CLAVE) return responder({ ok: false, error: 'clave' });
  if (p.accion === 'verFoto') return responder(verFoto(String(p.id || '')));
  return responder({ ok: true, registros: leerRegistros(), perfil: leerPerfil() });
}

/** Devuelve una foto de Karim. Solo entrega las fotos que figuran en el perfil, nunca otros archivos de tu Drive. */
function verFoto(id) {
  const perfil = leerPerfil();
  if (!id || !CAMPOS_FOTO.some(c => perfil[c] === id)) return { ok: false, error: 'foto' };
  const blob = DriveApp.getFileById(id).getBlob();
  return { ok: true, data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

/** Guarda una foto nueva en la carpeta "Karim Daily - fotos" y manda la anterior a la papelera. */
function guardarFoto(d) {
  const cual = CAMPOS_FOTO.indexOf(d.cual) >= 0 ? d.cual : null;
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(d.data || ''));
  if (!cual || !m || m[3].length > 4000000) throw new Error('foto no válida');
  const carpetas = DriveApp.getFoldersByName(CARPETA_FOTOS);
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_FOTOS);
  const nombre = (cual === 'foto' ? 'perfil' : 'inicio') + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm') + '.jpg';
  const archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], nombre));
  const perfil = leerPerfil();
  const anterior = perfil[cual];
  perfil[cual] = archivo.getId();
  escribirPerfil(perfil);
  if (anterior) { try { DriveApp.getFileById(anterior).setTrashed(true); } catch (err) {} }
}

/** La app escribe con POST: {clave, accion: 'guardar'|'borrar'|'perfil', datos} */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return responder({ ok: false, error: 'formato' }); }
  if (!body || body.clave !== CLAVE) return responder({ ok: false, error: 'clave' });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const datos = body.datos || {};
    if (body.accion === 'guardar') guardarRegistro(datos);
    else if (body.accion === 'borrar') borrarRegistro(String(datos.id || ''));
    else if (body.accion === 'perfil') guardarPerfil(datos);
    else if (body.accion === 'foto') guardarFoto(datos);
    else return responder({ ok: false, error: 'accion' });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return responder({ ok: true, registros: leerRegistros(), perfil: leerPerfil() });
}

function hoja(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('Falta la pestaña "' + nombre + '". Ejecuta la función configurar.');
  return h;
}

function texto(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return v === null || v === undefined ? '' : String(v);
}

function leerRegistros() {
  const h = hoja(HOJA_REGISTROS);
  const n = h.getLastRow() - 1;
  if (n < 1) return [];
  return h.getRange(2, 1, n, COLUMNAS.length).getValues()
    .filter(f => f[0] !== '')
    .map(f => {
      const o = {};
      COLUMNAS.forEach((c, i) => { o[c] = c === 'porcion' ? Number(f[i]) || 0 : texto(f[i]); });
      return o;
    });
}

function filaDe(id) {
  const h = hoja(HOJA_REGISTROS);
  const n = h.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = h.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

function limpiar(s, max) { return String(s === undefined || s === null ? '' : s).slice(0, max); }

function guardarRegistro(d) {
  const tipo = d.tipo === 'Paseo' ? 'Paseo' : 'Comida';
  const fila = [
    limpiar(d.id, 40) || Utilities.getUuid(),
    tipo,
    tipo === 'Comida' ? Math.max(0, Math.min(5, Number(d.porcion) || 0)) : '',
    tipo === 'Paseo' ? limpiar(d.hizo, 20) : '',
    limpiar(d.fecha, 16),
    limpiar(d.nota, 280),
    limpiar(d.quien, 40),
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
  ];
  const h = hoja(HOJA_REGISTROS);
  const existente = filaDe(fila[0]);
  if (existente > 0) {
    fila[7] = texto(h.getRange(existente, 8).getValue()) || fila[7];
    h.getRange(existente, 1, 1, fila.length).setValues([fila]);
  } else {
    h.appendRow(fila);
  }
}

function borrarRegistro(id) {
  const f = filaDe(id);
  if (f > 0) hoja(HOJA_REGISTROS).deleteRow(f);
}

function leerPerfil() {
  const h = hoja(HOJA_PERFIL);
  const n = h.getLastRow() - 1;
  const o = {};
  if (n < 1) return o;
  h.getRange(2, 1, n, 2).getValues().forEach(f => { if (f[0]) o[String(f[0])] = texto(f[1]); });
  return o;
}

/** Cambia los datos escritos del perfil; las fotos se mantienen. */
function guardarPerfil(d) {
  const perfil = leerPerfil();
  CAMPOS_PERFIL.forEach(c => { if (d[c] !== undefined) perfil[c] = limpiar(d[c], 280); });
  escribirPerfil(perfil);
}

function escribirPerfil(perfil) {
  const h = hoja(HOJA_PERFIL);
  const filas = CAMPOS_PERFIL.concat(CAMPOS_FOTO).map(c => [c, limpiar(perfil[c], 280)]);
  h.getRange('A:B').setNumberFormat('@');
  h.getRange(2, 1, Math.max(h.getLastRow() - 1, 1), 2).clearContent();
  h.getRange(2, 1, filas.length, 2).setValues(filas);
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
