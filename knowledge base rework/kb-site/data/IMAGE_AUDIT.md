# KB image audit - UI currency of every live-KB screenshot

585 unique image files (593 placements). Verdicts: REPLACE 373 - OK 135 - N-A 53 (not Legito UI: Word, third-party apps, diagrams) - CHECK 24.

Verdict basis: visual era classification by a 10-agent audit + wordpress upload date.
REPLACE = Legito UI that predates the current interface: the screenshot must be retaken
in current Legito (same scene per `recipe`), the original annotations (arrows/boxes per
`annotations`) redrawn on the new background. Machine-readable master: `image_audit.json`.

## REPLACE (373)

### DASHBOARD/Dashboard Overview.md
- `live/dashboard-overview-01-fa230d.png` (2021-12) - Dashboard widget-type picker dropdown (Drop Area / Document Records - Grid / Kanban / Object Records - Grid / Templates); reproduce: Dashboard > Customize Dashboard > Add row > Select Widget dropdown
- `live/dashboard-overview-02-8ecbed.png` (2021-12) - Dashboard switcher dropdown listing available dashboards; annotations: red box around dashboard list / Create New Dashboard option; reproduce: Dashboard > dashboard-name dropdown (top of Dashboard page)
- `live/dashboard-overview-03-8cec93.png` (2021-12) - Dashboard rename bar with Save button and private/default checkboxes; annotations: red arrow to 'Make this dashboard private' checkbox; reproduce: Dashboard > Customize Dashboard > rename bar
- `live/dashboard-overview-04-bf392f.png` (2021-12) - Timeline widget entries with Customize Dashboard button and Powered-by-Legito footer; annotations: red arrow to Customize Dashboard button; reproduce: Dashboard > Timeline widget > Customize Dashboard
- `live/dashboard-overview-05-a8e377.png` (2021-12) - Generic dashboard row placeholder strip with + Add Row button; reproduce: Dashboard > Customize Dashboard > Add Row
- `live/dashboard-overview-06-824f7b.png` (2021-12) - Document Records - Grid widget (Recent Documents table) in edit mode with row/column controls; annotations: red arrows to dropdown caret, Add Row, Edit, Delete, Delete Row controls; reproduce: Dashboard > Document Records - Grid widget, edit mode
- `live/dashboard-overview-07-e2078c.png` (2021-12) - Dashboard rename field with Save button; annotations: red arrow to Save button; reproduce: Dashboard > Customize Dashboard > rename/Save
- `live/dashboard-overview-08-99ebaf.png` (2021-12) - Dashboard switcher dropdown (Workspace Default) with Create New Dashboard option; annotations: red arrow to Create New Dashboard option; reproduce: Dashboard > dashboard-name dropdown
- `live/dashboard-overview-09-0e48d3.png` (2021-12) - Dashboard edit-mode top bar with Create New Dashboard / Finish buttons; annotations: red arrow to Create New Dashboard button; reproduce: Dashboard > Customize Dashboard (edit mode)

### DASHBOARD/Widget Types/Counter.md
- `live/counter-01-03a736.jpg` (2022-02) - Counter widget example: signature/review/signed-this-month stats; reproduce: Dashboard > Counter widget example
- `live/counter-02-675b6f.png` (2022-02) - Counter widget example: four plain colored-number cards (Show all / Recently Closed / Actively negotiated / Terminated contracts); reproduce: Dashboard > Counter widget, plain-number variant
- `live/counter-03-85917e.png` (2022-02) - Counter widget example: three cards with clipboard-checkmark icons (Recently Closed / MoM Growth / Recently Closed); reproduce: Dashboard > Counter widget, icon variant

### DASHBOARD/Widget Types/Document Records - Grid.md
- `live/document-records-grid-01-1b8f33.png` (2021-12) - Document Records - Grid widget: Recent Documents table with Edit/View/Download actions; reproduce: Dashboard > Document Records - Grid widget
- `live/document-records-grid-02-c1b43f.jpg` (2022-05) - Edit Dashboard Widget modal, Document Records - Grid type, Filter dropdown open; annotations: red arrow to Filter label; reproduce: Dashboard widget > Edit (gear/pencil) > Filter dropdown

### DASHBOARD/Widget Types/Document Records - Kanban.md
- `live/document-records-kanban-01-6d20f9.png` (2021-12) - Document Records - Kanban widget: two-panel Contracts/Other Documents board with stage columns; reproduce: Dashboard > Document Records - Kanban widget

### DASHBOARD/Widget Types/Drop Area.md
- `live/drop-area-01-994ff9.png` (2021-12) - Drop Area widget: Create Document Record / Sign document upload zones; reproduce: Dashboard > Drop Area widget

### DASHBOARD/Widget Types/Object Records - Grid.md
- `live/object-records-grid-01-df6b19.png` (2021-12) - Create Dashboard Widget modal, Object Records - Grid type, Object=Vendors, sort/limit fields; reproduce: Dashboard > Add row > Select Widget > Object Records - Grid > Create

### DASHBOARD/Widget Types/Signature in Progress.md
- `live/signature-in-progress-01-15ec60.png` (2021-12) - Signature in Progress widget: two Contractor Agreement cards awaiting signature; reproduce: Dashboard > Signature in Progress widget

### DASHBOARD/Widget Types/Templates.md
- `live/templates-01-976718.png` (2021-12) - Templates widget: template suite cards with Agreement Groups / Countries filter panel open; reproduce: Dashboard > Templates widget > Filter

### DASHBOARD/Widget Types/Timeline.md
- `live/timeline-01-6840e6.png` (2021-12) - Timeline widget: document-stage activity feed; reproduce: Dashboard > Timeline widget

### DOCUMENT EDITOR/Data Import/Batch Generation from Sheets.md
- `live/batch-generation-from-sheets-02-1855d2.png` (2020-03) - Old Document Editor toolbar, Batch Generation tab highlighted, CSV/XLS drop zone; annotations: red box around Batch Generation tab; reproduce: Document Editor > Data Import > Batch Generation
- `live/batch-generation-from-sheets-03-d5c5a2.png` (2020-03) - Document field dropdown (Name) in Loan Agreement body; annotations: red arrow to Name field dropdown/checkmark; reproduce: Document Editor > document body > click a bracketed field, choose column mapping
- `live/batch-generation-from-sheets-04-78595f.png` (2020-03) - Document field dropdown (Name) collapsed; annotations: red arrow to Name field; reproduce: Document Editor > document body field mapping
- `live/batch-generation-from-sheets-05-9c8ae5.png` (2020-03) - Document field dropdown (Name) with delete icon; annotations: red arrow to delete/trash icon on field; reproduce: Document Editor > document body field mapping > remove field
- `live/batch-generation-from-sheets-06-0e994e.png` (2020-03) - Advanced Settings modal for sheet import: Encoding and Separator options; reproduce: Document Editor > Data Import > Batch Generation > Advanced Settings
- `live/batch-generation-from-sheets-07-c51eb6.png` (2020-03) - Run Batch Generation modal: document list with house style and export-format icons; annotations: red arrow to 'Create Document Records But Do Not Batch Export' checkbox; reproduce: Document Editor > Batch Generation > Run Batch Generation dialog

### DOCUMENT EDITOR/Data Import/Import from Legito Documents.md
- `live/import-from-legito-documents-01-5c651c.png` (2020-03) - Old Document Editor toolbar, Import from Legito tab highlighted, Choose document record / Smart Import buttons; annotations: red box around Import from Legito tab; reproduce: Document Editor > Data Import > Import from Legito
- `live/import-from-legito-documents-02-14498a.png` (2020-03) - Document field dropdown showing linked import source, two states stacked; annotations: red arrows to field dropdown checkmark/delete icons; reproduce: Document Editor > Import from Legito > field mapping

### DOCUMENT EDITOR/Data Import/Import from Sheets.md
- `live/import-from-sheets-01-4d07be.png` (2020-03) - Old Document Editor toolbar, Import from Sheet tab highlighted, CSV/XLS drop zone; annotations: red box around Import from Sheet tab; reproduce: Document Editor > Data Import > Import from Sheet
- `live/import-from-sheets-02-649625.png` (2020-03) - Advanced Settings modal for sheet import: Encoding and Separator options; reproduce: Document Editor > Import from Sheet > Advanced Settings

### DOCUMENT EDITOR/Document Export/Download.md
- `live/download-01-09eadf.png` (2020-03) - Old Document Editor toolbar, Save dropdown open with 'Save and Download' highlighted; annotations: red arrow to Save and Download menu item; reproduce: Document Editor > Save dropdown
- `live/download-02-86454d.png` (2020-03) - Download modal, export-format submenu expanded (PDF/A, HTML, RTF, XML, ODT, TXT); annotations: red box around format list, red arrow to '...' menu; reproduce: Document Editor > Download > format '...' menu
- `live/download-03-ae49b3.png` (2020-03) - Old Document Editor toolbar with Download button; annotations: red arrow to Download button; reproduce: Document Editor > top toolbar Download button
- `live/download-04-bbf56e.png` (2020-03) - Document body bottom (Add witness) with Download button, Powered-by-Legito footer, chat widget; annotations: red arrow to Download button; reproduce: Document Editor > bottom-of-document Download button
- `live/download-05-9cdd95.png` (2020-03) - Workspace Admin > User Permissions checklist, export-file permissions section; annotations: red box around 'Export to file' permission checkboxes; reproduce: Workspace Admin > People > Edit user > User Permissions
- `live/download-07-77f1a3.png` (2020-03) - Download modal with 'Combine all PDFs into one file' toggle and file checkboxes; annotations: red boxes around Combine-PDFs toggle and file checkboxes; reproduce: Document Editor > Download modal
- `live/download-08-a946d7.png` (2020-03) - Old Document Editor toolbar, Save/Print-preview dropdown open; annotations: red arrow to Print preview menu item; reproduce: Document Editor > Save dropdown > Print preview
- `live/download-09-69d48c.png` (2022-11) - Old Document Editor toolbar, Start signing dropdown open (Print preview/Download/Save As/Add to Favorite Settings); annotations: red arrow to Print preview menu item; reproduce: Document Editor > Start signing dropdown
- `live/download-10-702fae.png` (2020-03) - PDF print preview modal showing rendered contract with yellow-highlighted placeholders; reproduce: Document Editor > Download/Print preview

### DOCUMENT EDITOR/Document Export/Sending by Email.md
- `live/sending-by-email-01-baf9d8.png` (2020-03) - Old Document Editor toolbar, Download dropdown open with Send By Email highlighted; annotations: red box around Send By Email menu item; reproduce: Document Editor > Download dropdown > Send By Email
- `live/sending-by-email-02-3ca4ba.png` (2020-03) - Send by e-mail modal with recipient list and export settings; reproduce: Document Editor > Download modal > Send by e-mail tab

### DOCUMENT EDITOR/Document Language/Dual Language Documents.md
- `live/dual-language-documents-01-efa7f7.png` (2020-02) - Old Document Editor toolbar, Languages tab highlighted, Second-language toggle set to Espanol; annotations: red arrows to Languages tab and Second language toggle; reproduce: Document Editor > Languages tab > Second language toggle

### DOCUMENT EDITOR/Document Language/Translations.md
- `live/translations-01-c9a411.png` (2024-02) - Old Document Editor toolbar, Languages tab, primary-language dropdown open (English/Deutsch/Espanol); annotations: red arrow to language dropdown; reproduce: Document Editor > Languages tab > primary language dropdown

### DOCUMENT EDITOR/Document Navigation/Document View Options.md
- `live/document-view-options-01-c1a1ad.png` (2020-02) - Old Document Editor toolbar, 'Modifiable Fields Only' toggle; annotations: red arrow to Modifiable Fields Only button; reproduce: Document Editor > View tab > Modifiable Fields Only toggle
- `live/document-view-options-02-25161b.png` (2020-02) - Old Document Editor toolbar, 'Apply conditions' toggle; annotations: red arrow to Apply conditions button; reproduce: Document Editor > View tab > Apply conditions toggle

### DOCUMENT EDITOR/Document Review/Comments.md
- `live/comments-01-66af22.png` (2020-02) - Document body with inline comment bubble icon and Add Comment box; annotations: red arrow to comment bubble icon; reproduce: Document Editor > document body > comment icon in margin

### DOCUMENT EDITOR/Document Review/Compare.md
- `live/compare-01-6a3533.png` (2020-02) - Old Document Editor, Compare feature showing two document versions side by side with version-picker dropdowns; annotations: arrows pointing to each version's date header; reproduce: Document Editor > Review tab > Compare

### DOCUMENT EDITOR/Document Review/Real Time Document Collaboration.md
- `live/real-time-document-collaboration-01-5d58bc.png` (2021-01) - Document body with dark 'Currently drafted by' / Viewers collaboration sidebar panel; reproduce: Document Editor > collaboration sidebar (shown when multiple users open a document)

### DOCUMENT EDITOR/Document Review/Track Changes.md
- `live/track-changes-01-adc09b.png` (2024-02) - Old Document Editor, Review tab, Track Changes toolbar and Reviewers panel open; annotations: red arrows to Track Changes toolbar button and left-rail Track Changes icon; reproduce: Document Editor > Review tab > Track Changes
- `live/track-changes-02-a73b31.png` (2024-02) - Document body showing tracked insertions/deletions and a reviewer accept/reject popup; reproduce: Document Editor > Track Changes, viewing a tracked edit
- `live/track-changes-03-efe67f.png` (2024-02) - Old Document Editor, Track Changes active, tracked field edits in document body; annotations: red arrows to tracked-change fields; reproduce: Document Editor > Track Changes, editing fields
- `live/track-changes-04-cd0734.png` (2024-02) - Reviewers dropdown panel open with per-reviewer Accept/Reject; annotations: red arrow to Reviewers dropdown; reproduce: Document Editor > Review tab > Reviewers dropdown
- `live/track-changes-05-f36d83.png` (2024-02) - Reviewers dropdown and individual change Accept/Reject popup; annotations: numbered red arrows to Reviewers button, dropdown, and Accept/Reject popup; reproduce: Document Editor > Review tab > Reviewers > accept/reject a change
- `live/track-changes-06-2fb6f3.png` (2024-02) - Old Document Editor, Track Changes button highlighted, clean document with underlined placeholder fields; annotations: red arrow to Track Changes button; reproduce: Document Editor > Review tab > Track Changes toggle
- `live/track-changes-07-95d749.png` (2024-02) - Old Document Editor, View tab, 'My Favorite Settings' banner and Free calculation questionnaire, Track Changes icon tooltip; annotations: red arrow to Track Changes icon in left rail; reproduce: Document Editor > View tab > Favorite Settings / left-rail Track Changes icon
- `live/track-changes-09-d3a33c.png` (2024-02) - Edit user permissions modal over Workspace Admin People page, showing old horizontal top menu (List of Partners/Minimum wage/People/Analytics); annotations: red box around Display/Control/Approve Track Changes permissions and People tab; reproduce: Workspace Admin > People > Edit user > User Permissions
- `live/track-changes-10-4c75d0.png` (2024-02) - Admin > People > Guests permission list, Track Changes checkboxes; annotations: red box around People menu item, red box around Guests list entry, red box around three Track Changes permission checkboxes; reproduce: Workspace Admin > People > Guests > permission checklist (Display/Control/Approve Track Changes)
- `live/track-changes-11-b8f3f7.png` (2024-02) - Document Editor > Review tab, Track Changes / Consequential Changes toggle buttons; annotations: red arrow pointing to Consequential Changes toggle; reproduce: Document Editor > Review tab, top toolbar toggles
- `live/track-changes-12-60686e.png` (2024-02) - Document Editor > Review tab, Reviewers dropdown with per-reviewer Accept/Reject/Hide; annotations: three red arrows to reviewer visibility (eye) icon, reviewer avatar row, and Hide All button; reproduce: Document Editor > Review tab > Reviewers dropdown

### DOCUMENT EDITOR/Overview of Document Drafting.md
- `live/overview-of-document-drafting-01-1764db.png` (2021-10) - Document Editor > View tab, Loan Agreement draft with unanswered mandatory question banner and tooltip; reproduce: Document Editor > View tab, open a document with an unanswered required Question element
- `live/overview-of-document-drafting-02-2653ee.png` (2021-12) - Document Editor > View tab, Outline panel opened from left icon rail showing clause tree; annotations: red arrow to Outline (list) icon in left rail; reproduce: Document Editor > View tab > click the list/Outline icon in the left icon rail
- `live/overview-of-document-drafting-03-94f866.png` (2020-03) - Document content: Question element rendered as radio buttons (Lump-Sum / In Installments); annotations: red arrow pointing at the question label; reproduce: Document Editor > View tab, a Question element with radio-button answers
- `live/overview-of-document-drafting-04-3ab03f.png` (2020-03) - Document content: Select element rendered as dropdown ('by a bank transfer' / 'in cash'); annotations: red arrow to the open dropdown; reproduce: Document Editor > View tab, a Select element dropdown
- `live/overview-of-document-drafting-05-a7d7d0.png` (2020-03) - Document content: Button elements ('Add Creditor', 'New counter') for adding repeat parties; annotations: two red arrows pointing at the green Add Creditor / New counter buttons; reproduce: Document Editor > View tab, repeat-party Button elements ('Add Creditor' / 'New counter')
- `live/overview-of-document-drafting-06-a9517b.png` (2020-03) - Document content: Link elements echoing party names ('Jane Doe' / 'John Doe') elsewhere in the document; annotations: two red arrows with captions 'Element linked to creditor's name' / 'Element linked to debtor's name'; reproduce: Document Editor > View tab, a Link element echoing a linked party's name
- `live/overview-of-document-drafting-07-a02213.png` (2020-03) - Document content: Calculation element, shares table with auto-summed totals; annotations: red arrow to the Number of shares input; reproduce: Document Editor > View tab, a table with a Calculation element column
- `live/overview-of-document-drafting-08-3757ba.png` (2020-03) - Document content: Text Input element (notice-period days) inside a Termination clause; annotations: red arrow to the text input box; reproduce: Document Editor > View tab, a Text Input element inside a clause
- `live/overview-of-document-drafting-09-c7bcea.png` (2020-03) - Document content: Date element with calendar date-picker widget open; annotations: red arrow to the date field; reproduce: Document Editor > View tab, a Date element, click the field to open the calendar picker
- `live/overview-of-document-drafting-10-9f16a0.png` (2020-03) - Document content: Money element with currency dropdown ($ CZK GBP EUR RUB AUD); annotations: red arrow to the currency dropdown; reproduce: Document Editor > View tab, a Money element currency selector
- `live/overview-of-document-drafting-11-91ceb4.png` (2020-03) - Document content: Text element showing 'Double Click To Unlock' tooltip on locked text; reproduce: Document Editor > View tab, a locked Text element, hover to see the unlock tooltip
- `live/overview-of-document-drafting-12-cca6aa.png` (2022-07) - Document Editor full view, Rich Text element with formatting toolbar (B/I/U, tables, code) open; reproduce: Document Editor > View tab, click into a Rich Text element to open its formatting toolbar
- `live/overview-of-document-drafting-13-fd152d.png` (2019-03) - Document Editor, Instructions tab open; annotations: red box around the Instructions tab; reproduce: Document Editor > Instructions tab
- `live/overview-of-document-drafting-15-4f4b52.png` (2020-02) - Document content: Contractual Penalty field showing a validation Warning tooltip ('too high'); annotations: red arrow to the warning tooltip; reproduce: Document Editor > View tab, trigger a Warning by entering an out-of-range value
- `live/overview-of-document-drafting-16-21a92b.png` (2020-02) - Document content: Creditor name field showing a green Help Text tooltip; annotations: red arrow to the help-text bubble; reproduce: Document Editor > View tab, a field with configured Help Text, click the field to reveal the tooltip
- `live/overview-of-document-drafting-17-85c1ac.gif` (2020-02) - Animated demo: toggling visibility (eye icon) of a mandatory vs. optional clause in the document; annotations: none (animated cursor demo, no static markup); reproduce: Document Editor > View tab, toggle the eye icon next to an optional clause
- `live/overview-of-document-drafting-18-2af89a.png` (2019-03) - Document Editor top bar, Owner dropdown; annotations: red arrow to the Owner dropdown; reproduce: Document Editor top bar > Owner dropdown
- `live/overview-of-document-drafting-19-69da9b.png` (2019-03) - Document Editor top bar, Draft status dropdown showing the list of workflow stages; annotations: red arrow to the status dropdown; reproduce: Document Editor top bar > status dropdown (workflow stages)
- `live/overview-of-document-drafting-20-df91b0.png` (2019-03) - Document Editor Review toolbar with red arrow toward the Share/add-person icon; annotations: red arrow to the green share/add-person icon; reproduce: Document Editor top bar > Share (person-add) icon
- `live/overview-of-document-drafting-21-7caa5c.png` (2020-02) - Conversation side panel, empty state ('Start a conversation'); annotations: red arrow to the empty conversation area; reproduce: Document Editor > open the Conversation panel from the bottom-right
- `live/overview-of-document-drafting-22-2bb411.png` (2022-11) - Document Editor, Record Properties tab, 'Assign to Document Record' dropdown; annotations: two red arrows to Record Properties tab and the assign-to-record dropdown; reproduce: Document Editor > Record Properties tab
- `live/overview-of-document-drafting-23-701034.png` (2019-03) - Document Editor, Upload Attachments panel with a sample DOCX attached; annotations: red box around the Upload Attachments section; reproduce: Document Editor > View tab, scroll to the Upload Attachments block near the signature section

### DOCUMENT EDITOR/Saving & Versions/Merging Template Updates.md
- `live/merging-template-updates-01-d6a0d1.png` (2020-03) - Document Editor, 'outdated template version' banner with Merge To... dropdown; annotations: red box around the whole outdated-version banner and Merge To dropdown; reproduce: Document Editor > Review tab, open a document based on a superseded template version

### DOCUMENT EDITOR/Saving & Versions/Saving.md
- `live/saving-01-c53461.png` (2020-03) - Document Editor top bar, Save button and its dropdown (Save and Download / Save and Send by Email / Save As A New Document / Add to Favorite Settings); annotations: two red arrows to the Save button and 'Save As A New Document' option; reproduce: Document Editor top bar > Save button dropdown
- `live/saving-02-266f04.png` (2020-03) - Document Editor, Save button and dropdown cropped near the document footer; annotations: two red arrows to 'Save As A New Document' menu item and the Save button; reproduce: Document Editor top bar > Save dropdown menu

### DOCUMENT EDITOR/Saving & Versions/Template Favorite Settings.md
- `live/template-favorite-settings-01-860714.png` (2020-02) - Document Editor, 'Apply Favorite settings' banner prompting to choose a saved setting; reproduce: Document Editor > View tab, top banner shown when Favorite Settings exist for the template
- `live/template-favorite-settings-02-5998ae.png` (2020-02) - 'Create New Favorite Setting' modal with name field and Only For Me / Default checkboxes; reproduce: Document Editor > Save dropdown > Add to Favorite Settings
- `live/template-favorite-settings-03-d4ce26.png` (2020-02) - 'My Favorite Settings' bar expanded, showing a saved setting with edit/delete icons; annotations: red arrow to the My Favorite Settings label; reproduce: Document Editor > View tab > My Favorite Settings bar
- `live/template-favorite-settings-04-78a228.png` (2020-02) - 'Create New Favorite Setting' modal, 'Only For Me' checkbox highlighted; annotations: red arrow to the Only For Me checkbox; reproduce: Document Editor > Add to Favorite Settings modal
- `live/template-favorite-settings-05-3c9c0c.png` (2020-02) - 'Create New Favorite Setting' modal, 'Default' checkbox highlighted; annotations: red arrow to the Default checkbox; reproduce: Document Editor > Add to Favorite Settings modal
- `live/template-favorite-settings-06-74bac4.png` (2024-08) - 'My Favorite Settings' bar, saved 'Verified Suppliers' setting shown in the dropdown; annotations: two red arrows to the setting name and the edit (pencil) icon; reproduce: Document Editor > View tab > My Favorite Settings dropdown
- `live/template-favorite-settings-07-bac37b.png` (2024-08) - 'Create New Favorite Setting' modal, Default checkbox unchecked next to Save button; annotations: two red arrows to the Default checkbox and Save button; reproduce: Document Editor > Add to Favorite Settings modal
- `live/template-favorite-settings-08-c6fa5a.png` (2024-08) - 'My Favorite Settings' dropdown, delete (trash) icon on a saved setting; annotations: red arrow to the trash/delete icon; reproduce: Document Editor > My Favorite Settings dropdown > delete icon
- `live/template-favorite-settings-09-dacefc.png` (2024-08) - Confirmation banner: 'Default setting Verified Suppliers successfully deleted'; annotations: red arrow to the confirmation message; reproduce: Document Editor, after deleting a Favorite Setting

### DOCUMENT EDITOR/Saving & Versions/Version History.md
- `live/version-history-01-ceb444.png` (2020-03) - Document Editor Review toolbar, Version dropdown listing document versions; annotations: red arrow to the Version dropdown; reproduce: Document Editor > Review tab > Version dropdown
- `live/version-history-02-03a850.png` (2020-03) - 'Nice to see you again!' modal offering to resume an unsaved revision (Continue / Start again); reproduce: Document Editor, reopen a document with an unsaved draft revision

### ELECTRONIC SIGNATURE/Legito Sign/Legito BioSign.md
- `live/legito-biosign-01-bad9b0.gif` (2020-03) - Legacy Dashboard homepage: recent documents table and template gallery, old horizontal top menu; annotations: none (animated cursor demo); reproduce: Dashboard homepage. Note: Legito BioSign is a deprecated feature - this article likely needs retirement/rewrite, not just a UI refresh
- `live/legito-biosign-02-75a25d.png` (2020-01) - Document content: 'LEGITOSIGN' signature block with linked-name tags (cropped, no chrome); annotations: red arrow to the LEGITOSIGN block; reproduce: Document Editor > View tab, a document using the legacy BioSign signature block (BioSign is now deprecated)

### ELECTRONIC SIGNATURE/Legito Sign/Legito Sign Editor.md
- `live/legito-sign-editor-01-cfe976.png` (2022-06) - Legito Sign editor: signing fields (Text/Date/Signature) with 'Start Signing' dropdown (Customize Message / Save For Later / Delete / Log Out); annotations: red arrow to the Start Signing dropdown menu; reproduce: Legito Sign external signing screen > Start Signing dropdown

### ELECTRONIC SIGNATURE/Legito Sign/Manage Signatures.md
- `live/manage-signatures-01-44e848.png` (2022-06) - Legacy 'Manage Signings' list page (old horizontal top menu incl. Vendors/Customers/Clause Library/Case Management) with a per-signer status tooltip; reproduce: Manage Signings page > document list with signature status

### ELECTRONIC SIGNATURE/eSignature Overview.md
- `live/esignature-overview-01-1714e3.png` (2023-08) - Workspace Settings > General, Signatures section listing e-signature providers (Legito Sign, Legito BioSign, DocuSign, Adobe Sign, Flow Sign); annotations: red box around the Signatures provider checklist; reproduce: Workspace Settings > General > Signatures section. Note: Legito BioSign is deprecated and should not appear as an option in a refreshed screenshot
- `live/esignature-overview-02-59ed78.png` (2021-10) - 'Choose Signatories' modal with consecutive-signing order and recipient list; annotations: red arrow to 'Consecutive signing' checkbox, red box around the signing-order dropdowns; reproduce: Document Editor > Start Signing > Choose Signatories modal
- `live/esignature-overview-03-5963f9.png` (2022-06) - Templates listing with a template's Settings panel open, 'Sign with' provider dropdown (LegitoSign); annotations: two red arrows to the Settings link and the Sign-with dropdown; reproduce: Templates > [template] > Settings > Sign with dropdown
- `live/esignature-overview-04-caf6c1.png` (2020-03) - Template Editor, clause tree showing a 'LEGITOSIGN1' signature tag element; annotations: red arrow to the LEGITOSIGN1 tag; reproduce: Template Editor > Design tab, a clause containing a LegitoSign signature tag
- `live/esignature-overview-05-fe9cb3.png` (2023-08) - Template Editor, 'LEGITOSIGNDATE1' auto-generated signing-date tag highlighted; annotations: none (blue highlight is selection state, not a drawn annotation); reproduce: Template Editor > Design tab, auto-created signing-date tag next to a LegitoSign tag
- `live/esignature-overview-06-66e526.png` (2022-06) - Workflow builder, Contract Life-cycle stage diagram with a stage-property checklist ('Start signing' highlighted); annotations: red box and arrow to the 'Start signing' checkbox; reproduce: Workspace Settings > Workflows > [workflow] > stage properties panel
- `live/esignature-overview-07-3e1da6.png` (2022-06) - Dashboard widget picker, 'Select Widget' dropdown (Drop Area, Document Records, Templates, Timeline, etc.); annotations: red arrow to the Drop Area option; reproduce: Dashboard > Edit > Select Widget dropdown
- `live/esignature-overview-08-09a97c.png` (2022-06) - 'Edit Dashboard Widget' modal configuring a Sign Document drop area with LegitoSign; annotations: two red arrows to the Sign Document Type field and LegitoSign Sign Type field; reproduce: Dashboard > Edit Widget modal > Drop Area configured as Sign Document

### INTEGRATIONS/Integration Tools/API Keys.md
- `live/api-keys-01-966d0d.png` (2020-02) - Legacy Workspace Settings > API page (old horizontal top menu) with Generate API Keys button and an existing key row; annotations: two red arrows to the Generate API Keys button and the API side-nav item; reproduce: Workspace Settings > Developers > API
- `live/api-keys-02-a3a8ca.png` (2023-05) - API settings, Personal Settings tab showing Default API User selector; annotations: red arrow to the Personal Settings tab; reproduce: Workspace Settings > Developers > API > Personal Settings tab

### INTEGRATIONS/Integration Tools/JSON Integrations.md
- `live/json-integrations-01-93772c.png` (2024-02) - Legacy Workspace Settings > JSON Integrations list page (old horizontal top menu) with one sample integration row; annotations: two red arrows to the JSON Integrations nav item and the Create New button; reproduce: Workspace Settings > Developers > JSON Integrations
- `live/json-integrations-02-16aa86.png` (2024-02) - 'Create JSON Integration' modal (name, description, template suite, JSON file upload); reproduce: JSON Integrations > Create New modal
- `live/json-integrations-03-152edd.png` (2024-02) - JSON Integration editor: sample employee JSON tree with Integration Trigger and Template Suite mapping panel; reproduce: JSON Integrations > open an integration > editor screen
- `live/json-integrations-04-047233.png` (2024-02) - JSON Integration editor, field-mapping panel (Match With: Document Settings / Template Element / Attachment, Transformation Function); annotations: red box around the mapping panel, red arrow from the JSON field to the mapped element; reproduce: JSON Integrations > editor > click a JSON field to open the field-mapping side panel
- `live/json-integrations-05-6a1574.png` (2024-02) - JSON Integration editor, Integration Trigger panel (String / Conditions / None) with String Name field; annotations: red box around the Integration Trigger panel, red arrow pointing to it; reproduce: JSON Integrations > editor > Integration Trigger panel

### INTEGRATIONS/Integration Tools/Push API (Webhooks).md
- `live/push-api-webhooks-02-1d8897.png` (2020-12) - Push API Push Connections list page, old horizontal top nav (Dashboard/Templates/Manage Documents/People/Analytics/Pricing); reproduce: Integrations > Push API (Webhooks) > Push Connections tab, list view
- `live/push-api-webhooks-04-df8bdb.png` (2020-12) - Edit Push Connection modal: apply-to Event types toggle list, partial old top nav visible at edge; reproduce: Push API > Push Connections > Edit > Apply to Event types / Document Record Types section
- `live/push-api-webhooks-05-75c41f.png` (2020-12) - Edit Push Connection modal: Attach following files / file formats toggle list; reproduce: Push API > Push Connections > Edit > Attach files / file formats section
- `live/push-api-webhooks-07-b99b85.png` (2020-12) - Push API Logs list page, old horizontal top nav (Dashboard/Templates/Manage Documents/People/Analytics/Pricing); reproduce: Push API > Logs tab, list view
- `live/push-api-webhooks-08-945a1f.png` (2020-12) - Push API Log detail view (Request Body / Response HTTP Code / Response Header), old top nav visible; reproduce: Push API > Logs tab > open one log entry (Show)

### INTEGRATIONS/Other Apps in Legito/Microsoft Entra ID (Azure AD).md
- `live/microsoft-entra-id-azure-ad-18-2fcc6f.png` (2023-04) - Edit SSO Role modal - permission checklist for a custom role (People > Roles & Permissions); annotations: red arrow to Identifier field, red arrow to Save button; reproduce: People > Roles & Permissions > Edit Role modal

### INTEGRATIONS/Other Apps in Legito/Microsoft Office For Web.md
- `live/microsoft-office-for-web-01-40d9ad.png` (2021-12) - Document Record Files panel showing a saved file with Edit button (opens Office for Web); annotations: red arrow to Edit button; reproduce: Manage Documents > open a Document Record > Files panel > Edit on a saved Office file
- `live/microsoft-office-for-web-02-2634c5.png` (2021-12) - Excel spreadsheet opened via Office for Web integration, embedded in Legito with old top navigation; annotations: red arrow to co-author avatars top right; reproduce: Manage Documents > Document Record with an Excel attachment > Edit (Office for Web)
- `live/microsoft-office-for-web-04-47815f.png` (2021-12) - Upload Attachments panel - existing attachment card with Edit action, drop zone for new files; annotations: red arrow to Edit button on attachment card; reproduce: Document Record > Attachments > Upload Attachments panel

### ONBOARDING/Guided Tour.md
- `live/guided-tour-01-2fdcd0.png` (2020-02) - Template gallery (Use Template screen) showing template cards including Contractor Agreement with #tour tag; annotations: red box around Contractor Agreement card, red arrow to #tour label; reproduce: Templates > browse the template gallery cards
- `live/guided-tour-02-39b1fd.png` (2020-02) - Template Editor Design tab - Help modal editing a Textinput's Long help text containing a #question tag; annotations: red arrow to #question tag; reproduce: Template Editor > select a Textinput element > Help > edit Long help

### ONBOARDING/User Onboarding.md
- `live/user-onboarding-01-f34a2b.png` (2023-03) - Dashboard with onboarding progress widget (Create Account, Watch Video, Quick/Full Guided Tour, Explore Resources, Personalize Account); reproduce: Dashboard (new non-admin user) > onboarding checklist widget
- `live/user-onboarding-02-d7c1e4.png` (2023-03) - Onboarding Guide panel - Document Lifecycle Management section, step 3 'Create a simple Workflow' course card; reproduce: Dashboard > Onboarding Guide widget > Document Lifecycle Management section

### ONBOARDING/Workspace Onboarding.md
- `live/workspace-onboarding-01-70fe26.png` (2023-02) - Workspace Settings sidebar - Onboarding page listing user onboarding steps and general settings; annotations: red arrow to Onboarding menu item; reproduce: Workspace Settings > Onboarding
- `live/workspace-onboarding-02-d34bd0.png` (2023-02) - Onboarding Guide full checklist (Get know to Legito, Document Lifecycle Management, Document Automation, Building Custom Applications, Collaboration and Negotiation, Digital Signing, Measure & Improve Performance); reproduce: Dashboard > Open full guide
- `live/workspace-onboarding-03-7dfb36.png` (2023-02) - Onboarding Guide walkthrough tour modal explaining the Dashboard (step 1 of 10); reproduce: Dashboard > Onboarding Guide > Take the tour
- `live/workspace-onboarding-04-b167b6.png` (2023-02) - 'Welcome to your Legito Workspace' onboarding customization screen (select relevant course segments); reproduce: First login / Workspace onboarding customization screen
- `live/workspace-onboarding-05-f2221e.png` (2023-05) - Workspace Settings > Onboarding page - Activate workspace onboarding checkbox; annotations: red box around 'Activate workspace onboarding' checkbox; reproduce: Workspace Settings > Onboarding

### PROCESS MANAGEMENT/Custom Objects/Grid View (Objects).md
- `live/grid-view-objects-01-00c37e.png` (2021-07) - Manage Documents grid view - column header context menu (move/add/delete column); annotations: red arrows to column header controls and Done link; reproduce: Manage Documents > grid view > column header dropdown

### PROCESS MANAGEMENT/Custom Objects/Object Administration.md
- `live/object-administration-01-117382.png` (2021-07) - Workspace Settings > Objects - list of custom Objects (Vendors, Customers, Clause Library, Case Management); reproduce: Workspace Settings > Objects
- `live/object-administration-02-5dde5c.png` (2022-05) - Edit Object modal - Apply Sharing to the Object Records / Apply Workflow settings; annotations: red arrow to 'Apply Sharing to the Object Records' checkbox; reproduce: Workspace Settings > Objects > Edit an Object
- `live/object-administration-03-cd455d.png` (2022-05) - Custom Object records grid (e.g. Vendors) with filter sidebar, record detail panel, Share and Open Full Record buttons; annotations: red arrows to Owner filter and Owner column, red arrow to Share button; reproduce: Objects > open an Object > Object Records grid > select a record

### PROCESS MANAGEMENT/Document Management/Customizable Document Management Area.md
- `live/customizable-document-management-area-01-f3dfe7.png` (2021-01) - Personal Settings > Manage Documents tab - Preferred DMS view, Default Workflow, Default sort options; reproduce: Personal Settings > Manage Documents

### PROCESS MANAGEMENT/Document Management/Document Record Labels.md
- `live/document-record-labels-01-93e314.png` (2020-08) - Document Record detail page - Labels field showing an applied label (RiskManagement); annotations: red box around Labels field; reproduce: Manage Documents > open a Document Record > Labels field
- `live/document-record-labels-02-623047.png` (2020-08) - Workspace Settings > Templates & Docs Grouping - Labels field for creating document labels; annotations: red box around Labels field; reproduce: Workspace Settings > Templates & Docs Grouping

### PROCESS MANAGEMENT/Document Management/Kanban View.md
- `live/kanban-view-01-db80b2.png` (2021-01) - Manage Documents Kanban view - document cards across pipeline stages (Draft, Ready For Internal/Client Review, To Be Executed); reproduce: Manage Documents > switch to Kanban view

### PROCESS MANAGEMENT/Document Management/Search.md
- `live/search-01-b6c869.png` (2020-09) - Manage Documents search results - column visibility filter dropdown (Name, Persons, Summary, Document); annotations: red underline under Document checkbox; reproduce: Manage Documents > search a document > column filter icon
- `live/search-02-2898ee.jpg` (2022-05) - Manage Documents - advanced filter sidebar (Templates, Document Record Types highlighted); annotations: red box around Templates / Document Record Types filters; reproduce: Manage Documents > Show filters sidebar

### PROCESS MANAGEMENT/Records/Anonymization.md
- `live/anonymization-01-7b916b.png` (2020-03) - Document Record detail page - Anonymize button; annotations: red arrow to Anonymize button; reproduce: Manage Documents > open a Document Record > Anonymize
- `live/anonymization-02-ac22af.png` (2020-03) - Anonymize agreement confirmation modal - field selection (Money fields, Clauses added by user, Date fields, Textfield, Modified paragraphs); reproduce: Document Record > Anonymize > confirmation modal
- `live/anonymization-03-31bdf0.png` (2020-03) - Workspace Settings > Document Anonymization page - auto-anonymization age threshold and field settings; annotations: red arrows to age threshold dropdown, Save button, and Document Anonymization menu item; reproduce: Workspace Settings > Document Anonymization

### PROCESS MANAGEMENT/Records/Conversations.md
- `live/conversations-01-b3f37f.png` (2020-03) - Document fill-in view with collapsed Conversation panel; annotations: red arrow to Conversation panel toggle; reproduce: Open a document in the (old) Document Editor > Conversation panel
- `live/conversations-02-9b111e.png` (2020-03) - Document Record detail panel - Add Message / start a conversation input; annotations: red arrow to Add Message field; reproduce: Manage Documents > open a Document Record > Messages panel

### PROCESS MANAGEMENT/Records/Document Record Details.md
- `live/document-record-details-01-09757a.png` (2020-03) - Document Record detail view - top summary row (Created, Document Name, Persons, Status, Owner, Expiration); annotations: red box around top summary row; reproduce: Manage Documents > open a Document Record
- `live/document-record-details-02-8f8131.png` (2020-03) - Document Record detail view - detail panel below the summary row (dates, Summary, Files, conversation, Related Documents); annotations: red box around detail panel; reproduce: Manage Documents > open a Document Record

### PROCESS MANAGEMENT/Records/Document Sharing.md
- `live/document-sharing-01-9630f9.png` (2020-03) - Document Record detail view - Share button; annotations: red arrow to Share button; reproduce: Manage Documents > open a Document Record > Share
- `live/document-sharing-02-0e7756.png` (2020-03) - Share modal - permission level dropdown for adding another user (View Document Record Only, View Document, Edit Documents, Manage Documents); annotations: red box around permission dropdown and External Sharing toggle; reproduce: Document Record > Share > Another users permission dropdown
- `live/document-sharing-03-92d169.png` (2020-03) - Share modal - External Sharing panel with generated shareable link (Type, Permission, Owner, Status, Reminder); annotations: red box around External Sharing panel; reproduce: Document Record > Share > enable External Sharing

### PROCESS MANAGEMENT/Records/Document Timeline.md
- `live/document-timeline-01-876bb6.png` (2020-07) - Document Timeline view - event log entries with Users/Event filters; reproduce: Document Record > Timeline
- `live/document-timeline-02-41e003.png` (2020-07) - Manage Documents grid - Actions dropdown with Export Timeline to CSV highlighted; annotations: red box around Export Timeline to CSV; reproduce: Manage Documents > Actions dropdown

### PROCESS MANAGEMENT/Records/Properties/Document Record Properties Overview.md
- `live/document-record-properties-overview-01-09d42c.png` (2020-12) - Dashboard - My account dropdown menu highlighting Settings; annotations: red arrow to Settings menu item; reproduce: Dashboard > My account dropdown > Settings
- `live/document-record-properties-overview-02-e8c5b1.png` (2020-12) - Workspace Settings > Document Records > Properties tab - list of document record properties; annotations: red box around Properties/Property Groups/Document Record Types tabs, red arrow to Document Records menu item; reproduce: Workspace Settings > Document Records > Properties
- `live/document-record-properties-overview-03-3aabee.png` (2020-12) - Create Document Record Property modal; annotations: red box around whole modal; reproduce: Workspace Settings > Document Records > Properties > Create
- `live/document-record-properties-overview-04-30543d.png` (2021-07) - Create Object Property modal - Settings checkboxes (Show in Form, Record Name); annotations: red arrows to 'Show in Form' and 'Record Name' checkboxes; reproduce: Workspace Settings > Objects > Properties > Create
- `live/document-record-properties-overview-05-8e50d5.png` (2020-12) - Workspace Settings > Document Records > Property Groups tab (Files, Key Facts, Deadlines, Record Details); annotations: red arrow to Property Groups tab; reproduce: Workspace Settings > Document Records > Property Groups
- `live/document-record-properties-overview-06-2a4eea.png` (2022-07) - Edit Property Group modal - Position dropdown (Left); annotations: red box around Position field; reproduce: Workspace Settings > Document Records > Property Groups > Edit a group
- `live/document-record-properties-overview-07-d81c78.png` (2020-12) - Workspace Settings > Document Records > Document Record Types tab (General, Record Overview); annotations: red arrow to Document Record Types tab; reproduce: Workspace Settings > Document Records > Document Record Types
- `live/document-record-properties-overview-08-fdd2f6.png` (2022-07) - Document Record Type edit modal - permission level dropdown (Edit and Manage, Manage, Workspace Admins only); reproduce: Workspace Settings > Document Records > Document Record Types > Edit

### PROCESS MANAGEMENT/Records/Properties/Document Records Priority.md
- `live/document-records-priority-01-a9e96f.png` (2021-01) - Workspace Settings > Document Records > Priorities tab - priority levels list (High, Medium default, Low); reproduce: Workspace Settings > Document Records > Priorities

### PROCESS MANAGEMENT/Records/Properties/Properties - Choosing Options.md
- `live/properties-choosing-options-01-2f8233.png` (2020-12) - Create Document Record Property modal - Property Type dropdown, 'Choosing Options' category (Single/Multiple Checkboxes, Single/Multiple Choice Select); annotations: red arrow to Property Type field, red underline under 'Choosing Options' label; reproduce: Workspace Settings > Document Records > Properties > Create > Property Type dropdown
- `live/properties-choosing-options-02-2f0029.png` (2021-01) - Create Document Record Property modal - choosing-options fields (Template Tag, Option Name, Extraction Keyword, Sort); annotations: red arrow to Extraction Keyword field; reproduce: Workspace Settings > Document Records > Properties > Create > choose a Choosing Options type

### PROCESS MANAGEMENT/Records/Properties/Properties - Inputs.md
- `live/properties-inputs-01-71b257.png` (2020-12) - Create Document Record Property modal - Property Type dropdown, 'Inputs' category (Single/Multiple Dates, Single/Multi-line Text, Numerical Value); annotations: red arrow to Property Type field, red underline under 'Inputs' label; reproduce: Workspace Settings > Document Records > Properties > Create > Property Type dropdown

### PROCESS MANAGEMENT/Records/Properties/Properties - Special.md
- `live/properties-special-01-1ed8bb.png` (2020-12) - Workspace Settings > Document Records > Properties list - Create button and Deadline Notification row; annotations: red arrows to Properties tab, Create button, and Document Records menu item; reproduce: Workspace Settings > Document Records > Properties
- `live/properties-special-02-906f2a.png` (2020-12) - Create Document Record Property modal - Property Type dropdown, 'Special' category (Single/Multiple User Select, Single/Multiple User Group Select); annotations: red arrows to Property Type field and 'Special' label; reproduce: Workspace Settings > Document Records > Properties > Create > Property Type dropdown
- `live/properties-special-03-5031e8.png` (2021-07) - Create Object Property modal - Property Type dropdown showing Object/Document Record reference options; annotations: red box around Object Record / Document Record options; reproduce: Workspace Settings > Objects > Properties > Create > Property Type dropdown

### PROCESS MANAGEMENT/Records/Properties/Properties - System.md
- `live/properties-system-01-662467.png` (2022-01) - Document Record Saved Files version list with 'Sign with Legito BioSign' button (deprecated feature) and file dropdown menu (Upload new version highlighted); annotations: red arrow to Upload new version menu item; reproduce: Manage Documents > open a Document Record > Saved Files > file options menu
- `live/properties-system-02-18dae2.png` (2021-12) - Document Record Versions modal for a saved file attachment, with attachment list dropdown menu (Download, Versions, Rename, Delete); reproduce: Manage Documents > open a Document Record > Saved Files > Versions
- `live/properties-system-03-3bd49e.png` (2022-11) - Create Document Record Property modal - 'Associated Templates' property type configuration (per-template toggles, stage dropdown, permission); reproduce: Workspace Settings > Document Records > Properties > Create > Property Type: Associated Templates
- `live/properties-system-04-0b9dd0.png` (2022-11) - Document Record detail - 'Change or Terminate' section with related-document Create buttons (Amendment, Termination Notice, Purchase Order); annotations: red box around Change or Terminate section; reproduce: Manage Documents > open a Document Record with an Associated Templates property
- `live/properties-system-05-2779e4.png` (2022-11) - Create Document Record Property modal - Associated Templates toggle list, per-template Stage dropdown set to Executed; annotations: red arrow to Stage dropdown (Executed); reproduce: Workspace Settings > Document Records > Properties > Create > Property Type: Associated Templates > per-template stage dropdown
- `live/properties-system-06-381722.png` (2022-11) - Create/Edit Document Record Type dialog - toggle list with 'Apply Sharing to the Related Document' checkbox and Settings (Show in Document Management area, Export to CSV, Permission Required to Edit); annotations: red arrow pointing to 'Apply Sharing to the Related Document' checkbox; reproduce: Workspace admin > Document Records > Document Record Types > Create/Edit a record type > Sharing/Settings section
- `live/properties-system-07-409358.png` (2020-12) - Workspace admin - Document Records > Properties list (System properties: Saved Files, Summary, Value, Signing Date, etc.) with old horizontal top menu and legacy admin left sidebar; annotations: red box around the Properties table; reproduce: Workspace admin > Templates & Documents > Document Records > Properties tab

### PROCESS MANAGEMENT/Smart Document Management Overview.md
- `live/smart-document-management-overview-01-f38e29.png` (2020-02) - Manage Documents list (Document Records grid) with old horizontal top menu; annotations: red box around the document-records table; red arrow pointing to 'Manage Documents' tab; reproduce: Top nav > Manage Documents
- `live/smart-document-management-overview-02-95e807.png` (2020-02) - Manage Documents list with Status/Users filter sidebar and document rows; annotations: red box around table rows; reproduce: Manage Documents > list view with filter sidebar
- `live/smart-document-management-overview-03-a5237e.png` (2020-02) - Manage Documents filtered view - Status=Draft, Owner=Legito Admin filter chips with Status/Users filter panel; annotations: red box around active filter chips and Status/Users sidebar; reproduce: Manage Documents > apply Status + Owner filters, expand filter sidebar
- `live/smart-document-management-overview-04-b87a1e.png` (2020-02) - Manage Documents list, Filter dropdown highlighted; annotations: red box around Filter dropdown; reproduce: Manage Documents > Filter dropdown (top left)
- `live/smart-document-management-overview-05-0e782b.png` (2020-02) - Manage Documents search bar highlighted; annotations: red box around 'Search for a document' field; reproduce: Manage Documents > search bar
- `live/smart-document-management-overview-06-d41e55.png` (2020-02) - Manage Documents - Actions dropdown open (Get Batch Documents / Export Document Records / Download All Files); annotations: red arrow to Actions dropdown menu; reproduce: Manage Documents > Actions button
- `live/smart-document-management-overview-07-f3d74b.png` (2020-02) - Manage Documents - Actions dropdown, 'Export Document Records' option highlighted; annotations: red arrow to Export Document Records; reproduce: Manage Documents > Actions > Export Document Records
- `live/smart-document-management-overview-08-145c3a.png` (2020-02) - Manage Documents - Actions dropdown, 'Download All Files' option highlighted; annotations: red arrow to Download All Files; reproduce: Manage Documents > Actions > Download All Files
- `live/smart-document-management-overview-09-6e3d0a.png` (2020-02) - Manage Documents - Trash button highlighted; annotations: red arrow to Trash button; reproduce: Manage Documents > Trash

### PROCESS MANAGEMENT/Workflows/Workflow Approvals.md
- `live/workflow-approvals-01-d37b2a.gif` (2020-03) - Workflow editor canvas - Draft stage with dashed connector to New stage, right panel (Use/Versions/Stage View Order); annotations: none (animated gif); reproduce: Workspace admin > Workflows > open/create a workflow
- `live/workflow-approvals-02-d131dd.png` (2020-03) - Approval list modal - add user to approvers list, 'Create List' button; annotations: red arrow to Create List button; reproduce: Document record > Appoint Approvers > add users > Create List
- `live/workflow-approvals-03-090feb.png` (2020-03) - Document detail (Recent Documents row expanded) - Stage 'Ready For Internal Review' dropdown, Appoint Approvers button; annotations: red arrows to Stage label and Appoint Approvers button; reproduce: Manage Documents > open a document record > Stage dropdown / Appoint Approvers
- `live/workflow-approvals-04-f1c1bd.png` (2020-03) - Document detail with Approval List panel, Approve/Reject buttons; annotations: red arrow to Approve button; reproduce: Document record with pending approval > Approve/Reject panel
- `live/workflow-approvals-05-0d5cd3.png` (2020-07) - Workflow editor diagram - Restart Approvals config panel (Legal & Finance Approval, Executives Approval); annotations: red box around Restart Approvals panel; reproduce: Workflows > edit workflow > Done stage > Restart Approvals settings
- `live/workflow-approvals-06-8050fb.png` (2020-03) - Workflow editor diagram - full stage flow with numbered red arrow pointing to Approval checkmark node; annotations: red arrow labeled '1.' with text 'Click on the Approval'; reproduce: Workflows > edit workflow > click the approval (checkmark) node on the diagram
- `live/workflow-approvals-07-09e31d.png` (2020-03) - Workflow editor - Approval config panel (Name, Approval Type, Approval Process); annotations: red arrow labeled '2.' with text 'Click on the Pen icon'; reproduce: Workflows > edit workflow > approval node > pen icon to rename
- `live/workflow-approvals-08-319376.png` (2021-05) - Workflow editor - full stage diagram with Approvers panel (Project Manager, Choose user, Users/User groups/Properties radio, search 'super', Supervisor); annotations: red box around Approvers panel; red arrow/cursor near approval node; reproduce: Workflows > edit workflow > approval node > Approvers section

### PROCESS MANAGEMENT/Workflows/Workflow Flows.md
- `live/workflow-flows-01-29b919.png` (2020-07) - Workflow editor - full flow diagram (Draft/To Be Reviewed/Managers Confirmation/Ready For Signature/Executed/Expired) with multiple arrows to connector lines; annotations: multiple red arrows pointing at flow connector lines; reproduce: Workflows > edit workflow > flow connectors between stages
- `live/workflow-flows-02-1dc80f.gif` (2020-07) - Workflow editor canvas - empty, single Draft stage with '+' add-stage button (animated); reproduce: Workflows > create new workflow > empty canvas with Draft stage
- `live/workflow-flows-03-36f8a0.png` (2020-07) - Workflow editor - Manual Activation panel (Signing in process / Document was signed / Signing canceled options); annotations: red arrow to dashed flow connector into Expired stage; reproduce: Workflows > edit workflow > click a flow connector > Manual Activation panel
- `live/workflow-flows-04-81f9f4.png` (2020-07) - Workflow editor - Automatic Activation panel; annotations: red box around Automatic Activation panel; red arrow to connector; reproduce: Workflows > edit workflow > flow connector > Automatic Activation panel
- `live/workflow-flows-05-a61433.png` (2020-03) - Workflow editor - Automatic Activation set to 'Signing in process'; annotations: red box + red arrow to activation trigger list; reproduce: Workflows > edit workflow > flow connector > select Automatic Activation trigger
- `live/workflow-flows-06-344bcf.png` (2020-07) - Workflow editor - Automatic Activation 'Document was signed' selected, 'Allow manual activation' checkbox unchecked; annotations: red arrow to 'Allow manual activation' checkbox; reproduce: Workflows > edit workflow > flow connector > Allow manual activation checkbox
- `live/workflow-flows-07-dea0a9.png` (2020-07) - Workflow editor - same panel with Allow manual activation checked, Manual Activation options list shown; annotations: red arrow to Manual Activation options list; reproduce: Workflows > edit workflow > flow connector > Manual Activation options
- `live/workflow-flows-08-5f66d3.png` (2020-07) - Workflow diagram close-up - approval node with arrows to reject (red) and approve (green) connector lines; annotations: two red arrows pointing to reject/approve connector paths; reproduce: Workflows > edit workflow > approval node > outgoing connectors
- `live/workflow-flows-09-ade452.png` (2020-07) - Full workflow diagram with Approval Result panel (Approval Accepted / Activate automatically when approved); annotations: red arrow to connector line; reproduce: Workflows > edit workflow > approval connector > Approval Result panel
- `live/workflow-flows-10-0c7057.png` (2020-07) - Same diagram, Approval Result = Approval Rejected / Activate automatically when rejected; annotations: red arrow to connector line; reproduce: Workflows > edit workflow > approval connector > Approval Result (Rejected) panel

### PROCESS MANAGEMENT/Workflows/Workflow Overview.md
- `live/workflow-overview-01-596d9b.png` (2020-03) - Document list widget - Status dropdown expanded showing all workflow stages (Draft, Ready For Internal Review, Ready For Client Review, To Be Executed, Signed, To Be Terminated, Terminated); reproduce: Recent Documents widget / Manage Documents row > Status dropdown
- `live/workflow-overview-02-5e29e8.png` (2020-03) - Document editor footer - seal option and Status dropdown (Draft/Ready for signature/Signed/Terminated), Owner/Share/Actions/Save bar; annotations: red box around Status dropdown options; reproduce: Document editor (Smart Document) > bottom toolbar > Status dropdown
- `live/workflow-overview-03-1b11cd.gif` (2020-03) - Dashboard - Recent Documents table plus Template Suite tiles (Contractor Agreement, Loan Agreement, Power of Attorney) and 'New Template Suite' tile, old top menu; annotations: none (animated gif); reproduce: Top nav > Dashboard
- `live/workflow-overview-04-3ebc77.png` (2020-03) - Workspace admin - Workflows list (Workflow, Workflow 2 rows), Create Workflow button, row actions (Set As Default/Edit/Delete); annotations: red boxes around Create Workflow button and Set As Default/Edit/Delete row actions; reproduce: Workspace admin > Workflows (list view)
- `live/workflow-overview-05-d0d189.png` (2020-03) - Workflow editor - empty canvas with a single Draft stage, Add Stage button, right panel (Use: Smart Documents/External Document Records/Both, Versions, Stage View Order); reproduce: Workflows > open/create workflow > empty canvas
- `live/workflow-overview-06-2f2eea.png` (2020-03) - Workflow editor - full stage diagram (Draft/Ready For Internal Review/Changes Requested/Ready For Client Review/To Be Executed/Signed/To Be Terminated/Terminated) with Approval config panel (Approval Type, Approval Process, List, Options); annotations: 3 numbered red arrows (1,2,3) to Draft stage, a connector, and the approval node; reproduce: Workflows > edit workflow > full stage diagram with an approval node selected
- `live/workflow-overview-07-ecc608.png` (2020-03) - Workflow editor - Publish button plus right panel close-up (Add Stage, Use: Smart Documents, Versions field, Stage View Order); annotations: 3 numbered red arrows to Add Stage/Use radio/Versions/Stage View Order area; reproduce: Workflows > edit workflow > top-right controls (Add Stage, Use, Versions, Stage View Order)
- `live/workflow-overview-08-584129.jpg` (2022-05) - Workspace admin - Workflows list with legacy left sidebar (Account/Notification Details/Workflows/Navigation/Branding/Footer/Announcements/Security), 'Create Workflow' modal open with Type dropdown (Any/Any Document Records/Legito Templates/External Document Record/Object Records); annotations: red arrow pointing to 'Object Records' option in Type dropdown; reproduce: Workspace admin > Workflows > Create Workflow > Type dropdown
- `live/workflow-overview-09-43101b.jpg` (2022-05) - 'Edit custom object' modal - Name field, Show Workflow checkbox, Workflows multi-select (Object Test Workflow chip); reproduce: Workspace admin > Objects > edit a custom object > Show Workflow / Workflows field

### PROCESS MANAGEMENT/Workflows/Workflow Stages.md
- `live/workflow-stages-01-b2633c.png` (2020-03) - Document editor footer - Status dropdown expanded (Draft/Review/Finalize/Execute), Owner/Share/Actions/Save bar; annotations: red arrow to status dropdown list; reproduce: Document editor > bottom bar > Status dropdown (custom workflow stages)
- `live/workflow-stages-02-ec678f.png` (2020-03) - Manage Documents list - Stage column showing status pills (Ready for signature/Signed/Draft/Terminated), old top menu; annotations: red box around Stage column; reproduce: Manage Documents > Stage column
- `live/workflow-stages-03-4f3a47.png` (2020-03) - Workflow editor - Stage Color picker panel (Global Colors palette, Your Colors, Properties: Send deadline reminders / Lock document editing); reproduce: Workflows > edit workflow > click a stage > Stage Color panel
- `live/workflow-stages-08-15f6d2.png` (2020-03) - Workflow editor canvas fragment - 'Draft' stage pill with '+' add-stage button below it; annotations: red arrow pointing at the '+' button; reproduce: Workflows > edit workflow > Draft stage > '+' add next stage
- `live/workflow-stages-09-fc7a5e.png` (2020-03) - Workflow editor canvas fragment - 'Draft' stage connected by dashed arrow to 'New Stage'; annotations: red arrow pointing at the dashed connector; reproduce: Workflows > edit workflow > Draft -> New Stage connector
- `live/workflow-stages-10-d59dab.png` (2021-03) - Workflow editor - full 'Contract Life-cycle' diagram with Properties panel (Download documents/Email documents/Mandatory track changes/Lock document editing/Start signing/Share with users/Share with guests/Send deadline reminders); annotations: orange arrow to Properties panel; red box around Properties checkboxes; reproduce: Workflows > edit 'Contract Life-cycle' workflow > select a stage > Properties panel
- `live/workflow-stages-11-064c7c.png` (2020-07) - Isolated crop - black 'Draft' stage pill (with play/pen/mute icons) beside Properties panel (Send deadline reminders/Lock document editing/Start signing checked); reproduce: Workflows > edit workflow > Draft stage > Properties panel

### TEMPLATE AUTOMATION/Clause Library/Clause Library Overview.md
- `live/clause-library-overview-01-4eb924.png` (2022-09) - Legito top nav (Dashboard/Templates/Manage Documents/People/Analytics/Manage Signings/Clause Library) with avatar icon; Clause Library grid (Final Provisions/Pricing/Vendor Identification/Standard Indemnity clause tiles) plus New Clause tile; annotations: red arrow to Clause Library tab; reproduce: Top nav > Clause Library
- `live/clause-library-overview-02-270697.png` (2022-09) - Workspace admin left sidebar (Security/Objects/Templates & Documents section: Advanced Layout Design/Styles/Numbering/Templates & Docs Grouping) with Template categories / Clause Library categories panel (Category Name input + Add New Category button); annotations: red arrow to 'Templates & Docs Grouping' sidebar item; red box around Clause Library categories panel; reproduce: Workspace admin > Templates & Documents > Templates & Docs Grouping > Clause Library categories
- `live/clause-library-overview-03-06ea4b.png` (2022-09) - Clause Library grid - 'Final Provisions' clause tile with Edit dropdown expanded (Test / Properties / Delete), 'New Clause' tile alongside; annotations: red arrow to Properties menu item; reproduce: Clause Library > a clause tile > Edit dropdown
- `live/clause-library-overview-04-9c9487.png` (2022-09) - Template Editor (pre-2026 design) - dark toolbar (Undo/Redo/Save/Publish/Test, template name, Find in Template), left icon rail (Clauses & Elements/Conditions & Repeats/Library/Versions/Template/Editor Settings/Translate), document body with a Clause-Library-managed clause showing 'managed via Clause Library' overlay; annotations: yellow system-name callout tag; red arrow pointing right at clause body; reproduce: Template Editor > Library icon (left rail) > insert/view a Clause Library clause in a template
- `live/clause-library-overview-05-328ad9.png` (2022-09) - 'Invite a User to Legito' modal - user permissions checkbox grid, 'Can access Clause Library' checkbox highlighted; annotations: red box around 'Can access Clause Library' checkbox; reproduce: People > Invite User > User Permissions > Can access Clause Library
- `live/clause-library-overview-06-544f48.png` (2022-09) - 'Invite a User to Legito' modal - Clause Library access scope radios (entire Clauses Library / following Clauses only; Categories all/following only; Countries all/following only); reproduce: People > Invite User > Clause Library access scope options
- `live/clause-library-overview-07-cd4ef7.png` (2022-09) - Template Editor (pre-2026 design) - dark toolbar, left icon rail, clause library panel (Final Provisions/Pricing/Vendor Identification/Standard Indemnity clauses), document body with numbered clause structure and yellow system-name tag; annotations: yellow system-name callout; red arrow pointing to clause list panel; reproduce: Template Editor > Library icon > browse Clause Library clauses list

### TEMPLATE AUTOMATION/Clause Library/Specifics of Logical Dependencies.md
- `live/specifics-of-logical-dependencies-01-5c08ab.png` (2022-09) - Small dialog - 'Inserted Clause Library Clause with different language' warning list (item 1, 1.1) with red X mark and Save button; annotations: red box around the clause list; large red X mark; reproduce: Template Editor > Clause Library clause with language mismatch warning
- `live/specifics-of-logical-dependencies-02-25ff8a.png` (2024-02) - Template Editor (pre-2026 design) - Clause Library Clause Conditions tab, condition rule 'Add selected paragraph to the document if: any Template Suite Content with system name indemnification is present', dark toolbar (Publish/Test/Conditions/Default Values/Repeat/Tags/Properties/Help/Design); annotations: red underline under the condition rule text; reproduce: Template Editor > Clause Library clause > Conditions tab
- `live/specifics-of-logical-dependencies-03-76c4de.png` (2024-02) - Template Editor (pre-2026 design) - Clause Library Clause editing mode with green 'Clause Library Clause' toolbar label, Popular/Full List clause panel, Conditions tab with 'repeated-content' dropdown showing repeat-position operators (is first/is second/is last/etc.); annotations: red box around 'any Template Suite Content' filter and repeat-position dropdown; green highlighted toolbar label 'Clause Library Clause'; reproduce: Template Editor > open a Clause Library clause > Conditions tab > Repeated content operator dropdown

### TEMPLATE AUTOMATION/Scripts/Documentation.md
- `live/documentation-01-19dd10.png` (2020-03) - Template Editor > plain left element panel (Clauses/Elements list) with Text Input/output fields on canvas; annotations: red box around Text Input field placeholder, blue box around Text/Text Input buttons in left panel; reproduce: Template Editor > drag a Text Input element onto the document, add a second Text element bound via tag to display its value
- `live/documentation-02-b790a5.png` (2020-03) - Template Editor > element settings bar, Tags tab with a tag added and suggested tags list; annotations: red arrows pointing to the tag chip and the Tags tab; reproduce: Template Editor > select a Text Input element > Tags tab > add tag e.g. inputField1
- `live/documentation-03-d20729.png` (2020-03) - Template Tags & Scripts > tag rows with 'Edit scripts' buttons; reproduce: Template Tags & Scripts page > tag list with Edit scripts action for a tag
- `live/documentation-05-52cbb4.png` (2020-03) - IDE Debugger > 'Last revision runs' table for a tag script; reproduce: Template Tags & Scripts > select a tag > IDE > Debugger tab > Last revision runs table
- `live/documentation-06-3b4e6a.png` (2020-03) - IDE Debugger > expanded run log tree inspecting a MarkupElement's methods; annotations: red arrow pointing to getValue() result; reproduce: Debugger > Debugger run logs > expand a log instance to inspect element Methods (getValue, isVisible, etc.)
- `live/documentation-07-3bc265.png` (2020-03) - Templates > Template Suite view showing template cards with Edit buttons; reproduce: Templates > open a Template Suite > template cards row with Edit buttons
- `live/documentation-08-1df023.png` (2020-03) - My Account > API Keys tab, token list with Create/Disable/Delete actions; annotations: red arrow pointing to 'Create token'; reproduce: My account > API Keys tab > Generate API Keys / manage tokens

### TEMPLATE AUTOMATION/Scripts/Script Administration.md
- `live/script-administration-01-1f2760.png` (2022-11) - Template Tags & Scripts page > tag search + list with Edit scripts buttons; reproduce: Workspace settings > Developers > Template Tags & Scripts, tag list view
- `live/script-administration-02-89a4eb.png` (2020-03) - Workspace settings sidebar (Developers > Template Tags & Scripts) with classic top nav; annotations: red arrows pointing to sidebar 'Template Tags & Scripts' item and an 'Edit scripts' row; reproduce: Account/Workspace settings > left sidebar > Developers section > Template Tags & Scripts

### TEMPLATE AUTOMATION/Scripts/Script Editor.md
- `live/script-editor-01-6e338a.png` (2020-03) - Script Editor showing a script revision's JS code and revision metadata, classic top nav; reproduce: Template Tags & Scripts > tag > Edit scripts > Script Editor with code panel + revision info

### TEMPLATE AUTOMATION/Template Administration/Template Settings/Assigned Advanced Layout Design.md
- `live/assigned-advanced-layout-design-01-fc406c.png` (2020-03) - Template settings > Advanced Layout Design dropdown for a template (English); annotations: red box around 'No Advanced Layout Design' dropdown and its option list; reproduce: Template Suite Settings panel > per-language Advanced Layout Design dropdown
- `live/assigned-advanced-layout-design-02-42b6ce.png` (2020-03) - Template Suite Settings panel > per-language Advanced Style dropdowns, classic top nav; annotations: red arrow pointing to the English-UK Advanced Style section; reproduce: Templates > Template Suite > Settings panel > Advanced Style per language (English-UK/US)
- `live/assigned-advanced-layout-design-03-1bae4a.png` (2020-03) - Template Suite Settings panel > Advanced Layout Design, Type radios, Export formats; annotations: red arrow pointing to Export formats section; reproduce: Template Suite Settings panel > Advanced Layout Design + Type (Document/Form/Table) + Export formats

### TEMPLATE AUTOMATION/Template Administration/Template Settings/Export Format Restrictions.md
- `live/export-format-restrictions-01-bd3dd8.png` (2022-11) - Template Suite Settings panel > Export formats dropdown highlighted; annotations: red box around Export formats section, red arrow; reproduce: Template Suite Settings panel > Export formats dropdown ('All supported formats')

### TEMPLATE AUTOMATION/Template Administration/Template Settings/Properties.md
- `live/properties-01-5df606.png` (2020-03) - Template Suite Settings panel > Properties checkboxes (Hidden, No export, Internal Document, Legacy table spacing); annotations: red box around Properties checkbox group, red arrows to/from Settings link; reproduce: Template Suite Settings panel > Properties section checkboxes

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Assigned Workflow.md
- `live/assigned-workflow-01-93bfc2.png` (2020-03) - Template Suite Settings panel > Assigned Workflow dropdown open; annotations: red box around Assigned Workflow dropdown/options, red arrow; reproduce: Template Suite Settings panel > Assigned Workflow dropdown

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Country - Region.md
- `live/country-region-01-bd1c62.png` (2020-03) - New Template Suite modal > Country/Region dropdown; annotations: red arrow pointing to Country/Region field; reproduce: Templates > New Template Suite modal > Country/Region field
- `live/country-region-02-766505.png` (2020-03) - Template Suite Settings panel > Country and Language fields at bottom; annotations: red arrow pointing to Country field; reproduce: Template Suite Settings panel > Country / Language fields
- `live/country-region-03-1d26d8.png` (2020-03) - Change Assigned Country/Region modal, radio list of countries; reproduce: Template Suite Settings panel > Country edit pencil > country/region radio-list modal
- `live/country-region-04-7aa712.png` (2020-03) - Templates dashboard > 'Show Templates by' country filter, classic top nav; annotations: red arrow pointing to United States country filter chip; reproduce: Templates dashboard > 'Show Templates by <country>' filter dropdown

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Description.md
- `live/description-01-bb4315.png` (2020-03) - Templates dashboard showing a template card with Edit/Create; reproduce: Templates dashboard > template card list, filtered by country
- `live/description-02-67e22c.png` (2020-03) - Template Suite Settings panel > Description field; annotations: red arrow pointing to Description field; reproduce: Template Suite Settings panel > Description field edit pencil
- `live/description-03-8e228b.png` (2020-03) - Edit description modal, textarea + Save Changes; reproduce: Template Suite Settings panel > Description > Edit modal

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Document Menu Bar Options.md
- `live/document-menu-bar-options-01-3bd221.png` (2021-10) - Template Suite Settings panel > Document Menu Bar Options section (checkbox + default tab dropdowns); annotations: red box around Document Menu Bar Options section; reproduce: Template Suite Settings panel > Document Menu Bar Options (Show Document Menu Bar, First Draft/Reviewing Default Tab)
- `live/document-menu-bar-options-02-c87697.png` (2024-02) - Document Editor top menu bar (old editor) with View/Review/Languages/Instructions/Import/Batch Generation/Record Properties tabs; reproduce: Document Editor (old, pre Next-Gen) > top menu bar tab row
- `live/document-menu-bar-options-03-d93228.png` (2024-02) - Document Editor > View tab active, Modifiable Fields Only / Apply conditions toggles; reproduce: Document Editor > View tab > Modifiable Fields Only / Apply conditions toggle row
- `live/document-menu-bar-options-04-4c17f6.png` (2024-02) - Document Editor > Review tab active, Track Changes toolbar; reproduce: Document Editor > Review tab > Track Changes / Consequential Changes / Accept-Reject all / Reviewers / version compare row
- `live/document-menu-bar-options-05-2b5a15.png` (2024-02) - Document Editor > Languages tab active; reproduce: Document Editor > Languages tab > Language / Second language row
- `live/document-menu-bar-options-06-935b1c.png` (2024-02) - Document Editor > Instructions tab active; reproduce: Document Editor > Instructions tab
- `live/document-menu-bar-options-07-6ed244.png` (2024-02) - Document Editor > Approval List tab active with approver chips; reproduce: Document Editor > Approval List tab (workflow approver chips)

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Instructions.md
- `live/instructions-01-8788d9.png` (2020-03) - Template Suite Settings panel > Instructions section, Add Initial/Add Follow-up, classic top nav; reproduce: Template Suite Settings panel > Instructions > Add Initial / Add Follow-up buttons
- `live/instructions-02-4d409f.png` (2020-03) - Edit instructions modal with old rich-text toolbar and 'Pop-up these instructions' dropdown; reproduce: Template Suite Settings panel > Instructions > Add/Edit Initial Instruction modal with rich text editor and pop-up trigger dropdown
- `live/instructions-03-41d05c.png` (2020-03) - Document Editor > Instructions pop-up overlay shown on document open (blurred background); reproduce: Document Editor > Instructions pop-up shown to user per template's 'Pop-up these instructions' setting
- `live/instructions-04-29c495.png` (2020-03) - Document Editor > Instructions tab showing instructions text/table above document content; reproduce: Document Editor > Instructions tab > instructions panel above the document view
- `live/instructions-05-1b114a.png` (2020-03) - Template Suite Settings panel > Instructions section, Add Follow-up highlighted, classic top nav; annotations: red arrow pointing to Add Follow-up button; reproduce: Template Suite Settings panel > Instructions > Add Follow-up button

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Language.md
- `live/language-01-d5ab6f.png` (2020-03) - New Template Suite modal > Language dropdown; annotations: red box around Language field; reproduce: Templates > New Template Suite modal > Language field
- `live/language-02-d690ca.png` (2020-03) - Template Suite Settings panel > Language field; annotations: red arrow pointing to Language field; reproduce: Template Suite Settings panel > Language field (next to Country)

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Search Keywords.md
- `live/search-keywords-01-ebfaf8.png` (2020-03) - Template Suite Settings panel > Search Keywords field with values; annotations: red arrow pointing to Search Keywords field; reproduce: Template Suite Settings panel > Search Keywords field
- `live/search-keywords-02-c01156.png` (2020-03) - Edit search keywords modal, comma-separated keyword list; reproduce: Template Suite Settings panel > Search Keywords > Edit modal
- `live/search-keywords-03-e3650f.png` (2020-03) - Templates dashboard > 'Search for a template' bar, classic top nav; annotations: red arrow pointing to search bar; reproduce: Templates dashboard > Search for a template bar
- `live/search-keywords-04-fe230d.png` (2020-03) - Dashboard page > Recent Documents table + Templates search bar, classic top nav; annotations: red arrow pointing to Templates search bar; reproduce: Dashboard > Templates search bar below Recent Documents section

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Template Categories.md
- `live/template-categories-01-226842.png` (2020-03) - Template Suite Settings panel > Template Categories dropdown; annotations: red arrow pointing to Template Categories dropdown; reproduce: Template Suite Settings panel > Template Categories dropdown
- `live/template-categories-02-3f8fc7.png` (2020-03) - Dashboard > template category filter chips (Demo/Contracts/Corporate/Disputes/HR/Presentation/Other) with country list; annotations: red box around category filter chips and country list; reproduce: Dashboard > template category filter chips + 'Show Templates by' country list

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Template Suite Layout.md
- `live/template-suite-layout-02-be87be.png` (2024-02) - Document Editor > Single layout, form fields (Director #1-3, toggles) above document content; reproduce: Document Editor > View tab > Single Template Suite Layout form fields above document content
- `live/template-suite-layout-03-c8e142.png` (2024-02) - Document Editor > Dual layout, form panel beside document content, Review tab active; reproduce: Document Editor > Review tab > Dual Template Suite Layout, form panel beside document
- `live/template-suite-layout-04-2db2c5.png` (2024-02) - Template Suite Settings panel > Template Suite Layout dropdown (Single/Dual options open); annotations: red box around Template Suite Layout dropdown and its Single/Dual options; reproduce: Template Suite Settings panel > Template Suite Layout dropdown

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Template Suite Properties.md
- `live/template-suite-properties-01-861452.png` (2024-02) - Rendered document showing Template Suite Name as header plus a document-type radio choice; annotations: red arrow pointing to the 'Agreements' header; reproduce: Enable 'Show Template Suite Name' > document preview shows suite name as header above the selected template's title
- `live/template-suite-properties-02-f91fe9.png` (2024-02) - Document Editor > Review tab, Upload Attachments panel; annotations: red arrow pointing to Choose File / drop zone; reproduce: Document Editor > Review tab > Upload Attachments panel (Choose File or drop document)
- `live/template-suite-properties-03-c31a3c.png` (2024-02) - Download modal > 'Combine all PDFs into one file' toggle and Merge PDF File Name field, per-document format icons; annotations: red box around 'Combine all PDFs into one file' toggle and file name field; reproduce: Document > Download modal > Combine all PDFs into one file toggle + PDF/Word icons per document
- `live/template-suite-properties-04-62ee96.png` (2021-10) - Template Suite Settings panel > Properties, 'Combine all PDFs into one file by default' checkbox; annotations: red arrow pointing to 'Combine all PDFs into one file by default' checkbox; reproduce: Template Suite Settings panel > Properties > Combine all PDFs into one file by default

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Template Suite Versions.md
- `live/template-suite-versions-01-67c684.png` (2020-08) - Template Suite Settings panel > 'Template Suite Versions' button; annotations: red arrow pointing to Template Suite Versions button; reproduce: Template Suite Settings panel > Template Suite Versions button
- `live/template-suite-versions-02-e229be.png` (2020-08) - Template Suite Versions modal > version list with Make Available links; reproduce: Template Suite Versions modal > Created/Template & Versions/Availability/Name table
- `live/template-suite-versions-03-562af6.png` (2020-08) - Template Suite Versions modal > Create Custom Template Suite Version form expanded; annotations: red box around the Create Custom Template Suite Version form; reproduce: Template Suite Versions modal > Create Custom Template Suite Version > name + per-template version pickers

### TEMPLATE AUTOMATION/Template Automation Overview.md
- `live/template-automation-overview-01-4f1085.png` (2020-03) - Templates page > list of Template Suites with Edit/Create buttons, classic top nav; reproduce: Templates page > grid of Template Suite cards with Create buttons
- `live/template-automation-overview-02-dbc351.png` (2020-03) - Dashboard > Templates carousel section (Filter/Show all), extended classic top nav; annotations: red arrows pointing to Dashboard nav tab and the Templates section label; reproduce: Dashboard > Templates carousel row with Filter / Show all controls
- `live/template-automation-overview-03-3fcd43.png` (2020-03) - Template Suite page listing templates (Fee Calculation, Loan Agreement, Delivery Note) with template settings side panel; annotations: red box around breadcrumb, red box around template cards, red box around settings panel; reproduce: Templates > open a Template Suite > Templates list + right-side Template Settings panel
- `live/template-automation-overview-04-b46bd4.png` (2020-03) - Clause Library page showing a clause card (Confidentiality) with old horizontal top navigation menu; annotations: red triangle pointing at top nav; reproduce: top nav > Clause Library
- `live/template-automation-overview-05-c57b25.png` (2020-03) - Template settings panel (Advanced Layout Design, Type, Properties, Export formats, Sign with); annotations: red arrow from Settings button to settings panel, red box around settings panel and Settings button; reproduce: Templates > open Template Suite > template card > Settings

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Currency-in-money.md
- `live/condition-to-currency-in-money-01-532913.png` (2020-03) - Condition builder element-type dropdown showing Currency-in-Money option; annotations: red box and red arrow pointing to Currency-in-Money option; reproduce: Template Editor > select an Article > Conditions tab > Add condition > element type dropdown
- `live/condition-to-currency-in-money-02-d106b0.png` (2020-03) - Condition builder operator dropdown for a Currency-in-Money element; annotations: red box around operator dropdown; reproduce: Template Editor > Conditions tab > Currency-in-Money condition > operator dropdown

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Date.md
- `live/condition-to-date-01-7cc7ed.jpg` (2020-10) - Very old condition editor (Learn tab) building a Date 'is before' condition; reproduce: Template Editor > Conditions tab > Date condition > operator dropdown

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Days-in-date.md
- `live/condition-to-days-in-date-01-605320.png` (2020-03) - Old condition editor (Learn tab) element-type dropdown showing Day/Month/Year-in-date options; annotations: red arrow pointing to element type list; reproduce: Template Editor > Conditions tab > Add condition > element type dropdown (Day in date)
- `live/condition-to-days-in-date-02-349b73.png` (2020-03) - Old condition editor (Learn tab) Day-in-date operator dropdown (numeric/generic/text operators); annotations: red box around operator dropdown; reproduce: Template Editor > Conditions tab > Day in date condition > operator dropdown
- `live/condition-to-days-in-date-03-26a5b7.png` (2020-03) - Old condition editor (Learn tab) completed Day-in-date condition bar; annotations: red box around the condition statement bar; reproduce: Template Editor > Conditions tab > completed Day in date condition

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To JSON Object.md
- `live/condition-to-json-object-01-a1e3a7.png` (2022-09) - Template Editor with left icon rail and dark header building a JSON Object condition operator dropdown; annotations: red box under 'JSON Object', red bar under operator dropdown; reproduce: Template Editor > Conditions tab > JSON Object condition > operator dropdown

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Questions.md
- `live/condition-to-questions-01-161919.png` (2020-03) - Condition builder element-type dropdown (Question, Clause, Text, Text Input, Select, Calculation, Switcher, Button); annotations: red box and red arrow pointing to element type dropdown; reproduce: Template Editor > Conditions tab > Add condition > element type dropdown
- `live/condition-to-questions-02-311df9.png` (2020-03) - Condition builder operator dropdown for a Question element; annotations: red arrow and red box around operator dropdown; reproduce: Template Editor > Conditions tab > Question condition > operator dropdown
- `live/condition-to-questions-03-088a78.png` (2020-03) - Question element Properties tab (Multiple Choice, Select first option, Sort options); annotations: red triangle pointing to 'Select first option' checkbox; reproduce: Template Editor > select a Question element > Properties tab
- `live/condition-to-questions-04-140490.png` (2020-03) - Condition builder Conditions tab, 'Create condition' button and structured question/answer article; annotations: red box around Conditions tab, red arrows to Edit control and Create condition button, numbered 1-3; reproduce: Template Editor > select an Article/Subparagraph > Conditions tab > Create condition
- `live/condition-to-questions-05-250d07.png` (2020-03) - Condition builder completed condition statement bar for a Question element; annotations: red underline under condition statement bar, red arrow to Edit; reproduce: Template Editor > Conditions tab > completed Question condition

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Select Elements.md
- `live/condition-to-select-elements-01-6b6820.png` (2020-03) - Condition builder element-type dropdown, Select element highlighted; annotations: red underline under condition bar, red arrow pointing to Select in dropdown; reproduce: Template Editor > Conditions tab > Add condition > element type dropdown > Select
- `live/condition-to-select-elements-02-58f3bf.png` (2020-03) - Condition builder operator dropdown for a Select element; annotations: red box and red underline around operator dropdown; reproduce: Template Editor > Conditions tab > Select condition > operator dropdown
- `live/condition-to-select-elements-03-75ecfc.png` (2020-03) - Condition builder, 'has selected option that is empty' operator highlighted; annotations: red arrow and red underline pointing at condition bar; reproduce: Template Editor > Conditions tab > Select condition > 'has selected option that is empty'

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Switcher.md
- `live/condition-to-switcher-01-37e7dd.png` (2021-07) - Template Editor dark header, Switcher condition ('is Turned off'); annotations: red bars under 'Switcher' and 'Turned off'; reproduce: Template Editor > Conditions tab > Switcher condition

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Text Inputs.md
- `live/condition-to-text-inputs-01-ffdc97.png` (2020-03) - Condition builder element-type dropdown, Text Input highlighted, for a Letter of Intent template; annotations: red box and red arrow pointing to Text Input in dropdown; reproduce: Template Editor > Conditions tab > Add condition > element type dropdown > Text Input
- `live/condition-to-text-inputs-02-939000.png` (2020-03) - Text Input element Properties tab (Numbers Only, 2nd Language, Allow for repeat, Insert Footnote/Endnote); annotations: red arrows pointing to checkboxes and inline field; reproduce: Template Editor > select a Text Input element > Properties tab
- `live/condition-to-text-inputs-03-d6984b.png` (2020-03) - Condition builder 'is empty' condition for a Text Input element, Modifiable Fields Only / Apply conditions toggles; reproduce: Template Editor > Conditions tab > Text Input 'is empty' condition
- `live/condition-to-text-inputs-04-74c1ed.png` (2020-03) - Condition builder 'is not empty' condition for a Text Input element; reproduce: Template Editor > Conditions tab > Text Input 'is not empty' condition

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Text.md
- `live/condition-to-text-01-75364b.png` (2024-03) - Template Editor dark header, Conditions tab, Text element operator dropdown (is present / is not present / Has been modified / Hasn't been modified); annotations: red box around 'Text' dropdown and operator dropdown; reproduce: Template Editor > Conditions tab > Text condition > operator dropdown

### TEMPLATE AUTOMATION/Template Editor/Conditions/Conditions Overview.md
- `live/conditions-overview-01-bef5ea.png` (2020-04) - Condition builder element-type dropdown listing all condition types; annotations: red box and red arrow pointing to element type dropdown; reproduce: Template Editor > Conditions tab > Add condition > element type dropdown
- `live/conditions-overview-02-0bd926.png` (2020-04) - Template Editor with ruler and left icon rail, Document Condition button on Conditions & Repeats panel; annotations: red box and red arrow pointing to Conditions & Repeats icon; reproduce: Template Editor > left rail > Conditions & Repeats > Document Condition

### TEMPLATE AUTOMATION/Template Editor/Default Values & Warnings/Conditional Default Values.md
- `live/conditional-default-values-01-96924d.png` (2024-03) - Template Editor Default Values tab, 'Apply default value' dropdown (Services Provided Once / Ongoing Services); annotations: red boxes and numbered red arrows (1-4) around Edit, Default Values tab, +Default Value, Choose dropdown; reproduce: Template Editor > select a Question element > Default Values tab > + Default Value
- `live/conditional-default-values-02-817f5e.png` (2024-03) - Default Values tab showing an applied default value with Copy / Remove All buttons; annotations: red box and red arrow pointing to Copy button; reproduce: Template Editor > Default Values tab > Copy
- `live/conditional-default-values-03-d3cb9d.png` (2024-03) - Default Values tab, empty state with Paste values button highlighted; annotations: red box and red arrow pointing to Paste values button; reproduce: Template Editor > Default Values tab > Paste values
- `live/conditional-default-values-04-cf9eef.png` (2024-03) - Default Values tab, applied default value 'Yes' with Remove All highlighted; annotations: red box and red arrow pointing to Remove All button; reproduce: Template Editor > Default Values tab > Remove All
- `live/conditional-default-values-05-2aec42.png` (2024-03) - Default Values tab with two conditional default values (ACME Inc. / John Doe) based on an answer; annotations: red arrow pointing to + Default Value button; reproduce: Template Editor > Default Values tab > multiple conditional default values
- `live/conditional-default-values-06-3e7232.png` (2022-12) - Default Values tab, single default value 'ACME Inc.' highlighted, Default Values tab active; annotations: red box around Default Values tab; reproduce: Template Editor > Default Values tab

### TEMPLATE AUTOMATION/Template Editor/Default Values & Warnings/Warnings.md
- `live/warnings-01-37e850.png` (2024-08) - Template Editor Warning tab, warning-type dropdown (notify only / prevent from saving, signing, exporting); annotations: red box around Warning tab and dropdown list; reproduce: Template Editor > select an element > Warning tab > warning type dropdown
- `live/warnings-02-5aa5ac.png` (2024-08) - Template Editor Warning tab, configured warning ('Must be filled!' / prevent from signing) on a Rent clause; annotations: red boxes around the warning bar and the money field; reproduce: Template Editor > Warning tab > configured warning message

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Advanced Layout Design.md
- `live/advanced-layout-design-04-971d04.png` (2021-07) - Template Editor Tags tab, a SigningDate tag applied to a date field with suggested tags; annotations: red arrow pointing to the SigningDate tag; reproduce: Template Editor > select a Date element > Tags tab

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Formatting, Styles & Design Overview.md
- `live/formatting-styles-design-overview-01-ddcc41.png` (2022-08) - Template Editor Design tab, Beginning & End spacing dropdown (Space / No Space / New Line); annotations: red arrow pointing to Beginning & End dropdown, red underlines under 'New Line' options; reproduce: Template Editor > select a paragraph > Design tab > Beginning & End

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Numbering.md
- `live/numbering-02-48b4c8.png` (2021-10) - Template Editor with ruler, right-click context menu on a paragraph showing Numbering submenu with style options; annotations: red boxes around Default List panel, context menu, and numbering style picker; red triangle pointer; reproduce: Template Editor > right-click a paragraph > Numbering > choose a numbering style

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Section Formatting.md
- `live/section-formatting-01-d40dcc.png` (2024-02) - Template Editor Design tab (Section), Margins fields (Left/Right/Top/Bottom, Header/Footer from edge); annotations: red box around margin fields; reproduce: Template Editor > Design tab > Section > Margins
- `live/section-formatting-02-91c870.png` (2022-08) - Template Editor Design tab, Continuous Section clause with Paper type / Columns Settings (Width/Spacing); annotations: red boxes around Continuous Section item and around Columns Settings panel; reproduce: Template Editor > insert Continuous Section > Design tab > Columns Settings

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Styles.md
- `live/styles-01-b12cb3.gif` (2020-03) - Old 'Legito Free Trial' dashboard with Recent Documents table and template cards; annotations: none (animated screen recording); reproduce: Dashboard (after login)
- `live/styles-04-357730.png` (2020-03) - Old Template Editor toolbar (individually boxed buttons, Learn tab), Design tab with Style/Font/Size/Background/Before/After/Align controls; reproduce: Template Editor > select a paragraph > Design tab
- `live/styles-05-3f270d.png` (2020-05) - Template Editor Design tab, text formatting (Bold/Italic/Underline/Strike) and Text/Highlight color picker with global color palette; reproduce: Template Editor > select text > Design tab > Text/Highlight color
- `live/styles-07-1dd759.png` (2021-03) - Template Editor Design tab, Indentation & Spacing dropdown (Left/Right Indentation, Special Indentation, Spacing, Line Spacing); reproduce: Template Editor > select a paragraph > Design tab > Indentation & Spacing
- `live/styles-08-922814.png` (2021-05) - Template Editor Design tab, Clear Formatting button and Word & PDF Export dropdown; annotations: red arrow pointing to Clear Formatting icon; reproduce: Template Editor > Design tab > Clear Formatting

### TEMPLATE AUTOMATION/Template Editor/Import/Import Legito Templates.md
- `live/import-legito-templates-01-75b98c.png` (2020-03) - Template Editor 'Import Automated Template' modal, choosing a Template Suite and Template to import; annotations: red arrows pointing to tab, Template Suite field, Template field, and Import button; reproduce: Template Editor > left rail > Template > Import template > Import Automated Template tab
- `live/import-legito-templates-02-6f6b26.jpg` (2020-03) - Template Editor left icon rail, Template panel with Import template button and Numbering options; annotations: red arrows pointing to Import template button and Template rail icon; reproduce: Template Editor > left rail > Template

### TEMPLATE AUTOMATION/Template Editor/Import/Import from Word.md
- `live/import-from-word-01-44a039.png` (2020-02) - Template Editor 'Import Word document' modal, drop zone and Import Settings checkboxes (Styles/Import numbering/Restart numbering/Save as ALD); annotations: red box around drop zone; reproduce: Template Editor > Import template > Import Word document tab
- `live/import-from-word-02-bb0f93.png` (2020-02) - Template Editor 'Import Word document' modal with a file selected (Loan Agreement Example.docx) and Import Settings; annotations: red box around Import Settings, red arrow pointing to Import button; reproduce: Template Editor > Import template > Import Word document tab > select file > Import

### TEMPLATE AUTOMATION/Template Editor/Structure/Text Input.md
- `live/text-input-03-c3f671.png` (2020-03) - Generated document/record view (Test status pill, Owner, dense horizontal text menu "View Review Import from Sheet Import from Legito Batch Generation Record Properties") with a Text Input field's help-text tooltip; annotations: red box around the field, red arrow to the "Text input help text" tooltip; reproduce: Document Editor (fill-in view) > Text Input field > Help tab tooltip

### TEMPLATE AUTOMATION/Template Types/PDF Template.md
- `live/pdf-template-01-3fc63b.png` (2023-07) - Templates > PDFFF-16 template suite > Choose type dialog (Document/Form/Table/PDF), old horizontal nav visible (Dashboard/Templates/Manage Documents/People/Analytics/Manage Signings/Clause Library); reproduce: Templates > open a Template Suite > add a new template type > Choose type dialog

### TEMPLATE AUTOMATION/Template Types/Template Type Overview.md
- `live/template-type-overview-01-c350c8.png` (2020-03) - Choose type dialog when creating a new template within a Template Suite (Document/Form/Table/PDF); reproduce: Templates > New Template Suite (or existing suite) > Choose type dialog

### WORKSPACE ADMINISTRATION/People & Access/Guests.md
- `live/guests-01-a8c24e.png` (2020-03) - External Guest access page (Sign out header, Guest title, Save action); reproduce: Open a document via an external Guest share link

### WORKSPACE ADMINISTRATION/People & Access/Single Sign-On (SSO).md
- `live/single-sign-on-sso-01-45a57e.png` (2022-07) - Workspace Settings > Developers > SSO > Details tab (Azure Active Directory config: claims mapping, Client Id/Secret, Scope, Tenant); reproduce: Workspace Settings > Developers > SSO > Details

### WORKSPACE ADMINISTRATION/People & Access/User Groups.md
- `live/user-groups-01-ba034f.png` (2020-03) - People > User Groups list, old horizontal nav (Dashboard/Templates/Manage Documents/People/Analytics/Pricing); annotations: red box around the Show/Users/User Groups sidebar; red underline under the People nav item; reproduce: People > User Groups tab
- `live/user-groups-02-de32b6.png` (2020-03) - People > User Groups - Add User Groups button (old nav cropped); annotations: red arrow pointing to the Add User Groups button; reproduce: People > User Groups > Add User Groups
- `live/user-groups-03-129b8f.png` (2020-03) - New User Group modal - group name, user picker, document permission level dropdown; annotations: red arrow pointing to the permission-level dropdown (List Documents option); reproduce: People > User Groups > Add User Groups > New User Group dialog
- `live/user-groups-04-4a07c4.png` (2020-03) - Share dialog - Add Users panel with Users/User Groups toggle, HR group in results; annotations: red arrow pointing to the HR user group result; reproduce: Document record > Share > Add Users > switch to User Groups

### WORKSPACE ADMINISTRATION/People & Access/Users and Permissions.md
- `live/users-and-permissions-01-f3fb58.png` (2020-03) - People > Users list, old horizontal nav visible; annotations: red box around Show/Users/User Groups sidebar; red arrow to the People nav item; reproduce: People > Users tab
- `live/users-and-permissions-02-7c7158.png` (2020-03) - People > Users - Add User button (old nav cropped); annotations: red arrow pointing to the Add User button; reproduce: People > Users > Add User
- `live/users-and-permissions-03-9c5ba3.png` (2020-03) - Invite a user to Legito modal - profile fields and permission checkboxes including Sign with Legito BioSign (deprecated feature), old nav visible in background; reproduce: People > Users > Add User > Invite a user dialog
- `live/users-and-permissions-04-e657a9.png` (2020-07) - Invite a user modal (continued) - remaining permission checkboxes, Auto-Share, Send Invite/Cancel; annotations: red arrow pointing to the Email invite checkbox; reproduce: People > Users > Add User > Invite a user dialog (scrolled)
- `live/users-and-permissions-05-5ee811.png` (2020-03) - People > Users list row with Edit/Delete actions; annotations: red arrow pointing to the Edit button; reproduce: People > Users > user row actions
- `live/users-and-permissions-06-b5e378.png` (2022-08) - Edit User permission checklist including Sign with Legito BioSign (deprecated) and AdobeSign/FlowSign/LegitoSign options; annotations: red box around Create New Template Suites checkbox; reproduce: People > Users > Edit User > permission checklist
- `live/users-and-permissions-07-4cf43c.png` (2022-08) - Edit User - template suite access scope (all/edit-all/selected templates) with per-template toggles; annotations: red arrows pointing to a toggled-off and a toggled-on template checkbox; reproduce: People > Users > Edit User > template suite access section

### WORKSPACE ADMINISTRATION/Personal Settings/Notifications.md
- `live/notifications-01-cfeef1.png` (2020-02) - Top bar notification bell with unread badge, old nav account menu; annotations: red arrow pointing to the notification bell; reproduce: Any page > top-right notification bell
- `live/notifications-02-142265.gif` (2020-02) - Full Dashboard with old horizontal nav (Dashboard/Templates/Manage Documents/People/Analytics/Pricing), Recent Documents table and template cards; reproduce: Dashboard (home page after login)
- `live/notifications-03-4a1a57.png` (2020-02) - Notifications settings - Default Notification Period and per-event Notification Type table (in-app/email settings); annotations: red box around the notification-scope dropdown (My Documents & Shared Documents); reproduce: Personal Settings > Notification Details

### WORKSPACE ADMINISTRATION/Personal Settings/User Account.md
- `live/user-account-01-96b1c2.gif` (2020-02) - Full Dashboard with old horizontal nav, used to illustrate reaching User Account settings; reproduce: Dashboard > My account menu > Settings > Account

### WORKSPACE ADMINISTRATION/Workspace Settings/Announcements.md
- `live/announcements-01-9411a8.png` (2020-02) - My account dropdown menu (Help/Guided Tour/Learning Center/Settings/Change Workspace/Sign out), old nav visible; annotations: red arrow pointing to the Settings menu item; reproduce: Top-right My account dropdown > Settings
- `live/announcements-02-ea410a.png` (2020-02) - Personal Settings sidebar with Announcements item highlighted, old horizontal nav visible above; annotations: red arrow pointing to the Announcements sidebar item; reproduce: Workspace Settings > Announcements

### WORKSPACE ADMINISTRATION/Workspace Settings/Billing.md
- `live/billing-01-e01b25.png` (2021-02) - Billing > Payment Methods table and Subscription summary card with Cancel Subscription; reproduce: Workspace Settings > Billing > Payments tab
- `live/billing-02-c946c4.png` (2021-02) - Billing > Upgrade Subscription table (Additional users, Legito Professional Services) with per-line Upgrade buttons; reproduce: Workspace Settings > Billing > Upgrade Subscription tab

### WORKSPACE ADMINISTRATION/Workspace Settings/Document Localizations.md
- `live/document-localizations-01-e8392e.png` (2020-12) - Personal Settings sidebar with Document Localization item, Time Zone and third-party sign-in panel (Google Calendar/SalesForce/HubSpot/iManage); annotations: red arrow pointing to the Document Localization sidebar item; reproduce: Workspace Settings > Templates & Documents > Document Localization
- `live/document-localizations-02-8d0767.png` (2020-12) - Document Localization > Language Specific tab - per-language Edit/Restore to default table; reproduce: Workspace Settings > Document Localization > Language Specific
- `live/document-localizations-03-0bc2da.png` (2020-08) - Document Localization > Unified Across All Workspace Templates tab - Date/Numerical/Monetary format settings; reproduce: Workspace Settings > Document Localization > Unified Across All Workspace Templates

### WORKSPACE ADMINISTRATION/Workspace Settings/General Workspace Settings.md
- `live/general-workspace-settings-01-2a5a56.png` (2022-07) - Workspace Settings > General page - workspace Name, Signings toggle, and Open items in a new tab checklist; annotations: red box around the Open the following items in a new tab checklist; reproduce: Workspace Settings > Workspace > General

### WORKSPACE ADMINISTRATION/Workspace Settings/Security Settings.md
- `live/security-settings-01-9ff2c3.png` (2020-11) - Workspace Settings > Security - Mandatory Password Character Set and White-listed Workspace IP Addresses; annotations: red box around the password character-set controls; reproduce: Workspace Settings > Workspace > Security
- `live/security-settings-02-6f0f35.png` (2020-11) - Workspace Settings > Security - Add IP Address modal, old horizontal nav and My account menu visible; annotations: red box around the IP input field; red arrows pointing to Save and to the Add IP Address button; reproduce: Workspace Settings > Security > Add IP Address dialog

### WORKSPACE ADMINISTRATION/Workspace Settings/Template & Document Grouping.md
- `live/template-document-grouping-01-32b250.gif` (2020-02) - Workspace Settings > Templates & Docs Grouping page, old horizontal nav visible; reproduce: Workspace Settings > Templates & Documents > Templates & Docs Grouping
- `live/template-document-grouping-02-aa5850.gif` (2020-02) - Templates & Docs Grouping - Countries And Regions multi-select and Categories input; reproduce: Workspace Settings > Templates & Docs Grouping > Countries and Regions / Categories
- `live/template-document-grouping-03-fff8f0.gif` (2020-02) - Templates & Docs Grouping - full page with multiple countries/regions selected and Basic Clauses sidebar section; reproduce: Workspace Settings > Templates & Docs Grouping
- `live/template-document-grouping-04-ff8001.png` (2020-02) - Templates & Docs Grouping - External Document Record Default Summary textbox and Save button; reproduce: Workspace Settings > Templates & Docs Grouping > External Document Record Default Summary

### WORKSPACE ADMINISTRATION/Workspace Settings/Workspace Branding.md
- `live/workspace-branding-01-576584.png` (2020-02) - Workspace Settings > Branding page - Logo upload, Primary/Secondary Color, Set Design, old nav visible; annotations: red arrow pointing to the Branding sidebar item; red box around the Branding panel; reproduce: Workspace Settings > Workspace > Branding
- `live/workspace-branding-02-58881c.png` (2021-06) - Branding page (expanded) - Logo, Primary/Secondary/Highlight colors plus New/Edited/Deleted elements colors; reproduce: Workspace Settings > Branding (full color set)

### WORKSPACE ADMINISTRATION/Workspace Settings/Workspace Footer.md
- `live/workspace-footer-01-3b11f8.gif` (2020-02) - Workspace Settings > Footer builder - blank layout with Add column, old nav visible; reproduce: Workspace Settings > Workspace > Footer
- `live/workspace-footer-02-f0fb78.gif` (2020-02) - Footer builder - three columns with Width and Add content controls, Add row option; reproduce: Workspace Settings > Footer > add columns/rows
- `live/workspace-footer-03-487bbc.gif` (2020-02) - Footer builder - Color scheme dropdown (Dark/Light); annotations: red arrow pointing to the Color scheme dropdown; reproduce: Workspace Settings > Footer > Color scheme
- `live/workspace-footer-04-deb551.png` (2020-02) - Footer column - Width field and Add content button; reproduce: Workspace Settings > Footer > column Width / Add content

### WORKSPACE ADMINISTRATION/Workspace Settings/Workspace Navigation.md
- `live/workspace-navigation-01-512336.png` (2021-07) - Workspace Settings > Navigation page - reorderable list of top-nav items (Dashboard/Templates/Manage Documents/People/Analytics/Vendors/Customers/Clause Library/Case Management), old horizontal nav visible above; reproduce: Workspace Settings > Workspace > Navigation

## CHECK (24)

### DOCUMENT EDITOR/Document Export/Download.md
- `live/download-06-3bd02a.png` (2020-03) - Workflows editor: Assigned Workflow node diagram with Stage Color palette and Properties panel; annotations: red box around 'Download documents' property checkbox; reproduce: Workspace Admin > Workflows > open a workflow > stage Properties panel

### DOCUMENT EDITOR/Document Review/Track Changes.md
- `live/track-changes-08-3d2557.png` (2024-02) - Workflows editor: Training workflow node diagram, Mandatory track changes property checked; annotations: red box around 'To Be Reviewed' stage, red arrow to Mandatory track changes checkbox; reproduce: Workspace Admin > Workflows > open a workflow > stage Properties > Mandatory track changes

### INTEGRATIONS/Integration Tools/Push API (Webhooks).md
- `live/push-api-webhooks-03-a950a1.png` (2023-08) - Create Push Connection modal: Name/URL/Version fields and Custom headers; annotations: red box around Custom headers section; reproduce: Push API > Push Connections > Create > Custom headers section

### PROCESS MANAGEMENT/Workflows/Workflow Stages.md
- `live/workflow-stages-04-59b5ad.png` (2020-03) - Isolated icon crop - white 'play' triangle-in-circle icon (stage-activation icon), no surrounding chrome; reproduce: Fragment of a workflow stage pill's play icon; too small/cropped to confirm current vs legacy styling
- `live/workflow-stages-05-328c9f.png` (2020-03) - Isolated icon crop - pen/edit icon, no surrounding chrome; reproduce: Fragment of a workflow stage pill's edit icon; too small/cropped to confirm current vs legacy styling
- `live/workflow-stages-06-2671b7.png` (2020-03) - Isolated icon crop - muted bell (notifications off) icon, no surrounding chrome; reproduce: Fragment of a workflow stage pill's notification icon; too small/cropped to confirm current vs legacy styling
- `live/workflow-stages-07-599ae9.png` (2020-03) - Isolated icon crop - lock icon, no surrounding chrome; reproduce: Fragment of a workflow stage pill's lock icon; too small/cropped to confirm current vs legacy styling

### TEMPLATE AUTOMATION/Clause Library/Specifics of Logical Dependencies.md
- `live/specifics-of-logical-dependencies-04-6b650c.png` (2024-02) - Template Editor > Repeat tab for a Clause Library element, repeat by number in a Text Input; annotations: red box around 'repeated-content' field name, red arrow pointing to it; reproduce: Template Editor > select a repeated Clause Library element > Repeat tab > 'according to number in Text Input' option; re-verify against live Template Editor post Q1-2026 redesign
- `live/specifics-of-logical-dependencies-05-3bd6a7.png` (2024-02) - Template Editor > Repeat tab, repeat every time user clicks a Button; annotations: red box around 'repeated-content_button' field name, red arrow, pink comment callout; reproduce: Template Editor > select repeated clause > Repeat tab > 'every time user clicks Button' option; re-verify against live Template Editor post Q1-2026 redesign

### TEMPLATE AUTOMATION/Scripts/Documentation.md
- `live/documentation-04-c89311.png` (2020-03) - Rendered document text preview showing a Text Input value mirrored into an output field; reproduce: Preview/Test a document with a tagged Text Input and a script-driven output field; no chrome visible to confirm current vs legacy rendering

### TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To JSON Object.md
- `live/condition-to-json-object-02-0946f3.png` (2022-09) - JSON Integrations mapping page ('Populate Data from the HR software') with Export to templates checkbox; annotations: red arrow pointing to 'Export to templates' checkbox, green underline under it; reproduce: Workspace Settings/Integrations > JSON Integrations > open an integration > map a field > Export to templates

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Advanced Layout Design.md
- `live/advanced-layout-design-01-98bdbe.png` (2020-02) - Workspace Settings > Templates & Documents > Advanced Layout Design list page; annotations: red arrows pointing to Add button and Advanced Layout Design sidebar item; reproduce: Workspace Settings > Templates & Documents > Advanced Layout Design

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Numbering.md
- `live/numbering-01-153a04.png` (2021-10) - Workspace Settings > Templates & Documents > Numbering page, Multi-Level Lists tab with numbering style options; annotations: red arrow pointing to Numbering sidebar item; reproduce: Workspace Settings > Templates & Documents > Numbering

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Styles.md
- `live/styles-02-7c4ac7.png` (2020-03) - Style creation modal (Name, Font, Size, Text/Background Color, Formatting, Alignment, Indentation) over the Styles settings list; annotations: red arrow pointing to Create button; reproduce: Workspace Settings > Templates & Documents > Styles > Create
- `live/styles-03-2fe145.png` (2020-03) - Style modal, Numbering section with numbering pattern picker; annotations: red box around Numbering picker; reproduce: Workspace Settings > Templates & Documents > Styles > Create/Edit > Numbering
- `live/styles-06-5da436.png` (2020-03) - Workspace Settings > Templates & Documents > Styles list page; annotations: red box around the Default For column, red arrow pointing to Create button; reproduce: Workspace Settings > Templates & Documents > Styles

### TEMPLATE AUTOMATION/Template Types/Form Template.md
- `live/form-template-02-e21fe8.png` (2024-02) - Template Editor - element Design toolbar for a Text Input (formatting + Full width toggle); annotations: red arrow pointing to the Full width toggle button; reproduce: Template Editor > select a Text Input element > Design tab toolbar
- `live/form-template-04-e9cbaa.png` (2024-02) - Document record view - Seller Info questionnaire panel plus generated Contractor Agreement document, with Batch Generation/Import from Sheet toolbar; annotations: red box around the left questionnaire panel; reproduce: Open a document record generated from a template with a Form-type questionnaire; top toolbar shows Import from Sheet / Batch Generation / Record Properties

### TEMPLATE AUTOMATION/Template Types/PDF Template.md
- `live/pdf-template-04-2a5ef0.png` (2024-02) - Template Editor - Extraction Keywords panel for a ComboBox-tagged PDF field; reproduce: Template Editor > PDF template > Document Condition > Extraction Keywords for a Combo box field
- `live/pdf-template-05-205d33.png` (2023-07) - Template Editor - Document Condition / Extraction Keywords panel over a PDF template (UCC-style form) with field state labels Empty/Active/With Tag; reproduce: Template Editor > open a PDF template > Conditions > Document Condition > Extraction Keywords

### TEMPLATE AUTOMATION/Template Types/Template Type Overview.md
- `live/template-type-overview-02-001fe1.png` (2020-03) - Document content preview - Choose Payment Option conditional radio group with Payment Conditions and Reimbursement of Expenses clauses; reproduce: Open a generated document containing a payment-option Switcher with conditional clauses
- `live/template-type-overview-03-813607.png` (2020-03) - Document fill preview - Form of Incorporation for California example with company type, incorporator and director questions; reproduce: Fill a Document-type template with nested conditional questions (company type, incorporators, directors)

### WORKSPACE ADMINISTRATION/People & Access/Users and Permissions.md
- `live/users-and-permissions-08-c4a09b.png` (2023-08) - Edit User modal - Custom Data field with Save/Email Invitation/Cancel; annotations: red box around the Custom Data text area; reproduce: People > Users > Edit User > Custom Data field

### WORKSPACE ADMINISTRATION/Workspace Settings/Workspace Localization.md
- `live/workspace-localization-01-1daa0e.png` (2023-09) - Workspace Settings > Localization page - Region, Units (Metric/Imperial), Date format, with renamed sidebar (Personal Settings/Application design/Onboarding); reproduce: Workspace Settings > Workspace > Localization

## OK (135)

### INTEGRATIONS/Integration Tools/JSON Integrations.md
- `live/json-integrations-06-ecb9a7.png` (2024-02) - JSON Integrations: Condition modal for array field mapping (equals/contains rows); reproduce: JSON Integrations editor > array element mapping > Set Condition modal
- `live/json-integrations-07-70e614.png` (2024-02) - JSON Integrations editor: JSON tree (left) with element mapping settings panel (right); reproduce: JSON Integrations editor > open a Data JSON integration > expand array item, open mapping settings panel
- `live/json-integrations-08-ace6f7.png` (2024-02) - JSON Integrations editor with full app top navigation visible (Dashboard/Templates/Manage Documents/People/Analytics/Manage Signings/Clause Library); annotations: red arrow pointing to array Edit button; large red arrow from bottom-right pointing up toward the array row; reproduce: JSON Integrations editor, full-page screenshot showing top navigation bar
- `live/json-integrations-09-bd7f01.png` (2024-02) - JSON Integrations editor: Sort Contents / Sort Order fields highlighted in mapping panel; annotations: red box around Sort Contents/Sort Order section; red arrow pointing to it; reproduce: JSON Integrations editor > array mapping panel > Sort Contents and Sort Order fields
- `live/json-integrations-10-d1607c.png` (2024-02) - JSON Integrations editor: Integration Trigger panel with Template Suites (Set Condition, Add Next Template Suite); annotations: red box around TEMPLATE SUITES label; red arrows pointing to Set Condition and Add Next Template Suite buttons; reproduce: JSON Integrations editor > Integration Trigger settings > Template Suites section

### INTEGRATIONS/Legito in Other Apps/Microsoft SharePoint.md
- `live/microsoft-sharepoint-01-201706.png` (2024-02) - Legito SharePoint add-on: SharePoint Authentication + Legito Authentication config form with side documentation panel; reproduce: SharePoint add-on install flow > Authentication configuration screen

### INTEGRATIONS/Legito in Other Apps/Salesforce.md
- `live/salesforce-08-f63b24.png` (2024-02) - Legito Salesforce-widget setup wizard, step "1. Actions" (upload/link toggles, button labels), shown as modal over Salesforce; reproduce: Salesforce widget settings (gear icon on the Legito widget) > 1. Actions step
- `live/salesforce-09-6cbd91.png` (2024-02) - Legito Salesforce-widget setup wizard, step "2. Authentication" (Legito Server URL, API Key, Private Key, Test connection); reproduce: Salesforce widget settings > 2. Authentication step
- `live/salesforce-11-a5277f.png` (2024-02) - Legito Salesforce-widget setup wizard, step "4. Data Mapping", Simple integration field-mapping table; reproduce: Salesforce widget settings > 4. Data Mapping step > Simple integration mode
- `live/salesforce-12-f2526a.png` (2024-02) - Legito Salesforce-widget setup wizard, step "4. Data Mapping", Complex/JSON integration download+upload steps; reproduce: Salesforce widget settings > 4. Data Mapping step > Complex integration using JSON
- `live/salesforce-17-8ebcfc.png` (2024-02) - Cropped toggle: "Automatically create Push API Connection in Legito" (Advanced settings); reproduce: Salesforce widget settings > 5. Metadata Mapping > Advanced settings toggle
- `live/salesforce-18-00fcef.png` (2024-02) - Push Connections list row "SalesForce - Opportunity" with Active/Edit/Delete buttons; reproduce: Push API > Push Connections tab, single connection row
- `live/salesforce-19-1afd70.png` (2024-02) - Edit Push Connection modal: Name/URL/Version and Custom headers with "use default API user" toggles (clientId, clientSecret, username, password); reproduce: Push API > Push Connections > Edit > Custom headers section
- `live/salesforce-20-bbf396.png` (2024-02) - Legito Salesforce-widget setup wizard, step "5. Metadata Mapping" (Legito Metadata Name -> Salesforce Field Name); reproduce: Salesforce widget settings > 5. Metadata Mapping step

### INTEGRATIONS/Other Apps in Legito/Microsoft Entra ID (Azure AD).md
- `live/microsoft-entra-id-azure-ad-11-9a5546.png` (2023-04) - Legito Workspace Settings: Security > SSO > Details tab (Azure Active Directory config: Client Id, Client Secret, Tenant); annotations: red arrows/boxes pointing to Enabled checkbox, Role Name attribute, Client Id, Client Secret, Tenant fields, and Save button; reproduce: Workspace Settings > Security > SSO > Details tab, type Azure Active Directory
- `live/microsoft-entra-id-azure-ad-12-abd49b.png` (2023-04) - Legito Workspace Settings: Security > SSO > Roles & Permissions tab (Default Role list); annotations: red arrows pointing to Roles & Permissions tab and Create button; reproduce: Workspace Settings > Security > SSO > Roles & Permissions tab
- `live/microsoft-entra-id-azure-ad-13-1717cf.png` (2023-04) - Legito Workspace Settings: Create SSO Role modal (individual authorization checkboxes); annotations: red arrow pointing to Save button; reproduce: Workspace Settings > Security > SSO > Roles & Permissions > Create
- `live/microsoft-entra-id-azure-ad-17-ed5001.png` (2023-04) - Legito Workspace Settings: Security > SSO > Roles & Permissions tab showing custom "My Role" with Edit/Delete/Make as default; annotations: red arrow pointing to Edit button; reproduce: Workspace Settings > Security > SSO > Roles & Permissions tab, custom role row

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Styles.md
- `live/styles-09-7341d1.png` (2023-07) - Workspace Settings > Templates & Documents > Styles list page with Default column and full top navigation; annotations: red box around Default column; reproduce: Workspace Settings > Templates & Documents > Styles
- `live/styles-10-00889b.png` (2023-08) - Workspace Settings > Styles list page, Duplicate button highlighted; annotations: red arrow pointing to Duplicate button; reproduce: Workspace Settings > Templates & Documents > Styles > Duplicate

### TEMPLATE AUTOMATION/Template Editor/Import/Import from Word.md
- `live/import-from-word-04-2c8fcd.jpg` (2020-02) - Legito document view after importing from Word, showing rendered element boxes (Select/Textinput/Date); reproduce: Template Editor > Import from Word > review generated document elements in the content pane

### TEMPLATE AUTOMATION/Template Editor/Repeats/Repeat To Any Content.md
- `live/repeat-to-any-content-01-0abfa4.png` (2024-08) - Template Editor Repeat tab configuring repeat of a Clause Library clause by a template element value; annotations: pink callout box pointing to repeated clause; reproduce: Template Editor > select Clause Library clause > Repeat tab > 'Repeat selected clause library according to value in...'

### TEMPLATE AUTOMATION/Template Editor/Repeats/Repeat To Buttons.md
- `live/repeat-to-buttons-01-dea28d.png` (2024-08) - Template Editor Repeat tab, empty state with Create repeat/Apply recent repeat/Paste repeat buttons; annotations: red arrow pointing to Create repeat button; reproduce: Template Editor > select a subparagraph > Repeat tab (before configuring)
- `live/repeat-to-buttons-02-7827fd.png` (2024-08) - Template Editor Repeat tab, configured repeat triggered by clicking a Button element; annotations: red underline under the repeat condition sentence; reproduce: Template Editor > Repeat tab > 'Repeat selected subparagraph every time user clicks Button...'

### TEMPLATE AUTOMATION/Template Editor/Repeats/Repeat To Text Inputs.md
- `live/repeat-to-text-inputs-01-0acde9.png` (2024-08) - Template Editor Repeat tab, empty state with a suggested repeat based on a Text Input value; annotations: red arrow pointing to Create repeat button; reproduce: Template Editor > select a subparagraph > Repeat tab, with a Text Input suggestion showing
- `live/repeat-to-text-inputs-02-f1fdad.png` (2024-08) - Template Editor Repeat tab, configured repeat according to number entered in a Text Input; annotations: red underline under the repeat condition sentence; reproduce: Template Editor > Repeat tab > 'Repeat selected subparagraph according to number in Text Input...'

### TEMPLATE AUTOMATION/Template Editor/Structure/Button.md
- `live/button-01-9b72fd.png` (2020-03) - Template Editor with left icon rail, Button element selected, Properties tab (Min/Max) and repeat/condition callouts; annotations: red arrows pointing to Add Milestone button and Button element in left rail; pink/yellow/orange callout boxes with condition labels; reproduce: Template Editor > Elements panel > Button element inserted in document > Properties tab

### TEMPLATE AUTOMATION/Template Editor/Structure/Calculation.md
- `live/calculation-01-3e10e4.png` (2020-02) - Template Editor, Calculation element selected showing its top tab menu (Conditions/Repeat/Tags/Properties/Warning/Design) and formula bar; annotations: red box around top tab menu; reproduce: Template Editor > insert Calculation element > element toolbar with formula field
- `live/calculation-02-b4d6e3.png` (2020-02) - Template Editor, Calculation formula bar with tag expression and Calculation element highlighted in left rail; annotations: red box around formula bar, red arrows pointing to a Money field and to Calculation in the elements list; reproduce: Template Editor > Calculation element > formula field showing @tag references

### TEMPLATE AUTOMATION/Template Editor/Structure/Clauses.md
- `live/clauses-01-ede5ec.png` (2020-03) - Template Editor, Clauses & Elements panel Full List showing clause hierarchy (Article/Paragraph/Subparagraph/Point/Item); annotations: red box around clause hierarchy list, red arrow pointing into document; reproduce: Template Editor > Clauses & Elements panel > Full List tab

### TEMPLATE AUTOMATION/Template Editor/Structure/Date.md
- `live/date-01-bce300.png` (2020-03) - Template Editor with left rail, Date element highlighted, repeat/condition callouts on a payment schedule clause; annotations: red arrows pointing to a Date field and to Date element in left rail; pink/orange callout boxes; reproduce: Template Editor > Elements panel > Date element inserted in a repeated payment clause
- `live/date-02-366670.png` (2024-08) - Document generation wizard, Date field open showing calendar picker with 'In Words' toggle; annotations: red box around 'In Words' toggle; reproduce: Wizard/document view > click a Date field > calendar picker with In Words checkbox
- `live/date-03-293bcc.png` (2024-08) - Document generation wizard, Date field with Help tooltip text bubble; annotations: red arrow and box around help tooltip text; reproduce: Wizard/document view > Date field with Help text configured (question mark tooltip)
- `live/date-04-858321.png` (2024-08) - Template Editor, Date element Tags tab with applied tag and suggested tags list; annotations: red box around tags area; reproduce: Template Editor > Date element > Tags tab
- `live/date-05-774da5.png` (2024-08) - Document view, deadline dates summary panel with Deadline Notification toggle and days-in-advance input; annotations: red box around Deadline Notification row, red arrow pointing to Expiration date; reproduce: Document view > document Key Dates panel > Deadline Notification toggle

### TEMPLATE AUTOMATION/Template Editor/Structure/Element Group.md
- `live/element-group-01-3da45e.png` (2021-09) - Template Editor Repeat tab, repeat configured on a markup element (Loan Agreement, Contractual Penalty clause); reproduce: Template Editor > select an Element Group > Repeat tab > 'Repeat selected markup according to number in Text Input...'
- `live/element-group-02-98acd3.png` (2021-09) - Template Editor Conditions tab, condition set on an element ('this-element' is last); reproduce: Template Editor > select an Element Group > Conditions tab > 'Add selected text to the document if...is last'

### TEMPLATE AUTOMATION/Template Editor/Structure/Footnotes and Endnotes.md
- `live/footnotes-and-endnotes-01-038089.png` (2021-08) - Template Editor right-click/selection formatting toolbar with Insert Footnote/Insert Endnote menu open; annotations: red arrows pointing to Insert Footnote and Insert Endnote menu items; reproduce: Template Editor > select text in content > floating formatting toolbar > Insert Footnote/Endnote

### TEMPLATE AUTOMATION/Template Editor/Structure/Header & Footer.md
- `live/header-footer-01-3855a0.png` (2020-03) - Template Editor, empty header area with 'Drag Article here to create header' prompt; annotations: red arrow pointing to header drop zone; reproduce: Template Editor > Design/Structure > page header drop zone at top of document
- `live/header-footer-02-e239ad.png` (2020-03) - Template Editor, empty footer area with 'Drag Article here to create footer' prompt and New Page Section button; annotations: red arrow pointing to footer drop zone; reproduce: Template Editor > Design/Structure > page footer drop zone at bottom of document

### TEMPLATE AUTOMATION/Template Editor/Structure/Image.md
- `live/image-01-4c1e7a.png` (2020-03) - Template Editor with left rail, Image element selected, Properties tab (Width/Height/Image overflow) with signature-block callouts; annotations: red box around Width/Height fields, red arrows pointing to Image element and Upload Image box; orange/pink callout boxes; reproduce: Template Editor > Elements panel > Image element inserted in signature block > Properties tab
- `live/image-02-07700d.png` (2020-03) - Template Editor, Image element Design tab with Layout Options panel and Position/Text Wrapping dialog open; annotations: red arrow pointing to More options button; reproduce: Template Editor > Image element > Design tab > Layout Options > Position dialog

### TEMPLATE AUTOMATION/Template Editor/Structure/Link.md
- `live/link-01-69856c.png` (2020-03) - Template Editor with left rail, Link element configured to a Text Input, signature block with callouts; annotations: red box around Link config bar, red arrows pointing into document and to Link in left rail; orange/pink/yellow callout boxes; reproduce: Template Editor > Elements panel > Link element > Link to Text Input
- `live/link-02-7ff2e9.png` (2024-08) - Template Editor, Link element configured as a Web page link with URL field; annotations: red box around URL field, red arrow pointing to link text in document; reproduce: Template Editor > Link element > Link to Web page > URL address field
- `live/link-03-2bf0e9.png` (2024-08) - Template Editor, Link element configured as Object property link to a Clause Library record field; annotations: red boxes around 'Object property' and property picker dropdown, red underline under Clause Text option; reproduce: Template Editor > Link element > Link to Object property > Clause Library record
- `live/link-04-ac3e86.png` (2024-08) - Template Editor content area, Loan Agreement with Link placeholder fields (Creditor/Debtor address); reproduce: Template Editor > document body showing inline Link placeholders
- `live/link-05-b5c64f.png` (2024-08) - Template Editor content area, signature block with Link element chips (debtor-signature/creditor-signature); annotations: red arrows pointing to Link element chips; reproduce: Template Editor > document body signature section with Link elements
- `live/link-06-a97ffe.png` (2024-08) - Template Editor, Link element configured to a Date element (termination_date) with top tab menu; annotations: red box around top tab menu, red arrow pointing to linked term in document; reproduce: Template Editor > Link element > Link to Date
- `live/link-07-5a46be.png` (2024-08) - Template Editor, Link element Design tab formatting toolbar (Bold/Italic/Underline/Strike/color); annotations: red boxes around Design tab and formatting toolbar, red arrow into document; reproduce: Template Editor > Link element > Design tab
- `live/link-08-6731dc.png` (2024-08) - Template Editor, Link element top menu bar showing the link configuration sentence (Link to Date...); annotations: red box around top config bar and tab menu; reproduce: Template Editor > Link element > top tab/config bar
- `live/link-09-aec7a1.png` (2024-08) - Template Editor content area showing a broken Link element rendered as a red error pill; reproduce: Template Editor > document body with a broken/unresolved Link element (red icon state)
- `live/link-10-c3e2d8.png` (2024-08) - Template Editor, Non-Solicitation clause with clause Edit/Actions toolbar and a Link element inline; annotations: red box around Edit/Actions toolbar, red arrows pointing into clause text; reproduce: Template Editor > clause block > Edit/Actions toolbar with inline Link element
- `live/link-11-370782.png` (2024-08) - Document/Wizard rendered view of a Non-Solicitation clause with a Both Parties/Contractor/Client radio selector; annotations: red arrows pointing to section number and inline link text; reproduce: Wizard/document view > rendered clause with radio question and inline links

### TEMPLATE AUTOMATION/Template Editor/Structure/Money.md
- `live/money-01-b2d708.png` (2020-03) - Template Editor with left rail, Money element highlighted in a Payment clause with condition callout; annotations: red arrows pointing to a Money field and to Money element in left rail; orange/yellow callout boxes; reproduce: Template Editor > Elements panel > Money element inserted in a Payment clause
- `live/money-02-794a94.png` (2020-03) - Template Editor content area, Loan clause with Money field and '+In Words' button; annotations: red arrow pointing to In Words button; reproduce: Template Editor > document body > Money element with In Words option enabled
- `live/money-03-9c15b6.png` (2024-08) - Template Editor, Money element selected showing its top tab menu (Conditions/Default Values/Repeat/Tags/Properties/Warning/Help/Design); annotations: red box around top tab menu; reproduce: Template Editor > Money element > top tab menu
- `live/money-04-2a1498.png` (2024-08) - Template Editor, Money element Design tab with Full width toggle enabled; annotations: red arrow pointing to the widened Money field; reproduce: Template Editor > Money element > Design tab > Full width toggle
- `live/money-05-db2f20.png` (2024-08) - Document view, Loan Amount clause with Money field, In Words button, and 'Add amount as required' help tooltip; annotations: red boxes around Money field/In Words button and around help tooltip; reproduce: Wizard/document view > Money field with In Words button and configured Help text
- `live/money-06-6f8880.png` (2024-08) - Template Editor, Money element Tags tab with applied tag (TotalValue) and suggested tags; annotations: red box around Money field, red arrow pointing up to tag; reproduce: Template Editor > Money element > Tags tab
- `live/money-07-bc60a8.png` (2024-08) - Document detail row in Manage Documents (Loan Agreement), showing Files/Messages/Approval List panels and Value field; annotations: red boxes around Document Name and Value fields; reproduce: Manage Documents > expand a document row > Key Facts panel showing Money element Value

### TEMPLATE AUTOMATION/Template Editor/Structure/Page Number.md
- `live/page-number-01-4b2a85.png` (2024-08) - Template Editor with left rail, Page Number element being dragged/highlighted at the footer of a Loan Agreement; annotations: red arrow pointing to Page Number element in left rail; reproduce: Template Editor > Elements panel > Page Number element, dragged near footer section
- `live/page-number-02-7478ad.png` (2022-11) - Template Editor, Page Number element Properties tab (Page numbering format / All pages numbering format / Continue previous section); annotations: red box around Properties options, red arrow and yellow arrows pointing to page number field; reproduce: Template Editor > Page Number element > Properties tab

### TEMPLATE AUTOMATION/Template Editor/Structure/QR Code.md
- `live/qr-code-01-39a5fa.png` (2023-01) - Template Editor with left rail, QR Code element highlighted, rendered QR code in the document footer area; annotations: red arrow pointing to QR Code in left rail, orange callout box; reproduce: Template Editor > Elements panel > QR Code element inserted near footer
- `live/qr-code-02-f3bdf4.png` (2024-02) - Template Editor, QR Code element Data field with SPD payment string and live Preview panel; annotations: red arrow pointing to Data field; reproduce: Template Editor > QR Code element > Data/Preview configuration panel
- `live/qr-code-03-c89982.png` (2024-02) - Document/Wizard rendered view, 'QR code for payment' with generated QR image and linked field list; reproduce: Wizard/document view > rendered QR Code element output
- `live/qr-code-04-1a790b.png` (2024-02) - Template Editor, QR Code element Data field containing a plain URL; annotations: red arrow pointing to Data field text; reproduce: Template Editor > QR Code element > Data field with a URL value
- `live/qr-code-05-06dd2d.png` (2024-02) - Template Editor, QR Code element Data/Preview panel in empty state with Legend; annotations: red box around Legend section; reproduce: Template Editor > QR Code element > Data/Preview panel, empty Data field
- `live/qr-code-06-bf190a.png` (2024-02) - Template Editor, QR Code element Data field with autocomplete dropdown suggesting an Object tag (QR_code); annotations: red arrow pointing to autocomplete dropdown; reproduce: Template Editor > QR Code element > Data field, typing @ to trigger object tag autocomplete
- `live/qr-code-07-15ed1d.png` (2024-02) - Template Editor, QR Code element Data field with autocomplete dropdown listing object property tags (amount/currency/iban.../message/variable-symbol); annotations: red arrow pointing to autocomplete dropdown; reproduce: Template Editor > QR Code element > Data field, selecting an object property tag

### TEMPLATE AUTOMATION/Template Editor/Structure/Question.md
- `live/question-01-48fe7b.png` (2024-08) - Template Editor with left rail, Question element ('client-is') with Edit/Actions toolbars and response chips; annotations: red boxes around Edit/Actions toolbars, red arrow pointing into panel; reproduce: Template Editor > Question element > Edit/Actions toolbar on question and its responses
- `live/question-02-a14107.png` (2024-08) - Document/Wizard rendered view, Question radio buttons (Company/Individual) with Help tooltip text; annotations: red arrow and box around help tooltip; reproduce: Wizard/document view > rendered Question element with configured Help text
- `live/question-03-cb7776.png` (2020-02) - Template Editor with left rail, Question element panel highlighting the Question element in the palette and 'New Response' button; annotations: red arrows pointing to Question element in left rail and to New Response button; reproduce: Template Editor > Elements panel > Question element > creating a new response option
- `live/question-04-e6df57.png` (2022-04) - Template Editor content area, Question element response row with '+Reference Option' dropdown open; annotations: red arrow pointing to New response dropdown; reproduce: Template Editor > Question element > response dropdown > Reference Option
- `live/question-05-1e9a24.png` (2024-08) - Template Editor, Question element Properties tab with Sort options dropdown (Alphabetical asc/desc/Custom); annotations: red boxes around Properties tab and Sort options dropdown, red arrow into panel; reproduce: Template Editor > Question element > Properties tab > Sort options
- `live/question-06-32cdbe.png` (2021-05) - Template Editor, Question element Properties tab with 'Select first option' toggle turned off; annotations: red arrow pointing to Select first option toggle; reproduce: Template Editor > Question element > Properties tab > Select first option toggle
- `live/question-07-b3b2b1.png` (2021-10) - Document/Wizard rendered view, multiple-choice checkbox question ('Apply the following policies') at top of a Loan Agreement; reproduce: Wizard/document view > rendered multiple-choice Question element (checkboxes)
- `live/question-08-7cb6e0.png` (2022-05) - Question element toolbar ("Select Vendor") referring to an Object, with Choose Object/Property/Label/Filter dropdowns and Options|Object Records toggle; annotations: red arrow pointing to the Object Records toggle button; reproduce: Template Editor > Question element set to refer to an Object > toolbar > Object Records tab
- `live/question-09-530fe1.png` (2024-08) - Question element ("Client is") with a searchable object-record dropdown (ABC/DEF/GHI) inside clause text with green Add next button; reproduce: Template Editor > Question referring to Object > open dropdown to search/select an object record

### TEMPLATE AUTOMATION/Template Editor/Structure/Rich Text.md
- `live/rich-text-01-68210c.png` (2022-07) - Elements panel with Rich Text highlighted, and Rich Text element toolbar/editor open on a clause; annotations: red box around "Rich text" in the Elements panel, red box around the rich-text toolbar/editor; reproduce: Template Editor > Clauses & Elements > Elements > Rich text

### TEMPLATE AUTOMATION/Template Editor/Structure/Select.md
- `live/select-01-2a4b35.jpg` (2020-03) - Elements panel list with Select highlighted; annotations: red arrow pointing to Select; reproduce: Template Editor > Clauses & Elements > Elements panel > Select
- `live/select-02-5b6ae4.png` (2022-04) - Select element dropdown on clause 4.3 showing after/before options with +Text Option / +Reference buttons; annotations: red arrow to the "+ Reference" button; reproduce: Template Editor > Select element > open dropdown > + Reference
- `live/select-03-dbdf4b.png` (2022-04) - "List of Shareholders" repeated Select element (choose-shareholder) with system-name toolbar (Conditions/Repeat/Tags/Properties/Warning/Help); reproduce: Template Editor > Select element inside a Repeat > choose-shareholder dropdown with +Text Option/+Reference
- `live/select-04-6179a7.png` (2022-04) - Document-generation preview of "List of Shareholders" repeat with Jane Doe/Peter Smith entries and green Add Shareholder button; reproduce: Document Editor (fill-in wizard) > repeated Select field > Add Shareholder
- `live/select-05-5ce918.png` (2022-04) - Select element options list on clause 2.3 (until/indefinitely/Other - please specify) with a row actions icon; annotations: red arrow to the vertical-dots/delete icon next to the "Other" option; reproduce: Template Editor > Select element > options dropdown > row actions icon
- `live/select-06-928a7c.png` (2022-04) - "Option settings" modal for a Select option, with a No export toggle; reproduce: Template Editor > Select option > settings icon > Option settings modal > No export
- `live/select-07-be42dc.png` (2022-04) - Select element dropdown (payment_before_or_after: after/before) with a sort icon; annotations: red arrow to the sort icon; reproduce: Template Editor > Select element dropdown > sort icon (top-right of options list)
- `live/select-08-d328b0.png` (2022-04) - Select element dropdown with "Sort by" panel expanded (Alphabetical Asc/Desc/Custom); annotations: red box around the Sort by panel; reproduce: Template Editor > Select element dropdown > sort icon > Sort by panel
- `live/select-09-d1badf.png` (2021-10) - Select element Properties tab showing Multiple Choice toggle with Separator/Second to last/The last fields; annotations: red box around the Multiple Choice settings; reproduce: Template Editor > Select element > Properties tab > Multiple Choice toggle
- `live/select-10-5b3f54.png` (2022-05) - Select element referring to an Object, Options/Object Records tabs showing Customers/Name/Address/Active Customers; reproduce: Template Editor > Select element > Object Records tab > choose object property
- `live/select-11-2e25af.png` (2022-05) - Select-referring-to-Object search dropdown ("Doe" typed, showing John Doe - Prague / Jane Doe - London); annotations: red arrow to the search box; reproduce: Template Editor > Select referring to Object > dropdown search box

### TEMPLATE AUTOMATION/Template Editor/Structure/Switcher.md
- `live/switcher-01-a8b212.png` (2021-07) - Full Template Editor UI (top bar Undo/Redo/Save/Publish/Test, left icon rail, Clauses & Elements panel) with Switcher highlighted, Visualize-as dropdown, and clause 8.1-8.4 with an "Insert license details" switcher; annotations: red arrows to the Full width toggle option, to the Insert license details switcher, and to Switcher in the Elements panel; reproduce: Template Editor (full view) > Elements panel > Switcher; Design tab > Visualize as
- `live/switcher-02-150144.png` (2024-08) - Switcher element Design tab, Visualize as: Toggle, rendered as a toggle switch; annotations: red box around the Design tab, red arrow from the Toggle dropdown to the rendered switch; reproduce: Template Editor > Switcher element > Design tab > Visualize as: Toggle
- `live/switcher-03-c989e1.png` (2024-08) - Switcher element Design tab, Visualize as: Checkbox, rendered as a checkbox; annotations: red box around the Design tab, red arrow from the Checkbox dropdown to the rendered checkbox; reproduce: Template Editor > Switcher element > Design tab > Visualize as: Checkbox

### TEMPLATE AUTOMATION/Template Editor/Structure/Table of Contents.md
- `live/table-of-contents-01-3b0129.png` (2024-03) - Full Template Editor UI, Table of Contents element Properties panel (Build table of contents from, Styles/TOC level list) with "already one Table of contents" tooltip; annotations: red arrow to the Table of Contents placeholder in the document; reproduce: Template Editor > Elements > Table of Contents > Properties tab

### TEMPLATE AUTOMATION/Template Editor/Structure/Table.md
- `live/table-01-34ce60.png` (2020-03) - Full Template Editor UI, Elements panel with Table highlighted; annotations: red arrow to Table in the Elements panel; reproduce: Template Editor > Elements panel > Table
- `live/table-02-8ec7db.png` (2020-03) - Table element with plus icons for adding a new row/column; annotations: red arrows to the plus (+) icons; reproduce: Template Editor > Table element > hover row/column edge > + icon
- `live/table-03-3f50f2.png` (2020-03) - Table cell merge tooltip ("Merge cells (beta)") shown on hover; annotations: red arrow to the merge icon/tooltip; reproduce: Template Editor > Table element > select adjacent cells > Merge cells icon
- `live/table-04-8b58f4.png` (2020-03) - Table cell unmerge icon; annotations: red arrow to the unmerge icon; reproduce: Template Editor > Table element > merged cell > Unmerge icon
- `live/table-05-dd6e95.png` (2020-03) - Table element Design tab, cell spacing/width fields (0.3) and alignment control; annotations: red boxes around the spacing fields and the alignment icon; reproduce: Template Editor > Table element > Design tab > cell spacing / alignment
- `live/table-06-e73603.png` (2020-03) - Table element Properties tab with a Table Header toggle; annotations: red box around the Edit dropdown on a table row; reproduce: Template Editor > Table element > Properties tab > Table Header toggle
- `live/table-07-d02b84.png` (2020-03) - Table element Design tab, cell width spacing fields and alignment control; annotations: red boxes around the spacing fields and the alignment icon; reproduce: Template Editor > Table element > Design tab > table width / cell spacing
- `live/table-08-0f8ec6.png` (2020-03) - Table element Design tab, "Beginning & End" spacing dropdown expanded (No Space/New Line) with Table width field; reproduce: Template Editor > Table element > Design tab > Beginning & End spacing options

### TEMPLATE AUTOMATION/Template Editor/Structure/Template Sections.md
- `live/template-sections-01-439eed.png` (2022-08) - Full Template Editor UI, Clauses panel with Continuous Section highlighted and a "+ Next Page Section" button; annotations: red arrows to the Continuous Section clause and to the + Next Page Section button; reproduce: Template Editor > Clauses & Elements > Continuous Section / Next Page Section button
- `live/template-sections-02-09843c.png` (2022-08) - Section properties toolbar ("section_2", Conditions/Repeat/Tags/Properties/Design tabs) with a "Hide for 2nd language" checkbox and Edit tag; annotations: red box around the tab menu, red arrow to the Edit tag; reproduce: Template Editor > Section > Properties toolbar
- `live/template-sections-03-66e284.png` (2022-08) - Clause 10 "Assignment" with a "+ New Page Section" button at the bottom of the section; annotations: red box around the + New Page Section button; reproduce: Template Editor > end of a section > + New Page Section
- `live/template-sections-04-257679.png` (2022-08) - Full Template Editor UI, "Continuous Section" clause and divider bar between two sections; annotations: red underline on the Continuous Section clause, red box around the Continuous Section divider; reproduce: Template Editor > Continuous Section divider between page sections

### TEMPLATE AUTOMATION/Template Editor/Structure/Text Input.md
- `live/text-input-01-345f3f.png` (2020-03) - Full Template Editor UI ("Contractor Agreement"), Elements panel with Text Input highlighted, and a Text Input field ("no. 1234") with SYSTEM NAME tags; annotations: red arrows to Text Input in the Elements panel and to the text input field; reproduce: Template Editor > Elements panel > Text Input
- `live/text-input-02-03d685.png` (2020-03) - Text Input element Properties tab (Numbers Only, 2nd Language, Allow for repeat, Insert Footnote/Endnote); annotations: red box around the Properties tab; reproduce: Template Editor > Text Input element > Properties tab

### TEMPLATE AUTOMATION/Template Editor/Structure/Text.md
- `live/text-01-ad370a.png` (2020-03) - Full Template Editor UI, clause 3 "Payment" with Select dropdowns (flat_or_time_rate, paymentselect, vat_select) and Text highlighted in Elements panel; annotations: red arrow to Text in the Elements panel; reproduce: Template Editor > Elements panel > Text
- `live/text-02-bb003b.png` (2020-03) - Clauses "Confidentiality"/"Contractual Penalty" with a right-click context menu open, Split option highlighted; annotations: red arrow to the highlighted text, red box around the Split menu item; reproduce: Template Editor > Text/clause > right-click context menu > Split
- `live/text-03-f9f9a8.png` (2020-03) - Text element Properties tab, "Unlock enable" / "Permissioned Users can (un)lock" dropdown; annotations: red box around the Unlock enable dropdown options; reproduce: Template Editor > Text element > Properties tab > Unlock enable dropdown
- `live/text-04-5aabc9.png` (2020-03) - Workflow builder ("Workflows > Example") node diagram (Draft/Review/Approved/Terminated) with Stage Color and Properties panel; annotations: red box around the "Lock document editing" property, red arrow to the Review node connector; reproduce: Workflows > open a workflow > stage node > Properties panel

### TEMPLATE AUTOMATION/Template Editor/Structure/Title.md
- `live/title-01-7c4079.png` (2020-02) - Full Template Editor UI, Clauses panel with Title highlighted, plus a Question ("I want to use this Agreement for") and Title clause "Contractor Agreement"; annotations: red arrows to Title in the Clauses panel and to the Edit control on the Title clause; reproduce: Template Editor > Clauses & Elements > Clauses > Title

### TEMPLATE AUTOMATION/Template Editor/Template Editor Settings/Template Editor Features Overview.md
- `live/template-editor-features-overview-01-113a6c.png` (2022-11) - Full Template Editor UI, Clauses & Elements panel with a Popular/Full List toggle; annotations: red box around the Popular/Full List toggle; reproduce: Template Editor > Clauses & Elements panel > Popular/Full List toggle
- `live/template-editor-features-overview-02-4a7c19.png` (2021-03) - Conditions & Repeats panel, Search box with Suggestions/Recently Created condition list; annotations: red arrow to the Search box; reproduce: Template Editor > Conditions & Repeats > Search
- `live/template-editor-features-overview-03-e30fef.png` (2021-05) - Link creation panel (Create Link, Apply recent link, Paste link) with a suggested link to a Text Input; reproduce: Template Editor > select text > Create Link panel
- `live/template-editor-features-overview-04-810733.png` (2021-03) - Conditions tab, "Create condition"/"Apply recent condition" dropdown expanded with a long list of saved conditions; annotations: red arrows to the Search box and to the Apply recent condition dropdown arrow; reproduce: Template Editor > Conditions tab > Apply recent condition dropdown
- `live/template-editor-features-overview-05-ce9879.png` (2021-03) - Conditions & Repeats Search panel with a Suggestions list; annotations: red arrow to the Search box; reproduce: Template Editor > Conditions & Repeats > Search
- `live/template-editor-features-overview-06-15362e.png` (2021-03) - Conditions & Repeats Search panel with a suggestion tooltip shown on a clause; reproduce: Template Editor > Conditions & Repeats > apply a search suggestion to a clause
- `live/template-editor-features-overview-07-70c535.png` (2021-03) - "Find in Template" dark search panel (Fulltext/Condition/Repeat/Link tabs, Types, Results match options); annotations: red arrow to the search icon; reproduce: Template Editor > top bar > Find in Template
- `live/template-editor-features-overview-08-6c6000.jpg` (2022-05) - "Find in Template" results panel with Bulk Actions tab and a "Choose All" button; annotations: red arrow to "Choose All"; reproduce: Template Editor > Find in Template results > Bulk Actions > Choose All
- `live/template-editor-features-overview-09-9e77a5.png` (2021-03) - Undo dropdown history list ("Multiple commands at once", "Paragraph moved"); annotations: red underline under the Undo dropdown; reproduce: Template Editor > top bar > Undo dropdown arrow > command history
- `live/template-editor-features-overview-10-da7149.png` (2021-03) - Template Suite name switcher dropdown ("Loan Agreement", "Delivery Note", "Fee Calculation") in the top bar; annotations: red arrow to the language/translate icon next to Delivery Note; reproduce: Template Editor > top bar > template name dropdown > switch between Template Suite documents
- `live/template-editor-features-overview-11-6da97b.png` (2022-07) - Clause 4.4/4.4.1 with repeat placeholders (First/Second/Third...Twelfth) and orange/yellow/pink condition, system-name and repeat annotation tags; annotations: orange "Question Choose Payment...= In Installments" tags, yellow SYSTEM NAME tag, pink "Repeat according to..." tag (Legito's own condition/repeat/system-name markers, not KB annotations); reproduce: Template Editor > repeated clause > condition/repeat/system-name markers shown alongside text
- `live/template-editor-features-overview-12-bdc57f.png` (2022-01) - Full Template Editor UI, clause 2 "Term of Agreement" 2.1-2.5; annotations: red arrow pointing up at the ruler/top bar; reproduce: Template Editor > document canvas showing a clause with sub-clauses
- `live/template-editor-features-overview-13-d84c5d.png` (2022-04) - Full Template Editor UI, Bulk Actions tab active, "Remove All Conditions" button, a Question ("The Contractor is") with repeat clauses; annotations: red arrow to the Bulk Actions tab; reproduce: Template Editor > top toolbar > Bulk Actions > Remove All Conditions
- `live/template-editor-features-overview-14-2636c7.jpg` (2022-05) - Bulk Actions "Replace with" dropdown listing element types (Table/Text/Text Input/Select/Money/Date/Switcher/Button); reproduce: Template Editor > Bulk Actions > Replace with dropdown
- `live/template-editor-features-overview-15-d084bb.png` (2023-09) - Right-click "Actions" context menu on a Question element (Copy/Paste condition, Duplicate, Select all, Numbering, Delete); reproduce: Template Editor > Question element > Actions context menu > Duplicate
- `live/template-editor-features-overview-16-850628.png` (2021-10) - "Auto-generated system name" settings panel (checkboxes for Question/Button/Switcher/Select/TextInput/Money/Date/Article/Paragraph/etc.); annotations: red box around the checklist, red underline on "Editor Settings"; reproduce: Template Editor > Editor Settings > Auto-generated system name

### TEMPLATE AUTOMATION/Template Editor/Template Editor Settings/Translation Mode.md
- `live/translation-mode-01-eb96fd.png` (2021-07) - Translation Mode panel (Languages: English-US/Español, Add language) with a tooltip showing last-edit timestamp; annotations: red arrow to the Translate icon in the left rail; reproduce: Template Editor > left icon rail > Translate > Languages panel

### TEMPLATE AUTOMATION/Template Editor/Template Tags/Template Tags Overview.md
- `live/template-tags-overview-01-5b5a5e.png` (2020-03) - Full Template Editor UI, element's Tags tab with DocumentName tag applied and a suggested-tags list; annotations: red arrow to the DocumentName tag, red box around the Tags tab; reproduce: Template Editor > element > Tags tab > apply a Template Tag

### TEMPLATE AUTOMATION/Template Types/Form Template.md
- `live/form-template-01-e78698.png` (2023-10) - Form Template "Quick Actions" block-type picker (Text Input/Date/Toggle/Single Choice/Multi Choice/Money/Title Only); reproduce: Form Template editor > click + (add block) > Quick Actions menu
- `live/form-template-03-a04917.png` (2023-10) - Form template preview - Seller Info Section fields (name, date, verified toggle, VAT dropdown, document dropdown, money field); reproduce: Create/open a Form-type template with text, date, toggle, select and money elements; Preview/Test

### TEMPLATE AUTOMATION/Template Types/PDF Template.md
- `live/pdf-template-06-480d69.png` (2024-02) - Document record - PDF attachment context menu (Download/Versions/Rename/Delete) with Versions modal open, timestamped 21.08.2024; annotations: red box around the Versions menu item; red arrow from the Versions button up to the Versions modal; reproduce: Open a document record with a processed PDF attachment > attachment card menu > Versions
- `live/pdf-template-07-81723e.png` (2024-02) - Document record - processed PDF attachment card at bottom of the generated document, with Download bar; annotations: red box around the PDF attachment card; red arrow pointing to it; reproduce: Open a document record with a processed PDF attachment; scroll to the attachment card above the Download bar

## N-A (53)

### DOCUMENT EDITOR/Data Import/Batch Generation from Sheets.md
- `live/batch-generation-from-sheets-01-e6d5f1.png` (2020-03) - Microsoft Excel spreadsheet with sample Name/Address/ID/Salary/Email columns (Czech ribbon)

### DOCUMENT EDITOR/Overview of Document Drafting.md
- `live/overview-of-document-drafting-14-7f29ee.png` (2020-03) - Gmail inbox showing a Legito-generated 'document ready' notification email with numbered Instructions text; annotations: red box around the Instructions section of the email body

### INTEGRATIONS/Integration Tools/Push API (Webhooks).md
- `live/push-api-webhooks-01-8e7aee.png` (2020-12) - Custom-made Push API flow diagram (Legito Workspace -> Push API -> Your Web Server); annotations: none (diagram is itself all arrows/boxes)
- `live/push-api-webhooks-06-ed11c4.png` (2020-12) - Auto-generated API reference (Swagger/ReDoc-style) schema for PushResponse object

### INTEGRATIONS/Legito in Other Apps/Make.md
- `live/make-01-9a42ac.png` (2024-03) - Make.com marketplace listing page for the Legito app (Actions list)

### INTEGRATIONS/Legito in Other Apps/Microsoft SharePoint.md
- `live/microsoft-sharepoint-02-cdbc4a.png` (2024-02) - Microsoft Entra admin center: App registrations (Owned applications) list; annotations: red box around App registrations nav item and New registration button
- `live/microsoft-sharepoint-03-eccad3.png` (2024-02) - Microsoft Entra admin center: Register an application form; annotations: red box around Name field; red arrow down to Register button
- `live/microsoft-sharepoint-04-3eaafe.png` (2024-02) - Split view: Microsoft Entra App essentials (Application/Directory ID) next to Legito SharePoint auth form; annotations: red boxes around Application (client) ID and Directory (tenant) ID; red double-arrow pointing to Legito Tenant ID / Client ID fields
- `live/microsoft-sharepoint-05-9384ee.png` (2024-02) - Microsoft Entra admin center: Certificates & secrets tab, New client secret; annotations: red box around Certificates & secrets nav item and New client secret link
- `live/microsoft-sharepoint-06-1e21a8.png` (2024-02) - Split view: Microsoft Entra Client secrets list (Secret ID) next to Legito SharePoint auth form; annotations: red box around Secret ID column; red arrow pointing to Legito Client Secret field
- `live/microsoft-sharepoint-07-970c1c.png` (2024-02) - Microsoft Entra admin center: API permissions tab (Microsoft Graph / SharePoint scopes); annotations: red box around API permissions nav item, Add a permission and Grant admin consent buttons

### INTEGRATIONS/Legito in Other Apps/Salesforce.md
- `live/salesforce-01-cffce3.png` (2024-02) - Custom-made diagram: Legito server exchanging documents with Salesforce and a Legito document; annotations: diagram arrows (part of the illustration, not an overlay)
- `live/salesforce-02-3de2e7.png` (2024-02) - Salesforce Opportunity record page with embedded "Legito Document Automation" widget panel
- `live/salesforce-03-3362a5.png` (2024-02) - Salesforce AppExchange: Install Legito package screen (install-for-all-users option); annotations: red arrow down to install-for-all-users option; red arrow to Install button
- `live/salesforce-04-9ee34b.png` (2024-02) - Salesforce AppExchange: Install Legito – Installation Complete confirmation; annotations: red arrow to Done button
- `live/salesforce-05-0a0d14.png` (2024-02) - Salesforce Setup: Installed Packages page listing the Legito package; annotations: red arrows pointing to page title and to the Legito package row
- `live/salesforce-06-9b94bb.png` (2024-02) - Salesforce Lightning App Builder: adding the legito component to an Opportunity page layout; annotations: red arrows pointing to the legito component in the sidebar, the drop target, and the Save button
- `live/salesforce-07-59345a.png` (2024-02) - Salesforce Lightning Sales app, Opportunity page showing the Legito Document Automation widget; annotations: red box around the Legito widget; red arrow pointing to its settings gear icon
- `live/salesforce-10-545949.png` (2024-02) - Custom-made diagram: Legito dashboard -> Salesforce Remote Site Settings -> API Keys flow; annotations: diagram arrows (part of the illustration)
- `live/salesforce-13-dae3e9.png` (2024-02) - Custom-made diagram: Salesforce -> JSON download -> Legito JSON upload -> field mapping flow; annotations: diagram arrows (part of the illustration)
- `live/salesforce-14-c5a1d6.png` (2024-02) - Salesforce Setup: Lightning Experience App Manager list showing the Legito connected app
- `live/salesforce-15-4d95fa.png` (2024-02) - Salesforce Setup: New Connected App form (OAuth settings)
- `live/salesforce-16-7564d6.png` (2024-02) - Salesforce Setup: Manage Connected Apps detail page for LegitoConnectedAppExample

### INTEGRATIONS/Other Apps in Legito/DocuSign.md
- `live/docusign-01-1f8079.png` (2020-03) - Pricing table (Personal/Standard/Business Pro/Advanced Solutions plans with Buy Now buttons)

### INTEGRATIONS/Other Apps in Legito/Microsoft Entra ID (Azure AD).md
- `live/microsoft-entra-id-azure-ad-01-773d66.png` (2023-04) - Microsoft Azure: Enterprise Application "Legito testing AD" OIDC-based Sign-on (Preview) overview; annotations: red arrows pointing to "Go to application" link and Single sign-on nav item
- `live/microsoft-entra-id-azure-ad-02-27fcc3.jpg` (2023-04) - Custom-made sequence diagram: OIDC login flow (Browser / Legito server / Azure AD OAuth server / Azure AD API); annotations: diagram arrows (part of the illustration)
- `live/microsoft-entra-id-azure-ad-03-49b7a4.png` (2023-04) - Microsoft Azure: App registration Essentials panel (Application/Object/Directory IDs, Redirect URIs); annotations: red arrow pointing to "Add a Redirect URI" link
- `live/microsoft-entra-id-azure-ad-04-97bdc5.png` (2023-04) - Microsoft Azure: Certificates & secrets tab, no secrets yet (New client secret); annotations: red arrow pointing to New client secret link
- `live/microsoft-entra-id-azure-ad-05-fe4d6d.png` (2023-04) - Microsoft Azure: Authentication tab with Configure Web panel (Redirect URIs, Implicit grant); annotations: red arrows pointing to Redirect URI field and Configure button
- `live/microsoft-entra-id-azure-ad-06-c698ee.png` (2023-04) - Microsoft Azure: Certificates & secrets tab, no secrets yet (duplicate view of step 04); annotations: red arrow pointing to New client secret link
- `live/microsoft-entra-id-azure-ad-07-2c7c81.png` (2023-04) - Microsoft Azure: "Add a client secret" side panel (Description, Expires); annotations: red arrows pointing to Expires dropdown and Add button
- `live/microsoft-entra-id-azure-ad-08-dbcb89.png` (2023-04) - Microsoft Azure: Certificates & secrets, generated client secret Value with copy-to-clipboard tooltip; annotations: red box around the secret Value field
- `live/microsoft-entra-id-azure-ad-09-150e84.png` (2023-04) - Microsoft Azure: App Essentials panel with Application (client) ID, Directory (tenant) ID, Client credentials highlighted; annotations: red boxes around Application (client) ID, Directory (tenant) ID, and Client credentials fields
- `live/microsoft-entra-id-azure-ad-10-3cf186.png` (2023-04) - Microsoft Azure: Token configuration tab, "Edit groups claim" side panel; annotations: red arrows pointing to Add groups claim link and to group-type checkboxes
- `live/microsoft-entra-id-azure-ad-14-db94ab.png` (2023-04) - Microsoft Azure: Default Directory Overview page (legacy Azure AD portal); annotations: red arrow pointing to Groups nav item
- `live/microsoft-entra-id-azure-ad-15-c3386e.png` (2023-04) - Microsoft Azure: Groups | All groups list page; annotations: red arrows pointing to New group button and the Test group row
- `live/microsoft-entra-id-azure-ad-16-f07177.png` (2023-04) - Microsoft Azure: Test group detail page (Object Id, membership counts); annotations: red arrow pointing to Object Id field
- `live/microsoft-entra-id-azure-ad-19-66b508.png` (2023-04) - Microsoft Azure Active Directory (Entra ID) Default Directory overview page; annotations: red arrow from search box toward Roles and administrators menu item
- `live/microsoft-entra-id-azure-ad-20-77047a.png` (2023-04) - Azure AD Roles and administrators - All roles list; annotations: red arrow to New custom role button, red arrow to Application Administrator role
- `live/microsoft-entra-id-azure-ad-21-ce71b8.png` (2023-04) - Azure AD Application Administrator role - Description panel; annotations: red arrows to Description tab, Template ID and Related articles link

### INTEGRATIONS/Other Apps in Legito/Microsoft Office For Web.md
- `live/microsoft-office-for-web-03-8b57f4.png` (2021-12) - Word document opened via Office for Web integration (Microsoft Word Online interface with Legito comments panel)

### TEMPLATE AUTOMATION/Template Administration/Template Suite Settings/Template Suite Layout.md
- `live/template-suite-layout-01-11aec8.png` (2024-02) - Illustrative diagram comparing Smart Document / Single Layout / Dual Layout concepts (not a screenshot)

### TEMPLATE AUTOMATION/Template Editor/Formatting, Styles & Design/Advanced Layout Design.md
- `live/advanced-layout-design-02-c87cae.png` (2018-08) - Word document with an Advanced Layout Design template showing $CONTENT$ placeholder and a 'Your LOGO here' image placeholder
- `live/advanced-layout-design-03-901afa.png` (2019-09) - Word document snippet showing $HEADER_CONTENTS$ and $CONTENT$ tags; annotations: red arrow pointing to $HEADER_CONTENTS$
- `live/advanced-layout-design-05-e00058.jpg` (2021-07) - Word document cover-page ALD template with Legito logo, city skyline photo, and $Tag: placeholders

### TEMPLATE AUTOMATION/Template Editor/Import/Import from Word.md
- `live/import-from-word-03-768333.jpg` (2020-02) - Word document with yellow-highlighted placeholder tags (Formatting Example for Import from Word)
- `live/import-from-word-05-a1daea.png` (2020-01) - Microsoft Word application icon/logo graphic

### TEMPLATE AUTOMATION/Template Editor/Structure/Link.md
- `live/link-12-dd8eef.png` (2024-08) - Generated Word document showing a hyperlink cross-reference with Word's 'Ctrl+Click to follow link' bookmark tooltip; annotations: red underline under 'section 10'

### TEMPLATE AUTOMATION/Template Editor/Template Tags/Document Records - Data Extraction.md
- `live/document-records-data-extraction-01-61d907.png` (2020-03) - Data-extraction rules reference matrix (Property vs Clause/Element types) - not a UI screenshot
- `live/document-records-data-extraction-02-a2f73a.png` (2020-03) - Data-extraction rules reference matrix by Template Tag occurrence count - not a UI screenshot

### TEMPLATE AUTOMATION/Template Types/PDF Template.md
- `live/pdf-template-02-268eb3.png` (2024-02) - Generic PDF form field example (text field, checkbox, radio buttons, combo/list box, signature field, submit/reset buttons) - not Legito UI
- `live/pdf-template-03-3d8615.png` (2023-06) - Reference table mapping PDF field types to Legito Clause/Element extraction behavior

### TEMPLATE AUTOMATION/Template Types/Template Type Overview.md
- `live/template-type-overview-04-5eafa2.png` (2020-03) - UCC Financing Statement - US government PDF form example used to illustrate a PDF Template, not Legito UI; annotations: red box around the Print button; red box around the Reset button

