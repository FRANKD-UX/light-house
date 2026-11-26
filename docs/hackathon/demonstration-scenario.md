# Synthetic demonstration scenario

Design only; Sprint 0 does not run this demonstration. Seed two invented ISP tenants, Lantern Fibre and Beacon Transit. Each has Hill POP, Harbour POP and Metro Core; each site has a primary 1000 Mbps and backup 500 Mbps uplink. Invent carriers Copper Kite and Blue Lantern. Six synthetic customer aliases per ISP span enterprise/standard tiers, with some sharing uplinks and one explicitly dual-homed service. Teams: Access NOC and Core Response; assignees use synthetic labels mapped manually to consenting test Atlassian accounts. No real customer contact details or infrastructure addresses are used.

Event types: primary link down, packet-loss degradation, capacity alarm and recovery. Document the simplified failover rule: a tested healthy backup with capacity sufficient for the service can preserve connectivity; otherwise distinguish potentially affected from confirmed disconnected customers. Reserve example.com aliases and never reuse employer hostnames/circuit references.

## Judge exercise, after later sprints implement it

1. Install the actual app on a fresh judge JSM site and follow setup to select a service desk/request type, fields, workflows and notification recipients. Seed a tenant through the app; do not require private ISP access.
2. Configure a source-specific credential privately and send a labelled **simulated Zabbix-compatible outage fixture** through the same authenticated webtrigger used by a genuine source. A genuine optional Zabbix media type run is separately labelled and its server/version shown.
3. Show durable receipt, site/uplink/carrier/team enrichment and a distinct affected-customer count with known/unknown state. Verify other ISP data is inaccessible.
4. Select a configured P1 policy, record warning/deadline/policy version and create an **actual live JSM request**. Open the real issue key, request fields and timeline; no mocked success view.
5. View the incident in Light House. Submit identical event again and show one issue with duplicate receipt, then a repeated problem notification without resetting its SLA.
6. Deliver a linked recovery as evidence, then demonstrate NOC final restoration validation and guarded closure → confirmed JSM resolution with timestamps. Recovery alone must leave the incident open. Display notification configuration/log evidence rather than claim mail from HTTP success.
7. Change the policy duration and create a new stable outage ID. Show new deadlines apply only to the new incident, with old snapshot unchanged.
8. Optionally demonstrate unknown resource/manual repair and ambiguous-create review using an explicitly labelled failure simulation. Reset only the synthetic dataset with reviewed cleanup.

Provide an editable request fixture/client command in Sprint 2 that reads secrets privately, never embeds them in recorded shell history. No fixture sender is claimed implemented in Sprint 0. Judges must exercise arbitrary fixture variants through validation, not a hardcoded success path. Target under five minutes for the public YouTube video; detailed setup instructions accompany installation. Live JSM and labelled monitoring fixtures are essential; Zoho Desk is optional.

Sprint 0.5 workflow extension (design only): acknowledge and triage in NOC, demonstrate one justified handoff rejected with a reason, a subsequent accepted handoff with accountable ownership, departmental completion and accepted return to NOC. Show the original SLA deadline unchanged. Also exercise direct NOC remediation without a handoff and an authenticated unmapped event in manual triage. The short video may summarise cases; reproducible acceptance must exercise them. These are planned later-sprint demonstrations, not scaffold functionality.

## Sprint 1 executable inventory — 2026-11-26

Explicitly bootstrap Lantern Fibre and Beacon Transit as a Jira administrator, select each ISP and run eleven four-record seed batches. Per ISP: 3 sites, 2 carriers, 6 primary/backup uplinks (1000/500 Mbps), 6 synthetic customers, 8 independently identified services, 8 dependencies, 3 teams (Access NOC, Network Engineering, Core Response), 2 unmapped manual engineer aliases, 2 team memberships, 2 SLA tiers and 2 draft demonstration policies: 44 inventory records. One customer has multiple services; dependencies share infrastructure; one service has failover primary/backup relationships and service 8 intentionally has no mapping. No IP addresses, contacts, credentials or fabricated Atlassian account bindings are seeded.

Fixture keys determine topology; opaque UUIDs are generated server-side on first creation and reused through tenant-scoped unique fixture keys. Reruns skip existing records without resetting user configuration and resume durable pending work. There is no automatic load-time seed or delete/reset job. Future outage/loss/unknown-impact demonstrations use this topology; impact and monitoring algorithms are not implemented here. The separate explicit development-only repair probe creates one known synthetic site/intent and never touches real infrastructure.
