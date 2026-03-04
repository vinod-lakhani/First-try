document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // Lightbox slideshow for gallery
  const imagePaths = [
    'images/01_443.jpg',
    'images/04_409.jpg',
    'images/07_693.jpg',
    'images/11_965.jpg',
    'images/13_34.jpg',
    'images/18_212.jpg',
    'images/19_987.jpg',
    'images/25_212.jpg',
    'images/28_429.jpg',
    'images/31_557.jpg',
    'images/34_189.jpg',
    'images/43_9.jpg',
    'images/46_281.jpg',
    'images/47_321.jpg',
    'images/51_918.jpg',
    'images/53_798.jpg',
    'images/57_818.jpg',
    'images/60_36.jpg',
    'images/63_511.jpg',
    'images/66_866.jpg',
    'images/69_42.jpg',
    'images/72_777.jpg',
    'images/75_966.jpg',
    'images/78_548.jpg',
    'images/79_69.jpg',
    'images/82_506.jpg',
    'images/85_170.jpg',
    'images/tw_86_490.jpg',
    'images/tw_87_845.jpg',
    'images/tw_88_956.jpg',
  ];

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const counterEl = document.getElementById('lightbox-counter');

  let currentIndex = 0;

  function updateLightbox() {
    if (!lightboxImage || !counterEl) return;
    lightboxImage.src = imagePaths[currentIndex];
    counterEl.textContent = `${currentIndex + 1} / ${imagePaths.length}`;
  }

  function openLightbox(index) {
    if (!lightbox) return;
    currentIndex = index;
    updateLightbox();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % imagePaths.length;
    updateLightbox();
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + imagePaths.length) % imagePaths.length;
    updateLightbox();
  }

  const galleryItems = document.querySelectorAll('.gallery-grid .gallery-item');
  galleryItems.forEach((item) => {
    item.addEventListener('click', () => {
      const indexAttr = item.getAttribute('data-index');
      const index = indexAttr ? parseInt(indexAttr, 10) : 0;
      if (!Number.isNaN(index)) {
        openLightbox(index);
      }
    });
  });

  document.querySelectorAll('[data-lightbox-close]').forEach((el) => {
    el.addEventListener('click', () => {
      closeLightbox();
    });
  });

  const prevBtn = document.querySelector('[data-lightbox-prev]');
  const nextBtn = document.querySelector('[data-lightbox-next]');

  if (prevBtn) prevBtn.addEventListener('click', showPrev);
  if (nextBtn) nextBtn.addEventListener('click', showNext);

  document.addEventListener('keydown', (event) => {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      closeLightbox();
    } else if (event.key === 'ArrowRight') {
      showNext();
    } else if (event.key === 'ArrowLeft') {
      showPrev();
    }
  });
});

