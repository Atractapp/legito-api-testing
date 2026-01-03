'use client';

import type {
  WorkspaceResources,
  TemplateResource,
  ObjectResource,
  GeneratedTest,
  TemplateElement
} from '@/types';

export interface ResourceSelections {
  selectedTemplateIds: number[];
  selectedObjectIds: number[];
  generateDocumentTests: boolean;
  generateObjectTests: boolean;
}

/**
 * Generates test cases from scanned workspace resources based on user selections
 */
export function generateTestsFromResources(
  resources: WorkspaceResources,
  selections: ResourceSelections
): GeneratedTest[] {
  const tests: GeneratedTest[] = [];

  // Generate document creation tests for selected templates
  if (selections.generateDocumentTests) {
    const selectedTemplates = resources.templates.filter(
      t => selections.selectedTemplateIds.includes(t.id)
    );

    for (const template of selectedTemplates) {
      tests.push(generateDocumentCreationTest(template));
      tests.push(generateDocumentReadTest(template));
    }
  }

  // Generate CRUD tests for selected objects
  if (selections.generateObjectTests) {
    const selectedObjects = resources.objects.filter(
      o => selections.selectedObjectIds.includes(o.id)
    );

    for (const object of selectedObjects) {
      tests.push(...generateObjectCrudTests(object));
    }
  }

  return tests;
}

/**
 * Generates a document creation test for a template
 */
export function generateDocumentCreationTest(template: TemplateResource): GeneratedTest {
  const elementData = generateElementData(template.elements);

  return {
    id: `doc-create-${template.id}`,
    name: `Create Document: ${template.name}`,
    description: `Create a new document using template "${template.name}" with ${template.elements.length} elements`,
    category: 'Documents',
    endpoint: '/documents',
    method: 'POST',
    resourceType: 'template',
    resourceId: template.id,
    bodyTemplate: {
      templateId: template.id,
      name: `Test Document - ${template.name}`,
      elements: elementData,
    },
    expectedStatus: [200, 201],
    crudOperation: 'CREATE',
  };
}

/**
 * Generates a document read test for a template
 */
function generateDocumentReadTest(template: TemplateResource): GeneratedTest {
  return {
    id: `doc-read-${template.id}`,
    name: `Read Document: ${template.name}`,
    description: `Read a document created from template "${template.name}"`,
    category: 'Documents',
    endpoint: '/documents/{documentId}',
    method: 'GET',
    resourceType: 'template',
    resourceId: template.id,
    expectedStatus: [200],
    crudOperation: 'READ',
  };
}

/**
 * Generates CRUD tests for a Smart Records object
 */
export function generateObjectCrudTests(object: ObjectResource): GeneratedTest[] {
  const recordData = generateRecordData(object);

  return [
    // CREATE test
    {
      id: `obj-create-${object.id}`,
      name: `Create Record: ${object.name}`,
      description: `Create a new record in object "${object.name}"`,
      category: 'Smart Records',
      endpoint: `/smart-records/objects/${object.id}/records`,
      method: 'POST',
      resourceType: 'object',
      resourceId: object.id,
      bodyTemplate: recordData,
      expectedStatus: [200, 201],
      crudOperation: 'CREATE',
    },
    // READ test
    {
      id: `obj-read-${object.id}`,
      name: `Read Records: ${object.name}`,
      description: `Read records from object "${object.name}"`,
      category: 'Smart Records',
      endpoint: `/smart-records/objects/${object.id}/records`,
      method: 'GET',
      resourceType: 'object',
      resourceId: object.id,
      expectedStatus: [200],
      crudOperation: 'READ',
    },
    // UPDATE test (requires existing record ID)
    {
      id: `obj-update-${object.id}`,
      name: `Update Record: ${object.name}`,
      description: `Update a record in object "${object.name}"`,
      category: 'Smart Records',
      endpoint: `/smart-records/objects/${object.id}/records/{recordId}`,
      method: 'PUT',
      resourceType: 'object',
      resourceId: object.id,
      bodyTemplate: recordData,
      expectedStatus: [200],
      crudOperation: 'UPDATE',
    },
    // DELETE test (requires existing record ID)
    {
      id: `obj-delete-${object.id}`,
      name: `Delete Record: ${object.name}`,
      description: `Delete a record from object "${object.name}"`,
      category: 'Smart Records',
      endpoint: `/smart-records/objects/${object.id}/records/{recordId}`,
      method: 'DELETE',
      resourceType: 'object',
      resourceId: object.id,
      expectedStatus: [200, 204],
      crudOperation: 'DELETE',
    },
  ];
}

/**
 * Generates test data for template elements based on their types
 */
function generateElementData(elements: TemplateElement[]): Record<string, unknown>[] {
  return elements.map(element => {
    const data: Record<string, unknown> = {
      uuid: element.uuid,
    };

    switch (element.type.toLowerCase()) {
      case 'textinput':
      case 'text':
      case 'string':
        data.value = `Test value for ${element.name}`;
        break;

      case 'number':
      case 'integer':
        data.value = 12345;
        break;

      case 'money':
      case 'currency':
        data.value = { amount: 1000, currency: 'USD' };
        break;

      case 'date':
        data.value = new Date().toISOString().split('T')[0];
        break;

      case 'datetime':
        data.value = new Date().toISOString();
        break;

      case 'boolean':
      case 'checkbox':
        data.value = true;
        break;

      case 'select':
      case 'dropdown':
      case 'question':
        // Use first option if available
        if (element.options && element.options.length > 0) {
          data.value = element.options[0].uuid;
        } else {
          data.value = null;
        }
        break;

      case 'multiselect':
        // Use first option if available
        if (element.options && element.options.length > 0) {
          data.value = [element.options[0].uuid];
        } else {
          data.value = [];
        }
        break;

      case 'email':
        data.value = 'test@example.com';
        break;

      case 'url':
        data.value = 'https://example.com';
        break;

      case 'phone':
        data.value = '+1234567890';
        break;

      case 'textarea':
      case 'longtext':
        data.value = `Test long text value for ${element.name}. This is a longer text field that might contain multiple paragraphs or detailed information.`;
        break;

      default:
        // For unknown types, use a generic string value
        data.value = `Test value for ${element.name}`;
    }

    return data;
  });
}

/**
 * Generates test data for Smart Records properties based on their types
 */
function generateRecordData(object: ObjectResource): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const property of object.properties) {
    const key = property.systemName || property.name.toLowerCase().replace(/\s+/g, '_');

    switch (property.type.toLowerCase()) {
      case 'text':
      case 'string':
        data[key] = `Test ${property.name}`;
        break;

      case 'number':
      case 'integer':
        data[key] = 100;
        break;

      case 'decimal':
      case 'float':
        data[key] = 99.99;
        break;

      case 'boolean':
        data[key] = true;
        break;

      case 'date':
        data[key] = new Date().toISOString().split('T')[0];
        break;

      case 'datetime':
        data[key] = new Date().toISOString();
        break;

      case 'email':
        data[key] = 'test@example.com';
        break;

      case 'url':
        data[key] = 'https://example.com';
        break;

      case 'json':
      case 'object':
        data[key] = { test: 'value' };
        break;

      default:
        data[key] = `Test ${property.name}`;
    }
  }

  return data;
}

/**
 * Converts generated tests to the format expected by LEGITO_TESTS
 */
export function convertToLegitoTestFormat(tests: GeneratedTest[]): LegitoTestDefinition[] {
  return tests.map(test => ({
    id: test.id,
    name: test.name,
    category: test.category,
    description: test.description,
    endpoint: test.endpoint,
    method: test.method,
    body: test.bodyTemplate,
    expectedStatus: test.expectedStatus,
  }));
}

interface LegitoTestDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  endpoint: string;
  method: string;
  body?: unknown;
  expectedStatus: number[];
}
