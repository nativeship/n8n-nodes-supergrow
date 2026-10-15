"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupergrowBearerAuthApi = void 0;
class SupergrowBearerAuthApi {
    constructor() {
        this.name = "supergrowBearerAuthApi";
        this.displayName = "Supergrow (Bearer Auth) API";
        this.documentationUrl = "https://external-api.supergrow.ai/api/v1/external/api-doc/openapi";
        this.icon = {
            light: "file:../nodes/Supergrow/supergrow.svg",
            dark: "file:../nodes/Supergrow/supergrow.dark.svg"
        };
        this.properties = [
            {
                displayName: "Access Token",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://external-api.supergrow.ai/api/v1/external",
                url: "/analytics/followers"
            }
        };
    }
}
exports.SupergrowBearerAuthApi = SupergrowBearerAuthApi;
//# sourceMappingURL=SupergrowBearerAuthApi.credentials.js.map