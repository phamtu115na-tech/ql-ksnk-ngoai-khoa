# BẢNG KIỂM ĐỂ ĐƯA PHẦN MỀM VÀO SỬ DỤNG
- [ ] Node.js 24.x, npm ci hoàn tất
- [ ] Chạy npm run typecheck, npm run lint, npm test, npm run build đều thành công
- [ ] SQL cài đặt chạy trên Supabase mới; có cx_people, cx_sessions, cx_threads, cx_messages
- [ ] Storage buckets không public, tài khoản nhân viên không truy xuất được tệp ngoài quyền
- [ ] Vercel READY và truy cập URL thực tế HTTP 200 (không phải 402 DEPLOYMENT_DISABLED)
- [ ] /api/health trả ok:true, supabaseDatabaseReachable:true
- [ ] Đăng nhập admin lần đầu, đổi mật khẩu, đăng xuất; không công bố bootstrap code
- [ ] Nhân viên xem/sửa đúng phạm vi; tổ trưởng, điều dưỡng trưởng, trưởng khoa đúng quyền
- [ ] Giao việc và Nhắc việc: tạo/sửa/trạng thái/tin nhắn/chuông/tệp đều chạy
- [ ] Trang chủ, Giao việc, Nhắc việc tự co giãn khi thu/mở menu; máy tính bảng dọc/ngang
- [ ] Giám sát, lỗi vi phạm, KPI, báo cáo và xuất Excel/PowerPoint không rò dữ liệu
- [ ] Backup và kế hoạch rollback được xác nhận, không dùng dữ liệu bệnh nhân thật để thử xóa
- [ ] Đã thống nhất ngân sách và nhà cung cấp hosting phù hợp hoạt động bệnh viện

Nếu còn bất kỳ mục quan trọng nào chưa đạt, chưa nên cho toàn bộ nhân viên sử dụng.