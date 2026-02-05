---
name: push2git
description: Examine codebase, update documentation, then commit and push to GitHub
---

# Push to Git with Documentation Update

This skill performs a complete documentation audit and git workflow:
1. Examines the codebase for recent changes
2. Updates documentation files (README.md, CLAUDE.md)
3. Commits with a descriptive message
4. Pushes to GitHub
5. Restarts the PM2 process

## Instructions for Claude

When this skill is invoked, follow these steps IN ORDER:

### Step 1: Analyze Recent Changes

First, gather context about what has changed:

```bash
cd /home/robug/yakima
git status
git diff --stat HEAD~5 HEAD 2>/dev/null || git diff --stat
git log --oneline -10
```

Identify:
- New files added
- Modified files
- New features implemented
- Database schema changes (schema.ts)
- API endpoint changes
- UI/component changes

### Step 2: Read Current Documentation

Read these documentation files to understand their current state:
- `README.md` - Project overview (if exists)
- `CLAUDE.md` - Project context and documentation

### Step 3: Identify Documentation Gaps

Compare the codebase changes against the documentation:
- Are new features documented?
- Are new database tables documented in CLAUDE.md?
- Are new API endpoints documented?
- Are new routes/pages mentioned?

### Step 4: Update Documentation Files

For each documentation file that needs updates:

**CLAUDE.md Updates:**
- Update the Quick Reference if needed
- Add new tables to the "Tables Used by This App" section
- Add new API endpoints
- Add new routes/pages
- Update any deployment information

**README.md Updates (if exists):**
- Update feature descriptions
- Update tech stack if changed

### Step 5: Stage and Review Changes

```bash
git status
git diff --stat
```

Show the user what will be committed.

### Step 6: Create Commit

Create a descriptive commit message. If there are documentation updates:

```bash
git add -A
git commit -m "$(cat <<'EOF'
[summary of changes]

[bullet points of specific changes]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

If there are no changes to commit, inform the user.

### Step 7: Push to GitHub

```bash
git push origin main
```

### Step 8: Restart Application

```bash
npm run build && pm2 restart yakima-events
```

Report success with the commit hash.

## Usage Examples

```
/push2git
```
Examines codebase, updates docs, commits, pushes, and restarts.

```
/push2git "Added communication hub"
```
Same as above, but uses the provided message context for commit.

## Key Files to Check

When examining the codebase, pay special attention to:

| File Pattern | Documentation Target |
|--------------|---------------------|
| `src/lib/server/db/schema.ts` | CLAUDE.md (Tables section) |
| `src/routes/api/**` | CLAUDE.md (API Endpoints) |
| `src/lib/components/*.svelte` | CLAUDE.md (UI Components) |
| `src/lib/server/services/**` | CLAUDE.md (Services) |
| `src/routes/**` | CLAUDE.md (Routes) |

## Safety Rules

1. NEVER commit secrets, API keys, or credentials
2. NEVER force push to main/master
3. ALWAYS show user what will be committed before committing
4. If uncertain about changes, ASK the user before proceeding
5. ALWAYS run `npm run build` to verify before deploying

## Error Handling

If any step fails:
1. Report the error clearly
2. Do NOT proceed with subsequent steps
3. Suggest how to fix the issue
4. Offer to retry after the user resolves the problem
