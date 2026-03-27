import { useState, useRef, useEffect } from 'react';
import { Search, MessageSquare, Send, Loader2 } from 'lucide-react';
import { chatWithCoach } from '../api/llm';

const Study = () => {
  const [boardInput, setBoardInput] = useState('J♠ T♥ 5♣');
  const [handInput, setHandInput] = useState('A♠ A♥');
  const [potInput, setPotInput] = useState('12.5 / 96BB');
  
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'ai', text: '特定のスポットについてGTOソリューションに疑問があればお答えします。「ボードにクローバーが落ちた場合の戦略変化」や「なぜターンでドンクベットするのか」など、GTOのロジックについて何でも聞いてください。' }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleSearch = () => {
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 800);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isThinking) return;
    
    const newLog = [...chatLog, { role: 'user', text: chatInput }];
    setChatLog(newLog);
    setChatInput('');
    setIsThinking(true);
    
    const contextStr = `ボード: ${boardInput}\nハンド: ${handInput}\nポット状況: ${potInput}`;
    
    const reply = await chatWithCoach(newLog, contextStr);
    
    setChatLog([...newLog, { role: 'ai', text: reply }]);
    setIsThinking(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>スタディ機能 (スポット解析)</h2>
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: '1rem' }}>シチュエーション設定</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ボードカード</label>
            <input 
              type="text" 
              value={boardInput}
              onChange={e => setBoardInput(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ヒーローのハンド</label>
            <input 
              type="text" 
              value={handInput}
              onChange={e => setHandInput(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ポット / 有効スタック</label>
            <input 
              type="text" 
              value={potInput}
              onChange={e => setPotInput(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
            />
          </div>
        </div>
        <button className="btn btn-accent" onClick={handleSearch} style={{ width: '100%' }}>
          {isAnalyzing ? '解析中...' : <><Search size={18} /> GTO簡易解析を実行</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem' }}>簡易レンジアクション頻度</h3>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            通常ここにGTOウィザードのような<br/>13x13のレンジマトリックスや<br/>バーグラフが表示されます。<br/><br/>
            (現在は簡易版のため表示を省略、<br/>右記のAIチャットで戦略を会話できます)
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={18} color="var(--primary)" /> 深い考察アシスタント (Gemini AI)
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', paddingRight: '0.5rem' }}>
            {chatLog.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                padding: '0.75rem 1rem',
                borderRadius: '1rem',
                borderBottomLeftRadius: msg.role === 'ai' ? '0' : '1rem',
                borderBottomRightRadius: msg.role === 'user' ? '0' : '1rem',
                maxWidth: '85%',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
            ))}
            {isThinking && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '1rem', borderBottomLeftRadius: '0' }}>
                <Loader2 size={20} className="spin" color="var(--primary)" />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="コーチに質問する..." 
              style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} 
            />
            <button className="btn btn-primary" onClick={handleSendMessage} disabled={isThinking} style={{ padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: isThinking ? 'not-allowed' : 'pointer' }}>
              <Send size={18} color="white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Study;
