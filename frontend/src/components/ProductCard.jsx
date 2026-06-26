// Consistent badge colour per category for quick visual scanning
const BADGE = {
  'Electronics'          : 'bg-blue-100 text-blue-700',
  'Clothing'             : 'bg-pink-100 text-pink-700',
  'Home & Kitchen'       : 'bg-emerald-100 text-emerald-700',
  'Sports & Outdoors'    : 'bg-orange-100 text-orange-700',
  'Books'                : 'bg-yellow-100 text-yellow-700',
  'Beauty & Personal Care': 'bg-purple-100 text-purple-700',
  'Toys & Games'         : 'bg-red-100 text-red-700',
  'Automotive'           : 'bg-zinc-100 text-zinc-700',
  'Health & Wellness'    : 'bg-teal-100 text-teal-700',
  'Food & Grocery'       : 'bg-lime-100 text-lime-700',
};

const formatPrice = p =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p);

const formatDate = iso =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ProductCard({ product }) {
  const { name, category, price, createdAt } = product;
  const badge = BADGE[category] || 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Top row — name + badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
          {name}
        </h3>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge}`}>
          {category}
        </span>
      </div>

      {/* Bottom row — price + date */}
      <div className="flex items-end justify-between mt-auto">
        <span className="text-xl font-bold text-gray-900">{formatPrice(price)}</span>
        <span className="text-xs text-gray-400">{formatDate(createdAt)}</span>
      </div>
    </div>
  );
}