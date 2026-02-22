import './ProductCard.css';

interface Product {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  url: string;
  image: string | null;
  originalPrice?: number | null;
  salePrice?: number | null;
  discountPercent?: number | null;
  platform?: 'amazon' | 'flipkart';
  isDeal?: boolean;
  isBestDeal?: boolean;
}

interface ProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
}

function calculateDiscount(original?: number | null, sale?: number | null): number | null {
  if (!original || !sale || original <= 0) return null;
  const discount = ((original - sale) / original) * 100;
  return Math.round(discount);
}

function renderStars(rating: number | null): string {
  if (!rating) return "";
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + " " + rating;
}

function ProductCard({ product, onClick }: ProductCardProps) {
  const discount = product.discountPercent ?? calculateDiscount(product.originalPrice || product.price, product.salePrice);
  const isBigDeal = (discount ?? 0) >= 30;

  return (
    <div
      className={`product-wrapper${product.isBestDeal ? ' is-best-deal' : ''}`}
      onClick={() => onClick && onClick(product)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Best Deal Ribbon */}
      {product.isBestDeal && (
        <div className="deal-ribbon">🏆 Best Deal</div>
      )}

      {/* Image */}
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

      {/* Footer */}
      <div className="product-footer">
        <div className="product-pricing">
          {product.salePrice ? (
            <>
              <span className="original-price">₹{(product.originalPrice || product.price)?.toLocaleString('en-IN')}</span>
              <span className="sale-price">₹{product.salePrice.toLocaleString('en-IN')}</span>
              {discount !== null && (
                <span className={`discount-badge${isBigDeal ? ' big-deal' : ''}`}>{discount}% OFF</span>
              )}
            </>
          ) : (
            <p className="product-price">
              {product.price ? `₹${product.price.toLocaleString('en-IN')}` : "Price N/A"}
            </p>
          )}
        </div>

        <p className="product-rating">
          {product.rating ? renderStars(product.rating) : "No rating"}
        </p>

        {onClick && (
          <button className="compare-hint-btn">
            ⟺ Compare
          </button>
        )}
      </div>
    </div>
  );
}

export default ProductCard;
