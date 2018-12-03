// Useful for mocking a long to run async process.
function delay (ms, result) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      resolve(result)
    }, ms)
  })
}

function delayError (ms, error) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(error)
    }, ms)
  })
}

module.exports.delay = delay
module.exports.delayError = delayError
