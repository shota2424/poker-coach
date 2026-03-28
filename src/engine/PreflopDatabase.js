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
    SB:  parseRangeString("22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A5o+, K8o+, Q9o+, J9o+, T9o"),
  },

  // ── 3bet レンジ（ポジション別） ──────────────────────────────────────
  facingOpen: {
    // vs早期ポジション（UTG/HJ）のオープン: タイトに3bet
    threeBet_tight: parseRangeString("QQ+, AKs, AKo"),
    call_tight:     parseRangeString("JJ, TT, 99, AQs, AJs, KQs, QJs, JTs, T9s, 98s"),

    // vs中間ポジション（CO）のオープン: やや広く3bet  
    threeBet_mid:   parseRangeString("JJ+, AQs+, AKo, A5s, A4s"),
    call_mid:       parseRangeString("22+, ATs+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, AQo"),

    // vsレイトポジション（BU/SB）のオープン: 広く3bet
    threeBet_wide:  parseRangeString("TT+, AJs+, AKo, AQo, KQs, A5s, A4s, A3s"),
    call_wide:      parseRangeString("22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, 65s, A9o+, KTo+, QJo"),
  },

  facing3Bet: {
    fourBet: parseRangeString("QQ+, AKs, AKo"),
    call:    parseRangeString("TT+, AQs, KQs, JTs, T9s, 98s"),
  },

  facingLimp: {
    raise: parseRangeString("55+, A2s+, K8s+, Q9s+, J9s+, T9s, A8o+, KTo+, QTo+, JTo"),
  },
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
 * openerPosition: ポジション of the opener (needed to adjust 3bet range)
 */
export function evaluatePreflopGTO(card1, card2, position, situationObj) {
  const handStr = getHandString(card1, card2);
  
  if (situationObj.facing === 'open') {
     // 3bet range depends on who opened
     const opener = situationObj.openerPosition || 'CO';
     let threeBetRange, callRange;

     if (opener === 'UTG' || opener === 'HJ') {
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
  } else if (situationObj.facing === '3bet') {
     if (GTO_RANGES.facing3Bet.fourBet.has(handStr)) return 'Raise';
     if (GTO_RANGES.facing3Bet.call.has(handStr)) return 'Call';
     return 'Fold';
  } else if (situationObj.facing === 'limp') {
     if (GTO_RANGES.facingLimp.raise.has(handStr)) return 'Raise';
     return 'Check';
  } else {
     const range = GTO_RANGES.open[position];
     if (range && range.has(handStr)) return 'Raise';
     return 'Fold';
  }
}
