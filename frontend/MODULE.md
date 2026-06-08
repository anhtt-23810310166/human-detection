# Module Frontend (Security Dashboard)

## Nghiệp vụ (Domain Logic)
Đóng vai trò là "Trung tâm Điều khiển" (Command Center) hiển thị cho người dùng cuối. Giao diện được thiết kế theo dạng SPA (Single Page Application) phong cách Dark Theme chuyên nghiệp.

## Cấu trúc luồng (Flow)
1. **WebRTC & Canvas:** `app.js` xin quyền Webcam, liên tục nén ảnh JPEG và gửi POST `/predict` mỗi 800ms.
2. **SPA Routing:** Xử lý chuyển Tab mượt mà (Camera, Lịch sử, Báo cáo, Quản trị) mà không cần tải lại trang.
3. **Data Fetching:** Sử dụng Fetch API để lấy dữ liệu `GET /history` và `GET /stats` từ Backend MongoDB.
4. **Data Visualization (Chart.js):** Lấy mảng dữ liệu Lịch sử để vẽ Biểu đồ Đường (Line Chart) mô phỏng biến động mức độ nguy hiểm.
5. **Admin Controls:** Quản lý ngưỡng tin cậy (Confidence Threshold) bằng thanh Slider. Lọc bỏ các kết quả AI trả về nếu thấp hơn ngưỡng này.
6. **Overlay UI:** Vẽ bounding box màu đỏ và hiển thị chỉ số cảnh báo trực tiếp đè lên khung hình Video.
