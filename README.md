# TALOS Core

**The Automaton for Local Operations and Search** — a persistent second brain for Claude.

TALOS gives Claude persistent memory across sessions via an Obsidian vault. The CLI manages the brain infrastructure (indexing, embedding, linking). The [marketplace plugins](https://github.com/dukesmith0/talos-marketplace) teach Claude how to use it.

## Quick Start

### 1. Install TALOS Core

```bash
git clone https://github.com/dukesmith0/talos-core.git
cd talos-core
npm install && npm run build && npm link
```

### 2. Create Your Brain

```bash
talos setup
```

Walks you through: vault location, name, description, current focus. Creates the `_brain/` infrastructure, QMD search index, and git repo.

### 3. Connect to Claude Code

```bash
# Add the TALOS marketplace
claude plugin marketplace add dukesmith0/talos-marketplace

# Install the core brain plugin (recommended for everyone)
# Then browse /plugin in Claude Code to install others
```

### 4. Verify

```bash
talos health    # Should show all green
```

Start a new Claude Code session — the SessionStart hook loads your profile, priorities, and pinned memories automatically.

---

## With Claude — Plugin Ecosystem

TALOS is the brain. Plugins teach Claude how to use it. Install via the marketplace:

```
claude plugin marketplace add dukesmith0/talos-marketplace
```

Then install individual plugins from within Claude Code:

| Plugin | What it adds | Install |
|--------|-------------|---------|
| **talos-base** | Core memory: ask, recall, remember, reflect, fix, search, capture. SessionStart/End hooks for automatic context loading and saving. **Start here.** | `/plugin install talos-base` |
| **talos-code** | Dev workflow: plan → go → review → simplify → risks. `.talos/` project framework with plan, bugs, decisions, debug scripts. | `/plugin install talos-code` |
| **talos-thoughts** | Thinking: brainstorm (SCAMPER), Socratic walkthrough, idea evaluation, deep research. Results saved to vault. | `/plugin install talos-thoughts` |
| **talos-study** | Learning: Socratic tutoring, Feynman technique, proficiency tracking (0-4 scale), course management. | `/plugin install talos-study` |
| **talos-career** | Career: job fit scoring (3 dimensions), interview prep, contact management, follow-up tracking. | `/plugin install talos-career` |

---

## Example Workflows

### Brainstorming Business Ideas (talos-base + talos-thoughts)

```
You: /talos-storm SaaS ideas for developer tools

Claude: [Searches vault for existing brainstorms on dev tools]
        [Reads profile.md for your background]

        Phase 1 — Generation (10+ ideas, no filtering):
        1. AI-powered code review bot...
        2. Documentation auto-generator...
        ...

        Phase 2 — Scoring:
        | Idea | Feasibility | Impact | Novelty | Effort | Total |
        |------|-------------|--------|---------|--------|-------|
        | ...  | 4           | 5      | 3       | 4      | 16    |

        Phase 3 — Top 3 refined with implementation steps.

        [Saves brainstorm to vault with frontmatter + wikilinks]
        [Logged to daily note: "14:32 — storm: SaaS ideas for dev tools"]
```

### Coding with Project Memory (talos-code)

```
You: /talos-init
Claude: [Detects TypeScript project from package.json]
        [Creates .talos/ with plan.md, bugs.md, decisions.md, risks.md]
        [Creates .talos/debug/ with test-typescript.ts]
        [Generates CLAUDE.md with tech stack and build commands]
        [Registers project in vault]

You: /talos-plan Add user authentication with JWT
Claude: [Searches vault for past auth implementations]
        [Decomposes into 8 checklist items in .talos/plan.md]

You: /talos-go
Claude: [Reads plan item 1: "Set up JWT middleware"]
        [Implements, tests, updates debug scripts]
        [Marks [x], commits: "feat: add JWT middleware"]
        [Logged to daily note: "15:01 — go: completed 'Set up JWT middleware'"]
        "Completed 1/8 items. Next: Create user registration endpoint"

You: /talos-review
Claude: [Runs git diff, checks for security issues]
        [References vault code standards]
        "2 warnings: missing rate limiting on login endpoint, JWT secret
         should use env var not hardcoded string."
```

### Daily Note-Taking (talos-base)

```
You: /talos-log Had a great meeting with Sarah about the API redesign

Claude: [Appends to journal/2026/03/2026-03-18.md]
        "Logged: Had a great meeting with Sarah about the API redesign"
        [Auto-linked [[Sarah]] from entity registry]

You: /talos-remember Sarah prefers REST over GraphQL for internal APIs

Claude: [Reads schemas.yaml → type: preference]
        [Checks for contradictions — none found]
        [Writes preference note with frontmatter]
        [Runs talos link → adds [[Sarah]] wikilink]
        "Remembered. Saved as preference in vault."

You: /talos-recall Sarah
Claude: [Reads link-index → Sarah links to: API redesign, Google, React]
        [Reads word-freq → "sarah" in 8 docs]
        [QMD query → top 5 results]
        [Reads access-log → last accessed yesterday]

        "Here's what I know about Sarah:
         - Contact: career/networking/sarah.md (met at GDG meetup)
         - Preferences: prefers REST over GraphQL
         - Mentioned in: API redesign notes, Google project, 3 daily notes
         - Last discussed: yesterday
         - Follow-up: none scheduled"
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `talos setup` | First-run onboarding: create vault, config, QMD index |
| `talos health` | Check dependencies, vault integrity, brain status |
| `talos update` | Reindex + embed + rebuild link-index + word-freq |
| `talos sync` | Git pull + push vault |
| `talos vault` | Print vault path |
| `talos link <file>` | Scan file for entities, add [[wikilinks]] |
| `talos index` | Build link graph + tag index |
| `talos wordfreq` | Build term frequency index |
| `talos template` | Manage vault templates |

---

## Brain Architecture

### Memory Systems

| System | Storage | How It Works |
|--------|---------|-------------|
| **Working Memory** | Context window + `_brain/crash-buffer.md` | SessionStart hook loads profile, priorities, pinned, crash buffer. Persists open threads between sessions. |
| **Episodic Memory** | `journal/YYYY/MM/YYYY-MM-DD.md` | Auto-log entries track every action with timestamps. Compressed into weekly summaries by `/talos-reflect`. |
| **Semantic Memory** | Vault `.md` files with typed frontmatter | Schemas: fact, episode, preference, reference, contact. Structured for reliable retrieval. |
| **Procedural Memory** | Skills (SKILL.md) + agents | 41 skills across 5 plugins. Agents handle specialized sub-tasks. |
| **Identity** | `_brain/profile.md` | Always loaded at session start. Name, role, preferences, background. |
| **Pinned Memory** | `_brain/pinned/*.md` | User-controlled permanent context. Loaded every session. |

### Retrieval

| Tool | Purpose |
|------|---------|
| `_brain/link-index.yaml` | Association graph — follow connections without searching |
| `_brain/word-freq.txt` | Topic coverage — guides search strategy |
| `_brain/access-log.txt` | Recency — weight recently accessed files higher |
| QMD BM25 / Vector / Hybrid | Keyword, semantic, and combined search via MCP |

### Consolidation

| Process | Trigger | What It Does |
|---------|---------|-------------|
| Reflection | `/talos-reflect` | Compress dailies → weeklies. Promote recurring topics to notes. Surface knowledge gaps. |
| Gap detection | Automatic (hooks) | 0-result searches logged to `_brain/gaps.txt`. Surfaced during reflection. |
| Contradiction detection | `/talos-remember` | Check existing notes before storing. Flag conflicts. |
| Brain update | `talos update` / SessionEnd hook | Rebuild QMD index, embeddings, link-index, word-freq. |

---

## Vault Structure

```
vault/
  _brain/                  # Brain infrastructure (auto-managed)
    profile.md             # Identity (always loaded)
    priorities.md          # Current focus (always loaded)
    pinned/                # Always-loaded memories
    schemas.yaml           # Memory type definitions
    link-index.yaml        # Association graph (auto)
    word-freq.txt          # Term frequency (auto)
    access-log.txt         # Read history (auto)
    search-log.txt         # Query history (auto)
    gaps.txt               # Knowledge gaps (auto)
    conflicts.md           # Contradictions (auto)
    changelog.md           # Changes (auto)
    crash-buffer.md        # Open threads
    state.yaml             # Session state
  _templates/              # Note templates (user-editable)
  journal/                 # Episodic memory
  (your folders)/          # Free structure
```

## Obsidian Setup

Download Obsidian: [https://obsidian.md/download](https://obsidian.md/download)

Open Obsidian → "Open folder as vault" → point to your vault directory.

### Recommended Plugins

Install from Obsidian Settings → Community Plugins:

| Plugin | Why |
|--------|-----|
| **Dataview** | Query notes by frontmatter (type, tags, dates). Essential for structured memory. |
| **Templater** | Use `_templates/` for new notes. Set template folder to `_templates`. |
| **Calendar** | Navigate daily notes visually. Works with `journal/YYYY/MM/` structure. |
| **Obsidian Git** | Auto-backup vault to GitHub. Set: 10 min auto-backup, pull on startup disabled. |
| **QuickAdd** | Rapid note capture with templates and macros. |
| **Graph View** (built-in) | Visualize your brain's link network. Already included in Obsidian. |

### Optional Plugins

| Plugin | Why |
|--------|-----|
| **3D Graph** (Apoo711) | 3D visualization of your knowledge graph |
| **Kanban** | Visual board for project planning alongside `.talos/plan.md` |
| **Excalidraw** | Diagrams and sketches stored in vault |

### Configuration Tips

- **Obsidian Git**: Auto-backup interval: 10 min. Commit message: `vault auto-backup`. Disable pull on startup (TALOS handles sync).
- **Templater**: Template folder: `_templates`. Enable folder templates for auto-applying templates.
- **Excluded folders**: Add `_brain` to excluded files in Settings → Files & Links (keeps system files out of graph view).

## License

MIT
