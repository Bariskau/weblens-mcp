# WebLens MCP

**Web scraping and content extraction MCP server for AI agents.** Renders any URL — including JavaScript-heavy SPAs — with headless Chromium via [Playwright](https://playwright.dev), extracts readable content with [Mozilla Readability](https://github.com/mozilla/readability), captures the page's navigation links, downloads images locally, and returns a clean markdown file. Works with Claude, Claude Code, Cursor, Copilot, VS Code, Codex, and any MCP-compatible client.

> `npx -y weblens-mcp` — runs as a local **stdio** MCP server. Playwright downloads its own Chromium on install, so there's nothing else to set up.

### Key Features

- **Single tool** — one `fetch_page` call does everything: render, extract, download, return
- **Bundled browser** — Chromium is auto-installed by Playwright; no system Chrome required
- **Markdown output** — returns a local `.md` file path with images embedded as local paths
- **Article extraction** — uses [Mozilla Readability](https://github.com/mozilla/readability) for clean content
- **Navigation links** — captures the site's menu/sidebar/header links (same-site, deduped)
- **Asset download** — page images are downloaded to a local tmp directory automatically
- **Auto cleanup** — downloaded files are purged after 6 hours

### Requirements

- Node.js 20 or newer

That's it. On install, Playwright downloads a matching Chromium build automatically (~90 MB, cached globally and reused across projects). No system Chrome needed.

### Browser

You normally don't need to do anything — Chromium is downloaded on `npm install` / first `npx`. If the automatic download was skipped (offline, firewall, or `--ignore-scripts`), you have two options:

```bash
# 1. Install the bundled browser manually with the Playwright CLI
npx playwright install chromium
```

```bash
# 2. Or point WebLens at a Chrome/Chromium you already have
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

If `CHROMIUM_PATH` is unset and the bundled browser is missing, WebLens also falls back to any Chrome/Chromium/Edge found in standard OS install locations.

### Getting started

**Standard config** works in most MCP clients (no environment variables needed — Chromium is bundled):

```json
{
  "mcpServers": {
    "weblens": {
      "command": "npx",
      "args": ["-y", "weblens-mcp"]
    }
  }
}
```

> Add an `"env": { "CHROMIUM_PATH": "..." }` block only to use a specific browser instead of the bundled Chromium.

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
      "args": ["-y", "weblens-mcp"]
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

# Optional — only to override the bundled Chromium:
# [mcp_servers.weblens.env]
# CHROMIUM_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
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
| `CHROMIUM_PATH` | Override the browser. By default WebLens uses Playwright's bundled Chromium; set this to use a specific Chrome/Chromium/Edge executable. | Bundled Chromium |
| `INSECURE_TLS` | Set to `1` to accept self-signed certificates. | `0` (disabled) |

**Browser resolution order:** `CHROMIUM_PATH` (if set) → Playwright's bundled Chromium → a system Chrome/Chromium/Edge found in standard OS install locations (`/Applications/...` on macOS, `C:\Program Files\...` on Windows, `/usr/bin/...` on Linux).

### Tool

#### `fetch_page`

Fetch and render a web page. Returns the absolute path to a local markdown file containing the page content with downloaded images embedded as local file paths.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `url` | string | yes | Target page URL |

**Returns:** Absolute path to a `.md` file in the system temp directory.

**Example response:**

```
/var/folders/lp/.../T/weblens-mcp/327c3fda87ce286848a574982ddd0b7c7487f816.md
```

**Generated markdown format:**

```markdown
# Page Title

Source: https://example.com/article

> Article excerpt or description

Article body text content...

## Navigation

- [Docs](https://example.com/docs)
- [Pricing](https://example.com/pricing)
- [Blog](https://example.com/blog)

## Images

![alt text](/var/folders/lp/.../T/weblens-mcp/abc123.png)
![another image](/var/folders/lp/.../T/weblens-mcp/def456.jpg)
```

**Behavior:**

- Renders the page with Playwright (headless Chromium)
- Blocks media and font requests for faster loading
- Extracts article content using Mozilla Readability when possible
- Captures navigation links from `nav`/`header`/`aside`/menu regions (same-site, deduped, up to 50)
- Downloads page images (skips icons smaller than 50x50px)
- Writes markdown with local image paths to the system temp dir (`<os-tmp>/weblens-mcp/`)
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
 └→ Playwright renders page (headless Chromium)
     └→ Extract title, text, HTML, images, navigation links from DOM
         └→ Mozilla Readability extracts clean article content
             └→ Download images to <os-tmp>/weblens-mcp/
                 └→ Compose markdown with local image paths
                     └→ Write .md file, return path
```

### Tmp directory

Downloaded assets and markdown files are stored in your system temp directory under `weblens-mcp/` (e.g. `/tmp/weblens-mcp/` on Linux, `/var/folders/.../T/weblens-mcp/` on macOS). Cleanup runs automatically:

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
        "-v", "/tmp/weblens-mcp:/tmp/weblens-mcp",
        "weblens-mcp"
      ]
    }
  }
}
```

### License

ISC
