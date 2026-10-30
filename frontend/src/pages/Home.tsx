import { useState } from "react";
import {
  BookOpen,
  FileEdit,
  FolderOpen,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Palette,
  Paperclip,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Footer, Header, Modal } from "../components";
import { useDemo } from "../demo";

const templates = [
  ["1", "小学科学探究", "elementary"],
  ["2", "物理实验", "physics"],
  ["3", "化学实验", "chemistry"],
  ["4", "生物与生态", "biology"],
  ["5", "地理与环境", "earth"],
  ["6", "工程与技术", "engineering"],
];

export function HomePage() {
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const [selected, setSelected] = useState(() => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem("edit-ppt-template-selection") || "{}",
      ).templateId;
      return templates.some(([id]) => id === stored) ? stored : "1";
    } catch {
      return "1";
    }
  });
  const [uploaded, setUploaded] = useState("");
  const [error, setError] = useState("");
  const selectTemplate = (id: string) => {
    setSelected(id);
    sessionStorage.setItem(
      "edit-ppt-template-selection",
      JSON.stringify({ templateId: id }),
    );
  };
  return (
    <div className="home-page">
      <Header>
        <Link className="btn ghost" to="/history">
          <FolderOpen size={17} />
          历史项目
        </Link>
        <button className="btn ghost" onClick={() => setHelp(true)}>
          <HelpCircle size={17} />
          帮助
        </button>
      </Header>
      <main className="home-main">
        <section className="hero">
          <div className="hero-tagline">
            <Sparkles size={18} />
            通过多轮对话引导生成结构严谨、风格统一的可编辑 PPT
          </div>
          <h1>PPT Edit · 可编辑PPT生成</h1>
          <p>面向中小学科学教育场景的课件生成系统</p>
          <div className="feature-pills">
            {[
              [Sparkles, "多轮对话生成"],
              [FileEdit, "可编辑 PPTX"],
              [Search, "科学课件结构化"],
              [Paperclip, "统一风格导出"],
            ].map(([Icon, label]) => {
              const Component = Icon as typeof Sparkles;
              return (
                <span key={String(label)}>
                  <Component size={14} />
                  {String(label)}
                </span>
              );
            })}
          </div>
        </section>
        <section className="creation-card">
          <div className="creation-tab">
            <Sparkles size={20} />
            多轮对话引导生成 PPT
          </div>
          <p className="creation-description">
            <Lightbulb size={17} />
            通过多轮对话逐步明确教学目标、实验内容与页面结构
          </p>
          <div className="launch-card">
            <div className="launch-icon">
              <MessageSquare size={28} />
            </div>
            <h2>开始多轮对话，生成科学教育 PPT</h2>
            <p>
              系统会逐步引导你明确学段、学习目标、实验探究和页面结构，最后生成可编辑
              PPT。
            </p>
            <button
              className="btn primary large"
              onClick={() => navigate("/edit-ppt")}
            >
              <MessageSquare size={18} />
              开始多轮对话生成 PPT
            </button>
          </div>
          <section className="template-section">
            <h2>
              <Palette size={19} />
              选择风格模板
            </h2>
            <h3>预设模板</h3>
            <div className="template-grid">
              {templates.map(([id, name, subject]) => (
                <button
                  key={id}
                  className={`template-option ${selected === id ? "selected" : ""}`}
                  onClick={() => selectTemplate(id)}
                  aria-label={name}
                  aria-pressed={selected === id}
                >
                  <img
                    src={`/templates/science-${subject}-thumb.webp`}
                    alt={name}
                  />
                  {selected === id && (
                    <span className="selected-badge">已选择</span>
                  )}
                </button>
              ))}
              {uploaded && (
                <button
                  className={`template-option ${selected === "upload" ? "selected" : ""}`}
                  onClick={() => selectTemplate("upload")}
                >
                  <img src={uploaded} alt="上传的模板" />
                  {selected === "upload" && (
                    <span className="selected-badge">已选择</span>
                  )}
                </button>
              )}
              <label className="template-upload">
                <Upload size={23} />
                <span>上传模板</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        file.type,
                      ) ||
                      file.size > 10 * 1024 * 1024
                    ) {
                      setError("请选择小于 10 MB 的 PNG、JPG 或 WebP 图片。");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setUploaded(String(reader.result));
                      selectTemplate("upload");
                      setError("");
                    };
                    reader.readAsDataURL(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {error && <p className="error-text">{error}</p>}
          </section>
        </section>
      </main>
      <Footer />
      {help && (
        <Modal title="使用帮助" onClose={() => setHelp(false)}>
          <div className="help-text">
            <p>1. 选择课件风格，点击“开始多轮对话生成 PPT”。</p>
            <p>2. 完成教学情境和思维链，点击“应用到 PPT 需求”。</p>
            <p>3. 查看、编辑大纲，点击“下一步”进入课件预览。</p>
            <p>4. 点击“导出”下载可编辑 PPTX。</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function HistoryPage() {
  const { project } = useDemo();
  return (
    <div>
      <Header title="历史项目" />
      <main className="history-main">
        <h1>我的课件</h1>
        <article className="history-card">
          <img src="/static-demo/slides/01.png" alt={project.project_title} />
          <div>
            <span className="eyebrow">
              <BookOpen size={15} />
              科学教育课件
            </span>
            <h2>{project.project_title}</h2>
            <p>共 {project.pages.length} 页 · 小学科学 · 16:9</p>
            <Link className="btn primary" to={`/project/${project.id}/outline`}>
              编辑大纲
            </Link>
            <Link
              className="btn secondary"
              to={`/project/${project.id}/preview`}
            >
              查看课件
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
