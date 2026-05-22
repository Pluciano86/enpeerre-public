// public/js/cardComercioSlide.js
import { supabase } from "../shared/supabaseClient.js";
import { t, interpolate } from "./i18n.js";
import { resolverPlanComercio } from "../shared/planes.js";
import { registrarBasicClickIntent } from "../shared/basicClickIntentTracker.js";
import { formatearTelefonoDisplay } from "../shared/utils.js";

const CATEGORIA_KEY_BY_ES = {
  "Restaurantes": "categoria.restaurantes",
  "Coffee Shops": "categoria.coffeeShops",
  "Panaderías": "categoria.panaderias",
  "Panaderias": "categoria.panaderias",
  "Pubs": "categoria.pubs",
  "Food Trucks": "categoria.foodTrucks",
  "Postres": "categoria.postres",
  "Playgrounds": "categoria.playgrounds",
  "Discotecas": "categoria.discotecas",
  "Barras": "categoria.barras",
};
const NEARBY_NAME_LONG_THRESHOLD = 24;
const PLACEHOLDER_PORTADA = "https://placehold.co/200x120?text=Portada";

function traducirCategoria(nombre) {
  const key = CATEGORIA_KEY_BY_ES[nombre];
  return key ? t(key) : nombre;
}

function buildNoImageOverlay() {
  return `
    <div class="playa-no-image-overlay absolute inset-0 flex flex-col items-center justify-center text-center text-white font-bold text-sm leading-snug px-2 pointer-events-none">
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageTitle')}</span>
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageSubtitle')}</span>
    </div>
  `;
}

/**
 * 🔹 Tarjeta compacta para mostrar comercios en sliders tipo “Cercanos para Comer”
 * Muestra portada (desde Comercios.portada), logo, nombre, categoría, municipio y tiempo en vehículo.
 */
export function cardComercioSlide(comercio) {
  const {
    id,
    nombre,
    municipio,
    telefono,
    portada,
    logo,
    categorias,
    tiempoTexto,
  } = comercio;
  const telefonoDisplay = formatearTelefonoDisplay(telefono || "");
  const nombreTexto = String(nombre ?? "").trim();
  const nombreClass = nombreTexto.length > NEARBY_NAME_LONG_THRESHOLD ? "text-[11px]" : "text-[12px]";

  const categoriaTexto =
    categorias?.length > 0
      ? categorias.map(traducirCategoria).join(", ")
      : t("categoria.sin");
  const portadaNormalizada = typeof portada === 'string' ? portada.trim() : '';
  const usaPlaceholderPortada =
    !portadaNormalizada ||
    portadaNormalizada === PLACEHOLDER_PORTADA ||
    portadaNormalizada.toLowerCase().includes('placehold.co/200x120?text=portada');
  const portadaURL = usaPlaceholderPortada ? PLACEHOLDER_PORTADA : portadaNormalizada;

  // 🔹 Crear tarjeta
  const planInfo = resolverPlanComercio(comercio || {});
  const permitePerfil = planInfo.permite_perfil !== false;

  const card = document.createElement("a");
  card.href = permitePerfil ? `perfilComercio.html?id=${id}` : "#";
  card.dataset.planBloqueado = permitePerfil ? "false" : "true";
  card.className =
    `block bg-white rounded-xl mb-1 overflow-hidden w-[160px] sm:w-[180px] relative my-[1px] shadow-[0_2px_5px_rgba(15,23,42,0.13)] ${permitePerfil ? '' : 'cursor-default'}`;

  // 🔹 Estructura visual idéntica al estilo de Playas
  card.innerHTML = `
    <div class="w-full h-24 relative bg-gray-200">
      <div class="absolute inset-0 overflow-hidden" data-comercio-portada-wrap>
        <img src="${
          portadaURL
        }" alt="Portada"
             class="w-full h-full object-cover" data-comercio-portada />
        ${usaPlaceholderPortada ? buildNoImageOverlay() : ''}
      </div>

      <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-14 h-14 bg-white rounded-full shadow-[0px_-17px_11px_-5px_rgba(0,_0,_0,_0.5)] overflow-hidden">
        <img src="${
          logo || "https://placehold.co/40x40?text=Logo"
        }" alt="Logo" class="w-full h-full object-cover" />
      </div>
    </div>

    <div class="pt-8 px-2 pb-2 text-center">
      <h3 class="${nombreClass} font-semibold leading-tight max-h-10 overflow-hidden line-clamp-2">
        ${nombre}
      </h3>

      <p class="text-[11px] text-gray-500 truncate">${categoriaTexto}</p>
      ${
        telefonoDisplay
          ? `<p class="mt-1 inline-flex items-center justify-center gap-1 rounded-full bg-red-600 px-2.5 py-[3px] text-[11px] font-medium text-white max-w-full">
               <i class="fa-solid fa-phone text-[10px] text-white"></i><span class="truncate">${telefonoDisplay}</span>
             </p>`
          : ""
      }
      <p class="text-[11px] text-gray-600 mt-1 truncate">
        <i class="fas fa-map-pin text-sky-600 mr-1"></i>${municipio || "—"}
      </p>
      <p class="text-[11px] text-gray-600 mt-1">
        <i class="fas fa-car text-red-500 mr-1"></i>${tiempoTexto || "N/A"}
      </p>
    </div>
  `;

  const portadaWrap = card.querySelector('[data-comercio-portada-wrap]');
  const portadaEl = card.querySelector('[data-comercio-portada]');

  const ensureNoImageOverlay = () => {
    if (!portadaWrap) return;
    let overlay = portadaWrap.querySelector('.playa-no-image-overlay');
    if (!overlay) {
      portadaWrap.insertAdjacentHTML('beforeend', buildNoImageOverlay());
      overlay = portadaWrap.querySelector('.playa-no-image-overlay');
    } else {
      const spans = overlay.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = t('playa.noImageTitle');
      if (spans[1]) spans[1].textContent = t('playa.noImageSubtitle');
    }
  };

  if (usaPlaceholderPortada) {
    ensureNoImageOverlay();
  }

  if (portadaEl) {
    portadaEl.addEventListener('error', () => {
      if (portadaEl.src !== PLACEHOLDER_PORTADA) {
        portadaEl.src = PLACEHOLDER_PORTADA;
      }
      ensureNoImageOverlay();
    });
  }

  if (!permitePerfil) {
    card.setAttribute('aria-disabled', 'true');
    card.setAttribute('tabindex', '-1');

    let bubbleState = null;

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const ensureBubble = () => {
      let bubble = card.querySelector('.basic-plan-bubble');
      if (bubble) return bubble;

      bubble = document.createElement('div');
      bubble.className =
        'basic-plan-bubble absolute left-1/2 -translate-x-1/2 top-1 z-20 w-[92%] max-w-[200px] opacity-0 translate-y-2 pointer-events-none transition-all duration-200 ease-out';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');

      const box = document.createElement('div');
      box.className =
        'relative bg-white text-gray-800 border border-gray-200 rounded-2xl shadow-lg px-3 py-2 text-center';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className =
        'absolute top-1 right-1 w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center';
      closeBtn.setAttribute('aria-label', t('popup.cerrar'));
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideBubble();
      });

      const iconWrap = document.createElement('div');
      iconWrap.className = 'mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600';
      iconWrap.innerHTML = '<i class="fa-solid fa-circle-info text-[10px]"></i>';

      const title = document.createElement('div');
      title.dataset.basicTitle = 'true';
      title.className = 'font-semibold text-[11px] text-gray-900 leading-tight';
      title.textContent = t('card.noPerfilTitle');

      const msg = document.createElement('div');
      msg.dataset.basicMessage = 'true';
      msg.className = 'text-[10px] text-gray-600 leading-snug mt-1';
      msg.innerHTML = '';

      const caret = document.createElement('span');
      caret.className =
        'absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45';

      box.appendChild(closeBtn);
      box.appendChild(iconWrap);
      box.appendChild(title);
      box.appendChild(msg);
      box.appendChild(caret);
      bubble.appendChild(box);

      bubble.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      card.appendChild(bubble);
      return bubble;
    };

    const getNoProfileCopy = () => {
      const nombreComercio = comercio?.nombre || 'este comercio';
      const slug = String(planInfo?.slug || '').toLowerCase();
      const appHighlight = `<span class="text-[#f57c00] font-semibold">${escapeHtml(t('card.appName'))}</span>`;
      const planHighlight = `<span class="text-[#f57c00] font-semibold">${escapeHtml(t('card.basicPlanName'))}</span>`;
      const nombreHighlight = `<span class="text-sky-600 font-semibold">${escapeHtml(nombreComercio)}</span>`;
      if (slug === 'basic') {
        return {
          title: t('card.noPerfilTitleBasic'),
          message:
            `${interpolate(t('card.noPerfilBodyBasic'), { plan: planHighlight })}<br>` +
            `${interpolate(t('card.noPerfilBodyNotify'), { nombre: nombreHighlight })}`,
        };
      }

      return {
        title: t('card.noPerfilTitle'),
        message:
          `${interpolate(t('card.noPerfilBodyGeneric'), { app: appHighlight })}<br>` +
          `${interpolate(t('card.noPerfilBodyNotify'), { nombre: nombreHighlight })}`,
      };
    };

    const hydrateBubbleCopy = () => {
      const bubble = ensureBubble();
      const titleNode = bubble.querySelector('[data-basic-title="true"]');
      const messageNode = bubble.querySelector('[data-basic-message="true"]');
      const copy = getNoProfileCopy();

      if (titleNode) titleNode.textContent = copy.title;
      if (messageNode) messageNode.innerHTML = copy.message;
      return bubble;
    };

    const hideBubble = () => {
      const bubble = card.querySelector('.basic-plan-bubble');
      if (!bubble || !bubbleState?.visible) return;
      bubbleState.visible = false;
      bubble.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
      bubble.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
      if (bubbleState.timer) {
        clearTimeout(bubbleState.timer);
        bubbleState.timer = null;
      }
      if (bubbleState.outsideHandler) {
        document.removeEventListener('click', bubbleState.outsideHandler);
        bubbleState.outsideHandler = null;
      }
    };

    const showBubble = () => {
      const bubble = hydrateBubbleCopy();
      if (!bubbleState) bubbleState = {};

      bubbleState.visible = true;
      bubble.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
      bubble.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');

      if (bubbleState.timer) clearTimeout(bubbleState.timer);
      bubbleState.timer = setTimeout(() => {
        hideBubble();
      }, 10000);

      if (!bubbleState.outsideHandler) {
        bubbleState.outsideHandler = (evt) => {
          if (!bubble.contains(evt.target)) {
            hideBubble();
          }
        };
        document.addEventListener('click', bubbleState.outsideHandler);
      }
    };

    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (bubbleState?.visible) {
        hideBubble();
        return;
      }

      registrarBasicClickIntent({
        idComercio: comercio?.id,
        metadata: {
          componente: "card_comercio_slide",
        },
      }).catch(() => {});

      showBubble();
    });
  }

  return card;
}

/**
 * 🔸 Cargar las categorías reales del comercio desde la relación ComercioCategorias → Categorias
 */
export async function cargarCategoriasComercio(idComercio) {
  try {
    const { data, error } = await supabase
      .from("ComercioCategorias")
      .select("Categorias (nombre)")
      .eq("idComercio", idComercio);

    if (error) throw error;

    return data?.map((c) => c.Categorias?.nombre).filter(Boolean) || [];
  } catch (err) {
    console.error("❌ Error cargando categorías del comercio:", err);
    return [];
  }
}
