# Module Backend (YOLO Core & Database API)

## Nghiệp vụ (Domain Logic)
Xử lý hình ảnh gửi lên từ Client, chạy thuật toán nhận diện vật thể bằng YOLOv8, và thao tác lưu trữ/đọc dữ liệu với Cơ sở dữ liệu MongoDB.

## Cấu trúc luồng (Flow)
1. **Khởi tạo:** Nạp mô hình YOLOv8n vào RAM và khởi tạo kết nối bất đồng bộ (AsyncIOMotorClient) đến MongoDB (`mongodb:27017`).
2. **`POST /predict`**:
   - Nhận file ảnh JPEG.
   - Tăng biến đếm `total_scans` trong MongoDB.
   - Chạy Inference bằng YOLO.
   - Nếu phát hiện Người (ALARM): Tăng `total_alarms` trong DB, ghi 1 bản ghi mới vào mảng `history` (Time, Confidence), và xóa các bản ghi cũ nếu vượt quá 50.
   - Trả về JSON tọa độ.
3. **`GET /history` & `GET /stats`**:
   - Cung cấp dữ liệu Lịch sử và Thống kê từ MongoDB cho Frontend hiển thị Bảng và vẽ Biểu đồ.
4. **`DELETE /history` & `DELETE /stats`**:
   - Các API dọn dẹp dữ liệu trong MongoDB.
