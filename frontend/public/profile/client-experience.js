(() => {
  const hero = document.querySelector('.hero-copy');
  if (!hero || document.getElementById('client-field-picker')) return;

  const content = {
    doctor: {
      en: ['Your expertise.', 'Clearly understood.',
        'Medical explanations, patient education and professional introductions — produced around your message.'],
      ar: ['خبرتك الطبية.', 'رسالة واضحة.',
        'شرح طبي وتوعية للمرضى وتعريف مهني — إنتاج يركز على رسالتك.']
    },
    educator: {
      en: ['Your knowledge.', 'Beautifully produced.',
        'Lectures, course series and worked solutions — with interactive teaching and clear recording.'],
      ar: ['معرفتك.', 'بإنتاج يليق بها.',
        'محاضرات وسلاسل تعليمية وحلول تطبيقية — بشرح تفاعلي وتسجيل واضح.']
    },
    business: {
      en: ['Your business.', 'Worth watching.',
        'Product stories, brand introductions and social videos — created to explain what makes your business different.'],
      ar: ['علامتك التجارية.', 'تستحق المشاهدة.',
        'قصص منتجات وتعريف بالعلامة وفيديوهات للتواصل — لإظهار ما يميز نشاطك.']
    }
  };

  let selected = '';
  const picker = document.createElement('div');
  picker.id = 'client-field-picker';
  picker.className = 'client-field-picker';

  const label = document.createElement('p');
  picker.append(label);
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  picker.append(group);

  const names = {
    doctor: ['Doctor', 'طبيب'],
    educator: ['Educator', 'محاضر'],
    business: ['Business owner', 'صاحب نشاط']
  };

  function refresh() {
    const arabic = document.documentElement.lang === 'ar';
    label.textContent = arabic ? 'اختر مجالك' : 'Choose your field';
    group.setAttribute('aria-label', label.textContent);

    group.querySelectorAll('button').forEach(button => {
      button.textContent = names[button.dataset.field][arabic ? 1 : 0];
      button.setAttribute('aria-pressed',
        String(button.dataset.field === selected));
    });

    if (selected) {
      const text = content[selected];
      const heading = hero.querySelector('h1 > span');
      const emphasis = hero.querySelector('h1 em');
      const intro = hero.querySelector('.hero-intro');

      [heading, emphasis, intro].forEach((element, index) => {
        if (!element) return;
        element.dataset.en = text.en[index];
        element.dataset.ar = text.ar[index];
        element.textContent = text[arabic ? 'ar' : 'en'][index];
      });
    }

    const whatsapp = document.getElementById('client-floating-whatsapp');
    whatsapp.textContent = arabic ? 'ناقش مشروعك على واتساب ↗'
                                  : 'Discuss your shoot ↗';
    const field = selected ? names[selected][arabic ? 1 : 0] : '';
    const message = arabic
      ? 'مرحباً SMART SHOOTS، أود مناقشة مشروع تصوير.' + (field ? '\nالمجال: ' + field : '')
      : 'Hello SMART SHOOTS, I would like to discuss a shoot.' + (field ? '\nField: ' + field : '');
    whatsapp.href = 'https://wa.me/201039331699?text=' +
                    encodeURIComponent(message);
  }

  Object.keys(names).forEach(field => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.field = field;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      selected = field;
      refresh();
    });
    group.append(button);
  });

  const actions = hero.querySelector('.hero-actions');
  hero.insertBefore(picker, actions);

  const whatsapp = document.createElement('a');
  whatsapp.id = 'client-floating-whatsapp';
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  document.body.append(whatsapp);

  new MutationObserver(refresh).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang']
  });
  refresh();
})();
