# Legito API Test Operations Reference

**Last Updated:** 2026-01-06

This document describes all available test operations in the Legito API Testing Dashboard.

---

## Table of Contents

1. [Documents](#documents)
2. [Objects](#objects)
3. [Users](#users)
4. [User Groups](#user-groups)
5. [Sharing](#sharing)
6. [Files](#files)
7. [Workflows](#workflows)
8. [Other (Labels, Tags, Webhooks)](#other)

---

## Documents

### GET_TEMPLATE_SUITES
| Property | Value |
|----------|-------|
| **Name** | Get Template Suites List |
| **Method** | GET |
| **Endpoint** | `/template-suite` |
| **Description** | Retrieve list of all template suites available in the workspace |
| **Requires** | None |

### CREATE_DOCUMENT
| Property | Value |
|----------|-------|
| **Name** | Create Document |
| **Method** | POST |
| **Endpoint** | `/document-version/data/{templateSuiteId}` |
| **Description** | Create a new document from a template with element values |
| **Requires** | `templateSuiteId` (required), `elementValues` (auto-generated) |
| **Optional** | `linkToParentTestId` - Link as child of another CREATE_DOCUMENT test (Related Documents) |

**Notes:**
- Creates a document with auto-generated test data
- Stores `documentRecordCode` and `documentRecordId` in context for subsequent operations
- Parent document linking requires the Related Documents property to be enabled on the template

### READ_DOCUMENT
| Property | Value |
|----------|-------|
| **Name** | Read Document |
| **Method** | GET |
| **Endpoint** | `/document-version/data/{documentRecordCode}` |
| **Description** | Read document data by document record code |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |

### UPDATE_DOCUMENT
| Property | Value |
|----------|-------|
| **Name** | Update Document |
| **Method** | PUT |
| **Endpoint** | `/document-version/data/{documentRecordCode}` |
| **Description** | Update document element values |
| **Requires** | `useResultFrom: CREATE_DOCUMENT`, `elementValues` (auto-generated) |

### UPDATE_DOCUMENT_METADATA
| Property | Value |
|----------|-------|
| **Name** | Update Document Metadata |
| **Method** | PUT |
| **Endpoint** | `/document-record/{documentRecordCode}` |
| **Description** | Update document record metadata (owner, name, etc.) |
| **Requires** | `useResultFrom: CREATE_DOCUMENT`, `ownerId` |

**Notes:**
- Used to change document owner
- Can also update document name and other metadata

### DELETE_DOCUMENT
| Property | Value |
|----------|-------|
| **Name** | Delete Document |
| **Method** | DELETE |
| **Endpoint** | `/document-record/{documentRecordCode}` |
| **Description** | Delete a document record |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |

### ANONYMIZE_DOCUMENT
| Property | Value |
|----------|-------|
| **Name** | Anonymize Document |
| **Method** | GET |
| **Endpoint** | `/document-record/anonymize/{code}` |
| **Description** | Anonymize document data (GDPR compliance) |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |

### GET_DOCUMENT_RECORDS
| Property | Value |
|----------|-------|
| **Name** | Get Document Records |
| **Method** | GET |
| **Endpoint** | `/document-record` |
| **Description** | List document records with optional filters |
| **Requires** | None |

### DOWNLOAD_DOCUMENT
| Property | Value |
|----------|-------|
| **Name** | Download Document |
| **Method** | GET |
| **Endpoint** | `/document-version/download/{code}/{format}` |
| **Description** | Download document in specified format (PDF, DOCX, etc.) |
| **Requires** | `useResultFrom: CREATE_DOCUMENT`, `downloadFormat` |

---

## Objects

### GET_OBJECTS
| Property | Value |
|----------|-------|
| **Name** | Get Objects List |
| **Method** | GET |
| **Endpoint** | `/object` |
| **Description** | Retrieve list of all object definitions |
| **Requires** | None |

### CREATE_OBJECT_RECORD
| Property | Value |
|----------|-------|
| **Name** | Create Object Record |
| **Method** | POST |
| **Endpoint** | `/object-record/{objectId}` |
| **Description** | Create a new object record with property values |
| **Requires** | `objectId`, `propertyValues` (auto-generated) |

### READ_OBJECT_RECORD
| Property | Value |
|----------|-------|
| **Name** | Read Object Record |
| **Method** | GET |
| **Endpoint** | `/object-record/{systemName}` |
| **Description** | Read object record by system name |
| **Requires** | `useResultFrom: CREATE_OBJECT_RECORD` |

### UPDATE_OBJECT_RECORD
| Property | Value |
|----------|-------|
| **Name** | Update Object Record |
| **Method** | PUT |
| **Endpoint** | `/object-record/{systemName}` |
| **Description** | Update object record property values |
| **Requires** | `useResultFrom: CREATE_OBJECT_RECORD`, `propertyValues` (auto-generated) |

### DELETE_OBJECT_RECORD
| Property | Value |
|----------|-------|
| **Name** | Delete Object Record |
| **Method** | DELETE |
| **Endpoint** | `/object-record/{systemName}` |
| **Description** | Delete an object record |
| **Requires** | `useResultFrom: CREATE_OBJECT_RECORD` |

---

## Users

### GET_USERS
| Property | Value |
|----------|-------|
| **Name** | Get Users List |
| **Method** | GET |
| **Endpoint** | `/user` |
| **Description** | Retrieve list of all users |
| **Requires** | None |

### CREATE_USER
| Property | Value |
|----------|-------|
| **Name** | Create User |
| **Method** | POST |
| **Endpoint** | `/user` |
| **Description** | Create a new user account |
| **Requires** | None (auto-generates email, name) |

### UPDATE_USER
| Property | Value |
|----------|-------|
| **Name** | Update User |
| **Method** | PUT |
| **Endpoint** | `/user/{userIdOrEmail}` |
| **Description** | Update user details |
| **Requires** | `useResultFrom: CREATE_USER` |

### DELETE_USER
| Property | Value |
|----------|-------|
| **Name** | Delete User |
| **Method** | DELETE |
| **Endpoint** | `/user/{userIdOrEmail}` |
| **Description** | Delete a user account |
| **Requires** | `useResultFrom: CREATE_USER` |

---

## User Groups

### GET_USER_GROUPS
| Property | Value |
|----------|-------|
| **Name** | Get User Groups List |
| **Method** | GET |
| **Endpoint** | `/user-group` |
| **Description** | Retrieve list of all user groups |
| **Requires** | None |

### CREATE_USER_GROUP
| Property | Value |
|----------|-------|
| **Name** | Create User Group |
| **Method** | POST |
| **Endpoint** | `/user-group` |
| **Description** | Create a new user group |
| **Requires** | None (auto-generates name) |

### UPDATE_USER_GROUP
| Property | Value |
|----------|-------|
| **Name** | Update User Group |
| **Method** | PUT |
| **Endpoint** | `/user-group/{userGroupId}` |
| **Description** | Update user group details |
| **Requires** | `useResultFrom: CREATE_USER_GROUP` |

### DELETE_USER_GROUP
| Property | Value |
|----------|-------|
| **Name** | Delete User Group |
| **Method** | DELETE |
| **Endpoint** | `/user-group/{userGroupId}` |
| **Description** | Delete a user group |
| **Requires** | `useResultFrom: CREATE_USER_GROUP` |

---

## Sharing

### CREATE_EXTERNAL_LINK
| Property | Value |
|----------|-------|
| **Name** | Create External Link |
| **Method** | POST |
| **Endpoint** | `/share/external-link/{documentRecordCode}` |
| **Description** | Create an external sharing link for a document |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |
| **Optional** | `returnExternalLink` - Include full URL in test report |

**Notes:**
- Creates a public link that can be shared externally
- Link URL is displayed in the test report for verification

### DELETE_EXTERNAL_LINK
| Property | Value |
|----------|-------|
| **Name** | Delete External Link |
| **Method** | DELETE |
| **Endpoint** | `/share/external-link/{externalLinkId}` |
| **Description** | Delete an external sharing link |
| **Requires** | `useResultFrom: CREATE_EXTERNAL_LINK` |

### UPDATE_EXTERNAL_LINK
| Property | Value |
|----------|-------|
| **Name** | Update External Link |
| **Method** | PUT |
| **Endpoint** | `/share/external-link/{externalLinkId}` |
| **Description** | Update an existing external sharing link |
| **Requires** | `useResultFrom: CREATE_EXTERNAL_LINK` |

### SHARE_TO_USER
| Property | Value |
|----------|-------|
| **Name** | Share to User |
| **Method** | POST |
| **Endpoint** | `/share/user/{code}` |
| **Description** | Share a document with a specific user |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` or `CREATE_USER`, `sharePermission` |

### SHARE_TO_USER_GROUP
| Property | Value |
|----------|-------|
| **Name** | Share to User Group |
| **Method** | POST |
| **Endpoint** | `/share/user-group/{code}` |
| **Description** | Share a document with a user group |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` or `CREATE_USER_GROUP`, `sharePermission` |

### REMOVE_USER_SHARE
| Property | Value |
|----------|-------|
| **Name** | Remove User Share |
| **Method** | DELETE |
| **Endpoint** | `/share/user/{code}/{userIdOrEmail}` |
| **Description** | Remove a user share from a document |
| **Requires** | `useResultFrom: SHARE_TO_USER` |

### REMOVE_USER_GROUP_SHARE
| Property | Value |
|----------|-------|
| **Name** | Remove User Group Share |
| **Method** | DELETE |
| **Endpoint** | `/share/user-group/{code}/{userGroupId}` |
| **Description** | Remove a user group share from a document |
| **Requires** | `useResultFrom: SHARE_TO_USER_GROUP` |

### GET_DOCUMENT_SHARES
| Property | Value |
|----------|-------|
| **Name** | Get Document Shares |
| **Method** | GET |
| **Endpoint** | `/share/{code}` |
| **Description** | Get all shares (users, groups, external links) for a document |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |

---

## Files

### LIST_FILES
| Property | Value |
|----------|-------|
| **Name** | List Document Files |
| **Method** | GET |
| **Endpoint** | `/file/{documentRecordCode}` |
| **Description** | List all external files attached to a document |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |

### UPLOAD_FILE
| Property | Value |
|----------|-------|
| **Name** | Upload File to Document |
| **Method** | POST |
| **Endpoint** | `/file/{documentRecordCode}` |
| **Description** | Upload an external file to a document record |
| **Requires** | `useResultFrom: CREATE_DOCUMENT` |

**Notes:**
- Uploads a test PDF file (base64 encoded)
- File is attached to the document record

### DOWNLOAD_FILE
| Property | Value |
|----------|-------|
| **Name** | Download File |
| **Method** | GET |
| **Endpoint** | `/file/download/{fileId}` |
| **Description** | Download an external file by ID |
| **Requires** | `useResultFrom: UPLOAD_FILE` |

### DELETE_FILE
| Property | Value |
|----------|-------|
| **Name** | Delete File |
| **Method** | DELETE |
| **Endpoint** | `/file/{fileId}` |
| **Description** | Remove an external file from a document |
| **Requires** | `useResultFrom: UPLOAD_FILE` |

---

## Workflows

### GET_WORKFLOWS
| Property | Value |
|----------|-------|
| **Name** | List Workflows |
| **Method** | GET |
| **Endpoint** | `/workflow` |
| **Description** | Retrieve list of all workflows |
| **Requires** | None |

### GET_WORKFLOW
| Property | Value |
|----------|-------|
| **Name** | Get Workflow Revision |
| **Method** | GET |
| **Endpoint** | `/workflow/revision/{workflowRevisionId}` |
| **Description** | Get schema of a specific workflow revision |
| **Requires** | `useResultFrom: GET_WORKFLOWS` |

---

## Other

### LIST_LABELS
| Property | Value |
|----------|-------|
| **Name** | List Labels |
| **Method** | GET |
| **Endpoint** | `/label` |
| **Description** | Retrieve list of all labels |
| **Requires** | None |

### CREATE_LABEL
| Property | Value |
|----------|-------|
| **Name** | Create Label |
| **Method** | POST |
| **Endpoint** | `/label` |
| **Description** | Create a new label |
| **Requires** | None (auto-generates name) |

### DELETE_LABEL
| Property | Value |
|----------|-------|
| **Name** | Delete Label |
| **Method** | DELETE |
| **Endpoint** | `/label/{labelId}` |
| **Description** | Remove a label |
| **Requires** | `useResultFrom: CREATE_LABEL` |

### LIST_TEMPLATE_TAGS
| Property | Value |
|----------|-------|
| **Name** | List Template Tags |
| **Method** | GET |
| **Endpoint** | `/template-tag` |
| **Description** | Retrieve list of all template tags |
| **Requires** | None |

### CREATE_TEMPLATE_TAG
| Property | Value |
|----------|-------|
| **Name** | Create Template Tag |
| **Method** | POST |
| **Endpoint** | `/template-tag` |
| **Description** | Create a new template tag |
| **Requires** | None (auto-generates name) |

### GET_PUSH_CONNECTIONS
| Property | Value |
|----------|-------|
| **Name** | List Push Connections |
| **Method** | GET |
| **Endpoint** | `/push-connection` |
| **Description** | Retrieve list of all webhook push connections |
| **Requires** | None |

### CREATE_PUSH_CONNECTION
| Property | Value |
|----------|-------|
| **Name** | Create Push Connection |
| **Method** | POST |
| **Endpoint** | `/push-connection` |
| **Description** | Create a webhook subscription for events |
| **Requires** | None |

**Notes:**
- Creates a webhook endpoint that receives Legito events
- Subscribes to: `DocumentRecordCreated`, `DocumentRecordUpdated`, `DocumentRecordDeleted`
- Stores correlation ID for webhook verification

### DELETE_PUSH_CONNECTION
| Property | Value |
|----------|-------|
| **Name** | Delete Push Connection |
| **Method** | DELETE |
| **Endpoint** | `/push-connection/{pushConnectionId}` |
| **Description** | Remove a push connection |
| **Requires** | `useResultFrom: CREATE_PUSH_CONNECTION` |

### VERIFY_WEBHOOK
| Property | Value |
|----------|-------|
| **Name** | Verify Webhook Received |
| **Method** | GET (internal) |
| **Endpoint** | `/api/webhook/legito/{correlationId}` |
| **Description** | Verify that a webhook was received from Legito push API |
| **Requires** | `useResultFrom: CREATE_PUSH_CONNECTION` |
| **Timeout** | 120 seconds (Legito takes 60-90s to send webhooks) |

**Notes:**
- This is an internal test operation, not a Legito API call
- Polls the local webhook storage for matching correlation ID
- Used to verify push connections are working correctly

---

## Operation Dependencies

Some operations require results from previous operations. Here's the dependency chain:

```
CREATE_DOCUMENT ──┬── READ_DOCUMENT
                  ├── UPDATE_DOCUMENT
                  ├── UPDATE_DOCUMENT_METADATA
                  ├── DELETE_DOCUMENT
                  ├── ANONYMIZE_DOCUMENT
                  ├── DOWNLOAD_DOCUMENT
                  ├── CREATE_EXTERNAL_LINK ──┬── DELETE_EXTERNAL_LINK
                  │                          └── UPDATE_EXTERNAL_LINK
                  ├── SHARE_TO_USER ────────── REMOVE_USER_SHARE
                  ├── SHARE_TO_USER_GROUP ──── REMOVE_USER_GROUP_SHARE
                  ├── GET_DOCUMENT_SHARES
                  ├── LIST_FILES
                  └── UPLOAD_FILE ──┬── DOWNLOAD_FILE
                                    └── DELETE_FILE

CREATE_OBJECT_RECORD ──┬── READ_OBJECT_RECORD
                       ├── UPDATE_OBJECT_RECORD
                       └── DELETE_OBJECT_RECORD

CREATE_USER ──┬── UPDATE_USER
              └── DELETE_USER

CREATE_USER_GROUP ──┬── UPDATE_USER_GROUP
                    └── DELETE_USER_GROUP

CREATE_LABEL ────── DELETE_LABEL

CREATE_PUSH_CONNECTION ──┬── DELETE_PUSH_CONNECTION
                         └── VERIFY_WEBHOOK

GET_WORKFLOWS ────── GET_WORKFLOW
```

---

## Test Configuration Options

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `templateSuiteId` | number | ID of the template to use for document creation |
| `objectId` | number | ID of the object definition for object records |
| `ownerId` | number | User ID to set as document owner |
| `useResultFrom` | string | Test ID to get dynamic values from |
| `linkToParentTestId` | string | Test ID of parent document for Related Documents linking |
| `returnExternalLink` | boolean | Include external link URL in test report |
| `downloadFormat` | string | Format for document download (pdf, docx) |
| `sharePermission` | string | Permission level (LIST, READ, EDIT, MANAGE) |
| `webhookTimeout` | number | Custom timeout for webhook verification (default: 120000ms) |

---

## Example Test Configurations

### Basic Document CRUD
```
1. CREATE_DOCUMENT (template: Contract Template)
2. UPDATE_DOCUMENT (uses result from #1)
3. READ_DOCUMENT (uses result from #1)
4. DELETE_DOCUMENT (uses result from #1)
```

### Document with External Sharing
```
1. CREATE_DOCUMENT (template: Agreement Template)
2. CREATE_EXTERNAL_LINK (uses result from #1, return URL: yes)
3. DELETE_EXTERNAL_LINK (uses result from #2)
4. DELETE_DOCUMENT (uses result from #1)
```

### Document with File Upload
```
1. CREATE_DOCUMENT (template: Contract Template)
2. UPLOAD_FILE (uses result from #1)
3. LIST_FILES (uses result from #1)
4. DOWNLOAD_FILE (uses result from #2)
5. DELETE_FILE (uses result from #2)
6. DELETE_DOCUMENT (uses result from #1)
```

### Webhook Verification
```
1. CREATE_PUSH_CONNECTION
2. CREATE_DOCUMENT (template: Any Template)
3. VERIFY_WEBHOOK (uses result from #1, waits up to 120s)
4. DELETE_PUSH_CONNECTION (uses result from #1)
5. DELETE_DOCUMENT (uses result from #2)
```

### Parent-Child Document Linking
```
1. CREATE_DOCUMENT (template: Parent Template) - Parent document
2. CREATE_DOCUMENT (template: Child Template, linkToParent: #1) - Child document
3. DELETE_DOCUMENT (uses result from #2)
4. DELETE_DOCUMENT (uses result from #1)
```

---

## API Regions

| Region | Base URL |
|--------|----------|
| EMEA | https://emea.legito.com/api/v7 |
| US | https://us.legito.com/api/v7 |
| CA | https://ca.legito.com/api/v6 |
| APAC | https://apac.legito.com/api/v7 |
| Quarterly | https://quarterly.legito.com/api/v7 |
| NDE Migrations | https://nde-migrations.legito.com/api/v7 |

---

## Version History

| Date | Changes |
|------|---------|
| 2026-01-06 | Initial documentation with 42 operations |
| 2026-01-06 | Added VERIFY_WEBHOOK with 120s timeout |
| 2026-01-06 | Added parent document linking (Related Documents) |
| 2026-01-06 | Added UPDATE_DOCUMENT_METADATA for owner changes |
