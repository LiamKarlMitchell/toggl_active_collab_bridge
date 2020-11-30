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
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client/Client");
/**
 * Example
 * Using it for TS project -> Middleware or Services
 */
const middleware = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Init Self-Hosted
        let client = new Client_1.Client("xxx@xxx.com", "xxxx", "xxx", "xxx", undefined, "http://localhost:8080");
        yield client.issueToken();
        const projects = yield client.get("projects");
        console.log(projects);
    }
    catch (error) {
        console.log(error);
    }
});
middleware();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQSw0Q0FBeUM7QUFFekM7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLEdBQUcsR0FBUyxFQUFFO0lBQzVCLElBQUk7UUFDRixtQkFBbUI7UUFDbkIsSUFBSSxNQUFNLEdBQUcsSUFBSSxlQUFNLENBQ3JCLGFBQWEsRUFDYixNQUFNLEVBQ04sS0FBSyxFQUNMLEtBQUssRUFDTCxTQUFTLEVBQ1QsdUJBQXVCLENBQ3hCLENBQUM7UUFDRixNQUFNLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxQixNQUFNLFFBQVEsR0FBRyxNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDOUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUN2QjtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNwQjtBQUNILENBQUMsQ0FBQSxDQUFDO0FBQ0YsVUFBVSxFQUFFLENBQUMifQ==