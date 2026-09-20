/**
 * MÔ-ĐUN NHÂN SỰ DÙNG CHUNG
 * Nguồn duy nhất cho cả Giao việc và Vi phạm: sheet DM_NHANVIEN.
 */
function getStaffData() {
  return {
    rows: getSheetDisplayValues_(APP_CONFIG.SHEETS.STAFF),
    departments: APP_CONFIG.DEPARTMENTS.slice()
  };
}

function getSharedStaffNames_() {
  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.STAFF);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(6, sheet.getLastColumn()))
    .getDisplayValues();
  const seen = {};
  const names = [];

  values.forEach(function(row) {
    const name = String(row[1] || '').trim();
    const status = String(row[5] || '').trim().toLowerCase();
    const isInactive = status.indexOf('nghỉ') !== -1 || status.indexOf('ngung') !== -1;
    if (name && !isInactive && !seen[name]) {
      seen[name] = true;
      names.push(name);
    }
  });

  return names.sort(function(a, b) {
    return a.localeCompare(b, 'vi');
  });
}

function addSharedStaff(formData) {
  formData = formData || {};
  const name = requireText_(formData.ten, 'Họ và tên');
  const department = requireText_(formData.boPhan, 'Bộ phận');
  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.STAFF);
  const staffId = String(formData.maNV || '').trim() || createRecordId_('NV');

  if (findRowById_(sheet, staffId, 1) !== -1) {
    throw new Error('Mã nhân viên "' + staffId + '" đã tồn tại.');
  }

  sheet.appendRow([
    staffId,
    name,
    department,
    String(formData.chucVu || '').trim(),
    String(formData.sdt || '').trim(),
    String(formData.trangThai || 'Đang làm việc').trim()
  ]);

  return 'Đã thêm nhân viên: ' + name;
}

function updateSharedStaff(formData) {
  formData = formData || {};
  const staffId = requireText_(formData.maNV, 'Mã nhân viên');
  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.STAFF);
  const row = findRowById_(sheet, staffId, 1);

  if (row < 2) throw new Error('Không tìm thấy nhân viên cần cập nhật.');

  sheet.getRange(row, 1, 1, 6).setValues([[
    staffId,
    requireText_(formData.ten, 'Họ và tên'),
    requireText_(formData.boPhan, 'Bộ phận'),
    String(formData.chucVu || '').trim(),
    String(formData.sdt || '').trim(),
    String(formData.trangThai || 'Đang làm việc').trim()
  ]]);

  return 'Đã cập nhật nhân sự thành công.';
}

function deleteSharedStaff(staffId) {
  return deleteRecordById_(APP_CONFIG.SHEETS.STAFF, staffId, 1);
}

/**
 * Helper dùng cho các mô-đun mở rộng (Bảng kiểm/Kế hoạch/KPI).
 * Không thay đổi API hay logic Nhân sự cũ.
 */
function getActiveStaffObjects_() {
  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.STAFF);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2,1,lastRow-1,Math.max(6,sheet.getLastColumn())).getDisplayValues();
  const out = [];
  const seen = {};
  values.forEach(function(row) {
    const id = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();
    const department = String(row[2] || '').trim();
    const position = String(row[3] || '').trim();
    const status = String(row[5] || '').trim().toLowerCase();
    const inactive = status.indexOf('nghỉ') !== -1 || status.indexOf('ngung') !== -1 || status.indexOf('ngừng') !== -1;
    if (id && name && !inactive && !seen[id]) {
      seen[id] = true;
      out.push({id:id,name:name,department:department,position:position,status:String(row[5]||'')});
    }
  });
  return out.sort(function(a,b){return a.name.localeCompare(b.name,'vi');});
}
