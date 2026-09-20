/**
 * 99_KiemTraHeThong.gs
 * FILE BỔ SUNG - KHÔNG THAY ĐỔI LOGIC CŨ.
 */
function KSNK_TEST_QUYEN_VA_DU_LIEU() {
  var ss = SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
  var result = {
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    tasksSheet: APP_CONFIG.SHEETS.TASKS,
    tasksRows: 0,
    violationsSheet: APP_CONFIG.SHEETS.VIOLATIONS,
    violationsRows: 0
  };
  var taskSh = ss.getSheetByName(APP_CONFIG.SHEETS.TASKS);
  if (!taskSh) throw new Error('Không tìm thấy sheet Giao việc: ' + APP_CONFIG.SHEETS.TASKS);
  result.tasksRows = taskSh.getLastRow();

  var vpSh = ss.getSheetByName(APP_CONFIG.SHEETS.VIOLATIONS);
  if (!vpSh) throw new Error('Không tìm thấy sheet Vi phạm: ' + APP_CONFIG.SHEETS.VIOLATIONS);
  result.violationsRows = vpSh.getLastRow();

  DriveApp.getFolderById(APP_CONFIG.DRIVE_FOLDER_ID).getName();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function KSNK_TEST_GIAO_VIEC() {
  var r = getTaskInitialData();
  Logger.log('Giao việc OK. Số dòng trả về: ' + ((r && r.data) ? r.data.length : 0));
  return r;
}

function KSNK_TEST_LOI_DOT_XUAT() {
  var r = getViolationSystemData();
  Logger.log('Lỗi đột xuất OK.');
  return r;
}
