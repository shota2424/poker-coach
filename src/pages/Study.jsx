import { useState, useRef, useEffect } from 'react';
import { Search, MessageSquare, Send, Loader2, Info } from 'lucide-react';
import { chatWithCoach } from '../api/llm';

const QUICK_QUESTIONS = [
  'このスポットでのCBet頻度は？',
  'ブラフキャッチすべき？',
  '相手のレンジはどう読む？',
  'このボードテクスチャーの特徴は？',
];

const Study = () => {
  const [boardInput, setBoardInput] = useState('J♠ T♥ 5♣');
  const [handInput, setHandInput] = useState('A♠ A♥');
  const [posInput, setPosInput] = useState('IP vs OOP');
  const [potInput, setPotInput] = useState('12.5BB / Stack 96BB');
  
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'ai', text: '特定のスポットについてGTO上の疑問があれば何でもどうぞ。「このボードでのCBet頻度は？」「なぜターンでドンクベットするのか？」など、上のシチュエーションを設定してから質問してください。' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const buildContext = () =>
    `ボード: ${boardInput} | ヒーローハンド: ${handInput} | ポジション: ${posInput} | ポット/スタック: ${potInput}`;

  const handleSendMessage = async (text) => {
    const msgText = text || chatInput.trim();
    if (!msgText || isThinking) return;
    
    const newLog = [...chatLog, { role: 'user', text: msgText }];
    setChatLog(newLog);
    setChatInput('');
    setIsThinking(true);
    
    const reply = await chatWithCoach(newLog, buildContext());
    setChatLog([...newLog, { role: 'ai', text: reply }]);
    setIsThinking(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleAnalyze = () => {
    handleSendMessage(`上記のシチュエーション（ボード: ${boardInput}, ハンド: ${handInput}, ポジション: ${posInput}）でのGTOアクションを簡潔に教えてください。`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>スタディ / スポット解析</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Info size={14} /> シチュエーションを設定してAIに質問
        </div>
      </div>

      {/* Situation input - compact */}
      <div className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
          {[
            { label: '🃏 ボード', value: boardInput, setter: setBoardInput, placeholder: 'Jh Td 5c' },
            { label: '🦸 ハンド', value: handInput, setter: setHandInput, placeholder: 'As Ah' },
            { label: '📍 ポジション', value: posInput, setter: setPosInput, placeholder: 'IP vs OOP' },
            { label: '💰 Pot / Stack', value: potInput, setter: setPotInput, placeholder: '12.5BB / 96BB' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>{label}</label>
              <input
                type="text"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
        <button className="btn btn-accent" onClick={handleAnalyze} disabled={isThinking} style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}>
          <Search size={16} /> このシチュエーションをGTO解析する
        </button>
      </div>

      {/* Quick question chips */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {QUICK_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => handleSendMessage(q)}
            disabled={isThinking}
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: 'var(--primary)',
              borderRadius: '2rem',
              padding: '0.3rem 0.75rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: 'clamp(300px, 50vh, 500px)', padding: '0.9rem' }}>
        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', color: 'var(--primary)' }}>
          <MessageSquare size={16} /> AIコーチ (Gemini)
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.25rem', marginBottom: '0.6rem' }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
              padding: '0.6rem 0.85rem',
              borderRadius: '0.75rem',
              borderBottomLeftRadius: msg.role === 'ai' ? '0.1rem' : '0.75rem',
              borderBottomRightRadius: msg.role === 'user' ? '0.1rem' : '0.75rem',
              maxWidth: '88%',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              fontSize: '0.88rem',
            }}>
              {msg.text}
            </div>
          ))}
          {isThinking && (
            <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.08)', padding: '0.6rem 0.85rem', borderRadius: '0.75rem', borderBottomLeftRadius: '0.1rem', display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="spin" color="var(--primary)" /> 考え中...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="質問を入力... (Enterで送信)"
            style={{
              flex: 1,
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(0,0,0,0.25)',
              color: 'white',
              outline: 'none',
              fontSize: '0.88rem',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSendMessage()}
            disabled={isThinking || !chatInput.trim()}
            style={{ padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Study;
