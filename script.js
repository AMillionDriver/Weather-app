/*****************************************************************
 *  ⚙️ CONFIG  (One Call 3.0 ONLY)
 *****************************************************************/
const API_KEY = "1160831f4df1167c0e58181e974f663e";
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const WEATHER_URL = "https://api.openweathermap.org/data/3.0/onecall";
const AIR_URL = "https://api.openweathermap.org/data/2.5/air_pollution";
const MAP_LAYER = "https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid=" + API_KEY;

let unit = "metric";
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let history = JSON.parse(localStorage.getItem("history") || "[]");
let map, markers = [], chart;

/*****************************************************************
 *  🧩 HELPERS
 *****************************************************************/
const $ = (sel) => document.querySelector(sel);
const showToast = (msg) => {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
};
const formatTime = (ts, offset) =>
  new Date((ts + offset) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/*****************************************************************
 *  🎨 THEME
 *****************************************************************/
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);
$("#themeToggle").addEventListener("click", () => {
  const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);
});
function updateThemeIcon(theme) {
  $("#themeToggle").querySelector("span").textContent = theme === "dark" ? "light_mode" : "dark_mode";
}
$("#unitToggle").addEventListener("click", () => {
  unit = unit === "metric" ? "imperial" : "metric";
  if (cityInput.dataset.lastCity) fetchWeather(cityInput.dataset.lastCity);
});

/*****************************************************************
 *  🔍 CITY AUTOCOMPLETE
 *****************************************************************/
let debounce;
$("#cityInput").addEventListener("input", (e) => {
  clearTimeout(debounce);
  const q = e.target.value.trim();
  if (!q) return suggestions.classList.add("hidden");
  debounce = setTimeout(async () => {
    try {
      const res = await fetch(`${GEO_URL}?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
      const data = await res.json();
      renderSuggestions(data);
    } catch { suggestions.classList.add("hidden"); }
  }, 300);
});
function renderSuggestions(list) {
  suggestions.innerHTML = "";
  list.forEach(({ name, country, state }) => {
    const li = document.createElement("li");
    li.textContent = state ? `${name}, ${state}, ${country}` : `${name}, ${country}`;
    li.addEventListener("click", () => {
      $("#cityInput").value = li.textContent;
      suggestions.classList.add("hidden");
      fetchWeather(name);
    });
    suggestions.appendChild(li);
  });
  suggestions.classList.remove("hidden");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#searchBar")) suggestions.classList.add("hidden");
});

/*****************************************************************
 *  📍 GEOLOCATION
 *****************************************************************/
$("#locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return showToast("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    async (pos) => await fetchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showToast("Location denied")
  );
});

/*****************************************************************
 *  🌤️ FETCH ONE CALL 3.0
 *****************************************************************/
async function fetchWeather(city) {
  showLoader(true);
  try {
    const geo = await (await fetch(`${GEO_URL}?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`)).json();
    if (!geo.length) throw new Error("City not found");
    const { lat, lon, name, country } = geo[0];
    await fetchByCoords(lat, lon, `${name}, ${country}`);
  } catch (err) { showToast(err.message); } finally { showLoader(false); }
}
async function fetchByCoords(lat, lon, cityName) {
  showLoader(true);
  try {
    const [weather, air] = await Promise.all([
      fetch(`${WEATHER_URL}?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=${unit}&appid=${API_KEY}`).then(r => r.json()),
      fetch(`${AIR_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}`).then(r => r.json())
    ]);
    if (!weather.current || !weather.current.weather) throw new Error("Invalid data");
    renderCurrent(weather, cityName, weather.timezone_offset);
    renderForecast(weather.daily);
    renderChart(weather.daily);
    renderMap(lat, lon, cityName);
    updateHistory(cityName);
    renderLists();
  } catch (err) { showToast(err.message); } finally { showLoader(false); }
}

/*****************************************************************
 *  🖼️ RENDER CURRENT
 *****************************************************************/
function renderCurrent(data, city, offset) {
  const c = data.current;
  cityCountry.textContent = city;
  weatherIcon.src = `https://openweathermap.org/img/wn/${c.weather[0].icon}@2x.png`;
  temperature.textContent = `${Math.round(c.temp)}°${unit === "metric" ? "C" : "F"}`;
  description.textContent = c.weather[0].description;
  humidity.textContent = `${c.humidity}%`;
  pressure.textContent = `${c.pressure} hPa`;
  windSpeed.textContent = `${c.wind_speed} m/s`;
  uvi.textContent = c.uvi;
  sunrise.textContent = formatTime(c.sunrise, offset);
  sunset.textContent = formatTime(c.sunset, offset);
  aqi.textContent = ["Good", "Fair", "Moderate", "Poor", "Very-poor"][data.list?.[0]?.main?.aqi - 1] || "N/A";
  currentCard.classList.remove("hidden");
  cityInput.dataset.lastCity = city;
  updateFavButton(city);
}

/*****************************************************************
 *  📅 RENDER FORECAST CARDS
 *****************************************************************/
function renderForecast(daily) {
  const list = $("#forecastList");
  list.innerHTML = "";
  daily.slice(1, 8).forEach(d => {
    const div = document.createElement("div");
    div.className = "forecast-item";
    div.innerHTML = `
      <p>${new Date(d.dt * 1000).toLocaleDateString([], { weekday: "short" })}</p>
      <img src="https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png" alt="">
      <p>${Math.round(d.temp.day)}°</p>
    `;
    list.appendChild(div);
  });
  forecastSection.classList.remove("hidden");
}

/*****************************************************************
 *  📈 CHART
 *****************************************************************/
function renderChart(daily) {
  if (chart) chart.destroy();
  const ctx = $("#tempChart");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: daily.slice(1, 8).map(d => new Date(d.dt * 1000).toLocaleDateString([], { weekday: "short" })),
      datasets: [
        { label: "Max", data: daily.slice(1, 8).map(d => d?.temp?.max ?? 0), borderColor: "#007aff", backgroundColor: "rgba(0,122,255,0.2)", fill: true, tension: 0.3 },
        { label: "Min", data: daily.slice(1, 8).map(d => d?.temp?.min ?? 0), borderColor: "#ff3b30", backgroundColor: "rgba(255,59,48,0.2)", fill: true, tension: 0.3 }
      ]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
  });
  chartSection.classList.remove("hidden");
}

/*****************************************************************
 *  🗺️ MAP
 *****************************************************************/
function renderMap(lat, lon, city) {
  if (!map) {
    map = L.map("map").setView([lat, lon], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
  } else map.setView([lat, lon], 9);
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  const marker = L.marker([lat, lon]).addTo(map).bindPopup(city);
  markers.push(marker);

  document.querySelectorAll(".map-controls button").forEach(btn => {
    btn.addEventListener("click", () => {
      const layer = btn.dataset.layer;
      map.eachLayer(l => { if (l._url && l._url.includes("tile.openweathermap.org")) map.removeLayer(l); });
      L.tileLayer(MAP_LAYER.replace("{layer}", layer), { attribution: "© OWM", maxZoom: 19 }).addTo(map);
    });
  });
  mapSection.classList.remove("hidden");
}

/*****************************************************************
 *  🗂️ FAVORITES / HISTORY
 *****************************************************************/
function updateHistory(city) {
  if (!history.includes(city)) history.unshift(city);
  history = history.slice(0, 10);
  localStorage.setItem("history", JSON.stringify(history));
}
function updateFavButton(city) {
  const isFav = favorites.includes(city);
  toggleFav.querySelector("span").textContent = isFav ? "star" : "star_outline";
  favLabel.textContent = isFav ? "Favorited" : "Favorite";
}
toggleFav.addEventListener("click", () => {
  const city = cityCountry.textContent;
  const idx = favorites.indexOf(city);
  idx === -1 ? favorites.unshift(city) : favorites.splice(idx, 1);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  updateFavButton(city);
  renderLists();
});

/*****************************************************************
 *  🧭 DRAWER
 *****************************************************************/
const drawer = $("#drawer");
const favList = $("#favoritesList");
const histList = $("#historyList");

function renderLists() {
  favList.innerHTML = favorites.map(c => `<li data-city="${c}">${c}</li>`).join("");
  histList.innerHTML = history.map(c => `<li data-city="${c}">${c}</li>`).join("");
  [...favList.children, ...histList.children].forEach(li => {
    li.addEventListener("click", () => fetchWeather(li.dataset.city));
  });
}

$("#openDrawer").addEventListener("click", () => drawer.classList.add("show"));
$("#closeDrawer").addEventListener("click", () => drawer.classList.remove("show"));

/*****************************************************************
 *  🔁 LOADER
 *****************************************************************/
function showLoader(show = true) {
  loader.classList.toggle("hidden", !show);
}

/*****************************************************************
 *  🚀 INIT
 *****************************************************************/
document.addEventListener("DOMContentLoaded", () => {
  renderLists();
});
                         
