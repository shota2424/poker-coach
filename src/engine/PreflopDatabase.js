const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const rankValues = Object.fromEntries(RANKS.map((r, i) => [r, 14 - i]));

function parseRangeString(rangeStr) {
  const hands = new Set();
  const parts = rangeStr.split(',').map(s => s.trim()).filter(s => s);
  
  for (const part of parts) {
    if (part.length === 3 && part.endsWith('+')) { // e.g. "22+"
      const r = part[0];
      const val = rankValues[r];
      for (let v = val; v <= 14; v++) {
        const char = RANKS.find(x => rankValues[x] === v);
        hands.add(char + char);
      }
    } else if (part.length === 4 && part.endsWith('+')) { // e.g. "ATs+"
      const r1 = part[0];
      const r2 = part[1];
      const suited = part[2];
      const v1 = rankValues[r1];
      const v2 = rankValues[r2];
      for (let v = v2; v < v1; v++) {
        const char = RANKS.find(x => rankValues[x] === v);
        hands.add(r1 + char + suited);
      }
    } else {
      hands.add(part); // "AKs", "AA"
    }
  }
  return hands;
}

export const GTO_RANGES = {
  open: {
    UTG: parseRangeString("55+, ATs+, KTs+, QTs+, J9s+, T9s, 98s, 87s, 76s, 65s, AJo+, KQo"),
    HJ:  parseRangeString("22+, A9s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, 65s, 54s, ATo+, KJo+, QJo"),
    CO:  parseRangeString("22+, A2s+, K5s+, Q8s+, J8s+, T8s, 97s, 87s, 76s, 65s, 54s, A8o+, KTo+, QTo+, JTo"),
    BU:  parseRangeString("22+, A2s+, K2s+, Q2s+, J5s+, T6s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o"),
    SB:  parseRangeString("22+, A2s+, K2s+, Q2s+, J5s+, T6s+, 96s+, 85s+, 75s+, 64s+, 54s, 43s, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o"), // Very wide SB open
  },

  facingOpen: {
    // vs UTG/HJ
    threeBet_tight: parseRangeString("QQ+, AKs, AKo, A5s, A4s"),
    call_tight:     parseRangeString("JJ-22, AQs-AJs, KQs, QJs, JTs, T9s, 98s, 87s, 76s, AQo"),

    // vs CO
    threeBet_mid:   parseRangeString("JJ+, AQs+, AKo, A5s-A2s, KJs, QJs, T9s"),
    call_mid:       parseRangeString("TT-22, AJs, ATs, KTs, QTs, JTs, 98s, 87s, 76s, AQo-AJo, KQo"),

    // vs BU
    threeBet_wide:  parseRangeString("99+, AJs+, AKo, AQo, KQs, A5s-A2s, K5s, Q9s, J9s, T8s, 97s, 86s"),
    call_wide:      parseRangeString("88-22, ATs-A2s, KTs-K2s, QTs-Q5s, JTs-J7s, T9s-T7s, 98s-97s, 87s, 76s, 65s, 54s, ATo-A7o, KTo+, QTo+, JTo"),

    // BB vs SB (The widest battle)
    threeBet_bb_vs_sb: parseRangeString("77+, A2s+, K5s+, Q8s+, J8s+, T8s+, 98s, 87s, 76s, A7o+, KTo+, QTo+, JTo"),
    call_bb_vs_sb:     parseRangeString("66-22, K2s-K4s, Q2s-Q7s, J2s-J7s, T2s-T7s, 92s-97s, 82s-86s, 72s-75s, 62s-65s, 52s-54s, 43s, A2o-A6o, K2o-K9o, Q2o-Q9o, J8o-J9o, T8o-T9o, 98o"),
  },

  facing3Bet: {
    // Standard 4bet/Call/Fold
    fourBet: parseRangeString("QQ+, AKs, AKo, A5s-A2s"),
    call:    parseRangeString("JJ-99, AQs, AJs, KQs, QJs, JTs"),
    
    // SB 4bet (Polarized)
    fourBet_sb: parseRangeString("JJ+, AKs, AKo, A5s-A2s, K5s, Q5s"),
  },

  facingLimp: {
    raise: parseRangeString("44+, A2s+, K8s+, Q9s+, J9s+, T9s, 98s, 87s, A8o+, KTo+, QTo+, JTo"),
  }
};

export function getHandString(card1, card2) {
  const r1 = card1[0], s1 = card1[1];
  const r2 = card2[0], s2 = card2[1];
  
  let h1 = r1, h2 = r2;
  if (rankValues[r2] > rankValues[r1]) {
    h1 = r2; h2 = r1;
  }
  if (h1 === h2) return h1 + h2; 
  return h1 + h2 + (s1 === s2 ? 's' : 'o'); 
}

/**
 * openerPosition: Position of the opener
 */
export function evaluatePreflopGTO(card1, card2, position, situationObj) {
  const handStr = getHandString(card1, card2);
  
  // 1. Facing Open
  if (situationObj.facing === 'open') {
     const opener = situationObj.openerPosition || 'CO';
     let threeBetRange, callRange;

     if (position === 'BB' && opener === 'SB') {
       threeBetRange = GTO_RANGES.facingOpen.threeBet_bb_vs_sb;
       callRange = GTO_RANGES.facingOpen.call_bb_vs_sb;
     } else if (opener === 'UTG' || opener === 'HJ') {
       threeBetRange = GTO_RANGES.facingOpen.threeBet_tight;
       callRange = GTO_RANGES.facingOpen.call_tight;
     } else if (opener === 'CO') {
       threeBetRange = GTO_RANGES.facingOpen.threeBet_mid;
       callRange = GTO_RANGES.facingOpen.call_mid;
     } else {
       threeBetRange = GTO_RANGES.facingOpen.threeBet_wide;
       callRange = GTO_RANGES.facingOpen.call_wide;
     }

     if (threeBetRange.has(handStr)) return 'Raise';
     if (callRange.has(handStr)) return 'Call';
     return 'Fold';

  // 2. Facing 3-bet
  } else if (situationObj.facing === '3bet') {
     let fourBetRange = GTO_RANGES.facing3Bet.fourBet;
     let callRange = GTO_RANGES.facing3Bet.call;
     
     if (position === 'SB') {
       fourBetRange = GTO_RANGES.facing3Bet.fourBet_sb;
     }

     if (fourBetRange.has(handStr)) return 'Raise';
     if (callRange.has(handStr)) return 'Call';
     return 'Fold';

  // 3. Facing Limp
  } else if (situationObj.facing === 'limp') {
     if (GTO_RANGES.facingLimp.raise.has(handStr)) return 'Raise';
     return 'Check';

  // 4. Unopened (Deciding to open)
  } else {
     const range = GTO_RANGES.open[position];
     if (range && range.has(handStr)) return 'Raise';
     return 'Fold';
  }
}
