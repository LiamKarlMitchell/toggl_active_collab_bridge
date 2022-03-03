const events = require('../MyEventEmitter')
const checkDiskSpace = require('check-disk-space').default
const config = require('../MyConfig')
const path = require("path")

const MBToBytes = 1048576

module.exports = {
    init: function (pluginConfig) {

        // Default to 10 MB~
        if (typeof pluginConfig.freeSpace === 'undefined') {
            pluginConfig.freeSpace = 10 * MBToBytes
        }

        events.on('startup', async function (event) {
            const location = path.resolve(process.cwd(), config.DataDirectory)
            const diskSpace = await checkDiskSpace(location)
            console.log(`Free disk space ${diskSpace.free / MBToBytes} MB.`)
            if (diskSpace.free < pluginConfig.freeSpace * MBToBytes) {
                throw new Error(`Not enough free disk space on ${location}.`)
            }
            // Example
            // {
            //     diskPath: 'C:',
            //     free: 12345678,
            //     size: 98756432
            // }
            // Note: `free` and `size` are in bytes
        })
    }
}
