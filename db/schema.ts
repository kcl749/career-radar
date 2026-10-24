import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const marks=sqliteTable('marks',{userId:text('user_id').notNull(),jobId:text('job_id').notNull(),saved:integer('saved').notNull().default(0),applied:integer('applied').notNull().default(0),feedback:text('feedback').notNull().default(''),feedbackReason:text('feedback_reason').notNull().default(''),feedbackNote:text('feedback_note').notNull().default(''),updated:text('updated').notNull() },t=>[primaryKey({columns:[t.userId,t.jobId]})]);
export const customJobs=sqliteTable('custom_jobs',{userId:text('user_id').notNull(),jobId:text('job_id').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.jobId]})]);
export const applications=sqliteTable('applications',{
  userId:text('user_id').notNull(),id:text('id').notNull(),sourceJobId:text('source_job_id'),
  company:text('company').notNull(),title:text('title').notNull(),appliedDate:text('applied_date'),
  currentStage:text('current_stage').notNull().default('已投递'),nextAction:text('next_action').notNull().default(''),
  nextDue:text('next_due'),lastUpdated:text('last_updated'),notes:text('notes').notNull().default(''),
  archived:integer('archived').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const applicationEvents=sqliteTable('application_events',{
  userId:text('user_id').notNull(),applicationId:text('application_id').notNull(),id:text('id').notNull(),
  stage:text('stage').notNull(),date:text('date'),notes:text('notes').notNull().default(''),
  createdAt:text('created_at').notNull()
},t=>[primaryKey({columns:[t.userId,t.applicationId,t.id]})]);
