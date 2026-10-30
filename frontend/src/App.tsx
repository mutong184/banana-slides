import { useEffect, useRef } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { DemoProvider, useDemo } from "./demo";
import { HomePage, HistoryPage } from "./pages/Home";
import { OutlinePage } from "./pages/Outline";
import { PreviewPage } from "./pages/Preview";

function HomeEntry() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const demo = useDemo();
  const started = useRef(false);
  const applying = params.get("action") === "teaching-context";
  useEffect(() => {
    if (!applying || started.current) return;
    started.current = true;
    demo.createProject();
    sessionStorage.removeItem("edit-ppt-context");
    navigate(`/project/${demo.project.id}/outline`, { replace: true });
  }, [applying, demo, navigate]);
  return applying ? (
    <div className="status-screen">
      <div className="spinner" />
      <p>正在准备 PPT 大纲…</p>
    </div>
  ) : (
    <HomePage />
  );
}

export default function App() {
  return (
    <DemoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeEntry />} />
          <Route
            path="/edit-ppt"
            element={
              <iframe
                className="teaching-frame"
                title="PPT Edit 多轮对话生成"
                src="/edit-ppt/main.html"
                allow="clipboard-read; clipboard-write"
              />
            }
          />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/project/:projectId/outline" element={<OutlinePage />} />
          <Route path="/project/:projectId/preview" element={<PreviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DemoProvider>
  );
}
