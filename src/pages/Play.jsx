import { useState, useEffect } from 'react';
import { Trophy, MessageSquare, RefreshCcw, Loader2 } from 'lucide-react';
import { PokerEngine, calculateExactEquityAsync } from '../engine/PokerEngine';
import { getAIExplanation } from '../api/llm';
import RangeChart from '../components/RangeChart';
import PlayingCard from '../components/PlayingCard';

const Play = () => {
  const [engine, setEngine] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [showdownResult, setShowdownResult] = useState(null);
  const [difficulty, setDifficulty] = useState('advanced');
  const [showRange, setShowRange] = useState(false);
  const [equity, setEquity] = useState(null);

  useEffect(() => {
    localStorage.setItem('poker_difficulty', difficulty);
  }, [difficulty]);

  useEffect(() => {
    if (currentStage && currentStage.street !== 'Preflop') {
      setEquity('計算中...');
      calculateExactEquityAsync(currentStage.heroCards, currentStage.board).then(eq => {
        setEquity(eq);
      });
    } else {
      setEquity(null);
    }
  }, [currentStage]);

  useEffect(() => {
    startNewGame();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (isThinking) return;

      if (isFinished) {
         if (e.code === 'Space' || e.code === 'Enter') {
             e.preventDefault();
             startNewGame();
         }
         return;
      }

      if (currentStage && currentStage.options) {
        let actionIndex = -1;
        if (e.key === '1') actionIndex = 0;
        else if (e.key === '2') actionIndex = 1;
        else if (e.key === '3') actionIndex = 2;
        else if (e.key === '4') actionIndex = 3;

        if (actionIndex >= 0 && actionIndex < currentStage.options.length) {
          e.preventDefault();
          handleAction(currentStage.options[actionIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStage, isFinished, isThinking]);

  const startNewGame = () => {
    const targetEngine = engine || new PokerEngine();
    targetEngine.resetGame(null, difficulty);
    setEngine(Object.assign(Object.create(Object.getPrototypeOf(targetEngine)), targetEngine));
    setCurrentStage(targetEngine.getSituation());
    setIsFinished(false);
    setAiExplanation(null);
    setIsThinking(false);
    setShowdownResult(null);
  };

  const handleAction = async (action) => {
    if (!engine) return;
    const isGameOver = engine.applyAction(action);
    
    if (isGameOver) {
      setIsFinished(true);
      const result = engine.getShowdownResult(action.includes('Fold'));
      setShowdownResult(result);
      const finalSituation = engine.getSituation();
      setCurrentStage(finalSituation);
      setAiExplanation(null);
    } else {
      setCurrentStage(engine.getSituation());
      setEngine(Object.assign(Object.create(Object.getPrototypeOf(engine)), engine));
    }
  };

  const handleRequestAI = async () => {
    setIsThinking(true);
    const explanation = await getAIExplanation(currentStage, showdownResult, engine.history, engine.totalEvLoss);
    setAiExplanation(explanation);
    setIsThinking(false);
  };

  if (!engine || !currentStage) return <div style={{ padding: '2rem', textAlign: 'center' }}>♠️ カードをシャッフル中...</div>;

  if (isFinished) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Sticky top bar: result + next button */}
        <div className="glass-panel result-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Trophy size={28} color={engine.totalEvLoss >= -0.5 ? 'var(--accent)' : engine.totalEvLoss >= -2.0 ? 'var(--warning)' : 'var(--danger)'} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ハンド終了</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: engine.totalEvLoss >= -0.5 ? 'var(--accent)' : engine.totalEvLoss >= -2.0 ? 'var(--warning)' : 'var(--danger)' }}>
                総EV損失: {engine.totalEvLoss.toFixed(2)} BB
              </div>
            </div>
          </div>
          <button className="btn btn-accent" onClick={startNewGame} disabled={isThinking} style={{ whiteSpace: 'nowrap', padding: '0.6rem 1.2rem' }}>
            <RefreshCcw size={16} style={{ marginRight: '0.4rem' }} /> 次のハンドへ [Enter]
          </button>
        </div>

        {/* Showdown result */}
        {showdownResult && (
          <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
            <h3 className={showdownResult.resultText.includes('勝ち') ? 'winner-text' : ''} style={{ marginBottom: '0.75rem', color: showdownResult.resultText.includes('勝ち') ? '#fbbf24' : 'var(--accent)', fontSize: '1.3rem' }}>
              {showdownResult.resultText}
            </h3>
            {showdownResult.finalBoard && showdownResult.finalBoard.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>最終ボード</div>
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {showdownResult.finalBoard.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>あなた</div>
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', marginBottom: '0.25rem' }}>
                  {currentStage.heroCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>{showdownResult.heroHandName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>相手</div>
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', marginBottom: '0.25rem' }}>
                  {showdownResult.villainCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>{showdownResult.villainHandName}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action history - compact */}
        <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>アクション履歴</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {engine.history.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', justifyContent: 'space-between', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', minWidth: '60px' }}>{h.street}</span>
                <span style={{ flex: 1 }}>{h.action}</span>
                <span style={{ fontWeight: 'bold', color: h.evLoss === 0 ? 'var(--accent)' : h.evLoss >= -0.5 ? 'var(--warning)' : 'var(--danger)' }}>
                  {h.evLoss === 0 ? '✅ +0.00' : `${h.evLoss >= -0.5 ? '⚠️' : '❌'} ${h.evLoss.toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Coach - scrollable text box */}
        <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <MessageSquare size={16} /> AIコーチの総評
          </div>
          {!aiExplanation && !isThinking && (
            <button onClick={handleRequestAI} className="btn btn-primary" style={{ width: '100%', fontWeight: 'bold', fontSize: '0.9rem', padding: '0.6rem' }}>
              🤖 AIコーチに詳しい解説を聞く
            </button>
          )}
          {isThinking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', fontSize: '0.9rem' }}>
              <Loader2 size={20} className="spin" color="var(--primary)" />
              <span>AI分析中...</span>
            </div>
          )}
          {aiExplanation && (
            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontSize: '0.88rem',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {aiExplanation}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>
          実戦プレイ
          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: 'var(--primary)', padding: '0.15rem 0.5rem', borderRadius: '2rem', verticalAlign: 'middle', fontWeight: 600 }}>
            {currentStage.street}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '2rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem' }}>
            <option value="beginner">🟢 ノーマル</option>
            <option value="advanced">😈 GTO</option>
          </select>
          <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: engine.totalEvLoss < -5 ? 'var(--danger)' : engine.totalEvLoss < -1 ? 'var(--warning)' : 'var(--accent)', background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.7rem', borderRadius: '2rem' }}>
            EV: {engine.totalEvLoss.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="glass-panel situation-panel">
        <div className="status-grid">
          <div className="status-box">
            <span className="status-label">👤 あなた</span>
            <span className="status-value">{currentStage.heroPosition}</span>
          </div>
          <div className="status-box">
            <span className="status-label">⚔️ 相手</span>
            <span className="status-value">{currentStage.villainPosition}</span>
          </div>
          <div className="status-box highlight">
            <span className="status-label">💰 Pot</span>
            <span className="status-value">{currentStage.pot}</span>
          </div>
          <div className="status-box">
            <span className="status-label">💵 Stack</span>
            <span className="status-value">{currentStage.stack}</span>
          </div>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.1rem' }}>アクション状況</div>
          <div style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1rem)', color: 'var(--primary)', fontWeight: 'bold', lineHeight: 1.4 }}>{currentStage.actionToHero}</div>
        </div>

        <div className="cards-row">
          <div className="cards-group">
            <div className="cards-label">あなたのハンド</div>
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
              {currentStage.heroCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
            </div>
          </div>
          {currentStage.board.length > 0 && (
            <div className="cards-group">
              <div className="cards-label">ボード</div>
              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {currentStage.board.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
              </div>
            </div>
          )}
        </div>

        {equity && (
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--accent)', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.65rem', borderRadius: '2rem' }}>
              🧠 {equity === '計算中...' ? 'Equity計算中...' : `Equity: ${equity}%`}
            </span>
          </div>
        )}
      </div>

      <div className="action-buttons">
        {currentStage.options.map((action, i) => {
           let displayLabel = action;
           if (action.includes('33% Pot')) {
             displayLabel = `Bet ${(parseFloat(currentStage.pot) * 0.33).toFixed(1)}BB (33%)`;
           } else if (action.includes('50% Pot')) {
             displayLabel = `Bet ${(parseFloat(currentStage.pot) * 0.50).toFixed(1)}BB (50%)`;
           } else if (action.includes('75% Pot')) {
             displayLabel = `Bet ${(parseFloat(currentStage.pot) * 0.75).toFixed(1)}BB (75%)`;
           } else if (action.includes('All-in')) {
             displayLabel = `ALL-IN (${currentStage.stack})`;
           }

           const parts = displayLabel.split(' (');
           return (
             <button 
               key={action}
               onClick={() => handleAction(action)}
               className="btn btn-outline action-btn"
               disabled={isThinking}
             >
               <span>{parts[0]}</span>
               {parts[1] && <span>({parts[1]}</span>}
               <span className="shortcut-key">[{i + 1}]</span>
             </button>
           );
        })}
      </div>
      
      {currentStage.street === 'Preflop' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setShowRange(!showRange)} style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
            {showRange ? '🙈 レンジ表を隠す' : '👁️ レンジ表を開く'}
          </button>
          {showRange && <RangeChart situation={currentStage} />}
        </div>
      )}
    </div>
  );
};

export default Play;
