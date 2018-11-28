// https://activecollab.com/help-classic/books/api/tasks

var ActiveCollabClient = require("../client");

ActiveCollabClient.prototype.tasks = function(projectId) {
  return this.get(`projects/${projectId}/tasks`);
};

ActiveCollabClient.prototype.task = function(projectId, taskId) {
  if (arguments.length === 1 && projectId.projectId) {
    task = projectId;
    projectId = task.projectId;
  }
  return this.get(`projects/${projectId}/tasks/${taskId}`);
};

ActiveCollabClient.prototype.taskAdd = function(projectId, task) {
  if (arguments.length === 1 && projectId.projectId) {
    task = projectId;
    projectId = task.projectId;
  }
  return this.post(`projects/${projectId}/tasks/add`, task);
};

ActiveCollabClient.prototype.taskEdit = function(projectId, taskId, task) {
  if (arguments.length === 1 && projectId.projectId && projectId.taskId) {
    task = projectId;
    taskId = task.taskId;
    projectId = task.projectId;
  } else if (arguments.length === 2 && taskId.taskId) {
    task = taskId;
    taskId = task.taskId;
  }
  return this.post(`projects/${projectId}/tasks/${taskId}`, task);
};

ActiveCollabClient.prototype.taskEdit = function(projectId, taskId, task) {
  if (arguments.length === 1 && projectId.projectId && projectId.taskId) {
    task = projectId;
    taskId = task.taskId;
    projectId = task.projectId;
  } else if (arguments.length === 2 && taskId.taskId) {
    task = taskId;
    taskId = task.taskId;
  }
  throw new Error("Not yet implemented.");
  return this.postFormData(
    `projects/${projectId}/tasks/${taskId}/attachments/add`,
    task
  );
};

ActiveCollabClient.prototype.taskDelete = function(projectId, taskId) {
  if (arguments.length === 1 && projectId.projectId && projectId.taskId) {
    task = projectId;
    taskId = task.taskId;
    projectId = task.projectId;
  } else if (arguments.length === 2 && taskId.taskId) {
    task = taskId;
    taskId = task.taskId;
  }
  return this.post(`projects/${projectId}/tasks/${taskId}/delete`);
};

ActiveCollabClient.prototype.taskArchive = function(projectId, taskId) {
  if (arguments.length === 1 && projectId.projectId && projectId.taskId) {
    task = projectId;
    taskId = task.taskId;
    projectId = task.projectId;
  } else if (arguments.length === 2 && taskId.taskId) {
    task = taskId;
    taskId = task.taskId;
  }
  return this.post(`projects/${projectId}/tasks/${taskId}/archive`);
};
