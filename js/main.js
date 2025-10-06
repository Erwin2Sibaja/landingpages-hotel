/* ==========================================================================
   GR Solaris Lighthouse - Main JS
   Estructura:
   0) Helpers y estado
   1) Idiomas (i18n)
   2) Banner (imágenes/video por idioma)
   3) Motor de reservaciones (URL builder + CTAs)
   4) Formularios (pax dinámico)
   5) Datepicker (Lightpick)
   6) Componentes visuales (Banner slider, Restaurantes)
   7) Galería (preview + modal)
   8) Carruseles (Rooms/Benefits/Experiences) + Lazy init
   9) Bootstrap final
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     0) Helpers y estado
     ========================= */
  let currentLang = localStorage.getItem("lang") || "en";
  document.documentElement.lang = currentLang;

  const calendar = {
    getToday: () => {
      const t = new Date();
      return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
    },
    getNext: (date, unit, value) => {
      const d = new Date(date.year, date.month - 1, date.day);
      if (unit === "d") d.setDate(d.getDate() + value);
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    },
  };

  const dateParser = (date) =>
    `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

  // Evitar interacciones fantasmas sobre videos de fondo
  document.querySelectorAll("video.background-hero").forEach(v => {
    v.style.pointerEvents = "none";
  });

  /* =========================
     1) Idiomas (i18n)
     ========================= */
  (function initLanguageSwitcher(){
    const langButtons = document.querySelectorAll(".lang-btn");

    langButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const selectedLang = button.getAttribute("data-lang");
        if (selectedLang && selectedLang !== currentLang) {
          localStorage.setItem("lang", selectedLang);
          location.reload();
        }
      });
    });

    updateLanguageSwitcher(currentLang);
    loadLanguage(currentLang);

    function updateLanguageSwitcher(lang){
      document.querySelectorAll('.lang-btn').forEach(btn=>{
        const isActive = btn.getAttribute('data-lang') === lang;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
    }

    async function loadLanguage(lang) {
      try {
        const response = await fetch(`./i18n/${lang}.json`, { cache: "no-store" });
        if (!response.ok) throw new Error("Error loading language file");
        const translations = await response.json();
        applyTranslations(translations);
      } catch (error) {
        console.error("Error loading translations:", error);
      }
    }

    function applyTranslations(translations) {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (translations[key]) {
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.placeholder = translations[key];
          } else {
            el.innerHTML = translations[key];
          }
        }
      });
    }
  })();

  /* =========================
     2) Banner (imágenes/video por idioma)
     ========================= */
  (function updateBannerImages(){
    const lang = currentLang;
    const bannerElement = document.querySelector("[data-i18n-banner]");
    if (!bannerElement) return;

    const sourceElement = bannerElement.querySelector("source");
    if (sourceElement) {
      const srcsetLang = sourceElement.getAttribute(`data-i18n-srcset-${lang}`);
      if (srcsetLang) sourceElement.setAttribute("srcset", srcsetLang);
    }

    const imgElement = bannerElement.querySelector("img");
    if (imgElement) {
      const srcLang = imgElement.getAttribute(`data-i18n-src-${lang}`);
      if (srcLang) imgElement.setAttribute("src", srcLang);
    }

    const video = bannerElement.querySelector("video.background-hero");
    if (video) {
      const poster = video.getAttribute(`data-i18n-poster-${lang}`);
      if (poster) video.setAttribute("poster", poster);
    }
  })();

  /* =========================
     3) Motor de reservaciones
     ========================= */
  function buildReservationURL(target, rooms, adults, childrenAges) {
    const domain = "res.hotelessolaris.com";
    const today = calendar.getToday();
    const checkIn  = calendar.getNext(today, "d", 1);
    const checkOut = calendar.getNext(today, "d", 3);

    let roomString = "";
    for (let i = 0; i < rooms; i++) {
      roomString += `&rooms%5B${i + 1}%5D%5Badults%5D=${adults[i] || 2}&rooms%5B${i + 1}%5D%5Bminors%5D=0`;
      if (childrenAges[i]) {
        for (let j = 0; j < childrenAges[i].length; j++) {
          roomString += `&rooms%5B${i + 1}%5D%5Bages%5D%5B${j + 1}%5D=${childrenAges[i][j]}`;
        }
      }
    }

    const currency = (target === "rooms") ? "usd" : "mxn";
    return `https://${domain}/${target}?action=hotel_search&resort=5&roomsAmount=${rooms}${roomString}&currency=${currency}&br=1&cin=${dateParser(checkIn)}&cout=${dateParser(checkOut)}`;
  }

  // CTA solo para banner y carrusel de habitaciones
  (function initScopedReservationButtons(){
    const banner       = document.querySelector('.banner-slider');
    const roomsSection = document.querySelector('.rooms-carrousel');

    const handleReservationClick = (e) => {
      const link = e.target.closest('a.button-book-now');
      if (!link) return;

      e.preventDefault();
      e.stopPropagation();

      const card = link.closest('.tarjeta');
      const roomType =
        card?.dataset?.roomType ||
        card?.getAttribute('data-room-type') ||
        'standard';

      const ROOM_CONFIG = {
        standard: { rooms: 1, adults: [2], childrenAges: [[]] }
      };
      const cfg = ROOM_CONFIG[roomType] || ROOM_CONFIG.standard;

      const target = document.documentElement.lang === 'es' ? 'cuartos' : 'rooms';
      const url = buildReservationURL(target, cfg.rooms, cfg.adults, cfg.childrenAges);

      window.open(url, '_blank', 'noopener');
    };

    banner       && banner.addEventListener('click', handleReservationClick);
    roomsSection && roomsSection.addEventListener('click', handleReservationClick);
  })();

  /* =========================
     4) Formularios
     ========================= */
  (function initPaxForm(){
    const roomsSelect = document.getElementById("rooms");
    roomsSelect && roomsSelect.addEventListener("change", addPaxRows);

    document.addEventListener("input", (event) => {
      if (event.target.classList.contains("minors-input")) {
        updateMinorAges(event);
      }
    });

    initializeDefaultValues();
    updateRoomLabels();

    function addPaxRows() {
      const paxForm = document.getElementById("paxForm");
      if (!paxForm) return;
      paxForm.innerHTML = "";
      const rooms = parseInt(document.getElementById("rooms")?.value || "1", 10);
      for (let i = 1; i <= rooms; i++) createRoomPaxRow(i, paxForm);
    }

    function createRoomPaxRow(key, container) {
      const row = document.createElement("div");
      row.classList.add("fields");

      const label = document.createElement("label");
      label.setAttribute("data-key", key);
      label.textContent = currentLang === 'en' ? `Room #${key}` : `Habitación #${key}`;
      row.appendChild(label);

      const adultsDiv = document.createElement("div");
      adultsDiv.classList.add("field");
      adultsDiv.innerHTML = `
        <label data-label-type="adults">${currentLang === 'en' ? 'Adults' : 'Adultos'}</label>
        <input type="number" name="rooms[${key}][adults]" value="2" min="1" max="4">
      `;
      row.appendChild(adultsDiv);

      const minorsDiv = document.createElement("div");
      minorsDiv.classList.add("field");
      minorsDiv.innerHTML = `
        <label data-label-type="minors">${currentLang === 'en' ? 'Minors' : 'Menores'}</label>
        <input type="number" name="rooms[${key}][minors]" value="0" min="0" max="4" data-room="${key}" class="minors-input">
      `;
      row.appendChild(minorsDiv);

      const agesDiv = document.createElement("div");
      agesDiv.classList.add("field", "ages-container");
      agesDiv.id = `ages-room-${key}`;

      const agesLabel = document.createElement("label");
      agesLabel.classList.add("ages-label");
      agesDiv.appendChild(agesLabel);
      row.appendChild(agesDiv);

      container.appendChild(row);
    }

    function updateRoomLabels() {
      document.querySelectorAll(".fields").forEach(row => {
        const label = row.querySelector("label[data-key]");
        const key = label?.getAttribute("data-key");
        if (label && key) label.textContent = currentLang === 'en' ? `Room #${key}` : `Habitación #${key}`;
        const adultsLabel = row.querySelector("label[data-label-type='adults']");
        if (adultsLabel) adultsLabel.textContent = currentLang === 'en' ? 'Adults' : 'Adultos';
        const minorsLabel = row.querySelector("label[data-label-type='minors']");
        if (minorsLabel) minorsLabel.textContent = currentLang === 'en' ? 'Minors' : 'Menores';
        const agesLabel = row.querySelector(".ages-label");
        if(agesLabel) agesLabel.textContent = currentLang === 'en' ? 'Age' : 'Edad';
      });
    }

    function updateMinorAges(event) {
      const input = event.target;
      const roomKey = input.getAttribute("data-room");
      const minorsCount = parseInt(input.value, 10) || 0;
      const agesContainer = document.getElementById(`ages-room-${roomKey}`);
      if (!agesContainer) return;

      let agesLabel = agesContainer.querySelector(".ages-label");
      if (!agesLabel) {
        agesLabel = document.createElement("label");
        agesLabel.classList.add("ages-label");
        agesContainer.appendChild(agesLabel);
      }
      agesLabel.textContent = currentLang === 'en'
        ? `Ages for Room #${roomKey}`
        : `Edades Habitación #${roomKey}`;

      agesContainer.querySelectorAll("select.minor-age").forEach(s => s.remove());

      for (let i = 0; i < minorsCount; i++) {
        const ageSelect = document.createElement("select");
        ageSelect.name = `rooms[${roomKey}][ages][${i}]`;
        ageSelect.classList.add("minor-age");
        for (let age = 0; age <= 17; age++) {
          const option = document.createElement("option");
          option.value = age;
          option.textContent = age;
          ageSelect.appendChild(option);
        }
        agesContainer.appendChild(ageSelect);
      }
    }

    function initializeDefaultValues() {
      const roomsSelect = document.getElementById("rooms");
      if (roomsSelect) roomsSelect.value = "1";
      addPaxRows();
    }
  })();

  /* =========================
     5) Datepicker (Lightpick)
     ========================= */
  (function initDatePicker(){
    const field = document.getElementById("cc");
    if (!field) return;

    const picker = new Lightpick({
      field,
      parentEl: document.getElementById("calendarParent"),
      minDays: 1,
      firstDay: 7,
      format: "YYYY-MM-DD",
      lang: currentLang,
      minDate: moment().add(1, "days"),
      singleDate: false,
      hideOnBodyClick: false,
      hoveringTooltip: false,
      onSelect: function (start, end) {
        let str = "";
        let visible = "";
        if (start) {
          str += start.format("DD/MM/YYYY") + " -> ";
          document.getElementById("cin").value = start.format("YYYY-MM-DD");
          visible = start.format("DD/MM/YY");
        }
        if (end) {
          str += end.format("DD/MM/YYYY");
          visible += (currentLang === 'en' ? " to " : " a ") + end.format("DD/MM/YY");
          document.getElementById("cout").value = end.format("YYYY-MM-DD");
          picker.hide();
        }
        field.value = str;
        field.placeholder = visible;
        if (start && end) {
          picker.setStartDate(null);
          picker.setEndDate(null);
        }
      },
    });

    field.value = currentLang === 'en' ? "Check in - Check out" : "Llegada - Salida";

    const form = document.getElementById("reservation-form");
    if (form) {
      form.addEventListener("submit", (event) => {
        const cin = document.getElementById("cin").value;
        const cout = document.getElementById("cout").value;
        if (!cin || !cout) {
          event.preventDefault();
          showCustomAlert(currentLang === 'en'
            ? "Please select both Check-in and Check-out dates."
            : "Por favor selecciona fechas de Llegada y Salida.");
          field.focus();
        }
      });
    }

    function showCustomAlert(message) {
      const alertBox = document.getElementById("customAlert");
      const alertMessage = document.getElementById("customAlertMessage");
      const closeBtn = document.getElementById("customAlertClose");

      alertMessage.textContent = message;
      alertBox.style.display = "flex";

      closeBtn.onclick = () => { alertBox.style.display = "none"; };
      alertBox.onclick = (e) => { if (e.target === alertBox) alertBox.style.display = "none"; };
    }
  })();

  /* =========================
     6) Componentes visuales
     ========================= */
  (function initBannerSlider(){
    const bannerImages = document.querySelectorAll(".banner-slider img");
    if (bannerImages.length === 0) return;

    let bannerIndex = 0;
    bannerImages[0].classList.add("active");
    setInterval(() => {
      bannerImages[bannerIndex].classList.remove("active");
      bannerIndex = (bannerIndex + 1) % bannerImages.length;
      bannerImages[bannerIndex].classList.add("active");
    }, 3000);
  })();

  // Slider de restaurantes
  (function initSlideShow(){
    const slidesContainer = document.querySelector(".restaurant-slides");
    const slides = document.querySelectorAll(".restaurant-container");
    const prevButton = document.querySelector(".restaurant-arrow-left");
    const nextButton = document.querySelector(".restaurant-arrow-right");
    if (!slidesContainer || slides.length === 0 || !prevButton || !nextButton) return;

    let index = 0;
    const update = () => {
      slidesContainer.style.transition = 'transform .35s ease';
      slidesContainer.style.transform = `translateX(${-index * 100}%)`;
    };
    prevButton.addEventListener("click", () => { index = (index - 1 + slides.length) % slides.length; update(); });
    nextButton.addEventListener("click", () => { index = (index + 1) % slides.length; update(); });
  })();

  /* =========================
     7) Galería (preview + modal)
     ========================= */
  function initGaleria(){
    const galleryPreview = document.querySelector(".gallery-preview");
    const modal = document.getElementById("gallery-modal");
    const modalCloseButton = document.getElementById("close-modal");
    const prevSlideButton = document.getElementById("prev-slide");
    const nextSlideButton = document.getElementById("next-slide");
    const sliderImagesContainer = document.querySelector(".slider-images");

    if (!galleryPreview || !modal || !modalCloseButton || !prevSlideButton || !nextSlideButton || !sliderImagesContainer) {
      console.error("[Galería] Faltan elementos requeridos en el DOM.");
      return;
    }

    const galleryImages = [
      { src: "./assets/gallery/GRSL01.webp",  alt: "Faro_GR_Solaris_Los_Cabos" },
      { src: "./assets/gallery/GRSL02.webp",  alt: "Fachada_GR_Solaris_Los_Cabos" },
      { src: "./assets/gallery/GRSL03.webp",  alt: "Restaurante_GR_Solaris_Los_Cabos" },
      { src: "./assets/gallery/GRSL04.webp",  alt: "Sushi_El_Faro_Los_Cabos" },
      { src: "./assets/gallery/GRSL05.webp",  alt: "Fuente_Delfin_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL06.webp",  alt: "Lobby_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL07.webp",  alt: "Bufet_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL08.webp",  alt: "Panoramica_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL09.webp",  alt: "Alberca_Camastros_Playa_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL10.webp", alt: "Cafe-Flameadoa_GR_Solaris_Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL11.webp", alt: "Alberca_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL12.webp", alt: "Alberca_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL13.webp", alt: "Jacuzzi_spa_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL14.webp", alt: "Restaurante_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL15.webp", alt: "Lobby_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL16.webp", alt: "Lobby_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL17.webp", alt: "Playa_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL18.webp", alt: "Restaurante_GR_Solaris__Lighthouse_Los_Cabos" },
      { src: "./assets/gallery/GRSL19.webp", alt: "Alberca_GR_Solaris__Lighthouse_Los_Cabos" },
    ];

    let currentIndex = 0;

    const renderGalleryPreview = () => {
      galleryPreview.innerHTML = "";
      galleryImages.forEach((image, index) => {
        const img = document.createElement("img");
        img.src = image.src;
        img.alt = image.alt;
        img.decoding = "async";
        img.loading = "lazy";
        img.style.setProperty("--delay", index);
        img.addEventListener("click", () => openModal(index));
        galleryPreview.appendChild(img);
      });
    };

    const renderSliderImages = () => {
      sliderImagesContainer.innerHTML = "";
      galleryImages.forEach((image) => {
        const img = document.createElement("img");
        img.src = image.src;
        img.alt = image.alt;
        img.decoding = "async";
        sliderImagesContainer.appendChild(img);
      });
    };

    const lockScroll = () => { document.body.style.overflow = "hidden"; };
    const unlockScroll = () => { document.body.style.overflow = ""; };

    const openModal = (index) => {
      currentIndex = index;
      updateSliderPosition();
      modal.style.display = "flex";
      lockScroll();
      modalCloseButton.focus();
    };

    const closeModal = (e) => {
      if (!e || e.target === modal || e.target === modalCloseButton) {
        modal.style.display = "none";
        unlockScroll();
      }
    };

    const updateSliderPosition = () => {
      sliderImagesContainer.style.transform = `translateX(${-currentIndex * 100}%)`;
    };

    const prevSlide = () => {
      currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
      updateSliderPosition();
    };

    const nextSlide = () => {
      currentIndex = (currentIndex + 1) % galleryImages.length;
      updateSliderPosition();
    };

    modal.addEventListener("click", closeModal);
    modalCloseButton.addEventListener("click", (e) => closeModal(e));
    prevSlideButton.addEventListener("click", prevSlide);
    nextSlideButton.addEventListener("click", nextSlide);

    document.addEventListener("keydown", (e) => {
      if (modal.style.display === "flex") {
        if (e.key === "ArrowLeft") prevSlide();
        if (e.key === "ArrowRight") nextSlide();
        if (e.key === "Escape") closeModal(); // sin evento, cierra igual
      }
    });

    let touchStartX = 0;
    sliderImagesContainer.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    sliderImagesContainer.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        if (dx > 0) prevSlide();
        else nextSlide();
      }
    }, { passive: true });

    const safeInit = () => {
      try {
        renderGalleryPreview();
        renderSliderImages();
      } catch (err) {
        console.error("[Galería] Error renderizando:", err);
      }
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting || entry.intersectionRatio > 0) {
              safeInit();
              obs.disconnect();
            }
          });
        },
        { root: null, threshold: 0.01 }
      );

      setTimeout(() => {
        try { observer.observe(galleryPreview); } catch { safeInit(); }
      }, 0);

      setTimeout(() => {
        const imgs = galleryPreview.querySelectorAll("img");
        if (!imgs.length) safeInit();
      }, 800);
    } else {
      safeInit();
    }
  }

  /* =========================
     8) Carruseles + Lazy init
     ========================= */
  const ActiveTimers = new Set();
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ActiveTimers.forEach(id => clearInterval(id)), ActiveTimers.clear();
    else document.querySelectorAll('[data-carousel]').forEach(el => el.__resume?.());
  });

  function initRoomsCarousel(root){
    const track    = root.querySelector('.rc-track');
    const viewport = root.querySelector('.rc-viewport');
    const prevBtn  = root.querySelector('.rc-prev');
    const nextBtn  = root.querySelector('.rc-next');
    const dotsWrap = root.querySelector('.rc-dots');
    const cards    = Array.from(root.querySelectorAll('.rc-card'));
    if(!track || !viewport || !cards.length) return;

    let index = 0, step = 0, maxIndex = 0;
    let downX = 0, isDragging = false, baseX = 0;

    function measure(){
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap || cs.gap) || 0;
      const cardW = cards[0].getBoundingClientRect().width;
      step = cardW + gap;
      const visible = Math.max(1, Math.floor((viewport.clientWidth + gap) / step));
      maxIndex = Math.max(0, cards.length - visible);
    }
    function slideTo(i, smooth=true){
      index = Math.max(0, Math.min(i, maxIndex));
      track.style.transition = smooth && !REDUCED_MOTION ? 'transform .35s cubic-bezier(.2,.7,.2,1)' : 'none';
      track.style.transform  = `translateX(${-index * step}px)`;
      prevBtn && (prevBtn.disabled = (index <= 0));
      nextBtn && (nextBtn.disabled = (index >= maxIndex));
      updateDots();
    }
    function buildDots(){
      if(!dotsWrap) return;
      dotsWrap.innerHTML = '';
      cards.forEach((_, i)=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rc-dot';
        b.setAttribute('aria-label', `Ir a la tarjeta ${i+1}`);
        b.addEventListener('click', ()=> slideTo(i));
        dotsWrap.appendChild(b);
      });
      updateDots();
    }
    function updateDots(){
      if(!dotsWrap) return;
      dotsWrap.querySelectorAll('.rc-dot').forEach((d,i)=>d.classList.toggle('is-active', i===index));
    }

    prevBtn?.addEventListener('click', ()=> slideTo(index-1));
    nextBtn?.addEventListener('click', ()=> slideTo(index+1));

    viewport.style.touchAction = 'pan-y';
    track.style.cursor = 'grab';
    viewport.addEventListener('pointerdown', (e)=>{
      // No bloquear clicks en CTAs
      if (e.target.closest('.button-book-now')) return;
      isDragging = true; track.style.cursor='grabbing'; track.style.transition='none';
      downX = e.clientX; baseX = -index*step; viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e)=>{
      if(!isDragging || e.target.closest('.button-book-now')) return;
      const dx = e.clientX - downX;
      track.style.transform = `translateX(${baseX + dx}px)`;
    });
    function endDrag(e){
      if(!isDragging || e.target.closest('.button-book-now')) return;
      isDragging=false; track.style.cursor='grab';
      const dx = e.clientX - downX;
      const moved = baseX + dx;
      const targetIndex = Math.round(-moved / step);
      const threshold = step * 0.25;
      if (Math.abs(dx) > threshold) slideTo(targetIndex, true);
      else slideTo(index, true);
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    function onResize(){ const prev=index; measure(); slideTo(Math.min(prev, maxIndex), false); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    let autoplayId = null;
    root.__pause  = ()=>{ if(autoplayId){ clearInterval(autoplayId); ActiveTimers.delete(autoplayId); autoplayId=null; } };
    root.__resume = ()=>{ if(REDUCED_MOTION) return; if(!autoplayId){ autoplayId = setInterval(()=> nextBtn?.click(), 6000); ActiveTimers.add(autoplayId); } };

    measure(); buildDots(); slideTo(0, false);
    root.__resume?.();
  }

  function initRestaurantsCarousel(root){
    const slidesContainer = root.querySelector('.restaurant-slides');
    const slides = root.querySelectorAll('.restaurant-container');
    const prevButton = root.querySelector('.restaurant-arrow-left');
    const nextButton = root.querySelector('.restaurant-arrow-right');
    if(!slidesContainer || !slides.length) return;

    let index = 0;
    const update = ()=> {
      slidesContainer.style.transition = !REDUCED_MOTION ? 'transform .35s ease' : 'none';
      slidesContainer.style.transform = `translate3d(${-index*100}%,0,0)`;
    };
    prevButton?.addEventListener('click', ()=>{ index = (index - 1 + slides.length) % slides.length; update(); });
    nextButton?.addEventListener('click', ()=>{ index = (index + 1) % slides.length; update(); });

    let sx=0;
    slidesContainer.addEventListener('touchstart', e=>{ sx = e.changedTouches[0].clientX; }, {passive:true});
    slidesContainer.addEventListener('touchend', e=>{
      const dx = e.changedTouches[0].clientX - sx;
      if(Math.abs(dx) > 40) dx<0 ? nextButton?.click() : prevButton?.click();
    }, {passive:true});

    let id=null;
    root.__pause  = ()=>{ if(id){ clearInterval(id); ActiveTimers.delete(id); id=null; } };
    root.__resume = ()=>{ if(REDUCED_MOTION) return; if(!id){ id=setInterval(()=>nextButton?.click(), 7000); ActiveTimers.add(id);} };

    update(); root.__resume?.();
  }

  function initBenefitsCarousel(root){
    initRoomsCarousel(root);
  }
  function initExperiencesCarousel(root){
    if (window.matchMedia('(max-width: 768px)').matches) return;
    initRoomsCarousel(root);
  }
  function initGalleryLazy(root){
    requestIdleCallback?.(()=> initGaleria()) ?? setTimeout(()=>initGaleria(), 0);
  }

  (function lazyCarousels(){
    const nodes = document.querySelectorAll('[data-carousel]');
    const inited = new WeakSet();

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries)=>{
          entries.forEach(entry=>{
            const el = entry.target;
            if(entry.isIntersecting && !inited.has(el)){
              const type = el.getAttribute('data-carousel');
              const initMap = {
                rooms: initRoomsCarousel,
                rest: initRestaurantsCarousel,
                benefits: initBenefitsCarousel,
                experiences: initExperiencesCarousel,
                gallery: initGalleryLazy
              };
              requestIdleCallback?.(()=> initMap[type]?.(el)) ?? initMap[type]?.(el);
              inited.add(el);
            }
            if(!entry.isIntersecting) el.__pause?.();
            else el.__resume?.();
          });
        }, {threshold: 0.25})
      : null;

    nodes.forEach(el=>{
      if(io) io.observe(el);
      else {
        const type = el.getAttribute('data-carousel');
        ({rooms:initRoomsCarousel, rest:initRestaurantsCarousel, benefits:initBenefitsCarousel, experiences:initExperiencesCarousel, gallery:initGalleryLazy}[type])?.(el);
      }
    });
  })();

  /* =========================
     9) Bootstrap final
     ========================= */
  (function toggleWhatsAppButton(){
    const whatsappButton = document.getElementById('whatsappButton');
    // Si en el futuro quieres lógica por idioma o dispositivo, hazlo aquí.
    void whatsappButton;
  })();

});
