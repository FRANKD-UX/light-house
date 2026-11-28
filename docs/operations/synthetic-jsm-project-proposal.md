# Synthetic JSM project proposal — reconstructed

Date: 2026-11-28. Reconstructed from recovered Sprint 5 contracts and the owner's requested values; this is not recovery of the lost document. Proposal only, no provisioning authority. Product: Light House. The literal owner-proposed project label below is retained. No real site/cloud/account identifiers belong in this publication candidate.

## Minimum configuration

| Setting              | Proposed value / decision                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Project display name | Lighthouse NOC — Development                                                                                     |
| Project key          | LHNOC, subject to availability; not an existing verified key                                                     |
| Product / template   | Jira Service Management / IT Service Management, if available on the current plan                                |
| Management           | Company-managed preferred; owner reviews any alternative before creation                                         |
| Light House tenant   | Lantern Fibre, existing synthetic tenant; internal ID resolved from trusted storage                              |
| Request type         | Prefer an existing incident request type; otherwise Network Incident, subject to separate configuration approval |
| Data / integration   | Synthetic only; no production connections, external customer participants or real infrastructure                 |
| Identifiers          | Project ID, service desk ID, request type ID, priority IDs and field IDs all UNKNOWN                             |

Connected authenticated discovery returned no caller-visible projects. An authorised administrator must first determine whether an existing project can be made accessible. Zero search results do not prove absence. Do not create a duplicate project or guess an ID. Site-specific target confirmation stays in owner-only operational records.

## Permissions and discovery

Company-managed project creation requires Jira administrative authority. Project/request-type configuration needs the applicable project/service-space administrator and product entitlement; shared custom fields/screens/workflows may require Jira admin. An authenticated connector alone does not establish those roles or Forge app access. Confirm the actual available creation/template/model and agent entitlement before approval; no paid plan change or additional seat is authorised.

After access/provisioning approval, bounded read-only sequence: listJiraProjects, then getJsmRequestCreationOptions with the verified project key, then getJsmRequestTypeFields with returned desk/type IDs. Confirm complete pagination, desk-to-project association, incident request type, all required fields, schema types and allowed values. Do not substitute Jira issue type IDs for JSM request type IDs. The connected tool supports this metadata chain, but current zero visible projects prevents its target-specific execution. No credentials in chat or token reuse from Forge CLI.

The recovered manifest already declares read:jira-work, storage:app, read:servicedesk-request, write:servicedesk-request and write:jira-work. JSM create requires write:servicedesk-request; metadata/readback uses read:servicedesk-request; Jira issue visibility/search uses read:jira-work. write:jira-work concerns separate platform writes, not proof that this POC needs arbitrary transitions. Review all five scopes against exact deployed handlers and consent; no scope change is proposed here. Embedded context uses interactive asUser, request creation uses the reviewed asApp gateway. Connector identity, Forge app permissions and tenant authority are separate checks.

## Gateway configuration and minimum fields

The current JsmConfiguration requires explicit installation/tenant binding, expected configuration version, project/desk/type/priority IDs and four distinct custom field IDs. Inspect and reuse existing compatible fields before requesting new configuration:

| Value                   | Current gateway requirement                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Summary and description | Non-enumerated string request fields; bounded synthetic content                                  |
| Priority                | Priority-schema field accepting verified P1/P2/P3 mapped IDs                                     |
| Reconciliation marker   | Non-enumerated string custom field; searchable exact returned value after bounded JQL candidates |
| Warning / deadline      | Two distinct datetime custom fields, UTC input accepted                                          |
| Policy reference        | Distinct non-enumerated string custom field; immutable selected policy UUID                      |

All seven supplied fields must appear in request-type field metadata with the expected schemas. Additional required fields unsupported by the current request builder block configuration. Hidden/default field behaviour, forms and field editability are not assumed compatible. If the template cannot satisfy this contract, stop and propose the smallest field/screen/request-type change for owner approval; do not weaken validation or invent mappings. No custom workflow, automation, plugin or paid feature is required merely to create the synthetic request. A stock template alone is not guaranteed sufficient.

Configuration is saved only by the current trusted tenant/Jira administrator path, with version CAS and gateway metadata verification. The gateway rechecks metadata before each create. Store only safe IDs/configuration in Forge SQL; monitoring credential material uses KVS secret storage. Initial marker is included in the first request. Native readback must confirm actual desk/type/project, field values and durable issue mapping. A connector-created request does not demonstrate the application's create path and must not be substituted as evidence.

## Workflow, tenancy and acceptance

Keep the template workflow for create/read POC. Native resolve/close remains disabled in Light House. Monitoring recovery is evidence only; the operational SLA snapshot remains immutable. Direct Jira UI/REST/automation bypass prevention and verifiable native confirmation remain separate release blockers. Do not claim template transitions enforce Light House gates. JSM owns native notifications; use consenting synthetic recipients only, no external delivery service. Do not disable native notifications silently to hide side effects.

The target project is not a tenant boundary. Trusted installation plus stored active tenant membership authorises every operation; referenced source/resource/incident/configuration must be same-tenant. Embedded context additionally requires exact Jira asUser visibility, issue/project match and current unexpired membership; denying access must not disclose the linked incident. Retain all R-01–R-14 native release obligations, including genuine installation isolation and role/expiry/revocation evidence.

Provisioning/configuration acceptance: verified project/key/desk/type IDs, template/model/entitlements and admin authority recorded privately; no additional required-field mismatch; all supplied metadata passes gateway verification; app read/create/search and consenting user visibility proven separately. Event acceptance: one synthetic authenticated problem yields one ready receipt, expected mapped impact/SLA, one linked JSM request, one NOC incident and authorised embedded context; duplicate adds no request; wrong tenant/identity denied; recovery never closes. Record UUIDs/UTC and allowlisted results, not tokens/raw events/HARs. See the operation-by-operation [hosted plan](sprint-5-hosted-poc-plan.md).

## Resources and approval boundary

Project creation can allocate workflows/screens/request types, expose a portal and trigger product notifications. Verify current product subscription, agent-seat implications and existing plan limits; do not assume free provisioning. No purchase, trial activation, plan upgrade, paid feature, new subscription or user invitation is authorised. Forge usage includes SQL/KVS/functions/queues/logs and public ingress. Historical SQL 292 and USD0 observations are not current headroom. Fresh environment-attributed metering, data-through time, delayed/unmetered bound and in-flight reservation are required. Preserve the existing shared additional2,000/cumulative5,000 SQL envelope; exact remaining allocation is UNKNOWN until reconciled. No reset or extra600 allowance is inferred.

Owner decisions: existing-project access versus one new LHNOC project; verified available template/model; exact compatible field changes if necessary; existing-seat-only entitlement/cost confirmation; separate bounded DEVELOPMENT artifact/risk/install/schema/source/event authority. This document approves none of them.

## Official evidence

Verified 2026-11-28: [service project creation](https://support.atlassian.com/jira-service-management-cloud/docs/create-a-service-project/), [JSM desk/request-type/field metadata](https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-servicedesk/), [JSM request creation/readback and scopes](https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-request/), [Forge issue context](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-context/). Forge MCP documentation search failed HTTP transport; exact official pages were used as fallback. These sources establish API contracts, not tenant entitlements, native field compatibility, billing totals or permission acceptance.

## Owner in-principle decision and current discovery — 2026-11-28

Owner approves the proposed LHNOC configuration in principle; execution of project provisioning is NOT authorised. The connected Atlassian read operations are available here. The current bounded project search again returned values[],total0,isLasttrue; there is no verified accessible project, not proof none exists. All project/desk/type/field IDs and allowed values remain UNKNOWN.

Exact minimum next action: a Jira administrator checks existing project visibility/permissions first. If a suitable synthetic project exists, approve only the required access change. If none is suitable, separately authorise one existing-entitlement ITSM/company-managed JSM project with displayname Lighthouse NOC — Development/key LHNOC (after availability check). Reuse its incident request type. Then execute the already discovered read-only getJsmRequestCreationOptions→getJsmRequestTypeFields chain on actual returned IDs. Reuse compatible fields; any necessary four-field configuration/screen/request-type changes need exact explicit approval. No paid subscription upgrade, additional seat, portal exposure change beyond approval, user invitation or new notification recipient is implied.

[Major-version investigation](forge-major-version-investigation.md) identifies the actual three-scope delta. [Current 20-operation plan](sprint-5-hosted-poc-plan.md#current-20-operation-admission-envelope--2026-11-28) defines the separately gated hosted session. No provisioning, metadata-ID invention or native Jira write performed.
