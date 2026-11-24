# Delivery roadmap

Internal release target: 19 December 2026; Codegeist submission: 22 December 2026 22:00 SAST. Sprints are ordered delivery slices, not an assumption that ten full weeks remain. Re-estimate capacity after Sprint 0; the remaining calendar is a schedule risk. No Sprint 1 work is authorised by this handover.

| Sprint | Outcome                                        | Exit gate                                                                                 |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0      | Architecture and engineering foundation        | Local scaffold/tests/docs/CI; external Forge gates separately tracked                     |
| 1      | ISP tenancy, network inventory and persistence | Schema migrations, explicit ownership, synthetic inventory and negative isolation tests   |
| 2      | Zabbix adapter and authenticated ingestion     | Real webtrigger, validated normalisation, stable inbox/dispatch and replay tests          |
| 3      | Enrichment and SLA engine                      | Deterministic distinct impact, P1/P2/P3 versioned UTC snapshots and unknown handling      |
| 4      | JSM and incident lifecycle                     | Actual requests, reconciliation, duplicate safety, recovery and native notification setup |
| 5      | NOC dashboard and administration               | Visible state/impact/deadlines, backend-admin permissions and source/policy management    |
| 6      | Entra, Google and manual mapping               | Provider consent/identity tests plus manual fallback; no login replacement                |
| 7      | Security, reliability and regression           | Cross-tenant/auth/rate/failure matrix and dependency remediation gates                    |
| 8      | Release candidate and install readiness        | Authorised deployment, fresh-site install, sharing and configuration documentation        |
| 9      | Hackathon demonstration and submission         | Working labelled demo/video, judge instructions and owner submission confirmation         |

Critical path: LH-013 real app/site gate → LH-101 isolation/persistence → LH-102 inventory → LH-103 authenticated ingestion → LH-104 enrichment/SLA → LH-105 actual JSM lifecycle → LH-106 usable NOC/admin → LH-108 regression → LH-109 installable release → LH-110 submission. LH-107 identity adapters can proceed once tenancy/admin contracts exist but provider consent is an independent risk. Manual assignee mapping is part of the minimum JSM workflow.

Minimum viable submission: synthetic multi-site inventory; authenticated Zabbix-compatible events; enrichment and distinct impact; effective/versioned SLA deadlines; real JSM incident; visible app lifecycle; duplicate/recovery safety; manual identity fallback; fresh judge installation and setup instructions. This is deliberately larger than webhook forwarding. If provider consent slips, the owner must explicitly re-scope Sprint 6 adapter delivery; do not silently mark it complete.

Optional enhancements: topology correlation across distinct events, high-volume production tuning, advanced directory group sync, configurable business-hour calendars and sophisticated failover modelling. Zoho Desk LH-190 is independently tracked as a non-blocking stretch goal. No optional integration may weaken the critical-path acceptance gates.
