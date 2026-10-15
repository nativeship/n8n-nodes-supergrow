import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class SupergrowBearerAuthApi implements ICredentialType {
  name = "supergrowBearerAuthApi";
  displayName = "Supergrow (Bearer Auth) API";
  documentationUrl = "https://external-api.supergrow.ai/api/v1/external/api-doc/openapi";
  icon: Icon = {
        light: "file:../nodes/Supergrow/supergrow.svg",
        dark: "file:../nodes/Supergrow/supergrow.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                Authorization: "=Bearer {{$credentials.secret}}"
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
