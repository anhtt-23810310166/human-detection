# 🎯 Human Detection (YOLOv8 Edge Vision)

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![YOLOv8](https://img.shields.io/badge/Ultralytics-YOLOv8-yellow.svg)
![License](https://img.shields.io/badge/License-MIT-purple.svg)

Hệ thống nhận diện con người (Human Detection) thời gian thực, được thiết kế theo tiêu chuẩn công nghiệp với kiến trúc Client-Server. Hệ thống sử dụng mô hình **YOLOv8** siêu nhẹ để nhận diện và theo dõi đối tượng trên trình duyệt Web mà không cần cài đặt phần mềm nặng trên client.

## 🚀 Tính năng nổi bật (Features)
- **Real-time Object Detection:** Suy luận với tốc độ cao bằng YOLOv8n.
- **Bounding Box Overlay:** Vẽ khung nhận diện trực tiếp trên luồng Video bằng HTML5 Canvas.
- **RESTful API Architecture:** Backend độc lập bằng FastAPI, dễ dàng scale bằng Docker.
- **Zero-setup Client:** Client chỉ cần trình duyệt web hỗ trợ WebRTC (Camera).

## 🧠 Kiến trúc Hệ thống (Architecture)

```mermaid
sequenceDiagram
    participant Cam as Webcam (Frontend)
    participant UI as Browser Canvas
    participant API as FastAPI Backend
    participant YOLO as YOLOv8 Core

    Cam->>UI: Stream Video
    loop Every 800ms
        UI->>API: POST /predict (JPEG Frame)
        API->>YOLO: model.predict(image, conf=0.5)
        YOLO-->>API: Array of Boxes [x, y, w, h]
        API-->>UI: JSON {status, message, persons[]}
        UI->>UI: Draw Red Bounding Boxes
    end
```

## 🛠️ Cài đặt & Triển khai (Deployment)

Cách chuyên nghiệp nhất để chạy hệ thống này là sử dụng **Docker Compose**.

### 1. Triển khai bằng Docker (Khuyên dùng)
Yêu cầu: Máy tính/Edge Device đã cài đặt Docker & Docker Compose.
```bash
docker-compose up -d --build
```
- **Frontend (UI):** Truy cập `http://localhost:80`
- **Backend (API):** Chạy ngầm tại `http://localhost:8080`

### 2. Chạy thủ công (Dành cho Developer)
Nếu không có Docker, bạn có thể chạy chay từng module:
```bash
# Terminal 1: Chạy Backend
cd backend
pip install -r requirements.txt
python main.py

# Terminal 2: Chạy Frontend
Mở file frontend/index.html bằng trình duyệt.
```

## 📁 Cấu trúc Thư mục
```text
human-detection/
├── backend/
│   ├── main.py              # Logic AI & API Endpoint
│   ├── requirements.txt     # Thư viện Python
│   └── MODULE.md            # Tài liệu nội bộ Backend
├── frontend/
│   ├── app.js               # WebRTC & Canvas Logic
│   ├── index.html           # UI Layout
│   ├── style.css            # Dark mode UI
│   └── MODULE.md            # Tài liệu nội bộ Frontend
├── AGENT_CONTEXT.md         # Context chuẩn mực cho AI Agent
└── README.md
```

## 🛡️ License
Dự án được phân phối dưới giấy phép MIT. Xem thêm tại file `LICENSE`.
