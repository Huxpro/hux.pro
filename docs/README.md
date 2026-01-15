# Documentation Index

Welcome to the Hux.Pro documentation. This directory contains comprehensive technical documentation for the codebase.

## Quick Navigation

### Architecture & Design

- **[Architecture Overview](./architecture.md)** - System structure, directory layout, and design principles
- **[Design Philosophy](./design-philosophy.md)** - AI-Native OS aesthetic, dual aesthetic system, core principles
- **[Design System](./design-system.md)** - Typography, colors, spacing, components, and styling conventions
- **[Motion & Animation](./motion.md)** - Animation philosophy and implementation patterns

### Systems Documentation

Systems are complex subsystems that bundle UI, state management, and logic:

- **[Ambient System](./system-ambient.md)** - Weather-based ambient UI with location, time phases, and gradients
- **[Command System](./system-command.md)** - Keyboard-first navigation with command palette
- **[Devtool System](./system-devtool.md)** - Developer tools for debugging ambient state

### Feature Documentation

- **[Navigation System](./navigation.md)** - Command trigger, command palette, and page structure
- **[Content System](./content-system.md)** - Bilingual MDX content, blog posts, and static generation

### Engineering Practices

- **[React Engineering](./react-engineering.md)** - React patterns, hooks, state management, and provider architecture
- **[Vibing Notes](./vibing-notes.md)** - _Draft notes_ on AI-assisted development practices (work in progress)

## Document Organization

### System Documentation Structure

Each system document follows a consistent structure:

1. **Product Design** - User experience, features, visual design
2. **Technical Architecture** - File structure, data flow, state management
3. **Components** - UI components and their usage
4. **API Reference** - Hooks, contexts, and their interfaces

### Naming Conventions

- `system-*.md` - System documentation (ambient, command, devtool)
- Other descriptive names for cross-cutting concerns (architecture, design-system, content-system, etc.)

## For AI Assistants

If you're an AI assistant working on this codebase:

1. **Start with** [architecture.md](./architecture.md) to understand the overall structure
2. **Refer to** system-specific docs when working on features
3. **Follow conventions in** [react-engineering.md](./react-engineering.md)
4. **Match styling from** [design-system.md](./design-system.md)

## Contributing to Docs

When adding new documentation:

1. Follow the established structure for similar documents
2. Use clear headings and consistent formatting
3. Include diagrams for complex concepts
4. Cross-reference related documents
5. Update this index when adding new files
