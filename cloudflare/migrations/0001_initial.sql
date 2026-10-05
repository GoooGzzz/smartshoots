CREATE TABLE accounts_user (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "first_name" TEXT NOT NULL,
 "last_name" TEXT NOT NULL,
 "user_id" TEXT NOT NULL UNIQUE,
 "role" TEXT NOT NULL CHECK ("role" IN ('owner','admin','manager','staff')),
 "phone" TEXT NOT NULL,
 "avatar" TEXT,
 "language_preference" TEXT NOT NULL CHECK ("language_preference" IN ('en','ar')),
 "theme_preference" TEXT NOT NULL CHECK ("theme_preference" IN ('light','dark')),
 "is_active_staff" INTEGER NOT NULL CHECK ("is_active_staff" IN (0,1)),
 "username" TEXT NOT NULL UNIQUE,
 "email" TEXT NOT NULL,
 "password" TEXT NOT NULL,
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1))
);
CREATE TABLE accounts_clienttag (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "tag_id" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL UNIQUE,
 "color" TEXT NOT NULL
);
CREATE TABLE accounts_client (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "client_id" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "type" TEXT NOT NULL CHECK ("type" IN ('doctor','teacher','professor','lab','other')),
 "category" TEXT NOT NULL CHECK ("category" IN ('academic','business')),
 "primary_phone" TEXT NOT NULL,
 "email" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "address" TEXT NOT NULL,
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL,
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1))
);
CREATE TABLE accounts_client_tags (owner_id INTEGER NOT NULL REFERENCES accounts_client(id) ON DELETE CASCADE, target_id INTEGER NOT NULL REFERENCES accounts_clienttag(id) ON DELETE CASCADE, PRIMARY KEY(owner_id,target_id));
CREATE INDEX idx_accounts_client_created_by ON accounts_client("created_by");
CREATE INDEX idx_accounts_client_created_at ON accounts_client("created_at");
CREATE INDEX idx_accounts_client_updated_at ON accounts_client("updated_at");
CREATE TABLE accounts_phonenumber (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "client" INTEGER NOT NULL REFERENCES accounts_client(id) ON DELETE CASCADE,
 "phone" TEXT NOT NULL,
 "label" TEXT NOT NULL,
 "is_whatsapp" INTEGER NOT NULL CHECK ("is_whatsapp" IN (0,1))
);
CREATE INDEX idx_accounts_phonenumber_client ON accounts_phonenumber("client");
CREATE TABLE accounts_staffmember (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "staff_id" TEXT NOT NULL UNIQUE,
 "user" INTEGER NOT NULL UNIQUE REFERENCES accounts_user(id) ON DELETE CASCADE,
 "role" TEXT NOT NULL CHECK ("role" IN ('editor','camera_operator','assistant','manager')),
 "hourly_rate" TEXT,
 "monthly_salary" TEXT,
 "hire_date" TEXT NOT NULL,
 "skills" TEXT NOT NULL,
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1))
);
CREATE INDEX idx_accounts_staffmember_user ON accounts_staffmember("user");
CREATE INDEX idx_accounts_staffmember_hire_date ON accounts_staffmember("hire_date");
CREATE TABLE accounts_staffevaluation (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "evaluation_id" TEXT NOT NULL UNIQUE,
 "staff" INTEGER NOT NULL REFERENCES accounts_staffmember(id) ON DELETE CASCADE,
 "evaluation_date" TEXT NOT NULL,
 "month" INTEGER NOT NULL,
 "year" INTEGER NOT NULL,
 "completed_assignments" INTEGER NOT NULL,
 "late_assignments" INTEGER NOT NULL,
 "quality_score" TEXT NOT NULL,
 "reliability_score" TEXT NOT NULL,
 "teamwork_score" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_accounts_staffevaluation_staff ON accounts_staffevaluation("staff");
CREATE INDEX idx_accounts_staffevaluation_evaluation_date ON accounts_staffevaluation("evaluation_date");
CREATE INDEX idx_accounts_staffevaluation_created_by ON accounts_staffevaluation("created_by");
CREATE INDEX idx_accounts_staffevaluation_created_at ON accounts_staffevaluation("created_at");
CREATE TABLE production_package (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "package_id" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "type" TEXT NOT NULL CHECK ("type" IN ('hourly_learning','per_minute_reels','outdoor_shoot')),
 "description" TEXT NOT NULL,
 "default_rate" TEXT NOT NULL,
 "unit" TEXT NOT NULL CHECK ("unit" IN ('hour','minute','session')),
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)),
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_production_package_created_at ON production_package("created_at");
CREATE TABLE production_productionorder (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "order_id" TEXT NOT NULL UNIQUE,
 "order_number" TEXT NOT NULL UNIQUE,
 "client" INTEGER NOT NULL REFERENCES accounts_client(id) ON DELETE RESTRICT,
 "package" INTEGER NOT NULL REFERENCES production_package(id) ON DELETE RESTRICT,
 "quantity" TEXT NOT NULL,
 "rate" TEXT NOT NULL,
 "total_amount" TEXT NOT NULL,
 "paid_amount" TEXT NOT NULL,
 "remaining_balance" TEXT NOT NULL,
 "status" TEXT NOT NULL CHECK ("status" IN ('draft','pending','in_progress','completed','delivered','closed','cancelled')),
 "order_date" TEXT NOT NULL,
 "delivery_date" TEXT,
 "requirements" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "is_financially_closed" INTEGER NOT NULL CHECK ("is_financially_closed" IN (0,1)),
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL
);
CREATE INDEX idx_production_productionorder_client ON production_productionorder("client");
CREATE INDEX idx_production_productionorder_package ON production_productionorder("package");
CREATE INDEX idx_production_productionorder_order_date ON production_productionorder("order_date");
CREATE INDEX idx_production_productionorder_delivery_date ON production_productionorder("delivery_date");
CREATE INDEX idx_production_productionorder_created_by ON production_productionorder("created_by");
CREATE INDEX idx_production_productionorder_created_at ON production_productionorder("created_at");
CREATE INDEX idx_production_productionorder_updated_at ON production_productionorder("updated_at");
CREATE TABLE production_productionassignment (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "assignment_id" TEXT NOT NULL UNIQUE,
 "order" INTEGER NOT NULL REFERENCES production_productionorder(id) ON DELETE CASCADE,
 "staff" INTEGER NOT NULL REFERENCES accounts_staffmember(id) ON DELETE RESTRICT,
 "role" TEXT NOT NULL,
 "assigned_date" TEXT NOT NULL,
 "deadline" TEXT NOT NULL,
 "completed_date" TEXT,
 "status" TEXT NOT NULL CHECK ("status" IN ('pending','in_progress','completed','late','cancelled')),
 "notes" TEXT NOT NULL
);
CREATE INDEX idx_production_productionassignment_order ON production_productionassignment("order");
CREATE INDEX idx_production_productionassignment_staff ON production_productionassignment("staff");
CREATE INDEX idx_production_productionassignment_assigned_date ON production_productionassignment("assigned_date");
CREATE INDEX idx_production_productionassignment_deadline ON production_productionassignment("deadline");
CREATE INDEX idx_production_productionassignment_completed_date ON production_productionassignment("completed_date");
CREATE TABLE production_delivery (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "delivery_id" TEXT NOT NULL UNIQUE,
 "order" INTEGER NOT NULL UNIQUE REFERENCES production_productionorder(id) ON DELETE CASCADE,
 "delivery_date" TEXT NOT NULL,
 "client_received_date" TEXT,
 "method" TEXT NOT NULL CHECK ("method" IN ('google_drive','dropbox','we_transfer','physical','direct_link','other')),
 "delivery_link" TEXT NOT NULL,
 "status" TEXT NOT NULL CHECK ("status" IN ('pending','sent','received','failed')),
 "notes" TEXT NOT NULL,
 "is_financially_closed" INTEGER NOT NULL CHECK ("is_financially_closed" IN (0,1)),
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_production_delivery_order ON production_delivery("order");
CREATE INDEX idx_production_delivery_delivery_date ON production_delivery("delivery_date");
CREATE INDEX idx_production_delivery_client_received_date ON production_delivery("client_received_date");
CREATE INDEX idx_production_delivery_created_by ON production_delivery("created_by");
CREATE INDEX idx_production_delivery_created_at ON production_delivery("created_at");
CREATE TABLE production_timelog (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "log_id" TEXT NOT NULL UNIQUE,
 "order" INTEGER NOT NULL REFERENCES production_productionorder(id) ON DELETE CASCADE,
 "staff" INTEGER NOT NULL REFERENCES accounts_staffmember(id) ON DELETE RESTRICT,
 "hours" TEXT NOT NULL,
 "work_date" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_production_timelog_order ON production_timelog("order");
CREATE INDEX idx_production_timelog_staff ON production_timelog("staff");
CREATE INDEX idx_production_timelog_work_date ON production_timelog("work_date");
CREATE INDEX idx_production_timelog_created_at ON production_timelog("created_at");
CREATE TABLE scheduling_resource (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "resource_id" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "type" TEXT NOT NULL CHECK ("type" IN ('staff','equipment','venue','vehicle')),
 "description" TEXT NOT NULL,
 "hourly_rate" TEXT,
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)),
 "color" TEXT NOT NULL,
 "capacity" INTEGER NOT NULL
);
CREATE TABLE scheduling_appointment (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "appointment_id" TEXT NOT NULL UNIQUE,
 "client" INTEGER NOT NULL REFERENCES accounts_client(id) ON DELETE RESTRICT,
 "project" INTEGER REFERENCES production_productionorder(id) ON DELETE SET NULL,
 "start_time" TEXT NOT NULL,
 "end_time" TEXT NOT NULL,
 "duration" TEXT NOT NULL,
 "status" TEXT NOT NULL CHECK ("status" IN ('pending','confirmed','in_progress','completed','cancelled','no_show')),
 "location" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "buffer_before" TEXT NOT NULL,
 "buffer_after" TEXT NOT NULL,
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL
);
CREATE INDEX idx_scheduling_appointment_client ON scheduling_appointment("client");
CREATE INDEX idx_scheduling_appointment_project ON scheduling_appointment("project");
CREATE TABLE scheduling_appointment_resources (owner_id INTEGER NOT NULL REFERENCES scheduling_appointment(id) ON DELETE CASCADE, target_id INTEGER NOT NULL REFERENCES scheduling_resource(id) ON DELETE CASCADE, PRIMARY KEY(owner_id,target_id));
CREATE INDEX idx_scheduling_appointment_start_time ON scheduling_appointment("start_time");
CREATE INDEX idx_scheduling_appointment_end_time ON scheduling_appointment("end_time");
CREATE INDEX idx_scheduling_appointment_created_by ON scheduling_appointment("created_by");
CREATE INDEX idx_scheduling_appointment_created_at ON scheduling_appointment("created_at");
CREATE INDEX idx_scheduling_appointment_updated_at ON scheduling_appointment("updated_at");
CREATE TABLE scheduling_resourceblock (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "resource" INTEGER NOT NULL REFERENCES scheduling_resource(id) ON DELETE CASCADE,
 "start_time" TEXT NOT NULL,
 "end_time" TEXT NOT NULL,
 "block_type" TEXT NOT NULL CHECK ("block_type" IN ('maintenance','vacation','holiday','other')),
 "reason" TEXT NOT NULL,
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT
);
CREATE INDEX idx_scheduling_resourceblock_resource ON scheduling_resourceblock("resource");
CREATE INDEX idx_scheduling_resourceblock_start_time ON scheduling_resourceblock("start_time");
CREATE INDEX idx_scheduling_resourceblock_end_time ON scheduling_resourceblock("end_time");
CREATE INDEX idx_scheduling_resourceblock_created_by ON scheduling_resourceblock("created_by");
CREATE TABLE finance_payment (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "payment_id" TEXT NOT NULL UNIQUE,
 "order" INTEGER NOT NULL REFERENCES production_productionorder(id) ON DELETE RESTRICT,
 "client" INTEGER NOT NULL REFERENCES accounts_client(id) ON DELETE RESTRICT,
 "amount" TEXT NOT NULL,
 "payment_date" TEXT NOT NULL,
 "method" TEXT NOT NULL CHECK ("method" IN ('vodafone_cash','instapay','cash')),
 "reference" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "is_deposit" INTEGER NOT NULL CHECK ("is_deposit" IN (0,1)),
 "resulting_balance" TEXT NOT NULL,
 "recorded_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_finance_payment_order ON finance_payment("order");
CREATE INDEX idx_finance_payment_client ON finance_payment("client");
CREATE INDEX idx_finance_payment_payment_date ON finance_payment("payment_date");
CREATE INDEX idx_finance_payment_recorded_by ON finance_payment("recorded_by");
CREATE INDEX idx_finance_payment_created_at ON finance_payment("created_at");
CREATE TABLE finance_expensecategory (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "category_id" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "category_type" TEXT NOT NULL CHECK ("category_type" IN ('internet','office_rent','electricity','custom')),
 "description" TEXT NOT NULL,
 "is_recurring" INTEGER NOT NULL CHECK ("is_recurring" IN (0,1)),
 "recurring_interval" TEXT CHECK ("recurring_interval" IN ('daily','weekly','monthly','quarterly','yearly')),
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)),
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_finance_expensecategory_created_by ON finance_expensecategory("created_by");
CREATE INDEX idx_finance_expensecategory_created_at ON finance_expensecategory("created_at");
CREATE TABLE finance_expense (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "expense_id" TEXT NOT NULL UNIQUE,
 "category" INTEGER NOT NULL REFERENCES finance_expensecategory(id) ON DELETE RESTRICT,
 "method" TEXT NOT NULL CHECK ("method" IN ('purchasing','withdraw')),
 "amount" TEXT NOT NULL,
 "expense_date" TEXT NOT NULL,
 "description" TEXT NOT NULL,
 "receipt" TEXT,
 "is_recurring" INTEGER NOT NULL CHECK ("is_recurring" IN (0,1)),
 "created_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_finance_expense_category ON finance_expense("category");
CREATE INDEX idx_finance_expense_expense_date ON finance_expense("expense_date");
CREATE INDEX idx_finance_expense_created_by ON finance_expense("created_by");
CREATE INDEX idx_finance_expense_created_at ON finance_expense("created_at");
CREATE TABLE finance_attachment (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "attachment_id" TEXT NOT NULL UNIQUE,
 "client" INTEGER REFERENCES accounts_client(id) ON DELETE CASCADE,
 "order" INTEGER REFERENCES production_productionorder(id) ON DELETE CASCADE,
 "file" TEXT NOT NULL,
 "filename" TEXT NOT NULL,
 "file_type" TEXT NOT NULL,
 "file_size" INTEGER NOT NULL,
 "description" TEXT NOT NULL,
 "is_shareable" INTEGER NOT NULL CHECK ("is_shareable" IN (0,1)),
 "share_token" TEXT NOT NULL UNIQUE,
 "uploaded_by" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 "uploaded_at" TEXT NOT NULL
);
CREATE INDEX idx_finance_attachment_client ON finance_attachment("client");
CREATE INDEX idx_finance_attachment_order ON finance_attachment("order");
CREATE INDEX idx_finance_attachment_uploaded_by ON finance_attachment("uploaded_by");
CREATE INDEX idx_finance_attachment_uploaded_at ON finance_attachment("uploaded_at");
CREATE TABLE finance_businesssettings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "business_id" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "logo" TEXT,
 "currency" TEXT NOT NULL,
 "timezone" TEXT NOT NULL,
 "language" TEXT NOT NULL CHECK ("language" IN ('en','ar')),
 "theme" TEXT NOT NULL CHECK ("theme" IN ('light','dark')),
 "address" TEXT NOT NULL,
 "phone" TEXT NOT NULL,
 "email" TEXT NOT NULL,
 "website" TEXT NOT NULL,
 "tax_number" TEXT NOT NULL,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL
);
CREATE INDEX idx_finance_businesssettings_created_at ON finance_businesssettings("created_at");
CREATE INDEX idx_finance_businesssettings_updated_at ON finance_businesssettings("updated_at");
CREATE TABLE toolkit_scripttemplate (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "template_id" TEXT NOT NULL UNIQUE,
 "category" TEXT NOT NULL CHECK ("category" IN ('cold_outreach','follow_up','quote_pricing','objection_handling','renewal','referral','social_caption')),
 "title" TEXT NOT NULL,
 "body" TEXT NOT NULL,
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)),
 "created_by" INTEGER REFERENCES accounts_user(id) ON DELETE SET NULL,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL
);
CREATE INDEX idx_toolkit_scripttemplate_created_by ON toolkit_scripttemplate("created_by");
CREATE INDEX idx_toolkit_scripttemplate_created_at ON toolkit_scripttemplate("created_at");
CREATE INDEX idx_toolkit_scripttemplate_updated_at ON toolkit_scripttemplate("updated_at");
CREATE TABLE toolkit_reportdraft (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "token" TEXT NOT NULL UNIQUE,
 "title" TEXT NOT NULL,
 "category" TEXT NOT NULL CHECK ("category" IN ('medical','multi_category','business','education','custom')),
 "description" TEXT NOT NULL,
 "file" TEXT NOT NULL,
 "file_type" TEXT NOT NULL CHECK ("file_type" IN ('html','doc','docx')),
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)),
 "view_count" INTEGER NOT NULL,
 "created_by" INTEGER REFERENCES accounts_user(id) ON DELETE SET NULL,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL
);
CREATE INDEX idx_toolkit_reportdraft_created_by ON toolkit_reportdraft("created_by");
CREATE INDEX idx_toolkit_reportdraft_created_at ON toolkit_reportdraft("created_at");
CREATE INDEX idx_toolkit_reportdraft_updated_at ON toolkit_reportdraft("updated_at");
CREATE TABLE toolkit_serviceprofile (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "profile_id" TEXT NOT NULL UNIQUE,
 "client_type" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "typical_needs" TEXT NOT NULL,
 "suggested_script" INTEGER REFERENCES toolkit_scripttemplate(id) ON DELETE SET NULL,
 "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)),
 "created_by" INTEGER REFERENCES accounts_user(id) ON DELETE SET NULL,
 "created_at" TEXT NOT NULL,
 "updated_at" TEXT NOT NULL
);
CREATE TABLE toolkit_serviceprofile_recommended_packages (owner_id INTEGER NOT NULL REFERENCES toolkit_serviceprofile(id) ON DELETE CASCADE, target_id INTEGER NOT NULL REFERENCES production_package(id) ON DELETE CASCADE, PRIMARY KEY(owner_id,target_id));
CREATE INDEX idx_toolkit_serviceprofile_suggested_script ON toolkit_serviceprofile("suggested_script");
CREATE INDEX idx_toolkit_serviceprofile_created_by ON toolkit_serviceprofile("created_by");
CREATE INDEX idx_toolkit_serviceprofile_created_at ON toolkit_serviceprofile("created_at");
CREATE INDEX idx_toolkit_serviceprofile_updated_at ON toolkit_serviceprofile("updated_at");
CREATE TABLE notifications_notification (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "notification_id" TEXT NOT NULL UNIQUE,
 "user" INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
 "type" TEXT NOT NULL CHECK ("type" IN ('schedule_conflict','upcoming_session','new_deposit','outstanding_balance','pending_production','delivery_status','operational_reminder')),
 "title" TEXT NOT NULL,
 "title_ar" TEXT NOT NULL,
 "message" TEXT NOT NULL,
 "message_ar" TEXT NOT NULL,
 "deep_link" TEXT NOT NULL,
 "idempotency_key" TEXT NOT NULL UNIQUE,
 "is_read" INTEGER NOT NULL CHECK ("is_read" IN (0,1)),
 "read_at" TEXT,
 "metadata" TEXT NOT NULL,
 "created_at" TEXT NOT NULL
);
CREATE INDEX idx_notifications_notification_user ON notifications_notification("user");
CREATE INDEX idx_notifications_notification_read_at ON notifications_notification("read_at");
CREATE INDEX idx_notifications_notification_created_at ON notifications_notification("created_at");
CREATE TABLE notifications_notificationpreference (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "user" INTEGER NOT NULL UNIQUE REFERENCES accounts_user(id) ON DELETE CASCADE,
 "enable_browser" INTEGER NOT NULL CHECK ("enable_browser" IN (0,1)),
 "enable_pwa" INTEGER NOT NULL CHECK ("enable_pwa" IN (0,1)),
 "email_notifications" INTEGER NOT NULL CHECK ("email_notifications" IN (0,1)),
 "schedule_conflicts" INTEGER NOT NULL CHECK ("schedule_conflicts" IN (0,1)),
 "upcoming_sessions" INTEGER NOT NULL CHECK ("upcoming_sessions" IN (0,1)),
 "new_deposits" INTEGER NOT NULL CHECK ("new_deposits" IN (0,1)),
 "outstanding_balances" INTEGER NOT NULL CHECK ("outstanding_balances" IN (0,1)),
 "pending_production" INTEGER NOT NULL CHECK ("pending_production" IN (0,1)),
 "delivery_status" INTEGER NOT NULL CHECK ("delivery_status" IN (0,1)),
 "operational_reminders" INTEGER NOT NULL CHECK ("operational_reminders" IN (0,1))
);
CREATE INDEX idx_notifications_notificationpreference_user ON notifications_notificationpreference("user");
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, record_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE restore_lock (id INTEGER PRIMARY KEY CHECK(id=1));

CREATE TABLE setup_lock (id INTEGER PRIMARY KEY CHECK(id=1));
CREATE TABLE import_guard (id INTEGER PRIMARY KEY CHECK(id=1));
