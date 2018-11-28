client.prototype.taskTimeGetAll
client.prototype.taskTimeGet
client.prototype.taskTimeAdd
client.prototype.taskTimeEdit
client.prototype.taskTimeDelete

// Wrappers for task or project depending on id's set.
client.prototype.timeGetAll = function (timeRecord) {
  if (timeRecord.projectId) {
    return this.projectTimeGetAll(timeRecord)
  }
}
client.prototype.timeGet = function (timeRecord) {
  if (timeRecord.projectId) {
    return this.projectTimeGet(timeRecord)
  }
}
client.prototype.timeAdd = function (timeRecord) {
  if (timeRecord.projectId) {
    return this.projectTimeAdd(timeRecord)
  }
}
client.prototype.timeEdit = function (timeRecord) {
  if (timeRecord.projectId) {
    return this.projectTimeEdit(timeRecord)
  }
}
client.prototype.timeDelete = function (timeRecord) {
  if (timeRecord.projectId) {
    return this.projectTimeDelete(timeRecord)
  }
}

// https://activecollab.com/help-classic/books/api/time-and-expenses

// projects/:project_id/tracking
// projects/:project_id/tracking/time/add
// projects/:project_id/tasks/:task_id/tracking/time/add
// projects/:project_id/tracking/time/:record_id
// projects/:project_id/tracking/time/:record_id/edit
