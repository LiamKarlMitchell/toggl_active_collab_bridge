const config = require("./MyConfig");
const ActiveCollabClient = require("./activecollab");
const activeCollab = new ActiveCollabClient(config.ActiveCollab);

module.exports = activeCollab;
