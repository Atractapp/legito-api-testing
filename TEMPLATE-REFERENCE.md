# Legito API - Template Reference

## Template Suite

| Property | Value |
|----------|-------|
| **ID** | 64004 |
| **Title** | Testing API |
| **Workflow ID** | 46968 |
| **Law ID** | 68 |

### Templates in Suite

| ID | Name | Type | No Export | Internal | Priority |
|----|------|------|-----------|----------|----------|
| 1000010119 | Test Form | Form | true | false | 0 |
| 1000010117 | Testing API | Document | false | false | 1 |

---

## Template Elements (Test Form)

### Editable Elements

| ID | Name | Type | UUID | Options/Items |
|----|------|------|------|---------------|
| 4 | `doc-name` | TextInput | 682b388c-d37d-4b20-8a5f-8ea90f598428 | - |
| 7 | `name` | TextInput | c596812a-bf43-4381-9a24-888247665824 | - |
| 10 | `date` | Date | 6302bd16-ec5e-461d-8e8b-17b7186510d6 | monthByWord: true |
| 13 | `switcher` | Switcher | 7c734db3-7a43-4750-8eae-52d49eaec9be | true/false |
| 14 | `option` | Question (single) | e65f0c64-a6f9-41a5-be5f-c508ed7029fc | A, B, C |
| 15 | `multi-option` | Question (multi) | eaa0016e-4b8c-4735-9ff4-dbb464458dbd | A, B, C, D |
| 18 | `single-choice` | Select (single) | c7ce9cfd-54d5-4351-8d18-d9a65e4ecff1 | 1, 2, 3 |
| 21 | `multi-choice` | Select (multi) | 9c39e564-af7a-4f27-8a2e-43e3c1709dea | 1, 2, 3, 4 |
| 24 | `testing-object-name` | ObjectRecordsSelectbox | f16b51cf-d3ac-4e7c-b349-c7390ec31841 | objectId: 935, propertyId: 607800 |
| 27 | `value` | Money | ecc4575b-dbb1-4081-9aee-bf92b725107d | currency: 3 |

### Clause Elements

| ID | Name | Type | UUID | Parent ID | Default Visible |
|----|------|------|------|-----------|-----------------|
| 31 | `ab` | Clause | b2f3c51a-41ed-4233-80cc-ac2431b36753 | 6 | true |
| 33 | `a` | Clause | 28296e84-a9bb-4b9f-acd2-68f967945424 | 31 | false |
| 35 | `b` | Clause | c3c55d24-9fca-4fb9-843f-0800ec8136a7 | 31 | false |
| 37 | `c` | Clause | 9689f814-f9d5-47f1-a11c-cdc263f00dbb | 31 | false |
| 17 | `multi` | Clause | adfcfbf5-749a-4c6e-bf0b-1092e8e00665 | 6 | true |

**Note:** Clause visibility via API - tested approaches that DO NOT work:
- `{name: 'ab', visible: false}` - accepted but no change
- `{name: 'ab', value: false}` - accepted but no change
- `{name: 'a', visible: true}` - accepted but no change
- `{uuid: '...', visible: true}` - accepted but no change
- `{id: 31, visible: false}` - accepted but no change

### Other Element Types Found

| Type | Description |
|------|-------------|
| Section | Document section container |
| Clause | Toggleable clause element |
| Text | Static text content |
| TextInput | User text input field |
| Date | Date picker |
| Switcher | Boolean toggle |
| Question | Single/multi choice question |
| Select | Single/multi select dropdown |
| ObjectRecordsSelectbox | Object record selector |
| Money | Currency/amount field |
| Image | Image element |
| ClauseLibrary | Clause library reference (ID: 7, UUID: 71d90578-a520-4e1f-898d-89e9d3b1e63a) |
| Link | Hyperlink element |

My values to Add:
| ID | Name | Type | UUID | Options/Items |
|----|------|------|------|---------------|
| 4 | `doc-name` | TextInput | 682b388c-d37d-4b20-8a5f-8ea90f598428 - My Test Document 01-01-2026 #comment-current date in text format
| 7 | `name` | TextInput | c596812a-bf43-4381-9a24-888247665824 | - John Doe
| 10 | `date` | Date | 6302bd16-ec5e-461d-8e8b-17b7186510d6 | monthByWord: true | - add current date
| 13 | `switcher` | Switcher | 7c734db3-7a43-4750-8eae-52d49eaec9be | true/false | - must be turned on (value "yes")
| 14 | `option` | Question (single) | e65f0c64-a6f9-41a5-be5f-c508ed7029fc | A, B, C | - choose B
| 15 | `multi-option` | Question (multi) | eaa0016e-4b8c-4735-9ff4-dbb464458dbd | A, B, C, D | - choose B and D
| 18 | `single-choice` | Select (single) | c7ce9cfd-54d5-4351-8d18-d9a65e4ecff1 | 1, 2, 3 | - choose 2
| 21 | `multi-choice` | Select (multi) | 9c39e564-af7a-4f27-8a2e-43e3c1709dea | 1, 2, 3, 4 | - choose 3 and 4
| 24 | `testing-object-name` | ObjectRecordsSelectbox | f16b51cf-d3ac-4e7c-b349-c7390ec31841 | objectId: 935, propertyId: 607800 | - choose last object record (you need to get objects first for that)
| 27 | `value` | Money | ecc4575b-dbb1-4081-9aee-bf92b725107d | currency: 3 | - 12345 

### Question/Select Options Detail

#### `option` (Question - Single Choice)
| Key (UUID) | Label |
|------------|-------|
| f40c04d1-a10e-4ac6-886b-b0bcc352f769 | A |
| 6df8e483-31a9-4f66-a96a-3ca10ffa56a7 | B |
| b233df25-49ce-4c23-89c2-a92244c0e625 | C |

#### `multi-option` (Question - Multi Choice)
| Key (UUID) | Label |
|------------|-------|
| ae37fd2d-159d-4f9d-9876-b6c234937fdc | A |
| 2261e6fe-f68a-44c1-aec2-73e4156f582c | B |
| 19206d74-6864-4c02-ac82-38e030ef92db | C |
| fcee8ee4-636e-4ed6-9576-7389691ace4f | D |

#### `single-choice` (Select - Single)
| Key (UUID) | Label |
|------------|-------|
| 77c4285b-137a-40bf-ae22-10d5c7c70f7a | 1 |
| 3a8bc084-0316-421a-b202-90622f89670b | 2 |
| d17a69ec-796e-4186-afd5-13c6cbce8729 | 3 |

#### `multi-choice` (Select - Multi)
| Key (UUID) | Label |
|------------|-------|
| c50bc5c6-628a-462a-b860-c5940364ce51 | 1 |
| b0f4bc5a-2827-4956-b8c7-9412c01e4be6 | 2 |
| 48d93b60-a8be-40c6-b00d-5a9f5904148a | 3 |
| 202f5757-934a-4729-92e1-413a9e552cb1 | 4 |

#### `testing-object-name` (ObjectRecordsSelectbox)
Links to **Testing Object** (ID: 935), displays **Name** property (ID: 607800).
Value should be an Object Record `systemName` from Testing Object.

---

## Object: Testing Object

| Property | Value |
|----------|-------|
| **ID** | 935 |
| **Name** | Testing Object |
| **Record Owner & Sharing** | false |
| **Show Workflow** | false |
| **Workflows** | [46968] |

### Object Properties

| ID | Name | Type | System Name (UUID) | System | Priority |
|----|------|------|-------------------|--------|----------|
| 607799 | Messages | system (messages) | bfed016c-5c87-4532-8e2d-7a4ca324182c | Yes | 1 |
| 607800 | Name | text | a6c58533-e21f-48b2-8389-d0ae954d28e2 | No | 1 |
| 607801 | Date | date | fffd692c-87a9-41bf-9bc1-0e9868d9a1ab | No | 2 |
| 607802 | Address | text | bfb218ce-59d7-46eb-b775-04f87bfd84a2 | No | 3 |
| 607803 | Numerical | number | 8b0de562-386c-4004-abb8-0acb0d553380 | No | 4 |
| 607804 | Financial Value | currency | 3f2ebeea-d87c-45ad-a59e-d681dd8d3903 | No | 5 |
| 607805 | User | user | 01f1b2ef-e8bf-47a0-acb3-6c1629a9545f | No | 6 |

### Object Records (6 total)

| # | Name | System Name | Date | Address | Numerical | Financial Value |
|---|------|-------------|------|---------|-----------|-----------------|
| 1 | Testing 1 | d6694172-3cef-4bac-bea5-1234cf16cb68 | 2026-01-02 | Brno | 123 | 345 CZK |
| 2 | Testing 2 | 98dd0be2-5164-467c-9f63-3c87c13384f8 | 2026-01-15 | Prague | 456 | 1,000 CZK |
| 3 | Testing 3 | 6c9855f5-3a4f-4877-ab08-16296b01d493 | 2026-02-01 | Vienna | 789 | 2,500 CZK |
| 4 | Testing 4 | 23e75230-e9c7-4a68-9013-10035164b365 | 2026-02-14 | Berlin | 1,024 | 5,000 CZK |
| 5 | Testing 5 | ac01eb47-ffb8-4615-a297-5a0260bd1f42 | 2026-03-01 | Munich | 2,048 | 7,500 CZK |
| 6 | Testing 6 | b5185231-c5e5-46cd-b404-1485ee48a39a | 2026-03-15 | Warsaw | 4,096 | 10,000 CZK |

### Example Record Structure

```json
{
  "id": 247417,
  "systemName": "d6694172-3cef-4bac-bea5-1234cf16cb68",
  "name": "Testing 1",
  "properties": {
    "Name": "Testing 1",
    "Date": "2026-01-02T00:00:00+01:00",
    "Address": "Brno",
    "Numerical": 123,
    "Financial Value": { "value": 345, "currencyId": 3 },
    "User": 44641
  }
}
```

### Creating Object Record - API Format

```json
POST /object-record/935

{
  "properties": [
    { "systemName": "a6c58533-e21f-48b2-8389-d0ae954d28e2", "value": "Record Name" },
    { "systemName": "fffd692c-87a9-41bf-9bc1-0e9868d9a1ab", "value": "2026-01-15T00:00:00+01:00" },
    { "systemName": "bfb218ce-59d7-46eb-b775-04f87bfd84a2", "value": "Address Value" },
    { "systemName": "8b0de562-386c-4004-abb8-0acb0d553380", "value": 123 },
    { "systemName": "3f2ebeea-d87c-45ad-a59e-d681dd8d3903", "value": { "value": 1000, "currencyId": 3 } },
    { "systemName": "01f1b2ef-e8bf-47a0-acb3-6c1629a9545f", "value": 44641 }
  ]
}
```

**Note:** The top-level `name` field is read-only. The record name is derived from the "Name" property.

---

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/document-version/data/64004` | Create document from template |
| GET | `/document-version/data/{code}` | Get document elements |
| GET | `/object-record/935` | Get object records |
| POST | `/object-record/935` | Create new object record |
| GET | `/user` | List all users |
| POST | `/user` | Create user(s) - **expects ARRAY** |
| PUT | `/user/{id}` | Update user |
| DELETE | `/user/{id}` | Delete user |

---

## API Format Notes

### POST /user - User Creation

**IMPORTANT:** POST /user expects an **ARRAY** of users, not a single object!

Request format:
```json
[
  {
    "email": "user@example.com",
    "name": "User Name",
    "caption": "Position/Title",
    "timezone": "Europe/Prague"
  }
]
```

Response format (returns array of created users):
```json
[
  {
    "id": 12345,
    "email": "user@example.com",
    "name": "User Name",
    "customIdentifier": null,
    "created": "2026-01-02T22:11:54+01:00",
    "position": null,
    "timezone": "Europe/Prague",
    "sessionExpiration": 7200,
    "sessionDestroy": 0,
    "customData": null
  }
]
```

Note: The request uses `caption` but response returns `position` (which may be null).

---

<!-- Add your additional context below -->

