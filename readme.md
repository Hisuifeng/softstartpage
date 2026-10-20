# 轻-soft 起始页 v2 (SoftStartpage v2)

![license](https://img.shields.io/badge/license-MIT-blue)
![pure-frontend](https://img.shields.io/badge/纯前端-zero--build-brightgreen)
![no-deps](https://img.shields.io/badge/依赖-无-9cf)

一个纯前端、可直接本地运行的浏览器起始页。无需安装、无需构建，打开即用。<br>
<div align='center'> <img src='doc/indexsc-all.png' alt='首页截图'> </div><br>
在 2026/7/25，由于暑假无聊，该项目被重构。重构之前的原文：<br>
"该项目本意是作为原生练手的项目，大一为了怀恋小学摸索原生前端做着玩的。没想到嵌入式大二还有web课，便继续更新了。"<br>
本想说之后没 web 课就不做了，但是还是那句话，AI 还是太好用了🤫

---

## 目录

- [快速开始](#快速开始)
- [功能特点](#功能特点)
  - [外观与主题](#外观与主题)
  - [时间](#时间)
  - [搜索](#搜索)
  - [书签与壁纸](#书签与壁纸)
  - [天气](#天气)
  - [设置](#设置)
- [常见说明](#常见说明)
- [面向开发者](#面向开发者)
  - [项目结构](#项目结构)
  - [构建与部署](#构建与部署)
  - [常用 API](#常用-api)
  - [存储](#存储)
  - [自定义仓库壁纸](#自定义仓库壁纸)
  - [图标](#图标)
  - [技术实现要点](#技术实现要点)
  - [调试](#调试)
- [许可证](#许可证)

---

## 快速开始

已经静态托管在 Cloudflare 和 GitHub：

- **Cloudflare（推荐）**：<https://softstartpage.pages.dev/>
- **GitHub Pages**：<https://hisuifeng.github.io/softstartpage/>

把上面任一地址设为浏览器主页即可；也可以下载整个项目，双击 `index.html` 本地打开。

> 注意：本地直接打开（`file://`）也能正常使用，但“仓库随机壁纸 / 固定壁纸”依赖服务器环境才能生效，天气与搜索联想需要联网。

## 功能特点

### 外观与主题

- **明暗主题**：浅色 / 深色 / 跟随系统三种模式，一键切换，配色平滑过渡。
- **自定义强调色**：在设置里挑一个喜欢的颜色，按钮、焦点光环、联想高亮等一并换色（亮/暗主题共用），可一键恢复主题默认。
- **动态背景**：“雨，静静的下起来了” —— 雨、雪等天气特效，可调节透明度与颜色。
- **粒子背景**：星点连线的粒子动效（默认关闭）。
- **视差背景**：鼠标移动时背景产生轻微视差，画面更有层次感（可关闭）。
- 未设置壁纸时，背景为纯色（跟随明暗主题）。

### 时间

- **时钟**：支持 24 / 12 小时制、显示秒、多种日期格式。
- **世界时钟**：添加并编辑多个时区时钟，预设常用城市（IANA 时区，自动跟随夏令时），也支持手动输入 `UTC±HH:MM`（可选配冬/夏令时）或 IANA 时区名（如 `Asia/Shanghai`，自动跟随夏令时）。

### 搜索

- **多引擎搜索**：内置 Google / Bing / Baidu / DuckDuckGo，可添加自定义搜索引擎（支持**拖拽排序**），默认引擎可在设置面板中逐项**隐藏**（隐藏后不出现在切换器、不占用数字快捷键，至少保留一个），支持 `Ctrl/Alt + 数字` 快捷切换（另可选 Ctrl+Shift 或仅数字键）。
- **搜索联想**：接入搜索引擎联想接口（可切换备用 API），支持搜索历史与一键清除。

### 书签与壁纸

- **书签管理**：拖拽排序，自定义名称 / 网址 / 图标，在设置面板中增删改；未填图标时自动获取网站图标（默认先请求站点 `/favicon.ico`，失败回退二级域名，再失败显示首字母；探测结果按「来源+域名」缓存 7 天，不会每次渲染重复请求已知失效的图标；可切换 Google s2，也可关闭自动获取，手动图标不受影响）；可选择“页面内跳转”或“新标签页打开”；书签为空时首页显示「+ 添加书签」，点击直达设置；支持把书签**导出到剪贴板**、或**从剪贴板导入**（导入按网址去重，不会覆盖现有书签）。
- **壁纸**：
  - 支持网络图片 URL，或上传本地图片；
  - 未设置壁纸时，可随机使用仓库内置壁纸（分暗色 / 亮色两套）；
  - 看到喜欢的仓库壁纸？点右上角「固定该壁纸」就能把它固定下来，再点「取消固定」即可恢复随机；
  - 右上角提示条会在「喜欢这张壁纸吗？」下方显示该壁纸的推荐者；设置面板「壁纸」区同样会显示当前壁纸的推荐者（固定或随机默认壁纸生效时）；
  - **高清原图开关**：设置 → 壁纸 →「使用高清原图」。开启后，默认与固定的仓库壁纸改用未压缩原图（构建产物位于 `orig/`，单张最大约 18MB，首次加载较慢）；默认关闭，弱网建议保持关闭。
  - 想把自己收藏的壁纸分享给大家？欢迎[提交 issues](https://github.com/Hisuifeng/softstartpage/issues/1)。

### 天气

- **天气模块**：左下角悬浮天气按钮，显示当前天气；点击展开详情面板。数据源支持两种，可在「设置 → 位置与天气」切换——
  - **UAPI**（`uapis.cn`，默认）：按城市名 / Adcode 或 IP 自动定位；
  - **Open-Meteo**（CMA 中国气象局 GFS GRAPES 全球模型）：按经纬度定位。
  - 顶部大卡片：当前温度、天气状况、城市、最高 / 最低 / 体感温度；
  - 下方信息网格：湿度、风速、风向、降雨、紫外线、日出、日落（Open-Meteo 额外含阵风 / 降雪 / 晴空紫外线，UAPI 额外含风力等级 / 空气质量）；
  - 生活指数（仅 UAPI）：18 项生活指数网格（穿衣 / 紫外线 / 洗车 / 运动 / 旅游……），鼠标悬停查看详细建议；
  - 未来 48 小时温度趋势折线图。

### 设置

- **设置面板**：左侧分类导航（外观主题 / 时间显示 / 动态背景 / 壁纸 / 搜索与引擎 / 书签管理 / 数据管理 / 位置与天气 / 快捷键 / 关于），右侧为对应设置项，支持点击定位，定位到的分类会高亮闪烁提示。
- **配置档案**：设置 → 数据管理，可保存多套「书签 + 自定义引擎 + 当前引擎」（如工作/学习/私人），一键切换。
- **设置备份**：全部设置（含书签、引擎、世界时钟与配置档案）可**导出为 JSON 到剪贴板**，换设备**从剪贴板导入**（白名单清洗后覆盖并刷新；不含搜索历史与天气缓存）。
- **恢复默认**：不会清除你的书签和自定义引擎；书签与自定义引擎另有独立的“清空”按钮。

## 常见说明

- 壁纸通过浏览器 `localStorage` 保存，因此体积有限制（本地图片建议 2MB 以内）。
- 天气数据来自公开接口，默认使用 **UAPI（`uapis.cn`）**，也可切换为 **Open-Meteo 的 `cma_grapes_global`（CMA 中国气象局模型）**；**天气预报仅供娱乐，气温相对准确**。CMA 模型不提供紫外线(UV)数据，该项改由 Open-Meteo 默认模型单独获取并合并（获取失败时回退为 `--`）。UAPI 依赖 CORS，需通过 http(s) 访问页面（本地用 `file://` 打开时 UAPI 不可用，Open-Meteo 不受影响）。
- “仓库随机壁纸 / 固定壁纸”只在静态托管环境下生效；本地 `file://` 打开时因浏览器安全策略不会加载。

---

## 面向开发者

> 以下内容面向二次开发与部署人员，普通使用无需了解。

### 项目结构

```text
index.html          页面结构
style.css           全部样式（CSS 变量 + 明暗主题）
js/
  utils.js          ICONS / svg() / 存储 / Toast 等公共工具
  modal.js          统一弹窗无障碍辅助（焦点陷阱 / Escape / 焦点归还）
  theme.js          明暗主题模块（App.Theme）
  particles.js      星点连线粒子背景（雨雪特效在 weather.js）
  parallax.js       视差背景
  clock.js          时钟
  wallpaper.js      壁纸（URL / 本地 / 仓库随机 / 固定）
  engine.js         搜索引擎
  search.js         搜索框与联想
  bookmarks.js      书签
  sortable.js       通用列表排序（拖拽手柄 + ↑↓，书签/自定义引擎共用）
  data.js           设置导入/导出与配置档案
  settings.js       设置面板
  worldclock.js     世界时钟
  weather.js        天气与雨雪特效
  main.js           状态与应用初始化
build.js            零依赖构建脚本（产出 dist/）
package.json        仅含 npm scripts，无第三方依赖
_headers            Cloudflare Pages 缓存策略（发布根目录也需要）
.github/workflows/  GitHub Actions 构建与部署
dist/               构建产物（已 gitignore，在action后构建的产物）
```

### 构建与部署

源码保持零构建即可直接双击运行；线上站点走一次构建，用来**合并请求**与**压缩壁纸**：

```bash
node build.js        # 或 npm run build
```

产物在 `dist/`，与源码相比有三处优化：

- **JS 合并**：16 个 `defer` 分片按顺序拼成 `assets/bundle.<hash>.js`（16 次请求 → 1 次）。
- **壁纸转 WebP**：`img/wallpaper/**` 由 JPG 压为 WebP（最长边 1920、q80，实测 52 MB → 约 1.7 MB，单张 ≤ 320 KB），并让代码引用 `.webp`；原图另存到 `img/wallpaper/*/orig/`，仅供设置里的「使用高清原图」开关按需加载（不开启不会产生任何请求）。若本机装了 `sharp` / ImageMagick / `webp` 则启用，否则回退拷贝原图（功能不受影响）。
- **内容 hash + 长缓存**：`index.html` 引用改为 `assets/` 下带 hash 的文件名，并写入 `dist/_headers`（`/assets/*` 一年 immutable、`/img/*` 7 天）。

线上由 `.github/workflows/build.yml` 在推送 `main` 时自动构建：

- **GitHub Pages**：仓库 Settings → Pages → Source 选 **GitHub Actions** 即可由工作流直接发布 `dist/`。
- **Cloudflare Pages**：推荐同样走工作流，配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 两个仓库 Secrets 后会自动 `pages deploy dist --project-name=softstartpage`。若沿用 Dashboard 的 Git 集成，请把 Build command 设为 `node build.js`、Output directory 设为 `dist`（构建镜像若无 WebP 工具会自动回退原图）。
- 若继续让两边直接发布仓库根目录，`_headers` 仍会修正缓存，但不会享受 JS 合并与壁纸压缩的收益。

> 本地只做开发预览时无需构建：`index.html` 直接引用 14 个源码分片与 `style.css`。

### 常用 API

- 天气（默认）：`https://uapis.cn/api/v1/misc/weather`（UAPI，国内数据，按 `city` / `adcode` 或 IP 定位，缓存 30 分钟；限流 4 QPS / ≤40 次/分）
- 天气（备选）：`https://api.open-meteo.com/v1/cma`（Open-Meteo，CMA 中国气象局 GFS GRAPES 全球模型，缓存 30 分钟）
- 紫外线：`https://api.open-meteo.com/v1/forecast`（Open-Meteo 默认模型，补齐 CMA 所缺的 UV 数据）
- 位置：`https://api.ip.sb/geoip`（IP 定位，仅 Open-Meteo 数据源使用，缓存 24 小时）

> 完整的接口参数、返回字段、缓存策略与注意事项见 [API.md](./doc/API.md)。

### 存储

所有设置保存在浏览器 `localStorage`（键前缀 `sp_`）：

| 键 | 含义 |
| --- | --- |
| `sp_theme` | 明暗主题模式（`auto` / `light` / `dark`，默认跟随系统） |
| `sp_accent_color` | 自定义强调色（`#rrggbb`；`null`/缺失 = 主题默认） |
| `sp_profiles` | 配置档案列表（每项含书签 + 自定义引擎 + 当前引擎） |
| `sp_active_profile` | 当前档案 id |
| `sp_time` | 时间格式（24 小时、显示秒、日期格式） |
| `sp_bookmarks` | 书签数组 |
| `sp_bookmark_inpage` | 书签页面内跳转（默认开启，关闭则新标签页打开） |
| `sp_favicon_source` | 书签自动 favicon 来源（`direct` 默认，站点 `/favicon.ico`；或 `google` s2） |
| `sp_favicon_enabled` | 自动获取网站图标开关（默认开启；关闭则仅显示首字母，手动图标不受影响） |
| `sp_favicon_cache_*` | 自动 favicon 探测结果缓存（`来源\|域名` → `{s:ok/fallback/none, t}`，7 天；可再生缓存，不进导入导出，恢复默认时清除） |
| `sp_history` | 搜索历史 |
| `sp_suggestions` | 搜索联想开关 |
| `sp_fallback` | 联想备用 API（baidu/bing/google） |
| `sp_modifier` | 引擎切换修饰键 |
| `sp_custom_engines` | 自定义搜索引擎（顺序即展示顺序） |
| `sp_engine` | 当前引擎 |
| `sp_hidden_engines` | 已隐藏的默认引擎（默认空） |
| `sp_weather_effect` | 雨雪特效开关 |
| `sp_rain_opacity` | 雨雪特效透明度（0–1，默认 1） |
| `sp_rain_colors` | 雨效颜色（按主题，`{ dark, light }`，默认天蓝） |
| `sp_custom_lat` / `sp_custom_lon` | 自定义经纬度 |
| `sp_location_cache` | 位置缓存（24h） |
| `sp_timezones` | 世界时钟时区列表 |
| `sp_wallpaper` | 壁纸来源 / URL（类型 `none`/`url`/`local`/`fixed`；`none` 时自动使用主题默认壁纸，`fixed` 为固定的仓库壁纸） |
| `sp_particles` | 粒子背景开关（默认关闭） |
| `sp_parallax` | 视差背景开关 |
| `sp_default_wallpaper` | 未设置壁纸时启用默认随机壁纸（关闭时固定壁纸也一并隐藏，但固定状态保留） |
| `sp_hd_wallpaper` | 壁纸使用高清原图（默认 `false`） |
| `sp_theme_wallpaper_count` | 回退方案：元数据缺失时默认壁纸的探测张数（默认 8） |
| `sp_weather_source` | 天气数据源（`uapi` / `open-meteo`，默认 `uapi`） |
| `sp_weather_city` / `sp_weather_adcode` | UAPI 定位参数（留空按 IP 自动定位） |
| `sp_storage_version` | 存储 schema 版本（供未来迁移） |

### 自定义仓库壁纸

默认壁纸放在 `img/wallpaper/` 下，按主题分成两套：

```text
img/wallpaper/black/              暗色主题壁纸
img/wallpaper/light/              亮色主题壁纸
img/wallpaper/wallpaper_about.json  壁纸数量与推荐者信息
```

- 直接替换或新增图片即可，请使用 `.jpg` 并按 `wallpaper0.jpg`、`wallpaper1.jpg`… 从 0 开始连续命名。
- **数量与推荐者由 `img/wallpaper/wallpaper_about.json` 声明**，无需改代码：

```json
{
  "type": "softstartpage-wallpaperabout",
  "black_num": 4,
  "light_num": 5,
  "black_about": [
    { "paper_name": "wallpaper2", "title": "由 Mashiro-Neri 推荐" }
  ],
  "light_about": [
    { "paper_name": "wallpaper0", "title": "由 Mashiro-Neri 推荐" }
  ]
}
```

- `black_num` / `light_num`：两套主题的壁纸张数，随机壁纸在 `[0, 数量)` 中取索引。
- `black_about` / `light_about`：推荐者列表（可选），`paper_name` 为文件名（不含扩展名），`title` 为展示文本。命中的壁纸会在右上角「喜欢这张壁纸吗？」下方显示推荐者。

> 仅静态托管生效：本地 `file://` 打开时，受浏览器安全策略限制不会加载仓库壁纸，元数据也不可读取（此时回退到按 `sp_theme_wallpaper_count` 探测）。

### 图标

- 为保证本地 `file://` 打开也能显示，页面图标由 `App.Utils.ICONS` 以**内联 `<svg>`** 注入，不依赖外部文件；`stroke="currentColor"` 使其自动跟随明暗主题。
- Canvas 图表中的天气图标通过 `App.Utils.svgDataUri()` 转为 base64 data URI 后由 `Image` 绘制。

### 技术实现要点

- **主题系统**：在 `<html>` 上设置 `data-theme` 与 `color-scheme`，配合 CSS 变量；`auto` 模式监听 `prefers-color-scheme`。`<head>` 内联脚本读取 `localStorage` 预置主题，避免首屏闪烁（FOUC）。
- **仓库壁纸探测**：随机挑选时只发一次 `HEAD` 请求，并校验响应 `Content-Type` 以 `image/` 开头才认定为壁纸，从而兼容开启 SPA 回退的托管（如 Cloudflare Pages，不存在的资源会返回 `200 + text/html`）。
- **固定壁纸**：以 `sp_wallpaper = { type:'fixed', value:'img/wallpaper/{black|light}/wallpaper{n}.jpg' }` 存储，路径经正则白名单校验（`_safeRepoUrl`）。
- **时钟渐变**：`.clock` 的数字片段使用 `background-clip: text` 渐变文字；因该属性会“冻结”子元素偏移，冒号的垂直微调改由独立片段（`position: relative`）实现。

### 调试

```js
// 手动激活雨效（强度参考 WMO_RAIN_MAP：小雨 61→4、中雨 63→6、大雨 65→8、雷暴 95→9）
App.state.weatherEffectEnabled = true;
App.Weather.startEffect('rain', 4);
// 雪效同理（WMO_SNOW_MAP：小雪 71→3、中雪 73→5、大雪 75→8）
App.Weather.startEffect('snow', 4);
// 停止
App.Weather.stopEffect();
```

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源，在著明来源的情况下可自由使用、修改与分发。
