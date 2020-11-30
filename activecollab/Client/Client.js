"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const Authentication_1 = require("../Authentication/Authentication");
const constants_1 = require("../constants");
class Client extends Authentication_1.Authentication {
    constructor(email, password, client_name, client_vendor, account_id, url) {
        super(email, password, client_name, client_vendor, url);
        this.account_id = account_id;
    }
    isSelfHosted() {
        if (this.getUrl() === constants_1.API.BASE_URL) {
            return false;
        }
        return true;
    }
    /**
     * @description Builds API endpoint
     * @returns String
     */
    endpoint(component) {
        const { TOKEN, BASE_URL } = constants_1.API;
        if (this.isSelfHosted()) {
            return component
                ? `${this.getUrl()}${constants_1.API_VERSION}/${component}`
                : `${this.getUrl()}${TOKEN.ISSUE_TOKEN}`;
        }
        return component
            ? `${BASE_URL}/${this.account_id}${constants_1.API_VERSION}/${component}`
            : `${BASE_URL}/${this.account_id}${TOKEN.ISSUE_TOKEN_INTENT}`;
    }
    fetchIntent() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield axios_1.default.post(constants_1.API.EXTERNAL_LOGIN_URL, {
                email: this.getEmail(),
                password: this.getPassword(),
            });
            if (res.data.is_ok === 1) {
                return res.data.user.intent;
            }
            else {
                throw new Error("Could not fetch intent...");
            }
        });
    }
    /**
     * @description Issues token based on the account_id
     * @returns String X-Angie-AuthApi Token
     */
    issueToken() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let res = null;
                // Self Hosted
                if (this.isSelfHosted()) {
                    res = yield axios_1.default.post(this.endpoint(), {
                        username: this.getEmail(),
                        password: this.getPassword(),
                        client_name: this.getClientName(),
                        client_vendor: this.getClientVendor(),
                    });
                    res.data.is_ok ? this.setToken(res.data.token) : new Error();
                }
                else {
                    const intent = yield this.fetchIntent();
                    res = yield axios_1.default.post(this.endpoint(), {
                        intent: intent,
                        client_name: this.getClientName(),
                        client_vendor: this.getClientVendor(),
                    });
                    res.data.is_ok ? this.setToken(res.data.token) : new Error();
                }
            }
            catch (e) {
                console.error(e.response);
            }
        });
    }
    get(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield axios_1.default.get(this.endpoint(path), {
                headers: {
                    "X-Angie-AuthApiToken": this.getToken(),
                },
            });
        });
    }
    post(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield axios_1.default.post(this.endpoint(path), data, {
                headers: {
                    "X-Angie-AuthApiToken": this.getToken(),
                    "Content-Type": "application/json",
                },
            });
        });
    }
    put(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield axios_1.default.put(this.endpoint(path), data, {
                headers: {
                    "X-Angie-AuthApiToken": this.getToken(),
                    "Content-Type": "application/json",
                },
            });
        });
    }
    delete(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield axios_1.default.delete(this.endpoint(path), {
                headers: {
                    "X-Angie-AuthApiToken": this.getToken(),
                },
            });
        });
    }
}
exports.Client = Client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NsaWVudC9DbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQSxrREFBNEM7QUFDNUMscUVBQWtFO0FBQ2xFLDRDQUFnRDtBQUdoRCxNQUFhLE1BQU8sU0FBUSwrQkFBYztJQUd4QyxZQUNFLEtBQWEsRUFDYixRQUFnQixFQUNoQixXQUFtQixFQUNuQixhQUFxQixFQUNyQixVQUFtQixFQUNuQixHQUFZO1FBRVosS0FBSyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztJQUMvQixDQUFDO0lBRU8sWUFBWTtRQUNsQixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxlQUFHLENBQUMsUUFBUSxFQUFFO1lBQ2xDLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDTyxRQUFRLENBQUMsU0FBa0I7UUFDbkMsTUFBTSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsR0FBRyxlQUFHLENBQUM7UUFFaEMsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUU7WUFDdkIsT0FBTyxTQUFTO2dCQUNkLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyx1QkFBVyxJQUFJLFNBQVMsRUFBRTtnQkFDL0MsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztTQUM1QztRQUNELE9BQU8sU0FBUztZQUNkLENBQUMsQ0FBQyxHQUFHLFFBQVEsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLHVCQUFXLElBQUksU0FBUyxFQUFFO1lBQzdELENBQUMsQ0FBQyxHQUFHLFFBQVEsSUFB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