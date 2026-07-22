/**
 * RSVP → Google Sheet
 *
 * SETUP (una tantum):
 * 1. Crea un Google Sheet nuovo (es. "Matrimonio RSVP").
 * 2. Estensioni → Apps Script, cancella il codice e incolla QUESTO file.
 * 3. Salva, poi Distribuisci → Nuova distribuzione → tipo "App Web":
 *    - Esegui come: Me
 *    - Chi può accedere: Chiunque
 * 4. Copia l’URL della web app e incollalo in script.js
 *    nella costante SHEETS_WEBAPP_URL.
 * 5. Al primo invio viene creato il foglio "RSVP" con le intestazioni.
 */

const SHEET_NAME = "RSVP";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet_();

    sheet.appendRow([
      new Date(),
      data.name || "",
      data.phone || data.email || "",
      data.attendance || "",
      data.guests || "",
      data.allergies === "si"
        ? ("Sì" + (data.allergyDetails ? ": " + data.allergyDetails : ""))
        : (data.allergies === "no" ? "No" : (data.menu || "")),
      data.message || "",
    ]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: "RSVP endpoint attivo" });
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Data",
      "Nome",
      "Telefono",
      "Partecipa",
      "Ospiti",
      "Allergie",
      "Messaggio",
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
