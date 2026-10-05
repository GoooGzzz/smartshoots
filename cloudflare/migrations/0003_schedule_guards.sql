CREATE TRIGGER appointment_end_insert BEFORE INSERT ON scheduling_appointment WHEN julianday(NEW.end_time)<=julianday(NEW.start_time) BEGIN SELECT RAISE(ABORT,'End time must follow start time'); END;
CREATE TRIGGER appointment_end_update BEFORE UPDATE ON scheduling_appointment WHEN julianday(NEW.end_time)<=julianday(NEW.start_time) BEGIN SELECT RAISE(ABORT,'End time must follow start time'); END;
CREATE TRIGGER resourceblock_conflict BEFORE INSERT ON scheduling_resourceblock BEGIN
 SELECT RAISE(ABORT,'Resource is already booked') WHERE EXISTS(SELECT 1 FROM scheduling_appointment a JOIN scheduling_appointment_resources r ON r.owner_id=a.id WHERE r.target_id=NEW.resource AND a.status IN ('pending','confirmed','in_progress') AND julianday(a.start_time)-((strftime('%H',a.buffer_before)*3600+strftime('%M',a.buffer_before)*60+strftime('%S',a.buffer_before))/86400.0)<julianday(NEW.end_time) AND julianday(a.end_time)+((strftime('%H',a.buffer_after)*3600+strftime('%M',a.buffer_after)*60+strftime('%S',a.buffer_after))/86400.0)>julianday(NEW.start_time));
END;
CREATE TRIGGER resourceblock_conflict_update BEFORE UPDATE ON scheduling_resourceblock BEGIN
 SELECT RAISE(ABORT,'Resource is already booked') WHERE EXISTS(SELECT 1 FROM scheduling_appointment a JOIN scheduling_appointment_resources r ON r.owner_id=a.id WHERE r.target_id=NEW.resource AND a.status IN ('pending','confirmed','in_progress') AND julianday(a.start_time)-((strftime('%H',a.buffer_before)*3600+strftime('%M',a.buffer_before)*60+strftime('%S',a.buffer_before))/86400.0)<julianday(NEW.end_time) AND julianday(a.end_time)+((strftime('%H',a.buffer_after)*3600+strftime('%M',a.buffer_after)*60+strftime('%S',a.buffer_after))/86400.0)>julianday(NEW.start_time));
END;
CREATE UNIQUE INDEX unique_phone_per_client ON accounts_phonenumber(client,phone);
CREATE UNIQUE INDEX unique_staff_evaluation_period ON accounts_staffevaluation(staff,month,year);
