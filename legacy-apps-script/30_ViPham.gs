/**
 * MÔ-ĐUN LỖI ĐỘT XUẤT / VI PHẠM
 * GIỮ NGUYÊN CẤU TRÚC VÀ LOGIC CŨ.
 */
function getViolationSystemData() {
  const _vpSheet = getRequiredSheet_(APP_CONFIG.SHEETS.VIOLATIONS);
  if (_vpSheet.getMaxColumns() < 13) _vpSheet.insertColumnsAfter(_vpSheet.getMaxColumns(), 13 - _vpSheet.getMaxColumns());
  if (!String(_vpSheet.getRange(1,13).getDisplayValue() || '').trim()) _vpSheet.getRange(1,13).setValue('Hình ảnh');
  return {
    nhanVien: getSheetDisplayValues_(APP_CONFIG.SHEETS.STAFF),
    loaiLoi: getSheetDisplayValues_(APP_CONFIG.SHEETS.ERRORS),
    viPham: getSheetDisplayValues_(APP_CONFIG.SHEETS.VIOLATIONS),
    boPhan: APP_CONFIG.DEPARTMENTS.slice(),
    currentUser: APP_CONFIG.AUTHOR
  };
}

function saveViolation(formData) {
  formData = formData || {};
  const violationDate = parseYmdDate_(formData.ngayViPham);
  if (!violationDate) throw new Error('Ngày vi phạm không hợp lệ.');

  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.VIOLATIONS);
  const violationId = createRecordId_('VP');
  sheet.appendRow([
    violationId,
    violationDate,
    requireText_(formData.maNV, 'Mã nhân viên'),
    requireText_(formData.tenNV, 'Tên nhân viên'),
    requireText_(formData.boPhan, 'Bộ phận'),
    requireText_(formData.maLoi, 'Mã lỗi'),
    requireText_(formData.tenLoi, 'Tên lỗi'),
    String(formData.mucDo || '').trim(),
    Number(formData.diem) || 0,
    requireText_(formData.nguoiGhiNhan, 'Người ghi nhận'),
    String(formData.ghiChu || '').trim(),
    'Chưa xử lý',
    formData.image ? saveBase64Image_(formData.image, 'VP') : ''
  ]);
  sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('dd/MM/yyyy');
  return 'Đã lưu vi phạm thành công.';
}

function addViolationError(formData) {
  formData = formData || {};
  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.ERRORS);
  const errorId = String(formData.maLoi || '').trim() || createRecordId_('L');

  if (findRowById_(sheet, errorId, 1) !== -1) {
    throw new Error('Mã lỗi "' + errorId + '" đã tồn tại.');
  }

  sheet.appendRow([
    errorId,
    requireText_(formData.tenLoi, 'Tên lỗi vi phạm'),
    requireText_(formData.boPhan, 'Bộ phận'),
    String(formData.mucDo || 'Nhắc nhở').trim(),
    Number(formData.diem) || 0,
    String(formData.ghiChu || '').trim(),
    'Hoạt động'
  ]);
  return 'Đã thêm lỗi mới thành công.';
}

function saveViolationMonthlySummary(periodLabel, summaryData) {
  const data = Array.isArray(summaryData) ? summaryData : [];
  if (!data.length) throw new Error('Không có dữ liệu bình xét để lưu.');

  const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.SUMMARY);
  const timestamp = new Date();
  const rows = data.map(function(item) {
    return [
      item.maNV,
      item.tenNV,
      item.boPhan,
      item.chucVu,
      Number(item.tongDiemTru) || 0,
      Number(item.diemConLai) || 0,
      item.xepLoai,
      periodLabel,
      timestamp
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(sheet.getLastRow() - rows.length + 1, 9, rows.length, 1)
    .setNumberFormat('dd/MM/yyyy HH:mm:ss');
  return 'Đã lưu ' + rows.length + ' dòng bình xét vào sheet tong_hop.';
}

function deleteViolationRecord(violationId) {
  return deleteRecordById_(APP_CONFIG.SHEETS.VIOLATIONS, violationId, 1);
}

function deleteViolationError(errorId) {
  return deleteRecordById_(APP_CONFIG.SHEETS.ERRORS, errorId, 1);
}
