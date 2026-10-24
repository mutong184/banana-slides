import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * 将工作区根目录的教学情境页面嵌入 PPT Edit。
 * main.html 由后端以同源 HTTP 路径提供，避免浏览器拦截 file:// 导航。
 */
export const EditPptEmbeddedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full overflow-hidden bg-[#eef3f7]">
      <div className="absolute left-4 top-4 z-50">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-lg border border-[#cbdde8] bg-white/95 px-3 py-2 text-sm font-medium text-[#365b76] shadow-sm backdrop-blur transition-colors hover:bg-white"
        >
          <ArrowLeft size={16} />
          返回 PPT Edit
        </button>
      </div>
      <iframe
        title="PPT Edit 多轮对话生成"
        src="/edit-ppt/main.html"
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

