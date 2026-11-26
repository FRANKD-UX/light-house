# Security policy

Light House has a registered Forge development scaffold and no production support commitment. Treat synthetic fixtures as the only approved data source.

Report suspected vulnerabilities privately to the repository owner through an existing private channel. Do not open an issue with tokens, webhook URLs, raw payloads or customer records. No dedicated security mailbox has been configured. Supply a sanitised reproduction, affected commit, boundary and observed impact. The owner triages tenant bypass, credential compromise and unsafe duplicate Jira creation first.

If a secret is exposed, revoke/rotate it at its issuer, disable the affected monitoring configuration, inspect redacted audit events and coordinate remediation before resuming ingestion. Deleting a working-tree file does not remove Git history exposure. See `docs/architecture/security.md` for the threat model and `docs/project/audit.md` for dependency findings. No security audit or production readiness certification is claimed.

LH-014 remains open: the project owner accepts the documented dependency residual risk only for isolated synthetic development. Production acceptance is blocked. See the dependency-security assessment for conditions and reassessment triggers. Public visibility is not a project licence or public application distribution authorisation.
