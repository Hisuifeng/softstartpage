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

        /**
         * 初始化搜索模块
         * @param {object} options 可选初始值，如 { suggestionsEnabled, fallbackAPI, searchHistory }
         */
        init(options = {}) {
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
            if (this.bookmarksSection) {
                this.bookmarksSection.classList.add('hidden-by-suggestions');
            }
            requestAnimationFrame(() => this._adjustDropdownHeight());
        },

        /** 关闭联想下拉面板 */
        _closeDropdown() {
            this.dropdown.classList.remove('active');
            this.dropdown.innerHTML = '';
            if (this.bookmarksSection) {
                this.bookmarksSection.classList.remove('hidden-by-suggestions');
            }
            this.dropdown.style.maxHeight = '0';
            this.dropdown._activeIndex = -1;
            this._cleanupJsonp();
        },

        /** 动态调整下拉高度 */
        _adjustDropdownHeight() {
            if (!this.dropdown.classList.contains('active')) return;
            const contentHeight = this.dropdown.scrollHeight;
            const maxLimit = 260;
            this.dropdown.style.maxHeight = Math.min(contentHeight, maxLimit) + 'px';
            this.dropdown.style.overflowY = contentHeight > maxLimit ? 'auto' : 'hidden';
        },

        /** 键盘上下导航联想词 */
        _navigateSuggestions(dir) {
            const items = this.dropdown.querySelectorAll('.suggestion-item:not(.no-results)');
            if (!items.length) return;
            let idx = this.dropdown._activeIndex;
            if (typeof idx !== 'number' || idx < 0 || idx >= items.length) idx = -1;
            items.forEach(i => i.classList.remove('active'));
            idx += dir;
            if (idx < 0) idx = items.length - 1;
            if (idx >= items.length) idx = 0;
            this.dropdown._activeIndex = idx;
            items[idx].classList.add('active');
            this.input.value = items[idx].querySelector('.sug-text').textContent;
            items[idx].scrollIntoView({ block: 'nearest' });
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

        /** 渲染联想词列表 */
        _renderSuggestions(items, source) {
            if (!items.length) {
                this.dropdown.innerHTML = `<div class="suggestion-item no-results">${App.Utils.svg('search')} 暂无相关搜索建议</div>`;
            } else {
                this.dropdown.innerHTML = items.map((text, i) => `
                    <div class="suggestion-item" data-index="${i}">
                        <span class="sug-icon"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7.5"/><line x1="16" y1="16" x2="21" y2="21"/></svg></span>
                        <span class="sug-text">${App.Utils.escapeHtml(text)}</span>
                        <span class="sug-badge">${source}</span>
                    </div>
                `).join('');
            }
            this._openDropdown();
            this.dropdown._activeIndex = -1;

            // 绑定点击事件
            this.dropdown.querySelectorAll('.suggestion-item:not(.no-results)').forEach(item => {
                item.addEventListener('click', () => {
                    const txt = item.querySelector('.sug-text').textContent;
                    this.input.value = txt;
                    this._closeDropdown();
                    this.performSearch(txt);
                });
            });
        },

        /** 显示历史记录下拉 */
        _showHistoryDropdown() {
            const history = window.App.state.searchHistory;
            if (!history.length) {
                this._closeDropdown();
                return;
            }
            this.dropdown.innerHTML = history.map((text, i) => `
                <div class="suggestion-item" data-index="${i}">
                    <span class="sug-icon"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7.5"/><line x1="16" y1="16" x2="21" y2="21"/></svg></span>
                    <span class="sug-text">${App.Utils.escapeHtml(text)}</span>
                    <span class="sug-badge">历史</span>
                    <button class="btn-delete-history" data-index="${i}" title="删除">${App.Utils.svg('close')}</button>
                </div>
            `).join('') + `<div class="history-clear-all" id="historyClearAll">清除全部历史</div>`;
            this._openDropdown();
            this.dropdown._activeIndex = -1;

            // 删除单个历史项
            this.dropdown.querySelectorAll('.btn-delete-history').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._deleteHistoryItem(parseInt(btn.dataset.index));
                    this._showHistoryDropdown();
                });
            });

            // 点击历史项执行搜索
            this.dropdown.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('btn-delete-history')) return;
                    const txt = item.querySelector('.sug-text').textContent;
                    this.input.value = txt;
                    this._closeDropdown();
                    this.performSearch(txt);
                });
            });

            // 清除全部历史
            const clearBtn = document.getElementById('historyClearAll');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this._clearAllHistory();
                    this._closeDropdown();
                });
            }
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