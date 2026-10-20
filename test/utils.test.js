const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript, makeLocalStorage } = require('./helpers.js');

function freshUtils(seed) {
    const localStorage = makeLocalStorage(seed);
    const sb = loadScript('js/utils.js', { localStorage });
    return { Utils: sb.App.Utils, localStorage };
}

test('escapeAttr 转义引号与尖括号（属性上下文安全）', () => {
    const { Utils } = freshUtils();
    assert.equal(Utils.escapeAttr('a"b'), 'a&quot;b');
    assert.equal(Utils.escapeAttr("a'b"), 'a&#39;b');
    assert.equal(Utils.escapeAttr('<img onerror=x>'), '&lt;img onerror=x&gt;');
    assert.equal(Utils.escapeAttr('a&b'), 'a&amp;b');
    assert.equal(Utils.escapeAttr(null), '');
    assert.equal(Utils.escapeAttr(undefined), '');
});

test('escapeAttr 结果不含裸引号', () => {
    const { Utils } = freshUtils();
    const out = Utils.escapeAttr('" onfocus="alert(1)');
    assert.ok(!out.includes('"'));
    assert.ok(out.includes('&quot;'));
});

test('isSafeUrl 放行常规协议', () => {
    const { Utils } = freshUtils();
    for (const u of [
        'https://example.com',
        'http://example.com/a?b=c',
        '//cdn.example.com/x.js',
        '/relative/path',
        '?query=1',
        '#hash',
        'mailto:a@b.com',
        'ftp://f.example.com',
        'tel:+8610000'
    ]) {
        assert.equal(Utils.isSafeUrl(u), true, `应放行: ${u}`);
    }
});

test('isSafeUrl 拒绝危险协议', () => {
    const { Utils } = freshUtils();
    for (const u of [
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        '  javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD4=',
        'vbscript:msgbox(1)',
        'jav\tascript:alert(1)',
        'example.com x'
    ]) {
        assert.equal(Utils.isSafeUrl(u), false, `应拒绝: ${u}`);
    }
    assert.equal(Utils.isSafeUrl(''), false);
    assert.equal(Utils.isSafeUrl(null), false);
    assert.equal(Utils.isSafeUrl(123), false);
});

test('load 损坏 JSON 时备份并返回默认值', () => {
    const localStorage = makeLocalStorage({ sp_bad: '{not json' });
    const sb = loadScript('js/utils.js', { localStorage });
    const def = sb.App.Utils.load('sp_bad', 'fallback');
    assert.equal(def, 'fallback');
    // 原键被移除，出现备份键
    assert.equal(localStorage.getItem('sp_bad'), null);
    assert.ok(localStorage._keys().some(k => k.startsWith('sp_corrupt_sp_bad_')));
});

test('purgeExpiredCaches 清理过期与损坏缓存，保留新鲜缓存', () => {
    const now = Date.now();
    const localStorage = makeLocalStorage({
        'sp_weather_cache_39.90_116.41': JSON.stringify({ data: {}, timestamp: now - 1000 }),     // 新鲜
        'sp_weather_cache_1.00_2.00': JSON.stringify({ data: {}, timestamp: now - 90000000 }),    // 过期
        'sp_weather_cache_uapi_oldcity': JSON.stringify({ data: {}, timestamp: now - 90000000 }), // 过期
        'sp_location_cache': JSON.stringify({ data: {}, timestamp: now - 90000000 }),             // 过期
        'sp_weather_cache_broken': 'not-json',                                                    // 损坏
        'sp_bookmarks': JSON.stringify([{ id: '1' }])                                             // 非缓存键，不应动
    });
    const sb = loadScript('js/utils.js', { localStorage });
    const removed = sb.App.Utils.purgeExpiredCaches();
    assert.equal(removed, 4);
    assert.ok(localStorage.getItem('sp_weather_cache_39.90_116.41'));
    assert.ok(localStorage.getItem('sp_bookmarks'));
    assert.equal(localStorage.getItem('sp_weather_cache_1.00_2.00'), null);
    assert.equal(localStorage.getItem('sp_location_cache'), null);
    assert.equal(localStorage.getItem('sp_weather_cache_broken'), null);
});

test('genId 生成不重复的 ID', () => {
    const { Utils } = freshUtils();
    const ids = new Set();
    for (let i = 0; i < 500; i++) ids.add(Utils.genId());
    assert.equal(ids.size, 500);
});
