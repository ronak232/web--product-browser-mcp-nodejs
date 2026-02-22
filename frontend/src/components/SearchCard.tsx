import { useState, useEffect } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import DealCard from "./DealCard";
import ComparisonModal from "./ComparisonModal";
import './SearchCard.css';

interface Product {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  url: string;
  image: string | null;
  platform?: 'amazon' | 'flipkart';
  isBestDeal?: boolean;
  salePrice?: number | null;
  originalPrice?: number | null;
  discountPercent?: number | null;
}

interface ScraperResult {
  items: Product[];
  count: number;
  hasMore?: boolean;
  _extra?: Product[];
  _totalAvailable?: number;
  displayLimit?: number;
}

export default function SearchCard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScraperResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparingProducts, setComparingProducts] = useState<Product[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load from session storage on mount
  useEffect(() => {
    const savedQuery = sessionStorage.getItem("search_query");
    const savedResults = sessionStorage.getItem("search_results");

    if (savedQuery) setQuery(savedQuery);
    if (savedResults) {
      try {
        setResults(JSON.parse(savedResults));
      } catch (e) {
        console.error("Failed to parse search_results from sessionStorage", e);
      }
    }
  }, []);

  // Save to session storage on change
  useEffect(() => {
    sessionStorage.setItem("search_query", query);
    if (results) {
      sessionStorage.setItem("search_results", JSON.stringify(results));
    } else {
      sessionStorage.removeItem("search_results");
    }
  }, [query, results]);

  const handleProductClick = async (product: Product) => {
    try {
      const res = await axios.post("http://localhost:5000/api/better-alternative", {
        product,
        allProducts: results?.items || []
      });

      let comparisonSet = [product];
      if (res.data.success && res.data.data) {
        comparisonSet.push(res.data.data);
      }

      setComparingProducts(comparisonSet);
      setShowComparison(true);

    } catch (e) {
      console.error(e);
      setComparingProducts([product]);
      setShowComparison(true);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post("http://localhost:5000/api/get", { query });
      if (response.data.success) {
        setResults(response.data.data);
      } else {
        setError(response.data.message || "An unknown error occurred.");
      }
    } catch (err) {
      setError("Failed to fetch data from the server. Is the backend running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowMore = () => {
    if (!results || !results._extra) return;
    setResults({
      ...results,
      items: [...results.items, ...results._extra],
      count: results.items.length + results._extra.length,
      hasMore: false,
      _extra: undefined,
    });
  };

  return (
    <div className="search-root">
      {/* Hero Section */}
      <div className="search-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Powered by AI
        </div>
        <h1>Find the Best Price,<br />Instantly.</h1>
        <p>Search across Amazon &amp; Flipkart with natural language — just describe what you need and your budget.</p>
      </div>

      {/* Search Bar */}
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <div className="search-field">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            id="query"
            aria-label="Search for products"
            placeholder="e.g., gaming keyboard under ₹3500"
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        <button type="submit" className="search-btn" disabled={loading} aria-label="Search">
          {loading ? "Searching..." : "Search →"}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Searching Amazon &amp; Flipkart for the best deals...</p>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-state">⚠️ {error}</div>}

      {/* Results */}
      {results && (
        <div className="results-section">
          {/* Best Deals Section */}
          <DealCard deals={results.items.filter(i => i.isBestDeal)} />

          {/* Results count header */}
          <div className="results-header">
            <p className="results-count">
              Showing <strong>{results.count}</strong> of{" "}
              <strong>{results._totalAvailable || results.count}</strong> results
            </p>
          </div>

          {/* Product Grid */}
          <div className="results-grid">
            {results.items.map((item) => (
              <div key={item.asin} className="product-card-item">
                <ProductCard product={item} onClick={handleProductClick} />
              </div>
            ))}
          </div>

          {/* Show More */}
          {results.hasMore && (
            <div className="show-more-container">
              <p className="show-more-hint">{results._extra?.length} more results available</p>
              <button
                className="show-more-btn"
                onClick={handleShowMore}
                aria-label="Show more results"
              >
                Show More Results
              </button>
            </div>
          )}
        </div>
      )}

      {showComparison && (
        <ComparisonModal
          products={comparingProducts}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
