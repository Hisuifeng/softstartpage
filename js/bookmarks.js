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

        // 当前拖拽状态
        draggedItem: null,
        draggedIndex: -1,

        /**
         * 初始化书签模块
         * @param {Array} [initialBookmarks] 书签数组，若不传则从 localStorage 读取
         */
        init(initialBookmarks) {
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

        /** 渲染主页书签区域 */
        renderMain() {
            if (!this.mainContainer) return;
            const bookmarks = window.App.state.bookmarks;
            this.mainContainer.innerHTML = bookmarks.map(bm => {
                const name = String(bm.name || '');
                const url = String(bm.url || '');
                const iconUrl = String(bm.iconUrl || '');
                const href = url ? App.Utils.escapeHtml(url) : '#';
                const img = iconUrl
                    ? `<img src="${App.Utils.escapeHtml(iconUrl)}" alt="" onerror="this.style.display='none'" onload="this.style.display='block';this.previousElementSibling.style.opacity='0'">`
                    : '';
                return `
                <a class="bookmark-item" href="${href}" target="_blank" rel="noopener noreferrer" title="${App.Utils.escapeHtml(name)}">
                    <div class="bookmark-icon-wrapper">
                        <span class="bookmark-fallback">${App.Utils.escapeHtml(App.Utils.getFallbackChar(name))}</span>
                        ${img}
                    </div>
                    <span class="bookmark-name">${name ? App.Utils.escapeHtml(name) : '未命名'}</span>
                </a>
            `;
            }).join('');
        },

        /**
         * 在设置面板中渲染可编辑的书签列表（包含拖拽功能）
         * 由 settings.js 调用
         */
        renderEditor() {
            if (!this.editList) return;
            const bookmarks = window.App.state.bookmarks;
            this.editList.innerHTML = bookmarks.map((bm, idx) => `
                <div class="bookmark-edit-item" draggable="true" data-index="${idx}">
                    <input class="settings-input" placeholder="名称" value="${App.Utils.escapeHtml(bm.name||'')}" data-field="name" style="flex:1;">
                    <input class="settings-input" placeholder="网址" value="${App.Utils.escapeHtml(bm.url||'')}" data-field="url" style="flex:2;">
                    <input class="settings-input" placeholder="图标(可选)" value="${App.Utils.escapeHtml(bm.iconUrl||'')}" data-field="iconUrl" style="flex:1;">
                    <button class="btn-icon-danger" data-idx="${idx}" title="删除">${App.Utils.svg('close')}</button>
                </div>
            `).join('');

            // 绑定拖拽事件
            this._bindDragEvents();
            // 绑定删除按钮事件
            this._bindDeleteEvents();
        },

        /** 从编辑器中收集当前书签数组（按 DOM 顺序） */
        collectEdited() {
            if (!this.editList) return [];
            const items = this.editList.querySelectorAll('.bookmark-edit-item');
            const newBookmarks = [];
            items.forEach(item => {
                const inputs = item.querySelectorAll('input');
                if (inputs.length >= 2) {
                    newBookmarks.push({
                        id: App.Utils.genId(), // 每次收集生成新 ID，避免冲突
                        name: inputs[0].value.trim(),
                        url: inputs[1].value.trim(),
                        iconUrl: inputs.length > 2 ? inputs[2].value.trim() : ''
                    });
                }
            });
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

        // ---------- 拖拽实现 ----------
        _bindDragEvents() {
            if (!this.editList) return;
            const items = this.editList.querySelectorAll('.bookmark-edit-item');

            items.forEach(item => {
                item.addEventListener('dragstart', (e) => this._onDragStart(e));
                item.addEventListener('dragover', (e) => this._onDragOver(e));
                item.addEventListener('dragleave', (e) => this._onDragLeave(e));
                item.addEventListener('drop', (e) => this._onDrop(e));
                item.addEventListener('dragend', (e) => this._onDragEnd(e));
            });
        },

        _onDragStart(e) {
            const item = e.target.closest('.bookmark-edit-item');
            if (!item) return;
            this.draggedItem = item;
            this.draggedIndex = parseInt(item.dataset.index);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedIndex);
            item.classList.add('dragging');
        },

        _onDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const target = e.target.closest('.bookmark-edit-item');
            if (target && target !== this.draggedItem) {
                target.classList.add('drag-over');
            }
        },

        _onDragLeave(e) {
            const target = e.target.closest('.bookmark-edit-item');
            if (target) {
                target.classList.remove('drag-over');
            }
        },

        _onDrop(e) {
            e.preventDefault();
            const target = e.target.closest('.bookmark-edit-item');
            if (!target || !this.draggedItem || target === this.draggedItem) return;

            const parent = this.editList;
            const targetIndex = parseInt(target.dataset.index);
            const fromIndex = this.draggedIndex;

            // 在 DOM 中移动节点
            if (fromIndex < targetIndex) {
                parent.insertBefore(this.draggedItem, target.nextSibling);
            } else {
                parent.insertBefore(this.draggedItem, target);
            }

            // 更新书签数组顺序
            const movedItem = window.App.state.bookmarks.splice(fromIndex, 1)[0];
            // 注意插入索引：如果目标在移动前的前面，移除后目标索引可能需调整
            const newTargetIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
            window.App.state.bookmarks.splice(newTargetIndex, 0, movedItem);

            // 重新分配所有 data-index 属性
            const allItems = parent.querySelectorAll('.bookmark-edit-item');
            allItems.forEach((item, idx) => {
                item.dataset.index = idx;
                // 同步更新删除按钮的 data-idx 属性
                const delBtn = item.querySelector('.btn-icon-danger');
                if (delBtn) delBtn.dataset.idx = idx;
            });

            // 清理拖拽样式
            this._clearDragStyles();
            this.draggedItem = null;
            this.draggedIndex = -1;
        },

        _onDragEnd() {
            this._clearDragStyles();
            this.draggedItem = null;
            this.draggedIndex = -1;
        },

        _clearDragStyles() {
            if (!this.editList) return;
            this.editList.querySelectorAll('.bookmark-edit-item').forEach(item => {
                item.classList.remove('dragging', 'drag-over');
            });
        },

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