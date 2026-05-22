// public/js/cardPlayaSlide.js
import { t } from "./i18n.js";

const PLACEHOLDER_PLAYA =
  "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/imgPlayaNoDisponible.jpg";

function buildNoImageOverlay() {
  return `
    <div class="playa-no-image-overlay absolute inset-0 flex flex-col items-center justify-center text-center text-white font-bold text-sm leading-snug px-2 pointer-events-none">
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageTitle')}</span>
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageSubtitle')}</span>
    </div>
  `;
}

export function cardPlayaSlide(playa) {
  const { id, nombre, municipio, tiempoTexto = "", imagen, clima = {} } = playa;
  console.log("Renderizando corazón para:", nombre, playa?.favorito);

  // 🪶 Crear el enlace contenedor
  const card = document.createElement("a");
  card.href = `perfilPlaya.html?id=${id}`;
  card.className =
    "block w-40 shrink-0 rounded-xl overflow-hidden bg-white relative my-[1px] shadow-[0_2px_5px_rgba(15,23,42,0.13)] transition-transform hover:scale-[1.02] active:scale-[0.98]";

  // 🧩 Validar imagen
  const imagenNormalizada = typeof imagen === 'string' ? imagen.trim() : '';
  const usaPlaceholder =
    !imagenNormalizada ||
    imagenNormalizada === PLACEHOLDER_PLAYA ||
    imagenNormalizada.toLowerCase().includes('imgplayanodisponible');
  const imagenURL = usaPlaceholder ? PLACEHOLDER_PLAYA : imagenNormalizada;

  // 🧱 Estructura HTML
  card.innerHTML = `
    <div class="w-full h-24 relative bg-gray-200 overflow-hidden" data-playa-image-wrap>
      ${playa.favorito ? `
        <div class="absolute top-2 right-2 z-50">
          <div class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
            <div class="w-6 h-6 rounded-full border-2 border-red-600 flex items-center justify-center">
              <i class="fas fa-heart text-red-600 text-xs"></i>
            </div>
          </div>
        </div>` : ''
      }
      <img 
        src="${imagenURL}" 
        alt="Imagen de ${nombre}" 
        class="w-full h-full object-cover" 
        loading="lazy"
        data-playa-image
      />
      ${usaPlaceholder ? buildNoImageOverlay() : ''}
    </div>

    <div class="pt-2 px-2 pb-2 text-center">
      <h3 class="text-sm font-semibold leading-tight h-9 overflow-hidden text-ellipsis line-clamp-2">
        ${nombre || t('area.playaSinNombre')}
      </h3>

      <div class="flex justify-center items-center gap-1 text-sm text-gray-600 mt-0.5">
        ${
          clima.iconoURL
            ? `<img src="${clima.iconoURL}" alt="${clima.estado}" class="w-4 h-4" />`
            : ""
        }
        <span>${clima.estado || ""}</span>
      </div>

      <div class="flex items-center justify-center gap-1 text-[11px] text-gray-600 mt-1">
        <i class="fas fa-map-pin text-sky-600"></i>
        <span>${municipio || ""}</span>
      </div>

      <div class="flex items-start justify-center gap-1 text-[11px] text-gray-600 mt-1">
        <i class="fas fa-car text-red-500 mt-[2px]"></i>
        <span>${tiempoTexto || t('area.noDisponible')}</span>
      </div>
    </div>
  `;

  const imageWrap = card.querySelector('[data-playa-image-wrap]');
  const imageEl = card.querySelector('[data-playa-image]');

  const ensureNoImageOverlay = () => {
    if (!imageWrap) return;
    let overlay = imageWrap.querySelector('.playa-no-image-overlay');
    if (!overlay) {
      imageWrap.insertAdjacentHTML('beforeend', buildNoImageOverlay());
      overlay = imageWrap.querySelector('.playa-no-image-overlay');
    } else {
      const spans = overlay.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = t('playa.noImageTitle');
      if (spans[1]) spans[1].textContent = t('playa.noImageSubtitle');
    }
  };

  if (usaPlaceholder) {
    ensureNoImageOverlay();
  }

  if (imageEl) {
    imageEl.addEventListener('error', () => {
      if (imageEl.src !== PLACEHOLDER_PLAYA) {
        imageEl.src = PLACEHOLDER_PLAYA;
      }
      ensureNoImageOverlay();
    });
  }

  return card;
}
