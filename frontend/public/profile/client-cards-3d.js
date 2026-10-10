(() => {
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  let active = null, frame = 0;

  const reset = () => {
    if (!active) return;
    ['--rx','--ry','--gx','--gy'].forEach(
      name => active.style.removeProperty(name)
    );
    active = null;
  };

  document.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches) {
      reset();
      return;
    }
    const card = event.target instanceof Element
      ? event.target.closest('.client-library-card') : null;
    if (!card) { reset(); return; }
    if (active !== card) { reset(); active = card; }

    const bounds = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1,
      (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1,
      (event.clientY - bounds.top) / bounds.height));

    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (active !== card) return;
      card.style.setProperty('--rx', `${(0.5-y)*7}deg`);
      card.style.setProperty('--ry', `${(x-0.5)*7}deg`);
      card.style.setProperty('--gx', `${x*100}%`);
      card.style.setProperty('--gy', `${y*100}%`);
    });
  });

  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) reset();
  });
  document.addEventListener('scroll', reset, {passive:true});
  window.addEventListener('blur', reset);
  reduced.addEventListener('change', reset);
})();