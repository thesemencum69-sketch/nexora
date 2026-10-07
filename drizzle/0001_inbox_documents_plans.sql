CREATE TYPE "public"."channel" AS ENUM('telegram', 'max', 'whatsapp', 'vk', 'instagram', 'website');--> statement-breakpoint
CREATE TYPE "public"."custom_field_entity" AS ENUM('deal', 'client');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'select', 'date');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('invoice', 'proposal');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('issued', 'paid', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."view_entity" AS ENUM('deals', 'clients', 'leads');--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'document_issued';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'document_paid';--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"contact_name" text NOT NULL,
	"handle" text NOT NULL,
	"external_id" text,
	"lead_id" uuid,
	"client_id" uuid,
	"deal_id" uuid,
	"owner_id" uuid,
	"unread" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_workspace_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity" "custom_field_entity" NOT NULL,
	"label" text NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"price_kopecks" bigint NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'шт.' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "deal_items_qty_positive" CHECK ("deal_items"."qty" > 0),
	CONSTRAINT "deal_items_price_non_negative" CHECK ("deal_items"."price_kopecks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"number" integer NOT NULL,
	"deal_id" uuid NOT NULL,
	"client_id" uuid,
	"items" jsonb NOT NULL,
	"total_kopecks" bigint NOT NULL,
	"requisites" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "document_status" DEFAULT 'issued' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_paid_consistency" CHECK (("documents"."status" = 'paid') = ("documents"."paid_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"client_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deal_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"lead_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_by_id" uuid,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"author_id" uuid,
	"text" text NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_text_length" CHECK (char_length("messages"."text") <= 4096)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_kopecks" bigint DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'шт.' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price_kopecks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reply_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_plans_month_first_day" CHECK (extract(day from "sales_plans"."month") = 1),
	CONSTRAINT "sales_plans_amount_positive" CHECK ("sales_plans"."amount_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity" "view_entity" NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "custom" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "custom" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "requisites" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_fk" FOREIGN KEY ("workspace_id","owner_id") REFERENCES "public"."memberships"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_deal_fk" FOREIGN KEY ("workspace_id","deal_id") REFERENCES "public"."deals"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_memberships_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_fk" FOREIGN KEY ("workspace_id","deal_id") REFERENCES "public"."deals"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_id_memberships_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_memberships_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "public"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_templates" ADD CONSTRAINT "reply_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_plans" ADD CONSTRAINT "sales_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_plans" ADD CONSTRAINT "sales_plans_member_fk" FOREIGN KEY ("workspace_id","member_id") REFERENCES "public"."memberships"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_id_memberships_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_external_unique" ON "conversations" USING btree ("workspace_id","channel","external_id");--> statement-breakpoint
CREATE INDEX "conversations_workspace_last_idx" ON "conversations" USING btree ("workspace_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_client_idx" ON "conversations" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "conversations_deal_idx" ON "conversations" USING btree ("workspace_id","deal_id");--> statement-breakpoint
CREATE INDEX "custom_fields_workspace_idx" ON "custom_fields" USING btree ("workspace_id","entity","position");--> statement-breakpoint
CREATE INDEX "deal_items_deal_idx" ON "deal_items" USING btree ("workspace_id","deal_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_number_unique" ON "documents" USING btree ("workspace_id","kind","number");--> statement-breakpoint
CREATE INDEX "documents_deal_idx" ON "documents" USING btree ("workspace_id","deal_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "imports_workspace_idx" ON "imports" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("workspace_id","conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_external_unique" ON "messages" USING btree ("conversation_id","external_id");--> statement-breakpoint
CREATE INDEX "products_workspace_idx" ON "products" USING btree ("workspace_id","archived");--> statement-breakpoint
CREATE INDEX "reply_templates_workspace_idx" ON "reply_templates" USING btree ("workspace_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_plans_member_month_unique" ON "sales_plans" USING btree ("workspace_id","member_id","month");--> statement-breakpoint
CREATE INDEX "saved_views_workspace_idx" ON "saved_views" USING btree ("workspace_id","entity");