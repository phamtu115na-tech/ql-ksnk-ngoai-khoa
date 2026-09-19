# Rà soát workbook KSNK cũ

Workbook có 25 sheet. Các bảng dữ liệu chính và kích thước tại thời điểm rà soát:
- DM_NHANVIEN: 497 x 6
- DM_LOI: 60 x 7
- THEODOI_VIPHAM: 220 x 12
- GIAO VIỆC: 982 x 13
- DM_PHIEU_GIAMSAT: 6 x 6
- DM_BANGKIEM: 997 x 9
- PHIEU_GIAMSAT: 988 x 22
- CT_PHIEU_GIAMSAT: 1740 x 10
- KE_HOACH_TUAN: 988 x 15
- KE_HOACH_THANG: 998 x 15
- TON_TAI_KIEN_NGHI: 1000 x 14
- KPI_100_DIEM: 220 x 14
- BANG_KE_QUA_GIAO_VIEC: 60 x 13
- NHAC_VIEC_GHI_CHU: 29 x 8

Nguyên tắc: giữ nguyên tên sheet, tên cột, mã nghiệp vụ và dữ liệu cũ khi migration. Runtime Vercel không phụ thuộc Google Apps Script; dữ liệu được nhập sang Supabase.
