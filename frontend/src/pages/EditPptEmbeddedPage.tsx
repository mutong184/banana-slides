import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Send, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { Button } from '@/components/shared/Button';
import logoUrl from '@/assets/edit-banana.jpg';
import { TeachingWorkflowFrame, type TeachingParameterSnapshot } from './TeachingWorkflowFrame';
import './TeachingContext.css';

interface Conversation {
  state_token: string;
  messages: { role: 'assistant' | 'user'; content: string }[];
  turn: number;
  status: 'collecting' | 'ready' | 'needs_correction';
  summary: string;
}

/** Live dialogue, a separate parameter review, and the teaching workflow handoff. */
export const EditPptEmbeddedPage: React.FC = () => {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState(0);
  const [parameterSnapshot, setParameterSnapshot] = useState<TeachingParameterSnapshot | null>(null);
  const initialized = useRef(false);
  const inFlight = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  const requestReply = async (restart = false) => {
    if (inFlight.current) return;
    const message = text.trim();
    if (!restart && conversation && (!message || conversation.status !== 'collecting')) return;
    const startingNew = restart || !conversation;
    if (startingNew) {
      setConversation(null);
      setParameterSnapshot(null);
      setText('');
      setStage(0);
      setApplying(false);
      try {
        sessionStorage.removeItem('ppt-edit-live-teaching-context-v1');
        sessionStorage.removeItem('edit-ppt-context');
        const previousWorkflowKeys = Object.keys(sessionStorage).filter(key =>
          key.startsWith('img2xml:ppt-teaching-example:v8:live-teaching-'),
        );
        previousWorkflowKeys.forEach(key => sessionStorage.removeItem(key));
      } catch { /* A fresh conversation also works when browser storage is unavailable. */ }
    }
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post('/api/teaching-context/chat',
        startingNew ? {} : { state_token: conversation!.state_token, message });
      const next = data.data as Conversation;
      setConversation(next); setText('');
      setParameterSnapshot(null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '暂时无法连接课件服务，请稍后重试。');
    } finally { setBusy(false); inFlight.current = false; }
  };
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void requestReply(true);
    }
    // A browser back/forward-cache restore can retain the old React tree.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [conversation, busy]);

  const openParameters = async () => {
    if (inFlight.current || !conversation) return;
    setStage(1);
    setError('');
    if (parameterSnapshot) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { data } = await apiClient.post('/api/teaching-context/parameters', {
        state_token: conversation.state_token,
      });
      setParameterSnapshot(data.data as TeachingParameterSnapshot);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '暂时无法读取情境参数，请重试。');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const apply = async () => {
    if (inFlight.current || !conversation || conversation.status !== 'ready') return;
    inFlight.current = true; setApplying(true); setError('');
    try {
      const { data } = await apiClient.post('/api/teaching-context/handoff', { state_token: conversation.state_token });
      // Existing project launcher retains the template chosen on the homepage.
      sessionStorage.setItem('edit-ppt-context', JSON.stringify(data.data));
      navigate('/?action=teaching-context');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '需求暂时无法提交，请重试。');
      setApplying(false);
    } finally { inFlight.current = false; }
  };
  const ready = conversation?.status === 'ready';
  if (stage === 1) {
    if (parameterSnapshot && conversation) {
      return <TeachingWorkflowFrame
        snapshot={parameterSnapshot}
        conversation={conversation}
        applying={applying}
        error={error}
        onDialogue={() => { setError(''); setStage(0); }}
        onApply={() => void apply()}
      />;
    }
    return <div className="teaching-workflow-loading" aria-busy={busy}>
      <h1>情境参数抽取</h1>
      {error ? <p role="alert">{error}</p> : <p role="status">正在整理本次对话的情境参数…</p>}
      <div>
        <Button variant="secondary" disabled={busy} onClick={() => { setError(''); setStage(0); }}>返回需求对话</Button>
        {error && <Button onClick={() => void openParameters()}>重试当前步骤</Button>}
      </div>
    </div>;
  }
  return (
    <div className="teaching-live-page">
      <header className="teaching-live-nav">
        <button className="teaching-live-brand" onClick={() => navigate('/')} aria-label="返回 PPT Edit 首页">
          <img src={logoUrl} alt="" /><strong>PPT Edit</strong>
        </button>
        <nav aria-label="课件准备进度">
          {['需求对话', '情境参数抽取', '教学思维链'].map((label, index) => (
            <span key={label} className={index === stage ? 'active' : ''} aria-current={index === stage ? 'step' : undefined}>
              <b>{index < stage ? <Check size={13} /> : index + 1}</b><span>{label}</span>
            </span>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}><ArrowLeft size={15} /> 返回首页</Button>
      </header>
      <main className="teaching-live-main">
        <div className="teaching-live-heading"><div><span className="teaching-live-eyebrow"><Sparkles size={15} /> 智能课件生成助手</span>
          <h1>{['聊一聊您想上的这堂课', '情境参数抽取', '教学思维链'][stage]}</h1>
          <p>明确教学需求，让课件更贴合您的课堂。</p></div>
          {conversation && <Button variant="ghost" size="sm" disabled={busy || applying} onClick={() => void requestReply(true)}><RotateCcw size={15} /> 重新填写需求</Button>}
        </div>
        {error && <div role="alert" className="teaching-live-error">{error}<Button size="sm" variant="secondary" disabled={busy || applying}
          onClick={() => void requestReply()}>重试当前步骤</Button></div>}
        <section className="teaching-live-chat" aria-label="教学需求对话">
          <div className="teaching-live-messages" role="log" aria-live="polite" aria-busy={busy}>
            {conversation?.messages.map((message, index) => <div className={`teaching-live-message ${message.role}`} key={index}>
              <span className="teaching-live-avatar">{message.role === 'assistant' ? <Sparkles size={17} /> : '我'}</span>
              <div><small>{message.role === 'assistant' ? '智能课件生成助手' : '教师'}</small><p>{message.content}</p></div>
            </div>)}
            {busy && <div className="teaching-live-pending"><span className="teaching-live-spinner" />正在整理您的需求…</div>}
            <div ref={end} />
          </div>
          {conversation?.status === 'collecting' && <form className="teaching-live-composer" onSubmit={e => { e.preventDefault(); void requestReply(); }}>
            <label htmlFor="teacher-requirement" className="sr-only">您的教学需求</label>
            <textarea id="teacher-requirement" value={text} maxLength={6000} disabled={busy} rows={3}
              onChange={e => setText(e.target.value)} placeholder="请输入您的教学需求或补充说明…"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void requestReply(); } }} />
            <div><span>Enter 发送 · Shift + Enter 换行</span><Button type="submit" size="sm" disabled={!text.trim() || busy} loading={busy}><Send size={15} /> 发送</Button></div>
          </form>}
          {ready && <div className="teaching-live-actions"><span><Check size={17} />需求已整理完成</span><Button onClick={() => void openParameters()}>下一步，查看情境参数 <ArrowRight size={16} /></Button></div>}
          {conversation?.status === 'needs_correction' && <div className="teaching-live-actions"><Button variant="secondary" onClick={() => void requestReply(true)}>重新填写需求</Button></div>}
        </section>
      </main>
    </div>
  );
};
