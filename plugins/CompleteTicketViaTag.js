const events = require('../MyEventEmitter')
const activeCollab = require('../MyActiveCollabClient')

module.exports = {
  init: function (pluginConfig) {
    events.on('tagAdded', async function (event) {
      if (event.tag === 'Complete') {
        await activeCollab.taskComplete(event.mapping.activeCollabProjectId, event.mapping.issueNumber)
      } else if (event.tag === 'Reopen') {
        await activeCollab.taskReopen(event.mapping.activeCollabProjectId, event.mapping.issueNumber)    
      }
    })

    events.on('tagRemoved', async function (event) {
      if (event.tag === 'Complete') {
        await activeCollab.taskReopen(event.mapping.activeCollabProjectId, event.mapping.issueNumber)
      }
    })
  }
}
