// ===== Router =====
$('#failToggle').onchange = e => { Mock.failMutations = e.target.checked; };
function route() {
  const h = location.hash || '#/dashboard', root = $('#app'), m = h.match(/^#\/courses\/(new|\d+)$/);
  document.querySelectorAll('.side nav a').forEach(a => a.classList.toggle('active', h.startsWith(a.getAttribute('href'))));
  if (m) return Pages.courseForm(root, m[1] === 'new' ? null : +m[1]);
  if (h.startsWith('#/courses')) return Pages.courses(root);
  if (h.startsWith('#/reviews')) return Pages.reviews(root);
  Pages.dashboard(root);
}
addEventListener('hashchange', route); route();
