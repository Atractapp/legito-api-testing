# Legito API v7 Reference

This documentation is auto-generated from the official Swagger spec at:
https://api.swaggerhub.com/apis/LegitoAPI/legito-api/7

## Servers

| Environment | URL |
|-------------|-----|
| EMEA | https://emea.legito.com/api/v7 |
| US | https://us.legito.com/api/v7 |
| CA | https://ca.legito.com/api/v6 |
| APAC | https://apac.legito.com/api/v7 |
| Quarterly | https://quarterly.legito.com/api/v7 |

## Authentication

Legito API uses JWT Bearer authentication with HS256 signing.

### JWT Token Structure

```json
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "iss": "<API_KEY>",
  "iat": "<UNIX_TIMESTAMP>",
  "exp": "<UNIX_TIMESTAMP + 3600>"
}
```

### Authorization Header
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### System Info
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /info | Returns system information |

### Reference Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /advanced-style | Returns Advanced Styles list |
| GET | /category | Returns category list |
| GET | /country | Returns country list |
| GET | /currency | Returns currency list |
| GET | /language | Returns list of languages |
| GET | /property | Returns property list |
| GET | /property-group | Returns Property Group list |
| GET | /timezone | Returns a list of timezones |
| GET | /event | Returns Event list |

### Objects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /object | Returns Object list |

### Object Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /object-record/{objectId} | Returns Object Record list |
| POST | /object-record/{objectId} | Creates new Object Record |
| PUT | /object-record/{systemName} | Updates existing Object Record |
| DELETE | /object-record/{systemName} | Removes Object Record |

### Labels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /label | Returns list of labels |
| POST | /label | Creates new Label |
| DELETE | /label/{labelId} | Removes the Label |

### Template Suites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /template-suite | Returns a list of Template Suites |

### Template Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /template-tag | Returns a list of Template Tags |
| POST | /template-tag | Creates new Template Tag |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /user | Returns user list |
| POST | /user | Creates a new user with default permissions |
| PUT | /user/{userIdOrEmail} | Updates user details |
| DELETE | /user/{userIdOrEmail} | Removes user |
| GET | /user/permission/{userIdOrEmail} | Returns list of user permissions |
| PUT | /user/permission/{userIdOrEmail} | Adds a user permission |

### User Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /user-group | Returns user group list |
| POST | /user-group | Inserts new user group |
| PUT | /user-group/{userGroupId} | Updates existing user group |
| DELETE | /user-group/{userGroupId} | Removes user group |
| POST | /user-group/user/{userGroupId} | Adds user to user group |
| DELETE | /user-group/user/{userGroupId}/{userIdOrEmail} | Removes user from department |

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /workflow | Returns workflow list |
| GET | /workflow/revision/{workflowRevisionId} | Returns schema of Workflow Revision |

### Document Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /document-record | Returns Document Record list |
| POST | /document-record | Creates new Document Record |
| PUT | /document-record/{code} | Updates existing Document Record |
| DELETE | /document-record/{code} | Removes Document Record |
| GET | /document-record/anonymize/{code} | Anonymize Document Record |

### Document Record Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /document-record-type | Returns list of Document Record Types |
| POST | /document-record-type | Creates new Document Record Type |
| PUT | /document-record-type/{documentRecordTypeId} | Updates the Document Record Type |
| DELETE | /document-record-type/{documentRecordTypeId} | Removes the Document Record Type |

### Document Versions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /document-version/data/{code} | Returns Elements data from document version |
| PUT | /document-version/data/{documentRecordcode} | Updates document version with new element data |
| POST | /document-version/data/{templateSuiteId} | Creates new Document Record from template |
| GET | /document-version/download/{code}/{format} | Downloads document (pdf, docx, etc) |
| POST | /document-version/json-integration | Maps json data to new document version |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /file/{documentRecordCode} | Returns files related to Document Record |
| POST | /file/{documentRecordCode} | Uploads external file into Document Record |
| DELETE | /file/{fileId} | Removes external file from Document Record |
| GET | /file/download/{fileId} | Downloads external file |

### Push Connections (Webhooks)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /push-connection | Returns Push Connection list |
| POST | /push-connection | Creates new Push Connection |
| DELETE | /push-connection/{pushConnectionId} | Removes Push connection |

### Sharing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /share/{code} | Returns share lists for Document Record |
| POST | /share/user/{code} | Creates a user share for document record |
| DELETE | /share/user/{code}/{userIdOrEmail} | Removes the user share from Document record |
| POST | /share/user-group/{code} | Creates a user group share for document record |
| DELETE | /share/user-group/{code}/{userGroupId} | Removes the user group share from Document record |
| POST | /share/external-link/{code} | Creates an External link for Document Record |
| PUT | /share/external-link/{externalLinkId} | Updates an External link |
| DELETE | /share/external-link/{externalLinkId} | Deactivates and removes the External Link |

### Notification Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /notification-setting/{userIdOrEmail} | Returns user notification settings |
| PUT | /notification-setting/{userIdOrEmail} | Updates user notification settings |

---

## Key Schemas

### User
```json
{
  "id": 11129,           // readOnly
  "email": "johndoe@legito.com",
  "name": "John Doe",
  "customIdentifier": "JD001",
  "position": "CEO",
  "timezone": "Europe/Prague",
  "sessionExpiration": 7200,
  "sessionDestroy": 0,
  "customData": "Additional notes"
}
```

### UserGroup
```json
{
  "id": 12,              // readOnly
  "name": "Sales department",
  "users": []            // array of UserGroupUser
}
```

### Label
```json
{
  "id": 58,              // readOnly
  "name": "Important"
}
```

### DocumentRecord
```json
{
  "id": 11000,           // readOnly
  "code": "yDWF...",     // readOnly, 40-char unique code
  "deleted": false,
  "templateSuiteId": 10132,
  "documentRecordTypeId": 2,
  "name": "Purchase Agreement",
  "ownerId": 11129,
  "properties": [],
  "persons": []
}
```

### DocumentRecordType
```json
{
  "id": 58,              // readOnly
  "name": "General",
  "priority": 2
}
```

### ObjectRecord
```json
{
  "id": 11000,           // readOnly
  "objectId": 15,        // readOnly
  "systemName": "8c7bef7e-ac29-4c44-b63e-47b044df4319",  // readOnly
  "name": "My Best Vendor",
  "properties": [
    {
      "systemName": "property-uuid",
      "value": "Property Value"
    }
  ]
}
```

### PushConnection
```json
{
  "id": 4,               // readOnly
  "systemName": "eb89...",  // readOnly
  "name": "Example connection",         // required
  "url": "https://example.com/webhook", // required, SSL only
  "enabled": false,
  "headers": [],
  "eventTypes": ["DocumentRecordCreated", "DocumentRecordUpdated"],
  "templateSuiteAll": true,
  "documentRecordTypeAll": true
}
```

### ShareUser
```json
{
  "id": 11129,           // or use email
  "email": "johndoe@legito.com",
  "permission": "READ"   // LIST, READ, EDIT, MANAGE
}
```

### ShareUserGroup
```json
{
  "id": 12,
  "name": "Sales group"
}
```

### ExternalLink
```json
{
  "id": 279,             // readOnly
  "link": "60nq8v4f4qkgfow",  // readOnly
  "url": "https://www.legito.com/US/en/shared/60nq8v4f4qkgfow/",  // readOnly
  "active": true,
  "type": "document",    // document, revision, template
  "useMax": 0,           // 0 = infinite
  "permission": "READ"   // MANAGE, EDIT, READ
}
```

### FileWithData
```json
{
  "id": 5698,            // readOnly
  "name": "document.pdf",
  "data": "data:application/pdf;base64,..."  // base64 with MIME prefix
}
```

### NotificationSetting
```json
{
  "changeOwner": { "web": "Newer", "email": "My" },
  "share": { "web": "Shared", "email": "Newer" },
  "fileUpload": { "web": "Shared", "email": "Newer" },
  "newDocumentVersion": { "web": "Shared", "email": "Newer" }
}
```
Values: "Newer", "My", "Shared"

---

## Document Version Data Format

To create a document from a template, send element data as array:

```json
POST /document-version/data/{templateSuiteId}

[
  { "name": "element_system_name", "value": "Element Value" },
  { "name": "another_element", "value": "Another Value" }
]
```

Response includes:
- `code` - Document version code (40 chars)
- `documentRecordId` - Document record ID
- `documentRecordCode` - Document record code

---

## Event Types for Push Connections

| Event | Description |
|-------|-------------|
| ApprovalActionApprove | Approval action approved |
| ApprovalActionCanceled | Approval action canceled |
| ApprovalActionDisapprove | Approval action disapproved |
| ApprovalApproved | Approval fully approved |
| ApprovalDisapproved | Approval fully disapproved |
| ApprovalProcessStarted | Approval process started |
| DocumentRecordCreated | Document record created |
| DocumentRecordUpdated | Document record updated |
| DocumentRecordDeleted | Document record deleted |
| NewDocumentVersion | New document version created |
| FileUpload | File uploaded |
| FileDeleted | File deleted |
| DocumentShared | Document shared |
| DocumentSharingRemoved | Document sharing removed |
| WorkflowStatusChanged | Workflow status changed |
| SignStarted | Signing started |
| SignCompleted | Signing completed |
| SignCanceled | Signing canceled |

---

## Full Swagger Spec

The complete OpenAPI 3.0 spec is saved at:
`docs/legito-swagger.json`

View online at:
https://app.swaggerhub.com/apis/LegitoAPI/legito-api/7
