/**
 * KHUNG CHÍNH HỆ THỐNG QUẢN LÝ KSNK - BỆNH VIỆN 115
 * NGUYÊN TẮC BẢN FINAL:
 * 1) APP_CONFIG + các hàm cũ được GIỮ NGUYÊN cấu trúc/logic cũ.
 * 2) Nội dung mới nằm trong EXT_CONFIG + các hàm setupExtensionSheets().
 * 3) Không đổi tên, không thêm cột, không xóa dữ liệu của 5 sheet cũ.
 * 4) Chỉ tệp này khai báo doGet() và onOpen().
 */

// ============================================================================
// A. KHỐI CŨ - GIỮ NGUYÊN CẤU TRÚC
// ============================================================================
const APP_CONFIG = Object.freeze({
  // Set these values in the private Apps Script project before using the
  // legacy Google Sheets deployment. They are intentionally not committed.
  SPREADSHEET_ID: 'REPLACE_WITH_PRIVATE_SPREADSHEET_ID',
  DRIVE_FOLDER_ID: 'REPLACE_WITH_PRIVATE_DRIVE_FOLDER_ID',
  APPSHEET_URL: 'https://www.appsheet.com/start/REPLACE_WITH_PRIVATE_APP_ID',
  AUTHOR: 'Phạm Văn Tú',
  SHEETS: Object.freeze({
    STAFF: 'DM_NHANVIEN',
    ERRORS: 'DM_LOI',
    VIOLATIONS: 'THEODOI_VIPHAM',
    SUMMARY: 'tong_hop',
    TASKS: 'GIAO VIỆC'
  }),
  DEPARTMENTS: Object.freeze([
    'VỆ SINH MÔI TRƯỜNG',
    'ĐỒ VẢI',
    'GIÁM SÁT',
    'DỤNG CỤ',
    'VI PHẠM CHUNG'
  ])
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hệ thống Quản lý KSNK - Bệnh viện 115')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('HỆ THỐNG KSNK')
    .addItem('Khởi tạo / kiểm tra cấu trúc bảng', 'setupSystemSheets')
    .addSeparator()
    .addItem('Mở hệ thống Web', 'showWebAppDialog')
    .addItem('Mở AppSheet giao việc', 'showAppSheetDialog')
    .addToUi();
}

function onInstall() {
  onOpen();
}

function verifySystemPassword(password) {
  const configuredPassword = PropertiesService.getScriptProperties()
    .getProperty('SYSTEM_PASSWORD') || '';
  return String(password || '') === configuredPassword;
}

function getMainAppInfo() {
  return {
    author: APP_CONFIG.AUTHOR,
    webAppUrl: ScriptApp.getService().getUrl() || '',
    appSheetUrl: APP_CONFIG.APPSHEET_URL
  };
}

function showWebAppDialog() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('Ứng dụng chưa được triển khai dưới dạng Web app.');
    return;
  }
  showExternalLinkDialog_(url, 'Đang mở hệ thống KSNK...');
}

function showAppSheetDialog() {
  showExternalLinkDialog_(APP_CONFIG.APPSHEET_URL, 'Đang mở AppSheet...');
}

function showExternalLinkDialog_(url, title) {
  const safeUrl = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + safeUrl + '", "_blank");google.script.host.close();<\/script>'
  ).setWidth(320).setHeight(70);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

/**
 * HÀM CŨ: chỉ kiểm tra/tạo 5 sheet cũ. Không tạo sheet mới ở đây.
 * Vì vậy người đang dùng hệ thống cũ có thể chạy lại mà cấu trúc cũ không đổi.
 */
function setupSystemSheets() {
  const definitions = [
    { name: APP_CONFIG.SHEETS.STAFF, headers: ['Mã NV', 'Họ và tên', 'Bộ phận', 'Chức vụ', 'Số điện thoại', 'Trạng thái'] },
    { name: APP_CONFIG.SHEETS.ERRORS, headers: ['Mã lỗi', 'Tên lỗi', 'Bộ phận', 'Mức độ', 'Điểm trừ', 'Ghi chú', 'Trạng thái'] },
    { name: APP_CONFIG.SHEETS.VIOLATIONS, headers: ['Mã VP', 'Ngày vi phạm', 'Mã NV', 'Họ tên', 'Bộ phận', 'Mã lỗi', 'Tên lỗi', 'Mức độ', 'Điểm trừ', 'Người ghi nhận', 'Ghi chú', 'Trạng thái'] },
    { name: APP_CONFIG.SHEETS.SUMMARY, headers: ['Mã NV', 'Họ tên', 'Bộ phận', 'Chức vụ', 'Tổng điểm trừ', 'Điểm bình xét', 'Xếp loại', 'Kỳ bình xét', 'Thời gian lưu'] },
    { name: APP_CONFIG.SHEETS.TASKS, headers: ['ID', 'Người thực hiện', 'Mức độ ưu tiên', 'Tiêu đề công việc', 'Nội dung / Mô tả', 'Dự phòng', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái NV', 'Ghi chú NV', 'Ảnh minh chứng', 'Đánh giá quản lý', 'Ghi chú quản lý'] }
  ];

  const ss = getAppSpreadsheet_();
  definitions.forEach(function(definition) {
    ensureSheet_(ss, definition.name, definition.headers);
  });

  SpreadsheetApp.flush();
  return 'Đã kiểm tra xong 5 bảng dữ liệu. Dữ liệu cũ được giữ nguyên.';
}

function getAppSpreadsheet_() {
  return SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
}

function ensureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).isBlank()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (sheet.getLastColumn() < headers.length) {
    const missingHeaders = headers.slice(sheet.getLastColumn());
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missingHeaders.length)
      .setValues([missingHeaders]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn()))
    .setFontWeight('bold')
    .setBackground('#1a3a8f')
    .setFontColor('#ffffff');
  return sheet;
}

function getSheetDisplayValues_(sheetName) {
  const sheet = getRequiredSheet_(sheetName);
  if (sheet.getLastRow() === 0) return [];
  return sheet.getDataRange().getDisplayValues();
}

function getRequiredSheet_(sheetName) {
  const sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Không tìm thấy sheet "' + sheetName + '". Hãy chạy setupSystemSheets().');
  }
  return sheet;
}

function parseYmdDate_(ymd) {
  if (!ymd) return null;
  const parts = String(ymd).split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDateForClient_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) !== '[object Date]' || isNaN(value.getTime())) {
    return String(value);
  }
  return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function requireText_(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(label + ' không được để trống.');
  return text;
}

function createRecordId_(prefix) {
  return prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmssSSS');
}

function findRowById_(sheet, idValue, idColumn) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues();
  const target = String(idValue || '').trim();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === target) return i + 2;
  }
  return -1;
}

function deleteRecordById_(sheetName, idValue, idColumn) {
  const sheet = getRequiredSheet_(sheetName);
  const row = findRowById_(sheet, idValue, idColumn || 1);
  if (row < 2) throw new Error('Không tìm thấy dữ liệu cần xóa.');
  sheet.deleteRow(row);
  return 'Đã xóa dữ liệu thành công.';
}

// ============================================================================
// B. KHỐI MỚI - TÁCH RIÊNG, KHÔNG ĐỔI APP_CONFIG / API CŨ
// ============================================================================
const EXT_CONFIG = Object.freeze({
  SHEETS: Object.freeze({
    CHECKLIST_FORMS_MASTER: 'DM_PHIEU_GIAMSAT',
    CHECKLIST_MASTER: 'DM_BANGKIEM',
    CHECKLIST_FORMS: 'PHIEU_GIAMSAT',
    CHECKLIST_DETAILS: 'CT_PHIEU_GIAMSAT',
    WEEKLY_PLAN: 'KE_HOACH_TUAN',
    MONTHLY_PLAN: 'KE_HOACH_THANG',
    ISSUES: 'TON_TAI_KIEN_NGHI',
    DEPT_REPORT: 'BAO_CAO_BO_PHAN',
    KPI: 'KPI_100_DIEM'
  }),
  REPORT_DEPARTMENTS: Object.freeze([
    'VỆ SINH MÔI TRƯỜNG',
    'GIÁM SÁT',
    'DỤNG CỤ',
    'ĐỒ VẢI - PHÒNG VIP'
  ]),
  CHECKLIST_SCORE: Object.freeze({
    RATE_95_100: 0,
    RATE_90_95: -3,
    RATE_80_90: -5,
    RATE_70_80: -10,
    RATE_BELOW_70: -20
  }),
  TASK_SCORE: Object.freeze({
    'XUẤT SẮC': 10,
    'TỐT': 5,
    'KHÁ': 0,
    'CHƯA ĐẠT_LÀM LẠI': -5,
    'CHƯA ĐẠT': -5,
    'KÉM': -10,
    'QUÁ HẠN': -5,
    'CHƯA BẮT ĐẦU': 0
  })
});

/** Chạy 1 lần để tạo CHỈ các sheet mới. Không chạm vào 5 sheet cũ. */
function setupExtensionSheets() {
  const definitions = [
    { name: EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER, headers: ['Mã phiếu','Tên phiếu','Bộ phận','Mô tả','Số tiêu chí','Trạng thái'] },
    // 5 cột đầu của DM_BANGKIEM GIỮ NGUYÊN logic cũ. Chỉ bổ sung cột F:I ở bên phải.
    { name: EXT_CONFIG.SHEETS.CHECKLIST_MASTER, headers: ['Mã tiêu chí','Bộ phận','Nhóm tiêu chí','Nội dung tiêu chí','Trạng thái','Mã phiếu','STT','Nội dung chi tiết','Cho phép ảnh lỗi'] },
    // A:P GIỮ NGUYÊN logic cũ. Chỉ bổ sung Q:S ở bên phải.
    { name: EXT_CONFIG.SHEETS.CHECKLIST_FORMS, headers: ['Mã phiếu','Ngày giám sát','Mã NV','Họ tên','Bộ phận','Người giám sát','Khu vực','Ca','Tổng áp dụng','Đạt','Không đạt','Tỷ lệ %','Điểm KPI','Ghi chú','Ảnh minh chứng','Thời gian lưu','Mã mẫu phiếu','Tên phiếu','Không áp dụng'] },
    // A:F GIỮ NGUYÊN logic cũ. Chỉ bổ sung G:I ở bên phải.
    { name: EXT_CONFIG.SHEETS.CHECKLIST_DETAILS, headers: ['Mã phiếu','Mã tiêu chí','Nhóm tiêu chí','Nội dung tiêu chí','Kết quả','Ghi chú','STT','Nội dung chi tiết','Hình ảnh lỗi'] },
    { name: EXT_CONFIG.SHEETS.WEEKLY_PLAN, headers: ['ID','Từ ngày','Đến ngày','Bộ phận','Nội dung','Người phụ trách','Trạng thái','Kết quả','Ghi chú','Thời gian lưu'] },
    { name: EXT_CONFIG.SHEETS.MONTHLY_PLAN, headers: ['ID','Từ ngày','Đến ngày','Bộ phận','Nội dung','Người phụ trách','Trạng thái','Kết quả','Ghi chú','Thời gian lưu'] },
    { name: EXT_CONFIG.SHEETS.ISSUES, headers: ['ID','Ngày','Bộ phận','Tồn tại / Sự cố','Nguyên nhân','Phương án khắc phục','Người phụ trách','Thời hạn','Trạng thái','Kiến nghị','Thời gian lưu'] },
    { name: EXT_CONFIG.SHEETS.DEPT_REPORT, headers: ['Thời gian lưu','Từ ngày','Đến ngày','Bộ phận','Người lọc','Nội dung JSON'] },
    { name: EXT_CONFIG.SHEETS.KPI, headers: ['Thời gian lưu','Từ ngày','Đến ngày','Mã NV','Họ tên','Bộ phận','Chức vụ','Điểm gốc','Điểm giao việc','Điểm bảng kiểm','Điểm vi phạm','Tổng điểm','Xếp loại','Chi tiết'] }
  ];
  const ss = getAppSpreadsheet_();
  definitions.forEach(function(definition) {
    ensureExtensionSheet_(ss, definition.name, definition.headers);
  });
  SpreadsheetApp.flush();
  return 'Đã tạo/kiểm tra 9 bảng mở rộng. 5 bảng cũ hoàn toàn không thay đổi.';
}

/** Hàm riêng cho sheet mới, không dùng để sửa sheet cũ. */
function ensureExtensionSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  // Không xóa dữ liệu cũ. Chỉ điền tiêu đề còn thiếu ở bên phải.
  if (sheet.getLastRow() === 0 || sheet.getRange(1,1).isBlank()) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  } else if (sheet.getLastColumn() < headers.length) {
    const oldCols = sheet.getLastColumn();
    sheet.getRange(1,oldCols+1,1,headers.length-oldCols).setValues([headers.slice(oldCols)]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,Math.max(headers.length, sheet.getLastColumn()))
    .setFontWeight('bold').setBackground('#123b8f').setFontColor('#ffffff');
  return sheet;
}

// Các helper mới; tên mới để tránh ghi đè helper cũ.
function getSheetValues_(sheetName) {
  const sheet = getRequiredSheet_(sheetName);
  if (sheet.getLastRow() < 1) return [];
  return sheet.getDataRange().getValues();
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  const d = parseFlexibleDate_(value);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(value || '');
}

function parseFlexibleDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return new Date(value.getTime());
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeText_(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
}

function inDateRange_(dateValue, fromValue, toValue) {
  const d = parseFlexibleDate_(dateValue);
  if (!d) return false;
  d.setHours(0,0,0,0);
  const f = parseFlexibleDate_(fromValue); if (f) f.setHours(0,0,0,0);
  const t = parseFlexibleDate_(toValue); if (t) t.setHours(23,59,59,999);
  return (!f || d >= f) && (!t || d <= t);
}

function overlapDateRange_(startValue, endValue, fromValue, toValue) {
  const s = parseFlexibleDate_(startValue), e = parseFlexibleDate_(endValue);
  const f = parseFlexibleDate_(fromValue), t = parseFlexibleDate_(toValue);
  if (!f && !t) return true;
  if (!s && !e) return true;
  const left = s || e, right = e || s;
  const ff = f || new Date(1900,0,1), tt = t || new Date(2999,11,31);
  return left <= tt && right >= ff;
}

function saveBase64Image_(obj, prefix) {
  if (!obj || !obj.base64) return '';
  const folder = DriveApp.getFolderById(APP_CONFIG.DRIVE_FOLDER_ID);
  const ext = (String(obj.fileName || '').match(/\.[^.]+$/) || ['.jpg'])[0];
  const name = (prefix || 'IMG') + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + ext;
  const blob = Utilities.newBlob(Utilities.base64Decode(obj.base64), obj.mimeType || 'image/jpeg', name);
  const file = folder.createFile(blob);
  return file.getId() + '|' + file.getName();
}

function getImageDataUrl(imageRef) {
  if (!imageRef) return '';
  try {
    const id = String(imageRef).split('|')[0];
    const blob = DriveApp.getFileById(id).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}
