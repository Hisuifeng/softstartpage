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

    const Theme = {
        // 当前模式：'auto' | 'light' | 'dark'
        mode: 'auto',
        // 系统是否为亮色
        systemLight: false,
        // 系统主题监听器
        _mq: null,

        /** 初始化主题管理，mode 可选 auto/light/dark */
        init(mode) {
            const saved = mode || window.App.Utils?.load(STORAGE_KEY, 'auto') || 'auto';
            this.mode = ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto';

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

        /** 将当前有效主题应用到 <html> 并派发事件 */
        _apply() {
            const light = this._effectiveLight();
            const root = document.documentElement;
            root.setAttribute('data-theme', light ? 'light' : 'dark');
            root.style.colorScheme = light ? 'light' : 'dark';
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { mode: this.mode, light, dark: !light }
            }));
        }
    };

    // 暴露到全局
    window.App.Theme = Theme;
})();
