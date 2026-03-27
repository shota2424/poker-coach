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
      <div className="glass-panel" style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out' }}>
        <Trophy size={64} color={engine.totalEvLoss >= -0.5 ? 'var(--accent)' : engine.totalEvLoss >= -2.0 ? 'var(--warning)' : 'var(--danger)'} style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ハンド終了！ 総EV損失: {engine.totalEvLoss.toFixed(2)} BB</h2>
        
        {showdownResult && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', margin: '1.5rem auto', maxWidth: '600px' }}>
            <h3 className={showdownResult.resultText.includes('勝ち') ? 'winner-text' : ''} style={{ margin: 0, color: showdownResult.resultText.includes('勝ち') ? '#fbbf24' : 'var(--accent)', fontSize: '1.8rem', fontWeight: '800' }}>
                結果: {showdownResult.resultText}
              </h3>
            
            {showdownResult.finalBoard && showdownResult.finalBoard.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>最終ボード</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                  {showdownResult.finalBoard.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>あなたのハンド</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  {currentStage.heroCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>{showdownResult.heroHandName}</div>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>相手のハンド</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  {showdownResult.villainCards.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--danger)', fontWeight: 'bold' }}>{showdownResult.villainHandName}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ margin: '2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          {engine.history.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', width: '100%', maxWidth: '500px', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold', width: '80px', textAlign: 'left' }}>{h.street}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>選択: {h.action}</span>
              <span style={{ color: h.evLoss === 0 ? 'var(--accent)' : h.evLoss >= -0.5 ? 'var(--warning)' : 'var(--danger)', fontWeight: 'bold' }}>
                {h.evLoss === 0 ? '✅ Excellent (0.00)' : h.evLoss >= -0.5 ? `⚠️ Inaccuracy (${h.evLoss.toFixed(2)})` : `❌ Blunder (${h.evLoss.toFixed(2)})`}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '1.5rem', background: 'rgba(59, 130, 246, 0.15)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)', textAlign: 'left', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            <MessageSquare size={18} /> OpenAI 専属コーチからの総評
          </div>

          {!aiExplanation && !isThinking && (
             <button onClick={handleRequestAI} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', fontWeight: 'bold' }}>
               🤖 このハンドの詳しいプレイング評価をAIコーチに聞く
             </button>
          )}

          {isThinking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', margin: '1rem 0' }}>
              <Loader2 size={24} className="spin" color="var(--primary)" />
              <span>コーチがあなたのプレイ履歴をAI分析し、解説を生成中です...</span>
            </div>
          )}
          
          {aiExplanation && (
            <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{aiExplanation}</div>
          )}
        </div>
        <button className="btn btn-primary" onClick={startNewGame} disabled={isThinking} style={{ marginTop: '1rem', width: '100%', padding: '1rem', fontSize: '1.2rem' }}>
          <RefreshCcw size={18} style={{ marginRight: '0.5rem' }} /> 次のハンドへ進む [Enter]
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>実戦プレイモード ({currentStage.street})</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '2rem', cursor: 'pointer', fontWeight: 'bold' }}>
            <option value="beginner">🟢 相手: ノーマル</option>
            <option value="advanced">😈 相手: 本気 (GTO)</option>
          </select>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: engine.totalEvLoss < -5 ? 'var(--danger)' : engine.totalEvLoss < -1 ? 'var(--warning)' : 'var(--accent)', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '2rem' }}>
            📊 総EV損失: {engine.totalEvLoss.toFixed(2)} BB
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <div className="status-grid">
          <div className="status-box">
            <span className="status-label">🦸‍♂️ Hero</span>
            <span className="status-value">{currentStage.heroPosition}</span>
          </div>
          <div className="status-box">
            <span className="status-label">🎯 Villain</span>
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

        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>現在のアクション状況</div>
          <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 'bold' }}>{currentStage.actionToHero}</div>
        </div>
        
        {currentStage.board.length > 0 && (
           <div style={{ marginBottom: '2rem' }}>
             <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ボード</div>
             <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            {currentStage.board.map((c, i) => <PlayingCard key={i} index={i} card={c} />)}
          </div>
           </div>
        )}

        <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>あなたのハンド</div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
          {currentStage.heroCards.map(c => <PlayingCard key={c} card={c} />)}
        </div>
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
      
      <div style={{ textAlign: 'center', marginTop: '2rem', minHeight: '60px' }}>
        {equity && (
           <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', background: 'rgba(16,185,129,0.1)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '2rem', animation: equity !== '計算中...' ? 'fadeIn 0.5s' : 'none' }}>
             {equity === '計算中...' ? '🧠 厳密な勝率（Equity）を計算中...' : `🧠 精密勝率 (Equity vs ATC): ${equity}%`}
           </h3>
        )}
        
        {currentStage.street === 'Preflop' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button className="btn btn-outline" onClick={() => setShowRange(!showRange)} style={{ marginBottom: '1rem' }}>
               {showRange ? '🙈 レンジ表を隠す' : '👁️ レンジ表（カンニングペーパー）を開く'}
            </button>
            {showRange && <RangeChart situation={currentStage} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default Play;
