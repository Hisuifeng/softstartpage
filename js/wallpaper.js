/**
 * wallpaper.js
 * 壁纸模块
 * 挂载于 window.App.Wallpaper
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};

    const Wallpaper = {
        // DOM 元素
        layer: null,
        preview: null,
        urlInput: null,

        // 当前壁纸状态
        wallpaper: null,

        // 各主题默认壁纸列表缓存（静态托管下通过 HEAD 探测 img/wallpaper/{black|light}/）
        _defaults: { black: null, light: null },

        /** 当前主题对应的壁纸子目录 */
        _themeDir() {
            const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
            return light ? 'light' : 'black';
        },

        /**
         * 随机挑选当前主题目录下【真实存在】的一张默认壁纸。
         *
         * 【关键改动】先随机确定【单个】索引 → 只对该 URL 发【一次】请求，
         * 并校验\"响应的 Content-Type 以 image/ 开头\"才算命中：
         *
         *   · GitHub Pages：不存在的 wallpaper{N}.jpg → 真 404 → 不通过，
         *     换下一个随机索引重试。
         *   · Cloudflare Pages（SPA fallback 开启）：不存在的资源会被兜底成
         *     200 + text/html 的 index.html（HEAD 的 .ok 会误判成\"壁纸存在\"）。
         *     因此这里不信任 HEAD/.ok，改为校验 Content-Type 必须 image/* ——
         *     SPA 兜底页是 text/html，即使 200 也过不了 image/ 校验，
         *     自然被排除，绝不会被当成壁纸塞进候选列表。
         *
         * 相比旧版\"HEAD 连发最多 50 个去探测存在哪些\"（在 SPA fallback 下
         * 会把 50 个不存在的都探测成\"存在\"、列表塞满兜底页），本次：
         *   - 每次随机只发 1 个请求（命中即停），不会对整目录连发探测；
         *   - 判定依据由\"HTTP 200\"改为\"真图片 Content-Type\"，对托管形态免疫。
         *
         * @param {string} dir 'light' | 'black'
         * @returns {Promise<string|null>} 壁纸 URL；探测不到返回 null
         */
        async _randomWallpaper(dir) {
            const count = App.Utils.load('sp_theme_wallpaper_count', 8) || 8;
            const maxAttempts = 6;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const i = Math.floor(Math.random() * count);
                const url = `img/wallpaper/${dir}/wallpaper${i}.jpg`;
                let isImage = false;
                try {
                    const res = await fetch(url, { method: 'HEAD' });
                    const type = (res.headers.get('content-type') || '').toLowerCase();
                    isImage = res.ok && type.startsWith('image/');
                } catch (e) { isImage = false; }
                if (isImage) return url;
            }
            return null;
        },

        /** 未设置壁纸时：随机选用当前主题的真实默认壁纸（只发一次请求） */
        _applyDefaultForTheme() {
            if (!this.layer) return;
            const dir = this._themeDir();
            const hide = () => {
                this.layer.style.backgroundImage = 'none';
                this.layer.classList.add('hidden');
            };

            const render = (url) => {
                if (!url) { hide(); return; }
                this.layer.style.backgroundImage = `url('${url}')`;
                this.layer.classList.remove('hidden');
            };

            if (this._defaults[dir]) {
                render(this._defaults[dir]);
            } else {
                this._randomWallpaper(dir).then(url => {
                    this._defaults[dir] = url;
                    // 探测期间用户可能已设置壁纸
                    if (this.wallpaper.type === 'none') render(url);
                    else if (!this.wallpaper.type) hide();
                }).catch(() => hide());
            }
        },

        /**
         * 初始化壁纸模块
         * @param {object} [initialWallpaper] 初始壁纸对象，若不传则从 localStorage 读取
         */
        init(initialWallpaper) {
            this.layer = document.getElementById('wallpaper-layer');
            this.preview = document.getElementById('wallpaperPreview');
            this.urlInput = document.getElementById('wallpaperUrlInput');

            if (!this.layer) {
                console.warn('未找到壁纸图层，跳过壁纸模块');
                return;
            }

            // 初始化状态
            if (initialWallpaper) {
                this.wallpaper = initialWallpaper;
            } else {
                this.wallpaper = App.Utils.load('sp_wallpaper', {
                    type: 'none',
                    value: ''
                });
            }

            // 绑定按钮事件（注意：这些按钮可能不在主界面，而是在设置面板中，我们使用全局选择器）
            this._bindEvents();
            this.applyToUI();

            // 主题切换时，若未设置自定义壁纸则换成对应主题的默认壁纸
            const mq = window.matchMedia('(prefers-color-scheme: light)');
            const onThemeChange = () => {
                if (this.wallpaper.type === 'none') this._applyDefaultForTheme();
            };
            if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
            else if (mq.addListener) mq.addListener(onThemeChange);

            // 如果之前是 URL 壁纸，将 URL 填入输入框
            if (this.wallpaper.type === 'url' && this.urlInput) {
                this.urlInput.value = this.wallpaper.value;
            }
        },

        /**
         * 应用壁纸到 UI 并保存
         * @param {string} type - 'url' | 'local' | 'none'
         * @param {string} value - 图片 URL 或 Base64 数据
         */
        set(type, value) {
            this.wallpaper = { type, value };
            App.Utils.save('sp_wallpaper', this.wallpaper);
            this.applyToUI();
        },

        /** 更新界面显示 */
        applyToUI() {
            if (!this.layer) return;

            if (this.wallpaper.type === 'url' || this.wallpaper.type === 'local') {
                const safeCss = this._sanitizeCssUrl(this.wallpaper.value);
                if (safeCss) {
                    this.layer.style.backgroundImage = `url('${safeCss}')`;
                    this.layer.classList.remove('hidden');
                    if (this.preview) {
                        this.preview.style.backgroundImage = `url('${safeCss}')`;
                    }
                    return;
                }
            }
            // 未设置壁纸 → 若开启"默认随机壁纸"则使用当前主题的默认随机壁纸
            if (window.App.state.defaultWallpaperEnabled !== false) {
                this._applyDefaultForTheme();
            } else if (this.layer) {
                this.layer.style.backgroundImage = 'none';
                this.layer.classList.add('hidden');
            }
            if (this.preview) {
                this.preview.style.backgroundImage = 'none';
            }
        },

        /**
         * 清理壁纸值，防止 CSS 注入
         * 仅允许 http(s) 与 data:image 协议，并转义引号/反斜杠/控制字符
         * @param {string} value
         * @returns {string}
         */
        _sanitizeCssUrl(value) {
            if (!value) return '';
            const s = String(value).trim();
            if (!/^(https?:|data:image\/)/i.test(s)) return '';
            // 去掉可能导致 url() 逃逸或注入的字符
            return s.replace(/[\u0000-\u001f\u007f"\\']/g, ch => '\\' + ch);
        },

        /** 获取当前壁纸对象 */
        get() {
            return this.wallpaper;
        },

        /** 清除壁纸 */
        clear() {
            this.set('none', '');
            if (this.urlInput) this.urlInput.value = '';
            App.Utils.showToast('壁纸已清除');
        },

        /**
         * 从网络 URL 设置壁纸
         * @param {string} url
         */
        applyUrl(url) {
            if (!url || !url.trim()) {
                App.Utils.showToast('请输入图片URL');
                return;
            }
            const trimmed = url.trim();
            if (!/^(https?:|data:image\/)/i.test(trimmed)) {
                App.Utils.showToast('仅支持 http(s) 或图片数据 URL');
                return;
            }
            this.set('url', trimmed);
            App.Utils.showToast('壁纸已应用');
        },

        /**
         * 从文件对象设置本地壁纸
         * @param {File} file
         */
        applyLocal(file) {
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                App.Utils.showToast('图片大小不能超过2MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                this.set('local', ev.target.result);
                App.Utils.showToast('本地壁纸已应用');
            };
            reader.onerror = () => App.Utils.showToast('读取文件失败');
            reader.readAsDataURL(file);
        },

        /** 绑定事件监听器（通过 ID 选择器，在打开设置面板时这些元素存在） */
        _bindEvents() {
            // 注意：这些按钮在设置面板中，可能尚未打开，但我们仍可绑定
            const applyBtn = document.getElementById('applyUrlWallpaper');
            const clearBtn = document.getElementById('clearWallpaper');
            const fileInput = document.getElementById('wallpaperFileInput');

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    if (this.urlInput) {
                        this.applyUrl(this.urlInput.value);
                    }
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clear());
            }

            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    this.applyLocal(e.target.files[0]);
                    // 重置 input，以便再次选择同一文件
                    e.target.value = '';
                });
            }
        }
    };

    // 暴露到全局
    window.App.Wallpaper = Wallpaper;
})();