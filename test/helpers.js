/**
 * 测试辅助：在 Node 中以 vm 沙箱加载浏览器 IIFE 模块
 * window 指向沙箱自身，使 window.App 与裸 App 等价
 */
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** 内存版 localStorage */
function makeLocalStorage(seed = {}) {
    const store = new Map(Object.entries(seed));
    return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
        key: (i) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
        _keys: () => Array.from(store.keys())
    };
}

/** 最小 document 桩（模块顶层不触碰 DOM，仅个别函数会用到） */
function makeDocumentStub() {
    return {
        createElement: () => {
            const el = {
                _text: '',
                style: { setProperty() {}, transform: '' },
                classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
                set textContent(v) { this._text = String(v ?? ''); },
                get textContent() { return this._text; },
                get innerHTML() {
                    return this._text
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                },
                setAttribute() {},
                getAttribute: () => null,
                appendChild() {},
                addEventListener() {}
            };
            return el;
        },
        getElementById: () => null,
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener() {},
        removeEventListener() {},
        body: { appendChild() {}, removeChild() {}, style: {} },
        documentElement: { setAttribute() {}, style: {} },
        activeElement: null
    };
}

/**
 * 加载一个 js/ 模块到沙箱
 * @param {string} relPath 相对仓库根的路径，如 'js/utils.js'
 * @param {Object} [opts]
 * @param {Object} [opts.sandbox] 复用已有沙箱（连续加载多个模块）
 * @param {Object} [opts.localStorage] 自定义 localStorage
 */
function loadScript(relPath, opts = {}) {
    const file = path.join(__dirname, '..', relPath);
    const code = readFileSync(file, 'utf8');
    const sandbox = opts.sandbox || {
        console,
        setTimeout, clearTimeout, setInterval, clearInterval,
        localStorage: opts.localStorage || makeLocalStorage(),
        document: makeDocumentStub(),
        navigator: {},
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        requestAnimationFrame: () => 0,
        cancelAnimationFrame() {},
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        URL, URLSearchParams
    };
    if (!opts.sandbox) {
        sandbox.window = sandbox;
        vm.createContext(sandbox);
    }
    vm.runInContext(code, sandbox, { filename: file });
    return sandbox;
}

module.exports = { loadScript, makeLocalStorage, makeDocumentStub };
