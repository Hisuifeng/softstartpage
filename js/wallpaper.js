/**
 * wallpaper.js
 * 壁纸模块
 * 挂载于 window.App.Wallpaper
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const REPO_WP_EXT = 'jpg';

    const Wallpaper = {
        // DOM 元素
        layer: null,
        preview: null,
        urlInput: null,
        hint: null,
        hintMsg: null,
        hintBtn: null,
        hintLabel: null,

        // 当前壁纸状态（M13 单一事实来源：视图指向 state.wallpaper，其他模块可直接读取）
        get wallpaper() { return window.App.state.wallpaper; },
        set wallpaper(v) { window.App.state.wallpaper = v; },

        // 当前展示的仓库默认壁纸 URL（用于“固定该壁纸”）
        _currentDefaultUrl: null,

        // 各主题当前展示的默认壁纸 URL 缓存
        _defaults: { black: null, light: null },

        // 壁纸元数据（img/wallpaper/wallpaper_about.json）：数量 + 推荐者信息
        _about: null,
        _aboutPromise: null,

        /** 当前主题对应的壁纸子目录 */
        _themeDir() {
            const light = window.App.Theme ? !App.Theme.isDark()
                : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
            return light ? 'light' : 'black';
        },

        /** 是否开启“使用高清原图”（仅影响仓库自带壁纸，网络/本地壁纸不受影响） */
        _isHdEnabled() {
            return !!(window.App.state && window.App.state.hdWallpaperEnabled === true);
        },

        /**
         * 把仓库壁纸的规范路径解析为实际展示 URL
         * · 构建产物（REPO_WP_EXT='webp'）且开启高清 → img/wallpaper/{dir}/orig/wallpaper{n}.jpg
         * · 源码模式（REPO_WP_EXT='jpg'）与未开启高清 → 原样返回
         * @param {string} url 仓库壁纸规范路径（压缩版）
         * @returns {string}
         */
        _resolveUrl(url) {
            if (!this._isHdEnabled() || REPO_WP_EXT !== 'webp') return String(url || '');
            const m = /^img\/wallpaper\/(black|light)\/wallpaper(\d+)\.(?:jpg|jpeg|png|webp)$/i.exec(String(url || ''));
            if (!m) return String(url || '');
            return `img/wallpaper/${m[1]}/orig/wallpaper${m[2]}.jpg`;
        },

        /**
         * 读取壁纸元数据 img/wallpaper/wallpaper_about.json（只请求一次并缓存）。
         * 提供每主题的壁纸张数（black_num / light_num）与推荐者（*_about）。
         * 失败（文件缺失 / file:// 跨域）返回 null，调用方回退到 _probeRandomWallpaper。
         * @returns {Promise<object|null>}
         */
        _loadAbout() {
            if (this._about) return Promise.resolve(this._about);
            if (this._aboutPromise) return this._aboutPromise;
            this._aboutPromise = fetch('img/wallpaper/wallpaper_about.json', { cache: 'no-cache' })
                .then(res => (res.ok ? res.json() : null))
                .then(json => {
                    if (json && typeof json === 'object') this._about = json;
                    return this._about;
                })
                .catch(() => null);
            return this._aboutPromise;
        },

        /** 某主题的壁纸张数（来自元数据；缺失返回 0） */
        _themeCount(dir) {
            const n = this._about ? this._about[dir === 'light' ? 'light_num' : 'black_num'] : 0;
            return Number.isFinite(n) && n > 0 ? n : 0;
        },

        /**
         * 从壁纸 URL 反查推荐者信息（如“由 Mashiro-Neri 推荐”）。
         * 按文件名（wallpaper{N}）在对应主题的 *_about 列表中匹配；无则返回空串。
         * @param {string} url
         * @returns {string}
         */
        _aboutFor(url) {
            if (!this._about || !url) return '';
            const m = /wallpaper(\d+)\.(?:jpg|jpeg|png|webp)$/i.exec(String(url));
            if (!m) return '';
            const dir = /\/black\//i.test(url) ? 'black' : (/\/light\//i.test(url) ? 'light' : '');
            if (!dir) return '';
            const list = this._about[dir === 'light' ? 'light_about' : 'black_about'];
            if (!Array.isArray(list)) return '';
            const name = 'wallpaper' + m[1];
            const hit = list.find(it => it && it.paper_name === name);
            return hit && hit.title ? String(hit.title) : '';
        },

        /**
         * 随机挑选当前主题目录下的一张默认壁纸。
         * 读取元数据声明的数量，在 [0, count) 中随机取一个索引直接返回；
         * 元数据不可用时回退 _probeRandomWallpaper。
         * @param {string} dir 'light' | 'black'
         * @returns {Promise<string|null>} 壁纸 URL；取不到返回 null
         */
        async _randomWallpaper(dir) {
            await this._loadAbout();
            const count = this._themeCount(dir);
            if (count > 0) {
                const i = Math.floor(Math.random() * count);
                return `img/wallpaper/${dir}/wallpaper${i}.${REPO_WP_EXT}`;
            }
            return this._probeRandomWallpaper(dir);
        },

        /**
         * 元数据不可用时的回退：随机索引发 HEAD 请求，校验响应 Content-Type
         * 以 image/ 开头才算命中（避免 SPA 兜底页的 200 + text/html 被误判）。
         * @param {string} dir 'light' | 'black'
         * @returns {Promise<string|null>} 壁纸 URL；探测不到返回 null
         */
        async _probeRandomWallpaper(dir) {
            const count = App.Utils.load('sp_theme_wallpaper_count', 8) || 8;
            const maxAttempts = 6;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const i = Math.floor(Math.random() * count);
                const url = `img/wallpaper/${dir}/wallpaper${i}.${REPO_WP_EXT}`;
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

        /**
         * 预载成功后再替换背景（L5：消除网络未就绪期间的纯色闪断，淡入过渡）
         * @param {string} cssUrl 已经过 _resolveUrl/_sanitizeCssUrl 的 URL 片段
         */
        _setBackgroundPreloaded(cssUrl) {
            if (!this.layer) return;
            if (!cssUrl) {
                this.layer.style.backgroundImage = 'none';
                return;
            }
            const img = new Image();
            img.onload = () => {
                // 探测期间用户可能已切换别的壁纸
                if (this._preloadToken !== img) return;
                this.layer.style.backgroundImage = `url('${cssUrl}')`;
                this.layer.classList.remove('hidden', 'wp-preload-fade');
                void this.layer.offsetWidth; // 强制重排以重新触发动画
                this.layer.classList.add('wp-preload-fade');
            };
            img.onerror = () => {
                if (this._preloadToken !== img) return;
                this.layer.style.backgroundImage = 'none';
                this.layer.classList.add('hidden');
                this._updateHint();
            };
            this._preloadToken = img;
            img.src = cssUrl;
        },

        /** 未设置壁纸时：随机选用当前主题的真实默认壁纸（只发一次请求） */
        _applyDefaultForTheme() {
            if (!this.layer) return;
            const dir = this._themeDir();
            const hide = () => {
                this._currentDefaultUrl = null;
                this._preloadToken = null; // 作废进行中的预载
                this.layer.style.backgroundImage = 'none';
                this.layer.classList.add('hidden');
                this._updateHint();
            };

            const render = (url) => {
                if (!url) { hide(); return; }
                this._currentDefaultUrl = url;
                this._setBackgroundPreloaded(this._resolveUrl(url));
                this._updateHint();
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
            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次
            this._inited = true;
            this.layer = document.getElementById('wallpaper-layer');
            this.preview = document.getElementById('wallpaperPreview');
            this.urlInput = document.getElementById('wallpaperUrlInput');
            this.hint = document.getElementById('wallpaperHint');
            this.hintMsg = document.getElementById('wallpaperHintMsg');
            this.hintAbout = document.getElementById('wallpaperHintAbout');
            this.hintBtn = document.getElementById('wallpaperPinBtn');
            this.hintLabel = document.getElementById('wallpaperPinLabel');
            this.settingsAbout = document.getElementById('wallpaperAbout');

            if (!this.layer) {
                console.warn('未找到壁纸图层，跳过壁纸模块');
                return;
            }

            // 固定/取消固定按钮
            if (this.hintBtn) {
                this.hintBtn.addEventListener('click', () => this.togglePin());
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

            this._bindEvents();
            this.applyToUI();

            // 预加载壁纸元数据（数量 / 推荐者），加载完刷新提示条
            this._loadAbout().then(() => this._updateHint());

            // 主题切换时，若未设置自定义壁纸则换成对应主题的默认壁纸
            const onThemeChange = () => {
                if (this.wallpaper.type === 'none') this._applyDefaultForTheme();
            };
            window.addEventListener('themechange', onThemeChange);

            // 若当前为 URL 壁纸，将 URL 回填输入框
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

            // 固定的仓库壁纸
            if (this.wallpaper.type === 'fixed') {
                const url = this._safeRepoUrl(this.wallpaper.value);
                if (url) {
                    this._currentDefaultUrl = url;
                    // 开关关闭时隐藏壁纸（固定状态仍保留，设置面板仍显示“壁纸已固定”）
                    if (window.App.state.defaultWallpaperEnabled !== false) {
                        this._setBackgroundPreloaded(this._resolveUrl(url));
                        if (this.preview) {
                            this.preview.style.backgroundImage = `url('${url}')`;
                        }
                    } else {
                        this._preloadToken = null; // 作废进行中的预载
                        this.layer.style.backgroundImage = 'none';
                        this.layer.classList.add('hidden');
                        if (this.preview) {
                            this.preview.style.backgroundImage = 'none';
                        }
                    }
                    this._updateHint();
                    return;
                }
                // 值非法则退化为未设置
                this.wallpaper = { type: 'none', value: '' };
            }

            if (this.wallpaper.type === 'url' || this.wallpaper.type === 'local') {
                const safeCss = this._sanitizeCssUrl(this.wallpaper.value);
                if (safeCss) {
                    this._currentDefaultUrl = null;
                    this._setBackgroundPreloaded(safeCss);
                    if (this.preview) {
                        this.preview.style.backgroundImage = `url('${safeCss}')`;
                    }
                    this._updateHint();
                    return;
                }
            }
            // 未设置壁纸 → 若开启"默认随机壁纸"则使用当前主题的默认随机壁纸
            if (window.App.state.defaultWallpaperEnabled !== false) {
                this._applyDefaultForTheme();
            } else {
                this._currentDefaultUrl = null;
                this._preloadToken = null; // 作废进行中的预载
                if (this.layer) {
                    this.layer.style.backgroundImage = 'none';
                    this.layer.classList.add('hidden');
                }
            }
            if (this.preview) {
                this.preview.style.backgroundImage = 'none';
            }
            this._updateHint();
        },

        /**
         * 校验并规范化仓库壁纸相对路径
         * 仅允许 img/wallpaper/{black|light}/wallpaper{n}.jpg
         * @param {string} value
         * @returns {string} 合法则返回该路径，否则返回空串
         */
        _safeRepoUrl(value) {
            const s = String(value || '').trim();
            if (/^img\/wallpaper\/(black|light)\/orig\/wallpaper\d+\.jpe?g$/i.test(s)) return s;
            if (!/^img\/wallpaper\/(black|light)\/wallpaper\d+\.(jpg|jpeg|png|webp)$/i.test(s)) return '';
            if (REPO_WP_EXT === 'webp') return s.replace(/\.jpe?g$/i, '.webp');
            return s;
        },

        /** 当前是否为固定的仓库壁纸 */
        isPinned() {
            return !!this.wallpaper && this.wallpaper.type === 'fixed';
        },

        /** 固定当前展示的仓库默认壁纸 */
        pin() {
            const url = this._currentDefaultUrl;
            if (!url || !this._safeRepoUrl(url)) {
                App.Utils.showToast('当前壁纸无法固定');
                return;
            }
            this.wallpaper = { type: 'fixed', value: url };
            App.Utils.save('sp_wallpaper', this.wallpaper);
            this.applyToUI();
            App.Utils.showToast('已固定该壁纸');
        },

        /** 取消固定，恢复默认随机壁纸 */
        unpin() {
            this.wallpaper = { type: 'none', value: '' };
            App.Utils.save('sp_wallpaper', this.wallpaper);
            this.applyToUI();
            App.Utils.showToast('已取消固定');
        },

        /** 切换固定状态 */
        togglePin() {
            if (this.isPinned()) this.unpin();
            else this.pin();
        },

        /** 更新右上角提示条：仅在使用仓库壁纸（默认随机或已固定）且壁纸可见时显示 */
        _updateHint() {
            this._updateSettingsAbout();
            if (!this.hint) return;
            const pinned = this.isPinned();
            const visible = this.layer && !this.layer.classList.contains('hidden');
            const showDefault = this.wallpaper && this.wallpaper.type === 'none'
                && window.App.state.defaultWallpaperEnabled !== false
                && this._currentDefaultUrl
                && visible;

            if (visible && (pinned || showDefault)) {
                this.hint.classList.remove('hidden');
                this.hint.classList.toggle('pinned', pinned);
                if (this.hintLabel) this.hintLabel.textContent = pinned ? '取消固定' : '固定该壁纸';
                if (this.hintBtn) this.hintBtn.title = pinned ? '取消固定' : '固定该壁纸';

                // 推荐者信息（仅未固定时展示；无匹配则隐藏）
                if (this.hintAbout) {
                    const about = !pinned ? this._aboutFor(this._currentDefaultUrl) : '';
                    if (about) {
                        this.hintAbout.textContent = about;
                        this.hintAbout.classList.remove('hidden');
                    } else {
                        this.hintAbout.textContent = '';
                        this.hintAbout.classList.add('hidden');
                    }
                }
            } else {
                this.hint.classList.add('hidden');
            }
        },

        /**
         * 更新设置面板中的推荐者信息：当前使用的仓库壁纸（固定、或开启随机默认）
         * 命中 *_about 时显示，否则隐藏。
         */
        _updateSettingsAbout() {
            if (!this.settingsAbout) return;
            const visible = this.layer && !this.layer.classList.contains('hidden');
            const about = visible ? this._aboutFor(this._currentDefaultUrl) : '';
            const wasHidden = this.settingsAbout.classList.contains('hidden');
            if (about) {
                this.settingsAbout.textContent = about;
                this.settingsAbout.classList.remove('hidden');
            } else {
                this.settingsAbout.textContent = '';
                this.settingsAbout.classList.add('hidden');
            }
            // 该行位于设置面板的壁纸分区，显隐会改变下方分区高度；
            // 若此时正有分区跳转在进行，通知设置面板重新对齐。
            if (wasHidden !== this.settingsAbout.classList.contains('hidden')) {
                this._notifySettingsLayoutChanged();
            }
        },

        /** 通知设置面板：本模块的异步更新可能改变了分区高度 */
        _notifySettingsLayoutChanged() {
            const settings = window.App && window.App.Settings;
            if (settings && typeof settings._realignJump === 'function') {
                settings._realignJump();
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