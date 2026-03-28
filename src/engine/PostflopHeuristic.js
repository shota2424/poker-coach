import { Hand } from 'pokersolver';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = Object.fromEntries(RANKS.map((r, i) => [r, i+2]));

export function analyzeBoardTexture(board) {
  if (board.length < 3) return { isDry: true, isWet: false, isPaired: false, isMonotone: false };
  
  const bVals = board.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const bSuits = board.map(c => c[1]);
  
  const suitCounts = {};
  bSuits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  
  const isMonotone = maxSuitCount >= 3;
  const isTwoTone = maxSuitCount === 2;
  const isRainbow = maxSuitCount === 1;
  
  const isPaired = bVals[0] === bVals[1] || bVals[1] === bVals[2] || (board.length>3 && bVals[2] === bVals[3]);
  
  let gaps = 0;
  for (let i=0; i<Math.min(3, bVals.length)-1; i++) {
     gaps += (bVals[i] - bVals[i+1] - 1);
  }
  const isConnected = gaps <= 2; 
  const isDry = !isPaired && !isMonotone && !isConnected;
  
  const hasA = bVals[0] === 14;
  const hasHighCards = bVals[0] >= 12; // Q or higher on board

  return { isDry, isWet: !isDry, isPaired, isMonotone, isTwoTone, isRainbow, isConnected, hasA, hasHighCards };
}

export function evaluatePostflopGTO(heroCards, board, heroIsOOP, isPreflopRaiser, facingActionObj) {
  const texture = analyzeBoardTexture(board);
  const street = board.length <= 3 ? 'flop' : board.length === 4 ? 'turn' : 'river';
  
  const heroRanks = heroCards.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const heroSuits = heroCards.map(c => c[1]);
  const bVals = board.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const bSuits = board.map(c => c[1]);

  // Hand rankings relative to board
  const isPocketPair = heroRanks[0] === heroRanks[1];
  const hasOverPair = isPocketPair && heroRanks[0] > (bVals[0] || 0);
  const hasTopPair = !isPocketPair && (heroRanks[0] === bVals[0] || heroRanks[1] === bVals[0]);
  const hasMiddlePair = !isPocketPair && bVals.length > 1 && (heroRanks[0] === bVals[1] || heroRanks[1] === bVals[1]);
  const hasBottomPair = !isPocketPair && bVals.length > 2 && (heroRanks[0] === bVals[2] || heroRanks[1] === bVals[2]);
  const hasTPTK = hasTopPair && heroRanks[0] >= 14; // top pair top kicker

  // Draw detection
  const suitCounts = {};
  [...heroSuits, ...bSuits].forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  const isFlushDraw = maxSuitCount === 4;
  const isFlush = maxSuitCount >= 5;

  // Straight draw
  const allVals = Array.from(new Set([...heroRanks, ...bVals])).sort((a,b) => a-b);
  let isStraightDraw = false;
  let isOESD = false; // open-ended straight draw
  let isGutshot = false;
  for (let i = 0; i <= allVals.length - 4; i++) {
    const span = allVals[i+3] - allVals[i];
    if (span === 3) isOESD = true;  // 4 consecutive = OESD
    if (span === 4) isGutshot = true; // 4 cards in 5 range = gutshot
  }
  isStraightDraw = isOESD || isGutshot;

  const hand = Hand.solve([...heroCards, ...board]);
  const strRanks = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
  const absoluteStrength = strRanks.indexOf(hand.name);
  
  const isNuts = absoluteStrength >= 4; // straight+
  const isMonster = absoluteStrength >= 2 || hasOverPair; // two pair or overpair
  const hasGoodDraw = isFlushDraw || isOESD;
  const hasMarginalDraw = isGutshot && !isOESD;
  const isAir = !hasTopPair && !hasMiddlePair && !hasBottomPair && !isPocketPair && !hasGoodDraw && !isMonster;

  // ─── ストリート別の判断差 ────────────────────────────────────────────
  // リバーではドローが実質無効（もう引けない）
  const drawIsLive = street !== 'river';
  const effectiveGoodDraw = hasGoodDraw && drawIsLive;
  const effectiveMarginalDraw = hasMarginalDraw && drawIsLive;

  // ─── FACING CHECK (betting decision) ──────────────────────────────────

  if (facingActionObj.facing === 'check') {
     if (isPreflopRaiser) {
       // C-Betting / Barrel Logic
       if (heroIsOOP) {
         // OOP PFR
         if (street === 'flop') {
           if (isNuts) return 'Bet 75% Pot';
           if (isMonster || isFlushDraw) return texture.isPaired ? 'Bet 33% Pot' : 'Bet 75% Pot';
           if (hasTopPair) return 'Bet 75% Pot';
           if (effectiveGoodDraw) return 'Bet 33% Pot'; // semi-bluff
           return 'Check';
         } else if (street === 'turn') {
           // Turn barrel: polarize more
           if (isNuts || isMonster) return 'Bet 75% Pot';
           if (hasTPTK) return 'Bet 50% Pot';
           if (hasTopPair) return 'Bet 33% Pot'; // thin value / pot control
           if (effectiveGoodDraw) return 'Bet 50% Pot'; // semi-bluff
           return 'Check';
         } else {
           // River: value or bluff, no middle ground
           if (isNuts || isMonster) return 'Bet 75% Pot';
           if (hasTPTK) return 'Bet 50% Pot';
           if (isAir && Math.random() < 0.35) return 'Bet 75% Pot'; // bluff frequency
           return 'Check'; // showdown value
         }
       } else {
         // IP PFR
         if (street === 'flop') {
           if (texture.isDry || texture.hasA) {
             // Dry/A-high: range bet small
             if (isNuts || isMonster) return 'Bet 75% Pot'; // don't small-bet the nuts
             return 'Bet 33% Pot';
           } else {
             if (isMonster || hasTopPair) return 'Bet 75% Pot';
             if (effectiveGoodDraw) return 'Bet 75% Pot'; // semi-bluff on wet board
             return 'Check';
           }
         } else if (street === 'turn') {
           if (isNuts || isMonster) return 'Bet 75% Pot';
           if (hasTopPair) return 'Bet 50% Pot';
           if (effectiveGoodDraw) return 'Bet 50% Pot';
           if (hasMiddlePair || isPocketPair) return 'Check'; // pot control
           return 'Check';
         } else {
           // River IP: thin value or bluff
           if (isNuts || isMonster) return 'Bet 75% Pot';
           if (hasTPTK || hasOverPair) return 'Bet 50% Pot';
           if (hasTopPair) return 'Bet 33% Pot'; // thin value
           if (isAir && Math.random() < 0.30) return 'Bet 75% Pot'; // bluff
           return 'Check';
         }
       }
     } else {
       // Caller (defender) — probe / float bets
       if (street === 'flop') {
         if (isMonster || hasTopPair) return 'Bet 75% Pot';
         if (effectiveGoodDraw) return 'Bet 33% Pot';
         if (isAir && !heroIsOOP) return 'Bet 33% Pot'; // IP stab
         return 'Check';
       } else if (street === 'turn') {
         if (isNuts || isMonster) return 'Bet 75% Pot';
         if (hasTopPair) return 'Bet 50% Pot';
         if (effectiveGoodDraw) return 'Bet 33% Pot';
         return 'Check';
       } else {
         // River
         if (isNuts || isMonster) return 'Bet 75% Pot';
         if (hasTopPair && heroRanks[0] >= 12) return 'Bet 50% Pot'; // thin value
         if (isAir && Math.random() < 0.25) return 'Bet 75% Pot'; // bluff
         return 'Check';
       }
     }

  // ─── FACING BET (call / raise / fold decision) ──────────────────────────

  } else if (facingActionObj.facing === 'bet') {
     if (street === 'flop') {
       if (isNuts || (isMonster && !texture.isMonotone)) return 'Raise';
       if (isFlushDraw && heroIsOOP) return 'Call'; // x/r consideration
       if (hasTopPair || hasOverPair) return 'Call';
       if (effectiveGoodDraw || hasMiddlePair) return 'Call';
       if (isPocketPair && heroRanks[0] > (bVals[1] || 0)) return 'Call';
       return 'Fold';
     } else if (street === 'turn') {
       // ターン: ドローのオッズが悪くなる、ペアの価値も下がる
       if (isNuts || isMonster) return 'Raise';
       if (hasOverPair || hasTPTK) return 'Call';
       if (hasTopPair) return 'Call'; // still usually a call
       if (effectiveGoodDraw) return 'Call'; // drawing to river
       if (hasMiddlePair && heroRanks[0] >= 10) return 'Call'; // marginal call
       if (effectiveMarginalDraw) return 'Fold'; // gutshot not worth it on turn
       return 'Fold';
     } else {
       // リバー: ドロー完成したかショーダウンバリューで判断
       if (isNuts || isFlush || absoluteStrength >= 4) return 'Raise';
       if (isMonster) return 'Call'; // two pair+ is a call
       if (hasOverPair) return 'Call'; // overpair bluff catch
       if (hasTPTK) return 'Call'; // TPTK bluff catch
       if (hasTopPair && heroRanks[0] >= 12) return 'Call'; // decent top pair bluff catch
       if (hasTopPair && heroRanks[0] < 12) return 'Fold'; // weak kicker top pair
       if (hasMiddlePair) return 'Fold'; // middle pair folds on river
       return 'Fold';
     }

  // ─── FACING ALL-IN ────────────────────────────────────────────────────

  } else if (facingActionObj.facing === 'allin') {
     if (absoluteStrength >= 4 || isFlush) return 'Call'; // straight+
     if (isMonster && !texture.isMonotone && !texture.isConnected) return 'Call'; // 2pair+ on safe board
     if (hasOverPair && absoluteStrength <= 1 && texture.isDry) return 'Call'; // overpair on dry board
     return 'Fold';
  }
  
  return 'Check';
}
