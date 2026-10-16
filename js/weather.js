/**
 * weather.js
 * 天气与雨效/雪效模块（适配新API结构）
 * 挂载于 window.App.Weather
 */
(function () {
    window.App = window.App || {};
    if (!window.App.state) window.App.state = {};

    const Weather = {
        // DOM 元素
        fabBtn: null, fabIcon: null, fabText: null,
        overlay: null,
        chartCanvas: null, chartTooltip: null, chartContainer: null,
        refreshBtn: null,

        // 天气数据
        currentWeatherData: null,
        resizeTimer: null,
        isRefreshing: false,

        // WMO 天气代码（icon 为 App.Utils.ICONS 中的扁平 SVG 图标名）
        WMO_CODES: {
            0: { icon: 'sun', desc: '晴' }, 1: { icon: 'weather', desc: '少云' },
            2: { icon: 'weather', desc: '多云' }, 3: { icon: 'cloud', desc: '阴' },
            45: { icon: 'fog', desc: '雾' }, 48: { icon: 'fog', desc: '冻雾' },
            51: { icon: 'drizzle', desc: '毛毛雨' }, 53: { icon: 'drizzle', desc: '毛毛雨' },
            55: { icon: 'drizzle', desc: '毛毛雨' }, 61: { icon: 'rain', desc: '小雨' },
            63: { icon: 'rain', desc: '中雨' }, 65: { icon: 'rain', desc: '大雨' },
            71: { icon: 'snow', desc: '小雪' }, 73: { icon: 'snow', desc: '中雪' },
            75: { icon: 'snow', desc: '大雪' }, 77: { icon: 'snow', desc: '雪粒' },
            80: { icon: 'rain', desc: '阵雨' }, 81: { icon: 'rain', desc: '中阵雨' },
            82: { icon: 'rain', desc: '大阵雨' }, 85: { icon: 'snow', desc: '小阵雪' },
            86: { icon: 'snow', desc: '大阵雪' }, 95: { icon: 'storm', desc: '雷暴' },
            96: { icon: 'storm', desc: '雷暴伴冰雹' }, 99: { icon: 'storm', desc: '雷暴伴大冰雹' }
        },

        WMO_RAIN_MAP: {
            0: 0, 1: 0, 2: 0, 3: 0, 45: 0, 48: 0,
            51: 3, 53: 4, 55: 5, 61: 4, 80: 4,
            63: 6, 81: 6, 65: 8, 82: 8, 95: 9, 96: 10, 99: 10
        },
        WMO_SNOW_MAP: { 71: 3, 73: 5, 75: 8, 77: 4, 85: 4, 86: 6 },

        // UAPI 生活指数：键 → 中文名（顺序即展示顺序，共 18 项）
        LIFE_INDICES: [
            ['clothing', '穿衣'], ['uv', '紫外线'], ['car_wash', '洗车'],
            ['drying', '晾晒'], ['air_conditioner', '空调'], ['cold_risk', '感冒'],
            ['exercise', '运动'], ['comfort', '舒适度'], ['travel', '旅游'],
            ['fishing', '钓鱼'], ['allergy', '过敏'], ['sunscreen', '防晒'],
            ['mood', '心情'], ['beer', '啤酒'], ['umbrella', '雨伞'],
            ['traffic', '交通'], ['air_purifier', '空气净化'], ['pollen', '花粉']
        ],

        currentEffectType: null, currentEffectIntensity: 0,
        effectCanvas: null, effectCtx: null,
        particles: [], animFrameId: null,
        // 雨/雪效全局透明度（0–1，设置面板 sp_rain_opacity）
        effectOpacity: 1,
        // 雨效颜色（按主题区分，设置面板 sp_rain_colors）
        rainColors: { dark: '#87ceeb', light: '#2a8fd4' },
        // 天气图标缓存（Canvas 绘制用）
        weatherIcons: {},
        isDarkTheme: window.App.Theme ? App.Theme.isDark() : !window.matchMedia('(prefers-color-scheme: light)').matches,

        init(options = {}) {
            this.fabBtn = document.getElementById('weatherFab');
            this.fabIcon = document.getElementById('weatherFabIcon');
            this.fabText = document.getElementById('weatherFabText');
            this.overlay = document.getElementById('weatherOverlay');
            this.chartCanvas = document.getElementById('weatherChartCanvas');
            this.chartContainer = document.getElementById('weatherChartContainer');
            this.chartTooltip = document.getElementById('chartTooltip');
            this.refreshBtn = document.getElementById('refreshWeatherBtn');

            this.effectCanvas = document.getElementById('rain-canvas');
            if (this.effectCanvas) {
                this.effectCtx = this.effectCanvas.getContext('2d');
                this._initEffectCanvas();
            }

            // 预载天气 SVG 图标（作为 Canvas 图片，颜色跟随当前主题）
            this._loadWeatherIcons();

            this.isDarkTheme = window.App.Theme ? App.Theme.isDark() : this.isDarkTheme;
            window.addEventListener('themechange', e => {
                this.isDarkTheme = e.detail ? e.detail.dark
                    : (window.App.Theme ? App.Theme.isDark() : this.isDarkTheme);
                this._loadWeatherIcons();
                if (this.currentEffectType && this.currentEffectIntensity > 0) {
                    this.startEffect(this.currentEffectType, this.currentEffectIntensity);
                }
            });

            const state = window.App.state;
            state.weatherEffectEnabled = options.weatherEffectEnabled !== undefined
                ? options.weatherEffectEnabled
                : App.Utils.load('sp_weather_effect', true);
            this.effectOpacity = state.rainOpacity !== undefined
                ? state.rainOpacity
                : App.Utils.load('sp_rain_opacity', 1);
            this.rainColors = state.rainColors || App.Utils.load('sp_rain_colors', { dark: '#87ceeb', light: '#2a8fd4' });
            state.customLat = App.Utils.load('sp_custom_lat', null);
            state.customLon = App.Utils.load('sp_custom_lon', null);
            // 天气数据源（uapi = uapis.cn，open-meteo = Open-Meteo/CMA）与 UAPI 定位参数
            state.weatherSource = state.weatherSource || App.Utils.load('sp_weather_source', 'uapi');
            state.weatherCity = state.weatherCity ?? App.Utils.load('sp_weather_city', '');
            state.weatherAdcode = state.weatherAdcode ?? App.Utils.load('sp_weather_adcode', '');

            this._bindEvents();
            this.updateWeatherFab();
            setInterval(() => this.updateWeatherFab(), 1800000);
        },

        getWeatherInfo(code) { return this.WMO_CODES[code] || { icon: 'unknown', desc: '未知' }; },

        /** 将天气图标加载为 Canvas 图片对象（通过内联 data URI，本地可用） */
        _loadWeatherIcons() {
            const iconNames = Object.values(this.WMO_CODES).map(w => w.icon)
                .concat(['unknown']).filter((v, i, a) => a.indexOf(v) === i);
            const color = this.getThemeColors().textColor;
            this.weatherIcons = {};
            iconNames.forEach(name => {
                const img = new Image();
                img.src = App.Utils.svgDataUri(name, color);
                this.weatherIcons[name] = img;
            });
        },
        getThemeColors() {
            const style = getComputedStyle(document.documentElement);
            return {
                tempColor: style.getPropertyValue('--temp-color').trim() || '#f87171',
                feelColor: style.getPropertyValue('--feel-color').trim() || '#8ab4f8',
                precipColor: style.getPropertyValue('--precip-color').trim() || 'rgba(74,108,247,0.4)',
                gridColor: style.getPropertyValue('--grid-color').trim() || 'rgba(128,128,128,0.15)',
                textColor: style.getPropertyValue('--text-tertiary').trim() || '#9aa0a6',
                bgColor: style.getPropertyValue('--settings-row-bg').trim() || 'rgba(255,255,255,0.02)',
                indicatorColor: style.getPropertyValue('--accent').trim() || '#8ab4f8'
            };
        },

        // ==================== 位置 API ====================
        async getLocation(forceRefresh = false) {
            const state = window.App.state;
            if (state.customLat !== null && state.customLon !== null && !isNaN(state.customLat) && !isNaN(state.customLon)) {
                return { city: '自定义位置', country: '', lat: state.customLat, lon: state.customLon };
            }
            if (!forceRefresh) {
                const cached = App.Utils.load('sp_location_cache', null);
                if (cached && cached.timestamp && (Date.now() - cached.timestamp < 86400000)) return cached.data;
            }
            try {
                const resp = await fetch('https://api.ip.sb/geoip');
                if (!resp.ok) throw new Error('位置获取失败');
                const data = await resp.json();
                const location = { city: data.city || '未知', country: data.country || data.region || '', lat: data.latitude, lon: data.longitude };
                App.Utils.save('sp_location_cache', { data: location, timestamp: Date.now() });
                return location;
            } catch (e) {
                console.warn('定位失败，使用默认位置（北京）');
                return { city: '北京', country: '中国', lat: 39.9042, lon: 116.4074 };
            }
        },

        // ==================== 天气 API (新接口) ====================
        async getWeather(lat, lon, forceRefresh = false) {
            const cacheKey = `sp_weather_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
            if (!forceRefresh) {
                const cached = App.Utils.load(cacheKey, null);
                if (cached && cached.timestamp && (Date.now() - cached.timestamp < 1800000)) {
                    // 检查新数据是否包含 current 对象，否则视为旧缓存
                    if (cached.data?.current && cached.data?.daily?.temperature_2m_max) {
                        return cached.data;
                    } else {
                        localStorage.removeItem(cacheKey);
                    }
                }
            }
            try {
                // 主数据：CMA（中国气象局）GFS GRAPES 全球模型的专用端点
                // 文档：https://open-meteo.com/en/docs/cma-api
                // 注：该模型原生为 3 小时间隔，Open-Meteo 会插值为逐小时序列供图表使用；其不提供紫外线(UV)数据
                const url = `https://api.open-meteo.com/v1/cma?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max,uv_index_clear_sky_max&hourly=temperature_2m,precipitation,weather_code,apparent_temperature,snowfall&current=temperature_2m,precipitation,weather_code,rain,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,snowfall&timezone=auto`;
                // 紫外线补齐：CMA 无 UV 数据，改用 Open-Meteo 默认模型（best_match）单独获取并按日期合并。
                // 两个请求并发，UV 失败不影响主数据（UV 保持 null，界面回退为 --）。
                const uvUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=uv_index_max,uv_index_clear_sky_max&timezone=auto`;
                const [resp, uvResp] = await Promise.all([fetch(url), fetch(uvUrl)]);
                if (!resp.ok) throw new Error('天气获取失败');
                const data = await resp.json();
                await this._mergeUv(data, uvResp);
                App.Utils.save(cacheKey, { data, timestamp: Date.now() });
                return data;
            } catch (e) { console.error(e); App.Utils.showToast('天气数据获取失败'); return null; }
        },

        /**
         * 将 Open-Meteo 默认模型返回的紫外线数据按日期合并进主数据（CMA 无 UV）。
         * @param {object} data    CMA 主数据（就地修改其 daily.uv_index_max / uv_index_clear_sky_max）
         * @param {Response} uvResp 默认模型 UV 响应；非 200 或异常时静默跳过
         */
        async _mergeUv(data, uvResp) {
            try {
                if (!data?.daily?.time || !uvResp || !uvResp.ok) return;
                const uvData = await uvResp.json();
                if (!uvData?.daily?.time) return;
                const idxByDate = {};
                uvData.daily.time.forEach((t, i) => { idxByDate[t] = i; });
                data.daily.time.forEach((t, i) => {
                    const j = idxByDate[t];
                    if (j === undefined) return;
                    const uvMax = uvData.daily.uv_index_max?.[j];
                    const uvClear = uvData.daily.uv_index_clear_sky_max?.[j];
                    if (uvMax !== undefined && uvMax !== null && data.daily.uv_index_max) data.daily.uv_index_max[i] = uvMax;
                    if (uvClear !== undefined && uvClear !== null && data.daily.uv_index_clear_sky_max) data.daily.uv_index_clear_sky_max[i] = uvClear;
                });
            } catch (uvErr) { console.warn('紫外线数据补齐失败', uvErr); }
        },

        /**
         * 统一入口：按当前数据源取天气。
         * 'uapi' = uapis.cn（按 city/adcode 查询或 IP 自动定位）
         * 'open-meteo' = Open-Meteo CMA（按经纬度查询）
         */
        async fetchWeather(forceRefresh = false) {
            const state = window.App.state;
            const source = state.weatherSource === 'open-meteo' ? 'open-meteo' : 'uapi';
            if (source === 'uapi') return this._getWeatherUapi(forceRefresh);
            const location = await this.getLocation(forceRefresh);
            return this.getWeather(location.lat, location.lon, forceRefresh);
        },

        // ==================== UAPI（uapis.cn）数据源 ====================
        /**
         * 调用 uapis.cn 天气接口并归一化为 Open-Meteo 风格结构（current/hourly/daily），
         * 使详情面板与图表无需关心数据源即可渲染。
         * 该接口有调用限制（4 QPS、建议 ≤40 次/分），故必须缓存 30 分钟再复用。
         * 文档：https://uapis.cn/docs/api-reference/get-misc-weather
         */
        async _getWeatherUapi(forceRefresh = false) {
            const state = window.App.state;
            const city = String(state.weatherCity || '').trim();
            const adcode = String(state.weatherAdcode || '').trim();
            // 缓存键包含定位参数：切换城市 / 编码 / 数据源时自动失效，互不串味
            const cacheKey = `sp_weather_cache_uapi_${(adcode || city || 'auto').replace(/\s+/g, '')}`;
            if (!forceRefresh) {
                const cached = App.Utils.load(cacheKey, null);
                if (cached && cached.timestamp && (Date.now() - cached.timestamp < 1800000)) {
                    if (cached.data?.current && cached.data?.daily?.temperature_2m_max) return cached.data;
                    localStorage.removeItem(cacheKey);
                }
            }
            const params = new URLSearchParams({ extended: 'true', forecast: 'true', hourly: 'true', indices: 'true', lang: 'zh' });
            // adcode 优先级高于 city；两者都不传时由接口按客户端 IP 自动定位
            if (adcode) params.set('adcode', adcode);
            else if (city) params.set('city', city);
            try {
                const resp = await fetch(`https://uapis.cn/api/v1/misc/weather?${params}`);
                if (!resp.ok) throw this._uapiError(resp);
                const data = this._normalizeUapi(await resp.json());
                if (!data) throw this._uapiError(null, '天气数据格式异常');
                App.Utils.save(cacheKey, { data, timestamp: Date.now() });
                return data;
            } catch (e) {
                console.error(e);
                App.Utils.showToast(e?.friendly ? e.message : '天气数据获取失败');
                return null;
            }
        },

        /** 把 uapis.cn 的错误状态码转成可直接展示给用户的中文错误 */
        _uapiError(resp, fallback = '') {
            const e = new Error(fallback || '天气获取失败');
            e.friendly = true;
            if (resp) {
                const map = {
                    400: '天气接口参数无效',
                    404: '未找到该城市的天气数据',
                    429: '天气接口请求过于频繁，请稍后再试',
                    500: '天气服务内部错误',
                    503: '天气服务暂时不可用'
                };
                e.message = map[resp.status] || `天气获取失败 (${resp.status})`;
            }
            return e;
        },

        /**
         * 将 uapis.cn 返回结构归一化为 Open-Meteo 风格数据。
         * @param {object} raw uapis.cn 原始响应
         * @returns {object|null}
         */
        _normalizeUapi(raw) {
            if (!raw || typeof raw !== 'object') return null;
            const h = Array.isArray(raw.hourly_forecast) ? raw.hourly_forecast : [];
            const fc = Array.isArray(raw.forecast) ? raw.forecast : [];

            // UAPI 的 hourly_forecast[].time 是「城市当地墙钟时间」（不带时区偏移），
            // 与 Open-Meteo timezone=auto 的语义一致：此处只把空格换成 T 得到可解析的
            // 本地时间串（不补任何偏移），保证图表按当地墙钟显示、与 Open-Meteo 行为一致。
            // 「今天」直接取 h[0].time 的日期；report_time 是相对描述（如“10 分钟前发布”），不可用。
            const todayDate = (h[0] && h[0].time ? String(h[0].time).slice(0, 10) : null)
                || (fc[0] ? fc[0].date : null);

            return {
                source: 'uapi',
                todayDate,
                current: {
                    temperature_2m: raw.temperature ?? null,
                    weather_code: this._wmoFromText(raw.weather),
                    weather_text: raw.weather || '',
                    apparent_temperature: raw.feels_like ?? null,
                    relative_humidity_2m: raw.humidity ?? null,
                    wind_speed_10m: h[0] && h[0].wind_speed != null ? h[0].wind_speed : null,
                    wind_gusts_10m: null,
                    wind_direction_10m: raw.wind_direction || '',
                    rain: raw.precipitation ?? null,
                    snowfall: null,
                    uapiWindPower: raw.wind_power || ''
                },
                daily: {
                    time: fc.map(f => f.date),
                    temperature_2m_max: fc.map(f => f.temp_max ?? null),
                    temperature_2m_min: fc.map(f => f.temp_min ?? null),
                    uv_index_max: fc.map(f => f.uv_index ?? null),
                    uv_index_clear_sky_max: fc.map(f => f.uv_index ?? null),
                    sunrise: fc.map(f => (f.date && f.sunrise ? `${f.date}T${f.sunrise}` : null)),
                    sunset: fc.map(f => (f.date && f.sunset ? `${f.date}T${f.sunset}` : null))
                },
                hourly: {
                    time: h.map(x => (x.time ? String(x.time).replace(' ', 'T') : null)),
                    temperature_2m: h.map(x => x.temperature ?? null),
                    precipitation: h.map(x => x.precip ?? null),
                    weather_code: h.map(x => this._wmoFromText(x.weather)),
                    weather_text: h.map(x => x.weather || ''),
                    apparent_temperature: h.map(x => x.feels_like ?? null),
                    snowfall: h.map(() => null)
                },
                uapi: {
                    province: raw.province || '',
                    city: raw.city || '',
                    district: raw.district || '',
                    weather: raw.weather || '',
                    windPower: raw.wind_power || '',
                    uv: raw.uv ?? null,
                    aqi: raw.aqi ?? null,
                    aqiLevel: raw.aqi_level ?? null,
                    aqiCategory: raw.aqi_category || '',
                    aqiPrimary: raw.aqi_primary || '',
                    visibility: raw.visibility ?? null,
                    pressure: raw.pressure ?? null,
                    cloud: raw.cloud ?? null,
                    reportTime: raw.report_time || '',
                    alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
                    lifeIndices: this._normalizeLifeIndices(raw.life_indices)
                }
            };
        },

        /** UAPI life_indices → 有序数组 [{name, level, brief, advice}]（缺失项跳过） */
        _normalizeLifeIndices(raw) {
            if (!raw || typeof raw !== 'object') return [];
            return this.LIFE_INDICES
                .map(([key, name]) => {
                    const it = raw[key];
                    if (!it || typeof it !== 'object') return null;
                    const level = it.level || it.brief || '';
                    if (!level) return null;
                    return { key, name, level, brief: it.brief || '', advice: it.advice || '' };
                })
                .filter(Boolean);
        },

        /** UAPI 的天气文本 → WMO 代码（驱动图标选择与雨/雪效强度） */
        _wmoFromText(text) {
            const t = String(text || '');
            if (!t) return 3;
            if (t.includes('雷')) return 95;
            if (t.includes('雹')) return 96;
            if (t.includes('雪')) return t.includes('大') ? 75 : (t.includes('中') ? 73 : 71);
            if (t.includes('雨')) return t.includes('阵') ? 80 : (t.includes('大') ? 65 : (t.includes('中') ? 63 : 61));
            if (t.includes('雾') || t.includes('霾') || t.includes('沙') || t.includes('尘')) return 45;
            if (t.includes('阴')) return 3;
            if (t.includes('多云') || t.includes('少云')) return 2;
            if (t.includes('晴')) return 0;
            return 3;
        },

        // ==================== 更新左下角按钮 ====================
        /** @param {object|null} weatherData 已取到的数据（避免重复请求），缺省时自行拉取 */
        async updateWeatherFab(weatherData = null) {
            const data = weatherData || await this.fetchWeather();
            if (!data || !data.current) return null;
            this.currentWeatherData = data;

            const current = data.current;
            const code = current.weather_code;
            const temp = Math.round(Number(current.temperature_2m));
            const info = this.getWeatherInfo(code);
            // UAPI 的天气文本（如“霾”）比 WMO 映射出的描述更准确，优先展示
            const desc = current.weather_text || info.desc;

            if (this.fabIcon) this.fabIcon.innerHTML = App.Utils.svg(info.icon);
            if (this.fabText) this.fabText.textContent = `${desc} ${temp}°`;

            // 雨/雪效
            this._applyEffectByCode(code);
            return data;
        },

        /** 数据源 / 定位参数变化后重新拉取（缓存键随参数变化，通常会真正发一次请求） */
        async handleSourceChange() {
            const data = await this.updateWeatherFab();
            if (data && this.overlay?.classList.contains('open')) {
                await this.renderWeatherDetail(data);
            }
        },

        async forceRefreshWeather() {
            if (this.isRefreshing) return;
            this.isRefreshing = true;
            if (this.refreshBtn) {
                this.refreshBtn.style.opacity = '0.5';
                this.refreshBtn.style.pointerEvents = 'none';
            }
            try {
                const weatherData = await this.fetchWeather(true);
                if (!weatherData || !weatherData.current) {
                    App.Utils.showToast('刷新失败，请稍后重试');
                    return;
                }
                await this.updateWeatherFab(weatherData);
                if (this.overlay?.classList.contains('open')) {
                    await this.renderWeatherDetail(weatherData);
                }
                App.Utils.showToast('天气已更新');
            } catch (err) {
                console.error(err);
                App.Utils.showToast('刷新异常');
            } finally {
                this.isRefreshing = false;
                if (this.refreshBtn) {
                    this.refreshBtn.style.opacity = '1';
                    this.refreshBtn.style.pointerEvents = 'auto';
                }
            }
        },

        _applyEffectByCode(code) {
            if (!window.App.state.weatherEffectEnabled) {
                this.stopEffect();
                return;
            }
            const rainIntensity = this.WMO_RAIN_MAP[code] || 0;
            if (rainIntensity > 0) {
                this.startEffect('rain', rainIntensity);
                return;
            }
            const snowIntensity = this.WMO_SNOW_MAP[code] || 0;
            if (snowIntensity > 0) {
                this.startEffect('snow', snowIntensity);
                return;
            }
            this.stopEffect();
        },

        // ==================== 天气详情面板 ====================
        async renderWeatherDetail(weatherData, location) {
            const data = weatherData || this.currentWeatherData;
            if (!data || !data.current) return;
            const isUapi = data.source === 'uapi';

            // 位置展示：UAPI 自带回传的城市/区县（其定位由接口按 IP 或 city/adcode 决定），
            // 此时无需再调用 IP 定位接口
            let cityLabel;
            if (isUapi && data.uapi) {
                const { city, district } = data.uapi;
                cityLabel = [city, district && district !== city ? district : ''].filter(Boolean).join(' ')
                    || city || '未知位置';
            } else {
                const loc = location || await this.getLocation();
                cityLabel = `${loc.city} ${loc.country}`.trim();
            }

            const current = data.current;
            const daily = data.daily;
            // 「今天」：UAPI 归一化时已按其当地时刻给出 todayDate；Open-Meteo 的 daily.time
            // 是「请求坐标所在时区」的当地日期，需用返回的 utc_offset_seconds 推算，
            // 否则当本地时区快于 UTC（如北京 UTC+8 的凌晨）会匹配不到当天，
            // 导致最高/最低/紫外线/日出日落全部显示为 --。
            const todayStr = data.todayDate
                || new Date(Date.now() + (data.utc_offset_seconds || 0) * 1000).toISOString().slice(0, 10);
            const todayIndex = daily.time.indexOf(todayStr);

            // 实时数据
            const has = v => v !== null && v !== undefined && v !== '';
            const temp = has(current.temperature_2m) ? Math.round(current.temperature_2m) : '--';
            const feel = has(current.apparent_temperature) ? Math.round(current.apparent_temperature) : '--';
            const humidity = has(current.relative_humidity_2m) ? current.relative_humidity_2m + '%' : '--';
            const code = current.weather_code;
            const info = this.getWeatherInfo(code);
            // UAPI 的天气文本（如“霾”）比 WMO 映射出的描述更准确，优先展示
            const desc = current.weather_text || info.desc;

            // 今日最高/最低温度
            const maxTemp = todayIndex >= 0 && daily.temperature_2m_max[todayIndex] !== null
                ? Math.round(daily.temperature_2m_max[todayIndex]) : '--';
            const minTemp = todayIndex >= 0 && daily.temperature_2m_min[todayIndex] !== null
                ? Math.round(daily.temperature_2m_min[todayIndex]) : '--';

            // UV 指数
            const uvMax = todayIndex >= 0 && daily.uv_index_max[todayIndex] !== null
                ? daily.uv_index_max[todayIndex] : '--';
            const uvClear = todayIndex >= 0 && daily.uv_index_clear_sky_max[todayIndex] !== null
                ? daily.uv_index_clear_sky_max[todayIndex] : '--';

            // 日出日落
            const sunrise = todayIndex >= 0 && daily.sunrise[todayIndex]
                ? daily.sunrise[todayIndex].slice(11, 16) : '--';
            const sunset = todayIndex >= 0 && daily.sunset[todayIndex]
                ? daily.sunset[todayIndex].slice(11, 16) : '--';

            // 明细卡片按数据源区分：UAPI 不提供阵风 / 降雪 / 晴空紫外线，
            // 但额外给出风力等级与空气质量
            const cards = [
                this._infoCard('droplet', '湿度', humidity),
                this._infoCard('wind', '风速', current.wind_speed_10m, 'km/h'),
                isUapi
                    ? this._infoCard('wind', '风力', current.uapiWindPower)
                    : this._infoCard('wind', '阵风', current.wind_gusts_10m, 'km/h'),
                this._infoCard('location', '风向', this._windDirText(current.wind_direction_10m)),
                this._infoCard('rain', '降雨', current.rain, 'mm')
            ];
            if (isUapi) {
                if (data.uapi && data.uapi.aqi != null) {
                    cards.push(this._infoCard('cloud', '空气质量', data.uapi.aqi, data.uapi.aqiCategory));
                }
                cards.push(this._infoCard('sun', '紫外线', uvMax));
            } else {
                cards.push(this._infoCard('snowflake', '降雪', current.snowfall, 'cm'));
                cards.push(this._infoCard('sun', '紫外线', uvMax, `晴空 ${uvClear}`));
            }
            cards.push(this._infoCard('sunrise', '日出', sunrise));
            cards.push(this._infoCard('sunset', '日落', sunset));

            const mainInfo = document.getElementById('weatherMainInfo');
            if (mainInfo) {
                mainInfo.innerHTML = `
                    <div class="weather-hero">
                        <div class="weather-hero-primary">
                            <div class="weather-hero-icon">${App.Utils.svg(info.icon)}</div>
                            <div class="weather-hero-tempwrap">
                                <div class="weather-hero-temp">${temp}<span class="unit">°</span></div>
                                <div class="weather-hero-desc">${desc}</div>
                            </div>
                        </div>
                        <div class="weather-hero-meta">
                            <div class="weather-hero-city">${App.Utils.svg('location')}<span>${cityLabel}</span></div>
                            <div class="weather-hero-stats">
                                <div class="hero-stat"><span class="hero-stat-label">最高</span><span class="hero-stat-value">${maxTemp}°</span></div>
                                <div class="hero-stat"><span class="hero-stat-label">最低</span><span class="hero-stat-value">${minTemp}°</span></div>
                                <div class="hero-stat"><span class="hero-stat-label">体感</span><span class="hero-stat-value">${feel}°</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="weather-details">
                        ${cards.join('')}
                    </div>
                `;
            }

            // 生活指数（仅 UAPI 提供，共 18 项）
            this._renderLifeIndices(isUapi && data.uapi ? data.uapi.lifeIndices : null);

            this.drawWeatherChart(data);
        },

        /** 渲染生活指数网格（仅 UAPI 有；无数据时隐藏整块） */
        _renderLifeIndices(list) {
            const box = document.getElementById('weatherLifeIndices');
            if (!box) return;
            if (!Array.isArray(list) || list.length === 0) {
                box.innerHTML = '';
                box.hidden = true;
                return;
            }
            box.hidden = false;
            const items = list.map(it => {
                const title = [it.brief, it.advice].filter(Boolean).join(' · ');
                return `<div class="weather-life-item"${title ? ` title="${App.Utils.escapeHtml(title)}"` : ''}>
                    <span class="weather-life-name">${App.Utils.escapeHtml(it.name)}</span>
                    <span class="weather-life-level">${App.Utils.escapeHtml(it.level)}</span>
                </div>`;
            }).join('');
            box.innerHTML = `
                <div class="weather-section-title">${App.Utils.svg('sun')}生活指数</div>
                <div class="weather-life-grid">${items}</div>
            `;
        },

        /** 生成一张天气详情卡片（空值统一显示为 --） */
        _infoCard(icon, label, value, sub = '') {
            const safe = (value === null || value === undefined || value === '') ? '--' : value;
            return `<div class="weather-detail-card">
                <div class="weather-detail-head">${App.Utils.svg(icon)}<span>${label}</span></div>
                <div class="weather-detail-value">${safe}${sub ? `<span class="weather-detail-unit">${sub}</span>` : ''}</div>
            </div>`;
        },

        /** 风向：角度（Open-Meteo）转中文方位；UAPI 直接给文本风向则原样返回 */
        _windDirText(deg) {
            if (typeof deg === 'string') return deg.trim() || '--';
            if (deg === null || deg === undefined || isNaN(deg)) return '--';
            const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
            const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
            return `${dirs[idx]} ${Math.round(deg)}°`;
        },

        // ==================== 图表绘制 ====================
        drawWeatherChart(weatherData) {
            if (!this.chartCanvas || !this.chartContainer) return;
            const ctx = this.chartCanvas.getContext('2d', { willReadFrequently: true });
            const containerWidth = this.chartContainer.clientWidth;
            const chartHeight = 240;
            const dpr = window.devicePixelRatio || 1;

            this.chartCanvas.width = containerWidth * dpr;
            this.chartCanvas.height = chartHeight * dpr;
            this.chartCanvas.style.width = containerWidth + 'px';
            this.chartCanvas.style.height = chartHeight + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const hourly = weatherData.hourly;
            const times = hourly.time;
            const temps = hourly.temperature_2m;
            const precips = hourly.precipitation;
            const feels = hourly.apparent_temperature;
            const codes = hourly.weather_code;
            const snowfalls = hourly.snowfall || []; // 新增降雪数据

            const now = new Date();
            const startIdx = times.findIndex(t => new Date(t) >= now);
            const start = startIdx >= 0 ? startIdx : 0;
            const end = Math.min(start + 48, times.length);
            const sliceTimes = times.slice(start, end);
            let sliceTemps = temps.slice(start, end);
            let slicePrecips = precips.slice(start, end);
            let sliceFeels = feels.slice(start, end);
            const sliceCodes = codes.slice(start, end);
            let sliceSnowfalls = snowfalls.slice(start, end); // 降雪

            // 填充空值
            for (let i = 0; i < sliceTemps.length; i++) {
                if (sliceTemps[i] === null) sliceTemps[i] = i > 0 ? sliceTemps[i - 1] : (i + 1 < sliceTemps.length ? sliceTemps[i + 1] : 0);
                if (sliceFeels[i] === null) sliceFeels[i] = i > 0 ? sliceFeels[i - 1] : (i + 1 < sliceFeels.length ? sliceFeels[i + 1] : 0);
                if (slicePrecips[i] === null) slicePrecips[i] = 0;
                if (sliceSnowfalls[i] === null) sliceSnowfalls[i] = 0; // 填充
            }

            const colors = this.getThemeColors();
            const padding = { top: 30, right: 20, bottom: 55, left: 55 };
            const chartW = containerWidth - padding.left - padding.right;
            const chartH = chartHeight - padding.top - padding.bottom;

            const tempMin = Math.min(...sliceTemps, ...sliceFeels);
            const tempMax = Math.max(...sliceTemps, ...sliceFeels);
            const tempRange = tempMax - tempMin || 1;
            const precipMax = Math.max(...slicePrecips, 0.1);
            const snowMax = Math.max(...sliceSnowfalls, 0.1);

            ctx.clearRect(0, 0, containerWidth, chartHeight);
            ctx.fillStyle = colors.bgColor;
            ctx.fillRect(0, 0, containerWidth, chartHeight);

            // 网格
            ctx.strokeStyle = colors.gridColor; ctx.lineWidth = 0.5;
            for (let i = 0; i <= 5; i++) {
                const y = padding.top + (chartH / 5) * i;
                ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(containerWidth - padding.right, y); ctx.stroke();
            }

            // Y轴温度标尺
            ctx.fillStyle = colors.textColor; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
            for (let i = 0; i <= 5; i++) {
                const val = tempMin + (tempRange / 5) * i;
                const y = padding.top + chartH - (i * (chartH / 5));
                ctx.fillText(Math.round(val) + '°', padding.left - 8, y + 4);
            }

            // 降水柱状图（蓝色半透明）
            ctx.fillStyle = colors.precipColor;
            slicePrecips.forEach((p, idx) => {
                if (p === 0) return;
                const x = padding.left + (idx / (sliceTemps.length - 1)) * chartW;
                const barWidth = chartW / sliceTemps.length * 0.8;
                const barHeight = (p / precipMax) * (chartH * 0.6);
                ctx.fillRect(x - barWidth / 2, padding.top + chartH - barHeight, barWidth, barHeight);
            });

            // 降雪柱状图（白色半透明，叠加在降水柱上）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // 半透明白色
            sliceSnowfalls.forEach((s, idx) => {
                if (s === 0) return;
                const x = padding.left + (idx / (sliceTemps.length - 1)) * chartW;
                const barWidth = chartW / sliceTemps.length * 0.7; // 稍窄，避免完全遮盖
                const barHeight = (s / snowMax) * (chartH * 0.5); // 降雪高度上限略低
                ctx.fillRect(x - barWidth / 2, padding.top + chartH - barHeight, barWidth, barHeight);
            });

            // 温度折线
            ctx.beginPath(); ctx.strokeStyle = colors.tempColor; ctx.lineWidth = 2;
            sliceTemps.forEach((t, idx) => {
                const x = padding.left + (idx / (sliceTemps.length - 1)) * chartW;
                const y = padding.top + chartH - ((t - tempMin) / tempRange) * chartH;
                if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }); ctx.stroke();

            // 体感温度虚线
            ctx.beginPath(); ctx.strokeStyle = colors.feelColor; ctx.lineWidth = 1.8; ctx.setLineDash([4, 3]);
            sliceFeels.forEach((f, idx) => {
                const x = padding.left + (idx / (sliceFeels.length - 1)) * chartW;
                const y = padding.top + chartH - ((f - tempMin) / tempRange) * chartH;
                if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }); ctx.stroke(); ctx.setLineDash([]);

            // X轴时间标签与天气图标
            ctx.fillStyle = colors.textColor;
            for (let i = 0; i < sliceTimes.length; i += 4) {
                const x = padding.left + (i / (sliceTimes.length - 1)) * chartW;
                const time = new Date(sliceTimes[i]);
                const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(timeStr, x, padding.top + chartH + 16);
                const code = sliceCodes[i] || 0; const info = this.getWeatherInfo(code);
                const iconImg = this.weatherIcons[info.icon];
                if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
                    ctx.drawImage(iconImg, x - 9, padding.top + chartH + 34 - 9, 18, 18);
                } else {
                    ctx.font = '15px sans-serif'; ctx.fillText('?', x, padding.top + chartH + 34);
                }
            }

            const imageData = ctx.getImageData(0, 0, this.chartCanvas.width, this.chartCanvas.height);
            this.chartCanvas._weatherData = {
                imageData, times: sliceTimes, temps: sliceTemps, precip: slicePrecips,
                feels: sliceFeels, codes: sliceCodes, snowfalls: sliceSnowfalls, // 保存降雪
                padding, chartW, chartH, tempMin, tempRange, colors,
                pointsCount: sliceTemps.length, dpr, containerWidth,
                precipMax, snowMax // 保存最大值便于可能使用
            };

            if (!this.chartCanvas._eventsBound) {
                this.chartCanvas._eventsBound = true;
                this.chartCanvas.addEventListener('mousemove', (e) => this._onChartMouseMove(e));
                this.chartCanvas.addEventListener('mouseleave', () => this._onChartMouseLeave());
            }
        },

        _onChartMouseMove(e) {
            const canvas = this.chartCanvas;
            if (!canvas || !canvas._weatherData) return;
            const data = canvas._weatherData;
            if (!data.imageData) return;

            const container = this.chartContainer;
            const currentWidth = container.clientWidth;
            if (currentWidth !== data.containerWidth) {
                if (this.currentWeatherData) this.drawWeatherChart(this.currentWeatherData);
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const relativeX = mouseX - data.padding.left;
            const ratio = Math.max(0, Math.min(1, relativeX / data.chartW));
            const idx = Math.round(ratio * (data.pointsCount - 1));
            if (idx < 0 || idx >= data.times.length) {
                if (this.chartTooltip) this.chartTooltip.style.display = 'none';
                return;
            }

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.putImageData(data.imageData, 0, 0);
            ctx.setTransform(data.dpr, 0, 0, data.dpr, 0, 0);

            const x = data.padding.left + (idx / (data.pointsCount - 1)) * data.chartW;
            const yTemp = data.padding.top + data.chartH - ((data.temps[idx] - data.tempMin) / data.tempRange) * data.chartH;

            // 垂直指示线
            ctx.beginPath();
            ctx.strokeStyle = data.colors.indicatorColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(x, data.padding.top);
            ctx.lineTo(x, data.padding.top + data.chartH);
            ctx.stroke();
            ctx.setLineDash([]);

            // 高亮点
            ctx.beginPath();
            ctx.arc(x, yTemp, 4, 0, Math.PI * 2);
            ctx.fillStyle = data.colors.tempColor;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Tooltip
            if (!this.chartTooltip) return;
            const t = new Date(data.times[idx]);
            const timeStr = t.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
            const temp = data.temps[idx] ?? '--';
            const feel = data.feels[idx] ?? '--';
            const precip = data.precip[idx] ?? 0;
            const code = data.codes[idx] || 0;
            const weather = this.getWeatherInfo(code);
            const snowfall = data.snowfalls ? data.snowfalls[idx] ?? 0 : 0;
            this.chartTooltip.innerHTML = `
    <div>${App.Utils.svg('clock')}${timeStr}</div>
    <div>${App.Utils.svg('thermometer')}温度 ${temp}°C (体感 ${feel}°C)</div>
    <div>${App.Utils.svg('droplet')}降水 ${precip} mm</div>
    <div>${App.Utils.svg('snowflake')}降雪 ${snowfall} cm</div>
    <div>${App.Utils.svg(weather.icon)} ${weather.desc}</div>
`;

            const containerRect = container.getBoundingClientRect();
            const tooltipWidth = this.chartTooltip.offsetWidth;
            let tooltipX = e.clientX - containerRect.left + 12;
            let tooltipY = e.clientY - containerRect.top - 30;
            if (tooltipX + tooltipWidth > containerRect.width) {
                tooltipX = e.clientX - containerRect.left - tooltipWidth - 12;
            }
            if (tooltipY < 0) {
                tooltipY = e.clientY - containerRect.top + 20;
            }
            this.chartTooltip.style.left = tooltipX + 'px';
            this.chartTooltip.style.top = tooltipY + 'px';
            this.chartTooltip.style.display = 'block';
        },

        _onChartMouseLeave() {
            const canvas = this.chartCanvas;
            if (!canvas || !canvas._weatherData) return;
            const data = canvas._weatherData;
            if (data.imageData) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.putImageData(data.imageData, 0, 0);
            }
            if (this.chartTooltip) this.chartTooltip.style.display = 'none';
        },

        // ==================== 特效代码（保持不变） ====================
        _initEffectCanvas() {
            if (!this.effectCanvas) return;
            this.effectCanvas.width = window.innerWidth;
            this.effectCanvas.height = window.innerHeight;
        },

        _onResizeEffect() {
            if (this.effectCanvas) {
                this.effectCanvas.width = window.innerWidth;
                this.effectCanvas.height = window.innerHeight;
            }
            if (this.currentEffectType && this.currentEffectIntensity > 0 && window.App.state.weatherEffectEnabled) {
                this.startEffect(this.currentEffectType, this.currentEffectIntensity);
            }
        },

        startEffect(type, intensity) {
            if (!this.effectCanvas || !window.App.state.weatherEffectEnabled || intensity <= 0) {
                this.stopEffect();
                return;
            }
            this.currentEffectType = type;
            this.currentEffectIntensity = intensity;

            this.particles = [];
            const count = Math.floor(intensity * 12);
            const canvasWidth = this.effectCanvas.width;
            const canvasHeight = this.effectCanvas.height;

            for (let i = 0; i < count; i++) {
                if (type === 'rain') {
                    this.particles.push({
                        type: 'rain',
                        x: Math.random() * canvasWidth,
                        y: Math.random() * -canvasHeight,
                        length: Math.random() * 10 + 5 * (intensity / 5),
                        speed: Math.random() * 8 + 5 * (intensity / 3),
                        opacity: Math.random() * 0.35 + 0.55
                    });
                } else { // snow
                    this.particles.push({
                        type: 'snow',
                        x: Math.random() * canvasWidth,
                        y: Math.random() * -canvasHeight,
                        radius: Math.random() * 3 + 1,
                        speed: Math.random() * 1.5 + 0.5,
                        swing: Math.random() * 2 - 1,
                        swingSpeed: Math.random() * 0.02,
                        opacity: Math.random() * 0.5 + 0.3
                    });
                }
            }

            if (this.animFrameId) return;

            const animate = () => {
                if (!window.App.state.weatherEffectEnabled || !this.currentEffectType || this.currentEffectIntensity <= 0) {
                    this.stopEffect();
                    return;
                }
                this._drawEffectFrame();
                this.animFrameId = requestAnimationFrame(animate);
            };
            animate();
        },

        stopEffect() {
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
            if (this.effectCtx && this.effectCanvas) {
                this.effectCtx.clearRect(0, 0, this.effectCanvas.width, this.effectCanvas.height);
            }
            this.particles = [];
            this.currentEffectType = null;
            this.currentEffectIntensity = 0;
        },

        _drawEffectFrame() {
            if (!this.effectCtx || !this.effectCanvas) return;
            const ctx = this.effectCtx;
            const canvasWidth = this.effectCanvas.width;
            const canvasHeight = this.effectCanvas.height;
            const type = this.currentEffectType;

            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            this.particles.forEach(p => {
                if (type === 'rain') {
                    // 雨效颜色按主题区分（暗色/亮色），默认天蓝，可在设置中修改
                    const hex = this.isDarkTheme ? this.rainColors.dark : this.rainColors.light;
                    const rgb = this._hexToRgb(hex) || (this.isDarkTheme ? '135,206,235' : '42,143,212');
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - 1, p.y + p.length);
                    ctx.strokeStyle = 'rgba(' + rgb + ',' + (p.opacity * this.effectOpacity) + ')';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    p.y += p.speed;
                    if (p.y > canvasHeight) {
                        p.y = -10;
                        p.x = Math.random() * canvasWidth;
                    }
                } else if (type === 'snow') {
                    const color = 'rgba(255,255,255,' + (p.opacity * this.effectOpacity) + ')';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    p.y += p.speed;
                    p.x += p.swing;
                    p.swing += p.swingSpeed;
                    if (p.y > canvasHeight + 5) {
                        p.y = -5;
                        p.x = Math.random() * canvasWidth;
                    }
                    if (p.x < 0) p.x = canvasWidth;
                    if (p.x > canvasWidth) p.x = 0;
                }
            });
        },

        handleEffectToggle(enabled) {
            window.App.state.weatherEffectEnabled = enabled;
            if (!enabled) {
                this.stopEffect();
            } else if (this.currentEffectType && this.currentEffectIntensity > 0) {
                this.startEffect(this.currentEffectType, this.currentEffectIntensity);
            }
        },

        /** 设置雨/雪效透明度（0–1，实时按帧生效） */
        setOpacity(value) {
            const v = parseFloat(value);
            this.effectOpacity = isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
            window.App.state.rainOpacity = this.effectOpacity;
        },

        /** 设置雨效颜色（按主题，实时按帧生效） */
        setRainColors(colors) {
            if (!colors) return;
            this.rainColors = {
                dark: colors.dark || this.rainColors.dark,
                light: colors.light || this.rainColors.light
            };
            window.App.state.rainColors = this.rainColors;
        },

        /** 将 #rgb / #rrggbb 转为 "r,g,b" 字符串，供 rgba() 拼装 */
        _hexToRgb(hex) {
            if (!hex) return null;
            let h = String(hex).trim().replace(/^#/, '');
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
            const num = parseInt(h, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255].join(',');
        },

        // ==================== 事件绑定 ====================
        _bindEvents() {
            this.fabBtn?.addEventListener('click', async () => {
                if (!this.overlay) return;
                this.overlay.classList.add('open');
                await this.renderWeatherDetail();
            });
            const closeWeatherBtn = document.getElementById('closeWeatherBtn');
            closeWeatherBtn?.addEventListener('click', () => this.overlay?.classList.remove('open'));
            if (this.refreshBtn) this.refreshBtn.addEventListener('click', () => this.forceRefreshWeather());
            this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.overlay.classList.remove('open'); });
            window.addEventListener('resize', () => {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => {
                    if (this.overlay?.classList.contains('open') && this.currentWeatherData) {
                        this.drawWeatherChart(this.currentWeatherData);
                    }
                }, 150);
                this._onResizeEffect();
            });
        }
    };

    window.App.Weather = Weather;
})();