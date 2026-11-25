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

## Cập nhật giao diện ma trận cấp quyền (24/11/2026)
- Các ô thao tác hỗ trợ nghiệp vụ cho chọn **Không cho phép** hoặc **Cho phép · Cá nhân/Toàn tổ/Toàn khoa**. `Không cho phép` được lưu dưới phạm vi `none` (thu hồi thực sự), không chỉ ẩn nút.
- Các ô không có chức năng thực tế ghi **Không áp dụng**, thay vì gạch ngang gây hiểu nhầm.
- Bảng chia 3 nhóm: **Công việc và nhắc việc**, **Nghiệp vụ KSNK**, **Nhân sự, báo cáo và đánh giá**.
- Đổi nền tiêu đề tối, chữ trắng rõ; tiêu đề hàng có chữ xanh đậm trên nền nhạt. Có nút mở ma trận **toàn màn hình** và hỗ trợ cuộn ngang trên điện thoại.
- Quyền **Xuất Excel/PPT** nằm ở **Báo cáo tổng hợp**, phạm vi luôn giới hạn theo quyền Xem. Các nút xuất dữ liệu cụ thể phải kiểm tra API.
- Quyền **Phê duyệt** được cấp riêng, nhưng chỉ có hiệu lực nếu tài khoản được đánh dấu làm người phê duyệt và được chỉ định duyệt tác vụ.
- Quyền **Lịch sử** đã hỗ trợ phiếu giám sát, giao việc, nhắc việc; quyền truy cập được kiểm tra tại API. Không áp dụng cho phân hệ chưa có lịch sử riêng.
- Không cho xóa mẫu phiếu đang được sử dụng trong lịch sử chấm hoặc có tiêu chí liên kết; thay bằng Tạm ngưng.
- Khôi phục mặc định cập nhật bản xem trước ngay và có thể lưu để xóa quyền ghi đè cũ.

**Lưu ý nghiệm thu:** chạy typecheck/lint/test/build của đúng commit trước khi phát hành. Kiểm tra API bằng tài khoản thật hoặc tài khoản kiểm thử an toàn; không dùng phiếu bệnh viện để thử xóa. Hệ thống Production và Preview chia sẻ cấu hình Supabase, do đó tuyệt đối tránh ghi dữ liệu mẫu vào dữ liệu thật.

## Quy tắc cấp quyền theo chức vụ (24/11/2026)
- Truy cập Quản trị viên → Ma trận cấp quyền → **Quy tắc quyền theo chức vụ**.
- Có ba nhóm chức danh: Nhân viên; Tổ trưởng; Trưởng khoa / Điều dưỡng trưởng. Thay đổi từng quyền Xem, Thêm, Sửa, Xóa, Lịch sử, Xuất bằng Không cho phép, Cá nhân, Toàn tổ hoặc Toàn khoa.
- Quyền mặc định có thể chọn **Mặc định** để kế thừa bộ quy tắc gốc; khi thay đổi chọn phạm vi và **LƯU QUY TẮC CHỨC VỤ**.
- Quyền cấp riêng cho tài khoản có mức ưu tiên cao hơn quyền mặc định theo chức vụ. Tài khoản Nhân viên có thể được ủy quyền phạm vi Toàn tổ hoặc Toàn khoa *theo đúng chức năng được cấp*, không tự nhận vai trò quản lý toàn hệ thống.
- Quyền Phê duyệt luôn là ngoại lệ, chỉ dành cho tài khoản quản lý được chỉ định; không có ô phê duyệt mặc định cho cả chức vụ.
- Các bản ghi quyền và lịch sử thay đổi dùng SQL `20261124_quy_tac_quyen_theo_chuc_vu.sql`; giới hạn báo cáo và luồng giao/nhắc việc được đồng bộ bởi các migration `20261124_bao_cao_quyen_uy_quyen.sql` và `20261124_uy_quyen_giao_viec_theo_ma_tran.sql`.
- Ma trận cấp quyền mở **một trang ngang cấp Quản trị nhân viên**, không còn nhúng phía cuối danh sách nhân viên.

**Trình tự phát hành:** Áp dụng các migration theo thứ tự trên vào môi trường được kiểm tra, chạy bộ test SQL và kiểm tra Production Vercel ở chính commit đã kiểm thử; tuyệt đối không đổi dữ liệu/chứng từ thật để thử quyền.
