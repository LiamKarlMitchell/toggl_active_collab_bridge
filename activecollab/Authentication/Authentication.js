"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
class Authentication {
    constructor(email, password, client_name, client_vendor, url = constants_1.API.BASE_URL) {
        this.X_ANGIE_AUTH_API = "";
        this.getEmail = () => this.email;
        this.getPassword = () => this.password;
        this.getToken = () => this.X_ANGIE_AUTH_API;
        this.getUrl = () => this.url;
        this.getClientName = () => this.client_name;
        this.getClientVendor = () => this.client_vendor;
        this.email = email;
        this.password = password;
        this.client_name = client_name;
        this.client_vendor = client_vendor;
        this.url = url;
    }
    setToken(newX_ANGIE_AUTH_API) {
        return this.X_ANGIE_AUTH_API = newX_ANGIE_AUTH_API;
    }
}
exports.Authentication = Authentication;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXV0aGVudGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvQXV0aGVudGljYXRpb24vQXV0aGVudGljYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw0Q0FBbUM7QUFFbkMsTUFBc0IsY0FBYztJQVNoQyxZQUFZLEtBQWEsRUFBRSxRQUFnQixFQUFFLFdBQW1CLEVBQUUsYUFBcUIsRUFBRSxNQUFjLGVBQUcsQ0FBQyxRQUFRO1FBRjNHLHFCQUFnQixHQUFXLEVBQUUsQ0FBQztRQVU1QixhQUFRLEdBQUcsR0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUVwQyxnQkFBVyxHQUFHLEdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7UUFFMUMsYUFBUSxHQUFHLEdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztRQUVsRCxXQUFNLEdBQUcsR0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUVoQyxrQkFBYSxHQUFHLEdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7UUFFL0Msb0JBQWUsR0FBRyxHQUFXLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBakJ0RCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztJQUNuQixDQUFDO0lBY1MsUUFBUSxDQUFDLG1CQUEyQjtRQUMxQyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQztJQUN2RCxDQUFDO0NBQ0o7QUFoQ0Qsd0NBZ0NDIn0=