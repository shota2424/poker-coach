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
  
  // Paired board
  const isPaired = bVals[0] === bVals[1] || bVals[1] === bVals[2] || (board.length>3 && bVals[2] === bVals[3]);
  
  // Connectedness (gaps between sorted flop cards)
  let gaps = 0;
  for (let i=0; i<Math.min(3, bVals.length)-1; i++) {
     gaps += (bVals[i] - bVals[i+1] - 1);
  }
  const isConnected = gaps <= 2; 
  const isDry = !isPaired && !isMonotone && !isConnected;
  
  const hasA = bVals[0] === 14;

  return { isDry, isWet: !isDry, isPaired, isMonotone, isTwoTone, isRainbow, isConnected, hasA };
}

export function evaluatePostflopGTO(heroCards, board, heroIsOOP, isPreflopRaiser, facingActionObj) {
  const texture = analyzeBoardTexture(board);
  
  const heroRanks = heroCards.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const heroSuits = heroCards.map(c => c[1]);
  const bVals = board.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const bSuits = board.map(c => c[1]);

  // Rankings relative to board
  const isPocketPair = heroRanks[0] === heroRanks[1];
  const hasOverPair = isPocketPair && heroRanks[0] > (bVals[0] || 0);
  const hasTopPair = !isPocketPair && (heroRanks[0] === bVals[0] || heroRanks[1] === bVals[0]);
  const hasMiddlePair = !isPocketPair && bVals.length > 1 && (heroRanks[0] === bVals[1] || heroRanks[1] === bVals[1]);

  // Draws
  const suitCounts = {};
  [...heroSuits, ...bSuits].forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  const isFlushDraw = maxSuitCount === 4;
  const isFlush = maxSuitCount >= 5;

  // Extremely rough straight draw approximation
  const allVals = Array.from(new Set([...heroRanks, ...bVals])).sort((a,b) => a-b);
  let isStraightDraw = false;
  for (let i = 0; i <= allVals.length - 4; i++) {
     if (allVals[i+3] - allVals[i] <= 4) isStraightDraw = true; 
  }

  const hand = Hand.solve([...heroCards, ...board]);
  const strRanks = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
  const absoluteStrength = strRanks.indexOf(hand.name);
  
  // Two pair or better is a monster on most boards
  const isMonster = absoluteStrength >= 2 || hasOverPair;

  const hasGoodDraw = isFlushDraw || isStraightDraw;
  const isAir = !hasTopPair && !hasMiddlePair && !isPocketPair && !hasGoodDraw && !isMonster;

  // ---------------------------------
  // ----- GTO Heuristic Tree --------
  // ---------------------------------

  if (facingActionObj.facing === 'check') {
     // We are checking / betting
     if (isPreflopRaiser) {
       // C-Betting Logic
       if (heroIsOOP) {
          // OOP PFR: Play polar (bet strong and draws, check mid hands)
          if (isMonster || isFlushDraw) return texture.isPaired ? 'Bet 33% Pot' : 'Bet 75% Pot';
          if (hasTopPair) return 'Bet 75% Pot';
          return 'Check';
       } else {
          // IP PFR: Bet frequent small on dry boards, polar big on wet
          if (texture.isDry || texture.hasA) {
             return 'Bet 33% Pot'; // Range bet
          } else { // Wet board
             if (isMonster || hasTopPair) return 'Bet 75% Pot';
             if (hasGoodDraw) return 'Bet 75% Pot'; // Semi-bluff
             return 'Check'; // Give up / Pot control
          }
       }
     } else {
       // Caller (Probe/Float betting)
       if (isMonster || hasTopPair) return 'Bet 75% Pot';
       if (hasGoodDraw) return 'Bet 33% Pot'; // Semi bluff float
       if (isAir && !heroIsOOP) return 'Bet 33% Pot'; // IP stab when checked to
       return 'Check';
     }
  } else if (facingActionObj.facing === 'bet') {
     // Facing a bet (Donk bet, or C-bet)
     if (isMonster) return 'Raise';
     if (isFlushDraw && heroIsOOP) return 'Call'; // Consider x/r, but call is safe
     if (hasTopPair) return 'Call';
     if (hasGoodDraw || hasMiddlePair || (isPocketPair && heroRanks[0] > bVals[1])) return 'Call';
     return 'Fold';
  } else if (facingActionObj.facing === 'allin') {
     // Facing an All-in
     if (absoluteStrength >= 4 || isFlush) return 'Call'; 
     if (isMonster && !texture.isMonotone && !texture.isConnected) return 'Call'; 
     return 'Fold';
  }
  
  return 'Check';
}
