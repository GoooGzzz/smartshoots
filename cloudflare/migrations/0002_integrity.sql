ALTER TABLE finance_payment ADD COLUMN amount_cents INTEGER GENERATED ALWAYS AS (CAST(REPLACE(amount,'.','') AS INTEGER)) VIRTUAL;
ALTER TABLE production_productionorder ADD COLUMN total_cents INTEGER GENERATED ALWAYS AS (CAST(REPLACE(total_amount,'.','') AS INTEGER)) VIRTUAL;
CREATE TRIGGER payment_client_insert BEFORE INSERT ON finance_payment BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM production_productionorder WHERE id=NEW."order" AND client=NEW.client AND status!='cancelled') THEN RAISE(ABORT,'Payment order/client mismatch or cancelled order') END;
END;
CREATE TRIGGER payment_client_update BEFORE UPDATE ON finance_payment BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM production_productionorder WHERE id=NEW."order" AND client=NEW.client AND status!='cancelled') THEN RAISE(ABORT,'Payment order/client mismatch or cancelled order') END;
END;
CREATE TRIGGER payment_insert AFTER INSERT ON finance_payment BEGIN
 UPDATE production_productionorder SET paid_amount=printf('%.2f',(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=NEW."order")/100.0) WHERE id=NEW."order";
 UPDATE finance_payment SET resulting_balance=(SELECT remaining_balance FROM production_productionorder WHERE id=NEW."order") WHERE id=NEW.id;
END;
CREATE TRIGGER payment_delete AFTER DELETE ON finance_payment BEGIN
 UPDATE production_productionorder SET paid_amount=printf('%.2f',(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=OLD."order")/100.0) WHERE id=OLD."order";
END;
CREATE TRIGGER payment_update AFTER UPDATE OF amount,"order" ON finance_payment BEGIN
 UPDATE production_productionorder SET paid_amount=printf('%.2f',(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=OLD."order")/100.0) WHERE id=OLD."order";
 UPDATE production_productionorder SET paid_amount=printf('%.2f',(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=NEW."order")/100.0) WHERE id=NEW."order";
 UPDATE finance_payment SET resulting_balance=(SELECT remaining_balance FROM production_productionorder WHERE id=NEW."order") WHERE id=NEW.id;
END;
CREATE TRIGGER order_balance AFTER UPDATE OF paid_amount,total_amount,status ON production_productionorder BEGIN
 UPDATE production_productionorder SET remaining_balance=printf('%.2f',(NEW.total_cents-CAST(REPLACE(NEW.paid_amount,'.','') AS INTEGER))/100.0),is_financially_closed=(NEW.total_cents<=CAST(REPLACE(NEW.paid_amount,'.','') AS INTEGER) AND NEW.status IN ('delivered','closed')) WHERE id=NEW.id;
END;
CREATE TRIGGER order_client_update BEFORE UPDATE OF client ON production_productionorder WHEN NEW.client!=OLD.client BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_payment WHERE "order"=OLD.id) THEN RAISE(ABORT,'Cannot change client of an order with payments') END;
END;
CREATE TRIGGER appointment_resource_insert BEFORE INSERT ON scheduling_appointment_resources BEGIN
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM scheduling_appointment a JOIN scheduling_appointment b ON b.id!=a.id JOIN scheduling_appointment_resources r ON r.owner_id=b.id AND r.target_id=NEW.target_id
 WHERE a.id=NEW.owner_id AND a.status IN ('pending','confirmed','in_progress') AND b.status IN ('pending','confirmed','in_progress')
 AND julianday(a.start_time)-((strftime('%H',a.buffer_before)*3600+strftime('%M',a.buffer_before)*60+strftime('%S',a.buffer_before))/86400.0)<julianday(b.end_time)+((strftime('%H',b.buffer_after)*3600+strftime('%M',b.buffer_after)*60+strftime('%S',b.buffer_after))/86400.0)
 AND julianday(a.end_time)+((strftime('%H',a.buffer_after)*3600+strftime('%M',a.buffer_after)*60+strftime('%S',a.buffer_after))/86400.0)>julianday(b.start_time)-((strftime('%H',b.buffer_before)*3600+strftime('%M',b.buffer_before)*60+strftime('%S',b.buffer_before))/86400.0)
 ) THEN RAISE(ABORT,'Resource is already booked including buffers') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM scheduling_appointment a JOIN scheduling_resourceblock b ON b.resource=NEW.target_id WHERE a.id=NEW.owner_id AND a.status IN ('pending','confirmed','in_progress') AND julianday(a.start_time)-((strftime('%H',a.buffer_before)*3600+strftime('%M',a.buffer_before)*60+strftime('%S',a.buffer_before))/86400.0)<julianday(b.end_time) AND julianday(a.end_time)+((strftime('%H',a.buffer_after)*3600+strftime('%M',a.buffer_after)*60+strftime('%S',a.buffer_after))/86400.0)>julianday(b.start_time)) THEN RAISE(ABORT,'Resource is blocked') END;
END;
CREATE TRIGGER payment_limit_insert BEFORE INSERT ON finance_payment BEGIN
 SELECT CASE WHEN NEW.amount_cents+(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=NEW."order")>(SELECT total_cents FROM production_productionorder WHERE id=NEW."order") THEN RAISE(ABORT,'Payment exceeds order total') END;
END;
CREATE TRIGGER payment_limit_update BEFORE UPDATE OF amount,"order" ON finance_payment BEGIN
 SELECT CASE WHEN NEW.amount_cents+(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=NEW."order" AND id!=OLD.id)>(SELECT total_cents FROM production_productionorder WHERE id=NEW."order") THEN RAISE(ABORT,'Payment exceeds order total') END;
END;
CREATE TRIGGER order_limit_update BEFORE UPDATE OF total_amount ON production_productionorder BEGIN
 SELECT CASE WHEN CAST(REPLACE(NEW.total_amount,'.','') AS INTEGER)<(SELECT COALESCE(SUM(amount_cents),0) FROM finance_payment WHERE "order"=OLD.id) THEN RAISE(ABORT,'Order total is below collected payments') END;
END;
