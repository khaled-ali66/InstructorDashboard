// ===== Pages layer: compose services + components =====
const Pages = {
  dashboard(root) {
    root.innerHTML = '<h2>Dashboard</h2><div id="box"></div>';
    UI.load($('#box'), {
      loader: () => Promise.all([OrdersService.stats(), OrdersService.activity()]), // parallel requests
      render: ([s, act]) => {
        const max = Math.max(...s.sales), days = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
        const bars = s.sales.map((v, i) => { const h = v / max * 140; return `<rect x="${i * 60 + 20}" y="${160 - h}" width="36" height="${h}" rx="6" fill="#4f46e5"><title>${v}</title></rect><text x="${i * 60 + 38}" y="176" text-anchor="middle" font-size="11">${days[i]}</text>`; }).join('');
        return `<div class="grid">${UI.stat('الإيرادات', s.revenue + ' ج')}${UI.stat('الطلاب', s.students)}${UI.stat('الكورسات', s.courses)}${UI.stat('متوسط التقييم', s.avgRating + ' ★')}</div>
        <div class="card"><b>مبيعات آخر 7 أيام</b><svg class="chart" viewBox="0 0 440 185">${bars}</svg></div>
        <div class="card" style="margin-top:12px"><b>آخر النشاط</b>${act.map(a => `<div class="act">🔔 ${esc(a)}</div>`).join('')}</div>`;
      }
    });
  },

  courses(root) {
    const st = { search: '', category: '', page: 1, size: 6, items: [], total: 0, req: 0 };
    root.innerHTML = `<h2>الكورسات</h2><div class="toolbar"><input id="q" placeholder="ابحث..."><select id="cat"><option value="">كل التصنيفات</option>${Mock.categories.map(c => `<option>${c}</option>`).join('')}</select><a class="btn" href="#/courses/new">+ كورس جديد</a></div><div class="card" id="list"></div>`;
    const list = $('#list');
    const draw = () => {
      if (!st.items.length && !st.total) { list.innerHTML = UI.empty('لا توجد كورسات مطابقة', 'أضف كورس', '#/courses/new'); return; }
      list.innerHTML = `<table><tr><th>العنوان</th><th>التصنيف</th><th>السعر</th><th>طلاب</th><th>منشور</th><th></th></tr>${st.items.map(c => `<tr data-id="${c.id}"><td>${esc(c.title)}</td><td>${esc(c.category)}</td><td>${c.price}</td><td>${c.students}</td><td><input type="checkbox" data-toggle ${c.published ? 'checked' : ''} style="width:auto"></td><td><a class="btn sec" href="#/courses/${c.id}">تعديل</a> <button class="btn danger" data-del>حذف</button></td></tr>`).join('')}</table>${UI.pager(st.page, st.total, st.size)}`;
    };
    const refresh = async () => {
      const my = ++st.req; list.innerHTML = UI.skeleton(6);
      try {
        const r = await CoursesService.list({ search: st.search, category: st.category, page: st.page, pageSize: st.size });
        if (my !== st.req) return; // ignore stale responses
        st.items = r.items; st.total = r.total; draw();
      } catch (e) { if (my !== st.req) return; list.innerHTML = UI.error(e.message); $('[data-retry]', list).onclick = refresh; }
    };
    $('#q').oninput = debounce(e => { st.search = e.target.value; st.page = 1; refresh(); }, 300);
    $('#cat').onchange = e => { st.category = e.target.value; st.page = 1; refresh(); }; // dynamic filtering
    list.onclick = async e => {
      const pg = e.target.closest('[data-page]'); if (pg) { st.page = +pg.dataset.page; return refresh(); }
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const id = +tr.dataset.id, idx = st.items.findIndex(c => c.id === id), course = st.items[idx];
      if (e.target.matches('[data-del]')) {
        if (!await Modal.confirm('حذف الكورس', `هل تريد حذف "${course.title}"؟`)) return;
        st.items.splice(idx, 1); st.total--; draw(); // optimistic delete
        try { await CoursesService.remove(id); Toast.show('تم الحذف'); }
        catch (err) { st.items.splice(idx, 0, course); st.total++; draw(); handleError(err); Toast.error('تم التراجع عن الحذف'); } // rollback
      }
    };
    list.onchange = async e => {
      if (!e.target.matches('[data-toggle]')) return;
      const tr = e.target.closest('tr'), c = st.items.find(x => x.id === +tr.dataset.id), prev = c.published;
      c.published = e.target.checked; // optimistic toggle
      try { await CoursesService.setPublished(c.id, c.published); Toast.show(c.published ? 'تم النشر' : 'تم إلغاء النشر'); }
      catch (err) { c.published = prev; e.target.checked = prev; handleError(err); } // rollback
    };
    refresh();
  },

  courseForm(root, id) {
    const rules = {
      title: v => v.trim().length < 3 ? 'العنوان 3 حروف على الأقل' : '',
      category: v => v ? '' : 'اختر تصنيف',
      price: v => v === '' || +v < 0 || +v > 10000 ? 'السعر بين 0 و 10000' : '',
      description: v => v.trim().length < 10 ? 'الوصف 10 حروف على الأقل' : ''
    };
    root.innerHTML = `<h2>${id ? 'تعديل كورس' : 'كورس جديد'}</h2><div class="card" id="box"></div>`;
    const build = c => {
      $('#box').innerHTML = `<form id="f" novalidate>
        <div class="field"><label>العنوان</label><input name="title" value="${esc(c?.title)}"><div class="err"></div></div>
        <div class="field"><label>التصنيف</label><select name="category"><option value="">اختر...</option>${Mock.categories.map(x => `<option ${c?.category === x ? 'selected' : ''}>${x}</option>`).join('')}</select><div class="err"></div></div>
        <div class="field"><label>السعر</label><input name="price" type="number" value="${c?.price ?? ''}"><div class="err"></div></div>
        <div class="field"><label>الوصف</label><textarea name="description" rows="4">${esc(c?.description)}</textarea><div class="err"></div></div>
        <button class="btn" id="save">حفظ</button> <a class="btn sec" href="#/courses">إلغاء</a></form>`;
      const f = $('#f'), check = el => { const msg = rules[el.name](el.value); el.closest('.field').classList.toggle('bad', !!msg); el.closest('.field').querySelector('.err').textContent = msg; return !msg; };
      f.querySelectorAll('input,select,textarea').forEach(el => { el.oninput = el.onchange = () => check(el); }); // instant validation
      f.onsubmit = async e => {
        e.preventDefault();
        const els = [...f.elements].filter(x => x.name), ok = els.map(check).every(Boolean); if (!ok) return;
        const data = Object.fromEntries(els.map(x => [x.name, x.name === 'price' ? +x.value : x.value])), btn = $('#save');
        btn.disabled = true; btn.innerHTML = '<span class="spin"></span> جارٍ الحفظ';
        try { id ? await CoursesService.update(id, data) : await CoursesService.create(data); Toast.show('تم الحفظ بنجاح'); location.hash = '#/courses'; }
        catch (err) {
          Object.entries(err.fields).forEach(([k, m]) => { const el = f.elements[k]; if (el) { el.closest('.field').classList.add('bad'); el.closest('.field').querySelector('.err').textContent = m; } }); // server field errors
          handleError(err); btn.disabled = false; btn.textContent = 'حفظ';
        }
      };
    };
    if (!id) return build();
    UI.load($('#box'), { loader: () => CoursesService.get(id), render: c => { setTimeout(() => build(c)); return ''; }, skeleton: 4 });
  },

  reviews(root) {
    const st = { rating: '', search: '' };
    root.innerHTML = `<h2>التقييمات</h2><div class="toolbar"><input id="q" placeholder="ابحث في التقييمات..."><select id="r"><option value="">كل التقييمات</option>${[5, 4, 3].map(n => `<option value="${n}">${n} نجوم</option>`).join('')}</select></div><div class="card" id="list"></div>`;
    const load = () => UI.load($('#list'), {
      loader: () => ReviewsService.list(st), isEmpty: d => !d.length, empty: ['لا توجد تقييمات مطابقة'],
      render: d => d.map(r => `<div class="rev"><b>${esc(r.student)}</b> ${UI.stars(r.rating)} <small>على ${esc(r.courseTitle)} · ${r.date}</small><p>${esc(r.comment)}</p></div>`).join('')
    });
    $('#q').oninput = debounce(e => { st.search = e.target.value; load(); }, 300);
    $('#r').onchange = e => { st.rating = e.target.value; load(); };
    load();
  }
};
