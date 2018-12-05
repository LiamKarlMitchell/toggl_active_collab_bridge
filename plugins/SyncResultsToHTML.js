const events = require('../MyEventEmitter')
const activeCollab = require('../MyActiveCollabClient')
const config = require('../MyConfig')
const fsPromises = require('fs').promises
const moment = require('moment')
const path = require('path')

module.exports = {
  init: function (pluginConfig) {
    events.on('timeEntrySyncResults', async function (syncResults) {
      // TODO: Write out a formatted HTML of the sync results with links through to appropriate places for time entries.
      var output = `<!DOCTYPE html>
<html>
<head><title>Time Sync Summary ${moment().format('DD/MM/YYYY h:mm:ss a')}</title>
<style>
table {
    font-family: "Trebuchet MS", Arial, Helvetica, sans-serif;
    border-collapse: collapse;
    width: 100%;
}

table td, table th {
    border: 1px solid #ddd;
    padding: 4px;
}

table tr:nth-child(even){background-color: #f2f2f2;}

table tr:hover {background-color: #ddd;}

table th {
    padding-top: 3px;
    padding-bottom: 3px;
    text-align: left;
    background-color: #4CAF50;
    color: white;
}


/* Style the tab */
.tab {
    overflow: hidden;
    border: 1px solid #ccc;
    background-color: #f1f1f1;
}

/* Style the buttons inside the tab */
.tab button {
    background-color: inherit;
    float: left;
    border: none;
    outline: none;
    cursor: pointer;
    padding: 14px 16px;
    transition: 0.3s;
    font-size: 17px;
}

/* Change background color of buttons on hover */
.tab button:hover {
    background-color: #ddd;
}

/* Create an active/current tablink class */
.tab button.active {
    background-color: #ccc;
}

/* Style the tab content */
.tabcontent {
    display: none;
    padding: 6px 12px;
    -webkit-animation: fadeEffect 1s;
    animation: fadeEffect 1s;
}

/* Fade in tabs */
@-webkit-keyframes fadeEffect {
    from {opacity: 0;}
    to {opacity: 1;}
}

@keyframes fadeEffect {
    from {opacity: 0;}
    to {opacity: 1;}
}
</style>
<body>
`

      if (syncResults.error) {
        output += `
<h1>Error</h1>
<pre>${syncResults.error}</pre>
`
      }

      output += `
<h1>Summary</h1>
Exported: ${moment().format('DD/MM/YYYY h:mm:ss a')}<br>
Range: ${syncResults.fromMoment.format('DD/MM/YYYY h:mm:ss a')} - ${syncResults.toMoment.format('DD/MM/YYYY h:mm:ss a')}
 <a target="blank" href="https://toggl.com/app/reports/summary/${config.Toggl.workspaceId}/from/${syncResults.fromMoment.format('YYYY-MM-DD')}/to/${syncResults.toMoment.format('YYYY-MM-DD')}">Toggl Report on Range</a> |
 <a target="blank" href="https://toggl.com/app/reports/summary/${config.Toggl.workspaceId}/period/prevWeek">Toggl Report on Previous Week</a>
 <br>
Failed: ${syncResults.failed.length}<br>
Deleted: ${syncResults.deleted.length}<br>
Ignored: ${syncResults.ignored.length}<br>
Synced: ${syncResults.synced.length}<br>
`

      var keys = ['failed', 'deleted', 'ignored', 'synced']
      keys.forEach(key => {
        if (syncResults[key] === undefined) {
          return
        }

        output += `<h1>${key} (${syncResults[key].length})</h1>`

        output += `<table>
<tr>
    <th>Date</th>
    <th>Reason<th>
    <th>Issue Number</th>
    <th>Summary</th>
    <th>Duration</th>
    <th>Actions</th>
</tr>`

        syncResults[key].forEach(result => {
          output += `
        <tr data-togglId="${result.timeEntry.togglId}" data-activeCollabId="${result.timeEntry.activeCollabId}">
        <td>${result.timeEntry.date}</td>
        <td>${result.summary}</td>
        <td>#${result.timeEntry.issueNumber}</td>
        <td>${result.timeEntry.summary}</td>
        <td>${result.timeEntry.duration}</td>
        <td>
            `

          if (result.timeEntry.activeCollabProjectId !== undefined && result.timeEntry.issueNumber !== undefined) {
            output += `<a href="https://support.triotech.co.nz/public/index.php?path_info=projects/${result.timeEntry.activeCollabProjectId}/tasks/${result.timeEntry.issueNumber}">View Ticket</a>`
          }
          output += `
        </td>
        </tr>
        `
          // ${result.timeEntry.date}
        })

        output += `</table>`
      })

      //output += `<iframe Application="Yes" width="100%" height="1024px" src="https://toggl.com/app/reports/summary/${config.Toggl.workspaceId}/from/${syncResults.fromMoment.format('YYYY-MM-DD')}/to/${syncResults.toMoment.format('YYYY-MM-DD')}"></iframe>`
      
      output += `
</body>
</html>
`

      // Ignore summarys we do not care about showing.
      // if (result.summary === 'Time entry unchanged.' || result.summary === 'Skipped.') {
      //     return
      //   }

      var outputFilePath = path.relative(process.cwd(), config.DataDirectory) + '/summary.html'
      if (pluginConfig.outputFile) {
        outputFilePath = pluginConfig.outputFile
      }

      await fsPromises.writeFile(outputFilePath, output)
    })
  }
}
