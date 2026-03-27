export default function PlayingCard({ card, index = 0, small = false }) {
  if (!card) return (
    <div style={{
      width: small ? 40 : 'var(--card-w, 52px)',
      height: small ? 56 : 'var(--card-h, 74px)',
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '0.4rem',
      border: '1px solid rgba(255,255,255,0.1)',
    }} />
  );

  const isRed = card.includes('h') || card.includes('d');
  const suitSymbol = card.includes('s') ? '♠' : card.includes('h') ? '♥' : card.includes('d') ? '♦' : '♣';
  const rank = card.replace(/[shdc]/g, '').replace('T', '10');
  const color = isRed ? '#ef4444' : '#1e293b';

  const w = small ? 40 : 52;
  const h = small ? 56 : 74;
  const fontSize = small ? '0.9rem' : '1.1rem';
  const suitSize = small ? '0.7rem' : '0.85rem';
  const watermarkSize = small ? '2rem' : '2.8rem';

  return (
    <div
      className="premium-card"
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
        color,
        borderRadius: '0.4rem',
        padding: small ? '0.25rem' : '0.35rem',
        width: `${w}px`,
        height: `${h}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontWeight: 'bold',
        boxShadow: '0 3px 6px -1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.8)',
        fontFamily: '"Arial", sans-serif',
        userSelect: 'none',
        flexShrink: 0,
        animationDelay: `${index * 0.08}s`,
      }}
    >
      {/* Top Left */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'flex-start', lineHeight: 1 }}>
        <span style={{ fontSize, letterSpacing: '-0.5px' }}>{rank}</span>
        <span style={{ fontSize: suitSize, marginTop: '-2px' }}>{suitSymbol}</span>
      </div>

      {/* Center watermark */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: watermarkSize, opacity: 0.08, pointerEvents: 'none' }}>
        {suitSymbol}
      </div>

      {/* Bottom Right */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'flex-end', lineHeight: 1, transform: 'rotate(180deg)' }}>
        <span style={{ fontSize, letterSpacing: '-0.5px' }}>{rank}</span>
        <span style={{ fontSize: suitSize, marginTop: '-2px' }}>{suitSymbol}</span>
      </div>
    </div>
  );
}
