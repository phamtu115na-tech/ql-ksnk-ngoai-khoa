# Kết quả kiểm tra ngày 20/11/2026

Kho nguồn phamtu115na-tech/ql-ksnk-ngoai-khoa, nhánh main, commit a8fa617655ef55664c326b49ee6fca3d44c66350. Vercel báo bản Production của dự án ql-ksnk-ngoai-khoa-pkdu dùng cùng commit và ở trạng thái READY. API health của bản đang chạy trả HTTP 200, supabaseDatabaseReachable=true và settingsRowFound=true.

Bản phân phối mới đã build Next.js Production với Node.js 24. Quy trình kiểm tra dùng dữ liệu giả, PostgreSQL nhúng PGlite, bộ mô phỏng giao thức Supabase REST/Storage và trình duyệt Chromium. Không sử dụng dữ liệu bệnh viện để kiểm thử.

| Luồng đã chạy | Kết quả |
|---|---|
| Chạy CAI_DAT.sql trên cơ sở dữ liệu trống rồi chạy lại | Thành công cả hai lần |
| Quyền gọi trực tiếp hàm ghi tin của anon và authenticated | Bị từ chối |
| Khởi tạo admin, cấp tài khoản hai viện, chọn sai đơn vị | Đăng nhập đúng đơn vị thành công, sai đơn vị bị từ chối |
| Người cùng viện ngoài việc, người khác viện, tin nhắn riêng | Quyền danh sách và quyền mở nội dung được kiểm tra riêng |
| Tin gửi lại cùng mã, đánh dấu đã đọc, xác nhận đã nhận | Không trùng tin, số chưa đọc giảm, sự kiện trạng thái có người gửi |
| Đính kèm và xin URL xem ảnh | Thành viên nhận URL; người ngoài bị từ chối trong mô phỏng Storage |
| Sửa việc với phiên bản cũ, khóa tài khoản đang có phiên | Từ chối ghi đè và từ chối phiên đã bị thu hồi |
| Trình duyệt máy tính và khung nhìn điện thoại | Đăng nhập, tạo giao việc, gửi tin, đổi thẻ chi tiết/chat, mở rộng, bảng 8 cột và danh sách thành công |
| Kiểm thử có sẵn về minh chứng của phân hệ nghiệp vụ | Đạt |

Bản ZIP chưa được triển khai lên một dự án Vercel và Supabase mới trong tài khoản bệnh viện. Sau khi cài, làm mục 6 trong BAT_DAU.html, gồm thử tệp thực trên Storage và kiểm tra bằng hai thiết bị.

## Bản bổ sung liên kết nhân sự

Đã thử SQL nâng cấp tại chỗ trên dữ liệu mẫu, chạy hai lần và đối chiếu toàn bộ bản ghi nguồn trước/sau. Đã kiểm tra mã NV ưu tiên hơn tên, hai người cùng tên khác mã, hai đơn vị có cùng mã, nhắc nhiều người, đổi tên giữ liên kết và quản trị xác nhận thủ công. Kiểm thử trình duyệt đã mở danh mục nguồn, cấp tài khoản từ tên có sẵn, đăng nhập và truy vấn đúng nhắc việc cũ. Build Production, bài thử giao việc, chat, phân quyền và hiển thị điện thoại đã đạt. Dữ liệu bệnh viện thực tế chưa dùng để thử.
