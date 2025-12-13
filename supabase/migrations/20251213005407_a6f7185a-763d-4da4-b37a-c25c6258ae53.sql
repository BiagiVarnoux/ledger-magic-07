-- Create audit log table for detailed change history
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own audit logs
CREATE POLICY "Users can create their own audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Viewers can read shared audit logs
CREATE POLICY "viewers_can_read_shared_audit_logs"
ON public.audit_log
FOR SELECT
USING (
  has_shared_access(auth.uid(), user_id) AND (
    SELECT shared_access.can_view_journal
    FROM shared_access
    WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = audit_log.user_id
    LIMIT 1
  )
);

-- Create index for faster queries
CREATE INDEX idx_audit_log_user_table ON public.audit_log(user_id, table_name);
CREATE INDEX idx_audit_log_record ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);