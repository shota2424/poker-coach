import { Link } from 'react-router-dom';
import { GraduationCap, Lightbulb, PlayCircle } from 'lucide-react';

const Home = () => {
  return (
    <div className="home-page" style={{ textAlign: 'center', marginTop: '4rem' }}>
      <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', background: 'linear-gradient(to right, #60a5fa, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        GTOを「プレイして」学ぶ
      </h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem' }}>
        あなたのポーカーの決断を専属AIコーチが横で付きっきりで解説・採点します。実践に近い形でGTO戦略を体得しましょう。
      </p>

      {/* 目玉機能: 実戦プレイ */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', maxWidth: '900px', margin: '0 auto 2rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
        <div style={{ padding: '1rem', background: 'var(--primary)', borderRadius: '50%', color: 'white', marginBottom: '0.5rem' }}>
          <PlayCircle size={48} />
        </div>
        <h2 style={{ fontSize: '2rem' }}>実戦プレイモード (イチオシ)</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '1.1rem' }}>プリフロップからリバーまでの連続プレイ！ハンド終了時にプレイの「総合スコア採点」と「AIコーチの分析総評」をもらえます。</p>
        <Link to="/play" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.2rem' }}>
          ゲームプレイを開始
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', color: 'var(--accent)' }}>
            <GraduationCap size={40} />
          </div>
          <h3>スポット練習 (トレーナー)</h3>
          <p style={{ color: 'var(--text-muted)' }}>特定のシチュエーションでの1アクションを練習し、アクションごとのGTO頻度と解説を確認します。</p>
          <Link to="/trainer" className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            単発スポットを練習
          </Link>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ padding: '1.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', color: 'var(--warning)' }}>
            <Lightbulb size={40} />
          </div>
          <h3>スタディ解析</h3>
          <p style={{ color: 'var(--text-muted)' }}>気になったボードやアクションを入力し、AIコーチへのチャット形式での深掘り質問を通じて戦略を理解します。</p>
          <Link to="/study" className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--warning)', color: 'var(--warning)' }}>
            スポットをGTO解析
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
