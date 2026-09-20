/**
 * parallax.js
 * 全局视差背景模块
 *
 * 关键点：鼠标侦测是【全局】的 —— mousemove 绑定在 document 上，
 * 因此不管光标位于页面上的哪个元素（div/容器/文本/其他模块）上方，
 * 视差效果都会持续响应。这修复了 test.html 中
 * 把 mousemove 只绑定到 .background-image 元素本身、
 * 导致悬停到其他容器上时视差中断/回跳的视觉 bug。
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
        _targets: [],        // [{ el, orig, origTransform }]
        _target: { x: 0, y: 0 },   // 目标位置（归一化 -0.5 ~ 0.5）
        _display: { x: 0, y: 0 },  // 平滑插值位置
        _raf: null,
        _started: false,

        /* ---------- 公共接口 ---------- */

        /** 初始化：收集元素 + 绑定【全局】事件 + 启动循环 */
        init(enabled) {
            this.enabled = enabled !== false;
            this._collect();

            if (!this._started) {
                document.addEventListener('mousemove', this._onMove, { passive: true });
                document.addEventListener('mouseenter', this._onEnter);
                document.addEventListener('mouseleave', this._onLeave);
                window.addEventListener('resize', this._collect);
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
        },

        /** 进入窗口：无操作（坐标由 mousemove 驱动） */
        _onEnter() {},

        /** 鼠标离开窗口：平滑归位，避免残留偏移 */
        _onLeave() {
            const p = window.App.Parallax;
            p._target.x = 0;
            p._target.y = 0;
        },

        /** 收集所有带 data-parallax 的元素，并记录其原始 transform 以便还原 */
        _collect() {
            this._targets = [];
            document.querySelectorAll('[data-parallax]').forEach((el) => {
                const depth = parseFloat(el.getAttribute('data-parallax')) || 1;
                const max = parseFloat(el.getAttribute('data-parallax-max')) || 20;
                /* 实际最远偏移 = max * depth（_tick 中 tx = x*max*depth），
                   因此外扩量也要用 max*depth，而不能只用 max，
                   否则 depth>1 时最远点仍会露出边缘。 */
                const pad = max * depth;
                /* 把自身最大偏移写为 CSS 变量 --parallax-pad 供 style.css 读取，
                   style.css 用负 inset 把元素四周外扩 pad 像素 ——
                   视差平移到最远时，外扩边缘正好盖住视口，不会露出后面的页面背景。 */
                el.style.setProperty('--parallax-pad', pad + 'px');
                el.style.setProperty('--parallax-pad', max + 'px');
                this._targets.push({
                    el,
                    depth,
                    max,
                    origTransform: el.style.transform || ''
                });
            });
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
            this._raf = requestAnimationFrame(() => this._tick());

            /* 指数平滑（拖尾效果） */
            this._display.x += (this._target.x - this._display.x) * 0.08;
            this._display.y += (this._target.y - this._display.y) * 0.08;

            const { x, y } = this._display;
            this._targets.forEach((t) => {
                if (!t.el || !t.el.isConnected) return;
                const tx = x * t.max * t.depth;
                const ty = y * t.max * t.depth;
                t.el.style.transform = `${t.origTransform} translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
            });
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
