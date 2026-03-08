---
name: browser-debug
description: Collaborative browser debugging using Chrome DevTools Protocol (CDP) directly, without MCP. Works with user's authenticated browser session.
---

# Collaborative Browser Debugging with Chrome DevTools Protocol

This skill describes how to perform collaborative debugging of browser extensions or web apps using Chrome's remote debugging protocol. This approach is preferred over the Chrome DevTools MCP because it works with the user's existing authenticated browser session and avoids bot detection.

## Prerequisites

The user must launch their browser with remote debugging enabled:

```bash
# Chromium (Flatpak)
flatpak run org.chromium.Chromium --remote-debugging-port=9222

# Chrome (standard install)
google-chrome --remote-debugging-port=9222

# Chrome (macOS)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

## Step 1: Get Debug Target Info

Query the debug HTTP endpoint to list available pages:

```bash
curl -s http://localhost:9222/json | jq '.'
```

This returns targets with their `webSocketDebuggerUrl`. Extract the WebSocket URL for the page you want to debug:

```bash
curl -s http://localhost:9222/json | jq '.[0]'
```

## Step 2: Execute JavaScript in the Browser

Use Node.js with the `ws` package to send CDP commands:

```javascript
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/PAGE_ID_HERE');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: \`
        (function() {
          // Your JavaScript here - wrap in IIFE to avoid variable collisions
          const result = document.title;
          return JSON.stringify({ title: result });
        })()
      \`,
      returnByValue: true
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    console.log(msg.result?.result?.value || JSON.stringify(msg, null, 2));
    ws.close();
  }
});
"
```

**Important**: Always wrap expressions in an IIFE `(function() { ... })()` to avoid "Identifier already declared" errors from previous script executions.

## Step 3: Set Up Console Log Monitoring

Create a persistent console monitor to capture extension logs:

```javascript
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/PAGE_ID_HERE');

ws.on('open', () => {
  // Enable console events
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  console.log('Console monitor started. Press Ctrl+C to stop.');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map(a => a.value || a.description).join(' ');
    const type = msg.params.type;
    console.log(\`[\${type}] \${args}\`);
  }
});

ws.on('error', (err) => console.error('WebSocket error:', err));
ws.on('close', () => console.log('Connection closed'));
"
```

Run this in the background to continuously capture logs:

```bash
node monitor-script.js > /tmp/console.log 2>&1 &
```

Then check logs after user actions:

```bash
tail -50 /tmp/console.log
```

## Step 4: Collaborative Debugging Workflow

1. **Set up monitoring**: Start the console log monitor in the background
2. **Ask user to perform action**: "Please click the Autosubmit button and wait for it to complete"
3. **Check logs**: Read the captured console output to see what happened
4. **Inspect DOM state**: Run JavaScript to query current page state
5. **Make code changes**: Edit the extension code based on findings
6. **Rebuild**: Run `npm run build`
7. **Ask user to reload**: "Please reload the extension and try again"
8. **Repeat**: Continue iterating until the issue is resolved

## Common CDP Commands

### Take a screenshot

```javascript
ws.send(
  JSON.stringify({
    id: 1,
    method: "Page.captureScreenshot",
    params: { format: "png" },
  }),
);
```

### Get page URL

```javascript
ws.send(
  JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: { expression: "window.location.href", returnByValue: true },
  }),
);
```

### Click an element

```javascript
ws.send(
  JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: {
      expression: `document.querySelector('button.my-btn').click()`,
      returnByValue: true,
    },
  }),
);
```

### Query DOM state

```javascript
ws.send(
  JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: {
      expression: `
      (function() {
        return JSON.stringify({
          url: window.location.href,
          title: document.title,
          buttonExists: !!document.querySelector('button.my-btn'),
          inputValue: document.querySelector('input')?.value
        }, null, 2);
      })()
    `,
      returnByValue: true,
    },
  }),
);
```

## Why This Approach Over Chrome DevTools MCP

1. **Avoids bot detection**: Sites like Grok/Twitter detect automation flags set by Puppeteer/Playwright and may block or rate-limit
2. **Uses existing auth**: The user's normal browser has their login cookies and session
3. **No extra dependencies**: Just needs Node.js with the `ws` package (usually already available)
4. **Full control**: Direct access to CDP without MCP abstraction layer

## Troubleshooting

- **"Identifier already declared" errors**: Wrap all expressions in IIFEs
- **WebSocket connection refused**: Ensure browser was launched with `--remote-debugging-port=9222`
- **Can't find page**: Run `curl http://localhost:9222/json` to list available targets
- **Stale page ID**: Page IDs change on navigation; re-query `/json` endpoint
