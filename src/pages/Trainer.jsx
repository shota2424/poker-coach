import { useState, useEffect, useRef } from 'react';
import { MessageSquare, AlertCircle, CheckCircle2, ListFilter, Loader2, Menu, X, ChevronRight } from 'lucide-react';
import { PokerEngine, calculateExactEquityAsync } from '../engine/PokerEngine';
import { getSpotExplanation } from '../api/llm';
import RangeChart from '../components/RangeChart';
import PlayingCard from '../components/PlayingCard';

const DRILL_CATEGORIES = [
  { id: 'preflop', name: '基本プリフロップ', active: true },
  { id: 'flop_cb', name: 'フロップCB (IP)', active: false },
  { id: 'river_bluff', name: 'リバーのブラフキャッチ', active: false },
];

const Trainer = () => {
  const [categories, setCategories] = useState(DRILL_CATEGORIES);
  const [situation, setSituation] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showRange, setShowRange] = useState(false);
  const [equity, setEquity] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lastEvLoss, setLastEvLoss] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    if (situation && situation.street !== 'Preflop') {
      setEquity('計算中...');
      calculateExactEquityAsync(situation.heroCards, situation.board).then(eq => {
        setEquity(eq);
      });
    } else {
      setEquity(null);
    }
  }, [situation]);

  const startDrill = (categoryId) => {
    const newEngine = new PokerEngine();
    newEngine.resetGame(categoryId === 'preflop' ? null : categoryId);
    setSituation(newEngine.getSituation());
    setSelectedAction(null);
    setExplanation(null);
    setLastEvLoss(null);
    setShowRange(false);
  };

  useEffect(() => {
    startDrill('preflop');
  }, []);

  const handleCategoryClick = (id) => {
    setCategories(categories.map(c => ({...c, active: c.id === id})));
    setStreak(0);
    startDrill(id);
  };

  const handleAction = async (actionName) => {
    setSelectedAction(actionName);
    const loss = situation.evLoss[actionName];
    setLastEvLoss(loss);
    if (loss === 0) setStreak(s => s + 1);
    else setStreak(0);
    setExplanation(null);
    // Scroll result into view on mobile
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (isThinking) return;

      if (selectedAction) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startDrill(categories.find(c => c.active)?.id || 'preflop');
        }
        return;
      }

      if (situation && situation.options) {
        let actionIndex = -1;
        if (e.key === '1') actionIndex = 0;
        else if (e.key === '2') actionIndex = 1;
        else if (e.key === '3') actionIndex = 2;
        else if (e.key === '4') actionIndex = 3;

        if (actionIndex >= 0 && actionIndex < situation.options.length) {
          e.preventDefault();
          handleAction(situation.options[actionIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [situation, selectedAction, isThinking, categories]);

  const handleRequestAI = async () => {
    setIsThinking(true);
    const exp = await getSpotExplanation(situation, selectedAction, isCorrect);
    setExplanation(exp);
    setIsThinking(false);
  };

  const activeCategory = categories.find(c => c.active);

  if (!situation) return <div>Loading...</div>;

  const getEvColor = (loss) => {
    if (loss === 0) return 'var(--accent)';
    if (loss >= -0.5) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getEvLabel = (loss) => {
    if (loss === 0) return '✅ 最適解！ (+0.00 EV)';
    if (loss >= -0.5) return `⚠️ やや損 (${loss.toFixed(2)} EV)`;
    return `❌ ミス (${loss.toFixed(2)} EV)`;
  };

  return (
    <div className="trainer-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <div className={`glass-panel trainer-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListFilter size={18} /> ドリル選択
          </h3>
          <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        {categories.map(cat => (
          <div
            key={cat.id}
            onClick={() => {
              handleCategoryClick(cat.id);
              if (window.innerWidth <= 768) setIsSidebarOpen(false);
            }}
            style={{
              background: cat.active ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: cat.active ? 'white' : 'var(--text-muted)',
              padding: '0.85rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: cat.active ? 'bold' : 'normal',
              transition: 'all 0.2s',
              border: cat.active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
            {cat.name}
            {cat.active && <ChevronRight size={16} />}
          </div>
        ))}
      </div>

      <div className="trainer-main">
        {/* Header row */}
        <div className="trainer-header-row">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 style={{ fontSize: 'clamp(1rem, 3vw, 1.4rem)' }}>🎯 {activeCategory?.name}</h2>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.4rem 0.8rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            🔥 {streak}連続正解
          </div>
        </div>

        {/* Situation info - compact */}
        <div className="glass-panel situation-panel">
          {/* Status row */}
          <div className="status-grid" style={{ marginBottom: '0.75rem' }}>
            <div className="status-box">
              <span className="status-label">🦸 Hero</span>
              <span className="status-value">{situation.heroPosition}</span>
            </div>
            <div className="status-box">
              <span className="status-label">🎯 Villain</span>
              <span className="status-value">{situation.villainPosition}</span>
            </div>
            <div className="status-box highlight">
              <span className="status-label">💰 Pot</span>
              <span className="status-value">{situation.pot}</span>
            </div>
            <div className="status-box">
              <span className="status-label">💵 Stack</span>
              <span className="status-value">{situation.stack}</span>
            </div>
          </div>

          {/* Action situation */}
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.6rem 0.9rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.1rem' }}>アクション状況</div>
            <div style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 'bold' }}>{situation.actionToHero}</div>
          </div>

          {/* Board + Hand in one row on mobile */}
          <div className="cards-row">
            <div className="cards-group">
              <div className="cards-label">あなたのハンド</div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {situation.heroCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
              </div>
            </div>
            {situation.board.length > 0 && (
              <div className="cards-group">
                <div className="cards-label">ボード</div>
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {situation.board.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
              </div>
            )}
          </div>

          {equity && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent)', background: 'rgba(16,185,129,0.1)', padding: '0.25rem 0.75rem', borderRadius: '2rem', animation: equity !== '計算中...' ? 'fadeIn 0.5s' : 'none' }}>
                🧠 {equity === '計算中...' ? 'Equity計算中...' : `Equity vs ATC: ${equity}%`}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          {situation.options.map((action, i) => {
            const isSelected = selectedAction === action;
            const actionLoss = situation.evLoss[action];
            const isOptimal = actionLoss === 0;

            let displayLabel = action;
            if (action.includes('33% Pot')) {
              displayLabel = `Bet ${(parseFloat(situation.pot) * 0.33).toFixed(1)}BB (33%)`;
            } else if (action.includes('50% Pot')) {
              displayLabel = `Bet ${(parseFloat(situation.pot) * 0.50).toFixed(1)}BB (50%)`;
            } else if (action.includes('75% Pot')) {
              displayLabel = `Bet ${(parseFloat(situation.pot) * 0.75).toFixed(1)}BB (75%)`;
            } else if (action.includes('All-in')) {
              displayLabel = `ALL-IN (${parseFloat(situation.stack).toFixed(1)}BB)`;
            }

            return (
              <button
                key={action}
                onClick={() => !selectedAction && handleAction(action)}
                className={`btn action-btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  borderColor: selectedAction && isOptimal ? 'var(--accent)' : selectedAction && !isOptimal && isSelected ? 'var(--danger)' : 'rgba(255,255,255,0.2)',
                  boxShadow: isSelected && isOptimal ? '0 0 15px rgba(16,185,129,0.4)' : 'none',
                  background: isSelected && !isOptimal ? 'rgba(239, 68, 68, 0.2)' : isSelected ? undefined : 'transparent',
                  opacity: selectedAction && !isSelected ? 0.35 : 1,
                  position: 'relative',
                }}
                disabled={!!selectedAction}
              >
                <span>{displayLabel.split(' (')[0]}</span>
                {displayLabel.includes(' (') && (
                  <span style={{ fontSize: '0.8rem', color: isSelected ? 'inherit' : 'var(--text-muted)' }}>
                    ({displayLabel.split(' (')[1]}
                  </span>
                )}
                {selectedAction && (
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: getEvColor(actionLoss) }}>
                    {actionLoss === 0 ? '+0.00 EV' : `${actionLoss.toFixed(2)} EV`}
                  </span>
                )}
                <span className="shortcut-key">[{i + 1}]</span>
              </button>
            );
          })}
        </div>

        {/* Result panel - appears inline, scrolls into view */}
        {selectedAction && lastEvLoss !== null && (
          <div ref={resultRef} className="glass-panel result-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Result header */}
            <div className="result-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                {lastEvLoss === 0 ? (
                  <CheckCircle2 color="var(--accent)" size={28} />
                ) : lastEvLoss >= -0.5 ? (
                  <AlertCircle color="var(--warning)" size={28} />
                ) : (
                  <AlertCircle color="var(--danger)" size={28} />
                )}
                <span style={{ fontWeight: 'bold', color: getEvColor(lastEvLoss), fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)' }}>
                  {getEvLabel(lastEvLoss)}
                </span>
              </div>
              <button className="btn btn-accent" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }} onClick={() => startDrill(activeCategory.id)} disabled={isThinking}>
                次へ [Enter]
              </button>
            </div>

            {/* AI Coach section */}
            <div style={{ marginTop: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary)', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <MessageSquare size={16} /> AIコーチの解説
              </div>
              {!explanation && !isThinking && (
                <button onClick={handleRequestAI} className="btn" style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '0.9rem' }}>
                  🤖 AIに詳しい解説を聞く
                </button>
              )}
              {isThinking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', padding: '0.5rem 0' }}>
                  <Loader2 size={20} className="spin" color="var(--primary)" />
                  <span style={{ fontSize: '0.9rem' }}>AIコーチが解説を生成中...</span>
                </div>
              )}
              {explanation && (
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.7 }}>{explanation}</p>
              )}
            </div>

            {/* Range chart toggle */}
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowRange(!showRange)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
                {showRange ? '🙈 レンジ表を隠す' : '👁️ レンジ表を開く'}
              </button>
              {showRange && <RangeChart situation={situation} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trainer;
