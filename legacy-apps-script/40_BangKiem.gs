/**
 * ============================================================
 * MÔ-ĐUN 5 - BẢNG KIỂM GIÁM SÁT ĐA PHIẾU
 * ============================================================
 * GIỮ NGUYÊN tương thích dữ liệu cũ:
 * - DM_BANGKIEM: A:E giữ nguyên; F:I là cột mới.
 * - PHIEU_GIAMSAT: A:P giữ nguyên; Q:S là cột mới.
 * - CT_PHIEU_GIAMSAT: A:F giữ nguyên; G:I là cột mới.
 *
 * Bộ dữ liệu chuẩn hiện có: 5 phiếu / 44 tiêu chí.
 */

function seedChecklistSystem() {
  setupExtensionSheets();

  const formSheet = getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER);
  const criterionSheet = getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_MASTER);

  if (formSheet.getLastRow() > 1 || criterionSheet.getLastRow() > 1) {
    return 'Danh mục bảng kiểm đã có dữ liệu. Hệ thống không ghi đè để bảo vệ dữ liệu hiện có.';
  }

  const forms = [
    ['DC-P01','GIÁM SÁT KHU VỰC XỬ LÝ DỤNG CỤ','DỤNG CỤ','Giám sát khu vực xử lý dụng cụ',10,'Hoạt động'],
    ['DC-P02','GIÁM SÁT KHU VỰC ĐÓNG GÓI - TIỆT KHUẨN','DỤNG CỤ','Giám sát khu vực đóng gói và tiệt khuẩn',9,'Hoạt động'],
    ['DC-P03','GIÁM SÁT KHU VỰC LƯU TRỮ - CẤP PHÁT DỤNG CỤ','DỤNG CỤ','Giám sát khu vực lưu trữ và cấp phát dụng cụ',9,'Hoạt động'],
    ['VSMT-P01','GIÁM SÁT VỆ SINH MÔI TRƯỜNG BỆNH VIỆN','VỆ SINH MÔI TRƯỜNG','Bảng kiểm giám sát vệ sinh môi trường bệnh viện',11,'Hoạt động'],
    ['VSMT-P02','GIÁM SÁT NHANH VỆ SINH MÔI TRƯỜNG','VỆ SINH MÔI TRƯỜNG','Phiếu giám sát nhanh vệ sinh môi trường',5,'Hoạt động']
  ];

  const c = [];
  function add(formCode, no, department, group, content, detail, allowImage) {
    c.push([
      formCode + '-' + ('0' + no).slice(-2),
      department,
      group,
      content,
      'Hoạt động',
      formCode,
      no,
      detail,
      allowImage === false ? 'Không' : 'Có'
    ]);
  }

  // DC-P01 - KHU VỰC XỬ LÝ DỤNG CỤ (10)
  add('DC-P01',1,'DỤNG CỤ','Khu vực xử lý','Phương tiện phòng hộ cá nhân','Mũ, khẩu trang, găng tay, tạp dề đầy đủ, sạch và bố trí đúng nơi quy định.');
  add('DC-P01',2,'DỤNG CỤ','Khu vực xử lý','Hóa chất','Đúng loại, còn hạn sử dụng; hóa chất đã pha có nhãn đầy đủ tên hóa chất, nồng độ/tỷ lệ pha, ngày giờ pha và người pha.');
  add('DC-P01',3,'DỤNG CỤ','Khu vực xử lý','Thùng ngâm dụng cụ','Được pha đúng tỷ lệ, còn thời gian sử dụng; thùng/bồn ngâm có nắp đậy và sạch sẽ.');
  add('DC-P01',4,'DỤNG CỤ','Khu vực xử lý','Thùng chứa chất thải','Phân loại đúng quy định; túi/thùng không đầy tràn, có đầy đủ dụng cụ chứa rác.');
  add('DC-P01',5,'DỤNG CỤ','Khu vực xử lý','Khu vực sàn','Sàn sạch, không có dụng cụ lộn xộn, rác tồn đọng, không đọng nước, không trơn trượt.');
  add('DC-P01',6,'DỤNG CỤ','Khu vực xử lý','Bồn rửa và khu vực xử lý','Bồn rửa sạch, không có cặn bẩn/dịch hữu cơ; khu vực xung quanh sạch và khô ráo.');
  add('DC-P01',7,'DỤNG CỤ','Khu vực xử lý','Dụng cụ và vật tư/hóa chất','Dụng cụ sắp xếp gọn gàng, đúng màu sắc các rổ; không để dụng cụ bẩn lẫn dụng cụ đã xử lý; kiểm tra lượng tồn và hóa chất tại vị trí.');
  add('DC-P01',8,'DỤNG CỤ','Khu vực xử lý','Máy rửa dụng cụ tự động','Bên trong máy sạch, không còn cặn bẩn; kiểm tra tình trạng máy trước khi vận hành.');
  add('DC-P01',9,'DỤNG CỤ','Khu vực xử lý','Sổ giao/nhận dụng cụ','Phiếu bàn giao giữa phòng mổ và KSNK được xác nhận giữa hai bên.');
  add('DC-P01',10,'DỤNG CỤ','Khu vực xử lý','Hành chính','Bàn giao đầy đủ công việc còn lại cho người trực.');

  // DC-P02 - ĐÓNG GÓI - TIỆT KHUẨN (9)
  add('DC-P02',1,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Phương tiện phòng hộ cá nhân','Mũ, khẩu trang, găng tay, dép đầy đủ, sạch sẽ và bố trí bỏ đúng nơi quy định.');
  add('DC-P02',2,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Khu vực đóng gói','Sàn nhà, kệ đóng gói, bàn làm việc, bề mặt và trang thiết bị máy móc sạch sẽ, gọn gàng; thực hiện vệ sinh hằng ngày.');
  add('DC-P02',3,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Vật tư đóng gói','Được sắp xếp đúng vị trí; kiểm tra, theo dõi số lượng hằng ngày; vật tư gần hết phải báo tổ trưởng để bổ sung kịp thời.');
  add('DC-P02',4,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Vận hành máy hấp','Kiểm tra hoạt động các máy vào đầu buổi sáng, vệ sinh sạch sẽ.');
  add('DC-P02',5,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Tiếp nhận và sắp xếp đồ vải','Tiếp nhận, ghi nhận đầy đủ số lượng bọc vải, săng gói; sắp xếp lên giá đúng vị trí quy định, đảm bảo trên giá gọn gàng.');
  add('DC-P02',6,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Dụng cụ và sổ sách','Theo dõi, kiểm tra chất lượng dụng cụ; ghi chép đầy đủ sổ sách; theo dõi và cấp phát dụng cụ của hãng đúng số lượng, đúng yêu cầu.');
  add('DC-P02',7,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Túi ép và vật tư chuẩn bị','Chuẩn bị đầy đủ các loại túi ép và vật tư đóng gói cần thiết trước khi bàn giao vị trí; đảm bảo không để thiếu vật tư cho ca sau.');
  add('DC-P02',8,'DỤNG CỤ','Đóng gói - tiệt khuẩn','5S khu vực','Thực hiện 5S đầu buổi sáng và cuối giờ hành chính; sắp xếp dụng cụ, vật tư, máy móc đúng vị trí; đảm bảo khu vực sạch, gọn, an toàn.');
  add('DC-P02',9,'DỤNG CỤ','Đóng gói - tiệt khuẩn','Bàn giao công việc','Kiểm tra lại công việc trước khi kết thúc ca; bàn giao đầy đủ công việc còn lại, số liệu, dụng cụ, vật tư và các vấn đề phát sinh cho người trực/ca sau.');

  // DC-P03 - LƯU TRỮ - CẤP PHÁT (9)
  add('DC-P03',1,'DỤNG CỤ','Lưu trữ - cấp phát','Phương tiện phòng hộ cá nhân','Mũ, khẩu trang, găng tay bố trí đúng nơi quy định.');
  add('DC-P03',2,'DỤNG CỤ','Lưu trữ - cấp phát','Nhiệt độ, độ ẩm','Kiểm tra và ghi phiếu theo dõi nhiệt độ, độ ẩm phòng lưu trữ hằng ngày; kịp thời báo cáo khi chỉ số không đạt yêu cầu.');
  add('DC-P03',3,'DỤNG CỤ','Lưu trữ - cấp phát','Bàn giao dụng cụ không chịu nhiệt','Kiểm tra, chuẩn bị và bàn giao dụng cụ không chịu nhiệt cho phòng mổ vào đầu buổi sáng theo quy định.');
  add('DC-P03',4,'DỤNG CỤ','Lưu trữ - cấp phát','Kiểm tra dụng cụ, vật tư lưu kho','Kiểm tra số lượng, hạn sử dụng, tình trạng bảo quản, cơ số dụng cụ và cơ số đỏ; báo cáo tổ trưởng vào đầu buổi sáng khi thiếu, gần hết hạn hoặc không đủ cơ số.');
  add('DC-P03',5,'DỤNG CỤ','Lưu trữ - cấp phát','Giá để đồ','Kiểm tra tất cả các dụng cụ trên giá gọn gàng, ngăn nắp, đúng vị trí.');
  add('DC-P03',6,'DỤNG CỤ','Lưu trữ - cấp phát','Vệ sinh khu vực','Vệ sinh hằng ngày các bề mặt phòng lưu trữ, kệ, xe vận chuyển dụng cụ, thùng dụng cụ bẩn và các khu vực liên quan; bảo đảm khu vực sạch sẽ, ngăn nắp và thực hiện đúng nguyên tắc 5S.');
  add('DC-P03',7,'DỤNG CỤ','Lưu trữ - cấp phát','Bọc vải','Bọc vải được phân loại, sắp xếp đúng theo cơ số trên giá, bao gồm cơ số đỏ và cơ số thường; xếp gọn gàng, đúng vị trí, dễ nhận biết và thuận tiện cho việc cấp phát. Kiểm tra số lượng hằng ngày, kịp thời bổ sung hoặc báo cáo tổ trưởng khi thiếu cơ số.');
  add('DC-P03',8,'DỤNG CỤ','Lưu trữ - cấp phát','Dụng cụ cấp phát','Dụng cụ được sắp xếp theo từng nhóm, từng bộ và đúng vị trí đã quy định; nhãn nhận diện đầy đủ, rõ ràng, dễ kiểm tra và cấp phát. Không để lẫn dụng cụ giữa các nhóm hoặc giữa cơ số đỏ và cơ số thường.');
  add('DC-P03',9,'DỤNG CỤ','Lưu trữ - cấp phát','Xe vận chuyển','Xe vận chuyển bọc vải được bố trí đúng vị trí quy định, vệ sinh sạch sẽ trước và sau khi sử dụng; bọc vải khi vận chuyển phải được sắp xếp gọn gàng.');

  // VSMT-P01 - GIÁM SÁT VSMT BỆNH VIỆN (11)
  add('VSMT-P01',1,'VỆ SINH MÔI TRƯỜNG','I','THÁI ĐỘ TÁC PHONG','Giao tiếp đúng mực, không có phản ánh từ đồng nghiệp, người bệnh.');
  add('VSMT-P01',2,'VỆ SINH MÔI TRƯỜNG','II','CHUẨN BỊ & TUÂN THỦ','Mặc đồng phục, mang PPE đầy đủ; đúng giờ; xe vệ sinh gọn gàng; hóa chất đầy đủ, đúng nhãn, pha đúng tỷ lệ; khăn/tải lau đúng màu.');
  add('VSMT-P01',3,'VỆ SINH MÔI TRƯỜNG','III','VỆ SINH MÔI TRƯỜNG CHUNG','Thực hiện đúng quy trình, nguyên tắc; đặt biển cảnh báo sàn trượt; đánh bảng kiểm đúng giờ; vệ sinh phòng ra viện/phòng trống (2 lần/tuần).');
  add('VSMT-P01',4,'VỆ SINH MÔI TRƯỜNG','III','Sàn, tường, trần, hành lang','Sàn sạch, không rác/mùi; tường/chân tường không bám bụi; trần không màng nhện; lan can hành lang, hộp PCCC sạch sẽ.');
  add('VSMT-P01',5,'VỆ SINH MÔI TRƯỜNG','III','Thang máy & Thang bộ','Thang máy (trong/ngoài): sạch buồng, sàn, rãnh, kính, không bụi/dấu tay; Thang bộ: không rác, không màng nhện.');
  add('VSMT-P01',6,'VỆ SINH MÔI TRƯỜNG','III','Tiện ích chung','Cây nước uống, bình sát khuẩn tay (còn dung dịch), ghế chờ sạch sẽ, không bám bụi bẩn.');
  add('VSMT-P01',7,'VỆ SINH MÔI TRƯỜNG','IV','GIƯỜNG BỆNH & TỦ ĐẦU GIƯỜNG','Giường, bàn ăn, bánh xe, mạ đầu/chân giường sạch; đệm không rách/mốc, vệ sinh sau mỗi bệnh nhân; Tủ đầu giường sạch trong/ngoài, không mùi/côn trùng, khử khuẩn khi bệnh nhân ra viện.');
  add('VSMT-P01',8,'VỆ SINH MÔI TRƯỜNG','V','KÍNH, KHUNG CỬA','Khung cửa, kệ cửa, tay nắm cửa sạch bụi; mặt kính sạch, không vện/dấu vân tay.');
  add('VSMT-P01',9,'VỆ SINH MÔI TRƯỜNG','VI','NHÀ VỆ SINH, NHÀ TẮM','Sàn, trần sạch, không mùi hôi; Bồn cầu, bồn tiểu, lavabo sạch, không ố vàng; Tường sạch; Gương, vòi nước, vòi sen không bám cặn canxi; Đầy đủ nước rửa tay, giấy vệ sinh.');
  add('VSMT-P01',10,'VỆ SINH MÔI TRƯỜNG','VII','QUẢN LÝ RÁC THẢI','Thùng rác có nhãn, sạch, không mùi; Túi rác đúng màu, thu gom khi đạt 2/3 thùng; Vận chuyển đúng quy định; Nhà lưu giữ rác sạch, ngăn nắp.');
  add('VSMT-P01',11,'VỆ SINH MÔI TRƯỜNG','VIII','VỆ SINH NGOẠI CẢNH','Cây cảnh xanh tốt, chăm sóc/tưới nước/đảo cây (2 lần/tháng); Ngoại cảnh, gốc cây, tầng hầm sạch rác, cỏ dại; Cống rãnh không đọng nước, thông thoáng.');

  // VSMT-P02 - GIÁM SÁT NHANH (5)
  add('VSMT-P02',1,'VỆ SINH MÔI TRƯỜNG','Giám sát nhanh','Trang phục và phương tiện phòng hộ cá nhân','Trang phục và phương tiện phòng hộ cá nhân đầy đủ, đúng quy định.');
  add('VSMT-P02',2,'VỆ SINH MÔI TRƯỜNG','Giám sát nhanh','Xe vệ sinh, hóa chất','Dụng cụ trên xe gọn gàng, đầy đủ; hóa chất và nhãn hóa chất đúng quy định.');
  add('VSMT-P02',3,'VỆ SINH MÔI TRƯỜNG','Giám sát nhanh','Nhà vệ sinh và chất thải','Nhà vệ sinh sạch sẽ; thùng chứa chất thải không đầy, không tràn.');
  add('VSMT-P02',4,'VỆ SINH MÔI TRƯỜNG','Giám sát nhanh','Thùng chất thải hành lang','Thùng chứa chất thải tại hành lang trong và ngoài sạch sẽ, không đầy, không tràn.');
  add('VSMT-P02',5,'VỆ SINH MÔI TRƯỜNG','Giám sát nhanh','Rác tại khu vực','Không có rác nổi hoặc rác tồn đọng tại khu vực kiểm tra.');

  formSheet.getRange(2,1,forms.length,forms[0].length).setValues(forms);
  criterionSheet.getRange(2,1,c.length,c[0].length).setValues(c);
  SpreadsheetApp.flush();

  return 'Đã nạp thành công 5 phiếu / 44 tiêu chí vào DM_PHIEU_GIAMSAT và DM_BANGKIEM.';
}

/** Tên cũ vẫn dùng được để tránh phải nhớ hàm mới. */
function seedChecklistMaster() {
  return seedChecklistSystem();
}

function getChecklistInitialData() {
  setupChecklistPercentSystem();

  const ss = getAppSpreadsheet_();
  const formSheet = ss.getSheetByName(EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER);
  const criterionSheet = ss.getSheetByName(EXT_CONFIG.SHEETS.CHECKLIST_MASTER);

  if (!formSheet) {
    throw new Error(
      'Không tìm thấy sheet "' + EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER +
      '" trong bảng tính: ' + ss.getName() + ' | ID: ' + ss.getId()
    );
  }
  if (!criterionSheet) {
    throw new Error(
      'Không tìm thấy sheet "' + EXT_CONFIG.SHEETS.CHECKLIST_MASTER +
      '" trong bảng tính: ' + ss.getName() + ' | ID: ' + ss.getId()
    );
  }

  const forms = formSheet.getDataRange().getDisplayValues();
  const criteria = criterionSheet.getDataRange().getDisplayValues();

  return {
    forms: forms,
    criteria: criteria,
    staff: getActiveStaffObjects_(),
    departments: APP_CONFIG.DEPARTMENTS.slice(),
    currentUser: APP_CONFIG.AUTHOR,
    source: {
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      formRows: Math.max(0, forms.length - 1),
      criterionRows: Math.max(0, criteria.length - 1)
    }
  };
}

/** Chạy trực tiếp trong Apps Script để kiểm tra Web App đang đọc đúng bảng nào. */
function debugChecklistSource() {
  const ss = getAppSpreadsheet_();
  const formSheet = ss.getSheetByName(EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER);
  const criterionSheet = ss.getSheetByName(EXT_CONFIG.SHEETS.CHECKLIST_MASTER);
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    formSheetExists: !!formSheet,
    formRows: formSheet ? Math.max(0, formSheet.getLastRow() - 1) : 0,
    criterionSheetExists: !!criterionSheet,
    criterionRows: criterionSheet ? Math.max(0, criterionSheet.getLastRow() - 1) : 0,
    departments: APP_CONFIG.DEPARTMENTS.slice()
  };
}

function addChecklistCriterion(formData) {
  formData = formData || {};
  const sh = getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_MASTER);
  const id = String(formData.id || '').trim() || createRecordId_('BK');
  if (findRowById_(sh,id,1) !== -1) throw new Error('Mã tiêu chí đã tồn tại.');
  sh.appendRow([
    id,
    requireText_(formData.department,'Bộ phận'),
    String(formData.group || 'Chung'),
    requireText_(formData.content,'Nội dung tiêu chí'),
    'Hoạt động',
    String(formData.formCode || ''),
    Number(formData.order) || '',
    String(formData.detail || formData.content || ''),
    String(formData.allowImage || 'Có')
  ]);
  return 'Đã thêm tiêu chí.';
}

function checklistScoreFromRate_(rate) {
  rate = Number(rate) || 0;
  if (rate >= 95) return EXT_CONFIG.CHECKLIST_SCORE.RATE_95_100;
  if (rate >= 90) return EXT_CONFIG.CHECKLIST_SCORE.RATE_90_95;
  if (rate >= 80) return EXT_CONFIG.CHECKLIST_SCORE.RATE_80_90;
  if (rate >= 70) return EXT_CONFIG.CHECKLIST_SCORE.RATE_70_80;
  return EXT_CONFIG.CHECKLIST_SCORE.RATE_BELOW_70;
}

function saveChecklistForm(formData) {
  formData = formData || {};
  const date = parseYmdDate_(formData.date);
  if (!date) throw new Error('Ngày giám sát không hợp lệ.');

  const details = Array.isArray(formData.details) ? formData.details : [];
  if (!details.length) throw new Error('Chưa có tiêu chí bảng kiểm.');

  const formCode = requireText_(formData.formCode,'Mã mẫu phiếu');
  const formName = requireText_(formData.formName,'Tên phiếu');

  const percentConfig =
    getChecklistPercentConfig(
      formCode
    );

  let pass = 0, fail = 0, applied = 0, na = 0;
  details.forEach(function(x,index) {
    const result = String(x.result || '').trim().toUpperCase();
    if (!result) throw new Error('Chưa chọn kết quả tại tiêu chí số ' + (index + 1) + '.');
    if (result === 'KHÔNG ÁP DỤNG') { na++; return; }
    if (result !== 'ĐẠT' && result !== 'KHÔNG ĐẠT') {
      throw new Error('Kết quả không hợp lệ tại tiêu chí số ' + (index + 1) + '.');
    }
    applied++;
    if (result === 'ĐẠT') pass++;
    else {
      fail++;
      if (!String(x.note || '').trim()) {
        throw new Error('Tiêu chí KHÔNG ĐẠT số ' + (index + 1) + ' cần nhập ghi chú lỗi.');
      }
    }
  });

  /*
   * TỶ LỆ %:
   * ĐẠT / (ĐẠT + KHÔNG ĐẠT) × 100
   * N/A không tính vào mẫu số.
   */
  const rate =
    applied
      ? Math.round(
          pass *
          10000 /
          applied
        ) /
        100
      : 0;

  const percentRank =
    percentConfig
      ? classifyChecklistRate_(
          rate,
          percentConfig
        )
      : '';

  const kpi =
    checklistKpiFromRateWithConfig_(
      rate,
      percentConfig
    );

  const formId = createRecordId_('PGS');

  const detailRows = [];
  let firstImageRef = '';

  details.forEach(function(x) {
    let imageRef = '';
    if (x.imageObject && x.imageObject.base64) {
      imageRef = saveBase64Image_(x.imageObject, formId + '_' + String(x.id || 'TC'));
      if (!firstImageRef) firstImageRef = imageRef;
    }
    detailRows.push([
      formId,
      String(x.id || ''),
      String(x.group || ''),
      String(x.content || ''),
      String(x.result || ''),
      String(x.note || ''),
      Number(x.order) || '',
      String(x.detail || ''),
      imageRef
    ]);
  });

  const sh = getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_FORMS);
  sh.appendRow([
    formId,
    date,
    requireText_(formData.staffId,'Mã NV'),
    requireText_(formData.staffName,'Họ tên'),
    requireText_(formData.department,'Bộ phận'),
    String(formData.supervisor || APP_CONFIG.AUTHOR),
    String(formData.area || ''),
    String(formData.shift || ''),
    applied,
    pass,
    fail,
    rate,
    kpi,
    String(formData.note || ''),
    firstImageRef,
    new Date(),
    formCode,
    formName,
    na,

    /*
     * T = Tỷ lệ % chấm
     * U = Xếp loại theo phiếu
     * V = KPI bảng kiểm áp dụng
     */
    rate,
    percentRank,
    kpi
  ]);
  sh.getRange(sh.getLastRow(),2).setNumberFormat('dd/MM/yyyy');

  const dt = getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_DETAILS);
  if (detailRows.length) {
    dt.getRange(dt.getLastRow()+1,1,detailRows.length,9).setValues(detailRows);
  }

  return {
    success: true,
    formId: formId,
    formCode: formCode,
    formName: formName,
    applied: applied,
    pass: pass,
    fail: fail,
    na: na,
    rate: rate,
    kpi: kpi,

    percentScoring:
      !!percentConfig,

    percentRank:
      percentRank
  };
}

function getChecklistHistory(filters) {
  filters = filters || {};
  return getChecklistFormsForRange_(filters.from,filters.to,filters.department,filters.person,filters.formCode);
}

function getChecklistFormsForRange_(from,to,department,person,formCode) {
  const data = getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_FORMS).getDataRange().getValues();
  const out = [];
  for (let i=1; i<data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    if (!inDateRange_(r[1],from,to)) continue;
    if (department && String(r[4] || '') !== department) continue;
    if (person && String(r[3] || '') !== person) continue;
    if (formCode && String(r[16] || '') !== formCode) continue;
    out.push({
      id:r[0], date:formatDate_(r[1]), staffId:r[2], name:r[3], department:r[4], supervisor:r[5],
      area:r[6], shift:r[7], applied:Number(r[8])||0, pass:Number(r[9])||0, fail:Number(r[10])||0,
      rate:Number(r[11])||0, kpi:Number(r[12])||0, note:r[13], imageRef:r[14],
      formCode:r[16]||'', formName:r[17]||'', na:Number(r[18])||0,
      percentRate:
        r.length>19 && r[19]!=='' ? Number(r[19]) : null,
      percentRank:
        r.length>20 ? String(r[20]||'') : '',
      percentKpi:
        r.length>21 && r[21]!=='' ? Number(r[21]) : null
    });
  }
  return out;
}

/**
 * ============================================================
 * V16 - XẾP LOẠI THEO TỶ LỆ % RIÊNG CHO TỪNG PHIẾU
 * ============================================================
 *
 * CÔNG THỨC CỐ ĐỊNH:
 *
 * TỶ LỆ ĐẠT (%) =
 *       SỐ TIÊU CHÍ ĐẠT
 * -------------------------------- x 100
 * ĐẠT + KHÔNG ĐẠT
 *
 * N/A KHÔNG tính vào mẫu số.
 *
 * Điều này đảm bảo:
 * - 18/20 = 90%
 * - 9/10  = 90%
 * => Hai người được đánh số tiêu chí khác nhau vẫn công bằng.
 *
 * Mỗi phiếu có thể có ngưỡng xếp loại riêng:
 * A >= ...
 * B >= ...
 * C >= ...
 * Dưới C = ...
 *
 * KPI:
 * - Mặc định giữ nguyên checklistScoreFromRate_() hiện tại.
 * - Có thể bật "KPI riêng theo %" cho từng phiếu.
 *
 * Sheet cấu hình:
 * DM_CAUHINH_PHIEU
 * ============================================================
 */

const CHECKLIST_PERCENT_CONFIG_SHEET = 'DM_CAUHINH_PHIEU';

function setupChecklistPercentSystem() {
  setupExtensionSheets();

  const ss = getAppSpreadsheet_();

  let sh =
    ss.getSheetByName(
      CHECKLIST_PERCENT_CONFIG_SHEET
    );

  const headers = [
    'Mã phiếu',
    'Ngưỡng A (%)',
    'Ngưỡng B (%)',
    'Ngưỡng C (%)',
    'Tên mức A',
    'Tên mức B',
    'Tên mức C',
    'Tên dưới C',
    'Dùng KPI riêng',
    'KPI mức 1 từ %',
    'KPI mức 1 điểm',
    'KPI mức 2 từ %',
    'KPI mức 2 điểm',
    'KPI mức 3 từ %',
    'KPI mức 3 điểm',
    'KPI mức 4 từ %',
    'KPI mức 4 điểm',
    'KPI mức 5 từ %',
    'KPI mức 5 điểm',
    'KPI dưới mức 5',
    'Trạng thái',
    'Cập nhật lúc'
  ];

  if (!sh) {
    sh =
      ss.insertSheet(
        CHECKLIST_PERCENT_CONFIG_SHEET
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
    .setValues([
      headers
    ])
    .setFontWeight('bold')
    .setBackground('#123b8f')
    .setFontColor('#ffffff')
    .setWrap(true);

  sh.setFrozenRows(1);

  /*
   * PHIEU_GIAMSAT:
   * A:S giữ nguyên
   * T = Tỷ lệ % chấm
   * U = Xếp loại theo phiếu
   * V = KPI bảng kiểm áp dụng
   */
  const formSheet =
    getRequiredSheet_(
      EXT_CONFIG.SHEETS.CHECKLIST_FORMS
    );

  if (
    formSheet.getMaxColumns() <
    22
  ) {
    formSheet.insertColumnsAfter(
      formSheet.getMaxColumns(),
      22 -
      formSheet.getMaxColumns()
    );
  }

  const extraHeaders = [
    'Tỷ lệ % chấm',
    'Xếp loại theo phiếu',
    'KPI bảng kiểm áp dụng'
  ];

  extraHeaders.forEach(
    function(header, index) {
      const col =
        20 + index;

      const current =
        String(
          formSheet
            .getRange(
              1,
              col
            )
            .getDisplayValue() ||
          ''
        ).trim();

      if (!current) {
        formSheet
          .getRange(
            1,
            col
          )
          .setValue(
            header
          );
      }
    }
  );

  return {
    success: true,
    sheet:
      CHECKLIST_PERCENT_CONFIG_SHEET
  };
}

function getChecklistPercentConfig(formCode) {
  setupChecklistPercentSystem();

  const code =
    String(
      formCode || ''
    ).trim();

  if (!code) {
    return null;
  }

  const ss =
    getAppSpreadsheet_();

  const sh =
    ss.getSheetByName(
      CHECKLIST_PERCENT_CONFIG_SHEET
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return null;
  }

  const values =
    sh.getDataRange()
      .getValues();

  const key =
    normalizeChecklistKey_(
      code
    );

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const r =
      values[i];

    if (
      normalizeChecklistKey_(
        r[0]
      ) !== key
    ) {
      continue;
    }

    const status =
      normalizeChecklistKey_(
        r[20]
      );

    if (
      status &&
      status !== 'hoat dong'
    ) {
      return null;
    }

    return {
      formCode:
        String(
          r[0] || ''
        ),

      thresholdA:
        numberOrDefault_(
          r[1],
          95
        ),

      thresholdB:
        numberOrDefault_(
          r[2],
          90
        ),

      thresholdC:
        numberOrDefault_(
          r[3],
          80
        ),

      labelA:
        String(
          r[4] || 'A'
        ),

      labelB:
        String(
          r[5] || 'B'
        ),

      labelC:
        String(
          r[6] || 'C'
        ),

      labelBelow:
        String(
          r[7] ||
          'CHƯA ĐẠT'
        ),

      useCustomKpi:
        normalizeChecklistKey_(
          r[8]
        ) === 'co',

      kpiBands: [
        {
          from:
            numberOrDefault_(
              r[9],
              98
            ),
          points:
            numberOrDefault_(
              r[10],
              5
            )
        },
        {
          from:
            numberOrDefault_(
              r[11],
              95
            ),
          points:
            numberOrDefault_(
              r[12],
              3
            )
        },
        {
          from:
            numberOrDefault_(
              r[13],
              90
            ),
          points:
            numberOrDefault_(
              r[14],
              0
            )
        },
        {
          from:
            numberOrDefault_(
              r[15],
              85
            ),
          points:
            numberOrDefault_(
              r[16],
              -2
            )
        },
        {
          from:
            numberOrDefault_(
              r[17],
              80
            ),
          points:
            numberOrDefault_(
              r[18],
              -4
            )
        }
      ],

      kpiBelow:
        numberOrDefault_(
          r[19],
          -5
        )
    };
  }

  return null;
}

function saveChecklistPercentConfig(payload) {
  setupChecklistPercentSystem();

  payload =
    payload || {};

  const formCode =
    requireText_(
      payload.formCode,
      'Mã phiếu'
    );

  const a =
    Number(
      payload.thresholdA
    );

  const b =
    Number(
      payload.thresholdB
    );

  const c =
    Number(
      payload.thresholdC
    );

  if (
    !isFinite(a) ||
    !isFinite(b) ||
    !isFinite(c)
  ) {
    throw new Error(
      'Ngưỡng A/B/C phải là số.'
    );
  }

  if (
    !(
      a > b &&
      b > c
    )
  ) {
    throw new Error(
      'Ngưỡng xếp loại phải theo thứ tự A > B > C.'
    );
  }

  if (
    a > 100 ||
    c < 0
  ) {
    throw new Error(
      'Ngưỡng xếp loại phải nằm trong 0–100%.'
    );
  }

  const useCustomKpi =
    !!payload.useCustomKpi;

  const inputBands =
    Array.isArray(
      payload.kpiBands
    )
      ? payload.kpiBands
      : [];

  const defaults = [
    {from:98,points:5},
    {from:95,points:3},
    {from:90,points:0},
    {from:85,points:-2},
    {from:80,points:-4}
  ];

  const bands =
    defaults.map(
      function(def, index) {
        const x =
          inputBands[index] ||
          def;

        return {
          from:
            numberOrDefault_(
              x.from,
              def.from
            ),

          points:
            numberOrDefault_(
              x.points,
              def.points
            )
        };
      }
    );

  if (useCustomKpi) {
    for (
      let i = 0;
      i < bands.length;
      i++
    ) {
      if (
        bands[i].from < 0 ||
        bands[i].from > 100
      ) {
        throw new Error(
          'Ngưỡng KPI phải nằm trong 0–100%.'
        );
      }

      if (
        i > 0 &&
        !(
          bands[i - 1].from >
          bands[i].from
        )
      ) {
        throw new Error(
          'Ngưỡng KPI phải giảm dần từ mức 1 đến mức 5.'
        );
      }
    }
  }

  const ss =
    getAppSpreadsheet_();

  const sh =
    ss.getSheetByName(
      CHECKLIST_PERCENT_CONFIG_SHEET
    );

  const row =
    findChecklistPercentConfigRow_(
      sh,
      formCode
    );

  const values = [[
    formCode,

    a,
    b,
    c,

    String(
      payload.labelA || 'A'
    ).trim() || 'A',

    String(
      payload.labelB || 'B'
    ).trim() || 'B',

    String(
      payload.labelC || 'C'
    ).trim() || 'C',

    String(
      payload.labelBelow ||
      'CHƯA ĐẠT'
    ).trim() ||
    'CHƯA ĐẠT',

    useCustomKpi
      ? 'Có'
      : 'Không',

    bands[0].from,
    bands[0].points,

    bands[1].from,
    bands[1].points,

    bands[2].from,
    bands[2].points,

    bands[3].from,
    bands[3].points,

    bands[4].from,
    bands[4].points,

    numberOrDefault_(
      payload.kpiBelow,
      -5
    ),

    'Hoạt động',
    new Date()
  ]];

  if (row >= 2) {
    sh.getRange(
      row,
      1,
      1,
      22
    ).setValues(
      values
    );
  } else {
    sh.appendRow(
      values[0]
    );
  }

  return {
    success: true,
    formCode:
      formCode,
    message:
      'Đã lưu cấu hình xếp loại theo % cho phiếu ' +
      formCode +
      '.'
  };
}

function findChecklistPercentConfigRow_(
  sheet,
  formCode
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return -1;
  }

  const key =
    normalizeChecklistKey_(
      formCode
    );

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        1
      )
      .getDisplayValues();

  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    if (
      normalizeChecklistKey_(
        values[i][0]
      ) === key
    ) {
      return i + 2;
    }
  }

  return -1;
}

function classifyChecklistRate_(
  rate,
  config
) {
  if (!config) {
    return '';
  }

  rate =
    Number(
      rate
    ) || 0;

  if (
    rate >=
    config.thresholdA
  ) {
    return config.labelA;
  }

  if (
    rate >=
    config.thresholdB
  ) {
    return config.labelB;
  }

  if (
    rate >=
    config.thresholdC
  ) {
    return config.labelC;
  }

  return config.labelBelow;
}

function checklistKpiFromRateWithConfig_(
  rate,
  config
) {
  if (
    !config ||
    !config.useCustomKpi
  ) {
    /*
     * GIỮ NGUYÊN cách tính KPI cũ.
     */
    return checklistScoreFromRate_(
      rate
    );
  }

  const bands =
    (config.kpiBands || [])
      .slice()
      .sort(
        function(a, b) {
          return (
            Number(
              b.from || 0
            ) -
            Number(
              a.from || 0
            )
          );
        }
      );

  for (
    let i = 0;
    i < bands.length;
    i++
  ) {
    if (
      rate >=
      Number(
        bands[i].from || 0
      )
    ) {
      return Number(
        bands[i].points || 0
      );
    }
  }

  return Number(
    config.kpiBelow || 0
  );
}

function numberOrDefault_(
  value,
  fallback
) {
  const n =
    Number(
      value
    );

  return isFinite(n)
    ? n
    : fallback;
}



/**
 * ============================================================
 * V14 - TẠO PHIẾU GIÁM SÁT MỚI TRỰC TIẾP TRÊN WEB APP
 * ============================================================
 *
 * Nguồn dữ liệu:
 * - DM_PHIEU_GIAMSAT
 * - DM_BANGKIEM
 *
 * Nguyên tắc:
 * - Không thay đổi cấu trúc dữ liệu cũ.
 * - Mã phiếu có thể nhập tay hoặc để trống để hệ thống tự sinh.
 * - Một phiếu mới phải có ít nhất 1 tiêu chí.
 * - Ghi phiếu + tiêu chí dưới LockService để tránh 2 người tạo trùng mã.
 * - Nếu ghi tiêu chí lỗi, hệ thống rollback dòng phiếu vừa tạo.
 * ============================================================
 */

/**
 * Gợi ý mã phiếu tiếp theo theo bộ phận.
 * Ví dụ:
 * VỆ SINH MÔI TRƯỜNG -> VSMT-P03
 * DỤNG CỤ            -> DC-P04
 * ĐỒ VẢI             -> DV-P01
 * GIÁM SÁT            -> GS-P01
 */
function suggestChecklistFormCode(department) {
  setupExtensionSheets();

  const formSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER
  );

  return buildNextChecklistFormCode_(
    department,
    formSheet
  );
}

/**
 * Tạo mới 1 phiếu giám sát + toàn bộ tiêu chí.
 */
function createChecklistFormDefinition(payload) {
  setupChecklistPercentSystem();

  payload = payload || {};

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(20000)) {
    throw new Error(
      'Hệ thống đang có người khác cập nhật danh mục phiếu. Vui lòng thử lại sau vài giây.'
    );
  }

  try {
    const formSheet = getRequiredSheet_(
      EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER
    );

    const criterionSheet = getRequiredSheet_(
      EXT_CONFIG.SHEETS.CHECKLIST_MASTER
    );

    const department = requireText_(
      payload.department,
      'Bộ phận'
    );

    const formName = requireText_(
      payload.formName,
      'Tên phiếu giám sát'
    );

    const description = String(
      payload.description || ''
    ).trim();

    let formCode = String(
      payload.formCode || ''
    ).trim().toUpperCase();

    if (!formCode) {
      formCode = buildNextChecklistFormCode_(
        department,
        formSheet
      );
    }

    formCode = normalizeChecklistCode_(
      formCode
    );

    if (!formCode) {
      throw new Error(
        'Mã phiếu không hợp lệ.'
      );
    }

    if (
      checklistFormCodeExists_(
        formSheet,
        formCode
      )
    ) {
      throw new Error(
        'Mã phiếu "' +
        formCode +
        '" đã tồn tại. Hãy chọn mã khác.'
      );
    }

    const criteria = Array.isArray(
      payload.criteria
    )
      ? payload.criteria
      : [];

    if (!criteria.length) {
      throw new Error(
        'Phiếu mới phải có ít nhất 1 tiêu chí.'
      );
    }

    const cleanCriteria = criteria.map(
      function(item, index) {
        item = item || {};

        const content = requireText_(
          item.content,
          'Nội dung tiêu chí số ' +
          (index + 1)
        );

        const group = String(
          item.group || 'Chung'
        ).trim() || 'Chung';

        const detail = String(
          item.detail || content
        ).trim() || content;

        const allowImage =
          String(
            item.allowImage || 'Có'
          )
            .trim()
            .toLowerCase() === 'không'
              ? 'Không'
              : 'Có';

        return {
          order: index + 1,
          group: group,
          content: content,
          detail: detail,
          allowImage: allowImage
        };
      }
    );

    const status = 'Hoạt động';

    const formRow = [
      formCode,
      formName,
      department,
      description ||
        (
          'Phiếu giám sát ' +
          formName
        ),
      cleanCriteria.length,
      status
    ];

    const criterionRows =
      cleanCriteria.map(
        function(item) {
          const id =
            formCode +
            '-' +
            ('0' + item.order)
              .slice(-2);

          return [
            id,
            department,
            item.group,
            item.content,
            'Hoạt động',
            formCode,
            item.order,
            item.detail,
            item.allowImage
          ];
        }
      );

    /*
     * Kiểm tra mã tiêu chí trước khi ghi.
     */
    const existingCriterionIds =
      checklistExistingIds_(
        criterionSheet,
        1
      );

    criterionRows.forEach(
      function(row) {
        if (
          existingCriterionIds[
            normalizeChecklistKey_(
              row[0]
            )
          ]
        ) {
          throw new Error(
            'Mã tiêu chí "' +
            row[0] +
            '" đã tồn tại.'
          );
        }
      }
    );

    let insertedFormRow = 0;

    try {
      formSheet.appendRow(
        formRow
      );

      insertedFormRow =
        formSheet.getLastRow();

      criterionSheet
        .getRange(
          criterionSheet.getLastRow() + 1,
          1,
          criterionRows.length,
          9
        )
        .setValues(
          criterionRows
        );

      /*
       * Cấu hình xếp loại theo %.
       */
      if (
        payload.scoring &&
        payload.scoring.enabled
      ) {
        saveChecklistPercentConfig({
          formCode:
            formCode,

          thresholdA:
            payload.scoring.thresholdA,

          thresholdB:
            payload.scoring.thresholdB,

          thresholdC:
            payload.scoring.thresholdC,

          labelA:
            payload.scoring.labelA,

          labelB:
            payload.scoring.labelB,

          labelC:
            payload.scoring.labelC,

          labelBelow:
            payload.scoring.labelBelow,

          useCustomKpi:
            payload.scoring.useCustomKpi,

          kpiBands:
            payload.scoring.kpiBands,

          kpiBelow:
            payload.scoring.kpiBelow
        });
      }

      SpreadsheetApp.flush();

    } catch (writeError) {
      /*
       * Rollback dòng phiếu nếu phần tiêu chí ghi lỗi.
       */
      if (
        insertedFormRow >= 2 &&
        formSheet.getLastRow() >=
        insertedFormRow
      ) {
        try {
          const codeAtRow =
            String(
              formSheet
                .getRange(
                  insertedFormRow,
                  1
                )
                .getDisplayValue() ||
              ''
            );

          if (
            normalizeChecklistKey_(
              codeAtRow
            ) ===
            normalizeChecklistKey_(
              formCode
            )
          ) {
            formSheet.deleteRow(
              insertedFormRow
            );
          }
        } catch (rollbackError) {}
      }

      throw writeError;
    }

    return {
      success: true,
      formCode: formCode,
      formName: formName,
      department: department,
      criterionCount:
        criterionRows.length,
      message:
        'Đã tạo phiếu "' +
        formName +
        '" (' +
        formCode +
        ') với ' +
        criterionRows.length +
        ' tiêu chí.'
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * ============================================================
 * V17 - ĐỌC / SỬA / SAO CHÉP MẪU PHIẾU CŨ
 * ============================================================
 */
function getChecklistFormDefinitionDetail(formCode) {
  setupChecklistPercentSystem();
  const code=requireText_(formCode,'Mã phiếu');
  const formSheet=getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER);
  const criterionSheet=getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_MASTER);
  const forms=formSheet.getDataRange().getDisplayValues();
  let form=null;

  for(let i=1;i<forms.length;i++){
    if(normalizeChecklistKey_(forms[i][0])===normalizeChecklistKey_(code)){
      form={
        formCode:String(forms[i][0]||''),
        formName:String(forms[i][1]||''),
        department:String(forms[i][2]||''),
        description:String(forms[i][3]||''),
        status:String(forms[i][5]||'Hoạt động')
      };
      break;
    }
  }
  if(!form) throw new Error('Không tìm thấy phiếu "'+code+'".');

  const rows=criterionSheet.getDataRange().getDisplayValues();
  const criteria=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    if(normalizeChecklistKey_(r[5])!==normalizeChecklistKey_(code)) continue;
    criteria.push({
      id:String(r[0]||''),
      group:String(r[2]||''),
      content:String(r[3]||''),
      status:String(r[4]||'Hoạt động'),
      order:Number(r[6])||0,
      detail:String(r[7]||''),
      allowImage:String(r[8]||'Có')
    });
  }
  criteria.sort(function(a,b){return a.order-b.order;});
  form.criteria=criteria;
  form.scoring=getChecklistPercentConfig(code);
  return form;
}

function updateChecklistFormDefinition(payload){
  setupChecklistPercentSystem();
  payload=payload||{};
  const formCode=requireText_(payload.formCode,'Mã phiếu').toUpperCase();
  const department=requireText_(payload.department,'Bộ phận');
  const formName=requireText_(payload.formName,'Tên phiếu giám sát');
  const description=String(payload.description||'').trim();
  const criteria=Array.isArray(payload.criteria)?payload.criteria:[];
  if(!criteria.length) throw new Error('Phiếu phải có ít nhất 1 tiêu chí.');

  const clean=criteria.map(function(item,index){
    item=item||{};
    const content=requireText_(item.content,'Nội dung tiêu chí số '+(index+1));
    return {
      order:index+1,
      group:String(item.group||'Chung').trim()||'Chung',
      content:content,
      detail:String(item.detail||content).trim()||content,
      allowImage:normalizeChecklistKey_(item.allowImage)==='khong'?'Không':'Có'
    };
  });

  const lock=LockService.getDocumentLock();
  if(!lock.tryLock(20000)) throw new Error('Hệ thống đang có người khác cập nhật danh mục. Vui lòng thử lại.');

  try{
    const formSheet=getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER);
    const criterionSheet=getRequiredSheet_(EXT_CONFIG.SHEETS.CHECKLIST_MASTER);
    const fv=formSheet.getDataRange().getDisplayValues();
    let formRow=-1, oldStatus='Hoạt động';

    for(let i=1;i<fv.length;i++){
      if(normalizeChecklistKey_(fv[i][0])===normalizeChecklistKey_(formCode)){
        formRow=i+1;
        oldStatus=String(fv[i][5]||'Hoạt động');
        break;
      }
    }
    if(formRow<2) throw new Error('Không tìm thấy phiếu "'+formCode+'" để sửa.');

    formSheet.getRange(formRow,1,1,6).setValues([[
      formCode,formName,department,
      description||('Phiếu giám sát '+formName),
      clean.length,oldStatus
    ]]);

    const cv=criterionSheet.getDataRange().getDisplayValues();
    for(let i=cv.length-1;i>=1;i--){
      if(normalizeChecklistKey_(cv[i][5])===normalizeChecklistKey_(formCode)){
        criterionSheet.deleteRow(i+1);
      }
    }

    const newRows=clean.map(function(x){
      const id=formCode+'-'+('0'+x.order).slice(-2);
      return [id,department,x.group,x.content,'Hoạt động',formCode,x.order,x.detail,x.allowImage];
    });
    criterionSheet.getRange(criterionSheet.getLastRow()+1,1,newRows.length,9).setValues(newRows);

    if(payload.scoring&&payload.scoring.enabled){
      saveChecklistPercentConfig({
        formCode:formCode,
        thresholdA:payload.scoring.thresholdA,
        thresholdB:payload.scoring.thresholdB,
        thresholdC:payload.scoring.thresholdC,
        labelA:payload.scoring.labelA,
        labelB:payload.scoring.labelB,
        labelC:payload.scoring.labelC,
        labelBelow:payload.scoring.labelBelow,
        useCustomKpi:payload.scoring.useCustomKpi,
        kpiBands:payload.scoring.kpiBands,
        kpiBelow:payload.scoring.kpiBelow
      });
    }

    SpreadsheetApp.flush();
    return {
      success:true,formCode:formCode,formName:formName,department:department,
      message:'Đã cập nhật phiếu '+formCode+' với '+newRows.length+' tiêu chí. Dữ liệu giám sát cũ được giữ nguyên.'
    };
  }finally{
    lock.releaseLock();
  }
}

function copyChecklistFormDefinition(sourceFormCode,newFormCode,newFormName){
  const source=getChecklistFormDefinitionDetail(sourceFormCode);
  return createChecklistFormDefinition({
    formCode:String(newFormCode||'').trim(),
    formName:String(newFormName||(source.formName+' - BẢN SAO')).trim(),
    department:source.department,
    description:source.description,
    criteria:(source.criteria||[]).map(function(x){
      return {group:x.group,content:x.content,detail:x.detail,allowImage:x.allowImage};
    }),
    scoring:source.scoring?{
      enabled:true,
      thresholdA:source.scoring.thresholdA,
      thresholdB:source.scoring.thresholdB,
      thresholdC:source.scoring.thresholdC,
      labelA:source.scoring.labelA,
      labelB:source.scoring.labelB,
      labelC:source.scoring.labelC,
      labelBelow:source.scoring.labelBelow,
      useCustomKpi:source.scoring.useCustomKpi,
      kpiBands:source.scoring.kpiBands,
      kpiBelow:source.scoring.kpiBelow
    }:{enabled:false}
  });
}

/**
 * Danh sách phiếu giám sát hiện có để hiển thị trong màn hình tạo phiếu.
 */
function getChecklistFormDefinitions(filters) {
  setupExtensionSheets();

  filters = filters || {};

  const department = String(
    filters.department || ''
  ).trim();

  const formSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER
  );

  const criterionSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_MASTER
  );

  const forms =
    formSheet
      .getDataRange()
      .getDisplayValues();

  const criteria =
    criterionSheet
      .getDataRange()
      .getDisplayValues();

  const criterionCountMap = {};

  for (
    let i = 1;
    i < criteria.length;
    i++
  ) {
    const r = criteria[i];

    const formCode = String(
      r[5] || ''
    ).trim();

    const status =
      normalizeChecklistKey_(
        r[4]
      );

    if (
      !formCode ||
      status === 'ngung' ||
      status === 'nghi' ||
      status === 'tam ngung'
    ) {
      continue;
    }

    criterionCountMap[
      normalizeChecklistKey_(
        formCode
      )
    ] =
      (
        criterionCountMap[
          normalizeChecklistKey_(
            formCode
          )
        ] ||
        0
      ) + 1;
  }

  const out = [];

  for (
    let i = 1;
    i < forms.length;
    i++
  ) {
    const r = forms[i];

    if (!r[0]) {
      continue;
    }

    if (
      department &&
      normalizeChecklistKey_(
        r[2]
      ) !==
      normalizeChecklistKey_(
        department
      )
    ) {
      continue;
    }

    const code = String(
      r[0] || ''
    ).trim();

    out.push({
      formCode: code,
      formName: String(
        r[1] || ''
      ),
      department: String(
        r[2] || ''
      ),
      description: String(
        r[3] || ''
      ),
      criterionCount:
        criterionCountMap[
          normalizeChecklistKey_(
            code
          )
        ] ||
        Number(
          r[4]
        ) ||
        0,
      status: String(
        r[5] || ''
      )
    });
  }

  out.sort(
    function(a, b) {
      const depCompare =
        String(
          a.department || ''
        ).localeCompare(
          String(
            b.department || ''
          ),
          'vi'
        );

      if (depCompare) {
        return depCompare;
      }

      return String(
        a.formCode || ''
      ).localeCompare(
        String(
          b.formCode || ''
        ),
        'vi'
      );
    }
  );

  return out;
}

/**
 * Đổi trạng thái phiếu Hoạt động / Tạm ngưng.
 * Không xóa dữ liệu lịch sử.
 */
function setChecklistFormDefinitionStatus(
  formCode,
  newStatus
) {
  setupExtensionSheets();

  formCode = requireText_(
    formCode,
    'Mã phiếu'
  );

  const status =
    normalizeChecklistKey_(
      newStatus
    ) === 'hoat dong'
      ? 'Hoạt động'
      : 'Tạm ngưng';

  const formSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER
  );

  const criterionSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_MASTER
  );

  const formRow =
    findChecklistFormRowByCode_(
      formSheet,
      formCode
    );

  if (formRow < 2) {
    throw new Error(
      'Không tìm thấy phiếu "' +
      formCode +
      '".'
    );
  }

  formSheet
    .getRange(
      formRow,
      6
    )
    .setValue(
      status
    );

  /*
   * Đồng bộ trạng thái tiêu chí của phiếu.
   */
  if (
    criterionSheet.getLastRow() >= 2
  ) {
    const values =
      criterionSheet
        .getRange(
          2,
          1,
          criterionSheet.getLastRow() - 1,
          9
        )
        .getValues();

    for (
      let i = 0;
      i < values.length;
      i++
    ) {
      if (
        normalizeChecklistKey_(
          values[i][5]
        ) ===
        normalizeChecklistKey_(
          formCode
        )
      ) {
        criterionSheet
          .getRange(
            i + 2,
            5
          )
          .setValue(
            status
          );
      }
    }
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    formCode: formCode,
    status: status,
    message:
      'Đã chuyển phiếu ' +
      formCode +
      ' sang trạng thái "' +
      status +
      '".'
  };
}


/**
 * ============================================================
 * V17.1 - API ỔN ĐỊNH CHO DANH SÁCH MẪU PHIẾU
 * ============================================================
 * Tách các thao tác Sửa / Sao chép / Tạm ngưng khỏi cơ chế gọi
 * hàm động AppUtil.server(functionName,...).
 *
 * Các wrapper này được KPI/Bảng kiểm gọi tường minh bằng
 * google.script.run.<tên_hàm>().
 * ============================================================
 */

function apiGetChecklistFormDefinitions(filters) {
  return getChecklistFormDefinitions(
    filters || {}
  );
}

function apiGetChecklistFormDefinitionDetail(formCode) {
  return getChecklistFormDefinitionDetail(
    formCode
  );
}

function apiCopyChecklistFormDefinition(
  sourceFormCode,
  newFormCode,
  newFormName
) {
  sourceFormCode =
    requireText_(
      sourceFormCode,
      'Mã phiếu nguồn'
    );

  return copyChecklistFormDefinition(
    sourceFormCode,
    String(newFormCode || '').trim(),
    String(newFormName || '').trim()
  );
}

function apiSetChecklistFormDefinitionStatus(
  formCode,
  newStatus
) {
  const lock =
    LockService.getDocumentLock();

  if (
    !lock.tryLock(
      20000
    )
  ) {
    throw new Error(
      'Hệ thống đang cập nhật danh mục phiếu. Vui lòng thử lại.'
    );
  }

  try {
    return setChecklistFormDefinitionStatus(
      formCode,
      newStatus
    );
  } finally {
    lock.releaseLock();
  }
}

function apiGetChecklistInitialData() {
  return getChecklistInitialData();
}

function apiCreateChecklistFormDefinition(payload) {
  return createChecklistFormDefinition(
    payload || {}
  );
}

function apiUpdateChecklistFormDefinition(payload) {
  return updateChecklistFormDefinition(
    payload || {}
  );
}

/**
 * Debug nhanh phần Tạo phiếu mới.
 */
function debugChecklistCreator() {
  setupChecklistPercentSystem();

  return {
    suggestedVsmt:
      suggestChecklistFormCode(
        'VỆ SINH MÔI TRƯỜNG'
      ),

    suggestedCssd:
      suggestChecklistFormCode(
        'DỤNG CỤ'
      ),

    suggestedLinen:
      suggestChecklistFormCode(
        'ĐỒ VẢI'
      ),

    suggestedMonitor:
      suggestChecklistFormCode(
        'GIÁM SÁT'
      ),

    totalForms:
      getChecklistFormDefinitions({})
        .length
  };
}

/**
 * ============================================================
 * HELPERS RIÊNG - TẠO PHIẾU
 * ============================================================
 */
function buildNextChecklistFormCode_(
  department,
  formSheet
) {
  const prefix =
    checklistDepartmentPrefix_(
      department
    );

  const values =
    formSheet.getLastRow() >= 2
      ? formSheet
          .getRange(
            2,
            1,
            formSheet.getLastRow() - 1,
            1
          )
          .getDisplayValues()
      : [];

  let maxNo = 0;

  values.forEach(
    function(row) {
      const code =
        String(
          row[0] || ''
        )
          .trim()
          .toUpperCase();

      const re =
        new RegExp(
          '^' +
          prefix.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          ) +
          '-P(\\d+)$'
        );

      const m =
        code.match(
          re
        );

      if (m) {
        maxNo =
          Math.max(
            maxNo,
            Number(
              m[1]
            ) ||
            0
          );
      }
    }
  );

  return (
    prefix +
    '-P' +
    String(
      maxNo + 1
    ).padStart(
      2,
      '0'
    )
  );
}

function checklistDepartmentPrefix_(
  department
) {
  const key =
    normalizeChecklistKey_(
      department
    );

  if (
    key ===
    normalizeChecklistKey_(
      'VỆ SINH MÔI TRƯỜNG'
    )
  ) {
    return 'VSMT';
  }

  if (
    key ===
    normalizeChecklistKey_(
      'DỤNG CỤ'
    )
  ) {
    return 'DC';
  }

  if (
    key ===
    normalizeChecklistKey_(
      'ĐỒ VẢI'
    ) ||
    key ===
    normalizeChecklistKey_(
      'ĐỒ VẢI - PHÒNG VIP'
    )
  ) {
    return 'DV';
  }

  if (
    key ===
    normalizeChecklistKey_(
      'GIÁM SÁT'
    )
  ) {
    return 'GS';
  }

  return 'PGS';
}

function normalizeChecklistCode_(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /Đ/g,
      'D'
    )
    .replace(
      /[^A-Z0-9_-]/g,
      '-'
    )
    .replace(
      /-+/g,
      '-'
    )
    .replace(
      /^-|-$/g,
      ''
    );
}

function normalizeChecklistKey_(
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

function checklistFormCodeExists_(
  formSheet,
  formCode
) {
  return (
    findChecklistFormRowByCode_(
      formSheet,
      formCode
    ) >= 2
  );
}

function findChecklistFormRowByCode_(
  formSheet,
  formCode
) {
  if (
    !formSheet ||
    formSheet.getLastRow() < 2
  ) {
    return -1;
  }

  const target =
    normalizeChecklistKey_(
      formCode
    );

  const values =
    formSheet
      .getRange(
        2,
        1,
        formSheet.getLastRow() - 1,
        1
      )
      .getDisplayValues();

  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    if (
      normalizeChecklistKey_(
        values[i][0]
      ) === target
    ) {
      return i + 2;
    }
  }

  return -1;
}

function checklistExistingIds_(
  sheet,
  column
) {
  const map = {};

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return map;
  }

  const values =
    sheet
      .getRange(
        2,
        column,
        sheet.getLastRow() - 1,
        1
      )
      .getDisplayValues();

  values.forEach(
    function(row) {
      const key =
        normalizeChecklistKey_(
          row[0]
        );

      if (key) {
        map[key] = true;
      }
    }
  );

  return map;
}

/**
 * Debug V17.2: chạy trực tiếp trong Apps Script.
 */
function debugChecklistManageApis() {
  setupChecklistPercentSystem();

  return {
    success: true,
    functions: {
      list: typeof apiGetChecklistFormDefinitions === 'function',
      detail: typeof apiGetChecklistFormDefinitionDetail === 'function',
      create: typeof apiCreateChecklistFormDefinition === 'function',
      update: typeof apiUpdateChecklistFormDefinition === 'function',
      copy: typeof apiCopyChecklistFormDefinition === 'function',
      status: typeof apiSetChecklistFormDefinitionStatus === 'function'
    },
    forms: apiGetChecklistFormDefinitions({})
  };
}

/**
 * ============================================================
 * V17.3 - MỘT API DUY NHẤT CHO QUẢN LÝ MẪU PHIẾU
 * ============================================================
 * Mục tiêu:
 * - Sửa
 * - Lưu thay đổi
 * - Sao chép
 * - Tạm ngưng / Kích hoạt
 * - Làm mới danh sách
 *
 * HTML chỉ gọi DUY NHẤT:
 * google.script.run.apiChecklistManager(action, payload)
 *
 * Không còn runner[functionName].
 * Không phụ thuộc AppUtil.server() cho nhóm chức năng này.
 * ============================================================
 */
function apiChecklistManager(action, payload) {
  action =
    String(
      action || ''
    )
      .trim()
      .toUpperCase();

  payload =
    payload || {};

  switch (action) {

    case 'PING':
      return {
        success: true,
        version: 'V17.3',
        message: 'Checklist Manager API hoạt động.'
      };

    case 'LIST':
      return {
        success: true,
        rows:
          getChecklistFormDefinitions(
            payload.filters || {}
          )
      };

    case 'DETAIL':
      return {
        success: true,
        data:
          getChecklistFormDefinitionDetail(
            payload.formCode
          )
      };

    case 'EDIT_DATA':
      return {
        success: true,
        data:
          getChecklistFormEditDataV174(
            payload.formCode
          )
      };

    case 'HEALTH':
      return {
        success: true,
        data: {
          version: 'V17.4',
          spreadsheetId:
            getAppSpreadsheet_().getId(),
          formSheet:
            EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER,
          criterionSheet:
            EXT_CONFIG.SHEETS.CHECKLIST_MASTER,
          configSheet:
            CHECKLIST_PERCENT_CONFIG_SHEET
        }
      };

    case 'INITIAL_DATA':
      return {
        success: true,
        data:
          getChecklistInitialData()
      };

    case 'CREATE':
      return {
        success: true,
        data:
          createChecklistFormDefinition(
            payload.data || {}
          )
      };

    case 'UPDATE':
      return {
        success: true,
        data:
          updateChecklistFormDefinition(
            payload.data || {}
          )
      };

    case 'COPY':
      return {
        success: true,
        data:
          copyChecklistFormDefinition(
            payload.sourceFormCode,
            payload.newFormCode || '',
            payload.newFormName || ''
          )
      };

    case 'SET_STATUS':
      return {
        success: true,
        data:
          setChecklistFormDefinitionStatus(
            payload.formCode,
            payload.newStatus
          )
      };

    default:
      throw new Error(
        'Checklist Manager không nhận dạng thao tác: ' +
        action
      );
  }
}

/**
 * Chạy trực tiếp trong Apps Script để kiểm tra V17.3.
 */
function debugChecklistManagerV173() {
  setupChecklistPercentSystem();

  var ping =
    apiChecklistManager(
      'PING',
      {}
    );

  var list =
    apiChecklistManager(
      'LIST',
      {}
    );

  return {
    success: true,
    ping: ping,
    formCount:
      (
        list &&
        list.rows
      )
        ? list.rows.length
        : 0,
    spreadsheetId:
      getAppSpreadsheet_().getId()
  };
}

/**
 * ============================================================
 * V17.4 - CHI TIẾT PHIẾU CHO MODAL SỬA ĐỘC LẬP
 * ============================================================
 */
function getChecklistFormEditDataV174(formCode) {
  setupChecklistPercentSystem();

  var data =
    getChecklistFormDefinitionDetail(
      formCode
    );

  if (!data) {
    throw new Error(
      'Không lấy được dữ liệu phiếu ' +
      formCode +
      '.'
    );
  }

  return {
    formCode:
      String(
        data.formCode || ''
      ),

    formName:
      String(
        data.formName || ''
      ),

    department:
      String(
        data.department || ''
      ),

    description:
      String(
        data.description || ''
      ),

    status:
      String(
        data.status || ''
      ),

    criteria:
      Array.isArray(
        data.criteria
      )
        ? data.criteria
        : [],

    scoring:
      data.scoring || null
  };
}

/**
 * ============================================================
 * V19 - API SỬA PHIẾU TRÊN KHUNG TẠO/SỬA PHÍA TRÊN
 * ============================================================
 * Mục tiêu:
 * - Nút SỬA lấy đúng mẫu cũ.
 * - HTML nạp mẫu vào bk-new-* và bk-new-criteria-body.
 * - Mã phiếu khóa khi sửa.
 * - Không xóa lịch sử PHIEU_GIAMSAT / CT_PHIEU_GIAMSAT.
 */
function apiLoadChecklistIntoEditorV19(formCode) {
  const code = requireText_(formCode, 'Mã phiếu').trim().toUpperCase();

  /*
   * Đọc dữ liệu chính trước.
   * Nếu cấu hình % có vấn đề, vẫn cho phép mở phiếu để sửa.
   */
  const formSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_FORMS_MASTER
  );

  const criterionSheet = getRequiredSheet_(
    EXT_CONFIG.SHEETS.CHECKLIST_MASTER
  );

  const forms = formSheet.getDataRange().getDisplayValues();

  let form = null;

  for (let i = 1; i < forms.length; i++) {
    if (
      normalizeChecklistKey_(forms[i][0]) ===
      normalizeChecklistKey_(code)
    ) {
      form = {
        formCode: String(forms[i][0] || ''),
        formName: String(forms[i][1] || ''),
        department: String(forms[i][2] || ''),
        description: String(forms[i][3] || ''),
        status: String(forms[i][5] || 'Hoạt động')
      };
      break;
    }
  }

  if (!form) {
    throw new Error(
      'Không tìm thấy phiếu "' + code +
      '" trong DM_PHIEU_GIAMSAT.'
    );
  }

  const rows = criterionSheet.getDataRange().getDisplayValues();
  const criteria = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];

    if (
      normalizeChecklistKey_(r[5]) !==
      normalizeChecklistKey_(code)
    ) {
      continue;
    }

    criteria.push({
      id: String(r[0] || ''),
      group: String(r[2] || ''),
      content: String(r[3] || ''),
      status: String(r[4] || 'Hoạt động'),
      order: Number(r[6]) || 0,
      detail: String(r[7] || ''),
      allowImage: String(r[8] || 'Có')
    });
  }

  criteria.sort(function(a, b) {
    return Number(a.order || 0) - Number(b.order || 0);
  });

  let scoring = null;

  try {
    scoring = getChecklistPercentConfig(code);
  } catch (e) {
    scoring = null;
  }

  return {
    success: true,
    version: 'V19',
    formCode: form.formCode,
    formName: form.formName,
    department: form.department,
    description: form.description,
    status: form.status,
    criteria: criteria,
    scoring: scoring
  };
}

/**
 * Lưu sửa bằng logic cũ đã có.
 */
function apiSaveChecklistFromEditorV19(payload) {
  return updateChecklistFormDefinition(payload || {});
}

/**
 * Debug:
 * chạy debugChecklistEditorV19('DC-P01')
 */
function debugChecklistEditorV19(formCode) {
  const x = apiLoadChecklistIntoEditorV19(
    formCode || 'DC-P01'
  );

  return {
    success: true,
    version: x.version,
    formCode: x.formCode,
    formName: x.formName,
    department: x.department,
    criteriaCount: (x.criteria || []).length,
    scoringLoaded: !!x.scoring
  };
}
