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

// --- Cài đặt Client-side ---
let confidenceThreshold = parseInt(localStorage.getItem('yolo_conf') || '60');
const confSlider = document.getElementById('confidenceSlider');
const confDisplay = document.getElementById('confidenceValueDisplay');
confSlider.value = confidenceThreshold;
confDisplay.innerText = confidenceThreshold + '%';

let isEngineRunning = false;
let inferenceInterval = null;

// --- DYNAMIC FETCH DATA (MONGODB VIA API) ---
let globalHistory = [];

async function fetchStats() {
    try {
        const res = await fetch('http://localhost:8080/stats');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('totalScansVal').innerText = (data.total_scans || 0).toLocaleString();
            document.getElementById('totalAlarmsVal').innerText = (data.total_alarms || 0).toLocaleString();
        }
    } catch (e) {
        console.error('Lỗi lấy thống kê', e);
    }
}

async function fetchHistory() {
    try {
        const res = await fetch('http://localhost:8080/history');
        if (res.ok) {
            const history = await res.json();
            globalHistory = history;
            
            // 1. Cập nhật Bảng
            const tbody = document.getElementById('historyTableBody');
            tbody.innerHTML = '';
            
            if (history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">Hệ thống chưa ghi nhận biến cố nào.</td></tr>`;
            } else {
                history.forEach(record => {
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
            
            // 2. Cập nhật Biểu đồ
            renderChart();
        }
    } catch (e) {
        console.error('Lỗi lấy lịch sử', e);
    }
}

// Gọi API lần đầu khi load trang
fetchStats();
fetchHistory();

// --- CHART.JS ---
let reportChart = null;

function renderChart() {
    const ctx = document.getElementById('reportChart').getContext('2d');
    
    // Dữ liệu từ MongoDB (Đã được xếp mới nhất ở đầu, cần đảo ngược để vẽ từ trái qua phải)
    const reversedHistory = [...globalHistory].reverse();
    
    const labels = reversedHistory.map(r => r.time);
    const dataPoints = reversedHistory.map(r => parseInt(r.conf));

    if (reportChart) {
        reportChart.data.labels = labels;
        reportChart.data.datasets[0].data = dataPoints;
        reportChart.update();
    } else {
        Chart.defaults.color = '#8b92a5';
        Chart.defaults.font.family = 'Inter';
        
        reportChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Độ tin cậy (%)',
                    data: dataPoints,
                    borderColor: '#ff6b00',
                    backgroundColor: 'rgba(255, 107, 0, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: '#00e5ff',
                    pointBorderColor: '#000',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// --- ADMIN SETTINGS ---
confSlider.addEventListener('input', (e) => {
    confidenceThreshold = parseInt(e.target.value);
    confDisplay.innerText = confidenceThreshold + '%';
    localStorage.setItem('yolo_conf', confidenceThreshold);
});

// --- CLEAR BUTTONS (GỌI API XÓA) ---
document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    try {
        await fetch('http://localhost:8080/history', { method: 'DELETE' });
        fetchHistory(); // Tải lại bảng & biểu đồ
    } catch (e) { console.error(e); }
});

document.getElementById('clearStatsBtn').addEventListener('click', async () => {
    try {
        await fetch('http://localhost:8080/stats', { method: 'DELETE' });
        fetchStats(); // Tải lại số
    } catch (e) { console.error(e); }
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
            fetchStats();
            
        } catch (error) {
            console.error(error);
        }
    }, 'image/jpeg', 0.8);
}

function updateStatus(result) {
    let validPersons = [];
    if (result.persons) {
        validPersons = result.persons.filter(p => (p.confidence * 100) >= confidenceThreshold);
    }

    if (validPersons.length > 0) {
        systemStatusVal.className = 'card-value danger';
        systemStatusVal.innerHTML = `<span class="icon">🚨</span> <span class="text">PHÁT HIỆN ĐỘT NHẬP</span>`;
        personCountVal.innerText = validPersons.length;
        personCountBox.classList.add('danger');
        
        drawBoxes(validPersons);
        fetchHistory(); // Sẽ tự động vẽ lại luôn Chart
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
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        viewSections.forEach(view => {
            view.classList.remove('active');
        });
        
        const targetId = item.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active');
            
            // Re-fetch data when opening views
            if (targetId === 'view-history') fetchHistory();
            if (targetId === 'view-reports') fetchStats();
            
            // Fix chart resizing issue when changing tabs
            if (targetId === 'view-analytics' && reportChart) {
                reportChart.resize();
            }
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
