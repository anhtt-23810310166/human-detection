# Hệ Thống Phát Hiện Người (Human Detection) - AI Agent Context

Tài liệu này định nghĩa ngữ cảnh, kiến trúc và luật nghiệp vụ (Business Rules) của dự án. AI Agents (Cursor, Copilot, ChatGPT...) ĐỌC KỸ file này trước khi can thiệp vào code.

## 1. Kiến trúc (Architecture)
- **Mô hình AI:** YOLOv8 (phiên bản `yolov8n.pt` / `yolov8n.onnx`). Đây là mô hình Object Detection.
- **Backend:** FastAPI (Python). Chịu trách nhiệm nhận ảnh, chạy Inference, trích xuất tọa độ Bounding Box.
- **Frontend:** HTML5, CSS3 (Vanilla), JS. Dùng `navigator.mediaDevices.getUserMedia` bắt webcam, vẽ Canvas overlay.

## 2. Luật Nghiệp vụ (Business Rules)
- **Quy tắc Phân loại (Lọc):** AI YOLOv8 trả về nhiều Class. Hệ thống CHỈ quan tâm đến `Class_ID = 0` (Person). TẤT CẢ các vật thể khác bị bỏ qua.
- **Cơ chế Báo động:** Nếu số lượng Person > 0 👉 Kích hoạt `ALARM`. Nếu = 0 👉 `SAFE`.
- **Hiển thị (UI/UX):** Khi phát hiện Người, Frontend bắt buộc phải vẽ Khung Đỏ (Bounding Box) bao quanh mục tiêu kèm độ tự tin (Confidence %).

## 3. Agent Skills & Lưu ý
- Khi code Frontend: Chú ý đồng bộ tọa độ (Scale) giữa kích thước ảnh gốc và kích thước Video hiển thị trên CSS.
- Khi code Backend: Không lưu trữ hình ảnh của người dùng (Quy tắc bảo mật nội bộ). Xử lý xong phải hủy ảnh trong RAM.
