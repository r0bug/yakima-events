---
name: testwithclaude
description: Generate a comprehensive test prompt for the Claude Chrome plugin to test a specific feature
---

# Test with Claude Chrome Plugin

This skill generates a detailed testing prompt that you can copy and paste into the Claude Chrome plugin to have it thoroughly test a specific feature on the live site.

## Instructions for Claude

When this skill is invoked with a feature name or description, generate a comprehensive testing prompt following this format:

### Step 1: Understand the Feature

If the user provides a feature name, search the codebase to understand:
- What the feature does
- Where it's located in the UI
- What user interactions are involved
- What the expected behavior should be
- Any edge cases or error states

### Step 2: Generate the Test Prompt

Output a formatted prompt block that the user can copy directly. The prompt should:

1. **Set Context**: Tell the Claude Chrome plugin what it's testing
2. **Provide Navigation**: How to get to the feature
3. **List Test Cases**: Specific things to test
4. **Define Success Criteria**: What "working" looks like
5. **Request Structured Report**: How to report findings

### Prompt Template

Generate a prompt following this structure:

```
=== CLAUDE CHROME PLUGIN TEST PROMPT ===
Copy everything below this line:
---

# Feature Test: [FEATURE NAME]

You are testing the [FEATURE NAME] feature on YFEvents. Please perform a thorough test and report your findings.

## Site Context
- URL: https://yfevents.yakimafinds.com (or current URL if already on site)
- Admin panel available at /admin
- Communication hub at /communication

## Navigation
[Specific steps to reach the feature, e.g.:]
1. Click on [menu item] in the header
2. Navigate to [specific page]
3. Look for [specific element]

## Test Cases

### Basic Functionality
- [ ] [Test case 1 - describe what to do and what should happen]
- [ ] [Test case 2]
- [ ] [Test case 3]

### User Interactions
- [ ] [Click/hover/input tests]
- [ ] [Form submission tests]
- [ ] [Navigation tests]

### Edge Cases
- [ ] [Empty state test]
- [ ] [Error handling test]
- [ ] [Boundary condition test]

### Visual/UI Checks
- [ ] [Layout check]
- [ ] [Responsive behavior]
- [ ] [Styling consistency]

## Success Criteria
- [What indicates the feature is working correctly]
- [Expected visual appearance]
- [Expected behavior after actions]

## Report Format

Please report your findings in this format:

### Test Results Summary
- **Overall Status**: [PASS/FAIL/PARTIAL]
- **Tests Passed**: X/Y
- **Critical Issues**: [Yes/No]

### Detailed Findings

#### Working Correctly:
- [List what works]

#### Issues Found:
- **Issue 1**: [Description]
  - Steps to reproduce: [Steps]
  - Expected: [What should happen]
  - Actual: [What actually happened]
  - Severity: [Critical/High/Medium/Low]

#### Screenshots/Evidence:
[Describe any visual evidence of issues]

### Recommendations
- [Suggested fixes or improvements]

---
=== END OF PROMPT ===
```

## Feature-Specific Templates

### For Communication Hub:
Focus on:
- Channel creation and listing
- Message posting and display
- Participant management
- Notification indicators
- Real-time updates

### For Event Scraper Admin:
Focus on:
- Source listing and management
- Scraper test functionality
- Intelligent scraper interface
- Log viewing

### For Shop Directory:
Focus on:
- Shop listing and filtering
- Map integration
- Shop details view
- Category filtering

### For Social Sharing:
Focus on:
- Share button appearance
- Share menu dropdown
- Copy link functionality
- Share link URL structure

### For Admin Panels:
Focus on:
- Data table display
- Filtering and search
- CRUD operations
- Bulk actions

## Usage Examples

```
/testwithclaude communication channels
```
Generates a prompt to test the Communication Hub channel features.

```
/testwithclaude event scraper
```
Generates a prompt to test the scraper admin interface.

```
/testwithclaude shop directory map
```
Generates a prompt to test the shop directory with map view.

```
/testwithclaude "share button on events"
```
Generates a prompt to test social sharing for events.

## YFEvents-Specific Context

### Key Routes to Test
| Area | Routes |
|------|--------|
| Events | `/`, `/calendar`, `/map`, `/api/events` |
| Shops | `/shops`, `/shops/[id]`, `/api/shops` |
| Communication | `/communication`, `/communication/[id]` |
| Admin | `/admin/*` |
| Scraper | `/admin/scrapers`, `/admin/scrapers/intelligent` |

### API Endpoints
- Events: `/api/events`, `/api/events/today`, `/api/events/nearby`
- Shops: `/api/shops`, `/api/shops/nearby`
- Communication: `/api/communication/channels`, `/api/communication/notifications`
- Social: `/api/events/[id]/share`, `/api/shops/[id]/share`

## Output Format

Always output the prompt in a code block so the user can easily copy it. Include:
1. A brief explanation of what will be tested
2. The full prompt in a copyable format
3. Any additional context the user should know
