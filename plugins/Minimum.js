const events = require('../MyEventEmitter')
const activeCollab = require('../MyActiveCollabClient')

module.exports = {
  init: function (pluginConfig) {

    if (typeof pluginConfig.duration === 'undefined') {
      pluginConfig.duration = 15 * 60
    }

    events.on('onTimeEntry', async function (event) {
      let timeEntry = event.timeEntry

      // Don't set the minimum duration if skipped or collated.
      if (timeEntry.skip || timeEntry.collated) {
        return
      }

      if (timeEntry.duration < pluginConfig.duration) {
        timeEntry.timeModified = 'minimum ' + pluginConfig.duration
        timeEntry.duration = pluginConfig.duration
      }
    })
  }
}
