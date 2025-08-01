// 获取HTML中的元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const errorDisplay = document.getElementById('error-display');

let model;
let particles = []; // 用于存放所有爱心粒子

// 错误处理函数
function showError(message) {
    console.error(message);
    errorDisplay.style.display = 'block';
    errorDisplay.innerText = '出错了 T_T: \n' + message;
    loadingOverlay.style.display = 'none';
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
    // 1. 绘制摄像头背景（镜像效果）
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    // 2. 检测手势，并在指尖创建新的粒子
    const predictions = await model.estimateHands(video, false);
    if (predictions.length > 0) {
        const indexFingerTip = predictions[0].landmarks[8];
        const [x, y] = indexFingerTip;

        // 在指尖位置添加一个新粒子
        particles.push({
            x: x,
            y: y,
            life: 40,      // 生命值，决定粒子存活多久
            maxLife: 40,   // 最大生命值，用于计算大小和透明度
            size: 30,      // 初始大小
            color: '#ff4757'
        });
    }

    // 3. 更新并绘制所有粒子
    // 倒序循环，方便在循环中安全地移除元素
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life--; // 生命值减少

        // 如果生命值耗尽，则从数组中移除该粒子
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue; // 继续下一个粒子
        }

        // 计算当前粒子的大小和透明度
        const currentOpacity = p.life / p.maxLife;
        const currentSize = p.size * (p.life / p.maxLife);

        // 设置绘制属性
        context.globalAlpha = currentOpacity;
        context.font = `${currentSize}px Arial`;

        // 绘制爱心（注意：因为画布是镜像的，所以粒子的X坐标也需要镜像绘制）
        context.fillText('❤️', canvas.width - p.x, p.y);
    }
    // 重置全局透明度，以免影响下一帧的背景绘制
    context.globalAlpha = 1.0;

    // 4. 持续循环
    requestAnimationFrame(updateAndDraw);
}

// 主函数入口
async function main() {
    try {
        await setupCamera();
        video.play();

        if (typeof handpose === 'undefined') throw new Error('Handpose.js库加载失败，请检查网络或CDN链接。');
        model = await handpose.load();

        loadingOverlay.style.opacity = '0';
        setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);

        // 启动核心的更新与绘制循环
        updateAndDraw();

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