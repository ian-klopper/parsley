-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin can view all activity logs" ON activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "System can insert activity logs" ON activity_logs
    FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON activity_logs TO authenticated;
GRANT ALL ON activity_logs TO service_role;