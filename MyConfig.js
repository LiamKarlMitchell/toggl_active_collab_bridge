var argv = require('./MyCommandLineArguments')
var configPath = './config/config'

// Allows for over-riding the default config location by a command line argument.
// Example: --config=./config/otherconfig.json
if (argv.config) {
  configPath = argv.config
}

// TODO: Validate the config in some way?
// Such as: https://www.jsonschema.net/

module.exports = require(configPath)
