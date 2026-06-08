import io
import os
import datetime
import jwt
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from ultralytics import YOLO
from PIL import Image
from motor.motor_asyncio import AsyncIOMotorClient

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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

model = None
db = None

# Hàm tạo mã băm mật khẩu
def get_password_hash(password):
    return pwd_context.hash(password)

# Hàm kiểm tra mật khẩu
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

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
        if db is not None:
            await db["stats"].update_one({"_id": "main"}, {"$inc": {"total_scans": 1}})

        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
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
        
        if len(persons) > 0:
            max_conf = max([p["confidence"] for p in persons]) * 100
            if db is not None:
                await db["stats"].update_one({"_id": "main"}, {"$inc": {"total_alarms": 1}})
                now = datetime.datetime.now()
                time_str = now.strftime("%H:%M:%S")
                await db["history"].insert_one({
                    "time": time_str,
                    "conf": f"{max_conf:.0f}",
                    "timestamp": now
                })
                
                count = await db["history"].count_documents({})
                if count > 50:
                    oldest = await db["history"].find().sort("timestamp", 1).limit(count - 50).to_list(None)
                    for doc in oldest:
                        await db["history"].delete_one({"_id": doc["_id"]})

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
