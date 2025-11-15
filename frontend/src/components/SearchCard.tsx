import { useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import './SearchCard.css';

interface Product {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  url: string;
  image: string | null;
}

interface ScraperResult {
  items: Product[];
  count: number;
}

export default function SearchCard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScraperResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="search-root">
      <div className="search-hero">
        <h2>
          AI Product Search
        </h2>
        <p>Find Amazon products powered by AI</p>
      </div>

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
            placeholder="e.g., gaming keyboard under 5000"
            className="search-input"
          />
          <span
            className="search-icon"
          >
            🔍
          </span>
        </div>
        <button type="submit" className="search-btn" disabled={loading} aria-label="Search">
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {loading && <p style={{ textAlign: "center", color: "#6b7280" }}>Loading... Please wait.</p>}
      {error && <p style={{ textAlign: "center", color: "red" }}>Error: {error}</p>}

      {results && (
        <div>
          <h3 className="results-count" aria-live="polite" role="status">Found {results.count} items</h3>
          <div className="results-grid">
            {results.items.map((item) => (
              <div key={item.asin} className="product-card-item">
                <ProductCard product={item} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
