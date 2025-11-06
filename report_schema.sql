-- ============================================
-- REPORT GENERATION SYSTEM TABLES
-- ============================================
-- Run this script in Supabase SQL Editor after running supabase_setup.sql and class_management_schema.sql
-- This adds report generation functionality

-- Step 1: Create report_queue table
CREATE TABLE IF NOT EXISTS public.report_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('student', 'class', 'subject', 'term', 'exam')),
  report_config JSONB NOT NULL, -- Stores parameters like student_id, class_id, date_range, etc.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_path TEXT, -- Path to generated file in storage
  file_format TEXT CHECK (file_format IN ('pdf', 'csv')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE -- For cleanup of old reports
);

-- Step 2: Create export_meta table
CREATE TABLE IF NOT EXISTS public.export_meta (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_queue_id UUID REFERENCES public.report_queue(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'csv', 'zip')),
  file_format TEXT, -- Additional format info (e.g., 'detailed', 'concise')
  file_size_bytes BIGINT,
  download_count INTEGER DEFAULT 0,
  share_token TEXT UNIQUE, -- For secure share links
  share_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_downloaded_at TIMESTAMP WITH TIME ZONE
);

-- Step 3: Create template_definitions table
CREATE TABLE IF NOT EXISTS public.template_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('student', 'class', 'subject', 'term', 'exam')),
  branding_config JSONB, -- logo_url, colors, watermark, etc.
  layout_config JSONB, -- format_style (concise/detailed), layout_preset, etc.
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, template_name, template_type)
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_report_queue_created_by ON public.report_queue(created_by);
CREATE INDEX IF NOT EXISTS idx_report_queue_status ON public.report_queue(status);
CREATE INDEX IF NOT EXISTS idx_report_queue_report_type ON public.report_queue(report_type);
CREATE INDEX IF NOT EXISTS idx_report_queue_created_at ON public.report_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_export_meta_report_queue_id ON public.export_meta(report_queue_id);
CREATE INDEX IF NOT EXISTS idx_export_meta_share_token ON public.export_meta(share_token);
CREATE INDEX IF NOT EXISTS idx_template_definitions_teacher_id ON public.template_definitions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_template_definitions_template_type ON public.template_definitions(template_type);

-- Step 5: Enable Row Level Security
ALTER TABLE public.report_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_definitions ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for report_queue
DROP POLICY IF EXISTS "Teachers can manage their own report queue" ON public.report_queue;
CREATE POLICY "Teachers can manage their own report queue"
  ON public.report_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
      AND report_queue.created_by = auth.uid()
    )
  );

-- Step 7: RLS Policies for export_meta
DROP POLICY IF EXISTS "Users can view export meta for their reports" ON public.export_meta;
CREATE POLICY "Users can view export meta for their reports"
  ON public.export_meta
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.report_queue
      WHERE report_queue.id = export_meta.report_queue_id
      AND report_queue.created_by = auth.uid()
    )
    OR
    -- Allow access via share token (will be checked in application logic)
    share_token IS NOT NULL
  );

DROP POLICY IF EXISTS "Teachers can manage export meta for their reports" ON public.export_meta;
CREATE POLICY "Teachers can manage export meta for their reports"
  ON public.export_meta
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.report_queue
      WHERE report_queue.id = export_meta.report_queue_id
      AND report_queue.created_by = auth.uid()
    )
  );

-- Step 8: RLS Policies for template_definitions
DROP POLICY IF EXISTS "Teachers can manage their own templates" ON public.template_definitions;
CREATE POLICY "Teachers can manage their own templates"
  ON public.template_definitions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
      AND template_definitions.teacher_id = auth.uid()
    )
  );

-- Step 9: Create trigger for updated_at on template_definitions
DROP TRIGGER IF EXISTS update_template_definitions_updated_at ON public.template_definitions;
CREATE TRIGGER update_template_definitions_updated_at
  BEFORE UPDATE ON public.template_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 10: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_meta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_definitions TO authenticated;

-- Step 11: Create function to generate share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create function to clean up expired reports (optional, can be run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_reports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete reports that have expired
  DELETE FROM public.report_queue
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

