/**
 * search.js
 * 搜索模块
 * 挂载于 window.App.Search
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const Search = {
        // DOM 元素
        input: null,
        clearBtn: null,
        dropdown: null,
        bookmarksSection: null,

        // JSONP 请求管理
        activeJsonp: null,
        suggestTimer: null,
        // 键盘高亮索引（L1：收进模块内部，不再挂 DOM 节点）
        _activeIndex: -1,

        /**
         * 初始化搜索模块
         * @param {object} options 可选初始值，如 { suggestionsEnabled, fallbackAPI, searchHistory }
         */
        init(options = {}) {
            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次
            this._inited = true;
            // 初始化状态
            const state = window.App.state;
            state.suggestionsEnabled = options.suggestionsEnabled !== undefined ? options.suggestionsEnabled : App.Utils.load('sp_suggestions', true);
            state.fallbackAPI = options.fallbackAPI || App.Utils.load('sp_fallback', 'baidu');
            state.searchHistory = options.searchHistory || App.Utils.load('sp_history', []);

            // 获取 DOM 元素
            this.input = document.getElementById('searchInput');
            this.clearBtn = document.getElementById('searchClear');
            this.dropdown = document.getElementById('suggestionsDropdown');
            this.bookmarksSection = document.getElementById('bookmarksSection');

            if (!this.input) {
                console.warn('搜索框元素缺失，跳过搜索模块');
                return;
            }

            this._bindEvents();
            this._updatePlaceholder();
        },

        /** 更新搜索框占位文字（根据当前引擎） */
        _updatePlaceholder(engineName) {
            if (!this.input) return;
            const name = engineName || (App.Engine && App.Engine.getCurrent ? App.Engine.getCurrent().name : 'Google');
            this.input.placeholder = `在 ${name} 上搜索`;
        },

        /** 对外接口：引擎切换时更新占位文字 */
        updatePlaceholder(engineName) {
            this._updatePlaceholder(engineName);
        },

        /** 执行搜索 */
        performSearch(query) {
            const state = window.App.state;
            if (query) {
                // 更新历史
                state.searchHistory = [query, ...state.searchHistory.filter(h => h !== query)].slice(0, 20);
                App.Utils.save('sp_history', state.searchHistory);

                // 构建搜索 URL
                const encoded = encodeURIComponent(query);
                const url = App.Engine.buildSearchUrl(encoded);
                window.location.href = url;
            } else {
                window.location.href = App.Engine.getHomeUrl();
            }
        },

        /** 打开联想下拉面板 */
        _openDropdown() {
            this.dropdown.classList.add('active');
            this.input?.setAttribute('aria-expanded', 'true');
            if (this.bookmarksSection) {
                this.bookmarksSection.classList.add('hidden-by-suggestions');
            }
            requestAnimationFrame(() => this._adjustDropdownHeight());
        },

        /** 关闭联想下拉面板 */
        _closeDropdown() {
            this.dropdown.classList.remove('active');
            this.dropdown.innerHTML = '';
            this.input?.setAttribute('aria-expanded', 'false');
            this.input?.removeAttribute('aria-activedescendant');
            if (this.bookmarksSection) {
                this.bookmarksSection.classList.remove('hidden-by-suggestions');
            }
            this.dropdown.style.maxHeight = '0';
            this._activeIndex = -1;
            this._cleanupJsonp();
        },

        /** 动态调整下拉高度 */
        _adjustDropdownHeight() {
            if (!this.dropdown.classList.contains('active')) return;
            const dd = this.dropdown;
            // 下拉打开时 padding 从 0 过渡到 6px，直接读 scrollHeight 会少算 padding。
            // 临时固定 padding 并关闭过渡，量到最终布局后再恢复，得到准确高度。
            const prevTransition = dd.style.transition;
            const prevPadding = dd.style.padding;
            dd.style.transition = 'none';
            dd.style.padding = '6px 0';
            const contentHeight = dd.scrollHeight;
            dd.style.padding = prevPadding;
            void dd.offsetHeight; // 强制同步布局，确保上面的临时样式生效
            dd.style.transition = prevTransition;
            const maxLimit = 260;
            dd.style.maxHeight = Math.min(contentHeight, maxLimit) + 'px';
            dd.style.overflowY = contentHeight > maxLimit ? 'auto' : 'hidden';
        },

        /** 键盘上下导航联想词 */
        _navigateSuggestions(dir) {
            const items = this.dropdown.querySelectorAll('.suggestion-item:not(.no-results)');
            if (!items.length) return;
            let idx = this._activeIndex;
            if (typeof idx !== 'number' || idx < 0 || idx >= items.length) idx = -1;
            items.forEach(i => {
                i.classList.remove('active');
                i.setAttribute('aria-selected', 'false');
            });
            idx += dir;
            if (idx < 0) idx = items.length - 1;
            if (idx >= items.length) idx = 0;
            this._activeIndex = idx;
            const active = items[idx];
            active.classList.add('active');
            active.setAttribute('aria-selected', 'true');
            // combobox 语义：让读屏知道当前高亮项
            if (active.id) this.input.setAttribute('aria-activedescendant', active.id);
            this.input.value = active.querySelector('.sug-text').textContent;
            active.scrollIntoView({ block: 'nearest' });
        },

        /** 获取联想词（JSONP） */
        _fetchSuggestions(query) {
            const state = window.App.state;
            if (!state.suggestionsEnabled || !query.trim()) {
                this._closeDropdown();
                return;
            }

            this._cleanupJsonp();
            const engineApi = App.Engine.getCurrent().api || state.fallbackAPI;
            const cbName = 'sug_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            let url;
            const q = encodeURIComponent(query.trim());

            if (engineApi === 'baidu') url = `https://suggestion.baidu.com/su?wd=${q}&cb=${cbName}`;
            else if (engineApi === 'bing') url = `https://api.bing.com/qsonhs.aspx?q=${q}&type=cb&cb=${cbName}`;
            else if (engineApi === 'google') url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=zh-CN&q=${q}&callback=${cbName}`;
            else {
                this._closeDropdown();
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            window[cbName] = (data) => {
                if (!this.activeJsonp || this.activeJsonp.cbName !== cbName) {
                    if (window[cbName]) delete window[cbName];
                    if (script.parentNode) script.parentNode.removeChild(script);
                    return;
                }
                let suggestions = [];
                try {
                    if (engineApi === 'baidu') suggestions = data.s || [];
                    else if (engineApi === 'bing') {
                        (data?.AS?.Results || []).forEach(g => (g.Suggests || []).forEach(s => s.Txt && suggestions.push(s.Txt)));
                    } else if (engineApi === 'google') {
                        if (Array.isArray(data) && data.length > 1) suggestions = data[1] || [];
                    }
                } catch (e) { /* 忽略解析错误 */ }
                this._renderSuggestions(suggestions.slice(0, 10), engineApi);
                this._cleanupJsonp();
            };

            script.onerror = () => { this._cleanupJsonp(); this._closeDropdown(); };
            document.head.appendChild(script);
            this.activeJsonp = { script, cbName };
        },

        /** 清理 JSONP 请求 */
        _cleanupJsonp() {
            if (this.activeJsonp) {
                const { script, cbName } = this.activeJsonp;
                if (window[cbName]) delete window[cbName];
                if (script && script.parentNode) script.parentNode.removeChild(script);
                this.activeJsonp = null;
            }
        },

        /**
         * 单条联想/历史行模板（M8 DRY：两处共用；图标复用 Utils.ICONS.search，
         * 不再内联重复 SVG）
         */
        _renderSuggestionRow(text, index, badge, extraHtml = '') {
            return `
                    <div class="suggestion-item" role="option" id="sug-opt-${index}" aria-selected="false" data-index="${index}">
                        <span class="sug-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${App.Utils.ICONS.search}</svg></span>
                        <span class="sug-text">${App.Utils.escapeHtml(text)}</span>
                        <span class="sug-badge">${App.Utils.escapeHtml(badge)}</span>
                        ${extraHtml}
                    </div>
                `;
        },

        /** 渲染联想词列表（无结果时直接收起下拉，L7） */
        _renderSuggestions(items, source) {
            if (!items.length) {
                this._closeDropdown();
                return;
            }
            this.dropdown.innerHTML = items.map((text, i) => this._renderSuggestionRow(text, i, source)).join('');
            this._openDropdown();
            this._activeIndex = -1;
            // 点击由 _bindEvents 中的容器级委托处理，此处不再逐项绑定（M14）
        },

        /** 显示历史记录下拉 */
        _showHistoryDropdown() {
            const history = window.App.state.searchHistory;
            if (!history.length) {
                this._closeDropdown();
                return;
            }
            this.dropdown.innerHTML = history.map((text, i) => this._renderSuggestionRow(text, i, '历史',
                `<button class="btn-delete-history" data-index="${i}" title="删除" aria-label="删除历史记录：${App.Utils.escapeAttr(text)}">${App.Utils.svg('close')}</button>`
            )).join('') + `<button type="button" class="history-clear-all" id="historyClearAll">清除全部历史</button>`;
            this._openDropdown();
            this._activeIndex = -1;
            // 点击（选中/删除/清空）由容器级委托处理（M14）
        },

        _deleteHistoryItem(index) {
            const state = window.App.state;
            if (index >= 0 && index < state.searchHistory.length) {
                state.searchHistory.splice(index, 1);
                App.Utils.save('sp_history', state.searchHistory);
            }
        },

        _clearAllHistory() {
            window.App.state.searchHistory = [];
            App.Utils.save('sp_history', []);
        },

        /** 绑定搜索相关事件 */
        _bindEvents() {
            // 下拉项点击：容器级事件委托（M14），替代每次渲染逐项 addEventListener
            this.dropdown.addEventListener('click', (e) => {
                const delBtn = e.target.closest('.btn-delete-history');
                if (delBtn) {
                    e.stopPropagation();
                    this._deleteHistoryItem(parseInt(delBtn.dataset.index, 10));
                    this._showHistoryDropdown();
                    return;
                }
                if (e.target.closest('.history-clear-all')) {
                    this._clearAllHistory();
                    this._closeDropdown();
                    return;
                }
                const item = e.target.closest('.suggestion-item');
                if (!item || item.classList.contains('no-results')) return;
                const txt = item.querySelector('.sug-text')?.textContent || '';
                if (!txt) return;
                this.input.value = txt;
                this._closeDropdown();
                this.performSearch(txt);
            });

            // 输入事件
            this.input.addEventListener('input', () => {
                const value = this.input.value.trim();
                this.clearBtn.classList.toggle('visible', !!value);
                clearTimeout(this.suggestTimer);
                if (!value) {
                    this._closeDropdown();
                    this._showHistoryDropdown();
                    return;
                }
                this.suggestTimer = setTimeout(() => this._fetchSuggestions(value), 250);
            });

            // 聚焦事件
            this.input.addEventListener('focus', () => {
                if (!this.input.value.trim()) {
                    this._closeDropdown();
                    this._showHistoryDropdown();
                }
            });

            // 键盘事件（上下导航 + 回车 + ESC）
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this._navigateSuggestions(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this._navigateSuggestions(-1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const active = this.dropdown.querySelector('.suggestion-item.active');
                    if (active) {
                        this.input.value = active.querySelector('.sug-text').textContent;
                        this._closeDropdown();
                    }
                    this.performSearch(this.input.value.trim());
                } else if (e.key === 'Escape') {
                    this._closeDropdown();
                }
            });

            // 清除按钮
            this.clearBtn.addEventListener('click', () => {
                this.input.value = '';
                this.clearBtn.classList.remove('visible');
                this._closeDropdown();
                this.input.focus();
                this._showHistoryDropdown();
            });

            // 全局点击关闭联想
            document.addEventListener('mousedown', (e) => {
                const section = document.getElementById('searchSection');
                if (section && !section.contains(e.target)) {
                    this._closeDropdown();
                }
            });
        }
    };

    // 暴露到全局
    window.App.Search = Search;
})();