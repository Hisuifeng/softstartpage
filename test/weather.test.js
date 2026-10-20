/**
 * weather.test.js — 天气图表时区换算（M11）与轮询健壮性（M12）
 */
const test = require('node:test');
const assert = require('node:assert');
const { loadScript } = require('./helpers');

function boot() {
    const sandbox = loadScript('js/utils.js');
    loadScript('js/weather.js', { sandbox });
    return sandbox;
}

test('_wallClockToMs 按 UTC 解析当地墙钟串', () => {
    const WC = boot().App.Weather;
    assert.strictEqual(WC._wallClockToMs('2026-10-20T14:00'), Date.UTC(2026, 9, 20, 14));
    assert.strictEqual(WC._wallClockToMs('2026-10-20 14:30:00'), Date.UTC(2026, 9, 20, 14, 30));
    assert.ok(Number.isNaN(WC._wallClockToMs('')));
    assert.ok(Number.isNaN(WC._wallClockToMs(null)));
});

test('_fmtWallClock 本地直显与非法输入', () => {
    const WC = boot().App.Weather;
    assert.strictEqual(WC._fmtWallClock('2026-10-20T14:05'), '14:05');
    assert.strictEqual(WC._fmtWallClock('2026-10-20T14:05', true), '10月20日 14:05');
    assert.strictEqual(WC._fmtWallClock('bad'), '');
});

test('_locOffsetSec 缺失回退 0，存在则使用', () => {
    const WC = boot().App.Weather;
    assert.strictEqual(WC._locOffsetSec({}), 0);
    assert.strictEqual(WC._locOffsetSec(null), 0);
    assert.strictEqual(WC._locOffsetSec({ utc_offset_seconds: 28800 }), 28800);
});

test('_normalizeUapi 补 utc_offset_seconds=UTC+8 且墙钟串用 T 分隔', () => {
    const WC = boot().App.Weather;
    const data = WC._normalizeUapi({
        temperature: 20, weather: '晴',
        hourly_forecast: [{ time: '2026-10-20 14:00', temperature: 20, precip: 0, weather: '晴', feels_like: 20 }],
        forecast: [{ date: '2026-10-20', temp_max: 25, temp_min: 15 }]
    });
    assert.ok(data);
    assert.strictEqual(data.utc_offset_seconds, 8 * 3600);
    assert.strictEqual(data.hourly.time[0], '2026-10-20T14:00');
});

test('fetchWeather single-flight：并发共享同一请求', async () => {
    const sandbox = boot();
    const WC = sandbox.App.Weather;
    let calls = 0;
    WC._getWeatherUapi = async () => {
        calls++;
        await new Promise(r => setTimeout(r, 20));
        return { current: { temperature_2m: 20 } };
    };
    const [a, b] = await Promise.all([WC.fetchWeather(), WC.fetchWeather()]);
    assert.strictEqual(calls, 1);
    assert.strictEqual(a, b);
});

test('updateWeatherFab 丢弃被新请求取代的过期响应', async () => {
    const sandbox = boot();
    const WC = sandbox.App.Weather;
    const resolvers = [];
    WC.fetchWeather = () => new Promise(r => resolvers.push(r));
    WC._applyEffectByCode = () => {};
    const p1 = WC.updateWeatherFab();
    const p2 = WC.updateWeatherFab();
    const dataB = { current: { weather_code: 0, temperature_2m: 10 } };
    resolvers[1](dataB);
    assert.strictEqual(await p2, dataB);
    assert.strictEqual(WC.currentWeatherData, dataB);
    const dataA = { current: { weather_code: 1, temperature_2m: 20 } };
    resolvers[0](dataA);
    assert.strictEqual(await p1, null);
    assert.strictEqual(WC.currentWeatherData, dataB);
});

test('silent 拉取失败不弹 toast，非静默正常提示', async () => {
    const sandbox = boot();
    const WC = sandbox.App.Weather;
    let toasts = 0;
    sandbox.App.Utils.showToast = () => { toasts++; };
    sandbox.fetch = async () => { throw new Error('net down'); };
    const silent = await WC.fetchWeather(false, true);
    assert.strictEqual(silent, null);
    assert.strictEqual(toasts, 0);
    const loud = await WC.fetchWeather(true);
    assert.strictEqual(loud, null);
    assert.strictEqual(toasts, 1);
});
