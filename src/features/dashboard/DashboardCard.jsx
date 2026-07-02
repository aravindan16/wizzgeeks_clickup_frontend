import PortfolioCard from './PortfolioCard';
import ChartCard from './ChartCard';

/** Renders the right card component for a card's type. */
export default function DashboardCard({ card, onRemove, onEdit, onExpand, fill = false }) {
  if (!card.type || card.type === 'portfolio') {
    return <PortfolioCard card={card} onRemove={onRemove} onEdit={onEdit} onExpand={onExpand} fill={fill} />;
  }
  return <ChartCard card={card} onRemove={onRemove} onEdit={onEdit} onExpand={onExpand} fill={fill} />;
}
