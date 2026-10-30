# PPT Edit 静态回放

从项目根目录运行 `powershell -ExecutionPolicy Bypass -File .\start-static-demo.ps1`，访问 http://127.0.0.1:3012/。
也可以在 frontend 运行 `npm run dev:demo`。仅需 Node.js 和已安装的前端依赖，不需要后端、数据库或 API Key。

流程：首页 → 开始多轮对话 → 教学情境 → 教学思维链 → 应用到 PPT 需求 → 大纲 → 下一步（页面描述进度）→ 逐页显示图片 → 导出可编辑 PPTX。

数据来自最新完整记录 `8937e1bd-8b00-48a8-bf08-f14fa8d036cc`（2026-10-25），共 15 页《摆的快慢》。文件位于 frontend/public/static-demo，包括 project.json、template.png 和 slides/ 下的页面图片。数据是独立快照，原项目和数据库不会改变。

下载文件为用户提供的 15 页《摆的快慢》可编辑课件 editable-example.pptx。替换此文件即可更新下载内容，无需重启开发服务。预览中的编辑、排序、单页选择均不会修改该下载文件。

静态模式由 `--mode static-demo` 启用，普通 `npm run dev` / `npm run build` 保留真实流程。静态模式的 Axios 请求由内存适配器处理；已实现的描述回放直接读取快照；未实现的在线操作直接报错，不转发真实服务。页面仅请求本地静态文件，不调用生成和转换服务。再次“应用到 PPT 需求”会重置演示，刷新则保留本标签页回放状态。

部署静态演示：在 frontend 运行 `npm run build:demo`，把 dist-demo 放到支持 SPA 回退的静态服务器。导航路径须回退到 index.html，静态资源须按真实文件返回。服务地址使用独立域名/端口，以隔离正式站点的浏览器缓存和项目状态。
