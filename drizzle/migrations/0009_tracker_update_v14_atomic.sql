ALTER TABLE public.action_tracker ALTER COLUMN due_date DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.tracker_update_v14(p_updates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
 item jsonb; patch jsonb; identity jsonb; before_row jsonb; after_row jsonb;
 rec public.action_tracker%ROWTYPE; matched boolean; field text; changed jsonb; unchanged jsonb; mismatches jsonb;
 snapshots jsonb := '[]'; results jsonb := '[]'; affected integer := 0; missed integer := 0; mismatch_count integer := 0;
 effective_status text; effective_note text;
BEGIN
 IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_updates) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'UPDATE needs 1-50 updates' USING ERRCODE='22023'; END IF;
 -- Lock every existing target in stable order before validating row-dependent rules.
 PERFORM a.id FROM public.action_tracker a WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(p_updates) u WHERE (u->'identity' ? 'id' AND a.id=(u->'identity'->>'id')::uuid) OR (NOT (u->'identity' ? 'id') AND a.dedupe_key=u->'identity'->>'dedupe_key')) ORDER BY a.id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(p_updates) LOOP
  identity:=item->'identity'; patch:=item->'body';
  IF jsonb_typeof(identity) IS DISTINCT FROM 'object' OR jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('identity','body')) OR EXISTS (SELECT 1 FROM jsonb_object_keys(identity) k WHERE k NOT IN ('id','dedupe_key')) OR NOT (identity ? 'id' OR identity ? 'dedupe_key') THEN RAISE EXCEPTION 'Invalid update identity' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('status','summary','context','due_date','priority','resolution_note','source_ref','apply_target','staged_payload')) THEN RAISE EXCEPTION 'Unknown update field' USING ERRCODE='22023'; END IF;
  IF patch ? 'status' AND (patch->>'status' IS NULL OR patch->>'status' NOT IN ('OPEN','CONFIRMED','DISMISSED')) THEN RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023'; END IF;
  IF patch ? 'priority' AND (patch->>'priority' IS NULL OR patch->>'priority' NOT IN ('HIGH','MEDIUM','LOW')) THEN RAISE EXCEPTION 'Invalid priority' USING ERRCODE='22023'; END IF;
  IF patch ? 'summary' AND (jsonb_typeof(patch->'summary') IS DISTINCT FROM 'string' OR length(btrim(patch->>'summary'))=0 OR length(patch->>'summary')>2000) THEN RAISE EXCEPTION 'Invalid summary' USING ERRCODE='22023'; END IF;
  FOREACH field IN ARRAY ARRAY['context','resolution_note','source_ref'] LOOP
   IF patch ? field AND patch->field <> 'null'::jsonb AND (jsonb_typeof(patch->field) <> 'string' OR length(patch->>field)>CASE WHEN field='source_ref' THEN 300 ELSE 4000 END) THEN RAISE EXCEPTION 'Invalid %',field USING ERRCODE='22023'; END IF;
  END LOOP;
  IF patch ? 'due_date' AND patch->'due_date' <> 'null'::jsonb THEN
   IF jsonb_typeof(patch->'due_date') <> 'string' OR patch->>'due_date' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid due_date' USING ERRCODE='22023'; END IF;
   PERFORM (patch->>'due_date')::date;
  END IF;
  IF (patch ? 'apply_target') <> (patch ? 'staged_payload') THEN RAISE EXCEPTION 'Staged fields must be paired' USING ERRCODE='22023'; END IF;
  IF patch ? 'apply_target' AND ((patch->'apply_target'='null'::jsonb) <> (patch->'staged_payload'='null'::jsonb) OR (patch->'apply_target'<>'null'::jsonb AND (patch->>'apply_target' NOT IN ('UPDATE_ROW','RC_QUEUE','TRADE_TICKET','NONE') OR jsonb_typeof(patch->'staged_payload')<>'object' OR patch->'staged_payload'->'v' IS DISTINCT FROM '1'::jsonb OR octet_length((patch->'staged_payload')::text)>32768))) THEN RAISE EXCEPTION 'Invalid staged fields' USING ERRCODE='22023'; END IF;
  SELECT a.* INTO rec FROM public.action_tracker a WHERE CASE WHEN identity ? 'id' THEN a.id=(identity->>'id')::uuid ELSE a.dedupe_key=identity->>'dedupe_key' END;
  matched:=FOUND;
  IF NOT matched THEN snapshots:=snapshots || jsonb_build_array(jsonb_build_object('identity',identity,'body',patch,'matched',false)); CONTINUE; END IF;
  before_row:=to_jsonb(rec); effective_status:=CASE WHEN patch ? 'status' THEN patch->>'status' ELSE rec.status END;
  effective_note:=CASE WHEN patch ? 'resolution_note' THEN patch->>'resolution_note' ELSE rec.resolution_note END;
  IF effective_status IN ('CONFIRMED','DISMISSED') AND (effective_note IS NULL OR length(btrim(effective_note))=0) THEN RAISE EXCEPTION 'CONFIRMED/DISMISSED requires resolution_note on request or row' USING ERRCODE='22023'; END IF;
  UPDATE public.action_tracker a SET
   status=effective_status,
   summary=CASE WHEN patch ? 'summary' THEN patch->>'summary' ELSE a.summary END,
   context=CASE WHEN patch ? 'context' THEN patch->>'context' ELSE a.context END,
   due_date=CASE WHEN patch ? 'due_date' THEN (patch->>'due_date')::date ELSE a.due_date END,
   priority=CASE WHEN patch ? 'priority' THEN patch->>'priority' ELSE a.priority END,
   resolution_note=effective_note,
   source_ref=CASE WHEN patch ? 'source_ref' THEN patch->>'source_ref' ELSE a.source_ref END,
   apply_target=CASE WHEN patch ? 'apply_target' THEN patch->>'apply_target' ELSE a.apply_target END,
   staged_payload=CASE WHEN patch ? 'staged_payload' THEN NULLIF(patch->'staged_payload','null'::jsonb) ELSE a.staged_payload END,
   resolved_at=CASE WHEN patch->>'status'='OPEN' THEN NULL WHEN patch ? 'status' AND effective_status IN ('CONFIRMED','DISMISSED') AND effective_status IS DISTINCT FROM a.status THEN now() ELSE a.resolved_at END,
   updated_at=now()
  WHERE a.id=rec.id;
  snapshots:=snapshots || jsonb_build_array(jsonb_build_object('identity',identity,'body',patch,'matched',true,'before',before_row,'id',rec.id));
 END LOOP;
 -- Fresh SELECTs after the entire batch, including triggers and any repeated targets.
 FOR item IN SELECT value FROM jsonb_array_elements(snapshots) LOOP
  identity:=item->'identity'; patch:=item->'body'; changed:='[]'; unchanged:='[]'; mismatches:='[]';
  IF item->>'matched'='false' THEN
   missed:=missed+1;
   results:=results || jsonb_build_array(jsonb_build_object('id',identity->>'id','dedupe_key',identity->>'dedupe_key','status',null,'due_date',null,'matched',false,'changed_fields',changed,'unchanged_fields',unchanged,'mismatched_fields',mismatches)); CONTINUE;
  END IF;
  SELECT to_jsonb(a) INTO after_row FROM public.action_tracker a WHERE a.id=(item->>'id')::uuid;
  FOR field IN SELECT jsonb_object_keys(patch) LOOP
   IF after_row->field IS DISTINCT FROM patch->field THEN mismatches:=mismatches || to_jsonb(field);
   ELSIF item->'before'->field IS DISTINCT FROM after_row->field THEN changed:=changed || to_jsonb(field);
   ELSE unchanged:=unchanged || to_jsonb(field); END IF;
  END LOOP;
  IF patch->>'status'='OPEN' AND after_row->'resolved_at' IS DISTINCT FROM 'null'::jsonb THEN mismatches:=mismatches || '"resolved_at"'::jsonb; END IF;
  IF patch->>'status' IN ('CONFIRMED','DISMISSED') AND patch->>'status' IS DISTINCT FROM item->'before'->>'status' AND (after_row->>'resolved_at')::timestamptz IS DISTINCT FROM now() THEN mismatches:=mismatches || '"resolved_at"'::jsonb; END IF;
  IF jsonb_array_length(mismatches)=0 THEN affected:=affected+1; ELSE mismatch_count:=mismatch_count+1; END IF;
  results:=results || jsonb_build_array(jsonb_build_object('id',after_row->>'id','dedupe_key',after_row->>'dedupe_key','status',after_row->>'status','due_date',after_row->>'due_date','matched',true,'changed_fields',changed,'unchanged_fields',unchanged,'mismatched_fields',mismatches));
 END LOOP;
 RETURN jsonb_build_object('version','v1.4','mode','UPDATE','status',CASE WHEN missed+mismatch_count>0 THEN 'PARTIAL' ELSE 'success' END,'requested',jsonb_array_length(p_updates),'affected',affected,'mismatched',mismatch_count,'unmatched',missed,'rows',results,'note',CASE WHEN missed+mismatch_count>0 THEN 'One or more updates unmatched or sent fields did not persist' ELSE 'Every sent field verified after the batch' END);
END $$;
REVOKE ALL ON FUNCTION public.tracker_update_v14(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_update_v14(jsonb) TO service_role;