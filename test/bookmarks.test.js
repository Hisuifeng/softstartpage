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
