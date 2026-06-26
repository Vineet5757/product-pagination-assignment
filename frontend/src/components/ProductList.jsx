import ProductCard from './ProductCard';

export default function ProductList({ products }) {
  if (!products.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map(p => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}