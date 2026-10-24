import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { History } from './pages/History';
import { OutlineEditor } from './pages/OutlineEditor';
import { TemplateSetupPage } from './pages/TemplateSetupPage';
import { SlidePreview } from './pages/SlidePreview';
import { EditPptEmbeddedPage } from './pages/EditPptEmbeddedPage';
import { SettingsPage } from './pages/Settings';
import { useProjectStore } from './store/useProjectStore';
import { useToast, AccessCodeGuard, DesktopTitleBar, UpdateChecker } from './components/shared';
import { getDesktopTopInset } from './components/shared/UpdateChecker';
import { isDesktop } from '@/utils';

// 页面描述现在由大纲页后台生成，旧地址只保留兼容跳转，避免再次展示“批量生成描述”页面。
function LegacyDetailRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={projectId ? `/project/${projectId}/preview` : '/'} replace />;
}

function App() {
  const { currentProject, syncProject, error, setError } = useProjectStore();
  const { show, ToastContainer } = useToast();

  // 恢复项目状态
  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && !currentProject) {
      syncProject();
    }
  }, [currentProject, syncProject]);

  // 显示全局错误
  useEffect(() => {
    if (error) {
      show({ message: error, type: 'error' });
      setError(null);
    }
  }, [error, setError, show]);


  return (
    <>
      <UpdateChecker />
      <div style={isDesktop ? { paddingTop: `${getDesktopTopInset()}px` } : undefined}>
        <AccessCodeGuard>
          {(() => {
            const Router = isDesktop ? HashRouter : BrowserRouter;
            return (
              <Router>
                <DesktopTitleBar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/landing" element={<Landing />} />
                  <Route path="/edit-ppt" element={<EditPptEmbeddedPage />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/project/:projectId/outline" element={<OutlineEditor />} />
                  <Route path="/project/:projectId/detail" element={<LegacyDetailRedirect />} />
                  <Route path="/project/:projectId/template-setup" element={<TemplateSetupPage />} />
                  <Route path="/project/:projectId/preview" element={<SlidePreview />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <ToastContainer />
              </Router>
            );
          })()}
        </AccessCodeGuard>
      </div>
    </>
  );
}

export default App;
