import { Hand } from 'pokersolver';
import { evaluatePreflopGTO, getHandString } from './PreflopDatabase';
import { evaluatePostflopGTO } from './PostflopHeuristic';

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, 'T':10, 'J':11, 'Q':12, 'K':13, 'A':14 };
const ALL_POSITIONS = ['UTG', 'HJ', 'CO', 'BU', 'SB', 'BB'];

// ─── Equity Calculation ───────────────────────────────────────────────────────

export async function calculateExactEquityAsync(heroCards, board) {
  const DECK = [];
  const suits = ['s', 'h', 'd', 'c'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  for (let r of ranks) for (let s of suits) DECK.push(r + s);
  let known = new Set([...heroCards, ...board]);
  let remaining = DECK.filter(c => !known.has(c));
  let wins = 0, total = 0;
  await new Promise(resolve => setTimeout(resolve, 0));
  if (board.length === 5) {
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        try {
          let heroHand = Hand.solve([...heroCards, ...board]);
          let villainHand = Hand.solve([remaining[i], remaining[j], ...board]);
          let w = Hand.winners([heroHand, villainHand]);
          if (w[0] === heroHand && w.length === 1) wins++;
          else if (w.length === 2) wins += 0.5;
          total++;
        } catch(e) {}
      }
    }
  } else {
    const ITERS = 5000;
    for (let i = 0; i < ITERS; i++) {
      if (i % 500 === 0) await new Promise(r => setTimeout(r, 0));
      let needed = 2 + (5 - board.length);
      for (let j = 0; j < needed; j++) {
        const k = j + Math.floor(Math.random() * (remaining.length - j));
        [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
      }
      let v1 = remaining[0], v2 = remaining[1];
      let b = [...board];
      for (let j = 0; j < 5 - board.length; j++) b.push(remaining[2 + j]);
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

// ─── 6-Player Preflop Simulator ───────────────────────────────────────────────

/**
 * Deals random hole cards to all positions from the deck,
 * skipping the hero's position (whose cards are already dealt).
 */
function dealTableHands(deck, heroPos, heroCards) {
  const hands = { [heroPos]: heroCards };
  for (const pos of ALL_POSITIONS) {
    if (pos !== heroPos) {
      hands[pos] = [deck.pop(), deck.pop()];
    }
  }
  return hands;
}

/**
 * Simulates preflop action from UTG up to (but not including) heroIdx.
 * Returns { facing, openRaiser, callersBefore, preflopActionLog, pot }
 */
function simulatePreflopBeforeHero(tableHands, heroIdx) {
  let facing = 'unopened';
  let openRaiser = null;
  let callersBefore = [];
  let preflopActionLog = [];
  let pot = 1.5; // SB(0.5) + BB(1.0)

  for (let i = 0; i < heroIdx; i++) {
    const pos = ALL_POSITIONS[i];
    const hand = tableHands[pos];
    const rec = evaluatePreflopGTO(hand[0], hand[1], pos, { facing, openerPosition: openRaiser });

    if (facing === 'unopened') {
      if (rec === 'Raise') {
        openRaiser = pos;
        facing = 'open';
        pot += 2.5;
        preflopActionLog.push(`${pos}: オープン(2.5BB)`);
      } else {
        preflopActionLog.push(`${pos}: フォールド`);
      }
    } else if (facing === 'open') {
      const rec2 = evaluatePreflopGTO(hand[0], hand[1], pos, { facing: 'open', openerPosition: openRaiser });
      if (rec2 === 'Raise') {
        const prevOpener = openRaiser;
        openRaiser = pos;
        facing = '3bet';
        pot += 9;
        preflopActionLog.push(`${pos}: 3ベット(9BB)`);
      } else if (rec2 === 'Call') {
        callersBefore.push(pos);
        pot += 2.5;
        preflopActionLog.push(`${pos}: コール`);
      } else {
        preflopActionLog.push(`${pos}: フォールド`);
      }
    } else if (facing === '3bet') {
      const rec3 = evaluatePreflopGTO(hand[0], hand[1], pos, { facing: '3bet' });
      if (rec3 === 'Raise') {
        facing = '4bet';
        pot += 22;
        preflopActionLog.push(`${pos}: 4ベット(22BB)`);
      } else if (rec3 === 'Call') {
        callersBefore.push(pos);
        pot += 9;
        preflopActionLog.push(`${pos}: コール`);
      } else {
        preflopActionLog.push(`${pos}: フォールド`);
      }
    }
  }

  return { facing, openRaiser, callersBefore, preflopActionLog, pot };
}

// ─── PokerEngine Class ─────────────────────────────────────────────────────────

export class PokerEngine {
  constructor() {
    this.deck = [];
    this.board = [];
    this.heroCards = [];
    this.villainCards = []; // main villain for postflop
    this.tableHands = {};
    this.activePlayers = []; // players still in after preflop
    this.heroPosition = 'BU';
    this.villainPosition = 'BB'; // main villain position
    this.pot = 1.5;
    this.heroStack = 100;
    this.street = 'Preflop';
    this.history = [];
    this.preflopState = { facing: 'unopened' };
    this.preflopHistory = []; // preflop action log
    this.matchHistory = [];   // full hand history (preflop, flop, turn)
    this.openRaiser = null;
    this.isMultiway = false;
    this.drillName = null;
    this.difficulty = 'advanced';
    this.totalEvLoss = 0.00;
    this.heroFolded = false;
    this.villainFolded = false;
    this.pendingVillainAction = null;
  }

  _shuffle() {
    this.deck = [];
    for (let r of RANKS) for (let s of SUITS) this.deck.push(r + s);
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  resetGame(drillName = null, difficulty = 'advanced') {
    this.difficulty = difficulty;
    this.drillName = drillName;
    this._shuffle();

    // ── Drill shortcuts ────────────────────────────────────────────────────
    if (drillName === 'flop_cb') {
      this.heroCards = [this.deck.pop(), this.deck.pop()];
      this.villainCards = [this.deck.pop(), this.deck.pop()];
      this.tableHands = {};
      this.heroPosition = 'BU'; this.villainPosition = 'BB';
      this.preflopState = { facing: 'unopened' };
      this.preflopHistory = ['フロップCBetドリル'];
      this.activePlayers = ['BU', 'BB'];
      this.pot = 5.5; this.street = 'Flop'; this.heroStack = 100;
      this.board = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.heroFolded = false; this.villainFolded = false; this.pendingVillainAction = null;
      this.isMultiway = false;
      this._genHistory(drillName);
      return;
    }
    if (drillName === 'river_bluff') {
      this.heroCards = [this.deck.pop(), this.deck.pop()];
      this.villainCards = [this.deck.pop(), this.deck.pop()];
      this.tableHands = {};
      this.heroPosition = 'BB'; this.villainPosition = 'BU';
      this.preflopState = { facing: 'open' };
      this.preflopHistory = ['リバーブラフキャッチドリル'];
      this.activePlayers = ['BB', 'BU'];
      this.pot = 45.0; this.street = 'River';
      this.heroStack = [100, 150][Math.floor(Math.random() * 2)];
      this.board = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.heroFolded = false; this.villainFolded = false; this.pendingVillainAction = null;
      this.isMultiway = false;
      this._genHistory(drillName);
      return;
    }

    // ── ターンのブラフキャッチ ─────────────────────────────────────────────
    if (drillName === 'turn_bluff_catch') {
      this.heroCards = [this.deck.pop(), this.deck.pop()];
      this.villainCards = [this.deck.pop(), this.deck.pop()];
      this.tableHands = {};
      this.heroPosition = 'BB'; this.villainPosition = 'BU';
      this.preflopState = { facing: 'open' };
      this.preflopHistory = ['ターン：ブラフキャッチドリル'];
      this.activePlayers = ['BB', 'BU'];
      const turnPot = [15, 20, 25, 30][Math.floor(Math.random() * 4)];
      this.pot = turnPot;
      this.street = 'Turn';
      this.heroStack = [80, 100, 120][Math.floor(Math.random() * 3)];
      this.board = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.heroFolded = false; this.villainFolded = false; this.pendingVillainAction = null;
      this.isMultiway = false;
      this._genHistory(drillName);
      return;
    }

    // ── リバー：コール/フォールド/レイズ判断 ─────────────────────────────
    if (drillName === 'river_decision') {
      this.heroCards = [this.deck.pop(), this.deck.pop()];
      this.villainCards = [this.deck.pop(), this.deck.pop()];
      this.tableHands = {};
      // Randomly hero is IP or OOP
      const heroIsIP = Math.random() > 0.5;
      this.heroPosition = heroIsIP ? 'BU' : 'BB';
      this.villainPosition = heroIsIP ? 'BB' : 'BU';
      this.preflopState = { facing: heroIsIP ? 'open_by_hero' : 'open' };
      this.preflopHistory = ['リバー：コール/フォールド/レイズ判断ドリル'];
      this.activePlayers = [this.heroPosition, this.villainPosition];
      const rivPot = [18, 25, 35, 50][Math.floor(Math.random() * 4)];
      this.pot = rivPot;
      this.street = 'River';
      this.heroStack = [60, 80, 100, 150][Math.floor(Math.random() * 4)];
      this.board = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.heroFolded = false; this.villainFolded = false; this.pendingVillainAction = null;
      this.isMultiway = false;
      this._genHistory(drillName);
      return;
    }

    // ── ターン：ベットサイジング練習 ─────────────────────────────────────
    if (drillName === 'turn_bet_sizing') {
      this.heroCards = [this.deck.pop(), this.deck.pop()];
      this.villainCards = [this.deck.pop(), this.deck.pop()];
      this.tableHands = {};
      this.heroPosition = 'BU'; this.villainPosition = 'BB';
      this.preflopState = { facing: 'open_by_hero' };
      this.preflopHistory = ['ターン：ベットサイジングドリル（IP）'];
      this.activePlayers = ['BU', 'BB'];
      const tPot = [12, 16, 20, 28][Math.floor(Math.random() * 4)];
      this.pot = tPot;
      this.street = 'Turn';
      this.heroStack = [80, 100, 130][Math.floor(Math.random() * 3)];
      this.board = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.heroFolded = false; this.villainFolded = false; this.pendingVillainAction = null;
      this.isMultiway = false;
      return;
    }

    // ── リバー：バリューベット vs チェック ────────────────────────────────
    if (drillName === 'river_value') {
      this.heroCards = [this.deck.pop(), this.deck.pop()];
      this.villainCards = [this.deck.pop(), this.deck.pop()];
      this.tableHands = {};
      this.heroPosition = 'BU'; this.villainPosition = 'BB';
      this.preflopState = { facing: 'open_by_hero' };
      this.preflopHistory = ['リバー：バリューベット判断ドリル（IP）'];
      this.activePlayers = ['BU', 'BB'];
      const rvPot = [20, 28, 35, 45][Math.floor(Math.random() * 4)];
      this.pot = rvPot;
      this.street = 'River';
      this.heroStack = [60, 80, 100][Math.floor(Math.random() * 3)];
      this.board = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.heroFolded = false; this.villainFolded = false; this.pendingVillainAction = null;
      this.isMultiway = false;
      return;
    }

    // ── Full 6-player table simulation ────────────────────────────────────
    this.street = 'Preflop';
    this.heroStack = [30, 50, 100, 150, 200][Math.floor(Math.random() * 5)];
    this.heroFolded = false;
    this.villainFolded = false;
    this.pendingVillainAction = null;
    this.board = [];

    // Pick hero position randomly (all 6 are equally common)
    const heroIdx = Math.floor(Math.random() * 6);
    this.heroPosition = ALL_POSITIONS[heroIdx];
    const heroPos = this.heroPosition;

    // Deal hero cards first, then fill the table
    this.heroCards = [this.deck.pop(), this.deck.pop()];
    const tableHands = dealTableHands(this.deck, this.heroPosition, this.heroCards);

    // Simulate action before hero
    const { facing, openRaiser, callersBefore, preflopActionLog, pot: prePot } = simulatePreflopBeforeHero(tableHands, heroIdx);
    this.tableHands = tableHands;
    this.preflopState = { facing, openerPosition: openRaiser };
    this.preflopHistory = preflopActionLog;
    this.matchHistory = [...preflopActionLog.map(l => `Preflop: ${l}`)];
    this.pot = prePot;
    this.activePlayers = [heroPos];
    if (openRaiser) this.activePlayers.push(openRaiser);
    callersBefore.forEach(p => this.activePlayers.push(p));
    this.isMultiway = this.activePlayers.length > 2;

    // Pick main villain: the open raiser, or nearest player behind hero, or BB
    if (openRaiser) {
      this.villainPosition = openRaiser;
    } else {
      // No raiser yet — assign a "default" opponent that will respond after hero
      const behindPositions = ALL_POSITIONS.slice(heroIdx + 1);
      this.villainPosition = behindPositions.length > 0
        ? behindPositions[behindPositions.length - 1] // last = BB usually
        : ALL_POSITIONS[heroIdx > 0 ? heroIdx - 1 : 0];
    }
    this.villainCards = this.tableHands[this.villainPosition] || [this.deck.pop(), this.deck.pop()];

    // Track initial active players (haven't folded before hero)
    const foldedBefore = new Set();
    for (let i = 0; i < heroIdx; i++) {
      const logEntry = preflopActionLog[i];
      if (logEntry && logEntry.includes('フォールド')) {
        foldedBefore.add(ALL_POSITIONS[i]);
      }
    }
    this.activePlayers = ALL_POSITIONS.filter((p, i) => i !== heroIdx && !foldedBefore.has(p));
    this.isMultiway = (callersBefore.length + (openRaiser ? 1 : 0)) > 1;
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
    const allVals = Array.from(new Set([...hVals, ...bVals])).sort((a,b) => a-b);
    let isStraightDraw = false;
    for (let i = 0; i <= allVals.length - 4; i++) {
      if (allVals[i+3] - allVals[i] <= 4) isStraightDraw = true;
    }
    const hand = Hand.solve([...this.heroCards, ...this.board]);
    const ranks = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];
    const absoluteStrength = ranks.indexOf(hand.name);
    return { absoluteStrength, hasOverPair, hasTopPair, hasMiddlePair, isFlushDraw, isStraightDraw, isMonster: absoluteStrength >= 2 };
  }

  // ─── Build hero action context in preflop ──────────────────────────────────

  getPreflopOptimalAction(pos, facing) {
    if (facing === 'unopened' || facing === 'open_by_hero') {
      const rec = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], pos, { facing: 'unopened' });
      return rec === 'Raise' ? (pos === 'SB' ? 'Raise (3BB)' : 'Raise (2.5BB)') : 'Fold';
    }
    if (facing === 'open') {
      const rec = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], pos, { facing: 'open', openerPosition: this.openRaiser });
      if (rec === 'Raise') return pos === 'BB' || pos === 'SB' ? 'Raise (3Bet: 9BB)' : 'Raise (3Bet: 7.5BB)';
      return rec; // 'Call' or 'Fold'
    }
    if (facing === '3bet') {
      const rec = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], pos, { facing: '3bet' });
      if (rec === 'Raise') return 'Raise (4Bet: 22BB)';
      return rec;
    }
    if (facing === '4bet') {
      const rec = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], pos, { facing: '3bet' });
      return rec === 'Raise' ? 'Call' : 'Fold'; // vs 4bet: call premium, else fold
    }
    if (facing === 'limp') {
      const rec = evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], pos, { facing: 'limp' });
      return rec === 'Raise' ? 'Raise (3.5BB)' : 'Check';
    }
    return 'Fold';
  }

  _genHistory(drillName) {
    this.matchHistory = [];
    const hero = this.heroPosition;
    const vill = this.villainPosition;
    const isHeroIP = (hero === 'BU' || hero === 'CO' || (hero === 'BB' && vill === 'SB'));

    // 1. Preflop
    if (drillName === 'flop_cb' || drillName === 'turn_bet_sizing' || drillName === 'river_value') {
       this.matchHistory.push(`Preflop: あなた(${hero})が 2.5BB オープン。${vill}がコール。`);
    } else {
       this.matchHistory.push(`Preflop: ${vill}が 2.5BB オープン。あなた(${hero})がコール。`);
    }

    // 2. Flop
    if (this.street === 'Turn' || this.street === 'River') {
      const b3 = this.board.slice(0, 3).map(c => c[0]+c[1]).join(' ');
      if (drillName === 'turn_bluff_catch' || drillName === 'river_bluff' || drillName === 'river_decision') {
        this.matchHistory.push(`Flop [${b3}]: あなたがチェック、${vill}が 33%ポットをベット、あなたはコール。`);
      } else {
        this.matchHistory.push(`Flop [${b3}]: ${vill}がチェック、あなたが 33%ポットをベット、${vill}がコール。`);
      }
    }

    // 3. Turn
    if (this.street === 'River') {
      const t = this.board[3][0] + this.board[3][1];
      if (drillName === 'river_bluff') {
        this.matchHistory.push(`Turn [${t}]: あなたも相手もチェック。`);
      } else if (drillName === 'river_decision') {
        this.matchHistory.push(`Turn [${t}]: 激しいアクションはなく、互いにチェック。`);
      }
    }
  }

  getSituation() {
    let options = [];
    let optimalAction = '';
    let actionToHero = '';

    // ─── Pending villain re-raise ───────────────────────────────────────────
    if (this.pendingVillainAction === 'Raise') {
      actionToHero = `${this.villainPosition}が さらにリレイズしてきました！`;
      options = ['Fold', 'Call', 'Raise (All-in)'];
      const rec = this.street === 'Preflop'
        ? evaluatePreflopGTO(this.heroCards[0], this.heroCards[1], this.heroPosition, { facing: '3bet' })
        : evaluatePostflopGTO(this.heroCards, this.board, false, false, { facing: 'allin' });
      optimalAction = rec === 'Raise' ? 'Raise (All-in)' : rec;
      this.pendingVillainAction = null;
      return this._buildSit(actionToHero, options, optimalAction);
    }

    // ─── PREFLOP ────────────────────────────────────────────────────────────
    if (this.street === 'Preflop') {
      const facing = this.preflopState.facing;
      const historyPrefix = this.preflopHistory.length > 0
        ? this.preflopHistory.join(' → ') + ' → '
        : '';
      const multiwayNote = this.isMultiway ? '（マルチウェイ）' : '';

      if (facing === 'unopened') {
        if (this.heroPosition === 'BB' && this.preflopHistory.every(h => h.includes('コール') || h.includes('フォールド'))) {
          // BB facing limps/complete
          actionToHero = `${historyPrefix}あなた(BB)の番です。リンプ/コール後のBBアクション。${multiwayNote}`;
          options = ['Check', 'Raise (4BB)', 'All-in'];
          optimalAction = this.getPreflopOptimalAction(this.heroPosition, 'limp');
        } else if (this.heroPosition === 'SB' && this.preflopHistory.every(h => h.includes('フォールド'))) {
          // SB completing vs BB
          actionToHero = `全員フォールドでSB(あなた)の番です。BBに対してどうしますか？`;
          options = ['Fold', 'Call (リンプ)', 'Raise (3BB)', 'All-in'];
          optimalAction = this.getPreflopOptimalAction(this.heroPosition, 'unopened');
        } else {
          actionToHero = `${historyPrefix}あなた(${this.heroPosition})の番です。オープンを検討してください。`;
          const rSize = this.heroPosition === 'SB' ? '3BB' : '2.5BB';
          options = ['Fold', `Raise (${rSize})`, 'All-in'];
          optimalAction = this.getPreflopOptimalAction(this.heroPosition, 'unopened');
        }
      } else if (facing === 'open') {
        const openPos = this.openRaiser || '相手';
        actionToHero = `${historyPrefix}${openPos}がオープン(2.5BB)。あなた(${this.heroPosition})の番です。${multiwayNote}`;
        const rSize = (this.heroPosition === 'BB' || this.heroPosition === 'SB') ? '9BB' : '7.5BB';
        options = ['Fold', 'Call', `Raise (3Bet: ${rSize})`, 'All-in'];
        optimalAction = this.getPreflopOptimalAction(this.heroPosition, 'open');
      } else if (facing === '3bet') {
        const threeBettor = this.openRaiser || '相手';
        actionToHero = `${historyPrefix}${threeBettor}が3ベット(9BB)してきました！あなた(${this.heroPosition})の番です。`;
        options = ['Fold', 'Call', 'Raise (4Bet: 22BB)', 'All-in'];
        optimalAction = this.getPreflopOptimalAction(this.heroPosition, '3bet');
      } else if (facing === '4bet') {
        actionToHero = `${historyPrefix}4ベット(22BB)されました！あなた(${this.heroPosition})の番です。`;
        options = ['Fold', 'Call', 'All-in'];
        optimalAction = this.getPreflopOptimalAction(this.heroPosition, '4bet');
      } else if (facing === 'limp') {
        actionToHero = `${historyPrefix}SBがリンプイン。あなた(BB)の番です。`;
        options = ['Check', 'Raise (3.5BB)', 'Raise (5BB)', 'All-in'];
        optimalAction = this.getPreflopOptimalAction(this.heroPosition, 'limp');
      } else {
        // open_by_hero or other
        actionToHero = `${historyPrefix}あなた(${this.heroPosition})の番です。オープンしますか？`;
        const rSize = this.heroPosition === 'SB' ? '3BB' : '2.5BB';
        options = ['Fold', `Raise (${rSize})`, 'All-in'];
        optimalAction = this.getPreflopOptimalAction(this.heroPosition, 'unopened');
      }

    // ─── POST-FLOP ──────────────────────────────────────────────────────────
    } else {
      const posOrder = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BU'];
      const heroIdx2 = posOrder.indexOf(this.heroPosition);
      const villainIdx2 = posOrder.indexOf(this.villainPosition);
      const heroIsOOP = heroIdx2 < villainIdx2;
      const heroIsPFR = this.preflopState.facing === 'unopened' ||
                        this.preflopState.facing === '3bet' ||
                        this.preflopState.facing === 'open_by_hero';
      const multiwayTag = this.isMultiway ? '（マルチウェイ）' : '';

      if (this.drillName === 'flop_cb' && this.street === 'Flop') {
        actionToHero = 'BB(相手)がチェック。IPのあなたのC-Bet判断です。';
        options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
        optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, true, { facing: 'check' }, this.isMultiway);

      } else if (this.drillName === 'river_bluff' && this.street === 'River') {
        const betAmt = (this.pot * 0.75).toFixed(1);
        actionToHero = `BU(相手)がリバーで${betAmt}BBのポラライズドベット。ブラフキャッチしますか？`;
        options = ['Fold', 'Call', 'Raise (All-in)'];
        optimalAction = evaluatePostflopGTO(this.heroCards, this.board, true, false, { facing: 'bet', amount: 0.75 }, this.isMultiway);

      } else if (this.drillName === 'turn_bluff_catch' && this.street === 'Turn') {
        const betMult = [0.33, 0.50, 0.75][Math.floor(Math.random() * 3)];
        const betAmt = (this.pot * betMult).toFixed(1);
        actionToHero = `BU(相手)がターンで${betAmt}BB（ポットの${(betMult*100).toFixed(0)}%）のベット。対応は？`;
        options = ['Fold', 'Call', 'Raise', 'All-in'];
        optimalAction = evaluatePostflopGTO(this.heroCards, this.board, true, false, { facing: 'bet', amount: betMult }, this.isMultiway);

      } else if (this.drillName === 'river_decision' && this.street === 'River') {
        const vGTO = evaluatePostflopGTO(this.villainCards, this.board, heroIsOOP, !heroIsOOP, { facing: 'check' }, this.isMultiway);
        if (vGTO !== 'Check' || heroIsOOP) {
          const mult = [0.33, 0.75, 1.5][Math.floor(Math.random() * 3)];
          const betAmt = (this.pot * mult).toFixed(1);
          const betLabel = mult > 1 ? 'オーバーベット' : `${(mult*100).toFixed(0)}%ポット`;
          actionToHero = `${this.villainPosition}(相手)がリバーで${betAmt}BB（${betLabel}）のベット。`;
          options = ['Fold', 'Call', 'Raise (All-in)'];
          optimalAction = evaluatePostflopGTO(this.heroCards, this.board, !heroIsOOP, heroIsOOP, { facing: 'bet', amount: mult }, this.isMultiway);
        } else {
          actionToHero = `${this.villainPosition}(OOP)がチェック。IP(あなた)のリバーアクションは？`;
          options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
          optimalAction = evaluatePostflopGTO(this.heroCards, this.board, heroIsOOP, !heroIsOOP, { facing: 'check' }, this.isMultiway);
        }

      } else if (this.drillName === 'turn_bet_sizing' && this.street === 'Turn') {
        actionToHero = `BB(相手)がターンでチェック。IP(あなた)のベットサイズを選んでください。`;
        options = ['Check', 'Bet 33% Pot', 'Bet 50% Pot', 'Bet 75% Pot', 'All-in'];
        optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, true, { facing: 'check' }, this.isMultiway);

      } else {
        // Normal play
        const villainGTO = evaluatePostflopGTO(this.villainCards, this.board, !heroIsOOP, !heroIsPFR, { facing: 'check' }, this.isMultiway);

        if (heroIsOOP) {
          if (villainGTO === 'Check' || Math.random() < 0.3) {
            actionToHero = `OOP(あなた)のアクションです。${multiwayTag}`;
            options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
            optimalAction = evaluatePostflopGTO(this.heroCards, this.board, true, heroIsPFR, { facing: 'check' }, this.isMultiway);
          } else {
            const amount = villainGTO.includes('33%') ? 0.33 : (villainGTO.includes('75%') ? 0.75 : 1.0);
            actionToHero = `${this.villainPosition}が${villainGTO}。${multiwayTag}`;
            options = ['Fold', 'Call', 'Raise', 'All-in'];
            optimalAction = evaluatePostflopGTO(this.heroCards, this.board, true, heroIsPFR, { facing: 'bet', amount }, this.isMultiway);
          }
        } else {
          if (villainGTO === 'Check') {
            actionToHero = `${this.villainPosition}がチェック。IPのあなたの番です。${multiwayTag}`;
            options = ['Check', 'Bet 33% Pot', 'Bet 75% Pot', 'All-in'];
            optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, heroIsPFR, { facing: 'check' }, this.isMultiway);
          } else {
            const amount = villainGTO.includes('33%') ? 0.33 : (villainGTO.includes('75%') ? 0.75 : 1.0);
            actionToHero = `${this.villainPosition}が${villainGTO}。${multiwayTag}`;
            options = ['Fold', 'Call', 'Raise (All-in)'];
            optimalAction = evaluatePostflopGTO(this.heroCards, this.board, false, heroIsPFR, { facing: 'bet', amount }, this.isMultiway);
          }
        }
      }
    }

    return this._buildSit(actionToHero, options, optimalAction);
  }

  _buildSit(actionToHero, options, optimalAction) {
    return {
      street: this.street,
      board: [...this.board],
      pot: this.pot.toFixed(1) + 'BB',
      stack: this.heroStack.toFixed(1) + 'BB',
      heroCards: [...this.heroCards],
      heroPosition: this.heroPosition,
      villainPosition: this.villainPosition,
      preflopHistory: [...this.preflopHistory],
      isMultiway: this.isMultiway,
      activePlayers: [...(this.activePlayers || [])],
      actionToHero,
      options,
      optimalAction,
      evLoss: this.generateEvLoss(options, optimalAction),
      matchHistory: this.matchHistory,
    };
  }

  generateEvLoss(options, optimalAction) {
    const ev = {};
    const sit = this.getSituation();

    options.forEach(opt => {
      if (opt === optimalAction) {
        ev[opt] = 0.00;
        return;
      }

      // ── Sync with GTO Engine ──
      // Calculate how far the chosen action is from the optimal one
      let loss = -0.1; // Default minor loss

      if (this.street === 'Preflop') {
        const rec = this.getPreflopOptimalAction(this.heroPosition, this.preflopState.facing);
        if (opt === 'Fold' && (rec.includes('Raise') || rec === 'Call')) loss = -1.5;
        if (opt.includes('Raise') && rec === 'Fold') loss = -1.0;
        if (opt === 'Call' && rec === 'Fold') loss = -0.5;
      } else {
        // Postflop synced penalty
        if (opt === 'Fold' && (optimalAction === 'Call' || optimalAction.includes('Raise'))) loss = -1.0;
        if (opt === 'Call' && optimalAction === 'Fold') loss = -0.6;
        if (opt.includes('Bet') && optimalAction === 'Check') loss = -0.4;
        if (opt.includes('Bet') && optimalAction === 'Fold') loss = -2.0;

        // Size mismatch penalty
        if (opt.includes('Bet') && optimalAction.includes('Bet')) {
           const optSize = parseInt(optimalAction.match(/\d+/)?.[0] || 0);
           const chooseSize = parseInt(opt.match(/\d+/)?.[0] || 0);
           if (Math.abs(optSize - chooseSize) > 40) loss = -0.15;
           else loss = -0.05;
        }
      }

      ev[opt] = parseFloat(loss.toFixed(2));
    });
    return ev;
  }

  applyAction(action) {
    const sit = this.getSituation();
    const loss = sit.evLoss[action] !== undefined ? sit.evLoss[action] : -0.50;
    this.totalEvLoss += loss;
    this.history.push({ street: this.street, action, evLoss: loss });

    const isCallingAllIn = action === 'Call' && sit.actionToHero.includes('オールイン');
    if (action.includes('Fold')) { this.heroFolded = true; return true; }
    if (action.includes('All-in') || isCallingAllIn) {
      if (action.includes('All-in')) { this.pot += this.heroStack * 2; this.heroStack = 0; }
      return true;
    }

    let heroAdded = 0;
    let isAggressive = false;
    if (action.includes('Raise') || action.includes('Bet')) {
      isAggressive = true;
      if (action.includes('33%')) { heroAdded = this.pot * 0.33; this.pot += this.pot * 0.66; }
      else if (action.includes('50%')) { heroAdded = this.pot * 0.50; this.pot += this.pot * 1.0; }
      else if (action.includes('75%')) { heroAdded = this.pot * 0.75; this.pot += this.pot * 1.5; }
      else if (action.includes('150%')) { heroAdded = this.pot * 1.5; this.pot += this.pot * 3.0; }
      else if (action.includes('2.5BB')) { heroAdded = 2.5; this.pot += 3; }
      else if (action.includes('3BB') || action.includes('3.5BB') || action.includes('4BB')) {
        heroAdded = parseFloat(action.match(/[\d.]+BB/)?.[0]) || 3;
        this.pot += heroAdded + 1;
      }
      else if (action.includes('7.5BB')) { heroAdded = 7.5; this.pot += 9; }
      else if (action.includes('9BB')) { heroAdded = 9; this.pot += 10; }
      else if (action.includes('22BB')) { heroAdded = 22; this.pot += 25; }
      else { heroAdded = this.pot; this.pot += this.pot * 2.5; }
    } else if (action === 'Call' || action === 'Call (リンプ)') {
      heroAdded = this.pot * 0.25;
      this.pot += this.pot * 0.5;
    } else if (action === 'Check') {
      // no change
    }

    this.heroStack = Math.max(0, this.heroStack - heroAdded);

    if (isAggressive) {
      // Simulate response from players behind hero (posted villain + remaining active)
      let villainResp = 'Call';
      if (this.difficulty === 'beginner') {
        villainResp = Math.random() < 0.6 ? 'Fold' : 'Call';
      } else {
        if (this.street === 'Preflop') {
          const facingStr = action.includes('3Bet') || action.includes('3bet') ? '3bet' : 'open';
          villainResp = evaluatePreflopGTO(this.villainCards[0], this.villainCards[1], this.villainPosition, { facing: facingStr });
          if (action.includes('4Bet') || action.includes('All-in')) villainResp = Math.random() < 0.4 ? 'Call' : 'Fold';
        } else {
          const facingState = this.pot > 40 ? 'allin' : 'bet';
          villainResp = evaluatePostflopGTO(this.villainCards, this.board, this.heroPosition === 'BU', false, { facing: facingState });
        }
      }

      if (villainResp === 'Fold') {
        this.villainFolded = true;
        // In multiway, other players also likely fold
        this.isMultiway = false;
        return true;
      } else if (villainResp === 'Raise' && !action.includes('All-in')) {
        this.pendingVillainAction = 'Raise';
        this.pot += heroAdded * 2;
        return false;
      } else {
        // Call — proceed to next street
        this.pot += heroAdded;
        this.progressStreet();
        return this.street === 'Showdown';
      }
    } else {
      // Check or limp — proceed
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
        finalBoard: [...this.board],
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
        finalBoard: [...this.board],
      };
    }
    while (this.board.length < 5) this.board.push(this.deck.pop());
    const heroHand = Hand.solve([...this.heroCards, ...this.board]);
    const villainHand = Hand.solve([...this.villainCards, ...this.board]);
    const winners = Hand.winners([heroHand, villainHand]);
    let resultText = '', isHeroWinner = false;
    if (winners.length === 2) resultText = 'チョップ（引き分け）です！🤝';
    else if (winners[0] === heroHand) { resultText = 'あなたの勝ちです！🎉'; isHeroWinner = true; }
    else resultText = '相手の勝ちです...💸';
    return {
      isShowdown: true, resultText, isHeroWinner,
      heroHandName: heroHand.descr,
      villainHandName: villainHand.descr,
      villainCards: [...this.villainCards],
      finalBoard: [...this.board],
    };
  }
}
