// ===== Core layer: utils, ApiClient, UI components =====
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

class ApiError extends Error { constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || {}; } }

// Single place for every HTTP call: timeout (3s), retry for transient errors (GET only), unified errors.
const ApiClient = {
  async request(method, path, { body, params, timeout = 3000, retries = method === 'GET' ? 2 : 0 } = {}) {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)) : '';
    let last;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch('/api' + path + qs, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
        const data = res.status === 204 ? null : await res.json();
        if (!res.ok) throw new ApiError(res.status, data?.message || 'حدث خطأ', data?.fields);
        return data;
      } catch (e) {
        last = e instanceof ApiError ? e : new ApiError(0, e.name === 'AbortError' ? 'انتهت مهلة الطلب' : 'مشكلة في الاتصال');
        if (last.status > 0 && last.status < 500) throw last; // client errors: no retry
        if (attempt < retries) await sleep(300 * (attempt + 1));
      } finally { clearTimeout(timer); }
    }
    throw last;
  },
  get: (p, o) => ApiClient.request('GET', p, o), post: (p, b) => ApiClient.request('POST', p, { body: b }),
  put: (p, b) => ApiClient.request('PUT', p, { body: b }), patch: (p, b) => ApiClient.request('PATCH', p, { body: b }),
  delete: p => ApiClient.request('DELETE', p)
};

// ===== Notification system (single place) =====
const Toast = {
  show(msg, type = 'success') { const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg; $('#toasts').append(el); setTimeout(() => el.remove(), 3500); },
  error: m => Toast.show(m, 'error')
};
const handleError = e => Toast.error(e?.message || 'حدث خطأ غير متوقع'); // centralized error handling

// ===== Reusable components =====
const Modal = {
  confirm(title, text) {
    return new Promise(res => {
      const root = $('#modal-root'); root.innerHTML = `<div class="ov"><div class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn sec" data-r="0">إلغاء</button><button class="btn danger" data-r="1">تأكيد</button></div></div></div>`;
      root.onclick = e => { const b = e.target.closest('[data-r]'); if (b || e.target.classList.contains('ov')) { root.innerHTML = ''; res(b?.dataset.r === '1'); } };
    });
  }
};
const UI = {
  skeleton: (n = 5) => Array.from({ length: n }, () => '<div class="sk"></div>').join(''),
  empty: (title, cta, href) => `<div class="state"><div class="ico">📭</div><h3>${esc(title)}</h3>${cta ? `<a class="btn" href="${href}">${esc(cta)}</a>` : ''}</div>`,
  error: msg => `<div class="state"><div class="ico">⚠️</div><h3>${esc(msg)}</h3><button class="btn" data-retry>إعادة المحاولة</button></div>`,
  stat: (label, value) => `<div class="card stat"><span>${label}</span><b>${value}</b></div>`,
  stars: n => `<span class="stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`,
  pager: (page, total, size) => { const pages = Math.max(1, Math.ceil(total / size)); return `<div class="pager"><button class="btn sec" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>السابق</button><span>${page} / ${pages}</span><button class="btn sec" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>التالي</button></div>`; },
  async load(box, { loader, isEmpty, render, empty = ['لا توجد بيانات'], skeleton = 5 }) {
    // Loading -> (Error + Retry | Empty | Content) state machine, used by every page.
    const run = async () => {
      box.innerHTML = UI.skeleton(skeleton);
      try { const d = await loader(); box.innerHTML = isEmpty?.(d) ? UI.empty(...empty) : render(d); }
      catch (e) { box.innerHTML = UI.error(e.message); box.querySelector('[data-retry]').onclick = run; }
    };
    return run();
  }
};
