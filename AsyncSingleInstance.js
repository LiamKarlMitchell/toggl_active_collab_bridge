// Source: https://gist.github.com/LiamKarlMitchell/7185433f5f62ce04e6218d76b2fdf3ec
// Given an Async Function (Not a promise) this class will ensure that the run method can only run 1 instance of that async operation at a time.
class AsyncSingleInstance {
  // Soon we will have private fields? https://github.com/tc39/proposal-class-fields#private-fields
  // #inProgress;
  // #asyncFunction;

  constructor (asyncFunction) {
    this.inProgress = false
    this.asyncFunction = asyncFunction
  }

  get isRunning () {
    return this.inProgress
  }

  // Ensures only one instance of the asyncFunction will run at once, will return a promise that resolves to the result or errors if already in use.
  async run () {
    if (this.inProgress) {
      throw new Error(
        'Task ' + this.asyncFunction.name + ' is already in progress.'
      )
    }

    this.inProgress = true
    try {
      var result = await this.asyncFunction(...arguments)

      // Ensure we are not in progress anymore.
      this.inProgress = false
      return result
    } catch (e) {
      // Ensure we are not in progress anymore.
      this.inProgress = false
      throw e
    }
  }
}

module.exports = AsyncSingleInstance
