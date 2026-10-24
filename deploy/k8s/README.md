# Kubernetes 部署

## 构建 Linux 镜像

仓库已提供 `.github/workflows/build-ppt-edit-image.yml`。提交到 `main` 后，GitHub Actions 会在 Linux Runner 上构建 `linux/amd64` 和 `linux/arm64` 镜像并推送到 GHCR。K8s 节点直接拉取该镜像即可；也可以使用下面的命令在 Linux 构建机上手动发布。

Windows 开发机不需要安装 Linux Python 依赖。使用 Linux CI 或服务器执行：

```bash
docker buildx build \
  --platform linux/amd64 \
  -f Dockerfile.allinone \
  -t ghcr.io/your-org/ppt-edit:latest \
  --push .
```

K8s 节点如果是 ARM64，把平台改为 `linux/arm64`；也可以同时推送两个平台的 manifest。

## 创建密钥

不要把 API Key 写进 Git 中的 YAML。准备一个只在部署机上保存的环境文件：

```bash
cat > .env.k8s <<'EOF'
GOOGLE_API_KEY=替换为真实密钥
SECRET_KEY=替换为随机长字符串
CODIA_API_KEY=替换为 Codia Open API Key
MINERU_TOKEN=替换为 MinerU Token
EOF

kubectl create namespace ppt-edit --dry-run=client -o yaml | kubectl apply -f -
kubectl -n ppt-edit create secret generic ppt-edit-secrets \
  --from-env-file=.env.k8s \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 部署

把 `kustomization.yaml` 中的镜像地址改成实际仓库（例如 `ghcr.io/anionex/ppt-edit`），然后执行：

```bash
kubectl apply -k deploy/k8s
kubectl -n ppt-edit rollout status deployment/ppt-edit --timeout=10m
kubectl -n ppt-edit get pods,svc,pvc
```

如果集群使用 Nginx Ingress Controller，再把示例域名改成真实域名后执行：

```bash
kubectl apply -f deploy/k8s/ingress.example.yaml
```

当前应用使用 SQLite，因此清单固定为单副本。要水平扩展，需要先迁移到 PostgreSQL，并把上传文件放到对象存储或 ReadWriteMany 存储。
