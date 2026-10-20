/**
 * settings.js
 * 设置面板模块（已整合自定义经纬度）
 * 挂载于 window.App.Settings
 */
(function () {
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    // 分区高亮框（.settings-group.section-highlight::before）向外扩出的距离，
    // 跳转时需让出这段空间，避免高亮框顶部被滚动口裁掉。
    const SECTION_HIGHLIGHT_OVERHANG = 10;
    // 框顶额外安全余量：overhang 只让框顶边恰好压在滚动口边界上。
    // 分区高度含 rem 行高的小数部分，浏览器对 scrollTop 取整/亚像素裁剪时
    // 顶部边框可能掉出边界（表现为高亮框顶部一条边缺失），故再留出余量。
    const SECTION_HIGHLIGHT_SLACK = 8;

    const Settings = {
        overlay: null,
        toggle24Hour: null,
        toggleSeconds: null,
        selectDateFormat: null,
        toggleSuggestions: null,
        selectFallbackAPI: null,
        selectModifierKey: null,
        toggleWeatherEffect: null,
        rainOpacityRange: null,
        rainOpacityValue: null,
        rainColorDark: null,
        rainColorLight: null,
        toggleParticles: null,
        toggleParallax: null,
        toggleDefaultWallpaper: null,
        toggleHdWallpaper: null,
        wallpaperPinStatus: null,
        toggleBookmarkInPage: null,
        selectFaviconSource: null,
        toggleFavicon: null,
        selectThemeMode: null,
        accentColorInput: null,
        resetAccentBtn: null,

        // 数据管理（M16-i/ii）
        selectProfile: null,
        switchProfileBtn: null,
        profileNameInput: null,
        createProfileBtn: null,
        renameProfileBtn: null,
        deleteProfileBtn: null,
        exportSettingsBtn: null,
        importSettingsBtn: null,

        // 侧边栏
        sidebar: null,
        body: null,
        panel: null,
        navItems: null,
        navSections: null,

        // 分区跳转定位状态（用于异步内容变化后重对齐）
        jumpSectionId: null,
        jumpTarget: 0,
        jumpAt: 0,
        realignTimer: null,

        // 自定义经纬度
        customLatInput: null,
        customLonInput: null,
        applyCoordsBtn: null,

        // 天气数据源与 UAPI 定位参数
        selectWeatherSource: null,
        weatherCityInput: null,
        weatherAdcodeInput: null,

        saveBtn: null,
        cancelBtn: null,
        resetBtn: null,
        clearHistoryBtn: null,
        addBookmarkBtn: null,
        clearBookmarksBtn: null,
        exportBookmarksBtn: null,
        importBookmarksBtn: null,
        addCustomEngineBtn: null,
        clearEnginesBtn: null,
        customEnginesList: null,
        defaultEngineList: null,

        // 排序（拖拽/↑↓）已统一收敛到 App.Sortable（js/sortable.js）

        init() {

            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次

            this._inited = true;
            this.overlay = document.getElementById('settingsOverlay');

            this.toggle24Hour = document.getElementById('toggle24Hour');
            this.toggleSeconds = document.getElementById('toggleSeconds');
            this.selectDateFormat = document.getElementById('selectDateFormat');
            this.toggleSuggestions = document.getElementById('toggleSuggestions');
            this.selectFallbackAPI = document.getElementById('selectFallbackAPI');
            this.selectModifierKey = document.getElementById('selectModifierKey');
            this.toggleWeatherEffect = document.getElementById('toggleWeatherEffect');
            this.rainOpacityRange = document.getElementById('rangeRainOpacity');
            this.rainOpacityValue = document.getElementById('rainOpacityValue');
            this.rainColorDark = document.getElementById('rainColorDark');
            this.rainColorLight = document.getElementById('rainColorLight');
            this.toggleParticles = document.getElementById('toggleParticles');
            this.toggleParallax = document.getElementById('toggleParallax');
            this.toggleDefaultWallpaper = document.getElementById('toggleDefaultWallpaper');
            this.toggleHdWallpaper = document.getElementById('toggleHdWallpaper');
            this.wallpaperPinStatus = document.getElementById('wallpaperPinStatus');
            this.toggleBookmarkInPage = document.getElementById('toggleBookmarkInPage');
            this.selectFaviconSource = document.getElementById('selectFaviconSource');
            this.toggleFavicon = document.getElementById('toggleFavicon');
            this.selectThemeMode = document.getElementById('selectThemeMode');
            this.accentColorInput = document.getElementById('accentColorInput');
            this.resetAccentBtn = document.getElementById('btnResetAccent');

            this.selectProfile = document.getElementById('selectProfile');
            this.switchProfileBtn = document.getElementById('btnSwitchProfile');
            this.profileNameInput = document.getElementById('profileNameInput');
            this.createProfileBtn = document.getElementById('btnCreateProfile');
            this.renameProfileBtn = document.getElementById('btnRenameProfile');
            this.deleteProfileBtn = document.getElementById('btnDeleteProfile');
            this.exportSettingsBtn = document.getElementById('btnExportSettings');
            this.importSettingsBtn = document.getElementById('btnImportSettings');

            this.customLatInput = document.getElementById('customLatInput');
            this.customLonInput = document.getElementById('customLonInput');
            this.applyCoordsBtn = document.getElementById('applyCustomCoords');

            this.selectWeatherSource = document.getElementById('selectWeatherSource');
            this.weatherCityInput = document.getElementById('weatherCityInput');
            this.weatherAdcodeInput = document.getElementById('weatherAdcodeInput');

            this.saveBtn = document.getElementById('btnSaveSettings');
            this.cancelBtn = document.getElementById('btnCancelSettings');
            this.resetBtn = document.getElementById('btnResetDefaults');
            this.clearHistoryBtn = document.getElementById('btnClearAllHistory');
            this.addBookmarkBtn = document.getElementById('btnAddBookmark');
            this.clearBookmarksBtn = document.getElementById('btnClearBookmarks');
            this.exportBookmarksBtn = document.getElementById('btnExportBookmarks');
            this.importBookmarksBtn = document.getElementById('btnImportBookmarks');
            this.addCustomEngineBtn = document.getElementById('btnAddCustomEngine');
            this.clearEnginesBtn = document.getElementById('btnClearCustomEngines');
            this.customEnginesList = document.getElementById('customEnginesList');
            this.defaultEngineList = document.getElementById('defaultEngineList');

            this._bindEvents();
            this._initSidebar();
            this._initSettingsItems();
            this._toggleLocationFields(window.App.state?.weatherSource);
        },

        // M9 草稿语义：打开面板时快照，取消/遮罩/Escape 关闭时回滚，保存时一次性提交
        _snapshotData: null,
        _enginesDraft: null,
        _committed: false,

        /** 打开面板时创建草稿：快照可被"取消"撤销的状态 + 自定义引擎编辑草稿数组 */
        _beginDraft() {
            const state = window.App.state;
            const clone = (v) => { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } };
            this._snapshotData = {
                themeMode: (window.App.Theme && App.Theme.mode) || 'auto',
                accentColor: (window.App.Theme && App.Theme.accentColor) || null,
                rainOpacity: state.rainOpacity ?? 1,
                rainColors: clone(state.rainColors || { dark: '#87ceeb', light: '#2a8fd4' }),
                // 默认引擎显隐/当前引擎在面板里是即时生效的，纳入快照以便取消时还原
                hiddenEngines: clone(Array.isArray(state.hiddenEngines) ? state.hiddenEngines : []),
                currentEngineKey: state.currentEngineKey || 'google'
            };
            // 引擎编辑全程走草稿数组：增删/排序不触碰 state 与 localStorage，保存时一次性提交
            this._enginesDraft = clone(Array.isArray(state.customEngines) ? state.customEngines : []);
            this._committed = false;
        },

        /** Modal 关闭钩子（覆盖取消按钮/关闭按钮/遮罩/Escape 全部路径） */
        _onPanelClosed() {
            if (this._committed) {
                this._snapshotData = null;
                this._enginesDraft = null;
                return;
            }
            this._rollbackDraft();
        },

        /** 取消关闭：把草稿期间即时生效的预览恢复为快照值 */
        _rollbackDraft() {
            const snap = this._snapshotData;
            if (!snap) return;
            if (window.App.Theme && App.Theme.mode !== snap.themeMode) {
                App.Theme.setMode(snap.themeMode); // 同步还原 state + 存储 + DOM
            }
            if (window.App.Theme && (App.Theme.accentColor || null) !== (snap.accentColor || null)) {
                App.Theme.setAccent(snap.accentColor); // 强调色预览回滚
            }
            if (window.App.Weather) {
                App.Weather.setOpacity(snap.rainOpacity);   // 写回 state.rainOpacity
                App.Weather.setRainColors(snap.rainColors); // 写回 state.rainColors
            }
            if (window.App.Engine) {
                // 还原默认引擎显隐与当前引擎（setHiddenKeys/switchTo 会同步 state+存储+渲染）
                App.Engine.setHiddenKeys(snap.hiddenEngines || []);
                if (snap.currentEngineKey && App.Engine.getAll()[snap.currentEngineKey]) {
                    App.Engine.switchTo(snap.currentEngineKey);
                }
            }
            this._snapshotData = null;
            this._enginesDraft = null;
        },

        open() {
            if (!this.overlay) return;
            this._syncUI();
            this._beginDraft();
            if (window.App.Bookmarks) App.Bookmarks.renderEditor();
            this._renderDefaultEngines();
            this._renderCustomEnginesEditor();
            if (this.body) this.body.scrollTop = 0;
            this._updateActiveNav();
            this.overlay.classList.add('open');
            // 无障碍：焦点管理 + Escape 关闭（关闭时在 close() 中还原；onClose 统一走草稿回滚）
            if (window.App.Modal) {
                App.Modal.open(this.overlay, { onClose: () => this._onPanelClosed() });
            }
        },

        /** 打开设置面板并定位到指定分区 */
        openTo(sectionId) {
            this.open();
            const target = sectionId ? document.getElementById(sectionId) : null;
            if (!target || !this.body) return;
            // 等待面板显示、布局完成后再滚动定位
            requestAnimationFrame(() => {
                this._scrollToSection(target);
                this._highlightSection(target);
            });
        },

        /**
         * 计算滚动定位到指定分区所需的目标 scrollTop。
         * 让出高亮框的上外扩距离（OVERHANG）加安全余量（SLACK），
         * 使高亮框顶部完整可见且不贴在滚动口边界上。
         */
        _sectionTarget(section) {
            return Math.max(0, section.offsetTop - SECTION_HIGHLIGHT_OVERHANG - SECTION_HIGHLIGHT_SLACK);
        },

        /**
         * 滚动定位到指定分区。
         * 记录本次跳转的目标，供 _realignJump 在异步内容（如壁纸推荐者文案）
         * 改变上方分区高度后做一次重对齐。
         */
        _scrollToSection(section) {
            if (!this.body || !section) return;
            this.jumpSectionId = section.id;
            this.jumpTarget = this._sectionTarget(section);
            this.jumpAt = Date.now();
            this.body.scrollTo({ top: this.jumpTarget, behavior: 'smooth' });
            // 兜底：异步内容加载完成后再校正一次
            clearTimeout(this.realignTimer);
            this.realignTimer = setTimeout(() => this._realignJump(), 500);
        },

        /**
         * 若跳转目标分区因上方内容异步变化而偏移，则重新滚动到正确位置。
         * 比较存储的目标值而非实时 scrollTop，避免平滑滚动过程中的误触发。
         */
        _realignJump() {
            if (!this.body || !this.jumpSectionId) return;
            if (!this.overlay || !this.overlay.classList.contains('open')) return;
            if (Date.now() - this.jumpAt > 3000) {
                this.jumpSectionId = null;
                return;
            }
            const section = document.getElementById(this.jumpSectionId);
            if (!section) return;
            const target = this._sectionTarget(section);
            if (target === this.jumpTarget) return;
            this.jumpTarget = target;
            this.body.scrollTo({ top: target, behavior: 'smooth' });
        },

        /** 高亮闪烁指定分区，提示用户当前定位位置 */
        _highlightSection(section) {
            if (!section) return;
            section.classList.remove('section-highlight');
            // 强制重排以重新触发动画
            void section.offsetWidth;
            section.classList.add('section-highlight');
            // L1：计时器收进模块内部（WeakMap 避免挂 DOM 节点）
            if (!this._highlightTimers) this._highlightTimers = new WeakMap();
            clearTimeout(this._highlightTimers.get(section));
            this._highlightTimers.set(section, setTimeout(() => {
                section.classList.remove('section-highlight');
            }, 1800));
        },

        close() {
            if (window.App.Modal) App.Modal.close(this.overlay);
            if (this.overlay) this.overlay.classList.remove('open');
        },

        save() {
            const state = window.App.state;

            state.timeFormat = {
                hour24: this.toggle24Hour?.checked ?? true,
                showSeconds: this.toggleSeconds?.checked ?? true,
                dateFormat: this.selectDateFormat?.value || 'cn'
            };
            state.suggestionsEnabled = this.toggleSuggestions?.checked ?? true;
            state.fallbackAPI = this.selectFallbackAPI?.value || 'baidu';
            state.modifierKey = this.selectModifierKey?.value || 'ctrl';

            const themeMode = this.selectThemeMode?.value || 'auto';
            if (window.App.Theme) App.Theme.setMode(themeMode);
            // 强调色无需在此提交：input 事件已即时 setAccent 持久化（取消关闭走草稿回滚）

            const weatherEffect = this.toggleWeatherEffect?.checked ?? true;
            state.weatherEffectEnabled = weatherEffect;
            App.Utils.save('sp_weather_effect', weatherEffect);

            const rainOpacity = (parseInt(this.rainOpacityRange?.value, 10) || 0) / 100;
            state.rainOpacity = rainOpacity;
            App.Utils.save('sp_rain_opacity', rainOpacity);
            if (window.App.Weather) App.Weather.setOpacity(rainOpacity);

            const rainColors = {
                dark: this.rainColorDark?.value || '#87ceeb',
                light: this.rainColorLight?.value || '#2a8fd4'
            };
            state.rainColors = rainColors;
            App.Utils.save('sp_rain_colors', rainColors);
            if (window.App.Weather) App.Weather.setRainColors(rainColors);

            // 天气数据源与定位参数（UAPI 用 city/adcode，Open-Meteo 用经纬度）
            const prevWeather = [state.weatherSource, state.weatherCity, state.weatherAdcode].join('|');
            state.weatherSource = this.selectWeatherSource?.value || 'uapi';
            state.weatherCity = (this.weatherCityInput?.value || '').trim();
            state.weatherAdcode = (this.weatherAdcodeInput?.value || '').trim();
            App.Utils.save('sp_weather_source', state.weatherSource);
            App.Utils.save('sp_weather_city', state.weatherCity);
            App.Utils.save('sp_weather_adcode', state.weatherAdcode);
            const weatherChanged = prevWeather !== [state.weatherSource, state.weatherCity, state.weatherAdcode].join('|');

            const particles = this.toggleParticles?.checked ?? false;
            state.particlesEnabled = particles;
            App.Utils.save('sp_particles', particles);
            if (window.App.Particles) App.Particles.setEnabled(particles);

            const parallax = this.toggleParallax?.checked ?? true;
            state.parallaxEnabled = parallax;
            App.Utils.save('sp_parallax', parallax);
            if (window.App.Parallax) App.Parallax.setEnabled(parallax);

            const defaultWallpaper = this.toggleDefaultWallpaper?.checked ?? true;
            state.defaultWallpaperEnabled = defaultWallpaper;
            App.Utils.save('sp_default_wallpaper', defaultWallpaper);

            const hdWallpaper = this.toggleHdWallpaper?.checked ?? false;
            state.hdWallpaperEnabled = hdWallpaper;
            App.Utils.save('sp_hd_wallpaper', hdWallpaper);

            if (window.App.Wallpaper) App.Wallpaper.applyToUI();

            // 书签
            const bookmarkInPage = this.toggleBookmarkInPage?.checked ?? true;
            state.bookmarkInPage = bookmarkInPage;
            App.Utils.save('sp_bookmark_inpage', bookmarkInPage);
            const faviconSource = ['direct', 'google'].includes(this.selectFaviconSource?.value)
                ? this.selectFaviconSource.value : 'direct';
            state.faviconSource = faviconSource;
            App.Utils.save('sp_favicon_source', faviconSource);
            const faviconEnabled = this.toggleFavicon?.checked ?? true;
            state.faviconEnabled = faviconEnabled;
            App.Utils.save('sp_favicon_enabled', faviconEnabled);
            if (window.App.Bookmarks) {
                const newBookmarks = App.Bookmarks.collectEdited();
                state.bookmarks = newBookmarks;
                App.Utils.save('sp_bookmarks', newBookmarks);
                App.Bookmarks.renderMain();
            }

            this._applyCustomEngines();

            // 保存时间等设置
            App.Utils.save('sp_time', state.timeFormat);
            App.Utils.save('sp_suggestions', state.suggestionsEnabled);
            App.Utils.save('sp_fallback', state.fallbackAPI);
            App.Utils.save('sp_modifier', state.modifierKey);

            if (window.App.Clock) App.Clock.refresh();
            if (window.App.Weather) App.Weather.handleEffectToggle(weatherEffect);
            // 数据源 / 定位参数变化时重新拉取天气
            if (window.App.Weather && weatherChanged) App.Weather.handleSourceChange();

            this._committed = true; // 提交完毕：close() 不再回滚草稿
            this.close();
            App.Utils.showToast('设置已保存');
        },

        async reset() {
            const ok = await App.Dialog.confirm('确定要恢复所有默认设置吗？（书签与自定义搜索引擎将保留）', '恢复默认');
            if (!ok) return;
            const state = window.App.state;
            const reducedMotion = App.Utils.prefersReducedMotion ? App.Utils.prefersReducedMotion() : false;
            state.timeFormat = { hour24: true, showSeconds: true, dateFormat: 'cn' };
            state.currentEngineKey = 'google';
            state.searchHistory = [];
            state.suggestionsEnabled = true;
            state.fallbackAPI = 'baidu';
            state.modifierKey = 'ctrlshift';
            state.weatherEffectEnabled = !reducedMotion;
            state.rainOpacity = 1;
            state.rainColors = { dark: '#87ceeb', light: '#2a8fd4' };
            state.bookmarkInPage = true;
            state.faviconSource = 'direct';
            state.faviconEnabled = true;
            state.particlesEnabled = false;
            state.defaultWallpaperEnabled = true;
            state.hdWallpaperEnabled = false;
            state.parallaxEnabled = !reducedMotion;
            // 默认引擎全部恢复显示
            state.hiddenEngines = [];
            // 主题恢复默认（跟随系统）
            if (window.App.Theme) {
                App.Theme.setMode('auto');
                App.Theme.setAccent(null); // 强调色恢复主题默认
            }
            // 清除自定义经纬度
            state.customLat = null;
            state.customLon = null;
            App.Utils.save('sp_custom_lat', null);
            App.Utils.save('sp_custom_lon', null);
            // 天气数据源与定位参数恢复默认（UAPI + IP 自动定位）
            state.weatherSource = 'uapi';
            state.weatherCity = '';
            state.weatherAdcode = '';
            App.Utils.save('sp_weather_source', 'uapi');
            App.Utils.save('sp_weather_city', '');
            App.Utils.save('sp_weather_adcode', '');

            App.Utils.save('sp_time', state.timeFormat);
            App.Utils.save('sp_engine', 'google');
            App.Utils.save('sp_history', []);
            App.Utils.save('sp_suggestions', true);
            App.Utils.save('sp_fallback', 'baidu');
            App.Utils.save('sp_modifier', 'ctrlshift');
            App.Utils.save('sp_weather_effect', !reducedMotion);
            App.Utils.save('sp_rain_opacity', 1);
            App.Utils.save('sp_rain_colors', { dark: '#87ceeb', light: '#2a8fd4' });
            App.Utils.save('sp_bookmark_inpage', true);
            App.Utils.save('sp_favicon_source', 'direct');
            App.Utils.save('sp_favicon_enabled', true);
            App.Utils.save('sp_particles', false);
            App.Utils.save('sp_default_wallpaper', true);
            App.Utils.save('sp_hd_wallpaper', false);
            App.Utils.save('sp_parallax', !reducedMotion);
            App.Utils.save('sp_hidden_engines', []);
            if (window.App.Particles) App.Particles.setEnabled(false);
            if (window.App.Parallax) App.Parallax.setEnabled(!reducedMotion);
            if (window.App.Weather) App.Weather.setOpacity(1);
            if (window.App.Weather) App.Weather.setRainColors({ dark: '#87ceeb', light: '#2a8fd4' });
            // 壁纸恢复默认（清除固定/自定义，回到主题默认随机）
            if (window.App.Wallpaper) App.Wallpaper.set('none', '');

            // 清理天气/位置/favicon 结果缓存，避免重置后仍复用旧缓存数据
            try {
                const doomed = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('sp_weather_cache_') || k === 'sp_location_cache'
                        || k.startsWith('sp_favicon_cache_'))) doomed.push(k);
                }
                doomed.forEach(k => localStorage.removeItem(k));
            } catch (e) { /* 忽略 */ }

            if (window.App.Clock) App.Clock.refresh();
            // 书签与自定义搜索引擎保留，不随恢复默认清除
            if (window.App.Engine) {
                App.Engine.setHiddenKeys([]);
                App.Engine.switchTo('google');
            }
            if (window.App.Weather) {
                App.Weather.stopEffect();
                // 重新拉取天气（使用IP定位）
                App.Weather.updateWeatherFab();
            }

            this.open();
        },

        _syncUI() {
            const state = window.App.state;
            const tf = state.timeFormat || {};
            if (this.toggle24Hour) this.toggle24Hour.checked = tf.hour24 !== false;
            if (this.toggleSeconds) this.toggleSeconds.checked = tf.showSeconds !== false;
            if (this.selectDateFormat) this.selectDateFormat.value = tf.dateFormat || 'cn';
            if (this.toggleSuggestions) this.toggleSuggestions.checked = state.suggestionsEnabled !== false;
            if (this.selectFallbackAPI) this.selectFallbackAPI.value = state.fallbackAPI || 'baidu';
            // shift 修饰键已移除，回退默认
            if (!['ctrlshift', 'ctrl', 'alt', 'none'].includes(state.modifierKey)) state.modifierKey = 'ctrlshift';
            if (this.selectModifierKey) this.selectModifierKey.value = state.modifierKey;
            if (this.toggleWeatherEffect) this.toggleWeatherEffect.checked = state.weatherEffectEnabled !== false;
            if (this.rainOpacityRange) {
                const pct = Math.round((state.rainOpacity ?? 1) * 100);
                this.rainOpacityRange.value = pct;
                if (this.rainOpacityValue) this.rainOpacityValue.textContent = pct + '%';
            }
            const rc = state.rainColors || {};
            if (this.rainColorDark) this.rainColorDark.value = rc.dark || '#87ceeb';
            if (this.rainColorLight) this.rainColorLight.value = rc.light || '#2a8fd4';
            if (this.toggleParticles) this.toggleParticles.checked = !!state.particlesEnabled;
            if (this.toggleParallax) this.toggleParallax.checked = state.parallaxEnabled !== false;
            if (this.toggleDefaultWallpaper) this.toggleDefaultWallpaper.checked = state.defaultWallpaperEnabled !== false;
            if (this.toggleHdWallpaper) this.toggleHdWallpaper.checked = state.hdWallpaperEnabled === true;
            if (this.wallpaperPinStatus) {
                const pinned = window.App.Wallpaper && App.Wallpaper.isPinned && App.Wallpaper.isPinned();
                this.wallpaperPinStatus.classList.toggle('hidden', !pinned);
            }
            if (this.toggleBookmarkInPage) this.toggleBookmarkInPage.checked = state.bookmarkInPage !== false;
            if (this.selectFaviconSource) {
                this.selectFaviconSource.value = ['direct', 'google'].includes(state.faviconSource)
                    ? state.faviconSource : 'direct';
            }
            if (this.toggleFavicon) this.toggleFavicon.checked = state.faviconEnabled !== false;
            if (this.selectThemeMode) {
                this.selectThemeMode.value = (window.App.Theme && App.Theme.mode) || 'auto';
            }
            if (this.accentColorInput) {
                const custom = (window.App.Theme && App.Theme.accentColor) || '';
                if (/^#[0-9a-fA-F]{6}$/.test(custom)) {
                    this.accentColorInput.value = custom;
                } else {
                    // 未自定义时回填当前主题的默认强调色（亮/暗主题不同）
                    try {
                        const def = getComputedStyle(document.documentElement)
                            .getPropertyValue('--accent').trim();
                        if (/^#[0-9a-fA-F]{6}$/.test(def)) this.accentColorInput.value = def;
                    } catch (e) { /* 保持 input 原值 */ }
                }
            }
            this._renderProfiles();

            // 同步自定义经纬度
            const lat = App.Utils.load('sp_custom_lat', null);
            const lon = App.Utils.load('sp_custom_lon', null);
            state.customLat = lat;
            state.customLon = lon;
            if (this.customLatInput) this.customLatInput.value = lat !== null ? lat : '';
            if (this.customLonInput) this.customLonInput.value = lon !== null ? lon : '';

            // 同步天气数据源与定位参数
            if (this.selectWeatherSource) {
                this.selectWeatherSource.value = state.weatherSource === 'open-meteo' ? 'open-meteo' : 'uapi';
            }
            if (this.weatherCityInput) this.weatherCityInput.value = state.weatherCity || '';
            if (this.weatherAdcodeInput) this.weatherAdcodeInput.value = state.weatherAdcode || '';

            // 按数据源显示对应定位项
            this._toggleLocationFields(state.weatherSource);
        },

        /** 天气数据源切换：UAPI 显示城市名/Adcode，Open-Meteo 显示经纬度 */
        _toggleLocationFields(source) {
            const src = source || this.selectWeatherSource?.value || window.App.state?.weatherSource || 'uapi';
            const isOpenMeteo = src === 'open-meteo';
            const uapiFields = document.getElementById('uapiLocationFields');
            const omFields = document.getElementById('openMeteoLocationFields');
            if (uapiFields) uapiFields.hidden = isOpenMeteo;
            if (omFields) omFields.hidden = !isOpenMeteo;
        },

        /** 渲染默认引擎的显示/隐藏开关列表 */
        _renderDefaultEngines() {
            if (!this.defaultEngineList) return;
            const Engine = window.App.Engine;
            if (!Engine || !Engine.defaultEngines) {
                this.defaultEngineList.innerHTML = '';
                return;
            }

            const hidden = Engine.hiddenEngines || [];
            const visibleCount = Object.keys(Engine.getAll()).length;
            this.defaultEngineList.innerHTML = Object.keys(Engine.defaultEngines).map(key => {
                const engine = Engine.defaultEngines[key];
                const isHidden = hidden.includes(key);
                const isLastVisible = !isHidden && visibleCount <= 1;
                const name = App.Utils.escapeAttr(engine.name);
                return `
                <div class="default-engine-item${isHidden ? ' is-hidden' : ''}" data-key="${key}">
                    <span class="default-engine-name">${App.Utils.escapeHtml(engine.name)}</span>
                    <button class="engine-visibility-btn" data-key="${key}"
                        title="${isHidden ? '显示' : '隐藏'}${name}${isLastVisible ? '（至少保留一个引擎）' : ''}"
                        aria-label="${isHidden ? '显示' : '隐藏'}${name}"${isLastVisible ? ' disabled' : ''}>
                        ${App.Utils.svg(isHidden ? 'eyeOff' : 'eye')}
                    </button>
                </div>`;
            }).join('');

            this.defaultEngineList.querySelectorAll('.engine-visibility-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.disabled) return;
                    const key = btn.dataset.key;
                    const all = window.App.Engine.getAll();
                    const isHidden = window.App.Engine.isHidden(key);
                    if (!isHidden && Object.keys(all).length <= 1) {
                        App.Utils.showToast('至少保留一个搜索引擎');
                        return;
                    }
                    window.App.Engine.toggleHidden(key, !isHidden);
                    this._renderDefaultEngines();
                });
            });
        },

        _renderCustomEnginesEditor() {
            if (!this.customEnginesList) return;
            const customEngines = this._enginesDraft || [];
            this.customEnginesList.innerHTML = customEngines.map((ce, idx) => `
                <div class="custom-engine-item" data-id="${ce.id}" data-index="${idx}">
                    <span class="drag-handle" draggable="true" title="拖拽排序" aria-label="拖拽排序">${App.Utils.svg('grip')}</span>
                    <div class="item-move-btns">
                        <button type="button" class="btn-move" data-move="up" data-idx="${idx}" title="上移" aria-label="上移该引擎">${App.Utils.svg('arrowUp')}</button>
                        <button type="button" class="btn-move" data-move="down" data-idx="${idx}" title="下移" aria-label="下移该引擎">${App.Utils.svg('arrowDown')}</button>
                    </div>
                    <input class="settings-input" placeholder="引擎名称" value="${App.Utils.escapeAttr(ce.name||'')}" data-field="name" data-idx="${idx}">
                    <input class="settings-input" placeholder="搜索URL (用 {q} 代替关键词)" value="${App.Utils.escapeAttr(ce.url||'')}" data-field="url" data-idx="${idx}">
                    <input class="settings-input" placeholder="主页URL (可选)" value="${App.Utils.escapeAttr(ce.home||'')}" data-field="home" data-idx="${idx}">
                    <button class="btn-icon-danger" data-idx="${idx}" title="删除">${App.Utils.svg('close')}</button>
                </div>
            `).join('');

            // 通用排序（与书签编辑列表同一套 App.Sortable：手柄拖拽 + ↑↓）
            if (window.App.Sortable) {
                App.Sortable.bind(this.customEnginesList, {
                    itemSelector: '.custom-engine-item',
                    onReorder: (fromIdx, toIdx, orderedItems) => {
                        // 以 DOM 顺序同步草稿（保存时再提交，取消即反悔）
                        const byId = new Map((this._enginesDraft || []).map(e => [String(e.id), e]));
                        const ordered = [];
                        orderedItems.forEach(item => {
                            const found = byId.get(String(item.dataset.id));
                            if (found) ordered.push(found);
                        });
                        this._enginesDraft = ordered;
                    }
                });
            }

            this.customEnginesList.querySelectorAll('.btn-icon-danger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    const engines = this._enginesDraft || [];
                    if (idx >= 0 && idx < engines.length) {
                        // M9：只删草稿，保存时提交；取消关闭即反悔（不写 state / localStorage）
                        engines.splice(idx, 1);
                        this._renderCustomEnginesEditor();
                    }
                });
            });
        },

        _applyCustomEngines() {
            if (!this.customEnginesList) return;
            const items = this.customEnginesList.querySelectorAll('.custom-engine-item');
            const newEngines = [];
            let skippedEmpty = 0;
            let skippedUnsafe = 0;
            items.forEach(item => {
                const inputs = item.querySelectorAll('input');
                if (inputs.length >= 2) {
                    const name = inputs[0].value.trim();
                    const url = inputs[1].value.trim();
                    const home = inputs[2]?.value?.trim() || '';
                    if (name && url) {
                        if (!App.Utils.isSafeUrl(url) || (home && !App.Utils.isSafeUrl(home))) {
                            skippedUnsafe++;
                            return;
                        }
                        newEngines.push({
                            id: item.dataset.id || App.Utils.genId(),
                            name,
                            url,
                            home
                        });
                    } else {
                        skippedEmpty++;
                    }
                }
            });
            window.App.state.customEngines = newEngines;
            App.Utils.save('sp_custom_engines', newEngines);
            if (window.App.Engine) {
                App.Engine.setCustom(newEngines); // 内部经 setter 写 state 并渲染
            }
            if (skippedUnsafe > 0) App.Utils.showToast(`已跳过 ${skippedUnsafe} 个含不安全网址的引擎`);
            else if (skippedEmpty > 0) App.Utils.showToast(`已跳过 ${skippedEmpty} 个未填完整的引擎`);
        },

        _applyCustomCoordinates() {
            const lat = this.customLatInput?.value.trim();
            const lon = this.customLonInput?.value.trim();
            const latNum = parseFloat(lat);
            const lonNum = parseFloat(lon);

            if (lat === '' || lon === '') {
                // 清空
                App.Utils.save('sp_custom_lat', null);
                App.Utils.save('sp_custom_lon', null);
                window.App.state.customLat = null;
                window.App.state.customLon = null;
                App.Utils.showToast('已清除自定义坐标，将使用IP定位');
            } else if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
                App.Utils.showToast('请输入有效的经纬度');
                return;
            } else {
                App.Utils.save('sp_custom_lat', latNum);
                App.Utils.save('sp_custom_lon', lonNum);
                window.App.state.customLat = latNum;
                window.App.state.customLon = lonNum;
                App.Utils.showToast(window.App.state.weatherSource === 'uapi'
                    ? '坐标已保存，仅对 Open-Meteo 数据源生效'
                    : '坐标已保存，天气即将更新');
            }

            // 经纬度仅 Open-Meteo 使用，刷新时按当前数据源判断
            if (window.App.Weather && window.App.state.weatherSource !== 'uapi') {
                App.Weather.updateWeatherFab();
            }
        },

        async _clearBookmarks() {
            const ok = await App.Dialog.confirm('确定要清空全部书签吗？此操作不可撤销。', '清空书签');
            if (!ok) return;
            window.App.state.bookmarks = [{ id: '1', name: '', url: '', iconUrl: '' }];
            App.Utils.save('sp_bookmarks', window.App.state.bookmarks);
            if (window.App.Bookmarks) {
                App.Bookmarks.renderMain();
                App.Bookmarks.renderEditor();
            }
            App.Utils.showToast('已清空全部书签');
        },

        /** 导出书签到剪贴板 */
        async _exportBookmarks() {
            if (!window.App.Bookmarks) return;
            const data = App.Bookmarks.exportData();
            const count = (JSON.parse(data).bookmarks || []).length;
            if (!count) {
                App.Utils.showToast('当前没有可导出的书签');
                return;
            }
            const ok = await App.Utils.copyText(data);
            if (ok) {
                App.Utils.showToast(`已导出 ${count} 条书签到剪贴板`);
            } else {
                // 复制失败：弹只读 textarea 并自动选中，供手动复制（L4）
                await App.Dialog.textarea(data, '复制失败，请手动复制');
            }
        },

        /** 从剪贴板导入书签（合并去重，不覆盖现有书签） */
        async _importBookmarks() {
            if (!window.App.Bookmarks) return;
            let text = await App.Utils.readText();
            if (!text || !String(text).trim()) {
                text = await App.Dialog.prompt('未能读取剪贴板，请粘贴书签数据：', '', '导入书签');
            }
            if (!text || !String(text).trim()) return;

            const list = App.Bookmarks.parseImport(text);
            if (!list || !list.length) {
                App.Utils.showToast('剪贴板内容不是有效的书签数据');
                return;
            }

            // 合并：保留现有有效书签，按网址去重后追加
            const existing = (window.App.state.bookmarks || [])
                .filter(bm => String(bm.url || '').trim());
            const seen = new Set(existing.map(bm => String(bm.url).trim().toLowerCase()));
            let added = 0;
            for (const bm of list) {
                const key = bm.url.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                existing.push(bm);
                added++;
            }

            if (!added) {
                App.Utils.showToast('没有可导入的新书签（已存在）');
                return;
            }

            window.App.state.bookmarks = existing;
            App.Utils.save('sp_bookmarks', window.App.state.bookmarks);
            App.Bookmarks.renderMain();
            App.Bookmarks.renderEditor();
            App.Utils.showToast(`已导入 ${added} 条书签`);
        },

        async _clearCustomEngines() {
            const ok = await App.Dialog.confirm('确定要清空全部自定义搜索引擎吗？此操作不可撤销。', '清空自定义引擎');
            if (!ok) return;
            // M9：只清草稿，保存时提交
            this._enginesDraft = [];
            this._renderCustomEnginesEditor();
            App.Utils.showToast('已清空自定义引擎，保存后生效');
        },

        _initSidebar() {
            this.sidebar = document.getElementById('settingsSidebar');
            this.body = document.getElementById('settingsPanelBody');
            this.panel = this.overlay ? this.overlay.querySelector('.settings-panel') : null;
            if (!this.sidebar || !this.body) return;

            this.navItems = Array.from(this.sidebar.querySelectorAll('.settings-nav-item'));
            this.navSections = this.navItems
                .map(it => document.getElementById(it.dataset.target))
                .filter(Boolean);

            this.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    const target = document.getElementById(item.dataset.target);
                    if (target) {
                        this._scrollToSection(target);
                        this._highlightSection(target);
                    }
                });
            });

            // 面板展开动画结束后再校正一次（此时上方异步内容多已就位）
            this.panel?.addEventListener('transitionend', (e) => {
                if (e.target !== this.panel) return;
                this._realignJump();
            });

            this.body.addEventListener('scroll', () => this._updateActiveNav(), { passive: true });
        },

        _updateActiveNav() {
            if (!this.navItems || !this.navSections) return;
            const scrollTop = this.body.scrollTop;
            let activeId = this.navSections[0]?.id;
            for (const sec of this.navSections) {
                if (sec.offsetTop - 24 <= scrollTop) activeId = sec.id;
                else break;
            }
            this.navItems.forEach(it => it.classList.toggle('active', it.dataset.target === activeId));
        },

        _initSettingsItems() {
            const panel = this.body || document.getElementById('settingsPanelBody');
            if (!panel) return;
            panel.addEventListener('click', (e) => {
                const item = e.target.closest('.settings-item');
                // 只读信息行（settings-item--info）：无交互展开态，不做激活切换
                if (!item || item.classList.contains('settings-item--info')) return;
                const target = e.target;
                if (
                    target.closest('.settings-item-control') ||
                    target.closest('button') ||
                    target.closest('input') ||
                    target.closest('select') ||
                    target.closest('label')
                ) {
                    if (
                        target.matches('input[type="checkbox"], input[type="range"], input[type="color"], select') ||
                        target.closest('button') ||
                        target.closest('.wallpaper-actions') ||
                        target.closest('.file-upload-label')
                    ) {
                        return;
                    }
                }
                const isActive = item.dataset.active === 'true';
                panel.querySelectorAll('.settings-item').forEach(i => {
                    i.dataset.active = 'false';
                });
                if (!isActive) {
                    item.dataset.active = 'true';
                    item.focus({ preventScroll: true });
                }
            });

            panel.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const item = e.target.closest('.settings-item');
                if (!item || e.target !== item) return;
                e.preventDefault();
                const isActive = item.dataset.active === 'true';
                panel.querySelectorAll('.settings-item').forEach(i => {
                    i.dataset.active = 'false';
                });
                if (!isActive) {
                    item.dataset.active = 'true';
                }
            });
        },

        _bindEvents() {
            const fab = document.getElementById('settingsFab');
            if (fab) fab.addEventListener('click', () => this.open());

            document.getElementById('settingsCloseBtn')?.addEventListener('click', () => this.close());
            if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());

            this.overlay?.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });

            this.saveBtn?.addEventListener('click', () => this.save());
            this.resetBtn?.addEventListener('click', () => this.reset());

            this.clearHistoryBtn?.addEventListener('click', async () => {
                const ok = await App.Dialog.confirm('确定要清除所有搜索历史吗？', '清除历史');
                if (ok) {
                    window.App.state.searchHistory = [];
                    App.Utils.save('sp_history', []);
                    App.Utils.showToast('历史已清空');
                }
            });

            // 雨效透明度：拖动时实时预览
            this.rainOpacityRange?.addEventListener('input', () => {
                const pct = parseInt(this.rainOpacityRange.value, 10) || 0;
                if (this.rainOpacityValue) this.rainOpacityValue.textContent = pct + '%';
                if (window.App.Weather) App.Weather.setOpacity(pct / 100);
            });

            // 雨效颜色：选择时实时预览
            const applyRainColors = () => {
                const colors = {
                    dark: this.rainColorDark?.value || '#87ceeb',
                    light: this.rainColorLight?.value || '#2a8fd4'
                };
                window.App.state.rainColors = colors;
                if (window.App.Weather) App.Weather.setRainColors(colors);
            };
            this.rainColorDark?.addEventListener('input', applyRainColors);
            this.rainColorLight?.addEventListener('input', applyRainColors);

            this.addBookmarkBtn?.addEventListener('click', () => {
                if (window.App.Bookmarks) App.Bookmarks.add();
            });

            this.clearBookmarksBtn?.addEventListener('click', () => this._clearBookmarks());
            this.exportBookmarksBtn?.addEventListener('click', () => this._exportBookmarks());
            this.importBookmarksBtn?.addEventListener('click', () => this._importBookmarks());

            this.addCustomEngineBtn?.addEventListener('click', () => {
                const engines = this._enginesDraft || (this._enginesDraft = []);
                engines.push({ id: App.Utils.genId(), name: '', url: '', home: '' });
                this._renderCustomEnginesEditor();
            });

            this.clearEnginesBtn?.addEventListener('click', () => this._clearCustomEngines());

            this.applyCoordsBtn?.addEventListener('click', () => {
                this._applyCustomCoordinates();
            });

            // 天气数据源切换：即时切换显示的定位项
            this.selectWeatherSource?.addEventListener('change', () => {
                this._toggleLocationFields();
            });

            // 主题模式：切换时即时生效
            this.selectThemeMode?.addEventListener('change', () => {
                if (window.App.Theme) App.Theme.setMode(this.selectThemeMode.value);
            });

            // 强调色：拖动即时预览（与主题模式一致；取消关闭时经草稿回滚还原）
            this.accentColorInput?.addEventListener('input', () => {
                if (window.App.Theme) App.Theme.setAccent(this.accentColorInput.value);
            });
            this.resetAccentBtn?.addEventListener('click', () => {
                if (window.App.Theme) App.Theme.setAccent(null);
                this._syncUI(); // 回填主题默认色到 color input
            });

            // ---------- 数据管理（M16-i/ii） ----------
            this.switchProfileBtn?.addEventListener('click', () => this._switchProfile());
            this.createProfileBtn?.addEventListener('click', () => this._createProfile());
            this.renameProfileBtn?.addEventListener('click', () => this._renameProfile());
            this.deleteProfileBtn?.addEventListener('click', () => this._deleteProfile());
            this.exportSettingsBtn?.addEventListener('click', () => this._exportSettings());
            this.importSettingsBtn?.addEventListener('click', () => this._importSettings());
        },

        // ---------- 配置档案 UI（M16-ii） ----------

        /** 渲染档案下拉框（_syncUI 时调用） */
        _renderProfiles() {
            if (!this.selectProfile || !window.App.Data) return;
            const list = App.Data.listProfiles();
            const activeId = App.Data.activeProfileId();
            this.selectProfile.innerHTML = list.map(p =>
                `<option value="${App.Utils.escapeAttr(p.id)}"${p.id === activeId ? ' selected' : ''}>${App.Utils.escapeHtml(p.name)}</option>`
            ).join('');
        },

        _switchProfile() {
            if (!window.App.Data || !this.selectProfile) return;
            const id = this.selectProfile.value;
            // 切换前把面板里的草稿写回 state，避免旧档案丢失未保存的编辑
            // （collectEdited 仅在编辑列表存在时返回有效数组，否则为 [] 不能覆盖）
            if (window.App.Bookmarks && App.Bookmarks.editList) {
                window.App.state.bookmarks = App.Bookmarks.collectEdited();
            }
            if (this._enginesDraft) window.App.state.customEngines = this._enginesDraft;
            const ok = App.Data.switchProfile(id);
            App.Utils.showToast(ok ? '已切换配置档案' : '未选择其他档案');
            if (ok) this._renderProfiles();
        },

        _createProfile() {
            if (!window.App.Data) return;
            const name = (this.profileNameInput?.value || '').trim();
            if (!name) {
                App.Utils.showToast('请输入新档案名称');
                this.profileNameInput?.focus();
                return;
            }
            // 新建以「当前面板内容」为基础
            if (window.App.Bookmarks && App.Bookmarks.editList) {
                window.App.state.bookmarks = App.Bookmarks.collectEdited();
            }
            if (this._enginesDraft) window.App.state.customEngines = this._enginesDraft;
            App.Data.createProfile(name);
            if (this.profileNameInput) this.profileNameInput.value = '';
            this._renderProfiles();
            App.Utils.showToast(`已创建并切换到档案「${name}」`);
        },

        async _renameProfile() {
            if (!window.App.Data || !this.selectProfile) return;
            const list = App.Data.listProfiles();
            const cur = list.find(p => p.id === App.Data.activeProfileId());
            const next = await App.Dialog.prompt('重命名当前档案：', cur ? cur.name : '', '重命名档案');
            if (next === null) return;
            if (!next.trim()) {
                App.Utils.showToast('名称不能为空');
                return;
            }
            App.Data.renameProfile(App.Data.activeProfileId(), next.trim());
            this._renderProfiles();
            App.Utils.showToast('档案已重命名');
        },

        async _deleteProfile() {
            if (!window.App.Data || !this.selectProfile) return;
            const list = App.Data.listProfiles();
            if (list.length <= 1) {
                App.Utils.showToast('至少保留一个档案');
                return;
            }
            const cur = list.find(p => p.id === App.Data.activeProfileId());
            const okConfirm = await App.Dialog.confirm(`确定删除档案「${cur ? cur.name : ''}」吗？此操作不可撤销。`, '删除档案');
            if (!okConfirm) return;
            const ok = App.Data.removeProfile(App.Data.activeProfileId());
            App.Utils.showToast(ok ? '档案已删除' : '至少保留一个档案');
            if (ok) {
                this._renderProfiles();
                // 删除当前档案时会切到另一档案，编辑器需与新数据对齐
                this._enginesDraft = null;
                this._beginDraft();
                if (window.App.Bookmarks) App.Bookmarks.renderEditor();
                this._renderCustomEnginesEditor();
            }
        },

        /** 档案切换后由 Data 回调：重建引擎草稿并刷新编辑器 */
        refreshAfterProfileSwitch() {
            this._enginesDraft = null;
            this._beginDraft();
            if (window.App.Bookmarks) App.Bookmarks.renderEditor();
            this._renderCustomEnginesEditor();
            this._renderDefaultEngines();
            this._renderProfiles();
        },

        // ---------- 设置整体导入/导出（M16-i） ----------

        /** 导出全部设置到剪贴板 */
        async _exportSettings() {
            if (!window.App.Data) return;
            // 导出前把当前 state 回写档案，保证备份含最新书签/引擎
            App.Data.persistActiveProfile();
            const data = App.Data.exportData();
            const ok = await App.Utils.copyText(data);
            if (ok) {
                App.Utils.showToast('已导出全部设置到剪贴板');
            } else {
                // 复制失败：弹只读 textarea 并自动选中，供手动复制（L4）
                await App.Dialog.textarea(data, '复制失败，请手动复制');
            }
        },

        /** 从剪贴板导入全部设置（清洗后覆盖并刷新页面） */
        async _importSettings() {
            if (!window.App.Data) return;
            let text = await App.Utils.readText();
            if (!text || !String(text).trim()) {
                text = await App.Dialog.prompt('未能读取剪贴板，请粘贴设置数据：', '', '导入设置');
            }
            if (!text || !String(text).trim()) return;

            const parsed = App.Data.parseImport(text);
            if (!parsed) {
                App.Utils.showToast('剪贴板内容不是有效的设置数据');
                return;
            }
            const okImport = await App.Dialog.confirm(`将覆盖当前全部设置（共 ${parsed.keys.length} 项），并刷新页面。确定导入吗？`, '导入设置');
            if (!okImport) return;
            const applied = App.Data.applyImport(parsed);
            App.Utils.showToast(`已导入 ${applied} 项设置，页面即将刷新`);
            setTimeout(() => window.location.reload(), 600);
        }
    };

    window.App.Settings = Settings;
})();