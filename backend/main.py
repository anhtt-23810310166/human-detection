import io
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image

app = FastAPI(title="YOLOv8 Thief Detection API")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo mô hình YOLOv8n (phiên bản nano: nhanh nhất)
# Lần đầu chạy nó sẽ tự động tải file yolov8n.pt về
model = None

@app.on_event("startup")
async def startup_event():
    global model
    try:
        print("Đang nạp bộ não siêu AI YOLOv8n...")
        model = YOLO('yolov8n.pt')
        print("Nạp mô hình thành công!")
    except Exception as e:
        print(f"Lỗi nạp model: {e}")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    global model
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")
    
    try:
        # Đọc ảnh từ client
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Chạy YOLOv8 suy luận
        # conf=0.5 nghĩa là chỉ tin tưởng kết quả > 50%
        results = model.predict(image, conf=0.5, verbose=False)
        
        # YOLO trả về 1 mảng các kết quả (do ta chỉ gửi 1 ảnh nên lấy kết quả [0])
        result = results[0]
        
        persons = []
        
        # Trích xuất các Bounding Box
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            
            # Class 0 trong thư viện COCO của YOLO chính là "Person" (Người)
            if class_id == 0:
                # Lấy tọa độ [x_min, y_min, x_max, y_max]
                coords = box.xyxy[0].tolist()
                persons.append({
                    "confidence": confidence,
                    "box": coords
                })
        
        # Trả về kết quả
        if len(persons) > 0:
            return JSONResponse(content={
                "status": "ALARM",
                "message": f"Phát hiện {len(persons)} Người trong khu vực!",
                "persons": persons
            })
        else:
            return JSONResponse(content={
                "status": "SAFE",
                "message": "Khu vực an toàn, không có người.",
                "persons": []
            })
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Chạy trên cổng 8080
    uvicorn.run(app, host="0.0.0.0", port=8080)
