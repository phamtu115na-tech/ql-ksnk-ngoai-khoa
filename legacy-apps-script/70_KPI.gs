/**
 * ============================================================
 * 70_KPI.gs - V18
 * KPI 100 ĐIỂM + MỘT BẢNG QUY ĐỔI DÙNG CHUNG
 * ============================================================
 *
 * NGUYÊN TẮC:
 * 1) Chỉ 70_KPI.gs tính Tổng + Xếp loại.
 * 2) KPI.html chỉ hiển thị và sửa cấu hình quy đổi.
 * 3) 60_BaoCao.gs gọi getKpiReport() của file này.
 * 4) BaoCao.html KHÔNG tự tính lại xếp loại.
 *
 * Sheet dùng chung:
 * DM_QUYDOI_KPI
 *
 * Cấu trúc:
 * A STT
 * B Xếp loại
 * C Từ điểm
 * D Đến điểm
 * E Màu
 * F Trạng thái
 * G Cập nhật lúc
 *
 * Mặc định:
 * XUẤT SẮC 110 -> 999999
 * TỐT       95 -> 109.99
 * KHÁ       80 -> 94.99
 * TRUNG BÌNH65 -> 79.99
 * CHƯA ĐẠT -999999 -> 64.99
 * ============================================================
 */

const KPI_CONVERSION_SHEET = 'DM_QUYDOI_KPI';

/**
 * Chạy 1 lần sau khi copy V18.
 * Không xóa dữ liệu nếu sheet đã có.
 */
function setupKpiConversionSystem() {
  const ss = getAppSpreadsheet_();

  let sh =
    ss.getSheetByName(
      KPI_CONVERSION_SHEET
    );

  const headers = [
    'STT',
    'Xếp loại',
    'Từ điểm',
    'Đến điểm',
    'Màu',
    'Trạng thái',
    'Cập nhật lúc'
  ];

  if (!sh) {
    sh =
      ss.insertSheet(
        KPI_CONVERSION_SHEET
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

  sh.getRange(
    1,
    1,
    1,
    headers.length
  )
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#123b8f')
    .setFontColor('#ffffff')
    .setWrap(true);

  sh.setFrozenRows(1);

  /*
   * Chỉ seed khi chưa có dữ liệu thực.
   */
  if (sh.getLastRow() < 2) {
    const now = new Date();

    sh.getRange(
      2,
      1,
      5,
      7
    ).setValues([
      [1,'XUẤT SẮC',110,999999,'#2563EB','Hoạt động',now],
      [2,'TỐT',95,109.99,'#16A34A','Hoạt động',now],
      [3,'KHÁ',80,94.99,'#0891B2','Hoạt động',now],
      [4,'TRUNG BÌNH',65,79.99,'#F59E0B','Hoạt động',now],
      [5,'CHƯA ĐẠT',-999999,64.99,'#DC2626','Hoạt động',now]
    ]);
  }

  sh.autoResizeColumns(
    1,
    headers.length
  );

  return {
    success: true,
    sheet: KPI_CONVERSION_SHEET,
    rows: getKpiConversionRules()
  };
}

/**
 * Trả cấu hình quy đổi cho KPI.html và Báo cáo.
 */
function getKpiConversionRules() {
  const ss = getAppSpreadsheet_();

  let sh =
    ss.getSheetByName(
      KPI_CONVERSION_SHEET
    );

  if (!sh) {
    setupKpiConversionSystem();

    sh =
      ss.getSheetByName(
        KPI_CONVERSION_SHEET
      );
  }

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  const values =
    sh.getRange(
      2,
      1,
      sh.getLastRow() - 1,
      7
    ).getValues();

  return values
    .filter(function(r) {
      return (
        String(
          r[1] || ''
        ).trim() &&
        kpiNorm_(
          r[5]
        ) !== 'tam ngung' &&
        kpiNorm_(
          r[5]
        ) !== 'ngung'
      );
    })
    .map(function(r) {
      return {
        order:
          Number(
            r[0]
          ) || 0,

        ranking:
          String(
            r[1] || ''
          ).trim(),

        min:
          Number(
            r[2]
          ),

        max:
          Number(
            r[3]
          ),

        color:
          String(
            r[4] ||
            '#6C757D'
          ).trim()
      };
    })
    .filter(function(x) {
      return (
        isFinite(x.min) &&
        isFinite(x.max)
      );
    })
    .sort(function(a,b) {
      return (
        a.order - b.order
      );
    });
}

/**
 * KPI.html gọi hàm này để lưu toàn bộ bảng quy đổi.
 */
function saveKpiConversionRules(rows) {
  setupKpiConversionSystem();

  rows =
    Array.isArray(rows)
      ? rows
      : [];

  if (!rows.length) {
    throw new Error(
      'Phải có ít nhất 1 mức xếp loại.'
    );
  }

  const clean =
    rows.map(
      function(x,index) {
        x = x || {};

        const ranking =
          String(
            x.ranking || ''
          ).trim()
          .toUpperCase();

        const min =
          Number(
            x.min
          );

        const max =
          Number(
            x.max
          );

        const color =
          String(
            x.color ||
            '#6C757D'
          ).trim();

        if (!ranking) {
          throw new Error(
            'Mức xếp loại số ' +
            (index + 1) +
            ' chưa có tên.'
          );
        }

        if (
          !isFinite(min) ||
          !isFinite(max)
        ) {
          throw new Error(
            'Từ điểm / Đến điểm phải là số tại mức ' +
            ranking +
            '.'
          );
        }

        if (min > max) {
          throw new Error(
            'Từ điểm không được lớn hơn Đến điểm tại mức ' +
            ranking +
            '.'
          );
        }

        return {
          ranking: ranking,
          min: min,
          max: max,
          color:
            /^#[0-9A-Fa-f]{6}$/.test(
              color
            )
              ? color
              : '#6C757D'
        };
      }
    );

  /*
   * Kiểm tra khoảng điểm không chồng lấn.
   */
  const byMin =
    clean.slice()
      .sort(function(a,b) {
        return a.min - b.min;
      });

  for (
    let i = 1;
    i < byMin.length;
    i++
  ) {
    if (
      byMin[i].min <=
      byMin[i - 1].max
    ) {
      throw new Error(
        'Khoảng điểm đang chồng lấn giữa "' +
        byMin[i - 1].ranking +
        '" và "' +
        byMin[i].ranking +
        '".'
      );
    }
  }

  const ss =
    getAppSpreadsheet_();

  const sh =
    ss.getSheetByName(
      KPI_CONVERSION_SHEET
    );

  if (sh.getLastRow() > 1) {
    sh.getRange(
      2,
      1,
      sh.getLastRow() - 1,
      7
    ).clearContent();
  }

  const now =
    new Date();

  const values =
    clean.map(
      function(x,index) {
        return [
          index + 1,
          x.ranking,
          x.min,
          x.max,
          x.color,
          'Hoạt động',
          now
        ];
      }
    );

  sh.getRange(
    2,
    1,
    values.length,
    7
  ).setValues(
    values
  );

  return {
    success: true,
    message:
      'Đã lưu ' +
      values.length +
      ' mức quy đổi KPI. KPI và Báo cáo sẽ dùng chung cấu hình này.',
    rows:
      getKpiConversionRules()
  };
}

/**
 * DUY NHẤT hàm này quy đổi Tổng -> Xếp loại.
 */
function getKpiRankingInfo_(total) {
  const score =
    Number(
      total || 0
    );

  const rules =
    getKpiConversionRules();

  for (
    let i = 0;
    i < rules.length;
    i++
  ) {
    const x =
      rules[i];

    if (
      score >= x.min &&
      score <= x.max
    ) {
      return {
        ranking:
          x.ranking,
        color:
          x.color,
        min:
          x.min,
        max:
          x.max
      };
    }
  }

  return {
    ranking:
      'CHƯA XẾP LOẠI',
    color:
      '#6C757D',
    min:
      null,
    max:
      null
  };
}

/**
 * Giữ tên helper cũ để các module cũ gọi vẫn chạy,
 * nhưng dữ liệu đã lấy từ DM_QUYDOI_KPI.
 */
function getRanking_(total) {
  return getKpiRankingInfo_(
    total
  ).ranking;
}


/**
 * ============================================================
 * V19.1 - KPI TỰ ĐỌC DỮ LIỆU, KHÔNG PHỤ THUỘC HELPER MODULE KHÁC
 * ============================================================
 *
 * Sửa lỗi:
 * ReferenceError: getTasksForRange_ is not defined
 *
 * 70_KPI.gs dùng các helper riêng có tiền tố kpi...
 * nên không còn phụ thuộc:
 * - getTasksForRange_
 * - getChecklistFormsForRange_
 * - getViolationsForRange_
 * - getActiveStaffObjects_
 *
 * Cấu trúc nguồn giữ theo hệ thống cũ:
 *
 * GIAO VIỆC:
 * A Mã
 * B Người thực hiện
 * C Ưu tiên
 * D Tiêu đề
 * E Mô tả
 * F ...
 * G Ngày bắt đầu
 * H Hạn
 * I Trạng thái NV
 * J Ghi chú
 * K Ảnh
 * L Trạng thái đánh giá
 * M Ghi chú QL
 *
 * PHIEU_GIAMSAT:
 * A Mã phiếu
 * B Ngày
 * C Mã NV
 * D Họ tên
 * E Bộ phận
 * ...
 * L Tỷ lệ
 * M KPI
 *
 * THEODOI_VIPHAM:
 * A Mã
 * B Ngày
 * C Mã NV
 * D Tên NV
 * E Bộ phận
 * F Mã lỗi
 * G Tên lỗi
 * H Mức độ
 * I Điểm trừ
 * ...
 * ============================================================
 */

function kpiGetActiveStaffObjects_() {
  const sh =
    kpiGetSheetByConfigOrNames_(
      'STAFF',
      [
        'DM_NHANVIEN',
        'DM NHANVIEN',
        'NHÂN VIÊN',
        'NHAN VIEN'
      ],
      false
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  const data =
    sh.getDataRange()
      .getDisplayValues();

  return data
    .slice(1)
    .filter(
      function(r) {
        const name =
          String(
            r[1] || ''
          ).trim();

        const status =
          kpiNormText_(
            r[5]
          );

        return (
          name &&
          status.indexOf(
            'nghi'
          ) === -1 &&
          status.indexOf(
            'ngung'
          ) === -1
        );
      }
    )
    .map(
      function(r) {
        return {
          id:
            String(
              r[0] || ''
            ).trim(),

          name:
            String(
              r[1] || ''
            ).trim(),

          department:
            String(
              r[2] || ''
            ).trim(),

          position:
            String(
              r[3] || ''
            ).trim(),

          phone:
            String(
              r[4] || ''
            ).trim(),

          status:
            String(
              r[5] || ''
            ).trim()
        };
      }
    );
}

function kpiGetTasksForRange_(
  from,
  to,
  department,
  person
) {
  const sh =
    kpiGetSheetByConfigOrNames_(
      'TASKS',
      [
        'GIAO VIỆC',
        'GIAO VIEC',
        'CÔNG VIỆC ĐƯỢC GIAO',
        'CONG VIEC DUOC GIAO',
        'CÔNG VIỆC',
        'CONG VIEC'
      ],
      false
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  const staffMap = {};

  kpiGetActiveStaffObjects_()
    .forEach(
      function(x) {
        staffMap[
          kpiNormText_(
            x.name
          )
        ] = x;
      }
    );

  const data =
    sh.getDataRange()
      .getValues();

  const out = [];

  for (
    let i = 1;
    i < data.length;
    i++
  ) {
    const r =
      data[i];

    const name =
      String(
        r[1] || ''
      ).trim();

    if (!name) {
      continue;
    }

    const st =
      staffMap[
        kpiNormText_(
          name
        )
      ] ||
      {};

    if (
      department &&
      !kpiSameText_(
        st.department,
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !kpiSameText_(
        name,
        person
      )
    ) {
      continue;
    }

    if (
      !kpiOverlapDateRange_(
        r[6],
        r[7],
        from,
        to
      )
    ) {
      continue;
    }

    out.push({
      id:
        r[0],

      assignee:
        name,

      department:
        st.department || '',

      position:
        st.position || '',

      priority:
        r[2],

      title:
        String(
          r[3] || ''
        ),

      startDate:
        kpiFormatDate_(
          r[6]
        ),

      endDate:
        kpiFormatDate_(
          r[7]
        ),

      status:
        String(
          r[8] || ''
        ),

      evalStatus:
        String(
          r[11] || ''
        ),

      qlNote:
        String(
          r[12] || ''
        )
    });
  }

  return out;
}

function kpiGetChecklistFormsForRange_(
  from,
  to,
  department,
  person
) {
  const sh =
    kpiGetSheetByConfigOrNames_(
      'CHECKLIST_FORMS',
      [
        'PHIEU_GIAMSAT',
        'PHIẾU GIÁM SÁT',
        'PHIEU GIAM SAT'
      ],
      false
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  const data =
    sh.getDataRange()
      .getValues();

  const out = [];

  for (
    let i = 1;
    i < data.length;
    i++
  ) {
    const r =
      data[i];

    if (!r[0]) {
      continue;
    }

    if (
      !kpiInDateRange_(
        r[1],
        from,
        to
      )
    ) {
      continue;
    }

    if (
      department &&
      !kpiSameText_(
        r[4],
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !kpiSameText_(
        r[3],
        person
      )
    ) {
      continue;
    }

    /*
     * KPI chuẩn vẫn lấy cột M (index 12)
     * do hệ thống Bảng kiểm đã tính và lưu.
     */
    out.push({
      id:
        r[0],

      date:
        kpiFormatDate_(
          r[1]
        ),

      staffId:
        r[2],

      name:
        String(
          r[3] || ''
        ).trim(),

      department:
        String(
          r[4] || ''
        ).trim(),

      supervisor:
        r[5],

      area:
        r[6],

      shift:
        r[7],

      applied:
        Number(
          r[8]
        ) || 0,

      pass:
        Number(
          r[9]
        ) || 0,

      fail:
        Number(
          r[10]
        ) || 0,

      rate:
        Number(
          r[11]
        ) || 0,

      kpi:
        Number(
          r[12]
        ) || 0,

      note:
        r[13],

      imageRef:
        r[14],

      formCode:
        r[16] || '',

      formName:
        r[17] || '',

      na:
        Number(
          r[18]
        ) || 0
    });
  }

  return out;
}

function kpiGetViolationsForRange_(
  from,
  to,
  department,
  person
) {
  const sh =
    kpiGetSheetByConfigOrNames_(
      'VIOLATIONS',
      [
        'THEODOI_VIPHAM',
        'THEO DÕI VI PHẠM',
        'THEO DOI VI PHAM',
        'VI PHẠM',
        'VI PHAM'
      ],
      false
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  const data =
    sh.getDataRange()
      .getValues();

  const out = [];

  for (
    let i = 1;
    i < data.length;
    i++
  ) {
    const r =
      data[i];

    if (!r[0]) {
      continue;
    }

    if (
      !kpiInDateRange_(
        r[1],
        from,
        to
      )
    ) {
      continue;
    }

    if (
      department &&
      !kpiSameText_(
        r[4],
        department
      )
    ) {
      continue;
    }

    if (
      person &&
      !kpiSameText_(
        r[3],
        person
      )
    ) {
      continue;
    }

    out.push({
      id:
        r[0],

      date:
        kpiFormatDate_(
          r[1]
        ),

      staffId:
        r[2],

      name:
        String(
          r[3] || ''
        ).trim(),

      department:
        String(
          r[4] || ''
        ).trim(),

      errorId:
        r[5],

      errorName:
        String(
          r[6] || ''
        ),

      level:
        r[7],

      points:
        Math.abs(
          Number(
            r[8]
          ) ||
          0
        ),

      recorder:
        r[9],

      note:
        r[10],

      status:
        r[11]
    });
  }

  return out;
}

function kpiGetSheetByConfigOrNames_(
  configKey,
  candidates,
  createIfMissing
) {
  const ss =
    typeof getAppSpreadsheet_ ===
    'function'
      ? getAppSpreadsheet_()
      : SpreadsheetApp.getActiveSpreadsheet();

  const names = [];

  /*
   * APP_CONFIG.SHEETS
   */
  try {
    if (
      APP_CONFIG &&
      APP_CONFIG.SHEETS &&
      APP_CONFIG.SHEETS[
        configKey
      ]
    ) {
      names.push(
        String(
          APP_CONFIG.SHEETS[
            configKey
          ]
        )
      );
    }
  } catch (e) {}

  /*
   * EXT_CONFIG.SHEETS
   */
  try {
    if (
      EXT_CONFIG &&
      EXT_CONFIG.SHEETS &&
      EXT_CONFIG.SHEETS[
        configKey
      ]
    ) {
      names.push(
        String(
          EXT_CONFIG.SHEETS[
            configKey
          ]
        )
      );
    }
  } catch (e) {}

  (candidates || [])
    .forEach(
      function(name) {
        if (
          name &&
          names.indexOf(
            name
          ) === -1
        ) {
          names.push(
            name
          );
        }
      }
    );

  /*
   * 1. Thử đúng tên.
   */
  for (
    let i = 0;
    i < names.length;
    i++
  ) {
    const sh =
      ss.getSheetByName(
        names[i]
      );

    if (sh) {
      return sh;
    }
  }

  /*
   * 2. Thử tên không dấu / không phân biệt hoa thường.
   */
  const all =
    ss.getSheets();

  for (
    let i = 0;
    i < all.length;
    i++
  ) {
    const actual =
      kpiNormText_(
        all[i].getName()
      );

    for (
      let j = 0;
      j < names.length;
      j++
    ) {
      if (
        actual ===
        kpiNormText_(
          names[j]
        )
      ) {
        return all[i];
      }
    }
  }

  if (
    createIfMissing &&
    names.length
  ) {
    return ss.insertSheet(
      names[0]
    );
  }

  return null;
}

function kpiInDateRange_(
  value,
  from,
  to
) {
  const d =
    kpiParseAnyDate_(
      value
    );

  if (!d) {
    return false;
  }

  const f =
    kpiParseAnyDate_(
      from
    );

  const t =
    kpiParseAnyDate_(
      to
    );

  d.setHours(
    12,
    0,
    0,
    0
  );

  if (f) {
    f.setHours(
      0,
      0,
      0,
      0
    );

    if (
      d.getTime() <
      f.getTime()
    ) {
      return false;
    }
  }

  if (t) {
    t.setHours(
      23,
      59,
      59,
      999
    );

    if (
      d.getTime() >
      t.getTime()
    ) {
      return false;
    }
  }

  return true;
}

function kpiOverlapDateRange_(
  startValue,
  endValue,
  from,
  to
) {
  const start =
    kpiParseAnyDate_(
      startValue
    );

  const end =
    kpiParseAnyDate_(
      endValue
    ) ||
    start;

  /*
   * Công việc không có ngày:
   * không lấy vào kỳ KPI có bộ lọc ngày.
   */
  if (
    !start &&
    !end
  ) {
    return (
      !from &&
      !to
    );
  }

  const s =
    start ||
    end;

  const e =
    end ||
    start;

  const f =
    kpiParseAnyDate_(
      from
    );

  const t =
    kpiParseAnyDate_(
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

  s.setHours(
    0,
    0,
    0,
    0
  );

  e.setHours(
    23,
    59,
    59,
    999
  );

  if (
    f &&
    e.getTime() <
    f.getTime()
  ) {
    return false;
  }

  if (
    t &&
    s.getTime() >
    t.getTime()
  ) {
    return false;
  }

  return true;
}

function kpiParseAnyDate_(
  value
) {
  if (
    value instanceof Date &&
    !isNaN(
      value.getTime()
    )
  ) {
    return new Date(
      value.getTime()
    );
  }

  const s =
    String(
      value || ''
    ).trim();

  if (!s) {
    return null;
  }

  let m =
    s.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (m) {
    return new Date(
      Number(
        m[1]
      ),
      Number(
        m[2]
      ) - 1,
      Number(
        m[3]
      )
    );
  }

  m =
    s.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );

  if (m) {
    return new Date(
      Number(
        m[3]
      ),
      Number(
        m[2]
      ) - 1,
      Number(
        m[1]
      )
    );
  }

  const d =
    new Date(
      s
    );

  return isNaN(
    d.getTime()
  )
    ? null
    : d;
}

function kpiFormatDate_(
  value
) {
  const d =
    kpiParseAnyDate_(
      value
    );

  if (!d) {
    return '';
  }

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}

function kpiNormText_(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
    .normalize(
      'NFD'
    )
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

function kpiSameText_(
  a,
  b
) {
  return (
    kpiNormText_(
      a
    ) ===
    kpiNormText_(
      b
    )
  );
}



/**
 * ============================================================
 * KPI 100 ĐIỂM - NGUỒN DUY NHẤT CHO KPI + BÁO CÁO
 * ============================================================
 */
function getKpiReport(filters) {
  setupKpiConversionSystem();

  filters =
    filters || {};

  const from =
    filters.from || '';

  const to =
    filters.to || '';

  const department =
    filters.department || '';

  const person =
    filters.person || '';

  let staff =
    kpiGetActiveStaffObjects_();

  if (department) {
    staff =
      staff.filter(
        function(x) {
          return (
            x.department ===
            department
          );
        }
      );
  }

  if (person) {
    staff =
      staff.filter(
        function(x) {
          return (
            x.name ===
            person
          );
        }
      );
  }

  const tasks =
    kpiGetTasksForRange_(
      from,
      to,
      department,
      ''
    );

  const checks =
    kpiGetChecklistFormsForRange_(
      from,
      to,
      department,
      ''
    );

  const violations =
    kpiGetViolationsForRange_(
      from,
      to,
      department,
      ''
    );

  const taskScoreMap =
    (
      typeof EXT_CONFIG !==
      'undefined' &&
      EXT_CONFIG.TASK_SCORE
    )
      ? EXT_CONFIG.TASK_SCORE
      : (
          typeof APP_CONFIG !==
          'undefined' &&
          APP_CONFIG.TASK_SCORE
        )
          ? APP_CONFIG.TASK_SCORE
          : {};

  return staff.map(
    function(s) {
      const st =
        tasks.filter(
          function(x) {
            return (
              x.assignee ===
              s.name
            );
          }
        );

      const sc =
        checks.filter(
          function(x) {
            return (
              x.name ===
              s.name
            );
          }
        );

      const sv =
        violations.filter(
          function(x) {
            return (
              x.name ===
              s.name
            );
          }
        );

      let taskScore = 0;

      const details = [];

      st.forEach(
        function(x) {
          const key =
            String(
              x.evalStatus || ''
            )
              .toUpperCase()
              .trim();

          const val =
            Object.prototype
              .hasOwnProperty
              .call(
                taskScoreMap,
                key
              )
              ? Number(
                  taskScoreMap[key]
                ) || 0
              : 0;

          taskScore +=
            val;

          if (val) {
            details.push(
              (
                val > 0
                  ? '+'
                  : ''
              ) +
              val +
              ' Giao việc: ' +
              x.title +
              ' (' +
              key +
              ')'
            );
          }
        }
      );

      const checklistScore =
        sc.reduce(
          function(sum,x) {
            return (
              sum +
              Number(
                x.kpi || 0
              )
            );
          },
          0
        );

      sc.forEach(
        function(x) {
          if (
            Number(
              x.kpi || 0
            )
          ) {
            details.push(
              x.kpi +
              ' Bảng kiểm ' +
              x.date +
              ': ' +
              x.rate +
              '%'
            );
          }
        }
      );

      const violationScore =
        -sv.reduce(
          function(sum,x) {
            return (
              sum +
              Math.abs(
                Number(
                  x.points
                ) || 0
              )
            );
          },
          0
        );

      sv.forEach(
        function(x) {
          if (
            Number(
              x.points || 0
            )
          ) {
            details.push(
              '-' +
              Math.abs(
                x.points
              ) +
              ' Vi phạm ' +
              x.date +
              ': ' +
              x.errorName
            );
          }
        }
      );

      /*
       * Công thức Tổng hiện tại được giữ nguyên.
       * Nếu sau này cần thay cách tính Tổng, chỉ sửa tại đây.
       * Báo cáo KHÔNG có công thức Tổng riêng.
       */
      const base =
        100;

      const total =
        base +
        taskScore +
        checklistScore +
        violationScore;

      const rankInfo =
        getKpiRankingInfo_(
          total
        );

      return {
        staffId:
          s.id,

        name:
          s.name,

        department:
          s.department,

        position:
          s.position,

        base:
          base,

        taskScore:
          taskScore,

        checklistScore:
          checklistScore,

        violationScore:
          violationScore,

        total:
          total,

        ranking:
          rankInfo.ranking,

        rankingColor:
          rankInfo.color,

        rankMin:
          rankInfo.min,

        rankMax:
          rankInfo.max,

        details:
          details,

        taskCount:
          st.length,

        checkCount:
          sc.length,

        violationCount:
          sv.length
      };
    }
  );
}

function saveKpiReport(filters) {
  const rows =
    getKpiReport(
      filters
    );

  const sheetName =
    (
      typeof EXT_CONFIG !==
      'undefined' &&
      EXT_CONFIG.SHEETS &&
      EXT_CONFIG.SHEETS.KPI
    )
      ? EXT_CONFIG.SHEETS.KPI
      : APP_CONFIG.SHEETS.KPI;

  const sh =
    getRequiredSheet_(
      sheetName
    );

  if (!rows.length) {
    return 'Không có dữ liệu để lưu.';
  }

  const now =
    new Date();

  const vals =
    rows.map(
      function(r) {
        return [
          now,
          filters.from || '',
          filters.to || '',
          r.staffId,
          r.name,
          r.department,
          r.position,
          r.base,
          r.taskScore,
          r.checklistScore,
          r.violationScore,
          r.total,
          r.ranking,
          r.details.join(
            ' | '
          )
        ];
      }
    );

  sh.getRange(
    sh.getLastRow() + 1,
    1,
    vals.length,
    14
  ).setValues(
    vals
  );

  return (
    'Đã lưu ' +
    vals.length +
    ' dòng KPI.'
  );
}

function kpiNorm_(value) {
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

/**
 * Debug nhanh sau khi cài V18.
 */
function debugKpiConversionSystem() {
  setupKpiConversionSystem();

  return {
    rules:
      getKpiConversionRules(),

    test95:
      getKpiRankingInfo_(95),

    test100:
      getKpiRankingInfo_(100),

    test110:
      getKpiRankingInfo_(110)
  };
}

/**
 * ============================================================
 * V19 - DASHBOARD KPI + KẾT LUẬN + GÓP Ý
 * ============================================================
 */
const KPI_FEEDBACK_SHEET = 'Y_KIEN_KPI';

function setupKpiDashboardSystem() {
  setupKpiConversionSystem();

  const ss = getAppSpreadsheet_();

  let sh = ss.getSheetByName(KPI_FEEDBACK_SHEET);

  const headers = [
    'Mã ý kiến',
    'Từ ngày',
    'Đến ngày',
    'Bộ phận',
    'Nhân viên',
    'Nội dung góp ý',
    'Người nhập',
    'Cập nhật lúc'
  ];

  if (!sh) {
    sh = ss.insertSheet(KPI_FEEDBACK_SHEET);
  }

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      headers.length - sh.getMaxColumns()
    );
  }

  sh.getRange(1,1,1,headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#123b8f')
    .setFontColor('#ffffff')
    .setWrap(true);

  sh.setFrozenRows(1);

  return {
    success:true,
    sheet:KPI_FEEDBACK_SHEET
  };
}

function getKpiDashboardData(filters) {
  setupKpiDashboardSystem();

  filters = filters || {};

  const rows = getKpiReport(filters);
  const rankingConfig = getKpiConversionRules();

  const summary = buildKpiSummary_(rows, rankingConfig);
  const conclusion = buildKpiConclusion_(rows, summary, rankingConfig);
  const feedback = getKpiFeedback_(filters);

  return {
    rows: rows,
    rankingConfig: rankingConfig,
    summary: summary,
    conclusion: conclusion,
    feedback: feedback
  };
}

function buildKpiSummary_(rows, rankingConfig) {
  rows = Array.isArray(rows) ? rows : [];
  rankingConfig = Array.isArray(rankingConfig) ? rankingConfig : [];

  const rankCounts = {};

  rankingConfig.forEach(function(r){
    rankCounts[r.ranking] = 0;
  });

  let totalScore = 0;
  let totalTask = 0;
  let totalChecklist = 0;
  let totalViolation = 0;
  let totalTasks = 0;
  let totalChecks = 0;
  let totalViolations = 0;

  rows.forEach(function(x){
    totalScore += Number(x.total || 0);
    totalTask += Number(x.taskScore || 0);
    totalChecklist += Number(x.checklistScore || 0);
    totalViolation += Number(x.violationScore || 0);

    totalTasks += Number(x.taskCount || 0);
    totalChecks += Number(x.checkCount || 0);
    totalViolations += Number(x.violationCount || 0);

    const rank = String(x.ranking || '').trim();

    if (rank) {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    }
  });

  const averageScore = rows.length
    ? Math.round(totalScore * 10 / rows.length) / 10
    : 0;

  return {
    staffCount: rows.length,
    totalScore: Math.round(totalScore * 10) / 10,
    averageScore: averageScore,
    totalTaskScore: totalTask,
    totalChecklistScore: totalChecklist,
    totalViolationScore: totalViolation,
    totalTasks: totalTasks,
    totalChecks: totalChecks,
    totalViolations: totalViolations,
    rankCounts: rankCounts
  };
}

function buildKpiConclusion_(rows, summary, rankingConfig) {
  rows = Array.isArray(rows) ? rows : [];
  summary = summary || {};
  rankingConfig = Array.isArray(rankingConfig) ? rankingConfig : [];

  if (!rows.length) {
    return [
      'Không có dữ liệu KPI phù hợp với bộ lọc hiện tại.'
    ];
  }

  const sorted = rows.slice().sort(function(a,b){
    return Number(b.total || 0) - Number(a.total || 0);
  });

  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  const topRank = rankingConfig.length
    ? rankingConfig[0].ranking
    : '';

  const topRankCount = topRank
    ? Number((summary.rankCounts || {})[topRank] || 0)
    : 0;

  const negativeTask = rows.filter(function(x){
    return Number(x.taskScore || 0) < 0;
  }).length;

  const negativeChecklist = rows.filter(function(x){
    return Number(x.checklistScore || 0) < 0;
  }).length;

  const violationStaff = rows.filter(function(x){
    return Number(x.violationScore || 0) < 0;
  }).length;

  const out = [
    'Điểm KPI bình quân của ' + rows.length + ' nhân viên: ' +
      Number(summary.averageScore || 0).toFixed(1) + ' điểm.',

    'Điểm cao nhất: ' + highest.name + ' — ' +
      Number(highest.total || 0).toFixed(1) + ' điểm (' +
      String(highest.ranking || 'Chưa xếp loại') + ').',

    'Điểm thấp nhất: ' + lowest.name + ' — ' +
      Number(lowest.total || 0).toFixed(1) + ' điểm (' +
      String(lowest.ranking || 'Chưa xếp loại') + ').'
  ];

  if (topRank) {
    out.push(
      'Có ' + topRankCount + ' nhân viên đạt mức ' + topRank + '.'
    );
  }

  if (negativeTask || negativeChecklist || violationStaff) {
    out.push(
      'Cần ưu tiên rà soát: ' +
      negativeTask + ' nhân viên bị trừ điểm giao việc; ' +
      negativeChecklist + ' nhân viên bị trừ điểm bảng kiểm; ' +
      violationStaff + ' nhân viên có điểm vi phạm.'
    );
  } else {
    out.push(
      'Không ghi nhận điểm âm từ giao việc, bảng kiểm hoặc vi phạm trong kỳ.'
    );
  }

  return out;
}

function getKpiFeedback_(filters) {
  setupKpiDashboardSystem();

  filters = filters || {};

  const ss = getAppSpreadsheet_();
  const sh = ss.getSheetByName(KPI_FEEDBACK_SHEET);

  if (!sh || sh.getLastRow() < 2) {
    return {
      text:'',
      author:'',
      updatedAt:''
    };
  }

  const data = sh.getDataRange().getValues();

  const fromKey = kpiDateKey_(filters.from);
  const toKey = kpiDateKey_(filters.to);
  const department = String(filters.department || '').trim();
  const person = String(filters.person || '').trim();

  for (let i = data.length - 1; i >= 1; i--) {
    const r = data[i];

    if (
      kpiDateKey_(r[1]) === fromKey &&
      kpiDateKey_(r[2]) === toKey &&
      String(r[3] || '').trim() === department &&
      String(r[4] || '').trim() === person
    ) {
      return {
        text:String(r[5] || ''),
        author:String(r[6] || ''),
        updatedAt:kpiFormatDateTime_(r[7])
      };
    }
  }

  return {
    text:'',
    author:'',
    updatedAt:''
  };
}

function saveKpiFeedback(payload) {
  setupKpiDashboardSystem();

  payload = payload || {};

  const from = String(payload.from || '').trim();
  const to = String(payload.to || '').trim();
  const department = String(payload.department || '').trim();
  const person = String(payload.person || '').trim();
  const text = String(payload.text || '').trim();

  if (!from || !to) {
    throw new Error('Thiếu khoảng ngày KPI.');
  }

  const ss = getAppSpreadsheet_();
  const sh = ss.getSheetByName(KPI_FEEDBACK_SHEET);
  const data = sh.getDataRange().getValues();

  let rowFound = 0;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];

    if (
      kpiDateKey_(r[1]) === kpiDateKey_(from) &&
      kpiDateKey_(r[2]) === kpiDateKey_(to) &&
      String(r[3] || '').trim() === department &&
      String(r[4] || '').trim() === person
    ) {
      rowFound = i + 1;
      break;
    }
  }

  const now = new Date();

  let author = '';

  try {
    author = String(APP_CONFIG.AUTHOR || '');
  } catch (e) {}

  const id = rowFound
    ? String(data[rowFound - 1][0] || '')
    : (
        'YK-KPI-' +
        Utilities.formatDate(
          now,
          Session.getScriptTimeZone(),
          'yyyyMMddHHmmss'
        ) +
        '-' +
        Math.floor(Math.random() * 9000 + 1000)
      );

  const values = [[
    id,
    kpiParseDate_(from) || from,
    kpiParseDate_(to) || to,
    department,
    person,
    text,
    author,
    now
  ]];

  if (rowFound) {
    sh.getRange(rowFound,1,1,8).setValues(values);
  } else {
    sh.appendRow(values[0]);
  }

  const row = rowFound || sh.getLastRow();

  sh.getRange(row,2,1,2).setNumberFormat('dd/MM/yyyy');
  sh.getRange(row,8).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  return {
    success:true,
    message:'Đã lưu góp ý KPI.',
    feedback:{
      text:text,
      author:author,
      updatedAt:kpiFormatDateTime_(now)
    }
  };
}

function kpiDateKey_(value) {
  const d = kpiParseDate_(value);

  return d
    ? Utilities.formatDate(
        d,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      )
    : String(value || '').trim();
}

function kpiParseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  const s = String(value || '').trim();

  if (!s) return null;

  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (m1) {
    return new Date(
      Number(m1[1]),
      Number(m1[2]) - 1,
      Number(m1[3])
    );
  }

  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (m2) {
    return new Date(
      Number(m2[3]),
      Number(m2[2]) - 1,
      Number(m2[1])
    );
  }

  const d = new Date(s);

  return isNaN(d.getTime())
    ? null
    : d;
}

function kpiFormatDateTime_(value) {
  const d = kpiParseDate_(value);

  return d
    ? Utilities.formatDate(
        d,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      )
    : '';
}

/**
 * V19.2 - Danh sách bộ lọc KPI tự lấy từ DM_NHANVIEN.
 * KPI.html không còn phụ thuộc getStaffData().
 */
function getKpiFilterOptions() {
  const staff =
    kpiGetActiveStaffObjects_();

  const departments =
    (APP_CONFIG.DEPARTMENTS || []).slice();

  staff.forEach(function(x) {
    const dep =
      String(
        x.department || ''
      ).trim();

    if (
      dep &&
      departments.indexOf(dep) === -1
    ) {
      departments.push(dep);
    }
  });

  departments.sort(
    function(a,b) {
      return a.localeCompare(
        b,
        'vi'
      );
    }
  );

  return {
    staff: staff,
    departments: departments
  };
}


/**
 * Chạy hàm này để kiểm tra nguồn KPI sau khi copy V19.1.
 */
function debugKpiDataSources() {
  const ss =
    typeof getAppSpreadsheet_ ===
    'function'
      ? getAppSpreadsheet_()
      : SpreadsheetApp.getActiveSpreadsheet();

  const staffSheet =
    kpiGetSheetByConfigOrNames_(
      'STAFF',
      ['DM_NHANVIEN'],
      false
    );

  const taskSheet =
    kpiGetSheetByConfigOrNames_(
      'TASKS',
      ['GIAO VIỆC'],
      false
    );

  const checklistSheet =
    kpiGetSheetByConfigOrNames_(
      'CHECKLIST_FORMS',
      ['PHIEU_GIAMSAT'],
      false
    );

  const violationSheet =
    kpiGetSheetByConfigOrNames_(
      'VIOLATIONS',
      ['THEODOI_VIPHAM'],
      false
    );

  return {
    spreadsheetId:
      ss.getId(),

    staffSheet:
      staffSheet
        ? staffSheet.getName()
        : 'KHÔNG TÌM THẤY',

    taskSheet:
      taskSheet
        ? taskSheet.getName()
        : 'KHÔNG TÌM THẤY',

    checklistSheet:
      checklistSheet
        ? checklistSheet.getName()
        : 'KHÔNG TÌM THẤY',

    violationSheet:
      violationSheet
        ? violationSheet.getName()
        : 'KHÔNG TÌM THẤY',

    activeStaffCount:
      kpiGetActiveStaffObjects_()
        .length
  };
}

/**
 * ============================================================
 * V19.4 - BOOTSTRAP KPI AN TOÀN
 * ============================================================
 * Một lần gọi duy nhất khi mở KPI:
 * - Tự tạo DM_QUYDOI_KPI nếu chưa có.
 * - Tự tạo Y_KIEN_KPI nếu chưa có.
 * - Trả danh sách nhân viên / bộ phận.
 * - Không phụ thuộc AppUtil.
 */
function getKpiBootstrapData() {
  setupKpiDashboardSystem();

  const options =
    getKpiFilterOptions();

  return {
    success: true,
    staff:
      options.staff || [],
    departments:
      options.departments || [],
    conversionRules:
      getKpiConversionRules()
  };
}


/**
 * Kiểm tra danh sách nhân viên mà KPI thực tế đang đọc từ DM_NHANVIEN.
 */
function KSNK_TEST_NHANVIEN_KPI() {
  var staff = kpiGetActiveStaffObjects_();
  Logger.log(JSON.stringify(staff, null, 2));
  return {
    count: staff.length,
    staff: staff
  };
}
