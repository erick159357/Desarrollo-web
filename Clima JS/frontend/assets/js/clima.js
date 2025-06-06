const apiKey = 'd2a55db8cf362d2a913c585fa99f1168'; // OPENWEATHER API 

let map, marker;

async function cargarEstados() {
  const resp = await fetch('assets/data/estados-municipios.json');
  const estados = await resp.json();
  const estadoSelect = document.getElementById('estadoSelect');
// Sidebar estático con toggle y secciones
document.addEventListener('DOMContentLoaded', () => {
  const sidebar   = document.getElementById('sidebar');
  const content   = document.getElementById('content');
  const toggleBtn = document.getElementById('toggleSidebar');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    content.classList.toggle('expanded');
  });

  // Mostrar email desde localStorage
  const userEmailEl = document.getElementById('userEmail');
  userEmailEl.textContent = localStorage.getItem('userEmail') || 'Usuario';

  document.getElementById('changePassword').addEventListener('click', e => {
    e.preventDefault();
    window.location.href = 'cambiar-password.html';
  });
  document.getElementById('logout').addEventListener('click', e => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
  });
});
  // estados de la republica
  Object.keys(estados).forEach(estado => {
    const opt = document.createElement('option');
    opt.value = estado;
    opt.textContent = estado;
    estadoSelect.appendChild(opt);
  });

  // Cuando cambia el estado, actualiza municipios
  estadoSelect.addEventListener('change', () => {
    const ciudades = estados[estadoSelect.value] || [];
    const ciudadSelect = document.getElementById('ciudadSelect');
    ciudadSelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
    ciudades.forEach(ciudad => {
      const opt = document.createElement('option');
      opt.value = ciudad;
      opt.textContent = ciudad;
      ciudadSelect.appendChild(opt);
    });
    ciudadSelect.disabled = !ciudades.length;
    document.getElementById('searchBtn').disabled = true;
  });

  // Habilitar botón al escoger un municipio
  document.getElementById('ciudadSelect').addEventListener('change', e => {
    document.getElementById('searchBtn').disabled = !e.target.value;
  });

  // Evento de busqueda
  document.getElementById('searchBtn').addEventListener('click', searchWeather);
}

async function searchWeather() {
  const estado = document.getElementById('estadoSelect').value;
  const ciudad = document.getElementById('ciudadSelect').value;
  const locationEl = document.getElementById('location');
  locationEl.textContent = `Buscando clima en ${ciudad}, ${estado}...`;

  try {
    // Geocoding: obtener lat/lon
    const geoResp = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(ciudad + ',MX')}&limit=1&appid=${apiKey}`
    );
    const geoData = await geoResp.json();
    if (!geoData.length) throw new Error('Ciudad no encontrada');

    const { lat, lon } = geoData[0];

    // Datos del clima
    const weatherResp = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${apiKey}`
    );
    const data = await weatherResp.json();

    // Mostrar en pantalla
    locationEl.textContent = `${data.name}, ${estado}`;
    document.getElementById('temperature').textContent =
      `Temperatura: ${data.main.temp} °C`;
    document.getElementById('weatherDescription').textContent =
      `Descripción: ${data.weather[0].description}`;
    document.getElementById('humidity').textContent =
      `Humedad: ${data.main.humidity}%`;
    document.getElementById('wind').textContent =
      `Viento: ${data.wind.speed} m/s`;
    document.getElementById('weatherIcon').src =
      `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    document.getElementById('weatherIcon').alt =
      data.weather[0].description;

    // Inicializar o actualizar mapa
    if (!map) {
      map = L.map('map').setView([lat, lon], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      marker = L.marker([lat, lon]).addTo(map);
    } else {
      map.setView([lat, lon], 10);
      marker.setLatLng([lat, lon]);
    }
  } catch (err) {
    locationEl.textContent = 'Error: ' + err.message;
    console.error(err);
  }
}

// Al cargar la página
window.onload = cargarEstados;

