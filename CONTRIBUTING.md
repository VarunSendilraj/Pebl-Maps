# Contributing to OpenClio

Thank you for your interest in contributing to OpenClio! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're building this together.

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/OpenClio.git
cd OpenClio
```

### 2. Set Up Development Environment

**Python (Pipeline):**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Node.js (Frontend):**
```bash
cd client
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
cp client/.env.example client/.env.local
# Edit both files with your API keys
```

## Development Workflow

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation updates
- `refactor/description` — Code refactoring

### Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes

3. Test your changes:
   ```bash
   # Frontend
   cd client && npm run lint && npm run build
   
   # Python (if applicable)
   python -m pytest  # when tests exist
   ```

4. Commit with clear messages:
   ```bash
   git commit -m "feat: add new visualization mode"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, etc.)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features when possible
3. **Ensure CI passes** (linting, builds)
4. **Request review** from maintainers

### PR Description Template

```markdown
## Summary
Brief description of changes.

## Changes
- Change 1
- Change 2

## Testing
How did you test this?

## Screenshots (if UI changes)
```

## Project Areas

### Pipeline (`pipeline/`)

The data ingestion pipeline processes traces:
- `generate_topics.py` — Topic generation with LLMs
- `embed_topics.py` — Vector embeddings
- `cluster.py` — Hierarchical clustering
- `upsert.py` — Pinecone indexing

**Guidelines:**
- Use type hints
- Follow PEP 8 style
- Add docstrings for public functions
- Handle API errors gracefully with retries

### Frontend (`client/`)

Next.js application with React:
- Components in `src/components/`
- API routes in `src/app/api/`
- Shared types in `src/lib/`

**Guidelines:**
- Use TypeScript strictly (no `any` unless necessary)
- Follow existing component patterns
- Use Tailwind for styling
- Keep components focused and composable

## Feature Ideas

Looking for something to work on? Here are some ideas:

- [ ] Add ChromaDB support as alternative to Pinecone
- [ ] Implement trace export functionality
- [ ] Add more visualization modes (timeline, graph)
- [ ] Create a CLI tool for the pipeline
- [ ] Add authentication/multi-user support
- [ ] Implement trace filtering and search
- [ ] Add unit tests for pipeline modules
- [ ] Create Docker compose setup

## Questions?

- Open a [GitHub Issue](https://github.com/yourusername/OpenClio/issues) for bugs or feature requests
- Start a [Discussion](https://github.com/yourusername/OpenClio/discussions) for questions

## License

By contributing to OpenClio, you agree that your contributions will be licensed under the MIT License.
