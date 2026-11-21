export const teamRecords={
 plans:{sheets:['KE_HOACH_TUAN','KE_HOACH_THANG','TON_TAI_KIEN_NGHI'],read:['Nội dung','Người phụ trách','Từ ngày','Đến ngày','Trạng thái','Tồn tại / Sự cố / Kiến nghị'],edit:['Nội dung / Mô tả','Kết quả','Ghi chú']},
 violations:{sheets:['THEODOI_VIPHAM'],read:['Họ tên','Tên lỗi','Ngày vi phạm','Mức độ','Trạng thái'],edit:['Ghi chú']},
 checklists:{sheets:['PHIEU_GIAMSAT'],read:['Tên phiếu','Họ tên','Ngày giám sát','Người giám sát','Tỷ lệ %'],edit:['Ghi chú']},
 reports:{sheets:['Y_KIEN_BAO_CAO'],read:['Nhân viên','Từ ngày','Đến ngày','Trạng thái'],edit:['Ý kiến khắc phục của tổ trưởng']},
 kpi:{sheets:['KPI_100_DIEM','Y_KIEN_KPI'],read:['Họ tên','Nhân viên','Từ ngày','Đến ngày','Tổng điểm','Xếp loại'],edit:['Ghi chú']},
 staff:{sheets:['DM_NHANVIEN'],read:['Mã NV','Họ và tên','Chức vụ','Trạng thái'],edit:['Ghi chú']}
};
export type TeamModule=keyof typeof teamRecords;
