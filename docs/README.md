# Documentation

This directory contains architectural documentation for the hux.pro codebase.

## Quick Start

| What you want | Read this |
|---------------|-----------|
| Understand the codebase structure | [Architecture Overview](./architecture.md) |
| Understand the design vision | [Design Philosophy](./design-philosophy.md) |
| Implement UI components | [Design System](./design-system.md) |
| Write React code | [React Engineering](./react-engineering.md) |

## Document Map

### Vision & Principles

- **[design-philosophy.md](./design-philosophy.md)** — The "AI-Native OS" aesthetic, dual UI systems, core principles
- **[motion.md](./motion.md)** — Animation philosophy, the "stagger and reshape" pattern

### Architecture & Engineering

- **[architecture.md](./architecture.md)** — Systems vs Services vs Shared pattern, directory structure
- **[react-engineering.md](./react-engineering.md)** — React Compiler usage, effects, TanStack Query patterns

### Implementation

- **[design-system.md](./design-system.md)** — Typography, colors (OKLCH), spacing, component patterns
- **[content-system.md](./content-system.md)** — MDX pipeline, bilingual content handling

### Feature Systems

| System | Documentation | Purpose |
|--------|---------------|---------|
| Ambient | [ambient-system.md](./ambient-system.md) | Weather/location/time-based UI |
| Command | [navigation.md](./navigation.md) | Command palette and keyboard navigation |
| Devtool | [devtool.md](./devtool.md) | Debug panel for testing ambient states |

### Reference & Testing

- **[typography-test.en.mdx](./typography-test.en.mdx)** — Typography verification (English)
- **[typography-test.zh.mdx](./typography-test.zh.mdx)** — Typography verification (Chinese)

### Meta

- **[vibing-notes.md](./vibing-notes.md)** — Notes on AI-assisted development practices (WIP)

## Conventions

### File Naming

- `[feature]-system.md` — Comprehensive feature documentation (product + technical)
- `[topic].md` — Topical documentation (design, engineering, etc.)

### Document Structure

Each system doc follows this structure:
1. Overview with directory tree
2. Key concepts and types
3. Component descriptions
4. Hook interfaces
5. Data flow diagrams
6. Key files table

### Cross-References

Documents reference each other with relative links:
```markdown
See [Architecture Overview](./architecture.md) for the full structure.
```
