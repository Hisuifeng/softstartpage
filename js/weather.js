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

        currentEffectType: null, currentEffectIntensity: 0,
        effectCanvas: null, effectCtx: null,
        particles: [], animFrameId: null,
        // 天气图标缓存（Canvas 绘制用）
        weatherIcons: {},
        isDarkTheme: !window.matchMedia('(prefers-color-scheme: light)').matches,

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

            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
                this.isDarkTheme = !e.matches;
                if (this.currentEffectType && this.currentEffectIntensity > 0) {
                    this.startEffect(this.currentEffectType, this.currentEffectIntensity);
                }
            });

            const state = window.App.state;
            state.weatherEffectEnabled = options.weatherEffectEnabled !== undefined
                ? options.weatherEffectEnabled
                : App.Utils.load('sp_weather_effect', true);
            state.customLat = App.Utils.load('sp_custom_lat', null);
            state.customLon = App.Utils.load('sp_custom_lon', null);

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
                // 新 API 参数，移除 models=cma_grapes_global
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max,uv_index_clear_sky_max&hourly=temperature_2m,precipitation,weather_code,apparent_temperature,snowfall&current=temperature_2m,precipitation,weather_code,rain,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,snowfall&timezone=auto&models=cma_grapes_global`;
                const resp = await fetch(url);
                if (!resp.ok) throw new Error('天气获取失败');
                const data = await resp.json();
                App.Utils.save(cacheKey, { data, timestamp: Date.now() });
                return data;
            } catch (e) { console.error(e); App.Utils.showToast('天气数据获取失败'); return null; }
        },

        // ==================== 更新左下角按钮 ====================
        async updateWeatherFab() {
            const location = await this.getLocation();
            const weatherData = await this.getWeather(location.lat, location.lon);
            if (!weatherData || !weatherData.current) return;
            this.currentWeatherData = weatherData;

            const current = weatherData.current;
            const code = current.weather_code;
            const temp = Math.round(current.temperature_2m);
            const info = this.getWeatherInfo(code);

            if (this.fabIcon) this.fabIcon.innerHTML = App.Utils.svg(info.icon);
            if (this.fabText) this.fabText.textContent = `${info.desc} ${temp}°`;

            // 雨/雪效
            this._applyEffectByCode(code);
        },

        async forceRefreshWeather() {
            if (this.isRefreshing) return;
            this.isRefreshing = true;
            if (this.refreshBtn) {
                this.refreshBtn.style.opacity = '0.5';
                this.refreshBtn.style.pointerEvents = 'none';
            }
            try {
                const location = await this.getLocation(true);
                const weatherData = await this.getWeather(location.lat, location.lon, true);
                if (!weatherData || !weatherData.current) {
                    App.Utils.showToast('刷新失败，请稍后重试');
                    return;
                }
                this.currentWeatherData = weatherData;
                await this.updateWeatherFab();
                if (this.overlay?.classList.contains('open')) {
                    await this.renderWeatherDetail(weatherData, location);
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
            const loc = location || await this.getLocation();

            const current = data.current;
            const daily = data.daily;
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayIndex = daily.time.indexOf(todayStr);

            // 实时数据
            const temp = Math.round(current.temperature_2m);
            const feel = Math.round(current.apparent_temperature);
            const humidity = current.relative_humidity_2m + '%';
            const windSpeed = current.wind_speed_10m + ' km/h';
            const windGust = current.wind_gusts_10m + ' km/h';
            const windDir = current.wind_direction_10m + '°';
            const rain = current.rain + ' mm';
            const snowfall = current.snowfall + ' cm';
            const code = current.weather_code;
            const info = this.getWeatherInfo(code);

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

            const mainInfo = document.getElementById('weatherMainInfo');
            if (mainInfo) {
                mainInfo.innerHTML = `
                    <div class="info-item"><strong>城市：</strong>${loc.city} ${loc.country}</div>
                    <div class="info-item"><strong>天气：</strong>${App.Utils.svg(info.icon)} ${info.desc}</div>
                    <div class="info-item"><strong>温度：</strong>${temp}° (体感 ${feel}°)</div>
                    <div class="info-item"><strong>湿度：</strong>${humidity}</div>
                    <div class="info-item"><strong>降雨：</strong>${rain}</div>
                    <div class="info-item"><strong>降雪：</strong>${snowfall}</div>
                    <div class="info-item"><strong>风速：</strong>${windSpeed}</div>
                    <div class="info-item"><strong>阵风：</strong>${windGust}</div>
                    <div class="info-item"><strong>风向：</strong>${windDir}</div>
                    <div class="info-item"><strong>最高/最低：</strong>${maxTemp}° / ${minTemp}°</div>
                    <div class="info-item"><strong>紫外线：</strong>${uvMax} (晴空 ${uvClear})</div>
                    <div class="info-item"><strong>日出 - 日落：</strong>${sunrise} - ${sunset}</div>
                `;
            }

            this.drawWeatherChart(data);
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
                        opacity: Math.random() * 0.3 + 0.2
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
                    const color = this.isDarkTheme ? 'rgba(174,194,224,' : 'rgba(40,60,100,';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - 1, p.y + p.length);
                    ctx.strokeStyle = color + p.opacity + ')';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    p.y += p.speed;
                    if (p.y > canvasHeight) {
                        p.y = -10;
                        p.x = Math.random() * canvasWidth;
                    }
                } else if (type === 'snow') {
                    const color = 'rgba(255,255,255,' + p.opacity + ')';
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