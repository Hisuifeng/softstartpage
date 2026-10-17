/**
 * engine.js
 * 搜索引擎管理模块
 * 挂载于 window.App.Engine
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};

    const Engine = {
        // 默认引擎配置
        defaultEngines: {
            google: { name: 'Google', url: 'https://www.google.com/search?q=', home: 'https://www.google.com', api: 'google' },
            baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=', home: 'https://www.baidu.com', api: 'baidu' },
            bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', home: 'https://www.bing.com', api: 'bing' },
            duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', home: 'https://duckduckgo.com', api: null }
        },

        // 自定义引擎列表
        customEngines: [],

        // 已隐藏的默认引擎 key 列表
        hiddenEngines: [],

        // 当前选中的引擎 key
        currentKey: 'google',

        // 引擎按钮容器
        container: null,

        /**
         * 初始化引擎模块
         * @param {string} [initialKey] 初始引擎 key
         * @param {Array} [initialCustom] 初始自定义引擎数组
         */
        init(initialKey, initialCustom) {
            this.container = document.getElementById('engineSwitcher');
            if (!this.container) {
                console.warn('未找到引擎切换容器，跳过引擎模块');
                return;
            }

            // 从 localStorage 或参数恢复状态
            if (initialKey) {
                this.currentKey = initialKey;
            } else {
                this.currentKey = App.Utils.load('sp_engine', 'google');
            }

            if (initialCustom) {
                this.customEngines = initialCustom;
            } else {
                this.customEngines = App.Utils.load('sp_custom_engines', []);
            }

            // 恢复已隐藏的默认引擎
            const initialHidden = window.App.state && Array.isArray(window.App.state.hiddenEngines)
                ? window.App.state.hiddenEngines
                : App.Utils.load('sp_hidden_engines', []);
            this.hiddenEngines = Array.isArray(initialHidden)
                ? initialHidden.filter(k => Object.prototype.hasOwnProperty.call(this.defaultEngines, k))
                : [];

            // 将当前引擎 key 写入全局状态
            if (!window.App.state) window.App.state = {};
            window.App.state.currentEngineKey = this.currentKey;
            window.App.state.customEngines = this.customEngines;
            window.App.state.hiddenEngines = this.hiddenEngines;

            this.render();
            this._bindEvents();
        },

        /** 获取所有引擎（默认 + 自定义，不含已隐藏的默认引擎） */
        getAll() {
            const engines = { ...this.defaultEngines };
            this.customEngines.forEach(ce => {
                engines[ce.id] = {
                    name: ce.name,
                    url: ce.url,
                    home: ce.home || '',
                    api: null
                };
            });
            (this.hiddenEngines || []).forEach(key => {
                if (Object.prototype.hasOwnProperty.call(this.defaultEngines, key)) {
                    delete engines[key];
                }
            });
            return engines;
        },

        /** 获取当前引擎对象 */
        getCurrent() {
            return this.getAll()[this.currentKey] || this.defaultEngines.google;
        },

        /** 切换引擎 */
        switchTo(key) {
            const all = this.getAll();
            if (!all[key]) return;
            this.currentKey = key;
            window.App.state.currentEngineKey = key;
            App.Utils.save('sp_engine', key);
            this.render();

            // 通知搜索模块更新 placeholder（如果已加载）
            if (window.App.Search && typeof window.App.Search.updatePlaceholder === 'function') {
                window.App.Search.updatePlaceholder(all[key].name);
            }
        },

        /** 渲染引擎按钮 */
        render() {
            if (!this.container) return;
            const all = this.getAll();
            this.container.innerHTML = Object.entries(all).map(([key, engine]) => `
                <button class="engine-btn ${key === this.currentKey ? 'active' : ''}" data-engine="${key}">
                    ${App.Utils.escapeHtml(engine.name)}
                </button>
            `).join('');
        },

        /**
         * 供搜索模块构建搜索 URL
         * @param {string} query 已编码的关键词
         * @returns {string}
         */
        buildSearchUrl(query) {
            const engine = this.getCurrent();
            if (engine.url.includes('{q}')) {
                return engine.url.replace(/\{q\}/g, query);
            }
            return engine.url + query;
        },

        /** 获取主页 URL */
        getHomeUrl() {
            const engine = this.getCurrent();
            return engine.home || 'https://www.google.com';
        },

        /** 设置自定义引擎列表并保存 */
        setCustom(list) {
            this.customEngines = list;
            window.App.state.customEngines = list;
            App.Utils.save('sp_custom_engines', list);
            // 如果当前引擎被删除，自动切到第一个可用引擎
            const all = this.getAll();
            if (!all[this.currentKey]) {
                const firstKey = Object.keys(all)[0];
                if (firstKey) this.switchTo(firstKey);
            }
            this.render();
        },

        /** 设置已隐藏的默认引擎列表并保存 */
        setHiddenKeys(keys) {
            const valid = Array.from(new Set(Array.isArray(keys) ? keys : []))
                .filter(k => Object.prototype.hasOwnProperty.call(this.defaultEngines, k));
            this.hiddenEngines = valid;
            window.App.state.hiddenEngines = valid;
            App.Utils.save('sp_hidden_engines', valid);
            // 如果当前引擎被隐藏，自动切到第一个可见引擎
            const all = this.getAll();
            if (!all[this.currentKey]) {
                const firstKey = Object.keys(all)[0];
                if (firstKey) this.switchTo(firstKey);
            }
            this.render();
            return this.hiddenEngines;
        },

        /** 隐藏/显示指定默认引擎 */
        toggleHidden(key, hidden) {
            const set = new Set(this.hiddenEngines || []);
            if (hidden) set.add(key);
            else set.delete(key);
            return this.setHiddenKeys(Array.from(set));
        },

        /** 判断默认引擎是否已隐藏 */
        isHidden(key) {
            return (this.hiddenEngines || []).includes(key);
        },

        /** 添加自定义引擎 */
        addCustom(name, url, home) {
            const newEngine = {
                id: App.Utils.genId(),
                name,
                url,
                home: home || ''
            };
            this.customEngines.push(newEngine);
            this.setCustom(this.customEngines);
        },

        /** 删除自定义引擎（按索引） */
        removeCustom(index) {
            this.customEngines.splice(index, 1);
            this.setCustom(this.customEngines);
        },

        /** 绑定事件 */
        _bindEvents() {
            if (!this.container) return;
            this.container.addEventListener('click', (e) => {
                const btn = e.target.closest('.engine-btn');
                if (btn) {
                    this.switchTo(btn.dataset.engine);
                }
            });

            // 快捷键由 main.js 统一处理，这里也可以预留方法
            document.addEventListener('keydown', (e) => {
                const modifier = window.App.state?.modifierKey || 'ctrl';
                const all = this.getAll();
                const keys = Object.keys(all);
                const num = parseInt(e.key);
                if (isNaN(num) || num < 1 || num > keys.length) return;

                const activeEl = document.activeElement;
                const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

                let shouldSwitch = false;
                if (modifier === 'ctrl' && e.ctrlKey) shouldSwitch = true;
                else if (modifier === 'alt' && e.altKey) shouldSwitch = true;
                else if (modifier === 'shift' && e.shiftKey) shouldSwitch = true;
                else if (modifier === 'none' && !isInputFocused && !e.ctrlKey && !e.altKey && !e.metaKey) shouldSwitch = true;

                if (shouldSwitch) {
                    e.preventDefault();
                    const targetKey = keys[num - 1];
                    if (targetKey) this.switchTo(targetKey);
                }
            });
        }
    };

    // 暴露到全局
    window.App.Engine = Engine;
})();