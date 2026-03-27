// フロントエンド側からはAPIキーを持たず、専用のバックエンド（Vercel Serverless Function）へリクエストを飛ばします。

export async function getAIExplanation(situation, showdownResult, history, evLoss) {
  try {
    const response = await fetch('/api/explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situation, showdownResult, history, evLoss })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }
    const data = await response.json();
    return data.text || data.error;
  } catch (error) {
    console.error('API Com Error:', error);
    return `通信エラーが発生しました。\n詳細: ${error.message}`;
  }
};

export const getSpotExplanation = async (situation, chosenAction, isCorrect) => {
  try {
    const response = await fetch('/api/spot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situation, chosenAction, isCorrect })
    });
    if (!response.ok) throw new Error('API Request failed');
    const data = await response.json();
    return data.text || data.error;
  } catch (e) {
    return 'API通信エラーが発生しました。';
  }
};

export const chatWithCoach = async (chatLog, contextStr) => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatLog, contextStr })
    });
    if (!response.ok) throw new Error('API Request failed');
    const data = await response.json();
    return data.text || data.error;
  } catch (e) {
    return 'API通信エラーが発生しました。時間を置いてお試しください。';
  }
};
