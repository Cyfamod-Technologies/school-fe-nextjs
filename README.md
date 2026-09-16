# Cyfamod Technologies - School Management System Frontend

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

A modern, responsive frontend for the School Management System built with Next.js 15.

## 🚀 Features

- **Modern UI/UX**: Clean, intuitive interface for students, teachers, and administrators
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Real-time Updates**: Live notifications and data synchronization
- **Dashboard Analytics**: Visual reports and statistics
- **Multi-role Support**: Different views for Admin, Teacher, and Student roles

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: CSS Modules / Tailwind CSS
- **State Management**: React Context / Zustand
- **API Integration**: REST API with Laravel Backend

## 📋 Prerequisites

- Node.js 18.x or higher
- npm, yarn, pnpm, or bun
- Git

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Cyfamod-Technologies/school-fe-nextjs.git
   cd school-fe-nextjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## 📁 Project Structure

```
├── app/                # Next.js App Router pages
├── components/         # Reusable UI components
├── contexts/           # React Context providers
├── lib/                # Utility functions and helpers
├── public/             # Static assets
├── styles/             # Global styles
└── legacy/             # Legacy code (to be migrated)
```

## 🧪 Available Scripts

### Broadsheet security verification errors

The broadsheet preview is fetched by the Next.js server from
`/api/v1/broadsheet/print`. A Cloudflare browser challenge on that request
prevents Laravel from generating the report; changing the displayed error alone
does not restore generation.

Configure `BACKEND_INTERNAL_URL` in the frontend server environment to a trusted
Laravel origin reachable from that server, then restart/redeploy the frontend.
It must point to the same backend as `NEXT_PUBLIC_BACKEND_URL`, without `/api/v1`.
Use a private network or a secured origin with HTTPS; do not expose an unprotected
origin publicly. This variable is server-only and currently applies to broadsheets.
Alternatively, have the Cloudflare administrator review Security Events and
adjust the challenge rule narrowly for the portal server and this endpoint,
keeping Laravel authentication and other security controls enabled.

Broadsheet responses are not cached, and upstream HTML errors are never displayed
as raw source in the preview.

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a PR.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- **Backend API**: [school-be-laravel](https://github.com/Cyfamod-Technologies/school-be-laravel)

## 💬 Support

- 📫 [Open an Issue](https://github.com/Cyfamod-Technologies/school-fe-nextjs/issues)
- 💡 [Discussions](https://github.com/Cyfamod-Technologies/school-fe-nextjs/discussions)
