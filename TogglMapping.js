const fs = require('fs') // Note: As of Node.js v10.0.0 there are fsPromises available through promises method.
const path = require('path')
const deepEqual = require('deep-equal')
const Promise = require('bluebird')
const mkdirp = require('mkdirp')

const readdirAsync = Promise.promisify(fs.readdir)
const unlinkAsync = Promise.promisify(fs.unlink)
const readFileAsync = Promise.promisify(fs.readFile)
const writeFileAsync = Promise.promisify(fs.writeFile)

class TogglMapping {
  constructor (dataPath, filenamePrefix = 'record') {
    this.dataPath = dataPath
    this.filenamePrefix = filenamePrefix

    // Ensure the dataPath exists.
    mkdirp.sync(this.dataPath)

    // Map of togglId to record contents.
    this._records = {}

    // Map of togglId to filepath it was stored as on disk.
    this._fileRecords = {}
  }

  // Return the first record where the function passed in fn argument returns true.
  // Could be slow, it iterates over values of an object's keys.
  find (fn) {
    return Object.values(this._records).find(fn)
  }

  findAll (fn) {
    return Object.values(this._records).filter(fn)
  }

  async eachAsync (fn) {
    var records = Object.values(this._records)
    for (let index = 0; index < records.length; index++) {
      var result = await fn(records[index])
      if (result === true) {
        break
      }
    }
  }

  async load () {
    // Get the files in the directory, sort them so we process in ascending order of file name just in-case there are duplicated/old files that did not get unlinked.
    let files = (await readdirAsync(this.dataPath)).sort()
    for (let index = 0; index < files.length; ++index) {
      let file = files[index]

      if (path.extname(file) !== '.json') {
        continue
      }

      // TODO: Only load the file if the name matches a specific pattern?
      let split = file.split('_')

      // Skip file if it does not start with the prefix we expect.
      if (split[0] !== this.filenamePrefix) {
        continue
      }

      let fileTogglId = parseInt(file.split('_')[2])
      let filePath = path.join(this.dataPath, file)

      let fileContents = await readFileAsync(filePath, 'utf8')

      // TOOD: What if this throws an exception?
      let contents = JSON.parse(fileContents)

      // TODO: Validate contents?

      // TODO: Derive togglId from the file name and compare it with the one in the contents?

      let togglId = contents.togglId

      if (!togglId) {
        console.warn(`The togglId is not set in file ${filePath} skipping it.`)
        continue
      }
      if (fileTogglId != contents.togglId) {
        console.warn(
          `The file names togglId ${fileTogglId} is not the same as the one in the record ${togglId} for ${filePath} skipping.`
        )
        continue
      }

      await this._trackFileRecord(togglId, filePath)
      this._trackRecord(togglId, contents)
    }
  }

  getRecord (togglId) {
    return this._records[togglId]
  }

  // Returns result based on if record was unchanged, added or updated.
  async store (togglId, record) {
    // Handle if just 1 argument record is passed with a togglId as a key.
    if (togglId.togglId && record === undefined) {
      record = togglId
      togglId = record.togglId
    }

    if (record.togglId != togglId) {
      if (!Object.isFrozen(record)) {
        // Ensure the record contains the togglId just in-case.
        record.togglId = togglId
      } else {
        throw new Error(
          `Records togglId does not match the one passed to this method to store it against ${togglId}`,
          record
        )
      }
    }

    let previousRecord = this._records[togglId]

    if (previousRecord && deepEqual(record, previousRecord)) {
      return TogglMapping.Constants.RecordUnchanged
    }

    await this._saveRecord(togglId, record)

    if (previousRecord) {
      return TogglMapping.Constants.RecordUpdated
    }
    return TogglMapping.Constants.RecordAdded
  }

  _trackRecord (togglId, record) {
    // Freeze the record to ensure it can not be modified.
    Object.freeze(record)
    this._records[togglId] = record
  }

  async _trackFileRecord (togglId, file) {
    let previousFile = this._fileRecords[togglId]

    // console.log(`Tracking file ${togglId} ${file}`)
    this._fileRecords[togglId] = file

    // TODO: Consider should wait on removing previous file?
    // We only want to keep the latest files mapped per record.
    if (previousFile) {
      // console.log(`Delete previous file ${togglId} ${previousFile}`);

      // Note: If creating files too fast, an error could happen unlinking or over-writing the same file.
      // Because of the resolution of the timestamp used in the name. I could probably use UUID's to overcome this if it is a problem...
      try {
        await unlinkAsync(previousFile)
      } catch (error) {
        console.error(
          `Unable to unlink a previous record file: ${previousFile}`,
          error
        )
      }
    }
  }

  async delete (togglId) {
    let previousRecord = this._records[togglId]
    let previousFile = this._fileRecords[togglId]

    if (previousRecord) {
      // console.log(`Delete previous file ${togglId} ${previousFile}`);

      // In reality if previousRecord is set then previousFile should also be set, but adding just in-case.
      if (previousFile) {
        try {
          await unlinkAsync(previousFile)
        } catch (error) {
          console.error(
            `Unable to unlink a previous record file: ${previousFile}`,
            error
          )
        }
      }

      delete this._records[togglId]
      delete this._fileRecords[togglId]
    }
  }

  async _saveRecord (togglId, record) {
    // Get the filename from the record and datetime stamp.
    // Replacing the : to a - because : is not allowed in file names on windows.
    let file = path.join(
      this.dataPath,
      `${this.filenamePrefix}_${new Date()
        .toISOString()
        .replace(/:/g, '-')}_${togglId}.json`
    )

    await writeFileAsync(file, JSON.stringify(record))
    await this._trackFileRecord(togglId, file)
    this._trackRecord(togglId, record)
  }
}

TogglMapping.Constants = Object.freeze({
  RecordAdded: 0,
  RecordUpdated: 1,
  RecordUnchanged: 2
})

module.exports = TogglMapping
