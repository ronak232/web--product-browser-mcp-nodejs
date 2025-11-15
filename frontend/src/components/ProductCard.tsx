import './ProductCard.css';

interface Product {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  url: string;
  image: string | null;
}

import './ProductCard.css';

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="product-wrapper">
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            className="product-image"
          />
        )}
        <h4 className="product-title">
          {product.title}
        </h4>
      </a>
      <div>
        <p className="product-price">
          {product.price ? `₹${product.price}` : "Price not available"}
        </p>
        <p className="product-rating">
          {product.rating ? `Rating: ${product.rating} / 5` : "No rating"}
        </p>
      </div>
    </div>
  );
}

export default ProductCard;
