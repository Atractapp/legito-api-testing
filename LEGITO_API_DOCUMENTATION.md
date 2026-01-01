# Legito REST API Documentation (v7)

## Overview

Legito features a RESTful interface that allows you to edit most of your enterprise settings via API.

> **Note:** REST API versions 6 and 7 continue to be supported. The ID parameter from objects in responses/requests for document-version endpoints was deprecated on January 15, 2024. Use UUID and System Name parameters instead.

## Base URL

```
https://emea.legito.com/api/v7
```

---

## Quickstart

The most common use-case is filling in data from your CRM and creating a Word/PDF export:

### Step 1: Create Document with Data

Call `POST /document-version/data/{templateSuiteId}` to create a new document record with initial data.

You need to know the **system names** used in your document template:

```json
[
  {
    "name": "first_party_name1",
    "value": "John Doe"
  }
]
```

### Step 2: Store Document Code

The response returns metadata including a **document code** (40-character string):
```
CaRDL6J7VOVqIrd7TazZyKd9pZWzxwiRylDtHdPc
```

### Step 3: Download Document

Call `GET /document-version/download/{code}/{format}` to download PDF/Word document.

---

## Authentication

Legito API uses **JWT (JSON Web Token) Bearer** authentication.

### Prerequisites

Generate an API key and private key in Legito:
**My Account > Settings > Developers > API**

### JWT Token Structure

#### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### Payload (Claims)

| Claim | Description |
|-------|-------------|
| `iss` | API key (identifies your Legito Workspace) |
| `iat` | Timestamp when JWT was issued (Unix epoch) |
| `exp` | Expiration timestamp (max 1 hour from issued time) |

```json
{
  "iss": "94afa3c5-a1d5-4657-a8a6-7f968820792c",
  "iat": "1587459071",
  "exp": "1587462671"
}
```

#### Signature

Sign with your private key using HS256:

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  $privateKey
)
```

### Authorization Header

```
Authorization: Bearer <jwtToken>
```

---

## API Endpoints

### Advanced Styles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/advanced-style` | Returns Advanced Styles list |

---

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/category` | Returns category list |

---

### Countries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/country` | Returns country list |

---

### Currencies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/currency` | Returns currency list |

---

### Document Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/document-record` | Returns Document Record list |
| POST | `/document-record` | Creates new Document Record |
| PUT | `/document-record/{code}` | Updates existing Document Record |
| DELETE | `/document-record/{code}` | Removes Document Record |
| GET | `/document-record/anonymize/{code}` | Anonymize Document Record |

---

### Document Record Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/document-record-type` | Returns list of Document Record Types |
| POST | `/document-record-type` | Creates new Document Record Type |
| PUT | `/document-record-type/{documentRecordTypeId}` | Updates the Document Record Type |
| DELETE | `/document-record-type/{documentRecordTypeId}` | Removes the Document Record Type |

---

### Document Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/document-version/data/{code}` | Returns Elements data from document version |
| PUT | `/document-version/data/{documentRecordcode}` | Enter Element data and create new version |
| POST | `/document-version/data/{templateSuiteId}` | Insert Element data and create new Document Record |
| GET | `/document-version/download/{code}/{format}` | Downloads document as base64 encoded file |
| POST | `/document-version/json-integration` | Maps JSON data to new document version |

#### Supported Download Formats
- `docx` - Microsoft Word
- `pdf` - PDF
- `pdfa` - PDF/A
- `htm` - HTML
- `rtf` - Rich Text Format
- `xml` - XML
- `odt` - OpenDocument Text
- `txt` - Plain Text

---

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/event` | Returns Event list |

---

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/file/{documentRecordCode}` | Returns files related to Document Record |
| POST | `/file/{documentRecordCode}` | Uploads external file into Document Record |
| DELETE | `/file/{fileId}` | Removes external file from Document Record |
| GET | `/file/download/{fileId}` | Downloads external file |

---

### System Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/info` | Returns system information |

---

### Languages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/language` | Returns list of languages |

---

### Labels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/label` | Returns list of labels |
| POST | `/label` | Creates new Label |
| DELETE | `/label/{labelId}` | Removes the Label |

---

### Notification Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notification-setting/{userIdOrEmail}` | Returns user notification settings |
| PUT | `/notification-setting/{userIdOrEmail}` | Updates user notification settings |

---

### Objects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/object` | Returns Object list |

---

### Object Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/object-record/{objectId}` | Returns Object Record list |
| POST | `/object-record/{objectId}` | Creates new Object Record |
| PUT | `/object-record/{systemName}` | Updates existing Object Record |
| DELETE | `/object-record/{systemName}` | Removes Object Record |

---

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/property` | Returns property list |

---

### Property Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/property-group` | Returns Property Group list |

---

### Push Connections (Webhooks)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/push-connection` | Returns Push Connection list |
| POST | `/push-connection` | Creates new Push Connection |
| DELETE | `/push-connection/{pushConnectionId}` | Removes Push Connection |

---

### Sharing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/share/{code}` | Returns share lists for Document Record |
| POST | `/share/user/{code}` | Creates user share for document record |
| DELETE | `/share/user/{code}/{userIdOrEmail}` | Removes user share from Document Record |
| POST | `/share/user-group/{code}` | Creates user group share for document record |
| DELETE | `/share/user-group/{code}/{userGroupId}` | Removes user group share from Document Record |
| POST | `/share/external-link/{code}` | Creates External Link for Document Record |
| PUT | `/share/external-link/{externalLinkId}` | Updates External Link |
| DELETE | `/share/external-link/{externalLinkId}` | Deactivates and removes External Link |

---

### Template Suites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/template-suite` | Returns list of Template Suites |

---

### Template Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/template-tag` | Returns list of Template Tags |
| POST | `/template-tag` | Creates new Template Tag |

---

### Timezones

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/timezone` | Returns list of timezones |

---

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user` | Returns user list |
| POST | `/user` | Creates new user with default permissions |
| PUT | `/user/{userIdOrEmail}` | Updates user details |
| DELETE | `/user/{userIdOrEmail}` | Removes user |
| GET | `/user/permission/{userIdOrEmail}` | Returns list of user permissions |
| PUT | `/user/permission/{userIdOrEmail}` | Adds a user permission |

---

### User Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user-group` | Returns user group list |
| POST | `/user-group` | Inserts new user group |
| PUT | `/user-group/{userGroupId}` | Updates existing user group |
| DELETE | `/user-group/{userGroupId}` | Removes user group |
| POST | `/user-group/user/{userGroupId}` | Adds user to user group |
| DELETE | `/user-group/user/{userGroupId}/{userIdOrEmail}` | Removes user from user group |

---

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflow` | Returns workflow list |
| GET | `/workflow/revision/{workflowRevisionId}` | Returns schema of Workflow Revision |

---

## Data Models (Schemas)

### Core Entities

| Schema | Description |
|--------|-------------|
| `AdvancedStyle` | Advanced style configuration |
| `Country` | Country reference data |
| `Currency` | Currency reference data |
| `DocumentRecord` | Document record entity |
| `DocumentRecordType` | Document record type definition |
| `DocumentVersion` | Version of a document |
| `DocumentVersionDocumentFile` | File associated with document version |

### Template Elements

| Schema | Description |
|--------|-------------|
| `AbstractTemplateElement` | Base template element |
| `TemplateElement` | Standard template element |
| `TemplateElementContainer` | Container for elements |
| `SectionTemplateElement` | Section element |
| `ClauseTemplateElement` | Clause element |
| `OwnClauseTemplateElement` | Custom clause element |
| `TableTemplateElement` | Table element |
| `TableCellTemplateElement` | Table cell element |
| `TextTemplateElement` | Text element |
| `TextinputTemplateElement` | Text input element |
| `DateTemplateElement` | Date picker element |
| `SelectTemplateElement` | Dropdown select element |
| `MoneyTemplateElement` | Currency/money element |
| `LinkTemplateElement` | Link element |
| `ObjectLinkTemplateElement` | Object link element |
| `HyperLinkTemplateElement` | Hyperlink element |
| `QuestionTemplateElement` | Question/checkbox element |
| `CounterTemplateElement` | Counter element |
| `TitleTemplateElement` | Title element |
| `CalculationTemplateElement` | Calculation element |
| `ImageTemplateElement` | Image element |
| `RichTextTemplateElement` | Rich text editor element |
| `RepeatContainerTemplateElement` | Repeating container |
| `TableOfContentsTemplateElement` | Table of contents |
| `SwitcherTemplateElement` | Switcher/toggle element |

### Events

| Schema | Description |
|--------|-------------|
| `Event` | Base event |
| `DocumentRecordEvent` | Document record events |
| `UserEvent` | User-related events |
| `ObjectRecordEvent` | Object record events |

### Properties

| Schema | Description |
|--------|-------------|
| `Property` | Property definition |
| `PropertyGroup` | Property group |
| `PropertyDefinitionNumber` | Number property |
| `PropertyDefinitionChoice` | Choice property |
| `PropertyDefinitionUser` | User property |
| `PropertyDefinitionUserGroup` | User group property |
| `PropertyDefinitionObjectRecord` | Object record property |
| `PropertyValue*` | Various property value types |

### Sharing & Permissions

| Schema | Description |
|--------|-------------|
| `ShareUser` | User share configuration |
| `ShareUserGroup` | User group share configuration |
| `ExternalLink` | External sharing link |
| `Permission` | Permission definition |

### Workflows

| Schema | Description |
|--------|-------------|
| `Workflow` | Workflow definition |
| `WorkflowRevision` | Workflow version |
| `WorkflowElement` | Workflow element |
| `WorkflowLink` | Workflow connection |
| `WorkflowStage` | Workflow stage |
| `WorkflowApproval` | Approval configuration |

### Users & Groups

| Schema | Description |
|--------|-------------|
| `User` | User entity |
| `UserGroup` | User group entity |
| `UserGroupUser` | User-group membership |

### Other

| Schema | Description |
|--------|-------------|
| `Info` | System information |
| `Language` | Language configuration |
| `Label` | Label entity |
| `File` | File metadata |
| `FileWithData` | File with content |
| `NotificationSetting` | Notification preferences |
| `Category` | Category entity |
| `PushConnection` | Webhook configuration |
| `Object` | Object definition |
| `ObjectRecord` | Object record entity |
| `TemplateSuite` | Template suite |
| `Template` | Template definition |
| `TemplateTag` | Template tag |
| `Timezone` | Timezone data |
| `JsonIntegrationData` | JSON integration payload |
| `JsonIntegrationError` | Integration error response |
| `JsonIntegrationTemplate` | Integration template |

---

## Quick Reference

### Most Used Endpoints

| Use Case | Method | Endpoint |
|----------|--------|----------|
| Create document from template | POST | `/document-version/data/{templateSuiteId}` |
| Download document | GET | `/document-version/download/{code}/{format}` |
| List documents | GET | `/document-record` |
| Update document data | PUT | `/document-version/data/{documentRecordcode}` |
| List templates | GET | `/template-suite` |
| Share with user | POST | `/share/user/{code}` |
| Upload file | POST | `/file/{documentRecordCode}` |

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Resources

- [Legito Knowledge Base](https://www.legito.com/knowledge-base/legito-rest-api/)
- [Legito Developers](https://www.legito.com/developers/)
- [API Wrapper (GitHub)](https://github.com/legito/api-wrapper)
- [Swagger Documentation](https://app.swaggerhub.com/apis-docs/LegitoAPI/legito-api/7)
