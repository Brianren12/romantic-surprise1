// 获取HTML中的元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const errorDisplay = document.getElementById('error-display');
const modelLoadingIndicator = document.getElementById('model-loading-indicator');
const timerSpan = document.getElementById('timer-span'); // 获取计时器元素
const loadingText = document.getElementById('loading-text');

let model;
let particles = [];
let isModelReady = false;

// 错误处理函数
function showError(message) {
    console.error(message);
    errorDisplay.style.display = 'block';
    errorDisplay.innerText = '出错了 T_T: \n' + message;
    loadingOverlay.style.display = 'none';
    modelLoadingIndicator.style.display = 'none';
}

// 设置并启动摄像头
async function setupCamera() {
    if (location.protocol !== 'https:') throw new Error('摄像头功能需要安全的HTTPS环境。');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('抱歉，您的浏览器不支持摄像头功能。');

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = stream;

    return new Promise(resolve => {
        video.onloadedmetadata = () => {
            video.width = window.innerWidth;
            video.height = window.innerHeight;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            resolve(video);
        };
    });
}

/**
 * 核心：更新与绘制循环
 */
async function updateAndDraw() {
    // 1. 绘制摄像头背景
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    // 2. 只有当模型准备好后，才执行手势识别
    if (isModelReady) {
        const predictions = await model.estimateHands(video, false);
        if (predictions.length > 0) {
            const landmarks = predictions[0].landmarks;
            const thumbTip = landmarks[4]; // 大拇指指尖
            const indexTip = landmarks[8]; // 食指指尖

            // --- 优化点1：计算捏合距离 ---
            const distance = Math.sqrt(
                Math.pow(thumbTip[0] - indexTip[0], 2) +
                Math.pow(thumbTip[1] - indexTip[1], 2)
            );

            const pinchThreshold = 30; // 捏合距离的阈值，可以根据实际效果微调

            // 如果距离小于阈值，则判断为“捏合”状态，激活画笔
            if (distance < pinchThreshold) {
                const midPointX = (thumbTip[0] + indexTip[0]) / 2;
                const midPointY = (thumbTip[1] + indexTip[1]) / 2;
                const randomHue = Math.random() * 360;
                const randomColor = `hsl(${randomHue}, 100%, 70%)`;
                const lifeSpan = 100;

                particles.push({ x: midPointX, y: midPointY, text: '❤️', life: lifeSpan, maxLife: lifeSpan, size: 50, color: randomColor });
                particles.push({ x: midPointX + 25, y: midPointY + 30, text: '毕雅雯', life: lifeSpan, maxLife: lifeSpan, size: 40, color: randomColor });
            }
        }
    }

    // 3. 更新并绘制所有粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        const currentOpacity = p.life / p.maxLife;
        const currentSize = p.size * (p.life / p.maxLife);
        context.fillStyle = p.color;
        context.globalAlpha = currentOpacity;
        context.font = `bold ${currentSize}px sans-serif`;
        context.fillText(p.text, canvas.width - p.x, p.y);
    }
    context.globalAlpha = 1.0;

    // 4. 持续循环
    requestAnimationFrame(updateAndDraw);
}

/**
 * 主函数入口 (全新加载流程)
 */
async function main() {
    let countdownTimer;
    try {
        // --- 第一阶段：快速启动相机 ---
        await setupCamera();
        video.play();
        loadingText.innerText = "相机准备就绪！";
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
        }, 1000); // 显示1秒成功信息再淡出
        
        updateAndDraw();

        // --- 第二阶段：在后台加载AI模型并显示读秒 ---
        modelLoadingIndicator.style.display = 'block';
        let timeLeft = 15; // 预估15秒加载时间
        timerSpan.innerText = `(${timeLeft}s)`;
        countdownTimer = setInterval(() => {
            timeLeft--;
            timerSpan.innerText = `(${timeLeft > 0 ? timeLeft : 0}s)`;
            if (timeLeft <= 0) {
                clearInterval(countdownTimer);
            }
        }, 1000);

        if (typeof handpose === 'undefined') throw new Error('Handpose.js库加载失败，请检查网络或CDN链接。');
        model = await handpose.load({ modelType: 'lite' });
        
        // 模型加载成功，无论倒计时是否结束，都立刻进入下一步
        clearInterval(countdownTimer); // 清除定时器
        isModelReady = true;
        modelLoadingIndicator.style.display = 'none';

    } catch (error) {
        if(countdownTimer) clearInterval(countdownTimer); // 如果出错也要清除定时器
        showError(error.message);
    }
}

// 运行
main();

window.addEventListener('resize', () => {
    try {
        setupCamera();
    } catch(error) {
        showError(error.message);
    }
});
