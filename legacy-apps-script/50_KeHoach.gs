/**
 * ============================================================
 * 50_KeHoach.gs
 * QUẢN LÝ KẾ HOẠCH + TỒN TẠI / SỰ CỐ / KIẾN NGHỊ
 * BẢN V9 - COPY LÀ SỬ DỤNG
 * ============================================================
 *
 * CHỨC NĂNG:
 * - Kế hoạch tuần / tháng theo Bộ phận.
 * - Người phụ trách lấy từ DM_NHANVIEN.
 * - Thêm / sửa / xóa kế hoạch.
 * - Tích hoàn thành.
 * - Tự động QUÁ HẠN khi hết "Đến ngày" mà chưa hoàn thành.
 * - Chuyển tiếp sang tuần sau / tháng sau:
 *   tạo bản mới, trạng thái CHƯA BẮT ĐẦU, giữ lịch sử bản cũ.
 * - Quản lý TỒN TẠI / SỰ CỐ / KIẾN NGHỊ.
 * - Dữ liệu dùng trực tiếp cho 60_BaoCao.gs.
 *
 * Không có doGet() trong file này.
 * ============================================================
 */

const KH_PLAN_HEADERS = [
  'Mã KH',
  'Từ ngày',
  'Đến ngày',
  'Bộ phận',
  'Nội dung',
  'Người phụ trách',
  'Trạng thái',
  'Kết quả',
  'Ghi chú',
  'Thời gian lưu',
  'Ngày hoàn thành',
  'Mã kế hoạch gốc',
  'Kỳ chuyển tiếp',
  'Cập nhật lúc',
  'Người cập nhật',
  'Nội dung / Mô tả'
];

const KH_ISSUE_HEADERS = [
  'Mã TT',
  'Ngày ghi nhận',
  'Bộ phận',
  'Tồn tại / Sự cố / Kiến nghị',
  'Nguyên nhân',
  'Phương án khắc phục',
  'Người phụ trách',
  'Hạn xử lý',
  'Trạng thái',
  'Kiến nghị',
  'Thời gian lưu',
  'Cập nhật lúc',
  'Ghi chú'
];

const KH_PLAN_STATUSES = [
  'CHƯA BẮT ĐẦU',
  'ĐANG THỰC HIỆN',
  'HOÀN THÀNH',
  'QUÁ HẠN',
  'CHUYỂN TIẾP'
];

const KH_ISSUE_STATUSES = [
  'CHƯA KHẮC PHỤC',
  'ĐANG XỬ LÝ',
  'ĐÃ KHẮC PHỤC',
  'QUÁ HẠN'
];

/**
 * ============================================================
 * SETUP - CHẠY 1 LẦN HOẶC TỰ ĐỘNG KHI MỞ MODULE
 * ============================================================
 */
function setupKeHoachSystem() {
  var ss = khSpreadsheet_();

  khEnsureSheetHeaders_(
    ss,
    khPlanSheetName_('WEEK'),
    KH_PLAN_HEADERS
  );

  khEnsureSheetHeaders_(
    ss,
    khPlanSheetName_('MONTH'),
    KH_PLAN_HEADERS
  );

  khEnsureSheetHeaders_(
    ss,
    khIssueSheetName_(),
    KH_ISSUE_HEADERS
  );

  khRefreshOverdueStatuses_();

  return {
    success: true,
    message: 'Đã kiểm tra/cập nhật cấu trúc KẾ HOẠCH thành công.',
    sheets: {
      weekly: khPlanSheetName_('WEEK'),
      monthly: khPlanSheetName_('MONTH'),
      issues: khIssueSheetName_()
    }
  };
}

/**
 * ============================================================
 * DỮ LIỆU KHỞI TẠO MODULE
 * ============================================================
 */
function getPlanInitialData() {
  setupKeHoachSystem();

  return {
    success: true,
    staff: khActiveStaff_(),
    departments: khDepartments_(),
    statuses: KH_PLAN_STATUSES.slice(),
    issueStatuses: KH_ISSUE_STATUSES.slice(),
    weekly: getPlanRows_('WEEK'),
    monthly: getPlanRows_('MONTH'),
    issues: getIssueRows_()
  };
}

/**
 * Dùng khi bấm "Làm mới" hoặc thay bộ lọc.
 */
function getPlanManagementData(filters) {
  setupKeHoachSystem();

  filters = filters || {};

  var type = String(filters.type || 'ALL').toUpperCase();
  var from = String(filters.from || '').trim();
  var to = String(filters.to || '').trim();
  var department = String(filters.department || '').trim();
  var person = String(filters.person || '').trim();
  var status = String(filters.status || '').trim();

  var weekly = type === 'MONTH'
    ? []
    : getPlanRows_(
        'WEEK',
        from,
        to,
        department,
        person,
        status
      );

  var monthly = type === 'WEEK'
    ? []
    : getPlanRows_(
        'MONTH',
        from,
        to,
        department,
        person,
        status
      );

  var issues = getIssueRows_(
    from,
    to,
    department,
    person
  );

  var all = weekly.concat(monthly);

  return {
    success: true,
    weekly: weekly,
    monthly: monthly,
    issues: issues,
    summary: {
      total: all.length,
      notStarted: all.filter(function(x) {
        return khNorm_(x.status) === 'chua bat dau';
      }).length,
      doing: all.filter(function(x) {
        return khNorm_(x.status) === 'dang thuc hien';
      }).length,
      done: all.filter(function(x) {
        return khNorm_(x.status) === 'hoan thanh';
      }).length,
      overdue: all.filter(function(x) {
        return khNorm_(x.status) === 'qua han';
      }).length,
      carried: all.filter(function(x) {
        return khNorm_(x.status) === 'chuyen tiep';
      }).length,
      issuesOpen: issues.filter(function(x) {
        return !khIssueClosed_(x.status);
      }).length
    }
  };
}

/**
 * ============================================================
 * KẾ HOẠCH - TẠO / SỬA
 * ============================================================
 */
function savePlan(formData) {
  setupKeHoachSystem();

  formData = formData || {};

  var type = String(formData.type || 'WEEK').toUpperCase();
  if (type !== 'WEEK' && type !== 'MONTH') {
    throw new Error('Loại kế hoạch không hợp lệ.');
  }

  var sh = khGetSheet_(khPlanSheetName_(type));

  var from = khParseDate_(formData.from);
  var to = khParseDate_(formData.to);

  if (!from || !to) {
    throw new Error('Phải nhập đầy đủ Từ ngày và Đến ngày.');
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  if (to < from) {
    throw new Error('Đến ngày không được nhỏ hơn Từ ngày.');
  }

  var department = khRequireText_(
    formData.department,
    'Bộ phận'
  );

  var content = khRequireText_(
    formData.content,
    'Nội dung kế hoạch'
  );

  var owner = String(formData.owner || '').trim();

  var status = khNormalizePlanStatus_(
    formData.status || 'CHƯA BẮT ĐẦU'
  );

  var now = new Date();
  var completedAt =
    status === 'HOÀN THÀNH'
      ? now
      : '';

  var id = String(formData.id || '').trim();

  if (id) {
    var row = khFindRowById_(sh, id);

    if (!row) {
      throw new Error(
        'Không tìm thấy kế hoạch cần sửa: ' + id
      );
    }

    /*
     * Giữ các cột lịch sử cũ.
     */
    var old = sh
      .getRange(row, 1, 1, Math.max(sh.getLastColumn(), 15))
      .getValues()[0];

    var createdAt = old[9] || now;
    var rootId = old[11] || '';
    var carryPeriod = old[12] || '';

    sh.getRange(row, 1, 1, 16).setValues([[
      id,
      from,
      to,
      department,
      content,
      owner,
      status,
      String(formData.result || ''),
      String(formData.note || ''),
      createdAt,
      completedAt || old[10] || '',
      rootId,
      carryPeriod,
      now,
      khCurrentUser_(),
      String(formData.description || old[15] || '')
    ]]);

    khFormatPlanRow_(sh, row);

    return {
      success: true,
      id: id,
      message: 'Đã cập nhật kế hoạch.'
    };
  }

  id = khCreateId_(
    type === 'MONTH'
      ? 'KHM'
      : 'KHT'
  );

  sh.appendRow([
    id,
    from,
    to,
    department,
    content,
    owner,
    status,
    String(formData.result || ''),
    String(formData.note || ''),
    now,
    completedAt,
    '',
    '',
    now,
    khCurrentUser_(),
    String(formData.description || '')
  ]);

  khFormatPlanRow_(sh, sh.getLastRow());

  return {
    success: true,
    id: id,
    message: 'Đã lưu kế hoạch.'
  };
}

/**
 * ============================================================
 * ĐỌC KẾ HOẠCH - GIỮ TƯƠNG THÍCH 60_BaoCao.gs
 * ============================================================
 */
function getPlanRows_(
  type,
  from,
  to,
  department,
  person,
  status
) {
  type = String(type || 'WEEK').toUpperCase();

  var sh = khGetSheet_(
    khPlanSheetName_(type)
  );

  if (!sh || sh.getLastRow() < 2) {
    return [];
  }

  var data = sh
    .getDataRange()
    .getValues();

  var out = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];

    if (!r[0]) {
      continue;
    }

    if (
      (from || to) &&
      !khOverlapRange_(
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
      !khSameText_(
        r[3],
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !khSameText_(
        r[5],
        person
      )
    ) {
      continue;
    }

    var effectiveStatus =
      khEffectivePlanStatus_(
        r[6],
        r[2]
      );

    if (
      status &&
      !khSameText_(
        effectiveStatus,
        status
      )
    ) {
      continue;
    }

    out.push({
      id: String(r[0] || ''),
      type: type,
      typeLabel:
        type === 'MONTH'
          ? 'KẾ HOẠCH THÁNG'
          : 'KẾ HOẠCH TUẦN',
      from: khFormatDate_(r[1]),
      to: khFormatDate_(r[2]),
      fromYmd: khYmd_(r[1]),
      toYmd: khYmd_(r[2]),
      department: String(r[3] || ''),
      content: String(r[4] || ''),
      owner: String(r[5] || ''),
      status: effectiveStatus,
      savedStatus: String(r[6] || ''),
      result: String(r[7] || ''),
      note: String(r[8] || ''),
      createdAt: khFormatDateTime_(r[9]),
      completedAt: khFormatDateTime_(r[10]),
      rootId: String(r[11] || ''),
      carryPeriod: String(r[12] || ''),
      updatedAt: khFormatDateTime_(r[13]),
      updatedBy: String(r[14] || ''),
      description: String(r[15] || ''),
      overdue:
        khNorm_(effectiveStatus) === 'qua han'
    });
  }

  out.sort(function(a, b) {
    var da = khParseDate_(a.fromYmd);
    var db = khParseDate_(b.fromYmd);

    var ta = da ? da.getTime() : 0;
    var tb = db ? db.getTime() : 0;

    if (ta !== tb) {
      return tb - ta;
    }

    return String(a.department || '')
      .localeCompare(
        String(b.department || ''),
        'vi'
      );
  });

  return out;
}

/**
 * ============================================================
 * CẬP NHẬT TRẠNG THÁI NHANH
 * ============================================================
 */
function updatePlanStatus(
  id,
  type,
  status,
  result
) {
  setupKeHoachSystem();

  var sh = khGetSheet_(
    khPlanSheetName_(type)
  );

  var row = khFindRowById_(
    sh,
    id
  );

  if (!row) {
    throw new Error(
      'Không tìm thấy kế hoạch.'
    );
  }

  var normalized =
    khNormalizePlanStatus_(
      status
    );

  sh.getRange(row, 7)
    .setValue(normalized);

  if (typeof result !== 'undefined') {
    sh.getRange(row, 8)
      .setValue(
        String(result || '')
      );
  }

  sh.getRange(row, 11)
    .setValue(
      normalized === 'HOÀN THÀNH'
        ? new Date()
        : ''
    );

  sh.getRange(row, 14)
    .setValue(new Date());

  sh.getRange(row, 15)
    .setValue(
      khCurrentUser_()
    );

  khFormatPlanRow_(
    sh,
    row
  );

  return {
    success: true,
    message:
      'Đã cập nhật trạng thái ' +
      normalized +
      '.'
  };
}

function completePlan(
  id,
  type,
  result
) {
  return updatePlanStatus(
    id,
    type,
    'HOÀN THÀNH',
    result || ''
  );
}

/**
 * Trả cùng bản ghi về CHƯA BẮT ĐẦU.
 * Nếu ngày cũ đã hết hạn, khi tải lại nó sẽ tự thành QUÁ HẠN.
 * Muốn làm tiếp ở kỳ mới, dùng carryPlanForward().
 */
function resetPlanToNotStarted(
  id,
  type
) {
  return updatePlanStatus(
    id,
    type,
    'CHƯA BẮT ĐẦU',
    ''
  );
}

/**
 * ============================================================
 * CHUYỂN TIẾP TUẦN SAU / THÁNG SAU
 *
 * Không xóa lịch sử.
 * Bản cũ = CHUYỂN TIẾP.
 * Bản mới = CHƯA BẮT ĐẦU.
 * ============================================================
 */
function carryPlanForward(
  id,
  type
) {
  setupKeHoachSystem();

  type = String(type || 'WEEK').toUpperCase();

  var sh = khGetSheet_(
    khPlanSheetName_(type)
  );

  var row = khFindRowById_(
    sh,
    id
  );

  if (!row) {
    throw new Error(
      'Không tìm thấy kế hoạch cần chuyển tiếp.'
    );
  }

  var r = sh
    .getRange(row, 1, 1, 15)
    .getValues()[0];

  var oldFrom =
    khParseDate_(r[1]);

  var oldTo =
    khParseDate_(r[2]);

  if (!oldFrom || !oldTo) {
    throw new Error(
      'Kế hoạch cũ không có thời gian hợp lệ.'
    );
  }

  var next =
    type === 'MONTH'
      ? khNextMonthRange_(
          oldFrom
        )
      : khNextWeekRange_(
          oldTo
        );

  var newId =
    khCreateId_(
      type === 'MONTH'
        ? 'KHM'
        : 'KHT'
    );

  var rootId =
    String(
      r[11] || r[0] || ''
    );

  var periodText =
    type === 'MONTH'
      ? 'THÁNG SAU'
      : 'TUẦN SAU';

  var now = new Date();

  /*
   * Đánh dấu bản cũ.
   */
  sh.getRange(row, 7)
    .setValue(
      'CHUYỂN TIẾP'
    );

  sh.getRange(row, 13)
    .setValue(
      periodText
    );

  sh.getRange(row, 14)
    .setValue(now);

  sh.getRange(row, 15)
    .setValue(
      khCurrentUser_()
    );

  /*
   * Tạo bản mới.
   */
  sh.appendRow([
    newId,
    next.from,
    next.to,
    String(r[3] || ''),
    String(r[4] || ''),
    String(r[5] || ''),
    'CHƯA BẮT ĐẦU',
    '',
    String(r[8] || ''),
    now,
    '',
    rootId,
    periodText,
    now,
    khCurrentUser_()
  ]);

  khFormatPlanRow_(
    sh,
    row
  );

  khFormatPlanRow_(
    sh,
    sh.getLastRow()
  );

  return {
    success: true,
    oldId: String(r[0] || ''),
    newId: newId,
    from: khFormatDate_(next.from),
    to: khFormatDate_(next.to),
    message:
      'Đã chuyển kế hoạch sang ' +
      periodText.toLowerCase() +
      ' và trả bản mới về CHƯA BẮT ĐẦU.'
  };
}

/**
 * ============================================================
 * XÓA KẾ HOẠCH - DÙNG CHO BẢN GHI NHẬP NHẦM
 * ============================================================
 */
function deletePlan(
  id,
  type
) {
  setupKeHoachSystem();

  var sh = khGetSheet_(
    khPlanSheetName_(type)
  );

  var row = khFindRowById_(
    sh,
    id
  );

  if (!row) {
    throw new Error(
      'Không tìm thấy kế hoạch cần xóa.'
    );
  }

  sh.deleteRow(row);

  return {
    success: true,
    message: 'Đã xóa kế hoạch.'
  };
}

/**
 * ============================================================
 * TỒN TẠI / SỰ CỐ / KIẾN NGHỊ - TẠO / SỬA
 * ============================================================
 */
function saveIssue(formData) {
  setupKeHoachSystem();

  formData = formData || {};

  var sh = khGetSheet_(
    khIssueSheetName_()
  );

  var date =
    khParseDate_(
      formData.date
    ) || new Date();

  var deadline =
    khParseDate_(
      formData.deadline
    );

  var department =
    String(
      formData.department || ''
    ).trim();

  var owner =
    String(
      formData.owner || ''
    ).trim();

  /*
   * Nếu Bộ phận trống nhưng có người phụ trách,
   * suy ra từ DM_NHANVIEN.
   */
  if (
    !department &&
    owner
  ) {
    var emp =
      khFindStaffByName_(
        owner
      );

    department =
      emp
        ? String(
            emp.department || ''
          ).trim()
        : '';
  }

  department =
    khRequireText_(
      department,
      'Bộ phận'
    );

  var issue =
    khRequireText_(
      formData.issue,
      'Tồn tại / Sự cố / Kiến nghị'
    );

  var status =
    khNormalizeIssueStatus_(
      formData.status ||
      'CHƯA KHẮC PHỤC'
    );

  var now =
    new Date();

  var id =
    String(
      formData.id || ''
    ).trim();

  if (id) {
    var row =
      khFindRowById_(
        sh,
        id
      );

    if (!row) {
      throw new Error(
        'Không tìm thấy tồn tại cần sửa.'
      );
    }

    var old =
      sh.getRange(
        row,
        1,
        1,
        Math.max(
          sh.getLastColumn(),
          13
        )
      ).getValues()[0];

    sh.getRange(
      row,
      1,
      1,
      13
    ).setValues([[
      id,
      date,
      department,
      issue,
      String(formData.cause || ''),
      String(formData.action || ''),
      owner,
      deadline || '',
      status,
      String(formData.recommendation || ''),
      old[10] || now,
      now,
      String(formData.note || '')
    ]]);

    khFormatIssueRow_(
      sh,
      row
    );

    return {
      success: true,
      id: id,
      message: 'Đã cập nhật tồn tại / kiến nghị.'
    };
  }

  id =
    khCreateId_(
      'TT'
    );

  sh.appendRow([
    id,
    date,
    department,
    issue,
    String(formData.cause || ''),
    String(formData.action || ''),
    owner,
    deadline || '',
    status,
    String(formData.recommendation || ''),
    now,
    now,
    String(formData.note || '')
  ]);

  khFormatIssueRow_(
    sh,
    sh.getLastRow()
  );

  return {
    success: true,
    id: id,
    message: 'Đã lưu tồn tại / kiến nghị.'
  };
}

/**
 * ============================================================
 * ĐỌC TỒN TẠI - GIỮ TƯƠNG THÍCH BÁO CÁO
 * ============================================================
 */
function getIssueRows_(
  from,
  to,
  department,
  person
) {
  var sh =
    khGetSheet_(
      khIssueSheetName_()
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
    var r = data[i];

    if (!r[0]) {
      continue;
    }

    if (
      (from || to) &&
      !khInRange_(
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

    var owner =
      String(
        r[6] || ''
      ).trim();

    if (
      !rowDepartment &&
      owner
    ) {
      var emp =
        khFindStaffByName_(
          owner
        );

      if (emp) {
        rowDepartment =
          String(
            emp.department || ''
          ).trim();
      }
    }

    if (
      department &&
      !khSameText_(
        rowDepartment,
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !khSameText_(
        owner,
        person
      )
    ) {
      continue;
    }

    var status =
      khEffectiveIssueStatus_(
        r[8],
        r[7]
      );

    out.push({
      id: String(r[0] || ''),
      date: khFormatDate_(r[1]),
      dateYmd: khYmd_(r[1]),
      department: rowDepartment,
      issue: String(r[3] || ''),
      cause: String(r[4] || ''),
      action: String(r[5] || ''),
      owner: owner,
      deadline: khFormatDate_(r[7]),
      deadlineYmd: khYmd_(r[7]),
      status: status,
      recommendation: String(r[9] || ''),
      createdAt: khFormatDateTime_(r[10]),
      updatedAt: khFormatDateTime_(r[11]),
      note: String(r[12] || ''),
      overdue:
        khNorm_(status) === 'qua han'
    });
  }

  out.sort(function(a, b) {
    var da =
      khParseDate_(
        a.dateYmd
      );

    var db =
      khParseDate_(
        b.dateYmd
      );

    return (
      (db ? db.getTime() : 0)
      -
      (da ? da.getTime() : 0)
    );
  });

  return out;
}

function updateIssueStatus(
  id,
  status
) {
  setupKeHoachSystem();

  var sh =
    khGetSheet_(
      khIssueSheetName_()
    );

  var row =
    khFindRowById_(
      sh,
      id
    );

  if (!row) {
    throw new Error(
      'Không tìm thấy tồn tại / sự cố.'
    );
  }

  var normalized =
    khNormalizeIssueStatus_(
      status
    );

  sh.getRange(row, 9)
    .setValue(
      normalized
    );

  sh.getRange(row, 12)
    .setValue(
      new Date()
    );

  return {
    success: true,
    message:
      'Đã cập nhật trạng thái ' +
      normalized +
      '.'
  };
}

function deleteIssue(id) {
  setupKeHoachSystem();

  var sh =
    khGetSheet_(
      khIssueSheetName_()
    );

  var row =
    khFindRowById_(
      sh,
      id
    );

  if (!row) {
    throw new Error(
      'Không tìm thấy tồn tại / sự cố cần xóa.'
    );
  }

  sh.deleteRow(row);

  return {
    success: true,
    message:
      'Đã xóa tồn tại / sự cố.'
  };
}

/**
 * ============================================================
 * TỰ ĐỘNG QUÁ HẠN
 * ============================================================
 */
function refreshPlanOverdueStatuses() {
  setupKeHoachSystem();

  var count =
    khRefreshOverdueStatuses_();

  return {
    success: true,
    updated: count,
    message:
      'Đã cập nhật ' +
      count +
      ' bản ghi quá hạn.'
  };
}

function khRefreshOverdueStatuses_() {
  var count = 0;

  ['WEEK', 'MONTH']
    .forEach(function(type) {
      var sh =
        khGetSheet_(
          khPlanSheetName_(type)
        );

      if (
        !sh ||
        sh.getLastRow() < 2
      ) {
        return;
      }

      var data =
        sh.getRange(
          2,
          1,
          sh.getLastRow() - 1,
          Math.max(
            sh.getLastColumn(),
            15
          )
        ).getValues();

      for (
        var i = 0;
        i < data.length;
        i++
      ) {
        var r =
          data[i];

        if (!r[0]) {
          continue;
        }

        var current =
          String(
            r[6] || ''
          );

        var effective =
          khEffectivePlanStatus_(
            current,
            r[2]
          );

        if (
          effective === 'QUÁ HẠN' &&
          !khSameText_(
            current,
            'QUÁ HẠN'
          )
        ) {
          sh.getRange(
            i + 2,
            7
          ).setValue(
            'QUÁ HẠN'
          );

          sh.getRange(
            i + 2,
            14
          ).setValue(
            new Date()
          );

          count++;
        }
      }
    });

  /*
   * Tồn tại/sự cố cũng tự quá hạn.
   */
  var issueSh =
    khGetSheet_(
      khIssueSheetName_()
    );

  if (
    issueSh &&
    issueSh.getLastRow() >= 2
  ) {
    var issueData =
      issueSh.getRange(
        2,
        1,
        issueSh.getLastRow() - 1,
        Math.max(
          issueSh.getLastColumn(),
          13
        )
      ).getValues();

    for (
      var j = 0;
      j < issueData.length;
      j++
    ) {
      var ir =
        issueData[j];

      if (!ir[0]) {
        continue;
      }

      var cur =
        String(
          ir[8] || ''
        );

      var eff =
        khEffectiveIssueStatus_(
          cur,
          ir[7]
        );

      if (
        eff === 'QUÁ HẠN' &&
        !khSameText_(
          cur,
          'QUÁ HẠN'
        )
      ) {
        issueSh.getRange(
          j + 2,
          9
        ).setValue(
          'QUÁ HẠN'
        );

        issueSh.getRange(
          j + 2,
          12
        ).setValue(
          new Date()
        );

        count++;
      }
    }
  }

  return count;
}

/**
 * ============================================================
 * DEBUG
 * ============================================================
 */
function debugKeHoachSystem() {
  var setup =
    setupKeHoachSystem();

  var weekly =
    getPlanRows_(
      'WEEK'
    );

  var monthly =
    getPlanRows_(
      'MONTH'
    );

  var issues =
    getIssueRows_();

  return {
    setup: setup,
    weekly: weekly.length,
    monthly: monthly.length,
    issues: issues.length,
    sampleWeekly:
      weekly.slice(0, 3),
    sampleMonthly:
      monthly.slice(0, 3),
    sampleIssues:
      issues.slice(0, 3)
  };
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */
function khSpreadsheet_() {
  if (
    typeof getAppSpreadsheet_ ===
    'function'
  ) {
    return getAppSpreadsheet_();
  }

  if (
    typeof APP_CONFIG !==
    'undefined' &&
    APP_CONFIG.SPREADSHEET_ID
  ) {
    return SpreadsheetApp.openById(
      APP_CONFIG.SPREADSHEET_ID
    );
  }

  return SpreadsheetApp
    .getActiveSpreadsheet();
}

function khPlanSheetName_(type) {
  var key =
    String(type || 'WEEK')
      .toUpperCase() === 'MONTH'
      ? 'MONTHLY_PLAN'
      : 'WEEKLY_PLAN';

  var fallback =
    key === 'MONTHLY_PLAN'
      ? 'KE_HOACH_THANG'
      : 'KE_HOACH_TUAN';

  if (
    typeof EXT_CONFIG !==
    'undefined' &&
    EXT_CONFIG.SHEETS &&
    EXT_CONFIG.SHEETS[key]
  ) {
    return EXT_CONFIG.SHEETS[key];
  }

  if (
    typeof APP_CONFIG !==
    'undefined' &&
    APP_CONFIG.SHEETS &&
    APP_CONFIG.SHEETS[key]
  ) {
    return APP_CONFIG.SHEETS[key];
  }

  return fallback;
}

function khIssueSheetName_() {
  if (
    typeof EXT_CONFIG !==
    'undefined' &&
    EXT_CONFIG.SHEETS &&
    EXT_CONFIG.SHEETS.ISSUES
  ) {
    return EXT_CONFIG.SHEETS.ISSUES;
  }

  if (
    typeof APP_CONFIG !==
    'undefined' &&
    APP_CONFIG.SHEETS &&
    APP_CONFIG.SHEETS.ISSUES
  ) {
    return APP_CONFIG.SHEETS.ISSUES;
  }

  return 'TON_TAI_KIEN_NGHI';
}

function khGetSheet_(name) {
  var ss =
    khSpreadsheet_();

  return ss.getSheetByName(
    name
  );
}

function khEnsureSheetHeaders_(
  ss,
  name,
  headers
) {
  var sh =
    ss.getSheetByName(
      name
    );

  if (!sh) {
    sh =
      ss.insertSheet(
        name
      );
  }

  if (
    sh.getMaxColumns() <
    headers.length
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      headers.length -
      sh.getMaxColumns()
    );
  }

  /*
   * Không xóa dữ liệu cũ.
   * Chỉ bổ sung/sửa tiêu đề theo cấu trúc mới.
   */
  sh.getRange(
    1,
    1,
    1,
    headers.length
  ).setValues([
    headers
  ]);

  sh.getRange(
    1,
    1,
    1,
    headers.length
  )
    .setFontWeight('bold')
    .setBackground('#123b8f')
    .setFontColor('#ffffff')
    .setWrap(true);

  sh.setFrozenRows(1);

  return sh;
}

function khActiveStaff_() {
  if (
    typeof getActiveStaffObjects_ ===
    'function'
  ) {
    return getActiveStaffObjects_();
  }

  var name =
    (
      typeof APP_CONFIG !==
      'undefined' &&
      APP_CONFIG.SHEETS &&
      APP_CONFIG.SHEETS.STAFF
    )
      ? APP_CONFIG.SHEETS.STAFF
      : 'DM_NHANVIEN';

  var sh =
    khGetSheet_(
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
      .getDisplayValues();

  var out = [];

  for (
    var i = 1;
    i < data.length;
    i++
  ) {
    var r =
      data[i];

    if (!r[1]) {
      continue;
    }

    var state =
      khNorm_(
        r[5]
      );

    if (
      state === 'nghi' ||
      state === 'ngung' ||
      state === 'khong hoat dong'
    ) {
      continue;
    }

    out.push({
      id: String(r[0] || ''),
      name: String(r[1] || ''),
      department: String(r[2] || ''),
      position: String(r[3] || ''),
      phone: String(r[4] || ''),
      status: String(r[5] || '')
    });
  }

  return out;
}

function khDepartments_() {
  if (
    typeof APP_CONFIG !==
      'undefined' &&
    Array.isArray(
      APP_CONFIG.DEPARTMENTS
    )
  ) {
    return APP_CONFIG.DEPARTMENTS
      .slice();
  }

  var map = {};

  khActiveStaff_()
    .forEach(function(x) {
      var d =
        String(
          x.department || ''
        ).trim();

      if (d) {
        map[d] = true;
      }
    });

  return Object.keys(map);
}

function khFindStaffByName_(name) {
  var q =
    khNorm_(
      name
    );

  if (!q) {
    return null;
  }

  var list =
    khActiveStaff_();

  for (
    var i = 0;
    i < list.length;
    i++
  ) {
    if (
      khNorm_(
        list[i].name
      ) === q
    ) {
      return list[i];
    }
  }

  return null;
}

function khCreateId_(prefix) {
  if (
    typeof createRecordId_ ===
    'function'
  ) {
    return createRecordId_(
      prefix
    );
  }

  return (
    String(prefix || 'ID') +
    '-' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMddHHmmss'
    ) +
    '-' +
    Math.floor(
      Math.random() * 9000 +
      1000
    )
  );
}

function khCurrentUser_() {
  if (
    typeof APP_CONFIG !==
      'undefined' &&
    APP_CONFIG.AUTHOR
  ) {
    return String(
      APP_CONFIG.AUTHOR
    );
  }

  try {
    return (
      Session.getActiveUser()
        .getEmail() ||
      ''
    );
  } catch (e) {
    return '';
  }
}

function khFindRowById_(
  sh,
  id
) {
  if (
    !sh ||
    !id ||
    sh.getLastRow() < 2
  ) {
    return 0;
  }

  var found =
    sh.getRange(
      2,
      1,
      sh.getLastRow() - 1,
      1
    )
    .createTextFinder(
      String(id)
    )
    .matchEntireCell(true)
    .findNext();

  return found
    ? found.getRow()
    : 0;
}

function khFormatPlanRow_(
  sh,
  row
) {
  sh.getRange(
    row,
    2,
    1,
    2
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    row,
    10
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );

  sh.getRange(
    row,
    11
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );

  sh.getRange(
    row,
    14
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm:ss'
  );
}

function khFormatIssueRow_(
  sh,
  row
) {
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
}

function khEffectivePlanStatus_(
  savedStatus,
  endDate
) {
  var status =
    khNormalizePlanStatus_(
      savedStatus ||
      'CHƯA BẮT ĐẦU'
    );

  if (
    status === 'HOÀN THÀNH' ||
    status === 'CHUYỂN TIẾP'
  ) {
    return status;
  }

  var end =
    khParseDate_(
      endDate
    );

  if (!end) {
    return status;
  }

  end.setHours(
    23,
    59,
    59,
    999
  );

  if (
    new Date() > end
  ) {
    return 'QUÁ HẠN';
  }

  return status;
}

function khEffectiveIssueStatus_(
  savedStatus,
  deadline
) {
  var status =
    khNormalizeIssueStatus_(
      savedStatus ||
      'CHƯA KHẮC PHỤC'
    );

  if (
    khIssueClosed_(
      status
    )
  ) {
    return status;
  }

  var d =
    khParseDate_(
      deadline
    );

  if (!d) {
    return status;
  }

  d.setHours(
    23,
    59,
    59,
    999
  );

  return new Date() > d
    ? 'QUÁ HẠN'
    : status;
}

function khNormalizePlanStatus_(
  value
) {
  var s =
    khNorm_(
      value
    );

  if (
    s === 'chua thuc hien' ||
    s === 'chua bat dau'
  ) {
    return 'CHƯA BẮT ĐẦU';
  }

  if (
    s === 'dang lam' ||
    s === 'dang thuc hien'
  ) {
    return 'ĐANG THỰC HIỆN';
  }

  if (
    s === 'hoan thanh' ||
    s === 'da hoan thanh' ||
    s === 'dat'
  ) {
    return 'HOÀN THÀNH';
  }

  if (
    s === 'qua han'
  ) {
    return 'QUÁ HẠN';
  }

  if (
    s === 'chuyen tiep'
  ) {
    return 'CHUYỂN TIẾP';
  }

  return String(
    value ||
    'CHƯA BẮT ĐẦU'
  ).trim().toUpperCase();
}

function khNormalizeIssueStatus_(
  value
) {
  var s =
    khNorm_(
      value
    );

  if (
    s === 'da khac phuc' ||
    s === 'da xu ly' ||
    s === 'hoan thanh' ||
    s === 'dong'
  ) {
    return 'ĐÃ KHẮC PHỤC';
  }

  if (
    s === 'dang xu ly' ||
    s === 'dang lam'
  ) {
    return 'ĐANG XỬ LÝ';
  }

  if (
    s === 'qua han'
  ) {
    return 'QUÁ HẠN';
  }

  return 'CHƯA KHẮC PHỤC';
}

function khIssueClosed_(
  status
) {
  var s =
    khNorm_(
      status
    );

  return (
    s === 'da khac phuc' ||
    s === 'da xu ly' ||
    s === 'hoan thanh' ||
    s === 'dong' ||
    s === 'closed'
  );
}

function khNextWeekRange_(
  oldEnd
) {
  var base =
    khParseDate_(
      oldEnd
    ) || new Date();

  base.setHours(
    0,
    0,
    0,
    0
  );

  var day =
    base.getDay();

  var add =
    day === 0
      ? 1
      : 8 - day;

  var from =
    new Date(
      base.getTime()
    );

  from.setDate(
    from.getDate() + add
  );

  from.setHours(
    0,
    0,
    0,
    0
  );

  var to =
    new Date(
      from.getTime()
    );

  to.setDate(
    to.getDate() + 6
  );

  to.setHours(
    23,
    59,
    59,
    999
  );

  return {
    from: from,
    to: to
  };
}

function khNextMonthRange_(
  oldFrom
) {
  var base =
    khParseDate_(
      oldFrom
    ) || new Date();

  var from =
    new Date(
      base.getFullYear(),
      base.getMonth() + 1,
      1
    );

  var to =
    new Date(
      base.getFullYear(),
      base.getMonth() + 2,
      0
    );

  from.setHours(
    0,
    0,
    0,
    0
  );

  to.setHours(
    23,
    59,
    59,
    999
  );

  return {
    from: from,
    to: to
  };
}

function khOverlapRange_(
  startValue,
  endValue,
  from,
  to
) {
  var start =
    khParseDate_(
      startValue
    );

  var end =
    khParseDate_(
      endValue
    );

  if (!start && !end) {
    return false;
  }

  start =
    start ||
    end;

  end =
    end ||
    start;

  start.setHours(
    0,
    0,
    0,
    0
  );

  end.setHours(
    23,
    59,
    59,
    999
  );

  var f =
    khParseDate_(
      from
    );

  var t =
    khParseDate_(
      to
    );

  if (f) {
    f.setHours(
      0,
      0,
      0,
      0
    );
  }

  if (t) {
    t.setHours(
      23,
      59,
      59,
      999
    );
  }

  if (
    f &&
    end < f
  ) {
    return false;
  }

  if (
    t &&
    start > t
  ) {
    return false;
  }

  return true;
}

function khInRange_(
  value,
  from,
  to
) {
  var d =
    khParseDate_(
      value
    );

  if (!d) {
    return false;
  }

  d.setHours(
    12,
    0,
    0,
    0
  );

  var f =
    khParseDate_(
      from
    );

  var t =
    khParseDate_(
      to
    );

  if (f) {
    f.setHours(
      0,
      0,
      0,
      0
    );
  }

  if (t) {
    t.setHours(
      23,
      59,
      59,
      999
    );
  }

  if (
    f &&
    d < f
  ) {
    return false;
  }

  if (
    t &&
    d > t
  ) {
    return false;
  }

  return true;
}

function khParseDate_(
  value
) {
  if (!value) {
    return null;
  }

  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]'
  ) {
    return isNaN(
      value.getTime()
    )
      ? null
      : new Date(
          value.getTime()
        );
  }

  var text =
    String(value)
      .trim()
      .split(' ')[0];

  var m;

  if (
    (
      m =
        text.match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        )
    )
  ) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3])
    );
  }

  if (
    (
      m =
        text.match(
          /^(\d{2})\/(\d{2})\/(\d{4})$/
        )
    )
  ) {
    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1])
    );
  }

  var d =
    new Date(value);

  return isNaN(
    d.getTime()
  )
    ? null
    : d;
}

function khFormatDate_(
  value
) {
  var d =
    khParseDate_(
      value
    );

  return d
    ? Utilities.formatDate(
        d,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy'
      )
    : '';
}

function khYmd_(
  value
) {
  var d =
    khParseDate_(
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

function khFormatDateTime_(
  value
) {
  var d =
    khParseDate_(
      value
    );

  return d
    ? Utilities.formatDate(
        d,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      )
    : '';
}

function khRequireText_(
  value,
  label
) {
  var s =
    String(
      value || ''
    ).trim();

  if (!s) {
    throw new Error(
      'Chưa nhập ' +
      label +
      '.'
    );
  }

  return s;
}

function khNorm_(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /đ/g,
      'd'
    )
    .replace(
      /\s+/g,
      ' '
    );
}

function khSameText_(
  a,
  b
) {
  return (
    khNorm_(a) ===
    khNorm_(b)
  );
}
