import { pgTable, uuid, text, timestamp, jsonb, integer, real, primaryKey, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const dataSourceStatusEnum = pgEnum('data_source_status', ['pending', 'processing', 'processed', 'failed']);
export const summaryLevelEnum = pgEnum('summary_level', ['sentence', 'paragraph', 'full']);

// Projects Table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  dataSources: many(dataSources),
  entities: many(entities),
  synthesisParameters: many(synthesisParameters),
}));

// Data Sources Table
export const dataSources = pgTable('data_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // e.g., 'pdf', 'url', 'audio'
  name: text('name').notNull(),
  contentUrl: text('content_url').notNull(),
  status: dataSourceStatusEnum('status').default('pending').notNull(),
  metadata: jsonb('metadata'), // File size, mime type, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dataSourcesRelations = relations(dataSources, ({ one, many }) => ({
  project: one(projects, {
    fields: [dataSources.projectId],
    references: [projects.id],
  }),
  summaries: many(summaries),
  dataSourceEntities: many(dataSourceEntities),
}));

// Summaries Table
export const summaries = pgTable('summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  dataSourceId: uuid('data_source_id').references(() => dataSources.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id'), // Self-referencing for hierarchy
  content: text('content').notNull(),
  level: summaryLevelEnum('level').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  dataSource: one(dataSources, {
    fields: [summaries.dataSourceId],
    references: [dataSources.id],
  }),
  parent: one(summaries, {
    fields: [summaries.parentId],
    references: [summaries.id],
    relationName: 'summaryHierarchy',
  }),
  children: many(summaries, {
    relationName: 'summaryHierarchy',
  }),
}));

// Entities Table
export const entities = pgTable('entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // e.g., 'parameter', 'organization', 'person'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  project: one(projects, {
    fields: [entities.projectId],
    references: [projects.id],
  }),
  dataSourceEntities: many(dataSourceEntities),
}));

// Join Table: Data Source <-> Entities
export const dataSourceEntities = pgTable('data_source_entities', {
  dataSourceId: uuid('data_source_id').references(() => dataSources.id, { onDelete: 'cascade' }).notNull(),
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }).notNull(),
  value: text('value'), // The specific value found in this source
  confidence: integer('confidence'), // Storing as integer 0-100 or float? Using integer for simplicity/storage often better, or real. Plan said float. Let's use real or doublePrecision.
  // Actually, let's use 'real' for float.
  // But wait, the plan said "Float (AI confidence score)".
  // Drizzle 'real' is standard for float4.
  // Let's stick to the plan but maybe use 'real' type.
  // Wait, I need to import 'real' or 'doublePrecision'.
  // Let's use 'real' for now.
  context: text('context'), // Snippet
}, (t) => ({
  pk: primaryKey({ columns: [t.dataSourceId, t.entityId] }),
}));

export const dataSourceEntitiesRelations = relations(dataSourceEntities, ({ one }) => ({
  dataSource: one(dataSources, {
    fields: [dataSourceEntities.dataSourceId],
    references: [dataSources.id],
  }),
  entity: one(entities, {
    fields: [dataSourceEntities.entityId],
    references: [entities.id],
  }),
}));

// Synthesis Parameters Table - for dynamic column management
export const synthesisParameters = pgTable('synthesis_parameters', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g., "Publication Year", "Institution", "Technology Maturity"
  type: text('type').notNull(), // 'text', 'number', 'date', 'category'
  description: text('description'),
  isSystem: boolean('is_system').default(false), // Auto-discovered vs user-defined
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const synthesisParametersRelations = relations(synthesisParameters, ({ one, many }) => ({
  project: one(projects, {
    fields: [synthesisParameters.projectId],
    references: [projects.id],
  }),
  values: many(synthesisValues),
}));

// Synthesis Values Table - the actual spreadsheet data
export const synthesisValues = pgTable('synthesis_values', {
  id: uuid('id').defaultRandom().primaryKey(),
  parameterId: uuid('parameter_id').references(() => synthesisParameters.id, { onDelete: 'cascade' }).notNull(),
  dataSourceId: uuid('data_source_id').references(() => dataSources.id, { onDelete: 'cascade' }).notNull(),
  value: text('value'), // JSON for complex types
  extractedValue: text('extracted_value'), // AI-extracted raw value
  confidence: real('confidence'), // 0.0 to 1.0
  context: text('context'), // Source snippet
  isVerified: boolean('is_verified').default(false), // Human verification
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const synthesisValuesRelations = relations(synthesisValues, ({ one }) => ({
  parameter: one(synthesisParameters, {
    fields: [synthesisValues.parameterId],
    references: [synthesisParameters.id],
  }),
  dataSource: one(dataSources, {
    fields: [synthesisValues.dataSourceId],
    references: [dataSources.id],
  }),
}));
