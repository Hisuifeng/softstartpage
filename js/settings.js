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
        toggleParticles: null,
        toggleDefaultWallpaper: null,

        // 自定义经纬度
        customLatInput: null,
        customLonInput: null,
        applyCoordsBtn: null,

        saveBtn: null,
        cancelBtn: null,
        resetBtn: null,
        clearHistoryBtn: null,
        addBookmarkBtn: null,
        addCustomEngineBtn: null,
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
            this.toggleParticles = document.getElementById('toggleParticles');
            this.toggleParallax = document.getElementById('toggleParallax');
            this.toggleDefaultWallpaper = document.getElementById('toggleDefaultWallpaper');

            this.customLatInput = document.getElementById('customLatInput');
            this.customLonInput = document.getElementById('customLonInput');
            this.applyCoordsBtn = document.getElementById('applyCustomCoords');

            this.saveBtn = document.getElementById('btnSaveSettings');
            this.cancelBtn = document.getElementById('btnCancelSettings');
            this.resetBtn = document.getElementById('btnResetDefaults');
            this.clearHistoryBtn = document.getElementById('btnClearAllHistory');
            this.addBookmarkBtn = document.getElementById('btnAddBookmark');
            this.addCustomEngineBtn = document.getElementById('btnAddCustomEngine');
            this.customEnginesList = document.getElementById('customEnginesList');

            this._bindEvents();
        },

        open() {
            if (!this.overlay) return;
            this._syncUI();
            if (window.App.Bookmarks) App.Bookmarks.renderEditor();
            this._renderCustomEnginesEditor();
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

            const weatherEffect = this.toggleWeatherEffect?.checked ?? true;
            state.weatherEffectEnabled = weatherEffect;
            App.Utils.save('sp_weather_effect', weatherEffect);

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
            if (!confirm('确定要恢复所有默认设置吗？')) return;
            const state = window.App.state;
            state.timeFormat = { hour24: true, showSeconds: true, dateFormat: 'cn' };
            state.bookmarks = [{ id: '1', name: '', url: '', iconUrl: '' }];
            state.customEngines = [];
            state.currentEngineKey = 'google';
            state.searchHistory = [];
            state.suggestionsEnabled = true;
            state.fallbackAPI = 'baidu';
            state.modifierKey = 'ctrl';
            state.weatherEffectEnabled = true;
            state.particlesEnabled = true;
            state.defaultWallpaperEnabled = true;
            state.parallaxEnabled = true;
            // 清除自定义经纬度
            state.customLat = null;
            state.customLon = null;
            App.Utils.save('sp_custom_lat', null);
            App.Utils.save('sp_custom_lon', null);

            App.Utils.save('sp_time', state.timeFormat);
            App.Utils.save('sp_bookmarks', state.bookmarks);
            App.Utils.save('sp_custom_engines', []);
            App.Utils.save('sp_engine', 'google');
            App.Utils.save('sp_history', []);
            App.Utils.save('sp_suggestions', true);
            App.Utils.save('sp_fallback', 'baidu');
            App.Utils.save('sp_modifier', 'ctrl');
            App.Utils.save('sp_weather_effect', true);
            App.Utils.save('sp_particles', true);
            App.Utils.save('sp_default_wallpaper', true);
            App.Utils.save('sp_parallax', true);
            if (window.App.Particles) App.Particles.setEnabled(true);
            if (window.App.Parallax) App.Parallax.setEnabled(true);
            if (window.App.Wallpaper) App.Wallpaper.applyToUI();

            if (window.App.Clock) App.Clock.refresh();
            if (window.App.Bookmarks) {
                App.Bookmarks.renderMain();
                App.Bookmarks.renderEditor();
            }
            if (window.App.Engine) {
                App.Engine.customEngines = [];
                App.Engine.currentKey = 'google';
                App.Engine.render();
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
            if (this.toggleParticles) this.toggleParticles.checked = state.particlesEnabled !== false;
            if (this.toggleParallax) this.toggleParallax.checked = state.parallaxEnabled !== false;
            if (this.toggleDefaultWallpaper) this.toggleDefaultWallpaper.checked = state.defaultWallpaperEnabled !== false;

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

            this.addBookmarkBtn?.addEventListener('click', () => {
                if (window.App.Bookmarks) App.Bookmarks.add();
            });

            this.addCustomEngineBtn?.addEventListener('click', () => {
                const engines = window.App.state.customEngines || [];
                engines.push({ id: App.Utils.genId(), name: '', url: '', home: '' });
                window.App.state.customEngines = engines;
                this._renderCustomEnginesEditor();
            });

            this.applyCoordsBtn?.addEventListener('click', () => {
                this._applyCustomCoordinates();
            });
        }
    };

    window.App.Settings = Settings;
})();