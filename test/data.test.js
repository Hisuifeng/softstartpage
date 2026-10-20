/**
 * data.test.js — 设置整体导入/导出（M16-i）与配置档案（M16-ii）
 */
const test = require('node:test');
const assert = require('node:assert');
const { loadScript, makeLocalStorage } = require('./helpers');

function boot(seed = {}) {
    const localStorage = makeLocalStorage(seed);
    const sandbox = loadScript('js/utils.js', { localStorage });
    sandbox.App.state = {
        bookmarks: [{ id: 'b1', name: '示例', url: 'https://example.com', iconUrl: '' }],
        customEngines: [{ id: 'e1', name: 'ECOSIA', url: 'https://www.ecosia.org/search?q={q}', home: '' }],
        currentEngineKey: 'google',
        hiddenEngines: [],
        themeMode: 'auto'
    };
    loadScript('js/data.js', { sandbox });
    return sandbox;
}

test('exportData 输出标准 type/version 结构且含白名单键', () => {
    const sandbox = boot({ sp_theme: JSON.stringify('dark'), sp_suggestions: JSON.stringify(false) });
    const payload = JSON.parse(sandbox.App.Data.exportData());
    assert.strictEqual(payload.type, 'softstartpage-settings');
    assert.strictEqual(payload.version, 1);
    assert.ok(payload.exportedAt);
    assert.strictEqual(payload.data.sp_theme, 'dark');
    assert.strictEqual(payload.data.sp_suggestions, false);
    // 缓存与历史不进备份
    assert.ok(!('sp_history' in payload.data));
});

test('parseImport 拒绝非设置数据与非法 JSON', () => {
    const sandbox = boot();
    assert.strictEqual(sandbox.App.Data.parseImport('not json'), null);
    assert.strictEqual(sandbox.App.Data.parseImport('{"type":"softstartpage-bookmarks","version":1}'), null);
    assert.strictEqual(sandbox.App.Data.parseImport(JSON.stringify({
        type: 'softstartpage-settings', version: 99, data: {}
    })), null);
});

test('parseImport 清洗：丢弃非法枚举/越界值，保留合法键', () => {
    const sandbox = boot();
    const parsed = sandbox.App.Data.parseImport(JSON.stringify({
        type: 'softstartpage-settings',
        version: 1,
        data: {
            sp_theme: 'neon',            // 非法枚举 → 丢弃
            sp_weather_source: 'open-meteo',
            sp_rain_opacity: 5,          // 越界 → 钳制到 1
            sp_modifier: 'ctrl',
            evil_key: 'x'                // 白名单外 → 丢弃
        }
    }));
    assert.ok(parsed);
    assert.ok(!('sp_theme' in parsed.data));
    assert.strictEqual(parsed.data.sp_weather_source, 'open-meteo');
    assert.strictEqual(parsed.data.sp_rain_opacity, 1);
    assert.strictEqual(parsed.data.sp_modifier, 'ctrl');
    assert.ok(!('evil_key' in parsed.data));
});

test('parseImport 清洗书签与引擎（不安全网址被拒）', () => {
    const sandbox = boot();
    const parsed = sandbox.App.Data.parseImport(JSON.stringify({
        type: 'softstartpage-settings',
        version: 1,
        data: {
            sp_bookmarks: [
                { name: 'ok', url: 'https://ok.com' },
                { name: 'bad', url: 'javascript:alert(1)' }
            ],
            sp_custom_engines: [
                { id: 'x', name: 'E', url: 'https://e.org/?q={q}', home: '' },
                { id: 'y', name: 'J', url: 'javascript:1', home: '' }
            ]
        }
    }));
    assert.ok(parsed);
    assert.strictEqual(parsed.data.sp_bookmarks.length, 1);
    assert.strictEqual(parsed.data.sp_bookmarks[0].url, 'https://ok.com');
    assert.strictEqual(parsed.data.sp_custom_engines.length, 1);
    assert.strictEqual(parsed.data.sp_custom_engines[0].id, 'x');
});

test('applyImport 写入 localStorage', () => {
    const sandbox = boot();
    const parsed = sandbox.App.Data.parseImport(JSON.stringify({
        type: 'softstartpage-settings', version: 1, data: { sp_theme: 'light' }
    }));
    const n = sandbox.App.Data.applyImport(parsed);
    assert.strictEqual(n, 1);
    assert.strictEqual(sandbox.App.Utils.load('sp_theme', null), 'light');
});

test('首次 init 固化当前数据为「默认」档案', () => {
    const sandbox = boot();
    sandbox.App.Data.init();
    const list = sandbox.App.Data.listProfiles();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, '默认');
    assert.strictEqual(list[0].bookmarks[0].url, 'https://example.com');
    assert.strictEqual(list[0].customEngines[0].id, 'e1');
    assert.strictEqual(sandbox.App.Data.activeProfileId(), list[0].id);
});

test('createProfile / switchProfile 互换书签与引擎', () => {
    const sandbox = boot();
    sandbox.App.Data.init();
    const first = sandbox.App.Data.activeProfileId();

    // 改动当前数据后新建档案（应带走当前数据）
    sandbox.App.state.bookmarks = [{ id: 'b2', name: '工作', url: 'https://work.com', iconUrl: '' }];
    const created = sandbox.App.Data.createProfile('工作');
    assert.strictEqual(created.name, '工作');
    assert.notStrictEqual(sandbox.App.Data.activeProfileId(), first);
    assert.strictEqual(sandbox.App.state.bookmarks[0].url, 'https://work.com');

    // 切回默认：旧档案数据被还原
    assert.ok(sandbox.App.Data.switchProfile(first));
    assert.strictEqual(sandbox.App.state.bookmarks[0].url, 'https://example.com');
    // 切换已持久化
    assert.strictEqual(sandbox.App.Utils.load('sp_bookmarks')[0].url, 'https://example.com');
});

test('removeProfile 至少保留一个；删除当前档案时先切到剩余档案', () => {
    const sandbox = boot();
    sandbox.App.Data.init();
    const first = sandbox.App.Data.activeProfileId();
    const created = sandbox.App.Data.createProfile('备用');
    assert.strictEqual(sandbox.App.Data.removeProfile(created.id), true);
    assert.strictEqual(sandbox.App.Data.activeProfileId(), first);
    // 只剩一个时拒绝删除
    assert.strictEqual(sandbox.App.Data.removeProfile(first), false);
});

test('bookmarks.autoIconUrl 默认站点 favicon.ico，可指定来源（M16-v）', () => {
    const sandbox = loadScript('js/utils.js');
    sandbox.App.state = { bookmarks: [] };
    loadScript('js/bookmarks.js', { sandbox });
    const auto = sandbox.App.Bookmarks.autoIconUrl.bind(sandbox.App.Bookmarks);
    assert.strictEqual(auto('https://github.com/foo/bar'), 'https://github.com/favicon.ico');
    assert.strictEqual(
        auto('https://github.com/foo/bar', 'google'),
        'https://www.google.com/s2/favicons?domain=github.com&sz=64'
    );
    assert.strictEqual(auto('http://example.com', 'direct'), 'http://example.com/favicon.ico');
    assert.strictEqual(auto('javascript:alert(1)'), '');
    assert.strictEqual(auto(''), '');
    assert.strictEqual(auto('not a url'), '');
});

test('theme.setAccent 写入 CSS 变量并在恢复默认时清除', () => {
    const sandbox = loadScript('js/utils.js');
    // documentElement.style 桩：记录 set/remove 的变量
    const vars = {};
    sandbox.document.documentElement.style = {
        setProperty: (k, v) => { vars[k] = v; },
        removeProperty: (k) => { delete vars[k]; }
    };
    sandbox.App.state = { themeMode: 'dark' };
    loadScript('js/theme.js', { sandbox });
    const Theme = sandbox.App.Theme;

    Theme.setAccent('#ff6600');
    assert.strictEqual(vars['--accent'], '#ff6600');
    assert.strictEqual(vars['--accent-dim'], 'rgba(255, 102, 0, 0.25)');
    assert.strictEqual(sandbox.App.Utils.load('sp_accent_color', null), '#ff6600');

    Theme.setAccent(null);
    assert.ok(!('--accent' in vars));
    assert.strictEqual(sandbox.App.Utils.load('sp_accent_color', 'keep'), null);
});
