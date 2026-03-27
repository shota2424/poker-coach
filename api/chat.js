import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chatLog, contextStr } = req.body;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      text: '【※Gemini API未設定】モック回答: APIキーが設定されれば、実際のAIとポーカー戦略について議論できます。',
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemPrompt = `あなたはGTOポーカーコーチです。以下のシチュエーションを踏まえて生徒の質問に答えてください。\n【現在のシチュエーション】\n${contextStr}\n\nポーカーの戦略に焦点を当ててプロフェッショナルに回答してください。`;

    const history = chatLog.map((msg) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const userMessage = history.pop();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt + 'この設定で会話を始めます。' }] },
        { role: 'model', parts: [{ text: '承知しました。プロとしてお答えします。' }] },
        ...history,
      ],
    });
    const result = await chat.sendMessage(userMessage.parts[0].text);
    const text = (await result.response).text();
    res.json({ text });
  } catch (e) {
    console.error('Chat API Error:', e);
    res.status(500).json({ error: `APIエラー: ${e.message}` });
  }
}
