const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Kitchen',
  'Sports & Outdoors', 'Books', 'Beauty & Personal Care',
  'Toys & Games', 'Automotive', 'Health & Wellness', 'Food & Grocery',
];

export default function FilterBar({ selected, onChange }) {
  const btn = (label, value) => (
    <button
      key={value}
      onClick={() => onChange(value)}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
        selected === value
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
          : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {btn('All', '')}
      {CATEGORIES.map(cat => btn(cat, cat))}
    </div>
  );
}