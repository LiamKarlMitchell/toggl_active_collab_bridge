'use strict';

// Official Documentation for Active Collab Version 5 API can be found at
// https://developers.activecollab.com/api-documentation/
// An older Version 4 API SDK can be found here: https://github.com/activecollab/activecollab-sdk

var rp = require('request-promise')

var VERSION = require('../package.json').version
var DEFAULT_INSTANCE = null
var DEFAULTS = {
  apiUrl: 'https://localhost/api.php'
}

class ActiveCollabClient {
  constructor (options) {
    if (options.apiToken) {
      this.apiToken = options.apiToken
    }

    this.apiUrl = options.apiUrl || DEFAULTS.apiUrl
  }

  get (path, queryParameters) {
    return rp({
      method: 'POST',
      url: this.apiUrl,
      qs: {
        path_info: path,
        auth_api_token: this.apiToken,
        format: 'json',
        ...queryParameters
      },
      json: true, // Automatically parses the body to JS Object.
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  post (path, content) {
    return rp({
      method: 'POST',
      url: this.apiUrl,
      qs: { path_info: path, auth_api_token: this.apiToken, format: 'json' },
      form: content,
      json: true, // Automatically stringifies the body to JSON
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  // Note: A submitted property set to submitted is required for a majority of things.
  postFormData (path, content) {
    return rp({
      method: 'POST',
      qs: { path_info: path, auth_api_token: this.apiToken, format: 'json' },
      url: this.apiUrl,
      formData: content,
      json: true, // Automatically stringifies the body to JSON
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

module.exports = ActiveCollabClient

require('./api/authenticate')
require('./api/people')
require('./api/projects')
require('./api/task')
require('./api/taskTime')

/* Notes

// This module is intended for use with the classic API for Active Collab version 4.2.17.
// I have implemented just what I needed.
// For help on the API see here:
//https://activecollab.com/help-classic/books/api/making-request
//https://activecollab.com/help-classic/books/api/authentication
// https://activecollab.com/help-classic/books/api/authentication
// Another node.js api for this https://github.com/mattapperson/activecollab-node-api

A connection needs API URL and API token
*/
