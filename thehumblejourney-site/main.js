(function () {
  // ── Mobile nav toggle ────────────────────────────
  const toggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      navLinks.classList.toggle('is-open');
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Photo lightbox ───────────────────────────────
  const photoItems = document.querySelectorAll('.photo-item');
  if (photoItems.length) {
    // Create lightbox elements
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');

    const lbImg = document.createElement('img');
    lbImg.className = 'lightbox__img';
    lbImg.alt = '';

    const lbClose = document.createElement('button');
    lbClose.className = 'lightbox__close';
    lbClose.innerHTML = '&times;';
    lbClose.setAttribute('aria-label', 'Close photo');

    lb.appendChild(lbImg);
    lb.appendChild(lbClose);
    document.body.appendChild(lb);

    function openLightbox(src, alt) {
      lbImg.src = src;
      lbImg.alt = alt || '';
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    }

    function closeLightbox() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      lbImg.src = '';
    }

    photoItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const img = item.querySelector('img');
        if (img) openLightbox(img.src, img.alt);
      });
    });

    lbClose.addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }
})();
