const config = require('./MyConfig')
const TogglClient = require('toggl-api')

const Promise = require('bluebird')
Promise.promisifyAll(TogglClient.prototype)

const toggl = new TogglClient({
    apiToken: config.Toggl.token,
    apiUrl: "https://api.track.toggl.com",
    reportsUrl: "https://api.track.toggl.com/reports",
    workspaceId: config.Toggl.workspaceId
})

module.exports = toggl
