import { useState, useEffect } from 'react';
import { MessageSquare, AlertCircle, CheckCircle2, ListFilter, Loader2 } from 'lucide-react';
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

  const [lastEvLoss, setLastEvLoss] = useState(null);

  const startDrill = (categoryId) => {
    const newEngine = new PokerEngine();
    newEngine.resetGame(categoryId === 'preflop' ? null : categoryId);
    
    setSituation(newEngine.getSituation());
    setSelectedAction(null);
    setExplanation(null);
    setLastEvLoss(null);
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

  return (
    <div style={{ display: 'flex', gap: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      <div className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.5rem', height: 'fit-content', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ListFilter size={18} /> ドリル選択
        </h3>
        {categories.map(cat => (
          <div 
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            style={{ 
              background: cat.active ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
              color: cat.active ? 'white' : 'var(--text-muted)', 
              padding: '1rem', 
              borderRadius: '0.5rem', 
              cursor: 'pointer', 
              fontWeight: cat.active ? 'bold' : 'normal',
              transition: 'all 0.2s',
              border: cat.active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'
            }}>
            {cat.name}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>🎯 {activeCategory?.name} (スポット練習)</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              連続正解: {streak}回 🔥
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '0.5rem', flex: 1, minWidth: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>🦸‍♂️ Hero</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{situation.heroPosition}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '0.5rem', flex: 1, minWidth: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>🎯 Villain</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{situation.villainPosition}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem 1rem', borderRadius: '0.5rem', flex: 1, minWidth: '100px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>💰 Pot</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--accent)' }}>{situation.pot}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '0.5rem', flex: 1, minWidth: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>💵 Stack</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{situation.stack}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>現在のアクション状況</div>
            <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 'bold' }}>{situation.actionToHero}</div>
          </div>
          
          {situation.board.length > 0 && (
             <div style={{ marginBottom: '2rem' }}>
               <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ボード</div>
               <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                 {situation.board.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
               </div>
             </div>
          )}

          <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>あなたのハンド</div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {situation.heroCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
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
                className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                style={{ 
                  height: '80px', 
                  fontSize: '1.2rem',
                  flexDirection: 'column',
                  gap: '0.2rem',
                  borderColor: selectedAction && isOptimal ? 'var(--accent)' : selectedAction && !isOptimal && isSelected ? 'var(--danger)' : 'rgba(255,255,255,0.2)',
                  boxShadow: isSelected && isOptimal ? `0 0 15px rgba(16,185,129,0.4)` : 'none',
                  background: isSelected && !isOptimal ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  opacity: selectedAction && !isSelected ? 0.3 : 1,
                  position: 'relative'
                }}
                disabled={!!selectedAction}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div>
                    {displayLabel.split(' (').map((part, idx) => (
                      <span key={idx} style={{ fontSize: idx === 0 ? '1.2rem' : '0.9rem', color: idx === 0 || isSelected ? 'inherit' : 'var(--text-muted)' }}>
                        {idx === 1 ? '(' + part : part}
                      </span>
                    ))}
                  </div>
                  {selectedAction && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', fontWeight: 'bold', color: actionLoss === 0 ? 'var(--accent)' : actionLoss >= -0.5 ? 'var(--warning)' : 'var(--danger)' }}>
                      {actionLoss === 0 ? '+0.00 EV' : `${actionLoss.toFixed(2)} EV`}
                    </div>
                  )}
                </div>
                <span style={{ position: 'absolute', top: 4, right: 8, fontSize: '0.7rem', opacity: 0.5 }}>[{i + 1}]</span>
              </button>
            );
          })}
        </div>

        {selectedAction && lastEvLoss !== null && (
          <div className="glass-panel" style={{ marginTop: '0.5rem', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {lastEvLoss === 0 ? (
                <CheckCircle2 color="var(--accent)" size={32} />
              ) : lastEvLoss >= -0.5 ? (
                <AlertCircle color="var(--warning)" size={32} />
              ) : (
                <AlertCircle color="var(--danger)" size={32} />
              )}
              <h3 style={{ margin: 0, flex: 1, color: lastEvLoss === 0 ? 'var(--accent)' : lastEvLoss >= -0.5 ? 'var(--warning)' : 'var(--danger)' }}>
                {lastEvLoss === 0 ? '✅ Excellent / Valid Mix (+0.00 EV)' : 
                 lastEvLoss >= -0.5 ? `⚠️ Inaccuracy (${lastEvLoss.toFixed(2)} EV)` : 
                 `❌ Blunder (${lastEvLoss.toFixed(2)} EV)`}
              </h3>
              <button className="btn btn-accent" onClick={() => startDrill(activeCategory.id)} disabled={isThinking}>
                次の問題へ進む [Enter]
              </button>
            </div>
            
            <div style={{ 
              padding: '1.5rem', 
              background: 'rgba(59, 130, 246, 0.15)', 
              borderRadius: 'var(--radius-md)',
              borderLeft: '4px solid var(--primary)',
              lineHeight: '1.6',
              animation: 'fadeIn 0.4s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                <MessageSquare size={18} /> AIコーチの解説
              </div>
              {!explanation && !isThinking && (
                 <button onClick={handleRequestAI} className="btn" style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '0.5rem' }}>
                   🤖 なぜこのスコア判定になったか、詳しい理由をAIに聞く
                 </button>
              )}
              {isThinking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', margin: '1rem 0' }}>
                  <Loader2 size={24} className="spin" color="var(--primary)" />
                  <span>AIコーチがこのスポットの解説を生成中...</span>
                </div>
              )}
              {explanation && (
                <p style={{ whiteSpace: 'pre-wrap' }}>{explanation}</p>
              )}
            </div>
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '2rem', minHeight: '60px' }}>
          {equity && (
             <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', background: 'rgba(16,185,129,0.1)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '2rem', animation: equity !== '計算中...' ? 'fadeIn 0.5s' : 'none' }}>
               {equity === '計算中...' ? '🧠 厳密な勝率（Equity）を計算中...' : `🧠 精密勝率 (Equity vs ATC): ${equity}%`}
             </h3>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button className="btn btn-outline" onClick={() => setShowRange(!showRange)} style={{ marginBottom: '1rem' }}>
               {showRange ? '🙈 レンジ表を隠す' : '👁️ レンジ表（カンニングペーパー）を開く'}
            </button>
            {showRange && <RangeChart situation={situation} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Trainer;
