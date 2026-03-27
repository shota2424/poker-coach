// フロントエンド側からはAPIキーを持たず、専用のバックエンド（Vercel Serverless Function）へリクエストを飛ばします。

export async function getAIExplanation(situation, showdownResult, history, evLoss) {
  try {
    const response = await fetch('/api/explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situation, showdownResult, history, evLoss })
    });
    if (!response.ok) throw new Error('API Request failed');
    const data = await response.json();
    return data.text || data.error;
  } catch (error) {
    console.error('API Com Error:', error);
    return 'サーバー通信エラーが発生しました。ローカルの場合は npm run dev でバックエンドが起動しているか確認してください。';
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
