# Removed internal email drafts

The following files were **removed from the repository** because they contained internal operational context and must not be stored in version control:

- `email_1_technical_assessment_note.txt`
- `email_2_server_provisioning_request.txt`
- `email_3_domain_registration.txt`
- `email_ipdu_manager_progress.txt`
- `email_odu_workflow_review.txt`

If these were ever pushed to a public remote, treat any credentials or hostnames mentioned in them as potentially exposed. Rotate secrets and use `git filter-repo` on the remote history if required.

`.gitignore` now blocks `email_*.txt` from being re-committed.
