<div align="center">

# ✨ Magic Resume ✨

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-latest-black)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-10.0-purple)

<a href="https://trendshift.io/repositories/13077" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13077" alt="Magic Resume | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>


简体中文 | [English](./README.en-US.md)

</div>

Magic Resume 是一个现代化的在线简历编辑器，让创建专业简历变得简单有趣。基于 TanStack Start 和 Motion 构建，支持实时预览和自定义主题。

## 📸 项目截图

<img width="1920" height="1440" alt="85_1x_shots_so" src="https://github.com/user-attachments/assets/4667e49a-7bf2-4379-9390-725e42799dc7" />


## ✨ 特性

- 🚀 基于 TanStack Start 构建
- 💫 流畅的动画效果 (Motion)
- 🎨 自定义主题支持
- 🌙 深色模式
- 📤 导出为 PDF
- 🔄 实时预览
- 💾 自动保存
- 🔒 硬盘级存储

## 🛠️ 技术栈

- TanStack Start
- TypeScript
- Motion
- Tiptap
- Tailwind CSS
- Zustand
- Shadcn/ui
- Lucide Icons

## 🚀 快速开始

1. 克隆项目

```bash
git clone git@github.com:JOYCEQL/magic-resume.git
cd magic-resume
```

2. 安装依赖

```bash
pnpm install
```

3. 启动开发服务器

```bash
pnpm dev
```

4. 打开浏览器访问 `http://localhost:3000`

## 🔑 访问 Key（可选）

如果你希望部署后访问全站都需要输入 Key（包含页面与 API），请在运行时设置环境变量：

- `MAGIC_RESUME_ACCESS_KEY=你的Key`

Docker Compose 示例（推荐在命令行临时注入，避免把 Key 写进仓库文件）：

```bash
MAGIC_RESUME_ACCESS_KEY=your_key_here docker compose up -d
```

## 💾 服务端持久化（多设备编辑）

在 Docker/Node 部署模式下，系统会把你的简历数据与 AI 配置持久化到服务器的 `data/` 目录中（默认挂载为 `./data`），因此你在公司电脑编辑的内容，到家里电脑输入同一个访问 Key 后也能继续编辑。

你也可以在系统内的「通用设置」里直接更换访问 Key（会写入 `data/access.json`，无需改容器环境变量）。

## 📦 构建打包

```bash
pnpm build
```

## 🐳 Docker 部署

### Docker Compose

1. 确保你已经安装了 Docker 和 Docker Compose

2. 在项目根目录运行：

```bash
docker compose up -d
```

这将会：

- 自动构建应用镜像
- 在后台启动容器



## 📝 开源协议

本项目采用 Apache 2.0 协议，但有一些自定义的部分 - 查看 [LICENSE](LICENSE) 了解详情

## 🗺️ 路线图

- [x] AI 辅助编写
- [x] 多语言支持
- [ ] 支持更多简历模板
- [ ] 更多格式导出
- [x] 自定义模型
- [x] 自动一页纸
- [ ] 导入 PDF, Markdown 等
- [ ] 在线简历托管

## 📈 Star History

<a href="https://star-history.com/#JOYCEQL/magic-resume&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JOYCEQL/magic-resume&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JOYCEQL/magic-resume&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=JOYCEQL/magic-resume&type=Date" />
 </picture>
</a>

## 📞 联系方式

可以通过以下方式关注最新动态:

- 作者：SiYue
- X: @GuangzhouY81070
- Discord: 欢迎加入群组 https://discord.gg/9mWgZrW3VN
- 邮箱：18806723365@163.com
- 微信群：扫码加入开发交流群
  
<img src="./images/wechat.jpg" width="200" alt="WeChat Group">

- 项目主页：https://github.com/JOYCEQL/magic-resume

## 🌟 支持项目

<img src="https://github.com/JOYCEQL/picx-images-hosting/raw/master/pintu-fulicat.com-1741081632544.26lmg2uc2m.webp" width="320"  alt="图片描述">
