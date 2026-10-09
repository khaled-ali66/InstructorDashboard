// Fake backend: intercepts fetch('/api/...') so the dashboard runs without a server.
(function () {
  const realFetch = window.fetch.bind(window);
  const cats = ['Programming', 'Design', 'Business', 'Data'];
  const titles = ['C# من الصفر', 'ASP.NET Core API', 'JavaScript المتقدم', 'UI/UX Basics', 'Figma للمبتدئين', 'إدارة المشاريع', 'Python للتحليل', 'SQL Server', 'React Fundamentals', 'التسويق الرقمي', 'Power BI', 'Clean Architecture', 'Docker للمطورين', 'ريادة الأعمال'];
  const db = {
    courses: titles.map((t, i) => ({ id: i + 1, title: t, category: cats[i % 4], price: 100 + i * 35, students: 20 + i * 13, published: i % 3 !== 0, rating: +(3.8 + (i % 5) * 0.25).toFixed(1), description: 'وصف تفصيلي لكورس ' + t })),
    reviews: Array.from({ length: 18 }, (_, i) => ({ id: i + 1, courseId: (i % 14) + 1, courseTitle: titles[i % 14], student: ['أحمد', 'سارة', 'محمود', 'منى', 'يوسف'][i % 5], rating: 3 + (i % 3), comment: ['شرح ممتاز', 'محتوى مفيد جدًا', 'محتاج أمثلة أكتر', 'أفضل كورس خدته'][i % 4], date: '2026-10-' + String(1 + (i % 9)).padStart(2, '0') })),
    sales: [1200, 1900, 1500, 2300, 2100, 2800, 3100],
    activity: ['طالب جديد سجل في ASP.NET Core API', 'تقييم جديد 5★ على C# من الصفر', 'طلب شراء جديد بقيمة 450', 'طالب سجل في React Fundamentals']
  };
  const resp = (s, d) => new Response(s === 204 ? null : JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
  const wait = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }); });
  function validate(b) {
    const f = {};
    if (!b.title || b.title.trim().length < 3) f.title = 'العنوان 3 حروف على الأقل';
    if (!cats.includes(b.category)) f.category = 'اختر تصنيف';
    if (!(b.price >= 0 && b.price <= 10000)) f.price = 'السعر بين 0 و 10000';
    if (!b.description || b.description.trim().length < 10) f.description = 'الوصف 10 حروف على الأقل';
    return f;
  }
  window.Mock = { failMutations: false, categories: cats };
  window.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('/api')) return realFetch(url, opts);
    await wait(Math.random() < 0.05 ? 4000 : 250 + Math.random() * 450, opts.signal); // 5% slow -> triggers timeout+retry
    const u = new URL(url, 'http://x'), q = u.searchParams, m = opts.method || 'GET', p = u.pathname;
    const body = opts.body ? JSON.parse(opts.body) : {};
    if (m === 'GET' && Math.random() < 0.1) return resp(503, { message: 'الخدمة غير متاحة مؤقتًا' }); // transient error
    if (m !== 'GET' && Mock.failMutations) return resp(500, { message: 'خطأ في السيرفر (محاكاة)' });
    let r;
    if (p === '/api/courses' && m === 'GET') {
      const s = (q.get('search') || '').toLowerCase(), c = q.get('category'), page = +q.get('page') || 1, size = +q.get('pageSize') || 6;
      const all = db.courses.filter(x => (!s || x.title.toLowerCase().includes(s)) && (!c || x.category === c));
      return resp(200, { items: all.slice((page - 1) * size, page * size), total: all.length, page, pageSize: size });
    }
    if (p === '/api/courses' && m === 'POST') {
      const f = validate(body); if (Object.keys(f).length) return resp(422, { message: 'بيانات غير صحيحة', fields: f });
      const c = { id: Math.max(0, ...db.courses.map(x => x.id)) + 1, students: 0, published: false, rating: 0, ...body }; db.courses.unshift(c); return resp(201, c);
    }
    if ((r = p.match(/^\/api\/courses\/(\d+)$/))) {
      const i = db.courses.findIndex(x => x.id === +r[1]); if (i < 0) return resp(404, { message: 'الكورس غير موجود' });
      if (m === 'GET') return resp(200, db.courses[i]);
      if (m === 'DELETE') { db.courses.splice(i, 1); return resp(204); }
      if (m === 'PATCH') { Object.assign(db.courses[i], body); return resp(200, db.courses[i]); }
      if (m === 'PUT') { const f = validate(body); if (Object.keys(f).length) return resp(422, { message: 'بيانات غير صحيحة', fields: f }); Object.assign(db.courses[i], body); return resp(200, db.courses[i]); }
    }
    if (p === '/api/reviews') {
      const rt = +q.get('rating'), s = (q.get('search') || '').toLowerCase();
      return resp(200, db.reviews.filter(x => (!rt || x.rating === rt) && (!s || (x.comment + x.courseTitle + x.student).toLowerCase().includes(s))));
    }
    if (p === '/api/stats') return resp(200, { revenue: db.sales.reduce((a, b) => a + b, 0), students: db.courses.reduce((a, c) => a + c.students, 0), courses: db.courses.length, avgRating: +(db.reviews.reduce((a, x) => a + x.rating, 0) / db.reviews.length).toFixed(1), sales: db.sales });
    if (p === '/api/activity') return resp(200, db.activity);
    return resp(404, { message: 'Not found' });
  };
})();
