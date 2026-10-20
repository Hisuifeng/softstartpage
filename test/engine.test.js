const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers.js');

function freshApp() {
    const sb = loadScript('js/utils.js');
    loadScript('js/engine.js', { sandbox: sb });
    return sb;
}

test('buildSearchUrl 正常拼接关键词', () => {
    const sb = freshApp();
    sb.App.Engine.currentKey = 'google';
    const url = sb.App.Engine.buildSearchUrl(encodeURIComponent('hello world'));
    assert.equal(url, 'https://www.google.com/search?q=hello%20world');
});

test('buildSearchUrl 自定义引擎含 {q} 时替换', () => {
    const sb = freshApp();
    sb.App.Engine.customEngines = [
        { id: 'c1', name: '自定义', url: 'https://s.example.com/?q={q}', home: '' }
    ];
    sb.App.Engine.currentKey = 'c1';
    assert.equal(sb.App.Engine.buildSearchUrl('abc'), 'https://s.example.com/?q=abc');
});

test('buildSearchUrl 危险协议回退到默认安全模板', () => {
    const sb = freshApp();
    sb.App.Engine.customEngines = [
        { id: 'bad', name: '坏引擎', url: 'javascript:alert(1)//{q}', home: '' }
    ];
    sb.App.Engine.currentKey = 'bad';
    const url = sb.App.Engine.buildSearchUrl('x');
    assert.ok(url.startsWith('https://www.google.com/'), url);
});

test('getHomeUrl 危险协议回退到 Google', () => {
    const sb = freshApp();
    sb.App.Engine.customEngines = [
        { id: 'bad', name: '坏引擎', url: 'https://s.example.com/?q={q}', home: 'javascript:alert(1)' }
    ];
    sb.App.Engine.currentKey = 'bad';
    assert.equal(sb.App.Engine.getHomeUrl(), 'https://www.google.com');
});

test('getHomeUrl 正常主页', () => {
    const sb = freshApp();
    sb.App.Engine.currentKey = 'bing';
    assert.equal(sb.App.Engine.getHomeUrl(), 'https://www.bing.com');
});
