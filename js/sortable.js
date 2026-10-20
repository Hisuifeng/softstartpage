/**
 * sortable.js
 * 通用列表排序模块（拖拽手柄 + 上移/下移按钮）
 * 供书签编辑列表、自定义引擎列表等复用（样式类 .dragging/.drag-over/.btn-move 共用）
 *
 * 用法：
 *   App.Sortable.bind(container, {
 *     itemSelector: '.bookmark-edit-item',
 *     onReorder(fromIndex, toIndex, orderedItems) { ... } // 拖拽或按钮移动后回调
 *   });
 *   container 需包含 itemSelector 行；行内手柄为 .drag-handle（draggable），
 *   行内移动按钮为 .btn-move[data-move="up|down"][data-idx]。
 *
 * 挂载于 window.App.Sortable
 */
(function () {
    window.App = window.App || {};

    const Sortable = {
        _bound: new WeakSet(),

        /**
         * 绑定容器（幂等：同一容器重复 bind 只绑一次；重渲染后 DOM 事件由委托自动覆盖）
         * @param {HTMLElement} container 列表容器
         * @param {Object} opts
         * @param {string} opts.itemSelector 行选择器
         * @param {Function} [opts.onReorder] (fromIndex, toIndex, orderedItems) => void
         */
        bind(container, opts = {}) {
            if (!container || this._bound.has(container)) return;
            const itemSelector = opts.itemSelector;
            if (!itemSelector) return;
            this._bound.add(container);

            const onReorder = typeof opts.onReorder === 'function' ? opts.onReorder : null;
            let dragged = null;

            const items = () => Array.from(container.querySelectorAll(itemSelector));

            const reindex = () => {
                items().forEach((item, idx) => {
                    item.dataset.index = idx;
                    item.querySelectorAll('[data-idx]').forEach(el => { el.dataset.idx = idx; });
                });
            };

            const clearStyles = () => {
                items().forEach(item => item.classList.remove('dragging', 'drag-over'));
            };

            const finish = (fromIndex, toIndex) => {
                reindex();
                clearStyles();
                dragged = null;
                if (onReorder) onReorder(fromIndex, toIndex, items());
            };

            // ---------- 拖拽（仅手柄发起，容器级委托） ----------
            container.addEventListener('dragstart', (e) => {
                const handle = e.target.closest('.drag-handle');
                if (!handle) return;
                const item = handle.closest(itemSelector);
                if (!item) return;
                dragged = item;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.id || item.dataset.index || '');
                try {
                    e.dataTransfer.setDragImage(item, 20, Math.max(1, item.offsetHeight / 2));
                } catch (err) { /* 部分浏览器不支持自定义拖拽图像，忽略 */ }
                item.classList.add('dragging');
            });

            container.addEventListener('dragover', (e) => {
                if (!dragged) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                const target = e.target.closest(itemSelector);
                if (target && target !== dragged) target.classList.add('drag-over');
            });

            container.addEventListener('dragleave', (e) => {
                const target = e.target.closest(itemSelector);
                if (target) target.classList.remove('drag-over');
            });

            container.addEventListener('drop', (e) => {
                if (!dragged) return;
                e.preventDefault();
                const target = e.target.closest(itemSelector);
                if (!target || target === dragged) return;
                const list = items();
                const fromIndex = list.indexOf(dragged);
                const toIndex = list.indexOf(target);
                if (fromIndex < 0 || toIndex < 0) return;
                if (fromIndex < toIndex) container.insertBefore(dragged, target.nextSibling);
                else container.insertBefore(dragged, target);
                finish(fromIndex, toIndex);
            });

            container.addEventListener('dragend', () => {
                clearStyles();
                dragged = null;
            });

            // ---------- 上移/下移按钮（触屏与键盘，容器级委托） ----------
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-move');
                if (!btn || !container.contains(btn)) return;
                const idx = parseInt(btn.dataset.idx, 10);
                if (isNaN(idx)) return;
                const dir = btn.dataset.move === 'up' ? -1 : 1;
                const list = items();
                const target = idx + dir;
                if (target < 0 || target >= list.length) return;
                const from = list[idx];
                const to = list[target];
                if (!from || !to) return;
                if (dir < 0) container.insertBefore(from, to);
                else container.insertBefore(to, from);
                finish(idx, target);
                // 焦点跟随按钮，便于连续点击
                const focusBtn = container.querySelector(
                    `.btn-move[data-move="${dir < 0 ? 'up' : 'down'}"][data-idx="${target}"]`);
                if (focusBtn) focusBtn.focus();
            });
        }
    };

    window.App.Sortable = Sortable;
})();
