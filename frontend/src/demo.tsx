import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface Slide {
  id: string;
  page_id: string;
  order_index: number;
  part?: string;
  outline_content: { title: string; points: string[] };
  description_content?: { text: string; extra_fields?: Record<string, string> };
  generated_image_path?: string;
  generated_image_url?: string;
  status: string;
}
export interface Project {
  id: string;
  project_id: string;
  project_title: string;
  idea_prompt: string;
  pages: Slide[];
  status: string;
}
interface Snapshot {
  project: Project;
  downloadUrl: string;
}
interface ImageTask {
  id: string;
  started: number;
  pageIds: string[];
}
interface ReplayState {
  project: Project;
  imageTask?: ImageTask;
}
const SESSION_KEY = "ppt-edit-static-replay-v1";
const rawFetch = window.fetch.bind(window);
let snapshotPromise: Promise<Snapshot> | undefined;

// There is no API client or online generation mode in this project.
window.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    location.href,
  );
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) {
    return Promise.reject(new Error("当前操作暂不可用。"));
  }
  return rawFetch(input, init);
};

export const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const loadSnapshot = () =>
  (snapshotPromise ??= fetch("/static-demo/project.json").then(
    async (response) => {
      if (!response.ok) throw new Error("课件内容暂时无法读取，请刷新后重试。");
      const data = (await response.json()) as Snapshot;
      if (!data.project?.pages?.length || !data.downloadUrl)
        throw new Error("课件文件不完整。");
      return data;
    },
  ));

interface Demo {
  project: Project;
  generating: boolean;
  createProject: () => void;
  updateSlide: (id: string, patch: Partial<Slide>) => void;
  loadDescriptions: (
    onProgress: (done: number, total: number) => void,
  ) => Promise<void>;
  startImages: (ids?: string[]) => void;
  download: (onProgress: (percent: number) => void) => Promise<void>;
}
const DemoContext = createContext<Demo | null>(null);
export const useDemo = () => {
  const value = useContext(DemoContext);
  if (!value) throw new Error("课件工作区尚未就绪。");
  return value;
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [state, setState] = useState<ReplayState | null>(null);
  const [error, setError] = useState("");
  const stateRef = useRef<ReplayState | null>(null);
  const runId = useRef(0);
  const commit = useCallback(
    (transform: (previous: ReplayState) => ReplayState) => {
      if (!stateRef.current) return;
      const next = transform(stateRef.current);
      stateRef.current = next;
      setState(next);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } catch {
        /* In-memory playback still works. */
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    loadSnapshot()
      .then((data) => {
        if (!mounted) return;
        let restored: ReplayState = { project: structuredClone(data.project) };
        try {
          const saved = JSON.parse(
            sessionStorage.getItem(SESSION_KEY) || "null",
          ) as ReplayState | null;
          const validIds = new Set(data.project.pages.map((page) => page.id));
          if (
            saved?.project?.id === data.project.id &&
            saved.project.pages.length > 0 &&
            saved.project.pages.every((page) => validIds.has(page.id))
          )
            restored = saved;
        } catch {
          /* A malformed session starts from the fixture. */
        }
        stateRef.current = restored;
        setState(restored);
        setSnapshot(data);
      })
      .catch((reason) => {
        if (mounted) setError(String(reason.message || reason));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const taskId = state?.imageTask?.id;
  useEffect(() => {
    if (!taskId || !snapshot) return;
    const tick = () =>
      commit((previous) => {
        const task = previous.imageTask;
        if (!task || task.id !== taskId) return previous;
        const completed = Math.min(
          task.pageIds.length,
          Math.floor((Date.now() - task.started) / 500),
        );
        const ready = new Set(task.pageIds.slice(0, completed));
        const pages = previous.project.pages.map((page) => {
          const source = snapshot.project.pages.find(
            (item) => item.id === page.id,
          );
          return ready.has(page.id) && source
            ? {
                ...page,
                generated_image_path: source.generated_image_path,
                generated_image_url: source.generated_image_url,
                status: "COMPLETED",
              }
            : page;
        });
        return {
          project: {
            ...previous.project,
            pages,
            status:
              completed === task.pageIds.length
                ? "COMPLETED"
                : "DESCRIPTIONS_GENERATED",
          },
          imageTask: completed === task.pageIds.length ? undefined : task,
        };
      });
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [taskId, snapshot, commit]);

  if (error)
    return (
      <div className="status-screen">
        <h2>{error}</h2>
        <button className="btn primary" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    );
  if (!snapshot || !state)
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>正在准备课件工作区…</p>
      </div>
    );

  const createProject = () => {
    runId.current++;
    const project = structuredClone(snapshot.project);
    project.status = "OUTLINE_GENERATED";
    project.pages = project.pages.map((page) => ({
      ...page,
      description_content: undefined,
      generated_image_path: undefined,
      generated_image_url: undefined,
      status: "DRAFT",
    }));
    commit(() => ({ project }));
  };
  const updateSlide = (id: string, patch: Partial<Slide>) =>
    commit((previous) => ({
      ...previous,
      project: {
        ...previous.project,
        pages: previous.project.pages.map((page) =>
          page.id === id ? { ...page, ...patch } : page,
        ),
      },
    }));
  const loadDescriptions = async (
    onProgress: (done: number, total: number) => void,
  ) => {
    const thisRun = runId.current;
    const pages = stateRef.current!.project.pages;
    onProgress(0, pages.length);
    for (let i = 0; i < pages.length; i++) {
      await wait(180);
      if (thisRun !== runId.current) return;
      const source = snapshot.project.pages.find(
        (page) => page.id === pages[i].id,
      )!;
      updateSlide(source.id, {
        description_content: structuredClone(source.description_content),
        status: "DESCRIPTION_GENERATED",
      });
      onProgress(i + 1, pages.length);
    }
    commit((previous) => ({
      ...previous,
      project: { ...previous.project, status: "DESCRIPTIONS_GENERATED" },
    }));
  };
  const startImages = (ids?: string[]) => {
    if (stateRef.current?.imageTask) return;
    const pageIds =
      ids || stateRef.current!.project.pages.map((page) => page.id);
    commit((previous) => ({
      project: {
        ...previous.project,
        pages: previous.project.pages.map((page) =>
          pageIds.includes(page.id)
            ? {
                ...page,
                generated_image_path: undefined,
                generated_image_url: undefined,
                status: "GENERATING",
              }
            : page,
        ),
      },
      imageTask: { id: `replay-${Date.now()}`, started: Date.now(), pageIds },
    }));
  };
  const download = async (onProgress: (percent: number) => void) => {
    for (const percent of [8, 25, 46, 72, 90]) {
      onProgress(percent);
      await wait(350);
    }
    const response = await fetch(snapshot.downloadUrl, {
      method: "HEAD",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("可编辑 PPTX 暂不可用，请稍后重试。");
    onProgress(100);
    await wait(200);
    const link = document.createElement("a");
    link.href = snapshot.downloadUrl;
    link.download = "摆的快慢-可编辑.pptx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  return (
    <DemoContext.Provider
      value={{
        project: state.project,
        generating: Boolean(state.imageTask),
        createProject,
        updateSlide,
        loadDescriptions,
        startImages,
        download,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
