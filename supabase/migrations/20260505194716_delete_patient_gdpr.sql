CREATE OR REPLACE FUNCTION delete_patient_gdpr(patient_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Delete in correct order (respecting foreign keys)
  DELETE FROM whatsapp_messages WHERE patient_id = patient_uuid;
  DELETE FROM feedback WHERE patient_id = patient_uuid;
  DELETE FROM session_notes WHERE patient_id = patient_uuid;
  DELETE FROM consent_records WHERE patient_id = patient_uuid;
  DELETE FROM bookings WHERE patient_id = patient_uuid;
  DELETE FROM patient_activity_log WHERE patient_id = patient_uuid;
  DELETE FROM patients WHERE id = patient_uuid;
  
  -- Log the deletion in audit_log
  INSERT INTO audit_log (action, entity_type, entity_id, performed_by)
  VALUES ('GDPR_DELETE', 'patient', patient_uuid, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
