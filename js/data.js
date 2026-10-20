/**
 * data.js
 * 数据管理模块（M16-i 设置整体导入/导出、M16-ii 多配置档案）
 * 挂载于 window.App.Data
 *
 * 导出格式（复用书签导出的 type/version 结构）：
 *   { type: 'softstartpage-settings', version: 1, exportedAt, data: { sp_*: 值 } }
 * 导入按白名单 + 逐键清洗，未知键与非法值一律丢弃，应用后刷新页面生效。
 * 配置档案只保存「书签 + 自定义引擎 + 当前引擎」三件套，切换时与当前数据互换。
 */
(function () {
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const PROFILES_KEY = 'sp_profiles';
    const ACTIVE_PROFILE_KEY = 'sp_active_profile';
    const EXPORT_TYPE = 'softstartpage-settings';
    const EXPORT_VERSION = 1;

    // ---------- 清洗工具 ----------
    const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const clone = (v) => { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return undefined; } };
    const HEX = /^#[0-9a-fA-F]{6}$/;

    const str = (v, max = 1000) => (typeof v === 'string' ? v.slice(0, max) : undefined);
    const bool = (v) => (typeof v === 'boolean' ? v : undefined);
    const num = (v, min, max) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return undefined;
        return Math.min(max, Math.max(min, n));
    };

    function sanitizeBookmarks(v) {
        if (!Array.isArray(v)) return undefined;
        let list;
        if (window.App.Bookmarks && typeof App.Bookmarks.parseImport === 'function') {
            // 复用书签模块的 URL 安全校验（内部会跳过不安全网址）
            list = App.Bookmarks.parseImport(JSON.stringify({ bookmarks: v }));
        } else {
            list = v.slice(0, 1000).map(bm => ({
                id: App.Utils.genId(),
                name: String((bm && bm.name) || '').trim().slice(0, 200),
                url: String((bm && bm.url) || '').trim().slice(0, 2000),
                iconUrl: String((bm && bm.iconUrl) || '').trim().slice(0, 2000)
            })).filter(bm => bm.url && App.Utils.isSafeUrl(bm.url));
        }
        return Array.isArray(list) ? list : undefined;
    }

    function sanitizeEngines(v) {
        if (!Array.isArray(v)) return undefined;
        const cleaned = v.slice(0, 200).map(ce => ({
            id: (ce && ce.id) ? String(ce.id).slice(0, 64) : App.Utils.genId(),
            name: String((ce && ce.name) || '').trim().slice(0, 100),
            url: String((ce && ce.url) || '').trim().slice(0, 2000),
            home: String((ce && ce.home) || '').trim().slice(0, 2000)
        })).filter(ce => {
            if (!ce.name || !ce.url) return false;
            const probe = ce.url.replace(/\{q\}/g, 'x');
            if (!App.Utils.isSafeUrl(probe)) return false;
            if (ce.home && !App.Utils.isSafeUrl(ce.home)) ce.home = '';
            return true;
        });
        return cleaned;
    }

    function sanitizeRainColors(v) {
        if (!isPlainObject(v)) return undefined;
        const out = {};
        if (HEX.test(String(v.dark || ''))) out.dark = String(v.dark);
        if (HEX.test(String(v.light || ''))) out.light = String(v.light);
        return Object.keys(out).length ? out : undefined;
    }

    function sanitizeWallpaper(v) {
        if (!isPlainObject(v)) return undefined;
        const type = ['none', 'url', 'local', 'fixed'].includes(v.type) ? v.type : 'none';
        const value = typeof v.value === 'string' ? v.value.slice(0, 5000000) : '';
        if (type === 'url' && !App.Utils.isSafeUrl(value)) return { type: 'none', value: '' };
        // fixed 为仓库相对路径，按 wallpaper._safeRepoUrl 同款白名单校验（isSafeUrl 不适用于相对路径）
        if (type === 'fixed' && value
            && !/^img\/wallpaper\/(black|light)\/(orig\/)?wallpaper\d+\.(jpe?g|png|webp)$/i.test(value)) {
            return { type: 'none', value: '' };
        }
        return { type, value };
    }

    function sanitizeTimezones(v) {
        return Array.isArray(v) ? clone(v.slice(0, 100)) : undefined;
    }

    function sanitizeProfile(p) {
        if (!isPlainObject(p)) return null;
        const bookmarks = sanitizeBookmarks(p.bookmarks);
        const customEngines = sanitizeEngines(p.customEngines);
        if (!bookmarks || !customEngines) return null;
        return {
            id: str(p.id, 64) || App.Utils.genId(),
            name: str(p.name, 100) || '未命名档案',
            bookmarks,
            customEngines,
            currentEngineKey: str(p.currentEngineKey, 64) || 'google'
        };
    }

    // 键 → 清洗函数；返回 undefined 表示丢弃该键
    const SCHEMA = {
        sp_time: (v) => (isPlainObject(v) ? {
            hour24: v.hour24 !== false,
            showSeconds: v.showSeconds !== false,
            dateFormat: ['cn', 'iso', 'us', 'uk'].includes(v.dateFormat) ? v.dateFormat : 'cn'
        } : undefined),
        sp_bookmarks: sanitizeBookmarks,
        // sp_history 刻意不进备份（隐私 + 提示文案承诺不含搜索历史）
        sp_suggestions: bool,
        sp_fallback: (v) => (['baidu', 'bing', 'google'].includes(v) ? v : undefined),
        sp_modifier: (v) => (['ctrlshift', 'ctrl', 'alt', 'none'].includes(v) ? v : undefined),
        sp_weather_effect: bool,
        sp_weather_source: (v) => (['uapi', 'open-meteo'].includes(v) ? v : undefined),
        sp_weather_city: (v) => str(v, 100),
        sp_weather_adcode: (v) => str(v, 20),
        sp_rain_opacity: (v) => num(v, 0, 1),
        sp_rain_colors: sanitizeRainColors,
        sp_bookmark_inpage: bool,
        sp_favicon_source: (v) => (['direct', 'google'].includes(v) ? v : undefined),
        sp_favicon_enabled: bool,
        sp_particles: bool,
        sp_parallax: bool,
        sp_default_wallpaper: bool,
        sp_hd_wallpaper: bool,
        sp_custom_engines: sanitizeEngines,
        sp_hidden_engines: (v) => (Array.isArray(v)
            ? v.filter(x => typeof x === 'string').slice(0, 20)
            : undefined),
        sp_engine: (v) => str(v, 64),
        sp_theme: (v) => (['auto', 'light', 'dark'].includes(v) ? v : undefined),
        sp_custom_lat: (v) => (v === null ? null : num(v, -90, 90)),
        sp_custom_lon: (v) => (v === null ? null : num(v, -180, 180)),
        sp_wallpaper: sanitizeWallpaper,
        sp_theme_wallpaper_count: (v) => num(v, 0, 100),
        sp_timezones: sanitizeTimezones,
        sp_accent_color: (v) => (v === null || v === '' || HEX.test(String(v)) ? (v || null) : undefined),
        sp_profiles: (v) => {
            if (!Array.isArray(v)) return undefined;
            return v.slice(0, 20).map(sanitizeProfile).filter(Boolean);
        },
        sp_active_profile: (v) => str(v, 64)
    };

    const Data = {
        EXPORT_TYPE,
        EXPORT_VERSION,
        PROFILES_KEY,
        ACTIVE_PROFILE_KEY,

        init() {
            if (this._inited) return;
            this._inited = true;
            this._ensureProfiles();
        },

        // ---------- 设置整体导入/导出（M16-i） ----------

        /** 收集白名单内的全部设置键当前值 */
        collectSettings() {
            const data = {};
            Object.keys(SCHEMA).forEach(key => {
                const raw = App.Utils.load(key, undefined);
                if (raw !== undefined) data[key] = raw;
            });
            return data;
        },

        /** 导出为可粘贴 JSON 文本 */
        exportData() {
            return JSON.stringify({
                type: EXPORT_TYPE,
                version: EXPORT_VERSION,
                exportedAt: new Date().toISOString(),
                data: this.collectSettings()
            }, null, 2);
        },

        /**
         * 解析并清洗导入文本
         * @param {string} text
         * @returns {{data: Object, keys: string[]}|null} 无效返回 null
         */
        parseImport(text) {
            let payload;
            try {
                payload = JSON.parse(String(text || ''));
            } catch (e) {
                return null;
            }
            if (!payload || payload.type !== EXPORT_TYPE) return null;
            if (Number(payload.version) > EXPORT_VERSION) return null;
            if (!isPlainObject(payload.data)) return null;

            const data = {};
            let skipped = 0;
            Object.keys(SCHEMA).forEach(key => {
                if (!(key in payload.data)) return;
                const cleaned = SCHEMA[key](payload.data[key]);
                if (cleaned === undefined) { skipped++; return; }
                data[key] = cleaned;
            });
            if (!Object.keys(data).length) return null;
            if (skipped > 0) App.Utils.showToast(`已跳过 ${skipped} 项无效设置`);
            return { data, keys: Object.keys(data) };
        },

        /** 写入清洗后的设置并刷新页面（全量设置用刷新应用最稳妥） */
        applyImport(parsed) {
            if (!parsed || !parsed.data) return 0;
            let applied = 0;
            Object.entries(parsed.data).forEach(([key, val]) => {
                App.Utils.save(key, val);
                applied++;
            });
            return applied;
        },

        // ---------- 多配置档案（M16-ii） ----------

        /** 读取档案列表（至少保证一项） */
        listProfiles() {
            let list = App.Utils.load(PROFILES_KEY, null);
            if (!Array.isArray(list) || !list.length) {
                list = [this._snapshotProfile('默认')];
                App.Utils.save(PROFILES_KEY, list);
            }
            return list;
        },

        /** 当前档案 id */
        activeProfileId() {
            const list = this.listProfiles();
            let id = App.Utils.load(ACTIVE_PROFILE_KEY, null);
            if (!list.some(p => p.id === id)) {
                id = list[0].id;
                App.Utils.save(ACTIVE_PROFILE_KEY, id);
            }
            return id;
        },

        /** 当前档案对象 */
        activeProfile() {
            const id = this.activeProfileId();
            return this.listProfiles().find(p => p.id === id) || this.listProfiles()[0];
        },

        /** 用当前 state 生成一份档案快照 */
        _snapshotProfile(name) {
            const state = window.App.state;
            return {
                id: App.Utils.genId(),
                name: String(name || '未命名档案').slice(0, 100),
                bookmarks: clone(state.bookmarks) || [],
                customEngines: clone(state.customEngines) || [],
                currentEngineKey: state.currentEngineKey || 'google'
            };
        },

        /** 首次运行：把当前数据固化为「默认」档案 */
        _ensureProfiles() {
            const list = App.Utils.load(PROFILES_KEY, null);
            if (Array.isArray(list) && list.length) return;
            const profile = this._snapshotProfile('默认');
            App.Utils.save(PROFILES_KEY, [profile]);
            App.Utils.save(ACTIVE_PROFILE_KEY, profile.id);
        },

        /** 把当前 state 写回所属档案（切换/导出前调用，防丢失） */
        persistActiveProfile() {
            const list = this.listProfiles();
            const id = this.activeProfileId();
            const idx = list.findIndex(p => p.id === id);
            if (idx < 0) return;
            const state = window.App.state;
            list[idx] = {
                ...list[idx],
                bookmarks: clone(state.bookmarks) || [],
                customEngines: clone(state.customEngines) || [],
                currentEngineKey: state.currentEngineKey || 'google'
            };
            App.Utils.save(PROFILES_KEY, list);
        },

        /**
         * 切换到指定档案：先把当前数据存回旧档案，再加载目标档案
         * @returns {boolean} 是否切换成功
         */
        switchProfile(id) {
            const list = this.listProfiles();
            const target = list.find(p => p.id === id);
            if (!target) return false;
            const currentId = this.activeProfileId();
            if (target.id === currentId) return false;

            this.persistActiveProfile();
            App.Utils.save(ACTIVE_PROFILE_KEY, target.id);
            this._applyProfileData(target);
            return true;
        },

        /** 把档案数据应用到 state / 存储 / 各模块 */
        _applyProfileData(profile) {
            const state = window.App.state;
            state.bookmarks = clone(profile.bookmarks) || [];
            App.Utils.save('sp_bookmarks', state.bookmarks);
            if (window.App.Bookmarks) {
                App.Bookmarks.renderMain();
                App.Bookmarks.renderEditor();
            }

            const engines = clone(profile.customEngines) || [];
            state.customEngines = engines;
            if (window.App.Engine) {
                App.Engine.setCustom(engines); // 内部写存储并渲染
                const key = profile.currentEngineKey;
                if (key && App.Engine.getAll()[key]) App.Engine.switchTo(key);
            } else {
                App.Utils.save('sp_custom_engines', engines);
            }

            // 设置面板若开着，同步刷新引擎草稿与书签编辑器
            if (window.App.Settings && typeof App.Settings.refreshAfterProfileSwitch === 'function') {
                App.Settings.refreshAfterProfileSwitch();
            }
        },

        /**
         * 新建档案：以当前数据为内容并切换过去。
         * 不回写旧档案 —— 当前 state 从此归新档案所有，旧档案保持其已存储的内容。
         */
        createProfile(name) {
            const list = this.listProfiles();
            const profile = this._snapshotProfile(name);
            list.push(profile);
            App.Utils.save(PROFILES_KEY, list);
            App.Utils.save(ACTIVE_PROFILE_KEY, profile.id);
            return profile;
        },

        /** 重命名档案 */
        renameProfile(id, name) {
            const list = this.listProfiles();
            const p = list.find(x => x.id === id);
            if (!p) return false;
            const next = String(name || '').trim().slice(0, 100);
            if (!next) return false;
            p.name = next;
            App.Utils.save(PROFILES_KEY, list);
            return true;
        },

        /**
         * 删除档案；删除的是当前档案时先切换到剩余的第一项
         * @returns {boolean} 是否删除成功（至少保留一个档案）
         */
        removeProfile(id) {
            let list = this.listProfiles();
            if (list.length <= 1) return false;
            const activeId = this.activeProfileId();
            if (id === activeId) {
                const next = list.find(p => p.id !== id);
                if (!next) return false;
                App.Utils.save(ACTIVE_PROFILE_KEY, next.id);
                this._applyProfileData(next);
            }
            list = this.listProfiles().filter(p => p.id !== id);
            App.Utils.save(PROFILES_KEY, list);
            return true;
        }
    };

    window.App.Data = Data;
})();
