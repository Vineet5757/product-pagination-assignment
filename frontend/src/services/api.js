import axios from 'axios';

// Normalize the API base so it can be configured as either /api or /api/products
// without accidentally doubling the products segment in requests.
const rawBaseURL = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const baseURL = rawBaseURL.replace(/\/products\/?$/, '');

// Single axios instance — one place to change base URL or add auth headers later
const client = axios.create({
  baseURL : baseURL,
  timeout : 10_000,
});

/**
 * Fetch a page of products from the backend.
 * Returns { products, pagination } extracted from the response envelope.
 */
export async function fetchProducts({ cursor, category, snapshotTime, limit = 20 } = {}) {
  const params = { limit };
  if (cursor)       params.cursor       = cursor;
  if (category)     params.category     = category;
  if (snapshotTime) params.snapshotTime = snapshotTime;

  // Response shape: { success: true, data: { products: [], pagination: {} } }
  const { data } = await client.get('/products', { params });
  return data.data; // { products, pagination: { nextCursor, hasNextPage, snapshotTime } }
}
