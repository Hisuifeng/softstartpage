const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers.js');

/** 可断言的 classList 桩 */
function makeClassList(init = []) {
    const s = new Set(init);
    return {
        add: (...cs) => cs.forEach(c => s.add(c)),
        remove: (...cs) => cs.forEach(c => s.delete(c)),
        toggle: (c, force) => {
            const on = force === undefined ? !s.has(c) : !!force;
            if (on) s.add(c); else s.delete(c);
            return on;
        },
        contains: (c) => s.has(c)
    };
}

test('_setBackgroundPreloaded 加载完成后刷新右上角固定提示条（L5 回归）', () => {
    const sb = loadScript('js/wallpaper.js');
    const W = sb.App.Wallpaper;
    const layer = {
        style: { backgroundImage: '' },
        classList: makeClassList(['hidden']),
        offsetWidth: 0
    };
    const hint = { classList: makeClassList(['hidden']) };
    const hintLabel = { textContent: '' };
    const hintBtn = { title: '' };
    const hintAbout = { classList: makeClassList(['hidden']), textContent: '' };
    W.layer = layer;
    W.hint = hint;
    W.hintLabel = hintLabel;
    W.hintBtn = hintBtn;
    W.hintAbout = hintAbout;
    W.settingsAbout = null;
    sb.App.state = { wallpaper: { type: 'none', value: '' }, defaultWallpaperEnabled: true };
    W._currentDefaultUrl = 'img/wallpaper/black/wallpaper1.jpg';

    // 预载完成前（图层仍 hidden）：提示条保持隐藏
    W._updateHint();
    assert.ok(hint.classList.contains('hidden'));

    // Image 桩：记录实例，由测试手动触发 onload
    let captured = null;
    sb.Image = class {
        constructor() { this.onload = null; this.onerror = null; }
        set src(v) { this._src = v; captured = this; }
        get src() { return this._src; }
    };
    W._setBackgroundPreloaded('img/wallpaper/black/wallpaper1.jpg');
    assert.equal(W._preloadToken, captured);

    // 模拟图片加载完成：图层去 hidden，提示条应随之出现
    captured.onload();
    assert.equal(layer.classList.contains('hidden'), false);
    assert.equal(hint.classList.contains('hidden'), false);
    assert.equal(hintLabel.textContent, '固定该壁纸');

    // 固定态：文案切为“取消固定”并加 pinned 类
    sb.App.state.wallpaper = { type: 'fixed', value: 'img/wallpaper/black/wallpaper1.jpg' };
    W._updateHint();
    assert.equal(hintLabel.textContent, '取消固定');
    assert.equal(hint.classList.contains('pinned'), true);

    // 加载失败：图层隐藏，提示条也应隐藏
    sb.Image = class {
        constructor() { this.onload = null; this.onerror = null; }
        set src(v) { this._src = v; captured = this; }
    };
    W._setBackgroundPreloaded('img/wallpaper/black/wallpaper9.jpg');
    captured.onerror();
    assert.equal(layer.classList.contains('hidden'), true);
    assert.equal(hint.classList.contains('hidden'), true);
});
