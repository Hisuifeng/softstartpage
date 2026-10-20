/**
 * main.js
 * 主入口文件
 * 初始化全局状态，依次调用各模块的 init 方法
 */
(function () {
    // 确保全局命名空间存在
    window.App = window.App || {};

    // 注入页面中的内联 SVG 图标（本地 file:// 打开可用）
    if (App.Utils && App.Utils.injectSvgIcons) App.Utils.injectSvgIcons();

    // ========== 存储治理（H8）：过期缓存清理 + schema 版本标记 ==========
    if (App.Utils && App.Utils.purgeExpiredCaches) App.Utils.purgeExpiredCaches();
    // 存储 schema 版本：未来字段改名 / 结构调整时在此做迁移（当前仅占位）
    const STORAGE_VERSION = 1;
    (function migrateStorage() {
        const cur = App.Utils.load('sp_storage_version', 0);
        if (cur === STORAGE_VERSION) return;
        try {
            // 迁移示例（保留给未来版本）：
            // if (cur < 2) { ...旧键改名 / 结构升级... }
            App.Utils.save('sp_storage_version', STORAGE_VERSION);
        } catch (e) {
            console.warn('[storage] 版本迁移失败', e);
        }
    })();

    // ========== 创建全局共享状态（从 localStorage 读取） ==========
    // 系统级“减少动态效果”：视差/雨效默认关闭（用户已显式保存的偏好仍尊重）
    const prefersReducedMotion = App.Utils.prefersReducedMotion
        ? App.Utils.prefersReducedMotion()
        : false;
    const state = {
        timeFormat: App.Utils.load('sp_time', { hour24: true, showSeconds: true, dateFormat: 'cn' }),
        bookmarks: App.Utils.load('sp_bookmarks', [{ id: '1', name: '', url: '', iconUrl: '' }]),
        searchHistory: App.Utils.load('sp_history', []),
        suggestionsEnabled: App.Utils.load('sp_suggestions', true),
        fallbackAPI: App.Utils.load('sp_fallback', 'baidu'),
        // shift+数字修饰键已移除，旧存储值迁移为 ctrlshift
        modifierKey: (() => {
            const v = App.Utils.load('sp_modifier', 'ctrlshift');
            if (v === 'shift') return 'ctrlshift';
            return ['ctrlshift', 'ctrl', 'alt', 'none'].includes(v) ? v : 'ctrlshift';
        })(),
        weatherEffectEnabled: App.Utils.load('sp_weather_effect', !prefersReducedMotion),
        weatherSource: App.Utils.load('sp_weather_source', 'uapi'),
        weatherCity: App.Utils.load('sp_weather_city', ''),
        weatherAdcode: App.Utils.load('sp_weather_adcode', ''),
        rainOpacity: App.Utils.load('sp_rain_opacity', 1),
        rainColors: App.Utils.load('sp_rain_colors', { dark: '#87ceeb', light: '#2a8fd4' }),
        bookmarkInPage: App.Utils.load('sp_bookmark_inpage', true),
        faviconSource: App.Utils.load('sp_favicon_source', 'direct'),
        faviconEnabled: App.Utils.load('sp_favicon_enabled', true),
        particlesEnabled: App.Utils.load('sp_particles', false),
        parallaxEnabled: App.Utils.load('sp_parallax', !prefersReducedMotion),
        defaultWallpaperEnabled: App.Utils.load('sp_default_wallpaper', true),
        hdWallpaperEnabled: App.Utils.load('sp_hd_wallpaper', false),
        customEngines: App.Utils.load('sp_custom_engines', []),
        hiddenEngines: App.Utils.load('sp_hidden_engines', []),
        currentEngineKey: App.Utils.load('sp_engine', 'google'),
        themeMode: App.Utils.load('sp_theme', 'auto'),
        accentColor: App.Utils.load('sp_accent_color', null)
    };
    window.App.state = state;

    // 数据管理（配置档案 ensure + 导入导出入口）：需在引擎/书签初始化前保证档案存在
    if (App.Data) App.Data.init();

    // ========== 按依赖顺序初始化各个模块 ==========

    // 1. 主题（最先初始化，供后续模块读取当前主题）
    if (App.Theme) App.Theme.init(state.themeMode);

    // 2. 粒子背景（独立，只需挂载画布）
    if (App.Particles) {
        App.Particles.init();
        App.Particles.setEnabled(state.particlesEnabled);
    }

    // 3. 全局视差背景（独立，鼠标侦测为 document 级全局）
    if (App.Parallax) {
        App.Parallax.init(state.parallaxEnabled);
    }

    // 4. 时钟（需要初始时间格式）
    if (App.Clock) App.Clock.init();

    // 5. 壁纸（独立，内部自行读取 localStorage）
    if (App.Wallpaper) App.Wallpaper.init();

    // 6. 搜索引擎管理（需要当前引擎和自定义引擎列表）
    if (App.Engine) App.Engine.init(state.currentEngineKey, state.customEngines);

    // 7. 搜索（需要联想开关、备用 API、历史记录）
    if (App.Search) App.Search.init({
        suggestionsEnabled: state.suggestionsEnabled,
        fallbackAPI: state.fallbackAPI,
        searchHistory: state.searchHistory
    });
    // L3：移除 HTML autofocus（移动端避免自动弹键盘），仅桌面指针设备手动聚焦
    if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus({ preventScroll: true });
    }

    // 8. 书签（传入初始书签数组）
    if (App.Bookmarks) App.Bookmarks.init(state.bookmarks);

    // 9. 设置面板（依赖壁纸、书签、引擎等模块已初始化）
    if (App.Settings) App.Settings.init();

    // 10. 世界时钟（依赖时钟模块）
    if (App.WorldClock) App.WorldClock.init();

    // 11. 天气与雨效（需要天气效果开关状态）
    if (App.Weather) App.Weather.init({
        weatherEffectEnabled: state.weatherEffectEnabled
    });

    // 所有模块已启动，控制台输出提示
    const arttext =
    " __   __    ___ ___     __        __   ___ \n" +
    '/__` /  \\  |__   |     |__)  /\\  / _` |__  \n' +
    '.__/ \\__/  |     |     |    /~~\\ \\__> |___  v2\n\n' +
    'Welcome to soft start page!Bug created by Hikari.\n' +
    '欢迎使用轻-soft起始页 2！';
    console.log(arttext);
    console.log('起始页所有模块加载完成');

    // L9：跨标签页同步——其它标签页写入 storage 时按键类型做局部重渲染
    window.addEventListener('storage', (e) => {
        if (!e || e.storageArea !== window.localStorage) return;
        const k = e.key;
        if (k === null) return; // clear()，整体刷新最稳妥
        const state = window.App.state;

        // 主题 / 强调色
        if (k === 'sp_theme' && window.App.Theme) {
            state.themeMode = App.Utils.load('sp_theme', 'auto');
            App.Theme.setMode(state.themeMode);
        } else if (k === 'sp_accent_color' && window.App.Theme) {
            App.Theme.setAccent(App.Utils.load('sp_accent_color', null));
        } else if (k === 'sp_time' && window.App.Clock) {
            state.timeFormat = App.Utils.load('sp_time', state.timeFormat);
            App.Clock.refresh();
        } else if (k === 'sp_engine' && window.App.Engine) {
            state.currentEngineKey = App.Utils.load('sp_engine', state.currentEngineKey);
            App.Engine.switchTo(state.currentEngineKey);
        } else if (k === 'sp_custom_engines' && window.App.Engine) {
            state.customEngines = App.Utils.load('sp_custom_engines', []);
            App.Engine.setCustom(state.customEngines);
        } else if (k === 'sp_hidden_engines' && window.App.Engine) {
            state.hiddenEngines = App.Utils.load('sp_hidden_engines', []);
            App.Engine.setHiddenKeys(state.hiddenEngines);
        } else if (k === 'sp_bookmarks' && window.App.Bookmarks) {
            state.bookmarks = App.Utils.load('sp_bookmarks', []);
            App.Bookmarks.renderMain();
        } else if (k === 'sp_wallpaper' && window.App.Wallpaper) {
            App.Wallpaper.wallpaper = App.Utils.load('sp_wallpaper', { type: 'none', value: '' });
            App.Wallpaper.applyToUI();
        } else if (k === 'sp_favicon_source' || k === 'sp_favicon_enabled') {
            if (k === 'sp_favicon_source') state.faviconSource = App.Utils.load('sp_favicon_source', 'direct');
            if (k === 'sp_favicon_enabled') state.faviconEnabled = App.Utils.load('sp_favicon_enabled', true);
            if (window.App.Bookmarks) App.Bookmarks.renderMain();
        } else if (k === 'sp_weather_effect' && window.App.Weather) {
            state.weatherEffectEnabled = App.Utils.load('sp_weather_effect', state.weatherEffectEnabled);
            App.Weather.handleEffectToggle(state.weatherEffectEnabled);
        } else if (k === 'sp_timezones' && window.App.WorldClock) {
            App.WorldClock.setTimezones(App.Utils.load('sp_timezones', []));
        }
    });
})();