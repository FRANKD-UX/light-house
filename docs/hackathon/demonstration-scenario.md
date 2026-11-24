# Synthetic demonstration scenario

Design only; Sprint 0 does not run this demonstration. Seed two invented ISP tenants, Lantern Fibre and Beacon Transit. Each has Hill POP, Harbour POP and Metro Core; each site has a primary 1000 Mbps and backup 500 Mbps uplink. Invent carriers Copper Kite and Blue Lantern. Six synthetic customer aliases per ISP span enterprise/standard tiers, with some sharing uplinks and one explicitly dual-homed service. Teams: Access NOC and Core Response; assignees use synthetic labels mapped manually to consenting test Atlassian accounts. No real customer contact details or infrastructure addresses are used.

Event types: primary link down, packet-loss degradation, capacity alarm and recovery. Document the simplified failover rule: a tested healthy backup with capacity sufficient for the service can preserve connectivity; otherwise distinguish potentially affected from confirmed disconnected customers. Reserve example.com aliases and never reuse employer hostnames/circuit references.

## Judge exercise, after later sprints implement it

1. Install the actual app on a fresh judge JSM site and follow setup to select a service desk/request type, fields, workflows and notification recipients. Seed a tenant through the app; do not require private ISP access.
2. Configure a source-specific credential privately and send a labelled **simulated Zabbix-compatible outage fixture** through the same authenticated webtrigger used by a genuine source. A genuine optional Zabbix media type run is separately labelled and its server/version shown.
3. Show durable receipt, site/uplink/carrier/team enrichment and a distinct affected-customer count with known/unknown state. Verify other ISP data is inaccessible.
4. Select a configured P1 policy, record warning/deadline/policy version and create an **actual live JSM request**. Open the real issue key, request fields and timeline; no mocked success view.
5. View the incident in Light House. Submit identical event again and show one issue with duplicate receipt, then a repeated problem notification without resetting its SLA.
6. Deliver a linked recovery and show resolution pending → confirmed JSM workflow resolution with timestamps. Display notification configuration/log evidence rather than claim mail from HTTP success.
7. Change the policy duration and create a new stable outage ID. Show new deadlines apply only to the new incident, with old snapshot unchanged.
8. Optionally demonstrate unknown resource/manual repair and ambiguous-create review using an explicitly labelled failure simulation. Reset only the synthetic dataset with reviewed cleanup.

Provide an editable request fixture/client command in Sprint 2 that reads secrets privately, never embeds them in recorded shell history. No fixture sender is claimed implemented in Sprint 0. Judges must exercise arbitrary fixture variants through validation, not a hardcoded success path. Target under five minutes for the public YouTube video; detailed setup instructions accompany installation. Live JSM and labelled monitoring fixtures are essential; Zoho Desk is optional.
