#!/usr/bin/env node
/**
 * 零依赖构建脚本：node build.js
 *
 * 产物输出到 dist/：
 *   · js 分片按顺序拼接为 assets/bundle.<hash>.js（14 请求 -> 1 请求）
 *   · style.css 重命名为 assets/style.<hash>.css
 *   · 壁纸 JPG 压缩为 WebP（最长边 1920，q80）并让代码引用 .webp；
 *     原图另存到 img/wallpaper/{dir}/orig/，供设置里的“使用高清原图”开关按需加载
 *   · 写入 dist/_headers 缓存策略 + dist/.nojekyll
 *
 * 若本机 / CI 没有 sharp、ImageMagick 或 cwebp，则自动回退为直接拷贝原图（功能不受影响）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const JS_ORDER = [
    'utils', 'modal', 'sortable', 'theme', 'particles', 'parallax', 'clock', 'wallpaper',
    'engine', 'search', 'bookmarks', 'data', 'settings', 'worldclock', 'weather', 'main'
];

const log = (...args) => console.log('[build]', ...args);
const hash8 = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);

function rimraf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dst) {
    mkdirp(path.dirname(dst));
    fs.copyFileSync(src, dst);
}

function cliConverter(cmd) {
    if (cmd === 'cwebp') {
        return (src, dst) => execFileSync('cwebp', ['-quiet', '-q', '80', '-resize', '1920', '0', src, '-o', dst], { stdio: 'ignore' });
    }
    return (src, dst) => execFileSync(cmd, [src, '-resize', '1920x1920>', '-quality', '80', '-strip', dst], { stdio: 'ignore' });
}

function detectConverters() {
    const found = [];
    try {
        require.resolve('sharp');
        found.push({
            name: 'sharp',
            run: async (src, dst) => {
                await require('sharp')(src)
                    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(dst);
            }
        });
    } catch (e) { /* 未安装 sharp */ }
    for (const cmd of ['magick', 'convert', 'cwebp']) {
        try {
            execFileSync(cmd, ['-version'], { stdio: 'ignore' });
            found.push({ name: cmd, run: cliConverter(cmd) });
        } catch (e) { /* 未安装 */ }
    }
    return found;
}

function listWallpapers() {
    const out = [];
    for (const dir of ['black', 'light']) {
        const d = path.join(ROOT, 'img', 'wallpaper', dir);
        if (!fs.existsSync(d)) continue;
        for (const name of fs.readdirSync(d)) {
            if (/^wallpaper\d+\.(jpe?g|png)$/i.test(name)) {
                const base = name.replace(/\.[^.]+$/, '');
                out.push({ dir, name, base, src: path.join(d, name) });
            }
        }
    }
    return out;
}

async function buildWallpapers() {
    const wallpapers = listWallpapers();
    if (!wallpapers.length) return { ext: 'jpg', webp: false };

    const tmp = path.join(DIST, '.wptmp');
    const converters = detectConverters();
    for (const converter of converters) {
        rimraf(tmp);
        let ok = true;
        for (const w of wallpapers) {
            const dst = path.join(tmp, w.dir, `${w.base}.webp`);
            mkdirp(path.dirname(dst));
            try {
                await converter.run(w.src, dst);
            } catch (e) {
                ok = false;
                break;
            }
        }
        if (ok) {
            for (const w of wallpapers) {
                copyFile(path.join(tmp, w.dir, `${w.base}.webp`), path.join(DIST, 'img', 'wallpaper', w.dir, `${w.base}.webp`));
                if (/\.jpe?g$/i.test(w.name)) {
                    copyFile(w.src, path.join(DIST, 'img', 'wallpaper', w.dir, 'orig', w.name));
                } else {
                    log(`跳过高清原图（仅支持 .jpg）：img/wallpaper/${w.dir}/${w.name}`);
                }
            }
            rimraf(tmp);
            log(`壁纸 -> WebP 完成（转换器：${converter.name}，共 ${wallpapers.length} 张）`);
            log('高清原图 -> img/wallpaper/{black,light}/orig/（仅在设置里开启“使用高清原图”时才加载）');
            return { ext: 'webp', webp: true };
        }
        rimraf(tmp);
        log(`转换器 ${converter.name} 转换失败，尝试下一个…`);
    }

    log('未检测到可用的 WebP 转换器，回退为直接拷贝原图（建议安装 ImageMagick / webp 或 npm i sharp）');
    for (const w of wallpapers) {
        copyFile(w.src, path.join(DIST, 'img', 'wallpaper', w.dir, w.name));
    }
    return { ext: 'jpg', webp: false };
}

function buildBundle(ext) {
    const parts = JS_ORDER.map((name) => {
        const file = path.join(ROOT, 'js', `${name}.js`);
        let code = fs.readFileSync(file, 'utf8');
        if (name === 'wallpaper' && ext === 'webp') {
            const patched = code.replace("const REPO_WP_EXT = 'jpg'", "const REPO_WP_EXT = 'webp'");
            if (patched === code) throw new Error('未找到 REPO_WP_EXT 常量，无法把壁纸引用切到 WebP');
            code = patched;
        }
        return `/*! js/${name}.js */\n${code}`;
    });
    const bundle = `/* 轻-soft 起始页 bundle · 由 build.js 生成 · 请勿直接编辑 */\n` +
        parts.join('\n;\n') + '\n';
    const file = `bundle.${hash8(bundle)}.js`;
    fs.writeFileSync(path.join(ASSETS, file), bundle);
    log(`JS 合并 -> assets/${file}（${JS_ORDER.length} 个文件，${bundle.length} B）`);
    return file;
}

function buildStyle() {
    const css = fs.readFileSync(path.join(ROOT, 'style.css'));
    const file = `style.${hash8(css)}.css`;
    fs.writeFileSync(path.join(ASSETS, file), css);
    log(`CSS -> assets/${file}（${css.length} B）`);
    return file;
}

function buildHtml(bundleFile, styleFile) {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    html = html.replace(/[ \t]*<script src="js\/[a-z]+\.js" defer><\/script>\r?\n?/g, '');
    html = html.replace('href="style.css"', `href="assets/${styleFile}"`);
    html = html.replace('</body>', `    <script src="assets/${bundleFile}" defer></script>\n</body>`);

    fs.writeFileSync(path.join(DIST, 'index.html'), html);
    log('index.html -> dist/index.html（单 script 引用）');
}

function buildHeaders() {
    // 单一来源：根目录 _headers 即最终缓存策略（含 HTML no-cache，防止部署后
    // 旧 HTML 引用已删除的 hash 资源导致白屏），构建时原样拷贝到 dist/
    copyFile(path.join(ROOT, '_headers'), path.join(DIST, '_headers'));
    log('_headers -> dist/_headers（沿用根目录单一来源）');
}

async function main() {
    rimraf(DIST);
    mkdirp(ASSETS);

    const { ext } = await buildWallpapers();
    const bundleFile = buildBundle(ext);
    const styleFile = buildStyle();
    buildHtml(bundleFile, styleFile);

    copyFile(path.join(ROOT, 'img', 'favicon.png'), path.join(DIST, 'img', 'favicon.png'));
    copyFile(path.join(ROOT, 'img', 'wallpaper', 'wallpaper_about.json'), path.join(DIST, 'img', 'wallpaper', 'wallpaper_about.json'));

    buildHeaders();
    fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

    log('构建完成 -> dist/');
}

main().catch((err) => {
    console.error('[build] 失败：', err);
    process.exitCode = 1;
});
