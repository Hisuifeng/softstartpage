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

        init() {
            this.clockEl = document.getElementById('clock');
            this.dateEl = document.getElementById('dateText');
            if (!this.clockEl || !this.dateEl) return;

            this.update(); // 立即显示
            this.timer = setInterval(() => this.update(), 1000);
        },

        update() {
            const tf = App.state.timeFormat;
            const now = new Date();
            const h24 = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const y = now.getFullYear();
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');

            const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const weekDaysShort = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            const wd = weekDays[now.getDay()];
            const wds = weekDaysShort[now.getDay()];

            // 构建时间 HTML
            let timeHtml;
            if (tf.hour24) {
                timeHtml = `${String(h24).padStart(2, '0')}<span class="colon">:</span>${m}`;
            } else {
                const h12 = h24 % 12 || 12;
                const ampm = h24 >= 12 ? 'PM' : 'AM';
                timeHtml = `${String(h12).padStart(2, '0')}<span class="colon">:</span>${m} <span style="font-size:0.4em;opacity:0.55">${ampm}</span>`;
            }
            if (tf.showSeconds) {
                timeHtml += `<span class="colon" style="animation:none;opacity:0.35;font-size:0.7em;">:</span><span style="font-size:0.55em;opacity:0.5;">${s}</span>`;
            }
            this.clockEl.innerHTML = timeHtml;

            // 构建日期字符串
            let dateStr;
            switch (tf.dateFormat) {
                case 'iso':
                    dateStr = `${y}-${mo}-${d} ${wds}`;
                    break;
                case 'us':
                    dateStr = `${mo}/${d}/${y} ${wds}`;
                    break;
                case 'uk':
                    dateStr = `${d}/${mo}/${y} ${wds}`;
                    break;
                default:
                    dateStr = `${y}年${mo}月${d}日 ${wd}`;
            }
            this.dateEl.textContent = dateStr;
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
            const h24 = date.getHours();
            const m = String(date.getMinutes()).padStart(2, '0');
            const s = String(date.getSeconds()).padStart(2, '0');
            const use24 = force24h !== undefined ? !!force24h : tf.hour24 !== false;
            let timeStr;
            if (use24) {
                timeStr = `${String(h24).padStart(2, '0')}:${m}`;
            } else {
                const h12 = h24 % 12 || 12;
                const ampm = h24 >= 12 ? 'PM' : 'AM';
                timeStr = `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
            }
            if (tf.showSeconds !== false) timeStr += `:${s}`;
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