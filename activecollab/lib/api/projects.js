// client.prototype.projectGetAll;
// client.prototype.projectGet;
// client.prototype.projectAdd;
// client.prototype.projectEdit;
// client.prototype.projectDelete;

// GET projects
// GET projects/archive
// POST projects/add
// GET projects/:project_id
// POST projects/:project_id/edit
// GET projects/:project_id/hourly-rates // 3.2.13
// GET projects/templates // 4.1.0

var ActiveCollabClient = require("../client");

ActiveCollabClient.prototype.projects = function() {
  return this.get("projects");
};
