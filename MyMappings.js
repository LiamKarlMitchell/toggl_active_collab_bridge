const config = require('./MyConfig')
const TogglMapping = require('./TogglMapping')
const path = require('path')

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

module.exports.timeMappings = timeMappings
module.exports.clientMappings = clientMappings
module.exports.projectMappings = projectMappings
