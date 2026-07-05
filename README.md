# 🎨 School Management System - Frontend App

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-blue?logo=react)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

Next.js 15 frontend application for the Cyfamod School Management System. It delivers role-based dashboards for administrators, teachers, students, and parents.

---

## 🏛️ Architecture Overview
This application interfaces directly with the Laravel backend API to display role-scoped dashboards:
- **Admin Dashboard:** Access at `/v10/dashboard`
- **Teacher Dashboard:** Access at `/v25/staff-dashboard`
- **Student Dashboard:** Access at `/v26/student-dashboard`
- **Parent Dashboard:** Access at `/v10/dashboard` (customized parent view)

## 📦 Prerequisites
- **Node.js** >= 18.x
- **NPM** >= 9.x or **Yarn**

## 🚀 One-Command Local Setup

Follow these exact steps to spin up the application on a clean machine:

```bash
# 1. Clone the repository
git clone https://github.com/Cyfamod-Technologies/school-fe-nextjs.git
cd school-fe-nextjs

# 2. Install dependencies
npm install

# 3. Setup your environment
cp .env.example .env.local

# 4. Boot the development server
npm run dev
```
The application is now running locally at `http://localhost:3000`.

### 🔑 Seeded Login Credentials
> 💡 **Tip:** Login credentials for the dashboards are seeded on the backend database. Run `php artisan db:seed` in the backend repository to see the login details printed in the terminal.

## 🧪 Running Tests

```bash
npm run test
```

## 🤝 Contributing

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide and Code of Conduct before submitting a PR.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Projects

Backend API: [school-be-laravel](https://github.com/Cyfamod-Technologies/school-be-laravel)

## 💬 Support

- 📫 [Open an Issue](https://github.com/Cyfamod-Technologies/school-fe-nextjs/issues)
- 💡 [Discussions](https://github.com/Cyfamod-Technologies/school-fe-nextjs/discussions)
