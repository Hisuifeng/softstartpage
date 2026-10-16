# 轻-soft 起始页 · API 与网络资源说明

本文档汇总「轻-soft 起始页」使用到的所有外部 API / 网络资源，包括请求方式、参数、缓存策略与注意事项。

> 项目为纯前端应用，无自建后端；以下接口均在前端直接调用（部分为 JSONP）。

## 概览

| 用途 | 接口 / 地址 | 方式 | 缓存 | 代码位置 |
| --- | --- | --- | --- | --- |
| 天气 · UAPI（默认） | `https://uapis.cn/api/v1/misc/weather` | `fetch` GET | 30 分钟 | `js/weather.js` |
| 天气 · Open-Meteo（备选） | `https://api.open-meteo.com/v1/cma` | `fetch` GET | 30 分钟 | `js/weather.js` |
| 紫外线（Open-Meteo 补齐） | `https://api.open-meteo.com/v1/forecast` | `fetch` GET | 随天气缓存 | `js/weather.js` |
| 定位（Open-Meteo 用） | `https://api.ip.sb/geoip` | `fetch` GET | 24 小时 | `js/weather.js` |
| 搜索联想 · 百度 | `https://suggestion.baidu.com/su` | JSONP | 无 | `js/search.js` |
| 搜索联想 · Bing | `https://api.bing.com/qsonhs.aspx` | JSONP | 无 | `js/search.js` |
| 搜索联想 · Google | `https://suggestqueries.google.com/complete/search` | JSONP | 无 | `js/search.js` |
| 壁纸（仓库默认） | `img/wallpaper/{black,light}/wallpaper{N}.jpg` | `fetch` HEAD | 本地缓存 | `js/wallpaper.js` |

---

## 1. 天气（双数据源，可在设置中切换）

天气由两个可切换的数据源提供，默认 **UAPI**，可在「设置 → 位置与天气 → 天气数据源」切换为 **Open-Meteo**：

| 数据源 | 定位方式 | 说明 |
| --- | --- | --- |
| **UAPI**（默认） | `city` / `adcode` 参数，留空则按客户端 IP 自动定位 | 国内数据，字段更全（空气质量、风力等级等），但有调用频率限制 |
| Open-Meteo（CMA） | 经纬度（自定义或 IP 定位） | 使用 CMA 中国气象局模型 |

> ⚠️ UAPI 依赖 CORS：服务端仅在请求携带合法 `Origin` 时返回 `Access-Control-Allow-Origin`（`Origin: null` 不返回）。因此**必须通过 http(s) 访问页面**（如 GitHub Pages），本地用 `file://` 直接打开时 UAPI 请求会被浏览器拦截；Open-Meteo 不受影响（其响应含 `Access-Control-Allow-Origin: *`）。

---

### 1.1 UAPI（uapis.cn）· 默认数据源

- **端点**：`https://uapis.cn/api/v1/misc/weather`
- **官方文档**：<https://uapis.cn/docs/api-reference/get-misc-weather>
- **请求方式**：`fetch` GET
- **鉴权**：免费、无需 API Key（按 IP 计「积分」，约 2 积分/次）
- **限流**：**4 QPS**，建议 ≤ **40 次/分钟**
- **缓存**：30 分钟，键名 `sp_weather_cache_uapi_{adcode||city||auto}`

#### 请求参数

| 参数 | 说明 |
| --- | --- |
| `city` | 城市名（如 `北京`），与 `adcode` 二选一 |
| `adcode` | 行政区划代码（如 `110000`），**优先于** `city` |
| `lang` | 语言，固定 `zh` |
| `extended` | `true`，返回空气质量等扩展字段 |
| `forecast` | `true`，返回 7 天预报 |
| `hourly` | `true`，返回逐时预报 |
| `indices` | `true`，返回 18 项生活指数（`life_indices`） |

> **不支持经纬度**；`city` 与 `adcode` 均留空时按客户端 IP 自动定位。

#### 返回与展示映射

| 字段 | 单位 | 展示位置 |
| --- | --- | --- |
| `temperature` | °C | 当前温度 |
| `weather` | 文本 | 天气描述（优于 WMO 映射结果，直接展示） |
| `weather_icon` | 和风编码 | 天气图标 |
| `feels_like` | °C | 体感 |
| `humidity` | % | 湿度 |
| `wind_direction` / `wind_power` | 文本 / 等级 | 风向（文本） / 风力 |
| `hourly_forecast[0].wind_speed` | km/h | 风速 |
| `precipitation` | mm | 降雨 |
| `uv` | — | 紫外线（当日） |
| `aqi` / `aqi_category` | — | 空气质量 |
| `forecast[].temp_max` / `temp_min` | °C | 当日最高 / 最低 |
| `forecast[].sunrise` / `sunset` | `HH:MM` | 日出 / 日落 |
| `hourly_forecast[]` | — | 未来逐时趋势折线图 |
| `life_indices` | — | 生活指数网格（18 项，见下） |

#### 生活指数（`life_indices`）

`indices=true` 时返回 `life_indices` 对象，共 **18 项**，每项含 `level`（等级名）、`brief`（简述）、`advice`（详细建议）。程序按固定顺序归一化为数组（键 → 中文名），渲染为「生活指数」网格；鼠标悬停显示 `brief · advice`。

| 键 | 名称 | 键 | 名称 |
| --- | --- | --- | --- |
| `clothing` | 穿衣 | `cold_risk` | 感冒 |
| `uv` | 紫外线 | `exercise` | 运动 |
| `car_wash` | 洗车 | `comfort` | 舒适度 |
| `drying` | 晾晒 | `travel` | 旅游 |
| `air_conditioner` | 空调 | `fishing` | 钓鱼 |
| `allergy` | 过敏 | `sunscreen` | 防晒 |
| `mood` | 心情 | `beer` | 啤酒 |
| `umbrella` | 雨伞 | `traffic` | 交通 |
| `air_purifier` | 空气净化 | `pollen` | 花粉 |

> 生活指数目前仅支持中文（`lang` 对其无效）；缺失项会被跳过，整块无数据时自动隐藏。

#### 注意事项

- **时间字段**：`report_time` 是**相对描述**（如 `"10 分钟前发布"`），**不可**用于取日期；「今天」改用 `hourly_forecast[0].time` 的日期。
- **逐时时间**：`hourly_forecast[].time` 是「城市当地墙钟时间」（格式 `YYYY-MM-DD HH:MM:SS`，无时区偏移）。程序仅把空格换成 `T` 得到本地时间串（**不补偏移**），与 Open-Meteo `timezone=auto` 的语义保持一致。
- **缺失字段**：UAPI **不提供**阵风、降雪、晴空紫外线；对应卡片会隐藏或显示 `--`（界面卡片集按数据源切换）。
- **错误码**：`400 INVALID_PARAMETER`、`404 NOT_FOUND`、`500`、`503 SERVICE_UNAVAILABLE`（502 已移除）。

#### 测试

```
https://uapis.cn/api/v1/misc/weather?extended=true&forecast=true&hourly=true&lang=zh
```

---

### 1.2 Open-Meteo —— CMA 中国气象局模型（备选数据源）

- **端点**：`https://api.open-meteo.com/v1/cma`
- **模型**：CMA 中国气象局 **GFS GRAPES 全球模型**（内部标识 `cma_grapes_global`）
- **官方文档**：<https://open-meteo.com/en/docs/cma-api>
- **请求方式**：`fetch` GET
- **鉴权**：免费、无需 API Key（非商业用途）
- **缓存**：30 分钟，存于 `localStorage`，键名 `sp_weather_cache_{lat}_{lon}`（经纬度保留两位小数）

### 请求参数

| 参数 | 说明 |
| --- | --- |
| `latitude` / `longitude` | 请求坐标（WGS84） |
| `timezone` | 固定为 `auto`（按坐标自动解析时区） |
| `current` | `temperature_2m, precipitation, weather_code, rain, apparent_temperature, relative_humidity_2m, wind_speed_10m, wind_gusts_10m, wind_direction_10m, snowfall` |
| `hourly` | `temperature_2m, precipitation, weather_code, apparent_temperature, snowfall` |
| `daily` | `sunrise, sunset, temperature_2m_max, temperature_2m_min, uv_index_max, uv_index_clear_sky_max`（CMA 对 UV 仅返回 `null` 占位数组，供后续合并） |

### 返回与展示映射

| 字段 | 单位 | 展示位置 |
| --- | --- | --- |
| `current.temperature_2m` | °C | 悬浮按钮 / 详情大卡（当前温度） |
| `current.weather_code` | WMO | 天气图标 + 描述 |
| `current.apparent_temperature` | °C | 体感 |
| `current.relative_humidity_2m` | % | 湿度 |
| `current.wind_speed_10m` / `wind_gusts_10m` | km/h | 风速 / 阵风 |
| `current.wind_direction_10m` | ° | 风向（转中文方位） |
| `current.rain` / `snowfall` | mm / cm | 降雨 / 降雪 |
| `daily.temperature_2m_max` / `min` | °C | 当日最高 / 最低 |
| `daily.uv_index_max` / `uv_index_clear_sky_max` | — | 紫外线（默认模型补齐，见下） |
| `daily.sunrise` / `sunset` | 当地时间 | 日出 / 日落 |
| `hourly.*`（未来 48 小时） | — | 温度 / 体感趋势折线图 + 降水 / 降雪柱状图 |

### 注意事项

- **时间分辨率**：CMA 模型原生为 **3 小时间隔**，Open-Meteo 会插值为**逐小时**序列（168 小时），故图表取未来 48 小时。
- **紫外线(UV)**：CMA 模型**不提供** UV 数据（`uv_index_max` / `uv_index_clear_sky_max` 恒为 `null`），故额外请求 Open-Meteo 默认模型（`best_match`）补齐，按日期合并进主数据（见下）。
- **时区匹配**：`daily.time` 为「坐标所在时区」的当地日期，取“今天”时需使用返回的 `utc_offset_seconds`（`js/weather.js` 中已处理），否则东八区凌晨会匹配不到当天。
- **可用性与精度**：CMA 开放数据偶有抽风，且天气为预报，**仅供娱乐，气温相对准确**。
- **失败回退**：请求失败时弹出提示 `天气数据获取失败`，不阻塞页面。

### 紫外线补齐（默认模型）

由于 CMA 不提供紫外线，程序会**并发**再请求一次 Open-Meteo **默认模型**（`best_match`），仅取 UV 字段：

```
https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=uv_index_max,uv_index_clear_sky_max&timezone=auto
```

- 两个请求通过 `Promise.all` 并发；UV 请求失败**不影响主数据**，UV 保持 `null`，界面回退显示 `--`（`js/weather.js` 的 `_mergeUv()`）。
- 合并方式：按 `daily.time` 的日期对齐，将默认模型的 `uv_index_max` / `uv_index_clear_sky_max` 写入 CMA 主数据对应日期。
- 合并结果随天气数据**一并缓存**（同一 30 分钟缓存，命中缓存时不再单独请求 UV）。

### 测试坐标（北京）

```
https://api.open-meteo.com/v1/cma?latitude=39.9042&longitude=116.4074&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max,uv_index_clear_sky_max&hourly=temperature_2m,precipitation,weather_code,apparent_temperature,snowfall&current=temperature_2m,precipitation,weather_code,rain,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,snowfall&timezone=auto
```

---

## 2. 定位 —— IP 地理定位（仅 Open-Meteo 使用）

> UAPI 数据源依据 `city` / `adcode` 或客户端 IP 自行定位，不使用此接口。

- **端点**：`https://api.ip.sb/geoip`
- **请求方式**：`fetch` GET
- **缓存**：24 小时，键名 `sp_location_cache`
- **优先级**：
  1. 若用户在设置中填写了自定义经纬度（`sp_custom_lat` / `sp_custom_lon`），直接使用，**不请求**定位接口；
  2. 否则读取 24 小时内的缓存；
  3. 否则请求 `api.ip.sb`。
- **返回值使用**：`city` / `country`（或 `region`）/ `latitude` / `longitude`。
- **失败回退**：请求异常时回退到**北京**（`39.9042, 116.4074`）。

---

## 3. 搜索联想 —— JSONP

通过动态 `<script>` 以 JSONP 回调方式获取（受 CORS 限制，故不用 `fetch`）。联想接口随当前引擎的 `api` 字段（或设置的备用 API `sp_fallback`）切换：

| 引擎 | 接口 | 说明 |
| --- | --- | --- |
| 百度 | `https://suggestion.baidu.com/su?wd={q}&cb={cb}` | 取 `data.s` |
| Bing | `https://api.bing.com/qsonhs.aspx?q={q}&type=cb&cb={cb}` | 取 `data.AS.Results[].Suggests[].Txt` |
| Google | `https://suggestqueries.google.com/complete/search?client=firefox&hl=zh-CN&q={q}&callback={cb}` | 取返回数组第 2 项 |

- 结果最多展示 10 条；输入变化会取消上一次未完成的 JSONP 请求。
- DuckDuckGo 无联想接口（`api: null`），此时使用备用 API。

---

## 4. 搜索跳转（引擎主页 / 结果页）

| 引擎 | 搜索 URL | 主页 |
| --- | --- | --- |
| Google | `https://www.google.com/search?q=` | `https://www.google.com` |
| 百度 | `https://www.baidu.com/s?wd=` | `https://www.baidu.com` |
| Bing | `https://www.bing.com/search?q=` | `https://www.bing.com` |
| DuckDuckGo | `https://duckduckgo.com/?q=` | `https://duckduckgo.com` |

> 另有自定义搜索引擎（`sp_custom_engines`）由用户配置搜索 URL 模板。

---

## 5. 壁纸资源（仓库默认壁纸）

- **路径**：`img/wallpaper/{black|light}/wallpaper{N}.jpg`（相对路径；`black` 对应暗色主题，`light` 对应亮色主题）。
- **数量与推荐者**：由 `img/wallpaper/wppaper_about.json` 声明——
  - `black_num` / `light_num`：两套主题的壁纸张数，随机选取在 `[0, 数量)` 中进行（不再写死上限 7）；
  - `black_about` / `light_about`：推荐者列表（可选），`paper_name` = 文件名（不含扩展名），`title` = 展示文本；命中的壁纸会在右上角「喜欢这张壁纸吗？」下方显示推荐者。
- **回退方案**：元数据读取失败时，按 `sp_theme_wallpaper_count`（默认 8）随机索引发**一次** `fetch` HEAD 请求，并校验响应 `Content-Type` 以 `image/` 开头才算命中（最多重试 6 次）。
- **为何校验 Content-Type**：
  - GitHub Pages 上不存在的图片返回真 404；
  - Cloudflare Pages 若开启 SPA fallback，不存在的资源会被兜底为 `200 + text/html`（`index.html`），仅看 `.ok` 会误判，故必须校验是否为真实图片类型。
- **说明**：仅在**静态托管环境**下生效；本地 `file://` 打开时受浏览器安全策略限制，不会加载仓库壁纸与元数据（自定义 URL / 本地上传壁纸不受影响）。

---

## 缓存与存储一览

| localStorage 键 | 含义 | 有效期 |
| --- | --- | --- |
| `sp_weather_cache_{lat}_{lon}` | 天气缓存（Open-Meteo 数据源） | 30 分钟 |
| `sp_weather_cache_uapi_{adcode\|city\|auto}` | 天气缓存（UAPI 数据源） | 30 分钟 |
| `sp_weather_source` | 天气数据源（`uapi` \| `open-meteo`，默认 `uapi`） | 持久 |
| `sp_weather_city` / `sp_weather_adcode` | UAPI 定位参数（留空按 IP 自动定位） | 持久 |
| `sp_location_cache` | IP 定位结果缓存（Open-Meteo 数据源） | 24 小时 |
| `sp_custom_lat` / `sp_custom_lon` | 自定义经纬度（Open-Meteo，优先于 IP 定位） | 持久 |
