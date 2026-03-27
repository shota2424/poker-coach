export default function PlayingCard({ card, index = 0 }) {
  if (!card) return <div style={{width: 56, height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)'}} />;
  
  const isRed = card.includes('h') || card.includes('d');
  const suitSymbol = card.includes('s') ? '♠' : card.includes('h') ? '♥' : card.includes('d') ? '♦' : '♣';
  const rank = card.replace(/[shdc]/g, '').replace('T', '10');
  const color = isRed ? '#ef4444' : '#1e293b';

  return (
    <div className="premium-card" style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)', 
      color: color, 
      borderRadius: '0.5rem',
      padding: '0.4rem', 
      width: '56px', 
      height: '80px', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'space-between', 
      fontWeight: 'bold', 
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.8)',
      fontFamily: '"Arial", sans-serif',
      userSelect: 'none',
      animationDelay: `${index * 0.1}s` // Cascade animation
    }}>
      {/* Top Left Rank & Suit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'flex-start', lineHeight: '1' }}>
        <span style={{ fontSize: '1.2rem', letterSpacing: '-1px' }}>{rank}</span>
        <span style={{ fontSize: '0.9rem', marginTop: '-2px' }}>{suitSymbol}</span>
      </div>
      
      {/* Center Watermark Suit */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '3rem', opacity: 0.1, pointerEvents: 'none' }}>
        {suitSymbol}
      </div>

      {/* Bottom Right Rank & Suit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'flex-end', lineHeight: '1', transform: 'rotate(180deg)' }}>
        <span style={{ fontSize: '1.2rem', letterSpacing: '-1px' }}>{rank}</span>
        <span style={{ fontSize: '0.9rem', marginTop: '-2px' }}>{suitSymbol}</span>
      </div>
    </div>
  );
}
