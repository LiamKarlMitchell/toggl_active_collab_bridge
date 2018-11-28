const client = require("../client");

//https://activecollab.com/help-classic/books/api/authentication

// client.prototype.apiRegisterSubscription = async function(
//   email,
//   password,
//   clientName = "nodejs",
//   clientVendor = "node-active-collab",
//   useAPIKey = true
// ) {
//   var response = await this.postRequest("", {
//     api_subscription: {
//       email: email,
//       password: password,
//       client_name: clientName,
//       client_vendor: clientVendor
//     }
//   });

//   // TODO: Check status codes.

//   if (useAPIKey) {
//     this.apiSetKey(response.body["API key"]);
//   }
// };

// client.prototype.apiSetKey = function(apiKey) {
//   this.apiKey = apiKey;
// };

// TODO: Authenticate by login to get an API Key.
