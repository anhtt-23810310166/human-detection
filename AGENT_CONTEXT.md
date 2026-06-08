# Hệ Thống Phát Hiện Người (Human Detection) - AI Agent Context

Tài liệu này định nghĩa ngữ cảnh, kiến trúc và luật nghiệp vụ (Business Rules) của dự án. AI Agents (Cursor, Copilot, ChatGPT...) ĐỌC KỸ file này trước khi can thiệp vào code.

## 1. Kiến trúc (3-Tier Enterprise Architecture)
- **Database (Data Layer):** MongoDB (Container `mongodb`). Lưu trữ vĩnh viễn Lịch sử báo động và Thống kê.
- **Backend (Logic Layer):** FastAPI (Python). Chịu trách nhiệm nhận ảnh, chạy Inference bằng YOLOv8 (`yolov8n.pt`), thao tác với MongoDB qua thư viện `motor`.
- **Frontend (Presentation Layer):** Nginx (Alpine) host HTML5, CSS3, JS tĩnh. Giao diện SPA Dark Theme, tích hợp `Chart.js`.
- **Triển khai:** Quản lý toàn bộ bằng `docker-compose.yml`.

## 2. Luật Nghiệp vụ (Business Rules)
- **Quy tắc Phân loại (Lọc):** AI YOLOv8 trả về nhiều Class. Hệ thống CHỈ quan tâm đến `Class_ID = 0` (Person).
- **Bộ lọc Admin (Threshold):** Mức độ tự tin (Confidence) của AI phải VƯỢT QUA ngưỡng được cài đặt trong `localStorage` (`yolo_conf`) thì mới được tính là Hợp lệ.
- **Cơ chế Báo động:** Nếu số lượng Person hợp lệ > 0 👉 Kích hoạt `ALARM`, tự động ghi log vào MongoDB. Nếu = 0 👉 `SAFE`.
- **Hiển thị (UI/UX):** Khi phát hiện Người, Frontend bắt buộc phải vẽ Khung Đỏ (Bounding Box), cập nhật danh sách Lịch sử và vẽ lại Biểu đồ Chart.js.

## 3. Agent Skills & Lưu ý
- Khi code Frontend: Đảm bảo giao diện không xuất hiện thanh cuộn dọc (Scrollbar). Phải tương thích với tỷ lệ Flexbox 100vh.
- Khi code Backend: Không lưu trữ hình ảnh của người dùng (Quy tắc bảo mật nội bộ). Xử lý xong phải hủy ảnh trong RAM. Chỉ lưu dạng chuỗi Log (Thời gian, Độ tin cậy) vào MongoDB.
