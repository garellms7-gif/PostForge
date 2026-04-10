import { useState, useRef, useEffect } from 'react';
import {
  Car, BookOpen, MessageCircle, Target, Send, Menu, X,
  Loader2, CheckCircle, XCircle, ChevronRight, RotateCcw,
  Key, Trophy, BarChart2, AlertTriangle
} from 'lucide-react';

const SYSTEM_PROMPT = `You are a friendly driver's permit test tutor. You only answer questions about driving rules, road signs, traffic laws, and permit test preparation. Keep answers concise and educational. When generating quizzes, always return valid JSON with this shape: { question: string, options: string[], correct: number, explanation: string }`;

const QUIZ_TOPICS = [
  { id: 'road-signs', label: 'Road Signs', desc: 'Traffic signs, signals & pavement markings' },
  { id: 'right-of-way', label: 'Right-of-Way', desc: 'Who goes first at intersections & crosswalks' },
  { id: 'speed-limits', label: 'Speed Limits', desc: 'School zones, work zones & residential areas' },
  { id: 'following-distance', label: 'Following Distance', desc: 'Safe distances & stopping distances' },
  { id: 'dui-bac', label: 'DUI/BAC Laws', desc: 'Blood alcohol limits, implied consent & penalties' },
];

const NAV_ITEMS = [
  { id: 'quiz', label: 'Quiz Mode', icon: BookOpen },
  { id: 'study', label: 'Study Mode', icon: MessageCircle },
  { id: 'review', label: 'Review Weak Spots', icon: Target },
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function App() {
  const [mode, setMode] = useState('quiz');
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Quiz state
  const [quizPhase, setQuizPhase] = useState('select');
  const [quizTopic, setQuizTopic] = useState('');
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);

  // Study state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Weak spots: { [topicLabel]: { correct, wrong } }
  const [weakSpots, setWeakSpots] = useState({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  function switchMode(newMode) {
    setMode(newMode);
    setSidebarOpen(false);
    setError('');
  }

  // ── API ──────────────────────────────────────────────
  async function callAPI(messages) {
    const res = await fetch('/api/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error (${res.status})`);
    }
    const data = await res.json();
    return data.content[0].text;
  }

  // ── Quiz Handlers ────────────────────────────────────
  async function startQuiz(topicLabel) {
    setLoading(true);
    setError('');
    setQuizTopic(topicLabel);
    setQIndex(0);
    setSelected(null);
    setAnswered(false);
    setResults([]);
    try {
      const text = await callAPI([{
        role: 'user',
        content: `Generate a 5-question multiple choice quiz about "${topicLabel}" for a US driver's permit test. Each question must have exactly 4 options. Return ONLY a valid JSON array (no markdown code fences, no extra text) with this exact shape:
[{"question":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}]
"correct" is the 0-based index of the right answer. Make questions realistic and educational.`,
      }]);
      let json = text;
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) json = fence[1];
      const arr = json.match(/\[[\s\S]*\]/);
      if (!arr) throw new Error('Failed to parse quiz response');
      const parsed = JSON.parse(arr[0]);
      if (!Array.isArray(parsed) || parsed.length < 1) throw new Error('Invalid quiz data');
      setQuestions(parsed);
      setQuizPhase('active');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function submitAnswer(idx) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const q = questions[qIndex];
    const isCorrect = idx === q.correct;
    setResults(r => [...r, {
      question: q.question,
      selected: idx,
      correct: q.correct,
      isCorrect,
      explanation: q.explanation,
    }]);
    setWeakSpots(prev => {
      const cur = prev[quizTopic] || { correct: 0, wrong: 0 };
      return {
        ...prev,
        [quizTopic]: {
          correct: cur.correct + (isCorrect ? 1 : 0),
          wrong: cur.wrong + (isCorrect ? 0 : 1),
        },
      };
    });
  }

  function nextQuestion() {
    if (qIndex < questions.length - 1) {
      setQIndex(i => i + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setQuizPhase('summary');
    }
  }

  function resetQuiz() {
    setQuizPhase('select');
    setQuestions([]);
    setResults([]);
    setQIndex(0);
    setSelected(null);
    setAnswered(false);
  }

  // ── Study Handlers ───────────────────────────────────
  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || loading) return;
    const userMsg = { role: 'user', content: text };
    const updated = [...chatHistory, userMsg];
    setChatHistory(updated);
    setChatInput('');
    setLoading(true);
    setError('');
    try {
      const reply = await callAPI(updated.map(m => ({ role: m.role, content: m.content })));
      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // ── Derived Data ─────────────────────────────────────
  const score = results.filter(r => r.isCorrect).length;
  const accuracy = results.length > 0 ? Math.round((score / results.length) * 100) : 0;

  const sortedWeakSpots = Object.entries(weakSpots)
    .map(([topic, d]) => ({
      topic,
      ...d,
      total: d.correct + d.wrong,
      pct: Math.round((d.correct / (d.correct + d.wrong)) * 100),
    }))
    .sort((a, b) => a.pct - b.pct);

  // ── API Key Screen ───────────────────────────────────
  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <Car className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Driver&apos;s Permit Study Agent</h1>
            <p className="text-slate-500 mt-2">Your AI-powered permit test tutor</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Anthropic API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && keyInput.trim() && setApiKey(keyInput.trim())}
                  placeholder="sk-ant-..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => keyInput.trim() && setApiKey(keyInput.trim())}
              disabled={!keyInput.trim()}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Studying
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Your key is only stored in memory and never persisted.
          </p>
        </div>
      </div>
    );
  }

  // ── Main Layout ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>
        <div className="p-5 border-b border-indigo-800">
          <div className="flex items-center gap-2.5">
            <Car className="w-6 h-6" />
            <span className="text-lg font-bold tracking-tight">Permit Study</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = mode === item.id;
            const weakCount = item.id === 'review'
              ? Object.values(weakSpots).reduce((s, d) => s + d.wrong, 0)
              : 0;
            return (
              <button
                key={item.id}
                onClick={() => switchMode(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {weakCount > 0 && item.id === 'review' && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{weakCount}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-indigo-800">
          <button
            onClick={() => { setApiKey(''); setKeyInput(''); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-indigo-300 hover:bg-indigo-800 hover:text-white text-sm transition-colors"
          >
            <Key className="w-4 h-4" />
            Change API Key
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <span className="font-semibold text-slate-800">
            {NAV_ITEMS.find(n => n.id === mode)?.label}
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="flex-shrink-0 hover:text-red-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {mode === 'quiz' && <QuizView />}
          {mode === 'study' && <StudyView />}
          {mode === 'review' && <ReviewView />}
        </main>
      </div>
    </div>
  );

  // ── Quiz View ────────────────────────────────────────
  function QuizView() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-medium">Generating your quiz...</p>
        </div>
      );
    }

    // Topic selection
    if (quizPhase === 'select') {
      return (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Quiz Mode</h2>
          <p className="text-slate-500 mb-6">Pick a topic to test your knowledge with 5 multiple-choice questions.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUIZ_TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => startQuiz(t.label)}
                className="group text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{t.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-sm text-slate-500">{t.desc}</p>
                {weakSpots[t.label] && (
                  <div className="mt-2 text-xs text-slate-400">
                    Previous: {weakSpots[t.label].correct}✓ {weakSpots[t.label].wrong}✗
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Active quiz
    if (quizPhase === 'active' && questions.length > 0) {
      const q = questions[qIndex];
      return (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">{quizTopic}</span>
              <h2 className="text-lg font-bold text-slate-800">Question {qIndex + 1} of {questions.length}</h2>
            </div>
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < results.length
                      ? results[i].isCorrect ? 'bg-emerald-400' : 'bg-red-400'
                      : i === qIndex ? 'bg-indigo-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
            <p className="text-slate-800 font-medium text-lg leading-relaxed">{q.question}</p>
          </div>

          <div className="space-y-3 mb-6">
            {q.options.map((opt, i) => {
              let style = 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer';
              if (answered) {
                if (i === q.correct) {
                  style = 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400';
                } else if (i === selected && !results[results.length - 1]?.isCorrect) {
                  style = 'bg-red-50 border-red-400 ring-1 ring-red-400';
                } else {
                  style = 'bg-slate-50 border-slate-200 opacity-60';
                }
              } else if (selected === i) {
                style = 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400';
              }
              return (
                <button
                  key={i}
                  onClick={() => submitAnswer(i)}
                  disabled={answered}
                  className={`w-full flex items-center gap-3 p-4 border rounded-xl text-left transition-all ${style}`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    answered && i === q.correct
                      ? 'bg-emerald-500 text-white'
                      : answered && i === selected
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {answered && i === q.correct
                      ? <CheckCircle className="w-4 h-4" />
                      : answered && i === selected && i !== q.correct
                        ? <XCircle className="w-4 h-4" />
                        : OPTION_LETTERS[i]}
                  </span>
                  <span className="text-slate-700">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation after answering */}
          {answered && (
            <div className={`p-4 rounded-xl mb-4 ${results[results.length - 1]?.isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {results[results.length - 1]?.isCorrect
                  ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                  : <XCircle className="w-5 h-5 text-amber-600" />}
                <span className="font-semibold text-sm">
                  {results[results.length - 1]?.isCorrect ? 'Correct!' : 'Not quite right'}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{q.explanation}</p>
            </div>
          )}

          {answered && (
            <button
              onClick={nextQuestion}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              {qIndex < questions.length - 1 ? (
                <>Next Question <ChevronRight className="w-4 h-4" /></>
              ) : (
                <>View Results <Trophy className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      );
    }

    // Summary
    if (quizPhase === 'summary') {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${accuracy >= 80 ? 'bg-emerald-100' : accuracy >= 60 ? 'bg-amber-100' : 'bg-red-100'}`}>
              <Trophy className={`w-10 h-10 ${accuracy >= 80 ? 'text-emerald-600' : accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Quiz Complete!</h2>
            <p className="text-slate-500 mt-1">{quizTopic}</p>
          </div>

          {/* Score cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-indigo-600">{score}/{results.length}</div>
              <div className="text-xs text-slate-500 mt-1">Score</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold ${accuracy >= 80 ? 'text-emerald-600' : accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{accuracy}%</div>
              <div className="text-xs text-slate-500 mt-1">Accuracy</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-slate-700">{quizTopic.split(' ')[0]}</div>
              <div className="text-xs text-slate-500 mt-1">Topic</div>
            </div>
          </div>

          {/* Question breakdown */}
          <h3 className="font-semibold text-slate-800 mb-3">Question Breakdown</h3>
          <div className="space-y-2 mb-8">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                {r.isCorrect
                  ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{r.question}</p>
                  {!r.isCorrect && (
                    <p className="text-xs text-slate-500 mt-1">{r.explanation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={resetQuiz}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> New Quiz
            </button>
            <button
              onClick={() => startQuiz(quizTopic)}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Retry Topic
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Study View ───────────────────────────────────────
  function StudyView() {
    return (
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)]">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Study Mode</h2>
          <p className="text-slate-500 text-sm">Ask any question about driving rules, road signs, or traffic laws.</p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
          {chatHistory.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Try asking about road signs, right-of-way rules, or speed limits.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {['What does a yield sign mean?', 'How far should I follow behind another car?', 'What is the BAC limit for drivers under 21?'].map(q => (
                  <button
                    key={q}
                    onClick={() => { setChatInput(q); }}
                    className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a driving question..."
            disabled={loading}
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={!chatInput.trim() || loading}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Review View ──────────────────────────────────────
  function ReviewView() {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Review Weak Spots</h2>
        <p className="text-slate-500 mb-6 text-sm">Topics are ranked by accuracy — lowest first. Focus on the areas you need most.</p>

        {sortedWeakSpots.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No data yet</p>
            <p className="text-sm mt-1">Complete a quiz to start tracking your weak spots.</p>
            <button
              onClick={() => switchMode('quiz')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Start a Quiz
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedWeakSpots.map(s => (
              <div key={s.topic} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{s.topic}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.total} question{s.total !== 1 ? 's' : ''} attempted
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${s.pct >= 80 ? 'text-emerald-600' : s.pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.pct}%
                    </span>
                    <button
                      onClick={() => { switchMode('quiz'); startQuiz(s.topic); }}
                      className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                    >
                      Practice
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>

                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    {s.correct} correct
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    {s.wrong} wrong
                  </span>
                </div>
              </div>
            ))}

            {/* Overall stats */}
            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-800">Overall Stats</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-indigo-600">
                    {sortedWeakSpots.reduce((s, d) => s + d.total, 0)}
                  </div>
                  <div className="text-xs text-indigo-500">Questions</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">
                    {sortedWeakSpots.reduce((s, d) => s + d.correct, 0)}
                  </div>
                  <div className="text-xs text-indigo-500">Correct</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600">
                    {sortedWeakSpots.reduce((s, d) => s + d.wrong, 0)}
                  </div>
                  <div className="text-xs text-indigo-500">Wrong</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
