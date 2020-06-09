const events = require('../MyEventEmitter')
const activeCollab = require('../MyActiveCollabClient')
const config = require('../MyConfig')
const fs = require('fs') // Note: As of Node.js v10.0.0 there are fsPromises available through promises method.
const Promise = require('bluebird')
const writeFileAsync = Promise.promisify(fs.writeFile)

const moment = require('moment')
const path = require('path')

var TimeEntriesRetrieveDuration = moment.duration(
  config.TimeEntriesRetrieveDuration || { weeks: 2 }
)

const {
  timeMappings,
  clientMappings,
  projectMappings
} = require('../MyMappings')

// Note: Could set the plugin config to have a different font if needed.
// "fontFamily": "\"Trebuchet MS\", Arial, Helvetica, sans-serif"
module.exports = {
  init: function (pluginConfig) {
    // Work around if webUrl not set in config.
    if (config.ActiveCollab.webUrl === undefined) {
      config.ActiveCollab.webUrl = config.ActiveCollab.apiUrl.replace(
        'api.php',
        'index.php'
      )
    }

    events.on('timeEntrySyncResults', async function (syncResults) {
      // TODO: Write out a formatted HTML of the sync results with links through to appropriate places for time entries.
      var output = `<!DOCTYPE html>
<html>
<head><title>Time Sync Summary ${moment().format(
    'DD/MM/YYYY h:mm:ss a'
  )}</title>
<style>
body {
    font-family: "${pluginConfig.fontFamily || 'monospace'};
    font-size: ${pluginConfig.fontSize || '8pt'};
}

xmp {
    font-family: "${pluginConfig.fontFamily || 'monospace'};
    font-size: ${pluginConfig.fontSize || '8pt'};
    margin: 0px 0px;
    white-space:pre-wrap;
    word-wrap:break-word;
}

table {
    border-collapse: collapse;
    width: 100%;
}

table td, table th {
    border: 1px solid #ddd;
    padding: 2px;
    margin: 0px 0px;
    white-space:pre-wrap;
    word-wrap:break-word;
}

table tr:nth-child(even){background-color: #f2f2f2;}

table tr:hover {background-color: #ddd;}

table th {
    padding-top: 2px;
    padding-bottom: 2px;
    text-align: left;
    background-color: #4CAF50;
    color: white;
}
</style>
<body>
`

      if (syncResults.error) {
        output += `
<h1>Error</h1>
<xmp>${syncResults.error}</xmp>
`
      }

      // Reduce the array of id's to an object key with true value for fast checks.
      // So it looks like this where <togglId> is substituted as appropriate.
      // {
      //   <togglId>: true
      // }
      syncResults.recent = []
      let receivedTogglIds = syncResults.togglIdsReceived.reduce(
        (obj, item) => {
          obj[item] = true
          return obj
        },
        {}
      )

      // Gather previous synced time entries that were not retreived again, unless they are older than our range.
      var TimeEntriesRetrieveDurationMS = TimeEntriesRetrieveDuration.asMilliseconds()
      await timeMappings.eachAsync(async function (oldTimeEntry) {
        // If a previous mapped time entry was not processed this time around.
        // if (receivedTogglIds[oldTimeEntry.togglId] === true) {
        //   return
        // }

        // But not if the entry is considered too old to delete (older of the TimeEntriesRetrieveDuration from now).
        if (
          syncResults.toMoment.diff(moment(oldTimeEntry.date, 'YYYY/MM/DD')) >=
          TimeEntriesRetrieveDurationMS
        ) {
          return
        }

        syncResults.recent.push({
          summary: 'Success',
          timeEntry: oldTimeEntry
        })
      })

      output += `
<h1>Summary</h1>
Exported: ${moment().format('DD/MM/YYYY h:mm:ss a')}<br>
Range: ${syncResults.fromMoment.format(
    'DD/MM/YYYY h:mm:ss a'
  )} - ${syncResults.toMoment.format('DD/MM/YYYY h:mm:ss a')}
 <a target="blank" href="https://toggl.com/app/reports/summary/${
  config.Toggl.workspaceId
}/from/${syncResults.fromMoment.format(
  'YYYY-MM-DD'
)}/to/${syncResults.toMoment.format(
  'YYYY-MM-DD'
)}">Toggl Report on Range</a> |
 <a target="blank" href="https://toggl.com/app/reports/summary/${
  config.Toggl.workspaceId
}/period/prevWeek">Toggl Report on Previous Week</a>
 <br>
Failed: ${syncResults.failed.length}<br>
Deleted: ${syncResults.deleted.length}<br>
Ignored: ${syncResults.ignored.length}<br>
Synced: ${syncResults.synced.length}<br>
Recent: ${syncResults.recent.length}<br>
`

      var keys = ['failed', 'deleted', 'ignored', 'synced', 'recent']
      keys.forEach(key => {
        if (syncResults[key].length === 0) {
          return
        }
        output += `<h1>${key} (${syncResults[key].length})</h1>`

        output += `<table>
<tr>
    <th>Date</th>
    <th>Reason</th>
    <th>Client</th>
    <th>Project</th>
    <th>Issue Number</th>
    <th>Summary</th>
    <th>Duration</th>
    <th>Actions</th>
</tr>`

        syncResults[key].forEach(result => {
          // Ignore summarys we do not care about showing.
          if (
            (key !== 'recent' && result.summary === 'Time entry unchanged.') ||
            result.summary === 'Skipped.'
          ) {
            return
          }

          var projectName = ''
          let projectMapping
          if (result.timeEntry.pid) {
            projectMappings.getRecord(result.timeEntry.pid)
          } else if (result.timeEntry.activeCollabProjectId) {
            projectMapping = projectMappings.find(mapping => {
              return (
                mapping.activeCollabProjectId ===
                result.timeEntry.activeCollabProjectId
              )
            })
          }
          let clientMapping
          if (projectMapping) {
            projectName = projectMapping.activeCollabName
            var togglColorHex = projectMapping.togglColorHex || '#000000'

            var clientName = ''
            if (projectMapping.togglClientId) {
              clientMapping = clientMappings.getRecord(
                projectMapping.togglClientId
              )
            } else if (projectMapping.activeCollabProjectId) {
              // A work-around for historical records that did not include the togglClientId on the project.
              clientMapping = clientMappings.find(mapping => {
                return (
                  mapping.activeCollabId ===
                  projectMapping.activeCollabCompanyId
                )
              })
            }

            if (clientMapping) {
              clientName = clientMapping.activeCollabName
            }
          }

          output += `
<tr data-togglId="${result.timeEntry.togglId}" data-activeCollabId="${
  result.timeEntry.activeCollabId
}">
<td>${result.timeEntry.date}<br>${moment(
  result.timeEntry.date,
  'YYYY/MM/DD'
).format('ddd, DD MMM')}</td>
<td>${result.summary}</td>`

          if (clientMapping) {
            output += `<td><span style="color: ${togglColorHex}">${clientName}</span></td>`
          } else {
            output += `<td></td>`
          }

          if (projectMapping) {
            output += `<td><span style="color: ${togglColorHex}">${projectName}</span></td>`
          } else {
            output += `<td></td>`
          }

          var durationSeconds = result.timeEntry.duration //rresult.timeEntry.activeCollabId !== undefined ? result.timeEntry.duration : result.timeEntry.duration * 3600

          output += `
<td>${
  result.timeEntry.issueNumber
    ? '#' + result.timeEntry.issueNumber
    : ''
}</td>`
output += `<td>${result.timeEntry.billable ? '<small>$ Billable</small><br>' : ''}${result.timeEntry.tags !== undefined && result.timeEntry.tags.length > 0 ? "<small><span>"+result.timeEntry.tags.join('</span><span>')+"</span></small><br>" : ''}${result.timeEntry.collatedTimeEntries !== undefined ? '<small>Collated ('+result.timeEntry.collatedTimeEntries.length+')</small>' : ''}<xmp>${result.timeEntry.summary || result.timeEntry.description || ''}</xmp>${result.timeEntry.timeModified ? '<br><small>Time was modified ' + result.timeEntry.timeModified + '</small>': '' }</td>`
output += `<td>${moment.utc(durationSeconds*1000).format('HH:mm:ss')}</td>
<td>
`

          if (
            result.timeEntry.activeCollabProjectId !== undefined &&
            result.timeEntry.issueNumber !== undefined
          ) {
            if (result.summary.startsWith('Task not found')) {
              output += `<a target="blank" href="${
                config.ActiveCollab.webUrl
              }?path_info=projects/${
                result.timeEntry.activeCollabProjectId
              }/tasks">View Project</a>`
            } else {
              output += `<a target="blank" href="${
                config.ActiveCollab.webUrl
              }?path_info=projects/${
                result.timeEntry.activeCollabProjectId
              }/tasks/${result.timeEntry.issueNumber}">View Ticket</a>`
            }
          }
          output += `
        </td>
        </tr>
        `
          // ${result.timeEntry.date}
        })

        output += `</table>`
      })

      // output += `<iframe Application="Yes" width="100%" height="1024px" src="https://toggl.com/app/reports/summary/${config.Toggl.workspaceId}/from/${syncResults.fromMoment.format('YYYY-MM-DD')}/to/${syncResults.toMoment.format('YYYY-MM-DD')}"></iframe>`

      output += `
</body>
</html>
`

      // TODO: Would be nice to include all synced time entry records within he configured period.

      var outputFilePath =
        path.relative(process.cwd(), config.DataDirectory) + '/summary.html'
      if (pluginConfig.outputFile) {
        outputFilePath = pluginConfig.outputFile
      }

      await writeFileAsync(outputFilePath, output)
    })
  }
}
