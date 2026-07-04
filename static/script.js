document.addEventListener('DOMContentLoaded', () => {
    // Инициализация AOS
    AOS.init({ duration: 800, easing: 'ease-in-out', once: true });

    // ===== ЛОГИКА СВЕТЛОЙ/ТЕМНОЙ ТЕМЫ =====
    const themeBtn = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    function updateThemeIcon(theme) {
        const icon = themeBtn.querySelector('i');
        if (theme === 'light') {
            icon.className = 'fas fa-moon';
        } else {
            icon.className = 'fas fa-sun';
        }
    }

    themeBtn.addEventListener('click', () => {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    // ===== ОСТАЛЬНОЙ КОД (ПОГОДА, КАРТА, ИЗБРАННОЕ) =====
    const cityInput = document.getElementById('cityInput');
    const searchBtn = document.getElementById('searchBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const cityName = document.getElementById('cityName');
    const dateEl = document.getElementById('date');
    const weatherIcon = document.getElementById('weatherIcon');
    const temp = document.getElementById('temp');
    const desc = document.getElementById('desc');
    const feelsLike = document.getElementById('feelsLike');
    const humidity = document.getElementById('humidity');
    const wind = document.getElementById('wind');
    const pressure = document.getElementById('pressure');
    const sunriseEl = document.getElementById('sunrise');
    const sunsetEl = document.getElementById('sunset');
    const clothingAdvice = document.getElementById('clothingAdvice');
    const forecastContainer = document.getElementById('forecastContainer');
    const historyContainer = document.getElementById('historyContainer');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const favoritesList = document.getElementById('favoritesList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    let chartInstance = null;
    let currentCity = '';

    // === Карта ===
    function updateMap(lat, lon) {
        const mapFrame = document.getElementById('osmMap');
        if (!mapFrame) return;
        const delta = 0.02;
        const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
        const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
        mapFrame.src = url;
    }

    // === Избранное ===
    function loadFavorites() { try { return JSON.parse(localStorage.getItem('favorites')) || []; } catch { return []; } }
    function saveFavorites(favorites) { localStorage.setItem('favorites', JSON.stringify(favorites)); }
    function isFavorite(city) { return loadFavorites().includes(city); }
    function toggleFavorite(city) {
        let favs = loadFavorites();
        if (favs.includes(city)) { favs = favs.filter(c => c !== city); } else { favs.push(city); }
        saveFavorites(favs);
        updateFavoriteUI(city);
        renderFavorites();
    }
    function updateFavoriteUI(city) {
        if (city === currentCity) {
            const isFav = isFavorite(city);
            favoriteBtn.innerHTML = isFav ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
            favoriteBtn.classList.toggle('active', isFav);
        }
    }
    function renderFavorites() {
        const favs = loadFavorites();
        if (favs.length === 0) {
            favoritesList.innerHTML = '<span style="color:var(--text-secondary); font-size:0.9rem;">Добавьте город в избранное</span>';
            return;
        }
        favoritesList.innerHTML = favs.map(city => `
            <button class="fav-city-btn" data-city="${city}">
                ${city}
                <span class="remove-fav" data-city="${city}">&times;</span>
            </button>
        `).join('');

        favoritesList.querySelectorAll('.fav-city-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-fav')) {
                    const city = e.target.dataset.city;
                    let favs = loadFavorites();
                    favs = favs.filter(c => c !== city);
                    saveFavorites(favs);
                    renderFavorites();
                    if (city === currentCity) updateFavoriteUI(city);
                    return;
                }
                const city = btn.dataset.city;
                cityInput.value = city;
                saveCity(city);
                fetchWeather(city);
            });
        });
    }

    // === Сохранение/загрузка города ===
    function saveCity(city) { localStorage.setItem('lastCity', city); }
    function loadCity() { return localStorage.getItem('lastCity') || 'Москва'; }

    // === Иконки ===
    function setWeatherIcon(iconCode, element) {
        const iconMap = {
            '01d': 'fa-sun', '01n': 'fa-moon',
            '02d': 'fa-cloud-sun', '02n': 'fa-cloud-moon',
            '03d': 'fa-cloud', '03n': 'fa-cloud',
            '04d': 'fa-cloud', '04n': 'fa-cloud',
            '09d': 'fa-cloud-rain', '09n': 'fa-cloud-rain',
            '10d': 'fa-cloud-sun-rain', '10n': 'fa-cloud-moon-rain',
            '11d': 'fa-cloud-bolt', '11n': 'fa-cloud-bolt',
            '13d': 'fa-snowflake', '13n': 'fa-snowflake',
            '50d': 'fa-smog', '50n': 'fa-smog'
        };
        const iconClass = iconMap[iconCode] || 'fa-sun';
        element.className = `fas ${iconClass}`;
        element.style.color = (iconCode && iconCode.includes('n')) ? '#c0c0c0' : '#ffd93d';
    }

    // === Совет по одежде ===
    function getClothingAdvice(temp, description) {
        const desc = description.toLowerCase();
        if (temp < -10) return 'Шуба, шапка, варежки!';
        if (temp < 0) return 'Зимняя куртка и перчатки.';
        if (temp < 10) return 'Лёгкая куртка или ветровка.';
        if (temp < 20) return 'Футболка и кофта.';
        if (temp < 30) return 'Майка и шорты.';
        if (temp >= 30) return 'Жарко! Головной убор обязателен.';
        if (desc.includes('дождь')) return 'Возьмите зонт!';
        return 'Одевайтесь по погоде.';
    }

    // === График ===
    function buildChart(labels, temps) {
        const ctx = document.getElementById('tempChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Температура (°C)',
                    data: temps,
                    borderColor: '#8B5CF6',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#D946EF',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: Math.min(...temps)-2, max: Math.max(...temps)+2, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#94A3B8', callback: v => v + '°C' } },
                    x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }

    // === Основной запрос ===
    function fetchWeather(city) {
        currentCity = city;
        fetch(`/api/weather?city=${encodeURIComponent(city)}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) { alert('Город не найден'); return; }
                cityName.textContent = data.city;
                dateEl.textContent = new Date(data.timestamp).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                setWeatherIcon(data.icon, weatherIcon);
                temp.textContent = `${Math.round(data.temp)}°C`;
                desc.textContent = data.description;
                feelsLike.textContent = `Ощущается как: ${Math.round(data.feels_like)}°C`;
                humidity.textContent = data.humidity;
                wind.textContent = data.wind_speed;
                pressure.textContent = data.pressure;
                if (data.sunrise) {
                    const sr = new Date(data.sunrise * 1000);
                    const ss = new Date(data.sunset * 1000);
                    sunriseEl.textContent = sr.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    sunsetEl.textContent = ss.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                }
                clothingAdvice.textContent = getClothingAdvice(data.temp, data.description);
                updateFavoriteUI(city);
                if (data.coord) { updateMap(data.coord.lat, data.coord.lon); }
            })
            .catch(err => console.error('Weather error:', err));

        fetch(`/api/forecast?city=${encodeURIComponent(city)}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length) {
                    const grouped = {};
                    data.forEach(item => {
                        const date = item.dt.split(' ')[0];
                        if (!grouped[date]) grouped[date] = { temps: [], desc: item.description, icon: item.icon };
                        grouped[date].temps.push(item.temp);
                    });
                    const daily = Object.keys(grouped).map(date => {
                        const temps = grouped[date].temps;
                        const avg = temps.reduce((a,b) => a+b, 0) / temps.length;
                        return { date, avg, desc: grouped[date].desc, icon: grouped[date].icon };
                    }).slice(0,5);

                    forecastContainer.innerHTML = daily.map(day => {
                        const isNight = day.icon && day.icon.includes('n');
                        const iconClass = isNight ? 'fa-moon' : 'fa-sun';
                        const iconColor = isNight ? '#c0c0c0' : '#ffd93d';
                        return `
                            <div class="forecast-card">
                                <div class="day">${new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                                <i class="fas ${iconClass} forecast-icon" style="color: ${iconColor};"></i>
                                <div class="forecast-temp">${Math.round(day.avg)}°C</div>
                                <div class="forecast-desc">${day.desc}</div>
                            </div>
                        `;
                    }).join('');

                    const labels = daily.map(d => new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
                    const temps = daily.map(d => Math.round(d.avg));
                    buildChart(labels, temps);
                } else {
                    forecastContainer.innerHTML = '<p style="color:var(--text-secondary);">Прогноз недоступен</p>';
                }
            })
            .catch(err => console.error('Forecast error:', err));

        fetch('/api/history')
            .then(res => res.json())
            .then(data => {
                if (data && data.length) {
                    let table = `<table><thead><tr><th>Город</th><th>Температура</th><th>Ощущается</th><th>Влажность</th><th>Дата</th></tr></thead><tbody>`;
                    data.slice().reverse().forEach(row => {
                        table += `<tr>
                            <td>${row['Город']}</td>
                            <td>${row['Температура']}°C</td>
                            <td>${row['Ощущается']}°C</td>
                            <td>${row['Влажность']}%</td>
                            <td>${row['Дата']}</td>
                        </tr>`;
                    });
                    table += '</tbody></table>';
                    historyContainer.innerHTML = table;
                } else {
                    historyContainer.innerHTML = '<p style="color:var(--text-secondary);">История пуста</p>';
                }
            })
            .catch(err => console.error('History error:', err));
    }

    // === Обработчики ===
    function handleCitySubmit() {
        const city = cityInput.value.trim();
        if (city) { saveCity(city); fetchWeather(city); }
    }

    searchBtn.addEventListener('click', handleCitySubmit);
    cityInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleCitySubmit(); });
    refreshBtn.addEventListener('click', () => {
        const city = cityInput.value.trim() || loadCity();
        if (city) { cityInput.value = city; saveCity(city); fetchWeather(city); }
    });
    favoriteBtn.addEventListener('click', () => { if (currentCity) toggleFavorite(currentCity); });
    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('Удалить всю историю?')) {
            try {
                const res = await fetch('/api/history/clear', { method: 'POST' });
                if (res.ok) fetchWeather(currentCity);
            } catch(e) { console.error(e); }
        }
    });

    // === Загрузка при старте ===
    const savedCity = loadCity();
    cityInput.value = savedCity;
    renderFavorites();
    fetchWeather(savedCity);
});
