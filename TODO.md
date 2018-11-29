# TODO
## Planned improvements.

* Configurable catch all filters for project/ticket/term/tag etc to store time in a specific active collab project ticket.

* Migrate existing time entries to new projects in new workspace.

* A generated output of any failed to transfer and ignored/no issue number/ticket/project mapping found when syncing the time.
  
## Nice to haves / ideas.

* Allowing time to be tracked against a project if no issue number is given, we don't use this workflow so I have not implemented it.

* Multiple user support mapping Toggl's uid to an Active Collab user. *May already work I'm not sure*.

* Out of band processing of syncing the time entries to Active Collab.
  Sync times in and store them as to be processed into Active Collab gradually over time as the. This would require substantial change at the moment I consider it a premature optimization.

* Repl or Web Interface to manually run a sync and view results and stats.

* Support for multiple Toggl's and Active Collabs. You can already run multiple instances of the software with different configs.
