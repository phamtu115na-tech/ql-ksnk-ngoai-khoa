/**
 * MÔ-ĐUN GIAO VIỆC + BẢNG TỔNG HỢP HIỆU SUẤT TOÀN PHÒNG
 * BẢN HOÀN CHỈNH: CHỌN NGƯỜI THỰC HIỆN THÔNG MINH
 *
 * Dữ liệu công việc: sheet GIAO VIỆC trong APP_CONFIG.SPREADSHEET_ID.
 * Danh sách người thực hiện: cột B của sheet DM_NHANVIEN.
 * Kết quả KPI: sheet BANG_KE_QUA_GIAO_VIEC (tự tạo nếu chưa có).
 * Nhắc việc / ghi chú: sheet NHAC_VIEC_GHI_CHU (tự tạo nếu chưa có).
 * Dữ liệu nhắc việc độc lập, không tham gia tính KPI.
 *
 * Chỉ cần thay toàn bộ mô-đun GS giao việc cũ bằng tệp này.
 */

function getTaskInitialData() {
  try {
    const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.TASKS);
    const lastRow = sheet.getLastRow();
    const staffNames = getSharedStaffNames_();

    if (lastRow < 2) {
      return {
        data: [],
        staffs: staffNames,
        filters: {
          assignees: staffNames,
          priorities: [],
          statuses: [],
          evalStatuses: []
        },
        appSheetUrl: APP_CONFIG.APPSHEET_URL
      };
    }

    const rowCount = lastRow - 1;
    const values = sheet.getRange(2, 1, rowCount, 13).getValues();
    const statusValues = values.map(function(row) {
      return [String(row[8] || '').trim() || 'CHƯA BẮT ĐẦU'];
    });
    const evalValues = values.map(function(row) {
      return [String(row[11] || '').trim() || 'CHƯA BẮT ĐẦU'];
    });

    const data = [];
    const assignees = {};
    const priorities = {};
    const statuses = {};
    const evalStatuses = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let statusChanged = false;
    let evalChanged = false;

    values.forEach(function(row, index) {
      const sheetRow = index + 2;
      let status = statusValues[index][0];
      let evalStatus = evalValues[index][0];
      const endDate = row[7];

      if (Object.prototype.toString.call(endDate) === '[object Date]' && !isNaN(endDate.getTime())) {
        const normalizedEnd = new Date(endDate);
        normalizedEnd.setHours(0, 0, 0, 0);
        const completed = status.toLowerCase().indexOf('hoàn thành') !== -1;

        if (today.getTime() > normalizedEnd.getTime() && !completed) {
          if (status.toUpperCase() !== 'QUÁ HẠN') {
            status = 'QUÁ HẠN';
            statusValues[index][0] = status;
            statusChanged = true;
          }

          if (
            evalStatus !== 'XUẤT SẮC' &&
            evalStatus !== 'TỐT' &&
            evalStatus !== 'KHÁ' &&
            evalStatus !== 'QUÁ HẠN'
          ) {
            evalStatus = 'QUÁ HẠN';
            evalValues[index][0] = evalStatus;
            evalChanged = true;
          }
        }
      }

      const item = {
        rowId: sheetRow,
        taskId: String(row[0] || '').trim(),
        assignee: String(row[1] || '').trim(),
        priority: String(row[2] || '').trim() || 'TRUNG BÌNH',
        title: String(row[3] || '').trim(),
        description: String(row[4] || '').trim(),
        startDate: formatDateForClient_(row[6]),
        endDate: formatDateForClient_(row[7]),
        status: status,
        note: String(row[9] || '').trim(),
        imageName: String(row[10] || '').trim(),
        evalStatus: evalStatus,
        qlNote: String(row[12] || '').trim()
      };

      data.push(item);
      if (item.assignee) assignees[item.assignee] = true;
      if (item.priority) priorities[item.priority] = true;
      if (item.status) statuses[item.status] = true;
      if (item.evalStatus) evalStatuses[item.evalStatus] = true;
    });

    // Ghi theo mảng, không ghi từng ô trong vòng lặp nên tải nhanh hơn.
    if (statusChanged) {
      sheet.getRange(2, 9, rowCount, 1).setValues(statusValues);
    }
    if (evalChanged) {
      sheet.getRange(2, 12, rowCount, 1).setValues(evalValues);
    }

    staffNames.forEach(function(name) {
      assignees[name] = true;
    });

    return {
      data: data,
      staffs: staffNames,
      filters: {
        assignees: Object.keys(assignees).sort(function(a, b) {
          return a.localeCompare(b, 'vi');
        }),
        priorities: Object.keys(priorities).sort(),
        statuses: Object.keys(statuses).sort(),
        evalStatuses: Object.keys(evalStatuses).sort()
      },
      appSheetUrl: APP_CONFIG.APPSHEET_URL
    };
  } catch (error) {
    return { error: error.message };
  }
}

function addTask(formData) {
  try {
    formData = formData || {};
    const title = requireText_(formData.title, 'Tiêu đề công việc');
    const assignee = resolveTaskAssignee_(formData.assignee, '');
    const startDate = parseYmdDate_(formData.startDate);
    const endDate = parseYmdDate_(formData.endDate);

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new Error('Ngày bắt đầu không được sau ngày kết thúc.');
    }

    const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.TASKS);
    sheet.appendRow([
      createRecordId_('GV'),
      assignee,
      String(formData.priority || 'TRUNG BÌNH').trim(),
      title,
      String(formData.description || '').trim(),
      '',
      startDate || '',
      endDate || '',
      String(formData.status || 'CHƯA BẮT ĐẦU').trim(),
      String(formData.note || '').trim(),
      '',
      String(formData.evalStatus || 'CHƯA BẮT ĐẦU').trim(),
      String(formData.qlNote || '').trim()
    ]);

    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 7, 1, 2).setNumberFormat('dd/MM/yyyy');
    return { success: true, message: 'Đã tạo công việc mới.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateTask(formData) {
  try {
    formData = formData || {};
    const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.TASKS);
    const rowId = Number(formData.rowId);

    if (!Number.isInteger(rowId) || rowId < 2 || rowId > sheet.getLastRow()) {
      throw new Error('Dòng công việc không hợp lệ.');
    }

    const startDate = parseYmdDate_(formData.startDate);
    const endDate = parseYmdDate_(formData.endDate);
    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new Error('Ngày bắt đầu không được sau ngày kết thúc.');
    }

    const existingAssignee = String(
      sheet.getRange(rowId, 2).getDisplayValue() || ''
    ).trim();
    const assignee = resolveTaskAssignee_(
      formData.assignee,
      existingAssignee
    );

    sheet.getRange(rowId, 2, 1, 12).setValues([[
      assignee,
      String(formData.priority || 'TRUNG BÌNH').trim(),
      requireText_(formData.title, 'Tiêu đề công việc'),
      String(formData.description || '').trim(),
      '',
      startDate || '',
      endDate || '',
      String(formData.status || 'CHƯA BẮT ĐẦU').trim(),
      String(formData.note || '').trim(),
      String(formData.currentImageName || '').trim(),
      String(formData.evalStatus || 'CHƯA BẮT ĐẦU').trim(),
      String(formData.qlNote || '').trim()
    ]]);
    sheet.getRange(rowId, 7, 1, 2).setNumberFormat('dd/MM/yyyy');

    const imageObject = formData.imageObject;
    if (imageObject && imageObject.base64) {
      if (!APP_CONFIG.DRIVE_FOLDER_ID) {
        throw new Error('Chưa cấu hình DRIVE_FOLDER_ID.');
      }

      const mimeType = String(imageObject.mimeType || 'image/jpeg');
      if (mimeType.indexOf('image/') !== 0) {
        throw new Error('Tệp tải lên phải là hình ảnh.');
      }

      const originalName = String(imageObject.fileName || 'minh_chung.jpg')
        .replace(/[\\/:*?"<>|]/g, '_');
      const fileName = createRecordId_('IMG_') + '_' + originalName;
      const blob = Utilities.newBlob(
        Utilities.base64Decode(imageObject.base64),
        mimeType,
        fileName
      );
      const file = DriveApp.getFolderById(APP_CONFIG.DRIVE_FOLDER_ID).createFile(blob);
      sheet.getRange(rowId, 11).setValue(file.getName());
    }

    return { success: true, message: 'Đã cập nhật công việc.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Chuẩn hóa người thực hiện theo danh sách DM_NHANVIEN.
 * - Cho phép gõ không dấu ở HTML nhưng khi lưu luôn dùng đúng tên trong danh mục.
 * - Nếu nhân viên cũ đã ngừng hoạt động, vẫn cho phép giữ nguyên tên cũ khi sửa.
 */
function resolveTaskAssignee_(value, existingValue) {
  const input = requireText_(value, 'Người thực hiện');
  const staffNames = getSharedStaffNames_();

  if (!staffNames || !staffNames.length) {
    return input;
  }

  const key = normalizeTaskStaffName_(input);
  const matched = staffNames.find(function(name) {
    return normalizeTaskStaffName_(name) === key;
  });

  if (matched) {
    return String(matched).trim();
  }

  if (
    existingValue &&
    normalizeTaskStaffName_(existingValue) === key
  ) {
    return String(existingValue).trim();
  }

  throw new Error(
    'Người thực hiện không có trong danh sách DM_NHANVIEN. ' +
    'Hãy gõ tên và chọn đúng nhân viên trong danh sách.'
  );
}

function normalizeTaskStaffName_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function deleteTask(rowId) {
  try {
    const sheet = getRequiredSheet_(APP_CONFIG.SHEETS.TASKS);
    rowId = Number(rowId);

    if (!Number.isInteger(rowId) || rowId < 2 || rowId > sheet.getLastRow()) {
      throw new Error('Dòng công việc không hợp lệ.');
    }

    sheet.deleteRow(rowId);
    return { success: true, message: 'Đã xóa công việc.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getTaskImageBase64(fileName) {
  if (!fileName || !APP_CONFIG.DRIVE_FOLDER_ID) return '';

  try {
    const raw = String(fileName || '').trim();
    let file = null;

    // Tương thích ảnh đã lưu bởi bộ code mới theo dạng FILE_ID|FILE_NAME.
    if (raw.indexOf('|') !== -1) {
      const fileId = raw.split('|')[0];
      try { file = DriveApp.getFileById(fileId); } catch (ignore) {}
    }

    // Logic gốc: tìm ảnh theo tên tệp trong DRIVE_FOLDER_ID.
    if (!file) {
      const cleanName = raw.indexOf('|') !== -1 ? raw.split('|').slice(1).join('|') : raw.split('/').pop();
      const files = DriveApp.getFolderById(APP_CONFIG.DRIVE_FOLDER_ID).getFilesByName(cleanName);
      if (!files.hasNext()) return '';
      file = files.next();
    }

    return 'data:' + file.getMimeType() + ';base64,' +
      Utilities.base64Encode(file.getBlob().getBytes());
  } catch (error) {
    return '';
  }
}

/**
 * LƯU TOÀN BỘ KẾT QUẢ KPI VÀO BANG_KE_QUA_GIAO_VIEC.
 * HTML gửi cả mảng trong một lần để tránh chậm và tránh ghi thiếu dòng.
 */
function saveTaskPerformanceResults(summaryList) {
  try {
    if (!Array.isArray(summaryList) || summaryList.length === 0) {
      throw new Error('Không có dữ liệu đánh giá để lưu.');
    }

    const spreadsheet = SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
    const resultSheetName = 'BANG_KE_QUA_GIAO_VIEC';
    let sheet = spreadsheet.getSheetByName(resultSheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(resultSheetName);

    const headers = [[
      'THỜI GIAN ĐÁNH GIÁ',
      'NHÂN VIÊN',
      'TỔNG SỐ CV',
      'ĐÃ HOÀN THÀNH',
      'QUÁ HẠN CHƯA LÀM',
      'XUẤT SẮC (+10)',
      'TỐT (+5)',
      'KHÁ (0)',
      'CHƯA ĐẠT (-5)',
      'KÉM (-10)',
      'TỔNG ĐIỂM (MỐC 100)',
      'XẾP LOẠI',
      'NGÀY TẠO BÁO CÁO'
    ]];

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers[0].length)
        .setValues(headers)
        .setFontWeight('bold')
        .setBackground('#1a3a8f')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center')
        .setWrap(true);
      sheet.setFrozenRows(1);
    }

    const nowText = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );

    const rows = summaryList.map(function(item) {
      item = item || {};
      return [
        String(item.period || ''),
        String(item.assignee || ''),
        Number(item.totalTasks) || 0,
        Number(item.completedTasks) || 0,
        Number(item.overduePendingTasks) || 0,
        Number(item.countXuatSac) || 0,
        Number(item.countTot) || 0,
        Number(item.countKha) || 0,
        Number(item.countChuaDat) || 0,
        Number(item.countKem) || 0,
        Number(item.finalScore) || 0,
        String(item.ranking || ''),
        nowText
      ];
    });

    const firstRow = sheet.getLastRow() + 1;
    sheet.getRange(firstRow, 1, rows.length, headers[0].length)
      .setValues(rows)
      .setHorizontalAlignment('center');

    sheet.autoResizeColumns(1, headers[0].length);

    return {
      success: true,
      savedCount: rows.length,
      message: 'Đã lưu thành công kết quả KPI của ' + rows.length +
        ' nhân viên vào sheet "' + resultSheetName + '".'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/* ========================================================================== */
/* NHẮC VIỆC - GHI CHÚ (KHÔNG TÍNH KPI)                                     */
/* ========================================================================== */

const TASK_REMINDER_SHEET_NAME = 'NHAC_VIEC_GHI_CHU';
const TASK_REMINDER_STATUSES = [
  'CHƯA THỰC HIỆN',
  'ĐANG THỰC HIỆN',
  'ĐÃ XONG'
];
const TASK_REMINDER_HEADERS = [[
  'MÃ NHẮC VIỆC',
  'NGÀY NHẮC',
  'TIÊU ĐỀ NHẮC VIỆC',
  'NỘI DUNG / GHI CHÚ',
  'NGƯỜI LIÊN QUAN',
  'TRẠNG THÁI',
  'NGÀY TẠO',
  'CẬP NHẬT LÚC'
]];

/**
 * Có thể chạy hàm này một lần trong Apps Script để kiểm tra quyền.
 * Khi người dùng mở mục Nhắc việc, sheet cũng sẽ tự động được tạo.
 */
function setupNhacViecGhiChu() {
  try {
    const sheet = ensureTaskReminderSheet_();
    return {
      success: true,
      sheetName: sheet.getName(),
      message: 'Đã sẵn sàng sheet "' + TASK_REMINDER_SHEET_NAME + '".'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getReminderInitialData() {
  try {
    const sheet = ensureTaskReminderSheet_();
    const staffNames = getSharedStaffNames_() || [];
    const lastRow = sheet.getLastRow();
    const data = [];
    const people = {};

    staffNames.forEach(function(name) {
      if (String(name || '').trim()) people[String(name).trim()] = true;
    });

    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      values.forEach(function(row, index) {
        const person = String(row[4] || '').trim();
        if (person) people[person] = true;

        data.push({
          rowId: index + 2,
          reminderId: String(row[0] || '').trim(),
          reminderDate: formatDateForClient_(row[1]),
          title: String(row[2] || '').trim(),
          note: String(row[3] || '').trim(),
          person: person,
          status: String(row[5] || '').trim() || TASK_REMINDER_STATUSES[0],
          createdAt: formatTaskReminderDateTime_(row[6]),
          updatedAt: formatTaskReminderDateTime_(row[7])
        });
      });
    }

    return {
      data: data,
      staffs: staffNames,
      filters: {
        people: Object.keys(people).sort(function(a, b) {
          return a.localeCompare(b, 'vi');
        }),
        statuses: TASK_REMINDER_STATUSES.slice()
      },
      sheetName: TASK_REMINDER_SHEET_NAME
    };
  } catch (error) {
    return { error: error.message };
  }
}

function addReminder(formData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    formData = formData || {};
    const reminderDate = parseYmdDate_(formData.reminderDate);
    if (!reminderDate) throw new Error('Vui lòng chọn ngày nhắc.');

    const sheet = ensureTaskReminderSheet_();
    const now = new Date();
    sheet.appendRow([
      createRecordId_('NV'),
      reminderDate,
      requireText_(formData.title, 'Tiêu đề nhắc việc'),
      String(formData.note || '').trim(),
      resolveReminderPerson_(formData.person, ''),
      validateReminderStatus_(formData.status),
      now,
      now
    ]);

    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 2).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(newRow, 7, 1, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    return { success: true, message: 'Đã lưu nhắc việc.' };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function updateReminder(formData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    formData = formData || {};
    const sheet = ensureTaskReminderSheet_();
    const rowId = Number(formData.rowId);

    if (!Number.isInteger(rowId) || rowId < 2 || rowId > sheet.getLastRow()) {
      throw new Error('Dòng nhắc việc không hợp lệ.');
    }

    const reminderDate = parseYmdDate_(formData.reminderDate);
    if (!reminderDate) throw new Error('Vui lòng chọn ngày nhắc.');

    const oldValues = sheet.getRange(rowId, 1, 1, 8).getValues()[0];
    const existingPerson = String(oldValues[4] || '').trim();
    sheet.getRange(rowId, 2, 1, 7).setValues([[
      reminderDate,
      requireText_(formData.title, 'Tiêu đề nhắc việc'),
      String(formData.note || '').trim(),
      resolveReminderPerson_(formData.person, existingPerson),
      validateReminderStatus_(formData.status),
      oldValues[6] || new Date(),
      new Date()
    ]]);
    sheet.getRange(rowId, 2).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(rowId, 7, 1, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    return { success: true, message: 'Đã cập nhật nhắc việc.' };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function deleteReminder(rowId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = ensureTaskReminderSheet_();
    rowId = Number(rowId);

    if (!Number.isInteger(rowId) || rowId < 2 || rowId > sheet.getLastRow()) {
      throw new Error('Dòng nhắc việc không hợp lệ.');
    }

    sheet.deleteRow(rowId);
    return { success: true, message: 'Đã xóa nhắc việc.' };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function ensureTaskReminderSheet_() {
  if (!APP_CONFIG || !APP_CONFIG.SPREADSHEET_ID) {
    throw new Error('Chưa cấu hình APP_CONFIG.SPREADSHEET_ID.');
  }

  const spreadsheet = SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(TASK_REMINDER_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(TASK_REMINDER_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TASK_REMINDER_HEADERS[0].length)
      .setValues(TASK_REMINDER_HEADERS)
      .setFontWeight('bold')
      .setBackground('#9c1c2b')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 42);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 260);
    sheet.setColumnWidth(4, 420);
    sheet.setColumnWidth(5, 180);
    sheet.setColumnWidth(6, 160);
    sheet.setColumnWidth(7, 150);
    sheet.setColumnWidth(8, 150);
  }

  return sheet;
}

function validateReminderStatus_(value) {
  const status = String(value || TASK_REMINDER_STATUSES[0]).trim().toUpperCase();
  if (TASK_REMINDER_STATUSES.indexOf(status) === -1) {
    throw new Error('Trạng thái nhắc việc không hợp lệ.');
  }
  return status;
}

function resolveReminderPerson_(value, existingValue) {
  const input = String(value || '').trim();
  if (!input) return '';

  const staffNames = getSharedStaffNames_() || [];
  if (!staffNames.length) return input;

  const key = normalizeTaskStaffName_(input);
  const matched = staffNames.find(function(name) {
    return normalizeTaskStaffName_(name) === key;
  });
  if (matched) return String(matched).trim();

  if (existingValue && normalizeTaskStaffName_(existingValue) === key) {
    return String(existingValue).trim();
  }

  throw new Error(
    'Người liên quan không có trong danh sách DM_NHANVIEN. ' +
    'Hãy gõ tên và chọn đúng người trong danh sách.'
  );
}

function formatTaskReminderDateTime_(value) {
  if (Object.prototype.toString.call(value) !== '[object Date]' || isNaN(value.getTime())) {
    return String(value || '').trim();
  }
  return Utilities.formatDate(
    value,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm:ss'
  );
}
