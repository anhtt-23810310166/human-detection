# Module Backend (YOLO Core)

## Nghiệp vụ (Domain Logic)
Xử lý hình ảnh gửi lên từ Client và chạy thuật toán nhận diện vật thể bằng YOLOv8.

## Cấu trúc luồng (Flow)
1. `/predict` (POST): Nhận file ảnh định dạng JPEG/PNG.
2. Tiền xử lý: Dùng PIL chuyển về chuẩn RGB.
3. Chạy Inference: `model.predict(image, conf=0.5)`. Chỉ tin kết quả > 50%.
4. Hậu xử lý: Lặp qua mảng `result.boxes`, lọc `class_id == 0`. Lấy mảng tọa độ `box.xyxy`.
5. Trả về JSON chứa danh sách tọa độ các đối tượng "Người".
