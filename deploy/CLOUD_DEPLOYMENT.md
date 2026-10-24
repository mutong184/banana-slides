# PPT Edit 云端部署

这个部署方式适合学校、教研组或多人共用。服务器运行一个一体化容器，用户通过浏览器访问，不需要在用户电脑上安装 Python、Node.js、FFmpeg 或 GPU 驱动。

## 1. 准备服务器

推荐使用 Ubuntu 22.04/24.04，至少 2 核 CPU、4 GB 内存和 20 GB 可用磁盘。安装 Docker Engine 和 Compose 插件后确认：

```bash
docker version
docker compose version
```

## 2. 获取源码和配置

```bash
git clone <你的仓库地址> ppt-edit
cd ppt-edit
cp .env.example .env
```

编辑 `.env`，至少填写一个文本/图片模型提供商的密钥，并设置生产环境密钥：

```env
AI_PROVIDER_FORMAT=gemini
GOOGLE_API_KEY=你的密钥
GOOGLE_API_BASE=https://generativelanguage.googleapis.com
SECRET_KEY=请替换为随机长字符串
OUTPUT_LANGUAGE=zh
PORT=3011
```

如果使用 Codia 可编辑 PPTX 导出，再填写真实的 Open API Key：

```env
CODIA_API_KEY=你的 Codia Open API Key
CODIA_API_BASE=https://openapi.codia.ai
```

不要把 `.env` 提交到 Git，也不要把密钥写入前端代码。

## 3. 启动

源码部署使用以下命令，当前源码修改会进入镜像：

```bash
docker compose -f deploy/docker-compose.cloud.yml up -d --build
```

查看状态和日志：

```bash
docker compose -f deploy/docker-compose.cloud.yml ps
docker compose -f deploy/docker-compose.cloud.yml logs -f --tail 100 app
```

健康检查通过后访问：

```text
http://服务器IP:3011
```

## 4. 更新

```bash
git pull
docker compose -f deploy/docker-compose.cloud.yml up -d --build
```

数据库和上传文件保存在 Docker 命名卷中，重建镜像不会丢失。

## 5. 备份

至少定期备份数据库和上传文件：

```bash
docker run --rm \
  -v ppt-edit-database:/data \
  -v "$PWD/backups:/backup" \
  alpine tar czf /backup/database-$(date +%F).tar.gz -C /data .

docker run --rm \
  -v ppt-edit-uploads:/data \
  -v "$PWD/backups:/backup" \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

正式对外提供服务时，再在容器前面增加 Caddy/Nginx HTTPS 反向代理，并通过域名访问，不建议长期直接暴露 `3011` 端口。
