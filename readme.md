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
- **动态背景**：“雨，静静的下起来了” —— 雨、雪等天气特效，可调节透明度与颜色。
- **粒子背景**：星点连线的粒子动效（默认关闭）。
- **视差背景**：鼠标移动时背景产生轻微视差，画面更有层次感（可关闭）。
- 未设置壁纸时，背景为纯色（跟随明暗主题）。

### 时间

- **时钟**：支持 24 / 12 小时制、显示秒、多种日期格式。
- **世界时钟**：添加并编辑多个时区时钟，预设常用城市，也支持手动输入 `UTC±HH:MM`。

### 搜索

- **多引擎搜索**：内置 Google / Bing / Baidu 等，可添加自定义搜索引擎，支持 `Ctrl/Alt/Shift + 数字` 快捷切换。
- **搜索联想**：接入搜索引擎联想接口（可切换备用 API），支持搜索历史与一键清除。

### 书签与壁纸

- **书签管理**：拖拽排序，自定义名称 / 网址 / 图标，在设置面板中增删改；可选择“页面内跳转”或“新标签页打开”；书签为空时首页显示「+ 添加书签」，点击直达设置；支持把书签**导出到剪贴板**、或**从剪贴板导入**（导入按网址去重，不会覆盖现有书签）。
- **壁纸**：
  - 支持网络图片 URL，或上传本地图片；
  - 未设置壁纸时，可随机使用仓库内置壁纸（分暗色 / 亮色两套）；
  - 看到喜欢的仓库壁纸？点右上角「固定该壁纸」就能把它固定下来，再点「取消固定」即可恢复随机；
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

- **设置面板**：左侧分类导航（外观主题 / 时间显示 / 动态背景 / 壁纸 / 搜索与引擎 / 书签管理 / 位置与天气 / 快捷键），右侧为对应设置项，支持点击定位与滚动高亮。
- **恢复默认**：不会清除你的书签和自定义引擎；书签与自定义引擎另有独立的“清空”按钮。

## 常见说明

- 壁纸通过浏览器 `localStorage` 保存，因此体积有限制（本地图片建议 2MB 以内）。
- 天气数据来自公开接口，默认使用 **UAPI（`uapis.cn`）**，也可切换为 **Open-Meteo 的 `cma_grapes_global`（CMA 中国气象局模型）**；**天气预报仅供娱乐，气温相对准确**。CMA 模型不提供紫外线(UV)数据，该项改由 Open-Meteo 默认模型单独获取并合并（获取失败时回退为 `--`）。UAPI 依赖 CORS，需通过 http(s) 访问页面（本地用 `file://` 打开时 UAPI 不可用，Open-Meteo 不受影响）。
- “仓库随机壁纸 / 固定壁纸”只在静态托管环境下生效；本地 `file://` 打开时因浏览器安全策略不会加载。

---

## 面向开发者

> 以下内容面向二次开发与部署人员，普通使用无需了解。

### 项目结构

纯前端、零构建、零依赖，源码分模块组织：

```text
index.html          页面结构
style.css           全部样式（CSS 变量 + 明暗主题）
js/
  utils.js          ICONS / svg() / 存储 / Toast 等公共工具
  theme.js          明暗主题模块（App.Theme）
  particles.js      雨雪粒子背景
  parallax.js       视差背景
  clock.js          时钟
  wallpaper.js      壁纸（URL / 本地 / 仓库随机 / 固定）
  engine.js         搜索引擎
  search.js         搜索框与联想
  bookmarks.js      书签
  settings.js       设置面板
  worldclock.js     世界时钟
  weather.js        天气与雨雪特效
  main.js           状态与应用初始化
```

### 常用 API

- 天气（默认）：`https://uapis.cn/api/v1/misc/weather`（UAPI，国内数据，按 `city` / `adcode` 或 IP 定位，缓存 30 分钟；限流 4 QPS / ≤40 次/分）
- 天气（备选）：`https://api.open-meteo.com/v1/cma`（Open-Meteo，CMA 中国气象局 GFS GRAPES 全球模型，缓存 30 分钟）
- 紫外线：`https://api.open-meteo.com/v1/forecast`（Open-Meteo 默认模型，补齐 CMA 所缺的 UV 数据）
- 位置：`https://api.ip.sb/geoip`（IP 定位，仅 Open-Meteo 数据源使用，缓存 24 小时）

> 完整的接口参数、返回字段、缓存策略与注意事项见 [API.md](./API.md)。

### 存储

所有设置保存在浏览器 `localStorage`（键前缀 `sp_`）：

| 键 | 含义 |
| --- | --- |
| `sp_theme` | 明暗主题模式（`auto` / `light` / `dark`，默认跟随系统） |
| `sp_time` | 时间格式（24 小时、显示秒、日期格式） |
| `sp_bookmarks` | 书签数组 |
| `sp_bookmark_inpage` | 书签页面内跳转（默认开启，关闭则新标签页打开） |
| `sp_history` | 搜索历史 |
| `sp_suggestions` | 搜索联想开关 |
| `sp_fallback` | 联想备用 API（baidu/bing/google） |
| `sp_modifier` | 引擎切换修饰键 |
| `sp_custom_engines` | 自定义搜索引擎 |
| `sp_engine` | 当前引擎 |
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
| `sp_theme_wallpaper_count` | 每主题默认壁纸张数（默认 8） |

### 自定义仓库壁纸

默认壁纸放在 `img/wallpaper/` 下，按主题分成两套：

```text
img/wallpaper/black/   暗色主题壁纸
img/wallpaper/light/   亮色主题壁纸
```

- 直接替换或新增图片即可，请使用 `.jpg` 并按 `wallpaper0.jpg`、`wallpaper1.jpg`… 连续命名。
- 随机挑选的索引范围由 `sp_theme_wallpaper_count` 决定（默认 8）；壁纸数量不同时可在控制台调整：

```js
// 例如每套只有 4 张时
App.Utils.save('sp_theme_wallpaper_count', 4);
```

> 仅静态托管生效：本地 `file://` 打开时，受浏览器安全策略限制不会加载仓库壁纸。

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
// 手动激活雨效（强度参考 WMO_RAIN_MAP：小雨 23、中雨 45、大雨 8）
App.state.weatherEffectEnabled = true;
App.Weather.startEffect('rain', 4);
// 雪效同理
App.Weather.startEffect('snow', 4);
// 停止
App.Weather.stopEffect();
```

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源，在著明来源的情况下可自由使用、修改与分发。
