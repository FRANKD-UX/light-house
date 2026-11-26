# ADR-0005: Monitoring adapter architecture

Date: 2026-11-24

Status: Accepted — extensibility and Zabbix priority owner-approved; contract implemented

## Context

Monitoring sources vary while enrichment/SLA/JSM rules should remain stable.

## Decision

MonitoringAdapter accepts unknown authenticated payload and returns a validated normalised event/result; Zabbix first, Prometheus/LibreNMS later.

## Rationale

Source-specific parsing stays outside orchestration.

## Consequences

Stable problem/recovery identity and timestamp semantics need provider tests; no complete adapter is implemented now.

## Alternatives considered

Direct Zabbix-to-Jira forwarding rejected because it lacks the required business context.

## Verification requirements

Contract tests for invalid payloads, source identity, duplicate/recovery semantics and future adapter conformance.

## Official references

[Official documentation](https://www.zabbix.com/documentation/current/en/manual/config/notifications/media/webhook), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
