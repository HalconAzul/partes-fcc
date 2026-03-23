// ════════════════════════════════════════════════════════════════
//  PARTES FCC BARBETIUM — Google Apps Script Web App
//  Archivo: Code.gs  (servidor)
// ════════════════════════════════════════════════════════════════

var SPREADSHEET_ID    = '1QR8Y88WHMYNcAU8vlNvMkyIgleyQvsKxk2b1LPTe1WI';
var SHEET_NAME        = 'Partes';
var DRIVE_FOLDER_ID   = '1TYXwYjNymZAWn-0qEdEGRmzEZ7Q867lW';

var HEADERS = [
  'ID', 'FECHA', 'TURNO', 'HORA INICIO', 'HORA FIN',
  'Nº HOJA', 'FORMULARIO', 'SERVICIO', 'EQUIPO / ZONA', 'CENTRO',
  'MATRÍCULA', 'MODELO VEHÍCULO', 'KM SALIDA', 'KM LLEGADA',
  'KM RECORRIDOS', 'PERSONAL', 'FIRMADO POR',
  'OBS. VEHÍCULO', 'OBS. SERVICIO', 'COMPLEMENTO RSU', 'FOTO', 'FECHA GUARDADO'
];

// ── Servir la app web ────────────────────────────────────────────
function doGet(e) {
  // ── Endpoint API REST (?action=getPartes) ──────────────────────
  if (e && e.parameter && e.parameter.action === 'getPartes') {
    var result = getPartes();
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Endpoint del manifiesto PWA (?manifest=1) ──────────────────
  if (e && e.parameter && e.parameter.manifest === '1') {
    var appUrl = ScriptApp.getService().getUrl();
    var manifest = {
      name:             'Partes · FCC Barbetium',
      short_name:       'Partes FCC',
      description:      'Gestión de partes de trabajo FCC Barbetium',
      start_url:        appUrl,
      scope:            appUrl,
      display:          'standalone',
      orientation:      'portrait-primary',
      background_color: '#003366',
      theme_color:      '#003366',
      lang:             'es',
      icons: [
        {
          src:   'https://www.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png',
          sizes: '48x48',
          type:  'image/png'
        },
        {
          src:   'https://www.gstatic.com/images/branding/product/2x/docs_2020q4_96dp.png',
          sizes: '96x96',
          type:  'image/png'
        },
        {
          src:   'https://www.gstatic.com/images/branding/product/2x/docs_2020q4_192dp.png',
          sizes: '192x192',
          type:  'image/png',
          purpose: 'any maskable'
        }
      ]
    };
    return ContentService
      .createTextOutput(JSON.stringify(manifest))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Página principal ───────────────────────────────────────────
  var tpl = HtmlService.createTemplateFromFile('index');
  tpl.appUrl = ScriptApp.getService().getUrl();
  return tpl.evaluate()
    .setTitle('Partes · FCC Barbetium')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

// ── API REST para GitHub Pages (doPost) ──────────────────────────
// Acepta POST con body application/x-www-form-urlencoded:
//   action=<nombre>  &  data=<JSON.stringify(params)>
function doPost(e) {
  try {
    var action = e.parameter.action;
    var data   = e.parameter.data ? JSON.parse(e.parameter.data) : null;
    var result;
    if      (action === 'saveParte')     result = saveParte(data);
    else if (action === 'uploadPhoto')   result = uploadPhoto(data.base64Data, data.filename);
    else if (action === 'runOCR')        result = runOCR(data);
    else if (action === 'deleteParte')   result = deleteParte(data);
    else if (action === 'corregirTexto') result = corregirTexto(data);
    else result = { status: 'error', message: 'Acción desconocida: ' + action };
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Obtener o crear la hoja ──────────────────────────────────────
function getOrCreateSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var hdrRange = sheet.getRange(1, 1, 1, HEADERS.length);
    hdrRange.setValues([HEADERS]);
    hdrRange.setFontWeight('bold');
    hdrRange.setBackground('#003366');
    hdrRange.setFontColor('#ffffff');
    hdrRange.setFontSize(10);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 90);
    sheet.setColumnWidth(8, 180);
    sheet.setColumnWidth(20, 60);  // COMPLEMENTO RSU
    sheet.setColumnWidth(21, 200); // FOTO
    var maxRows = sheet.getMaxRows();
    sheet.getRange(1, 2,  maxRows, 1).setNumberFormat('@STRING@'); // FECHA
    sheet.getRange(1, 4,  maxRows, 2).setNumberFormat('@STRING@'); // HORA INICIO, HORA FIN
    sheet.getRange(1, 22, maxRows, 1).setNumberFormat('@STRING@'); // FECHA GUARDADO
  }
  return sheet;
}

// ── Convertir valor de celda a texto limpio ──────────────────────
function cellToString(val, header, tz) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    var h    = header ? String(header).toUpperCase() : '';
    var zone = tz || 'Europe/Madrid';
    if (h.indexOf('HORA') >= 0) {
      return Utilities.formatDate(val, zone, 'HH:mm');
    }
    if (h === 'FECHA') {
      return Utilities.formatDate(val, zone, 'yyyy-MM-dd');
    }
    return Utilities.formatDate(val, zone, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return (val === null || val === undefined) ? '' : String(val);
}

// ── Leer todos los partes ────────────────────────────────────────
function getPartes() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var tz    = ss.getSpreadsheetTimeZone();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];

    var readCols = Math.max(lastCol, HEADERS.length);
    var data     = sheet.getRange(1, 1, lastRow, readCols).getValues();
    var headers  = data[0].map(function(h) { return String(h).trim(); });

    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var hasContent = row.some(function(cell) { return cell !== '' && cell !== null; });
      if (!hasContent) continue;

      var obj = {};
      headers.forEach(function(h, idx) {
        obj[h] = cellToString(row[idx], h, tz);
      });

      if (obj[headers[0]]) result.push(obj);
    }
    return result;
  } catch(e) {
    return { error: e.message };
  }
}

// ── Guardar o actualizar un parte ────────────────────────────────
function saveParte(parte) {
  try {
    if (!parte || !parte.id) return { status: 'error', message: 'Sin ID' };
    var sheet     = getOrCreateSheet();
    var data      = sheet.getDataRange().getValues();
    var targetRow = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(parte.id).trim()) {
        targetRow = i + 1;
        break;
      }
    }

    var kmr = '';
    if (parte.kms && parte.kml) {
      var diff = parseInt(parte.kml) - parseInt(parte.kms);
      if (!isNaN(diff) && diff > 0) kmr = String(diff);
    }

    var row = [
      parte.id        || '',
      parte.fecha     || '',
      parte.turno     || '',
      parte.h1        || '',
      parte.h2        || '',
      parte.nhoja     || parte.id || '',
      parte.form      || '',
      parte.serv      || '',
      parte.equipo    || '',
      parte.centro    || '',
      parte.mat       || '',
      parte.modelo    || '',
      parte.kms       || '',
      parte.kml       || '',
      kmr,
      parte.personal  || '',
      parte.firma     || '',
      parte.ov        || '',
      parte.os        || '',
      parte.rsu       ? 'Sí' : '',   // COMPLEMENTO RSU — columna 20
      parte.fotoUrl   || '',          // FOTO — columna 21
      new Date().toISOString()        // FECHA GUARDADO — columna 22
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
      sheet.getRange(targetRow, 2, 1, 1).setNumberFormat('@STRING@');
      sheet.getRange(targetRow, 4, 1, 2).setNumberFormat('@STRING@');
    } else {
      sheet.appendRow(row);
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 2, 1, 1).setNumberFormat('@STRING@');
      sheet.getRange(lastRow, 4, 1, 2).setNumberFormat('@STRING@');
      if (lastRow % 2 === 0) {
        sheet.getRange(lastRow, 1, 1, HEADERS.length).setBackground('#f0f4f8');
      }
    }
    return { status: 'ok', kmr: kmr };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}

// ── Eliminar un parte ────────────────────────────────────────────
function deleteParte(id) {
  try {
    var sheet = getOrCreateSheet();
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(id).trim()) {
        sheet.deleteRow(i + 1);
        return { status: 'ok' };
      }
    }
    return { status: 'error', message: 'No encontrado' };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}

// ── Subir foto a Google Drive ────────────────────────────────────
function uploadPhoto(base64Data, filename) {
  try {
    if (!base64Data) return { status: 'error', message: 'Sin imagen' };
    var raw    = base64Data.replace(/^data:image\/\w+;base64,/, '');
    var bytes  = Utilities.base64Decode(raw);
    var blob   = Utilities.newBlob(bytes, 'image/jpeg', filename || ('foto_' + Date.now() + '.jpg'));
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      status:  'ok',
      fileId:  file.getId(),
      fileUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view'
    };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}

// ── OCR: extraer texto de una imagen ────────────────────────────
// Requiere el servicio avanzado "Drive API v2" activado en el proyecto.
// CORRECCIÓN v3: usa UrlFetchApp + token OAuth para exportar el texto
// (Drive.Files.export del servicio avanzado no admite descarga directa,
//  y DocumentApp.openById requiere permisos extra — este método evita ambos)
function runOCR(base64Data) {
  try {
    if (!base64Data) return { status: 'error', message: 'Sin imagen' };
    var raw      = base64Data.replace(/^data:image\/\w+;base64,/, '');
    var bytes    = Utilities.base64Decode(raw);
    var blob     = Utilities.newBlob(bytes, 'image/jpeg', 'ocr_temp_' + Date.now() + '.jpg');

    // Subir imagen a la carpeta de Drive
    var folder   = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var tempFile = folder.createFile(blob);

    // Convertir a Google Doc con OCR nativo (reconocimiento en español)
    var resource = {
      title:    'ocr_temp_' + Date.now(),
      mimeType: 'application/vnd.google-apps.document'
    };
    var docFile = Drive.Files.copy(resource, tempFile.getId(), { ocr: true, ocrLanguage: 'es' });

    // Exportar como texto plano via Drive REST API v3 + token OAuth de la sesión
    var token    = ScriptApp.getOAuthToken();
    var url      = 'https://www.googleapis.com/drive/v3/files/' + docFile.id +
                   '/export?mimeType=text%2Fplain';
    var response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var text = response.getContentText('UTF-8');

    // Limpiar archivos temporales
    DriveApp.getFileById(tempFile.getId()).setTrashed(true);
    DriveApp.getFileById(docFile.id).setTrashed(true);

    return { status: 'ok', text: text };
  } catch (err) {
    return { status: 'error', ocrError: true, errorMsg: err.message };
  }
}

// ── Corrección ortográfica y gramatical (LanguageTool) ───────────
function corregirTexto(text) {
  if (!text || !text.trim()) return { status: 'ok', text: text, corrections: 0 };
  try {
    var response = UrlFetchApp.fetch('https://api.languagetool.org/v2/check', {
      method: 'post',
      payload: { text: text, language: 'es' },
      muteHttpExceptions: true
    });
    var data = JSON.parse(response.getContentText());

    if (!data.matches || data.matches.length === 0) {
      return { status: 'ok', text: text, corrections: 0 };
    }

    var matches   = data.matches.slice().sort(function(a, b) { return b.offset - a.offset; });
    var corrected = text;
    var applied   = 0;
    matches.forEach(function(m) {
      if (m.replacements && m.replacements.length > 0) {
        var rep = m.replacements[0].value;
        corrected = corrected.substring(0, m.offset) + rep +
                    corrected.substring(m.offset + m.length);
        applied++;
      }
    });

    if (corrected.length > 0) {
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    }

    return { status: 'ok', text: corrected, corrections: applied };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}

// ── Estadísticas rápidas ─────────────────────────────────────────
function getStats() {
  try {
    var sheet = getOrCreateSheet();
    var data  = sheet.getDataRange().getValues();
    if (data.length < 2) return { total: 0, mes: 0, semana: 0 };

    var now  = new Date();
    var mes0 = new Date(now.getFullYear(), now.getMonth(), 1);
    var day  = now.getDay();
    var diff = now.getDate() - day + (day === 0 ? -6 : 1);
    var sem0 = new Date(now.getFullYear(), now.getMonth(), diff);
    sem0.setHours(0, 0, 0, 0);

    var total = 0, mes = 0, semana = 0;
    for (var i = 1; i < data.length; i++) {
      var id = String(data[i][0] || '').trim();
      if (!id) continue;
      total++;
      var fechaStr = String(data[i][1] || '');
      if (fechaStr) {
        var fecha = new Date(fechaStr);
        if (!isNaN(fecha)) {
          if (fecha >= mes0) mes++;
          if (fecha >= sem0) semana++;
        }
      }
    }
    return { total: total, mes: mes, semana: semana };
  } catch(e) {
    return { total: 0, mes: 0, semana: 0 };
  }
}
