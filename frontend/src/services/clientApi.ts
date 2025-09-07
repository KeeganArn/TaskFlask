import axios from 'axios';

const clientApi = axios.create({ baseURL: '/api' });

clientApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('clientToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const clientAuthApi = {
  login: (data: { organization_slug: string; email: string; password: string }) =>
    clientApi.post('/client-auth/login', data).then(res => res.data)
};

export const clientTicketsApi = {
  listTypes: () => clientApi.get('/tickets/client/types').then(res => res.data),
  list: () => clientApi.get('/tickets/client').then(res => res.data),
  create: (data: { ticket_type_id: number; title: string; description?: string; priority?: string }) => clientApi.post('/tickets/client', data).then(res => res.data),
  addComment: (id: number, comment: string) => clientApi.post(`/tickets/${id}/comments/client`, { comment }).then(res => res.data),
};

export default clientApi;


