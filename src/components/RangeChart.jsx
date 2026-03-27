import React, { useMemo } from 'react';
import { evaluatePreflopGTO } from '../engine/PreflopDatabase';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export default function RangeChart({ situation }) {
  if (!situation || situation.street !== 'Preflop') {
    return (
      <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        ※ レンジ表はプリフロップでのみ表示されます
      </div>
    );
  }

  const { heroPosition, actionToHero } = situation;
  
  // アクション状況から facing(直面している事前アクション) を推測
  let facing = 'unopened';
  if (actionToHero.includes('オープンレイズ') || actionToHero.includes('オープンしました')) facing = 'open';
  else if (actionToHero.includes('3Bet')) facing = '3bet';
  else if (actionToHero.includes('リンプ')) facing = 'limp';

  // 13x13グリッドと、各アクションのコンボ数・比率を計算
  const grid = useMemo(() => {
    let stats = { Raise: 0, Call: 0, Check: 0, Fold: 0, Total: 1326 };
    const cells = [];
    
    for (let i = 0; i < RANKS.length; i++) {
      const row = [];
      const r1 = RANKS[i];
      for (let j = 0; j < RANKS.length; j++) {
        const r2 = RANKS[j];
        const isPair = i === j;
        const isSuited = j > i; // jが大きい＝配列の後半＝ランクが低い方。つまり r1(強) r2(スモール)s
        
        let card1, card2;
        let comboWeight = 0;
        let handText = '';
        
        if (isPair) {
          card1 = r1 + 's'; card2 = r2 + 'h'; 
          comboWeight = 6;
          handText = r1 + r2;
        } else if (isSuited) {
          // r1が強い
          card1 = r1 + 's'; card2 = r2 + 's';
          comboWeight = 4;
          handText = r1 + r2 + 's';
        } else {
          // r2が強い（左下のオフスート領域は r2が列だが、行iの方がランクが強い。つまり r2が強ランクになる）
          // i > j なので、RANKS[j] の方が強いカードになる。
          card1 = r2 + 's'; card2 = r1 + 'h';
          comboWeight = 12;
          handText = r2 + r1 + 'o';
        }
        
        const action = evaluatePreflopGTO(card1, card2, heroPosition, { facing });
        if (stats[action] !== undefined) stats[action] += comboWeight;
        
        row.push({ text: handText, action });
      }
      cells.push(row);
    }
    return { cells, stats };
  }, [heroPosition, facing]);

  const getActionColor = (action) => {
    if (action === 'Raise') return 'rgba(239, 68, 68, 0.8)'; // Red
    if (action === 'Call') return 'rgba(16, 185, 129, 0.8)'; // Green
    if (action === 'Check') return 'rgba(245, 158, 11, 0.8)'; // Yellow
    return 'transparent'; // Fold = 暗い透過色
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.1rem', textAlign: 'center' }}>
        📊 プリフロップ レンジ表 ({heroPosition} / 相手: {facing === 'unopened' ? 'なし' : facing})
      </h3>
      
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
           <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(239, 68, 68, 0.8)', borderRadius: '2px' }}></span>
           <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Raise: {((grid.stats.Raise / grid.stats.Total) * 100).toFixed(1)}%</span>
        </div>
        {grid.stats.Call > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
             <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(16, 185, 129, 0.8)', borderRadius: '2px' }}></span>
             <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Call: {((grid.stats.Call / grid.stats.Total) * 100).toFixed(1)}%</span>
          </div>
        )}
        {grid.stats.Check > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
             <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(245, 158, 11, 0.8)', borderRadius: '2px' }}></span>
             <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Check: {((grid.stats.Check / grid.stats.Total) * 100).toFixed(1)}%</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
           <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px' }}></span>
           <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>Fold: {((grid.stats.Fold / grid.stats.Total) * 100).toFixed(1)}%</span>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '2px', maxWidth: '400px', margin: '0 auto' }}>
        {grid.cells.flat().map((cell, idx) => (
          <div 
            key={idx} 
            style={{ 
              aspectRatio: '1/1', 
              background: getActionColor(cell.action),
              border: cell.action === 'Fold' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.2)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: cell.action !== 'Fold' ? 'bold' : 'normal',
              color: cell.action !== 'Fold' ? '#fff' : 'rgba(255,255,255,0.3)',
              cursor: 'default',
              userSelect: 'none'
            }}
            title={`${cell.text}: ${cell.action}`}
          >
            {cell.text}
          </div>
        ))}
      </div>
    </div>
  );
}
