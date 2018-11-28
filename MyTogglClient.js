const config = require('./MyConfig')
const TogglClient = require('toggl-api')

const Promise = require('bluebird')
Promise.promisifyAll(TogglClient.prototype)

const toggl = new TogglClient({ apiToken: config.Toggl.token })

module.exports = toggl
