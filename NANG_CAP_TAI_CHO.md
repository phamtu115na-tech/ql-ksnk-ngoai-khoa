# Nâng cấp phần mềm KSNK Ngoại khoa
1. Sao lưu Supabase và kiểm tra bản sao. Thư mục gốc chứa package.json là thư mục dự án.
2. Đối với cơ sở dữ liệu KSNK đang dùng, chạy supabase/NANG_CAP_TAI_CHO.sql. Với cơ sở dữ liệu mới, chạy supabase/CAI_DAT.sql.
3. Triển khai cùng bản mã nguồn trên GitHub và Vercel. Bản nâng cấp dùng lại cấu hình Supabase và mật khẩu admin hiện có.
4. Đăng nhập bằng đơn vị Ngoại khoa. Quản trị mở Quản trị nhân viên để cấp tài khoản từ hồ sơ hiện tại. Nhân viên mở Nhắc việc để đọc tin và trả lời.
5. Hướng dẫn điền từng biến khi tạo bản sao, thao tác trên GitHub, Supabase và Vercel nằm trong BAT_DAU.html.

## Bảng Giao việc & Nhắc việc hợp nhất

Sau khi triển khai mã nguồn và chạy tệp `supabase/nguoi_tao_phieu.sql` trên dự án Ngoại khoa đã cài bản trước, đăng nhập và mở **Giao việc & Nhắc việc**. Nhân viên thấy phiếu mình tạo, thực hiện hoặc được đưa vào theo dõi. Quản trị viên và tài khoản được cấp quyền quản lý nghiệp vụ thấy tiến độ của toàn viện. Thành viên của từng phiếu có thể trao đổi trong phiếu. Khi mở biểu mẫu chi tiết trên máy tính, phần trao đổi nằm bên phải. Trên điện thoại chọn **Phiếu** hoặc **Trò chuyện**.

Bản nâng cấp này dùng cấu hình kết nối và mật khẩu quản trị đang sử dụng. Kiểm tra bằng hai tài khoản nhân viên khác nhau và một tài khoản quản lý. Tạo một phiếu thử cho nhân viên thứ nhất, mở bằng tài khoản đó, gửi tin rồi kiểm tra tài khoản thứ hai và bảng toàn viện của quản lý.

### Trao đổi trực tiếp trong KSNK

Sau khi đăng nhập, mở **Trang chủ** để xem việc cần xử lý. Trong menu **Giao việc & Nhắc việc**, chọn **Giao việc** hoặc **Nhắc việc & Ghi chú**. Từng tác vụ hiển thị tin gần nhất và số tin chưa đọc của chính tài khoản. Bấm **Trao đổi** ngay tại công việc hoặc nhắc việc để đọc lịch sử, gửi tin hoặc xác nhận đã nhận trong màn hình tác vụ. Người giao có thể chọn nhiều nhân viên. Trên bảng thời hạn, nút trao đổi nằm bên dưới từng thẻ. Trên máy tính, khung nội dung, tiến độ và trò chuyện nằm bên phải bảng. Nhân viên bấm **Cập nhật tác vụ** để sửa nội dung cá nhân. Quản lý có thể tạo, sửa ngay trong màn hình Giao việc hoặc Nhắc việc. Dữ liệu phiếu và tin nhắn dùng các bảng hiện có.

## Phân quyền trưởng khoa, tổ trưởng và nhân viên

Chạy `supabase/phan_quyen_to.sql` một lần khi nâng từ PR 8, sau đó triển khai mã nguồn. Trong **Quản trị nhân viên → Sửa / cấp lại mã**, chọn vai trò, chọn đúng bộ phận cho tổ trưởng và tích **Được xem**, **Được sửa**. Khi bỏ quyền xem, giao diện cũng bỏ quyền sửa. Nhân viên có quyền sửa được cập nhật ghi chú riêng và tiến độ trên phiếu mình thực hiện. Người tạo và quản lý đúng phạm vi có thể chỉnh nội dung chung. Tổ trưởng mở các phân hệ của tổ trên menu, các trường nội dung được phép chỉnh có nút Sửa.

Phiếu giao việc có bộ phận ghi rõ dùng bộ phận trên phiếu. Nếu phiếu chưa ghi bộ phận, hệ thống chỉ xếp vào tổ khi toàn bộ người thực hiện cùng thuộc tổ đó. Tin nhắn trực tiếp thuộc riêng người tham gia. Các tài khoản quản lý cũ cần được đối chiếu vai trò theo danh mục thực tế. Khi quản trị viên lưu vai trò quản lý, tài khoản được đọc trao đổi công việc trong phạm vi đã cấp, kể cả phiếu trước đó.
