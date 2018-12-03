const moment = require('moment')

const activeCollab = require('./MyActiveCollabClient')
const toggl = require('./MyTogglClient')

const config = require('./MyConfig')
const argv = require('./MyCommandLineArguments')

const { delay, delayError } = require('./delay')

const migrateConfig = require(argv.migrateMappingConfig ||
  './config/migrationmapping.json')

var TimeEntriesRetrieveDuration = moment.duration(
  config.TimeEntriesRetrieveDuration || { weeks: 2 }
)

Main()
  .then(result => {
    console.log(result)
  })
  .catch(err => {
    console.error(err, err.stack)
  })

// Run our initial start up checks and initial syncs.
// The sequental calling and order of these operations is intended.
async function Main () {
  await ConfigCheck()
  await MigrateTimeEntries()
}

async function ConfigCheck () {
  // It is assumed you can run the index.js main application to sync just fine.
  console.log(`Config Check`)

  if (migrateConfig.includeNoProjectSpecified === undefined) {
    throw new Error('Expecting config to contain: includeNoProjectSpecified')
  }
  if (migrateConfig.startFromDate === undefined) {
    throw new Error('Expecting config to contain: startFromDate')
  }
  if (migrateConfig.mappings === undefined) {
    throw new Error('Expecting config to contain: mappings')
  }
}

async function MigrateTimeEntries () {
  var presentTime = moment()

  let fromMoment = moment(migrateConfig.startFromDate, 'DD/MM/YYYY')

  do {
    var fromDateISO = fromMoment.toISOString()
    var toDateISO = fromMoment.add(TimeEntriesRetrieveDuration).toISOString()
    console.log(`Getting time entries from ${fromDateISO} to ${toDateISO}`)

    try {
      var timeEntries = await toggl.getTimeEntriesAsync(fromDateISO, toDateISO)

      for (let i = 0; i < timeEntries.length; i++) {
        let timeEntry = timeEntries[i]

        if (timeEntry.wid === config.Toggl.workspaceId) {
          // console.log(`Skipping already in workspace: ${timeEntry.start} ${timeEntry.description}`)
          continue
        }

        var mappings = migrateConfig.mappings[timeEntry.wid]
        if (mappings === undefined) {
          console.log(`Skipping no mapping for this work space: ${timeEntry.start} ${timeEntry.description}`)
          continue
        }

        if (migrateConfig.includeNoProjectSpecified === false && timeEntry.pid === undefined) {
          console.log(`Skipping project id set: ${timeEntry.start} ${timeEntry.description}`)
          continue
        }

        var oldWid = timeEntry.wid
        var newProjectId
        if (timeEntry.pid) {
          var oldPid = timeEntry.pid
          newProjectId = mappings[timeEntry.pid] * 1
        } else {
          newProjectId = null
        }

        if (migrateConfig.dryRun) {
          console.log(`"Would Update time entry: ${timeEntry.start} ${timeEntry.description} Workspace: ${oldWid} => ${config.Toggl.workspaceId} ProjectID: ${oldPid} => ${newProjectId}`)
        } else {
          try {
            console.log(`Update time entry: ${timeEntry.start} ${timeEntry.description} Workspace: ${oldWid} => ${config.Toggl.workspaceId} ProjectID: ${oldPid} => ${newProjectId}`)
            
            // For some reason, I am unable to change the PID and WID as it gives me the following error message.
            //  - Conflict with project/workspace: project needs to be in the same workspace as the time entry
            // See: https://github.com/toggl/toggl_api_docs/issues/330
            // Unset current PID.
            if (timeEntry.pid) {
              let result = await toggl.updateTimeEntryAsync(timeEntry.id, { pid: null })
            }

            // Set new WID and PID.
            let result2 = await toggl.updateTimeEntryAsync(timeEntry.id, { wid: config.Toggl.workspaceId, pid: newProjectId })
          } catch (errorUpdate) {
            console.error('Error Updating: ', errorUpdate)

            // Can return a 429 Code if too many updates at once.
            if (errorUpdate.code === 429) {
              // Roll back the loop 1 record and try again.
              console.log(`Don't worry retrying in 1 second.`)
              i--
              await delay(1000)
              continue
            }
            
            //await toggl.updateTimeEntryAsync(timeEntry.id, { wid: timeEntry.wid, pid: timeEntry.pid })
          }
        }
      }
    } catch (error) {
      console.error('Failed to get time entries.', error)
    }
  } while (fromMoment.diff(presentTime) <= 0)

  console.log(`Finished with ${fromMoment.toISOString()} started processing date time ${presentTime.toISOString()}`)
}
