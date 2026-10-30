import type { AxiosAdapter } from 'axios';
import type { Project, Page } from '@/types';

// Enabled only by `vite --mode static-demo`; the normal application is unaffected.
export const isStaticReplay = import.meta.env.MODE === 'static-demo';
const STORAGE_KEY = 'ppt-edit-static-replay-v1';
const nativeFetch = globalThis.fetch.bind(globalThis);
export const replayDelay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface Snapshot {
  project: Project;
  downloadUrl: string;
  downloadIsExample: boolean;
}
interface ReplayState {
  project: Project;
  imageTask?: { id: string; started: number; pageIds: string[] };
}
let snapshotPromise: Promise<Snapshot> | undefined;
let state: ReplayState | undefined;

export async function loadReplaySnapshot(): Promise<Snapshot> {
  snapshotPromise ??= nativeFetch('/static-demo/project.json').then(async response => {
    if (!response.ok) throw new Error('课件内容暂时无法读取，请刷新页面后重试。');
    return response.json();
  });
  return snapshotPromise;
}

function saveState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function getState(): Promise<ReplayState> {
  if (!state) {
    const snapshot = await loadReplaySnapshot();
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.project?.id === snapshot.project.id && Array.isArray(saved.project.pages)) state = saved;
    } catch { /* Invalid session state starts a fresh replay. */ }
    state ??= { project: structuredClone(snapshot.project) };
  }
  // Elapsed time survives refresh; interrupted image replay never needs an API retry.
  if (state.imageTask) {
    const snapshot = await loadReplaySnapshot();
    const completed = Math.min(state.imageTask.pageIds.length, Math.floor((Date.now() - state.imageTask.started) / 500));
    const ready = new Set(state.imageTask.pageIds.slice(0, completed));
    state.project.pages = state.project.pages.map(page => {
      const source = snapshot.project.pages.find(item => item.id === page.id);
      return ready.has(page.id!) && source ? {
        ...page, generated_image_url: source.generated_image_url,
        generated_image_path: source.generated_image_path, status: 'COMPLETED',
      } : page;
    });
    if (completed === state.imageTask.pageIds.length) state.project.status = 'COMPLETED';
    saveState();
  }
  return state;
}

export async function replayDescriptions(onPage: (page: Page) => void): Promise<Page[]> {
  const current = await getState();
  const snapshot = await loadReplaySnapshot();
  for (const page of current.project.pages) {
    await replayDelay(180);
    const source = snapshot.project.pages.find(item => item.id === page.id);
    if (!source) throw new Error('当前页面描述暂不可用，请重新选择页面。');
    page.description_content = structuredClone(source.description_content);
    page.status = 'DESCRIPTION_GENERATED';
    saveState();
    onPage(structuredClone(page));
  }
  current.project.status = 'DESCRIPTIONS_GENERATED';
  saveState();
  return structuredClone(current.project.pages);
}

export async function getReplayPendingTask() {
  const current = await getState();
  const task = current.imageTask;
  if (!task) return null;
  const pendingIds = task.pageIds.filter(id => current.project.pages.some(page => page.id === id && page.status !== 'COMPLETED'));
  return pendingIds.length ? { id: task.id, pageIds: pendingIds } : null;
}

export async function replayEditableExport(onProgress?: (progress: number, message: string) => void): Promise<string> {
  const snapshot = await loadReplaySnapshot();
  for (const progress of [8, 25, 46, 72, 90, 100]) {
    onProgress?.(progress, progress === 100 ? '文件已就绪，即将下载' : '正在准备可编辑 PPTX…');
    await replayDelay(350);
  }
  // Verify the actual asset exists before reporting a successful download.
  const response = await nativeFetch(snapshot.downloadUrl, { method: 'HEAD' });
  if (!response.ok) throw new Error('可编辑 PPTX 暂不可用，请稍后重试。');
  return snapshot.downloadUrl;
}

async function dispatch(url: string, method: string, body: any) {
  const path = new URL(url, window.location.origin).pathname;
  const current = await getState();
  const snapshot = await loadReplaySnapshot();
  if (path === '/api/access-code/check') return { enabled: false };
  if (path === '/api/output-language') return { language: 'zh' };
  if (path === '/api/settings') return { image_resolution: '2K', output_language: 'zh', description_generation_mode: 'streaming' };
  if (path === '/api/settings/check-update') return { has_update: false };
  if (path === '/api/user-templates' || path === '/api/user-style-templates') return { templates: [] };
  if (path.startsWith('/api/reference-files/project/')) return { files: [] };
  if (path === '/api/projects' && method === 'post') {
    state = { project: structuredClone(snapshot.project) };
    state.project.status = 'OUTLINE_GENERATED';
    state.project.pages = state.project.pages.map(page => ({
      ...page, description_content: undefined, generated_image_url: undefined,
      generated_image_path: undefined, status: 'DRAFT',
    }));
    saveState();
    return state.project;
  }
  if (path === '/api/projects') return { projects: [current.project], total: 1 };
  const projectBase = `/api/projects/${current.project.id}`;
  if (path === projectBase) {
    if (method === 'put') {
      // Edits are session-local and never change the original saved project.
      for (const field of ['idea_prompt', 'outline_requirements', 'description_requirements', 'project_title'] as const) {
        if (typeof body[field] === 'string') current.project[field] = body[field];
      }
      if (Array.isArray(body.pages_order)) {
        current.project.pages.sort((a, b) => body.pages_order.indexOf(a.id) - body.pages_order.indexOf(b.id));
        current.project.pages.forEach((page, index) => { page.order_index = index; });
      }
      saveState();
    }
    return structuredClone(current.project);
  }
  if (path === `${projectBase}/template`) return { template_image_url: current.project.template_image_url };
  if (path === `${projectBase}/template-assets`) return { assets: [] };
  if (path === `${projectBase}/generate/images` || /\/pages\/[^/]+\/generate\/image$/.test(path)) {
    const pageId = path.match(/\/pages\/([^/]+)\/generate/)?.[1];
    const ids: string[] = pageId ? [pageId] : body.page_ids || current.project.pages.map(page => page.id!);
    current.imageTask = { id: `replay-${Date.now()}`, started: Date.now(), pageIds: ids };
    current.project.pages.forEach(page => {
      if (ids.includes(page.id!)) {
        page.status = 'QUEUED'; page.generated_image_path = undefined; page.generated_image_url = undefined;
      }
    });
    saveState();
    return { task_id: current.imageTask.id };
  }
  if (path.includes('/tasks/')) {
    if (!current.imageTask) throw new Error('未找到当前任务，请重新开始。');
    const ids = new Set(current.imageTask.pageIds);
    const completed = current.project.pages.filter(page => ids.has(page.id!) && page.status === 'COMPLETED').length;
    return { task_id: current.imageTask.id, status: completed === ids.size ? 'COMPLETED' : 'PROCESSING', progress: { total: ids.size, completed } };
  }
  const pageId = path.match(/\/pages\/([^/]+)/)?.[1];
  if (pageId) {
    const page = current.project.pages.find(item => item.id === pageId);
    if (!page) throw new Error('当前页面不存在，请重新选择页面。');
    if (path.endsWith('/image-versions')) return { versions: [] };
    if (method === 'put') {
      if (body.outline_content) page.outline_content = body.outline_content;
      if (body.description_content) page.description_content = body.description_content;
      saveState();
    }
    return structuredClone(page);
  }
  // Fail closed: unsupported actions cannot fall back to real generation services.
  console.warn('Unsupported static replay operation:', method, path);
  throw new Error('暂不支持此操作，请继续当前课件制作流程。');
}

export const staticReplayAdapter: AxiosAdapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {};
  const data = await dispatch(config.url || '', config.method || 'get', body);
  return { data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config };
};

// Fetch APIs outside the explicitly implemented replay are blocked as well.
// Static JSON, slide images and PPTX are the only network resources needed.
export function installStaticReplayGuard() {
  if (!isStaticReplay) return;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) {
      throw new Error('当前操作暂不可用，请稍后重试。');
    }
    return nativeFetch(input, init);
  };
}
