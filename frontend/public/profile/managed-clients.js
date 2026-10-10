
(() => {
  const grids=[...document.querySelectorAll('.client-library-grid')];
  if(!grids.length)return;
  let published=[];
  function render(){
    const ar=document.documentElement.lang==='ar';
    grids.forEach(grid=>{
      grid.querySelectorAll('[data-managed-client]').forEach(el=>el.remove());
      const names=new Set([...grid.querySelectorAll('h3')].map(
        el=>(el.dataset.en||el.textContent).trim().toLowerCase()
      ));
      published.forEach(profile=>{
        if(!profile.name||names.has(profile.name.trim().toLowerCase()))return;
        names.add(profile.name.trim().toLowerCase());
        const card=document.createElement('article');
        card.className='client-library-card';
        card.dataset.managedClient=profile.id;
        const frame=document.createElement('div');
        frame.className='client-library-image';
        if(profile.photo_url){
          const url=new URL(profile.photo_url,location.origin);
          if(url.origin===location.origin){
            const image=document.createElement('img');
            image.src=url.href;image.alt=profile.name;image.loading='lazy';
            frame.append(image);
          }
        }
        const body=document.createElement('div');
        body.className='client-library-body';
        const category=document.createElement('p');
        category.className='client-library-category';
        category.textContent=profile.speciality||'';
        const title=document.createElement('h3');
        title.textContent=profile.name;
        body.append(category,title);
        const description=ar?profile.bio_ar:profile.bio_en;
        if(description){
          const p=document.createElement('p');
          p.textContent=description;
          body.append(p);
        }
        card.append(frame,body);
        grid.append(card);
      });
    });
  }
  fetch('/api/academy/public',{cache:'no-store'})
    .then(response=>{
      if(!response.ok)throw new Error('Profiles unavailable');
      return response.json();
    })
    .then(data=>{
      published=Array.isArray(data.results)?data.results:[];
      render();
    })
    .catch(()=>{});
  new MutationObserver(render).observe(document.documentElement,{
    attributes:true,attributeFilter:['lang']
  });
})();
