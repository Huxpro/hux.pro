# Navigation System

## Command Trigger

The **Command Trigger** is a unified floating component that provides consistent access to the command palette across all pages. It morphs between three states based on context and screen size:

```
Mobile (non-home)     Desktop (non-home)      Homepage (any)
+---------+           +-------------+         +---------------------------+
|   ⌘     |  <--->    |  ⌘K         |  <--->  | 🔍  Search...     [⌘K]   |
+---------+           +-------------+         +---------------------------+
   FAB                   Pill                   Conversational Prompt
```

### State Determination

| Screen | Page | Variant | Position |
|--------|------|---------|----------|
| Mobile | Homepage | Prompt (compact) | Bottom center |
| Mobile | Other | FAB (circle) | Bottom right |
| Desktop | Homepage | Prompt (full) | Bottom center |
| Desktop | Other | Pill | Bottom right |

### Design Decisions

#### Unified Component
Previously, the FAB and Conversational Prompt were separate components with different styles and positions. The new unified approach:
- Uses a single `FloatingActionButton` component
- Shares the same glass styling across all states
- Animates smoothly between states during navigation

#### Glass Styling
All variants share the "frosted glass" aesthetic:

```tsx
"bg-card/50 backdrop-blur-xl",
"border border-border/50",
"shadow-lg shadow-black/5"
```

#### Animation Strategy
The morph uses Framer Motion's `layout` prop with staggered content transitions:

1. **Exit Phase**: Text content fades out first (opacity + x-translation)
2. **Reshape Phase**: Container morphs size/position (layout animation)
3. **Enter Phase**: New content fades in after reshape completes

This "stagger and reshape" approach ensures:
- Smooth contour continuity (no border-radius clipping)
- Content doesn't overflow during transition
- Stable animation origin point

#### Consistent Height
All states maintain `h-12` (48px) height to eliminate vertical jitter during transitions.

#### Responsive Text

| State | Mobile | Desktop |
|-------|--------|---------|
| Homepage | "Search" | "Search or / for commands" |
| Other | ⌘ icon only | ⌘K |

### Interaction States

- **Homepage (Prompt)**: Focus ring effect (`focus:ring-2`) — feels like an input field
- **Other pages (FAB/Pill)**: Scale effect (`active:scale-95`) — feels like a button

## Command Palette

The command palette is the central navigation hub, inspired by Raycast, Spotlight, and VS Code. It is dual-purpose: universal search **and** an app launcher (horizontal icon strip — see [Command System](./system-command)).

### Opening Methods

| Method | Where | Action |
|--------|-------|--------|
| `⌘K` / `Ctrl+K` | Anywhere | Open in **Search Mode** |
| `/` (anywhere) | Anywhere | Open in **Slash Commands** |
| Conversational prompt | Homepage | Open in Search Mode |
| FAB button | Non-homepage pages | Open in Search Mode |

### Homepage Entry Point

On the homepage, the Command Trigger expands into a **conversational prompt**—a wide button styled as a search input with the placeholder "Search" (mobile) or "Search or / for commands" (desktop). This creates a more inviting, dialogue-like entry point that fits the AI-native OS aesthetic.

When navigating away from the homepage, the prompt smoothly morphs into a compact FAB (mobile) or pill (desktop) positioned in the bottom-right corner.

### Two Modes

The command palette has two distinct modes that morph smoothly between each other:

#### Search Mode (Default)
- Full-text search across pages, posts, and talks
- Arrow keys to navigate, Enter to select
- Shows all content with descriptions
- Width: 600px

#### Slash Commands
- Single-letter shortcuts for immediate actions
- No search input—just press a letter
- Minimal UI showing only available actions
- Width: 400px

### Keyboard Shortcuts

#### In Search Mode

When the search input is empty or unfocused:

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `U` | Go to Writing |
| `X` | Go to Works |
| `P` | Go to Prompts |
| `I` | Go to Docs (internal) |
| `D` | Toggle Dark/Light mode |
| `L` | Toggle Language |
| `/` | Switch to Slash Commands |
| `Esc` | Close palette |

#### In Slash Commands

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `U` | Go to Writing |
| `X` | Go to Works |
| `P` | Go to Prompts |
| `I` | Go to Docs (internal) |
| `E` | Go to Editor |
| `A` | Cycle Appearance (system → dark → light) |
| `L` | Toggle Language |
| `O` | Toggle geolOcation (IP ↔ accurate) |
| `W` | Open the Wallpaper picker |
| `G` | Toggle Glass material (Tinted ↔ Clear) |
| `M` | Play / pause Music |
| `Q` | Open the playlist browser |
| `D` | Toggle the Devtool panel |
| `⌫` (Backspace) | Back to Search Mode |
| `Esc` | Close palette |

### Design Decisions

#### Why Two Modes?

1. **Avoid browser conflicts**: `⌘D`, `⌘L`, `⌘H` conflict with browser shortcuts
2. **Separation of concerns**: Search is for discovery; actions are for execution
3. **Progressive disclosure**: Beginners use search; power users use actions

#### Why `/` for Slash Commands?

- Familiar from Vim, Slack, Discord
- Single non-modifier key for quick access
- Doesn't conflict with search (handled as first character)

#### Morphing Transition

Instead of opening/closing between modes, the palette **morphs**:
- Width animates (600px ↔ 400px)
- Content crossfades with opacity
- Height animates using CSS Grid (`grid-template-rows: 0fr/1fr`)

### Footer Hints

**Search Mode:**
```
↑↓ navigate   ↵ select   / commands         ⌘K
```

**Slash Commands:**
```
⌫ back                                       /
```

## Page Structure

Each page follows a consistent pattern:

1. **Back link** (top-left): Returns to parent page
2. **Header**: Title + subtitle
3. **Content area**: Main page content
4. **No fixed navigation**: Command palette replaces traditional nav

### PageLayout Component

Content pages (prose, log, prompt, docs) share a common layout structure via the `PageLayout` component. PageLayout is used at the **app router level** (in page views), not within reusable components.

```tsx
// app/writing/blog-list.tsx (app router level)
<PageLayout page="writing">
  <PostList posts={posts} basePath="/writing" />
</PageLayout>
```

**Structure:**
```
┌─────────────────────────────────────────┐
│  max-w-[680px] px-6 pt-24 pb-32         │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ SystemNav (mb-16)                   ││
│  │ "λhux" → "cd .." on hover           ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ <header> (mb-20)                    ││
│  │ <h1> serif text-3xl/4xl             ││
│  └─────────────────────────────────────┘│
│                                         │
│  {children}                             │
│                                         │
└─────────────────────────────────────────┘
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Page title displayed in h1 |
| `backHref` | `string` | `"/"` | Back navigation destination |
| `backLabel` | `string` | `"λhux"` | Back navigation label |
| `className` | `string` | - | Additional classes for main |
| `children` | `ReactNode` | required | Page content |

### View Transitions

The site uses the browser's View Transitions API via the `next-view-transitions` library for smooth page-to-page animations.

**Shared Element Mapping:**

```
Home                          Content Pages (using PageLayout)
┌─────────────────┐          ┌─────────────────┐
│  λhux ◄─────────────────────► λhux           │  ← shared element (morphs position)
│  (centered)     │          │  (left-aligned) │
│                 │          │                 │
│  [greeting]     │          │  [page title]   │  ← crossfade
│                 │          │                 │
│  [widgets]      │          │  [content]      │  ← crossfade
└─────────────────┘          └─────────────────┘
```

**Implementation:**

1. **Library Setup** (`next-view-transitions`):
   ```tsx
   // app/layout.tsx
   import { ViewTransitions } from "next-view-transitions";
   
   export default function RootLayout({ children }) {
     return (
       <ViewTransitions>
         <html>...</html>
       </ViewTransitions>
     );
   }
   ```

2. **Link Components** - Use library's Link for navigation:
   ```tsx
   import { Link } from "next-view-transitions";
   
   <Link href="/writing">Blog</Link>
   ```

3. **Programmatic Navigation** - Use `useTransitionRouter`:
   ```tsx
   import { useTransitionRouter } from "next-view-transitions";
   
   const router = useTransitionRouter();
   router.push("/path"); // Triggers view transition
   ```

4. **Shared Elements** - Use `data-view-transition` attribute:
   ```tsx
   // Home page (centered)
   <span data-view-transition="site-identifier">λhux</span>
   
   // Content pages (left-aligned, in SystemNav)
   <span data-view-transition="site-identifier">λhux</span>
   ```

5. **CSS Animations** (`globals.css`):
   ```css
   /* Page content crossfades */
   ::view-transition-old(root) {
     animation: fade-out 200ms ease-out both;
   }
   ::view-transition-new(root) {
     animation: fade-in 200ms ease-out both;
   }
   
   /* Site identifier morphs position */
   [data-view-transition="site-identifier"] {
     view-transition-name: site-identifier;
   }
   ::view-transition-group(site-identifier) {
     animation-duration: 300ms;
     animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
   }
   ```

**How it works:**
- `next-view-transitions` wraps navigation in `document.startViewTransition()`
- Elements with `view-transition-name` become shared elements that morph position/size
- Root content crossfades during transition
- Falls back gracefully in unsupported browsers (instant navigation)

**Browser Support:**
- Chrome 111+, Edge 111+ (full support)
- Safari, Firefox (graceful fallback to instant navigation)

## Mobile Considerations

- **Unified Command Trigger**: Same component morphs between prompt (homepage) and FAB (other pages)
- **Compact prompt on mobile**: Shows only "Search" text instead of the full desktop message
- **FAB position**: Bottom-right corner with consistent `bottom-6 right-6` positioning
- Command palette is responsive (full width on small screens)
- Touch-friendly tap targets (`h-12` minimum)
- Widget grid stacks vertically on mobile
