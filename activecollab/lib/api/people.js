// https://activecollab.com/help-classic/books/api/people

// client.prototype.peopleGetAll;
// client.prototype.peopleGet;
// client.prototype.peopleAdd;
// client.prototype.peopleEdit;
// client.prototype.peopleDelete;

// All active companies
// GET people

// POST people/add-company

// GET people/archive

// GET people/${companyId}

/*
GET people
POST people/add-company
GET people/archive
GET people/:company_id
POST people/:company_id/edit
POST people/:company_id/add-user
GET people/:company_id/users/:user_id
POST people/:company_id/users/:user_id/edit-profile
*/

var ActiveCollabClient = require("../client");

// Note: I'm deviating from "People" to call this Companies because that seems more correct to me.

ActiveCollabClient.prototype.companies = function() {
  return this.get("people");
};

ActiveCollabClient.prototype.company = function(companyId) {
  return this.get(`people/${companyId}`);
};
