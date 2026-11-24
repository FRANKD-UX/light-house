# System context

Future target architecture; only Custom UI/status resolver are implemented in Sprint 0.

```mermaid
flowchart LR
  NOC[NOC engineer / manager] --> Jira[Jira host + Atlassian identity]
  Jira --> UI[Light House Custom UI]
  Z[Zabbix webhook / labelled fixture] --> W[Forge authenticated webtrigger]
  UI --> R[Forge resolver + authorisation]
  W --> Q[Durable event ledger + Async Events]
  R --> A[Application services]
  Q --> A
  A --> SQL[Forge SQL per installation]
  A --> Secrets[Forge KVS secrets]
  A --> JSM[JSM REST requests + workflow]
  JSM --> Notify[Native JSM notifications]
  A -. identity mappings .-> Directory[Entra / Google / manual]
  A -. post-resolution stretch .-> Zoho[Zoho Desk]
```

Trust boundaries: public monitoring ingress; authenticated Atlassian UI/backend bridge; per-installation storage; logical ISP tenant; external provider REST APIs; JSM project visibility. Customer counts remain aggregate in Jira. Forge is the only backend. See tenancy and security for enforcement and capability assessment for verified API references.
