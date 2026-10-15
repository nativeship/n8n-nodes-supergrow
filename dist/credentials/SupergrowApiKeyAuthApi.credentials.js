"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupergrowApiKeyAuthApi = void 0;
class SupergrowApiKeyAuthApi {
    constructor() {
        this.name = "supergrowApiKeyAuthApi";
        this.displayName = "Supergrow (API Key Auth) API";
        this.documentationUrl = "https://external-api.supergrow.ai/api/v1/external/api-doc/openapi";
        this.icon = {
            light: "file:../nodes/Supergrow/supergrow.svg",
            dark: "file:../nodes/Supergrow/supergrow.dark.svg"
        };
        this.properties = [
            {
                displayName: "X-Api-Key",
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
                    "X-Api-Key": "={{$credentials.secret}}"
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
exports.SupergrowApiKeyAuthApi = SupergrowApiKeyAuthApi;
//# sourceMappingURL=SupergrowApiKeyAuthApi.credentials.js.map