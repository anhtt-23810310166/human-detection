import io
import os
import datetime
import jwt
import bcrypt
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from ultralytics import YOLO
from PIL import Image
from motor.motor_asyncio import AsyncIOMotorClient
import cv2
import numpy as np
import requests
import threading

TELEGRAM_BOT_TOKEN = "8903352640:AAG2FNzhrPoj8-UEzvkI8LRCq-KlXDYlGQM"
TELEGRAM_CHAT_ID = "2049574618"
last_telegram_alert_time = 0

def send_telegram_photo_task(photo_bytes: bytes, caption: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    files = {"photo": ("alert.jpg", photo_bytes, "image/jpeg")}
    data = {"chat_id": TELEGRAM_CHAT_ID, "caption": caption}
    try:
        response = requests.post(url, data=data, files=files, timeout=10)
        print("Telegram Response:", response.text)
    except Exception as e:
        print("Telegram Send Error:", e)

app = FastAPI(title="YOLOv8 Security API with Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTHENTICATION CONFIG ---
SECRET_KEY = "YOLO_GUARD_SECRET_SUPER_SAFE_2026"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

model = None
db = None

# Hàm tạo mã băm mật khẩu bằng bcrypt
def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')

# Hàm kiểm tra mật khẩu bằng bcrypt
def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password=password_byte_enc, hashed_password=hashed_password_bytes)

# Dependency xác thực Token (Bảo vệ các API)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

@app.on_event("startup")
async def startup_event():
    global model, db
    try:
        print("Đang nạp AI YOLOv8n...")
        model = YOLO('yolov8n.pt')
        print("Nạp mô hình thành công!")
    except Exception as e:
        print(f"Lỗi nạp model: {e}")
        
    try:
        mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        client = AsyncIOMotorClient(mongo_url)
        db = client["yolo_guard_db"]
        
        # Khởi tạo bảng stats nếu chưa có
        stats = await db["stats"].find_one({"_id": "main"})
        if not stats:
            await db["stats"].insert_one({"_id": "main", "total_scans": 0, "total_alarms": 0})
            
        # Khởi tạo tài khoản Admin mặc định (admin/admin123)
        admin = await db["users"].find_one({"username": "admin"})
        if not admin:
            hashed_pwd = get_password_hash("admin123")
            await db["users"].insert_one({
                "username": "admin",
                "password": hashed_pwd,
                "role": "Super Admin"
            })
            print("Đã tạo tài khoản mặc định: admin / admin123")
            
        print("Kết nối MongoDB thành công!")
    except Exception as e:
        print(f"Lỗi kết nối MongoDB: {e}")

# --- API ĐĂNG NHẬP (LOGIN) ---
@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database Error")
        
    user = await db["users"].find_one({"username": username})
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Tài khoản hoặc mật khẩu không đúng!")
        
    # Tạo Token JWT (Sống 24 tiếng)
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    to_encode = {"sub": username, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"access_token": encoded_jwt, "token_type": "bearer", "role": user.get("role", "User")}

# --- CÁC API BỊ BẢO VỆ (PROTECTED ENDPOINTS) ---
@app.post("/predict")
async def predict(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    global model, db
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")
    
    try:
        global last_telegram_alert_time
        if db is not None:
            await db["stats"].update_one({"_id": "main"}, {"$inc": {"total_scans": 1}})

        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # OpenCV decode for drawing
        nparr = np.frombuffer(contents, np.uint8)
        img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        results = model.predict(image, conf=0.5, verbose=False)
        result = results[0]
        
        persons = []
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            if class_id == 0:
                coords = box.xyxy[0].tolist()
                persons.append({
                    "confidence": confidence,
                    "box": coords
                })
                # Draw Bounding Box and Label on OpenCV Image
                x1, y1, x2, y2 = map(int, coords)
                cv2.rectangle(img_cv2, (x1, y1), (x2, y2), (0, 0, 255), 2)
                label = f"NGUOI: {confidence*100:.0f}%"
                (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(img_cv2, (x1, max(y1 - 25, 0)), (x1 + w, max(y1, 0)), (0, 0, 255), -1)
                cv2.putText(img_cv2, label, (x1, max(y1 - 5, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        if len(persons) > 0:
            max_conf = max([p["confidence"] for p in persons]) * 100
            now = datetime.datetime.now()
            time_str = now.strftime("%Y-%m-%d %H:%M:%S")
            time_str_short = now.strftime("%H:%M:%S")
            
            # Draw Watermark
            cv2.putText(img_cv2, f"CAM-01 | {time_str}", (10, img_cv2.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            if db is not None:
                await db["stats"].update_one({"_id": "main"}, {"$inc": {"total_alarms": 1}})
                await db["history"].insert_one({
                    "time": time_str_short,
                    "conf": f"{max_conf:.0f}",
                    "timestamp": now
                })
                
                count = await db["history"].count_documents({})
                if count > 50:
                    oldest = await db["history"].find().sort("timestamp", 1).limit(count - 50).to_list(None)
                    for doc in oldest:
                        await db["history"].delete_one({"_id": doc["_id"]})

            # Check anti-spam 30s before sending to Telegram
            current_time = now.timestamp()
            if current_time - last_telegram_alert_time > 30:
                last_telegram_alert_time = current_time
                _, buffer = cv2.imencode('.jpg', img_cv2)
                img_bytes = buffer.tobytes()
                caption = f"🚨 BÁO ĐỘNG CAM-01 🚨\n\nPhát hiện {len(persons)} đối tượng lạ!\nĐộ tin cậy cao nhất: {max_conf:.0f}%\nThời gian: {time_str}"
                threading.Thread(target=send_telegram_photo_task, args=(img_bytes, caption)).start()

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
        print(f"Predict Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
async def get_history(current_user: str = Depends(get_current_user)):
    if db is None:
        return []
    cursor = db["history"].find({}, {"_id": 0, "timestamp": 0}).sort("timestamp", -1)
    history = await cursor.to_list(length=50)
    return history

@app.delete("/history")
async def clear_history(current_user: str = Depends(get_current_user)):
    if db is not None:
        await db["history"].delete_many({})
    return {"status": "ok"}

@app.get("/stats")
async def get_stats(current_user: str = Depends(get_current_user)):
    if db is None:
        return {"total_scans": 0, "total_alarms": 0}
    stats = await db["stats"].find_one({"_id": "main"})
    if stats:
        return {"total_scans": stats.get("total_scans", 0), "total_alarms": stats.get("total_alarms", 0)}
    return {"total_scans": 0, "total_alarms": 0}

@app.delete("/stats")
async def clear_stats(current_user: str = Depends(get_current_user)):
    if db is not None:
        await db["stats"].update_one({"_id": "main"}, {"$set": {"total_scans": 0, "total_alarms": 0}})
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
