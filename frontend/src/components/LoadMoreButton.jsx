export default function LoadMoreButton({ onClick, loading, hasMore }) {
  // Session exhausted — all products shown
  if (!hasMore) {
    return (
      <p className="text-center text-sm text-gray-400 py-8">
        ✓ You've reached the end — all products loaded
      </p>
    );
  }

  return (
    <div className="flex justify-center py-8">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <>
            {/* Spinner */}
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading…
          </>
        ) : (
          'Load More'
        )}
      </button>
    </div>
  );
}