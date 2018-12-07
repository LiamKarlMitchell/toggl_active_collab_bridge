const events = require('../MyEventEmitter')
/*
  Will Collate times that share the same Date, Project, Description and Billable flag.
  Tags will be merged and the first toggl time entry id will be retained.
  The array will have it's contents replaced.

  Note: The start and stop will not be suitable for getting a duration check after this.
  Stop datetime will only be retained for first record found.
*/

function getKeyFromTimeEntry(timeEntry) {
    return `${timeEntry.billable ? 'billable' : 'notbillable'}_${timeEntry.wid}_${timeEntry.uid}_${timeEntry.pid ? timeEntry.pid : 'nopid'}_${timeEntry.description}`.toLowerCase().replace(/[^#a-z_\-0-9]/g,'')
}

module.exports = {
  init: function (pluginConfig) {
    events.on('receivedTimeEntries', async function (event) {
        let collation = {}
        let dateCollations = null
        let lastDate = ''

        for (let index = 0; index < event.timeEntries.length; index++) {
            let timeEntry = event.timeEntries[index]
            var date = timeEntry.start.substr(0, 10)

            // This should never happen, as the entries are ordered from Toggl.
            if (lastDate > date) {
                throw new Error(`Time entry records are not in order? LastDate: ${lastDate} Date: ${date} TimeEntryID: ${timeEntry.id}`)
            }

            if (lastDate !== date) {
                collation[date] = dateCollations = {}
                lastDate = date
            }

            let key = getKeyFromTimeEntry(timeEntry)
            let collatedRecord = dateCollations[key]

            // Collated record does not exist add it.
            if (collatedRecord === undefined) {
                dateCollations[key] = collatedRecord = timeEntry
            } else {
                // Collated record exists already just add to it.
                collatedRecord.duration += timeEntry.duration

                // Merge the tag arrays without duplicates.
                collatedRecord.tags = collatedRecord.tags.concat(timeEntry.tags.filter(function (item) {
                    return collatedRecord.tags.indexOf(item) < 0;
                }))

                // Mark the time entry as skipped and collated.
                // Note: We could delete it and update the array but this is easier.
                timeEntry.skip = true
                timeEntry.collated = true
                if (collatedRecord.collatedTimeEntries === undefined) {
                    collatedRecord.collatedTimeEntries = []
                }
                collatedRecord.collatedTimeEntries.push({id: timeEntry.id, duration: timeEntry.duration, start: timeEntry.start, stop: timeEntry.stop})
            }

        }
    })
  }
}
