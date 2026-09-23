const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.message || body?.error || `request to ${path} failed`;
    throw new Error(message);
  }

  return body;
}

export const api = {
  getOutlets: () => request('/outlets'),
  createOutlet: (data) => request('/outlets', { method: 'POST', body: JSON.stringify(data) }),

  getMasterMenu: () => request('/menu'),
  createMasterMenuItem: (data) => request('/menu', { method: 'POST', body: JSON.stringify(data) }),

  getOutletMenu: (outletId) => request(`/outlets/${outletId}/menu`),
  assignMenuItem: (outletId, data) =>
    request(`/outlets/${outletId}/menu`, { method: 'POST', body: JSON.stringify(data) }),

  getInventory: (outletId) => request(`/outlets/${outletId}/inventory`),
  setStock: (outletId, data) =>
    request(`/outlets/${outletId}/inventory`, { method: 'PUT', body: JSON.stringify(data) }),

  createSale: (outletId, items) =>
    request(`/outlets/${outletId}/sales`, { method: 'POST', body: JSON.stringify({ items }) }),

  getRevenueByOutlet: () => request('/reports/revenue-by-outlet'),
  getTopItems: (outletId) => request(`/reports/outlets/${outletId}/top-items`),
};
