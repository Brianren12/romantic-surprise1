// 获取HTML中的元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const errorDisplay = document.getElementById('error-display');
const modelLoadingIndicator = document.getElementById('model-loading-indicator');

let model;
let particles = [];
let isModelReady = false; // 新增一个标志，判断模型是否已加载完成

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
    // 1. 无论模型是否加载好，都先绘制摄像头背景
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    // 2. 只有当模型准备好后，才执行手势识别和粒子效果
    if (isModelReady) {
        const predictions = await model.estimateHands(video, false);
        if (predictions.length > 0) {
            const indexFingerTip = predictions[0].landmarks[8];
            const [x, y] = indexFingerTip;
            const randomHue = Math.random() * 360;
            const randomColor = `hsl(${randomHue}, 100%, 70%)`;
            const lifeSpan = 100;

            particles.push({ x, y, text: '❤️', life: lifeSpan, maxLife: lifeSpan, size: 50, color: randomColor });
            particles.push({ x: x + 25, y: y + 30, text: '毕雅雯', life: lifeSpan, maxLife: lifeSpan, size: 40, color: randomColor });
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
    try {
        // --- 第一阶段：快速启动相机并显示画面 ---
        await setupCamera();
        video.play();
        // 隐藏初始的、全屏的加载动画
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
        // 开始不带手势识别的绘制循环，让用户能立刻看到自己
        updateAndDraw();

        // --- 第二阶段：在后台加载AI模型 ---
        modelLoadingIndicator.style.display = 'block'; // 显示一个不打扰的底部提示
        if (typeof handpose === 'undefined') throw new Error('Handpose.js库加载失败，请检查网络或CDN链接。');
        
        // 【关键优化点】加载轻量版(lite)模型
        model = await handpose.load({ handposeModel: 'lite' });
        
        console.log("轻量版手势模型加载成功！");
        isModelReady = true; // 设置标志位，让updateAndDraw循环开始执行手势识别
        modelLoadingIndicator.style.display = 'none'; // 隐藏底部提示

    } catch (error) {
        showError(error.message);
    }
}

// 运行
main();

// 监听窗口大小变化
window.addEventListener('resize', () => {
    try {
        setupCamera();
    } catch(error) {
        showError(error.message);
    }
});
