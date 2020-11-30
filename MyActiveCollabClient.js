const config = require("./MyConfig")
const { Client } = require("./activecollab/Client/Client")

var isSelfHosted = config.ActiveCollab.isSelfHosted || false
var appName = config.ActiveCollab.appName || 'Toggl Sync'
var organizationName = config.ActiveCollab.organizationName || 'Unknown'
var accountID = config.ActiveCollab.AccountID

if (config.ActiveCollab.apiUrl !== undefined && config.ActiveCollab.apiUrl !== null && config.ActiveCollab.apiUrl !== '') {
    if (config.ActiveCollab.apiUrl.startsWith('https://app.activecollab.com')) {
        isSelfHosted = false
    }
}

if (isSelfHosted === false) {
    if (accountID === undefined) {
        throw new Error('Expecting AccountID to be set in ActiveCollab config.')
    }
}

if (config.ActiveCollab.apiToken === undefined || config.ActiveCollab.apiToken === '' || config.ActiveCollab.apiToken === null) {
    if (config.ActiveCollab.email === undefined || config.ActiveCollab.email === '' || config.ActiveCollab.email === null ||
        config.ActiveCollab.password === undefined || config.ActiveCollab.password === '' || config.ActiveCollab.password === null) {
        throw new Error('apiToken is not set in the Active Collab configuration, expecting email and password to be set to Issue Token.')
    }
}

var client = null

if (isSelfHosted) {
    // Self-Hosted
    client = new Client(
        config.ActiveCollab.email,
        config.ActiveCollab.password,
        appName,
        organizationName,
        undefined,
        config.ActiveCollab.apiUrl
    )
} else {
    // Cloud-Hosted
    client = new Client(
        config.ActiveCollab.email,
        config.ActiveCollab.password,
        appName,
        organizationName,
        accountID
    )
}

if (config.ActiveCollab.apiToken !== undefined && config.ActiveCollab.apiToken !== null && config.ActiveCollab.apiToken !== '') {
    client.setToken(config.ActiveCollab.apiToken)
}

module.exports = client;

