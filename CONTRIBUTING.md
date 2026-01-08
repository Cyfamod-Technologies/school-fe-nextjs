# Contributing to Cyfamod Technologies Frontend

Thank you for considering contributing to our frontend application! This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/cyfamod-frontend.git
   cd cyfamod-frontend
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Copy environment variables**:
   ```bash
   cp .env.example .env.local
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```

## Branch Strategy

We use **Git Flow** branching model:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `hotfix/*` - Critical bug fixes
- `release/*` - Release preparation

## Development Workflow

### 1. Before Starting Work

```bash
# Switch to develop branch
git checkout develop

# Pull latest changes
git pull upstream develop

# Create a new feature branch
git checkout -b feature/your-feature-name
```

### 2. Making Changes

- Write clean, readable code
- Follow the existing code style
- Add appropriate comments
- Write tests for new functionality
- Update documentation if needed

### 3. Commit Guidelines

#### Commit Message Format
```
<type>(<scope>): <description>

<body>

<footer>
```

#### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

#### Examples:
```bash
feat(auth): add login page component
fix(dashboard): resolve chart rendering issue
docs(readme): update installation instructions
test(utils): add unit tests for helper functions
```

### 4. Code Quality Checks

Before committing, run these checks:

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Run tests
npm run test

# Build check
npm run build
```

### 5. Submitting Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat(component): add new feature"

# Push to your fork
git push origin feature/your-feature-name
```

## Pull Request Process

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select base branch: `develop`
4. Select compare branch: `feature/your-feature-name`
5. Fill out the PR template

## Coding Standards

### TypeScript/JavaScript Standards

- Use TypeScript for all new files
- Follow ESLint rules
- Use named exports over default exports
- Keep components focused and reusable

### React Best Practices

1. **Use functional components with hooks**
2. **Keep components small and focused**
3. **Use proper TypeScript types**
4. **Follow the project's folder structure**

### CSS/Styling

- Use the existing styling approach
- Follow BEM naming convention where applicable
- Keep styles modular and reusable

## Testing Guidelines

- Write tests for all new features
- Maintain good test coverage
- Test both happy path and edge cases

## Getting Help

- Check existing issues and documentation
- Open an issue for questions
- Contact maintainers for guidance

Thank you for contributing! 🚀
