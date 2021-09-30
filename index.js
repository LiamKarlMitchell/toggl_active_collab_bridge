const moment = require('moment-timezone')
const path = require('path')

const activeCollab = require('./MyActiveCollabClient')
const toggl = require('./MyTogglClient')

const schedule = require('node-schedule')
const AsyncSingleInstance = require('./AsyncSingleInstance')
const config = require('./MyConfig')
const argv = require('./MyCommandLineArguments')

const eventEmitter = require('./MyEventEmitter')

var TimeEntriesRetrieveDuration = moment.duration(
  config.TimeEntriesRetrieveDuration || { weeks: 2 }
)
var TimeEntiresAfter = null
if (config.TimeEntiresAfter) {
  TimeEntiresAfter = moment(config.TimeEntiresAfter, 'YYYY/MM/DD')
}

const { timeMappings, clientMappings, projectMappings } = require('./MyMappings')

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

  var activeCollabToken = activeCollab.getToken()
  if (activeCollabToken === '') {
    try {
      await activeCollab.issueToken()
      var token = activeCollab.getToken()
      if (token === undefined || token === '') {
        console.error('Active Collab Token is not set!')
      }
      console.log(`Active Collab Token is: ${token} you may set this in your config file as key apiToken on the ActiveCollab object to persist it.`)
    } catch (e) {
      console.error('Unable to issue a token from Active Collab.')
      throw e
    }
  }
  await LoadPlugins()
  await LoadMappings()
  await eventEmitter.emit('startup')
  await singleInstanceSyncCompanies.run()
  await singleInstanceSyncProjects.run()
  await singleInstanceSyncTimeEntries.run()
  await InitScheduledTasks()
}

const plugins = []
async function LoadPlugins () {
  if (config.plugins) {
    Object.entries(config.plugins).sort((a, b) => {
      return (a[1].pluginOrder || 0) - (b[1].pluginOrder || 0)
    }).forEach(
      ([pluginName, pluginConfig]) => {
        var scriptName = pluginName
        pluginConfig.name = pluginName

        // Allow for multiple plugin config entries to exist.
        if (pluginConfig.scriptName) {
          scriptName = pluginConfig.scriptName
        }

        if (pluginConfig.enabled) {
          console.log(`Loading Plugin: ${pluginName}`)
          var plugin = require('./plugins/' + scriptName)
          if (plugin.init instanceof Function) {
            plugin.init(pluginConfig)
          }
          plugins.push(plugin)
        }
      }
    )
  }
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
      "Expecting config.togglToActiveCollabUserMapping to map the Toggl User ID's to Active Collab User ID's.\nExample: { \"2108110\": 925 }"
    )
  }

  if ( !config.ActiveCollab ) {
    throw new Error("Expecting config.ActiveCollab to be set.")
  }

  if ( !config.ActiveCollab.apiToken ) {
    console.info("Active Collab API token is not set.")
  }

  // TODO: Check other settings such as Self Hosted, Account ID, URL etc etc, although these are checked in the MyActiveCollabClient.js as well so may not need to check them here?

  if (config.redirectFilters !== undefined) {
    if (Array.isArray(config.redirectFilters) === false) {
      throw new Error('Expecting config.redirectFilters if set to be an array.')
    }

    config.redirectFilters.forEach(filter => {
      if (filter.targetIssueNumber === undefined) {
        if (filter.skipTimeEntryIfMatched) {
          // It's okay.
        } else {
          throw new Error('Expecting redirect filter to have a targetIssueNumber set.')
        }
      }
    })
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
  try {
    var response = await activeCollab.get('companies')
    if (response.statusText !== 'OK') {
      throw new Error('Getting companies did not return OK.')
    }
    var activeCollabCompanies = response.data
  } catch (e) {
    console.error('Unable to get companies from Active Collab')
    throw e
  }
  for (const company of activeCollabCompanies) {
    // TODO: A way to skip specific records?
    // TODO: Exclude specific companies.
    // Both of these can be done with a plugin if emitted here.
    // TODO: Ignore trashed and archived?
    // if (company.is_trashed) {
    //   continue;
    // }

    try {
      let clientMapping = await TogglTryCreateClient(company)
      await clientMappings.store(clientMapping.togglId, clientMapping)
    } catch (e) {
      console.error('Unable to save company as a client in Toggl.')
      throw e;
    }
  }
}

/**
 * Copy the projects from Active Collab as Toggl Projects.
 */
async function SyncProjects () {
  try {
    var response = await activeCollab.get('projects')
    if (response.statusText !== 'OK') {
      throw new Error('Getting projects did not return OK.')
    }
    var activeCollabProjects = response.data
  } catch (e) {
    console.error('Unable to get projects from Active Collab')
    throw e
  }

  // TODO: Resolve an issue where projects for archived clients are attempted to map.
  for (const project of activeCollabProjects) {
    // TODO: A way to skip specific records?
    // TODO: Exclude projects for specific companies.
    // TOOD: Ignore trashed and archived?
    // if (project.is_trashed || project.is_archived) {
    //   continue
    // }

    let projectMapping = await TogglTryCreateProject(project)
    if (projectMapping) {
      await projectMappings.store(projectMapping.togglId, projectMapping)
    }
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
    // Note: We are assuming Toggl client has not changed.
    return previousMapping
  } else if (previousMapping && previousMapping.activeCollabName !== clientInfo.name && previousMapping.activeCollabId === clientInfo.id) {
    // If the previous mapping exists, and the id matches but the name does not.
    // Then Update the cilent in Toggl and store the updated mapping.
    // If unable to update because name already exists then delete the previous mapping and attempt to create it again as another syncing may have already done this.
    try {
      let result = await toggl.updateClientAsync(previousMapping.togglId, {
        id: previousMapping.togglId,
        name: clientInfo.name, // Name required and should be unique per workspace.
        wid: config.Toggl.workspaceId, // The workspace ID is required.
        notes: toEmptyStringOrValue(clientInfo.note)
      })

      var activeCollabTimestamp = clientInfo.updated_on
          ? clientInfo.updated_on
          : clientInfo.created_on

      previousMapping.activeCollabLastUpdated = new Date(activeCollabTimestamp * 1000 ).toISOString()
      previousMapping.togglName = clientInfo.name
      previousMapping.togglLastUpdated = new Date().toISOString()

      return previousMapping
    } catch (e) {
      if (
          e.code === 400 &&
          (e.data.startsWith('Name has already been taken') || err.data.startsWith('Missing or invalid client ID'))
      ) {
        if (argv.verbose > 5) {
          console.log(`Client Name ${clientInfo.name} already exists in Toggl getting it's information and removing old mapping.`)
        }

        // Delete the previous mapping.
        await clientMappings.delete(previousMapping.togglId)

        // Continue on to create or get existing client in/from Toggl.
      } else {
        console.error(`Error updating toggl client.`, e)
        throw e
      }
    }
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
  // https://developers.activecollab.com/api-documentation/v1/people/companies/companies.html
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
      ? clientInfo.updated_on
      : clientInfo.created_on

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
            ? clientInfo.updated_on
            : clientInfo.created_on
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
  // If so we can return doing nothing. Note: Does not check billable status!
  if (
    previousMapping &&
    previousMapping.activeCollabName === projectInfo.name &&
    previousMapping.activeCollabCompanyId === projectInfo.company_id &&
    previousMapping.activeCollabProjectId === projectInfo.id
  ) {
    // Note: We are assuming the Toggl project has not changed.
    return previousMapping
  } else if (
      previousMapping &&
      previousMapping.activeCollabName !== projectInfo.name &&
      previousMapping.activeCollabProjectId === projectInfo.id
  ) {
    // If the previous mapping exists, and the id matches but the name or client do not.
    // Then Update the project in Toggl and store the updated mapping.
    // If unable to update because name already exists then delete the previous mapping and attempt to create it again as another syncing may have already done this.

    // Find mapping for the company id.
    //

    var clientMapping = clientMappings.find(function (mappedClientRecord) {
      return mappedClientRecord.activeCollabId === projectInfo.company_id
    })

    if (!clientMapping) {
      throw new Error(`Unable to find client mapping for active collab project ${projectInfo.name}`)
    }

    try {
      let result = await toggl.updateProjectAsync(previousMapping.togglId, {
        id: previousMapping.togglId,
        cid: clientMapping.togglId,
        name: projectInfo.name, // Name required and should be unique per workspace.
        wid: config.Toggl.workspaceId, // The workspace ID is required.
      })

      var activeCollabTimestamp = projectInfo.updated_on
          ? projectInfo.updated_on
          : projectInfo.created_on

      previousMapping.activeCollabLastUpdated = new Date(activeCollabTimestamp * 1000 ).toISOString()
      previousMapping.togglName = projectInfo.name
      previousMapping.togglLastUpdated = new Date().toISOString()

      return previousMapping
    } catch (e) {
      if (
          e.code === 400 &&
          (e.data.startsWith('Name has already been taken') || err.data.startsWith('Missing or invalid project ID'))
      ) {
        if (argv.verbose > 5) {
          console.log(`Project Name ${projectInfo.name} already exists in Toggl getting it's information and removing old mapping.`)
        }

        // Delete the previous mapping.
        await projectMappings.delete(previousMapping.togglId)

        // Continue on to create or get existing project in/from Toggl.
      } else {
        console.error(`Error updating toggl project.`, e)
        throw e
      }
    }
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
    console.error(
        `Toggl Client mapping not found for Active Collab Project ${
          projectInfo.name
        } ${projectInfo.company_id}.`
      )

      return null
  }

  try {
    var result = await toggl.createProjectAsync({
      name: projectInfo.name, // Note: Name should be unique for client and workspace (Not really a concern for my usage.)
      wid: config.Toggl.workspaceId,
      cid: togglClientMapping.togglId,
      active: true,
      is_private: false,
      billable: projectInfo.is_billable, // Note: Might not work in free version of Toggl?
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
      ? projectInfo.updated_on
      : projectInfo.created_on

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
            ? projectInfo.updated_on
            : projectInfo.created_on
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
    try {
      var result = await activeCollab.get(`projects/${activeCollabProjectId}/tasks`)
      if (result.statusText !== 'OK') {
        throw new Error(`Getting Active Collabs tasks for project ${activeCollabProjectId} returned a non OK status.`)
      }
      var activeCollabTasks = result.data.tasks || null

      // Additionally get any "Archived" (e.g. completed) tasks.
      var archivedResult = await activeCollab.get(`projects/${activeCollabProjectId}/tasks/archive`)
      if (result.statusText !== 'OK') {
        console.warn(`Getting Active Collabs Archived tasks for project ${activeCollabProjectId} returned a non OK status.`)
      } else {
        if (Array.isArray(archivedResult.data)) {
          if (activeCollabTasks === null) {
            activeCollabTasks = archivedResult.data
          } else {
            activeCollabTasks = activeCollabTasks.concat(archivedResult.data)
          }
        }
      }

    } catch (e) {
      console.error('Unable to get Active Collab tasks.')
      throw e
    }

    if (activeCollabTasks === null) {
      console.log(`No tasks found for Project ID: ${activeCollabProjectId}`);
      return [];
    }

    // TODO: Remove trashed tasks from the tasks array as to not add time to them?

    // Reduce the array of objects down to key on task number.
    projectTasks = activeCollabTasks.reduce(function (obj, item) {
      obj[item.task_number] = item
      return obj
    }, {})

    projectTasksCache.set(activeCollabProjectId, projectTasks)
  }

  return projectTasks
}

// TODO: A way to sync over project active status if marked inactive in activeCollab.
// TODO: A way to deactivate clients and projects should they be deactivated in activeCollab.

/* Helper Methods to sync to Active Collab from Toggl. */

async function applyRedirectFilter (timeEntry, previousTimeEntry) {
  if (config.redirectFilters) {
    // if (Array.isArray(timeEntry.tags) && timeEntry.tags.includes('DEBUG')) {
    //   debugger
    // }

    config.redirectFilters.some(filter => {
      // Pattern.
      if (filter.pattern && timeEntry.description.match(filter.pattern) === null) {
        return false
      }

      // TogglProjectId wild card or exact match.
      if (filter.togglProjectId && !(filter.toggglProjectId === '*' || timeEntry.pid === filter.togglProjectId)) {
        return false
      }

      // ProjectID wild card or exact match.
      if (filter.activeCollabProjectId && !(filter.activeCollabProjectId === '*' || timeEntry.activeCollabProjectId === filter.activeCollabProjectId)) {
        return false
      }

      // Project ID in array.
      if (filter.projects && Array.isArray(filter.projects) && filter.projects.includes(timeEntry.activeCollabProjectId) === false) {
        return false
      }

      if (filter.issueNumber !== undefined) {
        if (filter.issueNumber === null) {
          if (timeEntry.issueNumber !== null && timeEntry.issueNumber !== undefined) {
            return false
          }
        } else if (timeEntry.issueNumber !== filter.issueNumber) {
          return false
        }
      }

      // Includes tag from
      if (filter.tags) {
        if (Array.isArray(timeEntry.tags) === false) {
          return false
        } else if (Array.isArray(filter.tags)) {
          if (filter.tags.reduce((accumulator, tag) => {
            return (timeEntry.tags.indexOf(tag) > -1) ? accumulator + 1 : accumulator
          }, 0) !== filter.tags.length) {
            return false
          }
        } else if (timeEntry.tags.includes(filter.tags) === false) {
          return false
        }
      }

      if (filter.excludeTags && timeEntry.tags) {
        if (Array.isArray(filter.excludeTags) && filter.excludeTags.some(tag => {
          return timeEntry.tags.includes(tag)
        }) === true) {
          return false
        }
      }

      if (filter.skipTimeEntryIfMatched) {
        timeEntry.skip = true
      }

      // Fail if error on billable is set to true and timeEntry is marked as billable.
      if (filter.errorOnBillable === true && timeEntry.billable === true) {
        // Fail as billable would have been met by this filter.
        throw new Error('Filter error on billable. ' + timeEntry.date + ' ' + timeEntry.description)
      }

      // Over-ride values with the target values.
      if (filter.targetProjectId) {
        timeEntry.activeCollabProjectId = filter.targetProjectId
      }
      timeEntry.issueNumber = filter.targetIssueNumber
      timeEntry.redirectFilterApplied = true

      // Exit this loop as a filter is applied.
      return true
    })
  }
}

async function fireTagEvents (timeEntryMapping, previousTimeEntryMapping) {
  // Get new and previous tags if set.
  var newTags = timeEntryMapping.tags
  var previousTags = previousTimeEntryMapping ? previousTimeEntryMapping.tags : []
  // Work around tags not being set, if no tags set Toggl's tags key is not present.
  if (newTags === undefined) {
    newTags = []
  }
  if (previousTags === undefined) {
    previousTags = []
  }

  // Fire an event of tagAdded if a tag in newTags is not present in previousTags.
  // Fire an event of tagRemoved if a tag in previousTags is not present in newTags.
  newTags = newTags.reduce((obj, tag) => {
    obj[tag] = true
    return obj
  }, {})
  previousTags = previousTags.reduce((obj, tag) => {
    obj[tag] = true
    return obj
  }, {})

  for (let tag in previousTags) {
    if (newTags[tag] === undefined) {
      try {
        await eventEmitter.emit('tagRemoved', { tag: tag, mapping: timeEntryMapping, previousMapping: previousTimeEntryMapping })
      } catch (error) {
        console.error(`Error executing tagRemoved event: `, error)
      }
    }
  }

  for (let tag in newTags) {
    if (previousTags[tag] === undefined) {
      try {
        await eventEmitter.emit('tagAdded', { tag: tag, mapping: timeEntryMapping, previousMapping: previousTimeEntryMapping })
      } catch (error) {
        console.error(`Error executing tagadded event: `, error)
      }
    }
  }
}

// duration = (duration / 3600).toFixed(2); // toFixed rounds we might want to ceiling if there is a preference to not loose time but that charging more rounding up to a minute is ok?
// Note: The precision in Active Collab only allows for (2 decimal places) the minimum value we can have is 0.01 so 36 seconds.
// Duration is in seconds.
// We need it in decimal hours for Active Collab. Eg 1.5 is 1 hour 30 minutes it appears to have a 36 second minimum precision.
function durationSecondsToHours(seconds) {
  return Math.max((Math.round(seconds / 36) * 36) / 3600, 0.01).toFixed(
    2
  )
}

// Note: The TogglAPI may impose a rate limit I saw the following in their documentation.
// I have not actually encountered a limit however.
// TogglAPI: For rate limiting we have implemented a Leaky bucket.
// When a limit has been hit the request will get a HTTP 429 response and it's the task of the client to sleep/wait until bucket is empty.
// Limits will and can change during time, but a safe window will be 1 request per second.
// Limiting is applied per api token per IP, meaning two users from the same IP will get their rate allocated separately.

async function SyncTimeEntries () {
  //console.time('SyncTimeEntries')

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
    togglIdsReceived: [],

    // To contain tasks we reopened.
    tasksReopened: [],
  }

  var startMoment = moment()
  try {
    let fromMoment = startMoment
      .clone()
      .subtract(TimeEntriesRetrieveDuration)

    // If set in config, clamp the start date to this.
    if (TimeEntiresAfter !== null) {
      fromMoment = moment.max(fromMoment, TimeEntiresAfter)
    }

    if (argv.verbose) {
      console.log(
        `Getting time entries from ${fromMoment.toISOString()}`
      )
    }

    // TODO: Batch this into weeks to handle multiple users in same workspace better?
    syncResults.fromMoment = fromMoment
    syncResults.toMoment = startMoment
    var timeEntries = await toggl.getTimeEntriesAsync(
      fromMoment.toISOString(),
      startMoment.toISOString()
    )
  } catch (error) {
    //console.timeEnd('SyncTimeEntries')
    syncResults.error = error
    console.error('Failed to get time entries.', error)
    await eventEmitter.emit('timeEntrySyncResults', syncResults)
    return syncResults
  }

  // Apply some cleanups and initial values we want to parse out on all time entries.
  for (let index = 0; index < timeEntries.length; ++index) {
    let timeEntry = timeEntries[index]
    timeEntry.dataType = 'TimeEntry'

    if (timeEntry.tags === undefined) {
      timeEntry.tags = []
    }

    // No description. Get outa here, we need a description to get the Ticket ID.
    if (!timeEntry.description) {
      timeEntry.description = ''
    }

    // Get the Issue # out of the time entry description.
    var match = timeEntry.description.match(/#(\d+)/)
    if (match !== null) {
      timeEntry.issueNumber = match[1] * 1
    }

    // Insist that billable be true or false.
    if (timeEntry.billable === undefined) {
      timeEntry.billable = false
    }

    // A work around to allow for billable time for this proof of concept. // TODO: Make this a plugin?
    if (timeEntry.billable === false && timeEntry.description.startsWith('$')) {
      timeEntry.billable = true
    }

    // Parse the start date from Toggl as UTC then change timezone to configured for storing in Active Collab.
    let date = moment(timeEntry.start).tz(config.timezone || 'Pacific/Auckland')
    timeEntry.date = date.format('YYYY/MM/DD')

    // Allow for modifying a time entry before it is processed.
    await eventEmitter.emit('preProcessTimeEntry', { timeEntry: timeEntry, syncResults: syncResults })
  }

  // Allow for interacting with received time entries prior to processing them.
  await eventEmitter.emit('receivedTimeEntries', { timeEntries: timeEntries, syncResults: syncResults })

  for (let index = 0; index < timeEntries.length; ++index) {
    let timeEntry = timeEntries[index]

    if (timeEntry.wid !== config.Toggl.workspaceId) {
      // TODO: Fix error Cannot access 'deletePreviousTimeEntryMapping' before initialization
      //await deletePreviousTimeEntryMapping()
      syncResults.ignored.push({
        summary: 'Not in configured workspace.',
        timeEntry: timeEntry
      })
      continue
    }

    // If the time entry was collated we don't want to process the collated ones as the first one found will have the sum of duration & tags.
    if (timeEntry.collated) {
      continue
    }

    // Map the toggl uid to an active collab user id.
    var activeCollabUserId =
      config.togglToActiveCollabUserMapping[timeEntry.uid]
    if (activeCollabUserId === undefined) {
      // TODO: Fix error Cannot access 'deletePreviousTimeEntryMapping' before initialization
      // await deletePreviousTimeEntryMapping()
      syncResults.failed.push({
        summary: `Toggl to Active Collab User ID mapping not found for Time Entry UID: ${
          timeEntry.uid
        }.`,
        timeEntry: timeEntry
      })
      continue
    }

    // Store the id's received.
    // We can iterate stored records later for ones not processed but not older than the time entry query duration to identify deletions we may need to make.
    syncResults.togglIdsReceived.push(timeEntry.id)

    // Map to a project if possible.
    let projectMapping = projectMappings.getRecord(timeEntry.pid)
    if (projectMapping) {
      timeEntry.activeCollabProjectId = projectMapping.activeCollabProjectId
    }

    let previousTimeEntryMapping = timeMappings.getRecord(timeEntry.id)

    var previousTimeEntryDate = ''
    if (previousTimeEntryMapping !== null && previousTimeEntryMapping !== undefined) {
      // Set the date for previous record from the previousTimeEntryMapping.at if not set.
      if (previousTimeEntryMapping.date === undefined) {
        previousTimeEntryDate = moment(previousTimeEntryMapping.at).tz(config.timezone || 'Pacific/Auckland').format('YYYY/MM/DD')
      } else {
        previousTimeEntryDate = previousTimeEntryMapping.date
      }

      await eventEmitter.emit('beforeDeletePreviousTimeEntry', { timeEntry: timeEntry, previousTimeEntryMapping: previousTimeEntryMapping, syncResults: syncResults })
    }

    let deletePreviousTimeEntryMapping = async (deleteMappingRecord = true) => {
      if (previousTimeEntryMapping === null || previousTimeEntryMapping === undefined) {
        return
      }

      try {
        if (argv.verbose) {
          console.log(`Deleting previous time entry: ${previousTimeEntryDate} ${previousTimeEntryMapping.issueNumber} ${previousTimeEntryMapping.summary}`)
        }

        await activeCollab.put(`move-to-trash/time-record/${previousTimeEntryMapping.activeCollabId}`)
      } catch (error) {
        console.error(`Failed to delete previous time entry mapping: ${previousTimeEntryDate} ${previousTimeEntryMapping.issueNumber} ${previousTimeEntryMapping.summary}`, error.message, error.stack)
      }

      if (deleteMappingRecord) {
        // And from our mappings.
        await timeMappings.delete(previousTimeEntryMapping.togglId)
      }
    }

    // TODO: get last time entry mapping if possible.
    // timeEntry.id
    // Get the Project mapping if any.
    // Ignore if not set.
    if (argv.verbose > 5) {
      console.log(JSON.stringify(timeEntry, true, 2))
    }

    // if (Array.isArray(timeEntry.tags) && timeEntry.tags.includes('DEBUG')) {
    //   debugger
    // }

    if (timeEntry.tid) {
      await deletePreviousTimeEntryMapping()
      syncResults.ignored.push({
        summary:
          'Time Entries with a task id are not yet implemented in the sync.',
        timeEntry: timeEntry
      })
      continue
    }

    await eventEmitter.emit('onTimeEntry', { timeEntry: timeEntry, previousMapping: previousTimeEntryMapping, syncResults: syncResults })

    var activeCollabSummary = timeEntry.description.trim()

    // Remove leading $ symbol if present and leading issue number and any white space after it.
    activeCollabSummary = activeCollabSummary.replace(/^\$?#\d+(\s+)?/, '')
    // TODO: Consider if there are any other characters or strings we must strip from the Active Collab summary.

    timeEntry.activeCollabDuration = duration = durationSecondsToHours(timeEntry.duration)

    // Note: TODO: If previousTimeEntry at is older start of month we may want to do an additional check on it's status in activeCollab if billable or paid we wouldn't want to over-write it, this case should be an error.

    // Apply redirection filters if any.
    await applyRedirectFilter(timeEntry, previousTimeEntryMapping)
    await eventEmitter.emit('applyRedirectFilter', { mapping: timeEntry, previousMapping: previousTimeEntryMapping })

    if (timeEntry.redirectFilterApplied) {
      if (argv.verbose > 1) {
        console.log(`TimeEntry has a redirect filter applied.`)
      }

      if (projectMapping === null ||
        projectMapping === undefined ||
        projectMapping.activeCollabProjectId !== timeEntry.activeCollabProjectId) {
        // Get pid based off the filters applied activeCollabProjectId.
        projectMapping = projectMappings.find((_projectMapping) => {
          return _projectMapping.activeCollabProjectId === timeEntry.activeCollabProjectId
        })
      }

    } else {
      // If no filter result.
      if (!timeEntry.pid) {
        await deletePreviousTimeEntryMapping()
        syncResults.ignored.push({
          summary: 'No project set.',
          timeEntry: timeEntry
        })
        continue
      }
    }

    if (timeEntry.skip) {
      // If we are going to skip the time entry then we should delete the previous time entry mapping if one exists.
      await deletePreviousTimeEntryMapping()

      syncResults.ignored.push({
        summary: 'Skipped.',
        timeEntry: timeEntry
      })
      continue
    }

    if (!projectMapping) {
      await deletePreviousTimeEntryMapping()
      syncResults.failed.push({
        summary: 'Project not found in mapping.',
        timeEntry: timeEntry
      })
      continue
    }

    if (argv.verbose > 5) {
      console.log(`Project Mapping found ${projectMapping.activeCollabName}.`)
    }

    // If the time entry is currently running, then skip processing it for now.
    // If the time entry is currently running, the duration attribute contains a negative value, denoting the start of the time entry in seconds since epoch (Jan 1 1970).
    // The correct duration can be calculated as current_time + duration, where current_time is the current time in seconds since epoch.
    if (timeEntry.duration < 0) {
      await deletePreviousTimeEntryMapping()
      syncResults.ignored.push({
        summary: `Time entry is currently running: ${timeEntry.id} ${timeEntry.duration} TODO: Get duration propper ${moment.utc().add({seconds: timeEntry.duration}).format('HH:mm:ss')}.`,
        timeEntry: timeEntry
      })
      continue
    }

    if (timeEntry.duronly) {
      console.warn('Duration only time entries are not yet implemented.')
      await deletePreviousTimeEntryMapping()
      syncResults.ignored.push({
        summary: `Time entry is currently running: ${timeEntry.id} ${timeEntry.duration} TODO: Get duration propper ${moment.utc().add({seconds: timeEntry.duration}).format('HH:mm:ss')}.`,
        timeEntry: timeEntry
      })
      continue
    }


    if (activeCollabSummary === '') {
      await deletePreviousTimeEntryMapping()
      syncResults.ignored.push({
        summary: 'No description.',
        timeEntry: timeEntry
      })
      continue
    }

    if (timeEntry.issueNumber === undefined || timeEntry.issueNumber === null) {
      await deletePreviousTimeEntryMapping()
      syncResults.failed.push({
        summary: 'No issue number.',
        timeEntry: timeEntry
      })
      continue
    }

    // Get active collab project tasks as needed.
    // This is cached.
    var projectTasks = await getActiveCollabProjectTasks(
      projectMapping.activeCollabProjectId
    )

    var task = projectTasks[timeEntry.issueNumber]
    if (!task) {
      if (argv.verbose > 5) {
        console.log(`Task not found in in Active Collab for ${timeEntry.issueNumber} project ${projectMapping.activeCollabName}`)
      }

      // Try to re-open the task as it might not be included in list from API if completed for some reason...
      if (previousTimeEntryMapping && previousTimeEntryMapping.taskId > 0) {
        try {
          if (argv.verbose > 5) {
            console.log(`Attempt to reopen task in Active Collab ${previousTimeEntryMapping.issueNumber} project ${projectMapping.activeCollabName}`)
          }
          let response = await activeCollab.put(`/open/task/${previousTimeEntryMapping.taskId}`)

          task = response.data.single

          syncResults.tasksReopened.push(task)
          // TODO: Can we modify the cache in this way?
          projectTasks[timeEntry.issueNumber] = task

          // Well we reopened the task, keep on going.
        } catch (e) {
          // If failed to find/reopen the time entry then delete the existing mapping.
          if (e.response.status === 404) {
            await deletePreviousTimeEntryMapping()
          }
          syncResults.failed.push({
            summary: `Error from Active Collab when reopening the task got status ${e.response.status}. ${e}`,
            timeEntry: timeEntry
          })
          continue
        }
      } else {
        await deletePreviousTimeEntryMapping()
        syncResults.failed.push({
          summary: `Task not found in Active Collab for ${timeEntry.issueNumber} project ${projectMapping.activeCollabName}`,
          timeEntry: timeEntry
        })
        continue;
      }
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
        `Task ${timeEntry.issueNumber} is locked in Active Collab project ${projectMapping.activeCollabName} ${
          task.id
        } ${task.name}`
      )
    }

    if (timeEntry.billable === true && task.is_billable === false) {
      console.warn(
          `Task ${timeEntry.issueNumber} adding billable to a non billable ticket, behaviour unknown Active Collab project ${projectMapping.activeCollabName} ${
              task.id
          } ${task.name}`
      )
    }

    // Template what we can on our time tracking mapping for storing if we add/update the record.
    var timeEntryMapping = {
      togglId: timeEntry.id,
      dataType: 'TimeEntryMapping',

      date: timeEntry.date,
      summary: activeCollabSummary,
      at: timeEntry.at,
      billable: timeEntry.billable,
      duration: timeEntry.duration, // Store original seconds.
      activeCollabDuration: timeEntry.activeCollabDuration, // Store the hours duration we give to ActiveCollab

      activeCollabId: null,
      activeCollabUserId: activeCollabUserId, // TODO: Handle multiple user id's.
      activeCollabProjectId: projectMapping.activeCollabProjectId,

      taskId: task.id,
      issueNumber: timeEntry.issueNumber,

      // Store the tags ensure they are sorted, empty array if not set.
      tags: timeEntry.tags !== undefined ? timeEntry.tags.sort() : [],

      // Just in-case include the time entry. This would most likely break our mapping check for if needing to update on disk...
      source: timeEntry,
      activeCollabResult: null
    }

    // Store history of collated time entry id and durations for summary reasons.
    if (timeEntry.collatedTimeEntries !== undefined) {
      timeEntryMapping.collatedTimeEntries = timeEntry.collatedTimeEntries
    }

    if (timeEntryMapping.tags.includes('DEBUG')) {
      debugger
    }

    // If the time entry is still for the same project & issue number as previously mapped.
    if (previousTimeEntryMapping) {

      // Use a calculated value in the comparison, in-case we change duration rounding/calculation. // TODO: Make this a function.
      var previousDuration = durationSecondsToHours(previousTimeEntryMapping.duration)

      // If the previous mapping is the same project and issue number as the current timeEntry
      if (
        previousTimeEntryMapping.activeCollabProjectId ===
          projectMapping.activeCollabProjectId &&
        previousTimeEntryMapping.issueNumber === timeEntry.issueNumber
      ) {
        // Check tags.
        // A work-around for old data not including tags array can probably remove it in the future.
        var previousTags = previousTimeEntryMapping.tags || []
        var tagsChanged = false
        if (previousTags.length !== timeEntryMapping.tags.length) {
          tagsChanged = true
        } else {
          // The tags arrays have same length check if entries are different. Is sorted so should be fine.
          for (let i = 0; i < timeEntryMapping.tags.length; i++) {
            if (previousTags[i] !== timeEntryMapping.tags[i]) {
              tagsChanged = true
              break
            }
          }
        }

        // And at least one of the fields we care about has changed.
        // Then trigger an update.
        if (
          previousTimeEntryMapping.summary !== activeCollabSummary ||
          previousDuration !== duration ||
          previousTimeEntryDate !== timeEntry.date ||
          previousTimeEntryMapping.billable !== timeEntry.billable ||
          tagsChanged === true
        ) {
          // We need to update the time entry.

          // TODO: Don't update if status was set to Billable or Paid. Track this as a Failed.
          //       I have decided that for my usage this won't be such an issue as we bill monthly and I won't be updating older records.

          try {
            if (argv.verbose) {
              console.log(
                `Updating time entry on ${
                  projectMapping.activeCollabName
                } #${timeEntry.issueNumber} ${
                  task.name
                } ${activeCollabSummary} ${timeEntry.date} ${duration}.`
              )
            }

            try {
              var response = await activeCollab.put(`projects/${projectMapping.activeCollabProjectId}/time-records/${previousTimeEntryMapping.activeCollabId}`,
                  {
                    user_id: activeCollabUserId, // TODO: Handle multiple user id's.
                    summary: activeCollabSummary,
                    job_type_id: 1, // TODO: Job Types? No idea how to handle this maybe based off a tag or key word being present in the description.
                    record_date: timeEntry.date,
                    value: timeEntry.activeCollabDuration,
                    billable_status: timeEntry.billable ? 1 : 0,
                    parent_id: task.id,
                    parent_type: "Task",
                    task_id: task.id
                  }
              )
              var trackingResult = response.data.single
            } catch (e) {
              // If failed to find the time entry then delete the existing mapping.
              // Attempt to create it?
              if (e.response.status === 404) {
                await deletePreviousTimeEntryMapping()
              }
              syncResults.failed.push({
                summary: `Error from Active Collab when editing a time tracking record. ${e}`,
                timeEntry: timeEntry
              })
              continue
            }

            // Update the id just in-case. Although in reality it should not have changed.
            timeEntryMapping.activeCollabId = trackingResult.id

            // Also storing the result from active collab just in-case.
            timeEntryMapping.activeCollabResult = trackingResult

            await eventEmitter.emit('timeUpdated', { mapping: timeEntryMapping, previousMapping: previousTimeEntryMapping, projectMapping: projectMapping })

            await fireTagEvents(timeEntryMapping, previousTimeEntryMapping)

            syncResults.synced.push({
              summary: ``,
              timeEntry: timeEntry
            })

            // Store the time mapping.
            await timeMappings.store(timeEntry.id, timeEntryMapping)
          } catch (error) {
            console.error(error.message, error.stack.replace(/\\n/g,"\n"))
            await deletePreviousTimeEntryMapping(false)
            syncResults.failed.push({
              summary: `Error from Active Collab when updating a time tracking record. ${error}`,
              timeEntry: timeEntry
            })
            continue
          }
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

          // Note: Intentionally not removing from mapping as we will over-write it next with a create new time entry action.
          deletePreviousTimeEntryMapping(false)
        } catch (error) {
          console.error(error.message, error.stack.replace(/\\n/g,"\n"))
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
        } ${activeCollabSummary} ${timeEntry.date} ${duration}.`
      )
    }

    // Note: Active Collab tasks have their own auto incrementing ID field, we want to use the issueNumber as the ticketId in calls to the API as that is what it expects.
    // Note: There is a risk of duplicated time entries being added here should the sync process bomb out before storing the mapping, I do not have a full solution to this problem yet.
    //       Could compare exact date and summary and check if other entry not mapped, but that is flawed if there are multiple.

    try {
      try {
        var response = await activeCollab.post(`projects/${projectMapping.activeCollabProjectId}/time-records`,
            {
              user_id: activeCollabUserId, // TODO: Handle multiple user id's.
              summary: activeCollabSummary,
              job_type_id: 1, // TODO: Job Types? No idea how to handle this maybe based off a tag or key word being present in the description.
              record_date: timeEntry.date,
              value: timeEntry.activeCollabDuration,
              billable_status: timeEntry.billable ? 1 : 0,
              parent_id: task.id,
              parent_type: "Task",
              task_id: task.id
            }
        )

        trackingResult = response.data.single
      } catch (e) {
        syncResults.failed.push({
          summary: `Error from Active Collab when adding a time tracking record. ${e}`,
          timeEntry: timeEntry
        })
        continue
      }

      timeEntryMapping.activeCollabId = trackingResult.id
      // Also storing the result from active collab just in-case.
      timeEntryMapping.activeCollabResult = trackingResult

      await eventEmitter.emit('timeAddded', { mapping: timeEntryMapping, previousMapping: previousTimeEntryMapping, projectMapping: projectMapping })

      await fireTagEvents(timeEntryMapping, previousTimeEntryMapping)

      syncResults.synced.push({
        summary: ``,
        timeEntry: timeEntry
      })

      // Store the time mapping.
      await timeMappings.store(timeEntry.id, timeEntryMapping)
    } catch (error) {
      if (argv.verbose) {
        console.error(error.message, error.stack.replace(/\\n/g,"\n"))
      }
      syncResults.failed.push({
        summary: `Error from Active Collab when adding a time tracking record. ${error}`,
        timeEntry: timeEntry
      })
      continue
    }
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

    // Then delete it from ActiveCollab. (Moves to trash)
    try {
      await activeCollab.put(`move-to-trash/time-record/${oldTimeEntry.activeCollabId}`)
    } catch (error) {
      if (argv.verbose) {
        console.error(error.message, error.stack.replace(/\\n/g,"\n"))
      }
      syncResults.failed.push({
        summary: `Error from Active Collab when deleting a time tracking record. ${error}`,
        timeEntry: oldTimeEntry
      })
    }

    try {
      await timeMappings.delete(oldTimeEntry.togglId)
    } catch (error) {
      console.error(error.message, error.stack.replace(/\\n/g,"\n"))
      syncResults.failed.push({
        summary: `Error from TogglMapping when deleting a time tracking record. ${error}`,
        timeEntry: oldTimeEntry
      })
    }

    await eventEmitter.emit('timeDeleted', { mapping: oldTimeEntry })
  })

  //console.timeEnd('SyncTimeEntries')

  await eventEmitter.emit('timeEntrySyncResults', syncResults)


  // Close tasks we opened to add/update time entries on.
  for (let index = 0; index < syncResults.tasksReopened.length; ++index) {
    let task = syncResults.tasksReopened[index]

    try {
      if (argv.verbose > 5) {
        console.log(`Attempt to close task in Active Collab ${task.task_number}`)

        if (task.open_subtasks > 0) {
          console.warn(`Note: There are still open subtasks on the task ${task.task_number} suggest to double check if those are resolved.`)
        }
      }
      let response = await activeCollab.put(`/complete/task/${task.id}`)
    } catch (e) {
      // If failed to find the task to close well what can we do...
      if (e.response.status === 404) {
        console.warn(`Failed to close task`)
        continue
      } else {
        console.warn(`Unable to close task ${task.id} exception ${e.response.status}`)
      }
    }
  }

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
    // Ignore summarys we do not care about showing.
    if (result.summary === 'Time entry unchanged.' || result.summary === 'Skipped.') {
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
