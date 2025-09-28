// ---------------------------
// CONFIG
// ---------------------------
const OPENWEATHER_KEY = '63b20dc9ac30968ec723f34842b2725d';
const UNITS = 'metric'; // 'metric' for °C, 'imperial' for °F

// DOM
const statusEl = document.getElementById('status');
const loadingCard = document.getElementById('loading');
const weatherCard = document.getElementById('weatherCard');
const locationNameEl = document.getElementById('locationName');
const currentTempEl = document.getElementById('currentTemp');
const currentDescEl = document.getElementById('currentDesc');
const currentIconEl = document.getElementById('currentIcon');
const feelsEl = document.getElementById('feelsLike');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const forecastEl = document.getElementById('forecast');

const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const cityInput = document.getElementById('cityInput');

// ---------------------------
// Helpers
// ---------------------------
function setStatus(text) {
  statusEl.textContent = text;
}

function showWeatherCard() {
  loadingCard.classList.add('hidden');
  weatherCard.classList.remove('hidden');
}

function showLoading(text) {
  loadingCard.classList.remove('hidden');
  weatherCard.classList.add('hidden');
  setStatus(text);
}

function owIconUrl(icon) {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function formatDate(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------------------------
// OpenWeather API calls
// ---------------------------

// Current weather
async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${UNITS}&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch current weather');
  return res.json();
}

// Forecast (5-day / 3-hour)
async function fetchForecast(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${UNITS}&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch forecast');
  return res.json();
}

// Geocode city
async function geocodeCity(city) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('City lookup failed');
  const j = await res.json();
  return j && j[0] ? j[0] : null;
}

// Reverse geocode
async function reverseGeocode(lat, lon) {
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  return j && j[0] ? j[0] : null;
}

// ---------------------------
// UI rendering
// ---------------------------
function renderCurrent(locationLabel, data) {
  locationNameEl.textContent = locationLabel;
  currentTempEl.textContent = `${Math.round(data.main.temp)}°C`;
  currentDescEl.textContent = data.weather?.[0]?.description ?? '—';
  currentIconEl.src = owIconUrl(data.weather?.[0]?.icon);
  currentIconEl.alt = data.weather?.[0]?.description ?? '';
  feelsEl.textContent = `${Math.round(data.main.feels_like)}°C`;
  humidityEl.textContent = `${data.main.humidity}%`;
  windEl.textContent = `${data.wind.speed} m/s`;
}

function renderForecast(forecast) {
  forecastEl.innerHTML = '';

  // Group by date
  const daily = {};
  forecast.list.forEach((item) => {
    const date = new Date(item.dt * 1000).toDateString();
    if (!daily[date]) {
      daily[date] = [];
    }
    daily[date].push(item);
  });

  // Take up to 5 days
  const days = Object.keys(daily).slice(0, 5);

  days.forEach((day, idx) => {
    const entries = daily[day];
    const temps = entries.map((e) => e.main.temp);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const icon = entries[0].weather[0].icon;
    const desc = entries[0].weather[0].main;

    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    dayDiv.innerHTML = `
      <div class="d">${idx === 0 ? 'Today' : formatDate(entries[0].dt)}</div>
      <img src="${owIconUrl(icon)}" alt="${desc}" />
      <div class="temps"><strong>${Math.round(avg)}°C</strong></div>
      <div class="small">${desc}</div>
    `;
    forecastEl.appendChild(dayDiv);
  });
}

// ---------------------------
// Main flows
// ---------------------------
async function updateByCoords(lat, lon) {
  try {
    showLoading('Fetching weather…');
    const [current, forecast, place] = await Promise.all([
      fetchCurrentWeather(lat, lon),
      fetchForecast(lat, lon),
      reverseGeocode(lat, lon).catch(() => null)
    ]);

    const label = place ? `${place.name}, ${place.country}` : `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
    renderCurrent(label, current);
    renderForecast(forecast);
    showWeatherCard();
  } catch (err) {
    console.error(err);
    showLoading('Could not fetch weather. Try search or refresh.');
  }
}

async function handleUseMyLocation() {
  if (!navigator.geolocation) {
    showLoading('Geolocation not supported — please search by city.');
    return;
  }
  showLoading('Getting location…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    await updateByCoords(latitude, longitude);
  }, (err) => {
    console.warn('geo err', err);
    showLoading('Location not allowed — try searching a city.');
  }, { enableHighAccuracy: false, timeout: 10000 });
}

async function handleSearchCity() {
  const city = cityInput.value.trim();
  if (!city) {
    cityInput.focus();
    return;
  }
  try {
    showLoading('Looking up city…');
    const place = await geocodeCity(city);
    if (!place) {
      showLoading('City not found. Check spelling and try again.');
      return;
    }
    await updateByCoords(place.lat, place.lon);
  } catch (err) {
    console.error(err);
    showLoading('Search failed — try again.');
  }
}

// ---------------------------
// Event Listeners
// ---------------------------
searchBtn.addEventListener('click', handleSearchCity);
cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearchCity();
});
locBtn.addEventListener('click', handleUseMyLocation);

// Auto-start
window.addEventListener('load', () => {
  handleUseMyLocation();
});
