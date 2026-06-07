# Module Frontend (Security Dashboard)

## Nghiệp vụ (Domain Logic)
Đóng vai trò là "Mắt" (Camera) và "Bảng điều khiển" hiển thị cho người dùng cuối.

## Cấu trúc luồng (Flow)
1. `app.js` gọi API trình duyệt xin quyền Webcam.
2. Vẽ ảnh lên 1 canvas ẩn (`captureCanvas`). Nén ảnh thành JPEG và POST lên Backend.
3. Khi Backend trả về JSON trạng thái ALARM kèm mảng tọa độ, gọi hàm `drawBoxes()`.
4. Hàm `drawBoxes()` dùng `overlayCanvas` đè lên Video để vẽ khung đỏ chính xác vào vị trí tọa độ nhận được.
5. Cập nhật DOM (chuyển đổi class CSS) để tạo hiệu ứng nhấp nháy đèn báo động.
