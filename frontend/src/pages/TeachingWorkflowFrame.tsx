import { useEffect, useRef } from 'react';

export interface TeachingParameterSnapshot {
  parameters: {
    name: string;
    value: string | string[];
    source: 'teacher' | 'inferred' | 'default' | 'missing';
    group: 'teacher' | 'scene';
    evidence?: string;
  }[];
  supplementary: string[];
}

interface WorkflowConversation {
  state_token: string;
  messages: { role: 'assistant' | 'user'; content: string }[];
}

interface TeachingWorkflowFrameProps {
  snapshot: TeachingParameterSnapshot;
  conversation: WorkflowConversation;
  applying: boolean;
  error: string;
  onDialogue: () => void;
  onApply: () => void;
}

/** Host the original workflow document, with live values and parent-owned API calls. */
export function TeachingWorkflowFrame(props: TeachingWorkflowFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  latest.current = props;

  const initialize = () => {
    const current = latest.current;
    frame.current?.contentWindow?.postMessage({
      type: 'ppt-workflow:init',
      sessionId: current.conversation.state_token.slice(-32),
      snapshot: current.snapshot,
      conversation: { messages: current.conversation.messages },
      applying: current.applying,
      error: current.error,
    }, window.location.origin);
  };

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      switch (event.data?.type) {
        case 'ppt-workflow:ready':
          initialize();
          break;
        case 'ppt-workflow:dialogue':
          latest.current.onDialogue();
          break;
        case 'ppt-workflow:apply':
          latest.current.onApply();
          break;
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({
      type: 'ppt-workflow:status', applying: props.applying, error: props.error,
    }, window.location.origin);
  }, [props.applying, props.error]);

  return (
    <iframe
      ref={frame}
      title="情境参数抽取与教学思维链"
      src="/edit-ppt/main.html?view=live-workflow"
      className="h-screen w-full border-0"
      onLoad={initialize}
    />
  );
}
