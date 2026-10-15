# Supergrow n8n community node

Supergrow helps creators and teams create, schedule, publish, and analyze LinkedIn content

Generated from OpenAPI 1.1.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated API key credential in n8n before using the node.

## Supported operations

- `GET /analytics/followers` - Get Follower Analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/metrics` - Get Engagement Metrics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/weekly-reports` - List Weekly Reports
  - Retry Contract: none
  - Pagination Contract: none
- `GET /calendar/monthly` - Get Monthly Calendar
  - Retry Contract: none
  - Pagination Contract: none
- `GET /calendar/weekly` - Get Weekly Calendar
  - Retry Contract: none
  - Pagination Contract: none
- `GET /company-pages` - List Company Pages
  - Retry Contract: none
  - Pagination Contract: none
- `GET /content-dna` - Get Content DNA
  - Retry Contract: none
  - Pagination Contract: none
- `POST /content-dna/regenerate` - Regenerate Content DNA
  - Retry Contract: none
  - Pagination Contract: none
- `POST /extract` - Extract Text from URL
  - Retry Contract: none
  - Pagination Contract: none
- `POST /extract/audio` - Transcribe Audio or Video
  - Retry Contract: none
  - Pagination Contract: none
- `POST /extract/pdf` - Extract PDF Text
  - Retry Contract: none
  - Pagination Contract: none
- `POST /extract/youtube` - Extract YouTube Transcript
  - Retry Contract: none
  - Pagination Contract: none
- `GET /kanban` - Get Kanban Board
  - Retry Contract: none
  - Pagination Contract: none
- `GET /kanban/column` - Get Kanban Column
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /knowledge-base/{id}` - Delete Knowledge Base Item
  - Retry Contract: none
  - Pagination Contract: none
- `GET /knowledge-base` - List Knowledge Base Items
  - Retry Contract: none
  - Pagination Contract: none
- `GET /knowledge-base/{id}` - Get Knowledge Base Item
  - Retry Contract: none
  - Pagination Contract: none
- `POST /knowledge-base/ingest` - Add Text to Knowledge Base
  - Retry Contract: none
  - Pagination Contract: none
- `POST /knowledge-base/search` - Search Knowledge Base
  - Retry Contract: none
  - Pagination Contract: none
- `GET /linked-in-accounts` - List LinkedIn Accounts
  - Retry Contract: none
  - Pagination Contract: none
- `GET /media` - List Media Items
  - Retry Contract: none
  - Pagination Contract: none
- `GET /media/{id}` - Get Media Item
  - Retry Contract: none
  - Pagination Contract: none
- `POST /media` - Create Media Item
  - Retry Contract: none
  - Pagination Contract: none
- `POST /media/{id}/confirm` - Confirm Media Upload
  - Retry Contract: none
  - Pagination Contract: none
- `POST /post-score` - Score LinkedIn Post
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /posts/{id}` - Delete Post
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /posts/{id}/comments/{comment_id}` - Delete Auto-Plug Comment
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /posts/{id}/public-link` - Remove Public Preview Link
  - Retry Contract: none
  - Pagination Contract: none
- `GET /posts` - List Posts
  - Retry Contract: none
  - Pagination Contract: none
- `GET /posts/{id}` - Get Post
  - Retry Contract: none
  - Pagination Contract: none
- `GET /posts/{id}/comments` - List Auto-Plug Comments
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts` - Create Post
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts/{id}/comments` - Add Auto-Plug Comments
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts/{id}/public-link` - Create Public Preview Link
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts/{id}/publish` - Publish Post
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts/{id}/schedule` - Schedule Post
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts/{id}/unschedule` - Unschedule Post
  - Retry Contract: none
  - Pagination Contract: none
- `POST /posts/queue` - Queue Post
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /posts/{id}` - Update Post
  - Retry Contract: none
  - Pagination Contract: none
- `POST /questions/from-text` - Generate Questions from Text
  - Retry Contract: none
  - Pagination Contract: none
- `POST /questions/from-topic` - Generate Questions from Topic
  - Retry Contract: none
  - Pagination Contract: none
- `GET /workspaces` - List Workspaces
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **Supergrow** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **Supergrow** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **Supergrow** display name.
