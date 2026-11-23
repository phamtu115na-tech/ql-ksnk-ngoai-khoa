# Hướng dẫn triển khai ma trận phân quyền KSNK (23/11/2026)

## Phạm vi
- Tại **Quản trị nhân viên**, bấm **MA TRẬN CẤP QUYỀN**. Có tìm kiếm theo họ tên, mã nhân viên, tên đăng nhập và bộ phận.
- Chọn người dùng; mỗi phân hệ có quyền **Xem / Thêm / Sửa / Xóa / Lịch sử / Xuất** (tùy nghiệp vụ). Mỗi ô lựa chọn **Không / Cá nhân / Toàn tổ / Toàn khoa**.
- Quản trị viên được quản lý cấu hình; quyền không được mở rộng quá chức danh đang xác minh (tổ trưởng không thể nhận phạm vi toàn khoa).
- Phiếu giám sát đã chấm: tổ trưởng được thêm, sửa, xóa, xem lịch sử trong tổ được phân công; không xóa phiếu ngoài bộ phận. Phiếu đã xóa được xử lý cùng chi tiết và liên kết minh chứng.
- Mẫu phiếu và tiêu chí: giới hạn các thao tác chỉnh sửa trong tổ theo bản ghi và bộ phận. Cấu hình KPI của mẫu cần liên kết về đúng bộ phận.
- Báo cáo: trưởng khoa, điều dưỡng trưởng và tổ trưởng có thể xuất Excel/PPTX theo phạm vi; nhân viên chỉ được xuất khi cấp quyền.
- Lịch sử cấp quyền lưu tài khoản thực hiện, trước/sau và thời gian; xung đột cập nhật được chặn bằng version.

## Các bước áp dụng an toàn
1. Sao lưu cơ sở dữ liệu, kiểm tra hiện đã có các migration `20261121_quyen_bao_cao.sql` và `20261121_phieu_giam_sat.sql`. **Không chạy migration trên dữ liệu Production khi chưa nghiệm thu trên bản sao.**
2. Áp dụng `supabase/20261123_ma_tran_cap_quyen_dong.sql` trên môi trường thử nghiệm có dữ liệu độc lập.
3. Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` bằng mã nhánh `feature/hoan-thien-pptx-quyen-20261123`.
4. Kiểm tra tài khoản **nhân viên**, **tổ trưởng VSMT**, **tổ trưởng đồ vải**, **điều dưỡng trưởng** và **trưởng khoa**. Thử lập/sửa/xóa phiếu đúng tổ và cố ý thay `row_no` sang phiếu tổ khác; yêu cầu trả 403. Kiểm tra chuyển vai trò xuống cấp thấp không giữ quyền cao.
5. Xuất Excel và PowerPoint của toàn khoa, một tổ, một cá nhân. So khớp số liệu và đảm bảo không xuất dữ liệu ngoài phạm vi. Mở tệp PPTX bằng PowerPoint để kiểm tra dấu tiếng Việt, tỷ lệ 16:9 và slide tràn.
6. Chỉ khi toàn bộ kiểm thử thành công mới duyệt PR và lên lịch áp dụng SQL trên Production. Preview Vercel có thể dùng chung Supabase với Production: **không thao tác thử tạo/xóa hồ sơ thật trên Preview**.

## Nguyên tắc bảo mật
- Tất cả thao tác ghi và xuất được máy chủ kiểm soát bằng `featureScope`; giá trị người dùng gửi từ trình duyệt không quyết định quyền.
- Dữ liệu quyền đã lưu được tự giới hạn theo chức danh hiện tại và phạm vi xem. Nút ẩn trên giao diện không phải cơ chế bảo mật.
- Phiếu giám sát và dữ liệu liên quan đến bệnh nhân/nhân viên phải được thử trên dữ liệu giả lập hoặc bản sao.
- Cần rà soát riêng quyền `Phê duyệt` với danh sách người duyệt được chỉ định; không sử dụng quyền cấp trên ma trận để thay thế cơ chế phê duyệt hiện có.
