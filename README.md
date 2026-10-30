# PPT Edit 静态演示

独立的前端课件演示项目。保留原首页、教学情境对话、大纲编辑、页面描述进度、幻灯片预览和可编辑 PPTX 下载。所有内容来自随项目附带的文件，不连接后端，不需要数据库、Python、Docker、`.env` 或 API Key。

## 启动

需要 Node.js 18 或更新版本。

```sh
npm run setup
npm run dev
```

访问 **http://127.0.0.1:3012/**。Windows 也可以双击 `start-demo.bat`，或运行 `start-static-demo.ps1`。开发服务默认只在本机监听。

## 演示流程

1. 在首页选择模板，点击“开始多轮对话生成 PPT”。
2. 完成教学情境和思维链，点击“应用到 PPT 需求”。
3. 直接进入已有的 15 页大纲，可修改标题和要点。
4. 点击“下一步”，展示描述进度，再逐页显示课件图片。
5. 点击“导出 → 导出可编辑 PPTX”，展示进度并下载已有文件。

刷新会恢复当前标签页的展示进度。再次“应用到 PPT 需求”会开始新一轮演示。图片预览与下载文件都是固定资源；编辑文字不会重新绘制图片或修改 PPTX。

## 维护位置

```text
frontend/
  src/
    App.tsx             路由和教学情境交接
    demo.tsx            展示数据、进度和会话状态
    components.tsx      导航栏、弹窗和进度条
    pages/Home.tsx      首页及历史课件
    pages/Outline.tsx   大纲编辑
    pages/Preview.tsx   图片预览和下载
    styles.css          所有页面样式
    main.tsx            应用入口
  public/
    edit-ppt/main.html  原教学情境页面（独立前端资源）
    static-demo/
      project.json      大纲与页面描述，包含图片顺序和下载地址
      slides/           15 张幻灯片图片
      editable-example.pptx  用户提供的可编辑文件
    templates/          首页模板图片
```

更换下载文件：替换 `frontend/public/static-demo/editable-example.pptx`。更换整套演示：同步修改 `project.json` 中的大纲、描述、图片路径及 `slides/` 图片，并替换对应 PPTX。网页资源路径从站点根目录开始，文件名和大小写应保持一致。

## 检查与打包

```sh
npm run check
npm run build
npm run preview
```

构建产物为 `frontend/dist/`，直接部署到静态网站服务即可。SPA 路径（例如 `/project/static-demo-latest/outline`）需要回退到 `index.html`。Nginx 示例：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

默认按域名根路径部署。部署到子目录时，需要同步调整 Vite base、路由 basename 及所有以 `/` 开头的资源和教学情境跳转路径。

启动开发服务后，`npm test` 会验证完整演示流程、刷新恢复、零 API 请求，以及实际下载文件与源 PPTX 的 SHA-256 一致性。Windows 默认使用已安装的 Edge；Linux 可先在 frontend 运行 `npx playwright install chromium`，再设置 `DEMO_BROWSER=chromium`。可用 `DEMO_URL` 指定测试地址。

## 原项目

本分支 `mock_demo` 专门用于前端演示。原后端、配置、生成记录和旧源码在精简前已归档到工作区父目录下的 `_backups/banana-slides-before-frontend-only-*`，不随本分支发布；Git 中的其他分支也保留原项目历史。

保留原项目 LICENSE 及相关版权声明。
