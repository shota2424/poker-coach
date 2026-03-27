import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { situation, showdownResult, history, evLoss } = req.body;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      text: `【※Gemini API未設定】モック解説: 最終EV損失は${evLoss}BBでした。`,
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    if (!history || history.length === 0) {
      return res.json({ text: 'プレイ履歴がありません。' });
    }
    const historyText = history
      .map((h) => `${h.street}: ${h.action} (EV損失: ${h.evLoss} BB)`)
      .join('\n');

    const prompt = `あなたはポーカーのプロコーチです。以下の1ハンドの実際のプレイデータを見て、総評と詳細なアドバイスを行ってください。

【手札と盤面の状況】
生徒のポジション: ${situation.heroPosition}
生徒のハンド: ${situation.heroCards.join(' ')}
最終ボード: ${showdownResult?.finalBoard ? showdownResult.finalBoard.join(' ') : situation.board.join(' ')}
相手のハンド: ${showdownResult?.villainCards ? showdownResult.villainCards.join(' ') : '不明'}
最終勝敗: ${showdownResult ? showdownResult.resultText : '不明'}

【生徒のアクション履歴】
${historyText}

【ハンド終了時の総EV損失】
${evLoss} BB

回答は、生徒を励ましつつ、GTOの観点から「なぜ良かったのか」「なぜEVの減点があったのか」の理由を論理的に説明してください。簡潔なMarkdown形式で返してください。`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    res.json({ text });
  } catch (e) {
    console.error('Explanation API Error:', e);
    res.status(500).json({ error: `APIエラー: ${e.message}` });
  }
}
