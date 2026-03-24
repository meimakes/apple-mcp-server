# Apple Reminders MCP Server

An MCP (Model Context Protocol) server that provides programmatic access to Apple Reminders via SSE (Server-Sent Events) transport. Built for integration with Poke.com and other MCP clients.

## Features

- ✅ Full access to Apple Reminders via EventKit
- ✅ SSE transport for real-time communication
- ✅ API key authentication
- ✅ Rate limiting and security headers
- ✅ Swift-based native macOS integration
- ✅ Comprehensive reminder management (create, read, update, delete, complete)
- ✅ Reminder list management
- ✅ Advanced filtering (by list, date, completion status, search)

## Requirements

- macOS 12.0 or later
- Node.js 18.0 or later
- Swift 5.9 or later (comes with Xcode Command Line Tools)
- npm or yarn

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/meimakes/apple-mcp-server.git
   cd apple-mcp-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Generate API key**

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. **Configure environment**

   Copy `.env.example` to `.env` and add your generated API key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```
   PORT=3000
   API_KEY=your_generated_key_here
   LOG_LEVEL=info
   ```

5. **Build the project**

   ```bash
   npm run build
   ```

   This will:
   - Compile TypeScript to JavaScript
   - Build the Swift binary for EventKit integration

## Usage

### Starting the Server

```bash
npm start
```

The server will start on the configured port (default: 3000) and display:
```
SSE server listening on port 3000
Health check: http://localhost:3000/
SSE endpoint: http://localhost:3000/sse
```

### Setting up ngrok (for remote access)

To make the server accessible from Poke.com or other external services:

```bash
# Install ngrok if you haven't already
brew install ngrok

# Start ngrok tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) for use in Poke.com configuration.

### Configuring Poke.com

1. Go to Poke.com connector settings
2. Add a new MCP connector:
   - **Name:** Apple Reminders
   - **Endpoint URL:** `https://your-ngrok-url.ngrok.io/sse`
   - **API Key:** Your generated API key from `.env`

## Permissions

On first run, the Swift binary will request access to Reminders. You'll see a system prompt:

1. Click "OK" to grant access
2. Alternatively, go to **System Settings > Privacy & Security > Reminders**
3. Ensure the terminal app or the Swift binary has access

## Available Tools

### 1. `list_reminder_lists`

Get all reminder lists.

**Example:**
```json
{}
```

**Returns:**
```json
[
  {
    "id": "...",
    "name": "Personal",
    "color": "#FF0000",
    "count": 5
  }
]
```

### 2. `create_reminder_list`

Create a new reminder list.

**Parameters:**
- `name` (required): Name of the list
- `color` (optional): Hex color code (e.g., "#FF0000")

**Example:**
```json
{
  "name": "Shopping",
  "color": "#00FF00"
}
```

### 3. `list_reminders`

List reminders with optional filtering.

**Parameters:**
- `listId` (optional): Filter by list ID
- `listName` (optional): Filter by list name
- `showCompleted` (optional): Include completed reminders (default: false)
- `dueWithin` (optional): Filter by due date - "today", "tomorrow", "this-week", "overdue", "no-date"
- `search` (optional): Search in title and notes

**Example:**
```json
{
  "listName": "Personal",
  "showCompleted": false,
  "dueWithin": "today"
}
```

### 4. `create_reminder`

Create a new reminder.

**Parameters:**
- `title` (required): Title of the reminder
- `listId` (optional): ID of the list
- `listName` (optional): Name of the list
- `notes` (optional): Additional notes
- `dueDate` (optional): ISO 8601 date string
- `dueDateIncludesTime` (optional): Whether the due date includes time
- `priority` (optional): 0=none, 1=high, 5=medium, 9=low
- `url` (optional): Associated URL

**Example:**
```json
{
  "title": "Buy groceries",
  "listName": "Shopping",
  "notes": "Milk, eggs, bread",
  "dueDate": "2025-11-20T10:00:00Z",
  "dueDateIncludesTime": true,
  "priority": 1
}
```

### 5. `update_reminder`

Update an existing reminder.

**Parameters:**
- `id` (required): ID of the reminder
- `title` (optional): New title
- `notes` (optional): New notes (null to clear)
- `dueDate` (optional): New due date (null to clear)
- `dueDateIncludesTime` (optional): Whether due date includes time
- `priority` (optional): New priority
- `url` (optional): New URL (null to clear)
- `moveToListId` (optional): Move to different list

**Example:**
```json
{
  "id": "...",
  "title": "Buy groceries and supplies",
  "priority": 5
}
```

### 6. `complete_reminder`

Mark a reminder as complete or incomplete.

**Parameters:**
- `id` (required): ID of the reminder
- `completed` (required): true or false

**Example:**
```json
{
  "id": "...",
  "completed": true
}
```

### 7. `delete_reminder`

Delete a reminder permanently.

**Parameters:**
- `id` (required): ID of the reminder

**Example:**
```json
{
  "id": "..."
}
```

## API Endpoints

### `GET /`
Health check endpoint (no authentication required).

Returns server status and active session count.

### `GET /sse`
SSE endpoint for MCP client connections (requires authentication).

Include API key in `x-api-key` header.

### `POST /messages`
Message handling endpoint (requires authentication).

Include API key in `x-api-key` header.

## Authentication

All protected endpoints require an API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your_api_key_here" http://localhost:3000/sse
```

### Error Codes

- `401 Unauthorized` - Missing API key
- `403 Forbidden` - Invalid API key
- `429 Too Many Requests` - Rate limit exceeded (100 requests per 15 minutes)

## Security

- ✅ API key authentication on all protected endpoints
- ✅ Rate limiting (100 requests per 15 min per IP)
- ✅ Security headers via Helmet
- ✅ HTTPS via ngrok for remote access
- ✅ Input validation via Zod schemas
- ✅ Session timeout after 30 minutes of inactivity

## Development

### Project Structure

```
apple-reminders-mcp/
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Configuration
│   ├── types.ts                 # TypeScript types
│   ├── server/
│   │   ├── sse.ts              # SSE server
│   │   └── session.ts          # Session management
│   ├── middleware/
│   │   └── auth.ts             # Authentication
│   ├── mcp/
│   │   ├── server.ts           # MCP server
│   │   ├── tools.ts            # Tool definitions
│   │   └── handlers.ts         # Tool handlers
│   ├── utils/
│   │   ├── logger.ts           # Logging
│   │   └── swift-bridge.ts    # Swift communication
│   └── swift/
│       ├── Models.swift         # Data models
│       ├── RemindersManager.swift # EventKit integration
│       ├── main.swift           # Swift entry point
│       └── build.sh             # Build script
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

- `npm run build:ts` - Compile TypeScript
- `npm run build:swift` - Build Swift binary
- `npm run build` - Build both TypeScript and Swift
- `npm start` - Start the server
- `npm run dev` - Build and start
- `npm run clean` - Clean build artifacts

### Rebuilding Swift Binary

If you make changes to Swift files:

```bash
npm run build:swift
```

### Logging

Set log level in `.env`:
```
LOG_LEVEL=debug  # debug, info, warn, error
```

## Troubleshooting

### Permission Denied Error

If you see a permission error:
1. Go to **System Settings > Privacy & Security > Reminders**
2. Add your terminal app or the Swift binary
3. Restart the server

### Swift Binary Not Found

```bash
npm run build:swift
```

### Port Already in Use

Change the port in `.env`:
```
PORT=3001
```

### ngrok Connection Issues

Make sure ngrok is installed and running:
```bash
ngrok http 3000
```

### TypeScript Compilation Errors

Clean and rebuild:
```bash
npm run clean
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
