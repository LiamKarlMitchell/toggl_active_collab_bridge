const events = require('../MyEventEmitter')
const activeCollab = require('../MyActiveCollabClient')

module.exports = {
  init: function (pluginConfig) {

    // Default duration to round of 5 minutes.
    if (typeof pluginConfig.duration === 'undefined') {
      pluginConfig.duration = 300
    }    

    events.on('onTimeEntry', async function (event) {
      let timeEntry = event.timeEntry

      // Don't set the minimum duration if skipped or collated.
      if (timeEntry.skip || timeEntry.collated) {
        return
      }

      let roundDuration = Math.ceil(timeEntry.duration / pluginConfig.duration) * pluginConfig.duration

      if (roundDuration != timeEntry.duration) {
        timeEntry.timeModified = 'ceil'
        timeEntry.duration = roundDuration
      }
    })
  }
}
