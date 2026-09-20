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

    // ========== 创建全局共享状态（从 localStorage 读取） ==========
    const state = {
        timeFormat: App.Utils.load('sp_time', { hour24: true, showSeconds: true, dateFormat: 'cn' }),
        bookmarks: App.Utils.load('sp_bookmarks', [{ id: '1', name: '', url: '', iconUrl: '' }]),
        searchHistory: App.Utils.load('sp_history', []),
        suggestionsEnabled: App.Utils.load('sp_suggestions', true),
        fallbackAPI: App.Utils.load('sp_fallback', 'baidu'),
        modifierKey: App.Utils.load('sp_modifier', 'ctrl'),
        weatherEffectEnabled: App.Utils.load('sp_weather_effect', true),
        particlesEnabled: App.Utils.load('sp_particles', true),
        parallaxEnabled: App.Utils.load('sp_parallax', true),
        defaultWallpaperEnabled: App.Utils.load('sp_default_wallpaper', true),
        customEngines: App.Utils.load('sp_custom_engines', []),
        currentEngineKey: App.Utils.load('sp_engine', 'google')
    };
    window.App.state = state;

    // ========== 按依赖顺序初始化各个模块 ==========

    // 1. 粒子背景（完全独立，只需挂载画布）
    if (App.Particles) {
        App.Particles.init();
        App.Particles.setEnabled(state.particlesEnabled);
    }

    // 1.5 全局视差背景（独立，鼠标侦测为 document 级全局）
    if (App.Parallax) {
        App.Parallax.init(state.parallaxEnabled);
    }

    // 2. 时钟（需要初始时间格式）
    if (App.Clock) App.Clock.init(state.timeFormat);

    // 3. 壁纸（独立，内部自行读取 localStorage）
    if (App.Wallpaper) App.Wallpaper.init();

    // 4. 搜索引擎管理（需要当前引擎和自定义引擎列表）
    if (App.Engine) App.Engine.init(state.currentEngineKey, state.customEngines);

    // 5. 搜索（需要联想开关、备用 API、历史记录）
    if (App.Search) App.Search.init({
        suggestionsEnabled: state.suggestionsEnabled,
        fallbackAPI: state.fallbackAPI,
        searchHistory: state.searchHistory
    });

    // 6. 书签（传入初始书签数组）
    if (App.Bookmarks) App.Bookmarks.init(state.bookmarks);

    // 7. 设置面板（依赖壁纸、书签、引擎等模块已初始化）
    if (App.Settings) App.Settings.init();

    // 8. 世界时钟（依赖时钟模块）
    if (App.WorldClock) App.WorldClock.init();

    // 9. 天气与雨效（需要天气效果开关状态）
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
})();