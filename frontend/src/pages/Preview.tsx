import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileEdit,
  RefreshCw,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDemo } from "../demo";
import { Header, Modal, Progress } from "../components";

export function PreviewPage() {
  const { project, generating, startImages, updateSlide, download } = useDemo();
  const [selected, setSelected] = useState(0);
  const [properties, setProperties] = useState(true);
  const [exportMenu, setExportMenu] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!location.state?.autoGenerateImages || started.current) return;
    started.current = true;
    startImages();
    navigate(location.pathname, { replace: true, state: null });
  }, [location, startImages, navigate]);
  const current = project.pages[Math.min(selected, project.pages.length - 1)];
  const completed = project.pages.filter(
    (page) => page.generated_image_path,
  ).length;
  const isExporting = percent !== null;
  const exportFile = async () => {
    if (isExporting) return;
    setError("");
    setPercent(0);
    try {
      await download(setPercent);
      setExportDialog(false);
      setMessage("可编辑 PPTX 已就绪，下载已开始。");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "导出失败，请稍后重试。",
      );
    } finally {
      setPercent(null);
    }
  };
  return (
    <div className="preview-page">
      <Header title="预览" back={`/project/${project.id}/outline`}>
        <button
          className="btn ghost refresh-button"
          onClick={() => location && window.location.reload()}
        >
          <RefreshCw size={16} />
          刷新
        </button>
        <div className="export-control">
          <button
            className="btn primary"
            disabled={completed !== project.pages.length || generating}
            onClick={() => setExportMenu(!exportMenu)}
          >
            <Download size={17} />
            导出
          </button>
          {exportMenu && (
            <>
              <button
                className="menu-dismiss"
                aria-label="关闭导出菜单"
                onClick={() => setExportMenu(false)}
              />
              <div className="export-menu">
                <button
                  onClick={() => {
                    setExportMenu(false);
                    setExportDialog(true);
                  }}
                >
                  导出可编辑 PPTX
                </button>
              </div>
            </>
          )}
        </div>
      </Header>
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <main className={`preview-layout ${properties ? "" : "hide-properties"}`}>
        <aside className="slides-panel">
          <button
            className="btn primary batch-button"
            disabled={generating}
            onClick={() => startImages()}
          >
            <RefreshCw size={16} />
            {generating
              ? `正在生成图片（${completed}/${project.pages.length}）`
              : `批量生成图片 (${project.pages.length})`}
          </button>
          {generating && (
            <Progress
              percent={Math.round((completed / project.pages.length) * 100)}
            />
          )}
          <div className="slide-thumbnails">
            {project.pages.map((page, index) => (
              <button
                key={page.id}
                className={`thumbnail ${selected === index ? "active" : ""}`}
                onClick={() => setSelected(index)}
                aria-label={`第 ${index + 1} 页 ${page.outline_content.title}`}
                aria-current={selected === index ? "page" : undefined}
              >
                <div>
                  {page.generated_image_path ? (
                    <img
                      src={page.generated_image_path}
                      alt={`第 ${index + 1} 页预览`}
                    />
                  ) : (
                    <span className="thumbnail-placeholder">{index + 1}</span>
                  )}
                  <small
                    className={
                      page.status === "COMPLETED"
                        ? "status-done"
                        : "status-pending"
                    }
                  >
                    {page.status === "COMPLETED" ? "已完成" : "生成中"}
                  </small>
                </div>
                <p>
                  {index + 1}. {page.outline_content.title}
                </p>
              </button>
            ))}
          </div>
        </aside>
        <section className="slide-stage" aria-label="当前幻灯片">
          {current.generated_image_path ? (
            <img
              className="main-slide"
              src={current.generated_image_path}
              alt={`第 ${selected + 1} 页 ${current.outline_content.title}`}
            />
          ) : (
            <div className="slide-placeholder">
              <div className="spinner" />
              <p>正在生成第 {selected + 1} 页图片…</p>
            </div>
          )}
          <div className="slide-controls">
            <button
              className="icon-button"
              aria-label="上一页"
              disabled={selected === 0}
              onClick={() => setSelected(selected - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            <span>
              {selected + 1} / {project.pages.length}
            </span>
            <button
              className="icon-button"
              aria-label="下一页"
              disabled={selected === project.pages.length - 1}
              onClick={() => setSelected(selected + 1)}
            >
              <ChevronRight size={19} />
            </button>
            <button
              className="btn secondary"
              onClick={() => setProperties(!properties)}
            >
              <FileEdit size={15} />
              编辑
            </button>
            <button
              className="btn ghost"
              disabled={generating}
              onClick={() => startImages([current.id])}
            >
              重新生成
            </button>
          </div>
        </section>
        {properties && (
          <aside className="properties-panel">
            <h2>
              页面属性{" "}
              <small>
                {selected + 1}/{project.pages.length}
              </small>
              <button
                className="icon-button"
                aria-label="收起页面属性"
                onClick={() => setProperties(false)}
              >
                <X size={16} />
              </button>
            </h2>
            <div className="properties-content">
              <span className="status-done">
                {current.status === "COMPLETED" ? "已完成" : "生成中"}
              </span>
              <h3>内容</h3>
              <label>
                标题
                <input
                  value={current.outline_content.title}
                  onChange={(event) =>
                    updateSlide(current.id, {
                      outline_content: {
                        ...current.outline_content,
                        title: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                所属章节
                <input value={current.part || "未分组"} readOnly />
              </label>
              <label>
                页面描述
                <textarea
                  value={(current.description_content?.text || "").replaceAll(
                    "\\n",
                    "\n",
                  )}
                  onChange={(event) =>
                    updateSlide(current.id, {
                      description_content: {
                        ...current.description_content,
                        text: event.target.value,
                      },
                    })
                  }
                />
              </label>
              {Object.entries(
                current.description_content?.extra_fields || {},
              ).map(([key, value]) => (
                <label key={key}>
                  {key}
                  <textarea value={value} readOnly />
                </label>
              ))}
              <h3>信息</h3>
              <p className="property-info">
                页码{" "}
                <span>
                  第 {selected + 1} / {project.pages.length} 页
                </span>
              </p>
            </div>
          </aside>
        )}
      </main>
      {exportDialog && (
        <Modal
          title="导出可编辑 PPTX"
          busy={isExporting}
          onClose={() => {
            setExportDialog(false);
            setError("");
          }}
        >
          <p className="export-hint">
            PPTX 文件支持在 PowerPoint 等软件中继续编辑。
          </p>
          {isExporting && (
            <div className="export-progress">
              <div>
                <span>正在准备可编辑 PPTX…</span>
                <b>{percent}%</b>
              </div>
              <Progress percent={percent} />
            </div>
          )}
          <div className="export-range">
            <small>导出范围</small>
            <p>全部 {project.pages.length} 页</p>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn ghost"
              disabled={isExporting}
              onClick={() => setExportDialog(false)}
            >
              取消
            </button>
            <button
              className="btn primary"
              disabled={isExporting}
              onClick={exportFile}
            >
              {isExporting ? `${percent}%` : "开始导出"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
