/**
 * particles.js
 * 粒子背景动画模块
 * 挂载于 window.App.Particles
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};

    const Particles = {
        // 内部状态
        canvas: null,
        ctx: null,
        particles: [],
        mouseX: -1000,
        mouseY: -1000,
        animFrame: null,
        // 是否允许显示粒子动画（由设置面板开关控制）
        enabled: true,
        // 主题颜色
        colors: {
            line: 'rgba(160,190,225,0.28)',
            glowStart: 'rgba(200,215,240,0.9)',
            glowMid: 'rgba(170,195,225,0.5)',
            glowEnd: 'rgba(140,170,210,0)',
            core: 'rgba(215,225,245,0.55)'
        },

        /** 初始化粒子画布及动画 */
        init() {
            this.canvas = document.getElementById('particle-canvas');
            if (!this.canvas) {
                console.warn('未找到粒子画布元素，跳过粒子背景');
                return;
            }
            this.ctx = this.canvas.getContext('2d');
            this.bindEvents();
            this.updateColors();
            this.resize();
            this.createParticles();
            if (this.enabled) this.startAnimation();

            // 监听系统主题变化
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            mediaQuery.addEventListener('change', () => {
                this.updateColors();
            });
        },

        /** 启用/停用粒子背景 */
        setEnabled(enabled) {
            this.enabled = !!enabled;
            if (!this.canvas) return;
            this.canvas.style.display = this.enabled ? 'block' : 'none';
            if (this.enabled) {
                if (!this.animFrame) this.startAnimation();
            } else {
                this.stopAnimation();
            }
        },

        /** 停止动画并清空画布 */
        stopAnimation() {
            if (this.animFrame) {
                cancelAnimationFrame(this.animFrame);
                this.animFrame = null;
            }
            if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        },

        /** 绑定鼠标和触摸事件 */
        bindEvents() {
            const handleMouseMove = (e) => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            };
            const handleTouchMove = (e) => {
                if (e.touches[0]) {
                    this.mouseX = e.touches[0].clientX;
                    this.mouseY = e.touches[0].clientY;
                }
            };
            const handleLeave = () => {
                this.mouseX = -1000;
                this.mouseY = -1000;
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('touchmove', handleTouchMove, { passive: true });
            document.addEventListener('mouseleave', handleLeave);
            document.addEventListener('touchend', handleLeave);

            window.addEventListener('resize', () => {
                this.resize();
                this.createParticles();
            });
        },

        /** 根据主题更新粒子颜色 */
        updateColors() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                this.colors = {
                    line: 'rgba(80,100,140,0.25)',
                    glowStart: 'rgba(120,140,180,0.9)',
                    glowMid: 'rgba(100,120,160,0.4)',
                    glowEnd: 'rgba(80,100,140,0)',
                    core: 'rgba(60,80,120,0.55)'
                };
            } else {
                this.colors = {
                    line: 'rgba(160,190,225,0.28)',
                    glowStart: 'rgba(200,215,240,0.9)',
                    glowMid: 'rgba(170,195,225,0.5)',
                    glowEnd: 'rgba(140,170,210,0)',
                    core: 'rgba(215,225,245,0.55)'
                };
            }
        },

        /** 调整画布尺寸 */
        resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
        },

        /** 生成粒子 */
        createParticles() {
            this.particles = [];
            const w = window.innerWidth;
            const h = window.innerHeight;
            const count = 80;
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.45,
                    vy: (Math.random() - 0.5) * 0.45,
                    radius: Math.random() * 1.6 + 0.8,
                    opacity: Math.random() * 0.4 + 0.25
                });
            }
        },

        /** 更新粒子位置 */
        updateParticles() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const pList = this.particles;

            for (const p of pList) {
                p.x += p.vx;
                p.y += p.vy;

                // 边界环绕
                if (p.x < -20) p.x = w + 20;
                if (p.x > w + 20) p.x = -20;
                if (p.y < -20) p.y = h + 20;
                if (p.y > h + 20) p.y = -20;

                // 鼠标排斥
                const dx = p.x - this.mouseX;
                const dy = p.y - this.mouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100 && dist > 0.1) {
                    const force = (100 - dist) / 100;
                    p.vx += (dx / dist) * force * 0.05;
                    p.vy += (dy / dist) * force * 0.05;
                }

                // 速度阻尼
                p.vx *= 0.999;
                p.vy *= 0.999;

                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > 1.5) {
                    p.vx = (p.vx / speed) * 1.5;
                    p.vy = (p.vy / speed) * 1.5;
                }
                if (speed < 0.15 && Math.random() < 0.005) {
                    p.vx += (Math.random() - 0.5) * 0.3;
                    p.vy += (Math.random() - 0.5) * 0.3;
                }
            }
        },

        /** 绘制粒子与连线 */
        draw() {
            const ctx = this.ctx;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const cols = this.colors;
            const pList = this.particles;

            ctx.clearRect(0, 0, w, h);

            // 连线
            for (let i = 0; i < pList.length; i++) {
                for (let j = i + 1; j < pList.length; j++) {
                    const dx = pList[i].x - pList[j].x;
                    const dy = pList[i].y - pList[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 140) {
                        const opacity = (1 - dist / 140) * 0.28;
                        ctx.beginPath();
                        ctx.moveTo(pList[i].x, pList[i].y);
                        ctx.lineTo(pList[j].x, pList[j].y);
                        ctx.strokeStyle = cols.line.replace(/[\d.]+\)$/, `${opacity})`);
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            // 粒子
            for (const p of pList) {
                // 光晕
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3.5);
                grad.addColorStop(0, cols.glowStart.replace(/[\d.]+\)$/, `${p.opacity * 1.1})`));
                grad.addColorStop(0.35, cols.glowMid.replace(/[\d.]+\)$/, `${p.opacity * 0.5})`));
                grad.addColorStop(1, cols.glowEnd);
                ctx.fillStyle = grad;
                ctx.fill();

                // 核心
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = cols.core.replace(/[\d.]+\)$/, `${p.opacity + 0.35})`);
                ctx.fill();
            }
        },

        /** 动画循环 */
        startAnimation() {
            const animate = () => {
                this.updateParticles();
                this.draw();
                this.animFrame = requestAnimationFrame(animate);
            };
            this.animFrame = requestAnimationFrame(animate);
        }
    };

    // 暴露到全局
    window.App.Particles = Particles;
})();