<div align="center">

# ✨ Magic Resume ✨

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-latest-black)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-10.0-purple)

[简体中文](./README.md) | English

</div>

Magic Resume is a modern online resume editor that makes creating professional resumes simple and enjoyable. Built with TanStack Start and Framer Motion, it supports real-time preview and custom themes.

## 📸 Screenshots

<img width="1920" height="1440" alt="336_1x_shots_so" src="https://github.com/user-attachments/assets/18969a17-06f8-4a4b-94eb-284ba8442620" />


## ✨ Features

- 🚀 Built with TanStack Start
- 💫 Smooth animations (Framer Motion)
- 🎨 Custom theme support
- 📱 Responsive design
- 🌙 Dark mode
- 📤 Export to PDF
- 🔄 Real-time preview
- 💾 Auto-save
- 🔒 Local storage

## 🛠️ Tech Stack

- TanStack Start
- TypeScript
- Motion
- Tiptap
- Tailwind CSS
- Zustand
- Shadcn/ui
- Lucide Icons

## 🚀 Quick Start

1. Clone the project

```bash
git clone git@github.com:JOYCEQL/magic-resume.git
cd magic-resume
```

2. Install dependencies

```bash
pnpm install
```

3. Start development server

```bash
pnpm dev
```

4. Open browser and visit `http://localhost:3000`

## 🔑 Access Key (Optional)

If you want to require an access key before accessing the site (pages and APIs), set this runtime environment variable:

- `MAGIC_RESUME_ACCESS_KEY=your_key`

Docker Compose example (recommended to inject via CLI to avoid committing secrets):

```bash
MAGIC_RESUME_ACCESS_KEY=your_key_here docker compose up -d
```

## 💾 Server-Side Persistence (Multi-Device Editing)

In Docker/Node deployments, the app persists your resume data and AI config to the server under the `data/` directory (mounted as `./data` by default). This lets you keep editing from another computer after entering the same access key.

You can also rotate the access key from within the app (Dashboard Settings). The key hash is stored in `data/access.json`, so you don't need to change container environment variables.

## 📦 Build and Deploy

```bash
pnpm build
```


## 🐳 Docker Deployment

### Docker Compose

1. Ensure you have Docker and Docker Compose installed

2. Run the following command in the project root directory:

```bash
docker compose up -d
```

This will:

- Automatically build the application image
- Start the container in the background


## 📝 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details

## 🗺️ Roadmap

- [x] AI-assisted writing
- [x] Multi-language support
- [ ] Support for more resume templates
- [ ] Support for more export formats
- [ ] Import PDF, Markdown, etc.
- [x] Custom model
- [x] Auto one page
- [ ] Online resume hosting

## 📈 Star History

<a href="https://star-history.com/#JOYCEQL/magic-resume&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JOYCEQL/magic-resume&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JOYCEQL/magic-resume&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=JOYCEQL/magic-resume&type=Date" />
 </picture>
</a>

## 📞 Contact

You can follow the latest updates via:

- Author: Siyue
- X: @GuangzhouY81070
- Discord: Join our community https://discord.gg/9mWgZrW3VN
- Email: 18806723365@163.com
- WeChat Group: Scan to join our developer community

  <img src="./images/wechat.png" width="200" alt="WeChat Group">

- Project Homepage: https://github.com/JOYCEQL/magic-resume

## 🌟 Support

If you find this project helpful, please give it a star ⭐️
