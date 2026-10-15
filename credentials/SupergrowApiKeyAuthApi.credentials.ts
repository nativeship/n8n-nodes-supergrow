import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class SupergrowApiKeyAuthApi implements ICredentialType {
  name = "supergrowApiKeyAuthApi";
  displayName = "Supergrow (API Key Auth) API";
  documentationUrl = "https://external-api.supergrow.ai/api/v1/external/api-doc/openapi";
  icon: Icon = {
        light: "file:../nodes/Supergrow/supergrow.svg",
        dark: "file:../nodes/Supergrow/supergrow.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                "X-Api-Key": "={{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://external-api.supergrow.ai/api/v1/external",
            url: "/analytics/followers"
        }
    };
}
