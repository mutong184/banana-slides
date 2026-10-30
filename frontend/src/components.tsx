import type { ReactNode } from "react";
import { ArrowLeft, Home, X } from "lucide-react";
import { Link } from "react-router-dom";

export function Header({
  title,
  back = "/",
  children,
}: {
  title?: string;
  back?: string;
  children?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="brand-group">
        {title && (
          <Link className="btn ghost" to={back}>
            <ArrowLeft size={17} />
            返回
          </Link>
        )}
        <Link className="brand" to="/">
          <img src="/edit-banana.jpg" alt="PPT Edit Logo" />
          <strong>PPT Edit</strong>
        </Link>
        {title && (
          <>
            <i className="header-divider" />
            <span className="page-title">{title}</span>
          </>
        )}
      </div>
      <div className="toolbar">
        {title && (
          <Link className="btn ghost home-button" to="/">
            <Home size={17} />
            主页
          </Link>
        )}
        {children}
      </div>
    </header>
  );
}

export function Progress({ percent }: { percent: number }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Loading({ done, total }: { done: number; total: number }) {
  const percent = Math.round(10 + (done / total) * 80);
  return (
    <div className="status-screen">
      <div className="spinner" />
      <h2>正在生成页面描述，即将进入图片生成...</h2>
      <div className="preparing-progress">
        <div className="percent">{percent}%</div>
        <Progress percent={percent} />
        <div className="progress-messages">
          › 正在生成页面描述（{done}/{total}）…
        </div>
      </div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Footer() {
  return (
    <footer>© {new Date().getFullYear()} PPT Edit · 可编辑 PPT 生成</footer>
  );
}
