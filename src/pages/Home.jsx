import { Link } from 'react-router-dom';
import { GraduationCap, Lightbulb, PlayCircle, Zap } from 'lucide-react';

const Home = () => {
  return (
    <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out' }}>
      {/* Hero */}
      <div style={{ marginBottom: '2rem', padding: '1rem 0' }}>
        <h1 style={{
          fontSize: 'clamp(1.6rem, 6vw, 3rem)',
          marginBottom: '0.75rem',
          background: 'linear-gradient(135deg, #60a5fa 0%, #10b981 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}>
          GTOを「プレイして」学ぶ
        </h1>
        <p style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
          あなたの判断をAIコーチがリアルタイムで採点・解説。実戦に近い形でGTO戦略を体得しましょう。
        </p>
      </div>

      {/* Primary CTA */}
      <div className="glass-panel" style={{
        maxWidth: '700px',
        margin: '0 auto 1.5rem',
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '50%', color: 'white', flexShrink: 0 }}>
            <PlayCircle size={32} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.6rem)', margin: 0 }}>実戦プレイモード <span style={{ background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '2rem', verticalAlign: 'middle', fontWeight: 600 }}>おすすめ</span></h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.8rem, 2vw, 0.95rem)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
              プリフロップ→リバーまでの連続プレイ。終了後にAIが総合採点！
            </p>
          </div>
        </div>
        <Link to="/play" className="btn btn-primary" style={{ width: '100%', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', padding: '0.85rem' }}>
          <Zap size={18} /> ゲームをはじめる
        </Link>
      </div>

      {/* Secondary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', maxWidth: '700px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', color: 'var(--accent)' }}>
            <GraduationCap size={28} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>スポット練習</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            特定の1アクションの正解を即座に練習。連続正解でストリークを伸ばそう。
          </p>
          <Link to="/trainer" className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: '0.9rem', padding: '0.6rem' }}>
            スポットを練習
          </Link>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', color: 'var(--warning)' }}>
            <Lightbulb size={28} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>スタディ解析</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            気になるボード・アクションをAIコーチにチャット形式で深掘り質問。
          </p>
          <Link to="/study" className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--warning)', color: 'var(--warning)', fontSize: '0.9rem', padding: '0.6rem' }}>
            スポットをGTO解析
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
