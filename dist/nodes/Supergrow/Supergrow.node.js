"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Supergrow = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Supergrow {
    constructor() {
        this.description = {
            displayName: "Supergrow",
            name: "supergrow",
            icon: {
                light: "file:supergrow.svg",
                dark: "file:supergrow.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{((JSON.parse(\"\\u007b\\\"analytics\\\":\\u007b\\\"getAnalyticsFollowers\\\":\\\"getFollowerAnalytics: analytic\\\",\\\"getAnalyticsMetrics\\\":\\\"getEngagementMetrics: analytic\\\",\\\"getAnalyticsWeeklyReports\\\":\\\"listWeeklyReports: analytic\\\"\\u007d,\\\"calendar\\\":\\u007b\\\"getCalendarMonthly\\\":\\\"getMonthlyCalendar: calendar\\\",\\\"getCalendarWeekly\\\":\\\"getWeeklyCalendar: calendar\\\"\\u007d,\\\"companyPages\\\":\\u007b\\\"getCompanyPages\\\":\\\"listCompanyPages: companyPage\\\"\\u007d,\\\"contentDna\\\":\\u007b\\\"getContentDna\\\":\\\"getContentDna: contentDna\\\",\\\"postContentDnaRegenerate\\\":\\\"regenerateContentDna: contentDna\\\"\\u007d,\\\"contentExtraction\\\":\\u007b\\\"postExtract\\\":\\\"extractTextFromUrl: contentExtraction\\\",\\\"postExtractAudio\\\":\\\"transcribeAudioOrVideo: contentExtraction\\\",\\\"postExtractPdf\\\":\\\"extractPdfText: contentExtraction\\\",\\\"postExtractYoutube\\\":\\\"extractYouTubeTranscript: contentExtraction\\\"\\u007d,\\\"kanban\\\":\\u007b\\\"getKanban\\\":\\\"getKanbanBoard: kanban\\\",\\\"getKanbanColumn\\\":\\\"getKanbanColumn: kanban\\\"\\u007d,\\\"knowledgeBase\\\":\\u007b\\\"deleteKnowledgeBaseId\\\":\\\"deleteKnowledgeBaseItem: knowledgeBase\\\",\\\"getKnowledgeBase\\\":\\\"listKnowledgeBaseItems: knowledgeBase\\\",\\\"getKnowledgeBaseId\\\":\\\"getKnowledgeBaseItem: knowledgeBase\\\",\\\"postKnowledgeBaseIngest\\\":\\\"addTextToKnowledgeBase: knowledgeBase\\\",\\\"postKnowledgeBaseSearch\\\":\\\"searchKnowledgeBase: knowledgeBase\\\"\\u007d,\\\"linkedinAccounts\\\":\\u007b\\\"getLinkedInAccounts\\\":\\\"listLinkedInAccounts: linkedInAccount\\\"\\u007d,\\\"media\\\":\\u007b\\\"getMedia\\\":\\\"listMediaItems: media\\\",\\\"getMediaId\\\":\\\"getMediaItem: media\\\",\\\"postMedia\\\":\\\"createMediaItem: media\\\",\\\"postMediaIdConfirm\\\":\\\"confirmMediaUpload: media\\\"\\u007d,\\\"postScore\\\":\\u007b\\\"postPostScore\\\":\\\"scoreLinkedInPost: postScore\\\"\\u007d,\\\"posts\\\":\\u007b\\\"deletePostsId\\\":\\\"deletePost: post\\\",\\\"deletePostsIdCommentsCommentId\\\":\\\"deleteAutoPlugComment: post\\\",\\\"deletePostsIdPublicLink\\\":\\\"removePublicPreviewLink: post\\\",\\\"getPosts\\\":\\\"listPosts: post\\\",\\\"getPostsId\\\":\\\"getPost: post\\\",\\\"getPostsIdComments\\\":\\\"listAutoPlugComments: post\\\",\\\"postPosts\\\":\\\"createPost: post\\\",\\\"postPostsIdComments\\\":\\\"addAutoPlugComments: post\\\",\\\"postPostsIdPublicLink\\\":\\\"createPublicPreviewLink: post\\\",\\\"postPostsIdPublish\\\":\\\"publishPost: post\\\",\\\"postPostsIdSchedule\\\":\\\"schedulePost: post\\\",\\\"postPostsIdUnschedule\\\":\\\"unschedulePost: post\\\",\\\"postPostsQueue\\\":\\\"queuePost: post\\\",\\\"putPostsId\\\":\\\"updatePost: post\\\"\\u007d,\\\"questions\\\":\\u007b\\\"postQuestionsFromText\\\":\\\"generateQuestionsFromText: question\\\",\\\"postQuestionsFromTopic\\\":\\\"generateQuestionsFromTopic: question\\\"\\u007d,\\\"workspaces\\\":\\u007b\\\"getWorkspaces\\\":\\\"listWorkspaces: workspace\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "Supergrow helps creators and teams create, schedule, publish, and analyze LinkedIn content",
            documentationUrl: "https://external-api.supergrow.ai/api/v1/external/api-doc/openapi",
            hints: [
                {
                    message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                }
            ],
            defaults: {
                name: "Supergrow"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "supergrowApiKeyAuthApi",
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: [
                                "ApiKeyAuth"
                            ]
                        }
                    }
                },
                {
                    name: "supergrowBearerAuthApi",
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: [
                                "BearerAuth"
                            ]
                        }
                    }
                }
            ],
            properties: [
                {
                    displayName: "Authentication",
                    name: "authentication",
                    type: "options",
                    noDataExpression: true,
                    default: "ApiKeyAuth",
                    options: [
                        {
                            name: "API Key Auth",
                            value: "ApiKeyAuth"
                        },
                        {
                            name: "Bearer Auth",
                            value: "BearerAuth"
                        }
                    ]
                },
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "analytics",
                    options: [
                        {
                            name: "Analytic",
                            value: "analytics"
                        },
                        {
                            name: "Calendar",
                            value: "calendar"
                        },
                        {
                            name: "Company Page",
                            value: "companyPages"
                        },
                        {
                            name: "Content DNA",
                            value: "contentDna"
                        },
                        {
                            name: "Content Extraction",
                            value: "contentExtraction"
                        },
                        {
                            name: "Kanban",
                            value: "kanban"
                        },
                        {
                            name: "Knowledge Base",
                            value: "knowledgeBase"
                        },
                        {
                            name: "LinkedIn Account",
                            value: "linkedinAccounts"
                        },
                        {
                            name: "Media",
                            value: "media"
                        },
                        {
                            name: "Post",
                            value: "posts"
                        },
                        {
                            name: "Post Score",
                            value: "postScore"
                        },
                        {
                            name: "Question",
                            value: "questions"
                        },
                        {
                            name: "Workspace",
                            value: "workspaces"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ]
                        }
                    },
                    default: "getAnalyticsFollowers",
                    options: [
                        {
                            name: "Get Engagement Metrics",
                            value: "getAnalyticsMetrics",
                            action: "Get engagement metrics analytics",
                            description: "Returns live trends for the requested linkedin engagement metric. analytics."
                        },
                        {
                            name: "Get Follower",
                            value: "getAnalyticsFollowers",
                            action: "Get follower analytics",
                            description: "Returns live linkedin follower counts and trends. analytics."
                        },
                        {
                            name: "List Weekly Reports",
                            value: "getAnalyticsWeeklyReports",
                            action: "List weekly reports analytics",
                            description: "Returns weekly performance reports. analytics."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getAnalyticsFollowers"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getAnalyticsFollowers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "End Date",
                            name: "end_date",
                            type: "string",
                            default: "",
                            description: "End of the custom date range (yyyy-mm-dd). use with `start_date`."
                        },
                        {
                            displayName: "Period",
                            name: "period",
                            type: "options",
                            default: "last_7_days",
                            description: "Predefined date range; ignored when custom dates are supplied",
                            options: [
                                {
                                    name: "Current Month",
                                    value: "current_month"
                                },
                                {
                                    name: "Last 30 Days",
                                    value: "last_30_days"
                                },
                                {
                                    name: "Last 7 Days",
                                    value: "last_7_days"
                                },
                                {
                                    name: "Previous Month",
                                    value: "previous_month"
                                }
                            ]
                        },
                        {
                            displayName: "Start Date",
                            name: "start_date",
                            type: "string",
                            default: "",
                            description: "Start of the custom date range (yyyy-mm-dd). use with `end_date`."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getAnalyticsMetrics"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getAnalyticsMetrics"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "End Date",
                            name: "end_date",
                            type: "string",
                            default: "",
                            description: "End of the custom date range (yyyy-mm-dd). use with `start_date`."
                        },
                        {
                            displayName: "Metric",
                            name: "metric",
                            type: "options",
                            default: "IMPRESSION",
                            description: "Linkedin engagement metric to retrieve",
                            options: [
                                {
                                    name: "COMMENT",
                                    value: "COMMENT"
                                },
                                {
                                    name: "IMPRESSION",
                                    value: "IMPRESSION"
                                },
                                {
                                    name: "MEMBERS REACHED",
                                    value: "MEMBERS_REACHED"
                                },
                                {
                                    name: "REACTION",
                                    value: "REACTION"
                                },
                                {
                                    name: "RESHARE",
                                    value: "RESHARE"
                                }
                            ]
                        },
                        {
                            displayName: "Period",
                            name: "period",
                            type: "options",
                            default: "last_7_days",
                            description: "Predefined date range; ignored when custom dates are supplied",
                            options: [
                                {
                                    name: "Current Month",
                                    value: "current_month"
                                },
                                {
                                    name: "Last 30 Days",
                                    value: "last_30_days"
                                },
                                {
                                    name: "Last 7 Days",
                                    value: "last_7_days"
                                },
                                {
                                    name: "Previous Month",
                                    value: "previous_month"
                                }
                            ]
                        },
                        {
                            displayName: "Start Date",
                            name: "start_date",
                            type: "string",
                            default: "",
                            description: "Start of the custom date range (yyyy-mm-dd). use with `end_date`."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getAnalyticsWeeklyReports"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getAnalyticsWeeklyReports"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Target Type",
                            name: "target_type",
                            type: "options",
                            default: "personal",
                            description: "Report target: personal profile, company page, or all targets. each report identifies its linkedin account or company page.",
                            options: [
                                {
                                    name: "All",
                                    value: "all"
                                },
                                {
                                    name: "Company Page",
                                    value: "company_page"
                                },
                                {
                                    name: "Personal",
                                    value: "personal"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "calendar"
                            ]
                        }
                    },
                    default: "getCalendarMonthly",
                    options: [
                        {
                            name: "Get Monthly",
                            value: "getCalendarMonthly",
                            action: "Get monthly calendar",
                            description: "Returns monthly publishing slots and scheduled posts for the selected month. calendar."
                        },
                        {
                            name: "Get Weekly",
                            value: "getCalendarWeekly",
                            action: "Get weekly calendar",
                            description: "Returns weekly publishing slots and scheduled posts for the selected week. calendar."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "calendar"
                            ],
                            operation: [
                                "getCalendarMonthly"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "calendar"
                            ],
                            operation: [
                                "getCalendarMonthly"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Offset",
                            name: "offset",
                            type: "number",
                            default: 0,
                            description: "Month offset: 0=current, 1=next, -1=previous"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "calendar"
                            ],
                            operation: [
                                "getCalendarWeekly"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "calendar"
                            ],
                            operation: [
                                "getCalendarWeekly"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Offset",
                            name: "offset",
                            type: "number",
                            default: 0,
                            description: "Week offset: 0=current, 1=next, -1=previous"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "companyPages"
                            ]
                        }
                    },
                    default: "getCompanyPages",
                    options: [
                        {
                            name: "List",
                            value: "getCompanyPages",
                            action: "List company pages",
                            description: "Lists linkedin company pages connected to the workspace"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "companyPages"
                            ],
                            operation: [
                                "getCompanyPages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contentDna"
                            ]
                        }
                    },
                    default: "getContentDna",
                    options: [
                        {
                            name: "Get",
                            value: "getContentDna",
                            action: "Get content dna",
                            description: "Returns the workspace's professional profile, writing style, content patterns, and target audience. content dna."
                        },
                        {
                            name: "Regenerate",
                            value: "postContentDnaRegenerate",
                            action: "Regenerate content dna",
                            description: "Starts async regeneration from linkedin profile data. content dna."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentDna"
                            ],
                            operation: [
                                "getContentDna"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentDna"
                            ],
                            operation: [
                                "postContentDnaRegenerate"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ]
                        }
                    },
                    default: "postExtract",
                    options: [
                        {
                            name: "Extract PDF Text",
                            value: "postExtractPdf",
                            action: "Extract pdf text content extraction",
                            description: "Extracts text from a pdf file. limited to 10 extractions per day per workspace. content extraction."
                        },
                        {
                            name: "Extract Text From URL",
                            value: "postExtract",
                            action: "Extract text from URL content extraction",
                            description: "Detects whether a URL points to a webpage, youtube video, pdf, or audio source and extracts its text. content extraction."
                        },
                        {
                            name: "Extract YouTube Transcript",
                            value: "postExtractYoutube",
                            action: "Extract youtube transcript content extraction",
                            description: "Extracts a transcript from a youtube video. limited to 10 extractions per day per workspace. content extraction."
                        },
                        {
                            name: "Transcribe Audio Or Video",
                            value: "postExtractAudio",
                            action: "Transcribe audio or video content extraction",
                            description: "Transcribes a supported audio or video file to text. content extraction."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtract"
                            ]
                        }
                    }
                },
                {
                    displayName: "URL",
                    name: "url",
                    type: "string",
                    default: "",
                    required: true,
                    description: "URL of a webpage, youtube video, pdf, or audio source to extract",
                    hint: "Expected format: uri",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtract"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtractAudio"
                            ]
                        }
                    }
                },
                {
                    displayName: "URL",
                    name: "url",
                    type: "string",
                    default: "",
                    required: true,
                    description: "URL of the audio or video file to transcribe",
                    hint: "Expected format: uri",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtractAudio"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtractPdf"
                            ]
                        }
                    }
                },
                {
                    displayName: "URL",
                    name: "url",
                    type: "string",
                    default: "",
                    required: true,
                    description: "URL of the pdf to extract",
                    hint: "Expected format: uri",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtractPdf"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtractYoutube"
                            ]
                        }
                    }
                },
                {
                    displayName: "URL",
                    name: "url",
                    type: "string",
                    default: "",
                    required: true,
                    description: "URL of the youtube video to transcribe",
                    hint: "Expected format: uri",
                    displayOptions: {
                        show: {
                            resource: [
                                "contentExtraction"
                            ],
                            operation: [
                                "postExtractYoutube"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "kanban"
                            ]
                        }
                    },
                    default: "getKanban",
                    options: [
                        {
                            name: "Get Kanban Board",
                            value: "getKanban",
                            action: "Get kanban board",
                            description: "Returns posts grouped by workflow status, with pagination. kanban."
                        },
                        {
                            name: "Get Kanban Column",
                            value: "getKanbanColumn",
                            action: "Get kanban column",
                            description: "Returns a paginated list of posts for the selected status. kanban."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "kanban"
                            ],
                            operation: [
                                "getKanban"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "kanban"
                            ],
                            operation: [
                                "getKanban"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "Page number to return"
                        },
                        {
                            displayName: "Per Page",
                            name: "per_page",
                            type: "number",
                            default: 10,
                            description: "Number of results per page (maximum 100)",
                            typeOptions: {
                                maxValue: 100
                            }
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "kanban"
                            ],
                            operation: [
                                "getKanbanColumn"
                            ]
                        }
                    }
                },
                {
                    displayName: "Status",
                    name: "status",
                    type: "options",
                    default: "draft",
                    required: true,
                    description: "Workflow status of the posts to return",
                    options: [
                        {
                            name: "Approved",
                            value: "approved"
                        },
                        {
                            name: "Draft",
                            value: "draft"
                        },
                        {
                            name: "Needs Changes",
                            value: "needs_changes"
                        },
                        {
                            name: "Published",
                            value: "published"
                        },
                        {
                            name: "Scheduled",
                            value: "scheduled"
                        },
                        {
                            name: "Under Review",
                            value: "under_review"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "kanban"
                            ],
                            operation: [
                                "getKanbanColumn"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "kanban"
                            ],
                            operation: [
                                "getKanbanColumn"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "Page number to return"
                        },
                        {
                            displayName: "Per Page",
                            name: "per_page",
                            type: "number",
                            default: 10,
                            description: "Number of results per page (maximum 100)",
                            typeOptions: {
                                maxValue: 100
                            }
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ]
                        }
                    },
                    default: "deleteKnowledgeBaseId",
                    options: [
                        {
                            name: "Add Text To",
                            value: "postKnowledgeBaseIngest",
                            action: "Add text to knowledge base",
                            description: "Adds plain text to the workspace knowledge base for asynchronous indexing"
                        },
                        {
                            name: "Delete Knowledge Base Item",
                            value: "deleteKnowledgeBaseId",
                            action: "Delete knowledge base item",
                            description: "Permanently deletes a knowledge base item and its associated chunks"
                        },
                        {
                            name: "Get Knowledge Base Item",
                            value: "getKnowledgeBaseId",
                            action: "Get knowledge base item",
                            description: "Returns a knowledge base item by ID"
                        },
                        {
                            name: "List Knowledge Base Items",
                            value: "getKnowledgeBase",
                            action: "List knowledge base items",
                            description: "Lists workspace knowledge base items, with optional source-type and status filters and pagination"
                        },
                        {
                            name: "Search",
                            value: "postKnowledgeBaseSearch",
                            action: "Search knowledge base",
                            description: "Searches the workspace knowledge base by meaning and returns matching text chunks and extracted insights ranked by relevance"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "deleteKnowledgeBaseId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the knowledge base item (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "deleteKnowledgeBaseId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "getKnowledgeBase"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "getKnowledgeBase"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "Page number to return"
                        },
                        {
                            displayName: "Per Page",
                            name: "per_page",
                            type: "number",
                            default: 20,
                            description: "Number of results per page (maximum 100)",
                            typeOptions: {
                                maxValue: 100
                            }
                        },
                        {
                            displayName: "Source Type",
                            name: "source_type",
                            type: "options",
                            default: "text",
                            description: "Filter items by source type",
                            options: [
                                {
                                    name: "Document",
                                    value: "document"
                                },
                                {
                                    name: "Pdf",
                                    value: "pdf"
                                },
                                {
                                    name: "Text",
                                    value: "text"
                                },
                                {
                                    name: "Voice",
                                    value: "voice"
                                },
                                {
                                    name: "Website",
                                    value: "website"
                                },
                                {
                                    name: "Youtube",
                                    value: "youtube"
                                }
                            ]
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "draft",
                            description: "Filter items by processing status",
                            options: [
                                {
                                    name: "Draft",
                                    value: "draft"
                                },
                                {
                                    name: "Failed",
                                    value: "failed"
                                },
                                {
                                    name: "Processing",
                                    value: "processing"
                                },
                                {
                                    name: "Ready",
                                    value: "ready"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "getKnowledgeBaseId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the knowledge base item (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "getKnowledgeBaseId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "postKnowledgeBaseIngest"
                            ]
                        }
                    }
                },
                {
                    displayName: "Content",
                    name: "content",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Plain text to add to the knowledge base",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "postKnowledgeBaseIngest"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "postKnowledgeBaseIngest"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: "",
                            description: "Optional title for the knowledge base item"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "postKnowledgeBaseSearch"
                            ]
                        }
                    }
                },
                {
                    displayName: "Query",
                    name: "query",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Terms or concepts to match against indexed content",
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "postKnowledgeBaseSearch"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "knowledgeBase"
                            ],
                            operation: [
                                "postKnowledgeBaseSearch"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Include Insights",
                            name: "include_insights",
                            type: "boolean",
                            default: true,
                            description: "Whether include ai-extracted insights; set to false to return raw chunks only"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Similarity Threshold",
                            name: "similarity_threshold",
                            type: "number",
                            default: 0,
                            description: "Minimum similarity score from 0 to 1 for returned results"
                        },
                        {
                            displayName: "Source Type",
                            name: "source_type",
                            type: "options",
                            default: "text",
                            description: "Limit results to this source type",
                            options: [
                                {
                                    name: "Document",
                                    value: "document"
                                },
                                {
                                    name: "Pdf",
                                    value: "pdf"
                                },
                                {
                                    name: "Text",
                                    value: "text"
                                },
                                {
                                    name: "Voice",
                                    value: "voice"
                                },
                                {
                                    name: "Website",
                                    value: "website"
                                },
                                {
                                    name: "Youtube",
                                    value: "youtube"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "linkedinAccounts"
                            ]
                        }
                    },
                    default: "getLinkedInAccounts",
                    options: [
                        {
                            name: "List",
                            value: "getLinkedInAccounts",
                            action: "List linkedin accounts",
                            description: "Lists linkedin accounts connected to the workspace without exposing sensitive tokens"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "linkedinAccounts"
                            ],
                            operation: [
                                "getLinkedInAccounts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ]
                        }
                    },
                    default: "getMedia",
                    options: [
                        {
                            name: "Confirm Media Upload",
                            value: "postMediaIdConfirm",
                            action: "Confirm media upload",
                            description: "Verifies the uploaded file and marks the media item as confirmed. image bytes must be jpeg, png, or gif;."
                        },
                        {
                            name: "Create Media Item",
                            value: "postMedia",
                            action: "Create media item",
                            description: "Creates a pending media item and a presigned upload URL"
                        },
                        {
                            name: "Get Media Item",
                            value: "getMediaId",
                            action: "Get media item",
                            description: "Returns a confirmed media item with a presigned download URL that expires after 24 hours"
                        },
                        {
                            name: "List Media Items",
                            value: "getMedia",
                            action: "List media items",
                            description: "Lists confirmed workspace media, with optional media-type filtering and pagination"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "getMedia"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "getMedia"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Media Type",
                            name: "media_type",
                            type: "options",
                            default: "image",
                            description: "Limit results to this media type",
                            options: [
                                {
                                    name: "Audio",
                                    value: "audio"
                                },
                                {
                                    name: "Document",
                                    value: "document"
                                },
                                {
                                    name: "Image",
                                    value: "image"
                                },
                                {
                                    name: "Video",
                                    value: "video"
                                }
                            ]
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "Page number to return"
                        },
                        {
                            displayName: "Per Page",
                            name: "per_page",
                            type: "number",
                            default: 20,
                            description: "Number of results per page (maximum 100)",
                            typeOptions: {
                                maxValue: 100
                            }
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "getMediaId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the media item (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "getMediaId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Content Type",
                    name: "content_type",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Mime type of the file, such as `image/jpeg` or `application/pdf`. images must be jpeg, png, or gif.",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "postMedia"
                            ]
                        }
                    }
                },
                {
                    displayName: "File Name",
                    name: "file_name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Original file name of the media item",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "postMedia"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace that will own the media item",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "postMedia"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the media item (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "postMediaIdConfirm"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace that owns the media item",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "postMediaIdConfirm"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "postScore"
                            ]
                        }
                    },
                    default: "postPostScore",
                    options: [
                        {
                            name: "Score LinkedIn Post",
                            value: "postPostScore",
                            action: "Score linkedin post post score",
                            description: "Evaluates linkedin post performance and authenticity. post score."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "postScore"
                            ],
                            operation: [
                                "postPostScore"
                            ]
                        }
                    }
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Linkedin post text to evaluate",
                    displayOptions: {
                        show: {
                            resource: [
                                "postScore"
                            ],
                            operation: [
                                "postPostScore"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ]
                        }
                    },
                    default: "deletePostsId",
                    options: [
                        {
                            name: "Add Auto Plug Comments",
                            value: "postPostsIdComments",
                            action: "Add auto plug comments posts",
                            description: "Adds comments that publish automatically after the post goes live, with a configurable delay"
                        },
                        {
                            name: "Create",
                            value: "postPosts",
                            action: "Create post",
                            description: "Creates a draft linkedin post"
                        },
                        {
                            name: "Create Public Preview Link",
                            value: "postPostsIdPublicLink",
                            action: "Create public preview link posts",
                            description: "Creates a shareable preview link, or returns the existing link if one is already set. posts."
                        },
                        {
                            name: "Delete",
                            value: "deletePostsId",
                            action: "Delete post",
                            description: "Deletes a draft or failed post"
                        },
                        {
                            name: "Delete Auto Plug Comment",
                            value: "deletePostsIdCommentsCommentId",
                            action: "Delete auto plug comment posts",
                            description: "Deletes an auto-plug comment. comments on published posts cannot be deleted."
                        },
                        {
                            name: "Get",
                            value: "getPostsId",
                            action: "Get post",
                            description: "Returns a post by ID, including its current content and status"
                        },
                        {
                            name: "List",
                            value: "getPosts",
                            action: "List posts",
                            description: "Lists workspace posts, with optional filters for status and tag IDs"
                        },
                        {
                            name: "List Auto Plug Comments",
                            value: "getPostsIdComments",
                            action: "List auto plug comments posts",
                            description: "Lists the auto-plug comments configured for a post"
                        },
                        {
                            name: "Publish",
                            value: "postPostsIdPublish",
                            action: "Publish post",
                            description: "Starts publishing the post immediately. publishing runs asynchronously."
                        },
                        {
                            name: "Queue",
                            value: "postPostsQueue",
                            action: "Queue post",
                            description: "Creates a post and schedules it for the next available time slot"
                        },
                        {
                            name: "Remove Public Preview Link",
                            value: "deletePostsIdPublicLink",
                            action: "Remove public preview link posts",
                            description: "Removes the post's public preview link"
                        },
                        {
                            name: "Schedule",
                            value: "postPostsIdSchedule",
                            action: "Schedule post",
                            description: "Schedules a post using the workspace's local time zone"
                        },
                        {
                            name: "Unschedule",
                            value: "postPostsIdUnschedule",
                            action: "Unschedule post",
                            description: "Removes a post from the schedule and returns it to draft status"
                        },
                        {
                            name: "Update",
                            value: "putPostsId",
                            action: "Update post",
                            description: "Updates an existing draft post"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsIdCommentsCommentId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsIdCommentsCommentId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Comment ID",
                    name: "comment_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the auto-plug comment (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsIdCommentsCommentId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsIdPublicLink"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "deletePostsIdPublicLink"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Status",
                    name: "status",
                    type: "options",
                    default: "draft",
                    required: true,
                    description: "Post status to filter by",
                    options: [
                        {
                            name: "All",
                            value: "all"
                        },
                        {
                            name: "Draft",
                            value: "draft"
                        },
                        {
                            name: "Failed",
                            value: "failed"
                        },
                        {
                            name: "Published",
                            value: "published"
                        },
                        {
                            name: "Scheduled",
                            value: "scheduled"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Tag IDs",
                            name: "tag_ids",
                            type: "string",
                            default: "",
                            description: "Comma-separated IDs of post tags"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPostsIdComments"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "getPostsIdComments"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Text content of the linkedin post",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Carousel Title",
                            name: "carousel_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "File URL",
                            name: "file_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Image URLs",
                            name: "image_urls",
                            type: "json",
                            default: [],
                            description: "Legacy field retained for compatibility; signed URLs are rejected. use `media_ids` instead."
                        },
                        {
                            displayName: "Linked In Company Page ID",
                            name: "linked_in_company_page_id",
                            type: "string",
                            default: "",
                            description: "Company page ID to publish from instead of a personal profile. get page IDs from `get /company-pages`.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Media IDs",
                            name: "media_ids",
                            type: "json",
                            default: [],
                            description: "IDs of confirmed media items uploaded through `post /media`. the server derives legacy media URLs and preserves the array order."
                        },
                        {
                            displayName: "Video Thumbnail URL",
                            name: "video_thumbnail_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Video Title",
                            name: "video_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Video URL",
                            name: "video_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdComments"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdComments"
                            ]
                        }
                    }
                },
                {
                    displayName: "Comments",
                    name: "comments",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Comments to publish automatically after the post goes live",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdComments"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdPublicLink"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdPublicLink"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdPublish"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdPublish"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdSchedule"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdSchedule"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdSchedule"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Day Of The Month",
                            name: "day_of_the_month",
                            type: "number",
                            default: 0,
                            description: "Day of the month for the scheduled date (1-31)",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 31
                            }
                        },
                        {
                            displayName: "Day Of Week",
                            name: "day_of_week",
                            type: "number",
                            default: 0,
                            description: "Day of week: 0=sunday through 6=saturday"
                        },
                        {
                            displayName: "Hour",
                            name: "hour",
                            type: "number",
                            default: 0,
                            description: "Hour in the workspace local time zone (0-23); do not convert to UTC",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 23
                            }
                        },
                        {
                            displayName: "Minute",
                            name: "minute",
                            type: "number",
                            default: 0,
                            description: "Minute within the hour (0-59)",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 59
                            }
                        },
                        {
                            displayName: "Month",
                            name: "month",
                            type: "number",
                            default: 0,
                            description: "Month for the scheduled date (1-12)",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 12
                            }
                        },
                        {
                            displayName: "Year",
                            name: "year",
                            type: "number",
                            default: 0,
                            description: "Year for the scheduled date"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdUnschedule"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsIdUnschedule"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsQueue"
                            ]
                        }
                    }
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Text content of the linkedin post",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsQueue"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "postPostsQueue"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Carousel Title",
                            name: "carousel_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "File URL",
                            name: "file_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Image URLs",
                            name: "image_urls",
                            type: "json",
                            default: [],
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Linked In Company Page ID",
                            name: "linked_in_company_page_id",
                            type: "string",
                            default: "",
                            description: "Company page ID to publish from instead of a personal profile. get page IDs from `get /company-pages`.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Media IDs",
                            name: "media_ids",
                            type: "json",
                            default: [],
                            description: "IDs of confirmed media items uploaded through `post /media`. the server derives legacy media URLs and preserves the array order."
                        },
                        {
                            displayName: "Video Title",
                            name: "video_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Video URL",
                            name: "video_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "putPostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the post (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "putPostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Text content of the linkedin post",
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "putPostsId"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "posts"
                            ],
                            operation: [
                                "putPostsId"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Carousel Title",
                            name: "carousel_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "File URL",
                            name: "file_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Image URLs",
                            name: "image_urls",
                            type: "json",
                            default: [],
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Media IDs",
                            name: "media_ids",
                            type: "json",
                            default: [],
                            description: "IDs of confirmed media items uploaded through `post /media`. the server derives legacy media URLs and preserves the array order."
                        },
                        {
                            displayName: "Video Thumbnail URL",
                            name: "video_thumbnail_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        },
                        {
                            displayName: "Video Title",
                            name: "video_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Video URL",
                            name: "video_url",
                            type: "string",
                            default: "",
                            description: "Legacy field retained for compatibility; use `media_ids` instead"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "questions"
                            ]
                        }
                    },
                    default: "postQuestionsFromText",
                    options: [
                        {
                            name: "Generate Questions From Text",
                            value: "postQuestionsFromText",
                            action: "Generate questions from text",
                            description: "Analyzes text and creates contextual interview questions to help develop linkedin posts"
                        },
                        {
                            name: "Generate Questions From Topic",
                            value: "postQuestionsFromTopic",
                            action: "Generate questions from topic",
                            description: "Generates 8-12 interview questions for a topic, using the workspace's content dna when available. each question includes follow-up prompts."
                        }
                    ]
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "questions"
                            ],
                            operation: [
                                "postQuestionsFromText"
                            ]
                        }
                    }
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Text to analyze and use as context for the questions",
                    displayOptions: {
                        show: {
                            resource: [
                                "questions"
                            ],
                            operation: [
                                "postQuestionsFromText"
                            ]
                        }
                    }
                },
                {
                    displayName: "Workspace ID",
                    name: "workspace_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the workspace (UUID)",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "questions"
                            ],
                            operation: [
                                "postQuestionsFromTopic"
                            ]
                        }
                    }
                },
                {
                    displayName: "Topic",
                    name: "topic",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Topic to use for the questions",
                    displayOptions: {
                        show: {
                            resource: [
                                "questions"
                            ],
                            operation: [
                                "postQuestionsFromTopic"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "workspaces"
                            ]
                        }
                    },
                    default: "getWorkspaces",
                    options: [
                        {
                            name: "List",
                            value: "getWorkspaces",
                            action: "List workspaces",
                            description: "Lists workspaces available to the authenticated user and the user's role in each"
                        }
                    ]
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                const authenticationChoice = this.getNodeParameter('authentication', itemIndex, '');
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "getAnalyticsFollowers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/analytics/followers";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["period"] !== undefined)
                            qs["period"] = additionalFields["period"];
                        if (additionalFields["start_date"] !== undefined)
                            qs["start_date"] = additionalFields["start_date"];
                        if (additionalFields["end_date"] !== undefined)
                            qs["end_date"] = additionalFields["end_date"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Follower Analytics"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["current_count", "trend"], simplified: ["current_count", "trend"] };
                        errorPlan = { "422": { "title": "No LinkedIn account connected" } };
                        break;
                    }
                    case "getAnalyticsMetrics": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/analytics/metrics";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["metric"] !== undefined)
                            qs["metric"] = additionalFields["metric"];
                        if (additionalFields["period"] !== undefined)
                            qs["period"] = additionalFields["period"];
                        if (additionalFields["start_date"] !== undefined)
                            qs["start_date"] = additionalFields["start_date"];
                        if (additionalFields["end_date"] !== undefined)
                            qs["end_date"] = additionalFields["end_date"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Engagement Metrics"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "metric_type"], simplified: ["data", "metric_type"] };
                        errorPlan = { "422": { "title": "No LinkedIn account connected or invalid metric" } };
                        break;
                    }
                    case "getAnalyticsWeeklyReports": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/analytics/weekly-reports";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["target_type"] !== undefined)
                            qs["target_type"] = additionalFields["target_type"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Weekly Reports"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["weekly_reports"], simplified: ["weekly_reports"] };
                        errorPlan = {};
                        break;
                    }
                    case "getCalendarMonthly": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/calendar/monthly";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Monthly Calendar"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["calendar", "timezone"], simplified: ["calendar", "timezone"] };
                        errorPlan = {};
                        break;
                    }
                    case "getCalendarWeekly": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/calendar/weekly";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Weekly Calendar"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["calendar", "timezone"], simplified: ["calendar", "timezone"] };
                        errorPlan = {};
                        break;
                    }
                    case "getCompanyPages": {
                        const path = "/company-pages";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Company Pages"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["company_pages"], simplified: ["company_pages"] };
                        errorPlan = {};
                        break;
                    }
                    case "getContentDna": {
                        const path = "/content-dna";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Content DNA"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["content_dna"], simplified: ["content_dna"] };
                        errorPlan = {};
                        break;
                    }
                    case "postContentDnaRegenerate": {
                        const path = "/content-dna/regenerate";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Regenerate Content DNA"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["content_dna", "message"], simplified: ["content_dna", "message"] };
                        errorPlan = { "409": { "title": "Content DNA regeneration is already in progress" }, "422": { "title": "Insufficient published history without a profile URL, invalid URL, or ambiguous member account" }, "503": { "title": "Failed to enqueue regeneration; the request claim has been released" } };
                        break;
                    }
                    case "postExtract": {
                        const path = "/extract";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "url", "displayName": "Url", "description": "URL of a webpage, YouTube video, PDF, or audio source to extract.", "type": "string", "format": "uri", "required": true }, this.getNodeParameter("url", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Extract Text from URL"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["text", "url"], simplified: ["text", "url"] };
                        errorPlan = { "429": { "title": "Daily extraction limit reached" } };
                        break;
                    }
                    case "postExtractAudio": {
                        const path = "/extract/audio";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "url", "displayName": "Url", "description": "URL of the audio or video file to transcribe.", "type": "string", "format": "uri", "required": true }, this.getNodeParameter("url", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Transcribe Audio or Video"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["text", "url"], simplified: ["text", "url"] };
                        errorPlan = {};
                        break;
                    }
                    case "postExtractPdf": {
                        const path = "/extract/pdf";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "url", "displayName": "Url", "description": "URL of the PDF to extract.", "type": "string", "format": "uri", "required": true }, this.getNodeParameter("url", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Extract PDF Text"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["text", "url"], simplified: ["text", "url"] };
                        errorPlan = {};
                        break;
                    }
                    case "postExtractYoutube": {
                        const path = "/extract/youtube";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "url", "displayName": "Url", "description": "URL of the YouTube video to transcribe.", "type": "string", "format": "uri", "required": true }, this.getNodeParameter("url", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Extract YouTube Transcript"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["text", "url"], simplified: ["text", "url"] };
                        errorPlan = {};
                        break;
                    }
                    case "getKanban": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/kanban";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["per_page"] !== undefined)
                            qs["per_page"] = additionalFields["per_page"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Kanban Board"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "getKanbanColumn": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/kanban/column";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        qs["status"] = this.getNodeParameter("status", itemIndex);
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["per_page"] !== undefined)
                            qs["per_page"] = additionalFields["per_page"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Kanban Column"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "deleteKnowledgeBaseId": {
                        let path = "/knowledge-base/{id}";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Delete Knowledge Base Item"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["status"], simplified: ["status"] };
                        errorPlan = { "404": { "title": "Item not found" } };
                        break;
                    }
                    case "getKnowledgeBase": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/knowledge-base";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["source_type"] !== undefined)
                            qs["source_type"] = additionalFields["source_type"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["per_page"] !== undefined)
                            qs["per_page"] = additionalFields["per_page"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Knowledge Base Items"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["knowledge_base_items", "page", "per_page", "total_count"], simplified: ["knowledge_base_items", "page", "per_page", "total_count"] };
                        errorPlan = {};
                        break;
                    }
                    case "getKnowledgeBaseId": {
                        let path = "/knowledge-base/{id}";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Knowledge Base Item"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["knowledge_base_item"], simplified: ["knowledge_base_item"] };
                        errorPlan = { "404": { "title": "Item not found or belongs to a different workspace" } };
                        break;
                    }
                    case "postKnowledgeBaseIngest": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/knowledge-base/ingest";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "content", "displayName": "Content", "description": "Plain text to add to the knowledge base.", "type": "string", "required": true }, this.getNodeParameter("content", itemIndex), this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "description": "Optional title for the knowledge base item.", "type": "string" }, additionalFields["title"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Add Text to Knowledge Base"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["knowledge_base_item"], simplified: ["knowledge_base_item"] };
                        errorPlan = { "401": { "title": "Unauthorized or workspace access denied" }, "422": { "title": "content parameter missing or ingestion failed" } };
                        break;
                    }
                    case "postKnowledgeBaseSearch": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/knowledge-base/search";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["include_insights"] !== undefined)
                            setBodyField(body, { "name": "include_insights", "displayName": "Include insights", "description": "Include AI-extracted insights; set to false to return raw chunks only.", "type": "boolean", "default": true }, additionalFields["include_insights"], this, itemIndex);
                        if (additionalFields["limit"] !== undefined)
                            setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Maximum number of results to return (1-50).", "type": "integer", "minValue": 1, "maxValue": 50, "default": 10 }, additionalFields["limit"], this, itemIndex);
                        setBodyField(body, { "name": "query", "displayName": "Query", "description": "Terms or concepts to match against indexed content.", "type": "string", "required": true }, this.getNodeParameter("query", itemIndex), this, itemIndex);
                        if (additionalFields["similarity_threshold"] !== undefined)
                            setBodyField(body, { "name": "similarity_threshold", "displayName": "Similarity threshold", "description": "Minimum similarity score from 0 to 1 for returned results.", "type": "number" }, additionalFields["similarity_threshold"], this, itemIndex);
                        if (additionalFields["source_type"] !== undefined)
                            setBodyField(body, { "name": "source_type", "displayName": "Source type", "description": "Limit results to this source type.", "type": "string", "enum": ["text", "website", "pdf", "document", "youtube", "voice"] }, additionalFields["source_type"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Search Knowledge Base"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["query", "results", "total_results"], simplified: ["query", "results", "total_results"] };
                        errorPlan = { "401": { "title": "Unauthorized or workspace access denied" }, "422": { "title": "query parameter missing" } };
                        break;
                    }
                    case "getLinkedInAccounts": {
                        const path = "/linked-in-accounts";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List LinkedIn Accounts"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["linked_in_accounts"], simplified: ["linked_in_accounts"] };
                        errorPlan = {};
                        break;
                    }
                    case "getMedia": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/media";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["media_type"] !== undefined)
                            qs["media_type"] = additionalFields["media_type"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["per_page"] !== undefined)
                            qs["per_page"] = additionalFields["per_page"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Media Items"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["media_items", "pagination"], simplified: ["media_items", "pagination"] };
                        errorPlan = {};
                        break;
                    }
                    case "getMediaId": {
                        let path = "/media/{id}";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Media Item"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["media_item"], simplified: ["media_item"] };
                        errorPlan = { "404": { "title": "Media item not found" } };
                        break;
                    }
                    case "postMedia": {
                        const path = "/media";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "content_type", "displayName": "Content type", "description": "MIME type of the file, such as `image/jpeg` or `application/pdf`. Images must be JPEG, PNG, or GIF.", "type": "string", "required": true }, this.getNodeParameter("content_type", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "file_name", "displayName": "File name", "description": "Original file name of the media item.", "type": "string", "required": true }, this.getNodeParameter("file_name", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "workspace_id", "displayName": "Workspace id", "description": "ID of the workspace that will own the media item.", "type": "string", "format": "uuid", "required": true }, this.getNodeParameter("workspace_id", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Create Media Item"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["media_item", "upload"], simplified: ["media_item", "upload"] };
                        errorPlan = { "401": { "title": "Missing/invalid credential, or the authenticated user does not have access to this workspace" }, "403": { "title": "Returned if the account is blocked or the caller's plan is not paid. Paid-plan errors include `PAID_PLAN_REQUIRED`." }, "404": { "title": "Workspace not found" }, "422": { "title": "Returned for missing fields, storage errors, or unsupported image MIME types. Images must be JPEG, PNG, or GIF." } };
                        break;
                    }
                    case "postMediaIdConfirm": {
                        let path = "/media/{id}/confirm";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        setBodyField(body, { "name": "workspace_id", "displayName": "Workspace id", "description": "ID of the workspace that owns the media item.", "type": "string", "format": "uuid", "required": true }, this.getNodeParameter("workspace_id", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Confirm Media Upload"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["media_item"], simplified: ["media_item"] };
                        errorPlan = { "401": { "title": "Missing/invalid credential, or the authenticated user does not have access to this workspace" }, "403": { "title": "Returned if the account is blocked or the caller's plan is not paid. Paid-plan errors include `PAID_PLAN_REQUIRED`." }, "404": { "title": "Media item not found in this workspace" }, "422": { "title": "Returned if the upload is missing from storage (the item remains pending) or image bytes use an unsupported format. Unsupported images and their media items are deleted; start a new upload using JPEG, PNG, or GIF." } };
                        break;
                    }
                    case "postPostScore": {
                        const path = "/post-score";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "LinkedIn post text to evaluate.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Score LinkedIn Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["analysis", "score"], simplified: ["analysis", "score"] };
                        errorPlan = { "422": { "title": "Invalid input or scoring failed" } };
                        break;
                    }
                    case "deletePostsId": {
                        let path = "/posts/{id}";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Delete Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "deletePostsIdCommentsCommentId": {
                        let path = "/posts/{id}/comments/{comment_id}";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        path = path.split("{comment_id}").join(encodeURIComponent(String(this.getNodeParameter("comment_id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Delete Auto-Plug Comment"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "404": { "title": "Comment not found" }, "422": { "title": "Cannot delete comments on a published post" } };
                        break;
                    }
                    case "deletePostsIdPublicLink": {
                        let path = "/posts/{id}/public-link";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Remove Public Preview Link"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "getPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/posts";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        qs["status"] = this.getNodeParameter("status", itemIndex);
                        if (additionalFields["tag_ids"] !== undefined)
                            qs["tag_ids"] = additionalFields["tag_ids"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Posts"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["posts"], simplified: ["posts"] };
                        errorPlan = {};
                        break;
                    }
                    case "getPostsId": {
                        let path = "/posts/{id}";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Get Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["post"], simplified: ["post"] };
                        errorPlan = {};
                        break;
                    }
                    case "getPostsIdComments": {
                        let path = "/posts/{id}/comments";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Auto-Plug Comments"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["comments"], simplified: ["comments"] };
                        errorPlan = { "404": { "title": "Post not found" } };
                        break;
                    }
                    case "postPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/posts";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["carousel_title"] !== undefined)
                            setBodyField(body, { "name": "carousel_title", "displayName": "Carousel title", "type": "string" }, additionalFields["carousel_title"], this, itemIndex);
                        if (additionalFields["file_url"] !== undefined)
                            setBodyField(body, { "name": "file_url", "displayName": "File url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["file_url"], this, itemIndex);
                        if (additionalFields["image_urls"] !== undefined)
                            setBodyField(body, { "name": "image_urls", "displayName": "Image urls", "description": "Legacy field retained for compatibility; signed URLs are rejected. Use `media_ids` instead.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["image_urls"], this, itemIndex);
                        if (additionalFields["linked_in_company_page_id"] !== undefined)
                            setBodyField(body, { "name": "linked_in_company_page_id", "displayName": "Linked in company page id", "description": "Company page ID to publish from instead of a personal profile. Get page IDs from `GET /company-pages`.", "type": "string", "format": "uuid" }, additionalFields["linked_in_company_page_id"], this, itemIndex);
                        if (additionalFields["media_ids"] !== undefined)
                            setBodyField(body, { "name": "media_ids", "displayName": "Media ids", "description": "IDs of confirmed media items uploaded through `POST /media`. The server derives legacy media URLs and preserves the array order.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "format": "uuid" } }, additionalFields["media_ids"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "Text content of the LinkedIn post.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        if (additionalFields["video_thumbnail_url"] !== undefined)
                            setBodyField(body, { "name": "video_thumbnail_url", "displayName": "Video thumbnail url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["video_thumbnail_url"], this, itemIndex);
                        if (additionalFields["video_title"] !== undefined)
                            setBodyField(body, { "name": "video_title", "displayName": "Video title", "type": "string" }, additionalFields["video_title"], this, itemIndex);
                        if (additionalFields["video_url"] !== undefined)
                            setBodyField(body, { "name": "video_url", "displayName": "Video url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["video_url"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Create Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["post", "status"], simplified: ["post", "status"] };
                        errorPlan = {};
                        break;
                    }
                    case "postPostsIdComments": {
                        let path = "/posts/{id}/comments";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        setBodyField(body, { "name": "comments", "displayName": "Comments", "description": "Comments to publish automatically after the post goes live.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "post_after_time_unit", "displayName": "Post after time unit", "description": "Unit for the delay after the post is published.", "type": "string", "required": true, "enum": ["minutes", "hours", "days"] }, { "name": "post_after_time_unit_count", "displayName": "Post after time unit count", "description": "Number of time units to wait after the post is published.", "type": "integer", "required": true, "example": 5 }, { "name": "text", "displayName": "Text", "description": "Text of the comment.", "type": "string", "required": true }] } }, this.getNodeParameter("comments", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Add Auto-Plug Comments"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["comments", "errors"], simplified: ["comments", "errors"] };
                        errorPlan = { "400": { "title": "Cannot add comments to a published post" }, "404": { "title": "Post not found" } };
                        break;
                    }
                    case "postPostsIdPublicLink": {
                        let path = "/posts/{id}/public-link";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Create Public Preview Link"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["public_url"], simplified: ["public_url"] };
                        errorPlan = { "404": { "title": "Post not found" } };
                        break;
                    }
                    case "postPostsIdPublish": {
                        let path = "/posts/{id}/publish";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Publish Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "postPostsIdSchedule": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/posts/{id}/schedule";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["day_of_the_month"] !== undefined)
                            setBodyField(body, { "name": "day_of_the_month", "displayName": "Day of the month", "description": "Day of the month for the scheduled date (1-31).", "type": "integer", "minValue": 1, "maxValue": 31 }, additionalFields["day_of_the_month"], this, itemIndex);
                        if (additionalFields["day_of_week"] !== undefined)
                            setBodyField(body, { "name": "day_of_week", "displayName": "Day of week", "description": "Day of week: 0=Sunday through 6=Saturday.", "type": "integer" }, additionalFields["day_of_week"], this, itemIndex);
                        if (additionalFields["hour"] !== undefined)
                            setBodyField(body, { "name": "hour", "displayName": "Hour", "description": "Hour in the workspace local time zone (0-23); do not convert to UTC.", "type": "integer", "minValue": 0, "maxValue": 23 }, additionalFields["hour"], this, itemIndex);
                        if (additionalFields["minute"] !== undefined)
                            setBodyField(body, { "name": "minute", "displayName": "Minute", "description": "Minute within the hour (0-59).", "type": "integer", "minValue": 0, "maxValue": 59 }, additionalFields["minute"], this, itemIndex);
                        if (additionalFields["month"] !== undefined)
                            setBodyField(body, { "name": "month", "displayName": "Month", "description": "Month for the scheduled date (1-12).", "type": "integer", "minValue": 1, "maxValue": 12 }, additionalFields["month"], this, itemIndex);
                        if (additionalFields["year"] !== undefined)
                            setBodyField(body, { "name": "year", "displayName": "Year", "description": "Year for the scheduled date.", "type": "integer" }, additionalFields["year"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Schedule Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "postPostsIdUnschedule": {
                        let path = "/posts/{id}/unschedule";
                        const qs = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Unschedule Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "postPostsQueue": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/posts/queue";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        if (additionalFields["carousel_title"] !== undefined)
                            setBodyField(body, { "name": "carousel_title", "displayName": "Carousel title", "type": "string" }, additionalFields["carousel_title"], this, itemIndex);
                        if (additionalFields["file_url"] !== undefined)
                            setBodyField(body, { "name": "file_url", "displayName": "File url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["file_url"], this, itemIndex);
                        if (additionalFields["image_urls"] !== undefined)
                            setBodyField(body, { "name": "image_urls", "displayName": "Image urls", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["image_urls"], this, itemIndex);
                        if (additionalFields["linked_in_company_page_id"] !== undefined)
                            setBodyField(body, { "name": "linked_in_company_page_id", "displayName": "Linked in company page id", "description": "Company page ID to publish from instead of a personal profile. Get page IDs from `GET /company-pages`.", "type": "string", "format": "uuid" }, additionalFields["linked_in_company_page_id"], this, itemIndex);
                        if (additionalFields["media_ids"] !== undefined)
                            setBodyField(body, { "name": "media_ids", "displayName": "Media ids", "description": "IDs of confirmed media items uploaded through `POST /media`. The server derives legacy media URLs and preserves the array order.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "format": "uuid" } }, additionalFields["media_ids"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "Text content of the LinkedIn post.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        if (additionalFields["video_title"] !== undefined)
                            setBodyField(body, { "name": "video_title", "displayName": "Video title", "type": "string" }, additionalFields["video_title"], this, itemIndex);
                        if (additionalFields["video_url"] !== undefined)
                            setBodyField(body, { "name": "video_url", "displayName": "Video url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["video_url"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Queue Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "putPostsId": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/posts/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["carousel_title"] !== undefined)
                            setBodyField(body, { "name": "carousel_title", "displayName": "Carousel title", "type": "string" }, additionalFields["carousel_title"], this, itemIndex);
                        if (additionalFields["file_url"] !== undefined)
                            setBodyField(body, { "name": "file_url", "displayName": "File url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["file_url"], this, itemIndex);
                        if (additionalFields["image_urls"] !== undefined)
                            setBodyField(body, { "name": "image_urls", "displayName": "Image urls", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["image_urls"], this, itemIndex);
                        if (additionalFields["media_ids"] !== undefined)
                            setBodyField(body, { "name": "media_ids", "displayName": "Media ids", "description": "IDs of confirmed media items uploaded through `POST /media`. The server derives legacy media URLs and preserves the array order.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "format": "uuid" } }, additionalFields["media_ids"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "Text content of the LinkedIn post.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        if (additionalFields["video_thumbnail_url"] !== undefined)
                            setBodyField(body, { "name": "video_thumbnail_url", "displayName": "Video thumbnail url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["video_thumbnail_url"], this, itemIndex);
                        if (additionalFields["video_title"] !== undefined)
                            setBodyField(body, { "name": "video_title", "displayName": "Video title", "type": "string" }, additionalFields["video_title"], this, itemIndex);
                        if (additionalFields["video_url"] !== undefined)
                            setBodyField(body, { "name": "video_url", "displayName": "Video url", "description": "Legacy field retained for compatibility; use `media_ids` instead.", "type": "string" }, additionalFields["video_url"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Update Post"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "postQuestionsFromText": {
                        const path = "/questions/from-text";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "Text to analyze and use as context for the questions.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Generate Questions from Text"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["questions"], simplified: ["questions"] };
                        errorPlan = { "422": { "title": "Missing text or generation failed" } };
                        break;
                    }
                    case "postQuestionsFromTopic": {
                        const path = "/questions/from-topic";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        qs["workspace_id"] = this.getNodeParameter("workspace_id", itemIndex);
                        setBodyField(body, { "name": "topic", "displayName": "Topic", "description": "Topic to use for the questions.", "type": "string", "required": true }, this.getNodeParameter("topic", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "Generate Questions from Topic"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["questions"], simplified: ["questions"] };
                        errorPlan = { "422": { "title": "Missing topic or generation failed" } };
                        break;
                    }
                    case "getWorkspaces": {
                        const path = "/workspaces";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsExternalApiSupergrowAiApiV1External", "url": "https://external-api.supergrow.ai/api/v1/external", "kind": "selectable", "variables": [] }], "documentServer1HttpsExternalApiSupergrowAiApiV1External", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ((0, http_1.selectCredentialApplications)(this, [{ "name": "ApiKeyAuth", "displayName": "API Key Auth", "applications": [{ "credentialType": "supergrowApiKeyAuthApi", "type": "apiKey", "location": "header", "parameter": "X-Api-Key" }] }, { "name": "BearerAuth", "displayName": "Bearer Auth", "applications": [{ "credentialType": "supergrowBearerAuthApi", "type": "bearer" }] }], authenticationChoice, "List Workspaces"));
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["workspaces"], simplified: ["workspaces"] };
                        errorPlan = {};
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Supergrow = Supergrow;
//# sourceMappingURL=Supergrow.node.js.map