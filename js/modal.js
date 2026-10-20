/**
 * modal.js
 * 统一弹窗（无障碍 Modal）辅助模块
 *
 * 职责（三个弹窗：设置 / 天气 / 世界时钟 复用）：
 *   - 补齐 role="dialog" / aria-modal / aria-labelledby
 *   - 打开时焦点移入弹窗，关闭后归还给触发元素
 *   - Escape 关闭（弹窗栈顶）
 *   - Tab 焦点陷阱（不跑到遮罩外）
 *   - 背景内容 inert + body 滚动锁定
 *   - 可选：点击遮罩关闭
 *
 * 用法：
 *   App.Modal.open(overlayEl, { closeOnBackdrop: true });
 *   App.Modal.close(overlayEl);
 *
 * 挂载于 window.App.Modal
 */
(function () {
    window.App = window.App || {};

    const FOCUSABLE_SELECTOR = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    let uidSeq = 0;

    const Modal = {
        /** 打开中的弹窗栈（支持嵌套，如设置面板内的确认） */
        _stack: [],
        _escBound: false,

        /**
         * 打开弹窗（负责无障碍属性与焦点管理，不改动 .open 类，由调用方控制显隐）
         * @param {HTMLElement} overlay 遮罩容器
         * @param {Object} [opts]
         * @param {boolean} [opts.closeOnBackdrop=false] 点击遮罩空白处时调用 close()
         * @param {HTMLElement} [opts.focusEl] 指定初始聚焦元素
         * @param {Function} [opts.onClose] 关闭时回调（含 Escape/任意关闭路径，供调用方做清理/回滚）
         * @returns {{close: Function}} 句柄
         */
        open(overlay, opts = {}) {
            if (!overlay) return null;
            // 同一元素重复打开只更新栈顶
            if (this._stack.some(e => e.overlay === overlay)) {
                return { close: () => this.close(overlay) };
            }

            const entry = {
                overlay,
                prevFocus: document.activeElement,
                closeOnBackdrop: !!opts.closeOnBackdrop,
                backdropHandler: null,
                onClose: typeof opts.onClose === 'function' ? opts.onClose : null
            };

            // ---- 无障碍属性 ----
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            const heading = overlay.querySelector('h1, h2, h3');
            if (heading) {
                if (!heading.id) heading.id = `modal-title-${++uidSeq}`;
                overlay.setAttribute('aria-labelledby', heading.id);
            }

            // ---- 背景 inert（支持则用 inert，否则 aria-hidden）----
            this._setBackgroundInert(true);

            // ---- 滚动锁定 ----
            document.body.style.overflow = 'hidden';

            // ---- 点击遮罩关闭 ----
            if (entry.closeOnBackdrop) {
                entry.backdropHandler = (e) => {
                    if (e.target === overlay) this.close(overlay);
                };
                overlay.addEventListener('click', entry.backdropHandler);
            }

            this._stack.push(entry);
            this._bindEsc();

            // ---- 焦点移入弹窗 ----
            requestAnimationFrame(() => {
                const target = opts.focusEl
                    || overlay.querySelector(FOCUSABLE_SELECTOR)
                    || overlay.querySelector('.settings-panel, .weather-panel, .world-clock-panel');
                if (target) {
                    if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
                        target.setAttribute('tabindex', '-1');
                    }
                    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
                }
            });

            return { close: () => this.close(overlay) };
        },

        /**
         * 关闭弹窗（还原焦点与滚动）
         * @param {HTMLElement} overlay
         */
        close(overlay) {
            const idx = this._stack.findIndex(e => e.overlay === overlay);
            if (idx === -1) return;
            const [entry] = this._stack.splice(idx, 1);

            // 调用方清理钩子（先于焦点还原，便于回滚后焦点逻辑看到最终状态）
            if (entry.onClose) {
                try { entry.onClose(); } catch (err) { console.error(err); }
            }

            if (entry.backdropHandler) overlay.removeEventListener('click', entry.backdropHandler);

            // 还原无障碍属性（保留 class 交给调用方）
            overlay.removeAttribute('aria-modal');

            // 焦点归还触发元素
            const prev = entry.prevFocus;
            if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
                try { prev.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
            }

            // 栈空时恢复背景与滚动
            if (this._stack.length === 0) {
                this._setBackgroundInert(false);
                document.body.style.overflow = '';
            }
        },

        /** 判断某弹窗是否处于打开栈中 */
        isOpen(overlay) {
            return this._stack.some(e => e.overlay === overlay);
        },

        /** 当前栈顶 */
        top() {
            return this._stack.length ? this._stack[this._stack.length - 1] : null;
        },

        // ---------- 内部 ----------

        /** 背景 inert / aria-hidden 切换 */
        _setBackgroundInert(on) {
            const main = document.getElementById('mainContainer');
            const targets = [main, document.getElementById('weatherFab'), document.getElementById('settingsFab')]
                .filter(Boolean);
            targets.forEach(el => {
                if (on) {
                    el.setAttribute('inert', '');
                    el.setAttribute('aria-hidden', 'true');
                } else {
                    // 仅当没有打开中的弹窗时才解除
                    if (this._stack.length === 0) {
                        el.removeAttribute('inert');
                        el.removeAttribute('aria-hidden');
                    }
                }
            });
        },

        /** 绑定全局 Escape（首个打开时绑定） */
        _bindEsc() {
            if (this._escBound) return;
            this._escBound = true;
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape' || this._stack.length === 0) return;
                const top = this._stack[this._stack.length - 1];
                if (!top) return;
                e.stopPropagation();
                this.close(top.overlay);
                // 调用方通过监听 open 类控制显隐：同步移除 .open
                top.overlay.classList.remove('open');
            });
        },

        /** Tab 焦点陷阱：在容器内循环（暴露给需要的调用方，也可手动绑定） */
        trapFocus(container, e) {
            if (e.key !== 'Tab') return;
            const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
                .filter(el => el.offsetParent !== null || el === document.activeElement);
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    // Tab 循环：仅对栈顶弹窗生效
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || Modal._stack.length === 0) return;
        const top = Modal._stack[Modal._stack.length - 1];
        if (!top) return;
        const panel = top.overlay.querySelector('.settings-panel, .weather-panel, .world-clock-panel') || top.overlay;
        Modal.trapFocus(panel, e);
    });

    window.App.Modal = Modal;

    // ==================== 轻量 Dialog（L4）====================
    // 替换阻塞式 confirm/prompt：App.Dialog.confirm(msg) → Promise<boolean>
    //                    App.Dialog.prompt(msg, def) → Promise<string|null>
    // 导出失败时的长文本展示用 Dialog.textarea（选中文本供手动复制）
    const Dialog = {
        _el: null,

        _ensure() {
            if (this._el && document.contains(this._el)) return this._el;
            const el = document.createElement('div');
            el.className = 'app-dialog-overlay';
            el.hidden = true;
            document.body.appendChild(el);
            this._el = el;
            return el;
        },

        /**
         * @param {Object} opts
         * @param {string} opts.title
         * @param {string} [opts.message]
         * @param {string} [opts.okText='确定']
         * @param {string} [opts.cancelText] 有值则显示取消按钮
         * @param {boolean} [opts.input] 是否单行输入
         * @param {boolean} [opts.textarea] 是否多行只读（自动聚焦选中）
         * @param {string} [opts.defaultValue]
         * @returns {Promise<string|boolean|null>} confirm→boolean；prompt→string|null
         */
        _show(opts) {
            return new Promise((resolve) => {
                const el = this._ensure();
                const title = App.Utils.escapeHtml(opts.title || '');
                const msg = opts.message
                    ? `<p class="app-dialog-msg">${App.Utils.escapeHtml(opts.message)}</p>` : '';
                let field = '';
                if (opts.input) {
                    field = `<input type="text" class="settings-input app-dialog-input" value="${App.Utils.escapeAttr(opts.defaultValue || '')}">`;
                } else if (opts.textarea) {
                    field = `<textarea class="app-dialog-textarea" readonly rows="8">${App.Utils.escapeHtml(opts.defaultValue || '')}</textarea>`;
                }
                const cancelBtn = opts.cancelText
                    ? `<button type="button" class="btn app-dialog-cancel">${App.Utils.escapeHtml(opts.cancelText)}</button>` : '';
                el.innerHTML = `
                    <div class="app-dialog" role="alertdialog" aria-modal="true" aria-label="${title}">
                        <div class="app-dialog-title">${title}</div>
                        ${msg}
                        ${field}
                        <div class="app-dialog-actions">
                            ${cancelBtn}
                            <button type="button" class="btn primary app-dialog-ok">${App.Utils.escapeHtml(opts.okText || '确定')}</button>
                        </div>
                    </div>`;
                el.hidden = false;
                const prevFocus = document.activeElement;
                const input = el.querySelector('.app-dialog-input, .app-dialog-textarea');
                const okBtn = el.querySelector('.app-dialog-ok');
                const cancelBtnEl = el.querySelector('.app-dialog-cancel');

                let settled = false;
                const finish = (val) => {
                    if (settled) return;
                    settled = true;
                    document.removeEventListener('keydown', onKey, true);
                    el.hidden = true;
                    el.innerHTML = '';
                    if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
                        try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
                    }
                    resolve(val);
                };
                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        finish(opts.input || opts.textarea ? null : false);
                    } else if (e.key === 'Enter' && input && !opts.textarea
                        && document.activeElement === input) {
                        e.preventDefault();
                        finish(input.value);
                    }
                };
                document.addEventListener('keydown', onKey, true);
                okBtn.addEventListener('click', () => {
                    finish(opts.input ? input.value : (opts.textarea ? true : true));
                });
                if (cancelBtnEl) {
                    cancelBtnEl.addEventListener('click', () => finish(opts.input || opts.textarea ? null : false));
                }
                // 遮罩点击 = 取消
                el.addEventListener('click', (e) => {
                    if (e.target === el) finish(opts.input || opts.textarea ? null : false);
                });
                requestAnimationFrame(() => {
                    if (input) {
                        input.focus();
                        if (opts.textarea && typeof input.select === 'function') input.select();
                    } else {
                        okBtn.focus();
                    }
                });
            });
        },

        /** 确认框：resolve(true/false) */
        confirm(message, title = '请确认') {
            return this._show({ title, message, okText: '确定', cancelText: '取消' });
        },

        /** 输入框：resolve(字符串 | null=取消) */
        prompt(message, defaultValue = '', title = '请输入') {
            return this._show({
                title, message, input: true, defaultValue,
                okText: '确定', cancelText: '取消'
            });
        },

        /** 长文本只读展示（自动选中，供手动复制）：resolve(true) */
        textarea(text, title = '请手动复制') {
            return this._show({ title, textarea: true, defaultValue: text, okText: '关闭' });
        }
    };

    window.App.Dialog = Dialog;
})();
