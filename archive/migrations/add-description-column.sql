-- Add description column to activity_logs table
ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create an index on the description column for better search performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_description ON activity_logs(description);