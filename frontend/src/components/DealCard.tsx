import './DealCard.css';

interface Product {
    asin: string;
    title: string;
    price: number | null;
    rating: number | null;
    url: string;
    image: string | null;
    salePrice?: number | null;
    originalPrice?: number | null;
    discountPercent?: number | null;
    platform?: 'amazon' | 'flipkart';
}

interface DealCardProps {
    deals: Product[];
}

export default function DealCard({ deals }: DealCardProps) {
    if (!deals || deals.length === 0) return null;

    return (
        <div className="deals-container">
            <h3 className="deals-header">🔥 Top 3 Best Deals</h3>
            <div className="deals-grid">
                {deals.map((deal, index) => (
                    <a key={deal.asin} href={deal.url} target="_blank" rel="noopener noreferrer" className="deal-card">
                        <div className="deal-badge">#{index + 1} Best Deal</div>
                        <div className="deal-image-wrapper">
                            {deal.image && <img src={deal.image} alt={deal.title} className="deal-image" />}
                            <div className={`platform-badge ${deal.platform || 'amazon'}`}>
                                {deal.platform === 'flipkart' ? 'Flipkart' : 'Amazon'}
                            </div>
                        </div>
                        <div className="deal-content">
                            <h4 className="deal-title" title={deal.title}>{deal.title}</h4>
                            <div className="deal-prices">
                                <span className="deal-price">₹{deal.salePrice || deal.price}</span>
                                {deal.originalPrice && <span className="deal-original-price">₹{deal.originalPrice}</span>}
                            </div>
                            {deal.discountPercent && (
                                <div className="deal-discount">{deal.discountPercent}% OFF</div>
                            )}
                            {deal.rating && <div className="deal-rating">★ {deal.rating}</div>}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
