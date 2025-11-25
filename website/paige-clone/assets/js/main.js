document.addEventListener('DOMContentLoaded', () => {
  const closeButton = document.querySelector('.announcement-bar__close');
  const announcement = document.querySelector('.announcement-bar');
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const revealTargets = document.querySelectorAll('.reveal');
  const menuToggle = document.querySelector('.menu-toggle');
  const menuPanel = document.querySelector('.menu-panel');
  const menuClose = menuPanel ? menuPanel.querySelector('.menu-panel__close') : null;
  const menuBackdrop = menuPanel ? menuPanel.querySelector('.menu-panel__backdrop') : null;

  if (closeButton && announcement) {
    closeButton.addEventListener('click', () => {
      announcement.classList.add('is-hidden');
      document.body.classList.add('announcement-dismissed');
    });
  }
  if (announcement && announcement.classList.contains('is-hidden')) {
    document.body.classList.add('announcement-dismissed');
  }

  const toggleHeaderState = () => {
    if (!header) return;
    const threshold = hero ? hero.offsetHeight * 0.3 : 180;
    if (window.scrollY > threshold) {
      header.classList.add('site-header--scrolled');
    } else {
      header.classList.remove('site-header--scrolled');
    }
  };

  toggleHeaderState();
  window.addEventListener('scroll', toggleHeaderState, { passive: true });

  if (revealTargets.length) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );

    revealTargets.forEach(target => observer.observe(target));
  }

  const closeMenuPanel = () => {
    if (!menuPanel) return;
    menuPanel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.focus({ preventScroll: true });
    }
  };

  const openMenuPanel = () => {
    if (!menuPanel) return;
    menuPanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'true');
    }
  };

  if (menuToggle && menuPanel) {
    menuToggle.addEventListener('click', () => {
      if (document.body.classList.contains('menu-open')) {
        closeMenuPanel();
      } else {
        openMenuPanel();
      }
    });
  }

  if (menuClose) {
    menuClose.addEventListener('click', closeMenuPanel);
  }

  if (menuBackdrop) {
    menuBackdrop.addEventListener('click', closeMenuPanel);
  }

  document.addEventListener('keyup', event => {
    if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenuPanel();
    }
  });
});
