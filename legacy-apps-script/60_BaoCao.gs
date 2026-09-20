/**
 * ============================================================
 * 60_BaoCao.gs
 * BÁO CÁO TỔNG HỢP KSNK - BẢN HOÀN CHỈNH V12
 *
 * ĐẶC THÙ:
 * - VỆ SINH MÔI TRƯỜNG có báo cáo riêng:
 *   1. Kế hoạch tuần
 *   2. Kế hoạch tháng
 *   3. Công việc trọng điểm / đột xuất
 *   4. Chỉ số tổng quan
 *   5. Phân tích bảng kiểm
 *   6. Thống kê lỗi phát hiện
 *   7. Chi tiết lỗi & hình ảnh
 *   8. Ma trận lỗi nhân viên theo tiêu chí
 *   9. Tổng hợp lỗi nhân viên
 *   10. Nhật ký sự cố
 *   11. Tồn tại khác & kiến nghị
 *
 * NGUỒN NHÂN VIÊN:
 * - DM_NHANVIEN
 *
 * NGUỒN VỊ TRÍ / KHU VỰC:
 * - PHIEU_GIAMSAT cột G = Khu vực
 *
 * V12: Lưu mới / mở lại / sửa Ý kiến, Nhật ký sự cố, Tồn tại & kiến nghị.
 * Không khai báo doGet() trong file này.
 * ============================================================
 */


/**
 * ============================================================
 * MA TRẬN TIÊU CHÍ VSMT CỐ ĐỊNH
 * Nhân viên KHÔNG cố định: lấy từ DM_NHANVIEN.
 * Vị trí KHÔNG cố định: lấy từ PHIEU_GIAMSAT.Khu vực.
 * ============================================================
 */
const BC_VSMT_MATRIX_CRITERIA = Object.freeze([
  'THÁI ĐỘ TÁC PHONG',
  'Giao tiếp đúng mực, không có phản ánh từ đồng nghiệp hoặc người bệnh',
  'CÔNG TÁC CHUẨN BỊ VÀ TUÂN THỦ QUY TRÌNH VỆ SINH',
  'Mang phòng hộ cá nhân đầy đủ',
  'Mặc đồng phục đúng quy định',
  'Vào vị trí làm việc đúng giờ',
  'Xe vệ sinh sắp xếp đúng quy định, sạch sẽ, gọn gàng',
  'Hóa chất vệ sinh đầy đủ, chai có nhãn đúng quy định, không dùng chai không có nhãn mác',
  'Pha hóa chất đúng tỷ lệ theo quy trình',
  'Tải lau đầy đủ, sử dụng đúng màu theo khu vực',
  'VỆ SINH MÔI TRƯỜNG CHUNG',
  'Đặt biển cảnh báo sàn chống trơn trượt',
  'Vệ sinh phòng sạch sẽ sau khi BN ra viện, phòng trống làm định kỳ 2 lần/ tuần',
  'Thực hiện vệ sinh đúng quy định, quy trình, nguyên tắc',
  'Sàn nhà sạch, không rác nổi, không bẩn, không có mùi',
  'Tường, chân tường không bám bụi, bẩn',
  'Trần nhà không có màng nhện',
  'Lan can hành lang sạch sẽ, không bụi bám, không bẩn',
  'Hộp PCCC không bụi, không bẩn',
  'Cầu thang máy sạch (sàn, buồng thang, rãnh, kính), không rác, không bụi, không dấu vân tay, không mùi',
  'Cầu thang bộ sạch, sàn tường không rác, không màng nhện',
  'Cây nước uống sạch, không bụi, không bẩn',
  'Khung cửa, kệ cửa sạch, không có bụi, bẩn',
  'Kính sạch, không có sọc, vân tay, bụi bẩn',
  'Nhà vệ sinh sạch, không mùi, không đọng nước',
  'Thùng rác sạch, có túi đúng màu, thu gom đúng quy định'
]);

const BC_VSMT_DEPARTMENT = 'VỆ SINH MÔI TRƯỜNG';
const BC_VSMT_ALERT_THRESHOLD = 2;

const BC_REPORT_OPINION_SHEET = 'Y_KIEN_BAO_CAO';
const BC_REPORT_OPINION_HISTORY_SHEET = 'Y_KIEN_BAO_CAO_LICH_SU';
const BC_KPI_REGULAR_WEIGHT = 0.70;
const BC_KPI_SUDDEN_WEIGHT = 0.30;

/*
 * V11.4 - Bộ trợ giúp ghi dữ liệu báo cáo.
 *
 * Một số dự án cũ dùng APP_CONFIG.SPREADSHEET, một số dự án mới dùng
 * APP_CONFIG.SPREADSHEET_ID. Hàm này chấp nhận cả hai cấu trúc và chỉ trả về
 * một Spreadsheet hợp lệ. Nhờ vậy phần đọc và phần lưu luôn cùng trỏ tới một
 * bảng tính, kể cả khi getAppSpreadsheet_ chưa được khai báo ở file khác.
 */
function bcGetWritableSpreadsheet_() {
  if (typeof getAppSpreadsheet_ === 'function') {
    var configured = getAppSpreadsheet_();
    if (configured && typeof configured.getSheetByName === 'function') {
      return configured;
    }
  }

  var spreadsheetId = '';

  if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG) {
    spreadsheetId = String(
      APP_CONFIG.SPREADSHEET_ID ||
      APP_CONFIG.SPREADSHEET ||
      APP_CONFIG.SS_ID ||
      ''
    ).trim();
  }

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  throw new Error(
    'Không xác định được bảng tính lưu dữ liệu. Hãy khai báo ' +
    'APP_CONFIG.SPREADSHEET_ID hoặc APP_CONFIG.SPREADSHEET.'
  );
}


function bcReportAuthor_() {
  if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.AUTHOR) {
    return String(APP_CONFIG.AUTHOR).trim();
  }

  try {
    return String(Session.getActiveUser().getEmail() || '').trim();
  } catch (e) {
    return '';
  }
}


function bcPrepareHeaderRow_(sheet, headers, background) {
  if (!sheet) {
    throw new Error('Không tìm thấy sheet cần lưu dữ liệu.');
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  /*
   * Nếu hàng tiêu đề cũ từng được gộp ô, setValues/setValue sẽ báo lỗi
   * "Cannot change part of a merged cell" và làm mọi nút LƯU dừng lại.
   */
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  try {
    headerRange.breakApart();
  } catch (e) {}

  headerRange
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground(background || '#123b8f')
    .setFontColor('#ffffff')
    .setWrap(true);

  sheet.setFrozenRows(1);
  return sheet;
}


function bcSaveApiJson_(callback) {
  var lock = null;

  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    var data = callback();
    return JSON.stringify({
      success: true,
      apiVersion: 'KS_REPORT_SAVE_V11_4',
      data: data || {}
    });
  } catch (err) {
    return JSON.stringify({
      success: false,
      apiVersion: 'KS_REPORT_SAVE_V11_4',
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? String(err.stack) : ''
    });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}



const BC_SPECIAL_DEPARTMENTS = Object.freeze([
  'VỆ SINH MÔI TRƯỜNG',
  'DỤNG CỤ',
  'ĐỒ VẢI',
  'GIÁM SÁT'
]);

/**
 * Nguồn CSSD bên ngoài.
 * LƯU Ý: KHÔNG dùng @OnlyCurrentDoc vì cần SpreadsheetApp.openById().
 */
const BC_CSSD_SOURCE_SPREADSHEET_ID =
  'REPLACE_WITH_PRIVATE_CSSD_SPREADSHEET_ID';

const BC_CSSD_SOURCE_SHEET = 'DỤNG CỤ BẬN';

/**
 * Nếu muốn tính % công suất so với định mức/ngày, nhập số bộ/ngày.
 * Để 0 = không áp định mức, chỉ hiển thị sản lượng thực tế.
 */
const BC_CSSD_TARGET_PER_DAY = 0;



/**
 * ============================================================
 * 1. DỮ LIỆU KHỞI TẠO BÁO CÁO
 * ============================================================
 */
function getKsReportInitialData() {
  setupBaoCaoNangCao();

  var staff = bcGetActiveStaff_();
  var departments = [];

  /*
   * Giữ nguyên danh sách Bộ phận cấu hình cũ và bổ sung an toàn
   * các Bộ phận thực tế đang có trong DM_NHANVIEN.
   * Không thay đổi tên/logic các Bộ phận cũ.
   */
  (APP_CONFIG.DEPARTMENTS || []).forEach(function(name) {
    name = String(name || '').trim();
    if (name && departments.indexOf(name) === -1) {
      departments.push(name);
    }
  });

  staff.forEach(function(x) {
    var name = String((x && x.department) || '').trim();
    if (name && departments.indexOf(name) === -1) {
      departments.push(name);
    }
  });

  return {
    departments: departments,
    staff: staff,
    currentUser: APP_CONFIG.AUTHOR
  };
}


/**
 * ============================================================
 * 2. API CHÍNH - BÁO CÁO THEO BỘ PHẬN
 * ============================================================
 */
function getKsDepartmentReport(filters) {
  filters = filters || {};

  var from = String(filters.from || '').trim();
  var to = String(filters.to || '').trim();
  var department = String(filters.department || '').trim();
  var person = String(filters.person || '').trim();

  if (bcIsSpecialDepartment_(department)) {
    return bcBuildSpecialDepartmentReport_(
      from,
      to,
      department,
      person
    );
  }

  return bcBuildGenericReport_(
    from,
    to,
    department,
    person
  );
}


/**
 * ============================================================
 * 3. BÁO CÁO CHUNG CÁC BỘ PHẬN KHÁC
 * ============================================================
 */
function bcBuildGenericReport_(from, to, department, person) {
  var weekly = bcGetPlanRows_('WEEK', from, to, department, person);
  var monthly = bcGetPlanRows_('MONTH', from, to, department, person);
  var tasks = bcGetTaskRows_(from, to, department, person);
  var checks = bcGetChecklistFormRows_(from, to, department, person);
  var violations = bcGetViolationRows_(from, to, department, person);
  var issues = bcGetIssueRows_(from, to, department);

  var taskDone = tasks.filter(function(x) {
    return bcNorm_(x.status).indexOf('hoan thanh') !== -1;
  }).length;

  var overdue = tasks.filter(function(x) {
    return bcNorm_(x.status).indexOf('qua han') !== -1 ||
           bcNorm_(x.evalStatus).indexOf('qua han') !== -1;
  }).length;

  var avgRate = checks.length
    ? Math.round(checks.reduce(function(s, x) { return s + Number(x.rate || 0); }, 0) * 100 / checks.length) / 100
    : 0;

  var nextWeekPlan = bcBuildNextWeekPlan_(
    to,
    department,
    person
  );

  return {
    reportType: 'GENERIC',
    filters: { from: from, to: to, department: department, person: person },
    weekly: weekly,
    monthly: monthly,
    tasks: tasks,
    checks: checks,
    violations: violations,
    issues: issues,
    nextWeekPlan: nextWeekPlan,
    summary: {
      weeklyTotal: weekly.length,
      weeklyDone: weekly.filter(function(x) { return bcIsDone_(x.status); }).length,
      monthlyTotal: monthly.length,
      monthlyDone: monthly.filter(function(x) { return bcIsDone_(x.status); }).length,
      taskTotal: tasks.length,
      taskDone: taskDone,
      overdue: overdue,
      checklistForms: checks.length,
      checklistAvgRate: avgRate,
      checklistFails: checks.reduce(function(s, x) { return s + Number(x.fail || 0); }, 0),
      violationCount: violations.length,
      violationPoints: violations.reduce(function(s, x) { return s + Math.abs(Number(x.points || 0)); }, 0),
      issueCount: issues.length
    }
  };
}


/**
 * ============================================================
 * 4. BÁO CÁO ĐẶC THÙ VỆ SINH MÔI TRƯỜNG
 * ============================================================
 */
function bcBuildSpecialDepartmentReport_(
  from,
  to,
  department,
  person
) {
  setupBaoCaoNangCao();
  var weekly = bcGetPlanRows_(
    'WEEK',
    from,
    to,
    department,
    person
  );

  var monthly = bcGetPlanRows_(
    'MONTH',
    from,
    to,
    department,
    person
  );

  var tasks = bcGetTaskRows_(
    from,
    to,
    department,
    person
  );

  var forms = bcGetChecklistFormRows_(
    from,
    to,
    department,
    person
  );

  var details = bcGetChecklistDetailRows_(
    forms
  );

  var violations = bcGetViolationRows_(
    from,
    to,
    department,
    person
  );

  var issues = bcGetIssueRows_(
    from,
    to,
    department
  );

  var failDetails = details.filter(
    function(x) {
      var s = bcNorm_(x.result);
      return (
        s === 'khong dat' ||
        s === 'kem'
      );
    }
  );

  var errorStats =
    bcBuildErrorStats_(
      failDetails
    );

  var errorDetails =
    bcBuildErrorDetailRows_(
      failDetails
    );

  var matrix =
    bcBuildDepartmentMatrix_(
      from,
      to,
      forms,
      details,
      department,
      person
    );

  var suddenErrorStats = bcBuildSuddenErrorStats_(violations);

  var formMatrices = bcBuildFormMatrixReports_(
    from,
    to,
    department,
    person,
    forms,
    details
  );

  /*
   * KPI BÁO CÁO PHẢI DÙNG ĐÚNG LOGIC CỦA 70_KPI.gs.
   * Không tự tạo công thức KPI riêng trong Báo cáo.
   */
  var kpiReport = bcBuildOfficialKpiReport_(
    from,
    to,
    department,
    person
  );

  var routineAnalysis = bcBuildSmartErrorAnalysis_(
    errorStats,
    'THƯỜNG QUY'
  );

  var suddenAnalysis = bcBuildSmartSuddenAnalysis_(
    suddenErrorStats
  );

  var incidentIssues = issues.filter(function(x) {
    return (
      String(
        x.type || ''
      ).toUpperCase() ===
      BC_ISSUE_TYPE_INCIDENT
    );
  });

  var otherIssues = issues.filter(function(x) {
    return (
      String(
        x.type || ''
      ).toUpperCase() ===
      BC_ISSUE_TYPE_OTHER
    );
  });

  var overallOpinion = bcGetOneReportOpinion_(
    from,
    to,
    department,
    person,
    '__TONG_THE__'
  );

  var taskDone =
    tasks.filter(function(x) {
      return (
        bcNorm_(x.status)
          .indexOf('hoan thanh') !== -1
      );
    }).length;

  var overdue =
    tasks.filter(function(x) {
      return (
        bcNorm_(x.status)
          .indexOf('qua han') !== -1
        ||
        bcNorm_(x.evalStatus)
          .indexOf('qua han') !== -1
      );
    }).length;

  var avgRate =
    forms.length
      ? Math.round(
          forms.reduce(
            function(s, x) {
              return (
                s +
                Number(x.rate || 0)
              );
            },
            0
          ) *
          100 /
          forms.length
        ) / 100
      : 0;

  var nextWeekPlan =
    bcBuildNextWeekPlan_(
      to,
      department,
      person
    );

  /*
   * Công suất CSSD là chỉ số CẤP BỘ PHẬN.
   * Không lọc theo person vì đây là sản lượng toàn tổ.
   */
  var capacity = null;

  if (
    bcSameText_(
      department,
      'DỤNG CỤ'
    )
  ) {
    capacity =
      bcGetCssdExternalCapacity_(
        from,
        to
      );
  }

  return {
    reportType: 'SPECIAL',

    specialDepartment:
      department,

    /*
     * Cấu hình phông tiêu đề riêng cho từng tổ.
     */
    reportHero:
      bcGetDepartmentReportHero_(
        department
      ),

    filters: {
      from: from,
      to: to,
      department: department,
      person: person
    },

    capacity: capacity,

    weekly: weekly,
    monthly: monthly,
    tasks: tasks,
    checks: forms,
    violations: violations,
    issues: issues,

    nextWeekPlan:
      nextWeekPlan,

    errorStats:
      errorStats,

    errorDetails:
      errorDetails,

    suddenErrorStats:
      suddenErrorStats,

    routineAnalysis:
      routineAnalysis,

    suddenAnalysis:
      suddenAnalysis,

    formMatrices:
      formMatrices,

    kpiReport:
      kpiReport,

    incidentIssues:
      incidentIssues,

    otherIssues:
      otherIssues,

    overallOpinion:
      overallOpinion,

    matrixCriteria:
      matrix.criteria || [],

    matrixStaff:
      matrix.staff || [],

    matrixRows:
      matrix.rows || [],

    staffSummary:
      matrix.summary || [],

    summary: {
      weeklyTotal:
        weekly.length,

      weeklyDone:
        weekly.filter(
          function(x) {
            return bcIsDone_(
              x.status
            );
          }
        ).length,

      monthlyTotal:
        monthly.length,

      monthlyDone:
        monthly.filter(
          function(x) {
            return bcIsDone_(
              x.status
            );
          }
        ).length,

      taskTotal:
        tasks.length,

      taskDone:
        taskDone,

      overdue:
        overdue,

      checklistForms:
        forms.length,

      checklistAvgRate:
        avgRate,

      checklistApplied:
        forms.reduce(
          function(s, x) {
            return (
              s +
              Number(
                x.applied || 0
              )
            );
          },
          0
        ),

      checklistPass:
        forms.reduce(
          function(s, x) {
            return (
              s +
              Number(
                x.pass || 0
              )
            );
          },
          0
        ),

      checklistFails:
        forms.reduce(
          function(s, x) {
            return (
              s +
              Number(
                x.fail || 0
              )
            );
          },
          0
        ),

      checklistNa:
        forms.reduce(
          function(s, x) {
            return (
              s +
              Number(
                x.na || 0
              )
            );
          },
          0
        ),

      uniqueErrors:
        errorStats.length,

      errorRecords:
        failDetails.length,

      warningErrors:
        errorStats.filter(
          function(x) {
            return x.overThreshold;
          }
        ).length,

      violationCount:
        violations.length,

      violationPoints:
        violations.reduce(
          function(s, x) {
            return (
              s +
              Math.abs(
                Number(
                  x.points || 0
                )
              )
            );
          },
          0
        ),

      issueCount:
        issues.length
    }
  };
}


/**
 * Giữ tương thích nếu code khác còn gọi tên cũ.
 */
function bcBuildVsmtReport_(
  from,
  to,
  person
) {
  return bcBuildSpecialDepartmentReport_(
    from,
    to,
    BC_VSMT_DEPARTMENT,
    person
  );
}



/**
 * ============================================================
 * BÁO CÁO NÂNG CAO V10
 * ============================================================
 */
function setupBaoCaoNangCao() {
  var ss = bcGetWritableSpreadsheet_();

  /*
   * Bổ sung cột ảnh khắc phục cho CT_PHIEU_GIAMSAT.
   * Chỉ thêm cột bên phải, KHÔNG xóa/đổi dữ liệu cũ.
   */
  bcEnsureChecklistCorrectiveImageColumn_(ss);

  /*
   * V11.2:
   * Khởi tạo đồng bộ sheet ý kiến + lịch sử chỉnh sửa.
   */
  var opinionSetup =
    bcSetupReportOpinionV112_();

  return {
    success:true,
    sheet:opinionSetup.mainSheet.getName(),
    historySheet:
      opinionSetup.historySheet.getName()
  };
}



function bcEnsureChecklistCorrectiveImageColumn_(ss) {
  try {
    var detailSheetName =
      bcSheetName_(
        'CHECKLIST_DETAILS',
        'CT_PHIEU_GIAMSAT'
      );

    var sh =
      ss.getSheetByName(
        detailSheetName
      );

    if (!sh) {
      return;
    }

    /*
     * Cấu trúc hiện tại A:I.
     * Bổ sung J = Hình ảnh khắc phục.
     */
    if (
      sh.getMaxColumns() < 10
    ) {
      sh.insertColumnsAfter(
        sh.getMaxColumns(),
        10 -
        sh.getMaxColumns()
      );
    }

    var currentHeader =
      String(
        sh.getRange(
          1,
          10
        ).getDisplayValue() ||
        ''
      ).trim();

    if (!currentHeader) {
      sh.getRange(
        1,
        10
      ).setValue(
        'Hình ảnh khắc phục'
      );
    }
  } catch (e) {
    /*
     * Không chặn toàn bộ báo cáo nếu sheet chi tiết chưa tồn tại.
     */
  }
}



/**
 * ============================================================
 * V11.2 - Ý KIẾN KHẮC PHỤC / KẾT LUẬN
 * GIỐNG CÁCH QUẢN LÝ MỤC 10 & 11
 * ============================================================
 *
 * Khóa bản ghi:
 * - Từ ngày
 * - Đến ngày
 * - Bộ phận
 * - Người lọc
 * - Mã phiếu
 *
 * Y_KIEN_BAO_CAO:
 * - giữ BẢN HIỆN TẠI mới nhất.
 *
 * Y_KIEN_BAO_CAO_LICH_SU:
 * - ghi lại LƯU / CẬP NHẬT / XÓA
 * - không làm mất dấu nội dung cũ.
 */
function bcSetupReportOpinionV112_() {
  var ss = bcGetWritableSpreadsheet_();

  var sh =
    ss.getSheetByName(
      BC_REPORT_OPINION_SHEET
    );

  if (!sh) {
    sh =
      ss.insertSheet(
        BC_REPORT_OPINION_SHEET
      );
  }

  var headers = [
    'Mã ý kiến',
    'Từ ngày',
    'Đến ngày',
    'Bộ phận',
    'Người lọc',
    'Mã phiếu',
    'Tên phiếu',
    'Ý kiến khắc phục của tổ trưởng',
    'Người nhập',
    'Cập nhật lúc',
    'Ngày tạo',
    'Số lần cập nhật',
    'Trạng thái'
  ];

  bcPrepareHeaderRow_(
    sh,
    headers,
    '#123b8f'
  );

  var historySheet =
    ss.getSheetByName(
      BC_REPORT_OPINION_HISTORY_SHEET
    );

  if (!historySheet) {
    historySheet =
      ss.insertSheet(
        BC_REPORT_OPINION_HISTORY_SHEET
      );
  }

  var historyHeaders = [
    'Mã lịch sử',
    'Mã ý kiến',
    'Thao tác',
    'Từ ngày',
    'Đến ngày',
    'Bộ phận',
    'Người lọc',
    'Mã phiếu',
    'Tên phiếu',
    'Nội dung trước',
    'Nội dung sau',
    'Người thao tác',
    'Thời gian',
    'Lần cập nhật'
  ];

  bcPrepareHeaderRow_(
    historySheet,
    historyHeaders,
    '#315f9e'
  );

  return {
    mainSheet:sh,
    historySheet:historySheet
  };
}


function bcReportOpinionHistoryId_() {
  return (
    'LSYK-' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMddHHmmssSSS'
    ) +
    '-' +
    Math.floor(
      Math.random()*9000+1000
    )
  );
}


function bcFindReportOpinionRow_(
  data,
  from,
  to,
  department,
  person,
  formCode
) {
  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r = data[i];

    if (
      bcFormatDateKey_(r[1]) ===
        bcFormatDateKey_(from) &&
      bcFormatDateKey_(r[2]) ===
        bcFormatDateKey_(to) &&
      bcSameText_(
        r[3],
        department
      ) &&
      bcSameText_(
        r[4],
        person
      ) &&
      bcSameText_(
        r[5],
        formCode
      )
    ) {
      return i + 1;
    }
  }

  return 0;
}


function bcWriteReportOpinionHistory_(
  historySheet,
  action,
  id,
  from,
  to,
  department,
  person,
  formCode,
  formName,
  oldOpinion,
  newOpinion,
  author,
  revision
) {
  var now = new Date();

  historySheet.appendRow([
    bcReportOpinionHistoryId_(),
    id,
    action,
    bcParseDate_(from) || from,
    bcParseDate_(to) || to,
    department,
    person,
    formCode,
    formName,
    oldOpinion || '',
    newOpinion || '',
    author || '',
    now,
    revision || 1
  ]);

  var row =
    historySheet.getLastRow();

  historySheet.getRange(
    row,
    4,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  historySheet.getRange(
    row,
    13
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );
}


/**
 * API lấy riêng ý kiến hiện tại.
 */
function getReportOpinionV112(payload) {
  payload = payload || {};

  return bcGetOneReportOpinion_(
    String(
      payload.from || ''
    ).trim(),
    String(
      payload.to || ''
    ).trim(),
    String(
      payload.department || ''
    ).trim(),
    String(
      payload.person || ''
    ).trim(),
    String(
      payload.formCode ||
      '__TONG_THE__'
    ).trim()
  );
}


function saveReportOpinion(payload) {
  payload = payload || {};

  var from =
    String(
      payload.from || ''
    ).trim();

  var to =
    String(
      payload.to || ''
    ).trim();

  var department =
    String(
      payload.department || ''
    ).trim();

  var person =
    String(
      payload.person || ''
    ).trim();

  var formCode =
    String(
      payload.formCode ||
      '__TONG_THE__'
    ).trim();

  var formName =
    String(
      payload.formName || ''
    ).trim();

  var opinion =
    String(
      payload.opinion || ''
    ).trim();

  if (!from || !to) {
    throw new Error(
      'Thiếu khoảng ngày báo cáo.'
    );
  }

  if (!department) {
    throw new Error(
      'Thiếu Bộ phận.'
    );
  }

  var setup =
    bcSetupReportOpinionV112_();

  var sh =
    setup.mainSheet;

  var historySheet =
    setup.historySheet;

  var data =
    sh.getDataRange()
      .getValues();

  var rowFound =
    bcFindReportOpinionRow_(
      data,
      from,
      to,
      department,
      person,
      formCode
    );

  var now =
    new Date();

  var author = bcReportAuthor_();

  var oldOpinion = '';
  var createdAt = now;
  var revision = 1;
  var action = 'LƯU MỚI';

  if (rowFound) {
    oldOpinion =
      String(
        data[rowFound - 1][7] ||
        ''
      );

    createdAt =
      data[rowFound - 1][10]
        instanceof Date
          ? data[rowFound - 1][10]
          : (
              data[rowFound - 1][9]
                instanceof Date
                  ? data[rowFound - 1][9]
                  : now
            );

    revision =
      Math.max(
        1,
        Number(
          data[rowFound - 1][11] ||
          1
        )
      ) + 1;

    action =
      'CẬP NHẬT';
  }

  var id =
    rowFound
      ? String(
          data[rowFound - 1][0] ||
          bcReportOpinionId_()
        )
      : bcReportOpinionId_();

  var values = [[
    id,
    bcParseDate_(from) || from,
    bcParseDate_(to) || to,
    department,
    person,
    formCode,
    formName,
    opinion,
    author,
    now,
    createdAt,
    revision,
    'Đã lưu'
  ]];

  if (rowFound) {
    sh.getRange(
      rowFound,
      1,
      1,
      13
    ).setValues(values);

  } else {
    sh.appendRow(
      values[0]
    );

    rowFound =
      sh.getLastRow();
  }

  sh.getRange(
    rowFound,
    2,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    rowFound,
    10,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );

  bcWriteReportOpinionHistory_(
    historySheet,
    action,
    id,
    from,
    to,
    department,
    person,
    formCode,
    formName,
    oldOpinion,
    opinion,
    author,
    revision
  );

  SpreadsheetApp.flush();

  return {
    success:true,

    mode:
      action === 'LƯU MỚI'
        ? 'CREATE'
        : 'UPDATE',

    message:
      action === 'LƯU MỚI'
        ? 'Đã lưu ý kiến khắc phục cho kỳ báo cáo.'
        : 'Đã cập nhật ý kiến khắc phục cho kỳ báo cáo.',

    id:id,
    opinion:opinion,
    author:author,
    updatedAt:
      bcFormatDateTimeSafe_(
        now
      ),
    revision:revision,
    exists:true,
    status:'Đã lưu'
  };
}

function bcGetOneReportOpinion_(
  from,
  to,
  department,
  person,
  formCode
) {
  var setup =
    bcSetupReportOpinionV112_();

  var sh =
    setup.mainSheet;

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return {
      exists:false,
      id:'',
      opinion:'',
      author:'',
      updatedAt:'',
      createdAt:'',
      revision:0,
      status:''
    };
  }

  var data =
    sh.getDataRange()
      .getValues();

  /*
   * Chỉ lấy ĐÚNG kỳ báo cáo.
   * Không lấy kỳ ngày chồng lấn.
   */
  for (
    var i = data.length - 1;
    i >= 1;
    i--
  ) {
    var r = data[i];

    if (
      bcFormatDateKey_(r[1]) ===
        bcFormatDateKey_(from) &&
      bcFormatDateKey_(r[2]) ===
        bcFormatDateKey_(to) &&
      bcSameText_(
        r[3],
        department
      ) &&
      bcSameText_(
        r[4],
        person
      ) &&
      bcSameText_(
        r[5],
        formCode
      )
    ) {
      var status =
        String(
          r[12] || 'Đã lưu'
        ).trim();

      /*
       * Nếu đã XÓA nội dung:
       * không nạp lại vào báo cáo,
       * nhưng lịch sử vẫn còn.
       */
      if (
        bcNorm_(status) ===
        'da xoa'
      ) {
        return {
          exists:false,
          id:String(r[0] || ''),
          opinion:'',
          author:String(r[8] || ''),
          updatedAt:
            bcFormatDateTimeSafe_(
              r[9]
            ),
          createdAt:
            bcFormatDateTimeSafe_(
              r[10] || r[9]
            ),
          revision:
            Math.max(
              1,
              Number(r[11] || 1)
            ),
          status:status
        };
      }

      return {
        exists:true,
        id:String(r[0] || ''),
        opinion:String(r[7] || ''),
        author:String(r[8] || ''),
        updatedAt:
          bcFormatDateTimeSafe_(
            r[9]
          ),
        createdAt:
          bcFormatDateTimeSafe_(
            r[10] || r[9]
          ),
        revision:
          Math.max(
            1,
            Number(r[11] || 1)
          ),
        status:status
      };
    }
  }

  return {
    exists:false,
    id:'',
    opinion:'',
    author:'',
    updatedAt:'',
    createdAt:'',
    revision:0,
    status:''
  };
}


/**
 * XÓA NỘI DUNG Ý KIẾN KHỎI BÁO CÁO HIỆN TẠI.
 * Không xóa lịch sử:
 * bản cũ vẫn nằm trong Y_KIEN_BAO_CAO_LICH_SU.
 */
function deleteReportOpinion(payload) {
  payload = payload || {};

  var from =
    String(
      payload.from || ''
    ).trim();

  var to =
    String(
      payload.to || ''
    ).trim();

  var department =
    String(
      payload.department || ''
    ).trim();

  var person =
    String(
      payload.person || ''
    ).trim();

  var formCode =
    String(
      payload.formCode ||
      '__TONG_THE__'
    ).trim();

  var formName =
    String(
      payload.formName || ''
    ).trim();

  if (!from || !to) {
    throw new Error(
      'Thiếu khoảng ngày báo cáo.'
    );
  }

  if (!department) {
    throw new Error(
      'Thiếu Bộ phận.'
    );
  }

  var setup =
    bcSetupReportOpinionV112_();

  var sh =
    setup.mainSheet;

  var historySheet =
    setup.historySheet;

  var data =
    sh.getDataRange()
      .getValues();

  var rowFound =
    bcFindReportOpinionRow_(
      data,
      from,
      to,
      department,
      person,
      formCode
    );

  if (!rowFound) {
    return {
      success:true,
      message:
        'Kỳ báo cáo này chưa có ý kiến để xóa.',
      exists:false
    };
  }

  var r =
    data[rowFound - 1];

  var id =
    String(
      r[0] ||
      bcReportOpinionId_()
    );

  var oldOpinion =
    String(
      r[7] || ''
    );

  var author = bcReportAuthor_();

  var now =
    new Date();

  var createdAt =
    r[10] instanceof Date
      ? r[10]
      : (
          r[9] instanceof Date
            ? r[9]
            : now
        );

  var revision =
    Math.max(
      1,
      Number(r[11] || 1)
    ) + 1;

  sh.getRange(
    rowFound,
    1,
    1,
    13
  ).setValues([[
    id,
    bcParseDate_(from) || from,
    bcParseDate_(to) || to,
    department,
    person,
    formCode,
    formName || String(r[6] || ''),
    '',
    author,
    now,
    createdAt,
    revision,
    'Đã xóa'
  ]]);

  sh.getRange(
    rowFound,
    2,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    rowFound,
    10,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );

  bcWriteReportOpinionHistory_(
    historySheet,
    'XÓA',
    id,
    from,
    to,
    department,
    person,
    formCode,
    formName || String(r[6] || ''),
    oldOpinion,
    '',
    author,
    revision
  );

  SpreadsheetApp.flush();

  return {
    success:true,
    message:
      'Đã xóa nội dung ý kiến khỏi kỳ báo cáo. Lịch sử chỉnh sửa vẫn được giữ.',
    exists:false,
    revision:revision
  };
}


/**
 * Chạy 1 lần sau khi copy code V11.2.
 */
function setupBaoCaoOpinionV112() {
  var x =
    bcSetupReportOpinionV112_();

  return {
    success:true,
    mainSheet:
      x.mainSheet.getName(),
    historySheet:
      x.historySheet.getName(),
    message:
      'Đã sẵn sàng chức năng Lưu / Sửa / Xóa / Mở lại ý kiến báo cáo V11.2.'
  };
}


/**
 * Debug nhanh 1 kỳ báo cáo.
 */
function debugReportOpinionV112(
  from,
  to,
  department,
  person,
  formCode
) {
  return {
    success:true,
    saved:
      bcGetOneReportOpinion_(
        from,
        to,
        department,
        person || '',
        formCode ||
        '__TONG_THE__'
      )
  };
}


function bcReportOpinionId_() {
  return 'YK-' +
    Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMddHHmmss') +
    '-' + Math.floor(Math.random()*9000+1000);
}


function bcFormatDateKey_(value) {
  var d = bcParseDate_(value);
  return d
    ? Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd')
    : String(value || '').trim();
}


function bcBuildSuddenErrorStats_(violations) {
  var map = {};

  (violations || []).forEach(function(v) {
    var name = String(v.errorName || 'Lỗi chưa đặt tên').trim();
    var key = bcNorm_(name);

    if (!map[key]) {
      map[key] = {
        errorName:name,
        count:0,
        totalPoints:0,
        levels:{},
        staffMap:{}
      };
    }

    map[key].count++;
    map[key].totalPoints += Math.abs(Number(v.points || 0));

    var level = String(v.level || '').trim();
    if (level) map[key].levels[level] = (map[key].levels[level] || 0) + 1;

    var staff = String(v.name || '').trim();
    if (staff) map[key].staffMap[staff] = (map[key].staffMap[staff] || 0) + 1;
  });

  return Object.keys(map).map(function(k) {
    var x = map[k];

    return {
      errorName:x.errorName,
      count:x.count,
      totalPoints:x.totalPoints,
      levelText:Object.keys(x.levels).map(function(level) {
        return level + ': ' + x.levels[level];
      }).join(', '),
      topStaff:Object.keys(x.staffMap)
        .sort(function(a,b){ return x.staffMap[b]-x.staffMap[a]; })
        .slice(0,3)
        .map(function(n){ return n + ' (' + x.staffMap[n] + ')'; })
        .join(', '),
      alert:x.count >= BC_VSMT_ALERT_THRESHOLD
    };
  }).sort(function(a,b) {
    return b.count - a.count || b.totalPoints - a.totalPoints;
  });
}


function bcBuildFormMatrixReports_(from,to,department,person,forms,details) {
  var groups = {};

  (forms || []).forEach(function(f) {
    var code = String(f.formCode || '__KHONG_MA__').trim();

    if (!groups[code]) {
      groups[code] = {
        formCode:code,
        formName:String(f.formName || code),
        forms:[]
      };
    }

    groups[code].forms.push(f);
  });

  return Object.keys(groups).map(function(code) {
    var g = groups[code];
    var ids = {};

    g.forms.forEach(function(f){ ids[String(f.id)] = true; });

    var formDetails = (details || []).filter(function(d) {
      return !!ids[String(d.formId)];
    });

    var failDetails = formDetails.filter(function(d) {
      var s = bcNorm_(d.result);
      return s === 'khong dat' || s === 'kem';
    });

    var evaluated = formDetails.filter(function(d) {
      var s = bcNorm_(d.result);
      return s === 'dat' || s === 'khong dat' || s === 'kem';
    });

    var pass = evaluated.filter(function(d) {
      return bcNorm_(d.result) === 'dat';
    }).length;

    var matrix = bcBuildDepartmentMatrix_(
      from,to,g.forms,formDetails,department,person
    );

    var errorStats = bcBuildErrorStats_(failDetails);

    /*
     * Chi tiết lỗi riêng của đúng loại phiếu này.
     */
    var errorDetails =
      bcBuildErrorDetailRows_(
        failDetails
      );

    var passRate = evaluated.length
      ? Math.round(pass*1000/evaluated.length)/10
      : 0;

    return {
      formCode:code,
      formName:g.formName,
      formCount:g.forms.length,
      evaluated:evaluated.length,
      pass:pass,
      fail:evaluated.length-pass,
      passRate:passRate,
      staff:matrix.staff || [],
      rows:matrix.rows || [],
      summary:matrix.summary || [],
      errorStats:errorStats,

      errorDetails:
        errorDetails,

      conclusion:bcBuildFormConclusion_(
        g.formName,passRate,errorStats,matrix.summary || []
      ),
      opinion:bcGetOneReportOpinion_(
        from,to,department,person,code
      )
    };
  }).sort(function(a,b) {
    return String(a.formCode).localeCompare(String(b.formCode),'vi');
  });
}


function bcBuildFormConclusion_(formName,passRate,errorStats,staffSummary) {
  var out = [
    'Tỷ lệ đạt của "' + formName + '" trong kỳ là ' + passRate + '%.'
  ];

  if (!errorStats.length) {
    out.push('Không ghi nhận tiêu chí KHÔNG ĐẠT/KÉM trong dữ liệu đã chấm.');
    return out;
  }

  out.push(
    'Nhóm lỗi nổi bật: ' +
    errorStats.slice(0,3).map(function(x) {
      return x.errorName + ' (' + x.count + ' lần)';
    }).join('; ') + '.'
  );

  var high = (staffSummary || [])
    .filter(function(x){ return Number(x.errorRate || 0) >= 15; })
    .sort(function(a,b){ return Number(b.errorRate||0)-Number(a.errorRate||0); })
    .slice(0,3);

  if (high.length) {
    out.push(
      'Cần ưu tiên theo dõi lại: ' +
      high.map(function(x){
        return x.name + ' (' + x.errorRate + '% lỗi)';
      }).join(', ') + '.'
    );
  }

  if (passRate < 90) {
    out.push('Khuyến nghị rà soát quy trình, hướng dẫn lại tiêu chí không đạt và tăng tần suất giám sát.');
  } else if (passRate < 95) {
    out.push('Khuyến nghị duy trì giám sát trọng điểm ở các lỗi lặp lại và kiểm tra kết quả khắc phục.');
  } else {
    out.push('Kết quả chung tốt; tiếp tục duy trì và tập trung vào các lỗi lặp lại nếu có.');
  }

  return out;
}


function bcBuildSmartErrorAnalysis_(stats,label) {
  stats = stats || [];
  if (!stats.length) {
    return ['Không ghi nhận lỗi ' + String(label || '').toLowerCase() + ' trong kỳ báo cáo.'];
  }

  var total = stats.reduce(function(s,x){ return s + Number(x.count || 0); },0);
  var top = stats[0];
  var repeated = stats.filter(function(x){
    return Number(x.count || 0) >= BC_VSMT_ALERT_THRESHOLD;
  });

  return [
    'Tổng số lỗi ' + String(label || '').toLowerCase() + ': ' + total + '.',
    'Lỗi xuất hiện nhiều nhất: "' + top.errorName + '" với ' + top.count + ' lần.',
    repeated.length
      ? 'Có ' + repeated.length + ' nhóm lỗi đạt/vượt ngưỡng cảnh báo; cần lập hành động khắc phục và kiểm tra lại.'
      : 'Chưa có nhóm lỗi nào vượt ngưỡng cảnh báo lặp lại.'
  ];
}


function bcBuildSmartSuddenAnalysis_(stats) {
  stats = stats || [];
  if (!stats.length) return ['Không ghi nhận lỗi đột xuất/vi phạm trong kỳ báo cáo.'];

  var total = stats.reduce(function(s,x){ return s + Number(x.count || 0); },0);
  var points = stats.reduce(function(s,x){ return s + Number(x.totalPoints || 0); },0);
  var top = stats[0];

  var out = [
    'Ghi nhận ' + total + ' lỗi đột xuất, tổng ' + points + ' điểm trừ.',
    'Lỗi đột xuất nổi bật: "' + top.errorName + '" (' +
      top.count + ' lần, ' + top.totalPoints + ' điểm trừ).'
  ];

  if (top.topStaff) out.push('Nhân viên liên quan nhiều nhất: ' + top.topStaff + '.');

  return out;
}



/**
 * ============================================================
 * KPI TRONG BÁO CÁO - DÙNG NGUYÊN LOGIC 70_KPI.gs
 * ============================================================
 *
 * Công thức chính thức của hệ thống:
 *
 * TỔNG ĐIỂM =
 * 100
 * + Điểm giao việc
 * + Điểm bảng kiểm
 * + Điểm vi phạm
 *
 * Giao việc:
 * XUẤT SẮC +10
 * TỐT       +5
 * KHÁ        0
 * CHƯA ĐẠT / LÀM LẠI -5
 * KÉM       -10
 * QUÁ HẠN   -5
 *
 * Bảng kiểm:
 * lấy đúng cột KPI đã được 40_BangKiem.gs tính.
 *
 * Vi phạm:
 * âm tổng Điểm trừ THEODOI_VIPHAM.
 *
 * Xếp loại:
 * >=110 XUẤT SẮC
 * >=95  TỐT
 * >=80  KHÁ
 * >=65  TRUNG BÌNH
 * <65   CHƯA ĐẠT
 *
 * Hàm này ưu tiên gọi trực tiếp getKpiReport() của 70_KPI.gs,
 * để Báo cáo và menu KPI luôn cho cùng một kết quả.
 * ============================================================
 */
function bcBuildOfficialKpiReport_(
  from,
  to,
  department,
  person
) {
  if (
    typeof getKpiReport !==
    'function'
  ) {
    throw new Error(
      'Không tìm thấy hàm getKpiReport() của 70_KPI.gs. ' +
      'Hãy kiểm tra file 70_KPI.gs đang tồn tại và không bị đổi tên hàm.'
    );
  }

  var rows =
    getKpiReport({
      from:
        from || '',

      to:
        to || '',

      department:
        department || '',

      person:
        person || ''
    }) || [];

  var totalBase =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.base || 0
          )
        );
      },
      0
    );

  var totalTask =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.taskScore || 0
          )
        );
      },
      0
    );

  var totalChecklist =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.checklistScore || 0
          )
        );
      },
      0
    );

  var totalViolation =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.violationScore || 0
          )
        );
      },
      0
    );

  var totalScore =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.total || 0
          )
        );
      },
      0
    );

  var avgScore =
    rows.length
      ? Math.round(
          totalScore *
          10 /
          rows.length
        ) / 10
      : 0;

  var totalTasks =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.taskCount || 0
          )
        );
      },
      0
    );

  var totalChecks =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.checkCount || 0
          )
        );
      },
      0
    );

  var totalViolations =
    rows.reduce(
      function(s, x) {
        return (
          s +
          Number(
            x.violationCount || 0
          )
        );
      },
      0
    );

  /*
   * Xếp loại và màu lấy trực tiếp từ 70_KPI.gs.
   * Không hard-code ngưỡng tại Báo cáo.
   */
  var rankCounts = {};

  rows.forEach(
    function(x) {
      var rank =
        String(
          x.ranking || ''
        ).trim();

      if (!rank) {
        return;
      }

      rankCounts[rank] =
        (
          rankCounts[rank] ||
          0
        ) + 1;
    }
  );

  var rankingConfig =
    typeof getKpiConversionRules === 'function'
      ? getKpiConversionRules()
      : [];

  return {
    rows:
      rows,

    formula:
      '100 + Điểm giao việc + Điểm bảng kiểm + Điểm vi phạm',

    totalBase:
      totalBase,

    totalTask:
      totalTask,

    totalChecklist:
      totalChecklist,

    totalViolation:
      totalViolation,

    totalScore:
      totalScore,

    averageScore:
      avgScore,

    totalTasks:
      totalTasks,

    totalChecks:
      totalChecks,

    totalViolations:
      totalViolations,

    rankCounts:
      rankCounts,

    rankingConfig:
      rankingConfig,

    conclusion:
      bcBuildOfficialKpiConclusion_(
        rows,
        avgScore
      )
  };
}


function bcBuildOfficialKpiConclusion_(
  rows,
  average
) {
  rows =
    rows || [];

  if (!rows.length) {
    return [
      'Không có nhân viên phù hợp bộ lọc để tính KPI 100 điểm.'
    ];
  }

  var sorted =
    rows.slice()
      .sort(
        function(a, b) {
          return (
            Number(
              a.total || 0
            ) -
            Number(
              b.total || 0
            )
          );
        }
      );

  var lowest =
    sorted[0];

  var highest =
    sorted[
      sorted.length - 1
    ];

  var below95 =
    rows.filter(
      function(x) {
        return (
          Number(
            x.total || 0
          ) < 95
        );
      }
    );

  var messages = [
    'Điểm KPI bình quân của tổ trong kỳ: ' +
      average +
      ' điểm.',

    'Nhân viên có điểm cao nhất: ' +
      highest.name +
      ' (' +
      highest.total +
      ' điểm — ' +
      highest.ranking +
      ').',

    'Nhân viên có điểm thấp nhất: ' +
      lowest.name +
      ' (' +
      lowest.total +
      ' điểm — ' +
      lowest.ranking +
      ').'
  ];

  if (below95.length) {
    messages.push(
      'Có ' +
      below95.length +
      ' nhân viên dưới 95 điểm; nên xem phần Chi tiết KPI để xác định điểm trừ từ giao việc, bảng kiểm và vi phạm.'
    );
  } else {
    messages.push(
      'Tất cả nhân viên có dữ liệu KPI đều đạt từ 95 điểm trở lên.'
    );
  }

  return messages;
}


function bcBuildDepartmentKpiReport_(department,person,forms,details,violations) {
  var staff = bcGetActiveStaff_().filter(function(x) {
    if (department && !bcSameText_(x.department,department)) return false;
    if (person && !bcSameText_(x.name,person)) return false;
    return true;
  });

  var formById = {};
  (forms || []).forEach(function(f){ formById[String(f.id)] = f; });

  var rows = staff.map(function(emp) {
    var empForms = (forms || []).filter(function(f) {
      return (
        (emp.id && f.staffId && String(emp.id).trim() === String(f.staffId).trim()) ||
        bcSameText_(emp.name,f.name)
      );
    });

    var empDetails = (details || []).filter(function(d) {
      var f = formById[String(d.formId)];
      if (!f) return false;

      var same = (
        (emp.id && f.staffId && String(emp.id).trim() === String(f.staffId).trim()) ||
        bcSameText_(emp.name,f.name)
      );

      if (!same) return false;

      var s = bcNorm_(d.result);
      return s === 'dat' || s === 'khong dat' || s === 'kem';
    });

    var regularPass = empDetails.filter(function(d){
      return bcNorm_(d.result) === 'dat';
    }).length;

    var regularScore = empDetails.length
      ? Math.round(regularPass*1000/empDetails.length)/10
      : null;

    var ev = (violations || []).filter(function(v) {
      return (
        (emp.id && v.staffId && String(emp.id).trim() === String(v.staffId).trim()) ||
        bcSameText_(emp.name,v.name)
      );
    });

    var points = ev.reduce(function(s,v){
      return s + Math.abs(Number(v.points || 0));
    },0);

    var suddenScore = Math.max(0,Math.min(100,100-points));

    var combined = regularScore === null
      ? null
      : Math.round(
          (regularScore*BC_KPI_REGULAR_WEIGHT +
           suddenScore*BC_KPI_SUDDEN_WEIGHT)*10
        )/10;

    return {
      staffId:emp.id || '',
      name:emp.name || '',
      regularCount:empForms.length,
      regularEvaluated:empDetails.length,
      regularPass:regularPass,
      regularScore:regularScore,
      suddenCount:ev.length,
      suddenPoints:points,
      suddenScore:suddenScore,
      combinedScore:combined,
      rank:bcKpiRank_(combined)
    };
  });

  var valid = rows.filter(function(x){ return x.combinedScore !== null; });

  var avg = valid.length
    ? Math.round(valid.reduce(function(s,x){
        return s + Number(x.combinedScore || 0);
      },0)*10/valid.length)/10
    : 0;

  var totalEvaluated = rows.reduce(function(s,x){
    return s + Number(x.regularEvaluated || 0);
  },0);

  var totalPass = rows.reduce(function(s,x){
    return s + Number(x.regularPass || 0);
  },0);

  return {
    rows:rows,
    totalEvaluated:totalEvaluated,
    totalPass:totalPass,
    totalRoutineFail:Math.max(0,totalEvaluated-totalPass),
    totalSudden:rows.reduce(function(s,x){ return s + Number(x.suddenCount || 0); },0),
    averageScore:avg,
    conclusion:bcBuildKpiConclusion_(rows,avg)
  };
}


function bcKpiRank_(score) {
  if (score === null || typeof score === 'undefined') return 'CHƯA CÓ DỮ LIỆU';
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
}


function bcBuildKpiConclusion_(rows,average) {
  var valid = (rows || []).filter(function(x){ return x.combinedScore !== null; });

  if (!valid.length) return ['Chưa đủ dữ liệu thường quy để tính KPI tổng hợp.'];

  var sorted = valid.slice().sort(function(a,b){
    return Number(a.combinedScore||0)-Number(b.combinedScore||0);
  });

  var lowest = sorted[0];
  var below90 = valid.filter(function(x){ return Number(x.combinedScore||0) < 90; });

  return [
    'Điểm KPI tổng hợp trung bình của tổ: ' + average + '/100.',
    'Nhân viên có điểm thấp nhất: ' + lowest.name + ' (' +
      lowest.combinedScore + '/100, xếp loại ' + lowest.rank + ').',
    below90.length
      ? 'Có ' + below90.length + ' nhân viên dưới 90 điểm; cần xem lại lỗi thường quy, lỗi đột xuất và kế hoạch khắc phục.'
      : 'Không có nhân viên nào dưới 90 điểm trong dữ liệu đã đánh giá.'
  ];
}


function bcIsIncidentIssue_(issue) {
  var text = bcNorm_(
    String(issue.issue || '') + ' ' + String(issue.cause || '')
  );

  return (
    text.indexOf('su co') !== -1 ||
    text.indexOf('tai nan') !== -1 ||
    text.indexOf('loi') !== -1 ||
    text.indexOf('hong') !== -1 ||
    text.indexOf('bat thuong') !== -1
  );
}



/**
 * ============================================================
 * PHÔNG TIÊU ĐỀ BÁO CÁO RIÊNG CHO 4 TỔ
 * ============================================================
 *
 * Chỉ cần thay nội dung tại đây nếu muốn đổi:
 * - màu
 * - khẩu hiệu
 * - mô tả
 * - biểu tượng
 *
 * Không cần sửa BaoCao.html.
 * ============================================================
 */
function bcGetDepartmentReportHero_(
  department
) {
  var d =
    bcNorm_(
      department
    );

  if (
    d ===
    bcNorm_(
      'DỤNG CỤ'
    )
  ) {
    return {
      key: 'cssd',
      department:
        'TỔ XỬ LÝ DỤNG CỤ',
      title:
        'BÁO CÁO GIAO BAN',
      subtitle:
        'CHUẨN XÁC – AN TOÀN – VÔ KHUẨN',
      slogan:
        'Xử lý đúng quy trình – Đảm bảo vô khuẩn',
      icon:
        '⚙',
      accent:
        '#148447',
      accentDark:
        '#086b38',
      accentLight:
        '#e9f7ef',
      tasks: [
        'Tiếp nhận, phân loại dụng cụ',
        'Làm sạch, khử khuẩn, tiệt khuẩn',
        'Kiểm tra chất lượng sau tiệt khuẩn',
        'Lưu trữ, bảo quản dụng cụ vô khuẩn',
        'Cấp phát dụng cụ an toàn, đúng quy trình'
      ]
    };
  }

  if (
    d ===
    bcNorm_(
      'ĐỒ VẢI'
    )
  ) {
    return {
      key: 'linen',
      department:
        'TỔ ĐỒ VẢI',
      title:
        'BÁO CÁO GIAO BAN',
      subtitle:
        'ĐÚNG ĐỦ – SẠCH SẼ – KỊP THỜI',
      slogan:
        'Đồ vải sạch – Đủ – Kịp thời phục vụ chăm sóc',
      icon:
        '▤',
      accent:
        '#ef6c00',
      accentDark:
        '#c94f00',
      accentLight:
        '#fff2e7',
      tasks: [
        'Tiếp nhận, phân loại đồ vải',
        'Giặt, sấy, là, gấp theo quy trình',
        'Kiểm tra chất lượng đồ vải sạch',
        'Lưu trữ, bảo quản đồ vải',
        'Cấp phát đồ vải đầy đủ, kịp thời'
      ]
    };
  }

  if (
    d ===
    bcNorm_(
      'GIÁM SÁT'
    )
  ) {
    return {
      key: 'monitor',
      department:
        'TỔ GIÁM SÁT',
      title:
        'BÁO CÁO GIAO BAN',
      subtitle:
        'GIÁM SÁT – TUÂN THỦ – CẢI TIẾN',
      slogan:
        'Tuân thủ quy định – Cải tiến liên tục',
      icon:
        '⌕',
      accent:
        '#7b2cbf',
      accentDark:
        '#5a189a',
      accentLight:
        '#f5ebff',
      tasks: [
        'Giám sát tuân thủ quy trình KSNK',
        'Giám sát vệ sinh tay, PPE',
        'Giám sát môi trường, dụng cụ, đồ vải',
        'Theo dõi và báo cáo chỉ số KSNK',
        'Đào tạo, truyền thông và cải tiến'
      ]
    };
  }

  return {
    key: 'vsmt',
    department:
      'TỔ VỆ SINH MÔI TRƯỜNG',
    title:
      'BÁO CÁO GIAO BAN',
    subtitle:
      'SẠCH SẼ – AN TOÀN – THÂN THIỆN',
    slogan:
      'Môi trường sạch – An toàn người bệnh',
    icon:
      '✦',
    accent:
      '#1f5fbf',
    accentDark:
      '#123b8f',
    accentLight:
      '#eaf2ff',
    tasks: [
      'Vệ sinh buồng bệnh, khu vực chung',
      'Vệ sinh hành lang, cầu thang, thang máy',
      'Thu gom, phân loại, vận chuyển chất thải',
      'Kiểm tra dụng cụ và phương tiện vệ sinh',
      'Đảm bảo môi trường xanh – sạch – đẹp'
    ]
  };
}




/**
 * ============================================================
 * 5. THỐNG KÊ LỖI PHÁT HIỆN
 * ============================================================
 */
function bcBuildErrorStats_(failDetails) {
  var map = {};

  failDetails.forEach(function(x) {
    var label = String(x.detail || x.content || '').trim();
    if (!label) label = 'Lỗi chưa có mô tả';

    var key = bcNorm_(label);
    if (!map[key]) {
      map[key] = {
        errorName: label,
        count: 0
      };
    }
    map[key].count++;
  });

  return Object.keys(map)
    .map(function(k) {
      var x = map[k];
      x.overThreshold = x.count >= BC_VSMT_ALERT_THRESHOLD;
      x.thresholdText = x.overThreshold
        ? 'Vượt ngưỡng cảnh báo'
        : 'Trong giới hạn';
      return x;
    })
    .sort(function(a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.errorName).localeCompare(String(b.errorName), 'vi');
    });
}


/**
 * ============================================================
 * 6. CHI TIẾT LỖI & HÌNH ẢNH
 * ============================================================
 */
function bcBuildErrorDetailRows_(failDetails) {
  return failDetails
    .map(function(x) {
      return {
        date: x.date,
        name: x.name,
        area: x.area || 'Chưa xác định',
        errorName: String(x.detail || x.content || '').trim(),
        result: x.result,
        note: x.note || '',
        cause: 'Chưa xác định',
        action: 'Yêu cầu khắc phục',

        formCode:
          x.formCode || '',

        formName:
          x.formName || '',

        criterionId:
          x.criterionId || '',

        imageRef:
          x.imageRef || '',

        correctiveImageRef:
          x.correctiveImageRef || ''
      };
    })
    .sort(function(a, b) {
      var da = bcParseDate_(a.date);
      var db = bcParseDate_(b.date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
}


/**
 * ============================================================
 * 7. MA TRẬN VSMT
 *
 * - Cột nhân viên lấy DM_NHANVIEN.
 * - Vị trí lấy PHIEU_GIAMSAT.Khu vực trong khoảng lọc.
 * - Ô chỉ hiện KHÔNG ĐẠT / KÉM.
 * - Ô ĐẠT để trống.
 * ============================================================
 */

/**
 * ============================================================
 * 7A. TIÊU CHÍ MA TRẬN VSMT ĐỘNG
 *
 * Nguồn:
 * - DM_BANGKIEM
 *
 * Chỉ lấy:
 * - Bộ phận = VỆ SINH MÔI TRƯỜNG
 * - Trạng thái đang hoạt động
 * - Thuộc các Mã phiếu thực tế đã được chấm
 *   trong khoảng thời gian báo cáo.
 *
 * Cấu trúc DM_BANGKIEM:
 * A Mã tiêu chí
 * B Bộ phận
 * C Nhóm tiêu chí
 * D Nội dung tiêu chí
 * E Trạng thái
 * F Mã phiếu
 * G STT
 * H Nội dung chi tiết
 * I Cho phép ảnh lỗi
 * ============================================================
 */
function bcGetDepartmentMatrixCriteria_(
  forms,
  department
) {
  var sh = bcGetSheet_(
    bcSheetName_(
      'CHECKLIST_MASTER',
      'DM_BANGKIEM'
    )
  );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  var activeFormCodes = {};

  (forms || []).forEach(
    function(f) {
      var code =
        String(
          f.formCode || ''
        ).trim();

      if (code) {
        activeFormCodes[
          code
        ] = true;
      }
    }
  );

  var data =
    sh.getDataRange()
      .getDisplayValues();

  var result = [];

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r = data[i];

    var criterionId =
      String(
        r[0] || ''
      ).trim();

    var rowDepartment =
      String(
        r[1] || ''
      ).trim();

    var group =
      String(
        r[2] || ''
      ).trim();

    var content =
      String(
        r[3] || ''
      ).trim();

    var status =
      String(
        r[4] || ''
      ).trim();

    var formCode =
      String(
        r[5] || ''
      ).trim();

    var order =
      Number(
        r[6]
      ) || 0;

    var detail =
      String(
        r[7] || ''
      ).trim();

    if (!criterionId) {
      continue;
    }

    if (
      !bcSameText_(
        rowDepartment,
        department
      )
    ) {
      continue;
    }

    var statusKey =
      bcNorm_(
        status
      );

    if (
      statusKey === 'ngung' ||
      statusKey === 'tam ngung' ||
      statusKey === 'nghi' ||
      statusKey === 'khong hoat dong'
    ) {
      continue;
    }

    /*
     * Nếu đã có phiếu được chấm trong khoảng lọc,
     * chỉ hiện tiêu chí thuộc các phiếu đó.
     */
    if (
      Object.keys(
        activeFormCodes
      ).length > 0
      &&
      !activeFormCodes[
        formCode
      ]
    ) {
      continue;
    }

    result.push({
      criterionId:
        criterionId,

      formCode:
        formCode,

      group:
        group,

      order:
        order,

      content:
        content,

      detail:
        detail || content
    });
  }

  result.sort(
    function(a, b) {
      var byForm =
        String(
          a.formCode || ''
        ).localeCompare(
          String(
            b.formCode || ''
          ),
          'vi'
        );

      if (byForm !== 0) {
        return byForm;
      }

      return (
        Number(
          a.order || 0
        )
        -
        Number(
          b.order || 0
        )
      );
    }
  );

  return result;
}


/**
 * Tương thích tên hàm VSMT cũ.
 */
function bcGetVsmtMatrixCriteria_(
  forms
) {
  return bcGetDepartmentMatrixCriteria_(
    forms,
    BC_VSMT_DEPARTMENT
  );
}


function bcBuildDepartmentMatrix_(
  from,
  to,
  forms,
  details,
  department,
  person
) {
  /*
   * ==========================================================
   * 1. NHÂN VIÊN THỰC SỰ CÓ PHIẾU TRONG KHOẢNG LỌC
   *
   * DM_NHANVIEN dùng để bổ sung tên/chức vụ chuẩn.
   * PHIEU_GIAMSAT quyết định người nào xuất hiện trong ma trận.
   * ==========================================================
   */
  var masterStaff =
    bcGetActiveStaff_();

  var byId = {};
  var byName = {};

  masterStaff.forEach(
    function(x) {
      if (x.id) {
        byId[
          String(
            x.id
          ).trim()
        ] = x;
      }

      if (x.name) {
        byName[
          bcNorm_(
            x.name
          )
        ] = x;
      }
    }
  );

  var staffMap = {};

  (forms || []).forEach(
    function(f) {
      if (
        !bcSameText_(
          f.department,
          department
        )
      ) {
        return;
      }

      if (
        person &&
        !bcSameText_(
          f.name,
          person
        )
      ) {
        return;
      }

      var id =
        String(
          f.staffId || ''
        ).trim();

      var name =
        String(
          f.name || ''
        ).trim();

      if (!name && !id) {
        return;
      }

      var master =
        (
          id &&
          byId[id]
        )
        ||
        byName[
          bcNorm_(
            name
          )
        ]
        ||
        {};

      var key =
        id
        ? 'ID:' + id
        : 'NAME:' +
          bcNorm_(
            name
          );

      if (!staffMap[key]) {
        staffMap[key] = {
          staffId:
            id ||
            master.id ||
            '',

          name:
            master.name ||
            name ||
            '',

          position:
            master.position ||
            '',

          areas:
            []
        };
      }

      var area =
        String(
          f.area || ''
        ).trim();

      if (
        area &&
        staffMap[key]
          .areas
          .indexOf(
            area
          ) === -1
      ) {
        staffMap[key]
          .areas
          .push(
            area
          );
      }
    }
  );

  var staffColumns =
    Object.keys(
      staffMap
    )
    .map(
      function(key) {
        var x =
          staffMap[key];

        return {
          staffId:
            x.staffId,

          name:
            x.name,

          position:
            x.position,

          area:
            x.areas.length
              ? x.areas.join(
                  ' + '
                )
              : 'Chưa ghi nhận'
        };
      }
    )
    .sort(
      function(a, b) {
        return String(
          a.name || ''
        ).localeCompare(
          String(
            b.name || ''
          ),
          'vi'
        );
      }
    );


  /*
   * ==========================================================
   * 2. TIÊU CHÍ ĐỘNG
   * ==========================================================
   */
  var criteria =
    bcGetDepartmentMatrixCriteria_(
      forms,
      department
    );


  /*
   * ==========================================================
   * 3. MAP PHIẾU
   * ==========================================================
   */
  var formById = {};

  forms.forEach(
    function(f) {
      formById[
        String(
          f.id
        )
      ] = f;
    }
  );


  /*
   * ==========================================================
   * 4. MA TRẬN
   * ==========================================================
   */
  var rows =
    criteria.map(
      function(c) {
        var values =
          staffColumns.map(
            function(emp) {
              var matched =
                details.filter(
                  function(d) {
                    if (
                      String(
                        d.criterionId ||
                        ''
                      ).trim()
                      !==
                      String(
                        c.criterionId ||
                        ''
                      ).trim()
                    ) {
                      return false;
                    }

                    var form =
                      formById[
                        String(
                          d.formId
                        )
                      ];

                    if (!form) {
                      return false;
                    }

                    var sameEmployee =
                      (
                        emp.staffId &&
                        form.staffId &&
                        String(
                          emp.staffId
                        ).trim()
                        ===
                        String(
                          form.staffId
                        ).trim()
                      )
                      ||
                      bcSameText_(
                        emp.name,
                        form.name
                      );

                    return sameEmployee;
                  }
                );

              if (
                matched.some(
                  function(x) {
                    return (
                      bcNorm_(
                        x.result
                      )
                      ===
                      'kem'
                    );
                  }
                )
              ) {
                return 'KÉM';
              }

              if (
                matched.some(
                  function(x) {
                    return (
                      bcNorm_(
                        x.result
                      )
                      ===
                      'khong dat'
                    );
                  }
                )
              ) {
                return 'KHÔNG ĐẠT';
              }

              return '';
            }
          );

        return {
          criterionId:
            c.criterionId,

          formCode:
            c.formCode,

          group:
            c.group,

          order:
            c.order,

          criterion:
            c.content,

          detail:
            c.detail,

          isSection:
            false,

          values:
            values
        };
      }
    );


  /*
   * ==========================================================
   * 5. TỔNG HỢP NHÂN VIÊN
   * ==========================================================
   */
  var summary =
    staffColumns.map(
      function(emp) {
        var empForms =
          forms.filter(
            function(f) {
              return (
                (
                  emp.staffId &&
                  f.staffId &&
                  String(
                    emp.staffId
                  ).trim()
                  ===
                  String(
                    f.staffId
                  ).trim()
                )
                ||
                bcSameText_(
                  emp.name,
                  f.name
                )
              );
            }
          );

        var ids = {};

        empForms.forEach(
          function(f) {
            ids[
              String(
                f.id
              )
            ] = true;
          }
        );

        var empDetails =
          details.filter(
            function(d) {
              return !!ids[
                String(
                  d.formId
                )
              ];
            }
          );

        var evaluated =
          empDetails.filter(
            function(d) {
              var r =
                bcNorm_(
                  d.result
                );

              return (
                r === 'dat' ||
                r === 'khong dat' ||
                r === 'kem'
              );
            }
          );

        var pass =
          evaluated.filter(
            function(d) {
              return (
                bcNorm_(
                  d.result
                )
                ===
                'dat'
              );
            }
          ).length;

        var fail =
          evaluated.filter(
            function(d) {
              return (
                bcNorm_(
                  d.result
                )
                ===
                'khong dat'
              );
            }
          ).length;

        var poor =
          evaluated.filter(
            function(d) {
              return (
                bcNorm_(
                  d.result
                )
                ===
                'kem'
              );
            }
          ).length;

        var total =
          evaluated.length;

        var errors =
          fail +
          poor;

        var rate =
          total
            ? Math.round(
                errors *
                1000 /
                total
              ) / 10
            : 0;

        return {
          staffId:
            emp.staffId,

          name:
            emp.name,

          area:
            emp.area,

          total:
            total,

          pass:
            pass,

          fail:
            fail,

          poor:
            poor,

          errors:
            errors,

          errorRate:
            rate
        };
      }
    );

  summary.sort(
    function(a, b) {
      if (
        Number(
          a.errorRate || 0
        )
        !==
        Number(
          b.errorRate || 0
        )
      ) {
        return (
          Number(
            a.errorRate || 0
          )
          -
          Number(
            b.errorRate || 0
          )
        );
      }

      return String(
        a.name || ''
      ).localeCompare(
        String(
          b.name || ''
        ),
        'vi'
      );
    }
  );

  return {
    staff:
      staffColumns,

    criteria:
      criteria,

    rows:
      rows,

    summary:
      summary
  };
}


/**
 * Tương thích tên VSMT cũ.
 */
function bcBuildVsmtMatrix_(
  from,
  to,
  forms,
  details,
  person
) {
  return bcBuildDepartmentMatrix_(
    from,
    to,
    forms,
    details,
    BC_VSMT_DEPARTMENT,
    person
  );
}



/**
 * ============================================================
 * NGUỒN NGOÀI CSSD - CÔNG SUẤT HOẠT ĐỘNG
 *
 * Spreadsheet:
 * BC_CSSD_SOURCE_SPREADSHEET_ID
 *
 * Sheet:
 * DỤNG CỤ BẬN
 *
 * Cấu trúc theo code nguồn người dùng cung cấp:
 * B = Ngày
 * D = Tên bộ
 * F = Người giao
 * G = Người nhận
 * H = Trạng thái
 * I = Ghi chú
 * ============================================================
 */
function bcGetCssdExternalCapacity_(
  from,
  to
) {
  try {
    var ss =
      SpreadsheetApp.openById(
        BC_CSSD_SOURCE_SPREADSHEET_ID
      );

    var sh =
      ss.getSheetByName(
        BC_CSSD_SOURCE_SHEET
      );

    if (!sh) {
      return {
        ok: false,
        error:
          'Không tìm thấy sheet "' +
          BC_CSSD_SOURCE_SHEET +
          '" trong Spreadsheet CSSD.'
      };
    }

    if (
      sh.getLastRow() < 2
    ) {
      return {
        ok: true,
        total: 0,
        uniqueSets: 0,
        activeDays: 0,
        calendarDays:
          bcCountCalendarDays_(
            from,
            to
          ),
        avgPerActiveDay: 0,
        avgPerCalendarDay: 0,
        peakDay: '',
        peakCount: 0,
        targetPerDay:
          Number(
            BC_CSSD_TARGET_PER_DAY
          ) || 0,
        utilizationPct: null,
        statusSummary: {
          DU: 0,
          THIEU: 0,
          HET_HAN: 0,
          KHAC: 0
        },
        daily: [],
        thieuList: [],
        hetHanList: [],
        queryRange: {
          start: from,
          end: to
        }
      };
    }

    var data =
      sh.getDataRange()
        .getValues();

    var total = 0;

    var statusSummary = {
      DU: 0,
      THIEU: 0,
      HET_HAN: 0,
      KHAC: 0
    };

    var thieuList = [];
    var hetHanList = [];
    var dailyMap = {};
    var setMap = {};

    for (
      var i = 1;
      i < data.length;
      i++
    ) {
      var row =
        data[i];

      var rowDate =
        bcParseDate_(
          row[1]
        );

      if (!rowDate) {
        continue;
      }

      if (
        !bcInRange_(
          rowDate,
          from,
          to
        )
      ) {
        continue;
      }

      total++;

      var dateKey =
        Utilities.formatDate(
          rowDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

      if (
        !dailyMap[
          dateKey
        ]
      ) {
        dailyMap[
          dateKey
        ] = {
          date:
            Utilities.formatDate(
              rowDate,
              Session.getScriptTimeZone(),
              'dd/MM/yyyy'
            ),

          total: 0,
          DU: 0,
          THIEU: 0,
          HET_HAN: 0,
          KHAC: 0
        };
      }

      dailyMap[
        dateKey
      ].total++;

      var tenBo =
        String(
          row[3] || ''
        ).trim();

      var nguoiGiao =
        String(
          row[5] || ''
        ).trim();

      var nguoiNhan =
        String(
          row[6] || ''
        ).trim();

      var trangThai =
        bcNorm_(
          row[7]
        );

      var ghiChu =
        String(
          row[8] || ''
        ).trim();

      if (tenBo) {
        setMap[
          bcNorm_(
            tenBo
          )
        ] = true;
      }

      var item = {
        date:
          Utilities.formatDate(
            rowDate,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy'
          ),

        tenBo:
          tenBo,

        nguoiGiao:
          nguoiGiao,

        nguoiNhan:
          nguoiNhan,

        ghiChu:
          ghiChu
      };

      if (
        trangThai === 'du'
      ) {
        statusSummary.DU++;
        dailyMap[
          dateKey
        ].DU++;

      } else if (
        trangThai === 'thieu'
      ) {
        statusSummary.THIEU++;
        dailyMap[
          dateKey
        ].THIEU++;
        thieuList.push(
          item
        );

      } else if (
        trangThai === 'het han'
      ) {
        statusSummary.HET_HAN++;
        dailyMap[
          dateKey
        ].HET_HAN++;
        hetHanList.push(
          item
        );

      } else {
        statusSummary.KHAC++;
        dailyMap[
          dateKey
        ].KHAC++;
      }
    }

    var daily =
      Object.keys(
        dailyMap
      )
      .sort()
      .map(
        function(k) {
          return dailyMap[k];
        }
      );

    var activeDays =
      daily.length;

    var calendarDays =
      bcCountCalendarDays_(
        from,
        to
      );

    var avgPerActiveDay =
      activeDays
        ? Math.round(
            total *
            10 /
            activeDays
          ) / 10
        : 0;

    var avgPerCalendarDay =
      calendarDays
        ? Math.round(
            total *
            10 /
            calendarDays
          ) / 10
        : 0;

    var peakCount = 0;
    var peakDay = '';

    daily.forEach(
      function(x) {
        if (
          Number(
            x.total || 0
          )
          >
          peakCount
        ) {
          peakCount =
            Number(
              x.total || 0
            );

          peakDay =
            x.date;
        }
      }
    );

    var targetPerDay =
      Number(
        BC_CSSD_TARGET_PER_DAY
      ) || 0;

    var utilizationPct =
      (
        targetPerDay > 0 &&
        calendarDays > 0
      )
      ? Math.round(
          total *
          1000 /
          (
            targetPerDay *
            calendarDays
          )
        ) / 10
      : null;

    return {
      ok: true,

      sourceSpreadsheetId:
        BC_CSSD_SOURCE_SPREADSHEET_ID,

      sourceSheet:
        BC_CSSD_SOURCE_SHEET,

      total:
        total,

      uniqueSets:
        Object.keys(
          setMap
        ).length,

      activeDays:
        activeDays,

      calendarDays:
        calendarDays,

      avgPerActiveDay:
        avgPerActiveDay,

      avgPerCalendarDay:
        avgPerCalendarDay,

      peakDay:
        peakDay,

      peakCount:
        peakCount,

      targetPerDay:
        targetPerDay,

      utilizationPct:
        utilizationPct,

      statusSummary:
        statusSummary,

      daily:
        daily,

      thieuList:
        thieuList,

      hetHanList:
        hetHanList,

      queryRange: {
        start:
          from,

        end:
          to
      }
    };

  } catch (err) {
    return {
      ok: false,
      error:
        'Không đọc được nguồn CSSD: ' +
        (
          err &&
          err.message
            ? err.message
            : String(err)
        )
    };
  }
}


function bcCountCalendarDays_(
  from,
  to
) {
  var f =
    bcParseDate_(
      from
    );

  var t =
    bcParseDate_(
      to
    );

  if (
    !f ||
    !t
  ) {
    return 0;
  }

  f.setHours(
    0, 0, 0, 0
  );

  t.setHours(
    0, 0, 0, 0
  );

  if (
    t < f
  ) {
    var tmp = f;
    f = t;
    t = tmp;
  }

  return (
    Math.floor(
      (
        t.getTime() -
        f.getTime()
      )
      /
      86400000
    )
    + 1
  );
}


/**
 * Debug nguồn CSSD bên ngoài.
 */
function debugKsCssdExternal() {
  return bcGetCssdExternalCapacity_(
    '',
    ''
  );
}


/**
 * ============================================================
 * 8. JOIN PHIẾU GIÁM SÁT + CHI TIẾT
 * ============================================================
 */
function bcGetChecklistDetailRows_(forms) {
  var detailSheetName = bcSheetName_('CHECKLIST_DETAILS', 'CT_PHIEU_GIAMSAT');
  var sh = bcGetSheet_(detailSheetName);
  if (!sh || sh.getLastRow() < 2) return [];

  var formMap = {};
  (forms || []).forEach(function(f) {
    formMap[String(f.id)] = f;
  });

  var values = sh.getDataRange().getValues();
  var out = [];

  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var formId = String(r[0] || '').trim();
    if (!formId || !formMap[formId]) continue;

    var f = formMap[formId];

    out.push({
      formId: formId,
      date: f.date,
      staffId: f.staffId,
      name: f.name,
      department: f.department,
      area: f.area,
      formCode: f.formCode,
      formName: f.formName,

      criterionId: String(r[1] || ''),
      group: String(r[2] || ''),
      content: String(r[3] || ''),
      result: String(r[4] || ''),
      note: String(r[5] || ''),
      order: Number(r[6]) || '',
      detail: String(r[7] || r[3] || ''),
      imageRef: String(r[8] || ''),

      /*
       * Cột J (index 9) - ảnh sau khắc phục.
       * Dữ liệu cũ chưa có cột này vẫn chạy bình thường.
       */
      correctiveImageRef:
        String(
          r.length > 9
            ? (r[9] || '')
            : ''
        )
    });
  }

  return out;
}


/**
 * ============================================================
 * 9. ĐỌC PHIẾU GIÁM SÁT
 * Cấu trúc hỗ trợ cả bản cũ 16 cột và bản mới 19 cột.
 * ============================================================
 */
function bcGetChecklistFormRows_(from, to, department, person) {
  var sheetName = bcSheetName_('CHECKLIST_FORMS', 'PHIEU_GIAMSAT');
  var sh = bcGetSheet_(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];

  var data = sh.getDataRange().getValues();
  var out = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    if (!bcInRange_(r[1], from, to)) continue;
    if (department && !bcSameText_(r[4], department)) continue;
    if (person && !bcSameText_(r[3], person)) continue;

    out.push({
      id: r[0],
      date: bcFormatDate_(r[1]),
      rawDate: r[1],
      staffId: r[2],
      name: r[3],
      department: r[4],
      supervisor: r[5],
      area: r[6],
      shift: r[7],
      applied: Number(r[8]) || 0,
      pass: Number(r[9]) || 0,
      fail: Number(r[10]) || 0,
      rate: Number(r[11]) || 0,
      kpi: Number(r[12]) || 0,
      note: r[13],
      imageRef: r[14],
      savedAt: r[15],
      formCode: r.length > 16 ? String(r[16] || '') : '',
      formName: r.length > 17 ? String(r[17] || '') : '',
      na: r.length > 18 ? Number(r[18]) || 0 : 0
    });
  }

  return out;
}


/**
 * ============================================================
 * 10. ĐỌC NHÂN SỰ TỪ DM_NHANVIEN
 * ============================================================
 */
function bcGetActiveStaff_() {
  var sh = bcGetSheet_(APP_CONFIG.SHEETS.STAFF);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getDisplayValues();
  var out = [];

  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[1]) continue;

    var status = bcNorm_(r[5]);
    if (
      status.indexOf('nghi') !== -1 ||
      status.indexOf('ngung') !== -1 ||
      status.indexOf('khong hoat dong') !== -1
    ) {
      continue;
    }

    out.push({
      id: String(r[0] || '').trim(),
      name: String(r[1] || '').trim(),
      department: String(r[2] || '').trim(),
      position: String(r[3] || '').trim(),
      phone: String(r[4] || '').trim(),
      status: String(r[5] || '').trim()
    });
  }

  return out;
}


/**
 * ============================================================
 * 11. KẾ HOẠCH
 * ============================================================
 */
function bcGetPlanRows_(
  type,
  from,
  to,
  department,
  person
) {
  var name =
    type === 'MONTH'
      ? bcSheetName_(
          'MONTHLY_PLAN',
          'KE_HOACH_THANG'
        )
      : bcSheetName_(
          'WEEKLY_PLAN',
          'KE_HOACH_TUAN'
        );

  var sh =
    bcGetSheet_(
      name
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  var data =
    sh.getDataRange()
      .getValues();

  var out = [];

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r =
      data[i];

    if (!r[0]) {
      continue;
    }

    if (
      (from || to) &&
      !bcOverlapRange_(
        r[1],
        r[2],
        from,
        to
      )
    ) {
      continue;
    }

    if (
      department &&
      !bcSameText_(
        r[3],
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !bcSameText_(
        r[5],
        person
      )
    ) {
      continue;
    }

    var status =
      bcEffectivePlanStatus_(
        r[6],
        r[2]
      );

    out.push({
      id:
        String(
          r[0] || ''
        ),

      type:
        type,

      typeLabel:
        type === 'MONTH'
          ? 'KẾ HOẠCH THÁNG'
          : 'KẾ HOẠCH TUẦN',

      from:
        bcFormatDate_(
          r[1]
        ),

      to:
        bcFormatDate_(
          r[2]
        ),

      department:
        String(
          r[3] || ''
        ),

      content:
        String(
          r[4] || ''
        ),

      owner:
        String(
          r[5] || ''
        ),

      status:
        status,

      result:
        String(
          r[7] || ''
        ),

      note:
        String(
          r[8] || ''
        ),

      description:
        String(
          r[15] || ''
        ),

      completedAt:
        bcFormatDateTimeSafe_(
          r[10]
        ),

      rootId:
        String(
          r[11] || ''
        ),

      carryPeriod:
        String(
          r[12] || ''
        ),

      overdue:
        bcNorm_(
          status
        ) ===
        'qua han'
    });
  }

  return out;
}


/**
 * ============================================================
 * 12. GIAO VIỆC
 * ============================================================
 */
function bcGetTaskRows_(from, to, department, person) {
  var sh = bcGetSheet_(APP_CONFIG.SHEETS.TASKS);
  if (!sh || sh.getLastRow() < 2) return [];

  var staffMap = {};
  bcGetActiveStaff_().forEach(function(x) {
    staffMap[bcNorm_(x.name)] = x;
  });

  var data = sh.getDataRange().getValues();
  var out = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;

    var assignee = String(r[1] || '').trim();
    if (!assignee) continue;

    var employee = staffMap[bcNorm_(assignee)] || {};
    var dep = String(employee.department || '').trim();

    if (person && !bcSameText_(assignee, person)) continue;
    if (department && !bcSameText_(dep, department)) continue;
    if ((from || to) && !bcOverlapRange_(r[6], r[7], from, to)) continue;

    out.push({
      id: r[0],
      assignee: assignee,
      department: dep,
      priority: r[2],
      title: r[3],
      description: r[4],
      startDate: bcFormatDate_(r[6]),
      endDate: bcFormatDate_(r[7]),
      status: r[8],
      staffNote: r[9],
      imageRef: r[10],
      evalStatus: r[11],
      managerNote: r[12]
    });
  }

  return out;
}


/**
 * ============================================================
 * 13. VI PHẠM
 * ============================================================
 */
function bcGetViolationRows_(from, to, department, person) {
  var sh = bcGetSheet_(APP_CONFIG.SHEETS.VIOLATIONS);
  if (!sh || sh.getLastRow() < 2) return [];

  var data = sh.getDataRange().getValues();
  var out = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;

    if ((from || to) && !bcInRange_(r[1], from, to)) continue;
    if (department && !bcSameText_(r[4], department)) continue;
    if (person && !bcSameText_(r[3], person)) continue;

    out.push({
      id: r[0],
      date: bcFormatDate_(r[1]),
      staffId: r[2],
      name: r[3],
      department: r[4],
      errorId: r[5],
      errorName: r[6],
      level: r[7],
      points: Math.abs(Number(r[8]) || 0),
      recorder: r[9],
      note: r[10],
      status: r[11],
      imageRef: r[12] || ''
    });
  }

  return out;
}



/**
 * ============================================================
 * V14 - NGUỒN DỮ LIỆU MỤC 10 / 11 + NHẬP TRỰC TIẾP TỪ BÁO CÁO
 * ============================================================
 *
 * Dùng chung sheet TON_TAI_KIEN_NGHI (hoặc APP_CONFIG.SHEETS.ISSUES).
 *
 * Cấu trúc A:N:
 * A  Mã
 * B  Ngày
 * C  Bộ phận
 * D  Nội dung
 * E  Nguyên nhân
 * F  Phương án khắc phục
 * G  Người phụ trách
 * H  Hạn
 * I  Trạng thái
 * J  Kiến nghị
 * K  Tạo lúc
 * L  Cập nhật lúc
 * M  Ghi chú
 * N  Loại nội dung: SU_CO / TON_TAI
 *
 * Dữ liệu cũ chưa có cột N:
 * hệ thống tự phân loại theo nội dung như trước.
 * ============================================================
 */
const BC_ISSUE_TYPE_INCIDENT = 'SU_CO';
const BC_ISSUE_TYPE_OTHER = 'TON_TAI';


function setupBaoCaoIssueSystem() {
  var ss = bcGetWritableSpreadsheet_();

  var sh =
    bcGetIssueSheetRobust_(
      ss,
      true
    );

  var headers = [
    'Mã',
    'Ngày',
    'Bộ phận',
    'Tồn tại / Sự cố / Kiến nghị',
    'Nguyên nhân',
    'Phương án khắc phục',
    'Người phụ trách',
    'Hạn',
    'Trạng thái',
    'Kiến nghị',
    'Tạo lúc',
    'Cập nhật lúc',
    'Ghi chú',
    'Loại nội dung'
  ];

  bcPrepareHeaderRow_(
    sh,
    headers,
    '#123b8f'
  );

  return {
    success: true,
    sheet: sh.getName()
  };
}


function bcGetIssueSheetRobust_(
  ss,
  createIfMissing
) {
  ss = ss || bcGetWritableSpreadsheet_();

  var candidates = [];

  try {
    if (
      APP_CONFIG &&
      APP_CONFIG.SHEETS &&
      APP_CONFIG.SHEETS.ISSUES
    ) {
      candidates.push(
        String(
          APP_CONFIG.SHEETS.ISSUES
        )
      );
    }
  } catch (e) {}

  [
    'TON_TAI_KIEN_NGHI',
    'TỒN TẠI KIẾN NGHỊ',
    'TỒN TẠI / SỰ CỐ / KIẾN NGHỊ',
    'TON TAI KIEN NGHI'
  ].forEach(
    function(name) {
      if (
        candidates.indexOf(
          name
        ) === -1
      ) {
        candidates.push(
          name
        );
      }
    }
  );

  for (
    var i = 0;
    i < candidates.length;
    i++
  ) {
    var sh =
      ss.getSheetByName(
        candidates[i]
      );

    if (sh) {
      return sh;
    }
  }

  if (!createIfMissing) {
    return null;
  }

  return ss.insertSheet(
    candidates[0] ||
    'TON_TAI_KIEN_NGHI'
  );
}


/**
 * Nhập mới trực tiếp từ Báo cáo - Mục 10 hoặc 11.
 */
function saveReportIssueEntry(payload) {
  setupBaoCaoIssueSystem();

  payload =
    payload || {};

  var type =
    String(
      payload.type || ''
    )
      .trim()
      .toUpperCase();

  if (
    type !==
    BC_ISSUE_TYPE_INCIDENT &&
    type !==
    BC_ISSUE_TYPE_OTHER
  ) {
    throw new Error(
      'Loại nội dung không hợp lệ.'
    );
  }

  var department =
    String(
      payload.department || ''
    ).trim();

  if (!department) {
    throw new Error(
      'Phải chọn Bộ phận trước khi lưu.'
    );
  }

  var issue =
    String(
      payload.issue || ''
    ).trim();

  if (!issue) {
    throw new Error(
      type ===
      BC_ISSUE_TYPE_INCIDENT
        ? 'Phải nhập Nội dung sự cố.'
        : 'Phải nhập Nội dung tồn tại / kiến nghị.'
    );
  }

  var date =
    bcParseDate_(
      payload.date
    ) ||
    new Date();

  var deadline =
    bcParseDate_(
      payload.deadline
    );

  var status =
    String(
      payload.status ||
      (
        type ===
        BC_ISSUE_TYPE_INCIDENT
          ? 'CHƯA XỬ LÝ'
          : 'CHƯA KHẮC PHỤC'
      )
    )
      .trim()
      .toUpperCase();

  var now = new Date();

  var requestedId = String(
    payload.id || ''
  ).trim();

  var ss = bcGetWritableSpreadsheet_();

  var sh =
    bcGetIssueSheetRobust_(
      ss,
      true
    );

  var data = sh.getDataRange().getValues();
  var rowFound = 0;

  if (requestedId) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() === requestedId) {
        rowFound = i + 1;
        break;
      }
    }

    if (!rowFound) {
      throw new Error(
        'Không tìm thấy bản ghi cần sửa: ' + requestedId
      );
    }
  }

  var id = requestedId || (
    'TT-' +
    Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'yyyyMMddHHmmssSSS'
    ) +
    '-' +
    Math.floor(Math.random() * 9000 + 1000)
  );

  var createdAt =
    rowFound && data[rowFound - 1][10]
      ? data[rowFound - 1][10]
      : now;

  var values = [[
    id,
    date,
    department,
    issue,
    String(
      payload.cause || ''
    ).trim(),
    String(
      payload.action || ''
    ).trim(),
    String(
      payload.owner || ''
    ).trim(),
    deadline || '',
    status,
    String(
      payload.recommendation || ''
    ).trim(),
    createdAt,
    now,
    String(
      payload.note || ''
    ).trim(),
    type
  ]];

  var row;

  if (rowFound) {
    row = rowFound;
    sh.getRange(
      row,
      1,
      1,
      14
    ).setValues(values);
  } else {
    sh.appendRow(values[0]);
    row = sh.getLastRow();
  }

  sh.getRange(
    row,
    2
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    row,
    8
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    row,
    11,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );

  SpreadsheetApp.flush();

  return {
    success: true,
    id: id,
    type: type,
    row: row,
    sheet: sh.getName(),
    mode: rowFound ? 'UPDATE' : 'CREATE',
    savedAt:
      bcFormatDateTimeSafe_(
        now
      ),
    message:
      rowFound
        ? (
            type === BC_ISSUE_TYPE_INCIDENT
              ? 'Đã cập nhật Nhật ký sự cố thành công.'
              : 'Đã cập nhật Tồn tại / Kiến nghị thành công.'
          )
        : (
            type === BC_ISSUE_TYPE_INCIDENT
              ? 'Đã lưu Nhật ký sự cố thành công.'
              : 'Đã lưu Tồn tại / Kiến nghị thành công.'
          )
  };
}


/**
 * Lấy một bản ghi Mục 10/11 để nạp lại vào biểu mẫu sửa.
 */
function getReportIssueEntry(payload) {
  payload = payload || {};

  var id = String(
    typeof payload === 'string'
      ? payload
      : (payload.id || '')
  ).trim();

  if (!id) {
    throw new Error('Thiếu mã bản ghi cần mở.');
  }

  var ss = bcGetWritableSpreadsheet_();
  var sh = bcGetIssueSheetRobust_(ss, false);

  if (!sh || sh.getLastRow() < 2) {
    throw new Error('Chưa có dữ liệu Nhật ký sự cố/Tồn tại.');
  }

  var data = sh.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var r = data[i];

    if (String(r[0] || '').trim() !== id) {
      continue;
    }

    return {
      id: String(r[0] || ''),
      date: bcFormatDateKey_(r[1]),
      department: String(r[2] || ''),
      issue: String(r[3] || ''),
      cause: String(r[4] || ''),
      action: String(r[5] || ''),
      owner: String(r[6] || ''),
      deadline: bcFormatDateKey_(r[7]),
      status: String(r[8] || ''),
      recommendation: String(r[9] || ''),
      note: String(r[12] || ''),
      type: bcNormalizeIssueType_(r[13], r[3], r[4])
    };
  }

  throw new Error('Không tìm thấy bản ghi: ' + id);
}


/**
 * Cập nhật nhanh trạng thái từ Báo cáo.
 */
function updateReportIssueEntryStatus(
  id,
  status
) {
  setupBaoCaoIssueSystem();

  id =
    String(
      id || ''
    ).trim();

  status =
    String(
      status || ''
    ).trim()
    .toUpperCase();

  if (!id) {
    throw new Error(
      'Thiếu mã nội dung.'
    );
  }

  if (!status) {
    throw new Error(
      'Thiếu trạng thái.'
    );
  }

  var ss = bcGetWritableSpreadsheet_();

  var sh =
    bcGetIssueSheetRobust_(
      ss,
      false
    );

  if (!sh) {
    throw new Error(
      'Không tìm thấy sheet tồn tại / sự cố.'
    );
  }

  var data =
    sh.getDataRange()
      .getValues();

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    if (
      String(
        data[i][0] || ''
      ).trim() === id
    ) {
      sh.getRange(
        i + 1,
        9
      ).setValue(
        status
      );

      sh.getRange(
        i + 1,
        12
      ).setValue(
        new Date()
      );

      return {
        success: true,
        message:
          'Đã cập nhật trạng thái.'
      };
    }
  }

  throw new Error(
    'Không tìm thấy nội dung cần cập nhật.'
  );
}


function bcNormalizeIssueType_(
  explicitType,
  issue,
  cause
) {
  var type =
    String(
      explicitType || ''
    )
      .trim()
      .toUpperCase();

  if (
    type ===
    BC_ISSUE_TYPE_INCIDENT ||
    type ===
    BC_ISSUE_TYPE_OTHER
  ) {
    return type;
  }

  /*
   * Tương thích dữ liệu cũ chưa có cột Loại nội dung.
   */
  var text =
    bcNorm_(
      String(
        issue || ''
      ) +
      ' ' +
      String(
        cause || ''
      )
    );

  if (
    text.indexOf(
      'su co'
    ) !== -1 ||
    text.indexOf(
      'tai nan'
    ) !== -1 ||
    text.indexOf(
      'hong'
    ) !== -1 ||
    text.indexOf(
      'bat thuong'
    ) !== -1 ||
    text.indexOf(
      'loi'
    ) !== -1
  ) {
    return BC_ISSUE_TYPE_INCIDENT;
  }

  return BC_ISSUE_TYPE_OTHER;
}




/**
 * ============================================================
 * 14. TỒN TẠI / NHẬT KÝ SỰ CỐ
 * ============================================================
 */
function bcGetIssueRows_(from, to, department) {
  var ss =
    typeof getAppSpreadsheet_ === 'function'
      ? getAppSpreadsheet_()
      : SpreadsheetApp.openById(
          APP_CONFIG.SPREADSHEET_ID
        );

  var sh =
    bcGetIssueSheetRobust_(
      ss,
      false
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  var data =
    sh.getDataRange()
      .getValues();

  var out = [];

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r =
      data[i];

    if (!r[0]) {
      continue;
    }

    if (
      (from || to) &&
      !bcInRange_(
        r[1],
        from,
        to
      )
    ) {
      continue;
    }

    var rowDepartment =
      String(
        r[2] || ''
      ).trim();

    /*
     * Trường hợp dữ liệu cũ thiếu Bộ phận:
     * nếu có người phụ trách, thử suy ra từ DM_NHANVIEN.
     */
    if (
      !rowDepartment &&
      r[6]
    ) {
      try {
        var staff =
          bcGetActiveStaff_();

        for (
          var s = 0;
          s < staff.length;
          s++
        ) {
          if (
            bcSameText_(
              staff[s].name,
              r[6]
            )
          ) {
            rowDepartment =
              String(
                staff[s].department ||
                ''
              ).trim();

            break;
          }
        }
      } catch (e) {}
    }

    if (
      department &&
      !bcSameText_(
        rowDepartment,
        department
      )
    ) {
      continue;
    }

    var type =
      bcNormalizeIssueType_(
        r.length > 13
          ? r[13]
          : '',
        r[3],
        r[4]
      );

    out.push({
      id:
        String(
          r[0] || ''
        ),

      date:
        bcFormatDate_(
          r[1]
        ),

      department:
        rowDepartment,

      issue:
        String(
          r[3] || ''
        ),

      cause:
        String(
          r[4] || ''
        ),

      action:
        String(
          r[5] || ''
        ),

      owner:
        String(
          r[6] || ''
        ),

      deadline:
        bcFormatDate_(
          r[7]
        ),

      status:
        String(
          r[8] || ''
        ),

      recommendation:
        String(
          r[9] || ''
        ),

      note:
        String(
          r.length > 12
            ? (r[12] || '')
            : ''
        ),

      type:
        type
    });
  }

  out.sort(
    function(a, b) {
      var da =
        bcParseDate_(
          a.date
        );

      var db =
        bcParseDate_(
          b.date
        );

      return (
        (db ? db.getTime() : 0) -
        (da ? da.getTime() : 0)
      );
    }
  );

  return out;
}

/**
 * ============================================================
 * 15. LƯU ẢNH CHỤP BÁO CÁO
 * ============================================================
 */
function saveDepartmentReportSnapshot(filters) {
  var report = getKsDepartmentReport(filters || {});
  var sh = bcGetSheet_(APP_CONFIG.SHEETS.DEPT_REPORT);

  if (!sh) {
    throw new Error('Không tìm thấy sheet "' + APP_CONFIG.SHEETS.DEPT_REPORT + '".');
  }

  sh.appendRow([
    new Date(),
    String((filters || {}).from || ''),
    String((filters || {}).to || ''),
    String((filters || {}).department || ''),
    String((filters || {}).person || ''),
    JSON.stringify(report)
  ]);

  return 'Đã lưu ảnh chụp báo cáo.';
}


/**
 * ============================================================
 * 16. DEBUG BÁO CÁO
 * Chạy debugDepartmentReport() trong Apps Script nếu cần kiểm tra.
 * ============================================================
 */
function debugDepartmentReport() {
  var ss = getAppSpreadsheet_ ? getAppSpreadsheet_() : SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);

  var names = [
    APP_CONFIG.SHEETS.STAFF,
    APP_CONFIG.SHEETS.TASKS,
    bcSheetName_('CHECKLIST_FORMS', 'PHIEU_GIAMSAT'),
    bcSheetName_('CHECKLIST_DETAILS', 'CT_PHIEU_GIAMSAT'),
    APP_CONFIG.SHEETS.WEEKLY_PLAN,
    APP_CONFIG.SHEETS.MONTHLY_PLAN,
    APP_CONFIG.SHEETS.VIOLATIONS,
    APP_CONFIG.SHEETS.ISSUES
  ];

  var result = {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheets: {}
  };

  names.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    result.sheets[name] = {
      exists: !!sh,
      rows: sh ? Math.max(0, sh.getLastRow() - 1) : 0,
      columns: sh ? sh.getLastColumn() : 0
    };
  });

  return result;
}



/**
 * DEBUG CHI TIẾT BỘ LỌC BÁO CÁO VSMT.
 * person='' => kiểm tra toàn bộ bộ phận.
 */
function debugKsVsmtFilter(filters) {
  filters = filters || {};

  var from = String(filters.from || '').trim();
  var to = String(filters.to || '').trim();
  var department = String(filters.department || BC_VSMT_DEPARTMENT).trim();
  var person = String(filters.person || '').trim();

  var sh = bcGetSheet_(bcSheetName_('CHECKLIST_FORMS', 'PHIEU_GIAMSAT'));
  if (!sh) {
    return {
      ok: false,
      message: 'Không tìm thấy PHIEU_GIAMSAT',
      sheet: bcSheetName_('CHECKLIST_FORMS', 'PHIEU_GIAMSAT')
    };
  }

  var data = sh.getDataRange().getValues();
  var byDate = [];
  var byDepartment = [];
  var byPerson = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;

    if ((from || to) && !bcInRange_(r[1], from, to)) continue;
    byDate.push(r);

    if (department && !bcSameText_(r[4], department)) continue;
    byDepartment.push(r);

    if (person && !bcSameText_(r[3], person)) continue;
    byPerson.push(r);
  }

  return {
    ok: true,
    spreadsheetId: (typeof getAppSpreadsheet_ === 'function' ? getAppSpreadsheet_().getId() : APP_CONFIG.SPREADSHEET_ID),
    sheet: sh.getName(),
    totalRows: Math.max(0, data.length - 1),
    afterDateFilter: byDate.length,
    afterDepartmentFilter: byDepartment.length,
    afterPersonFilter: byPerson.length,
    department: department,
    person: person || '(TẤT CẢ)',
    from: from,
    to: to,
    sample: byPerson.slice(0, 10).map(function(r) {
      return {
        id: r[0],
        date: bcFormatDate_(r[1]),
        staffId: r[2],
        name: r[3],
        department: r[4],
        area: r[6],
        formCode: r.length > 16 ? r[16] : '',
        formName: r.length > 17 ? r[17] : ''
      };
    })
  };
}



/**
 * ============================================================
 * KẾ HOẠCH TUẦN SAU - DÙNG CHUNG TẤT CẢ BÁO CÁO
 *
 * Nguồn 1: GIAO VIỆC
 * - Chỉ lấy Trạng thái NV:
 *   CHƯA BẮT ĐẦU
 *   ĐANG LÀM
 *   QUÁ HẠN
 *
 * Nguồn 2: TỒN TẠI / SỰ CỐ / KIẾN NGHỊ
 * - Chỉ lấy các mục chưa hoàn thành/đang mở.
 *
 * Cách xác định "tuần sau":
 * - Căn cứ theo ngày ĐẾN (to) của bộ lọc báo cáo.
 * - Tuần sau = Thứ 2 kế tiếp -> Chủ nhật.
 *
 * Quy tắc GIAO VIỆC:
 * - Lấy công việc có trạng thái pending nêu trên
 * - Và:
 *   + có ngày nằm trong tuần sau; HOẶC
 *   + đang tồn/chưa xong từ trước và cần chuyển tiếp sang tuần sau.
 *
 * Vì vậy công việc QUÁ HẠN vẫn xuất hiện để không bị bỏ sót.
 * ============================================================
 */
function bcBuildNextWeekPlan_(
  reportTo,
  department,
  person
) {
  var range =
    bcGetNextWeekRange_(
      reportTo
    );

  var tasks =
    bcGetNextWeekTaskRows_(
      range.from,
      range.to,
      department,
      person
    );

  var issues =
    bcGetNextWeekIssueRows_(
      range.from,
      range.to,
      department
    );

  /*
   * Kế hoạch chính thức đã được tạo/chuyển tiếp
   * sang đúng tuần kế tiếp.
   */
  var plans =
    bcGetNextWeekOfficialPlans_(
      range.from,
      range.to,
      department,
      person
    );

  var rows = [];

  plans.forEach(function(x) {
    rows.push({
      source: 'KẾ HOẠCH',
      type:
        x.type === 'MONTH'
          ? 'Kế hoạch tháng'
          : 'Kế hoạch tuần',
      owner: x.owner || '',
      content: x.content || '',
      startDate: x.from || '',
      dueDate: x.to || '',
      status: x.status || '',
      priority: '',
      note:
        x.note ||
        x.result ||
        '',
      carryOver:
        !!x.rootId ||
        bcNorm_(x.status) ===
        'chuyen tiep'
    });
  });

  tasks.forEach(function(x) {
    rows.push({
      id: x.id || '',
      kind: 'TASK',
      description: x.description || '',
      evalStatus: x.evalStatus || '',
      managerNote: x.managerNote || '',
      source: 'GIAO VIỆC',
      type: 'Công việc',
      owner: x.assignee || '',
      content: x.title || x.description || '',
      startDate: x.startDate || '',
      dueDate: x.endDate || '',
      status: x.status || '',
      priority: x.priority || '',
      note: x.managerNote || x.staffNote || '',
      carryOver: !!x.carryOver
    });
  });

  issues.forEach(function(x) {
    rows.push({
      id: x.id || '',
      kind: 'ISSUE',
      description: '',
      source: 'TỒN TẠI / SỰ CỐ / KIẾN NGHỊ',
      type: 'Tồn tại / sự cố / kiến nghị',
      owner: x.owner || '',
      content: x.issue || '',
      startDate: x.date || '',
      dueDate: x.deadline || '',
      status: x.status || '',
      priority: '',
      note: x.recommendation || x.action || '',
      carryOver: !!x.carryOver
    });
  });

  rows.sort(function(a, b) {
    var da =
      bcParseDate_(
        a.dueDate
      ) ||
      bcParseDate_(
        a.startDate
      );

    var db =
      bcParseDate_(
        b.dueDate
      ) ||
      bcParseDate_(
        b.startDate
      );

    var ta =
      da
        ? da.getTime()
        : 9999999999999;

    var tb =
      db
        ? db.getTime()
        : 9999999999999;

    if (ta !== tb) {
      return ta - tb;
    }

    return String(
      a.owner || ''
    ).localeCompare(
      String(
        b.owner || ''
      ),
      'vi'
    );
  });

  return {
    from:
      bcFormatDate_(
        range.from
      ),

    to:
      bcFormatDate_(
        range.to
      ),

    fromYmd:
      bcFormatYmd_(
        range.from
      ),

    toYmd:
      bcFormatYmd_(
        range.to
      ),

    planCount:
      plans.length,

    taskCount:
      tasks.length,

    issueCount:
      issues.length,

    total:
      rows.length,

    rows:
      rows
  };
}


function bcGetNextWeekRange_(
  reportTo
) {
  var base =
    bcParseDate_(
      reportTo
    );

  if (!base) {
    base = new Date();
  }

  base.setHours(
    0, 0, 0, 0
  );

  /*
   * JS:
   * CN = 0
   * T2 = 1
   * ...
   * T7 = 6
   */
  var day =
    base.getDay();

  var daysUntilNextMonday =
    day === 0
      ? 1
      : 8 - day;

  var from =
    new Date(
      base.getTime()
    );

  from.setDate(
    from.getDate() +
    daysUntilNextMonday
  );

  from.setHours(
    0, 0, 0, 0
  );

  var to =
    new Date(
      from.getTime()
    );

  to.setDate(
    to.getDate() + 6
  );

  to.setHours(
    23, 59, 59, 999
  );

  return {
    from: from,
    to: to
  };
}



function bcGetNextWeekOfficialPlans_(
  nextFrom,
  nextTo,
  department,
  person
) {
  var from =
    bcFormatYmd_(
      nextFrom
    );

  var to =
    bcFormatYmd_(
      nextTo
    );

  var weekly =
    bcGetPlanRows_(
      'WEEK',
      from,
      to,
      department,
      person
    );

  /*
   * Kế hoạch tháng cũng có thể bao phủ tuần sau,
   * vì vậy vẫn đưa vào danh sách kế hoạch tuần sau.
   */
  var monthly =
    bcGetPlanRows_(
      'MONTH',
      from,
      to,
      department,
      person
    );

  return weekly
    .concat(monthly)
    .filter(function(x) {
      var s =
        bcNorm_(
          x.status
        );

      return (
        s !== 'hoan thanh' &&
        s !== 'chuyen tiep'
      );
    });
}


function bcGetNextWeekTaskRows_(
  nextFrom,
  nextTo,
  department,
  person
) {
  var sh =
    bcGetSheet_(
      APP_CONFIG.SHEETS.TASKS
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  var staffMap = {};

  bcGetActiveStaff_()
    .forEach(function(x) {
      staffMap[
        bcNorm_(
          x.name
        )
      ] = x;
    });

  var data =
    sh.getDataRange()
      .getValues();

  var result = [];

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r = data[i];

    if (!r[0]) {
      continue;
    }

    /*
     * Cấu trúc GIAO VIỆC:
     * B Người thực hiện
     * C Ưu tiên
     * D Tiêu đề
     * E Nội dung
     * G Ngày bắt đầu
     * H Ngày kết thúc
     * I Trạng thái NV
     * J Ghi chú NV
     * L Đánh giá quản lý
     * M Ghi chú quản lý
     */
    var assignee =
      String(
        r[1] || ''
      ).trim();

    if (!assignee) {
      continue;
    }

    var emp =
      staffMap[
        bcNorm_(
          assignee
        )
      ] || {};

    var dep =
      String(
        emp.department || ''
      ).trim();

    if (
      department &&
      !bcSameText_(
        dep,
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !bcSameText_(
        assignee,
        person
      )
    ) {
      continue;
    }

    var status =
      String(
        r[8] || ''
      ).trim();

    if (
      !bcIsNextWeekTaskStatus_(
        status
      )
    ) {
      continue;
    }

    var start =
      bcParseDate_(
        r[6]
      );

    var end =
      bcParseDate_(
        r[7]
      );

    /*
     * Trong tuần sau.
     */
    var inNextWeek =
      bcDateRangesOverlap_(
        start,
        end,
        nextFrom,
        nextTo
      );

    /*
     * Công việc tồn từ trước:
     * - chưa hoàn thành
     * - ngày kết thúc trước tuần sau
     * - hoặc không có ngày kết thúc.
     */
    var carryOver = false;

    if (
      !inNextWeek
    ) {
      if (!end) {
        carryOver = true;
      } else {
        var e =
          new Date(
            end.getTime()
          );

        e.setHours(
          23, 59, 59, 999
        );

        if (
          e < nextFrom
        ) {
          carryOver = true;
        }
      }
    }

    if (
      !inNextWeek &&
      !carryOver
    ) {
      continue;
    }

    result.push({
      id:
        String(
          r[0] || ''
        ),

      assignee:
        assignee,

      department:
        dep,

      priority:
        String(
          r[2] || ''
        ),

      title:
        String(
          r[3] || ''
        ),

      description:
        String(
          r[4] || ''
        ),

      startDate:
        bcFormatDate_(
          r[6]
        ),

      endDate:
        bcFormatDate_(
          r[7]
        ),

      status:
        status,

      staffNote:
        String(
          r[9] || ''
        ),

      evalStatus:
        String(
          r[11] || ''
        ),

      managerNote:
        String(
          r[12] || ''
        ),

      carryOver:
        carryOver
    });
  }

  return result;
}


function bcIsNextWeekTaskStatus_(
  status
) {
  var s =
    bcNorm_(
      status
    );

  return (
    s === 'chua bat dau' ||
    s === 'dang lam' ||
    s === 'qua han'
  );
}


function bcGetNextWeekIssueRows_(
  nextFrom,
  nextTo,
  department
) {
  var sh =
    bcGetSheet_(
      APP_CONFIG.SHEETS.ISSUES
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  /*
   * Map tên nhân viên -> bộ phận.
   * Dùng fallback khi dòng tồn tại/sự cố/kiến nghị
   * chưa nhập cột Bộ phận nhưng đã có Người phụ trách.
   */
  var staffMap = {};

  bcGetActiveStaff_()
    .forEach(function(x) {
      staffMap[
        bcNorm_(
          x.name
        )
      ] = x;
    });

  var data =
    sh.getDataRange()
      .getValues();

  var result = [];

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r = data[i];

    if (!r[0]) {
      continue;
    }

    var owner =
      String(
        r[6] || ''
      ).trim();

    var rowDepartment =
      String(
        r[2] || ''
      ).trim();

    /*
     * Nếu chưa có Bộ phận,
     * suy ra từ Người phụ trách.
     */
    if (
      !rowDepartment &&
      owner
    ) {
      var employee =
        staffMap[
          bcNorm_(
            owner
          )
        ] || {};

      rowDepartment =
        String(
          employee.department || ''
        ).trim();
    }

    /*
     * Chỉ đưa vào đúng báo cáo của tổ.
     */
    if (
      department &&
      !bcSameText_(
        rowDepartment,
        department
      )
    ) {
      continue;
    }

    var status =
      String(
        r[8] || ''
      ).trim();

    if (
      bcIsClosedIssueStatus_(
        status
      )
    ) {
      continue;
    }

    var created =
      bcParseDate_(
        r[1]
      );

    var deadline =
      bcParseDate_(
        r[7]
      );

    var inNextWeek =
      deadline
        ? bcDateRangesOverlap_(
            deadline,
            deadline,
            nextFrom,
            nextTo
          )
        : false;

    var carryOver = false;

    /*
     * Mục đang mở nhưng:
     * - không có hạn
     * - hoặc hạn trước tuần sau
     * => chuyển tiếp vào kế hoạch tuần sau.
     */
    if (!deadline) {
      carryOver = true;
    } else {
      var dl =
        new Date(
          deadline.getTime()
        );

      dl.setHours(
        23, 59, 59, 999
      );

      if (
        dl < nextFrom
      ) {
        carryOver = true;
      }
    }

    if (
      !inNextWeek &&
      !carryOver
    ) {
      continue;
    }

    result.push({
      id:
        String(
          r[0] || ''
        ),

      date:
        bcFormatDate_(
          r[1]
        ),

      department:
        rowDepartment,

      issue:
        String(
          r[3] || ''
        ),

      cause:
        String(
          r[4] || ''
        ),

      action:
        String(
          r[5] || ''
        ),

      owner:
        owner,

      deadline:
        bcFormatDate_(
          r[7]
        ),

      status:
        status,

      recommendation:
        String(
          r[9] || ''
        ),

      carryOver:
        carryOver
    });
  }

  return result;
}


function bcIsClosedIssueStatus_(
  status
) {
  var s =
    bcNorm_(
      status
    );

  return (
    s === 'hoan thanh' ||
    s === 'da hoan thanh' ||
    s === 'da xu ly' ||
    s === 'dong' ||
    s === 'closed'
  );
}


function bcDateRangesOverlap_(
  start,
  end,
  rangeFrom,
  rangeTo
) {
  if (
    !start &&
    !end
  ) {
    return false;
  }

  var s =
    start
      ? new Date(
          start.getTime()
        )
      : new Date(
          end.getTime()
        );

  var e =
    end
      ? new Date(
          end.getTime()
        )
      : new Date(
          start.getTime()
        );

  s.setHours(
    0, 0, 0, 0
  );

  e.setHours(
    23, 59, 59, 999
  );

  return (
    s <= rangeTo &&
    e >= rangeFrom
  );
}


function bcFormatYmd_(
  value
) {
  var d =
    bcParseDate_(
      value
    );

  return d
    ? Utilities.formatDate(
        d,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      )
    : '';
}


/**
 * Debug mục Kế hoạch tuần sau.
 */
function debugKsNextWeekPlan(
  filters
) {
  filters =
    filters || {};

  return bcBuildNextWeekPlan_(
    String(
      filters.to || ''
    ).trim(),

    String(
      filters.department || ''
    ).trim(),

    String(
      filters.person || ''
    ).trim()
  );
}


/**
 * ============================================================
 * HELPERS RIÊNG CHO BÁO CÁO
 * Dùng tiền tố bc để không xung đột logic cũ.
 * ============================================================
 */

function bcIsSpecialDepartment_(
  department
) {
  return BC_SPECIAL_DEPARTMENTS
    .some(
      function(x) {
        return bcSameText_(
          x,
          department
        );
      }
    );
}

function bcGetSheet_(name) {
  var ss = (typeof getAppSpreadsheet_ === 'function')
    ? getAppSpreadsheet_()
    : SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

function bcSheetName_(key, fallback) {
  if (typeof EXT_CONFIG !== 'undefined' && EXT_CONFIG.SHEETS && EXT_CONFIG.SHEETS[key]) {
    return EXT_CONFIG.SHEETS[key];
  }
  if (APP_CONFIG.SHEETS && APP_CONFIG.SHEETS[key]) {
    return APP_CONFIG.SHEETS[key];
  }
  return fallback;
}


function bcEffectivePlanStatus_(
  savedStatus,
  endDate
) {
  var s =
    bcNorm_(
      savedStatus
    );

  if (
    s === 'hoan thanh' ||
    s === 'chuyen tiep'
  ) {
    return s === 'hoan thanh'
      ? 'HOÀN THÀNH'
      : 'CHUYỂN TIẾP';
  }

  if (
    s === 'dang lam' ||
    s === 'dang thuc hien'
  ) {
    savedStatus =
      'ĐANG THỰC HIỆN';
  } else if (
    s === 'chua thuc hien' ||
    s === 'chua bat dau'
  ) {
    savedStatus =
      'CHƯA BẮT ĐẦU';
  } else if (
    s === 'qua han'
  ) {
    savedStatus =
      'QUÁ HẠN';
  }

  var d =
    bcParseDate_(
      endDate
    );

  if (d) {
    d.setHours(
      23,
      59,
      59,
      999
    );

    if (
      new Date() > d
    ) {
      return 'QUÁ HẠN';
    }
  }

  return String(
    savedStatus ||
    'CHƯA BẮT ĐẦU'
  );
}


function bcFormatDateTimeSafe_(
  value
) {
  var d =
    bcParseDate_(
      value
    );

  if (!d) {
    return '';
  }

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm:ss'
  );
}


function bcNorm_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function bcSameText_(a, b) {
  return bcNorm_(a) === bcNorm_(b);
}

function bcSameStaff_(employee, form) {
  if (
    employee.staffId &&
    form.staffId &&
    String(employee.staffId).trim() === String(form.staffId).trim()
  ) {
    return true;
  }
  return bcSameText_(employee.name, form.name);
}

function bcParseDate_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  var s = String(value).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function bcFormatDate_(value) {
  var d = bcParseDate_(value);
  return d
    ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy')
    : '';
}

function bcInRange_(value, from, to) {
  var d = bcParseDate_(value);
  if (!d) return false;

  d.setHours(0, 0, 0, 0);

  var f = bcParseDate_(from);
  var t = bcParseDate_(to);

  if (f) f.setHours(0, 0, 0, 0);
  if (t) t.setHours(23, 59, 59, 999);

  return (!f || d >= f) && (!t || d <= t);
}

function bcOverlapRange_(start, end, from, to) {
  if (!from && !to) return true;

  var s = bcParseDate_(start);
  var e = bcParseDate_(end);
  var f = bcParseDate_(from);
  var t = bcParseDate_(to);

  if (!s && !e) return true;

  var left = s || e;
  var right = e || s;

  if (left) left.setHours(0, 0, 0, 0);
  if (right) right.setHours(23, 59, 59, 999);

  if (!f) f = new Date(1900, 0, 1);
  if (!t) t = new Date(2999, 11, 31);

  f.setHours(0, 0, 0, 0);
  t.setHours(23, 59, 59, 999);

  return left <= t && right >= f;
}

function bcIsDone_(status) {
  var s = bcNorm_(status);
  return s.indexOf('hoan thanh') !== -1 || s === 'dat';
}

function bcIsMatrixSection_(criterion) {
  return criterion === 'THÁI ĐỘ TÁC PHONG' ||
         criterion === 'CÔNG TÁC CHUẨN BỊ VÀ TUÂN THỦ QUY TRÌNH VỆ SINH' ||
         criterion === 'VỆ SINH MÔI TRƯỜNG CHUNG';
}


/**
 * So khớp tiêu chí:
 * - Ưu tiên chính xác.
 * - Hỗ trợ dữ liệu cũ/phiếu rút gọn bằng so khớp chứa từ khóa.
 */
function bcCriterionMatches_(criterion, content, detail) {
  var c = bcNorm_(criterion);
  var a = bcNorm_(content);
  var b = bcNorm_(detail);

  if (!c) return false;
  if (c === a || c === b) return true;
  if (a && (a.indexOf(c) !== -1 || c.indexOf(a) !== -1)) return true;
  if (b && (b.indexOf(c) !== -1 || c.indexOf(b) !== -1)) return true;

  var cTokens = c.split(' ').filter(function(x) { return x.length >= 4; });
  if (!cTokens.length) return false;

  var text = a + ' ' + b;
  var hit = 0;

  cTokens.forEach(function(token) {
    if (text.indexOf(token) !== -1) hit++;
  });

  return hit / cTokens.length >= 0.65;
}



/**
 * ============================================================
 * API V3 JSON - CHỐNG XUNG ĐỘT + CHỐNG LỖI SERIALIZE
 * ============================================================
 * Luôn trả về STRING JSON, không trả object trực tiếp.
 * Vì vậy Date/object đặc biệt trong Apps Script không thể làm
 * google.script.run nhận null/undefined.
 */

function ksReportV3InitialJson() {
  try {
    var payload = getKsReportInitialData();
    return JSON.stringify({
      success: true,
      apiVersion: 'KS_REPORT_V3_JSON',
      data: payload
    });
  } catch (err) {
    return JSON.stringify({
      success: false,
      apiVersion: 'KS_REPORT_V3_JSON',
      error: err && err.message ? err.message : String(err)
    });
  }
}

function ksReportV3DepartmentJson(filters) {
  try {
    filters = filters || {};

    var report = getKsDepartmentReport(filters);

    if (!report || typeof report !== 'object') {
      return JSON.stringify({
        success: false,
        apiVersion: 'KS_REPORT_V3_JSON',
        error: 'Hàm getKsDepartmentReport không trả về object.',
        receivedType: typeof report
      });
    }

    return JSON.stringify({
      success: true,
      apiVersion: 'KS_REPORT_V3_JSON',
      data: report
    });

  } catch (err) {
    return JSON.stringify({
      success: false,
      apiVersion: 'KS_REPORT_V3_JSON',
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? String(err.stack) : ''
    });
  }
}

/**
 * Kiểm tra nhanh API V3 ngay trong Apps Script Editor.
 */
function debugKsReportV3() {
  var sample = {
    from: '',
    to: '',
    department: 'VỆ SINH MÔI TRƯỜNG',
    person: ''
  };

  var text = ksReportV3DepartmentJson(sample);

  return {
    length: text.length,
    preview: text.substring(0, 1000)
  };
}



/**
 * ============================================================
 * DEBUG MA TRẬN VSMT ĐỘNG
 *
 * Chạy:
 * debugKsVsmtMatrix({
 *   from:'2026-08-01',
 *   to:'2026-08-31',
 *   person:''
 * })
 * ============================================================
 */
function debugKsVsmtMatrix(filters) {
  filters = filters || {};

  var from = String(filters.from || '').trim();
  var to = String(filters.to || '').trim();
  var person = String(filters.person || '').trim();

  var forms = bcGetChecklistFormRows_(
    from,
    to,
    BC_VSMT_DEPARTMENT,
    person
  );

  var details = bcGetChecklistDetailRows_(
    forms
  );

  var matrix = bcBuildVsmtMatrix_(
    from,
    to,
    forms,
    details,
    person
  );

  return {
    forms: forms.length,
    details: details.length,
    criteria: matrix.criteria.length,
    staff: matrix.staff.length,
    rows: matrix.rows.length,
    summary: matrix.summary.length,
    formCodes: forms.map(function(x) {
      return x.formCode;
    }),
    criterionIds: matrix.criteria.map(function(x) {
      return x.criterionId;
    }).slice(0, 50)
  };
}



/**
 * DEBUG MA TRẬN 4 BỘ PHẬN.
 */
function debugKsDepartmentMatrix(
  filters
) {
  filters =
    filters || {};

  var from =
    String(
      filters.from || ''
    ).trim();

  var to =
    String(
      filters.to || ''
    ).trim();

  var department =
    String(
      filters.department ||
      'VỆ SINH MÔI TRƯỜNG'
    ).trim();

  var person =
    String(
      filters.person || ''
    ).trim();

  var forms =
    bcGetChecklistFormRows_(
      from,
      to,
      department,
      person
    );

  var details =
    bcGetChecklistDetailRows_(
      forms
    );

  var matrix =
    bcBuildDepartmentMatrix_(
      from,
      to,
      forms,
      details,
      department,
      person
    );

  return {
    department:
      department,

    forms:
      forms.length,

    details:
      details.length,

    criteria:
      matrix.criteria.length,

    staff:
      matrix.staff.length,

    rows:
      matrix.rows.length,

    summary:
      matrix.summary.length,

    formCodes:
      forms.map(
        function(x) {
          return x.formCode;
        }
      ),

    criterionIds:
      matrix.criteria
        .map(
          function(x) {
            return x.criterionId;
          }
        )
        .slice(
          0,
          100
        )
  };
}


/**
 * ============================================================
 * API LƯU V11.4 - LUÔN TRẢ STRING JSON
 * ============================================================
 * BaoCao.html gọi trực tiếp ba hàm này bằng google.script.run.
 * Không phụ thuộc AppUtil.server hoặc danh sách hàm cho phép ở file HTML khác.
 */
function bcSaveReportOpinionV114Json(payload) {
  return bcSaveApiJson_(function() {
    return saveReportOpinion(payload || {});
  });
}


function bcDeleteReportOpinionV114Json(payload) {
  return bcSaveApiJson_(function() {
    return deleteReportOpinion(payload || {});
  });
}


function bcSaveReportIssueEntryV114Json(payload) {
  return bcSaveApiJson_(function() {
    return saveReportIssueEntry(payload || {});
  });
}


/**
 * Một cổng duy nhất cho toàn bộ thao tác lưu/lấy/sửa dữ liệu Báo cáo V12.
 * HTML chỉ cần gọi đúng một hàm công khai này.
 */
function bcReportDataV120Json(request) {
  request = request || {};

  return bcSaveApiJson_(function() {
    var action = String(request.action || '').trim().toUpperCase();
    var payload = request.payload || {};

    if (action === 'PING') {
      var ss = bcGetWritableSpreadsheet_();
      var opinion = bcSetupReportOpinionV112_();
      var issue = setupBaoCaoIssueSystem();

      return {
        connected: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        opinionSheet: opinion.mainSheet.getName(),
        opinionHistorySheet: opinion.historySheet.getName(),
        issueSheet: issue.sheet,
        apiVersion: 'KS_REPORT_DATA_V12'
      };
    }

    if (action === 'SAVE_OPINION') {
      return saveReportOpinion(payload);
    }

    if (action === 'DELETE_OPINION') {
      return deleteReportOpinion(payload);
    }

    if (action === 'SAVE_ISSUE') {
      return saveReportIssueEntry(payload);
    }

    if (action === 'GET_ISSUE') {
      return getReportIssueEntry(payload);
    }

    throw new Error('Thao tác dữ liệu Báo cáo không hợp lệ: ' + action);
  });
}


/**
 * Chạy trong Apps Script Editor để kiểm tra cấu hình mà không tạo dữ liệu giả.
 */
function debugBaoCaoSaveV114() {
  var ss = bcGetWritableSpreadsheet_();
  var opinion = bcSetupReportOpinionV112_();
  var issue = setupBaoCaoIssueSystem();

  return {
    success: true,
    apiVersion: 'KS_REPORT_SAVE_V11_4',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    opinionSheet: opinion.mainSheet.getName(),
    opinionHistorySheet: opinion.historySheet.getName(),
    issueSheet: issue.sheet,
    message: 'Kết nối lưu dữ liệu báo cáo đã sẵn sàng.'
  };
}


/**
 * Chạy đúng 1 lần sau khi thay code V12 để cấp quyền và kiểm tra nơi lưu.
 */
function setupBaoCaoV120() {
  var ss = bcGetWritableSpreadsheet_();
  var opinion = bcSetupReportOpinionV112_();
  var issue = setupBaoCaoIssueSystem();

  return {
    success: true,
    version: 'V12',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    opinionSheet: opinion.mainSheet.getName(),
    opinionHistorySheet: opinion.historySheet.getName(),
    issueSheet: issue.sheet,
    message: 'Báo cáo V12 đã sẵn sàng lưu, đọc lại và cập nhật dữ liệu.'
  };
}


/**
 * V11.3 - setup tổng hợp phần phản hồi lưu.
 */
function setupBaoCaoV113() {
  var opinion =
    setupBaoCaoOpinionV112();

  var issue =
    setupBaoCaoIssueSystem();

  return {
    success:true,
    opinion:opinion,
    issue:issue,
    message:
      'Đã sẵn sàng Báo cáo V11.3: hiển thị trạng thái lưu rõ ràng cho Ý kiến, Mục 10 và Mục 11.'
  };
}


/**
 * ============================================================
 * V20 - BỔ SUNG SỬA TRỰC TIẾP TỪ BÁO CÁO
 * CHỈ THÊM, KHÔNG THAY ĐỔI API CŨ.
 * ============================================================
 */
function bcInlineUpdateV20(payload) {
  payload = payload || {};
  var kind = String(payload.kind || '').trim().toUpperCase();
  var id = String(payload.id || '').trim();
  if (!id) throw new Error('Thiếu mã bản ghi.');

  function findById(sh) {
    if (!sh || sh.getLastRow() < 2) return 0;
    var vals = sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues();
    for (var i=0;i<vals.length;i++) if (String(vals[i][0]||'').trim()===id) return i+2;
    return 0;
  }

  if (kind === 'TASK') {
    var tsh = getRequiredSheet_(APP_CONFIG.SHEETS.TASKS);
    var tr = findById(tsh); if (!tr) throw new Error('Không tìm thấy công việc: '+id);
    if (payload.status !== undefined) tsh.getRange(tr,9).setValue(String(payload.status||''));
    if (payload.evalStatus !== undefined) tsh.getRange(tr,12).setValue(String(payload.evalStatus||''));
    if (payload.note !== undefined) tsh.getRange(tr,13).setValue(String(payload.note||''));
    return {success:true,message:'Đã lưu công việc.'};
  }

  if (kind === 'PLAN') {
    var type = String(payload.planType || 'WEEK').toUpperCase();
    var psh = khGetSheet_(khPlanSheetName_(type));
    var pr = findById(psh); if (!pr) throw new Error('Không tìm thấy kế hoạch: '+id);
    if (payload.status !== undefined) psh.getRange(pr,7).setValue(khNormalizePlanStatus_(payload.status));
    if (payload.note !== undefined) psh.getRange(pr,9).setValue(String(payload.note||''));
    if (payload.description !== undefined) {
      if (psh.getMaxColumns()<16) psh.insertColumnsAfter(psh.getMaxColumns(),16-psh.getMaxColumns());
      if (!String(psh.getRange(1,16).getDisplayValue()||'').trim()) psh.getRange(1,16).setValue('Nội dung / Mô tả');
      psh.getRange(pr,16).setValue(String(payload.description||''));
    }
    psh.getRange(pr,14).setValue(new Date());
    return {success:true,message:'Đã lưu kế hoạch.'};
  }

  if (kind === 'VIOLATION') {
    var vsh = getRequiredSheet_(APP_CONFIG.SHEETS.VIOLATIONS);
    var vr = findById(vsh); if (!vr) throw new Error('Không tìm thấy vi phạm: '+id);
    if (payload.status !== undefined) vsh.getRange(vr,12).setValue(String(payload.status||''));
    if (payload.note !== undefined) vsh.getRange(vr,11).setValue(String(payload.note||''));
    return {success:true,message:'Đã lưu vi phạm.'};
  }

  if (kind === 'ISSUE') {
    var ish = bcGetIssueSheetRobust_(bcGetWritableSpreadsheet_(), false);
    var ir = findById(ish); if (!ir) throw new Error('Không tìm thấy tồn tại/sự cố: '+id);
    if (payload.status !== undefined) ish.getRange(ir,9).setValue(String(payload.status||''));
    if (payload.note !== undefined) ish.getRange(ir,13).setValue(String(payload.note||''));
    ish.getRange(ir,12).setValue(new Date());
    return {success:true,message:'Đã lưu trạng thái.'};
  }

  throw new Error('Loại dữ liệu không hỗ trợ: '+kind);
}


/**
 * V2 - kiểm tra riêng danh sách Bộ phận của Báo cáo.
 */
function KSNK_TEST_BOPHAN_BAOCAO() {
  var d = getKsReportInitialData();
  Logger.log(JSON.stringify(d.departments || []));
  return d.departments || [];
}


/**
 * Kiểm tra nhanh 7. BÁO CÁO TỔNG HỢP MỚI.
 * Không sửa dữ liệu.
 */
function KSNK_TEST_BAOCAO_V7() {
  var result = {
    spreadsheet: '',
    departments: [],
    staffCount: 0,
    initJsonOk: false,
    reportJsonOk: false
  };

  var ss = getAppSpreadsheet_();
  result.spreadsheet = ss.getName();

  var init = getKsReportInitialData();
  result.departments = (init && init.departments) || [];
  result.staffCount = (init && init.staff && init.staff.length) || 0;

  var initText = ksReportV3InitialJson();
  var initPacket = JSON.parse(String(initText || '{}'));
  result.initJsonOk = !!initPacket.success;

  var now = new Date();
  var from = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var to = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var reportText = ksReportV3DepartmentJson({from:from,to:to,department:'',person:''});
  var reportPacket = JSON.parse(String(reportText || '{}'));
  result.reportJsonOk = !!reportPacket.success;

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
