/**
 * settings.js
 * 设置面板模块（已整合自定义经纬度）
 * 挂载于 window.App.Settings
 */
(function () {
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

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
        toggleBookmarkInPage: null,
        selectThemeMode: null,

        // 侧边栏
        sidebar: null,
        body: null,
        navItems: null,
        navSections: null,

        // 自定义经纬度
        customLatInput: null,
        customLonInput: null,
        applyCoordsBtn: null,

        saveBtn: null,
        cancelBtn: null,
        resetBtn: null,
        clearHistoryBtn: null,
        addBookmarkBtn: null,
        clearBookmarksBtn: null,
        addCustomEngineBtn: null,
        clearEnginesBtn: null,
        customEnginesList: null,

        init() {
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
            this.toggleBookmarkInPage = document.getElementById('toggleBookmarkInPage');
            this.selectThemeMode = document.getElementById('selectThemeMode');

            this.customLatInput = document.getElementById('customLatInput');
            this.customLonInput = document.getElementById('customLonInput');
            this.applyCoordsBtn = document.getElementById('applyCustomCoords');

            this.saveBtn = document.getElementById('btnSaveSettings');
            this.cancelBtn = document.getElementById('btnCancelSettings');
            this.resetBtn = document.getElementById('btnResetDefaults');
            this.clearHistoryBtn = document.getElementById('btnClearAllHistory');
            this.addBookmarkBtn = document.getElementById('btnAddBookmark');
            this.clearBookmarksBtn = document.getElementById('btnClearBookmarks');
            this.addCustomEngineBtn = document.getElementById('btnAddCustomEngine');
            this.clearEnginesBtn = document.getElementById('btnClearCustomEngines');
            this.customEnginesList = document.getElementById('customEnginesList');

            this._bindEvents();
            this._initSidebar();
        },

        open() {
            if (!this.overlay) return;
            this._syncUI();
            if (window.App.Bookmarks) App.Bookmarks.renderEditor();
            this._renderCustomEnginesEditor();
            if (this.body) this.body.scrollTop = 0;
            this._updateActiveNav();
            this.overlay.classList.add('open');
        },

        close() {
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

            const particles = this.toggleParticles?.checked ?? true;
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
            if (window.App.Wallpaper) App.Wallpaper.applyToUI();

            // 书签
            const bookmarkInPage = this.toggleBookmarkInPage?.checked ?? true;
            state.bookmarkInPage = bookmarkInPage;
            App.Utils.save('sp_bookmark_inpage', bookmarkInPage);
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

            this.close();
            App.Utils.showToast('设置已保存');
        },

        reset() {
            if (!confirm('确定要恢复所有默认设置吗？（书签与自定义搜索引擎将保留）')) return;
            const state = window.App.state;
            state.timeFormat = { hour24: true, showSeconds: true, dateFormat: 'cn' };
            state.currentEngineKey = 'google';
            state.searchHistory = [];
            state.suggestionsEnabled = true;
            state.fallbackAPI = 'baidu';
            state.modifierKey = 'ctrl';
            state.weatherEffectEnabled = true;
            state.rainOpacity = 1;
            state.rainColors = { dark: '#87ceeb', light: '#2a8fd4' };
            state.bookmarkInPage = true;
            state.particlesEnabled = true;
            state.defaultWallpaperEnabled = true;
            state.parallaxEnabled = true;
            // 主题恢复默认（跟随系统）
            if (window.App.Theme) App.Theme.setMode('auto');
            // 清除自定义经纬度
            state.customLat = null;
            state.customLon = null;
            App.Utils.save('sp_custom_lat', null);
            App.Utils.save('sp_custom_lon', null);

            App.Utils.save('sp_time', state.timeFormat);
            App.Utils.save('sp_engine', 'google');
            App.Utils.save('sp_history', []);
            App.Utils.save('sp_suggestions', true);
            App.Utils.save('sp_fallback', 'baidu');
            App.Utils.save('sp_modifier', 'ctrl');
            App.Utils.save('sp_weather_effect', true);
            App.Utils.save('sp_rain_opacity', 1);
            App.Utils.save('sp_rain_colors', { dark: '#87ceeb', light: '#2a8fd4' });
            App.Utils.save('sp_bookmark_inpage', true);
            App.Utils.save('sp_particles', true);
            App.Utils.save('sp_default_wallpaper', true);
            App.Utils.save('sp_parallax', true);
            if (window.App.Particles) App.Particles.setEnabled(true);
            if (window.App.Parallax) App.Parallax.setEnabled(true);
            if (window.App.Weather) App.Weather.setOpacity(1);
            if (window.App.Weather) App.Weather.setRainColors({ dark: '#87ceeb', light: '#2a8fd4' });
            if (window.App.Wallpaper) App.Wallpaper.applyToUI();

            if (window.App.Clock) App.Clock.refresh();
            // 书签与自定义搜索引擎保留，不随恢复默认清除
            if (window.App.Engine) {
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
            if (this.selectModifierKey) this.selectModifierKey.value = state.modifierKey || 'ctrl';
            if (this.toggleWeatherEffect) this.toggleWeatherEffect.checked = state.weatherEffectEnabled !== false;
            if (this.rainOpacityRange) {
                const pct = Math.round((state.rainOpacity ?? 1) * 100);
                this.rainOpacityRange.value = pct;
                if (this.rainOpacityValue) this.rainOpacityValue.textContent = pct + '%';
            }
            const rc = state.rainColors || {};
            if (this.rainColorDark) this.rainColorDark.value = rc.dark || '#87ceeb';
            if (this.rainColorLight) this.rainColorLight.value = rc.light || '#2a8fd4';
            if (this.toggleParticles) this.toggleParticles.checked = state.particlesEnabled !== false;
            if (this.toggleParallax) this.toggleParallax.checked = state.parallaxEnabled !== false;
            if (this.toggleDefaultWallpaper) this.toggleDefaultWallpaper.checked = state.defaultWallpaperEnabled !== false;
            if (this.toggleBookmarkInPage) this.toggleBookmarkInPage.checked = state.bookmarkInPage !== false;
            if (this.selectThemeMode) {
                this.selectThemeMode.value = (window.App.Theme && App.Theme.mode) || 'auto';
            }

            // 同步自定义经纬度
            const lat = App.Utils.load('sp_custom_lat', null);
            const lon = App.Utils.load('sp_custom_lon', null);
            state.customLat = lat;
            state.customLon = lon;
            if (this.customLatInput) this.customLatInput.value = lat !== null ? lat : '';
            if (this.customLonInput) this.customLonInput.value = lon !== null ? lon : '';
        },

        _renderCustomEnginesEditor() {
            if (!this.customEnginesList) return;
            const customEngines = window.App.state.customEngines || [];
            this.customEnginesList.innerHTML = customEngines.map((ce, idx) => `
                <div class="custom-engine-item" data-id="${ce.id}">
                    <input class="settings-input" placeholder="引擎名称" value="${App.Utils.escapeHtml(ce.name||'')}" data-field="name" data-idx="${idx}">
                    <input class="settings-input" placeholder="搜索URL (用 {q} 代替关键词)" value="${App.Utils.escapeHtml(ce.url||'')}" data-field="url" data-idx="${idx}">
                    <input class="settings-input" placeholder="主页URL (可选)" value="${App.Utils.escapeHtml(ce.home||'')}" data-field="home" data-idx="${idx}">
                    <button class="btn-icon-danger" data-idx="${idx}" title="删除">${App.Utils.svg('close')}</button>
                </div>
            `).join('');

            this.customEnginesList.querySelectorAll('.btn-icon-danger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    const engines = window.App.state.customEngines || [];
                    if (idx >= 0 && idx < engines.length) {
                        engines.splice(idx, 1);
                        App.Utils.save('sp_custom_engines', engines);
                        this._renderCustomEnginesEditor();
                    }
                });
            });
        },

        _applyCustomEngines() {
            if (!this.customEnginesList) return;
            const items = this.customEnginesList.querySelectorAll('.custom-engine-item');
            const newEngines = [];
            items.forEach(item => {
                const inputs = item.querySelectorAll('input');
                if (inputs.length >= 2) {
                    const name = inputs[0].value.trim();
                    const url = inputs[1].value.trim();
                    if (name && url) {
                        newEngines.push({
                            id: item.dataset.id || App.Utils.genId(),
                            name,
                            url,
                            home: inputs[2]?.value?.trim() || ''
                        });
                    }
                }
            });
            window.App.state.customEngines = newEngines;
            App.Utils.save('sp_custom_engines', newEngines);
            if (window.App.Engine) {
                App.Engine.customEngines = newEngines;
                App.Engine.setCustom(newEngines);
            }
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
                App.Utils.showToast('坐标已保存，天气即将更新');
            }

            // 刷新天气
            if (window.App.Weather) {
                App.Weather.updateWeatherFab();
            }
        },

        _clearBookmarks() {
            if (!confirm('确定要清空全部书签吗？此操作不可撤销。')) return;
            window.App.state.bookmarks = [{ id: '1', name: '', url: '', iconUrl: '' }];
            App.Utils.save('sp_bookmarks', window.App.state.bookmarks);
            if (window.App.Bookmarks) {
                App.Bookmarks.renderMain();
                App.Bookmarks.renderEditor();
            }
            App.Utils.showToast('已清空全部书签');
        },

        _clearCustomEngines() {
            if (!confirm('确定要清空全部自定义搜索引擎吗？此操作不可撤销。')) return;
            window.App.state.customEngines = [];
            if (window.App.Engine) {
                App.Engine.setCustom([]);
            } else {
                App.Utils.save('sp_custom_engines', []);
            }
            this._renderCustomEnginesEditor();
            App.Utils.showToast('已清空自定义引擎');
        },

        _initSidebar() {
            this.sidebar = document.getElementById('settingsSidebar');
            this.body = document.getElementById('settingsPanelBody');
            if (!this.sidebar || !this.body) return;

            this.navItems = Array.from(this.sidebar.querySelectorAll('.settings-nav-item'));
            this.navSections = this.navItems
                .map(it => document.getElementById(it.dataset.target))
                .filter(Boolean);

            this.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    const target = document.getElementById(item.dataset.target);
                    if (target) this.body.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
                });
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

            this.clearHistoryBtn?.addEventListener('click', () => {
                if (confirm('确定要清除所有搜索历史吗？')) {
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

            this.addCustomEngineBtn?.addEventListener('click', () => {
                const engines = window.App.state.customEngines || [];
                engines.push({ id: App.Utils.genId(), name: '', url: '', home: '' });
                window.App.state.customEngines = engines;
                this._renderCustomEnginesEditor();
            });

            this.clearEnginesBtn?.addEventListener('click', () => this._clearCustomEngines());

            this.applyCoordsBtn?.addEventListener('click', () => {
                this._applyCustomCoordinates();
            });

            // 主题模式：切换时即时生效
            this.selectThemeMode?.addEventListener('change', () => {
                if (window.App.Theme) App.Theme.setMode(this.selectThemeMode.value);
            });
        }
    };

    window.App.Settings = Settings;
})();