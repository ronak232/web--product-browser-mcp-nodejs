import './ProductCard.css';

interface Product {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  url: string;
  image: string | null;
  originalPrice?: number | null;  // Original/list price
  salePrice?: number | null;      // Current sale/offer price
  discountPercent?: number | null; // Discount percentage
  platform?: 'amazon' | 'flipkart';
  isDeal?: boolean;
}

interface ProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
}

// Helper: calculate discount if salePrice and originalPrice provided
function calculateDiscount(original?: number | null, sale?: number | null): number | null {
  if (!original || !sale || original <= 0) return null;
  const discount = ((original - sale) / original) * 100;
  return Math.round(discount);
}

function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <div className="product-wrapper" onClick={() => onClick && onClick(product)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="product-link-wrapper">
        {product.image && (
          <div className="image-container">
            <img
              src={product.image}
              alt={product.title}
              className="product-image"
            />
            <div className={`platform-badge-small ${product.platform || 'amazon'}`}>
              {product.platform === 'flipkart' ? 'F' : 'A'}
            </div>
          </div>
        )}
        <h4 className="product-title" title={product.title}>
          {product.title}
        </h4>
      </div>
      <div className="product-footer">
        {/* Price section with offer support */}
        <div className="product-pricing">
          {product.salePrice ? (
            <>
              <span className="original-price">₹{product.originalPrice || product.price}</span>
              <span className="sale-price">₹{product.salePrice}</span>
              {product.discountPercent !== undefined ? (
                <span className="discount-badge">{product.discountPercent}% OFF</span>
              ) : (
                <span className="discount-badge">{calculateDiscount(product.originalPrice || product.price, product.salePrice)}% OFF</span>
              )}
            </>
          ) : (
            <p className="product-price">
              {product.price ? `₹${product.price}` : "Price not available"}
            </p>
          )}
        </div>
        <p className="product-rating">
          {product.rating ? `★ ${product.rating}` : "No rating"}
        </p>
        {onClick && <button className="compare-hint-btn">Click to Compare</button>}
      </div>
    </div>
  );
}

export default ProductCard;
