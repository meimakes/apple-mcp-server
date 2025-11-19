# Apple Reminders MCP Server Product Specification

## Overview

An MCP server providing Apple Reminders access via SSE transport for [Poke.com](http://Poke.com) integration, using Swift + EventKit for native macOS Reminders access. Secured with API key authentication.

## Technical Stack

- **Transport:** SSE (Server-Sent Events) over HTTP
- **Language:** TypeScript (server) + Swift (EventKit bridge)
- **Apple API:** EventKit framework
- **Deployment:** Local Mac + ngrok tunnel
- **Authentication:** API key via x-api-key header

## Architecture

```
Poke.com (with API key)
  ↓ (HTTPS + x-api-key header)
ngrok tunnel (https://abc123.ngrok.io)
  ↓ (HTTP)
Mac: Node.js SSE Server (port 3000)
  ├── Auth Middleware (validates API key)
  ├── /sse (SSE endpoint)
  ├── /messages (POST endpoint)
  └── MCP Server Instance
        ↓ (spawns + stdio)
      Swift CLI Binary
        ↓ (EventKit)
      macOS Reminders.app
```

## Project Structure

```
apple-reminders-mcp/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Environment config
│   ├── server/
│   │   ├── sse.ts                  # SSE server setup
│   │   └── session.ts              # Session management
│   ├── middleware/
│   │   └── auth.ts                 # API key validation
│   ├── mcp/
│   │   ├── server.ts               # MCP server instance
│   │   ├── tools.ts                # Tool definitions (Zod schemas)
│   │   └── handlers.ts             # Tool implementation
│   ├── swift/
│   │   ├── RemindersManager.swift  # EventKit interface
│   │   ├── Models.swift            # Data models
│   │   ├── build.sh                # Build script
│   │   └── bin/
│   │       └── reminders-cli       # Compiled binary
│   ├── utils/
│   │   ├── swift-bridge.ts         # Spawn Swift, handle stdio
│   │   └── logger.ts               # Logging
│   └── types.ts                    # TypeScript types
├── .env.example                     # API_KEY, PORT, NGROK_AUTHTOKEN
├── package.json
├── tsconfig.json
└── README.md
```

## Authentication

### API Key Setup

1. User generates secure API key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
1. Add to `.env`: `API_KEY=your_generated_key`
1. Configure in Poke with endpoint URL + API key
1. Server validates `x-api-key` header on all requests

### Protected Endpoints

- `GET /` - Health check (no auth)
- `GET /sse` - SSE connection (requires auth)
- `POST /messages` - Message handling (requires auth)

### Error Codes

- `401 Unauthorized` - Missing API key
- `403 Forbidden` - Invalid API key
- `429 Too Many Requests` - Rate limit exceeded

## MCP Tools

### 1. list_reminder_lists

Get all reminder lists available

**Output:** Array of lists with id, name, color, count

### 2. create_reminder_list

Create a new reminder list

**Input:** name (required), color (optional)

### 3. list_reminders

List reminders with filtering

**Input:**

- listId or listName (optional)
- showCompleted (default: false)
- dueWithin: “today” | “tomorrow” | “this-week” | “overdue” | “no-date”
- search (text search)

**Output:** Array of reminders with full metadata

### 4. create_reminder

Create a new reminder

**Input:**

- title (required)
- listId or listName (optional)
- notes (optional)
- dueDate (ISO 8601, optional)
- dueDateIncludesTime (boolean)
- priority (0=none, 1=high, 5=medium, 9=low)
- url (optional)

### 5. update_reminder

Update an existing reminder

**Input:**

- id (required)
- Any fields to update (title, notes, dueDate, priority, url)
- moveToListId (to move lists)
- Set fields to null to clear

### 6. complete_reminder

Mark reminder as complete/incomplete

**Input:** id, completed (boolean)

### 7. delete_reminder

Delete a reminder permanently

**Input:** id (required)

## Swift EventKit Bridge

### Communication Protocol

**TypeScript → Swift:**

- JSON command via stdin
- Format: `{ "action": "list_reminders", "params": {...} }`

**Swift → TypeScript:**

- JSON response via stdout
- Success: `{ "success": true, "data": {...} }`
- Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

### Swift Components

- EventKit integration for native Reminders access
- Permission handling (request full access to Reminders)
- Data model serialization (Swift → JSON)
- Error handling and validation

### Build Process

- Swift source files compiled to single binary
- Binary placed in `swift/bin/` directory
- TypeScript spawns binary and communicates via stdio

## Configuration

### Environment Variables (.env)

```
PORT=3000
API_KEY=generated_secure_key_here
NGROK_AUTHTOKEN=your_ngrok_token
LOG_LEVEL=info
```

### Package Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol
- `express` - HTTP server
- `express-rate-limit` - Rate limiting
- `helmet` - Security headers
- `zod` - Input validation
- `dotenv` - Environment config

## Setup & Deployment

### Initial Setup

1. Install dependencies: `npm install`
1. Generate API key: Use crypto.randomBytes command
1. Configure `.env` with API key and port
1. Build Swift binary: `npm run build:swift`
1. Build TypeScript: `npm run build:ts`

### Running Locally

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Create ngrok tunnel
ngrok http 3000
```

Copy ngrok HTTPS URL for Poke configuration.

### Poke.com Configuration

User provides in Poke connector settings:

- **Name:** Apple Reminders
- **Endpoint URL:** `https://abc123.ngrok.io/sse`
- **API Key:** Their generated key

## Security

- API key authentication on all protected endpoints
- Rate limiting (100 requests per 15 min per IP)
- Security headers via Helmet
- HTTPS via ngrok
- Input validation via Zod schemas
- No secrets stored in Reminders data
- Sessions expire after inactivity

## Error Handling

### Permission Errors

Swift binary detects missing Reminders permissions and returns clear error message directing user to System Settings.

### Authentication Errors

Clear error responses for missing/invalid API keys with codes and messages.

### Swift Process Errors

- Binary not found → Build instructions
- Timeout → Process management
- JSON parsing errors → Validation feedback

## Testing

### Authentication Tests

- Request without API key (401)
- Request with invalid key (403)
- Request with valid key (200)

### Functionality Tests

- Create reminder and verify in Reminders.app
- List reminders with various filters
- Complete/uncomplete reminders
- Delete reminders
- Handle edge cases (empty lists, special characters, etc.)

## Future Enhancements

- Batch operations (create/update multiple at once)
- Subtasks support
- Recurring reminders
- Attachments
- Location-based reminders
- Calendar integration (separate tool set)
- Smart categorization
- Webhook notifications for reminder changes

## Success Criteria

- ✅ User can generate and configure API key
- ✅ Poke connects successfully with endpoint + API key
- ✅ Can create reminders from Poke
- ✅ Can list and filter reminders
- ✅ Can complete and delete reminders
- ✅ SSE connection stable for extended periods
- ✅ Swift responses under 500ms
- ✅ Permission errors handled gracefully
- ✅ Authentication errors are clear and actionable

## Documentation Deliverables

- README with setup instructions
- API key generation guide
- Poke integration walkthrough
- Troubleshooting common issues
- Security best practices​​​​​​​​​​​​​​​​
