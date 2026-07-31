// public/js/cercaDeMi.js
import { supabase } from '../shared/supabaseClient.js';
import { t, getLang } from './i18n.js';
import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { fetchCercanosParaCoordenadas } from './buscarComerciosListado.js';
import { mostrarPopupUbicacionDenegada, showPopupFavoritosVacios } from './popups.js';
import { requireAuthSilent, showAuthModal, ACTION_MESSAGES } from './authGuard.js';
import { showPopup as showPopupManager } from './popupManager.js';

const FALLBACK_USER_IMG = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const USER_MARKER_Z_INDEX = 10000;

function getNavCopy() {
  const lang = String(getLang() || 'es').toLowerCase().split('-')[0];
  if (lang === 'es') {
    return {
      openGps: 'Abrir GPS',
      title: 'Elegir navegación',
      body: '¿Con qué app deseas abrir la ruta?',
      google: 'Google Maps',
      waze: 'Waze',
      cancel: 'Cancelar',
    };
  }
  return {
    openGps: 'Open GPS',
    title: 'Choose navigation',
    body: 'Which app do you want to use for directions?',
    google: 'Google Maps',
    waze: 'Waze',
    cancel: 'Cancel',
  };
}

function getAppBase() {
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  return isLocal ? '/public/' : '/';
}

function openWithFallback(nativeUrl, webUrl) {
  let hidden = false;
  const markHidden = () => {
    hidden = true;
  };
  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', markHidden);
  };
  const onVisibility = () => {
    if (document.hidden) {
      hidden = true;
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', markHidden);

  try {
    window.location.href = nativeUrl;
  } catch (_) {
    window.open(webUrl, '_blank', 'noopener');
    cleanup();
    return;
  }

  setTimeout(() => {
    cleanup();
    if (!hidden) {
      window.open(webUrl, '_blank', 'noopener');
    }
  }, 900);
}

function showNavigationPicker({ lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const copy = getNavCopy();
  const destination = `${lat},${lon}`;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const googleNative = isIOS
    ? `comgooglemaps://?daddr=${destination}&directionsmode=driving`
    : `google.navigation:q=${destination}&mode=d`;
  const googleWeb = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  const wazeNative = `waze://?ll=${lat},${lon}&navigate=yes`;
  const wazeWeb = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;

  showPopupManager({
    title: copy.title,
    message: copy.body,
    buttons: [
      {
        text: copy.cancel,
      },
      {
        text: copy.google,
        primary: true,
        onClick: () => openWithFallback(googleNative, googleWeb),
      },
      {
        text: copy.waze,
        primary: true,
        onClick: () => openWithFallback(wazeNative, wazeWeb),
      },
    ],
  });
}

function attachGpsAction(cardNode, comercio = {}) {
  const lat = Number(comercio.latitud ?? comercio.lat ?? comercio.latitude);
  const lon = Number(comercio.longitud ?? comercio.lon ?? comercio.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const hasGpsButton = cardNode.querySelector('[data-map-nav-action="true"]');
  if (hasGpsButton) return;

  const timeRow = Array.from(cardNode.querySelectorAll('div')).find((el) =>
    el.querySelector('i.fa-car, i.fas.fa-car')
  );
  if (!timeRow || !timeRow.parentElement) return;

  const copy = getNavCopy();
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.mapNavAction = 'true';
  button.className =
    'gps-open-btn mx-auto -mt-2 mb-3 inline-flex items-center justify-center gap-1 rounded-full border border-[#a8dcee] bg-[#edf9fd] px-3 py-1 text-sm font-medium text-[#3ea6c4] hover:bg-[#dff4fb] transition';
  button.innerHTML = `<i class="fas fa-location-arrow text-[#3ea6c4]"></i> ${copy.openGps}`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showNavigationPicker({ lat, lon });
  });

  timeRow.insertAdjacentElement('afterend', button);
}

function crearIconoUsuario(src, headingDeg = null) {
  const safeSrc = typeof src === 'string' && src.trim() ? src.trim() : FALLBACK_USER_IMG;
  const safeHeading = normalizeHeadingDeg(headingDeg) ?? 0;
  const pointer = `
      <div style="
        position:absolute;
        inset:0;
        transform: rotate(${safeHeading}deg);
        transform-origin: 50% 50%;
        pointer-events:none;
      ">
        <div style="
          position:absolute;
          left:50%;
          top:-6px;
          transform: translateX(-50%);
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-bottom:12px solid #2563eb;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));
        "></div>
      </div>
    `;

  return L.divIcon({
    className: 'user-marker',
    html: `
      <div style="
        position: relative;
        width: 48px;
        height: 48px;
        overflow: visible;
      ">
        ${pointer}
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid white;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          background: white;
        ">
          <img src="${safeSrc}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.onerror=null;this.src='${FALLBACK_USER_IMG}'" />
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -40],
  });
}

async function obtenerImagenUsuario(idUsuario) {
  if (userIconSrc) return userIconSrc;
  if (!idUsuario) {
    userIconSrc = FALLBACK_USER_IMG;
    return userIconSrc;
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('imagen')
      .eq('id', idUsuario)
      .single();

    const imagenPerfil = typeof data?.imagen === 'string' ? data.imagen.trim() : '';
    if (error || !imagenPerfil) {
      userIconSrc = FALLBACK_USER_IMG;
      return userIconSrc;
    }

    userIconSrc = imagenPerfil;
    return userIconSrc;
  } catch (err) {
    userIconSrc = FALLBACK_USER_IMG;
    return userIconSrc;
  }
}
const PLACEHOLDER_LOGO =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgLogoNoDisponible.jpg';

const CATEGORY_COLORS = {
  1: '#2563eb',
  2: '#16a34a',
  3: '#f97316',
  4: '#ec4899',
  5: '#9333ea',
  6: '#facc15',
  7: '#0ea5e9',
};

let map, markersLayer, userMarker;
let userLat = null;
let userLon = null;
let geoWatchId = null;
let mapInteractionsBound = false;
let followControlAdded = false;
let siguiendoUsuario = true;
let ultimaPosicion = null;
let userIconSrc = null;
let userHeadingDeg = null;
let lastHeadingApplied = null;
let followControlButton = null;
let speedSamplesMph = [];
let previousPositionForHeading = null;
let playasLayer = null;
let lugaresLayer = null;
let playasCercanasCache = [];
let lugaresCercanosCache = [];
let capasOpcionalesUltimaClave = '';



const $radio = document.getElementById('radioKm');
const $radioLabel = document.getElementById('radioKmLabel');
const $loader = document.getElementById('loader');
const $search = document.getElementById('searchNombre');
const $filtroAbierto = document.getElementById('filtroAbierto');
const $filtroFavoritos = document.getElementById('filtroFavoritos');
const $filtroCategoria = document.getElementById('filtroCategoria');
const $btnToggleFiltros = document.getElementById('btnToggleFiltros');
const $panelFiltros = document.getElementById('panelFiltros');
const $geoFallbackPanel = document.getElementById('geoFallbackPanel');
const $geoFallbackStatus = document.getElementById('geoFallbackStatus');
const $fallbackMunicipioSelect = document.getElementById('fallbackMunicipioSelect');
const $btnFallbackApplyMunicipio = document.getElementById('btnFallbackApplyMunicipio');
const $btnFallbackRetryGeo = document.getElementById('btnFallbackRetryGeo');
const $togglePlayas = document.getElementById('togglePlayas');
const $toggleLugares = document.getElementById('toggleLugares');

let comerciosOriginales = [];
let searchDebounceId = null;
let favoritosUsuarioIds = new Set();
let favoritosPromise = null;
let municipiosFallback = [];
let geoFallbackReady = false;

function setMapFollowMode(enabled) {
  siguiendoUsuario = enabled;
  if (map) {
    map._userMovedManually = !enabled;
  }
  if (followControlButton) {
    followControlButton.classList.toggle('hidden', enabled);
  }
}

function updateFollowControlStyle() {
  if (!followControlButton) return;
  followControlButton.style.cssText = `
    width: 54px;
    height: 54px;
    border: 2px solid rgba(255,255,255,0.95);
    border-radius: 9999px;
    cursor: pointer;
    color: white;
    background: linear-gradient(135deg, #ff7a18 0%, #ff4d4d 100%);
    box-shadow: 0 14px 28px rgba(0,0,0,0.28), 0 0 0 6px rgba(255,122,24,0.18);
    font-size: 18px;
    display: grid;
    place-items: center;
    margin-right: 14px;
    margin-bottom: 76px;
    position: relative;
  `;
}

function normalizeHeadingDeg(deg) {
  if (!Number.isFinite(deg)) return null;
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getBearingDegrees(from, to) {
  if (!from || !to) return null;
  const lat1 = Number(from.lat);
  const lon1 = Number(from.lon);
  const lat2 = Number(to.lat);
  const lon2 = Number(to.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  return normalizeHeadingDeg(toDeg(Math.atan2(y, x)));
}

function getZoomForSpeedMph(mph) {
  const lastZoomMode = Number(map?._followZoomMode);
  const previousZoom = Number.isFinite(lastZoomMode) ? lastZoomMode : 13;

  if (!Number.isFinite(mph)) {
    return previousZoom;
  }

  if (previousZoom >= 15) {
    if (mph > 8) return 13;
    return 15;
  }

  if (previousZoom === 13) {
    if (mph <= 6) return 15;
    if (mph >= 38) return 11;
    return 13;
  }

  if (mph <= 32) {
    return 13;
  }
  return 11;
}

function getSmoothedSpeedMph(mph) {
  if (!Number.isFinite(mph)) return mph;
  speedSamplesMph.push(mph);
  if (speedSamplesMph.length > 5) {
    speedSamplesMph.shift();
  }

  const values = speedSamplesMph.filter((value) => Number.isFinite(value));
  if (!values.length) return mph;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const R = 6371e3;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1000;
}

function getSearchRadiusKm() {
  const radioMiles = Number($radio?.value ?? 5) || 5;
  return Math.max(0.5, radioMiles) * 1.60934;
}

function createOptionalPinIcon({ iconClass, color, borderColor }) {
  return L.divIcon({
    className: 'optional-map-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 54px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
      ">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: white;
          border: 3px solid ${borderColor};
          box-shadow: 0 8px 18px rgba(0,0,0,0.22);
          display: grid;
          place-items: center;
          color: ${color};
          font-size: 18px;
        ">
          <i class="${iconClass}"></i>
        </div>
        <div style="
          width: 2px;
          height: 10px;
          background: ${borderColor};
          border-radius: 999px;
          margin-top: -1px;
        "></div>
      </div>
    `,
    iconSize: [44, 54],
    iconAnchor: [22, 54],
    popupAnchor: [0, -50],
  });
}

function createBeachIcon() {
  return createOptionalPinIcon({
    iconClass: 'fas fa-umbrella-beach',
    color: '#0f766e',
    borderColor: '#06b6d4',
  });
}

function createLugarIcon() {
  return createOptionalPinIcon({
    iconClass: 'fas fa-signs-post',
    color: '#92400e',
    borderColor: '#f59e0b',
  });
}

function buildOptionalPopup({ title, subtitle, href, ctaLabel, accent = 'sky' }) {
  const bg = accent === 'amber' ? 'bg-amber-500' : 'bg-sky-500';
  const hover = accent === 'amber' ? 'hover:bg-amber-600' : 'hover:bg-sky-600';
  return `
    <div class="w-56 rounded-2xl bg-white p-3 text-center">
      <div class="mb-1 text-sm font-semibold text-slate-800">${title}</div>
      <div class="mb-3 text-xs text-slate-500">${subtitle || ''}</div>
      <a href="${href}" class="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold text-white ${bg} ${hover}">
        ${ctaLabel}
      </a>
    </div>
  `;
}

function renderOptionalLayer(layer, items, iconFactory, popupFactory) {
  if (!layer) return;
  layer.clearLayers();
  if (!Array.isArray(items) || items.length === 0) return;
  items.forEach((item) => {
    const lat = Number(item.latitud);
    const lon = Number(item.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const marker = L.marker([lat, lon], { icon: iconFactory() });
    if (popupFactory) {
      marker.bindPopup(popupFactory(item), {
        maxWidth: 260,
        className: 'popup-card--clean',
      });
    }
    layer.addLayer(marker);
  });
}

async function cargarPlayasEnMapa() {
  if (!playasLayer) return;
  playasLayer.clearLayers();
  if (!$togglePlayas?.checked || typeof userLat !== 'number' || typeof userLon !== 'number') {
    return;
  }

  const radiusKm = getSearchRadiusKm();
  try {
    const { data, error } = await supabase
      .from('playas')
      .select('id, nombre, municipio, latitud, longitud');

    if (error) throw error;

    const items = (Array.isArray(data) ? data : [])
      .map((playa) => ({
        ...playa,
        latitud: Number(playa.latitud),
        longitud: Number(playa.longitud),
      }))
      .filter((playa) =>
        Number.isFinite(playa.latitud) &&
        Number.isFinite(playa.longitud) &&
        getDistanceKm(userLat, userLon, playa.latitud, playa.longitud) <= radiusKm
      )
      .sort(
        (a, b) =>
          getDistanceKm(userLat, userLon, a.latitud, a.longitud) -
          getDistanceKm(userLat, userLon, b.latitud, b.longitud)
      )
      .slice(0, 30);

    playasCercanasCache = items;
    renderOptionalLayer(
      playasLayer,
      items,
      createBeachIcon,
      (playa) =>
        buildOptionalPopup({
          title: playa.nombre || 'Playa',
          subtitle: playa.municipio || '',
          href: `${getAppBase()}perfilPlaya.html?id=${playa.id}`,
          ctaLabel: 'Ver playa',
          accent: 'sky',
        })
    );
  } catch (err) {
    console.error('❌ Error cargando playas en el mapa:', err);
  }
}

async function cargarLugaresEnMapa() {
  if (!lugaresLayer) return;
  lugaresLayer.clearLayers();
  if (!$toggleLugares?.checked || typeof userLat !== 'number' || typeof userLon !== 'number') {
    return;
  }

  const radiusKm = getSearchRadiusKm();
  try {
    const { data, error } = await supabase
      .from('LugaresTuristicos')
      .select('id, nombre, municipio, latitud, longitud, categoria, activo')
      .eq('activo', true);

    if (error) throw error;

    const items = (Array.isArray(data) ? data : [])
      .map((lugar) => ({
        ...lugar,
        latitud: Number(lugar.latitud),
        longitud: Number(lugar.longitud),
      }))
      .filter((lugar) =>
        Number.isFinite(lugar.latitud) &&
        Number.isFinite(lugar.longitud) &&
        getDistanceKm(userLat, userLon, lugar.latitud, lugar.longitud) <= radiusKm
      )
      .sort(
        (a, b) =>
          getDistanceKm(userLat, userLon, a.latitud, a.longitud) -
          getDistanceKm(userLat, userLon, b.latitud, b.longitud)
      )
      .slice(0, 30);

    lugaresCercanosCache = items;
    renderOptionalLayer(
      lugaresLayer,
      items,
      createLugarIcon,
      (lugar) =>
        buildOptionalPopup({
          title: lugar.nombre || 'Lugar',
          subtitle: lugar.municipio || lugar.categoria || '',
          href: `${getAppBase()}perfilLugar.html?id=${lugar.id}`,
          ctaLabel: 'Ver lugar',
          accent: 'amber',
        })
    );
  } catch (err) {
    console.error('❌ Error cargando lugares en el mapa:', err);
  }
}

async function refreshOptionalLayers() {
  const latKey = Number.isFinite(userLat) ? userLat.toFixed(3) : 'na';
  const lonKey = Number.isFinite(userLon) ? userLon.toFixed(3) : 'na';
  const key = [
    latKey,
    lonKey,
    getSearchRadiusKm().toFixed(2),
    Boolean($togglePlayas?.checked),
    Boolean($toggleLugares?.checked),
  ].join('|');

  if (key === capasOpcionalesUltimaClave) return;
  capasOpcionalesUltimaClave = key;

  await Promise.all([
    cargarPlayasEnMapa(),
    cargarLugaresEnMapa(),
  ]);
}

function toggleLoader(show) {
  if (!$loader) return;
  $loader.classList.toggle('hidden', !show);
  $loader.classList.toggle('flex', show);
}

function togglePanelFiltros() {
  if (!$panelFiltros || !$btnToggleFiltros) return;
  const estabaOculto = $panelFiltros.classList.toggle('hidden');
  $btnToggleFiltros.setAttribute('aria-expanded', String(!estabaOculto));
  $btnToggleFiltros.classList.toggle('bg-gray-100', estabaOculto);
  $btnToggleFiltros.classList.toggle('bg-gray-200', !estabaOculto);
}

function stopGeoWatch() {
  if (geoWatchId === null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(geoWatchId);
  geoWatchId = null;
}

function setGeoFallbackStatus(message = '', tone = 'info') {
  if (!$geoFallbackStatus) return;
  const text = String(message || '').trim();
  if (!text) {
    $geoFallbackStatus.textContent = '';
    $geoFallbackStatus.classList.add('hidden');
    $geoFallbackStatus.classList.remove('text-amber-900', 'text-red-700', 'text-green-700');
    return;
  }

  $geoFallbackStatus.textContent = text;
  $geoFallbackStatus.classList.remove('hidden', 'text-amber-900', 'text-red-700', 'text-green-700');
  if (tone === 'error') {
    $geoFallbackStatus.classList.add('text-red-700');
  } else if (tone === 'success') {
    $geoFallbackStatus.classList.add('text-green-700');
  } else {
    $geoFallbackStatus.classList.add('text-amber-900');
  }
}

function hideGeoFallbackPanel() {
  if (!$geoFallbackPanel) return;
  $geoFallbackPanel.classList.add('hidden');
  setGeoFallbackStatus('');
}

function showGeoFallbackPanel(errorCode = null) {
  if (!$geoFallbackPanel) return;
  $geoFallbackPanel.classList.remove('hidden');

  if (errorCode === 1) {
    setGeoFallbackStatus(t('cerca.geoFallbackPermissionDenied'), 'error');
  } else if (errorCode === 3) {
    setGeoFallbackStatus(t('cerca.geoFallbackTimeout'), 'error');
  } else if (errorCode === 2) {
    setGeoFallbackStatus(t('cerca.geoFallbackPositionUnavailable'), 'error');
  } else {
    setGeoFallbackStatus(t('cerca.geoFallbackUnknownError'), 'error');
  }
}

async function cargarMunicipiosFallback({ force = false } = {}) {
  if (!$fallbackMunicipioSelect) return;
  if (geoFallbackReady && !force) return;
  const selectedBefore = String($fallbackMunicipioSelect.value || '').trim();

  try {
    const { data, error } = await supabase
      .from('Municipios')
      .select('id, nombre, latitud, longitud')
      .order('nombre');

    if (error) throw error;

    municipiosFallback = (Array.isArray(data) ? data : []).filter((item) => {
      const lat = Number(item?.latitud);
      const lon = Number(item?.longitud);
      return typeof item?.nombre === 'string' && item.nombre.trim() && Number.isFinite(lat) && Number.isFinite(lon);
    });

    $fallbackMunicipioSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('cerca.geoFallbackMunicipioPlaceholder');
    $fallbackMunicipioSelect.appendChild(placeholder);

    municipiosFallback.forEach((municipio) => {
      const option = document.createElement('option');
      option.value = municipio.nombre;
      option.textContent = municipio.nombre;
      $fallbackMunicipioSelect.appendChild(option);
    });

    if (selectedBefore) {
      const hasSelected = municipiosFallback.some(
        (item) => String(item?.nombre || '').trim() === selectedBefore
      );
      if (hasSelected) {
        $fallbackMunicipioSelect.value = selectedBefore;
      }
    }

    geoFallbackReady = true;
  } catch (err) {
    console.error('⚠️ No se pudo cargar la lista de municipios para fallback:', err?.message || err);
    setGeoFallbackStatus(t('cerca.geoFallbackMunicipiosError'), 'error');
  }
}

function getCoordsFromMunicipioNombre(nombre = '') {
  const municipio = municipiosFallback.find(
    (item) => String(item?.nombre || '').trim().toLowerCase() === String(nombre || '').trim().toLowerCase()
  );
  if (!municipio) return null;
  const lat = Number(municipio.latitud);
  const lon = Number(municipio.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, nombre: municipio.nombre };
}

async function applyFallbackMunicipio() {
  const municipioNombre = String($fallbackMunicipioSelect?.value || '').trim();
  if (!municipioNombre) {
    setGeoFallbackStatus(t('cerca.geoFallbackSelectMunicipioRequired'), 'error');
    return;
  }

  const coords = getCoordsFromMunicipioNombre(municipioNombre);
  if (!coords) {
    setGeoFallbackStatus(t('cerca.geoFallbackMunicipioNoCoords'), 'error');
    return;
  }

  stopGeoWatch();
  siguiendoUsuario = false;
  map._userMovedManually = true;
  map._firstFix = false;
  map._comerciosCargados = false;

  if (userMarker) {
    userMarker.remove();
    userMarker = null;
  }
  userLat = coords.lat;
  userLon = coords.lon;
  map.setView([coords.lat, coords.lon], 12, { animate: true });
  await loadNearby();

  setGeoFallbackStatus(t('cerca.geoFallbackLoadedMunicipio', { municipio: coords.nombre }), 'success');
}

async function cargarCategoriasDropdown() {
  if (!$filtroCategoria) return;
  $filtroCategoria.innerHTML = `<option value="">${t('cerca.categoriasTodas')}</option>`;
  try {
    const { data, error } = await supabase
      .from('Categorias')
      .select('id, nombre, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja')
      .order('nombre');
    if (error) throw error;
    const lang = (getLang() || 'es').toLowerCase().split('-')[0];
    const nombreKey = `nombre_${lang}`;
    data?.forEach((categoria) => {
      if (categoria?.id == null) return;
      const traducido = categoria?.[nombreKey];
      const nombreFinal = traducido || categoria.nombre || `${t('cerca.categoriasTodas')} ${categoria.id}`;
      const option = document.createElement('option');
      option.value = categoria.id;
      option.textContent = nombreFinal;
      $filtroCategoria.appendChild(option);
    });
  } catch (err) {
    console.error('⚠️ No se pudieron cargar las categorías:', err?.message || err);
  }
}

function normalizarTextoPlano(valor) {
  if (valor == null) return '';
  return String(valor)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarId(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }
  const texto = String(valor).trim();
  if (!texto) return null;
  const num = Number(texto);
  if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  return texto.toLowerCase();
}

function setTieneId(conjunto, valor) {
  if (!conjunto || conjunto.size === 0) return false;
  const key = normalizarId(valor);
  if (key === null || key === '') return false;
  if (conjunto.has(key)) return true;
  if (typeof key === 'number') return conjunto.has(String(key));
  const num = Number(key);
  return !Number.isNaN(num) && conjunto.has(num);
}

function aplicarFiltros() {
  if (!Array.isArray(comerciosOriginales) || !comerciosOriginales.length) {
    markersLayer?.clearLayers();
    return;
  }

  let resultado = [...comerciosOriginales];

  // 🔍 Búsqueda por nombre o descripción
  const termino = normalizarTextoPlano($search?.value || '');
  if (termino) {
    resultado = resultado.filter(c => {
      const nombre = normalizarTextoPlano(c.nombre || '');
      const descripcion = normalizarTextoPlano(c.descripcion || '');
      return nombre.includes(termino) || descripcion.includes(termino);
    });
  }

  // 🟩 Abierto ahora
  if ($filtroAbierto?.checked) {
    resultado = resultado.filter(c => c.abiertoAhora === true || c.abierto === true);
  }

  // 💜 Mis favoritos
  if ($filtroFavoritos?.checked && favoritosUsuarioIds.size > 0) {
    resultado = resultado.filter(c => setTieneId(favoritosUsuarioIds, c.id));
  }

  // 🗺️ Renderizar resultados en el mapa
  renderMarkers(resultado);
}

async function obtenerIdUsuarioActual() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session?.user?.id || null;
  } catch (err) {
    console.warn('⚠️ No se pudo obtener la sesión del usuario actual:', err?.message || err);
    return null;
  }
}

async function obtenerFavoritosUsuarioIds() {
  if (favoritosPromise) {
    try {
      const ids = await favoritosPromise;
      favoritosUsuarioIds = ids;
      return favoritosUsuarioIds;
    } catch (err) {
      favoritosPromise = null;
    }
  }

  favoritosPromise = (async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData?.session?.user?.id;
      if (!userId) return new Set();

      const { data, error } = await supabase
        .from('favoritosusuarios')
        .select('idcomercio')
        .eq('idusuario', userId);

      if (error) throw error;

      const ids = Array.isArray(data)
        ? data
            .map(reg => reg?.idcomercio)
            .filter(id => id !== null && id !== undefined)
        : [];

      const set = new Set();
      ids.forEach(id => {
        const num = Number(id);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
          set.add(num);
          set.add(String(num));
        } else if (typeof id === 'string') {
          const limpio = id.trim();
          if (limpio) set.add(limpio);
        }
      });

      return set;
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar favoritos del usuario:', err?.message || err);
      return new Set();
    }
  })();

  favoritosUsuarioIds = await favoritosPromise;
  return favoritosUsuarioIds;
}

function initMap() {
  // ✅ Crear mapa base (sin rotación CSS)
  map = L.map('map', {
    maxZoom: 22,     // 🔥 permite acercar más de lo normal
    minZoom: 6,
    zoomControl: true,
  }).setView([18.2208, -66.5901], 13); // Zoom inicial más amplio

  // ✅ Capa de mapa (Carto Voyager o OpenStreetMap)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 22,
    attribution:
      '&copy; <a href="https://carto.com/">CartoDB</a> | &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  }).addTo(map);

  // ✅ Capa para los marcadores
  markersLayer = L.layerGroup().addTo(map);
  playasLayer = L.layerGroup().addTo(map);
  lugaresLayer = L.layerGroup().addTo(map);

}

function updateRadioLabel() {
  if ($radio && $radioLabel) $radioLabel.textContent = `${$radio.value} mi`;
}

function getComercioColor(comercio) {
  if (comercio.color_hex && /^#([0-9a-f]{6})$/i.test(comercio.color_hex)) {
    return comercio.color_hex;
  }
  if (comercio.idCategoria && CATEGORY_COLORS[comercio.idCategoria]) {
    return CATEGORY_COLORS[comercio.idCategoria];
  }
  return '#2563eb';
}


function createComercioIcon(comercio) {
  const logoURL =
    comercio.logo && comercio.logo.trim() !== '' ? comercio.logo.trim() : PLACEHOLDER_LOGO;

  return L.divIcon({
    className: 'comercio-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        background: white;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid ${getComercioColor(comercio)};
        box-shadow: 0 3px 8px rgba(0,0,0,0.25);
      ">
        <img
          src="${logoURL}"
          alt="Logo ${comercio.nombre}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        />
      </div>
      <div style="width:2px;height:10px;background:${getComercioColor(
        comercio
      )};margin:0 auto;border-radius:1px;"></div>
    `,
    iconSize: [50, 60],
    iconAnchor: [25, 60],
    popupAnchor: [0, -60],
  });
}

/* -------------------------- ENRIQUECEDORES -------------------------- */

async function renderMarkers(comercios = []) {
  markersLayer.clearLayers();
  if (!Array.isArray(comercios) || !comercios.length) return;

  comercios.forEach((comercio) => {
    const lat = Number(comercio.latitud ?? comercio.lat ?? comercio.latitude);
    const lon = Number(comercio.longitud ?? comercio.lon ?? comercio.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const marker = L.marker([lat, lon], {
      icon: createComercioIcon(comercio),
    });

    const cardFactory = comercio.activo === true ? cardComercio : cardComercioNoActivo;
    const cardNode = cardFactory({
      ...comercio,
      abierto: Boolean(comercio.abierto ?? comercio.abiertoAhora ?? comercio.abierto_ahora),
      tiempoVehiculo: comercio.tiempoVehiculo || comercio.tiempoTexto,
      pueblo: comercio.municipio || comercio.pueblo || '',
    });
    attachGpsAction(cardNode, comercio);

    cardNode.querySelector('div[class*="text-[#3ea6c4]"]')?.remove();
    cardNode.querySelector('.municipio-info')?.remove();

    const municipioTexto = typeof comercio.municipio === 'string' ? comercio.municipio.trim() : '';
    if (municipioTexto) {
      const municipioEl = document.createElement('div');
      municipioEl.className =
        'flex items-center gap-1 justify-center text-[#3ea6c4] text-sm font-medium municipio-info';
      municipioEl.innerHTML = `<i class="fas fa-map-pin"></i> ${municipioTexto}`;

      const anchorNombre = cardNode.querySelector('a[href*="perfilComercio.html"]');
      if (anchorNombre) {
        anchorNombre.insertAdjacentElement('afterend', municipioEl);
      } else {
        cardNode.insertBefore(municipioEl, cardNode.firstChild);
      }
    }

    const wrapper = document.createElement('div');
    wrapper.style.width = '340px';
    wrapper.appendChild(cardNode);

    marker.bindPopup(wrapper, {
      maxWidth: 360,
      className: 'popup-card--clean',
      autoPan: true,
      keepInView: true,
    });

    marker.on('popupopen', (e) => {
      const popupEl = e.popup._contentNode;
      if (!popupEl) return;
      const telButtons = popupEl.querySelectorAll('a[href^="tel:"], button[href^="tel:"]');
      telButtons.forEach((btn) => {
        btn.style.color = '#ffffff';
        btn.style.backgroundColor = '#dc2626';
        btn.style.border = 'none';
      });
      const telIcons = popupEl.querySelectorAll('a[href^="tel:"] i, a[href^="tel:"] span');
      telIcons.forEach((icon) => (icon.style.color = '#ffffff'));
    });

    markersLayer.addLayer(marker);
  });
}

/* ------------------------------ CARGA ------------------------------ */

async function loadNearby() {
  if (typeof userLat !== 'number' || typeof userLon !== 'number') return;

  const radioMiles = Number($radio?.value ?? 5) || 5;
  const radioKm = Math.max(0.5, radioMiles) * 1.60934;
  toggleLoader(true);

  const abiertoAhoraFiltro = $filtroAbierto?.checked ? true : null;
  const categoriaSeleccionada = ($filtroCategoria?.value ?? '').trim();
  const categoriaOpcional = categoriaSeleccionada ? Number(categoriaSeleccionada) || null : null;
  const incluirInactivos = false; // solo mostrar inactivos si se habilita explícitamente un filtro futuro

  try {
    const lista = await fetchCercanosParaCoordenadas({
      latitud: userLat,
      longitud: userLon,
      radioKm,
      categoriaOpcional,
      abiertoAhora: abiertoAhoraFiltro,
      incluirInactivos,
    });

    const favoritosIds = await obtenerFavoritosUsuarioIds();

    const listaConFavoritos = lista.map((c) => {
      const esFavorito = favoritosIds.has(c.id) || favoritosIds.has(String(c.id));
      return { ...c, favorito: esFavorito };
    });

    comerciosOriginales = listaConFavoritos;
    aplicarFiltros();
    await refreshOptionalLayers();
  } catch (err) {
    console.error('❌ Error al cargar comercios cercanos:', err);
  } finally {
    toggleLoader(false);
  }
}

async function locateUser() {
  if (!map) return;
  if (!navigator.geolocation) {
    showGeoFallbackPanel();
    setGeoFallbackStatus(t('cerca.geoFallbackNoSupport'), 'error');
    cargarMunicipiosFallback();
    return;
  }
  previousPositionForHeading = null;
  if (geoWatchId !== null) {
    map._userMovedManually = false;
    siguiendoUsuario = true;
    if (typeof userLat === 'number' && typeof userLon === 'number') {
      map.setView([userLat, userLon], Math.max(15, map.getZoom() || 13), { animate: true });
    }
    return;
  }
  toggleLoader(true);

  const idUsuario = await obtenerIdUsuarioActual();
  const iconoUsuarioSrc = await obtenerImagenUsuario(idUsuario);
  const iconoUsuario = crearIconoUsuario(iconoUsuarioSrc, userHeadingDeg);

  siguiendoUsuario = true;
  ultimaPosicion = null;

  // marca si el usuario tocó el mapa (para no re-centrar a la fuerza)
  setMapFollowMode(true);

  // si el usuario mueve o hace zoom, pausamos seguimiento automático
  if (!mapInteractionsBound) {
    const desactivarSeguimientoPorInteraccion = (e) => {
      if (e && e.originalEvent) {
        setMapFollowMode(false);
      }
    };
    map.on('movestart zoomstart', desactivarSeguimientoPorInteraccion);
    map.on('dragstart', desactivarSeguimientoPorInteraccion);
    map.on('zoomstart', desactivarSeguimientoPorInteraccion);
    map.on('touchstart', (e) => {
      if (e && e.originalEvent) {
        setMapFollowMode(false);
      }
    });
    mapInteractionsBound = true;
  }

  // util distancia (metros)
  const getDistanceMeters = (p1, p2) => {
    const R = 6371e3, toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const a = Math.sin(dLat/2)**2 +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const actualizarUbicacion = async (pos) => {
    try {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      if (!map || !Number.isFinite(userLat) || !Number.isFinite(userLon)) return;
      hideGeoFallbackPanel();

      // velocidad → mph
      const speed = pos.coords.speed || 0; // m/s
      const mph = speed * 2.23694;
      const smoothMph = getSmoothedSpeedMph(mph);

      // distancia recorrida desde la última lectura
      const ahora = { lat: userLat, lon: userLon };
      const dist = ultimaPosicion ? getDistanceMeters(ultimaPosicion, ahora) : Infinity;
      ultimaPosicion = ahora;

      // heading (grados) si está disponible; si no, usar dirección de movimiento
      const headingRaw = pos.coords.heading;
      if (Number.isFinite(headingRaw)) {
        userHeadingDeg = normalizeHeadingDeg(headingRaw);
      } else if (previousPositionForHeading && dist >= 3) {
        const movementBearing = getBearingDegrees(previousPositionForHeading, ahora);
        if (Number.isFinite(movementBearing)) {
          userHeadingDeg = movementBearing;
        }
      }
      previousPositionForHeading = ahora;

      // crea/mueve el pin del usuario
      if (userMarker) {
        userMarker.setLatLng([userLat, userLon]);
        userMarker.setZIndexOffset(USER_MARKER_Z_INDEX);
        if (Number.isFinite(userHeadingDeg)) {
          if (lastHeadingApplied === null || Math.abs(userHeadingDeg - lastHeadingApplied) >= 5) {
            userMarker.setIcon(crearIconoUsuario(userIconSrc, userHeadingDeg));
            lastHeadingApplied = userHeadingDeg;
          }
        }
      } else {
        userMarker = L.marker([userLat, userLon], { icon: crearIconoUsuario(userIconSrc, userHeadingDeg) }).addTo(map);
        userMarker.setZIndexOffset(USER_MARKER_Z_INDEX);
        if (Number.isFinite(userHeadingDeg)) {
          lastHeadingApplied = userHeadingDeg;
        }
      }

      // 1) primera fijación: mostrar vista amplia (13) para ver varias cuadras/comercios
      if (!map._firstFix) {
        map._firstFix = true;
        map.setView([userLat, userLon], 13, { animate: true });
        previousPositionForHeading = ahora;
      } else {
        // 2) si aún no recorrió 3 m, no cambiamos el zoom (solo seguimos el pin)
        if (dist >= 3) {
          // 3) calcular zoom según velocidad
          let zoomDeseado = getZoomForSpeedMph(smoothMph);
          map._followZoomMode = zoomDeseado;

          // si el usuario acercó más, no lo alejamos
          const zActual = map.getZoom();
          if (zActual > zoomDeseado) zoomDeseado = zActual;

          // re-centrar solo si seguimos al usuario y no movió el mapa manualmente
          if (siguiendoUsuario && !map._userMovedManually) {
            map.setView([userLat, userLon], zoomDeseado, { animate: true });
          }
        } else {
          // menos de 3 m: mantener zoom actual; si seguimos, solo centrar suavemente
          if (siguiendoUsuario && !map._userMovedManually) {
            map.panTo([userLat, userLon], { animate: true });
          }
        }
      }

      // cargar comercios la primera vez
      if (!map._comerciosCargados) {
        await loadNearby();
        map._comerciosCargados = true;
      } else if ($togglePlayas?.checked || $toggleLugares?.checked) {
        await refreshOptionalLayers();
      }

      // debug
      // console.log(`📍 ${userLat.toFixed(5)}, ${userLon.toFixed(5)} | ${mph.toFixed(1)} mph | dist ${Math.round(dist)} m`);
    } catch (err) {
      console.error('⚠️ Error actualizando ubicación:', err);
    } finally {
      toggleLoader(false);
    }
  };

  const handleError = (err) => {
    console.warn('⚠️ Error en seguimiento de ubicación:', err.message);
    const errorCode = Number(err?.code);
    if (err && err.code === err.PERMISSION_DENIED) {
      mostrarPopupUbicacionDenegada();
      stopGeoWatch();
    }
    showGeoFallbackPanel(errorCode);
    cargarMunicipiosFallback();
    toggleLoader(false);
  };

  // seguimiento continuo
  geoWatchId = navigator.geolocation.watchPosition(actualizarUbicacion, handleError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });

  // botón para re-centrar (reactiva seguimiento y respeta zoom por velocidad)
  if (!followControlAdded) {
    const btnSeguir = L.control({ position: 'bottomright' });
    btnSeguir.onAdd = () => {
      const btn = L.DomUtil.create('button', 'seguir-usuario-btn');
      btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
      btn.title = 'Volver a centrar en tu ubicación';
      followControlButton = btn;
      updateFollowControlStyle();
      btn.classList.add('hidden');
      btn.onclick = () => {
        setMapFollowMode(true);
        if (typeof userLat === 'number' && typeof userLon === 'number') {
          const currentZoom = Number(map?.getZoom?.());
          if (Number.isFinite(currentZoom)) {
            map._followZoomMode = currentZoom;
          }
          map.setView([userLat, userLon], Math.max(15, map.getZoom() || 13), { animate: true });
        }
      };
      return btn;
    };
    btnSeguir.addTo(map);
    followControlButton = document.querySelector('.seguir-usuario-btn');
    updateFollowControlStyle();
    setMapFollowMode(siguiendoUsuario);
    followControlAdded = true;
  }
}

/* ------------------------------ INIT ------------------------------ */

(function init() {
  initMap();
  updateRadioLabel();
  cargarCategoriasDropdown();
  cargarMunicipiosFallback();

  $radio?.addEventListener('input', updateRadioLabel);
  $radio?.addEventListener('change', () => loadNearby());
  $btnFallbackApplyMunicipio?.addEventListener('click', () => applyFallbackMunicipio());
  $btnFallbackRetryGeo?.addEventListener('click', () => {
    stopGeoWatch();
    setGeoFallbackStatus(t('cerca.geoFallbackRetrying'), 'info');
    speedSamplesMph = [];
    previousPositionForHeading = null;
    if (map) map._followZoomMode = 13;
    locateUser();
  });
  $btnToggleFiltros?.addEventListener('click', togglePanelFiltros);
  $filtroCategoria?.addEventListener('change', () => loadNearby());
  $togglePlayas?.addEventListener('change', () => refreshOptionalLayers());
  $toggleLugares?.addEventListener('change', () => refreshOptionalLayers());
  window.addEventListener('lang:changed', () => {
    cargarCategoriasDropdown();
    cargarMunicipiosFallback({ force: true });
    refreshOptionalLayers();
  });

  if ($search) {
    $search.addEventListener('input', () => {
      if (searchDebounceId) clearTimeout(searchDebounceId);
      searchDebounceId = setTimeout(aplicarFiltros, 200);
    });
  }

  [$filtroAbierto, $filtroFavoritos].forEach(toggle => {
    if (toggle === $filtroFavoritos) {
      toggle?.addEventListener('change', async (e) => {
        if (e.target.checked) {
          const user = await requireAuthSilent('favoriteCommerce');
          if (!user) {
            e.target.checked = false;
            showAuthModal(ACTION_MESSAGES.favoriteCommerce, 'favoriteCommerce');
            aplicarFiltros();
            return;
          }
          const favoritosIds = await obtenerFavoritosUsuarioIds();
          if (!favoritosIds || favoritosIds.size === 0) {
            showPopupFavoritosVacios("comercio");
            desactivarSwitchFavoritos();
            aplicarFiltros();
            return;
          }
        }
        aplicarFiltros();
      });
    } else {
      toggle?.addEventListener('change', aplicarFiltros);
    }
  });

  locateUser();
})();

// Asegurar color blanco en popup al abrirlo
map?.on('popupopen', () => {
  document
    .querySelectorAll('.leaflet-popup-content .card-comercio a[href^="tel:"]')
    .forEach(el => (el.style.color = 'white'));
});
function desactivarSwitchFavoritos() {
  if ($filtroFavoritos) {
    $filtroFavoritos.checked = false;
  }
}
