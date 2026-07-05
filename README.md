# Cyfamod Technologies - School Management System Frontend

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

A modern, responsive frontend for the School Management System built with Next.js 15.

---

## Features
- **Modern UI/UX:** Clean, intuitive interface for students, teachers, and administrators
- **Responsive Design:** Works seamlessly on desktop, tablet, and mobile devices
- **Real-time Updates:** Live notifications and data synchronization
- **Dashboard Analytics:** Visual reports and statistics
- **Multi-role Support:** Different views for Admin, Teacher, and Student roles

## Tech Stack
- **Framework:** [Next.js 15](https://nextjs.org/) with App Router
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** CSS Modules / Tailwind CSS
- **State Management:** React Context / Zustand
- **API Integration:** REST API with Laravel Backend

## Prerequisites
- Node.js 18.x or higher
- npm, yarn, pnpm, or bun
- Git

## Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/Cyfamod-Technologies/school-fe-nextjs.git
   cd school-fe-nextjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Seeded Login Credentials for Local Testing
When testing the frontend against a seeded local backend, you can log in to the different portals/dashboards using the credentials below:

### 1. School Administrator Portal
- **Dashboard URL:** /v10/dashboard
- **Email:** demo@gmail.com
- **Password:** 12345678

### 2. Teacher and Staff Portal
- **Dashboard URL:** /v25/staff-dashboard
- **Email:** folake-balarabe@demointernational.edu.ng
- **Password:** password

### 3. Student Portal
- **Dashboard URL:** /v26/student-dashboard (via /student-login page)
- **Admission Number:** DIS001/2026/1
- **Password:** 123456

### 4. Parent View
- **Dashboard URL:** /v10/dashboard (shows parent dashboard layout with linked students)
- **Email:** chukwuemeka-obi-parent@demointernational.edu.ng
- **Password:** password

## Project Structure
```
├── app/                # Next.js App Router pages
├── components/         # Reusable UI components
├── contexts/           # React Context providers
├── lib/                # Utility functions and helpers
├── public/             # Static assets
└── styles/             # Global styles
```

## Available Scripts
```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Common Troubleshooting
**Issue:** Token mismatch or authorization errors when navigating dashboards.
**Fix:** Ensure `NEXT_PUBLIC_BACKEND_URL` in `.env.local` matches your running backend instance (usually `http://localhost:8000`). If cookies are blocked, verify your browser allows third-party cookies or run the apps on matching local domains.

## Contributing
We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a PR.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects
- **Backend API:** [school-be-laravel](https://github.com/Cyfamod-Technologies/school-be-laravel)

## Support
- 📫 [Open an Issue](https://github.com/Cyfamod-Technologies/school-fe-nextjs/issues)
- 💡 [Discussions](https://github.com/Cyfamod-Technologies/school-fe-nextjs/discussions)
