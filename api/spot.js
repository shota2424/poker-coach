import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { situation, chosenAction, isCorrect } = req.body;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      text: `【※Gemini API未設定】モック解説: あなたの ${chosenAction} は${isCorrect ? '正解です' : 'ミスです'}。GTO的には ${situation?.optimalAction} が推奨されます。`,
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const evLossInfo = situation?.evLoss?.[chosenAction];
    const evLossText = evLossInfo !== undefined ? `EV損失: ${evLossInfo.toFixed(2)} BB` : '';

    const prompt = `あなたは世界トップクラスのポーカープロ兼GTOコーチです。
シチュエーション: ストリート=${situation.street}, Board=[${(situation.board || []).join(' ')}], Pot=${situation.pot}, あなたのハンド=[${situation.heroCards.join(' ')}]
ヒーローポジション: ${situation.heroPosition} vs ヴィランポジション: ${situation.villainPosition}
アクション状況: ${situation.actionToHero}
生徒の選択: ${chosenAction} (${evLossText})
GTO評価: EV損失が0であれば最適アクション。損失が大きいほど誤り。

生徒のこの1つのアクションに対して、「なぜそのEVスコアになったか」「本来はどうするべきか」「どういう思考プロセスが重要か」を2〜3段落で解説してください。日本語で答えてください。`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    res.json({ text });
  } catch (e) {
    console.error('Spot API Error:', e);
    res.status(500).json({ error: `APIエラー: ${e.message}` });
  }
}
