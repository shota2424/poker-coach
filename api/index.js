import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ローカルの場合のみ .env を読み込む（Vercelでは管理画面から設定されるため）
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const getGeminiClient = () => {
  // ViteのVITE_GEMINI_API_KEYか、サーバー用のGEMINI_API_KEYのどちらでも動くようにフォールバック
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

app.post('/api/explanation', async (req, res) => {
  const { situation, showdownResult, history, score } = req.body;
  
  try {
    const genAI = getGeminiClient();
    if (!genAI) {
      return res.json({ text: `【※バックエンドにGemini APIキーが未設定です】モック解説: 最終スコアは${score}でした。ローカルで .env ファイルを作成し、GEMINI_API_KEY=AIza... を設定すると実際のGeminiが解説を生成します。` });
    }

    if (!history || history.length === 0) return res.json({ text: "プレイ履歴がありません。" });
    const historyText = history.map(h => `${h.street}: ${h.action} (正解判定: ${h.isOptimal ? '〇' : '✕'})`).join('\n');
    const prompt = `あなたはポーカーのプロコーチです。以下の1ハンドの実際のプレイデータと最終スコアを見て、総評と詳細なアドバイスを行ってください。

【手札と盤面の状況】
生徒のポジション: ${situation.heroPosition}
生徒のハンド: ${situation.heroCards.join(' ')}
最終ボード: ${showdownResult && showdownResult.finalBoard ? showdownResult.finalBoard.join(' ') : situation.board.join(' ')}
相手のハンド: ${showdownResult && showdownResult.villainCards ? showdownResult.villainCards.join(' ') : '不明'}
最終勝敗: ${showdownResult ? showdownResult.resultText : '不明'}

【生徒のアクション履歴】
${historyText}

【GTOエンジンからの最終採点】
${score} / 100点

回答は、生徒を励ましつつ、GTOの観点から「なぜ良かったのか」「なぜ減点されたのか」の理由を論理的に説明してください。簡潔なMarkdown形式で返してください。`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error('LLM API Error:', error);
    res.status(500).json({ error: 'エラーが発生しました。GeminiのAPIキーが正しく設定されているか確認してください。' });
  }
});

app.post('/api/spot', async (req, res) => {
  const { situation, chosenAction, isCorrect } = req.body;
  
  try {
    const genAI = getGeminiClient();
    if (!genAI) {
      return res.json({ text: `【※Gemini API未設定】モック解説: あなたの ${chosenAction} は${isCorrect ? '正解です' : 'ミスです'}。GTO的には ${situation.optimalAction} が推奨されます。` });
    }

    const prompt = `あなたは世界トップクラスのポーカープロ兼GTOコーチです。
シチュエーション: ストリート= ${situation.street}, Board= [${situation.board.join(' ')}], Pot= ${situation.pot}, あなたのハンド= [${situation.heroCards.join(' ')}]
アクション状況: ${situation.actionToHero}
生徒の選択: ${chosenAction} (GTO評価: ${isCorrect ? '正解' : '不正解。最適解は ' + situation.optimalAction})

生徒のこの1つのアクションに対して、「なぜその選択が良かったのか/悪かったのか」「本来はどうするべきか」を1段落で簡潔に解説してください。`;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    res.json({ text: (await result.response).text() });
  } catch(e) { 
    console.error('LLM API Error:', e);
    res.status(500).json({ error: 'APIエラーが発生しました。' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { chatLog, contextStr } = req.body;
  
  try {
    const genAI = getGeminiClient();
    if (!genAI) {
      return res.json({ text: `【※Gemini API未設定】モック回答: コーチです。特定のボードについてですね。APIキーが設定されれば、実際のAIとポーカー戦略について議論できます。` });
    }

    const systemPrompt = `あなたはGTOポーカーコーチです。以下のシチュエーションを踏まえて生徒の質問に答えてください。\n【現在のシチュエーション】\n${contextStr}\n\nポーカーの戦略に焦点を当ててプロフェッショナルに回答してください。`;
    
    // Convert to Gemini format
    const history = chatLog.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    
    const userMessage = history.pop(); 
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({
      history: [{ role: 'user', parts: [{ text: systemPrompt + "この設定で会話を始めます。" }]}, { role: 'model', parts: [{ text: "承知しました。プロとしてお答えします。" }]}, ...history],
    });
    const result = await chat.sendMessage(userMessage.parts[0].text);
    res.json({ text: (await result.response).text() });
  } catch(e) { 
    console.error('LLM API Error:', e);
    res.status(500).json({ error: 'APIエラーが発生しました。時間を置いてお試しください。' }); 
  }
});

export default app;
