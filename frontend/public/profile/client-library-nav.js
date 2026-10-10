
(() => {
  const nav=document.getElementById('main-navigation');
  if(nav && !nav.querySelector('.client-library-nav')){
    const link=document.createElement('a');
    link.href='/profile/client-library/';
    link.className='client-library-nav';
    link.dataset.en='Client Library';
    link.dataset.ar='????? ???????';
    link.textContent=document.documentElement.lang==='ar'?'????? ???????':'Client Library';
    nav.prepend(link);
  }
})();
