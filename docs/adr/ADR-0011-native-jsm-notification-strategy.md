# ADR-0011: Native JSM notification strategy

Date: 2026-11-24

Status: Accepted — owner-approved constraint; configuration pending

## Context

Customer/team communication must stay in JSM.

## Decision

Use JSM native notification schemes/customer notifications and configured automation/workflow activity for warnings, breaches and resolution. No external email or Microsoft Graph mail.

## Rationale

Keeps communication tied to request visibility and existing team workflows.

## Consequences

API success is not proof of recipient delivery; owner/admin configures rules, participants, visibility and validates logs.

## Alternatives considered

External email services and Graph mail explicitly prohibited.

## Verification requirements

Verify synthetic reporter/participant/agent recipients, public/internal comments, preferences and warning/resolution delivery on development site.

## Official references

[Official documentation](https://support.atlassian.com/jira-service-management-cloud/docs/set-up-notifications-for-your-customers-and-team/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
