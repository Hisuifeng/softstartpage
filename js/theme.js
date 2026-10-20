/**
 * theme.js
 * 主题管理模块（明暗主题：跟随系统 / 亮色 / 暗色）
 * 挂载于 window.App.Theme
 *
 * 通过在 <html> 上设置 data-theme="light|dark" 与 color-scheme 控制主题，
 * 并在有效主题变化时派发 window 事件 'themechange'，供各模块监听。
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};

    const STORAGE_KEY = 'sp_theme';
    const ACCENT_KEY = 'sp_accent_color';
    const HEX_RE = /^#[0-9a-fA-F]{6}$/;

    const Theme = {
        // M13 单一事实来源：模式只存 App.state.themeMode，本属性是其视图，不再维护第二份
        get mode() { return window.App.state?.themeMode || 'auto'; },
        set mode(v) {
            if (!window.App.state) window.App.state = {};
            window.App.state.themeMode = v;
        },
        // M16-ix 自定义强调色：null = 主题默认；经 setter 写入 state.accentColor
        get accentColor() { return window.App.state?.accentColor || null; },
        set accentColor(v) {
            if (!window.App.state) window.App.state = {};
            window.App.state.accentColor = v;
        },
        // 系统是否为亮色
        systemLight: false,
        // 系统主题监听器
        _mq: null,

        /** 初始化主题管理，mode 可选 auto/light/dark */
        init(mode) {
            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次
            this._inited = true;
            const saved = mode || window.App.Utils?.load(STORAGE_KEY, 'auto') || 'auto';
            this.mode = ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto';
            const accent = window.App.Utils?.load(ACCENT_KEY, null);
            this.accentColor = HEX_RE.test(String(accent || '')) ? String(accent) : null;

            this._mq = window.matchMedia('(prefers-color-scheme: light)');
            this.systemLight = this._mq.matches;

            // 监听系统主题变化（仅在 auto 模式下生效）
            const onChange = () => {
                this.systemLight = this._mq.matches;
                if (this.mode === 'auto') this._apply();
            };
            if (this._mq.addEventListener) {
                this._mq.addEventListener('change', onChange);
            } else if (this._mq.addListener) {
                this._mq.addListener(onChange);
            }

            // 初始化只写属性不派发事件（避免启动期 particles/weather 冗余重建）
            this._lastAppliedLight = this._effectiveLight();
            this._apply();
        },

        /** 当前是否处于暗色主题 */
        isDark() {
            return !this._effectiveLight();
        },

        /** 当前有效是否为亮色 */
        _effectiveLight() {
            if (this.mode === 'light') return true;
            if (this.mode === 'dark') return false;
            return !!this.systemLight;
        },

        /** 设置主题模式并持久化 */
        setMode(mode) {
            if (!['auto', 'light', 'dark'].includes(mode)) return;
            this.mode = mode;
            window.App.Utils?.save(STORAGE_KEY, mode);
            this._apply();
        },

        /**
         * 设置自定义强调色并持久化（M16-ix）
         * @param {string|null} hex '#rrggbb'；null/非法值 = 恢复主题默认
         */
        setAccent(hex) {
            this.accentColor = HEX_RE.test(String(hex || '')) ? String(hex) : null;
            window.App.Utils?.save(ACCENT_KEY, this.accentColor);
            this._applyAccent();
        },

        /** 把强调色写入 CSS 变量（派生 dim/strong/按钮/联想等衍生色） */
        _applyAccent() {
            const root = document.documentElement;
            const hex = this.accentColor;
            const style = root.style || {};
            if (!hex) {
                // 恢复默认：清掉行内覆盖，交回 style.css 的主题变量
                ['--accent', '--accent-dim', '--accent-strong', '--suggestions-hover',
                    '--btn-primary-bg', '--btn-primary-border',
                    '--engine-btn-active-bg', '--engine-btn-active-border'].forEach(name => {
                    if (style.removeProperty) style.removeProperty(name);
                });
                return;
            }
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const set = (name, val) => { if (style.setProperty) style.setProperty(name, val); };
            set('--accent', hex);
            set('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.25)`);
            set('--accent-strong', `rgba(${r}, ${g}, ${b}, 0.5)`);
            set('--suggestions-hover', `rgba(${r}, ${g}, ${b}, 0.12)`);
            set('--btn-primary-bg', `rgba(${r}, ${g}, ${b}, 0.2)`);
            set('--btn-primary-border', `rgba(${r}, ${g}, ${b}, 0.4)`);
            set('--engine-btn-active-bg', `rgba(${r}, ${g}, ${b}, 0.2)`);
            set('--engine-btn-active-border', `rgba(${r}, ${g}, ${b}, 0.45)`);
        },

        /** 上次应用的有效亮/暗结果（L2：仅真正变化时派发 themechange） */
        _lastAppliedLight: null,

        /** 将当前有效主题应用到 <html> 并派发事件 */
        _apply() {
            const light = this._effectiveLight();
            const root = document.documentElement;
            root.setAttribute('data-theme', light ? 'light' : 'dark');
            root.style.colorScheme = light ? 'light' : 'dark';
            this._applyAccent();
            // 初始化与未变化时不再派发，避免 particles/weather 启动期冗余重建图标
            if (this._lastAppliedLight === light) return;
            this._lastAppliedLight = light;
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { mode: this.mode, light, dark: !light }
            }));
        }
    };

    // 暴露到全局
    window.App.Theme = Theme;
})();
