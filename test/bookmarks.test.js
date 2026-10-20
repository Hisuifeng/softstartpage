const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers.js');

function freshApp() {
    const sb = loadScript('js/utils.js');
    loadScript('js/bookmarks.js', { sandbox: sb });
    return sb;
}

test('parseImport 解析导出格式并规范化字段', () => {
    const sb = freshApp();
    const text = JSON.stringify({
        type: 'softstartpage-bookmarks',
        version: 1,
        bookmarks: [
            { name: ' 示例 ', url: ' https://example.com ', iconUrl: '' },
            { name: 'A', url: 'https://a.com', iconUrl: 'https://a.com/i.png' }
        ]
    });
    const out = sb.App.Bookmarks.parseImport(text);
    assert.equal(out.length, 2);
    assert.equal(out[0].name, '示例');
    assert.equal(out[0].url, 'https://example.com');
    assert.ok(out[0].id.startsWith('id_'));
});

test('parseImport 拒绝 javascript: 等危险网址', () => {
    const sb = freshApp();
    const text = JSON.stringify([
        { name: 'xss', url: 'javascript:alert(document.cookie)' },
        { name: 'data', url: 'data:text/html,<script>1</script>' },
        { name: 'ok', url: 'https://example.com' }
    ]);
    const out = sb.App.Bookmarks.parseImport(text);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'ok');
});

test('parseImport 非法 JSON / 非书签结构返回 null', () => {
    const sb = freshApp();
    assert.equal(sb.App.Bookmarks.parseImport('not json'), null);
    assert.equal(sb.App.Bookmarks.parseImport('{"foo":1}'), null);
    assert.equal(sb.App.Bookmarks.parseImport(''), null);
});

test('parseImport 清空危险的 iconUrl 但保留书签', () => {
    const sb = freshApp();
    const text = JSON.stringify([
        { name: 'ok', url: 'https://example.com', iconUrl: 'javascript:alert(1)' }
    ]);
    const out = sb.App.Bookmarks.parseImport(text);
    assert.equal(out.length, 1);
    assert.equal(out[0].iconUrl, '');
});

test('exportData 只导出有网址的书签', () => {
    const sb = freshApp();
    sb.App.state = {
        bookmarks: [
            { id: '1', name: 'a', url: 'https://a.com', iconUrl: '' },
            { id: '2', name: 'empty', url: '', iconUrl: '' }
        ]
    };
    const data = JSON.parse(sb.App.Bookmarks.exportData());
    assert.equal(data.type, 'softstartpage-bookmarks');
    assert.equal(data.version, 1);
    assert.equal(data.bookmarks.length, 1);
    assert.equal(data.bookmarks[0].url, 'https://a.com');
});

test('autoIconUrl 按来源返回对应 favicon 服务（默认站点 /favicon.ico）', () => {
    const sb = freshApp();
    const url = 'https://example.com/page?q=1';
    assert.equal(sb.App.Bookmarks.autoIconUrl(url), 'https://example.com/favicon.ico');
    assert.equal(
        sb.App.Bookmarks.autoIconUrl(url, 'google'),
        'https://www.google.com/s2/favicons?domain=example.com&sz=64'
    );
    assert.equal(sb.App.Bookmarks.autoIconUrl('http://foo.org/x', 'direct'), 'http://foo.org/favicon.ico');
    assert.equal(sb.App.Bookmarks.autoIconUrl(url, 'direct'), 'https://example.com/favicon.ico');
});

test('autoIconUrl 读取 state.faviconSource 并拒绝非 http(s)', () => {
    const sb = freshApp();
    sb.App.state = { faviconSource: 'google' };
    assert.equal(
        sb.App.Bookmarks.autoIconUrl('https://foo.org/x'),
        'https://www.google.com/s2/favicons?domain=foo.org&sz=64'
    );
    assert.equal(sb.App.Bookmarks.autoIconUrl('javascript:alert(1)'), '');
    assert.equal(sb.App.Bookmarks.autoIconUrl('data:text/html,x'), '');
    assert.equal(sb.App.Bookmarks.autoIconUrl(''), '');
});

test('autoIconFallbackUrl direct 回退二级域名，两段域名与 google 无回退', () => {
    const sb = freshApp();
    assert.equal(
        sb.App.Bookmarks.autoIconFallbackUrl('https://www.example.com/a'),
        'https://example.com/favicon.ico'
    );
    assert.equal(
        sb.App.Bookmarks.autoIconFallbackUrl('https://cdn.static.example.com/x'),
        'https://example.com/favicon.ico'
    );
    assert.equal(sb.App.Bookmarks.autoIconFallbackUrl('https://example.com/'), '');
    assert.equal(sb.App.Bookmarks.autoIconFallbackUrl('http://a.b.org/'), 'http://b.org/favicon.ico');
    assert.equal(sb.App.Bookmarks.autoIconFallbackUrl('https://www.example.com/', 'google'), '');
    assert.equal(sb.App.Bookmarks.autoIconFallbackUrl('javascript:alert(1)'), '');
});

test('_iconCache 缓存读写、来源隔离与过期', () => {
    const sb = freshApp();
    const B = sb.App.Bookmarks;
    assert.equal(B._iconCacheGet('direct', 'a.com'), null);
    B._iconCacheSet('direct', 'a.com', 'none');
    assert.equal(B._iconCacheGet('direct', 'a.com'), 'none');
    // 键含 source：google 来源不受 direct 结果污染
    assert.equal(B._iconCacheGet('google', 'a.com'), null);
    // 过期（写入早于 TTL）→ 返回 null 并删除
    sb.localStorage.setItem(B._iconCacheKey('direct', 'a.com'),
        JSON.stringify({ s: 'fallback', t: Date.now() - B.ICON_CACHE_TTL - 1000 }));
    assert.equal(B._iconCacheGet('direct', 'a.com'), null);
    assert.equal(sb.localStorage.getItem(B._iconCacheKey('direct', 'a.com')), null);
    // 损坏数据 → null
    sb.localStorage.setItem(B._iconCacheKey('direct', 'b.com'), 'not-json-object');
    assert.equal(B._iconCacheGet('direct', 'b.com'), null);
});

test('autoIconPlan 按缓存返回：none 不出图、fallback 直达二级域名', () => {
    const sb = freshApp();
    sb.App.state = { faviconSource: 'direct' };
    const B = sb.App.Bookmarks;
    // 未缓存：一级 + 回退属性（vm 沙箱对象与宿主原型不同，逐字段断言）
    let p = B.autoIconPlan('https://www.example.com/x');
    assert.equal(p.src, 'https://www.example.com/favicon.ico');
    assert.equal(p.fallback, 'https://example.com/favicon.ico');
    assert.equal(p.host, 'www.example.com');
    // 缓存 none：src/fallback 均空
    B._iconCacheSet('direct', 'www.example.com', 'none');
    p = B.autoIconPlan('https://www.example.com/x');
    assert.equal(p.src, '');
    assert.equal(p.fallback, '');
    assert.equal(p.host, 'www.example.com');
    // 缓存 fallback：直达二级域名，不再尝试一级
    B._iconCacheSet('direct', 'www.example.com', 'fallback');
    p = B.autoIconPlan('https://www.example.com/x');
    assert.equal(p.src, 'https://example.com/favicon.ico');
    assert.equal(p.fallback, '');
    assert.equal(p.host, 'www.example.com');
    assert.equal(p.cached, 'fallback');
    // 非 http(s) / 非法 URL 不出方案
    p = B.autoIconPlan('javascript:alert(1)');
    assert.equal(p.src, '');
    assert.equal(p.host, '');
    p = B.autoIconPlan('');
    assert.equal(p.src, '');
    assert.equal(p.host, '');
});
