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
        hourToggle: null,
        hourLabel: null,
        dstRow: null,
        dstEnabled: null,
        dstOffsetInput: null,
        dstHemiSelect: null,

        // 时区数据
        timezones: [],
        // 定时器 ID
        updateTimer: null,
        // Intl 格式器缓存（按 IANA 时区）
        _fmtCache: {},
        // 标准时/夏令时判定缓存（每年只变两次，缓存 6 小时）
        _stdCache: {},
        // 浏览器本地时区标识缓存
        _localTzCache: '',

        /**
         * 初始化世界时钟模块
         * @param {Array} [initialTimezones] 初始时区数组，若不传则从 localStorage 读取
         */
        init(initialTimezones) {
            if (this._inited) return; // M14 防重入：document/window 级监听只绑一次
            this._inited = true;
            this.overlay = document.getElementById('worldClockOverlay');
            this.listEl = document.getElementById('timezoneList');
            this.presetSelect = document.getElementById('timezonePreset');
            this.customInput = document.getElementById('customTimezoneInput');
            this.addBtn = document.getElementById('addTimezoneBtn');
            this.closeBtn = document.getElementById('closeWorldClockBtn');
            this.hourToggle = document.getElementById('wcHourToggle');
            this.hourLabel = document.getElementById('wcHourLabel');
            this.dstRow = document.getElementById('wcDstRow');
            this.dstEnabled = document.getElementById('dstEnabledChk');
            this.dstOffsetInput = document.getElementById('dstOffsetInput');
            this.dstHemiSelect = document.getElementById('dstHemiSelect');
            this.addToggle = document.getElementById('wcAddToggle');
            this.addPanel = document.getElementById('wcAddPanel');

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

        /** 校验 IANA 时区标识（如 Asia/Shanghai）是否有效 */
        _isValidTz(tz) {
            if (!tz || typeof tz !== 'string') return false;
            try {
                new Intl.DateTimeFormat('en-US', { timeZone: tz });
                return true;
            } catch (e) {
                return false;
            }
        },

        /** 获取（并缓存）某时区的墙钟分段格式器 */
        _zoneFmt(tz) {
            if (!this._fmtCache[tz]) {
                this._fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
                    timeZone: tz,
                    hourCycle: 'h23',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
            }
            return this._fmtCache[tz];
        },

        /**
         * 取某时刻该时区墙钟字段拼成的 UTC 毫秒数；时区无效返回 null
         * @param {string} tz IANA 时区标识
         * @param {Date} at 参照时刻
         * @returns {number|null}
         */
        _zonePartsAt(tz, at) {
            let parts;
            try {
                parts = this._zoneFmt(tz).formatToParts(at);
            } catch (e) {
                return null;
            }
            const g = {};
            parts.forEach(p => { if (p.type !== 'literal') g[p.type] = p.value; });
            const H = +g.hour === 24 ? 0 : +g.hour;
            return Date.UTC(+g.year, +g.month - 1, +g.day, H, +g.minute, +g.second);
        },

        /**
         * 按 IANA 时区取"此刻"的墙钟信息（自动跟随夏令时）
         * @returns {{date: Date, label: string, offMin: number}|null} date 的本地 getter 等于该时区墙钟；label 形如 UTC+8 / UTC-5:30；时区无效返回 null
         */
        _zoneInfo(tz) {
            const now = new Date();
            const asUTC = this._zonePartsAt(tz, now);
            if (asUTC === null) return null;
            const offMin = Math.round((asUTC - now.getTime()) / 60000);
            // 平移一个本地偏移，使 Date 的本地 getter 恰好输出该时区的墙钟
            const date = new Date(asUTC + now.getTimezoneOffset() * 60000);
            return { date, label: this._fmtOffset(offMin), offMin };
        },

        /** 浏览器本地时区标识（如 Asia/Shanghai） */
        _localTzId() {
            if (!this._localTzCache) {
                try {
                    this._localTzCache = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                } catch (e) {
                    this._localTzCache = '';
                }
            }
            return this._localTzCache;
        },

        /** 本地当前 UTC 偏移（分钟） */
        _localOffMin() {
            return -new Date().getTimezoneOffset();
        },

        /** 按小时判断昼夜：6:00–17:59 为白天；icon 对应 Utils.ICONS 键名 */
        _dayNight(hour) {
            return (hour >= 6 && hour < 18)
                ? { icon: 'sun', label: '白天' }
                : { icon: 'moon', label: '夜晚' };
        },

        /**
         * 与本地的时差显示
         * @param {number} offMin 该条目当前 UTC 偏移（分钟）
         * @returns {{text: string, title: string}}
         */
        _fmtDiff(offMin) {
            const diff = offMin - this._localOffMin();
            if (diff === 0) return { text: '与本地相同', title: '与本地时差：相同' };
            const sign = diff > 0 ? '+' : '-';
            const abs = Math.abs(diff);
            const h = Math.floor(abs / 60);
            const m = abs % 60;
            const short = h
                ? `${sign}${h}h${m ? String(m).padStart(2, '0') : ''}`
                : `${sign}${m}m`;
            const detail = `${h ? h + ' 小时' : ''}${m ? (h ? ' ' : '') + m + ' 分' : ''}`;
            return { text: `时差 ${short}`, title: `比本地${diff > 0 ? '快' : '慢'} ${detail}` };
        },

        /**
         * 该时区的标准时偏移与是否实行夏令时（每年只变两次，缓存 6 小时）
         * @returns {{observes: boolean, std: number|null}}
         */
        _stdInfo(tz) {
            const now = Date.now();
            const cached = this._stdCache[tz];
            if (cached && now - cached.at < 6 * 3600 * 1000) {
                return { observes: cached.observes, std: cached.std };
            }
            const y = new Date().getFullYear();
            const at = (mon) => this._zoneOffsetMinAt(tz, new Date(Date.UTC(y, mon, 1, 12)));
            const jan = at(0);
            const jul = at(6);
            const observes = jan !== null && jul !== null && jan !== jul;
            const std = observes ? Math.min(jan, jul) : null;
            this._stdCache[tz] = { at: now, observes, std };
            return { observes, std };
        },

        /** 某时区某时刻的 UTC 偏移（分钟），无效返回 null */
        _zoneOffsetMinAt(tz, at) {
            const asUTC = this._zonePartsAt(tz, at);
            return asUTC === null ? null : Math.round((asUTC - at.getTime()) / 60000);
        },

        /** 某年某月（0 基）最后一个周日 01:00 UTC 的时间戳 */
        _lastSunday(year, month0) {
            const d = new Date(Date.UTC(year, month0 + 1, 0));
            d.setUTCDate(d.getUTCDate() - d.getUTCDay());
            d.setUTCHours(1, 0, 0, 0);
            return d.getTime();
        },

        /** 某年某月（0 基）第 n 个周日 01:00 UTC 的时间戳 */
        _nthSunday(year, month0, n) {
            const d = new Date(Date.UTC(year, month0, 1));
            d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7) + (n - 1) * 7);
            d.setUTCHours(1, 0, 0, 0);
            return d.getTime();
        },

        /**
         * 自定义偏移的冬夏令时判定（近似规则，MVP）
         * 北半球：3 月最后一个周日 → 10 月最后一个周日为夏令时
         * 南半球：10 月第一个周日 → 次年 4 月第一个周日为夏令时
         * @param {'n'|'s'} hemi 半球
         * @param {number} [at=Date.now()] 参照时间戳（便于测试）
         */
        _inDstPeriod(hemi, at = Date.now()) {
            const y = new Date(at).getUTCFullYear();
            if (hemi === 's') {
                return at >= this._nthSunday(y, 9, 1) || at < this._nthSunday(y, 3, 1);
            }
            return at >= this._lastSunday(y, 2) && at < this._lastSunday(y, 9);
        },

        /**
         * 冬/夏令时小字标签：只对实行夏令时的 IANA 时区生效
         * @param {string} tz IANA 时区标识
         * @param {number|null} curOffMin 当前偏移
         * @returns {string} '夏令时中' / '冬令时中' / ''
         */
        _dstTag(tz, curOffMin) {
            if (curOffMin === null) return '';
            const { observes, std } = this._stdInfo(tz);
            if (!observes) return '';
            return curOffMin > std ? '夏令时中' : '冬令时中';
        },

        /** 分钟数 → UTC±HH:MM 显示（分钟为 0 时省略分钟段） */
        _fmtOffset(min) {
            const sign = min < 0 ? '-' : '+';
            const abs = Math.abs(min);
            const h = Math.floor(abs / 60);
            const m = abs % 60;
            return `UTC${sign}${h}` + (m ? `:${String(m).padStart(2, '0')}` : '');
        },

        /**
         * 解析夏令时增量输入：填"相对基础（标准）偏移的加量"，如基础 UTC-5 填 +1 → 夏令时 UTC-4
         * @param {string} raw 用户输入（±H[:MM]，符号省略视为正）
         * @param {number} stdMin 基础偏移（分钟）
         * @returns {{ok: true, offset: string}|{ok: false, error: string}} offset 为绝对形式 'UTC±HH:MM'
         */
        _dstFromDelta(raw, stdMin) {
            const m = String(raw || '').trim().match(/^([+-])?(\d{1,2})(?::(\d{1,2}))?$/);
            const mins = m ? parseInt(m[3] || '0', 10) : null;
            if (!m || mins >= 60) return { ok: false, error: '请输入夏令时增量，如 +1 或 1:30' };
            const delta = (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + mins);
            if (delta <= 0) return { ok: false, error: '夏令时是拨快，应填正增量（如 +1）' };
            const dstMin = stdMin + delta;
            if (dstMin > 14 * 60 || dstMin < -14 * 60) {
                return { ok: false, error: '夏令时增量不合理，结果需在 UTC-14 ~ UTC+14 内' };
            }
            const sign = dstMin < 0 ? '-' : '+';
            const abs = Math.abs(dstMin);
            return {
                ok: true,
                offset: `UTC${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
            };
        },

        /**
         * 统一入口：按条目类型取"此刻"的显示数据
         * offset 三种取值：'local' / 'UTC±HH:MM'（固定偏移，兼容旧数据）/ IANA 时区名
         * 固定偏移条目可带 dst：{ offset: 'UTC+2:00', hemi: 'n'|'s' }（自定义冬夏令时）
         * @returns {{date: Date, label: string, offMin: number|null, isZone: boolean, isLocal: boolean, dstState: string|null}}
         *   offMin 为当前生效的 UTC 偏移（本地条目为 null）；isZone = IANA 时区条目；
         *   isLocal = 与当前本地时区一致；dstState = 自定义条目的冬夏令时状态标签
         */
        _entryInfo(tz) {
            const offset = tz && tz.offset;
            const localTz = this._localTzId();
            const localOff = this._localOffMin();
            if (!offset || offset === 'local') {
                return { date: new Date(), label: '', offMin: null, isZone: false, isLocal: true, dstState: null };
            }
            if (/^UTC[+-]/.test(offset)) {
                const stdMin = this._parseOffset(offset);
                if (stdMin === null) {
                    return { date: new Date(), label: '', offMin: null, isZone: false, isLocal: false, dstState: null };
                }
                // 自定义冬夏令时：按半球近似规则取当前生效偏移
                let curMin = stdMin;
                let dstState = null;
                const dst = tz.dst;
                if (dst && dst.offset) {
                    const dstMin = this._parseOffset(dst.offset);
                    if (dstMin !== null && dstMin > stdMin) {
                        const active = this._inDstPeriod(dst.hemi === 's' ? 's' : 'n');
                        if (active) curMin = dstMin;
                        dstState = active ? '夏令时中' : '冬令时中';
                    }
                }
                return {
                    date: this._getTimeByOffset(curMin),
                    label: this._fmtOffset(curMin),
                    offMin: curMin,
                    isZone: false,
                    isLocal: offset === localTz || curMin === localOff,
                    dstState
                };
            }
            // IANA 时区
            const info = this._zoneInfo(offset);
            if (!info) return { date: new Date(), label: '', offMin: null, isZone: false, isLocal: false, dstState: null };
            return {
                date: info.date,
                label: info.label,
                offMin: info.offMin,
                isZone: true,
                isLocal: offset === localTz || info.offMin === localOff,
                dstState: null
            };
        },

        /**
         * 生成条目下方的小标签行 HTML
         * 顺序：冬/夏令时（首位，纯文字状态）→ 昼夜 → 时差 → 当前时区
         * icon 走 Utils.svg（扁平 SVG，随主题 currentColor 着色），其余为受控固定文案
         */
        _tagsHtml(tz, info) {
            const tags = [];
            const dstTag = info.isZone
                ? this._dstTag(tz.offset, info.offMin)
                : (info.dstState || '');
            if (dstTag) tags.push(`<span class="tz-tag tz-dst">${dstTag}</span>`);
            const dn = this._dayNight(info.date.getHours());
            tags.push(`<span class="tz-tag tz-dn">${App.Utils.svg(dn.icon)} ${dn.label}</span>`);
            if (info.offMin !== null) {
                const d = this._fmtDiff(info.offMin);
                tags.push(`<span class="tz-tag tz-diff" title="${d.title}">${d.text}</span>`);
            }
            if (info.isLocal && tz.offset !== 'local') {
                tags.push('<span class="tz-tag tz-localtag">当前时区</span>');
            }
            return `<div class="tz-tags">${tags.join('')}</div>`;
        },

        /**
         * 条目的显示数据（renderList 与 updateTimes 共用，避免两处重复格式化）
         * @param {object} tz 条目
         * @returns {{info: object, timeStr: string, dateLine: string, tagsHtml: string}}
         */
        _entryDisplay(tz) {
            const info = this._entryInfo(tz);
            const clock = window.App.Clock;
            const timeStr = clock?.formatTime ? clock.formatTime(info.date) : info.date.toLocaleTimeString();
            const dateStr = clock?.formatDate ? clock.formatDate(info.date) : info.date.toLocaleDateString();
            return {
                info,
                timeStr,
                dateLine: info.label ? `${dateStr} · ${info.label}` : dateStr,
                tagsHtml: this._tagsHtml(tz, info)
            };
        },

        /** 渲染时区列表 */
        renderList() {
            if (!this.listEl) return;
            // L7：空列表引导提示
            if (!this.timezones.length) {
                this.listEl.innerHTML = `<div class="wc-empty">尚未添加时区，使用上方「选择常用城市」或手动输入添加</div>`;
                return;
            }
            this.listEl.innerHTML = this.timezones.map((tz, idx) => {
                const d = this._entryDisplay(tz);
                const isLocal = tz.offset === 'local';
                const nameTitle = isLocal ? '点击修改名称' : `点击修改名称（当前 ${d.info.label || '—'}）`;
                const cls = d.info.isLocal ? 'timezone-item is-local' : 'timezone-item';
                return `
                    <div class="${cls}" data-index="${idx}">
                        <div class="tz-info">
                            <span class="tz-name" data-idx="${idx}" title="${App.Utils.escapeHtml(nameTitle)}">${App.Utils.escapeHtml(tz.name)} ${isLocal ? '(本地)' : ''}</span>
                            <span class="tz-time">${d.timeStr}</span>
                            <span class="tz-date">${d.dateLine}</span>
                            ${d.tagsHtml}
                        </div>
                        <button class="btn-icon-danger" data-idx="${idx}" title="删除">${App.Utils.svg('close')}</button>
                    </div>
                `;
            }).join('');

            // 绑定事件（每次重新渲染后都需要）
            this._bindListEvents();
        },

        /** 更新已渲染列表中的时间与标签（标签仅在内容变化时写入，避免每秒重绘导致悬停/tooltip 闪烁） */
        updateTimes() {
            if (!this.listEl || !this.overlay.classList.contains('open')) return;
            const items = this.listEl.querySelectorAll('.timezone-item');
            if (items.length !== this.timezones.length) {
                this.renderList();
                return;
            }
            items.forEach((item, idx) => {
                const d = this._entryDisplay(this.timezones[idx]);
                item.querySelector('.tz-time').textContent = d.timeStr;
                item.querySelector('.tz-date').textContent = d.dateLine;
                const tagsEl = item.querySelector('.tz-tags');
                // 昼夜标签等每分钟才可能变化；内容相同则跳过 DOM 写入
                if (tagsEl && tagsEl.innerHTML !== d.tagsHtml) tagsEl.innerHTML = d.tagsHtml;
            });
        },

        /**
         * 整体替换时区列表（跨标签页同步用，L9）
         * @param {Array} list
         */
        setTimezones(list) {
            if (!Array.isArray(list)) return;
            this.timezones = list;
            this.renderList();
        },

        /**
         * 添加时区
         * @param {string} name 显示名称
         * @param {string} offset 'local' / 'UTC±HH:MM' / IANA 时区名
         * @param {{offset: string, hemi: 'n'|'s'}|null} [dst] 固定偏移条目的冬夏令时配置
         */
        addTimezone(name, offset, dst = null) {
            if (!name || !offset) return;
            // 检查重复：已存在时若夏令时配置不同则就地更新（允许补充/修改冬夏令时）
            const exist = this.timezones.find(tz => tz.offset === offset && tz.name === name);
            if (exist) {
                const prev = exist.dst || null;
                const sameDst = JSON.stringify(prev) === JSON.stringify(dst);
                if (sameDst) {
                    App.Utils.showToast('该时区已存在');
                    return;
                }
                if (dst) exist.dst = dst; else delete exist.dst;
                this._save();
                this.renderList();
                App.Utils.showToast('已更新该时区的夏令时设置');
                return;
            }
            const entry = { name, offset };
            if (dst) entry.dst = dst;
            this.timezones.push(entry);
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

        /** 打开面板（含无障碍焦点管理） */
        _openPanel() {
            this.overlay.classList.add('open');
            this.renderList();
            if (window.App.Modal) App.Modal.open(this.overlay, { closeOnBackdrop: false });
        },

        /** 关闭面板（还原焦点） */
        _closePanel() {
            if (window.App.Modal) App.Modal.close(this.overlay);
            this.overlay.classList.remove('open');
        },

        /** 绑定面板的事件 */
        _bindEvents() {
            // 打开面板（点击主页时间区域；div 触发器补键盘可达性）
            const trigger = document.getElementById('timeSectionTrigger');
            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._openPanel();
                });
                trigger.setAttribute('role', 'button');
                trigger.setAttribute('tabindex', '0');
                trigger.setAttribute('aria-label', '打开世界时钟');
                trigger.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this._openPanel();
                    }
                });
            }

            // 关闭按钮
            if (this.closeBtn) {
                this.closeBtn.addEventListener('click', () => this._closePanel());
            }

            // 点击覆盖层关闭
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this._closePanel();
            });

            // 添加时钟折叠
            if (this.addToggle && this.addPanel) {
                this.addToggle.addEventListener('click', () => {
                    const expanded = this.addToggle.getAttribute('aria-expanded') === 'true';
                    if (expanded) {
                        this.addToggle.setAttribute('aria-expanded', 'false');
                        this.addPanel.hidden = true;
                    } else {
                        this.addToggle.setAttribute('aria-expanded', 'true');
                        this.addPanel.hidden = false;
                        setTimeout(() => {
                            if (this.presetSelect && !this.presetSelect.value) {
                                this.customInput?.focus();
                            }
                        }, 150);
                    }
                });
            }

            // 冬夏令时选项：仅手输偏移时生效（选了预设城市则隐藏，IANA 自动支持）
            if (this.presetSelect && this.dstRow) {
                const syncDstRow = () => { this.dstRow.hidden = !!this.presetSelect.value; };
                this.presetSelect.addEventListener('change', syncDstRow);
                syncDstRow();
            }
            if (this.dstEnabled) {
                this.dstEnabled.addEventListener('change', () => {
                    const on = this.dstEnabled.checked;
                    if (this.dstOffsetInput) this.dstOffsetInput.disabled = !on;
                    if (this.dstHemiSelect) this.dstHemiSelect.disabled = !on;
                    if (on && this.dstOffsetInput) this.dstOffsetInput.focus();
                });
            }

            // 12/24 小时快捷切换（与设置面板的"24 小时制"同步：共享 state.timeFormat + sp_time）
            if (this.hourToggle) {
                this._syncHourBtn();
                this.hourToggle.addEventListener('click', () => {
                    const tf = App.state.timeFormat || (App.state.timeFormat = {});
                    tf.hour24 = !(tf.hour24 !== false);
                    App.Utils.save('sp_time', tf);
                    if (App.Clock && App.Clock.refresh) App.Clock.refresh();
                    this._syncHourBtn();
                    this.renderList();
                    App.Utils.showToast(tf.hour24 !== false ? '已切换为 24 小时制' : '已切换为 12 小时制');
                });
            }

            // 添加按钮
            this.addBtn.addEventListener('click', () => this._handleAdd());
        },

        /** 同步快捷切换按钮的显示与 aria-pressed */
        _syncHourBtn() {
            const on = (App.state.timeFormat || {}).hour24 !== false;
            if (this.hourLabel) this.hourLabel.textContent = on ? '24H' : '12H';
            if (this.hourToggle) this.hourToggle.setAttribute('aria-pressed', String(on));
        },

        /** 处理"添加"：预设城市（IANA）/ 手输 UTC±HH:MM / 手输 IANA 时区名 */
        _handleAdd() {
            const preset = this.presetSelect.value;
            const custom = this.customInput.value.trim();

            if (preset) {
                const name = this.presetSelect.selectedOptions[0].text.trim();
                this.addTimezone(name, preset);
                this.presetSelect.value = '';
                this._resetDstRow();
                return;
            }
            if (!custom) {
                App.Utils.showToast('请选择或输入时区');
                return;
            }
            // 固定偏移：+8 / -5:30（可附带冬夏令时配置）
            const match = custom.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
            if (match) {
                const sign = match[1];
                const hours = match[2].padStart(2, '0');
                const minutes = match[3] || '00';
                const offsetStr = `UTC${sign}${hours}:${minutes}`;
                let dst = null;
                if (this.dstEnabled && this.dstEnabled.checked) {
                    const raw = (this.dstOffsetInput && this.dstOffsetInput.value || '').trim();
                    const stdMin = this._parseOffset(offsetStr);
                    const res = this._dstFromDelta(raw, stdMin);
                    if (!res.ok) {
                        App.Utils.showToast(res.error);
                        if (this.dstOffsetInput) this.dstOffsetInput.focus();
                        return;
                    }
                    dst = { offset: res.offset, hemi: this.dstHemiSelect && this.dstHemiSelect.value === 's' ? 's' : 'n' };
                }
                this.addTimezone(offsetStr, offsetStr, dst);
                this.customInput.value = '';
                this._resetDstRow();
                return;
            }
            // IANA 时区名：Asia/Shanghai、Europe/Paris（Intl 自动处理冬夏令时，无须配置）
            if (this._isValidTz(custom)) {
                const cityName = custom.split('/').pop().replace(/_/g, ' ');
                this.addTimezone(cityName, custom);
                this.customInput.value = '';
                this._resetDstRow();
                return;
            }
            App.Utils.showToast('格式无效：UTC±HH:MM 或时区名（如 Asia/Shanghai）');
        },

        /** 添加成功后重置冬夏令时选项行 */
        _resetDstRow() {
            if (this.dstEnabled) this.dstEnabled.checked = false;
            if (this.dstOffsetInput) {
                this.dstOffsetInput.value = '';
                this.dstOffsetInput.disabled = true;
            }
            if (this.dstHemiSelect) this.dstHemiSelect.disabled = true;
            if (this.addToggle && this.addPanel) {
                this.addToggle.setAttribute('aria-expanded', 'false');
                this.addPanel.hidden = true;
            }
        },

        /** 绑定列表内的事件（名称编辑、删除） */
        _bindListEvents() {
            if (!this.listEl) return;

            // 名称编辑
            this.listEl.querySelectorAll('.tz-name').forEach(nameEl => {
                nameEl.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const idx = parseInt(nameEl.dataset.idx);
                    if (isNaN(idx) || idx < 0 || idx >= this.timezones.length) return;
                    const newName = await App.Dialog.prompt('请输入新的时区名称：', this.timezones[idx].name, '重命名时区');
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