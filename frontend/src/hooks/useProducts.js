import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchProducts } from '../services/api';

export function useProducts() {
  // ── UI State (triggers re-renders) ────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [hasMore,  setHasMore]  = useState(true);
  const [category, setCategory] = useState('');

  // ── Session Refs (async-safe, never stale in callbacks) ──────────────────
  const cursorRef   = useRef(null);   // bookmark from last successful page
  const snapshotRef = useRef(null);   // ceiling locked after page 1 of each session
  const loadingRef  = useRef(false);  // guards against concurrent in-flight requests
  const categoryRef = useRef('');     // mirrors category state for use inside doFetch

  // ── Core Fetch ────────────────────────────────────────────────────────────
  // reset=true  → first page of a session (no cursor, no snapshot)
  // reset=false → subsequent pages (use stored cursor + snapshot)
  const doFetch = useCallback(async (reset = false, cat = categoryRef.current) => {
    if (loadingRef.current) return;   // block duplicate concurrent calls
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchProducts({
        cursor      : reset ? null : cursorRef.current,
        category    : cat,
        snapshotTime: reset ? null : snapshotRef.current,
        limit       : 20,
      });

      const { products: newProducts, pagination } = result;

      // Lock snapshot on the very first page of each session.
      // All subsequent pages echo this value back — guarantees consistency.
      if (reset || !snapshotRef.current) {
        snapshotRef.current = pagination.snapshotTime;
      }

      // Advance the cursor bookmark
      cursorRef.current = pagination.nextCursor;

      setProducts(prev => reset ? newProducts : [...prev, ...newProducts]);
      setHasMore(pagination.hasNextPage);
    } catch (err) {
      const msg = err.response?.data?.message
        ?? 'Failed to load products. Check your connection and try again.';
      setError(msg);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // stable — all mutable values live in refs

  // ── Mount: initial fetch ──────────────────────────────────────────────────
  useEffect(() => { doFetch(true); }, [doFetch]);

  // ── Load More (called by button) ──────────────────────────────────────────
  const loadMore = useCallback(() => doFetch(false), [doFetch]);

  // ── Category change: reset entire session ─────────────────────────────────
  const changeCategory = useCallback((newCat) => {
    // Update refs synchronously BEFORE calling doFetch
    categoryRef.current = newCat;
    cursorRef.current   = null;
    snapshotRef.current = null;

    // Clear UI immediately so old category products vanish
    setCategory(newCat);
    setProducts([]);
    setHasMore(true);
    setError(null);

    doFetch(true, newCat);
  }, [doFetch]);

  return { products, loading, error, hasMore, category, loadMore, changeCategory };
}