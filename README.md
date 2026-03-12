# WebLens MCP

**Web scraping and content extraction MCP server for AI agents.** Renders any URL — including JavaScript-heavy SPAs — with headless Chrome via [Playwright](https://playwright.dev), extracts readable content with [Mozilla Readability](https://github.com/mozilla/readability), downloads images locally, and returns a clean markdown file. Works with Claude, Claude Code, Cursor, Copilot, VS Code, Codex, and any MCP-compatible client.

> `npx -y weblens-mcp` — zero config, just add your Chrome path and go.

### Key Features

- **Single tool** — one `fetch_page` call does everything: render, extract, download, return
- **Markdown output** — returns a local `.md` file path with images embedded as local paths
- **Article extraction** — uses [Mozilla Readability](https://github.com/mozilla/readability) for clean content
- **Asset download** — page images are downloaded to a local tmp directory automatically
- **Auto cleanup** — downloaded files are purged after 6 hours

### Requirements

- Node.js 20 or newer
- Chrome or Chromium installed on the system

### Getting started

**Standard config** works in most MCP clients:

```json
{
  "mcpServers": {
    "weblens": {
      "command": "npx",
      "args": ["-y", "weblens-mcp"],
      "env": {
        "CHROMIUM_PATH": "/usr/bin/google-chrome"
      }
    }
  }
}
```

<details>
<summary>Claude Code</summary>

```bash
claude mcp add weblens -- npx -y weblens-mcp
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "weblens": {
      "command": "npx",
      "args": ["-y", "weblens-mcp"],
      "env": {
        "CHROMIUM_PATH": "/usr/bin/google-chrome"
      }
    }
  }
}
```

</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Codex</summary>

Create or edit `~/.codex/config.toml`:

```toml
[mcp_servers.weblens]
command = "npx"
args = ["-y", "weblens-mcp"]

[mcp_servers.weblens.env]
CHROMIUM_PATH = "/usr/bin/google-chrome"
```

</details>

<details>
<summary>Cursor</summary>

Go to `Cursor Settings` → `MCP` → `Add new MCP Server`. Use `command` type with the command `npx -y weblens-mcp`.

</details>

<details>
<summary>VS Code</summary>

```bash
code --add-mcp '{"name":"weblens","command":"npx","args":["-y","weblens-mcp"]}'
```

</details>

### Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `CHROMIUM_PATH` | Path to Chrome/Chromium executable. Auto-detected if not set. | Auto-detect |
| `INSECURE_TLS` | Set to `1` to accept self-signed certificates. | `0` (disabled) |

Auto-detection checks these paths in order:

```
/usr/bin/google-chrome
/usr/bin/google-chrome-stable
/usr/bin/chromium
/usr/bin/chromium-browser
```

### Tool

#### `fetch_page`

Fetch and render a web page. Returns the absolute path to a local markdown file containing the page content with downloaded images embedded as local file paths.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `url` | string | yes | Target page URL |

**Returns:** Absolute path to a `.md` file in the local tmp directory.

**Example response:**

```
/home/user/project/dist/.tmp/weblens/327c3fda87ce286848a574982ddd0b7c7487f816.md
```

**Generated markdown format:**

```markdown
# Page Title

Source: https://example.com/article

> Article excerpt or description

Article body text content...

## Images

![alt text](/home/user/project/dist/.tmp/weblens/abc123.png)
![another image](/home/user/project/dist/.tmp/weblens/def456.jpg)
```

**Behavior:**

- Renders the page with Playwright (headless Chrome)
- Blocks media and font requests for faster loading
- Extracts article content using Mozilla Readability when possible
- Downloads page images (skips icons smaller than 50x50px)
- Writes markdown with local image paths to `dist/.tmp/weblens/`
- Files older than 6 hours are automatically cleaned up

### Local development

```bash
npm install
npm run build
node dist/index.js
```

### How it works

```
URL
 └→ Playwright renders page (headless Chrome)
     └→ Extract title, text, HTML, images from DOM
         └→ Mozilla Readability extracts clean article content
             └→ Download images to dist/.tmp/weblens/
                 └→ Compose markdown with local image paths
                     └→ Write .md file, return path
```

### Tmp directory

Downloaded assets and markdown files are stored in `dist/.tmp/weblens/`. Cleanup runs automatically:

- On every `fetch_page` call (throttled to every 5 minutes)
- Files older than 6 hours (by mtime) are deleted
- No external cron or scheduler needed

### Docker

```json
{
  "mcpServers": {
    "weblens": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--init",
        "-v", "/tmp/weblens:/app/dist/.tmp/weblens",
        "weblens-mcp"
      ]
    }
  }
}
```

### License

ISC
