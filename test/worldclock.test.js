/**
 * worldclock.test.js — 世界时钟时区解析与 IANA 夏令时换算
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { loadScript } = require('./helpers');

function boot() {
    const sandbox = loadScript('js/utils.js');
    loadScript('js/worldclock.js', { sandbox });
    return sandbox.App.WorldClock;
}

test('_parseOffset 解析固定偏移与 local', () => {
    const WC = boot();
    assert.strictEqual(WC._parseOffset('local'), null);
    assert.strictEqual(WC._parseOffset('UTC+8'), 480);
    assert.strictEqual(WC._parseOffset('UTC+08:00'), 480);
    assert.strictEqual(WC._parseOffset('UTC-5:30'), -330);
    assert.strictEqual(WC._parseOffset('UTC+0'), 0);
    assert.strictEqual(WC._parseOffset('garbage'), null);
});

test('_fmtOffset 分钟数 → 显示标签', () => {
    const WC = boot();
    assert.strictEqual(WC._fmtOffset(480), 'UTC+8');
    assert.strictEqual(WC._fmtOffset(0), 'UTC+0');
    assert.strictEqual(WC._fmtOffset(-330), 'UTC-5:30');
    assert.strictEqual(WC._fmtOffset(-300), 'UTC-5');
});

test('_entryDisplay 汇总时间/日期行/标签（renderList 与 updateTimes 共用）', () => {
    const WC = boot();
    const d = WC._entryDisplay({ name: 'UTC+8', offset: 'UTC+8:00' });
    assert.ok(d.info && d.info.offMin === 480);
    assert.match(d.timeStr, /\d{1,2}:\d{2}/);
    assert.ok(d.dateLine.includes('· UTC+8'));
    assert.ok(d.tagsHtml.includes('tz-tags'));
    assert.ok(d.tagsHtml.includes('tz-dn')); // 昼夜标签
    // 本地条目：无偏移标签段
    const local = WC._entryDisplay({ name: '本地时间', offset: 'local' });
    assert.strictEqual(local.info.isLocal, true);
    assert.ok(!local.dateLine.includes('·'));
});

test('_isValidTz 校验 IANA 时区标识', () => {
    const WC = boot();
    assert.strictEqual(WC._isValidTz('Asia/Shanghai'), true);
    assert.strictEqual(WC._isValidTz('Europe/Paris'), true);
    assert.strictEqual(WC._isValidTz('America/New_York'), true);
    assert.strictEqual(WC._isValidTz('Mars/Olympus_Mons'), false);
    assert.strictEqual(WC._isValidTz('UTC+8'), false);
    assert.strictEqual(WC._isValidTz(''), false);
    assert.strictEqual(WC._isValidTz(null), false);
});

test('_zoneInfo 墙钟换算与偏移标签（UTC+8 恒定偏移）', () => {
    const WC = boot();
    const info = WC._zoneInfo('Asia/Shanghai');
    assert.ok(info);
    assert.strictEqual(info.label, 'UTC+8');
    assert.strictEqual(info.offMin, 480);
    // date 的本地 getter 应等于 Asia/Shanghai 的墙钟
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date());
    const g = {};
    parts.forEach(p => { if (p.type !== 'literal') g[p.type] = p.value; });
    assert.strictEqual(info.date.getFullYear(), +g.year);
    assert.strictEqual(info.date.getMonth() + 1, +g.month);
    assert.strictEqual(info.date.getDate(), +g.day);
    assert.strictEqual(info.date.getHours(), +g.hour % 24);
    assert.strictEqual(info.date.getMinutes(), +g.minute);
});

test('_zoneInfo 偏移标签（UTC+5:30 半小时时区）', () => {
    const WC = boot();
    const info = WC._zoneInfo('Asia/Kolkata');
    assert.ok(info);
    assert.strictEqual(info.label, 'UTC+5:30');
});

test('_zoneInfo 美国东部随夏令时为 UTC-4 或 UTC-5', () => {
    const WC = boot();
    const info = WC._zoneInfo('America/New_York');
    assert.ok(info);
    assert.match(info.label, /^UTC-[45]$/);
});

test('_zoneInfo 无效时区返回 null', () => {
    const WC = boot();
    assert.strictEqual(WC._zoneInfo('Mars/Olympus_Mons'), null);
});

test('_entryInfo 三种条目类型均可取显示数据', () => {
    const WC = boot();
    // 本地
    const local = WC._entryInfo({ name: '本地时间', offset: 'local' });
    assert.strictEqual(local.label, '');
    assert.ok(Object.prototype.toString.call(local.date) === '[object Date]');
    // 固定偏移（旧数据格式）
    const fixed = WC._entryInfo({ name: 'UTC+8', offset: 'UTC+8:00' });
    assert.strictEqual(fixed.label, 'UTC+8');
    const deltaMin = Math.round((fixed.date.getTime() - Date.now()) / 60000);
    assert.ok(Math.abs(deltaMin - (new Date().getTimezoneOffset() + 480)) <= 1);
    // IANA 时区
    const zone = WC._entryInfo({ name: '巴黎', offset: 'Europe/Paris' });
    assert.match(zone.label, /^UTC[+-]\d+(:\d{2})?$/);
    assert.ok(Object.prototype.toString.call(zone.date) === '[object Date]');
    // 无效时区降级为本地（不崩）
    const bad = WC._entryInfo({ name: '坏数据', offset: 'Nowhere/Land' });
    assert.strictEqual(bad.label, '');
    assert.ok(Object.prototype.toString.call(bad.date) === '[object Date]');
    // 扩展字段：偏移与类型标记
    const sh = WC._entryInfo({ name: '上海', offset: 'Asia/Shanghai' });
    assert.strictEqual(sh.offMin, 480);
    assert.strictEqual(sh.isZone, true);
    assert.strictEqual(local.offMin, null);
    assert.strictEqual(local.isZone, false);
    assert.strictEqual(local.isLocal, true);
    assert.strictEqual(fixed.isZone, false);
});

test('_dayNight 昼夜判断（6:00-17:59 白天）', () => {
    const WC = boot();
    assert.strictEqual(WC._dayNight(6).label, '白天');
    assert.strictEqual(WC._dayNight(12).label, '白天');
    assert.strictEqual(WC._dayNight(17).label, '白天');
    assert.strictEqual(WC._dayNight(18).label, '夜晚');
    assert.strictEqual(WC._dayNight(0).label, '夜晚');
    assert.strictEqual(WC._dayNight(5).label, '夜晚');
    assert.strictEqual(WC._dayNight(12).icon, 'sun');
    assert.strictEqual(WC._dayNight(23).icon, 'moon');
});

test('_fmtDiff 与本地时差文案', () => {
    const WC = boot();
    const base = WC._localOffMin();
    assert.strictEqual(WC._fmtDiff(base).text, '与本地相同');
    assert.strictEqual(WC._fmtDiff(base + 180).text, '时差 +3h');
    assert.match(WC._fmtDiff(base + 180).title, /比本地快 3 小时/);
    assert.strictEqual(WC._fmtDiff(base - 330).text, '时差 -5h30');
    assert.match(WC._fmtDiff(base - 330).title, /比本地慢 5 小时 30 分/);
    assert.strictEqual(WC._fmtDiff(base + 30).text, '时差 +30m');
});

test('_dstTag 冬/夏令时标签', () => {
    const WC = boot();
    // 上海不实行夏令时 → 无标签
    assert.strictEqual(WC._dstTag('Asia/Shanghai', 480), '');
    // 纽约标准时 -5、夏令时 -4（每年 1/7 月取样判定）
    assert.strictEqual(WC._dstTag('America/New_York', -240), '夏令时中');
    assert.strictEqual(WC._dstTag('America/New_York', -300), '冬令时中');
    // 无效时区 / 本地条目不打标签
    assert.strictEqual(WC._dstTag('Nowhere/Land', null), '');
});

test('_zonePartsAt 指定时刻偏移计算', () => {
    const WC = boot();
    // 2026-07-01 巴黎处于夏令时 UTC+2，1 月为 UTC+1
    const jul = WC._zoneOffsetMinAt('Europe/Paris', new Date(Date.UTC(2026, 6, 1, 12)));
    const jan = WC._zoneOffsetMinAt('Europe/Paris', new Date(Date.UTC(2026, 0, 1, 12)));
    assert.strictEqual(jan, 60);
    assert.strictEqual(jul, 120);
    assert.strictEqual(WC._zoneOffsetMinAt('Nowhere/Land', new Date()), null);
});

test('_tagsHtml 生成昼夜/时差标签，本地条目无时差', () => {
    const WC = boot();
    const zoneTz = { name: '测试', offset: 'Asia/Shanghai' };
    const html = WC._tagsHtml(zoneTz, WC._entryInfo(zoneTz));
    assert.match(html, /tz-dn/);
    assert.match(html, /(白天|夜晚)/);
    assert.match(html, /(时差|与本地相同)/);
    // 昼夜图标为扁平 SVG，不使用 emoji
    assert.match(html, /<svg[\s>]/);
    assert.doesNotMatch(html, /☀|🌙/);
    const localTz = { name: '本地', offset: 'local' };
    const localHtml = WC._tagsHtml(localTz, WC._entryInfo(localTz));
    assert.match(localHtml, /tz-dn/);
    assert.doesNotMatch(localHtml, /tz-diff/);
    assert.doesNotMatch(localHtml, /tz-localtag/);
});

test('_lastSunday/_nthSunday 周日边界计算', () => {
    const WC = boot();
    // 2026-03 最后一个周日 = 3/29（3/1 是周日）
    assert.strictEqual(WC._lastSunday(2026, 2), Date.UTC(2026, 2, 29, 1));
    // 2026-10 最后一个周日 = 10/25，第一个周日 = 10/4
    assert.strictEqual(WC._lastSunday(2026, 9), Date.UTC(2026, 9, 25, 1));
    assert.strictEqual(WC._nthSunday(2026, 9, 1), Date.UTC(2026, 9, 4, 1));
    // 2026-04 第一个周日 = 4/5（4/1 是周三）
    assert.strictEqual(WC._nthSunday(2026, 3, 1), Date.UTC(2026, 3, 5, 1));
});

test('_inDstPeriod 半球夏令时区间', () => {
    const WC = boot();
    // 北半球：7 月是夏令时，1 月不是
    assert.strictEqual(WC._inDstPeriod('n', Date.UTC(2026, 6, 1)), true);
    assert.strictEqual(WC._inDstPeriod('n', Date.UTC(2026, 0, 15)), false);
    // 南半球：1 月是夏令时，7 月不是
    assert.strictEqual(WC._inDstPeriod('s', Date.UTC(2026, 0, 15)), true);
    assert.strictEqual(WC._inDstPeriod('s', Date.UTC(2026, 6, 1)), false);
    // 北半球边界：3/29 01:00 UTC 起生效，10/25 01:00 UTC 结束
    assert.strictEqual(WC._inDstPeriod('n', Date.UTC(2026, 2, 29, 1)), true);
    assert.strictEqual(WC._inDstPeriod('n', Date.UTC(2026, 2, 29, 0, 59)), false);
    assert.strictEqual(WC._inDstPeriod('n', Date.UTC(2026, 9, 25, 1)), false);
});

test('_entryInfo 自定义冬夏令时条目按当前状态取偏移', () => {
    const WC = boot();
    const entry = { name: '自定义', offset: 'UTC+1:00', dst: { offset: 'UTC+2:00', hemi: 'n' } };
    const info = WC._entryInfo(entry);
    const active = WC._inDstPeriod('n');
    assert.strictEqual(info.dstState, active ? '夏令时中' : '冬令时中');
    assert.strictEqual(info.offMin, active ? 120 : 60);
    assert.strictEqual(info.label, active ? 'UTC+2' : 'UTC+1');
    // 无 dst 配置 → 无状态标签
    assert.strictEqual(WC._entryInfo({ name: '固定', offset: 'UTC+1:00' }).dstState, null);
    // dst 配置不合法（不大于标准偏移）→ 忽略
    const bad = WC._entryInfo({ name: '坏', offset: 'UTC+2:00', dst: { offset: 'UTC+1:00', hemi: 'n' } });
    assert.strictEqual(bad.dstState, null);
    assert.strictEqual(bad.offMin, 120);
});

test('_tagsHtml 自定义条目带冬夏令时标签', () => {
    const WC = boot();
    const entry = { name: '自定义', offset: 'UTC+1:00', dst: { offset: 'UTC+2:00', hemi: 'n' } };
    const html = WC._tagsHtml(entry, WC._entryInfo(entry));
    assert.match(html, /tz-dst/);
    assert.match(html, /(夏令时中|冬令时中)/);
});

test('addTimezone 支持并可更新冬夏令时配置', () => {
    const WC = boot();
    WC.timezones = [];
    WC.addTimezone('自定义', 'UTC+1:00', { offset: 'UTC+2:00', hemi: 'n' });
    assert.strictEqual(WC.timezones.length, 1);
    assert.strictEqual(WC.timezones[0].dst.offset, 'UTC+2:00');
    assert.strictEqual(WC.timezones[0].dst.hemi, 'n');
    // 相同配置重复添加 → 不变
    WC.addTimezone('自定义', 'UTC+1:00', { offset: 'UTC+2:00', hemi: 'n' });
    assert.strictEqual(WC.timezones.length, 1);
    // 不同配置 → 就地更新
    WC.addTimezone('自定义', 'UTC+1:00', { offset: 'UTC+3:00', hemi: 's' });
    assert.strictEqual(WC.timezones.length, 1);
    assert.strictEqual(WC.timezones[0].dst.offset, 'UTC+3:00');
    // 不带 dst → 移除配置
    WC.addTimezone('自定义', 'UTC+1:00', null);
    assert.strictEqual(WC.timezones[0].dst, undefined);
    WC.timezones = [];
});

test('_dstFromDelta 夏令时增量 → 绝对偏移', () => {
    const WC = boot();
    // 用户示例：基础 UTC-4 填 +2 → 夏令时 UTC-2
    assert.strictEqual(WC._dstFromDelta('+2', -240).offset, 'UTC-2:00');
    // 加拿大东部：基础 UTC-5（标准时）填 +1 → 夏令时 UTC-4
    assert.strictEqual(WC._dstFromDelta('+1', -300).offset, 'UTC-4:00');
    // 符号省略视为正
    assert.strictEqual(WC._dstFromDelta('2', 0).offset, 'UTC+2:00');
    // 半小时增量
    assert.strictEqual(WC._dstFromDelta('1:30', -300).offset, 'UTC-3:30');
    // 零/负增量拒绝（夏令时是拨快）
    assert.strictEqual(WC._dstFromDelta('0', -300).ok, false);
    assert.strictEqual(WC._dstFromDelta('-1', -300).ok, false);
    // 非法格式与超范围分钟
    assert.strictEqual(WC._dstFromDelta('abc', -300).ok, false);
    assert.strictEqual(WC._dstFromDelta('', -300).ok, false);
    assert.strictEqual(WC._dstFromDelta('1:99', -300).ok, false);
    // 结果超出 UTC±14 拒绝
    assert.strictEqual(WC._dstFromDelta('+2', 13 * 60).ok, false);
    // 错误信息为中文提示
    assert.match(WC._dstFromDelta('0', -300).error, /正增量/);
});

test('_tagsHtml 令时标签在首位（不以明暗代表时令）', () => {
    const WC = boot();
    // 自定义带 DST：冬/夏令时文字标签排在昼夜之前
    const entry = { name: '自定义', offset: 'UTC+1:00', dst: { offset: 'UTC+2:00', hemi: 'n' } };
    const html = WC._tagsHtml(entry, WC._entryInfo(entry));
    assert.ok(html.indexOf('tz-dst') < html.indexOf('tz-dn'), 'dst 应在 dn 之前');
    assert.match(html, /(夏令时中|冬令时中)/);
    // IANA 实行夏令时的时区同样首位显示
    const zone = { name: '温哥华', offset: 'America/Vancouver' };
    const zhtml = WC._tagsHtml(zone, WC._entryInfo(zone));
    assert.ok(zhtml.indexOf('tz-dst') < zhtml.indexOf('tz-dn'), 'IANA dst 应在 dn 之前');
    assert.match(zhtml, /(夏令时中|冬令时中)/);
    // 不实行夏令时的时区没有 dst 标签，昼夜仍在
    const sh = { name: '上海', offset: 'Asia/Shanghai' };
    const shhtml = WC._tagsHtml(sh, WC._entryInfo(sh));
    assert.ok(!shhtml.includes('tz-dst'));
    assert.ok(shhtml.includes('tz-dn'));
});
