import { Hand } from 'pokersolver';
import { evaluatePreflopGTO } from './PreflopDatabase';
import { evaluatePostflopGTO } from './PostflopHeuristic';

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, 'T':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

export async function calculateExactEquityAsync(heroCards, board) {
    const DECK = [];
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    for (let r of ranks) for (let s of suits) DECK.push(r + s);

    let known = new Set([...heroCards, ...board]);
    let remaining = DECK.filter(c => !known.has(c));
    let wins = 0;
    let total = 0;
    
    // UIを固めないために一旦メインスレッドを解放
    await new Promise(resolve => setTimeout(resolve, 0));

    if (board.length === 5) {
        // リバーの場合は「完全列挙（Exact Enumeration）」(残り45枚の組み合わせ990通りを全探索)
        for (let i = 0; i < remaining.length; i++) {
            for (let j = i + 1; j < remaining.length; j++) {
                let v1 = remaining[i];
                let v2 = remaining[j];
                try {
                   let heroHand = Hand.solve([...heroCards, ...board]);
                   let villainHand = Hand.solve([v1, v2, ...board]);
                   let w = Hand.winners([heroHand, villainHand]);
                   if (w[0] === heroHand && w.length === 1) wins++;
                   else if (w.length === 2) wins += 0.5;
                   total++;
                } catch(e) {}
            }
        }
    } else {
        // フロップ・ターンの場合は「高精度モンテカルロシミュレーション」(5000回)
        const ITERS = 5000;
        for (let i = 0; i < ITERS; i++) {
            if (i % 500 === 0) await new Promise(r => setTimeout(r, 0)); 
            
            let needed = 2 + (5 - board.length);
            for (let j = 0; j < needed; j++) {
                const k = j + Math.floor(Math.random() * (remaining.length - j));
                const temp = remaining[j];
                remaining[j] = remaining[k];
                remaining[k] = temp;
            }
            
            let v1 = remaining[0];
            let v2 = remaining[1];
            let b = [...board];
            for (let j = 0; j < 5 - board.length; j++) {
               b.push(remaining[2 + j]);
            }
            
            try {
               let heroHand = Hand.solve([...heroCards, ...b]);
               let villainHand = Hand.solve([v1, v2, ...b]);
               let w = Hand.winners([heroHand, villainHand]);
               if (w[0] === heroHand && w.length === 1) wins++;
               else if (w.length === 2) wins += 0.5;
               total++;
            } catch(e) {}
        }
    }
    return ((wins / total) * 100).toFixed(2);
}

export class PokerEngine {
  constructor() {
    this.deck = [];
    this.board = [];
    this.heroCards = [];
    this.villainCards = [];
    this.pot = 1.5;
    this.heroStack = 100;
    this.street = 'Preflop';
    this.history = [];
    this.score = 100;
    this.preflopState = { facing: 'unopened' };
    this.heroPosition = 'BU';
    this.villainPosition = 'BB';
    this.drillName = null;
    this.difficulty = 'advanced';
    this.totalEvLoss = 0.00;
  }

  resetGame(drillName = null, difficulty = 'advanced') {
    this.difficulty = difficulty;
    this.deck = [];
    for (let r of RANKS) {
      for (let s of SUITS) {
        this.deck.push(r + s);
      }
    }
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.board = [];
    this.heroCards = [this.deck.pop(), this.deck.pop()];
    this.villainCards = [this.deck.pop(), this.deck.pop()];
    this.history = [];
    // this.totalEvLoss = 0.00; // コメントアウトしてセッション全体で累積するように変更
    this.drillName = drillName;

    // Villain range enforcer — used after position is decided
    const dealVillainInRange = (villainPos, facingForVillain, maxAttempts = 30) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const rec = evaluatePreflopGTO(this.villainCards[0], this.villainCards[1], villainPos, { facing: facingForVillain });
        if (rec === 'Raise' || rec === 'Call') return; // acceptable hand
        // Redeal villain cards: return current cards to deck and redraw
        this.deck.unshift(...this.villainCards);
        // Shuffle only the returned portion
        for (let i = this.deck.length - 1; i >= this.deck.length - 2; i--) {
          const j = Math.floor(Math.random() * this.deck.length);
          [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        this.villainCards = [this.deck.pop(), this.deck.pop()];
      }
    };

    if (drillName === 'flop_cb') {
      this.heroPosition = 'BU';
      this.villainPosition = 'BB';
      this.preflopState = { facing: 'unopened' }; 
      this.pot = 5.5;
      this.street = 'Flop'; 
      this.heroStack = 100;
      this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      return;
    } else if (drillName === 'river_bluff') {
      this.heroPosition = 'BB';
      this.villainPosition = 'BU';
      this.preflopState = { facing: 'open' }; 
      this.pot = 45.0;
      this.street = 'River'; 
      this.heroStack = [100, 150][Math.floor(Math.random() * 2)];
      this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.heroFolded = false;
      this.villainFolded = false;
      this.pendingVillainAction = null;
      return;
    }

    this.street = 'Preflop';
    this.heroStack = [30, 50, 100, 150, 200][Math.floor(Math.random() * 5)];
    this.heroFolded = false;
    this.villainFolded = false;
    this.pendingVillainAction = null;

    const PREFLOP_ORDER = ['UTG', 'HJ', 'CO', 'BU', 'SB', 'BB'];
    const p1Idx = Math.floor(Math.random() * 6);
    let p2Idx = Math.floor(Math.random() * 6);
    while (p2Idx === p1Idx) p2Idx = Math.floor(Math.random() * 6);
    
    const firstActIdx = Math.min(p1Idx, p2Idx);
    const secondActIdx = Math.max(p1Idx, p2Idx);
    const firstPosition = PREFLOP_ORDER[firstActIdx];
    const secondPosition = PREFLOP_ORDER[secondActIdx];

    const scenarioDice = Math.random();
    
    if (scenarioDice < 0.08 && firstPosition === 'SB' && secondPosition === 'BB') {
       this.heroPosition = 'BB';
       this.villainPosition = 'SB';
       this.preflopState = { facing: 'limp' };
       this.pot = 2.0;
       // SBのリンプはコール相当 — 特にレンジ縛りなし（弱め可）
    } else if (scenarioDice < 0.35) {
       // Hero opens — villain responds
       this.heroPosition = firstPosition;
       this.villainPosition = secondPosition;
       this.preflopState = { facing: 'open_by_hero' };
       this.pot = 1.5;
       // 相手はヒーローの後ろ側なので特にレンジ縛りなし
    } else if (scenarioDice < 0.55) {
       // Unopened — hero decides whether to open
       this.heroPosition = firstPosition;
       this.villainPosition = secondPosition;
       this.preflopState = { facing: 'unopened' };
       this.pot = 1.5;
    } else if (scenarioDice < 0.80) {
       // Villain already opened — enforce villain opening range
       this.villainPosition = firstPosition;
       this.heroPosition = secondPosition;
       this.preflopState = { facing: 'open' };
       this.pot = 4.0;
       // ✅ ヴィランをそのポジションのオープンレンジに縛る
       dealVillainInRange(this.villainPosition, 'unopened');
    } else {
       // Hero opened, villain 3bet — enforce villain 3bet range
       this.heroPosition = firstPosition;
       this.villainPosition = secondPosition;
       this.preflopState = { facing: '3bet' };
       this.pot = 12.0;
       // ✅ ヴィランを3betレンジ（高強度ハンドのみ）に縛る
       dealVillainInRange(this.villainPosition, 'open');
    }
  }


  progressStreet() {
    if (this.street === 'Preflop') {
      this.street = 'Flop';
      this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
    } else if (this.street === 'Flop') {
      this.street = 'Turn';
      this.board.push(this.deck.pop());
    } else if (this.street === 'Turn') {
      this.street = 'River';
      this.board.push(this.deck.pop());
    } else if (this.street === 'River') {
      this.street = 'Showdown';
    }
  }

  evaluateHandContext() {
    const heroRanks = this.heroCards.map(c => c[0]);
    const heroSuits = this.heroCards.map(c => c[1]);
    const hVals = heroRanks.map(r => RANK_VALUES[r]).sort((a,b) => b-a);
    const isSuited = heroSuits[0] === heroSuits[1];
    
    // (High card * 2) + (Low card) + (Pair ? +22) + (Suited ? +6)
    const preflopScore = (hVals[0] * 2) + hVals[1] + (hVals[0] === hVals[1] ? 22 : 0) + (isSuited ? 6 : 0);

    if (this.street === 'Preflop') return { preflopScore, isSuited, hVals };

    const boardRanks = this.board.map(c => c[0]);
    const boardSuits = this.board.map(c => c[1]);
    const bVals = boardRanks.map(r => RANK_VALUES[r]).sort((a,b) => b-a);

    const isPocketPair = hVals[0] === hVals[1];
    const hasOverPair = isPocketPair && hVals[0] > (bVals[0] || 0);
    const hasTopPair = !isPocketPair && (hVals[0] === bVals[0] || hVals[1] === bVals[0]);
    const hasMiddlePair = !isPocketPair && bVals.length > 1 && (hVals[0] === bVals[1] || hVals[1] === bVals[1]);

    const suitCounts = {};
    [...heroSuits, ...boardSuits].forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const isFlushDraw = Object.values(suitCounts).some(c => c === 4);
    
    // Check Straight Draw (very coarse approximation)
    const allVals = Array.from(new Set([...hVals, ...bVals])).sort((a,b) => a-b);
    let isStraightDraw = false;
    for (let i = 0; i <= allVals.length - 4; i++) {
       if (allVals[i+3] - allVals[i] <= 4) isStraightDraw = true; // OESD or Gutshot roughly
    }

    const hand = Hand.solve([...this.heroCards, ...this.board]);
    const ranks = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
    const absoluteStrength = ranks.indexOf(hand.name);

    return {
      absoluteStrength,
      hasOverPair,
      hasTopPair,
      hasMiddlePair,
      isFlushDraw,
      isStraightDraw,
      isMonster: absoluteStrength >= 2
    };
  }

  getPreflopOptimalAction(pos) {
    const facing = this.preflopState.facing;
    const basicGTO = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], pos, { facing });
    
    if (facing === 'unopened') {
       if (pos === 'SB') return basicGTO === 'Fold' ? 'Fold' : 'Raise (3BB)';
       return basicGTO === 'Fold' ? 'Fold' : 'Raise (2.5BB)';
    } else if (facing === 'limp') {
       return basicGTO === 'Raise' ? 'Raise (3.5BB)' : 'Check';
    } else if (facing === 'open') {
       if (this.villainPosition === 'SB') return basicGTO === 'Raise' ? 'Raise (3Bet: 9BB)' : basicGTO; 
       if (pos === 'BB' || pos === 'SB') return basicGTO === 'Raise' ? 'Raise (3Bet: 9BB)' : basicGTO; 
       return basicGTO === 'Raise' ? 'Raise (3Bet: 7.5BB)' : basicGTO;
    } else if (facing === '3bet') {
       if (pos === 'UTG' || pos === 'HJ') return basicGTO === 'Raise' ? 'Raise (4Bet: 20BB)' : basicGTO;
       return basicGTO === 'Raise' ? 'Raise (4Bet: 22BB)' : basicGTO;
    }
    return basicGTO;
  }

  getSituation() {
    let options = [];
    let optimalAction = '';
    let actionToHero = '';

    if (this.pendingVillainAction === 'Raise') {
      actionToHero = '相手がさらに厳しいレイズ（リレイズ）を返してきました！';
      options = ['Fold', 'Call', 'Raise (All-in)'];
      if (this.street === 'Preflop') {
         let rec = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], this.heroPosition, { facing: '3bet' });
         optimalAction = rec === 'Raise' ? 'Raise (All-in)' : rec;
      } else {
         let rec = evaluatePostflopGTO(this.heroCards, this.board, this.heroPosition === 'BB', false, { facing: 'allin' });
         optimalAction = rec === 'Raise' ? 'Raise (All-in)' : rec;
      }
      this.pendingVillainAction = null; 

      return {
        street: this.street, board: [...this.board], pot: this.pot.toFixed(1) + 'BB', stack: this.heroStack.toFixed(1) + 'BB', heroCards: [...this.heroCards], heroPosition: this.heroPosition, villainPosition: this.villainPosition, actionToHero, options, optimalAction, evLoss: this.generateEvLoss(options, optimalAction)
      };
    }
    
    if (this.street === 'Preflop') {
      let recommended = this.getPreflopOptimalAction(this.heroPosition);
      const facing = this.preflopState.facing;
      
      if (facing === 'unopened') {
        if (this.heroPosition === 'UTG') actionToHero = 'ゲーム開始。UTG(あなた)の番です。ブラインドは1.5BBです。';
        else actionToHero = `フォールドであなた(${this.heroPosition})まで回ってきました。`;
        const raiseSize = this.heroPosition === 'SB' ? '3BB' : '2.5BB';
        options = ['Fold', 'Call', `Raise (${raiseSize})`, 'All-in'];
        optimalAction = recommended === 'Fold' ? 'Fold' : `Raise (${raiseSize})`;
      } else if (facing === 'open_by_hero') {
        // Hero acts first — decides whether to open raise
        if (this.heroPosition === 'UTG') actionToHero = `UTG(あなた)からオープンします。何BBでレイズしますか？`;
        else actionToHero = `${this.heroPosition}(あなた)からオープンレイズを検討しています。アクションを選んでください。`;
        const raiseSize = this.heroPosition === 'SB' ? '3BB' : '2.5BB';
        options = ['Fold', `Raise (${raiseSize})`, 'All-in'];
        // GTO recommends raise if hand is strong enough
        const rec2 = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], this.heroPosition, { facing: 'unopened' });
        optimalAction = rec2 === 'Fold' ? 'Fold' : `Raise (${raiseSize})`;
      } else if (facing === 'limp') {
        actionToHero = 'SB(相手)が1BBのリンプインをしてきました。BB(あなた)の番です。';
        options = ['Check', 'Raise (3.5BB)', 'Raise (5BB)', 'All-in'];
        optimalAction = recommended === 'Check' ? 'Check' : 'Raise (3.5BB)';
      } else if (facing === 'open') {
        actionToHero = `${this.villainPosition}(相手)がオープンレイズしました。${this.heroPosition}(あなた)の番です。`;
        const raiseSize = (this.heroPosition === 'SB' || this.heroPosition === 'BB' || this.villainPosition === 'SB') ? '9BB' : '7.5BB';
        options = ['Fold', 'Call', `Raise (3Bet: ${raiseSize})`, 'All-in'];
        optimalAction = ['Call', 'Fold'].includes(recommended) ? recommended : `Raise (3Bet: ${raiseSize})`;
      } else if (facing === '3bet') {
        actionToHero = `あなたが${this.heroPosition}からオープンしたところ、${this.villainPosition}(相手)が3Betしてきました！`;
        const raiseSize = (this.heroPosition === 'UTG' || this.heroPosition === 'HJ') ? '20BB' : '22BB';
        options = ['Fold', 'Call', `Raise (4Bet: ${raiseSize})`, 'All-in'];
        optimalAction = ['Call', 'Fold'].includes(recommended) ? recommended : `Raise (4Bet: ${raiseSize})`;
      }
    } else {
      const positionsOrder = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BU'];
      const heroIdx = positionsOrder.indexOf(this.heroPosition);
      const villainIdx = positionsOrder.indexOf(this.villainPosition);
      const heroIsOOP = heroIdx < villainIdx;
      // Preflop Raiser (アグレッサー) かどうかの簡易推定
      const heroIsPFR = this.preflopState ? (this.preflopState.facing === 'unopened' || this.preflopState.facing === '3bet') : true;
      
      const pRandom = Math.random();

      if (this.drillName === 'flop_cb' && this.street === 'Flop') {
        actionToHero = '相手(BB)がチェックしました。（IPのあなたのC-Bet判断です）';
        options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
        optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, true, { facing: 'check' });
      } else if (this.drillName === 'river_bluff' && this.street === 'River') {
        actionToHero = `相手(BU) がリバーでタフなベット（${(this.pot * 0.75).toFixed(1)}BB）をしてきました。ブラフキャッチしますか？`;
        options = ['Fold', 'Call', 'Raise (All-in)'];
        let res = evaluatePostflopGTO(this.heroCards, this.board, true, false, { facing: 'bet' });
        optimalAction = res === 'Raise' ? 'Raise (All-in)' : res;
      } else {
        const villainIsPFR = !heroIsPFR;
        // 相手(Villain)自身の手札を使ってGTO評価を行い、本当に打つべき手か判定する
        const villainGTO = evaluatePostflopGTO(this.villainCards, this.board, !heroIsOOP, villainIsPFR, { facing: 'check' });

        if (heroIsOOP) {
          // もし相手が絶対チェックしたい（弱い手）なら、自分からアクションさせることでリアル感を出す
          if (villainGTO === 'Check' || Math.random() < 0.5) {
            actionToHero = 'OOPのあなたからアクションの番です。（相手は順番待ち）';
            options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
            optimalAction = evaluatePostflopGTO(this.heroCards, this.board, true, heroIsPFR, { facing: 'check' });
          } else {
             // 相手が本当にBetしたいハンドを持っている場合のみ、「自分がチェックして相手が打ってきた」状況を作る
             const betStr = this.difficulty === 'beginner' ? 'ハーフポット' : villainGTO.replace('Bet ', '');
             
             if (this.difficulty === 'advanced' && (this.street === 'River' || this.pot >= this.heroStack / 2) && villainGTO === 'Bet 75% Pot') {
                 actionToHero = 'あなたがチェックしたところ、相手が全額をオールインしてきました！';
                 options = ['Fold', 'Call'];
                 let res = evaluatePostflopGTO(this.heroCards, this.board, true, heroIsPFR, { facing: 'allin' });
                 optimalAction = res === 'Raise' ? 'Call' : res;
             } else {
                 actionToHero = `あなたがチェックしたところ、相手が標準的なベット（${betStr}）をしてきました。`;
                 options = ['Fold', 'Call', 'Raise', 'All-in'];
                 optimalAction = evaluatePostflopGTO(this.heroCards, this.board, true, heroIsPFR, { facing: 'bet' });
             }
          }
        } else { 
          // IP hero (相手がOOPなので先にアクションする)
          if (villainGTO === 'Check') {
            actionToHero = '相手(OOP)がチェックしました。（IPのあなたの番です）';
            options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
            optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, heroIsPFR, { facing: 'check' });
          } else {
            const betStr = this.difficulty === 'beginner' ? 'ドンクベット（ハーフポット）' : villainGTO.replace('Bet ', '') + 'のベット';
            
            if (this.difficulty === 'advanced' && (this.street === 'River' || this.pot >= this.heroStack / 2) && villainGTO === 'Bet 75% Pot') {
                actionToHero = '相手が突然全額（オールイン）をしてきました！';
                options = ['Fold', 'Call'];
                let res = evaluatePostflopGTO(this.heroCards, this.board, false, heroIsPFR, { facing: 'allin' });
                optimalAction = res === 'Raise' ? 'Call' : res;
            } else {
                actionToHero = `相手が ${betStr} をしてきました。`;
                options = ['Fold', 'Call', 'Raise (All-in)'];
                optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, heroIsPFR, { facing: 'bet' });
            }
          }
        }
      }
    }

    return {
      street: this.street,
      board: [...this.board],
      pot: this.pot.toFixed(1) + 'BB',
      stack: this.heroStack.toFixed(1) + 'BB',
      heroCards: [...this.heroCards],
      heroPosition: this.heroPosition,
      villainPosition: this.villainPosition,
      actionToHero,
      options,
      optimalAction,
      evLoss: this.generateEvLoss(options, optimalAction)
    };
  }

  generateEvLoss(options, optimalAction) {
    const ev = {};
    const ctx = this.evaluateHandContext();
    
    options.forEach(opt => {
       if (opt === optimalAction) {
           ev[opt] = 0.00;
           return;
       }
       
       let loss = 0;
       if (this.street === 'Preflop') {
           const strength = ctx.preflopScore;
           if (opt === 'Fold') loss = strength > 26 ? -1.5 : 0.00;
           else if (opt === 'Call') loss = optimalAction === 'Fold' ? -0.5 : -0.1;
           else if (opt.includes('Raise')) loss = strength < 20 ? -1.0 : 0.00;
           else loss = -0.2;
       } else {
           const hasValue = ctx.isMonster || ctx.hasTopPair || ctx.hasOverPair;
           const hasDraw = ctx.isFlushDraw || ctx.isStraightDraw;
           
           if (opt === 'Fold') {
               if (hasValue) loss = -(this.pot * 0.8);
               else if (hasDraw) loss = -(this.pot * 0.3);
               else loss = 0.00; 
           } else if (opt === 'Call') {
               if (optimalAction.includes('Raise')) loss = -0.2; 
               else if (optimalAction === 'Fold' || optimalAction === 'Check') loss = -(this.pot * 0.4); 
               else loss = 0.00;
           } else if (opt.includes('Raise') || opt.includes('Bet') || opt.includes('All-in')) {
               if (optimalAction === 'Fold') loss = -(this.pot * 1.5); 
               else if (optimalAction === 'Check' || optimalAction === 'Call') {
                   loss = (hasValue || hasDraw) ? 0.00 : -(this.pot * 0.5); 
               } else {
                   loss = -0.1; 
               }
           } else if (opt === 'Check') {
               if (optimalAction.includes('Bet')) loss = hasValue ? -0.5 : 0.00;
               else loss = 0.00;
           }
       }
       ev[opt] = parseFloat(Math.min(0, loss).toFixed(2));
    });
    
    if (optimalAction.includes('Fold') || optimalAction === 'Fold') ev['Fold'] = 0.00;
    return ev;
  }

  applyAction(action) {
    const sit = this.getSituation();
    let loss = sit.evLoss[action] !== undefined ? sit.evLoss[action] : -0.50;
    
    this.totalEvLoss += loss;
    this.history.push({ street: this.street, action, evLoss: loss });
    
    const isCallingAllIn = action === 'Call' && sit.actionToHero.includes('オールイン');
    if (action.includes('Fold')) {
      this.heroFolded = true;
      return true; 
    }
    if (action.includes('All-in') || isCallingAllIn) {
      if (action.includes('All-in')) {
        this.pot += this.heroStack * 2;
        this.heroStack = 0;
      }
      return true; // へとわだちする
    }

    let heroAdded = 0;
    let isAggressive = false;
    if (action.includes('Raise') || action.includes('Bet')) {
      isAggressive = true;
      if (action.includes('33%')) { heroAdded = this.pot * 0.33; this.pot += this.pot * 0.66; }
      else if (action.includes('75%')) { heroAdded = this.pot * 0.75; this.pot += this.pot * 1.5; }
      else if (action.includes('2.5BB')) { heroAdded = 2.5; this.pot += 3; }
      else if (action.includes('3BB')) { heroAdded = 3; this.pot += 3.5; }
      else if (action.includes('9BB')) { heroAdded = 9; this.pot += 10; }
      else if (action.includes('22BB')) { heroAdded = 22; this.pot += 25; }
      else { heroAdded = this.pot; this.pot += this.pot * 2.5; } // generic Raise
    } else if (action === 'Call') {
      heroAdded = this.pot * 0.25; 
      this.pot += this.pot * 0.5; 
    }
    
    this.heroStack = Math.max(0, this.heroStack - heroAdded);

    if (isAggressive) {
       let villainResp = 'Call';
       if (this.difficulty === 'beginner') {
           villainResp = Math.random() < 0.6 ? 'Fold' : 'Call'; 
       } else {
           if (this.street === 'Preflop') {
               const facingStr = action.includes('3Bet') ? '3bet' : 'open';
               villainResp = evaluatePreflopGTO(this.villainCards[0], this.villainCards[1], this.villainPosition, { facing: facingStr });
               if (action.includes('4Bet') || action.includes('All-in')) villainResp = Math.random() < 0.4 ? 'Call' : 'Fold';
           } else {
               const facingState = (this.pot > 40) ? 'allin' : 'bet';
               villainResp = evaluatePostflopGTO(this.villainCards, this.board, this.heroPosition === 'BU', false, { facing: facingState });
           }
       }

       if (villainResp === 'Fold') {
           this.villainFolded = true;
           return true; 
       } else if (villainResp === 'Raise' && !action.includes('All-in')) {
           this.pendingVillainAction = 'Raise';
           this.pot += heroAdded * 2; 
           return false; 
       } else {
           this.pot += heroAdded; 
           this.progressStreet();
           return this.street === 'Showdown';
       }
    } else {
       this.progressStreet();
       return this.street === 'Showdown';
    }
  }

  getShowdownResult(heroFoldedArg = false) {
    if (heroFoldedArg || this.heroFolded) {
      return {
        isShowdown: false,
        resultText: 'あなたがフォールドしました😷',
        villainCards: [...this.villainCards],
        villainHandName: '不明',
        heroHandName: '不明',
        finalBoard: [...this.board]
      };
    }
    
    if (this.villainFolded) {
      return {
        isShowdown: false,
        resultText: '相手がフォールドしました🏆',
        isHeroWinner: true,
        heroHandName: 'Winner',
        villainHandName: 'Folded',
        villainCards: [...this.villainCards],
        finalBoard: [...this.board]
      };
    }

    // オールイン等でボードが最後まで開いていない場合は5枚になるまで配る
    while (this.board.length < 5) {
      this.board.push(this.deck.pop());
    }

    const heroHand = Hand.solve([...this.heroCards, ...this.board]);
    const villainHand = Hand.solve([...this.villainCards, ...this.board]);
    const winners = Hand.winners([heroHand, villainHand]);
    
    let resultText = '';
    let isHeroWinner = false;
    if (winners.length === 2) {
      resultText = 'チョップ（引き分け）です！🤝';
    } else if (winners[0] === heroHand) {
      resultText = 'あなたの勝ちです！🎉';
      isHeroWinner = true;
    } else {
      resultText = '相手の勝ちです...💸';
    }

    return {
      isShowdown: true,
      resultText,
      isHeroWinner,
      heroHandName: heroHand.descr,
      villainHandName: villainHand.descr,
      villainCards: [...this.villainCards],
      finalBoard: [...this.board]
    };
  }
}
