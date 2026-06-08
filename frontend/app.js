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

let isEngineRunning = false;
let inferenceInterval = null;

// Clock
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

async function analyzeFrame() {
    if (!isEngineRunning) return;
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
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
    if (result.status === "ALARM") {
        systemStatusVal.className = 'card-value danger';
        systemStatusVal.innerHTML = `<span class="icon">🚨</span> <span class="text">PHÁT HIỆN ĐỘT NHẬP</span>`;
        const count = result.persons ? result.persons.length : 0;
        personCountVal.innerText = count;
        personCountBox.classList.add('danger');
        if (result.persons) drawBoxes(result.persons);
    } 
    else {
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
        // Remove active class from all nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        // Add active class to clicked item
        item.classList.add('active');
        
        // Hide all views
        viewSections.forEach(view => {
            view.classList.remove('active');
        });
        
        // Show target view
        const targetId = item.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active');
        }
    });
});

// Snapshot Logic
const snapshotBtn = document.getElementById('snapshotBtn');
snapshotBtn.addEventListener('click', () => {
    // 1. Draw video frame to capture canvas
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    // 2. Draw overlay (bounding boxes) on top of capture canvas
    captureCtx.drawImage(overlayCanvas, 0, 0);
    
    // 3. Download the merged image
    const dataURL = captureCanvas.toDataURL('image/jpeg', 1.0);
    const a = document.createElement('a');
    a.href = dataURL;
    
    // Add timestamp to filename
    const now = new Date();
    const timeStr = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    a.download = `YOLO_Snapshot_${timeStr}.jpg`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Feedback effect
    snapshotBtn.style.color = 'var(--cyan)';
    setTimeout(() => { snapshotBtn.style.color = ''; }, 500);
});

startWebcam();
