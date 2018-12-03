const moment = require('moment-timezone')
const path = require('path')

const activeCollab = require('./MyActiveCollabClient')
const toggl = require('./MyTogglClient')

const schedule = require('node-schedule')
const AsyncSingleInstance = require('./AsyncSingleInstance')
const config = require('./MyConfig')
const argv = require('./MyCommandLineArguments')

var TimeEntriesRetrieveDuration = moment.duration(
  config.TimeEntriesRetrieveDuration || { weeks: 2 }
)

const TogglMapping = require('./TogglMapping')
var timeMappings = new TogglMapping(
  path.join(config.DataDirectory, 'MappedRecords'),
  'time',
  {
    // TODO: Deletion of old file records.
    // Delete old records that we are not interested in after 2 months?
    // Base this off the date timestamp stored in file name?
    // deleteAfter: { months: 2 }
  }
)

var clientMappings = new TogglMapping(
  path.join(config.DataDirectory, 'MappedRecords'),
  'client'
)

var projectMappings = new TogglMapping(
  path.join(config.DataDirectory, 'MappedRecords'),
  'project'
)

const NodeCache = require('node-cache')
const projectTasksCache = new NodeCache({
  useClones: false,
  deleteOnExpire: true,
  stdTTL: config.projectTasksCacheTTLSeconds || 300 // 5 Minutes retention TTL is in seconds.
})

Main()
  .then(result => {
    console.log(result)
  })
  .catch(err => {
    console.error(err, err.stack)
  })

/* Application Specific methods/tasks. */

// Ensure these operations do not execute whilst they are already operating.
const singleInstanceSyncCompanies = new AsyncSingleInstance(SyncCompanies)
const singleInstanceSyncProjects = new AsyncSingleInstance(SyncProjects)
const singleInstanceSyncTimeEntries = new AsyncSingleInstance(SyncTimeEntries)

// Run our initial start up checks and initial syncs.
// The sequental calling and order of these operations is intended.
async function Main () {
  await ConfigCheck()
  await LoadMappings()
  await singleInstanceSyncCompanies.run()
  await singleInstanceSyncProjects.run()
  await singleInstanceSyncTimeEntries.run()
  await InitScheduledTasks()
}

async function ConfigCheck () {
  if (config.verbose) {
    argv.verbose = config.verbose
  }

  if (argv.verbose) {
    console.log(`Config Check`)
  }

  // We require the workspaceId in toggl to be set.
  if (!config.Toggl.workspaceId) {
    // If workspace name is given in the config we can attempt to look up the id.
    if (config.Toggl.workspace) {
      console.log(
        `Attempting to find Toggl workspace id for '${config.Toggl.workspace}'.`
      )

      // Get the Toggl work spaces and find workspace id.
      let workspaces = await toggl.getWorkspacesAsync()

      // Get the workspaceId based on workspace name.
      for (let index = 0; index < workspaces.length; ++index) {
        let workspace = workspaces[index]
        if (workspace.name === config.Toggl.workspace) {
          config.Toggl.workspaceId = workspace.id
          console.log(
            `Toggl workspace id found '${
              config.Toggl.workspace
            }' you should set Toggl.workspaceId in your config to ${
              workspace.id
            }.`
          )
          break
        }
      }

      if (!config.Toggl.workspaceId) {
        throw new Error(
          'Expecting config.Toggl.workspaceId to be set. Please get the id from the URL on the appropriate Toggl workspace page.'
        )
      }
    } else {
      throw new Error(
        'Expecting config.Toggl.workspaceId to be set. Please get the id from the URL on the appropriate Toggl workspace page.'
      )
    }
  }

  // We also require other settings.
  if (
    !config.togglToActiveCollabUserMapping ||
    Object.keys(config.togglToActiveCollabUserMapping).length === 0
  ) {
    // Be helpful, list out the Toggl workspace users.
    var togglWorkspaceUsers = await toggl.getWorkspaceUsersAsync(
      config.Toggl.workspaceId,
      true
    )
    togglWorkspaceUsers.forEach(user => {
      console.log(`ID: ${user.id} Name: ${user.fullname} Email: ${user.email}`)
    })

    // Note: We could get users from active collab, and guess mapping to toggl ones by name match?
    // We would need to know the Company name or id however.
    // people/PeopleId/users

    throw new Error(
      "Expecting config.togglToActiveCollabUserMapping to map the Toggl User ID's to Active Collab User ID's.\nExample: { \"4118110\": 315 }"
    )
  }
}

/**
 * Load historical record mappings for comparison.
 */
async function LoadMappings () {
  await clientMappings.load()
  await projectMappings.load()
  await timeMappings.load()
}

/**
 * Copy the companies from Active Collab as Toggl Clients.
 */
async function SyncCompanies () {
  var activeCollabCompanies = await activeCollab.companies()
  for (let index = 0; index < activeCollabCompanies.length; ++index) {
    // TODO: A way to skip specific records?
    // TODO: Exclude specific companies.
    let companyInfo = activeCollabCompanies[index]

    let clientMapping = await TogglTryCreateClient(companyInfo)
    await clientMappings.store(clientMapping.togglId, clientMapping)
  }
}

/**
 * Copy the projects from Active Collab as Toggl Projects.
 */
async function SyncProjects () {
  var activeCollabProjects = await activeCollab.projects()
  for (let index = 0; index < activeCollabProjects.length; ++index) {
    // TODO: A way to skip specific records?
    // TODO: Exclude projects for specific companies.
    let projectInfo = activeCollabProjects[index]

    let projectMapping = await TogglTryCreateProject(projectInfo)
    await projectMappings.store(projectMapping.togglId, projectMapping)
  }
}

async function processTimeEntrySyncResults (results) {
  console.log('Sync finished with results.', new Date())
}

async function processTimeEntrySyncError (error) {
  console.error('Error syncing time entries: ', error)
}

async function processSyncCompaniesAndProjectsError (error) {
  console.error('Error syncing companies/projects: ', error)
}

async function InitScheduledTasks () {
  // Sync Companies and Projects.
  schedule.scheduleJob(
    config.Schedule.CompaniesAndProjects || '0 * * * *',
    function SyncCompaniesAndProjectsScheduledJob () {
      singleInstanceSyncCompanies.run()
        .then(singleInstanceSyncProjects.run())
        .catch(processSyncCompaniesAndProjectsError)
    }
  )

  // Sync Time Entries.
  schedule.scheduleJob(
    config.Schedule.TimeEntries || '*/5 * * * *',
    function SyncTimeEntriesScheduledJob () {
      singleInstanceSyncTimeEntries.run()
        .then(processTimeEntrySyncResults)
        .catch(processTimeEntrySyncError)
    }
  )
}

/* Misc utility functions. */

/**
 * Used to prevent null or undefined showing up when dealing with optional values.
 * @param {*} value
 */
function toEmptyStringOrValue (value) {
  if (value === null || value === undefined) {
    return ''
  }

  return value
}

/* Helper Methods to sync to Toggl from Active Collab. */

/**
 * Attempt to create a Client in Toggl.
 * If a previous mapping record is found then it will be used.
 * Otherwise create the Client and store a mapping record.
 * @param {*} clientInfo
 */
async function TogglTryCreateClient (clientInfo) {
  // Get from mapping if already there we can just return if unmodified.
  var previousMapping = clientMappings.find(function (mappedClientRecord) {
    return mappedClientRecord.activeCollabId === clientInfo.id
  })

  // Check if record would be same as what we already mapped.
  // If so we can return doing nothing.
  if (
    previousMapping &&
    previousMapping.activeCollabName === clientInfo.name &&
    previousMapping.activeCollabId === clientInfo.id
  ) {
    // Note: We are assumign Toggl client has not changed.
    return previousMapping
  }

  let clientMapping = await TogglCreateClient(clientInfo)

  await clientMappings.store(clientMapping.togglId, clientMapping)

  return clientMapping
}

var tempCache = {}

/**
 * Create a Client in Toggl.
 * Returns the Client Mapping.
 * @param {*} clientInfo
 */
async function TogglCreateClient (clientInfo) {
  // Relevant documentation:
  // http://7eggs.github.io/node-toggl-api/TogglClient.html#createClient
  // https://github.com/toggl/toggl_api_docs/blob/master/chapters/clients.md
  // https://activecollab.com/help-classic/books/api/people
  try {
    var result = await toggl.createClientAsync({
      name: clientInfo.name, // Name required and should be unique per workspace.
      wid: config.Toggl.workspaceId, // The workspace ID is required.
      notes: toEmptyStringOrValue(clientInfo.note)
    })
    if (argv.verbose > 5) {
      console.log(
        `Toggl Client created: ${clientInfo.name}, ${clientInfo.id} => ${
          result.id
        }.`
      )
    }

    var activeCollabTimestamp = clientInfo.updated_on
      ? clientInfo.updated_on.timestamp
      : clientInfo.created_on.timestamp

    var mapping = {
      sync: true,
      activeCollabName: clientInfo.name,
      activeCollabId: clientInfo.id,
      activeCollabLastUpdated: new Date(
        activeCollabTimestamp * 1000
      ).toISOString(),
      togglName: result.name,
      togglId: result.id,
      togglLastUpdated: new Date().toISOString() // Not as reliable, toggl does not seem to give us back the date last updated/created for the Client records.
    }

    return mapping
  } catch (err) {
    // Special handling if name already taken, get the existing one and map to it.
    if (
      err.code === 400 &&
      err.data.startsWith('Name has already been taken')
    ) {
      if (argv.verbose > 5) {
        console.log(`Client Name ${clientInfo.name} already taken getting it's information.`)
      }

      if (tempCache.clients === undefined) {
        clearTimeout(tempCache.clearClientsTimeout)
        tempCache.clearClientsTimeout = setTimeout(() => {
          delete tempCache.clients
        }, 300000) // Keep this for 5 minutes.
        tempCache.clients = await toggl.getClientsAsync()
      }

      for (let index = 0; index < tempCache.clients.length; index++) {
        var togglClient = tempCache.clients[index]
        if (
          togglClient.name === clientInfo.name &&
          togglClient.wid === config.Toggl.workspaceId
        ) {
          activeCollabTimestamp = clientInfo.updated_on
            ? clientInfo.updated_on.timestamp
            : clientInfo.created_on.timestamp
          return {
            sync: true,
            activeCollabName: clientInfo.name,
            activeCollabId: clientInfo.id,
            activeCollabLastUpdated: new Date(
              activeCollabTimestamp * 1000
            ).toISOString(),
            togglName: togglClient.name,
            togglId: togglClient.id,
            togglLastUpdated: new Date().toISOString()
          }
        }
      }
    }

    console.error(
      `Toggl Client create failed: ${clientInfo.name} ${err.code} ${err.data}.`
    )

    throw err
  }
}

/**
 * Attempt to create a Project in Toggl.
 * If a previous mapping record is found then it will be used.
 * Otherwise create the Project and store a mapping record.
 * @param {*} projectInfo
 */
async function TogglTryCreateProject (projectInfo) {
  // Get from mapping if already there we can just return the previous mapping if no updates are required.
  var previousMapping = projectMappings.find(function (mappedProjectRecord) {
    return mappedProjectRecord.activeCollabProjectId === projectInfo.id
  })

  // Check if record would be same as what we already mapped.
  // If so we can return doing nothing.
  if (
    previousMapping &&
    previousMapping.activeCollabName === projectInfo.name &&
    previousMapping.activeCollabClientId === projectInfo.clientId &&
    previousMapping.activeCollabProjectId === projectInfo.id
  ) {
    // Note: We are assumign Toggl project has not changed.
    return previousMapping
  }

  return TogglCreateProject(projectInfo)
}

/**
 * Create the project in Toggl and return the mapping.
 * @param {*} projectInfo
 */
async function TogglCreateProject (projectInfo) {
  // TODO: Decide if we want to ignore is_completed: 1 or by project state?

  var togglClientMapping = clientMappings.find(function (mappedClientRecord) {
    return mappedClientRecord.activeCollabId === projectInfo.company_id
  })

  if (!togglClientMapping) {
    throw new Error(
      `Toggl Client mapping not found for Active Collab Project ${
        projectInfo.name
      } ${projectInfo.company_id}.`
    )
  }

  try {
    var result = await toggl.createProjectAsync({
      name: projectInfo.name, // Note: Name should be unique for client and workspace (Not really a concern for my usage.)
      wid: config.Toggl.workspaceId,
      cid: togglClientMapping.togglId,
      active: true,
      is_private: false,
      // billable: true, // One day maybe...
      color: Math.floor(Math.random() * 15) // 15 colors. Taste the rainbow.
      // rate: 9001, // We don't use Rate.
    })
    if (argv.verbose > 5) {
      console.log(
        `Toggl Project created: ${projectInfo.name}, ${projectInfo.id} => ${
          result.id
        }.`
      )
    }

    var activeCollabTimestamp = projectInfo.updated_on
      ? projectInfo.updated_on.timestamp
      : projectInfo.created_on.timestamp

    var mapping = {
      sync: true,
      activeCollabName: projectInfo.name,
      activeCollabCompanyId: projectInfo.company_id,
      activeCollabProjectId: projectInfo.id,
      activeCollabLastUpdated: new Date(
        activeCollabTimestamp * 1000
      ).toISOString(),
      togglName: result.name,
      togglId: result.id,
      togglClientId: togglClientMapping.togglId,
      togglLastUpdated: result.at,
      togglColor: result.color,
      togglColorHex: result.hex_color
    }
    return mapping
  } catch (err) {
    // Special handling if name already taken, get the existing one and map to it.
    if (
      err.code === 400 &&
      err.data.startsWith('Name has already been taken')
    ) {
      if (argv.verbose > 5) {
        console.log(`Project Name ${projectInfo.name} already taken getting it's information.`)
      }

      let clientsProjects = await toggl.getClientProjectsAsync(
        togglClientMapping.togglId,
        'both'
      )

      for (let index = 0; index < clientsProjects.length; index++) {
        var togglProject = clientsProjects[index]
        if (
          togglProject.name === projectInfo.name &&
          togglProject.wid === config.Toggl.workspaceId
        ) {
          activeCollabTimestamp = projectInfo.updated_on
            ? projectInfo.updated_on.timestamp
            : projectInfo.created_on.timestamp
          return {
            sync: true,
            activeCollabName: projectInfo.name,
            activeCollabCompanyId: projectInfo.company_id,
            activeCollabProjectId: projectInfo.id,
            activeCollabLastUpdated: new Date(
              activeCollabTimestamp * 1000
            ).toISOString(),
            togglName: togglProject.name,
            togglId: togglProject.id,
            togglClientId: togglClientMapping.togglId,
            togglLastUpdated: togglProject.at,
            togglColor: togglProject.color,
            togglColorHex: togglProject.hex_color
          }
        }
      }
    }

    console.error(
      `Toggl Project create failed: ${projectInfo.name} ${err.code} ${
        err.data
      }.`
    )

    throw err
  }
}

/**
 * Return the tasks on an Active Collab project.
 * @param {*} activeCollabProjectId
 */
async function getActiveCollabProjectTasks (activeCollabProjectId) {
  var projectTasks = projectTasksCache.get(activeCollabProjectId)

  // If the Project Tasks were not found in the cache then get them from Active Collab and store them in the cache.
  if (projectTasks === undefined) {
    let activeCollabTasks = await activeCollab.tasks(activeCollabProjectId)

    // Reduce the array of objects down to key on task id.
    projectTasks = activeCollabTasks.reduce(function (obj, item) {
      obj[item.task_id] = item
      return obj
    }, {})

    projectTasksCache.set(activeCollabProjectId, projectTasks)
  }

  return projectTasks
}

// TODO: A way to sync over project active status if marked inactive in activeCollab.
// TODO: A way to deactivate clients and projects should they be deactivated in activeCollab.

/* Helper Methods to sync to Active Collab from Toggl. */

// Note: The TogglAPI may impose a rate limit I saw the following in their documentation.
// I have not actually encountered a limit however.
// TogglAPI: For rate limiting we have implemented a Leaky bucket.
// When a limit has been hit the request will get a HTTP 429 response and it's the task of the client to sleep/wait until bucket is empty.
// Limits will and can change during time, but a safe window will be 1 request per second.
// Limiting is applied per api token per IP, meaning two users from the same IP will get their rate allocated separately.

async function SyncTimeEntries () {
  console.time('SyncTimeEntries')

  var syncResults = {
    // Time entries we have ignored from syncing, although we still track their received id to omit those records from deletion if they were previously processed.
    // TODO: Consider if we want to delete time tracking records if they would be ignored but had previously been processed? I think we would.
    ignored: [],

    // Time entries we successfully synced. (TODO: Consider if we want to have added and updated as different?)
    synced: [],

    // Any time entrys we failed to process for many reasons.
    failed: [],

    // To contain mapping info of previous time entries that we deleted from activeCollab because they were no longer received by toggl in a recent query.
    deleted: [],
    togglIdsReceived: []
  }

  var startMoment = moment()
  try {
    let fromMoment = startMoment
      .clone()
      .subtract(TimeEntriesRetrieveDuration)

    if (argv.verbose) {
      console.log(
        `Getting time entries from ${fromMoment.toISOString()}`
      )
    }

    var timeEntries = await toggl.getTimeEntriesAsync(
      fromMoment.toISOString(),
      startMoment.toISOString()
    )
  } catch (error) {
    syncResults.error = error
    console.error('Failed to get time entries.', error)
    return syncResults
  }

  for (let index = 0; index < timeEntries.length; ++index) {
    let timeEntry = timeEntries[index]

    // Store the id's received.
    // We can iterate stored records later for ones not processed but not older than the time entry query duration to identify deletions we may need to make.
    syncResults.togglIdsReceived.push(timeEntry.id)

    let previousTimeEntryMapping = timeMappings.getRecord(timeEntry.id)

    // TODO: get last time entry mapping if possible.
    // timeEntry.id
    // Get the Project mapping if any.
    // Ignore if not set.
    if (argv.verbose > 5) {
      console.log(JSON.stringify(timeEntry, true, 2))
    }

    if (timeEntry.wid !== config.Toggl.workspaceId) {
      syncResults.ignored.push({
        summary: 'Not in workspace.',
        timeEntry: timeEntry
      })
      continue
    }

    // Note: Time zone of input date/time is in UTC we should convert it to NZDT for ActiveCollab...
    // TODO: Handle destination timezone, we can get this info as configured by user in /info endpoint?
    // See here for info on dealing with timezones, thankfully my local timezone is the same as what Active Collab is expecting....
    // https://stackoverflow.com/questions/15347589/moment-js-format-date-in-a-specific-timezone
    var date = moment.tz(timeEntry.start, 'UTC').format('YYYY/MM/DD').tz(config.timezone || 'Pacific/Auckland')
    timeEntry.date = date.format('YYYY/MM/DD')

    // If the time entry is currently running, then skip processing it for now.
    // If the time entry is currently running, the duration attribute contains a negative value, denoting the start of the time entry in seconds since epoch (Jan 1 1970).
    // The correct duration can be calculated as current_time + duration, where current_time is the current time in seconds since epoch.
    if (timeEntry.duration < 0) {
      syncResults.ignored.push({
        summary: `Time entry is currently running: ${timeEntry.id}.`,
        timeEntry: timeEntry
      })
      continue
    }

    // No description. Get outa here, we need a description to get the Ticket ID.
    if (!timeEntry.description) {
      syncResults.ignored.push({
        summary: 'No description.',
        timeEntry: timeEntry
      })
      continue
    }

    // Get the Issue # out of the time entry description.
    let issueNumber = null
    var match = timeEntry.description.match(/#(\d+)/)
    if (match === null) {
      syncResults.failed.push({
        summary: 'No issue number.',
        timeEntry: timeEntry
      })
      continue
    } else {
      issueNumber = match[1] * 1
      timeEntry.issueNumber = issueNumber
    }

    if (!timeEntry.pid) {
      syncResults.ignored.push({
        summary: 'No project set.',
        timeEntry: timeEntry
      })
      continue
    }

    let projectMapping = projectMappings.getRecord(timeEntry.pid)
    if (!projectMapping) {
      syncResults.failed.push({
        summary: 'Project not found in mapping.',
        timeEntry: timeEntry
      })
      continue
    }

    if (argv.verbose > 5) {
      console.log(`Project Mapping found ${projectMapping.activeCollabName}.`)
    }

    // Get active collab project tasks as needed.
    // This is cached.
    var projectTasks = await getActiveCollabProjectTasks(
      projectMapping.activeCollabProjectId
    )

    if (timeEntry.tid) {
      syncResults.ignored.push({
        summary:
          'Time Entries with a task id are not yet implemented in the sync.',
        timeEntry: timeEntry
      })
      continue
    }

    var activeCollabSummary = timeEntry.description.trim()

    var billable = timeEntry.billable

    // A work around to allow for billable time for this proof of concept.
    if (billable === false && activeCollabSummary.startsWith('$')) {
      billable = true
    }

    // Remove leading $ symbol if present and leading issue number and any white space after it.
    activeCollabSummary = activeCollabSummary.replace(/^\$?#\d+(\s+)?/, '')
    // TODO: Consider if there are any other characters or strings we must strip from the Active Collab summary.

    var duration = timeEntry.duration
    // Duration is in seconds.
    // We need it in decimal hours for Active Collab. Eg 1.5 is 1 hour 30 minutes it appears to have a 36 second minimum precision.
    duration = Math.max((Math.round(duration / 36) * 36) / 3600, 0.01).toFixed(
      2
    )

    // duration = (duration / 3600).toFixed(2); // toFixed rounds we might want to ceiling if there is a preference to not loose time but that charging more rounding up to a minute is ok?
    // Note: The precision in Active Collab only allows for (2 decimal places) the minimum value we can have is 0.01 so 36 seconds.
    // TODO: Consider if we should round nearest minute (or 36 second interval)?
    // Such as:
    // duration = ((Math.round(39 / 36)*36)/3600).toFixed(2);

    // Note: TODO: If previousTimeEntry at is older start of month we may want to do an additional check on it's status in activeCollab if billable or paid we wouldn't want to over-write it, this case should be an error.

    // Map the toggl uid to an active collab user id.
    var activeCollabUserId =
      config.togglToActiveCollabUserMapping[timeEntry.uid]
    if (activeCollabUserId === undefined) {
      syncResults.failed.push({
        summary: `User ID mapping not found for Time Entry UID: ${
          timeEntry.uid
        }.`,
        timeEntry: timeEntry
      })
      continue
    }

    var task = projectTasks[issueNumber]
    if (!task) {
      syncResults.failed.push({
        summary: `Task not found in in Active Collab for ${issueNumber} project ${projectMapping.activeCollabName}`,
        timeEntry: timeEntry
      })
      continue
    }

    if (argv.verbose > 5) {
      console.log(
        `Task found in Active Collab ${projectMapping.activeCollabName} ${
          task.id
        } ${task.name}`
      )
    }

    // TODO: Consider state of the task? Such as
    // is_completed:0
    // is_locked:false
    // visibility: 1
    if (task.isLocked) {
      console.warn(
        `Task ${issueNumber} is locked in Active Collab project ${projectMapping.activeCollabName} ${
          task.id
        } ${task.name}`
      )
    }

    // Template what we can on our time tracking mapping for storing if we add/update the record.
    var timeTrackingMapping = {
      togglId: timeEntry.id,

      date: date,
      summary: activeCollabSummary,
      at: timeEntry.at,
      billable: billable,
      duration: duration,

      activeCollabId: null,
      activeCollabUserId: activeCollabUserId, // TODO: Handle multiple user id's.
      activeCollabProjectId: projectMapping.activeCollabProjectId,
      issueNumber: issueNumber,

      // Just in-case include the time entry. This would most likely break our mapping check for if needing to update on disk...
      source: timeEntry,
      activeCollabResult: null
    }

    // If the time entry is still for the same project & issue number as previously mapped.
    if (previousTimeEntryMapping) {
      // If the previous mapping is the same project and issue number as the current timeEntry
      if (
        previousTimeEntryMapping.activeCollabProjectId ===
          projectMapping.activeCollabProjectId &&
        previousTimeEntryMapping.issueNumber === issueNumber
      ) {
        // And at least one of the fields we care about has changed.
        // Then trigger an update.
        if (
          previousTimeEntryMapping.summary !== activeCollabSummary ||
          previousTimeEntryMapping.duration !== duration ||
          previousTimeEntryMapping.date !== date ||
          previousTimeEntryMapping.billable !== billable
        ) {
          // We need to update the time entry.

          // TODO: Don't update if status was set to Billable or Paid. Track this as a Failed.
          //       I have decided that for my usage this won't be such an issue as we bill monthly and I won't be updating older records.

          try {
            if (argv.verbose) {
              console.log(
                `Updating time entry on ${
                  projectMapping.activeCollabName
                } #${issueNumber} ${
                  task.name
                } ${activeCollabSummary} ${date} ${duration}.`
              )
            }

            var trackingResult = await activeCollab.timeEdit(
              projectMapping.activeCollabProjectId,
              issueNumber,
              previousTimeEntryMapping.activeCollabId,
              {
                user_id: activeCollabUserId, // TODO: Handle multiple user id's.
                summary: activeCollabSummary,
                job_type_id: 1, // TODO: Job Types? No idea how to handle this maybe based off a tag or key word being present in the description.
                record_date: date,
                value: duration,
                billable_status: billable ? 1 : 0
              }
            )

            // Update the id just in-case. Although in reality it should not have changed.
            timeTrackingMapping.activeCollabId = trackingResult.id

            // Also storing the result from active collab just in-case.
            timeTrackingMapping.activeCollabResult = trackingResult
          } catch (error) {
            console.error(error)
            syncResults.failed.push({
              summary: `Error from Active Collab when updating a time tracking record. ${error}`,
              timeEntry: timeEntry
            })
            continue
          }

          // Store the time mapping.
          await timeMappings.store(timeEntry.id, timeTrackingMapping)
          continue
        } else {
          // No Change in the time entry we would record in Active collab.
          syncResults.ignored.push({
            summary: 'Time entry unchanged.',
            timeEntry: timeEntry
          })
          continue
        }
      } else {
        // We need to delete the previous time entry.

        // TODO: Don't delete if status was set to Billable or Paid. Treat this as an ignored but warn about it?
        // TODO: Don't delete if older than ??? Treat this as an ignored but warn about it?

        try {
          if (argv.verbose) {
            console.log(
              `Deleting time entry on ${previousTimeEntryMapping.summary} #${
                previousTimeEntryMapping.issueNumber
              }.`
            )
          }

          await activeCollab.timeDelete(
            previousTimeEntryMapping.activeCollabProjectId,
            previousTimeEntryMapping.issueNumber,
            previousTimeEntryMapping.activeCollabId
          )

          // Note: Intentionally not removing from mapping as we will over-write it next with a create new time entry action.
        } catch (error) {
          console.error(error)
          syncResults.failed.push({
            summary: `Error from Active Collab when deleting a time tracking record. ${error}`,
            timeEntry: timeEntry
          })
        }

        // Intentionally not continuing here as we would add a new record next.
      }
    }

    // We need to create a time entry.

    // TODO: Consider if syncing tracked time to Active Collab should be ran more frequently, out of phase with the import.
    //       It could happen that a tracked time record is updated as it is being updated/used which could cause a problem with loss of data?
    //       A state flag could aleviate this?
    //       Syncing appears to run fast enough at present to not worry about this actually.

    if (argv.verbose) {
      console.log(
        `Creating time entry on ${projectMapping.activeCollabName} #${task.id} ${
          task.name
        } ${activeCollabSummary} ${date} ${duration}.`
      )
    }

    // Note: Active Collab tasks have their own auto incrementing ID field, we want to use the issueNumber as the ticketId in calls to the API as that is what it expects.
    // Note: There is a risk of duplicated time entries being added here should the sync process bomb out before storing the mapping, I do not have a full solution to this problem yet.
    //       Could compare exact date and summary and check if other entry not mapped, but that is flawed if there are multiple.

    try {
      trackingResult = await activeCollab.timeAdd(
        projectMapping.activeCollabProjectId,
        issueNumber,
        {
          user_id: activeCollabUserId, // TODO: Handle multiple user id's.
          summary: activeCollabSummary,
          job_type_id: 1, // TODO: Job Types? No idea how to handle this maybe based off a tag or key word being present in the description.
          record_date: date,
          value: duration,
          billable_status: billable ? 1 : 0
        }
      )

      timeTrackingMapping.activeCollabId = trackingResult.id
      // Also storing the result from active collab just in-case.
      timeTrackingMapping.activeCollabResult = trackingResult
    } catch (error) {
      if (argv.verbose) {
        console.error(error)
      }
      syncResults.failed.push({
        summary: `Error from Active Collab when adding a time tracking record. ${error}`,
        timeEntry: timeEntry
      })
      continue
    }

    // Store the time mapping.
    await timeMappings.store(timeEntry.id, timeTrackingMapping)
  }

  // Reduce the array of id's to an object key with true value for fast checks.
  // So it looks like this where <togglId> is substituted as appropriate.
  // {
  //   <togglId>: true
  // }
  let receivedTogglIds = syncResults.togglIdsReceived.reduce((obj, item) => {
    obj[item] = true
    return obj
  }, {})

  // So the Toggl API will only return only the first 1000 time entries found.
  // We want to delete any non processed entries that were previously processed, as that means they have likely been deleted from Toggl.
  // I checked and time entries are returned ordered by start date time ascending order not by id or at.
  // So long as past entries are not being added in to push it to 1000 between syncs (unlikely) then things should be ok.
  if (timeEntries.length >= 1000) {
    console.warn(
      '1000 time entries returned, recommend to shorten your configured range for getting entries.'
    )
  }

  // Delete previous synced time entries that were not retreived again, unless they are older than our range.
  await timeMappings.eachAsync(async function (
    oldTimeEntry
  ) {
    // If a previous mapped time entry was not processed this time around.
    if (receivedTogglIds[oldTimeEntry.togglId] === true) {
      return
    }

    // But not if the entry is considered too old to delete (older of the TimeEntriesRetrieveDuration from now).
    if (
      startMoment.diff(moment(oldTimeEntry.date, 'YYYY/MM/DD')) >=
      TimeEntriesRetrieveDuration.asMilliseconds()
    ) {
      return
    }

    // Then delete it from ActiveCollab.
    try {
      await activeCollab.timeDelete(
        oldTimeEntry.activeCollabProjectId,
        oldTimeEntry.issueNumber,
        oldTimeEntry.activeCollabId
      )
    } catch (error) {
      if (argv.verbose) {
        console.error(error)
      }
      syncResults.failed.push({
        summary: `Error from Active Collab when deleting a time tracking record. ${error}`,
        timeEntry: oldTimeEntry
      })
    }

    try {
      await timeMappings.delete(oldTimeEntry.togglId)
    } catch (error) {
      console.error(error)
      syncResults.failed.push({
        summary: `Error from TogglMapping when deleting a time tracking record. ${error}`,
        timeEntry: oldTimeEntry
      })
    }
  })

  console.timeEnd('SyncTimeEntries')

  console.log(`
  Failed: ${syncResults.failed.length}
  Deleted: ${syncResults.deleted.length}
  Ignored: ${syncResults.ignored.length}
  Synced: ${syncResults.synced.length}
  `)

  // TODO: A better summary showing things like Project, Issue Number, Date, Summary
  summarizeSyncResultCategory(syncResults, 'ignored')
  summarizeSyncResultCategory(syncResults, 'failed')

  return syncResults
}

function summarizeSyncResultCategory (syncResults, key) {
  var results = syncResults[key]

  var output = `Summary of ${key} results: ${results.length}\n`
  results.forEach((result) => {
    if (result.summary === 'Time entry unchanged.') {
      return
    }

    var projectName = ''
    let projectMapping = projectMappings.getRecord(result.timeEntry.pid)
    if (projectMapping) {
      projectName = projectMapping.activeCollabName

      var clientName = ''
      let clientMapping = clientMappings.getRecord(projectMapping.togglClientId)
      if (clientMapping) {
        clientName = clientMapping.activeCollabName
      }
    }
    output += `${key} ${result.timeEntry.date} ${result.summary} ${clientName} ${projectName} #${result.timeEntry.issueNumber} ${result.timeEntry.description}\n`
  })

  // TODO: I wish this output to CSV or HTML actually.
  console.log(output)
}
// gBzJGckMYO4
