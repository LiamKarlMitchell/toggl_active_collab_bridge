
# Facilitate syncing time entries from Toggl against tickets in Active Collab.
This project aims to sync Projects and Clients from Active Collab into Toggl workspace and automate filling time entries from Toggl into the appropriate Active Collab ticket.

# Features

1. Sync Companies as Clients in Toggl
2. Sync Projects to Toggl
3. Take time entries for a project, user, billable status and prefixed with an issue id and put them in Active Collab.
   Creating or Deleting/Updating.

Does not create tasks in Toggl or use them for data.

Note: Multi User support is not yet tested, behaviour undefined.
Note: I'm not sure what would happen if this is used by multiple users on the same Toggl Workspace!
      Plan to test this soon as we are wanting to use Toggl at work for multiple users on the same Workspace for reporting purposes as Active Collab 7 does not have great reporting features like version 4 did.
      I know that it handles case of client or project already existing and looks up the relevant info for the mapping records from Toggl and that it looks up the mapped user id, config could have multiple so it should work but I've never tried!

Note: This tool stores a mapping of id and data of records between the two systems.
If you want to run it from multiple devices for the same user, please make sure to keep the data directory up to date or you will get duplicate entries!

Note: Projects are currently created as public so all team members could see it.
It is not always the case that all team members would be seeing same project in Active Collab.
If this is important for you then need to adapt the code to update Toggl members on projects based on the Toggl user id mappings.
However would need to be constantly updated when the members on the project changes which would be irksome so I have not implemented this.

## Requirements
Node.js: node.js 8.10.0 + *Or close enough...* I'm actually running 10.6 on Windows 10, although this should run on other OS as well.

Active Collab: Self Hosted v7.0.15
Should also work with cloud by the way.

For older versions e.g. 5,6 it might work API should be the same?

For even older version such as v4.2.17 use the code at the tag active_collab_4 b98b74143dbeea77d34a10618859ccd9265a9e05

Other versions may work although the new Active Collab overhauled their API and it has some significant changes, the wrapper module would need to be improved/modified to talk with it.

Please let me know if you know of other old versions of Active Collab that this works correctly on and I can list them here.

## Getting Started

Clone/Download the repo.

Copy the config.dist.json and name it config.json
 Set up your Toggl API Key.

Create a workspace in Toggl if it does not exist already, you may be able to use the default workspace by it's id.

The Workspace ID can be seen in the url when you click the settings of the Workspace on the toggl.com/app/workspaces page the program can alternatively find it by the configured Name if needed.


TODO: Rewrite getting started instructions for new Active Collab 7!
Set up your Active Collab API key subscription and put it in the Config.

Install node modules.
```bash
npm install
```

## Configuration
TODO: Need to write better documentation on configuration.  

In short,

- Copy the config.dist.json and name it config.json
- Fill in API keys, Active Collab URL and Workspace id/Name.
- Specify the user mapping of TogglId to ActiveCollabId.
- Note: apiUrl is the Base URL to your Active Collab installation, don't include the /api/v1 part!


## Toggl API Token

Login to https://toggl.com/app/timer
Click on your Profile and click Profile Settings
You can find your API token on that page.

See here for Toggl's documentation on this.
https://support.toggl.com/my-profile/#api

Ensure Time Zone is set as you expect.

## Active Collab API Token

In Active Collab navigate to ```People``` and ```Click your self.```
Click Options in the top right and select API Subscriptions
Click New Subscription in the top right

Fill in whatever you like but ensure Read Only is set to No.
Click Add Subscription

To view the Token and API URL click on the Magnifyer + button.

Ensure Time Zone is set in your profile settings.

## User Mapping

Get your User ID from Active Collab and Toggl.
You can find this in the end of the Profile URL on Active Collab.

On Toggl you have to dig a little deeper.

Visiting this link will show you your Toggl User ID.
https://www.toggl.com/api/v8/me

We need to define a togglToActiveCollabUserMapping in the config

Example of user mapping.
```
"togglToActiveCollabUserMapping": {
  "yourTogglID": "yourActiveCollabId"
},
```

## Workflow
When entering time entries into Toggl you should.
1. Choose the appropriate Project and be working in the configured Workspace.
2. Start the description with #taskNumber where taskNumber is the value you see in Active Collab. (Note: This is not the ID in the URL in Active Collab 7 but the one on the task as it opens up.)
   You can also put a $ in front of the # in the task description to indicate if the time is billable.
3. After syncing, review failed/ignored reasons and cross-check your times using the Active Collab and Toggl reporting features.

Note: The task_number from Active Collab is entered in the descriptions of time entries in Toggl.
However Time Entries are created to have a parent_id and TaskID set to the Active Collab Task ID, this is different to the Active Collab task_number that you see in the URL.
  
## Program Usage
Start the program as needed to sync, you can leave it running longer there is a cron like schedule for running the sync operations..
```bash
npm start
```

### Other command line shenanigans.
Use a different config.
```bash
node index --config=another.json
```
Verbose Mode
```bash
node index --verbose=1
```
More Verbose Mode
```bash
node index --verbose=5
```

## Plugins

Plugins can be loaded in.

Optional argument of pluginOrder lets you sort the order in which plugins are loaded.

Example Config:
```json
{
  "plugins": {
    "CollateTimeEntries": { "pluginOrder": 1, "enabled": true, "keyTags": [ "Overtime" ] },
    "CompleteTicketViaTag": { "pluginOrder": 2, "enabled": true },
    "StoreSummaryAsCommentOnTicketViaTag": { "pluginOrder": 3, "enabled": true },
    "SyncResultsToHTML": { "pluginOrder": 4, "enabled": true },
    "Minimum" : { "pluginOrder": 10, "minutes": 15 }
  }
}
```

### Collate Time Entries

Collates time entries into a single record if they are the same project, issue number, comment, billable status, day.

### Complete Ticket Via Tag

Completes a ticket in Active Collab based on the Tag given.

### Minimum

Lets you have a minimum time for each entry.
15 minutes default.

Arguments:
duration: seconds

### Round

Lets you round a time entry duration to a chuck of seconds.

Arguments:
duration: seconds

### Ceiling

Lets you round up a time entry duration to a chuck of seconds.

Arguments:
duration: seconds


### Store Summary As Comment On Ticket Via Tag

Store the summary from the time entry onto the Active Collab ticket if the tag is set.

### Sync Results To HTML
Recommended, gives an HTML report after syncing that can be used to see potential issues.

### Disk Space Check

Errors at startup if not enough disk space available.

Arguments:
freeSpace: number of megabytes


## License etc...
License: MIT

This project is not endorsed or supported by Active Collab, Toggl or any one else.

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR

IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,

FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE

AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER

LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,

OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE

SOFTWARE.
```

Additionally I would like to add.
```
Use this at your own risk.

You can't hold anyone but your self accountable if something borks, breaks, catches fire does not work as intended or works as intended. Everything is at your own risk.

I've put it through some scenarios and debugged it until it worked for me. It is probably not perfect I'm sure there is room for improvement please feel free to make issues and pull requests to that end.

What works for me may not work for you.
```

## Q & A
So far I have had to ask my-self these questions feel free to make an Issue asking something if it is not here or email me.

Q. What Active Collab does this support?

A. None, but it seems to work with Self Hosted v7 an older tag works with Active Collab Self Hosted v4.2.17.

Q. Why should we use Toggl Active Collab 7 already includes a timer.

A. You are right, but I find Toggl is more user friendly than the built in timer and has better reporting features.

Q. I changed the time entry details or deleted it, have I broken this?

A. Nope it should check and delete/create or update as needed for previous entries so long as the modifications are within the configured duration to sync for.
  
Q. How can I ignore some Projects/Clients from being Synced over?

A. Edit the code and make a Pull request for adding this functionality to the configuration. I would love to have this.
- Alternatively you might remove the Projects/Clients you are not interested in from Toggl after they have been created?

Q. How can I mark something as Billable?

A. Choose the Billable checkbox or simply put an $ after the ticket number in the description. *Note: I have not tested the billable flag although it should work.*

Q. What about Toggl's paid plan features such as Billable and Tickets?

A. I am still testing Toggl out to see if it remains essential to my day to day so have not yet sprung for the paid plan. Billable should work just fine, Tickets would be something else...

Q. Can time entries not mapped to a project or not containing an issue number to be caught and assigned to a specific project ticket?

A. No but this would be an awesome feature, please make a pull request and add it, or consider donating to me and I'll see what I can do?

Q. What if I enter the wrong Issue Number or Project on a time entry description?

A. It's fine, just change it so long as it's within your configured window of time for pulling down time entries.

Q. I need to have a time entry span multiple ticket numbers / projects.

A. Simple work around make multiple time entries to divide the time between and assign as needed, sorry I consider this a complex/rare scenario to handle with code alone. If you have a Meeting and discuss several issues, you could probably assign the time to a Meeting ticket in Active Collab?

Q. What if a Project in Active Collab was moved to a different Client?
   What if a Ticket in Active Collab was moved to a different Project?
   What if a Ticket in Active Collab was deleted?

A. Forget About it.

Q. Something borked and my time entries are all messed up now.

A. That sounds like a you problem. Good luck with that, as mentioned you use this program at your own risk.

Q. Would you consider improving this to work with newer Active Collab versions possibly even for http://activecollab.com?

A. Feel free to get in touch about it.

Q. What is so great about Toggl anyway?

A. Well personally, I love how easy it is to work with If I forget to stop/start a timer I can do it from my phone isn't that super.

Q. Would you consider writing a program like this for other API's/Services?

A. Feel free to get in touch about it.

Q. I found a problem/bug/improvement.

A. Great, due to the nature of Open Source and Github you can fork this repo and make a pull request. Please try to give a good and succinct description of the thing you want to improve.

Q. How to make this run as a Daemon or Service?

A. Well, I haven't put much thought into that yet.
There are wrappers for Windows and Linux/Other service/daemon managers. Such as [os-service](https://www.npmjs.com/package/os-service).

Q. There are no tests?

A. "The real test is in Production" no really, don't use this in production without knowing it is untested software, it is not considered suitable for any purpose not even the one it was created for. It simply works for me and my use-case.

Q. Can I write tests?

A. Please do, knock your self out and submit a pull request. I would love to learn more about this side of software.

Q. I have an issue with...?

A. If it's something uber critical and it's not because of your configuration or API limitations/restrictions please provide more information. You could make an issue about it or possibly debug and fix with a pull request.

Q. You missed a semi-colon;

A. I'm actually attempting to use standard-js JavaScript Standard Style for this program.

Q. Naming is inconsistent

A. You may consider these terms interchangeable whilst reading this project.
| A | B |
| ---- | ---- |
| Task | Ticket |
| Client | Company |
| API Key | API Token |


Q. Does this support multiple job types?
A. No, at the moment it puts everything as General id 1.
   However this behaviour could be improved on, perhaps by mapping specific tags to Job Types?

Q. Was this fun to make?
A. Yes quite, I went through several thoughts of it's design and decided I didn't need a database.
  
# In closing  
Timesheets are evil, of necessity of course, “If you can’t measure it, you can’t improve it.”

This is simply a glue between two software/services born out of frustration at doing it manually for several months. I finally snapped and wrote this program to automate it.

It suits my needs mostly, and I found no official or alternative integration prior to making this.
  

Made by a software developer in New Zealand.
[Donate via PayPal
![Shout me if you like this?](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)
](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=VWLV79Q9F9P84)
