/*****************************************************************
 *  ⚙️ CONFIGURATION
 *****************************************************************/
const API_KEY = "1160831f4df1167c0e58181e974f663e";
const GEO_URL   = "https://api.openweathermap.org/geo/1.0/direct";
const WEATHER_URL = "https://api.openweathermap.org/data/3.0/onecall";

/*****************************************************************
 *  🌏 STATE
 *****************************************************************/
let unit = "metric";            // metric or imperial
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let history = JSON.parse(localStorage.getItem("history") || "[]");

/*****************************************************************
 *  🧩 HELPERS
 *****************************************************************/
const $ = (sel) => document.querySelector(sel);
const formatTime = (ts, offset) => new Date((ts + offset) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const showToast = (msg) => {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
};

/*****************************************************************
 *  📦 ELEMENTS
 *****************************************************************/
const cityInput   = $("#cityInput");
const suggestions = $("#suggestions");
const loader      = $("#loader");
const currentCard = $("#currentCard");
const forecastSection = $("#forecastSection");
const searchSheet = $("#searchSheet");
const openSearch  = $("#openSearch");
const closeDrawer = $("#closeDrawer");
const drawer      = $("#drawer");

const cityCountry = $("#cityCountry");
const weatherIcon = $("#weatherIcon");
const temperature = $("#temperature");
const description = $("#description");
const humidity = $("#humidity");
const pressure = $("#pressure");
const windSpeed = $("#windSpeed");
const uvi = $("#uvi");
const sunrise = $("#sunrise");
const sunset = $("#sunset");
const toggleFav = $("#toggleFav");
const favLabel = $("#favLabel");

const forecastList = $("#forecastList");
const favList = $("#favoritesList");
const histList = $("#historyList");

/*****************************************************************
 *  🎨 THEME TOGGLE
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

/*****************************************************************
 *  🌡️ UNIT TOGGLE
 *****************************************************************/
$("#unitToggle").addEventListener("click", () => {
  unit = unit === "metric" ? "imperial" : "metric";
  if (cityInput.dataset.lastQuery) fetchWeather(cityInput.dataset.lastQuery);
});

/*****************************************************************
 *  🔍 CITY AUTOCOMPLETE
 *****************************************************************/
let debounce;
cityInput.addEventListener("input", (e) => {
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
    li.addEventListener("click", () => selectCity(name));
    suggestions.appendChild(li);
  });
  suggestions.classList.remove("hidden");
}
function selectCity(city) {
  cityInput.value = city;
  suggestions.classList.add("hidden");
  fetchWeather(city);
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#searchSheet")) suggestions.classList.add("hidden");
});

/*****************************************************************
 *  📍 GEOLOCATION
 *****************************************************************/
$("#locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return showToast("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      await fetchByCoords(lat, lon);
    },
    () => showToast("Unable to retrieve location")
  );
});

/*****************************************************************
 *  🌤️ FETCH & RENDER
 *****************************************************************/
async function fetchWeather(city) {
  showLoader();
  try {
    const geoRes = await fetch(`${GEO_URL}?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`);
    const geo = await geoRes.json();
    if (!geo.length) throw new Error("City not found");
    const { lat, lon, name, country } = geo[0];
    await fetchByCoords(lat, lon, `${name}, ${country}`);
  } catch (err) {
    showToast(err.message);
  } finally {
    hideLoader();
  }
}
async function fetchByCoords(lat, lon, displayCity) {
  showLoader();
  try {
    const res = await fetch(`${WEATHER_URL}?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=${unit}&appid=${API_KEY}`);
    const data = await res.json();
    renderCurrent(data.current, displayCity || `${data.timezone}`, data.timezone_offset);
    renderForecast(data.daily);
    updateHistory(displayCity || `${data.timezone}`);
  } catch (err) {
    showToast(err.message);
  } finally {
    hideLoader();
  }
}

function renderCurrent(current, city, offset) {
  cityCountry.textContent = city;
  weatherIcon.src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;
  temperature.textContent = `${Math.round(current.temp)}°${unit === "metric" ? "C" : "F"}`;
  description.textContent = current.weather[0].description;
  humidity.textContent = `${current.humidity}%`;
  pressure.textContent = `${current.pressure} hPa`;
  windSpeed.textContent = `${current.wind_speed} m/s`;
  uvi.textContent = current.uvi;
  sunrise.textContent = formatTime(current.sunrise, offset);
  sunset.textContent = formatTime(current.sunset, offset);
  currentCard.classList.remove("hidden");
  forecastSection.classList.remove("hidden");
  cityInput.dataset.lastQuery = city.split(",")[0];

  const isFav = favorites.includes(city);
  toggleFav.querySelector("span").textContent = isFav ? "star" : "star_outline";
  favLabel.textContent = isFav ? "Favorited" : "Favorite";
}

function renderForecast(daily) {
  forecastList.innerHTML = "";
  daily.slice(1, 8).forEach((day) => {
    const div = document.createElement("div");
    div.className = "forecast-item";
    div.innerHTML = `
      <p>${new Date(day.dt*1000).toLocaleDateString([],{weekday:"short"})}</p>
      <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" alt="">
      <p>${Math.round(day.temp.day)}°</p>
    `;
    forecastList.appendChild(div);
  });
}

/*****************************************************************
 *  🔄 LOADER
 *****************************************************************/
function showLoader() {
  loader.classList.remove("hidden");
  currentCard.classList.add("hidden");
  forecastSection.classList.add("hidden");
}
function hideLoader() {
  loader.classList.add("hidden");
}

/*****************************************************************
 *  🗂️ HISTORY & FAVORITES
 *****************************************************************/
function updateHistory(city) {
  if (!history.includes(city)) history.unshift(city);
  history = history.slice(0, 10);
  localStorage.setItem("history", JSON.stringify(history));
  renderLists();
}

toggleFav.addEventListener("click", () => {
  const city = cityCountry.textContent;
  const idx = favorites.indexOf(city);
  if (idx === -1) {
    favorites.unshift(city);
  } else {
    favorites.splice(idx, 1);
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  renderLists();
  renderCurrent({}, city); // just to update button state
});

function renderLists() {
  favList.innerHTML = "";
  favorites.forEach((c) => {
    const li = document.createElement("li");
    li.textContent = c;
    li.addEventListener("click", () => fetchWeather(c));
    favList.appendChild(li);
  });

  histList.innerHTML = "";
  history.forEach((c) => {
    const li = document.createElement("li");
    li.textContent = c;
    li.addEventListener("click", () => fetchWeather(c));
    histList.appendChild(li);
  });
}

/*****************************************************************
 *  📂 DRAWER & SEARCH SHEET
 *****************************************************************/
openSearch.addEventListener("click", () => searchSheet.classList.add("show"));
closeDrawer.addEventListener("click", () => drawer.classList.remove("show"));
panelToggle?.addEventListener("click", () => drawer.classList.toggle("show"));

/*****************************************************************
*  🚀 INIT
*****************************************************************/
renderLists();