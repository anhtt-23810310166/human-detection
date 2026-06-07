const video = document.getElementById('webcam');
const captureCanvas = document.getElementById('captureCanvas');
const captureCtx = captureCanvas.getContext('2d');

const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

const toggleBtn = document.getElementById('toggleEngineBtn');
const scanLine = document.querySelector('.scan-line');

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const statusIcon = document.getElementById('statusIcon');
const logList = document.getElementById('logList');

let isEngineRunning = false;
let inferenceInterval = null;

// Cập nhật đồng hồ
setInterval(() => {
    const now = new Date();
    document.getElementById('systemTime').innerText = now.toLocaleTimeString('en-US', { hour12: false });
}, 1000);

function addLog(msg, type = 'info') {
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    let color = 'inherit';
    if(type === 'alarm') color = 'var(--alarm)';
    if(type === 'safe') color = 'var(--safe)';
    
    li.innerHTML = `<span class="log-time">[${time}]</span> <span style="color:${color}; font-weight:500;">${msg}</span>`;
    logList.prepend(li);
    if(logList.children.length > 20) logList.removeChild(logList.lastChild);
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        
        // Chờ video play để lấy kích thước thật
        video.onloadedmetadata = () => {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
        };
        addLog('Đã kết nối Camera', 'safe');
    } catch (err) {
        addLog(`Lỗi Camera: ${err.message}`, 'alarm');
        statusText.innerText = 'LỖI CAMERA';
    }
}

function clearOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// Vẽ khung đỏ (Bounding Box)
function drawBoxes(persons) {
    clearOverlay();
    
    persons.forEach(person => {
        const [x1, y1, x2, y2] = person.box;
        const width = x2 - x1;
        const height = y2 - y1;
        const conf = (person.confidence * 100).toFixed(0);

        // Vẽ Khung
        overlayCtx.strokeStyle = '#ef4444'; // Red
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(x1, y1, width, height);

        // Vẽ nhãn (Label)
        overlayCtx.fillStyle = '#ef4444';
        overlayCtx.fillRect(x1, y1 - 25, 110, 25);
        
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.font = '16px Inter, sans-serif';
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
    statusIndicator.className = 'status-indicator';
    
    if (result.status === "ALARM") {
        statusIndicator.classList.add('alarm');
        statusIcon.innerText = '👤'; 
        statusText.innerText = result.message;
        addLog(`Cảnh báo: ${result.message}`, 'alarm');
        
        // Vẽ box
        if (result.persons) {
            drawBoxes(result.persons);
        }
    } 
    else {
        // SAFE
        statusIndicator.classList.add('safe');
        statusIcon.innerText = '🛡️';
        statusText.innerText = result.message;
        
        // Không có người thì xóa các box trên màn hình
        clearOverlay();
    }
}

toggleBtn.addEventListener('click', () => {
    isEngineRunning = !isEngineRunning;
    
    if (isEngineRunning) {
        toggleBtn.innerText = 'TẮT AI ENGINE';
        toggleBtn.classList.add('active');
        scanLine.style.display = 'block';
        
        statusIndicator.className = 'status-indicator';
        statusIcon.innerText = '👁️';
        statusText.innerText = 'Đang quét ảnh...';
        
        addLog('Bật hệ thống AI Phát hiện Người.', 'info');
        inferenceInterval = setInterval(analyzeFrame, 800); // Gửi nhanh hơn xíu
    } else {
        toggleBtn.innerText = 'BẬT AI ENGINE';
        toggleBtn.classList.remove('active');
        scanLine.style.display = 'none';
        clearInterval(inferenceInterval);
        
        statusIndicator.className = 'status-indicator';
        statusIcon.innerText = '🛡️';
        statusText.innerText = 'Hệ thống đã dừng';
        
        clearOverlay(); // Xóa khung khi tắt máy
        addLog('Tắt hệ thống AI.', 'info');
    }
});

startWebcam();
