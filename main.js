// 获取HTML中的元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const errorDisplay = document.getElementById('error-display');

let model;
let particles = []; // 用于存放所有粒子

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
    context.clearRect(0, 0, canvas.width, canvas.height); // 清除画布是必要的，放在最前面
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    // 2. 检测手势，并在指尖创建新的粒子
    const predictions = await model.estimateHands(video, false);
    if (predictions.length > 0) {
        const indexFingerTip = predictions [0].landmarks [8];
        const [x, y] = indexFingerTip;

        // 在指尖位置添加一个新的爱心文字粒子
        particles.push({
            x: x,
            y: y,
            text: '❤️', // 爱心
            life: 40,
            maxLife: 40,
            size: 30,
            color: '#ff4757'
        });
        // 同时在稍微偏移的位置添加“毕雅雯”文字粒子
        particles.push({
            x: x + 20, // 向右偏移一点
            y: y + 20, // 向下偏移一点
            text: '毕雅雯',
            life: 40,
            maxLife: 40,
            size: 20,
            color: '#ffffff' // 白色文字
        });
    }

    // 3. 更新并绘制所有粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles [i];
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        const currentOpacity = p.life / p.maxLife;
        const currentSize = p.size * (p.life / p.maxLife);

        context.globalAlpha = currentOpacity;
        context.font = `${currentSize}px sans-serif`; // 使用 sans-serif 字体

        // 绘制文字
        context.fillText(p.text, canvas.width - p.x, p.y);
    }
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
