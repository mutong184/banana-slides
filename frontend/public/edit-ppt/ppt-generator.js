(() => {
  const configuredServiceOrigin = typeof window !== 'undefined' && window.PPT_SERVICE_ORIGIN ? String(window.PPT_SERVICE_ORIGIN).replace(/\/$/, '') : '';
  const needsLocalServiceOrigin = typeof location !== 'undefined' && (location.protocol === 'file:' || (location.hostname === 'localhost' && location.port && location.port !== '8787'));
  const SERVICE_ORIGIN = configuredServiceOrigin || (needsLocalServiceOrigin ? 'http://localhost:8787' : '');
  const API_PREFIX = `${SERVICE_ORIGIN}/api/codia`;
  const LOCAL_PREFIX = `${SERVICE_ORIGIN}/api/ppt-master`;
  const WIDTH = 1600;
  const HEIGHT = 900;
  const DEFAULT_SLIDES = [
    ['封面', '建立生活现象与科学问题的连接', ['摆的快慢', '探究摆长与摆动快慢的关系'], 'cover'],
    ['学习目标', '明确本节课要解决的问题和探究能力', ['认识摆长与摆动快慢的关系', '学会控制变量和重复测量', '用证据解释自己的判断'], 'goals'],
    ['情境导入', '从摆钟、秋千等生活现象开始观察', ['观察相同点与不同点', '先描述现象，再提出疑问', '暂不提前揭示结论'], 'scene'],
    ['提出问题', '把生活疑问转化成可验证的问题', ['摆长会影响摆动快慢吗？', '怎样比较才是公平的？', '哪些条件需要保持不变？'], 'question'],
    ['提出猜想', '让学生先预测再说明理由', ['摆长变长，摆动可能变慢', '摆长变短，摆动可能变快', '用实验记录检验猜想'], 'hypothesis'],
    ['设计公平实验', '控制变量，明确操作和分工', ['只改变摆长', '摆锤、摆幅和起摆方式保持一致', '操作、计时、记录、汇报轮换'], 'design'],
    ['动手实验', '按步骤完成测量并保留真实记录', ['相同时间内数摆动次数', '每组至少重复测量三次', '如实记录，不用单次结果下结论'], 'experiment'],
    ['数据记录', '把观察结果整理成可以比较的数据', ['摆长：短 / 中 / 长', '测量次数：第1次 / 第2次 / 第3次', '比较平均趋势并记录发现'], 'data'],
    ['证据分析', '用重复测量检验猜想', ['先描述数据差异', '再判断证据是否支持猜想', '区分观察结果与解释'], 'evidence'],
    ['结论与迁移', '回到问题并把方法用于新情境', ['条件相同时，摆长越长，摆动越慢', '用控制变量和重复测量解决新问题', '回顾问题—猜想—实验—证据'], 'conclusion']
  ].map((s, i) => ({ id: `slide-${i + 1}`, title: s[0], objective: s[1], keyPoints: s[2], visualBrief: s[1], layout: s[3], imageUrl: '', compositeUrl: '', status: '待生成' }));

  const styleText = `
  .pptg-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(18,47,72,.32);backdrop-filter:blur(8px);overflow:auto;padding:28px 18px}
  .pptg-shell{width:min(1420px,100%);min-height:calc(100vh - 56px);margin:auto;border:1px solid #d8e7f0;border-radius:24px;background:#f7fbfd;box-shadow:0 24px 80px rgba(19,52,79,.25);color:#244e6c;overflow:hidden}
  .pptg-top{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 30px;border-bottom:1px solid #e0ebf1;background:#fff}.pptg-title{display:flex;align-items:center;gap:12px}.pptg-title b{font-size:21px}.pptg-title span{display:block;color:#8ba3b3;font-size:11px;margin-top:3px}.pptg-close{border:1px solid #dbe7ee;background:#fff;color:#7893a6;border-radius:10px;width:36px;height:36px;font-size:20px;cursor:pointer}.pptg-body{display:grid;grid-template-columns:minmax(280px,.78fr) minmax(0,1.5fr);min-height:720px}.pptg-sidebar{padding:26px;border-right:1px solid #e0ebf1;background:linear-gradient(150deg,#f4f9fc,#edf5f9)}.pptg-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.pptg-section-title strong{font-size:14px}.pptg-muted{color:#8ba2b2;font-size:11px;line-height:1.7}.pptg-mode{display:flex;gap:6px;margin:16px 0}.pptg-mode button,.pptg-btn{border:1px solid #d3e3ed;background:#fff;color:#55788f;border-radius:10px;padding:9px 12px;font-size:12px;cursor:pointer}.pptg-mode button.is-active,.pptg-btn.primary{background:#286fa8;border-color:#286fa8;color:#fff;box-shadow:0 6px 14px rgba(40,111,168,.16)}.pptg-drop{display:block;border:1px dashed #9fc3d9;border-radius:15px;background:#fff;padding:18px;text-align:center;color:#6d8da5;cursor:pointer}.pptg-drop:hover{border-color:#4486b3;background:#fafdff}.pptg-drop input{display:none}.pptg-template-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.pptg-template{position:relative;border:1px solid #dbe8ef;border-radius:9px;background:#fff;overflow:hidden;aspect-ratio:16/9}.pptg-template img{width:100%;height:100%;object-fit:cover}.pptg-template button{position:absolute;right:4px;top:4px;border:0;border-radius:50%;width:20px;height:20px;background:rgba(28,63,89,.72);color:#fff;cursor:pointer}.pptg-context{margin-top:24px;padding:13px;border:1px solid #dce9f0;border-radius:13px;background:#fff}.pptg-context strong{display:block;font-size:12px;margin-bottom:6px}.pptg-context pre{white-space:pre-wrap;max-height:170px;overflow:auto;margin:0;color:#7893a5;font:11px/1.65 inherit}.pptg-main{padding:28px 32px;background:#fff}.pptg-main-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}.pptg-main-head h2{margin:0;font-size:22px}.pptg-main-head p{margin:5px 0 0;color:#8aa1b1;font-size:12px}.pptg-outline{display:grid;gap:10px;max-height:560px;overflow:auto;padding-right:5px}.pptg-slide-row{display:grid;grid-template-columns:38px minmax(0,1fr) 86px;gap:10px;align-items:start;border:1px solid #dde9f0;border-radius:13px;padding:11px;background:#fbfdfe}.pptg-slide-number{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#edf5fa;color:#4c82a8;font-weight:700;font-size:11px}.pptg-slide-row input,.pptg-slide-row textarea{width:100%;border:1px solid #e0eaf0;border-radius:8px;background:#fff;color:#355d79;padding:7px 9px;font:12px/1.5 inherit;outline:0}.pptg-slide-row textarea{min-height:44px;resize:vertical;margin-top:6px}.pptg-slide-row input:focus,.pptg-slide-row textarea:focus{border-color:#80afd0;box-shadow:0 0 0 3px #edf6fb}.pptg-layout{font-size:10px;color:#91a6b5;text-align:right;padding-top:7px}.pptg-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e8eff3}.pptg-actions-right{display:flex;gap:8px}.pptg-progress{margin:24px 0}.pptg-progress-head{display:flex;justify-content:space-between;font-size:12px;color:#66879e}.pptg-progress-track{height:9px;background:#edf3f7;border-radius:99px;overflow:hidden;margin-top:8px}.pptg-progress-track span{display:block;height:100%;background:linear-gradient(90deg,#5c9bc0,#75ad93);transition:width .35s}.pptg-slide-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;max-height:545px;overflow:auto}.pptg-preview{border:1px solid #dce8ef;border-radius:13px;background:#f8fbfd;padding:8px}.pptg-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#eaf2f6}.pptg-preview footer{display:flex;justify-content:space-between;gap:8px;margin-top:7px;color:#6f8ca1;font-size:10px}.pptg-status{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:99px;background:#eef6fb;color:#4c82a5;font-size:11px}.pptg-status.is-error{background:#fff0f0;color:#b05b5b}.pptg-error{margin-top:13px;padding:11px 13px;border:1px solid #f0c9c9;border-radius:10px;background:#fff6f6;color:#a04d4d;font-size:12px;line-height:1.65}.pptg-empty{padding:50px 20px;text-align:center;color:#8ea5b4;font-size:13px}.pptg-small{font-size:10px;color:#9aadb9}.pptg-download{display:inline-flex;align-items:center;gap:7px;text-decoration:none}.pptg-result{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:20px}.pptg-result-card{padding:15px;border:1px solid #dce9f0;border-radius:15px;background:#f8fbfd}.pptg-result-card strong{display:block;font-size:13px;margin-bottom:7px}.pptg-result-card p{margin:0;color:#7d96a6;font-size:11px;line-height:1.7}.pptg-check{color:#5b967f;font-size:11px}.pptg-spinner{display:inline-block;width:13px;height:13px;border:2px solid #cfe0eb;border-top-color:#3980ae;border-radius:50%;animation:pptg-spin .8s linear infinite;vertical-align:-2px}@keyframes pptg-spin{to{transform:rotate(360deg)}}
  .pptg-template-index{position:absolute;left:5px;top:5px;border-radius:6px;padding:2px 5px;background:rgba(255,255,255,.78);color:#4c82a8;font-size:10px}.pptg-template-tools{position:absolute;right:4px;top:4px;display:flex;gap:3px}.pptg-template-tools button{position:static;width:20px;height:20px;border-radius:6px;font-size:11px;padding:0}.pptg-template-tools button:disabled{opacity:.35;cursor:default}.pptg-retry-slide{width:100%;margin-top:7px;border:1px solid #d4e4ed;background:#fff;color:#4c82a8;border-radius:7px;padding:5px;font-size:10px;cursor:pointer}
  @media(max-width:900px){.pptg-body{grid-template-columns:1fr}.pptg-sidebar{border-right:0;border-bottom:1px solid #e0ebf1}.pptg-main{padding:22px 18px}.pptg-slide-grid{grid-template-columns:repeat(2,1fr)}.pptg-result{grid-template-columns:1fr}}
  @media(max-width:560px){.pptg-backdrop{padding:0}.pptg-shell{border-radius:0;min-height:100vh}.pptg-top{padding:17px 15px}.pptg-title b{font-size:17px}.pptg-sidebar{padding:18px 15px}.pptg-slide-grid{grid-template-columns:1fr}.pptg-slide-row{grid-template-columns:30px minmax(0,1fr)}.pptg-layout{grid-column:2;text-align:left}.pptg-actions{align-items:stretch;flex-direction:column}.pptg-actions-right{width:100%}.pptg-actions-right button{flex:1}}
  `;
  const style = document.createElement('style'); style.textContent = styleText; document.head.appendChild(style);
  const state = { stage: 'outline', mode: 'local', templates: [], outline: DEFAULT_SLIDES.map(s => ({ ...s, keyPoints: [...s.keyPoints] })), slides: [], progress: 0, taskId: '', pptUrl: '', pdfUrl: '', error: '', payload: null, busy: false, generationId: '' };
  let root = null;
  const revokeObjectUrl = url => { if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url); };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const contextText = () => {
    const context = state.payload?.context;
    if (!context) return '当前教学情境将在生成提示词中使用。';
    if (typeof context === 'string') return context.slice(0, 1200);
    try { return JSON.stringify(context, null, 2).slice(0, 1200); } catch { return String(context); }
  };
  const makeDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const mockVisual = index => {
    const colors = ['#dcecf6','#f3e9dc','#e4f1e9','#e9e3f4','#f3e7e3'];
    const bg = colors[index % colors.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="${bg}"/><circle cx="1350" cy="140" r="240" fill="#ffffff" opacity=".36"/><circle cx="180" cy="760" r="320" fill="#ffffff" opacity=".26"/><path d="M0 720 C300 590 490 850 790 700 S1260 510 1600 670" fill="none" stroke="#ffffff" stroke-width="20" opacity=".45"/><path d="M0 760 C300 630 490 890 790 740 S1260 550 1600 710" fill="none" stroke="#7aa6bd" stroke-width="3" opacity=".25"/><rect x="1120" y="560" width="290" height="150" rx="28" fill="#ffffff" opacity=".38"/><circle cx="1265" cy="610" r="22" fill="#4b88ad" opacity=".7"/><path d="M1265 632v52M1215 680h100" stroke="#4b88ad" stroke-width="10" opacity=".7"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };
  const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  async function compositeSlide(slide, index) {
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eef5f8'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (slide.imageUrl) { try { const img = await loadImage(slide.imageUrl); ctx.drawImage(img, 0, 0, WIDTH, HEIGHT); } catch (_) {} }
    ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.roundRect(72, 62, 900, 710, 34); ctx.fill();
    ctx.fillStyle = '#1f526f'; ctx.font = '700 56px Microsoft YaHei, sans-serif'; ctx.fillText(slide.title, 130, 170);
    ctx.fillStyle = '#62839a'; ctx.font = '24px Microsoft YaHei, sans-serif'; ctx.fillText(slide.objective, 134, 220);
    ctx.strokeStyle = '#7aa6bf'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(132, 252); ctx.lineTo(900, 252); ctx.stroke();
    ctx.fillStyle = '#315d79'; ctx.font = '28px Microsoft YaHei, sans-serif';
    slide.keyPoints.forEach((point, i) => { const y = 335 + i * 94; ctx.fillStyle = '#4c89ad'; ctx.beginPath(); ctx.arc(155, y - 9, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#315d79'; ctx.fillText(point, 190, y); });
    ctx.fillStyle = '#7d9bad'; ctx.font = '18px Microsoft YaHei, sans-serif'; ctx.fillText(`摆的快慢 · 教学探究 · ${String(index + 1).padStart(2, '0')}`, 130, 824);
    return canvas.toDataURL('image/png');
  }
  const styleContract = '统一16:9小学科学教学课件风格，浅蓝与暖米色配色，留白充足，圆角卡片，细线图示，清晰的实验器材插画，轻松但专业，避免生成任何文字、字母和水印，为后续中文排版预留左侧内容区。';
  const buildPrompt = slide => {
    const profile = state.payload?.promptProfile ? JSON.stringify(state.payload.promptProfile) : '';
    const notes = Array.isArray(state.payload?.notes) ? state.payload.notes.join('\n') : String(state.payload?.notes || '');
    return `${styleContract}\n当前教学情境：${contextText()}\n教师补充：${notes.slice(0, 1800)}\n本页主题：${slide.title}。视觉目标：${slide.visualBrief}。请生成适合“摆的快慢”小学五年级探究课的背景与插画，体现摆、摆长、计时或实验记录中的相关视觉隐喻，画面干净，主体集中在右侧，左侧留白，不要出现文字。${profile ? `\n设计约束：${profile.slice(0, 1200)}` : ''}`;
  };
  const postJson = async (path, body) => { let response; try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch { throw new Error('无法连接本地 PPT Master 服务，请确认服务已启动，并使用 http://localhost:8787/ 打开页面。'); } const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.message || `请求失败（${response.status}）`); return payload.data ?? payload; };
  const getJson = async path => { let response; try { response = await fetch(path); } catch { throw new Error('无法连接本地 PPT Master 服务，请确认服务已启动，并使用 http://localhost:8787/ 打开页面。'); } const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.message || `请求失败（${response.status}）`); return payload.data ?? payload; };

  async function runLocalPptMaster() {
    const job = await postJson(`${LOCAL_PREFIX}/generate`, {
      outline: state.outline.map(slide => ({ ...slide, imageUrl: '', compositeUrl: '' })),
      context: state.payload?.context || {},
      notes: state.payload?.notes || [],
      templateFiles: state.templates.map(template => ({ name: template.name, type: template.type, dataUrl: template.dataUrl }))
    });
    state.taskId = job.jobId;
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await wait(700);
      const current = await getJson(`${LOCAL_PREFIX}/jobs/${encodeURIComponent(state.taskId)}`);
      state.progress = Number(current.progress || 0);
      if (current.status === 'generating') state.stage = 'generating';
      if (current.status === 'converting') state.stage = 'converting';
      if (Array.isArray(current.pages)) {
        state.slides = state.outline.map((slide, index) => {
          const page = current.pages[index] || {};
          return { ...slide, status: page.status || '等待生成', compositeUrl: page.previewUrl || '', imageUrl: page.previewUrl || '' };
        });
      }
      render();
      if (current.status === 'done') {
        state.pptUrl = current.pptUrl || '';
        state.progress = 100;
        state.stage = 'done';
        return;
      }
      if (current.status === 'error') throw new Error(current.error || current.message || 'PPT Master 本地工作流失败。');
    }
    throw new Error('PPT Master 任务超过 4 分钟仍未完成，请检查本地服务日志。');
  }

  async function generateOne(slide, index) {
    slide.status = '生成中'; render();
    if (state.mode === 'mock') { await wait(450 + index * 80); slide.imageUrl = mockVisual(index); slide.compositeUrl = await compositeSlide(slide, index); slide.status = '已完成'; return; }
    const result = await postJson(`${API_PREFIX}/generate`, { prompt: buildPrompt(slide), n: 1, size: '1536x1024', model: 'nano_banana_2_1', idempotencyKey: `ppt-${state.generationId}-${slide.id}`, referenceImages: state.templates.map(t => ({ name: t.name, type: t.type, dataUrl: t.dataUrl })) });
    slide.imageUrl = result.image_urls?.[0] || '';
    slide.compositeUrl = await compositeSlide(slide, index);
    slide.status = '已完成';
  }
  async function retrySlide(index) {
    if (state.busy || !state.slides[index]) return;
    const slide = state.slides[index]; state.busy = true; state.error = ''; slide.status = '生成中'; render();
    try { await generateOne(slide, index); } catch (error) { slide.status = '失败'; slide.error = error.message || '页面生成失败'; state.error = `第 ${index + 1} 页生成失败：${slide.error}`; }
    state.busy = false; state.progress = Math.round(state.slides.filter(s => s.status === '已完成').length / state.slides.length * 100); state.stage = 'ready'; render();
  }
  async function generateAll() {
    if (state.busy) return;
    if (state.mode === 'api' && state.templates.length === 0) { state.error = '真实 Codia 模式需要至少上传一张模板图片。'; render(); return; }
    state.busy = true; state.error = ''; state.generationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; state.stage = 'generating'; state.progress = 0; state.slides = state.outline.map(s => ({ ...s, keyPoints: [...s.keyPoints], status: '等待生成' })); render();
    if (state.mode === 'local') {
      try { await runLocalPptMaster(); state.busy = false; render(); } catch (error) { state.error = error.message || 'PPT Master 本地工作流失败'; state.stage = 'error'; state.busy = false; render(); }
      return;
    }
    let cursor = 0; let completed = 0;
    const worker = async () => { while (cursor < state.slides.length) { const i = cursor++; try { await generateOne(state.slides[i], i); } catch (error) { state.slides[i].status = '失败'; state.slides[i].error = error.message; state.error = `第 ${i + 1} 页生成失败：${error.message}`; } completed++; state.progress = Math.round(completed / state.slides.length * 100); render(); } };
    await Promise.all([worker(), worker()]); state.busy = false; state.stage = 'ready'; render();
  }
  async function createPdfBlob() {
    const pdfLib = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    const pdf = await pdfLib.PDFDocument.create();
    for (const slide of state.slides) { const page = pdf.addPage([960, 540]); const image = await pdf.embedPng(slide.compositeUrl); page.drawImage(image, { x: 0, y: 0, width: 960, height: 540 }); }
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  }
  const blobToDataUrl = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  async function convertToPpt() {
    if (state.mode === 'local') return;
    if (state.busy || !state.slides.length || state.slides.some(s => s.status !== '已完成')) return;
    state.busy = true; state.error = ''; state.stage = 'converting'; state.progress = 0; render();
    try {
      if (state.mode === 'mock') { for (let i = 1; i <= 5; i++) { await wait(420); state.progress = i * 20; render(); } const mock = new Blob([JSON.stringify({ mock: true, title: '摆的快慢教学课件', slides: state.slides.map(s => s.title) }, null, 2)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }); state.pptUrl = URL.createObjectURL(mock); state.stage = 'done'; state.busy = false; render(); return; }
      const pdfBlob = await createPdfBlob(); const pdfDataUrl = await blobToDataUrl(pdfBlob); state.progress = 20; render();
      const uploaded = await postJson(`${API_PREFIX}/upload`, { fileName: 'pendulum-teaching-deck.pdf', mimeType: 'application/pdf', dataUrl: pdfDataUrl }); state.progress = 35; render();
      const task = await postJson(`${API_PREFIX}/tasks`, { operation: 'pdf_to_ppt', input: { upload_id: uploaded.upload_id, page_no: state.slides.map((_, i) => i), title: '摆的快慢教学课件' } }); state.taskId = task.task_id;
      let result; for (let attempt = 0; attempt < 120; attempt++) { await wait(1800); const current = await getJson(`${API_PREFIX}/tasks/${encodeURIComponent(state.taskId)}`); state.progress = Math.max(35, Math.min(98, Number(current.progress || 0))); render(); if (current.status === 'succeeded') { result = current.result; break; } if (current.status === 'failed' || current.status === 'cancelled' || current.status === 'canceled') throw new Error(current.message || current.error || 'PPT 转换任务失败'); }
      if (!result?.ppt_url) throw new Error('转换完成但没有返回 PPTX 下载地址'); state.pptUrl = result.ppt_url; state.stage = 'done'; state.progress = 100; state.busy = false; render();
    } catch (error) { state.error = error.message || 'PPT 转换失败'; state.stage = 'error'; state.busy = false; render(); }
  }
  function renderTemplates() { return state.templates.length ? state.templates.map((t, i) => `<div class="pptg-template"><img src="${t.dataUrl}" alt="模板${i + 1}"><span class="pptg-template-index">${i + 1}</span><div class="pptg-template-tools"><button type="button" data-move-template="${i}:up" aria-label="模板上移" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move-template="${i}:down" aria-label="模板下移" ${i === state.templates.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-remove-template="${i}" aria-label="删除模板">×</button></div></div>`).join('') : '<div class="pptg-small">尚未上传模板。PPT Master 会使用统一的科学课堂视觉契约。</div>'; }
  function renderOutline() { return state.outline.map((slide, i) => `<div class="pptg-slide-row"><span class="pptg-slide-number">${String(i + 1).padStart(2, '0')}</span><div><input data-slide-title="${i}" value="${esc(slide.title)}" aria-label="第${i + 1}页标题"><textarea data-slide-points="${i}" aria-label="第${i + 1}页要点">${esc(slide.keyPoints.join('\n'))}</textarea></div><span class="pptg-layout">${esc(slide.layout)}</span></div>`).join(''); }
  function renderPreviews() { return state.slides.length ? state.slides.map((s, i) => `<article class="pptg-preview"><img src="${s.compositeUrl || s.imageUrl || mockVisual(i)}" alt="${esc(s.title)}"><footer><span>${String(i + 1).padStart(2, '0')} · ${esc(s.title)}</span><span>${s.status === '生成中' ? '<i class="pptg-spinner"></i>' : s.status}</span></footer>${s.status === '失败' ? `<button class="pptg-retry-slide" type="button" data-retry-slide="${i}">重试此页</button>` : ''}</article>`).join('') : '<div class="pptg-empty">生成后将在这里显示 PPT 页面预览。</div>'; }
  function renderMain() {
    if (state.stage === 'generating' || state.stage === 'ready') return `<div class="pptg-main-head"><div><h2>${state.mode === 'local' ? 'PPT Master 正在生成原生页面' : state.stage === 'generating' ? '正在生成页面图片' : '页面图片已生成'}</h2><p>${state.mode === 'local' ? '本地工作流直接生成可编辑文字、形状和图示。' : '所有页面使用相同模板约束，前端负责叠加准确中文内容。'}</p></div><span class="pptg-status">${state.progress}%</span></div><div class="pptg-progress"><div class="pptg-progress-head"><span>${state.mode === 'local' ? 'SVG 页面生成与 PPTX 导出' : state.stage === 'generating' ? 'Codia 文生图与页面合成' : '图片生成完成，可开始转换'}</span><strong>${state.mode === 'local' ? `${state.slides.filter(s => s.status === '已生成').length} / ${state.slides.length}` : `${state.slides.filter(s => s.status === '已完成').length} / ${state.slides.length}`}</strong></div><div class="pptg-progress-track"><span style="width:${state.progress}%"></span></div></div><div class="pptg-slide-grid">${renderPreviews()}</div><div class="pptg-actions"><span class="pptg-muted">${state.mode === 'local' ? 'PPT Master 在本机生成，服务不会上传课件内容。' : '可关闭窗口，稍后重新打开继续查看本地预览。'}</span><div class="pptg-actions-right"><button class="pptg-btn" type="button" data-back-outline ${state.mode === 'local' ? 'disabled' : ''}>返回修改</button>${state.mode === 'local' ? '' : `<button class="pptg-btn primary" type="button" data-convert ${state.stage === 'generating' ? 'disabled' : ''}>转换为可编辑 PPTX →</button>`}</div></div>`;
    if (state.stage === 'converting') return `<div class="pptg-main-head"><div><h2>${state.mode === 'local' ? 'PPT Master 正在导出可编辑 PPTX' : '正在转换为可编辑 PPTX'}</h2><p>${state.mode === 'local' ? '质量检查通过后，官方导出器正在写入 PowerPoint 原生对象。' : '先上传 PDF，再轮询 Codia 转换任务。'}</p></div><span class="pptg-status"><i class="pptg-spinner"></i>${state.progress}%</span></div><div class="pptg-progress"><div class="pptg-progress-head"><span>${state.mode === 'local' ? '本地 SVG → DrawingML PPTX' : 'PDF 上传与 PPTX 转换'}</span><strong>${state.progress}%</strong></div><div class="pptg-progress-track"><span style="width:${state.progress}%"></span></div></div><div class="pptg-result"><div class="pptg-result-card"><strong>${state.mode === 'local' ? '文字、形状和图示保持可编辑' : '页面仍保持图片式视觉稿'}</strong><p>${state.mode === 'local' ? 'PPT Master 正在生成原生 DrawingML 页面。' : '转换完成后，Codia 会尝试将文本、形状和图片重建为 PowerPoint 原生元素。'}</p></div><div class="pptg-result-card"><strong>任务状态</strong><p>${state.taskId ? `任务 ${esc(state.taskId)}` : '准备生成本地任务'}</p></div></div>`;
    if (state.stage === 'done') return `<div class="pptg-main-head"><div><h2>PPTX 已生成</h2><p>课件页面已完成统一风格生成并转换。</p></div><span class="pptg-status"><span class="pptg-check">✓</span>已完成</span></div><div class="pptg-slide-grid">${renderPreviews()}</div><div class="pptg-actions"><span class="pptg-muted">${state.mode === 'local' ? 'PPT Master 已输出原生可编辑文字、形状和图示。' : state.mode === 'mock' ? '当前为 Mock 演示文件，配置 API 代理后可下载真实 PPTX。' : 'Codia 已返回可编辑 PPTX 文件。'}</span><div class="pptg-actions-right"><a class="pptg-btn primary pptg-download" href="${state.pptUrl}" download="摆的快慢教学课件.pptx">下载 PPTX ↓</a><button class="pptg-btn" type="button" data-restart>重新生成</button></div></div>`;
    if (state.stage === 'error') return `<div class="pptg-main-head"><div><h2>生成遇到问题</h2><p>可以修正配置后重试当前流程。</p></div><span class="pptg-status is-error">失败</span></div><div class="pptg-error">${esc(state.error)}</div><div class="pptg-actions"><span class="pptg-muted">${state.mode === 'local' ? '请确认 PPT Master 文件和 Python 依赖已安装。' : '请检查代理服务、API Key、余额或网络连接。'}</span><button class="pptg-btn primary" type="button" data-retry>返回并重试</button></div>`;
    return `<div class="pptg-main-head"><div><h2>确认课件大纲</h2><p>根据当前教学情境生成 10 页课件。你可以修改标题和要点，再开始生成。</p></div><span class="pptg-status">${state.outline.length} 页 · 16:9</span></div><div class="pptg-outline">${renderOutline()}</div><div class="pptg-actions"><span class="pptg-muted">${state.mode === 'local' ? 'PPT Master 本地模式：生成原生可编辑 PPTX。' : state.mode === 'mock' ? 'Mock 模式不消耗 Codia 积分。' : '真实模式会调用 Codia API 并产生积分消耗。'}</span><div class="pptg-actions-right"><button class="pptg-btn" type="button" data-add-slide>+ 添加一页</button><button class="pptg-btn primary" type="button" data-generate>${state.mode === 'local' ? '调用 PPT Master →' : '开始生成图片 →'}</button></div></div>`;
  }
  function render() {
    if (!root) return;
    root.innerHTML = `<div class="pptg-shell" role="dialog" aria-modal="true" aria-label="PPT 图片生成与导出"><header class="pptg-top"><div class="pptg-title"><span class="pptg-status">PPT</span><div><b>课件生成系统</b><span>模板约束 · 结构化大纲 · PPT Master 原生导出</span></div></div><button class="pptg-close" type="button" data-close aria-label="关闭">×</button></header><div class="pptg-body"><aside class="pptg-sidebar"><div class="pptg-section-title"><strong>模板图片</strong><span class="pptg-small">${state.templates.length} / 3</span></div><p class="pptg-muted">上传 1–3 张参考图，生成页面会持续复用同一套视觉语言。</p><label class="pptg-drop">点击上传 PNG / JPG / WebP<input id="pptg-file-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple></label><div class="pptg-template-list">${renderTemplates()}</div><div class="pptg-mode"><button type="button" data-mode="local" class="${state.mode === 'local' ? 'is-active' : ''}">PPT Master 本地</button><button type="button" data-mode="mock" class="${state.mode === 'mock' ? 'is-active' : ''}">Mock 演示</button><button type="button" data-mode="api" class="${state.mode === 'api' ? 'is-active' : ''}">Codia API</button></div><div class="pptg-context"><strong>本次教学情境</strong><pre>${esc(contextText())}</pre></div><button class="pptg-btn" type="button" data-example style="width:100%;margin-top:12px">使用内置示例模板</button></aside><main class="pptg-main">${renderMain()}${state.error && !['error'].includes(state.stage) ? `<div class="pptg-error">${esc(state.error)}</div>` : ''}</main></div></div>`;
    bind();
  }
  function bind() {
    root.querySelector('[data-close]')?.addEventListener('click', () => { revokeObjectUrl(state.pptUrl); root.remove(); root = null; });
    root.querySelector('#pptg-file-input')?.addEventListener('change', async e => { const files = [...(e.target.files || [])]; state.error = ''; if (files.length + state.templates.length > 3) { state.error = '最多上传 3 张模板图片。'; render(); return; } for (const file of files) { if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { state.error = '只支持 PNG、JPG、JPEG 或 WebP 图片。'; continue; } if (file.size > 10 * 1024 * 1024) { state.error = `${file.name} 超过 10MB。`; continue; } state.templates.push({ name: file.name, type: file.type, dataUrl: await makeDataUrl(file) }); } render(); });
    root.querySelectorAll('[data-remove-template]').forEach(btn => btn.addEventListener('click', () => { state.templates.splice(Number(btn.dataset.removeTemplate), 1); render(); }));
    root.querySelectorAll('[data-move-template]').forEach(btn => btn.addEventListener('click', () => { const [rawIndex, direction] = btn.dataset.moveTemplate.split(':'); const index = Number(rawIndex); const next = direction === 'up' ? index - 1 : index + 1; if (next < 0 || next >= state.templates.length) return; [state.templates[index], state.templates[next]] = [state.templates[next], state.templates[index]]; render(); }));
    root.querySelector('[data-example]')?.addEventListener('click', () => { state.templates = [{ name: '内置暖色科学课件模板.svg', type: 'image/svg+xml', dataUrl: mockVisual(1) }]; render(); });
    root.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => { state.mode = btn.dataset.mode; render(); }));
    root.querySelectorAll('[data-slide-title]').forEach(input => input.addEventListener('input', e => { state.outline[Number(e.target.dataset.slideTitle)].title = e.target.value; }));
    root.querySelectorAll('[data-slide-points]').forEach(input => input.addEventListener('input', e => { state.outline[Number(e.target.dataset.slidePoints)].keyPoints = e.target.value.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 5); }));
    root.querySelector('[data-add-slide]')?.addEventListener('click', () => { const i = state.outline.length + 1; state.outline.push({ id: `slide-${i}`, title: `新增页面 ${i}`, objective: '补充课堂内容', keyPoints: ['请填写本页核心信息'], visualBrief: '补充与课程主题相关的视觉', layout: 'custom', imageUrl: '', compositeUrl: '', status: '待生成' }); render(); });
    root.querySelector('[data-generate]')?.addEventListener('click', generateAll);
    root.querySelector('[data-convert]')?.addEventListener('click', convertToPpt);
    root.querySelectorAll('[data-retry-slide]').forEach(btn => btn.addEventListener('click', () => retrySlide(Number(btn.dataset.retrySlide))));
    root.querySelector('[data-back-outline]')?.addEventListener('click', () => { state.stage = 'outline'; state.busy = false; render(); });
    root.querySelector('[data-retry]')?.addEventListener('click', () => { state.error = ''; state.stage = 'generating'; state.busy = false; state.progress = 0; render(); void generateAll(); });
    root.querySelector('[data-restart]')?.addEventListener('click', () => { revokeObjectUrl(state.pptUrl); state.stage = 'generating'; state.pptUrl = ''; state.slides = []; state.progress = 0; state.error = ''; state.busy = false; render(); void generateAll(); });
  }
  window.PptGenerator = { open(payload = {}) { if (root) root.remove(); revokeObjectUrl(state.pptUrl); state.payload = payload; state.stage = 'generating'; state.mode = 'local'; state.error = ''; state.busy = false; state.progress = 0; state.pptUrl = ''; state.taskId = ''; state.slides = []; state.outline = DEFAULT_SLIDES.map(s => ({ ...s, keyPoints: [...s.keyPoints] })); state.templates = []; const incoming = Array.isArray(payload.templateFiles) ? payload.templateFiles.filter(Boolean) : []; root = document.createElement('div'); root.className = 'pptg-backdrop'; document.body.appendChild(root); render(); Promise.all(incoming.slice(0, 3).map(async f => ({ name: f.name, type: f.type, dataUrl: await makeDataUrl(f) }))).then(items => { state.templates = items; render(); void generateAll(); }).catch(error => { state.error = `模板读取失败：${error.message || '无法读取图片'}`; state.stage = 'error'; render(); }); } };
})();
