# Giao việc, nhắc việc và trao đổi giữa hai màn hình

Trong CONNECT, chọn **Giao việc** hoặc **Nhắc việc**, chọn **Mở** trên việc của mình. Trong **Hệ thống nghiệp vụ KSNK Ngoại khoa**, mở phiếu giao việc đã lưu, hoặc chọn **Xem chi tiết** trên một nhắc việc rồi chọn **Trao đổi về việc này**. Tin nhắn, ảnh, tài liệu và trạng thái đọc dùng chung mã cuộc trò chuyện. Chỉ thành viên được mở nội dung trò chuyện. Phiếu mới cần được lưu để có mã việc.

Sổ Ngoại khoa và CONNECT cùng cập nhật tiêu đề, hạn, nội dung và trạng thái. Việc tạo trong CONNECT có đơn vị Ngoại khoa được ghi vào sổ Ngoại khoa. Việc chỉ thuộc Đa khoa hoặc Tổng công ty ở trong phạm vi đơn vị đã chọn. Quy trình phê duyệt, đánh giá quản lý và minh chứng gốc của sổ tiếp tục thao tác trong phần nghiệp vụ. Khi xem việc cũ, nhắc việc sử dụng trường Người liên quan để xác định thành viên.

Quản trị viên vào **Nhân viên → Danh mục nhân viên hiện tại**, chọn hồ sơ, đặt tên đăng nhập và mã riêng. Người chưa được cấp mã có thể nhận việc theo hồ sơ. Sau khi tài khoản được kích hoạt, họ đăng nhập để xem việc và trò chuyện. Chọn “Đối chiếu tự động” và kiểm tra danh sách cần xác nhận khi nhập thêm danh mục trùng tên.

## Cài đặt và nhân bản

1. Với hệ thống đã cài bản liên kết nhân viên, sao lưu cơ sở dữ liệu, mở Supabase → SQL Editor, chạy một lần nội dung `supabase/cong_viec_chung.sql`. Với dự án mới, chạy `supabase/CAI_DAT.sql` và làm theo README.
2. Đưa mã nguồn tương ứng lên GitHub và triển khai đúng nhánh trong Vercel. Giữ cấu hình môi trường hiện có. Bản này không thêm biến môi trường. Dự án nhân bản dùng URL và khóa máy chủ của dự án Supabase riêng theo `.env.example`.
3. Kiểm tra bằng hai tài khoản cùng tham gia một việc. Gửi tin ở phiếu Ngoại khoa rồi mở đúng việc ở CONNECT, trả lời và kiểm tra cả hai phía. Dùng một tài khoản ngoài việc để kiểm tra quyền truy cập.
