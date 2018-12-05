const events = require('../MyEventEmitter')
const activeCollab = require('../MyActiveCollabClient')

module.exports = {
  init: function (pluginConfig) {
    events.on('tagAdded', async function (event) {
      if (event.tag === 'Comment') {
        await activeCollab.taskAddComment(event.mapping.activeCollabProjectId, event.mapping.issueNumber, event.mapping.summary)
      }      
    })
  }
}