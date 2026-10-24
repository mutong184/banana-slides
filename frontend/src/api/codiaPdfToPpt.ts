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

const readCodiaResponse = async <T>(response: Response): Promise<T> => {
  let payload: CodiaEnvelope<T> | T | null = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Codia 返回了无法解析的响应（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const envelope = payload as CodiaEnvelope<T>;
    throw new Error(envelope?.message || `Codia 请求失败（HTTP ${response.status}）`);
  }

  // Codia 的错误响应同时可能通过 HTTP 状态码和业务 code 返回，
  // 这里两种形式都拦截，避免把错误 envelope 当成成功数据继续执行。
  if (payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error((payload as CodiaEnvelope<T>).message || `Codia 请求失败（code ${payload.code}）`);
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
  return fetch(`${useDirectApi ? 'https://openapi.codia.ai/v2/open' : CODIA_PROXY_BASE}${path}`, {
    ...init,
    headers,
  });
};

/**
 * 将已经生成的 PDF 交给 Codia pdf_to_ppt，返回可下载的 PPTX 地址。
 * 默认经本地后端代理调用，Codia API Key 由后端 .env 提供。
 * 传入 apiKey 仅用于开发调试时的直连覆盖。
 */
export async function convertPdfToEditablePpt(options: CodiaPdfToPptOptions): Promise<string> {
  const { apiKey, pdf, fileName = 'slides.pdf', title = '教学课件', pageCount = 0, onProgress } = options;
  if (apiKey?.trim().toLowerCase().startsWith('whsec_')) {
    throw new Error('当前填写的是 Codia webhook secret（whsec_ 开头），请改用 Codia Open API Key。');
  }
  onProgress?.(8, '正在上传 PDF 到 Codia…');
  const form = new FormData();
  form.append('file', pdf, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  const upload = await readCodiaResponse<{ upload_id?: string }>(
    await codiaFetch(apiKey, '/uploads', { method: 'POST', body: form }),
  );
  if (!upload.upload_id) throw new Error('Codia 上传成功但没有返回 upload_id');

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
  if (!task.task_id) throw new Error('Codia 任务创建成功但没有返回 task_id');

  const deadline = Date.now() + 20 * 60 * 1000;
  let lastProgress = 18;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const current = await readCodiaResponse<CodiaTask>(
      await codiaFetch(apiKey, `/tasks/${encodeURIComponent(task.task_id)}`),
    );
    const status = String(current.status || '').toLowerCase();
    const reported = typeof current.progress === 'number' ? current.progress : 0;
    const progress = Math.min(98, Math.max(lastProgress, 18 + Math.round(reported * 0.8)));
    lastProgress = progress;
    onProgress?.(progress, status === 'succeeded' ? '正在整理下载地址…' : `Codia 正在转换（${Math.round(reported)}%）…`);

    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error('Codia PPT 转换失败，请检查 API Key、余额或 PDF 内容。');
    }
    if (['succeeded', 'completed', 'success'].includes(status)) {
      const pptUrl = current.result?.ppt_url;
      if (!pptUrl) throw new Error('Codia 转换完成，但响应中没有 ppt_url');
      onProgress?.(100, 'PPTX 已生成');
      return pptUrl;
    }
  }

  throw new Error('Codia PPT 转换超时，请稍后在 Codia 控制台确认任务状态。');
}
