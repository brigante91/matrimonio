const SHEET_NAME = "RSVP";

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet_();

    const safeName = sanitizeInput_(data.name);
    const safePhone = sanitizeInput_(data.phone);
    const safeAttendance = sanitizeInput_(data.attendance);
    const safeGuests = sanitizeInput_(data.guests);
    const safeAllergies = sanitizeInput_(data.allergies);
    const safeAllergyDetails = sanitizeInput_(data.allergyDetails);
    const safeMessage = sanitizeInput_(data.message);

    sheet.appendRow([
      new Date(),
      safeName,
      safePhone,
      safeAttendance,
      safeGuests,
      safeAllergies,
      safeAllergyDetails,
      safeMessage,
    ]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: "RSVP endpoint attivo e protetto" });
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  const headers = [
    "Data",
    "Nome",
    "Telefono",
    "Partecipa",
    "Ospiti",
    "Allergie",
    "Dettaglio allergie",
    "Messaggio",
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange("A2:A").setNumberFormat("dd/MM/yyyy HH:mm:ss");
    return sheet;
  }

  // Aggiorna intestazioni se lo sheet esisteva con colonne vecchie (Email/Menu).
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaderUpdate = headers.some(function (header, i) {
    return String(firstRow[i] || "") !== header;
  });
  if (needsHeaderUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange("A2:A").setNumberFormat("dd/MM/yyyy HH:mm:ss");
  }

  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Previene formula injection su Google Sheets.
 * Se la stringa inizia con =, +, - o @, antepone un apostrofo.
 */
function sanitizeInput_(value) {
  if (value === undefined || value === null) return "";

  const str = String(value).trim();
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}
