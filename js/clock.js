/**
 * clock.js
 * 时钟和日期模块
 * 挂载于 window.App.Clock
 */
(function () {
    window.App = window.App || {};

    const Clock = {
        clockEl: null,
        dateEl: null,
        timer: null,
        // 结构缓存：仅当格式开关变化时重建 DOM，每秒只改文本，避免 innerHTML 重绘打断冒号动画
        _parts: null,
        _structKey: '',
        _lastDate: '',

        init() {

            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次

            this._inited = true;
            this.clockEl = document.getElementById('clock');
            this.dateEl = document.getElementById('dateText');
            if (!this.clockEl || !this.dateEl) return;

            this._lastDate = '';
            this._structKey = '';
            this._parts = null;
            this.update(); // 立即显示
            this._schedule();
        },

        /** 对齐到下一整秒调度，避免 setInterval 漂移 */
        _schedule() {
            clearTimeout(this.timer);
            const delay = 1000 - (Date.now() % 1000) + 10;
            this.timer = setTimeout(() => {
                this.update();
                this._schedule();
            }, delay);
        },

        /** 按当前格式构建时钟 DOM（只在结构变化时调用） */
        _buildParts(tf) {
            const mk = (cls, style) => {
                const el = document.createElement('span');
                if (cls) el.className = cls;
                if (style) el.setAttribute('style', style);
                return el;
            };
            const frag = document.createDocumentFragment();
            const hh = mk('clock-grad');
            const colon1 = mk('colon clock-grad');
            colon1.textContent = ':';
            const mm = mk('clock-grad');
            frag.append(hh, colon1, mm);

            const parts = { hh, mm, ss: null, ampm: null };

            if (tf.showSeconds) {
                const colon2 = mk('colon clock-grad', 'animation:none;opacity:0.35;font-size:0.7em;');
                colon2.textContent = ':';
                const ss = mk('clock-grad', 'font-size:0.55em;opacity:0.5;');
                frag.append(colon2, ss);
                parts.ss = ss;
            }
            if (tf.hour24 === false) {
                const ampm = mk('', 'font-size:0.4em;opacity:0.55;');
                frag.append(document.createTextNode(' '), ampm);
                parts.ampm = ampm;
            }
            this.clockEl.replaceChildren(frag);
            this._parts = parts;
        },

        /**
         * 时/分/秒/上下午拆解（M8 DRY：update 与 formatTime 共用）
         * @param {Date} date
         * @param {boolean} use24 是否 24 小时制
         */
        _timeParts(date, use24) {
            const h24 = date.getHours();
            return {
                hourStr: use24
                    ? String(h24).padStart(2, '0')
                    : String(h24 % 12 || 12).padStart(2, '0'),
                m: String(date.getMinutes()).padStart(2, '0'),
                s: String(date.getSeconds()).padStart(2, '0'),
                ampm: h24 >= 12 ? 'PM' : 'AM'
            };
        },

        update() {
            const tf = App.state.timeFormat || {};
            const use24 = tf.hour24 !== false; // 与 formatTime/设置默认值语义一致：缺省即 24 小时制
            const now = new Date();

            // ---- 日期：仅跨天 / 格式变化时写 DOM ----
            const dateStr = this.formatDate(now);
            if (dateStr !== this._lastDate) {
                this.dateEl.textContent = dateStr;
                this._lastDate = dateStr;
            }

            // ---- 时间：结构变化才重建，否则只更新文本 ----
            const structKey = `${use24 ? 1 : 0}|${tf.showSeconds ? 1 : 0}`;
            if (structKey !== this._structKey || !this._parts || !this.clockEl.contains(this._parts.hh)) {
                this._buildParts(tf);
                this._structKey = structKey;
            }

            const p = this._timeParts(now, use24);
            this._parts.hh.textContent = p.hourStr;
            this._parts.mm.textContent = p.m;
            if (this._parts.ss) this._parts.ss.textContent = p.s;
            if (this._parts.ampm) this._parts.ampm.textContent = p.ampm;
        },

        /** 强制立即更新（当设置改变时由外部调用） */
        refresh() {
            this.update();
        },

        /**
         * 格式化时间（供世界时钟等模块复用）
         * @param {Date} date 日期对象
         * @param {boolean} force24h 是否强制24小时制
         * @returns {string}
         */
        formatTime(date, force24h) {
            const tf = App.state.timeFormat || {};
            const use24 = force24h !== undefined ? !!force24h : tf.hour24 !== false;
            const p = this._timeParts(date, use24);
            let timeStr = `${p.hourStr}:${p.m}`;
            if (!use24) timeStr += ` ${p.ampm}`;
            if (tf.showSeconds !== false) timeStr += `:${p.s}`;
            return timeStr;
        },

        /**
         * 格式化日期（供世界时钟等模块复用）
         * @param {Date} date 日期对象
         * @returns {string}
         */
        formatDate(date) {
            const tf = App.state.timeFormat || {};
            const y = date.getFullYear();
            const mo = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const wds = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
            switch (tf.dateFormat) {
                case 'iso':
                    return `${y}-${mo}-${d} ${wds}`;
                case 'us':
                    return `${mo}/${d}/${y} ${wds}`;
                case 'uk':
                    return `${d}/${mo}/${y} ${wds}`;
                default:
                    return `${y}年${mo}月${d}日 ${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()]}`;
            }
        }
    };

    window.App.Clock = Clock;
})();