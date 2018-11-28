// client.prototype.taskTimeGet;
// client.prototype.taskTimeAdd;
// client.prototype.taskTimeEdit;
// client.prototype.taskTimeDelete;

// https://activecollab.com/help-classic/books/api/time-and-expenses

const moment = require('moment')
const ActiveCollabClient = require('../client')

ActiveCollabClient.prototype.times = function (projectId, taskId, dontLimit) {
  if (arguments.length === 1 && projectId.projectId) {
    var task = projectId
    projectId = task.projectId
    taskId = task.id
  }

  var params = {}
  if (dontLimit) {
    params.dont_limit_result = 1
  }

  // TODO: Strip out only timeRecord class records.
  return this.get(`projects/${projectId}/tasks/${taskId}/tracking`, params)
}

ActiveCollabClient.prototype.time = function (projectId, taskId, timeId) {
  if (
    arguments.length === 1 &&
    projectId.projectId &&
    projectId.taskId &&
    projectId.timeId
  ) {
    timeId = projectId.timeId
    taskId = projectId.taskId
    projectId = projectId.projectId
  }
  return this.get(
    `projects/${projectId}/tasks/${taskId}/tracking/time/${timeId}`
  )
}

// function validateDuration(duration) {
//     // If the duration is a number then it should already be in hours.
//     // If the duration is HH:MM then its okay too.
//     if (!isNumber(duration)) {
//         return false;
//     }
//     if (duration)
// }

ActiveCollabClient.prototype.timeAdd = function (projectId, taskId, timeRecord) {
  //   if (arguments.length === 1 && projectId.projectId && projectId.taskId) {
  //     timeRecord = projectId;
  //     taskId = timeRecord.taskId;
  //     projectId = timeRecord.projectId;
  //   }

  //   if (!timeRecord.summary) {
  //     throw new Error("Time Record should have a summary set.");
  //   }

  // time_record[value]: 1
  // time_record[user_id]: 351
  // time_record[job_type_id]: 1
  // time_record[record_date]: 2018 / 11 / 07
  // time_record[summary]: NEW
  // time_record[billable_status]: 0

  // TODO: Check default behaviours.
  // var recordDate = timeRecord.record_date;
  // if (!recordDate) {
  //     record_date = moment().format("YYYY/MM/DD");
  // }

  // var userId = timeRecord.user_id;
  // if (!userId) {
  //     userId = this.userId;
  // }

  // TODO: A way to have JSON validation.

  if (!timeRecord.user_id) {
    throw new Error('Expecting time record to have user_id set.')
  }
  if (!timeRecord.summary) {
    throw new Error('Expecting time record to have summary set.')
  }
  if (!timeRecord.job_type_id) {
    throw new Error('Expecting time record to have job_type_id set.')
  }
  if (!timeRecord.record_date) {
    throw new Error('Expecting time record to have record_date set.')
  }
  if (!timeRecord.value) {
    throw new Error('Expecting time record to have value set.')
  }

  if (timeRecord.billable_status === undefined) {
    throw new Error('Expecting time record to have undefined set.')
  }

  return this.post(`projects/${projectId}/tasks/${taskId}/tracking/time/add`, {
    time_record: timeRecord,
    submitted: 'submitted'
  })
}

ActiveCollabClient.prototype.timeEdit = function (
  projectId,
  taskId,
  timeId,
  timeRecord
) {
  return this.post(
    `projects/${projectId}/tasks/${taskId}/tracking/time/${timeId}/edit`,
    {
      time_record: timeRecord,
      submitted: 'submitted'
    }
  )
}

// TODO: Implement task tracked time deletion.
ActiveCollabClient.prototype.timeDelete = function (projectId, taskId, timeId) {
  return this.post(
    `projects/${projectId}/tasks/${taskId}/tracking/time/${timeId}/trash`,
    { submitted: 'submitted' }
  )
}
