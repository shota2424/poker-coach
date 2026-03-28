import gtoData from '../data/gto-ranges.json';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const rankValues = Object.fromEntries(RANKS.map((r, i) => [r, 14 - i]));

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
 * Resolves a GTO action ('R', 'C', 'F', 'M') into a engine-ready action.
 */
function resolveAction(actionCode, scenarioData, hand) {
  if (actionCode === 'R') return 'Raise';
  if (actionCode === 'C') return 'Call';
  if (actionCode === 'F' || !actionCode) return 'Fold';
  
  if (actionCode === 'M') {
    // Check frequency if available
    const freq = scenarioData.freq?.[hand] ?? 0.5;
    return Math.random() < freq ? 'Raise' : 'Call';
  }
  return 'Fold';
}

export function evaluatePreflopGTO(card1, card2, position, situationObj) {
  const handStr = getHandString(card1, card2);
  const scenarios = gtoData.scenarios;
  // Map 'BU' to 'BTN' for JSON lookup
  const pos = position === 'BU' ? 'BTN' : position;
  
  // 1. Unopened (RFI)
  if (situationObj.facing === 'unopened') {
    const scenario = scenarios.open_raise[pos];
    if (!scenario) return 'Fold';
    const action = scenario[handStr];
    return resolveAction(action, scenario, handStr);
  }

  // 2. Facing Open (3-betting or Calling)
  if (situationObj.facing === 'open') {
    let opener = situationObj.openerPosition || 'UTG';
    if (opener === 'BU') opener = 'BTN';
    let scenario;
    
    if (pos === 'BB') {
      scenario = scenarios.BB_vs_open["vs_" + opener];
      if (!scenario) scenario = scenarios.BB_vs_open["vs_BTN"];
      if (!scenario) scenario = scenarios.BB_vs_open["vs_UTG"];
    } else {
      scenario = scenarios.three_bet["vs_" + opener];
      if (!scenario) scenario = scenarios.three_bet["vs_BTN"];
      if (!scenario) scenario = scenarios.three_bet["vs_UTG"];
    }
    
    if (!scenario) return 'Fold';
    const action = scenario[handStr];
    return resolveAction(action, scenario, handStr);
  }

  // 3. Facing Limp
  if (situationObj.facing === 'limp') {
    // Note: The JSON doesn't provide explicit limp scenarios, fallback to heuristic
    const highCardValue = Math.max(rankValues[handStr[0]], rankValues[handStr[1]]);
    if (handStr[0] === handStr[1] && highCardValue >= 6) return 'Raise'; // 66+
    if (highCardValue >= 12 && handStr.endsWith('s')) return 'Raise'; // Qsx+
    return 'Check';
  }

  // 4. Facing 3-bet (4-betting or Calling)
  if (situationObj.facing === '3bet') {
    let scenario;
    if (pos === 'BTN') {
      scenario = scenarios.vs_3bet["BTN_vs_3bet"];
    } else {
      scenario = scenarios.vs_3bet[pos + "_vs_3bet"];
    }
    if (!scenario) return 'Fold';
    const action = scenario[handStr];
    // In vs_3bet, R=4bet, C=Call, F=Fold
    return resolveAction(action, scenario, handStr);
  }

  // Default fallback
  return 'Fold';
}
