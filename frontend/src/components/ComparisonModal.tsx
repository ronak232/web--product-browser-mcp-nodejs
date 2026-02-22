import { useEffect, useState } from 'react';
import axios from 'axios';
import './ComparisonModal.css';

interface Product {
    asin: string;
    title: string;
    price: number | null;
    rating: number | null;
    image: string | null;
    platform?: 'amazon' | 'flipkart';
}

interface ComparisonData {
    asin: string;
    pros: string[];
    cons: string[];
    bestFor: string;
}

interface ComparisonModalProps {
    products: Product[];
    onClose: () => void;
}

export default function ComparisonModal({ products, onClose }: ComparisonModalProps) {
    const [comparisonData, setComparisonData] = useState<ComparisonData[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (products.length > 0) {
            fetchComparison();
        }
    }, [products]);

    const fetchComparison = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post('http://localhost:5000/api/compare', { products });
            if (response.data.success) {
                setComparisonData(response.data.data);
            } else {
                setError(response.data.message);
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch comparison");
        } finally {
            setLoading(false);
        }
    };

    if (!products || products.length === 0) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>&times;</button>
                <h2>Smart Comparison</h2>

                {loading && <div className="loading-spinner">Analyzing products with AI...</div>}
                {error && <div className="error-msg">{error}</div>}

                {!loading && !error && (
                    <div className="comparison-grid">
                        {products.map((p) => {
                            const aiData = comparisonData?.find(c => c.asin === p.asin);
                            return (
                                <div key={p.asin} className="comparison-column">
                                    <div className="comp-header">
                                        {p.image && <img src={p.image} alt={p.title} className="comp-img" />}
                                        <h4 title={p.title}>{p.title}</h4>
                                        <div className="comp-price">₹{p.price}</div>
                                        {p.rating && <div className="comp-rating">★ {p.rating}</div>}
                                    </div>

                                    {aiData ? (
                                        <div className="comp-ai-content">
                                            <div className="comp-section">
                                                <h5>🏆 Best For</h5>
                                                <p className="best-for-badge">{aiData.bestFor}</p>
                                            </div>
                                            <div className="comp-section">
                                                <h5>✅ Pros</h5>
                                                <ul>
                                                    {aiData.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                                                </ul>
                                            </div>
                                            <div className="comp-section">
                                                <h5>❌ Cons</h5>
                                                <ul>
                                                    {aiData.cons.map((con, i) => <li key={i}>{con}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    ) : (
                                        !loading && <p className="no-data">Thinking...</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
