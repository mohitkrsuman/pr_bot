GitHub Webhook (pull_request opened / synchronize)
          │
          ▼
Hono Server Endpoint (/webhook)
          │
          ▼
Octokit → Fetch PR diff
          │
          ▼
Send diff to Claude (Anthropic API)
          │
          ▼
Claude returns review comments
          │
          ▼
Octokit posts comment on PR