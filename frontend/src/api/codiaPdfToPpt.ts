import { isStaticReplay, replayEditableExport } from '@/demo/staticReplay';
import apiClient from './client';

const CODIA_PROXY_BASE = '/api/codia';

export interface CodiaPdfToPptOptions {
  /** Optional development override. Production calls use the local proxy. */
  apiKey?: string;
  pdf: Blob;
  fileName?: string;
  title?: string;
  pageCount?: number;
  onProgress?: (progress: number, message: string) => void;
}

interface CodiaEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface CodiaTask {
  task_id?: string;
  status?: string;
  progress?: number;
  result?: { ppt_url?: string; pages?: unknown[] };
}

export interface CodiaProjectExportOptions {
  projectId: string;
  pageIds?: string[];
  title?: string;
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Export errors are intentionally kept provider-neutral in the UI. The
 * provider response can contain vendor names, URLs, or credential hints that
 * should never be shown to end users.
 */
const toExportError = (fallback: string): Error => new Error(fallback);

const readCodiaResponse = async <T>(response: Response): Promise<T> => {
  let payload: CodiaEnvelope<T> | T | null = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`导出服务返回了无法解析的响应（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    throw toExportError(`导出请求失败（HTTP ${response.status}）`);
  }

  // Codia 的错误响应同时可能通过 HTTP 状态码和业务 code 返回，
  // 这里两种形式都拦截，避免把错误 envelope 当成成功数据继续执行。
  if (payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'number' && payload.code !== 0) {
    throw toExportError(`导出请求失败（code ${payload.code}）`);
  }

  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data as T;
  }
  return payload as T;
};

const codiaFetch = (apiKey: string | undefined, path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const useDirectApi = Boolean(apiKey?.trim());
  if (useDirectApi) headers.set('Authorization', `Bearer ${apiKey!.trim()}`);
  if (!useDirectApi) {
    const accessCode = window.localStorage.getItem('banana-access-code');
    if (accessCode) headers.set('X-Access-Code', accessCode);
  }
  return fetch(`${useDirectApi ? 'https://openapi.codia.ai/v2/open' : CODIA_PROXY_BASE}${path}`, {
    ...init,
    headers,
  });
};

const pollCodiaTask = async (
  apiKey: string | undefined,
  taskId: string,
  onProgress?: (progress: number, message: string) => void,
  initialProgress = 18,
): Promise<string> => {
  const deadline = Date.now() + 20 * 60 * 1000;
  let lastProgress = initialProgress;
  let firstCheck = true;

  while (Date.now() < deadline) {
    // Query once immediately after task creation. Subsequent checks use a
    // shorter interval so the UI notices completion without adding avoidable
    // idle time after Codia finishes.
    if (!firstCheck) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    firstCheck = false;

    const current = await readCodiaResponse<CodiaTask>(
      await codiaFetch(apiKey, `/tasks/${encodeURIComponent(taskId)}`),
    );
    const status = String(current.status || '').toLowerCase();
    const reported = typeof current.progress === 'number' ? current.progress : 0;
    const progress = Math.min(98, Math.max(lastProgress, initialProgress + Math.round(reported * 0.8)));
    lastProgress = progress;
    onProgress?.(progress, status === 'succeeded' ? '正在整理下载地址…' : `正在转换 PPTX（${Math.round(reported)}%）…`);

    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error('PPT 转换失败，请检查导出配置或 PDF 内容。');
    }
    if (['succeeded', 'completed', 'success'].includes(status)) {
      const pptUrl = current.result?.ppt_url;
      if (!pptUrl) throw new Error('转换完成，但响应中没有 PPTX 下载地址');
      onProgress?.(100, 'PPTX 已生成');
      return pptUrl;
    }
  }

  throw new Error('PPT 转换超时，请稍后重试。');
};

/**
 * Generate the project's PDF and submit it to Codia entirely on the server.
 * The browser sends page ids only; it no longer downloads and re-uploads PDF.
 */
export async function convertProjectToEditablePpt(options: CodiaProjectExportOptions): Promise<string> {
  const { projectId, pageIds, title, onProgress } = options;
  if (isStaticReplay) return replayEditableExport(onProgress);
  const idempotencyKey = `ppt-edit-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  onProgress?.(3, '正在由服务器准备 PDF…');

  let response;
  try {
    response = await apiClient.post<{
      data?: { task_id?: string };
      task_id?: string;
      message?: string;
    }>(
      `/api/codia/projects/${encodeURIComponent(projectId)}/pdf-to-ppt`,
      { page_ids: pageIds, title },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  } catch {
    throw new Error('服务器生成 PDF 或创建导出任务失败，请稍后重试。');
  }

  const payload = response.data;
  const taskId = payload.data?.task_id || payload.task_id;
  if (!taskId) throw new Error('导出任务创建成功但没有返回任务编号');
  onProgress?.(18, '正在转换 PPTX…');
  return pollCodiaTask(undefined, taskId, onProgress, 18);
}

/**
 * 将已经生成的 PDF 交给 Codia pdf_to_ppt，返回可下载的 PPTX 地址。
 * 默认经本地后端代理调用，Codia API Key 由后端 .env 提供。
 * 传入 apiKey 仅用于开发调试时的直连覆盖。
 */
export async function convertPdfToEditablePpt(options: CodiaPdfToPptOptions): Promise<string> {
  const { apiKey, pdf, fileName = 'slides.pdf', title = '教学课件', pageCount = 0, onProgress } = options;
  if (apiKey?.trim().toLowerCase().startsWith('whsec_')) {
    throw new Error('当前填写的导出密钥无效，请检查服务配置。');
  }
  onProgress?.(8, '正在上传 PDF…');
  const form = new FormData();
  form.append('file', pdf, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  const upload = await readCodiaResponse<{ upload_id?: string }>(
    await codiaFetch(apiKey, '/uploads', { method: 'POST', body: form }),
  );
  if (!upload.upload_id) throw new Error('PDF 上传成功但没有返回任务编号');

  const pages = Array.from({ length: Math.max(0, pageCount) }, (_, index) => index);
  onProgress?.(18, '正在创建可编辑 PPT 任务…');
  const task = await readCodiaResponse<CodiaTask>(
    await codiaFetch(apiKey, '/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `ppt-edit-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
      },
      body: JSON.stringify({
        operation: 'pdf_to_ppt',
        input: {
          upload_id: upload.upload_id,
          page_no: pages,
          title,
        },
      }),
    }),
  );
  if (!task.task_id) throw new Error('导出任务创建成功但没有返回任务编号');

  return pollCodiaTask(apiKey, task.task_id, onProgress, 18);
}
