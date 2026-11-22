# Kiểm tra bản thử KSNK Ngoại khoa
Mở Preview của PR #11 và đăng nhập bằng tài khoản Ngoại khoa. Trang chủ hiển thị các cuộc trao đổi chưa đọc, mới nhất trước. Hai ô trên thanh tiêu đề đếm số tác vụ có tin mới. Chọn tên việc để mở nội dung cùng cuộc trò chuyện. Nút Trao đổi góc phải mở tin riêng. Nút Đăng xuất ở thanh tiêu đề.

Trong Cài đặt → Tên bộ phận, đối chiếu danh sách đang sử dụng với danh sách cũ. Tên đang dùng phải có chữ KSNK. Tên cũ vẫn tra được để đối chiếu nhân sự và lịch sử.

## Triển khai và nghiệm thu
1. Dùng nhánh feature của PR #11 với môi trường Preview. Để thử ghi, cấu hình Preview với một Supabase thử nghiệm có cấu trúc và dữ liệu đã ẩn danh giống hệ thống hiện hành. Xác minh đích kết nối trước khi chạy SQL.
2. Trên bản sao, sao lưu cơ sở dữ liệu và áp dụng lần lượt các tập lệnh trong thư mục supabase mang tên 20261121_quyen_bao_cao.sql, 20261121_phe_duyet_tac_vu.sql và 20261121_phieu_giam_sat.sql. Kiểm tra kết quả từng giao dịch.
3. Chạy npm ci, npm test, npm run typecheck, npm run lint và npm run build. Tạo Preview với cấu hình thử nghiệm.
4. Dùng hai tài khoản thử. Gửi tin giao việc và tin nhắc việc, kiểm tra số việc chưa đọc của người nhận, mở từng dòng trên Trang chủ, kiểm tra tiêu đề, người gửi và nội dung. Xác minh người ngoài việc không thấy tin. Kiểm tra ở cả điện thoại và máy tính.
5. Với tài khoản được phân quyền, thử tạo, sửa và xem lịch sử phiếu, xin duyệt rồi phê duyệt tác vụ. Đối chiếu số đạt, không đạt và mẫu số với các lượt giám sát đã biết. Kiểm tra file xuất và quyền của tổ trưởng, nhân viên.
6. Với từng nguồn Sheets, nhập ID bảng và tên trang tính đúng của bộ phận, cấp quyền đọc cho tài khoản dịch vụ đã cấu hình rồi đối chiếu số liệu từng kỳ.
7. Chỉ đưa bản đã nghiệm thu lên môi trường chính thức sau phê duyệt. Nếu cần khôi phục giao diện, chọn bản Production trước trong Vercel. Việc khôi phục dữ liệu cần bản sao lưu riêng.

## Quyền của tổ trưởng
Trong Quản trị nhân viên, chọn vai trò Tổ trưởng, chọn bộ phận phụ trách rồi bật quyền xem và sửa. Tổ trưởng mở tác vụ trực tiếp từ Giao việc hoặc Nhắc việc. Phiếu giám sát chuyên môn nằm trong Bảng kiểm giám sát. Tổ trưởng xem lịch sử và sửa lượt chấm của tất cả nhân viên thuộc bộ phận mình. Trưởng khoa và Điều dưỡng trưởng có phạm vi toàn khoa. Khi nghiệm thu, dùng hai tổ có nhân viên khác nhau và một phiếu do người khác lập trong cùng tổ.

Áp dụng thêm 20261122_quyen_nguoi_lap.sql sau ba tập lệnh ngày 21/11. Người lập có thể mở, chỉnh sửa và xin phê duyệt ngay trong tác vụ của mình. Khi cần bổ sung, mở cùng tác vụ để sửa rồi gửi lại. Kiểm tra bằng tài khoản người lập đã tắt quyền sửa chung và một tài khoản quản lý khác được chọn để duyệt.
