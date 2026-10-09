// ===== Services layer: one per resource, no DOM code =====
const CoursesService = {
  list: params => ApiClient.get('/courses', { params }),
  get: id => ApiClient.get('/courses/' + id),
  create: d => ApiClient.post('/courses', d),
  update: (id, d) => ApiClient.put('/courses/' + id, d),
  remove: id => ApiClient.delete('/courses/' + id),
  setPublished: (id, published) => ApiClient.patch('/courses/' + id, { published })
};
const ReviewsService = { list: params => ApiClient.get('/reviews', { params }) };
const OrdersService = { stats: () => ApiClient.get('/stats'), activity: () => ApiClient.get('/activity') };
