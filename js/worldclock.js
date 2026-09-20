/**
 * worldclock.js
 * 世界时钟模块
 * 挂载于 window.App.WorldClock
 */
(function () {
    // 确保全局 App 命名空间存在
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const WorldClock = {
        // DOM 元素
        overlay: null,
        listEl: null,
        presetSelect: null,
        customInput: null,
        addBtn: null,
        closeBtn: null,

        // 时区数据
        timezones: [],

        // 定时器 ID
        updateTimer: null,

        /**
         * 初始化世界时钟模块
         * @param {Array} [initialTimezones] 初始时区数组，若不传则从 localStorage 读取
         */
        init(initialTimezones) {
            this.overlay = document.getElementById('worldClockOverlay');
            this.listEl = document.getElementById('timezoneList');
            this.presetSelect = document.getElementById('timezonePreset');
            this.customInput = document.getElementById('customTimezoneInput');
            this.addBtn = document.getElementById('addTimezoneBtn');
            this.closeBtn = document.getElementById('closeWorldClockBtn');

            if (!this.overlay) {
                console.warn('世界时钟面板元素缺失，跳过世界时钟模块');
                return;
            }

            // 加载时区数据
            if (initialTimezones) {
                this.timezones = initialTimezones;
            } else {
                this.timezones = App.Utils.load('sp_timezones', [
                    { name: '本地时间', offset: 'local' }
                ]);
            }

            this._bindEvents();
            this._startAutoUpdate();
        },

        /** 解析 UTC 偏移量字符串为分钟数 */
        _parseOffset(offsetStr) {
            if (offsetStr === 'local') return null; // 本地时间
            const match = offsetStr.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);
            if (!match) return null;
            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2]) || 0;
            const minutes = parseInt(match[3]) || 0;
            return sign * (hours * 60 + minutes);
        },

        /** 根据偏移量获取对应时间 */
        _getTimeByOffset(offsetMinutes) {
            const now = new Date();
            if (offsetMinutes === null) return now; // 本地时间
            const utc = now.getTime() + now.getTimezoneOffset() * 60000;
            return new Date(utc + offsetMinutes * 60000);
        },

        /** 渲染时区列表 */
        renderList() {
            if (!this.listEl) return;
            const clock = window.App.Clock;
            this.listEl.innerHTML = this.timezones.map((tz, idx) => {
                const offsetMin = this._parseOffset(tz.offset);
                const now = this._getTimeByOffset(offsetMin);
                const timeStr = clock?.formatTime ? clock.formatTime(now, true) : now.toLocaleTimeString();
                const dateStr = clock?.formatDate ? clock.formatDate(now) : now.toLocaleDateString();
                const isLocal = tz.offset === 'local';
                return `
                    <div class="timezone-item" data-index="${idx}">
                        <div class="tz-info">
                            <span class="tz-name" data-idx="${idx}" title="点击修改名称">${App.Utils.escapeHtml(tz.name)} ${isLocal ? '(本地)' : ''}</span>
                            <span class="tz-time">${timeStr}</span>
                            <span class="tz-date">${dateStr}</span>
                        </div>
                        <button class="btn-icon-danger" data-idx="${idx}" title="删除">${App.Utils.svg('close')}</button>
                    </div>
                `;
            }).join('');

            // 绑定事件（每次重新渲染后都需要）
            this._bindListEvents();
        },

        /** 更新已渲染列表中的时间 */
        updateTimes() {
            if (!this.listEl || !this.overlay.classList.contains('open')) return;
            const clock = window.App.Clock;
            const items = this.listEl.querySelectorAll('.timezone-item');
            if (items.length !== this.timezones.length) {
                this.renderList();
                return;
            }
            items.forEach((item, idx) => {
                const tz = this.timezones[idx];
                const offsetMin = this._parseOffset(tz.offset);
                const now = this._getTimeByOffset(offsetMin);
                const timeStr = clock?.formatTime ? clock.formatTime(now, true) : now.toLocaleTimeString();
                const dateStr = clock?.formatDate ? clock.formatDate(now) : now.toLocaleDateString();
                item.querySelector('.tz-time').textContent = timeStr;
                item.querySelector('.tz-date').textContent = dateStr;
            });
        },

        /** 添加时区 */
        addTimezone(name, offset) {
            if (!name || !offset) return;
            // 检查重复
            if (this.timezones.some(tz => tz.offset === offset && tz.name === name)) {
                App.Utils.showToast('该时区已存在');
                return;
            }
            this.timezones.push({ name, offset });
            this._save();
            this.renderList();
            App.Utils.showToast('时区已添加');
        },

        /** 删除时区 */
        removeTimezone(index) {
            if (index >= 0 && index < this.timezones.length) {
                this.timezones.splice(index, 1);
                this._save();
                this.renderList();
            }
        },

        /** 保存时区数据到 localStorage */
        _save() {
            App.Utils.save('sp_timezones', this.timezones);
        },

        /** 启动每秒更新时间 */
        _startAutoUpdate() {
            this.updateTimer = setInterval(() => this.updateTimes(), 1000);
        },

        /** 绑定面板的事件 */
        _bindEvents() {
            // 打开面板（点击主页时间区域）
            const trigger = document.getElementById('timeSectionTrigger');
            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.overlay.classList.add('open');
                    this.renderList();
                });
            }

            // 关闭按钮
            if (this.closeBtn) {
                this.closeBtn.addEventListener('click', () => {
                    this.overlay.classList.remove('open');
                });
            }

            // 点击覆盖层关闭
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.overlay.classList.remove('open');
                }
            });

            // 添加按钮
            this.addBtn.addEventListener('click', () => {
                const preset = this.presetSelect.value;
                const custom = this.customInput.value.trim();
                if (preset) {
                    const name = this.presetSelect.selectedOptions[0].text.split(' (')[0];
                    const offset = preset.replace('UTC', '');
                    this.addTimezone(name, `UTC${offset}`);
                } else if (custom) {
                    const match = custom.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
                    if (!match) {
                        App.Utils.showToast('格式错误，请输入如 +8 或 -5:30');
                        return;
                    }
                    const sign = match[1];
                    const hours = match[2].padStart(2, '0');
                    const minutes = match[3] || '00';
                    const offsetStr = `UTC${sign}${hours}:${minutes}`;
                    this.addTimezone(`UTC${sign}${hours}:${minutes}`, offsetStr);
                    this.customInput.value = '';
                } else {
                    App.Utils.showToast('请选择或输入时区');
                }
            });
        },

        /** 绑定列表内的事件（名称编辑、删除） */
        _bindListEvents() {
            if (!this.listEl) return;

            // 名称编辑
            this.listEl.querySelectorAll('.tz-name').forEach(nameEl => {
                nameEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(nameEl.dataset.idx);
                    if (isNaN(idx) || idx < 0 || idx >= this.timezones.length) return;
                    const newName = prompt('请输入新的时区名称：', this.timezones[idx].name);
                    if (newName !== null && newName.trim() !== '') {
                        this.timezones[idx].name = newName.trim();
                        this._save();
                        this.renderList();
                        App.Utils.showToast('名称已更新');
                    }
                });
            });

            // 删除
            this.listEl.querySelectorAll('.btn-icon-danger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    this.removeTimezone(idx);
                });
            });
        }
    };

    // 暴露到全局
    window.App.WorldClock = WorldClock;
})();