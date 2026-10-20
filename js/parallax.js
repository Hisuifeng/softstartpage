/**
 * parallax.js
 * 全局视差背景模块
 *
 * mousemove 绑定在 document 上，光标位于任意元素上方时视差都会持续响应。
 *
 * 用法：给参与视差的元素加 data-parallax 属性
 *   data-parallax       深度系数（默认 1，可负数反向，0 不参与）
 *   data-parallax-max   最大偏移像素（默认 20）
 * 例：<div id="wallpaper-layer" data-parallax="1.2" data-parallax-max="24"></div>
 *
 * 全局开关：App.Parallax.setEnabled(bool)；设置面板键 sp_parallax（默认开）
 */
(function () {
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const Parallax = {
        /* ---------- 公共状态 ---------- */
        enabled: true,

        /* ---------- 内部实现 ---------- */
        _targets: [],        // [{ el, depth, max, origTransform }]
        _target: { x: 0, y: 0 },   // 目标位置（归一化 -0.5 ~ 0.5）
        _display: { x: 0, y: 0 },  // 平滑插值位置
        _raf: null,
        _started: false,
        _resizeTimer: null,

        /* ---------- 公共接口 ---------- */

        /** 初始化：收集元素 + 绑定【全局】事件 + 启动循环 */
        init(enabled) {
            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次
            this._inited = true;
            this.enabled = enabled !== false;
            this._collect();

            if (!this._started) {
                document.addEventListener('mousemove', this._onMove, { passive: true });
                document.addEventListener('mouseleave', this._onLeave);
                // resize 防抖：连续拖动窗口时不反复全量收集
                window.addEventListener('resize', () => {
                    clearTimeout(this._resizeTimer);
                    this._resizeTimer = setTimeout(() => this._collect(), 150);
                });
                this._started = true;
                if (this.enabled) this._startLoop();
                else this._resetAll();
            }
        },

        /** 开关（设置面板 / 控制台调用） */
        setEnabled(enabled) {
            this.enabled = !!enabled;
            if (this.enabled) this._startLoop();
            else {
                this._stopLoop();
                this._resetAll();
            }
        },

        /* ---------- 内部实现 ---------- */

        /** 全局鼠标移动：始终更新目标坐标，不随悬停元素变化 */
        _onMove(e) {
            const p = window.App.Parallax;
            p._target.x = (e.clientX / window.innerWidth) - 0.5;
            p._target.y = (e.clientY / window.innerHeight) - 0.5;
            if (p.enabled) p._startLoop(); // 从静止态恢复
        },

        /** 鼠标离开窗口：平滑归位，避免残留偏移 */
        _onLeave() {
            const p = window.App.Parallax;
            p._target.x = 0;
            p._target.y = 0;
            if (p.enabled) p._startLoop(); // 从静止态恢复
        },

        /** 收集所有带 data-parallax 的元素，并记录其原始 transform 以便还原 */
        _collect() {
            this._targets = [];
            document.querySelectorAll('[data-parallax]').forEach((el) => {
                const depth = parseFloat(el.getAttribute('data-parallax')) || 1;
                const max = parseFloat(el.getAttribute('data-parallax-max')) || 20;
                // --parallax-pad 供 style.css 用负 inset 外扩元素：平移到最远（max*depth）时边缘仍盖住视口
                const pad = max * depth;
                el.style.setProperty('--parallax-pad', pad + 'px');
                // 剥离已应用的视差位移：resize 重新收集时，若把当前（含位移的）transform
                // 记为“原始值”，下次绘制会再追加一次位移，导致偏移逐次翻倍累积
                const cur = el.style.transform || '';
                const origTransform = cur
                    .replace(/translate3d\(\s*-?[\d.]+px\s*,\s*-?[\d.]+px\s*,\s*0\s*\)/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                this._targets.push({
                    el,
                    depth,
                    max,
                    origTransform
                });
            });
            // 重新收集后立即按当前插值位置重绘，避免旧 transform 残留
            if (this._started) {
                this._targets.forEach((t) => {
                    if (t.el && t.el.isConnected) t.el.style.transform = t.origTransform;
                });
            }
        },

        _startLoop() {
            if (this._raf) return;
            this._raf = requestAnimationFrame(() => this._tick());
        },

        _stopLoop() {
            if (this._raf) {
                cancelAnimationFrame(this._raf);
                this._raf = null;
            }
        },

        _tick() {
            /* 指数平滑（拖尾效果） */
            const EPS = 0.0004;
            const dx = this._target.x - this._display.x;
            const dy = this._target.y - this._display.y;
            const settled = Math.abs(dx) <= EPS && Math.abs(dy) <= EPS;
            if (settled) {
                this._display.x = this._target.x;
                this._display.y = this._target.y;
            } else {
                this._display.x += dx * 0.08;
                this._display.y += dy * 0.08;
            }

            const { x, y } = this._display;
            this._targets.forEach((t) => {
                if (!t.el || !t.el.isConnected) return;
                const tx = x * t.max * t.depth;
                const ty = y * t.max * t.depth;
                t.el.style.transform = `${t.origTransform} translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
            });

            // 收敛后停表，页面静止时不再空转 rAF（下次鼠标移动/离开时恢复）
            if (settled) {
                this._raf = null;
                return;
            }
            this._raf = requestAnimationFrame(() => this._tick());
        },

        /** 关闭时还原所有元素 */
        _resetAll() {
            this._targets.forEach((t) => {
                if (t.el && t.el.isConnected) {
                    t.el.style.transform = t.origTransform;
                }
            });
            this._display.x = 0;
            this._display.y = 0;
            this._target.x = 0;
            this._target.y = 0;
        }
    };

    window.App.Parallax = Parallax;
})();
