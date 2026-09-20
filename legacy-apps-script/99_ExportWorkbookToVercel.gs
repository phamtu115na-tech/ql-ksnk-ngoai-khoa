/**
 * MIGRATION AN TOÀN TỪ GOOGLE SHEETS SANG VERCEL + SUPABASE
 *
 * Không xóa dữ liệu nguồn và không xóa dữ liệu đích.
 * Chạy lại nhiều lần sẽ cập nhật đúng dòng theo sheet_name + row_no.
 *
 * Thiết lập một lần trong Apps Script:
 * 1. Project Settings -> Script properties
 * 2. Tạo SYSTEM_PASSWORD bằng mật khẩu quản trị hiện tại.
 * 3. Chạy migrateWorkbookToVercel().
 */
const VERCEL_WORKBOOK_IMPORT_URL =
  'https://ql-ksnk-ngoai-khoa-pkdu.vercel.app/api/import/workbook';
const WORKBOOK_IMPORT_BATCH_SIZE = 100;

function migrateWorkbookToVercel() {
  const props = PropertiesService.getScriptProperties();
  const password = String(
    props.getProperty('MIGRATION_PASSWORD') ||
    props.getProperty('SYSTEM_PASSWORD') ||
    ''
  ).trim();

  if (!password) {
    throw new Error(
      'Hãy đặt Script property MIGRATION_PASSWORD hoặc SYSTEM_PASSWORD trước khi chạy.'
    );
  }

  const cookie = loginToVercelForMigration_(password);
  const ss = getAppSpreadsheet_();
  const sheets = ss.getSheets();
  let batch = [];
  let sent = 0;
  let sheetsWithData = 0;

  sheets.forEach(function(sheet) {
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 1) return;

    sheetsWithData++;
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = uniqueHeaders_(values[0]);

    for (let index = 1; index < values.length; index++) {
      const sourceRow = values[index];
      const data = {};
      let hasValue = false;

      headers.forEach(function(header, columnIndex) {
        const value = sourceRow[columnIndex] == null ? '' : String(sourceRow[columnIndex]);
        data[header] = value;
        if (value.trim()) hasValue = true;
      });

      if (!hasValue) continue;

      const rowNumber = index + 1;
      batch.push({
        sheet_name: sheet.getName(),
        row_no: rowNumber,
        legacy_id: firstLegacyId_(data, sheet.getName() + ':' + rowNumber),
        data: data
      });

      if (batch.length >= WORKBOOK_IMPORT_BATCH_SIZE) {
        postWorkbookBatch_(cookie, batch);
        sent += batch.length;
        batch = [];
      }
    }
  });

  if (batch.length) {
    postWorkbookBatch_(cookie, batch);
    sent += batch.length;
  }

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheetCount: sheets.length,
    sheetsWithData: sheetsWithData,
    importedRows: sent,
    message: 'Đã nhập dữ liệu theo lô; dữ liệu nguồn không bị xóa.'
  };
}

function loginToVercelForMigration_(password) {
  const response = UrlFetchApp.fetch(VERCEL_WORKBOOK_IMPORT_URL.replace(
    '/api/import/workbook',
    '/api/auth'
  ), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ password: password }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Đăng nhập Vercel thất bại (' + code + ').');
  }

  const headers = response.getAllHeaders();
  const rawCookie = headers['Set-Cookie'] || headers['set-cookie'];
  const cookie = Array.isArray(rawCookie)
    ? rawCookie.map(function(value) { return String(value).split(';')[0]; }).join('; ')
    : String(rawCookie || '').split(';')[0];

  if (!cookie) throw new Error('Vercel không trả session cookie.');
  return cookie;
}

function postWorkbookBatch_(cookie, rows) {
  const response = UrlFetchApp.fetch(VERCEL_WORKBOOK_IMPORT_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Cookie: cookie },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(
      'Nhập dữ liệu thất bại (' + code + '): ' +
      response.getContentText().slice(0, 500)
    );
  }
}

function uniqueHeaders_(headerRow) {
  const used = {};
  return headerRow.map(function(value, index) {
    const base = String(value || '').trim() || 'Cột ' + (index + 1);
    used[base] = (used[base] || 0) + 1;
    return used[base] === 1 ? base : base + ' [' + used[base] + ']';
  });
}

function firstLegacyId_(data, fallback) {
  const keys = [
    'ID', 'Mã NV', 'Mã VP', 'Mã lỗi', 'Mã phiếu',
    'Mã tiêu chí', 'Mã mẫu phiếu'
  ];
  for (let i = 0; i < keys.length; i++) {
    if (String(data[keys[i]] || '').trim()) return String(data[keys[i]]).trim();
  }
  return fallback;
}
