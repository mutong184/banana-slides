import { useState } from "react";
import { ArrowRight, FileText, GripVertical, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDemo } from "../demo";
import { Header, Loading } from "../components";

export function OutlinePage() {
  const { project, createProject, updateSlide, loadDescriptions } = useDemo();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");
  const next = async () => {
    if (progress) return;
    setError("");
    setProgress({ done: 0, total: project.pages.length });
    try {
      await loadDescriptions((done, total) => setProgress({ done, total }));
      navigate(`/project/${project.id}/preview`, {
        state: { autoGenerateImages: true },
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "页面描述生成失败，请重试。",
      );
      setProgress(null);
    }
  };
  if (progress) return <Loading {...progress} />;
  return (
    <div className="editor-page">
      <Header title="编辑大纲">
        <button className="btn primary" onClick={next}>
          下一步
          <ArrowRight size={17} />
        </button>
      </Header>
      <main className="outline-layout">
        <aside className="idea-panel">
          <h2>
            <FileText size={19} />
            PPT 构想
          </h2>
          <textarea
            aria-label="PPT 构想"
            value={project.idea_prompt}
            readOnly
          />
          <div className="idea-caption">
            围绕教学目标、探究问题、实验步骤、数据证据和结论组织页面。
          </div>
        </aside>
        <section className="outline-content">
          <div className="outline-toolbar">
            <span>共 {project.pages.length} 页</span>
            <button className="btn secondary" onClick={createProject}>
              <RefreshCw size={15} />
              重新生成大纲
            </button>
          </div>
          {error && (
            <div role="alert" className="error-text">
              {error}
            </div>
          )}
          <div className="outline-cards">
            {project.pages.map((page, index) => (
              <article className="outline-card" key={page.id}>
                <div className="outline-card-heading">
                  <span>
                    <GripVertical size={15} />第 {index + 1} 页
                  </span>
                  {page.part && <small>{page.part}</small>}
                </div>
                <input
                  aria-label={`第 ${index + 1} 页标题`}
                  value={page.outline_content.title}
                  onChange={(event) =>
                    updateSlide(page.id, {
                      outline_content: {
                        ...page.outline_content,
                        title: event.target.value,
                      },
                    })
                  }
                />
                <textarea
                  aria-label={`第 ${index + 1} 页要点`}
                  value={page.outline_content.points.join("\n")}
                  onChange={(event) =>
                    updateSlide(page.id, {
                      outline_content: {
                        ...page.outline_content,
                        points: event.target.value.split("\n"),
                      },
                    })
                  }
                />
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
