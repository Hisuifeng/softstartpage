/**
 * utils.js
 * 通用工具函数模块
 * 挂载于 window.App.Utils
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};

    const Utils = {
        /**
         * 从 localStorage 加载数据，若不存在则返回默认值
         * @param {string} key
         * @param {*} def 默认值
         * @returns {*}
         */
        load(key, def) {
            try {
                const val = localStorage.getItem(key);
                return val ? JSON.parse(val) : def;
            } catch {
                return def;
            }
        },

        /**
         * 将数据保存到 localStorage
         * @param {string} key
         * @param {*} val
         */
        save(key, val) {
            try {
                localStorage.setItem(key, JSON.stringify(val));
            } catch {
                App.Utils.showToast?.('存储异常');
            }
        },

        /**
         * 转义 HTML 特殊字符，防止 XSS
         * @param {string} str
         * @returns {string}
         */
        escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        /**
         * 生成唯一 ID
         * @returns {string}
         */
        genId() {
            return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        },

        /**
         * 获取名称的首字符作为图标回退文字
         * @param {string} name
         * @returns {string}
         */
        getFallbackChar(name) {
            const c = (name || '').trim().charAt(0) || '?';
            return /[\u4e00-\u9fff]/.test(c) ? c : c.toUpperCase();
        },

        /**
         * 显示 Toast 提示
         * @param {string} msg
         */
        showToast(msg) {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.classList.add('show');
            clearTimeout(window.__toastTimer);
            window.__toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        },

        // ==================== 扁平 SVG 图标 ====================
        // 内联注入，不依赖外部文件，本地 file:// 打开即可使用
        // 源文件见 svg/ 文件夹（内容与下方保持一致）
        ICONS: {
            close: '<path d="M18 6 6 18M6 6l12 12"/>',
            settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
            globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
            weather: '<circle cx="8" cy="8" r="3.6"/><path d="M8 1.6v1.9M8 12.5v1.9M1.6 8h1.9M12.5 8h1.9M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/><path d="M5 20.5a4 4 0 0 1-.7-7.9 5.5 5.5 0 0 1 9.9-1.9A3.9 3.9 0 0 1 18.5 20H5.5a4 4 0 0 1-.5-.5z"/>',
            refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
            location: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
            rain: '<path d="M5.5 15.6a3.9 3.9 0 0 1-.4-7.8 5.5 5.5 0 0 1 10-1.8A4 4 0 0 1 18 17.6H6.3a3.9 3.9 0 0 1-.8-2z"/><path d="M8.3 17.8l-1 2M12.3 17.8l-1 2M16.3 17.8l-1 2"/>',
            clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
            image: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 15.5l-6-5.5-9 9"/>',
            folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
            keyboard: '<rect x="2.5" y="6" width="19" height="12.5" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 14h.01M17 14h.01M9.5 14h5"/>',
            search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="M16 16l5 5"/>',
            wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
            pin: '<path d="M6 3h12l-3.2 8H9.2L6 3z"/><path d="M12 11v9"/>',
            thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="M12 9v6"/>',
            droplet: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
            snowflake: '<path d="M12 2v20M4.2 7l15.6 10M4.2 17l15.6-10"/><path d="M8 4.5 12 6l4-1.5M8 19.5l4-1.5 4 1.5M3.8 9.5l3.2 2-3.2 2M20.2 9.5l-3.2 2 3.2 2"/>',
            sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.7 4.7l1.7 1.7M17.6 17.6l1.7 1.7M4.7 19.3l1.7-1.7M17.6 6.4l1.7-1.7"/>',
            cloud: '<path d="M6.5 17.5a4 4 0 0 1-.6-7.9 5.6 5.6 0 0 1 10.3-1.6A3.9 3.9 0 0 1 18 17.5H6.5z"/>',
            fog: '<path d="M6.5 14.5a3.8 3.8 0 0 1-.5-7.4 5.4 5.4 0 0 1 9.9-1.5 3.9 3.9 0 0 1 2.1 7.2A3.6 3.6 0 0 1 16 14.5H6.5z"/><path d="M3.5 17.5h17M6 20.5h12"/>',
            drizzle: '<path d="M6.5 16.5a4 4 0 0 1-.6-7.9 5.6 5.6 0 0 1 10.3-1.6A3.9 3.9 0 0 1 18 16.5H6.5z"/><path d="M8.8 18.5v2M12 18.5v2M15.2 18.5v2"/>',
            snow: '<path d="M6.5 16.5a4 4 0 0 1-.6-7.9 5.6 5.6 0 0 1 10.3-1.6A3.9 3.9 0 0 1 18 16.5H6.5z"/><path d="M9 18.6v2.2M7.9 19.7h2.2M12.4 18.6v2.2M11.3 19.7h2.2M15.8 18.6v2.2M14.7 19.7h2.2"/>',
            storm: '<path d="M6.5 13.5a3.8 3.8 0 0 1-.5-7.4 5.4 5.4 0 0 1 9.9-1.5 3.9 3.9 0 0 1 2.1 7.2A3.6 3.6 0 0 1 15.5 13.5H6.5z"/><path d="M13 8.5l-4.2 5.8h3L9.8 20.5l6.2-7h-3l1.2-5z"/>',
            unknown: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9.3a2.4 2.4 0 1 1 3.7 2c-.7.5-1.5 1-1.5 2.2"/><path d="M12 16.8h.01"/>'
        },

        /**
         * 生成扁平 SVG 图标的完整 HTML（span 包裹）
         * @param {string} name 图标名称（对应 ICONS 键）
         * @returns {string}
         */
        svg(name) {
            const inner = this.ICONS[name] || this.ICONS.close;
            return `<span class="svg-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
        },

        /**
         * 生成扁平 SVG 图标的内联 data URI（用于 Canvas 绘制）
         * @param {string} name 图标名称（对应 ICONS 键）
         * @param {string} [color] 描边颜色，默认跟随当前主题文字色
         * @returns {string}
         */
        svgDataUri(name, color = '#9aa0a6') {
            const inner = this.ICONS[name] || this.ICONS.unknown;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
            return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        },

        /**
         * 将静态 HTML 中的 [data-svg] 占位替换为内联 SVG
         * @param {Element} [root] 检索范围，默认整个文档
         */
        injectSvgIcons(root = document) {
            root.querySelectorAll('[data-svg]').forEach(el => {
                const name = el.getAttribute('data-svg');
                const inner = this.ICONS[name];
                if (!inner) return;
                const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                ['viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"', 'stroke-width="2"',
                    'stroke-linecap="round"', 'stroke-linejoin="round"'
                ].forEach(attr => {
                    const sp = attr.indexOf('=');
                    svgEl.setAttribute(attr.slice(0, sp), attr.slice(sp + 2, -1));
                });
                svgEl.setAttribute('aria-hidden', 'true');
                svgEl.innerHTML = inner;
                el.textContent = '';
                el.appendChild(svgEl);
            });
        }
    };

    // 暴露到全局
    window.App.Utils = Utils;
})();