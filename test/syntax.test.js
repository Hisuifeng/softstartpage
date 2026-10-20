const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function listJsFiles(dir) {
    return readdirSync(dir).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));
}

test('js/ 下所有文件语法正确（vm.Script 解析校验）', () => {
    const files = listJsFiles(path.join(ROOT, 'js'));
    assert.ok(files.length >= 13, `期望至少 13 个模块，实际 ${files.length}`);
    for (const file of files) {
        const code = readFileSync(file, 'utf8');
        assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `语法错误: ${file}`);
    }
});

test('build.js 语法正确', () => {
    const file = path.join(ROOT, 'build.js');
    const code = readFileSync(file, 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }));
});

test('测试文件自身语法正确', () => {
    for (const file of listJsFiles(__dirname)) {
        const code = readFileSync(file, 'utf8');
        assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `语法错误: ${file}`);
    }
});
