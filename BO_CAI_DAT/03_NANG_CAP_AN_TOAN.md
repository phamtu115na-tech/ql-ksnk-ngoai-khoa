# CHỌN BẢN ỔN ĐỊNH HAY BẢN PR #13?

01_BAN_ON_DINH_PRODUCTION là bản cài đặt mặc định cho người mới. Có file supabase/CAI_DAT.sql để khởi tạo CSDL mới, không được tự động ghi dữ liệu vào CSDL cũ.

02_BAN_MO_RONG_PR13_THU_NGHIEM chứa các cải tiến phân quyền động, các migration SQL ngày 21–24/11/2026, các chức năng giao việc, cảnh báo, báo cáo, xuất PowerPoint. PR #13 trên GitHub đang là DRAFT, chưa nghiệm thu đầy đủ migration trên Production. KHÔNG đưa bản PR #13 vào dữ liệu thật khi chưa kiểm thử.

## Nâng cấp từ phiên bản đã chạy
1. Sao lưu CSDL và thử phục hồi trên Supabase riêng.
2. Đọc NANG_CAP_TAI_CHO.md và supabase/NANG_CAP_TAI_CHO.sql ở bản mã tương ứng.
3. Đối chiếu lược đồ hiện tại và migration đã áp dụng, KHÔNG tự chạy trọn bộ CAI_DAT.sql và NANG_CAP_TAI_CHO.sql chồng lên cùng dữ liệu.
4. Với PR #13, đọc docs/MA_TRAN_CAP_QUYEN_20261123.md và những SQL liên quan: 20261123_ma_tran_cap_quyen_dong.sql, 20261124_quy_tac_quyen_theo_chuc_vu.sql, 20261124_bao_cao_quyen_uy_quyen.sql, 20261124_uy_quyen_giao_viec_theo_ma_tran.sql, các migration liên quan khác.
5. Chạy từng SQL theo thứ tự phụ thuộc đã kiểm tra; dừng và khôi phục backup nếu lỗi.
6. Kiểm thử vai trò Nhân viên, Tổ trưởng, Điều dưỡng trưởng, Trưởng khoa; API phải ngăn thao tác ngoài quyền dù thay đổi dữ liệu gửi từ trình duyệt.
7. Kiểm thử danh sách phiếu, đính kèm, tin nhắn, Excel/PPTX trên dữ liệu giả. Chỉ phát hành thật sau khi nghiệm thu và có người chịu trách nhiệm.

Gói này không chứa dữ liệu khách hàng/nhân viên, không tạo admin cứng, không chứa SQL chỉnh sửa dữ liệu Production đã chạy.