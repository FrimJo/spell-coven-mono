---
description: Use Chrome DevTools MCP server for browser automation and testing
---

# Chrome DevTools MCP Server Workflow

This workflow guides you through using the chrome-devtools MCP server for browser automation, testing, and debugging.

## Prerequisites

- Chrome DevTools MCP server must be configured and running
- Browser instance should be available

## Workflow Steps

### 1. List Available Pages

Start by checking what browser pages are currently open:

```
Use mcp0_list_pages to see all open browser tabs
```

### 2. Create or Select a Page

Either create a new page or select an existing one:

```
- To create new: mcp0_new_page with the target URL
- To select existing: mcp0_select_page with the page index
```

### 3. Take a Snapshot

Before interacting, take a text snapshot to understand the page structure:

```
Use mcp0_take_snapshot to get page elements with UIDs
Always prefer snapshots over screenshots for actions
```

### 4. Interact with Elements

Use the UIDs from the snapshot to interact with elements:

```
- Click: mcp0_click with element UID
- Fill forms: mcp0_fill or mcp0_fill_form with UIDs and values
- Type text: mcp0_fill with UID and value
- Hover: mcp0_hover with UID
- Select options: mcp0_fill with UID for <select> elements
```

### 5. Navigate and Wait

Control page navigation and timing:

```
- Navigate: mcp0_navigate_page with URL
- Wait for content: mcp0_wait_for with text to appear
- Go back: mcp0_navigate_page_history with "back"
```

### 6. Inspect Results

Check console messages and network activity:

```
- Console: mcp0_list_console_messages
- Network: mcp0_list_network_requests
- Specific request: mcp0_get_network_request with URL
```

### 7. Performance Analysis (Optional)

For performance testing:

```
1. Start trace: mcp0_performance_start_trace
2. Perform actions on the page
3. Stop trace: mcp0_performance_stop_trace
4. Analyze insights: mcp0_performance_analyze_insight
```

### 8. Take Screenshots (When Needed)

For visual verification:

```
Use mcp0_take_screenshot (optionally with element UID)
Note: Prefer snapshots for actions, screenshots for visual verification
```

## Best Practices

- **Always take a snapshot first** before interacting with elements
- **Use the latest snapshot** - UIDs may change after page updates
- **Check console messages** if something doesn't work as expected
- **Wait for dynamic content** using mcp0_wait_for before interacting
- **Handle dialogs** with mcp0_handle_dialog if they appear
- **Clean up** by closing unnecessary pages with mcp0_close_page

## Common Patterns

### Form Filling
```
1. Take snapshot
2. Identify form field UIDs
3. Use mcp0_fill_form with all fields at once
```

### Testing User Flows
```
1. Navigate to start page
2. Take snapshot
3. Click through flow using UIDs
4. Verify with snapshots and console messages
```

### Debugging Issues
```
1. Take snapshot to see current state
2. Check console messages for errors
3. Review network requests for failed calls
4. Take screenshot for visual confirmation
```

## Troubleshooting

- **Element not found**: Take a fresh snapshot, UIDs may have changed
- **Action not working**: Check console messages for JavaScript errors
- **Slow page**: Use mcp0_wait_for to ensure content is loaded
- **Dialog blocking**: Use mcp0_handle_dialog to accept/dismiss
