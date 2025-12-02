const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
const YANDEX_MAPS_API_URL = 'https://api-maps.yandex.ru/2.1/';
const OPENWEATHER_KEY = '95b615ed131ed09445e9e078a2c6d44e';
const YANDEX_MAPS_KEY = 'db0526f0-22f9-471c-9e1b-65f064b8682c';

let coordsForm;
let widgetsContainer;
let yandexMapsLoaded = false;
let mapsInitializationQueue = [];

document.addEventListener('DOMContentLoaded', function() {
    coordsForm = document.getElementById('coords-form');
    widgetsContainer = document.getElementById('widgets-container');
    
    coordsForm.addEventListener('submit', function(event) {
        event.preventDefault();
        handleFormSubmit();
    });
    
    loadYandexMaps();
});

function loadYandexMaps() {
    if (window.ymaps) {
        yandexMapsLoaded = true;
        processMapQueue();
        return;
    }

    const script = document.createElement('script');
    script.src = `${YANDEX_MAPS_API_URL}?apikey=${YANDEX_MAPS_KEY}&lang=ru_RU`;
    script.onload = function() {
        ymaps.ready(function() {
            yandexMapsLoaded = true;
            processMapQueue();
        });
    };
    script.onerror = function() {
        console.error('Failed to load Yandex Maps API');
    };
    document.head.appendChild(script);
}

function processMapQueue() {
    while (mapsInitializationQueue.length > 0) {
        const { containerId, latitude, longitude, locationName } = mapsInitializationQueue.shift();
        initializeMap(containerId, latitude, longitude, locationName);
    }
}

function handleFormSubmit() {
    const latitude = document.getElementById('latitude').value.trim();
    const longitude = document.getElementById('longitude').value.trim();
    
    if (!isValidCoordinate(latitude, longitude)) {
        alert('Пожалуйста, введите корректные координаты.\nШирота: -90 до 90\nДолгота: -180 до 180');
        return;
    }
    
    createWeatherWidget(parseFloat(latitude), parseFloat(longitude));
    coordsForm.reset();
}

function isValidCoordinate(lat, lon) {
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);
    
    return !isNaN(numLat) && !isNaN(numLon) && 
           numLat >= -90 && numLat <= 90 && 
           numLon >= -180 && numLon <= 180;
}

async function createWeatherWidget(latitude, longitude) {
    const widgetId = 'widget-' + Date.now();
    const widgetElement = createWidgetElement(widgetId, latitude, longitude);
    
    widgetsContainer.appendChild(widgetElement);
    
    try {
        const weatherData = await fetchWeatherData(latitude, longitude);
        updateWeatherWidget(widgetId, weatherData, latitude, longitude);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showError(widgetId, 'Не удалось загрузить данные: ' + error.message);
    }
    
    setupRemoveButton(widgetElement, widgetId);
}

function createWidgetElement(widgetId, latitude, longitude) {
    const widgetElement = document.createElement('div');
    widgetElement.className = 'weather-widget';
    widgetElement.id = widgetId;
    
    widgetElement.innerHTML = `
        <div class="widget-header">
            <div class="widget-title">Загрузка... (${latitude.toFixed(4)}, ${longitude.toFixed(4)})</div>
            <button class="remove-btn" data-widget="${widgetId}">×</button>
        </div>
        <div class="widget-content">
            <div class="loading">Загрузка данных...</div>
        </div>
    `;
    
    return widgetElement;
}

function setupRemoveButton(widgetElement, widgetId) {
    widgetElement.querySelector('.remove-btn').addEventListener('click', function() {
        removeWidget(widgetId);
    });
}

async function fetchWeatherData(latitude, longitude) {
    if (!OPENWEATHER_KEY) {
        throw new Error('Не задан API ключ OpenWeatherMap');
    }

    const response = await fetch(
        `${WEATHER_API_URL}?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_KEY}&units=metric&lang=ru`
    );
    
    console.log('Статус ответа:', response.status);
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Ошибка OpenWeatherMap: ${response.status} - ${errorData.message}`);
    }
    
    return await response.json();
}

function updateWeatherWidget(widgetId, weatherData, latitude, longitude) {
    const widgetElement = document.getElementById(widgetId);
    if (!widgetElement) return;
    
    const contentElement = widgetElement.querySelector('.widget-content');
    const weather = weatherData.weather[0];
    const main = weatherData.main;
    const wind = weatherData.wind;
    
    const localTime = getLocalTime(weatherData.timezone);
    
    contentElement.innerHTML =
    createWeatherMainHTML(weather, main, localTime) +
    createWeatherDetailsHTML(main, wind, weatherData, widgetId);
    
    const locationName = weatherData.name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    updateWidgetTitle(widgetElement, locationName);
    
    initMap(`map-${widgetId}`, latitude, longitude, locationName);
}

function createWeatherMainHTML(weather, main, localTime) {
    return `
        <div class="weather-main">
            <img src="https://openweathermap.org/img/wn/${weather.icon}@2x.png" alt="${weather.description}" class="weather-icon">
            <div class="temperature">${Math.round(main.temp)}°C</div>
            <div class="weather-description">${capitalizeFirst(weather.description)}</div>
            <div class="weather-time">Местное время: ${localTime}</div>
        </div>
    `;
}

function createWeatherDetailsHTML(main, wind, weatherData, widgetId) {
    return `
        <div class="weather-details">
            <div class="detail-item">
                <span class="detail-label">Ощущается как</span>
                <span class="detail-value">${Math.round(main.feels_like)}°C</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Влажность</span>
                <span class="detail-value">${main.humidity}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Давление</span>
                <span class="detail-value">${Math.round(main.pressure * 0.75)} мм рт.ст.</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Ветер</span>
                <span class="detail-value">${wind.speed} м/с</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Видимость</span>
                <span class="detail-value">${(weatherData.visibility / 1000).toFixed(1)} км</span>
            </div>
        </div>
        <div class="map-container" id="map-${widgetId}"></div>
    `;
}

function updateWidgetTitle(widgetElement, locationName) {
    const titleElement = widgetElement.querySelector('.widget-title');
    titleElement.textContent = `Погода: ${locationName}`;
}

function getLocalTime(timezone) {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const localTime = new Date(utcTime + timezone * 1000);
    return localTime.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function initMap(containerId, latitude, longitude, locationName) {
    if (!yandexMapsLoaded) {
        mapsInitializationQueue.push({ containerId, latitude, longitude, locationName });
        return;
    }
    
    initializeMap(containerId, latitude, longitude, locationName);
}

function initializeMap(containerId, latitude, longitude, locationName) {
    if (typeof ymaps === 'undefined') {
        showMapError(containerId, 'Яндекс Карты не загружены');
        return;
    }

    try {
        createYandexMap(containerId, latitude, longitude, locationName);
    } catch (error) {
        console.error('Ошибка инициализации карты:', error);
        showMapError(containerId, 'Ошибка загрузки карты');
    }
}

function createYandexMap(containerId, latitude, longitude, locationName) {
    const map = new ymaps.Map(containerId, {
        center: [latitude, longitude],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl']
    });
    
    const placemark = createPlacemark(latitude, longitude, locationName);
    map.geoObjects.add(placemark);
}

function createPlacemark(latitude, longitude, locationName) {
    return new ymaps.Placemark([latitude, longitude], {
        hintContent: locationName,
        balloonContent: `
            <strong>${locationName}</strong><br>
            Широта: ${latitude.toFixed(6)}<br>
            Долгота: ${longitude.toFixed(6)}
        `
    }, {
        preset: 'islands#blueIcon'
    });
}

function showMapError(containerId, message) {
    document.getElementById(containerId).innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
            ${message}
        </div>
    `;
}

function showError(widgetId, message) {
    const widgetElement = document.getElementById(widgetId);
    if (!widgetElement) return;
    
    const contentElement = widgetElement.querySelector('.widget-content');
    contentElement.innerHTML = `
        <div class="error-message">
            ${message}
        </div>
    `;
}

function removeWidget(widgetId) {
    const widgetElement = document.getElementById(widgetId);
    if (widgetElement) {
        widgetElement.remove();
    }
}
