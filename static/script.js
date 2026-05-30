const APP = {
    unit: 'C',
    isDark: false,
    data: null,
    history: [],
    apiKey: null
};

// Load API key from backend immediately
fetch('/api/config')
    .then(res => res.json())
    .then(config => {
        APP.apiKey = config.api_key;
        console.log('✅ API Key Loaded:', APP.apiKey ? 'YES' : 'NO');
        // Initialize app after API key is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
    })
    .catch(err => {
        console.error('❌ Failed to load API key:', err);
        showError('Failed to load API key from server');
    });

function initApp() {
    loadTheme();
    loadHistory();
    attachAllListeners();
    
    if (APP.apiKey) {
        fetchWeather('London');
    } else {
        showError('⚠️ API key not available');
    }
}
const DOM = {
    search: () => document.getElementById('searchInput'),
    geoBtn: () => document.getElementById('geoBtn'),
    tempBtn: () => document.getElementById('tempBtn'),
    themeBtn: () => document.getElementById('themeBtn'),
    suggestions: () => document.getElementById('suggestionsBox'),
    history: () => document.getElementById('history'),
    loader: () => document.getElementById('loading'),
    error: () => document.getElementById('errorBox'),
    weather: () => document.getElementById('weatherSection'),
    cityName: () => document.getElementById('cityName'),
    dateTime: () => document.getElementById('dateTime'),
    temperature: () => document.getElementById('temperature'),
    description: () => document.getElementById('description'),
    weatherIcon: () => document.getElementById('weatherIcon'),
    sunrise: () => document.getElementById('sunrise'),
    sunset: () => document.getElementById('sunset'),
    aiMessage: () => document.getElementById('aiMessage'),
    metricsGrid: () => document.getElementById('metricsGrid'),
    hourly: () => document.getElementById('hourlyContainer'),
    forecast: () => document.getElementById('forecastGrid'),
    greeting: () => document.getElementById('greetingMsg'),
    body: () => document.body
};

const API = 'https://api.openweathermap.org/data/2.5';

// INIT
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌤️ Weather Dashboard Ready');
    loadSettings();
    attachListeners();
    
    const key = localStorage.getItem('api_key');
    if (key) {
        APP.apiKey = key;
        fetchWeather('London');
    } else {
        showError('⚠️ No API key set. Run: localStorage.setItem("api_key", "YOUR_KEY")');
    }
});

function attachListeners() {
    // TEMP TOGGLE
    DOM.tempBtn().addEventListener('click', () => {
        APP.unit = APP.unit === 'C' ? 'F' : 'C';
        DOM.tempBtn().textContent = APP.unit;
        localStorage.setItem('unit', APP.unit);
        if (APP.data) updateWeatherDisplay(APP.data);
    });

    // THEME TOGGLE
    DOM.themeBtn().addEventListener('click', () => {
        DOM.body().classList.toggle('dark-mode');
        APP.isDark = DOM.body().classList.contains('dark-mode');
        localStorage.setItem('isDark', APP.isDark);
        updateThemeIcon();
    });

    // GEO BUTTON
    DOM.geoBtn().addEventListener('click', getLocation);

    // SEARCH INPUT
    DOM.search().addEventListener('input', debounce(handleSearch, 300));
    DOM.search().addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = DOM.search().value.trim();
            if (query) {
                DOM.search().value = '';
                fetchWeather(query);
            }
        }
    });
}

function loadSettings() {
    APP.unit = localStorage.getItem('unit') || 'C';
    DOM.tempBtn().textContent = APP.unit;
    
    if (localStorage.getItem('isDark') === 'true') {
        DOM.body().classList.add('dark-mode');
        APP.isDark = true;
    }
    updateThemeIcon();
    
    APP.history = JSON.parse(localStorage.getItem('history') || '[]');
    renderHistory();
}

function updateThemeIcon() {
    const icon = DOM.themeBtn().querySelector('i');
    if (icon) {
        if (APP.isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

async function fetchWeather(city) {
    if (!APP.apiKey) {
        showError('❌ API key missing');
        return;
    }

    showLoader();
    hideError();

    try {
        const url = `${API}/weather?q=${encodeURIComponent(city)}&appid=${APP.apiKey}&units=metric`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error('City not found');
        
        const data = await res.json();
        APP.data = data;
        updateWeatherDisplay(data);
        addHistory(city);
        hideError();
        
        // Fetch forecast
        fetchForecast(data.coord.lat, data.coord.lon);
    } catch (e) {
        showError('❌ ' + e.message);
    } finally {
        hideLoader();
    }
}

function updateWeatherDisplay(d) {
    const now = new Date(d.dt * 1000);
    const temp = convertTemp(d.main.temp);
    const sunrise = new Date(d.sys.sunrise * 1000);
    const sunset = new Date(d.sys.sunset * 1000);

    // Basic info
    DOM.cityName().textContent = `${d.name}, ${d.sys.country}`;
    DOM.dateTime().textContent = formatDate(now);
    DOM.temperature().textContent = Math.round(temp) + '°';
    DOM.description().textContent = d.weather[0].description;
    DOM.weatherIcon().textContent = getIcon(d.weather[0].main);
    DOM.sunrise().textContent = formatTime(sunrise);
    DOM.sunset().textContent = formatTime(sunset);

    // Greeting
    updateGreeting(now);

    // AI Message
    generateAIMessage(d);

    // Metrics
    displayMetrics(d);

    // Theme
    applyTheme(d, now);

    DOM.weather().style.display = 'block';
}

async function fetchForecast(lat, lon) {
    try {
        const url = `${API}/forecast?lat=${lat}&lon=${lon}&appid=${APP.apiKey}&units=metric`;
        const res = await fetch(url);
        const data = await res.json();
        
        displayHourly(data.list.slice(0, 8));
        displayForecast(data.list);
    } catch (e) {
        console.error('Forecast error:', e);
    }
}

function displayHourly(list) {
    DOM.hourly().innerHTML = list.map(item => {
        const time = new Date(item.dt * 1000);
        const temp = convertTemp(item.main.temp);
        return `
            <div class="hourly-item">
                <p>${String(time.getHours()).padStart(2, '0')}:00</p>
                <div class="hourly-icon">${getIcon(item.weather[0].main)}</div>
                <p class="hourly-temp">${Math.round(temp)}°</p>
            </div>
        `;
    }).join('');
}

function displayForecast(list) {
    const daily = {};
    list.forEach(item => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!daily[date]) daily[date] = item;
    });

    DOM.forecast().innerHTML = Object.values(daily).slice(0, 5).map(item => {
        const date = new Date(item.dt * 1000);
        const high = convertTemp(item.main.temp_max);
        const low = convertTemp(item.main.temp_min);
        return `
            <div class="forecast-card">
                <div class="forecast-date">${date.toLocaleDateString('en-US', {month:'short', day:'numeric'})}</div>
                <div class="forecast-icon">${getIcon(item.weather[0].main)}</div>
                <div class="forecast-temps">
                    <span class="forecast-high">${Math.round(high)}°</span>
                    <span class="forecast-low">${Math.round(low)}°</span>
                </div>
                <div class="forecast-desc">${item.weather[0].description}</div>
            </div>
        `;
    }).join('');
}

function displayMetrics(d) {
    const temp = convertTemp(d.main.temp);
    const feels = convertTemp(d.main.feels_like);
    
    const metrics = [
        {icon: '💧', label: 'Humidity', value: `${d.main.humidity}%`},
        {icon: '💨', label: 'Wind', value: `${d.wind.speed.toFixed(1)} m/s`},
        {icon: '🔽', label: 'Pressure', value: `${d.main.pressure} hPa`},
        {icon: '👁️', label: 'Visibility', value: `${(d.visibility/1000).toFixed(1)} km`},
        {icon: '🌡️', label: 'Feels Like', value: `${Math.round(feels)}°`},
        {icon: '☁️', label: 'Clouds', value: `${d.clouds.all}%`},
        {icon: '🌊', label: 'Dew Point', value: `${Math.round(d.main.temp - ((100 - d.main.humidity) / 5))}°`},
        {icon: '🧭', label: 'Wind Dir', value: `${d.wind.deg}°`}
    ];

    DOM.metricsGrid().innerHTML = metrics.map(m => `
        <div class="metric-item">
            <div class="metric-icon">${m.icon}</div>
            <div class="metric-label">${m.label}</div>
            <div class="metric-value">${m.value}</div>
        </div>
    `).join('');
}

function generateAIMessage(d) {
    const messages = [];
    const wind = d.wind.speed;
    const humidity = d.main.humidity;
    const temp = d.main.temp;
    const desc = d.weather[0].main.toLowerCase();

    if (desc.includes('rain')) messages.push('☔ Rain expected. Carry an umbrella.');
    if (wind > 10) messages.push('💨 Strong winds. Secure loose items.');
    if (wind > 15) messages.push('🌪️ Very windy! Be cautious.');
    if (humidity > 85) messages.push('💧 High humidity. Stay hydrated.');
    if (temp < 0) messages.push('❄️ Freezing! Wear warm clothes.');
    if (temp > 30) messages.push('🔥 Very hot. Use sunscreen.');
    if (desc.includes('clear') || desc.includes('sunny')) messages.push('☀️ Perfect weather for outdoor activities!');
    if (desc.includes('snow')) messages.push('⛄ Snowing. Drive carefully.');
    if (desc.includes('thunder')) messages.push('⚡ Thunderstorm. Stay indoors.');

    DOM.aiMessage().textContent = messages[0] || '🌤️ Weather looks pleasant!';
}

function updateGreeting(date) {
    const hour = date.getHours();
    let greeting = '🌤️ Hello';
    
    if (hour < 12) greeting = '☀️ Good Morning';
    else if (hour < 17) greeting = '🌤️ Good Afternoon';
    else if (hour < 21) greeting = '🌅 Good Evening';
    else greeting = '🌙 Good Night';
    
    if (DOM.greeting()) DOM.greeting().textContent = greeting;
}

function applyTheme(d, now) {
    const hour = now.getHours();
    const desc = d.weather[0].main.toLowerCase();
    const isNight = hour < 6 || hour > 18;

    DOM.body().className = APP.isDark ? 'dark-mode' : '';

    if (isNight) {
        DOM.body().classList.add('night');
        createStars();
    } else if (desc.includes('thunder')) {
        DOM.body().classList.add('thunder');
        createRain();
    } else if (desc.includes('rain') || desc.includes('drizzle')) {
        DOM.body().classList.add('rainy');
        createRain();
    } else if (desc.includes('cloud')) {
        DOM.body().classList.add('cloudy');
    } else if (desc.includes('snow')) {
        DOM.body().classList.add('snow');
        createSnow();
    } else {
        DOM.body().classList.add('sunny');
    }
}

function createStars() {
    const container = document.getElementById('starsContainer');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.cssText = `left:${Math.random()*100}%; top:${Math.random()*50}%; width:${Math.random()*3}px; height:${Math.random()*3}px; animation-delay:${Math.random()*3}s`;
        container.appendChild(star);
    }
}

function createRain() {
    const container = document.getElementById('rainContainer');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const drop = document.createElement('div');
        drop.className = 'raindrop';
        drop.style.cssText = `left:${Math.random()*100}%; animation-delay:${Math.random()*0.5}s`;
        container.appendChild(drop);
    }
}

function createSnow() {
    const container = document.getElementById('snowContainer');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.textContent = '❄';
        flake.style.cssText = `left:${Math.random()*100}%; animation-delay:${Math.random()*10}s`;
        container.appendChild(flake);
    }
}

async function handleSearch(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
        DOM.suggestions().classList.remove('active');
        return;
    }

    try {
        const url = `${API}/find?q=${encodeURIComponent(query)}&appid=${APP.apiKey}&type=like&sort=population`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.list && data.list.length) {
            DOM.suggestions().innerHTML = data.list.slice(0, 5).map(city => `
                <div class="suggestion-item" onclick="selectCity('${city.name}')">${city.name}, ${city.sys.country}</div>
            `).join('');
            DOM.suggestions().classList.add('active');
        }
    } catch (e) {
        console.error('Search error:', e);
    }
}

function selectCity(name) {
    DOM.search().value = '';
    DOM.suggestions().classList.remove('active');
    fetchWeather(name);
}

function getLocation() {
    if (!navigator.geolocation) {
        showError('❌ Geolocation not supported');
        return;
    }

    showLoader();
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            try {
                const url = `${API}/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${APP.apiKey}&units=metric`;
                const res = await fetch(url);
                const data = await res.json();
                APP.data = data;
                updateWeatherDisplay(data);
                fetchForecast(data.coord.lat, data.coord.lon);
                hideError();
            } catch (e) {
                showError('❌ ' + e.message);
            } finally {
                hideLoader();
            }
        },
        () => {
            showError('❌ Location access denied');
            hideLoader();
        }
    );
}

// UTILITIES
function convertTemp(c) {
    return APP.unit === 'F' ? (c * 9/5) + 32 : c;
}

function getIcon(condition) {
    const c = condition.toLowerCase();
    const icons = {
        'clear': '☀️', 'sunny': '☀️', 'cloud': '☁️', 'cloudy': '☁️',
        'rain': '🌧️', 'rainy': '🌧️', 'drizzle': '🌦️', 'snow': '❄️',
        'thunder': '⛈️', 'thunderstorm': '⛈️', 'mist': '🌫️',
        'fog': '🌫️', 'dust': '🌪️', 'tornado': '🌪️'
    };
    return Object.keys(icons).find(k => c.includes(k)) ? icons[Object.keys(icons).find(k => c.includes(k))] : '🌤️';
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addHistory(city) {
    if (!APP.history.includes(city)) {
        APP.history.unshift(city);
        if (APP.history.length > 5) APP.history.pop();
        localStorage.setItem('history', JSON.stringify(APP.history));
        renderHistory();
    }
}

function renderHistory() {
    DOM.history().innerHTML = APP.history.map(city => 
        `<button class="history-btn" onclick="fetchWeather('${city}')">${city}</button>`
    ).join('');
}

function showLoader() { DOM.loader().style.display = 'block'; }
function hideLoader() { DOM.loader().style.display = 'none'; }
function showError(msg) { DOM.error().textContent = msg; DOM.error().style.display = 'block'; }
function hideError() { DOM.error().style.display = 'none'; }

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

console.log('%c✅ Dashboard Ready!', 'color: green; font-size: 14px;');
console.log('%cSet API Key: localStorage.setItem("api_key", "YOUR_KEY")', 'color: blue;');
