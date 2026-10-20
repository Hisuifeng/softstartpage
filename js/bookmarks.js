/**
 * bookmarks.js
 * 书签管理模块（支持拖拽排序）
 * 挂载于 window.App.Bookmarks
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const Bookmarks = {
        // 主页书签容器
        mainContainer: null,
        // 设置面板中的编辑列表容器
        editList: null,

        /**
         * 初始化书签模块
         * @param {Array} [initialBookmarks] 书签数组，若不传则从 localStorage 读取
         */
        init(initialBookmarks) {
            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次
            this._inited = true;
            this.mainContainer = document.getElementById('bookmarksSection');
            this.editList = document.getElementById('bookmarkEditList');

            // 加载书签到全局状态
            if (initialBookmarks) {
                window.App.state.bookmarks = initialBookmarks;
            } else {
                window.App.state.bookmarks = App.Utils.load('sp_bookmarks', [
                    { id: '1', name: '', url: '', iconUrl: '' }
                ]);
            }

            // 渲染主页书签
            this.renderMain();
        },

        // ==================== 自动 favicon 结果缓存 ====================
        // 按「来源|主机名」记住探测结果（ok/fallback/none），避免每次渲染对
        // 已知失败的站点重复发请求；键含 source，切换来源互不污染。
        // 属可再生缓存，不进导入导出备份；恢复默认时与天气缓存一并清除。
        ICON_CACHE_PREFIX: 'sp_favicon_cache_',
        ICON_CACHE_TTL: 7 * 24 * 3600 * 1000, // 7 天（站点图标偶有更新，留够窗口）

        /** 缓存键：sp_favicon_cache_{source}_{host} */
        _iconCacheKey(source, host) {
            return `${this.ICON_CACHE_PREFIX}${source}|${host}`;
        },

        /** 读缓存；缺失/损坏/过期返回 null（并顺手删除过期项） */
        _iconCacheGet(source, host) {
            const key = this._iconCacheKey(source, host);
            const v = App.Utils.load(key, null);
            if (!v || typeof v !== 'object' || typeof v.s !== 'string' || typeof v.t !== 'number') return null;
            if (Date.now() - v.t > this.ICON_CACHE_TTL) {
                try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
                return null;
            }
            return v.s;
        },

        /** 写缓存（status: ok/fallback/none）；localStorage 满等异常静默忽略 */
        _iconCacheSet(source, host, status) {
            if (!host || !status) return;
            try { App.Utils.save(this._iconCacheKey(source, host), { s: status, t: Date.now() }); } catch (e) { /* 忽略 */ }
        },

        /**
         * 综合缓存后的自动图标方案
         * @returns {{src:string, fallback:string, host:string, cached?:string}}
         *   · 缓存 none —— src/fallback 均空（渲染首字母，不发请求）
         *   · 缓存 fallback —— src 直达二级域名地址，跳过已知失败的一级地址
         *   · 其余 —— src 一级地址 + fallback 回退地址，由 load/error 事件回写缓存
         */
        autoIconPlan(url, source) {
            const s = String(url || '').trim();
            if (!/^https?:\/\//i.test(s)) return { src: '', fallback: '', host: '' };
            const srcName = String(source || window.App.state?.faviconSource || 'direct');
            let host = '';
            try { host = new URL(s).hostname; } catch (e) { return { src: '', fallback: '', host: '' }; }
            if (!host) return { src: '', fallback: '', host: '' };
            const status = this._iconCacheGet(srcName, host);
            if (status === 'none') return { src: '', fallback: '', host };
            const fbUrl = this.autoIconFallbackUrl(url, srcName);
            if (status === 'fallback' && fbUrl) {
                return { src: fbUrl, fallback: '', host, cached: 'fallback' };
            }
            return { src: this.autoIconUrl(url, srcName), fallback: fbUrl, host };
        },

        /**
         * 由书签网址推导自动 favicon URL（M16-v）
         * 来源由 state.faviconSource 决定：
         * · direct（默认）——站点自身 {origin}/favicon.ico，任何网站均可
         * · google —— Google s2（国内可能不可用）
         * direct 加载失败时再经 autoIconFallbackUrl 回退二级域名，仍失败回退首字母
         * 仅对 http/https 且有主机名的网址生效
         * @param {string} url
         * @param {string} [source] 覆盖来源（测试用；默认读 state.faviconSource）
         * @returns {string} 空串表示不适用
         */
        autoIconUrl(url, source) {
            const s = String(url || '').trim();
            if (!/^https?:\/\//i.test(s)) return '';
            const src = String(source || window.App.state?.faviconSource || 'direct');
            try {
                const u = new URL(s);
                if (!u.hostname) return '';
                if (src === 'google') {
                    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`;
                }
                // direct（默认）：任意站点域名后接 /favicon.ico
                return `${u.protocol}//${u.hostname}/favicon.ico`;
            } catch (e) {
                return '';
            }
        },

        /**
         * 自动 favicon 的备用地址（direct 源失败时的二级域名尝试）
         * @param {string} url
         * @param {string} [source]
         * @returns {string} 无备用返回空串
         */
        autoIconFallbackUrl(url, source) {
            const s = String(url || '').trim();
            if (!/^https?:\/\//i.test(s)) return '';
            const src = String(source || window.App.state?.faviconSource || 'direct');
            if (src !== 'direct') return ''; // google s2 本身按域名查询，无二级回退
            try {
                const u = new URL(s);
                const parts = u.hostname.split('.');
                if (parts.length < 3) return ''; // example.com 无更上一级
                const parent = parts.slice(-2).join('.');
                return `${u.protocol}//${parent}/favicon.ico`;
            } catch (e) {
                return '';
            }
        },

        /** 渲染主页书签区域 */
        renderMain() {
            if (!this.mainContainer) return;
            const bookmarks = window.App.state.bookmarks || [];
            // 没有有效书签（无网址）时，显示“添加书签”加号入口
            const hasValid = bookmarks.some(bm => String(bm.url || '').trim());
            if (!hasValid) {
                this.mainContainer.innerHTML = `
                    <a class="bookmark-item bookmark-add" href="#" title="添加书签" aria-label="添加书签">
                        <div class="bookmark-icon-wrapper bookmark-add-icon">${App.Utils.svg('plus')}</div>
                        <span class="bookmark-name">添加书签</span>
                    </a>
                `;
                const addTile = this.mainContainer.querySelector('.bookmark-add');
                if (addTile) {
                    addTile.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (window.App.Settings) window.App.Settings.openTo('secBookmarks');
                    });
                }
                return;
            }
            // 页面内跳转（默认开启）：在当前标签页打开；关闭时新标签页打开
            const inPage = window.App.state.bookmarkInPage !== false;
            const targetAttr = inPage ? '' : ' target="_blank" rel="noopener noreferrer"';
            this.mainContainer.innerHTML = bookmarks.map(bm => {
                const name = String(bm.name || '');
                const url = String(bm.url || '');
                const iconUrl = String(bm.iconUrl || '');
                const href = url && App.Utils.isSafeUrl(url) ? App.Utils.escapeAttr(url) : '#';
                // 图标优先级：手动 iconUrl > 自动 favicon（可关闭；direct 失败回退二级域名，结果按来源|主机名缓存 7 天）> 首字母
                const autoEnabled = window.App.state.faviconEnabled !== false;
                const plan = (!iconUrl && autoEnabled) ? this.autoIconPlan(url) : null;
                const src = iconUrl || (plan ? plan.src : '');
                const autoFallback = plan ? plan.fallback : '';
                // data-ficon="source|host" 供 load/error 事件回写结果缓存；data-result 标记缓存命中的 fallback 直达
                const ficonAttr = plan && plan.host
                    ? ` data-ficon="${App.Utils.escapeAttr((window.App.state.faviconSource || 'direct') + '|' + plan.host)}"` : '';
                const resultAttr = plan && plan.cached === 'fallback' ? ' data-result="fallback"' : '';
                const fallbackAttr = (autoFallback && App.Utils.isSafeUrl(autoFallback) && !iconUrl)
                    ? ` data-fallback="${App.Utils.escapeAttr(autoFallback)}"` : '';
                // L6：不再使用内联 onerror/onload（CSP 兼容），由 renderMain 后统一 addEventListener
                const img = src && App.Utils.isSafeUrl(src)
                    ? `<img src="${App.Utils.escapeAttr(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${ficonAttr}${resultAttr}${fallbackAttr}>`
                    : '';
                return `
                <a class="bookmark-item" href="${href}"${targetAttr} title="${App.Utils.escapeAttr(name)}">
                    <div class="bookmark-icon-wrapper">
                        <span class="bookmark-fallback">${App.Utils.escapeHtml(App.Utils.getFallbackChar(name))}</span>
                        ${img}
                    </div>
                    <span class="bookmark-name">${name ? App.Utils.escapeHtml(name) : '未命名'}</span>
                </a>
            `;
            }).join('');
            this._bindIconEvents();
        },

        /** L6：图标加载/回退用容器级事件委托（无内联 onerror/onload，CSP 兼容）；结果写入 sp_favicon_cache_ 缓存 */
        _bindIconEvents() {
            if (!this.mainContainer || this._iconEventsBound) return;
            this._iconEventsBound = true;
            this.mainContainer.addEventListener('load', (e) => {
                const img = e.target;
                if (!(img instanceof HTMLImageElement) || !img.closest('.bookmark-icon-wrapper')) return;
                img.style.display = 'block';
                const fallback = img.previousElementSibling;
                if (fallback) fallback.style.opacity = '0';
                // 成功：一级地址记 ok，二级回退记 fallback
                if (img.dataset.ficon) {
                    const [srcName, host] = String(img.dataset.ficon).split('|');
                    if (srcName && host) {
                        this._iconCacheSet(srcName, host, img.dataset.ftried ? 'fallback' : 'ok');
                    }
                }
            }, true);
            this.mainContainer.addEventListener('error', (e) => {
                const img = e.target;
                if (!(img instanceof HTMLImageElement) || !img.closest('.bookmark-icon-wrapper')) return;
                // direct 一级失败 → 尝试二级域名 → 仍失败隐藏（显示首字母）
                if (img.dataset.fallback && !img.dataset.ftried) {
                    img.dataset.ftried = '1';
                    img.src = img.dataset.fallback;
                    return;
                }
                // 无可再试的地址（或回退也失败）：记 none，后续渲染跳过请求
                if (img.dataset.ficon) {
                    const [srcName, host] = String(img.dataset.ficon).split('|');
                    if (srcName && host) this._iconCacheSet(srcName, host, 'none');
                }
                img.style.display = 'none';
            }, true);
        },

        /**
         * 在设置面板中渲染可编辑的书签列表（手柄拖拽 + ↑↓，App.Sortable 复用）
         * 由 settings.js 调用
         */
        renderEditor() {
            if (!this.editList) return;
            const bookmarks = window.App.state.bookmarks;
            this.editList.innerHTML = bookmarks.map((bm, idx) => `
                <div class="bookmark-edit-item" data-id="${App.Utils.escapeAttr(bm.id || '')}" data-index="${idx}">
                    <span class="drag-handle" draggable="true" title="拖拽排序" aria-label="拖拽排序">${App.Utils.svg('grip')}</span>
                    <div class="item-move-btns">
                        <button type="button" class="btn-move" data-move="up" data-idx="${idx}" title="上移" aria-label="上移该书签">${App.Utils.svg('arrowUp')}</button>
                        <button type="button" class="btn-move" data-move="down" data-idx="${idx}" title="下移" aria-label="下移该书签">${App.Utils.svg('arrowDown')}</button>
                    </div>
                    <input class="settings-input settings-stretch" placeholder="名称" value="${App.Utils.escapeAttr(bm.name||'')}" data-field="name">
                    <input class="settings-input settings-stretch-2" placeholder="网址" value="${App.Utils.escapeAttr(bm.url||'')}" data-field="url">
                    <input class="settings-input settings-stretch" placeholder="图标(可选)" value="${App.Utils.escapeAttr(bm.iconUrl||'')}" data-field="iconUrl">
                    <button class="btn-icon-danger" data-idx="${idx}" title="删除">${App.Utils.svg('close')}</button>
                </div>
            `).join('');

            // 通用排序（拖拽手柄 + ↑↓）；输入框内容在 save() 时由 collectEdited 统一收集，
            // 此处只需按 DOM 顺序同步 state 数组（与自定义引擎同一套 Sortable）
            if (window.App.Sortable) {
                App.Sortable.bind(this.editList, {
                    itemSelector: '.bookmark-edit-item',
                    onReorder: (fromIdx, toIdx, orderedItems) => this._reorderState(orderedItems)
                });
            }
            // 绑定删除按钮事件
            this._bindDeleteEvents();
        },

        /** 按编辑器 DOM 顺序重排 state.bookmarks（不读输入框，保留未保存编辑） */
        _reorderState(orderedItems) {
            const arr = window.App.state.bookmarks || [];
            const byId = new Map(arr.map(bm => [String(bm.id), bm]));
            const ordered = [];
            orderedItems.forEach(item => {
                const found = byId.get(String(item.dataset.id));
                if (found) ordered.push(found);
            });
            if (ordered.length === arr.length) window.App.state.bookmarks = ordered;
        },

        /** 从编辑器中收集当前书签数组（按 DOM 顺序） */
        collectEdited() {
            if (!this.editList) return [];
            const items = this.editList.querySelectorAll('.bookmark-edit-item');
            const newBookmarks = [];
            let unsafe = 0;
            items.forEach(item => {
                const inputs = item.querySelectorAll('input');
                if (inputs.length >= 2) {
                    const url = inputs[1].value.trim();
                    if (url && !App.Utils.isSafeUrl(url)) { unsafe++; return; }
                    newBookmarks.push({
                        id: App.Utils.genId(), // 每次收集生成新 ID，避免冲突
                        name: inputs[0].value.trim(),
                        url,
                        iconUrl: inputs.length > 2 ? inputs[2].value.trim() : ''
                    });
                }
            });
            if (unsafe > 0) App.Utils.showToast(`已跳过 ${unsafe} 条含不安全网址的书签`);
            return newBookmarks.length ? newBookmarks : [{ id: '1', name: '', url: '', iconUrl: '' }];
        },

        /** 添加空白书签并刷新编辑器 */
        add() {
            window.App.state.bookmarks.push({
                id: App.Utils.genId(),
                name: '',
                url: '',
                iconUrl: ''
            });
            this.renderEditor();
        },

        /** 删除指定索引的书签并刷新编辑器 */
        remove(index) {
            const bookmarks = window.App.state.bookmarks;
            if (index >= 0 && index < bookmarks.length) {
                bookmarks.splice(index, 1);
            }
            // 重新渲染编辑器以更新索引
            this.renderEditor();
        },

        /** 保存书签到 localStorage */
        save() {
            App.Utils.save('sp_bookmarks', window.App.state.bookmarks);
        },

        /**
         * 导出书签为可粘贴的 JSON 文本（只保留有网址的有效书签）
         * @returns {string}
         */
        exportData() {
            const bookmarks = (window.App.state.bookmarks || [])
                .filter(bm => String(bm.url || '').trim())
                .map(bm => ({
                    name: String(bm.name || '').trim(),
                    url: String(bm.url || '').trim(),
                    iconUrl: String(bm.iconUrl || '').trim()
                }));
            return JSON.stringify({
                type: 'softstartpage-bookmarks',
                version: 1,
                exportedAt: new Date().toISOString(),
                bookmarks
            }, null, 2);
        },

        /**
         * 解析导入的书签文本（支持导出格式或纯数组）
         * @param {string} text
         * @returns {Array|null} 规范化后的书签数组；无效返回 null
         */
        parseImport(text) {
            let data;
            try {
                data = JSON.parse(String(text || ''));
            } catch (e) {
                return null;
            }
            let arr = null;
            if (Array.isArray(data)) arr = data;
            else if (data && Array.isArray(data.bookmarks)) arr = data.bookmarks;
            if (!arr) return null;

            let rejected = 0;
            const cleaned = arr.slice(0, 1000).map(bm => ({
                id: App.Utils.genId(),
                name: String((bm && bm.name) || '').trim().slice(0, 200),
                url: String((bm && bm.url) || '').trim().slice(0, 2000),
                iconUrl: String((bm && bm.iconUrl) || '').trim().slice(0, 2000)
            })).filter(bm => {
                if (!bm.url) return false;
                if (!App.Utils.isSafeUrl(bm.url)) { rejected++; return false; }
                if (bm.iconUrl && !App.Utils.isSafeUrl(bm.iconUrl)) { bm.iconUrl = ''; }
                return true;
            });
            if (rejected > 0) App.Utils.showToast(`已跳过 ${rejected} 条不安全网址`);
            return cleaned;
        },

        // ---------- 排序（拖拽/↑↓）已统一收敛到 App.Sortable（js/sortable.js） ----------

        /** 绑定删除按钮事件 */
        _bindDeleteEvents() {
            if (!this.editList) return;
            this.editList.querySelectorAll('.btn-icon-danger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    this.remove(idx);
                });
            });
        }
    };

    // 暴露到全局
    window.App.Bookmarks = Bookmarks;
})();