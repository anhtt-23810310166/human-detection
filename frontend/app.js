const video = document.getElementById('webcam');
const captureCanvas = document.getElementById('captureCanvas');
const captureCtx = captureCanvas.getContext('2d');

const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

const toggleBtn = document.getElementById('toggleEngineBtn');
const engineStatusBadge = document.getElementById('engineStatusBadge');
const liveTimestamp = document.getElementById('liveTimestamp');

const systemStatusVal = document.getElementById('systemStatusVal');
const personCountVal = document.getElementById('personCountVal');
const personCountBox = document.getElementById('personCountBox');

// --- DYNAMIC DATA STORAGE (LOCAL STORAGE) ---
let detectionHistory = JSON.parse(localStorage.getItem('yolo_history') || '[]');
let totalScans = parseInt(localStorage.getItem('yolo_scans') || '0');
let totalAlarms = parseInt(localStorage.getItem('yolo_alarms') || '0');
let confidenceThreshold = parseInt(localStorage.getItem('yolo_conf') || '60');

let isEngineRunning = false;
let inferenceInterval = null;

// --- INITIALIZE UI ---
document.getElementById('totalScansVal').innerText = totalScans.toLocaleString();
document.getElementById('totalAlarmsVal').innerText = totalAlarms.toLocaleString();
const confSlider = document.getElementById('confidenceSlider');
const confDisplay = document.getElementById('confidenceValueDisplay');
confSlider.value = confidenceThreshold;
confDisplay.innerText = confidenceThreshold + '%';

renderHistoryTable();

// --- ADMIN SETTINGS ---
confSlider.addEventListener('input', (e) => {
    confidenceThreshold = parseInt(e.target.value);
    confDisplay.innerText = confidenceThreshold + '%';
    localStorage.setItem('yolo_conf', confidenceThreshold);
});

// --- CLEAR BUTTONS ---
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    detectionHistory = [];
    localStorage.setItem('yolo_history', JSON.stringify(detectionHistory));
    renderHistoryTable();
});

document.getElementById('clearStatsBtn').addEventListener('click', () => {
    totalScans = 0;
    totalAlarms = 0;
    localStorage.setItem('yolo_scans', '0');
    localStorage.setItem('yolo_alarms', '0');
    document.getElementById('totalScansVal').innerText = '0';
    document.getElementById('totalAlarmsVal').innerText = '0';
});

// --- CLOCK ---
setInterval(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[now.getDay()];
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = String(hours).padStart(2, '0') + ':' + 
                    String(now.getMinutes()).padStart(2, '0') + ':' + 
                    String(now.getSeconds()).padStart(2, '0') + ' ' + ampm;
    liveTimestamp.innerText = `${month}-${date}-${year} ${day} ${strTime}`;
}, 1000);

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
        };
    } catch (err) {
        systemStatusVal.innerHTML = `<span class="icon">❌</span> <span class="text">LỖI CAMERA</span>`;
        systemStatusVal.className = 'card-value danger';
    }
}

function clearOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function drawBoxes(persons) {
    clearOverlay();
    persons.forEach(person => {
        const [x1, y1, x2, y2] = person.box;
        const width = x2 - x1;
        const height = y2 - y1;
        const conf = (person.confidence * 100).toFixed(0);

        overlayCtx.strokeStyle = '#ff3333'; 
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(x1, y1, width, height);

        overlayCtx.fillStyle = '#ff3333';
        overlayCtx.fillRect(x1, y1 - 25, 110, 25);
        
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.font = 'bold 14px Inter, sans-serif';
        overlayCtx.fillText(`NGƯỜI ${conf}%`, x1 + 5, y1 - 7);
    });
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (detectionHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">Hệ thống chưa ghi nhận biến cố nào.</td></tr>`;
        return;
    }
    
    // Đảo ngược mảng để hiện sự kiện mới nhất lên đầu
    [...detectionHistory].reverse().forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${record.time}</td>
            <td style="color: var(--cyan); font-weight: bold;">${record.conf}%</td>
            <td><span class="tag high">Nguy hiểm</span></td>
            <td>Ghi nhận Đột nhập</td>
        `;
        tbody.appendChild(tr);
    });
}

async function analyzeFrame() {
    if (!isEngineRunning) return;
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Tăng biến đếm scan
    totalScans++;
    localStorage.setItem('yolo_scans', totalScans);
    document.getElementById('totalScansVal').innerText = totalScans.toLocaleString();

    captureCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');
        try {
            const response = await fetch('http://localhost:8080/predict', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error("Mất kết nối Server");
            const result = await response.json();
            updateStatus(result);
        } catch (error) {
            console.error(error);
        }
    }, 'image/jpeg', 0.8);
}

function updateStatus(result) {
    // 1. Lọc kết quả dựa trên Độ nhạy (Threshold) của Admin
    let validPersons = [];
    if (result.persons) {
        validPersons = result.persons.filter(p => (p.confidence * 100) >= confidenceThreshold);
    }

    if (validPersons.length > 0) {
        // Có báo động thực sự
        systemStatusVal.className = 'card-value danger';
        systemStatusVal.innerHTML = `<span class="icon">🚨</span> <span class="text">PHÁT HIỆN ĐỘT NHẬP</span>`;
        personCountVal.innerText = validPersons.length;
        personCountBox.classList.add('danger');
        
        drawBoxes(validPersons);

        // Lưu vào Lịch sử
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        
        // Lấy confidence cao nhất trong số những người phát hiện được
        const maxConf = Math.max(...validPersons.map(p => p.confidence * 100)).toFixed(0);
        
        detectionHistory.push({ time: timeStr, conf: maxConf });
        if (detectionHistory.length > 50) detectionHistory.shift(); // Chỉ giữ 50 bản ghi gần nhất
        localStorage.setItem('yolo_history', JSON.stringify(detectionHistory));
        
        // Cập nhật số lần báo động
        totalAlarms++;
        localStorage.setItem('yolo_alarms', totalAlarms);
        document.getElementById('totalAlarmsVal').innerText = totalAlarms.toLocaleString();
        
        renderHistoryTable();
    } 
    else {
        // SAFE
        systemStatusVal.className = 'card-value safe';
        systemStatusVal.innerHTML = `<span class="icon">✅</span> <span class="text">An toàn</span>`;
        personCountVal.innerText = '0';
        personCountBox.classList.remove('danger');
        clearOverlay();
    }
}

// AI Toggle
toggleBtn.addEventListener('click', () => {
    isEngineRunning = !isEngineRunning;
    if (isEngineRunning) {
        toggleBtn.innerHTML = `<span class="icon">⏹️</span> Dừng AI`;
        toggleBtn.classList.add('active');
        engineStatusBadge.innerText = 'AI: ĐANG HOẠT ĐỘNG';
        engineStatusBadge.style.color = '#00e676';
        engineStatusBadge.style.borderColor = '#00e676';
        inferenceInterval = setInterval(analyzeFrame, 800);
    } else {
        toggleBtn.innerHTML = `<span class="icon">⚡</span> Khởi động AI`;
        toggleBtn.classList.remove('active');
        engineStatusBadge.innerText = 'AI: ĐANG CHỜ LỆNH';
        engineStatusBadge.style.color = '#00e5ff';
        engineStatusBadge.style.borderColor = '#00e5ff';
        clearInterval(inferenceInterval);
        
        systemStatusVal.className = 'card-value safe';
        systemStatusVal.innerHTML = `<span class="icon">✅</span> <span class="text">Hệ thống Tạm dừng</span>`;
        personCountVal.innerText = '0';
        personCountBox.classList.remove('danger');
        clearOverlay(); 
    }
});

// SPA Navigation Logic
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        viewSections.forEach(view => {
            view.classList.remove('active');
        });
        
        const targetId = item.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active');
            // Re-render bảng nếu vào tab Lịch sử
            if (targetId === 'view-history') renderHistoryTable();
        }
    });
});

// Snapshot Logic
const snapshotBtn = document.getElementById('snapshotBtn');
snapshotBtn.addEventListener('click', () => {
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    captureCtx.drawImage(overlayCanvas, 0, 0);
    
    const dataURL = captureCanvas.toDataURL('image/jpeg', 1.0);
    const a = document.createElement('a');
    a.href = dataURL;
    
    const now = new Date();
    const timeStr = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    a.download = `YOLO_Snapshot_${timeStr}.jpg`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    snapshotBtn.style.color = 'var(--cyan)';
    setTimeout(() => { snapshotBtn.style.color = ''; }, 500);
});

startWebcam();
