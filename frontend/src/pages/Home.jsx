import { useProducts }    from '../hooks/useProducts';
import FilterBar          from '../components/FilterBar';
import ProductList        from '../components/ProductList';
import LoadMoreButton     from '../components/LoadMoreButton';

// Skeleton card shown during initial load
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
      <div className="flex justify-between gap-3 mb-4">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-6 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-6" />
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-200 rounded w-1/4" />
        <div className="h-3 bg-gray-100 rounded w-1/5" />
      </div>
    </div>
  );
}

export default function Home() {
  const {
    products, loading, error,
    hasMore, category,
    loadMore, changeCategory,
  } = useProducts();

  const isInitialLoad = loading && products.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              Product Catalog
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">200,000+ products</p>
          </div>
          {products.length > 0 && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {products.length.toLocaleString()} loaded
            </span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Category Filter ───────────────────────────────────────────── */}
        <FilterBar selected={category} onChange={changeCategory} />

        {/* ── Error Banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4">
            <span className="text-red-400 text-xl leading-none">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">Something went wrong</p>
              <p className="text-sm text-red-600 mt-0.5 break-words">{error}</p>
              <button
                onClick={loadMore}
                className="text-sm text-red-700 underline mt-1 hover:text-red-900"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Initial Skeleton ──────────────────────────────────────────── */}
        {isInitialLoad && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────────────── */}
        {!isInitialLoad && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">📦</span>
            <p className="font-semibold text-gray-700">No products found</p>
            {category && (
              <p className="text-sm text-gray-400 mt-1">
                No results in &ldquo;{category}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* ── Product Grid ──────────────────────────────────────────────── */}
        {!isInitialLoad && <ProductList products={products} />}

        {/* ── Load More / End ───────────────────────────────────────────── */}
        {!isInitialLoad && !error && products.length > 0 && (
          <LoadMoreButton onClick={loadMore} loading={loading} hasMore={hasMore} />
        )}

      </main>
    </div>
  );
}