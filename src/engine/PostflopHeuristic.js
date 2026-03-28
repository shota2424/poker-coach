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
  const isTwoTone   = maxSuitCount === 2;
  const isPaired    = bVals[0] === bVals[1] || bVals[1] === bVals[2] || (board.length>3 && bVals[2] === bVals[3]);
  
  let gaps = 0;
  for (let i=0; i<Math.min(3, bVals.length)-1; i++) {
     gaps += (bVals[i] - bVals[i+1] - 1);
  }
  const isConnected = gaps <= 2; 
  const isDry = !isPaired && !isMonotone && !isConnected;
  
  const hasA = bVals[0] === 14;
  const hasHighCards = bVals[0] >= 12;

  return { isDry, isWet: !isDry, isPaired, isMonotone, isTwoTone, isConnected, hasA, hasHighCards };
}

/**
 * @param {Object} facingActionObj { facing: 'check'|'bet'|'allin', amount: number (bet size as % of pot) }
 */
export function evaluatePostflopGTO(heroCards, board, heroIsOOP, isPreflopRaiser, facingActionObj, isMultiway = false) {
  const texture = analyzeBoardTexture(board);
  const street = board.length <= 3 ? 'flop' : (board.length === 4 ? 'turn' : 'river');
  const betSize = facingActionObj.amount || 0; // 0.33, 0.75, 1.0 etc.

  const heroRanks = heroCards.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const heroSuits = heroCards.map(c => c[1]);
  const bVals = board.map(c => RANK_VALUES[c[0]]).sort((a,b) => b-a);
  const bSuits = board.map(c => c[1]);

  // Hand identification
  const isPocketPair = heroRanks[0] === heroRanks[1];
  const hasOverPair  = isPocketPair && heroRanks[0] > (bVals[0] || 0);
  const hasTopPair   = !isPocketPair && (heroRanks[0] === bVals[0] || heroRanks[1] === bVals[0]);
  const hasMiddlePair = !isPocketPair && bVals.length > 1 && (heroRanks[0] === bVals[1] || heroRanks[1] === bVals[1]);
  const hasBottomPair = !isPocketPair && bVals.length > 2 && (heroRanks[0] === bVals[2] || heroRanks[1] === bVals[2]);
  const hasTPTK     = hasTopPair && heroRanks[0] >= 14;

  // Draws
  const suitCounts = {};
  [...heroSuits, ...bSuits].forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  const isFlushDraw = maxSuitCount === 4;
  const isFlush     = maxSuitCount >= 5;

  const allVals = Array.from(new Set([...heroRanks, ...bVals])).sort((a,b) => a-b);
  let isOESD = false; 
  let isGutshot = false;
  for (let i = 0; i <= allVals.length - 4; i++) {
    const span = allVals[i+3] - allVals[i];
    if (span === 3) isOESD = true;
    if (span === 4) isGutshot = true;
  }
  const isStraightDraw = isOESD || isGutshot;

  const hand = Hand.solve([...heroCards, ...board]);
  const strRanks = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
  const absoluteStrength = strRanks.indexOf(hand.name);
  
  const isNuts    = absoluteStrength >= 4; // straight+
  const isMonster = absoluteStrength >= 2 || hasOverPair; 
  const hasGoodDraw = isFlushDraw || isOESD;
  const isAir     = !hasTopPair && !hasMiddlePair && !hasBottomPair && !isPocketPair && !hasGoodDraw && !isMonster;

  // Multiway adjustment: Be much tighter
  const strengthTier = (isMonster ? 3 : (hasTopPair || hasGoodDraw ? 2 : (hasMiddlePair ? 1 : 0))) - (isMultiway ? 1 : 0);

  // ─── 1. FACING CHECK / ACTING FIRST ───────────────────────────────────

  if (facingActionObj.facing === 'check') {
     if (isPreflopRaiser) {
        // C-Bet / Barrel Logic
        if (heroIsOOP) {
           // OOP PFR: Polarized strategy
           if (street === 'flop') {
              if (isMonster || isFlushDraw) return texture.isPaired ? 'Bet 33% Pot' : 'Bet 75% Pot';
              if (hasTopPair && heroRanks[0] >= 12) return 'Bet 75% Pot';
              return 'Check';
           } else { // Turn/River OOP
              if (isNuts || isMonster) return 'Bet 75% Pot';
              if (isAir && Math.random() < 0.3) return 'Bet 75% Pot'; // Bluff
              return 'Check';
           }
        } else {
           // IP PFR: Small frequent bets vs big polar bets
           if (street === 'flop') {
              if (texture.isDry || texture.hasA) return 'Bet 33% Pot'; // Range bet
              if (isMonster || hasGoodDraw) return 'Bet 75% Pot';
              return 'Check';
           } else if (street === 'turn') {
              if (isMonster || isOESD || isFlushDraw) return 'Bet 75% Pot';
              if (hasTopPair) return 'Bet 50% Pot';
              return 'Check';
           } else { // River
              if (isNuts || isMonster) return (Math.random() < 0.2 ? 'Bet 150% Pot' : 'Bet 75% Pot'); // Overbet
              if (hasTPTK) return 'Bet 50% Pot';
              if (isAir && Math.random() < 0.25) return 'Bet 75% Pot'; // Bluff
              return 'Check';
           }
        }
     } else {
        // Caller (Defender) strategy
        if (isMonster) return heroIsOOP ? 'Check' : 'Bet 75% Pot'; // OOP x/r, IP value
        if (hasGoodDraw && !heroIsOOP) return 'Bet 33% Pot'; // IP stab
        return 'Check';
     }
  }

  // ─── 2. FACING BET (The MDF / Pot Odds Core) ──────────────────────────

  if (facingActionObj.facing === 'bet') {
     // Minimum Defense Frequency (Approx)
     // 33% bet -> MDF 75% (Catch middle pair+)
     // 75% bet -> MDF 57% (Catch top pair+)
     // 150% bet -> MDF 40% (Catch high top pair+)

     if (street === 'river') {
        // No more draws. Value vs Bluffs only.
        if (isNuts || isFlush) return 'Raise';
        if (isMonster) return 'Call'; // Two pair+ always call river
        
        if (betSize <= 0.4) { // Small bet
          return (hasMiddlePair || hasTopPair || hasOverPair) ? 'Call' : 'Fold';
        } else if (betSize <= 0.8) { // Medium bet
          return (hasTopPair || hasOverPair) ? 'Call' : 'Fold';
        } else { // Overbet / Large
          return (hasTPTK || hasOverPair) ? 'Call' : 'Fold';
        }
     } else {
        // Turn / Flop: Consider draws and future streets
        if (isNuts) return 'Raise';
        if (isMonster) {
          // Check-raise semi-frequently OOP
          if (heroIsOOP && Math.random() < 0.4) return 'Raise';
          return 'Call';
        }
        
        if (hasGoodDraw) return 'Call';
        if (hasTopPair) return 'Call';

        if (betSize <= 0.4) {
           return (hasMiddlePair || isGutshot) ? 'Call' : 'Fold';
        }
        return 'Fold';
     }
  }

  // ─── 3. FACING ALL-IN ──────────────────────────────────────────────────

  if (facingActionObj.facing === 'allin') {
     if (absoluteStrength >= 4 || isFlush) return 'Call'; 
     if (isMonster && texture.isDry) return 'Call';
     return 'Fold';
  }

  return 'Check';
}
